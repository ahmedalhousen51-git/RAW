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
    let spread = 1;
    let focus = null;                       // المحطة اللي الكاميرا مركّزة عليها
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
        WIDE.target.y + Math.sin(pitch) * d,
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
      dist = Math.max(LIMIT.distMin, Math.min(LIMIT.distMax, dist + e.deltaY * 0.006));
    }
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    /* ---------- الحالة ---------- */
    /* بيتنده من الـresize: بيرجّع زاوية الرؤية المناسبة للنسبة الجديدة */
    function fit(aspect) {
      const was = spread;
      let fov;
      if (aspect >= 1.4) { spread = 1; fov = 44; }
      else if (aspect >= 1.0) { spread = 1.12; fov = 50; }
      else { spread = 1.32; fov = 58; }
      // لو المسافة اتغيّرت وإحنا في اللقطة الواسعة، اقفز مكانها فوراً من غير انزلاق
      if (was !== spread && !focus) { widePos(cam.position, 0); cam.lookAt(target); }
      return fov;
    }

    function setFocus(st) { focus = st || null; }
    function isFocused() { return !!focus; }

    function update(dt, chefPos) {
      if (focus) {
        // لقطة قريبة: قدّام المحطة، بتبص على قلبها
        wantTarget.copy(focus.obj.position).add(new THREE.Vector3(0, 0.18, 0));
        wantPos.copy(focus.obj.position).add(focus.view);
      } else {
        wantTarget.set(WIDE.target.x + (chefPos ? chefPos.x * 0.22 : 0), WIDE.target.y, WIDE.target.z);
        widePos(wantPos, chefPos ? chefPos.x : 0);
      }
      // damping مستقل عن الـframe rate
      const k = 1 - Math.exp(-(focus ? 3.4 : 2.6) * dt);
      cam.position.lerp(wantPos, k);
      target.lerp(wantTarget, k);
      // إبقاء الكاميرا جوه حدود معقولة — ما تدخلش جدار ولا تنزل تحت الأرض
      cam.position.y = Math.max(1.1, Math.min(3.9, cam.position.y));
      cam.position.x = Math.max(-7.5, Math.min(7.5, cam.position.x));
      cam.position.z = Math.max(-5.4, Math.min(15.5, cam.position.z));
      cam.lookAt(target);
    }

    function dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
    }

    return { setFocus, isFocused, update, dispose, fit, target,
             reset() { yaw = WIDE.yaw; pitch = WIDE.pitch; dist = WIDE.dist; } };
  };
})(window);
