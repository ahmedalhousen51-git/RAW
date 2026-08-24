/* ==========================================================================
   RAW — الإضاءة: three-point متوازنة + ضوء نافذة + إضاءة مخفية وعملية
   ظل واحد بس بيتحسب (الـkey) عشان الأداء.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.lighting = function (THREE, scene, mats) {
    // ضوء عام دافي من فوق وبارد شوية من تحت
    scene.add(new THREE.HemisphereLight(0xFFF3E2, 0x8A7C68, 0.8));
    scene.add(new THREE.AmbientLight(0xFFF6EC, 0.34));

    // Key: دافي وناعم من فوق وقدّام — هو اللي بيرمي الظل
    const key = new THREE.DirectionalLight(0xFFEFD6, 1.45);
    key.position.set(4.5, 8.5, 7.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -13; key.shadow.camera.right = 13;
    key.shadow.camera.top = 13; key.shadow.camera.bottom = -13;
    key.shadow.camera.far = 34;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    // Fill أضعف من الناحية المقابلة عشان يفتح الظلال
    const fill = new THREE.DirectionalLight(0xC9DCF2, 0.42);
    fill.position.set(-8, 5.5, 6);
    scene.add(fill);

    // Rim ذهبي خفيف من ورا يفصل الشخصية والمعدات عن الخلفية
    const rim = new THREE.DirectionalLight(0xFFC98A, 0.5);
    rim.position.set(-2, 5.5, -9);
    scene.add(rim);

    // ضوء نهار ناعم داخل من نافذة اليمين (Point بدل RectArea — الأخير محتاج addon)
    const day = new THREE.PointLight(0xEAF2FF, 22, 18, 2);
    day.position.set(7.2, 2.9, 2.4);
    scene.add(day);

    // إضاءة مخفية دافية تحت الرف الطويل — خط ضوء مش بقعة
    const strip = [];
    for (let i = -1; i <= 1; i++) {
      const p = new THREE.PointLight(0xFFD9A0, 4.2, 6.4, 2);
      p.position.set(i * 4.4, 2.02, -6.15);
      scene.add(p);
      strip.push(p);
    }

    // إضاءة عملية فوق الجزيرة — نجفتين نحاس
    const pendants = [];
    [-1.35, 0.45].forEach(x => {
      const g = new THREE.Group();
      const rod = mats.cyl(0.02, 0.02, 1.5, 8, mats.M(mats.C.brassDim, 0.4, 0.85));
      rod.position.y = 0.75; g.add(rod);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.34, 22, 1, true),
        new THREE.MeshStandardMaterial({ color: mats.C.brass, roughness: 0.32, metalness: 0.8, side: THREE.DoubleSide }));
      shade.position.y = -0.16; g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xFFE9C0, emissive: 0xFFD08A, emissiveIntensity: 1.6, roughness: 0.3 }));
      bulb.position.y = -0.3; g.add(bulb);
      const lamp = new THREE.PointLight(0xFFD9A0, 6.5, 7, 2);
      lamp.position.y = -0.34; g.add(lamp);
      g.position.set(x, 2.62, -0.8);
      scene.add(g);
      pendants.push(g);
    });

    // ضوء خفيف على سطح العمل الخلفي عشان الماكينات تبان
    const overCounter = new THREE.PointLight(0xFFE3B8, 9, 11, 2);
    overCounter.position.set(3.6, 2.5, -5.4);
    scene.add(overCounter);
    // طرف اليمين (السيرب والإسبريسو) كان بيقع في الضل
    const overRight = new THREE.PointLight(0xFFE0B0, 7, 9, 2);
    overRight.position.set(6.8, 2.4, -5.2);
    scene.add(overRight);

    return { key, fill, rim, day, strip, pendants, overCounter, overRight };
  };
})(window);
