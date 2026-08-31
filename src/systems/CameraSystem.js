/* ==========================================================================
   RAW — نظام الكاميرا (CameraSystem) · كلاس

   لقطة واسعة تبدأ منها التجربة، ولقطة قريبة للمحطة عند التفاعل بس. السحب
   يدوّر ٣٦٠° حوالين نورة، عجلة الماوس تقرّب، والقرصة بصباعين على اللمس،
   والحدود مقفولة عشان الكاميرا ما تخرجش ورا الجدران.

   ملاحظة معمارية: الزوايا اللي المستخدم بيحرّكها (`_yaw`/`_pitch`/`_dist`)
   هي اللي بتتسلّس، والمكان بيتحسب منها كل فريم — كده الكاميرا بتمشي على قوس
   حوالين الشخصية بدل ما تقطع من نص الأوضة.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const bus = () => RAW.core && RAW.core.bus;
  const log = () => RAW.core && RAW.core.logger;

  const ORBIT_Y = 1.35;         // ارتفاع نقطة الدوران (فوق كتفها شوية)

  /* إعدادات اللقطة حسب نسبة الشاشة — زاوية أوسع ومسافة أقرب = منظور أقوى */
  const SCREENS = [
    { min: 1.4,  b: 'wide',  spread: 1,    drop: 0,    fov: 54, maxY: 3.9, pMax: 0.75, pitch: 0.17 },
    { min: 1.0,  b: 'mid',   spread: 1.1,  drop: 0.1,  fov: 58, maxY: 4.2, pMax: 0.8,  pitch: 0.2 },
    { min: 0.75, b: 'tall',  spread: 1.15, drop: 0.15, fov: 54, maxY: 4.8, pMax: 0.85, pitch: 0.32 },
    // موبايل طولي: الكاميرا بتعلى فوق الحيطة وتبص جوه الأوضة زي بيت الدمية
    { min: -1,   b: 'phone', spread: 1.05, drop: -0.2, fov: 48, maxY: 9.2, pMax: 0.95, pitch: 0.52 }
  ];

  class CameraSystem {
    /**
     * @param {Object} deps {THREE, camera, domElement, onTap}
     */
    constructor(deps) {
      const d = deps || {};
      if (!d.THREE || !d.camera || !d.domElement) {
        const l = log(); if (l) l.error('CameraSystem: ناقص اعتماديات');
        throw new Error('CameraSystem: missing dependencies');
      }
      const THREE = this.THREE = d.THREE;
      this.cam = d.camera;
      this.dom = d.domElement;
      this.onTap = d.onTap || null;

      /* اللقطة الواسعة الافتراضية */
      this.WIDE = { target: new THREE.Vector3(0, 1.5, -2.9), dist: 7.6, yaw: 0, pitch: 0.17 };
      // مفيش حد لليمين والشمال: لفّة كاملة ٣٦٠ حوالين الشخصية
      this.LIMIT = { pitchMin: 0.02, pitchMax: 0.95, distMin: 3.2, distMax: 16 };
      // حدود الأوضة اللي الكاميرا ما تخرجش منها
      this.BOX = { x0: -7.3, x1: 7.3, z0: -6.2, z1: 10.5, y0: 0.75 };

      /* المدار اللي المستخدم بيحرّكه — بيتطبّق على اللقطة الواسعة.
         مسمّيين بشرطة سفلية عشان `yaw()` تفضل دالة زي الأول. */
      this._yaw = this.WIDE.yaw;
      this._pitch = this.WIDE.pitch;
      this._dist = this.WIDE.dist;

      // الشاشات الطولية بتضيّق مجال الرؤية الأفقي، فبنبعد الكاميرا شوية
      this.spread = 1;
      this.drop = 0;               // بنوطّي نقطة النظر في الشاشات الطولية
      this.maxY = 3.9;             // أقصى ارتفاع للكاميرا (بيعلى في الطولي)
      this.bucket = '';            // نوع الشاشة الحالي (عرضي/طولي)

      this.focus = null;           // المحطة اللي الكاميرا مركّزة عليها
      this._roll = 0;
      this._breath = 0;            // نَفَس دخول بطيء
      this._loose = true;          // محتاجين نعيد قراءة الزوايا من مكان الكاميرا
      this._blocked = 0;           // قد إيه الحيطة قرّبت الكاميرا (٠..١)

      // النسخة الناعمة من زوايا الدوران
      this._yawS = 0; this._pitchS = 0.22; this._distS = 9.5;

      this.target = this.WIDE.target.clone();
      this._targetS = new THREE.Vector3(0, 1.35, 0);
      this._wantPos = new THREE.Vector3();
      this._wantTarget = new THREE.Vector3();
      this._dirV = new THREE.Vector3();
      this._lookDown = new THREE.Vector3(0, -0.34, 0);   // إزاحة نقطة النظر
      this._off = new THREE.Vector3();

      /* إدخال */
      this._down = false; this._dragged = false;
      this._sx = 0; this._sy = 0; this._lx = 0; this._ly = 0;
      this._downAt = 0; this._pid = null;
      this._touches = {}; this._pinch0 = 0;

      /* مربوطين مرة واحدة — نفس المرجع لازم للإزالة */
      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
      this._onTouchDown = this._onTouchDown.bind(this);
      this._onTouchMove = this._onTouchMove.bind(this);
      this._onTouchUp = this._onTouchUp.bind(this);
      this._bindDOM();

      // ابدأ في مكان اللقطة الواسعة بالظبط، من غير أي انتقال في أول frame
      this._widePos(this.cam.position);
      this.cam.lookAt(this.target);

      const l = log(); if (l) l.debug('CameraSystem جاهز');
    }

    /* ==================== حساب المكان ==================== */

    /**
     * مكان الكاميرا = نقطة الدوران + إزاحة كروية. لو الإزاحة هتطلّعها بره
     * الأوضة بنقصّرها لحد الحيطة (زي camera collision في الألعاب) بدل ما
     * المستخدم يلاقي نفسه بيبص من ورا الحيطة.
     */
    _orbitPos(out, t, yawA, pitchA, distA) {
      const B = this.BOX;
      const d = (distA == null ? this._dist : distA) * this.spread;
      const yawU = yawA == null ? this._yaw : yawA;
      const pitchU = pitchA == null ? this._pitch : pitchA;
      // لو الحيطة قرّبت الكاميرا، بنعلّيها شوية عشان تبصّ من فوق الحاجز
      // بدل ما تتحشر جنبه — نفس اللي بيحصل في كاميرات الألعاب.
      const rough = Math.min(1, this._blocked);
      const p2 = Math.min(this.LIMIT.pitchMax, pitchU + rough * 0.4);
      this._dirV.set(Math.sin(yawU) * Math.cos(p2), Math.sin(p2), Math.cos(yawU) * Math.cos(p2));

      let max = d;
      // أقصى مسافة قبل ما نخرج من صندوق الأوضة
      const lim = (p, v, lo, hi) => {
        if (Math.abs(v) < 1e-4) return Infinity;
        const t1 = ((v > 0 ? hi : lo) - p) / v;
        return t1 > 0 ? t1 : Infinity;
      };
      max = Math.min(max, lim(t.x, this._dirV.x, B.x0, B.x1));
      max = Math.min(max, lim(t.z, this._dirV.z, B.z0, B.z1));
      max = Math.min(max, lim(t.y, this._dirV.y, B.y0, this.maxY));
      max = Math.max(1.8, max - 0.12);
      this._blocked = Math.max(0, 1 - max / d);      // بيتقاس للفريم اللي بعده
      out.copy(t).addScaledVector(this._dirV, Math.min(d, max));
      return out;
    }

    _widePos(out) {
      this.target.set(0, ORBIT_Y, 0);
      this._targetS.copy(this.target);
      this._yawS = this._yaw; this._pitchS = this._pitch; this._distS = this._dist;
      return this._orbitPos(out, this.target, this._yawS, this._pitchS, this._distS);
    }

    static _shortAngle(from, to) {
      let d = to - from;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    /* ==================== التركيز ==================== */

    setFocus(st) {
      const was = this.focus;
      if (st !== this.focus) this._breath = 0;
      if (this.focus && !st) this._loose = true;   // راجعين للدوران: اقرا الزوايا من مكانها
      this.focus = st || null;
      if (was !== this.focus) {
        const b = bus();
        if (b) b.emit('camera:focus', this.focus ? this.focus.id : null);
      }
    }

    isFocused() { return !!this.focus; }

    /** يرجّع الكاميرا لزاويتها الافتراضية (من غير نطّة — بتلف لحد هناك) */
    reset() {
      this._yaw = this.WIDE.yaw;
      this._pitch = this.WIDE.pitch;
      this._dist = this.WIDE.dist;
      const b = bus();
      if (b) b.emit('camera:reset', null);
      return true;
    }

    /** الزاوية الأفقية الحالية — الحركة بالكيبورد بتتحسب منها */
    yaw() { return this._yaw; }

    /* ==================== التحديث ==================== */

    update(dt, chefPos) {
      const cam = this.cam, target = this.target;

      if (this.focus) {
        // لقطة قريبة: قدّام المحطة، بتبص على قلبها، مع دخول بطيء (push-in)
        this._breath += dt;
        const push = RAW.reduceMotion ? 1 : 1 - Math.min(0.06, this._breath * 0.02);
        this._wantTarget.copy(this.focus.obj.position).add(this._lookDown);
        this._wantPos.copy(this.focus.obj.position).addScaledVector(this.focus.view, push);
        const k = 1 - Math.exp(-2 * dt);        // دخول أبطأ = إحساس درامي
        cam.position.lerp(this._wantPos, k);
        target.lerp(this._wantTarget, k);
        this._loose = true;                     // لما نخرج من التركيز نبدأ من هنا
      } else {
        this._breath = 0;
        /* الدوران: بنسلّس الزاوية والمسافة، والمكان بيتحسب منهم — كده الكاميرا
           بتمشي على قوس حوالين نورة ومش بتقطع من نص الأوضة وهي بتلف. */
        if (this._loose) {
          // جايين من لقطة قريبة: نبدأ من زاوية الكاميرا الحالية عشان ما تنطّش
          const off = this._off.copy(cam.position).sub(target);
          const len = Math.max(0.001, off.length());
          this._distS = Math.max(1.5, len / Math.max(0.001, this.spread));
          this._pitchS = Math.asin(Math.max(-1, Math.min(1, off.y / len)));
          this._yawS = Math.atan2(off.x, off.z);
          this._targetS.copy(target);
          this._loose = false;
        }
        this._wantTarget.set(
          chefPos ? chefPos.x : 0,
          ORBIT_Y - this.drop * 0.5,
          chefPos ? chefPos.z : 0);
        const kt = 1 - Math.exp(-5 * dt);
        this._targetS.lerp(this._wantTarget, kt);
        const ka = 1 - Math.exp(-7 * dt);
        this._yawS += CameraSystem._shortAngle(this._yawS, this._yaw) * ka;
        this._pitchS += (this._pitch - this._pitchS) * ka;
        this._distS += (this._dist - this._distS) * ka;
        this._orbitPos(cam.position, this._targetS, this._yawS, this._pitchS, this._distS);
        target.copy(this._targetS);
      }

      // إبقاء الكاميرا جوه حدود معقولة — ما تدخلش جدار ولا تنزل تحت الأرض
      const B = this.BOX;
      cam.position.y = Math.max(B.y0, Math.min(this.maxY, cam.position.y));
      cam.position.x = Math.max(B.x0, Math.min(B.x1, cam.position.x));
      cam.position.z = Math.max(B.z0, Math.min(B.z1, cam.position.z));
      cam.lookAt(target);

      // Dutch angle: ميلة بسيطة ناحية العكس من زاوية اللقطة — دراما من غير دوخة
      const wantRoll = (this.focus && !RAW.reduceMotion)
        ? (this.focus.view.x >= 0 ? -0.042 : 0.042) : 0;
      this._roll += (wantRoll - this._roll) * Math.min(1, dt * 2.2);
      cam.rotateZ(this._roll);
    }

    /* ==================== التكيّف مع الشاشة ==================== */

    /** بيتنده من الـresize: بيرجّع زاوية الرؤية المناسبة للنسبة الجديدة */
    fit(aspect) {
      let cfg = SCREENS[SCREENS.length - 1];
      for (let i = 0; i < SCREENS.length; i++) {
        if (aspect >= SCREENS[i].min) { cfg = SCREENS[i]; break; }
      }
      this.spread = cfg.spread;
      this.drop = cfg.drop;
      this.maxY = cfg.maxY;
      this.LIMIT.pitchMax = cfg.pMax;
      if (cfg.b !== this.bucket) {
        // اتغيّر اتجاه الشاشة: نرجّع الزاوية للوضع المناسب ونقفز مكانها فوراً
        this.bucket = cfg.b;
        this._pitch = cfg.pitch;
        if (!this.focus) { this._widePos(this.cam.position); this.cam.lookAt(this.target); }
      } else {
        this._pitch = Math.min(this._pitch, this.LIMIT.pitchMax);
      }
      return cfg.fov;
    }

    /* ==================== الإدخال ==================== */

    _bindDOM() {
      const dom = this.dom;
      dom.addEventListener('pointerdown', this._onDown);
      dom.addEventListener('pointermove', this._onMove);
      dom.addEventListener('pointerup', this._onUp);
      dom.addEventListener('pointercancel', this._onUp);
      dom.addEventListener('wheel', this._onWheel, { passive: false });
      dom.addEventListener('pointerdown', this._onTouchDown);
      dom.addEventListener('pointermove', this._onTouchMove);
      dom.addEventListener('pointerup', this._onTouchUp);
      dom.addEventListener('pointercancel', this._onTouchUp);
    }

    _onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      this._down = true; this._dragged = false;
      this._sx = this._lx = e.clientX;
      this._sy = this._ly = e.clientY;
      this._downAt = performance.now();
      this._pid = e.pointerId;
      if (this.dom.setPointerCapture && this._pid != null) {
        try { this.dom.setPointerCapture(this._pid); } catch (err) {}
      }
    }

    _onMove(e) {
      if (!this._down) return;
      if (RAW.stirring) return;          // الحركة دي تقليب مش تدوير كاميرا
      const dx = e.clientX - this._lx, dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      if (Math.abs(e.clientX - this._sx) + Math.abs(e.clientY - this._sy) > 6) this._dragged = true;
      if (!this._dragged) return;
      this._yaw -= dx * 0.0042;                       // لفّة كاملة من غير حدود
      if (this._yaw > Math.PI) this._yaw -= Math.PI * 2;
      if (this._yaw < -Math.PI) this._yaw += Math.PI * 2;
      this._pitch = Math.max(this.LIMIT.pitchMin,
        Math.min(this.LIMIT.pitchMax, this._pitch + dy * 0.0028));
    }

    _onUp(e) {
      if (!this._down) return;
      this._down = false;
      if (this._pid != null && this.dom.releasePointerCapture) {
        try { this.dom.releasePointerCapture(this._pid); } catch (err) {}
      }
      this._pid = null;
      // دوسة سريعة من غير سحب = تحديد نقطة على الأرض أو محطة
      if (!this._dragged && performance.now() - this._downAt < 500 && this.onTap) this.onTap(e);
    }

    _onWheel(e) {
      e.preventDefault();
      this.zoom(e.deltaY * 0.006);
    }

    zoom(d) {
      this._dist = Math.max(this.LIMIT.distMin,
        Math.min(this.LIMIT.distMax, this._dist + d));
    }

    /* قرصة بصباعين على اللمس = تقريب وتبعيد */
    _onTouchDown(e) {
      if (e.pointerType !== 'touch') return;
      this._touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(this._touches);
      if (ids.length === 2) this._pinch0 = this._pinchSpread(ids);
    }

    _onTouchMove(e) {
      if (e.pointerType !== 'touch' || !this._touches[e.pointerId]) return;
      this._touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(this._touches);
      if (ids.length !== 2) return;
      const d = this._pinchSpread(ids);
      if (this._pinch0) this.zoom((this._pinch0 - d) * 0.02);
      this._pinch0 = d;
      this._dragged = true;                       // قرصة مش دوسة
    }

    _onTouchUp(e) {
      delete this._touches[e.pointerId];
      if (Object.keys(this._touches).length < 2) this._pinch0 = 0;
    }

    _pinchSpread(ids) {
      const a = this._touches[ids[0]], b = this._touches[ids[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /* ==================== التنظيف ==================== */

    dispose() {
      const dom = this.dom;
      dom.removeEventListener('pointerdown', this._onDown);
      dom.removeEventListener('pointermove', this._onMove);
      dom.removeEventListener('pointerup', this._onUp);
      dom.removeEventListener('pointercancel', this._onUp);
      dom.removeEventListener('wheel', this._onWheel);
      dom.removeEventListener('pointerdown', this._onTouchDown);
      dom.removeEventListener('pointermove', this._onTouchMove);
      dom.removeEventListener('pointerup', this._onTouchUp);
      dom.removeEventListener('pointercancel', this._onTouchUp);
      this._touches = {};
    }
  }

  RAW.systems = RAW.systems || {};
  RAW.systems.CameraSystem = CameraSystem;

  /* اسم قديم متوافق: `RAW.cameraRig(THREE, cam, dom, onTap)` */
  RAW.cameraRig = (THREE, cam, dom, onTap) =>
    new CameraSystem({ THREE, camera: cam, domElement: dom, onTap });
})(window);
