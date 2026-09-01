/* ==========================================================================
   RAW — نظام الإيدين (HandsSystem) · كلاس

   نورة بتمسك الأداة فعلاً: بتتعلّق في قبضة إيدها، وبتتحرك معاها، وبيترمي
   ظلها معاها. التقليب مش زرار — بتلفّ الماوس بحركة دائرية والسائل بيلفّ معاك.

   الأحداث بتترمي بطريقتين: `onAction(kind, info)` للي مركّب النظام (المطبخ
   بيوصّلها للواجهة)، و`hand:<kind>` على الناقل لأي حد تاني عايز يسمع.
   النظام **مبيسمعش** الأحداث اللي هو بيبثّها — ده كان هيعمل استدعاء متكرّر.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const bus   = () => RAW.core && RAW.core.bus;
  const store = () => RAW.core && RAW.core.state;
  const log   = () => RAW.core && RAW.core.logger;
  const sfx   = () => RAW.sfx;

  const REACH = 1.75;            // مدى وصول الإيد
  const SURFACE_Y = 0.95;        // وش الرخام
  const SHAKE_SECS = 3.4;
  const CLEAN_SECS = 2.2;
  /* مسافات بنجرّبها قدّام الشخصية لما نص المتر ما يلاقيش سطح */
  const DROP_PROBES = [0.75, 0.95, 1.15];

  class HandsSystem {
    /**
     * @param {Object} deps {THREE, scene, mats, fx, chef, drink, onAction}
     */
    constructor(deps) {
      const d = deps || {};
      if (!d.THREE || !d.scene || !d.mats || !d.chef || !d.drink) {
        const l = log(); if (l) l.error('HandsSystem: ناقص اعتماديات');
        throw new Error('HandsSystem: missing dependencies');
      }
      this.THREE = d.THREE;
      this.scene = d.scene;
      this.mats  = d.mats;
      this.fx    = d.fx;
      this.chef  = d.chef;
      this.drink = d.drink;
      this.onAction = d.onAction || null;
      this.L = RAW.layout || {};

      /* الأسطح اللي ينفع تسيب عليها حاجة */
      this.SURFACES = [
        { x0: -7.9,  x1: 7.9,   z0: -6.94, z1: -6.22, y: SURFACE_Y },  // السطح الخلفي
        { x0: -7.94, x1: -7.22, z0: -6.3,  z1: -1.3,  y: SURFACE_Y },  // السطح الشمال
        { x0: -2.3,  x1: 0.9,   z0: -1.6,  z1: -0.2,  y: SURFACE_Y },  // الجزيرة
        { x0: -4.95, x1: -3.25, z0: 1.93,  z1: 2.87,  y: 0.77 }        // ترابيزة الطعام
      ];
      this.SINK = new this.THREE.Vector3(-5.6, SURFACE_Y, this.L.backCounterZ);

      /* الحالة */
      this.items = [];
      this.held = null;
      this.near = null;
      this.tween = null;
      this.pouring = false;
      this.shaking = 0;
      this.cleaning = 0;
      this.stirMode = false;
      this.stirAngle = 0;
      this.stirTurns = 0;
      this.stirPower = 0;
      this.stirIdle = 0;
      this.ringOn = true;
      this._lastPt = null;
      this._centre = null;
      this._spillWarned = false;
      this._tmp = new this.THREE.Vector3();

      /* مربوطة مرة واحدة — لازم نفس المرجع عشان removeEventListener يشتغل */
      this._onStirMove = this._onStirMove.bind(this);

      this._buildRing();
      this._buildTools();

      const l = log(); if (l) l.debug('HandsSystem جاهز');
    }

    /* ==================== البناء ==================== */

    _buildRing() {
      const THREE = this.THREE;
      this.ringMat = new THREE.MeshBasicMaterial({
        color: 0x2FE0B0, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.115, 26), this.ringMat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.renderOrder = 3;
      this.scene.add(this.ring);
    }

    /** تسجيل أداة: مكانها الأصلي، وضعها في الإيد، وإيه اللي تعرف تعمله */
    _register(id, name, obj, cfg) {
      cfg = cfg || {};
      const THREE = this.THREE;
      obj.userData.grabId = id;
      const it = {
        id, name, obj,
        home: { p: obj.position.clone(), q: obj.quaternion.clone() },
        carry: cfg.carry || { p: new THREE.Vector3(0, -0.02, 0.04), e: new THREE.Euler(0, 0, 0) },
        pour: cfg.pour || null,          // { kind, color, temp, rate }
        stir: !!cfg.stir,
        shake: cfg.shake || null,        // { effect }
        dirty: false,
        held: false
      };
      this.items.push(it);
      return it;
    }

    _buildTools() {
      const THREE = this.THREE, scene = this.scene, L = this.L;
      const { C, M, box, cyl } = this.mats;
      const steel = M(C.steel, 0.3, 0.72);
      const dark = M(0x2A2521, 0.6);

      /* الكوباية نفسها — أهم حاجة تتمسك */
      this._register('cup', 'الكوباية', this.drink.group, {
        carry: { p: new THREE.Vector3(0, -0.06, 0.05), e: new THREE.Euler(0, 0, 0) },
        pour: { kind: 'drain', rate: 0.5 }, stir: false,
        shake: { effect: 'mix' }
      });

      /* مضرب الماتشا (Chasen) */
      const chasen = new THREE.Group();
      const chHandle = cyl(0.026, 0.03, 0.09, 12, M(0xD9C79A, 0.75));
      chHandle.position.y = 0.045; chasen.add(chHandle);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const tine = cyl(0.0035, 0.0035, 0.075, 5, M(0xE8DBB6, 0.7));
        tine.position.set(Math.cos(a) * 0.022, 0.125, Math.sin(a) * 0.022);
        tine.rotation.z = Math.cos(a) * 0.32;
        tine.rotation.x = -Math.sin(a) * 0.32;
        chasen.add(tine);
      }
      chasen.position.set(-1.15, SURFACE_Y, L.backCounterZ + 0.2);
      chasen.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(chasen);
      this._register('chasen', 'مضرب الماتشا', chasen, {
        carry: { p: new THREE.Vector3(0, -0.1, 0.03), e: new THREE.Euler(-0.5, 0, 0) },
        stir: true
      });

      /* إبريق اللبن */
      const jug = new THREE.Group();
      const jugBody = cyl(0.062, 0.052, 0.14, 18, steel);
      jugBody.position.y = 0.07; jug.add(jugBody);
      const jugSpout = box(0.04, 0.032, 0.04, steel);
      jugSpout.position.set(0, 0.135, 0.055); jugSpout.rotation.x = 0.55; jug.add(jugSpout);
      const jugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), steel);
      jugHandle.position.set(-0.08, 0.065, 0); jugHandle.rotation.y = Math.PI / 2; jug.add(jugHandle);
      const jugMilk = cyl(0.055, 0.05, 0.08, 16, M(0xF6EFE0, 0.35));
      jugMilk.position.y = 0.055; jug.add(jugMilk);
      jug.position.set(1.85, SURFACE_Y, L.backCounterZ + 0.16);
      jug.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(jug);
      this._register('jug', 'إبريق اللبن', jug, {
        carry: { p: new THREE.Vector3(0, -0.06, 0.05), e: new THREE.Euler(0, 0, 0) },
        pour: { kind: 'milk', color: 0xC79A6B, temp: 62, rate: 0.16 }
      });

      /* ملعقة التقليب الطويلة */
      const spoon = new THREE.Group();
      const spStick = cyl(0.006, 0.006, 0.19, 8, steel);
      spStick.position.y = 0.095; spoon.add(spStick);
      const spBowl = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), steel);
      spBowl.scale.set(1, 0.42, 1.35);
      spBowl.position.y = 0.008; spoon.add(spBowl);
      spoon.position.set(L.island.x + 0.55, SURFACE_Y, L.island.z + 0.3);
      spoon.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(spoon);
      this._register('spoon', 'ملعقة التقليب', spoon, {
        carry: { p: new THREE.Vector3(0, -0.12, 0.03), e: new THREE.Euler(-0.35, 0, 0) },
        stir: true
      });

      /* البورتافلتر */
      const porta = new THREE.Group();
      const pBasket = cyl(0.055, 0.05, 0.035, 16, steel);
      pBasket.position.y = 0.018; porta.add(pBasket);
      const pGrounds = cyl(0.048, 0.046, 0.016, 14, M(0x4A3120, 0.9));
      pGrounds.position.y = 0.03; porta.add(pGrounds);
      const pHandle = cyl(0.016, 0.016, 0.11, 10, dark);
      pHandle.rotation.z = Math.PI / 2;
      pHandle.position.set(0.08, 0.018, 0); porta.add(pHandle);
      porta.position.set(5.85, SURFACE_Y, L.backCounterZ + 0.22);
      porta.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(porta);
      this._register('porta', 'البورتافلتر', porta, {
        carry: { p: new THREE.Vector3(0, -0.05, 0.07), e: new THREE.Euler(0, 0, -0.3) },
        shake: { effect: 'knock' }
      });

      /* زجاجة السيرب */
      const bottle = new THREE.Group();
      const bBody = cyl(0.036, 0.036, 0.16, 14, M(0xC2334D, 0.32));
      bBody.position.y = 0.08; bottle.add(bBody);
      const bNeck = cyl(0.016, 0.016, 0.04, 10, M(0x241C16, 0.5));
      bNeck.position.y = 0.18; bottle.add(bNeck);
      bottle.position.set(6.35, SURFACE_Y, L.backCounterZ + 0.2);
      bottle.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(bottle);
      this._register('bottle', 'زجاجة السيرب', bottle, {
        carry: { p: new THREE.Vector3(0, -0.08, 0.05), e: new THREE.Euler(0, 0, 0) },
        pour: { kind: 'syrup', color: 0x7A2E3C, temp: 24, rate: 0.06 }
      });

      /* مصفاة الماتشا */
      const sieve = new THREE.Group();
      const svRim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 18), steel);
      svRim.rotation.x = Math.PI / 2; svRim.position.y = 0.02; sieve.add(svRim);
      const svMesh = cyl(0.05, 0.05, 0.002, 18, M(0xBFC4C8, 0.5, 0.4));
      svMesh.position.y = 0.02; sieve.add(svMesh);
      const svHandle = cyl(0.006, 0.006, 0.07, 8, steel);
      svHandle.rotation.z = Math.PI / 2;
      svHandle.position.set(0.08, 0.02, 0); sieve.add(svHandle);
      sieve.position.set(-1.95, SURFACE_Y, L.backCounterZ + 0.2);
      sieve.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(sieve);
      this._register('sieve', 'المصفاة', sieve, {
        carry: { p: new THREE.Vector3(0, -0.05, 0.06), e: new THREE.Euler(-0.25, 0, 0) },
        shake: { effect: 'sift' }
      });
    }

    /* ==================== مساعدات ==================== */

    _chefPos() { return this.chef.root.position; }

    _dist2D(v) {
      const p = this._chefPos();
      return Math.hypot(v.x - p.x, v.z - p.z);
    }

    _worldOf(it) {
      it.obj.getWorldPosition(this._tmp);
      return this._tmp.clone();
    }

    /** أقرب أداة في متناول الإيد */
    _candidate() {
      if (this.held) return null;
      let best = null, bd = REACH;
      this.items.forEach(it => {
        if (it.held) return;
        const d = this._dist2D(this._worldOf(it));
        if (d < bd) { bd = d; best = it; }
      });
      return best;
    }

    /** الكوباية لو كانت قريبة (سايبها على السطح) */
    _cupNear() {
      const cup = this.items[0];
      if (cup.held) return null;
      return this._dist2D(this._worldOf(cup)) < 1.4 ? cup : null;
    }

    /** أقرب سطح تحت نقطة */
    _surfaceAt(x, z) {
      for (let i = 0; i < this.SURFACES.length; i++) {
        const s = this.SURFACES[i];
        if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s.y;
      }
      return 0;
    }

    _startTween(obj, toP, toQ, dur) {
      this.tween = {
        obj, t: 0, dur: dur || 0.32,
        fromP: obj.position.clone(), fromQ: obj.quaternion.clone(),
        toP: toP.clone(), toQ: toQ.clone()
      };
    }

    /** بلاغ برّه: callback المطبخ + الناقل. مفيش اشتراك على نفس الأسماء دي. */
    _fire(kind, info) {
      const payload = info || {};
      if (this.onAction) this.onAction(kind, payload);
      const b = bus();
      if (b) b.emit('hand:' + kind, payload);
    }

    /* ==================== مسك وإفلات ==================== */

    grab() {
      if (this.held) return false;
      const it = this.near || this._candidate();
      if (!it) return false;
      this.chef.setPose('reach');
      this.chef.grip.attach(it.obj);            // بيحافظ على المكان في العالم
      const q = new this.THREE.Quaternion().setFromEuler(it.carry.e);
      this._startTween(it.obj, it.carry.p, q, 0.3);
      it.held = true;
      this.held = it;
      this._carryTimer = setTimeout(() => {
        if (this.held === it) this.chef.setPose('carry');
      }, 320);
      const s = sfx(); if (s) s.grab();
      const st = store(); if (st) st.set('heldTool', it.id);
      this._fire('grab', { id: it.id, name: it.name });
      return true;
    }

    /** مسك أداة معيّنة بالاسم (لو في متناول الإيد) */
    grabId(id) {
      if (this.held) return false;
      const it = this.items.filter(x => x.id === id)[0];
      if (!it || it.held) return false;
      if (this._dist2D(this._worldOf(it)) > REACH) return false;
      this.near = it;
      return this.grab();
    }

    drop() {
      if (!this.held) return false;
      const it = this.held;
      /* قدّامها، على أقرب سطح. بنجرّب أكتر من مسافة لأن مكان الوقوف عند
         المحطة بعيد ٦٢سم عن حرف الرخام — نص متر بس كان بيوقّع الأداة على
         الأرض قدّام الماكينة بدل ما يحطّها على السطح اللي هي واقفة قدّامه. */
      const p = this._chefPos();
      const fx2 = Math.sin(this.chef.root.rotation.y), fz = Math.cos(this.chef.root.rotation.y);
      let x = p.x + fx2 * 0.55, z = p.z + fz * 0.55, y = this._surfaceAt(x, z);
      if (y <= 0) {
        for (let i = 0; i < DROP_PROBES.length; i++) {
          const r = DROP_PROBES[i];
          const px = p.x + fx2 * r, pz = p.z + fz * r;
          const py = this._surfaceAt(px, pz);
          if (py > 0) { x = px; z = pz; y = py; break; }
        }
      }
      this.scene.attach(it.obj);
      this._startTween(it.obj, new this.THREE.Vector3(x, y, z), it.home.q.clone(), 0.28);
      it.held = false;
      this.held = null;
      this.pouring = false; this.shaking = 0;
      if (this.stirMode) this.stirToggle(false);
      this.chef.setPose('idle');
      const s = sfx(); if (s) s.drop();
      const st = store(); if (st) st.set('heldTool', null);
      this._fire('drop', { id: it.id, name: it.name, onSurface: y > 0.1 });
      return true;
    }

    /* ==================== الصبّ ==================== */

    pourStart() {
      if (this.pouring) return false;
      if (!this.held || !this.held.pour) return false;
      this.pouring = true;
      this.chef.setPose('pour');
      const s = sfx();
      if (s) s.pour({ from: this.drink.level, to: Math.min(1, this.drink.level + 0.25), secs: 1.4 });
      this._fire('pour-start', { id: this.held.id });
      return true;
    }

    pourStop() {
      if (!this.pouring) return false;
      this.pouring = false;
      this.chef.setPose(this.held ? 'carry' : 'idle');
      this._fire('pour-stop', { id: this.held ? this.held.id : null });
      return true;
    }

    _pourStep(dt) {
      if (!this.pouring || !this.held) return;
      const src = this.held.pour;
      if (src.kind === 'drain') {
        // بتفرّغ الكوباية
        if (this.drink.level <= 0.001) { this.pourStop(); return; }
        this.drink.drain(src.rate * dt);
        this.held.dirty = true;
      } else {
        const target = this.held.id === 'cup' ? null : this._cupNear();
        if (!target && this.held.id !== 'cup') {
          // مفيش كوباية قريبة — بتتكب على السطح
          if (!this._spillWarned) { this._fire('spill', { id: this.held.id }); this._spillWarned = true; }
          return;
        }
        this._spillWarned = false;
        this.drink.pour({ amount: src.rate * dt, color: src.color, tempC: src.temp });
        this.held.dirty = true;
      }
    }

    /* ==================== الرجّ ==================== */

    shakeStart() {
      if (this.shaking) return false;
      if (!this.held || !this.held.shake) return false;
      this.shaking = 0.0001;
      this.chef.setPose('shake');
      const s = sfx(); if (s) s.shake();
      this._fire('shake-start', { id: this.held.id });
      return true;
    }

    shakeStop(done) {
      if (!this.shaking) return false;
      const p = Math.min(1, this.shaking / SHAKE_SECS);
      this.shaking = 0;
      this.chef.setPose(this.held ? 'carry' : 'idle');
      this._fire('shake-stop', {
        id: this.held ? this.held.id : null, progress: +p.toFixed(2), done: !!done
      });
      return true;
    }

    _shakeStep(dt) {
      if (!this.shaking || !this.held) return;
      this.shaking += dt;
      const it = this.held;
      // اهتزاز سريع محسوس
      it.obj.position.x = it.carry.p.x + (Math.random() - 0.5) * 0.02;
      it.obj.position.y = it.carry.p.y + (Math.random() - 0.5) * 0.02;
      if (this.shaking >= SHAKE_SECS) {
        const eff = it.shake.effect;
        if (eff === 'mix') this.drink.stir();
        else if (eff === 'sift') this.drink.pour({ amount: 0.02, color: 0x6E8B3D });
        else if (eff === 'knock') it.dirty = false;
        const s = sfx(); if (s) s.confirm();
        this.shakeStop(true);
      }
    }

    /* ==================== التقليب بحركة دائرية ==================== */

    stirToggle(on) {
      const want = on == null ? !this.stirMode : !!on;
      if (want) {
        if (this.stirMode) return false;
        if (!this.held || !this.held.stir) return false;
        if (!this._cupNear() && !this.items[0].held) return false;
        this.stirMode = true;
        this.stirTurns = 0; this.stirPower = 0; this.stirIdle = 0;
        this._lastPt = null; this._centre = null;
        RAW.stirring = true;                    // الكاميرا بتبطّل تلف وإحنا بنقلّب
        this.chef.setPose('stir');
        addEventListener('pointermove', this._onStirMove);
        this._fire('stir-start', { id: this.held.id });
      } else {
        if (!this.stirMode) return false;
        this.stirMode = false;
        RAW.stirring = false;
        removeEventListener('pointermove', this._onStirMove);
        this.chef.setPose(this.held ? 'carry' : 'idle');
        this._fire('stir-stop', {
          turns: +this.stirTurns.toFixed(2), power: +this.stirPower.toFixed(2)
        });
      }
      return true;
    }

    /* الدوران بيتقاس من الزاوية حوالين مركز متحرّك للحركة */
    _onStirMove(e) {
      const pt = { x: e.clientX, y: e.clientY };
      if (!this._centre) this._centre = { x: pt.x, y: pt.y };
      this._centre.x += (pt.x - this._centre.x) * 0.06;   // المركز بيتبع الحركة ببطء
      this._centre.y += (pt.y - this._centre.y) * 0.06;
      if (this._lastPt) {
        const a1 = Math.atan2(this._lastPt.y - this._centre.y, this._lastPt.x - this._centre.x);
        const a2 = Math.atan2(pt.y - this._centre.y, pt.x - this._centre.x);
        let d = a2 - a1;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const r = Math.hypot(pt.x - this._centre.x, pt.y - this._centre.y);
        if (r > 18) {                             // الحركات الصغيرة مش دوران
          this.stirAngle += d;
          this.stirTurns += Math.abs(d) / (Math.PI * 2);
          this.stirPower = Math.min(1, this.stirPower + Math.abs(d) * 0.55);
          this.stirIdle = 0;
        }
      }
      this._lastPt = pt;
    }

    _stirStep(dt) {
      if (!this.stirMode) return;
      const ds = this.drink.state;
      this.stirIdle += dt;
      this.stirPower = Math.max(0, this.stirPower - dt * 0.85);
      if (this.stirPower > 0.08) {
        ds.swirl = Math.max(ds.swirl, this.stirPower * 2.4);
        ds.wobble = Math.min(1, ds.wobble + this.stirPower * dt * 2.2);
        if (this.held && this.held.id === 'chasen') {
          ds.foam = Math.min(1, (ds.foam || 0) + this.stirPower * dt * 0.5);
        }
        if (this.held) this.held.dirty = true;
        const s = sfx();
        if (s && Math.random() < dt * 6) s.stirTick(this.stirPower);
      }
      // الأداة بتلف مع الحركة
      if (this.held) {
        this.held.obj.rotation.z = Math.sin(this.stirAngle) * 0.28;
        this.held.obj.rotation.x = this.held.carry.e.x + Math.cos(this.stirAngle) * 0.2;
      }
      if (this.stirIdle > 2.5) this.stirToggle(false);      // سكوت طويل = خلاص
    }

    /* ==================== التنظيف ==================== */

    cleanStart() {
      if (this.cleaning) return false;
      if (!this.held) return false;
      if (this._dist2D(this.SINK) > 1.9) { this._fire('clean-far', {}); return false; }
      this.cleaning = 0.0001;
      this.chef.setPose('shake');
      this._fire('clean-start', { id: this.held.id });
      return true;
    }

    cleanStop() {
      this.cleaning = 0;
      if (this.held) this.chef.setPose('carry');
    }

    _cleanStep(dt) {
      if (!this.cleaning || !this.held) return;
      this.cleaning += dt;
      const s = sfx();
      if (s && Math.random() < dt * 4) s.water();
      if (this.cleaning >= CLEAN_SECS) {
        this.held.dirty = false;
        if (this.held.id === 'cup') this.drink.reset();
        this.cleaning = 0;
        this.chef.setPose('carry');
        if (s) s.confirm();
        this._fire('clean-done', { id: this.held.id });
      }
    }

    /* ==================== التحديث ==================== */

    update(dt) {
      // انتقال الأداة وهي بتتمسك أو تتساب
      if (this.tween) {
        const tw = this.tween;
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOutQuad
        tw.obj.position.lerpVectors(tw.fromP, tw.toP, e);
        tw.obj.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, e);
        if (k >= 1) this.tween = null;
      }

      // الحلقة الخضرا حوالين الأداة اللي في متناول الإيد
      const cand = this._candidate();
      if (cand !== this.near) {
        this.near = cand;
        const st = store(); if (st) st.set('nearTool', cand ? cand.id : null);
        this._fire('near', this.near ? { id: this.near.id, name: this.near.name } : null);
      }
      if (!this.ringOn) {
        this.ring.visible = false;
      } else if (this.near && !this.tween) {
        const w = this._worldOf(this.near);
        this.ring.visible = true;
        this.ring.position.set(w.x, Math.max(0.02, w.y - 0.005), w.z);
        this.ringMat.opacity = 0.42 + Math.sin(performance.now() * 0.005) * 0.16;
      } else {
        this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 2);
      }

      // الأداة المتمسكة بتميل وهي بتصبّ
      if (this.held && !this.tween) {
        const tilt = this.pouring ? -1.15 : 0;
        const rz = this.held.obj.rotation.z;
        this.held.obj.rotation.z += (tilt + (this.stirMode ? rz : 0) - rz) * Math.min(1, dt * 6);
        if (!this.shaking && !this.stirMode) {
          this.held.obj.position.lerp(this.held.carry.p, Math.min(1, dt * 8));
        }
      }

      this._pourStep(dt);
      this._shakeStep(dt);
      this._stirStep(dt);
      this._cleanStep(dt);
    }

    /* ==================== قراءات ==================== */

    state() {
      const h = this.held, n = this.near;
      return {
        held: h ? { id: h.id, name: h.name, dirty: h.dirty,
                    canPour: !!h.pour, canShake: !!h.shake, canStir: !!h.stir } : null,
        near: n ? { id: n.id, name: n.name } : null,
        pouring: this.pouring, stirring: this.stirMode,
        shakeProgress: this.shaking ? Math.min(1, this.shaking / SHAKE_SECS) : 0,
        cleanProgress: this.cleaning ? Math.min(1, this.cleaning / CLEAN_SECS) : 0,
        stirTurns: +this.stirTurns.toFixed(2), stirPower: +this.stirPower.toFixed(2),
        atSink: this._dist2D(this.SINK) < 1.9
      };
    }

    /** مكان أداة في العالم (للمهام التلقائية) */
    pos(id) {
      const it = this.items.filter(x => x.id === id)[0];
      return it ? this._worldOf(it) : null;
    }

    /** الأداة دي في إيدها دلوقتي؟ */
    holding(id) { return !!this.held && this.held.id === id; }

    /** إخفاء مؤشر التحديد (وضع المشاهدة) */
    setRingVisible(v) { this.ringOn = !!v; this.ring.visible = this.ringOn; }

    /* ==================== التنظيف ==================== */

    dispose() {
      removeEventListener('pointermove', this._onStirMove);
      clearTimeout(this._carryTimer);
      RAW.stirring = false;
      this.scene.remove(this.ring);
      /* الأدوات نفسها بتفضل في المشهد — `raw-kitchen.destroy()` بيمشي على
         المشهد كله ويحرّر الهندسات والخامات، فلو شلناها هنا كانت هتتسرّب. */
    }
  }

  HandsSystem.REACH = REACH;
  HandsSystem.SHAKE_SECS = SHAKE_SECS;

  RAW.systems = RAW.systems || {};
  RAW.systems.HandsSystem = HandsSystem;

  /* اسم قديم متوافق: `RAW.hands(THREE, scene, mats, fx, {chef, drink, onAction})` */
  RAW.hands = (THREE, scene, mats, fx, opts) => new HandsSystem(
    Object.assign({ THREE, scene, mats, fx }, opts || {}));
})(window);
