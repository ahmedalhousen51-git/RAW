/* ==========================================================================
   RAW — جو المكان: غبار عايم في الضوء، عمود نور من النافذة، وانعكاسات
   البيئة على الستانلس والزجاج.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.atmos = function (THREE, renderer, scene, mats) {
    const L = RAW.layout;

    /* ---------- غبار عايم ---------- */
    const N = 150;
    const pos = new Float32Array(N * 3);
    const drift = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // بيتكتّل ناحية النافذة اليمين، وباقيه متوزّع في الأوضة
      const nearWindow = i < N * 0.45;
      pos[i * 3]     = nearWindow ? 4.2 + Math.random() * 3.4 : (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = 0.4 + Math.random() * 2.9;
      pos[i * 3 + 2] = nearWindow ? 0.4 + Math.random() * 4.4 : (Math.random() - 0.5) * 12;
      drift[i * 3]     = (Math.random() - 0.5) * 0.09;
      drift[i * 3 + 1] = 0.012 + Math.random() * 0.035;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 0.09;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // نقطة ناعمة مرسومة على canvas — النقطة المربعة بتبان زي البكسل
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d');
    const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,244,224,1)');
    rg.addColorStop(1, 'rgba(255,244,224,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
    const dustMat = new THREE.PointsMaterial({
      size: 0.035, map: new THREE.CanvasTexture(cv), transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const dust = new THREE.Points(geo, dustMat);
    scene.add(dust);

    /* ---------- عمود نور من النافذة ---------- */
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xFFE9C4, transparent: true, opacity: 0.075,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const shafts = [];
    [1.4, 4.4].forEach(z => {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.5, 5.4, 14, 1, true), shaftMat);
      sh.rotation.z = Math.PI / 2.6;
      sh.position.set(5.6, 1.9, z);
      sh.renderOrder = 2;
      scene.add(sh);
      shafts.push(sh);
    });

    /* ---------- انعكاسات البيئة ----------
       كاميرا مكعّبة بترسم الأوضة مرة كل كام ثانية وبتتحط كـenvironment،
       فالستانلس والزجاج يعكسوا المكان بجد بدل انعكاس مزيّف. */
    const rt = new THREE.WebGLCubeRenderTarget(96, {
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter
    });
    const cube = new THREE.CubeCamera(0.2, 40, rt);
    cube.position.set(0.4, 1.55, -2.2);
    scene.add(cube);
    scene.environment = rt.texture;

    // معايرة قوة الانعكاس: المعادن والزجاج بيعكسوا كتير، والخشب والبلاط لأ
    function tune() {
      scene.traverse(n => {
        const m = n.material;
        if (!m) return;
        (Array.isArray(m) ? m : [m]).forEach(mm => {
          if (!mm || mm.envMapIntensity === undefined) return;
          const metal = mm.metalness || 0;
          const glassy = (mm.transmission || 0) > 0.2;
          mm.envMapIntensity = glassy ? 0.55 : (metal > 0.4 ? 0.85 : 0.22);
          mm.needsUpdate = true;
        });
      });
    }

    let cooldown = 0, envOn = true;
    /* الانعكاسات = ٦ رندرات للمشهد في فريم واحد. على الموبايل دي أكبر مصدر
       للّاج، فبنقدر نقفلها خالص. */
    function setEnv(on) {
      envOn = !!on;
      scene.environment = envOn ? rt.texture : null;
      if (!envOn) cooldown = 1e9;
      else cooldown = 0;
    }
    function refresh() {
      if (!envOn) return;
      dust.visible = false;                    // الغبار ما ينفعش ينعكس على نفسه
      shafts.forEach(s => (s.visible = false));
      cube.update(renderer, scene);
      dust.visible = true;
      shafts.forEach(s => (s.visible = true));
      cooldown = 8;      // ٦ رندرات في فريم واحد — بنبعّدها عشان ما تعملش تهتيت
    }

    function update(dt, now) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        a[j]     += drift[j] * dt + Math.sin(now * 0.0004 + i) * dt * 0.05;
        a[j + 1] += drift[j + 1] * dt;
        a[j + 2] += drift[j + 2] * dt;
        if (a[j + 1] > 3.5) { a[j + 1] = 0.35; }        // بيرجع من تحت تاني
        if (a[j] > 7.6 || a[j] < -7.6) drift[j] *= -1;
        if (a[j + 2] > 6.4 || a[j + 2] < -6.4) drift[j + 2] *= -1;
      }
      geo.attributes.position.needsUpdate = true;

      cooldown -= dt;
      if (cooldown <= 0) refresh();
    }

    return { dust, shafts, refresh, tune, update, setEnv,
      setShaft(v) { shaftMat.opacity = v; },
      setDust(v) { dustMat.opacity = v; },
      dispose() { rt.dispose(); scene.environment = null; } };
  };
})(window);
