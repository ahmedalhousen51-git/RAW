/* ==========================================================================
   RAW — الباريستا: مجسّم stylized بسيط لكن واضح، بطول واقعي (~١.٧٨ م)
   فيه دورة مشي، ونَفَس وهو واقف، وظل ناعم على الأرض.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.character = function (THREE, scene, mats) {
    const { C, M, box, cyl } = mats;
    const root = new THREE.Group();

    const skin  = M(0xE8C49E, 0.78);
    const shirt = M(0xF4EFE4, 0.82);
    const apronM = M(0x2E5A4B, 0.85);
    const pants = M(0x3A3B3F, 0.88);
    const hairM = M(0x211913, 0.9);
    const dark  = M(0x1F1B18, 0.45);

    const legs = [], arms = [];
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 5, 12), pants);
      leg.position.set(s * 0.105, 0.5, 0);
      root.add(leg); legs.push(leg);
      const shoe = box(0.125, 0.07, 0.25, M(0x2A2521, 0.7));
      shoe.position.set(s * 0.105, 0.035, 0.045);
      root.add(shoe);
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.185, 0.42, 6, 14), shirt);
    torso.position.y = 1.15; root.add(torso);
    // مريلة الشغل + رباط الوسط
    const apron = box(0.33, 0.52, 0.07, apronM);
    apron.position.set(0, 1.0, 0.16); root.add(apron);
    const apronTop = box(0.22, 0.22, 0.06, apronM);
    apronTop.position.set(0, 1.32, 0.17); root.add(apronTop);
    const tie = box(0.42, 0.05, 0.16, M(0x224437, 0.85));
    tie.position.set(0, 1.06, 0.1); root.add(tie);

    [-1, 1].forEach(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.235, 1.4, 0);
      root.add(pivot); arms.push(pivot);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.3, 5, 12), shirt);
      upper.position.y = -0.19; pivot.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 5, 12), skin);
      fore.position.y = -0.44; pivot.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), skin);
      hand.position.y = -0.58; pivot.add(hand);
    });

    const neck = cyl(0.055, 0.06, 0.09, 12, skin);
    neck.position.y = 1.48; root.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 22, 18), skin);
    head.position.y = 1.63; root.add(head);
    // الشعر: طاقية بتوقف فوق العينين + غرة، فالوش يبان
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2.35), hairM);
    hair.position.y = 1.645; root.add(hair);
    const fringe = new THREE.Mesh(
      new THREE.SphereGeometry(0.144, 22, 8, -0.9, 1.8, 0.5, 0.42), hairM);
    fringe.position.y = 1.645; root.add(fringe);
    const eyeWhite = M(0xFFFFFF, 0.25);
    [-1, 1].forEach(s => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), eyeWhite);
      w.position.set(s * 0.05, 1.638, 0.112); root.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), dark);
      p.position.set(s * 0.05, 1.638, 0.132); root.add(p);
      const brow = box(0.05, 0.012, 0.01, dark);
      brow.position.set(s * 0.05, 1.688, 0.118); root.add(brow);
    });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 14, Math.PI), dark);
    smile.rotation.z = Math.PI;
    smile.position.set(0, 1.578, 0.115); root.add(smile);
    // فوطة على الكتف — تفصيلة كافيه صغيرة
    const towel = box(0.1, 0.2, 0.05, M(0xE0D6C2, 0.85));
    towel.position.set(-0.2, 1.34, 0.02); towel.rotation.z = 0.2; root.add(towel);

    root.traverse(n => { if (n.isMesh) n.castShadow = true; });

    /* ظل ناعم تحت الرجلين — دايره متدرّجة، مضمونة مهما كانت الإضاءة */
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(35,25,18,.5)');
    grad.addColorStop(1, 'rgba(35,25,18,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(cv);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    root.add(blob);

    scene.add(root);

    /* الحركة: دورة مشي بسيطة، ونَفَس هادي وهو واقف */
    let phase = 0;
    function update(dt, moving, speed) {
      if (moving) {
        phase += dt * (6.2 * (speed || 1));
        const sw = Math.sin(phase);
        arms[0].rotation.x = sw * 0.6;
        arms[1].rotation.x = -sw * 0.6;
        legs[0].rotation.x = -sw * 0.5;
        legs[1].rotation.x = sw * 0.5;
        root.position.y = Math.abs(Math.sin(phase)) * 0.035;
        torso.rotation.z = sw * 0.03;
        torso.scale.setScalar(1);
      } else {
        phase += dt * 1.6;
        const br = Math.sin(phase) * 0.5 + 0.5;              // نَفَس
        torso.scale.set(1 + br * 0.012, 1 + br * 0.008, 1 + br * 0.012);
        arms[0].rotation.x = Math.sin(phase) * 0.05;
        arms[1].rotation.x = -Math.sin(phase) * 0.05;
        legs[0].rotation.x = legs[1].rotation.x = 0;
        root.position.y = br * 0.008;
        torso.rotation.z = 0;
      }
    }

    return { root, update };
  };
})(window);
