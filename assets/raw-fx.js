/* ==========================================================================
   RAW — المؤثرات: بخار، لمبات بتنبض، فقاقيع، ودوران خفيف
   كل حاجة مسجّلة في list واحدة بتتحدّث من الـtick بتاع المشهد.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.fx = function (THREE) {
    const steams = [], pulses = [], bubbles = [], spins = [];

    /* بخار بيطلع فعلاً: كل نفخة تطلع، تتوسّع، تبهت، وتبدأ من الأول */
    function steam(parent, x, y, z, spread, rise, count) {
      const g = new THREE.Group();
      const n = count || 8;
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        // نفرّق الطور والانزياح، وإلا التمان نفخات يطلعوا زي خرزة واحدة
        p.userData = {
          t: (i / n) + Math.random() * 0.08,
          dx: (Math.random() - 0.5) * spread,
          dz: (Math.random() - 0.5) * spread,
          k: 0.8 + Math.random() * 0.45
        };
        g.add(p);
      }
      g.position.set(x, y, z);
      g.userData.rise = rise || 0.8;
      g.userData.boost = 0;           // بيعلى شوية وقت ما الماكينة تشتغل
      parent.add(g);
      steams.push(g);
      return g;
    }

    /* لمبة مؤشّر — بترجع mesh ينفع نولّعه بـflash */
    function indicator(colour, w, h, d) {
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: colour, emissive: colour, emissiveIntensity: 0.3, roughness: 0.3
        }));
    }
    function flash(mat, peak, secs) {
      if (!mat) return;
      pulses.push({ mat: mat, t: 0, dur: secs || 0.9, base: mat.emissiveIntensity || 0, peak: peak });
    }

    /* فقاقيع بتطلع جوه إبريق أو كوب */
    function bubbleSet(parent, count, radius, baseY, height, colour) {
      for (let i = 0; i < count; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.009, 8, 8),
          new THREE.MeshPhysicalMaterial({
            color: colour || 0xFFE6C4, roughness: 0.06,
            transmission: 0.8, transparent: true, opacity: 0.5
          }));
        const a = i * 2.1, r = radius * (0.25 + (i % 4) * 0.2);
        b.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y0: baseY, h: height, t: i / count, k: 0.6 + (i % 5) * 0.16 };
        parent.add(b);
        bubbles.push(b);
      }
    }

    /* لفّة بطيئة لأي حاجة (مكعبات تلج، كور بوبا) */
    function spin(mesh, speed) { spins.push({ m: mesh, s: speed || 0.25 }); return mesh; }

    function update(dt) {
      for (let i = 0; i < steams.length; i++) {
        const g = steams[i], rise = g.userData.rise;
        if (g.userData.boost > 0) g.userData.boost = Math.max(0, g.userData.boost - dt / 1.8);
        const push = 1 + g.userData.boost * 1.5;
        for (let j = 0; j < g.children.length; j++) {
          const p = g.children[j], u = p.userData;
          u.t += dt * 0.34 * u.k * push;
          if (u.t > 1) u.t -= 1;
          p.position.set(u.dx * u.t, u.t * rise * u.k, u.dz * u.t);
          p.material.opacity = Math.sin(u.t * Math.PI) * (0.16 + g.userData.boost * 0.4);
          const s = 0.5 + u.t * 1.5;
          p.scale.set(s, s, s);
        }
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        p.mat.emissiveIntensity = p.base + (p.peak - p.base) * Math.sin(k * Math.PI);
        if (k >= 1) { p.mat.emissiveIntensity = p.base; pulses.splice(i, 1); }
      }
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i], u = b.userData;
        u.t += dt * 0.3 * u.k;
        if (u.t > 1) u.t -= 1;
        b.position.set(u.x, u.y0 + u.t * u.h, u.z);
        b.material.opacity = Math.sin(u.t * Math.PI) * 0.5;
      }
      for (let i = 0; i < spins.length; i++) spins[i].m.rotation.y += dt * spins[i].s;
    }

    return { steam, indicator, flash, bubbleSet, spin, update };
  };
})(window);
