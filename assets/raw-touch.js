/* ==========================================================================
   RAW — تحكّم اللمس على الموبايل

   جويستيك عايم في الربع الشمال السفلي: تحط صباعك في أي مكان فيه فيتفتح
   الجويستيك عند نقطة اللمس، وتحرّك حواليها. باقي الشاشة سايبة للكاميرا
   (سحب = تدوير، قرصة = تقريب) وللدوس على الأرض.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /** جهاز لمس؟ (الماوس الدقيق مش محتاج جويستيك) */
  RAW.isTouch = function () {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  };

  RAW.touch = function (host, api) {
    const zone = document.createElement('div');
    zone.className = 'raw-stick-zone';
    const stick = document.createElement('div');
    stick.className = 'raw-stick';
    stick.innerHTML = '<i></i>';
    zone.appendChild(stick);
    host.appendChild(zone);

    const R = 52;                 // نصف قطر الجويستيك بالبكسل
    const DEAD = 0.14;            // منطقة ميتة في النص
    let id = null, ox = 0, oy = 0;

    function start(e) {
      if (id !== null) return;
      id = e.pointerId;
      ox = e.clientX; oy = e.clientY;
      const r = host.getBoundingClientRect();
      stick.style.left = (ox - r.left) + 'px';
      stick.style.top = (oy - r.top) + 'px';
      stick.classList.add('on');
      zone.setPointerCapture && zone.setPointerCapture(id);
      e.preventDefault();
    }
    function move(e) {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - ox) / R;
      let dy = (e.clientY - oy) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      const mag = Math.min(1, m);
      stick.querySelector('i').style.transform =
        'translate(' + (dx * R) + 'px,' + (dy * R) + 'px)';
      if (mag < DEAD) { api.move(0, 0); return; }
      // فوق الشاشة = بعيد عن الكاميرا (-z)
      api.move(dx, dy);
      e.preventDefault();
    }
    function end(e) {
      if (e.pointerId !== id) return;
      id = null;
      api.move(0, 0);
      stick.classList.remove('on');
      stick.querySelector('i').style.transform = 'translate(0,0)';
    }

    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('pointerleave', end);

    return {
      dispose() {
        api.move(0, 0);
        zone.remove();
      }
    };
  };
})(window);
