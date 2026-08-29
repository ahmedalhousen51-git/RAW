/* ==========================================================================
   RAW — الكاميرا: لقطة واسعة تبدأ منها التجربة، ولقطة قريبة للمحطة عند
   التفاعل بس. السحب يدوّر، عجلة الماوس تقرّب، والحدود مقفولة عشان
   ما تخرجش ورا الجدران.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.cameraRig = function (THREE, cam, dom, onTap) {
    const WIDE = {
      target: new THREE.Vector3(0, 1.5, -2.9),
      dist: 7.6, yaw: 0, pitch: 0.17
    };
    // مفيش حد لليمين والشمال: لفّة كاملة ٣٦٠ حوالين الشخصية
    const LIMIT = { pitchMin: 0.02, pitchMax: 0.95, distMin: 3.2, distMax: 16 };
    // حدود الأوضة اللي الكاميرا ما تخرجش منها
    const BOX = { x0: -7.3, x1: 7.3, z0: -6.2, z1: 10.5, y0: 0.75 };
    const ORBIT_Y = 1.35;         // ارتفاع نقطة الدوران (فوق كتفها شوية)

    // المدار اللي المستخدم بيحرّكه — بيتطبّق على اللقطة الواسعة
    let yaw = WIDE.yaw, pitch = WIDE.pitch, dist = WIDE.dist;
    // الشاشات الطولية بتضيّق مجال الرؤية الأفقي، فبنبعد الكاميرا شوية
    let spread = 1, drop = 0;      // drop = بنوطّي نقطة النظر في الشاشات الطولية
    let maxY = 3.9;                // أقصى ارتفاع للكاميرا (بيعلى في الطولي)
    let bucket = '';               // نوع الشاشة الحالي (عرضي/طولي)
    let focus = null;                       // المحطة اللي الكاميرا مركّزة عليها
    let roll = 0, breath = 0;               // ميلة درامية خفيفة ونَفَس دخول بطيء
    let loose = true;                       // محتاجين نعيد قراءة الزوايا من مكان الكاميرا
    const target = WIDE.target.clone();
    const wantPos = new THREE.Vector3();
    const wantTarget = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    /* مكان الكاميرا = نقطة الدوران + إزاحة كروية. لو الإزاحة هتطلّعها بره
       الأوضة بنقصّرها لحد الحيطة (زي camera collision في الألعاب) بدل ما
       المستخدم يلاقي نفسه بيبص من ورا الحيطة. */
    const dirV = new THREE.Vector3();
    let blockedAmount = 0;         // قد إيه الحيطة قرّبت الكاميرا (٠..١)
    // النسخة الناعمة من زوايا الدوران — الكاميرا بتلف على قوس مش خط مستقيم
    let yawS = 0, pitchS = 0.22, distS = 9.5;
    const targetS = new THREE.Vector3(0, 1.35, 0);
    const shortAngle = (from, to) => {
      let d = to - from;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    function orbitPos(out, t, yawA, pitchA, distA) {
      const d = (distA == null ? dist : distA) * spread;
      const yawU = yawA == null ? yaw : yawA;
      const pitchU = pitchA == null ? pitch : pitchA;
      // لو الحيطة قرّبت الكاميرا، بنعلّيها شوية عشان تبصّ من فوق الحاجز
      // بدل ما تتحشر جنبه — نفس اللي بيحصل في كاميرات الألعاب.
      const rough = Math.min(1, blockedAmount);
      const p2 = Math.min(LIMIT.pitchMax, pitchU + rough * 0.4);
      dirV.set(Math.sin(yawU) * Math.cos(p2), Math.sin(p2), Math.cos(yawU) * Math.cos(p2));
      let max = d;
      // أقصى مسافة قبل ما نخرج من صندوق الأوضة
      const lim = (p, v, lo, hi) => {
        if (Math.abs(v) < 1e-4) return Infinity;
        const t1 = ((v > 0 ? hi : lo) - p) / v;
        return t1 > 0 ? t1 : Infinity;
      };
      max = Math.min(max, lim(t.x, dirV.x, BOX.x0, BOX.x1));
      max = Math.min(max, lim(t.z, dirV.z, BOX.z0, BOX.z1));
      max = Math.min(max, lim(t.y, dirV.y, BOX.y0, maxY));
      max = Math.max(1.8, max - 0.12);
      blockedAmount = Math.max(0, 1 - max / d);      // بيتقاس للفريم اللي بعده
      out.copy(t).addScaledVector(dirV, Math.min(d, max));
      return out;
    }

    // ابدأ في مكان اللقطة الواسعة بالظبط، من غير أي انتقال في أول frame
    function widePos(out) {
      target.set(0, ORBIT_Y, 0);
      targetS.copy(target);
      yawS = yaw; pitchS = pitch; distS = dist;
      return orbitPos(out, target, yawS, pitchS, distS);
    }
    widePos(cam.position, 0);
    cam.lookAt(target);

    /* ---------- إدخال: سحب للتدوير، عجلة للتقريب، ودوسة للأرض ---------- */
    let down = false, dragged = false, sx = 0, sy = 0, lx = 0, ly = 0, downAt = 0;
    let pid = null;

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      down = true; dragged = false;
      sx = lx = e.clientX; sy = ly = e.clientY;
      downAt = performance.now();
      pid = e.pointerId;
      if (dom.setPointerCapture && pid != null) { try { dom.setPointerCapture(pid); } catch (err) {} }
    }
    function onMove(e) {
      if (!down) return;
      if (RAW.stirring) return;          // الحركة دي تقليب مش تدوير كاميرا
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) dragged = true;
      if (!dragged) return;
      yaw -= dx * 0.0042;                       // لفّة كاملة من غير حدود
      if (yaw > Math.PI) yaw -= Math.PI * 2;
      if (yaw < -Math.PI) yaw += Math.PI * 2;
      pitch = Math.max(LIMIT.pitchMin, Math.min(LIMIT.pitchMax, pitch + dy * 0.0028));
    }
    function onUp(e) {
      if (!down) return;
      down = false;
      if (pid != null && dom.releasePointerCapture) { try { dom.releasePointerCapture(pid); } catch (err) {} }
      pid = null;
      // دوسة سريعة من غير سحب = تحديد نقطة على الأرض أو محطة
      if (!dragged && performance.now() - downAt < 500 && onTap) onTap(e);
    }
    function onWheel(e) {
      e.preventDefault();
      zoom(e.deltaY * 0.006);
    }
    function zoom(d) {
      dist = Math.max(LIMIT.distMin, Math.min(LIMIT.distMax, dist + d));
    }

    /* قرصة بصباعين على اللمس = تقريب وتبعيد */
    const touches = {};
    let pinch0 = 0;
    function onTouchDown(e) {
      if (e.pointerType !== 'touch') return;
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(touches);
      if (ids.length === 2) pinch0 = pinchSpread(ids);
    }
    function onTouchMove(e) {
      if (e.pointerType !== 'touch' || !touches[e.pointerId]) return;
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(touches);
      if (ids.length !== 2) return;
      const d = pinchSpread(ids);
      if (pinch0) zoom((pinch0 - d) * 0.02);
      pinch0 = d;
      dragged = true;                       // قرصة مش دوسة
    }
    function onTouchUp(e) {
      delete touches[e.pointerId];
      if (Object.keys(touches).length < 2) pinch0 = 0;
    }
    function pinchSpread(ids) {
      const a = touches[ids[0]], b = touches[ids[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('pointerdown', onTouchDown);
    dom.addEventListener('pointermove', onTouchMove);
    dom.addEventListener('pointerup', onTouchUp);
    dom.addEventListener('pointercancel', onTouchUp);

    /* ---------- الحالة ---------- */
    /* بيتنده من الـresize: بيرجّع زاوية الرؤية المناسبة للنسبة الجديدة */
    function fit(aspect) {
      let cfg;
      // زاوية أوسع ومسافة أقرب = منظور أقوى وإحساس إنك واقف في الأوضة
      if (aspect >= 1.4)       cfg = { b: 'wide',  spread: 1,    drop: 0,     fov: 54, maxY: 3.9, pMax: 0.75, pitch: 0.17 };
      else if (aspect >= 1.0)  cfg = { b: 'mid',   spread: 1.1,  drop: 0.1,   fov: 58, maxY: 4.2, pMax: 0.8,  pitch: 0.2 };
      else if (aspect >= 0.75) cfg = { b: 'tall',  spread: 1.15, drop: 0.15,  fov: 54, maxY: 4.8, pMax: 0.85, pitch: 0.32 };
      // موبايل طولي: الكاميرا بتعلى فوق الحيطة وتبص جوه الأوضة زي بيت الدمية
      else                     cfg = { b: 'phone', spread: 1.05, drop: -0.2,  fov: 48, maxY: 9.2, pMax: 0.95, pitch: 0.52 };

      spread = cfg.spread;
      drop = cfg.drop;
      maxY = cfg.maxY;
      LIMIT.pitchMax = cfg.pMax;
      if (cfg.b !== bucket) {
        // اتغيّر اتجاه الشاشة: نرجّع الزاوية للوضع المناسب ونقفز مكانها فوراً
        bucket = cfg.b;
        pitch = cfg.pitch;
        if (!focus) { widePos(cam.position, 0); cam.lookAt(target); }
      } else {
        pitch = Math.min(pitch, LIMIT.pitchMax);
      }
      return cfg.fov;
    }

    function setFocus(st) {
      if (st !== focus) breath = 0;
      if (focus && !st) loose = true;       // راجعين للدوران: اقرا الزوايا من مكانها
      focus = st || null;
    }
    function isFocused() { return !!focus; }

    function update(dt, chefPos) {
      if (focus) {
        // لقطة قريبة: قدّام المحطة، بتبص على قلبها، مع دخول بطيء (push-in)
        breath += dt;
        const push = RAW.reduceMotion ? 1 : 1 - Math.min(0.06, breath * 0.02);
        wantTarget.copy(focus.obj.position).add(new THREE.Vector3(0, -0.34, 0));
        wantPos.copy(focus.obj.position).addScaledVector(focus.view, push);
        const k = 1 - Math.exp(-2 * dt);        // دخول أبطأ = إحساس درامي
        cam.position.lerp(wantPos, k);
        target.lerp(wantTarget, k);
        loose = true;                       // لما نخرج من التركيز نبدأ من هنا
      } else {
        breath = 0;
        /* الدوران: بنسلّس الزاوية والمسافة، والمكان بيتحسب منهم — كده الكاميرا
           بتمشي على قوس حوالين نورة ومش بتقطع من نص الأوضة وهي بتلف. */
        if (loose) {
          // جايين من لقطة قريبة: نبدأ من زاوية الكاميرا الحالية عشان ما تنطّش
          const off = cam.position.clone().sub(target);
          distS = Math.max(1.5, off.length() / Math.max(0.001, spread));
          pitchS = Math.asin(Math.max(-1, Math.min(1, off.y / off.length())));
          yawS = Math.atan2(off.x, off.z);
          targetS.copy(target);
          loose = false;
        }
        wantTarget.set(chefPos ? chefPos.x : 0, ORBIT_Y - drop * 0.5, chefPos ? chefPos.z : 0);
        const kt = 1 - Math.exp(-5 * dt);
        targetS.lerp(wantTarget, kt);
        const ka = 1 - Math.exp(-7 * dt);
        yawS += shortAngle(yawS, yaw) * ka;
        pitchS += (pitch - pitchS) * ka;
        distS += (dist - distS) * ka;
        orbitPos(cam.position, targetS, yawS, pitchS, distS);
        target.copy(targetS);
      }
      // إبقاء الكاميرا جوه حدود معقولة — ما تدخلش جدار ولا تنزل تحت الأرض
      cam.position.y = Math.max(BOX.y0, Math.min(maxY, cam.position.y));
      cam.position.x = Math.max(BOX.x0, Math.min(BOX.x1, cam.position.x));
      cam.position.z = Math.max(BOX.z0, Math.min(BOX.z1, cam.position.z));
      cam.lookAt(target);
      // Dutch angle: ميلة بسيطة ناحية العكس من زاوية اللقطة — دراما من غير دوخة
      const wantRoll = (focus && !RAW.reduceMotion) ? (focus.view.x >= 0 ? -0.042 : 0.042) : 0;
      roll += (wantRoll - roll) * Math.min(1, dt * 2.2);
      cam.rotateZ(roll);
    }

    function dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('pointerdown', onTouchDown);
      dom.removeEventListener('pointermove', onTouchMove);
      dom.removeEventListener('pointerup', onTouchUp);
      dom.removeEventListener('pointercancel', onTouchUp);
    }

    return { setFocus, isFocused, update, dispose, fit, target,
             yaw() { return yaw; },
             /** يرجّع الكاميرا لزاويتها الافتراضية (من غير نطّة — بتلف لحد هناك) */
             reset() { yaw = WIDE.yaw; pitch = WIDE.pitch; dist = WIDE.dist; return true; } };
  };
})(window);
