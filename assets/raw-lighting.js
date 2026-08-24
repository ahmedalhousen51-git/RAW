/* ==========================================================================
   RAW — الإضاءة: three-point متوازنة + ضوء نافذة + إضاءة مخفية وعملية
   ظل واحد بس بيتحسب (الـkey) عشان الأداء.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.lighting = function (THREE, scene, mats, cove) {
    // ضوء عام دافي من فوق وبارد شوية من تحت
    const hemi = new THREE.HemisphereLight(0xFFF3E2, 0x8A7C68, 0.8);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0xFFF6EC, 0.34);
    scene.add(amb);

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

    /* ---------- الإضاءة حسب الوقت ----------
       نفس الأوضة بتتغيّر مع اليوم: صبح دافي، ضهر مفتوح، مغرب عسلي، وليل
       بيعتمد على الإضاءة العملية. الألوان والشدّات بس اللي بتتغيّر. */
    const PRESETS = {
      morning: { name: 'الصبح', key: 0xFFEAD0, keyI: 1.42, hemi: 0.82, amb: 0.32,
                 day: 0xEAF2FF, dayI: 24, warm: 0.85, bg: 0xEBE4D8, shaft: 0.09 },
      noon:    { name: 'الضهر', key: 0xFFF6E8, keyI: 1.65, hemi: 0.95, amb: 0.38,
                 day: 0xF2F7FF, dayI: 32, warm: 0.6,  bg: 0xEFE9DE, shaft: 0.05 },
      sunset:  { name: 'المغرب', key: 0xFFC98C, keyI: 1.05, hemi: 0.6,  amb: 0.26,
                 day: 0xFFD2A0, dayI: 15, warm: 1.35, bg: 0xE6D6C2, shaft: 0.13 },
      night:   { name: 'الليل',  key: 0xBFD0F0, keyI: 0.38, hemi: 0.34, amb: 0.18,
                 day: 0x9FB6E0, dayI: 5,  warm: 1.9,  bg: 0xCFC3B2, shaft: 0.03 }
    };
    const ORDER = ['morning', 'noon', 'sunset', 'night'];
    let now = 'noon';

    function setTime(id) {
      const p = PRESETS[id] || PRESETS.noon;
      now = PRESETS[id] ? id : 'noon';
      key.color.setHex(p.key); key.intensity = p.keyI;
      hemi.intensity = p.hemi;
      amb.intensity = p.amb;
      day.color.setHex(p.day); day.intensity = p.dayI;
      rim.intensity = 0.3 + p.warm * 0.22;
      strip.forEach(l => (l.intensity = 2.6 * p.warm));
      pendants.forEach(g => g.children.forEach(c => {
        if (c.isPointLight) c.intensity = 4.4 * p.warm;
        if (c.material && c.material.emissive) c.material.emissiveIntensity = 0.9 * p.warm;
      }));
      overCounter.intensity = 5.5 * p.warm;
      overRight.intensity = 4.4 * p.warm;
      cove.material.emissiveIntensity = 0.55 * p.warm;
      if (scene.background && scene.background.setHex) scene.background.setHex(p.bg);
      if (scene.fog) scene.fog.color.setHex(p.bg);
      return p;
    }
    function nextTime() {
      return setTime(ORDER[(ORDER.indexOf(now) + 1) % ORDER.length]);
    }
    /** الوقت الحقيقي للجهاز → أقرب حالة */
    function timeOfDay(hour) {
      if (hour == null) hour = new Date().getHours();
      if (hour >= 6 && hour < 11) return 'morning';
      if (hour >= 11 && hour < 16) return 'noon';
      if (hour >= 16 && hour < 20) return 'sunset';
      return 'night';
    }

    return { key, fill, rim, day, strip, pendants, overCounter, overRight,
             setTime, nextTime, timeOfDay, presets: PRESETS,
             get current() { return now; } };
  };
})(window);
