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
      dist: 12.5, yaw: 0, pitch: 0.135
    };
    const LIMIT = { yaw: 0.5, pitchMin: 0.04, pitchMax: 0.52, distMin: 7.5, distMax: 17 };

    // المدار اللي المستخدم بيحرّكه — بيتطبّق على اللقطة الواسعة
    let yaw = WIDE.yaw, pitch = WIDE.pitch, dist = WIDE.dist;
    // الشاشات الطولية بتضيّق مجال الرؤية الأفقي، فبنبعد الكاميرا شوية
    let spread = 1, drop = 0;      // drop = بنوطّي نقطة النظر في الشاشات الطولية
    let maxY = 3.9;                // أقصى ارتفاع للكاميرا (بيعلى في الطولي)
    let bucket = '';               // نوع الشاشة الحالي (عرضي/طولي)
    let focus = null;                       // المحطة اللي الكاميرا مركّزة عليها
    let roll = 0, breath = 0;               // ميلة درامية خفيفة ونَفَس دخول بطيء
    const target = WIDE.target.clone();
    const wantPos = new THREE.Vector3();
    const wantTarget = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    // ابدأ في مكان اللقطة الواسعة بالظبط، من غير أي انتقال في أول frame
    function widePos(out, centreX) {
      const tx = (centreX || 0) * 0.22;
      const d = dist * spread;
      out.set(
        tx + Math.sin(yaw) * d * Math.cos(pitch),
        WIDE.target.y - drop + Math.sin(pitch) * d,
        WIDE.target.z + Math.cos(yaw) * d * Math.cos(pitch)
      );
      return out;
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
      yaw = Math.max(-LIMIT.yaw, Math.min(LIMIT.yaw, yaw - dx * 0.0032));
      pitch = Math.max(LIMIT.pitchMin, Math.min(LIMIT.pitchMax, pitch + dy * 0.0022));
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
      if (aspect >= 1.4)       cfg = { b: 'wide',  spread: 1,    drop: 0,     fov: 44, maxY: 3.9, pMax: 0.52, pitch: 0.135 };
      else if (aspect >= 1.0)  cfg = { b: 'mid',   spread: 1.12, drop: 0.1,   fov: 50, maxY: 4.2, pMax: 0.55, pitch: 0.17 };
      else if (aspect >= 0.75) cfg = { b: 'tall',  spread: 1.2,  drop: 0.15,  fov: 54, maxY: 4.8, pMax: 0.62, pitch: 0.26 };
      // موبايل طولي: الكاميرا بتعلى فوق الحيطة وتبص جوه الأوضة زي بيت الدمية
      else                     cfg = { b: 'phone', spread: 1.1,  drop: -0.2,  fov: 48, maxY: 9.2, pMax: 0.8,  pitch: 0.58 };

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
      focus = st || null;
    }
    function isFocused() { return !!focus; }

    function update(dt, chefPos) {
      if (focus) {
        // لقطة قريبة: قدّام المحطة، بتبص على قلبها، مع دخول بطيء (push-in)
        breath += dt;
        // الدخول البطيء بيتلغي في وضع الحركة المخفّضة
        const push = RAW.reduceMotion ? 1 : 1 - Math.min(0.06, breath * 0.02);
        wantTarget.copy(focus.obj.position).add(new THREE.Vector3(0, -0.34, 0));
        wantPos.copy(focus.obj.position).addScaledVector(focus.view, push);
      } else {
        breath = 0;
        wantTarget.set(WIDE.target.x + (chefPos ? chefPos.x * 0.22 : 0), WIDE.target.y - drop, WIDE.target.z);
        widePos(wantPos, chefPos ? chefPos.x : 0);
      }
      // damping مستقل عن الـframe rate
      const k = 1 - Math.exp(-(focus ? 3.4 : 2.6) * dt);
      cam.position.lerp(wantPos, k);
      target.lerp(wantTarget, k);
      // إبقاء الكاميرا جوه حدود معقولة — ما تدخلش جدار ولا تنزل تحت الأرض
      cam.position.y = Math.max(1.1, Math.min(maxY, cam.position.y));
      cam.position.x = Math.max(-7.5, Math.min(7.5, cam.position.x));
      cam.position.z = Math.max(-5.4, Math.min(15.5, cam.position.z));
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
             reset() { yaw = WIDE.yaw; pitch = WIDE.pitch; dist = WIDE.dist; } };
  };
})(window);
