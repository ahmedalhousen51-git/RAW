/* ==========================================================================
   RAW — محطات التحضير السبعة
   كل محطة group مستقلة، أصلها على وش الرخام، وليها نقطة وقوف وزاوية لقطة
   قريبة. التعريف موحّد: { id, label, obj, at, view, lamp, plume }
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.stations = function (THREE, scene, mats, fx) {
    const { C, M, box, cyl, decal } = mats;
    const L = RAW.layout;
    const TOP = L.counterY + 0.05;           // وش الرخام
    const stations = {}, roots = [];

    /* نقطة الوقوف قدّام السطح الخلفي وقدّام السطح الشمال */
    // بيقف جنب الماكينة شوية مش قدّامها بالظبط، عشان ما يحجبهاش في اللقطة القريبة
    const backStand = x => new THREE.Vector3(x - 0.62, 0, -5.62);
    const leftStand = z => new THREE.Vector3(-6.52, 0, z - 0.62);

    function mk(id, label, obj, x, z, stand, view, kit) {
      obj.position.set(x, TOP, z);
      obj.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      obj.userData.stationId = id;            // عشان الكليك يلاقي طريقه لفوق
      scene.add(obj);
      roots.push(obj);
      stations[id] = {
        id: id, label: label, obj: obj,
        at: stand,
        view: view,                            // إزاحة الكاميرا في اللقطة القريبة
        lamp: (kit && kit.lamp) || null,
        plume: (kit && kit.plume) || null
      };
      return stations[id];
    }
    const BACK_VIEW = new THREE.Vector3(1.6, 1.35, 3.6);
    // المحطات في آخر اليمين بتتصوّر من الناحية التانية، وإلا الكاميرا تطلع بره الجدار
    const RIGHT_VIEW = new THREE.Vector3(-1.6, 1.35, 3.6);
    const rightStand = x => new THREE.Vector3(x + 0.62, 0, -5.62);
    const LEFT_VIEW = new THREE.Vector3(3.7, 1.3, 2.2);

    /* ---------- ١) ماكينة الإسبريسو ---------- */
    const esp = new THREE.Group();
    const espBody = box(1.9, 0.56, 0.6, M(C.steel, 0.3, 0.65));
    espBody.position.y = 0.28; esp.add(espBody);
    const espTop = box(1.94, 0.16, 0.64, M(C.steelDark, 0.35, 0.7));
    espTop.position.y = 0.64; esp.add(espTop);
    // صواني الفناجين فوق
    for (let i = -1; i <= 1; i++) {
      const cup = cyl(0.045, 0.036, 0.06, 12, M(C.cream, 0.35));
      cup.position.set(i * 0.4, 0.75, -0.02); esp.add(cup);
    }
    // شريط الشعار — بسيط، اسم المكان بس
    const badge = box(0.92, 0.15, 0.02, M(0x6E2438, 0.45));
    badge.position.set(-0.4, 0.4, 0.31); esp.add(badge);
    const badgeText = decal('RAW', 0.34, 0.1, { fg: '#F6F0E4', size: 96 });
    badgeText.position.set(-0.4, 0.4, 0.325); esp.add(badgeText);
    // شاشة صغيرة
    const espScr = box(0.22, 0.1, 0.02, new THREE.MeshStandardMaterial({
      color: 0x0F2A3A, emissive: 0x1E5C86, emissiveIntensity: 0.7, roughness: 0.3 }));
    espScr.position.set(0.62, 0.42, 0.31); esp.add(espScr);
    const espScrTxt = decal('92°C', 0.17, 0.06, { fg: '#BFE6FF', size: 74 });
    espScrTxt.position.set(0.62, 0.42, 0.325); esp.add(espScrTxt);
    // رأسين تحضير + مقابض سودة + فناجين تحتهم
    [-0.62, 0.0, 0.62].forEach(dx => {
      const group = box(0.3, 0.2, 0.3, M(C.steelDark, 0.35, 0.7));
      group.position.set(dx, 0.13, 0.3); esp.add(group);
      const pf = cyl(0.11, 0.11, 0.07, 16, M(C.steelDark, 0.35, 0.7));
      pf.position.set(dx, 0.03, 0.34); esp.add(pf);
      const handle = cyl(0.032, 0.032, 0.22, 10, M(C.black, 0.6));
      handle.rotation.x = Math.PI / 2;
      handle.position.set(dx, 0.03, 0.5); esp.add(handle);
      const shot = cyl(0.038, 0.03, 0.06, 12, M(C.cream, 0.32));
      shot.position.set(dx, -0.02, 0.34); esp.add(shot);
    });
    // صنية التصريف
    const drip = box(1.2, 0.03, 0.34, M(C.steelDark, 0.4, 0.6));
    drip.position.set(-0.15, 0.005, 0.34); esp.add(drip);
    // لانس البخار على اليمين
    const wand = cyl(0.022, 0.016, 0.34, 10, M(C.steelDark, 0.3, 0.7));
    wand.position.set(0.82, 0.14, 0.3); wand.rotation.x = 0.3; esp.add(wand);
    const espPlume = fx.steam(esp, 0.84, 0.3, 0.36, 0.16, 0.55, 7);
    const espLamp = fx.indicator(0xE23B2E, 0.07, 0.03, 0.02);
    espLamp.position.set(0.3, 0.42, 0.315); esp.add(espLamp);
    mk('espresso', 'محطة الإسبريسو', esp, 4.7, L.backCounterZ, backStand(4.7), BACK_VIEW,
       { lamp: espLamp, plume: espPlume });

    // فناجين وصحون قدّام الماكينة على الرخام
    for (let i = 0; i < 4; i++) {
      const x = 3.95 + i * 0.42;
      const saucer = cyl(0.085, 0.085, 0.012, 16, M(C.cream, 0.35));
      saucer.position.set(x, TOP + 0.006, L.backCounterZ + 0.26);
      saucer.receiveShadow = true; scene.add(saucer);
      const cup = cyl(0.052, 0.042, 0.07, 14, M(C.cream, 0.32));
      cup.position.set(x, TOP + 0.05, L.backCounterZ + 0.26);
      cup.castShadow = true; scene.add(cup);
    }
    // تامبر
    const tamper = cyl(0.055, 0.062, 0.04, 16, M(C.brass, 0.3, 0.8));
    tamper.position.set(5.85, TOP + 0.02, L.backCounterZ + 0.2); scene.add(tamper);
    const grip = cyl(0.03, 0.038, 0.09, 12, M(0x3A2A1C, 0.7));
    grip.position.set(5.85, TOP + 0.085, L.backCounterZ + 0.2); scene.add(grip);

    /* ---------- ٢) مطحنة البن ---------- */
    const grd = new THREE.Group();
    const gBody = box(0.34, 0.6, 0.34, M(C.black, 0.45, 0.3));
    gBody.position.y = 0.3; grd.add(gBody);
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.34, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x6B4A2C, transmission: 0.45, roughness: 0.2,
        transparent: true, opacity: 0.7 }));
    hopper.position.y = 0.76; grd.add(hopper);
    const beansIn = cyl(0.15, 0.11, 0.16, 18, M(0x3B2318, 0.85));
    beansIn.position.y = 0.7; grd.add(beansIn);
    const hopLid = cyl(0.175, 0.175, 0.03, 20, M(C.black, 0.5));
    hopLid.position.y = 0.94; grd.add(hopLid);
    const gScr = box(0.18, 0.09, 0.02, new THREE.MeshStandardMaterial({
      color: 0x102A3C, emissive: 0x1E5C86, emissiveIntensity: 0.75, roughness: 0.3 }));
    gScr.position.set(0, 0.42, 0.18); grd.add(gScr);
    const doseTxt = decal('18.0 g', 0.15, 0.055, { fg: '#BFE6FF', size: 66 });
    doseTxt.position.set(0, 0.42, 0.195); grd.add(doseTxt);
    const chute = box(0.1, 0.12, 0.1, M(C.steelDark, 0.4, 0.6));
    chute.position.set(0, 0.16, 0.2); grd.add(chute);
    const grindLamp = fx.indicator(0x3FBF57, 0.07, 0.03, 0.02);
    grindLamp.position.set(0, 0.28, 0.185); grd.add(grindLamp);
    mk('grinder', 'محطة طحن البن', grd, 3.0, L.backCounterZ, backStand(3.0), BACK_VIEW,
       { lamp: grindLamp });
    // بن مطحون وحبوب متناثرة جنبها
    const grounds = cyl(0.001, 0.14, 0.05, 18, M(0x4A3120, 0.95));
    grounds.position.set(2.5, TOP + 0.025, L.backCounterZ + 0.2); scene.add(grounds);
    const beanMat = M(0x3B2318, 0.82);
    for (let i = 0; i < 10; i++) {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), beanMat);
      bean.scale.set(1, 0.7, 1.3);
      bean.position.set(2.5 + (Math.random() - 0.5) * 0.6, TOP + 0.012,
                        L.backCounterZ + 0.16 + (Math.random() - 0.5) * 0.3);
      bean.rotation.y = i * 1.2; bean.castShadow = true; scene.add(bean);
    }

    /* ---------- ٣) رف السيرب ---------- */
    const rack = new THREE.Group();
    const rackBase = box(1.15, 0.05, 0.34, M(C.black, 0.6));
    rackBase.position.y = 0.025; rack.add(rackBase);
    const rackShelf = box(1.15, 0.04, 0.3, M(C.woodDark, 0.75));
    rackShelf.position.set(0, 0.44, -0.02); rack.add(rackShelf);
    const syrupCols = [0xD9A6B4, 0x8E2F45, 0x3E5C8A, 0xC2334D, 0xEDE7DC];
    for (let i = 0; i < 5; i++) {
      const x = -0.44 + i * 0.22;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 14),
        new THREE.MeshPhysicalMaterial({ color: syrupCols[i], transmission: 0.32,
          roughness: 0.25, transparent: true, opacity: 0.92 }));
      b.position.set(x, 0.22, 0); rack.add(b);
      const neck = cyl(0.024, 0.024, 0.06, 10, M(C.black, 0.5));
      neck.position.set(x, 0.42, 0); rack.add(neck);
      const pump = cyl(0.014, 0.014, 0.16, 8, M(C.black, 0.5));
      pump.position.set(x, 0.52, 0); rack.add(pump);
      const nozzle = box(0.03, 0.02, 0.08, M(C.black, 0.5));
      nozzle.position.set(x, 0.47, 0.05); rack.add(nozzle);
      const lab = decal('1883', 0.09, 0.035, { fg: '#241C16', size: 80 });
      lab.position.set(x, 0.24, 0.057); rack.add(lab);
    }
    const syrupLamp = fx.indicator(0xE8B33A, 0.08, 0.025, 0.02);
    syrupLamp.position.set(0.5, 0.06, 0.16); rack.add(syrupLamp);
    mk('syrup', 'محطة السيرب 1883', rack, 6.9, L.backCounterZ, rightStand(6.9), RIGHT_VIEW,
       { lamp: syrupLamp });

    /* ---------- ٤) محطة اللبن ---------- */
    const milk = new THREE.Group();
    // إبريق ستانلس بمنقار
    const pitcher = cyl(0.1, 0.085, 0.22, 18, M(C.steel, 0.28, 0.7));
    pitcher.position.y = 0.11; milk.add(pitcher);
    const spout = box(0.06, 0.05, 0.06, M(C.steel, 0.28, 0.7));
    spout.position.set(0, 0.21, 0.09); spout.rotation.x = 0.5; milk.add(spout);
    const pHandle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 12), M(C.steel, 0.3, 0.65));
    pHandle.position.set(-0.13, 0.1, 0); pHandle.rotation.y = Math.PI / 2; milk.add(pHandle);
    fx.bubbleSet(milk, 6, 0.06, 0.06, 0.12, 0xFFF6E6);
    // كرتونتين لبن
    [[0.28, 0.02], [0.44, -0.1]].forEach((p, i) => {
      const carton = box(0.14, 0.3, 0.14, M(i ? 0xF3EFE6 : 0xE6EEF6, 0.6));
      carton.position.set(p[0], 0.15, p[1]); milk.add(carton);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4), M(i ? 0xE2DCD0 : 0xD6E2EE, 0.6));
      roof.rotation.y = Math.PI / 4;
      roof.position.set(p[0], 0.34, p[1]); milk.add(roof);
      const lab = decal('MILK', 0.09, 0.035, { fg: '#3A4A5A', size: 78 });
      lab.position.set(p[0], 0.2, p[1] + 0.072); milk.add(lab);
    });
    // ثرمومتر صغير
    const therm = cyl(0.008, 0.008, 0.16, 8, M(C.steel, 0.3, 0.7));
    therm.position.set(-0.16, 0.2, 0.06); therm.rotation.z = 0.3; milk.add(therm);
    const milkLamp = fx.indicator(0x7FBFEF, 0.06, 0.025, 0.02);
    milkLamp.position.set(0.13, 0.02, 0.14); milk.add(milkLamp);
    const milkPlume = fx.steam(milk, 0, 0.24, 0, 0.1, 0.4, 6);
    mk('milk', 'محطة اللبن', milk, 1.3, L.backCounterZ, backStand(1.3), BACK_VIEW,
       { lamp: milkLamp, plume: milkPlume });

    /* ---------- ٥) محطة الشاي والبوبا ---------- */
    const tea = new THREE.Group();
    // برطمانات شاي
    ['GREEN', 'BLACK'].forEach((t, i) => {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xE8E2D4, transmission: 0.3,
          roughness: 0.25, transparent: true, opacity: 0.85 }));
      jar.position.set(-0.34 + i * 0.24, 0.13, 0); tea.add(jar);
      const leaves = cyl(0.082, 0.082, 0.12, 14, M(i ? 0x4A3324 : 0x5E7A3E, 0.85));
      leaves.position.set(-0.34 + i * 0.24, 0.07, 0); tea.add(leaves);
      const lid = cyl(0.095, 0.095, 0.03, 16, M(C.brass, 0.35, 0.8));
      lid.position.set(-0.34 + i * 0.24, 0.275, 0); tea.add(lid);
      const lab = decal(t, 0.1, 0.035, { fg: '#3A2E22', size: 70 });
      lab.position.set(-0.34 + i * 0.24, 0.15, 0.093); tea.add(lab);
    });
    // حوض البوبا: كور تابيوكا في شراب
    const bobaTub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.18, 20),
      M(0x2E5A4B, 0.5));
    bobaTub.position.set(0.16, 0.09, 0.02); tea.add(bobaTub);
    const syrupPool = cyl(0.13, 0.12, 0.12, 18, M(0x3A2318, 0.35));
    syrupPool.position.set(0.16, 0.1, 0.02); tea.add(syrupPool);
    for (let i = 0; i < 9; i++) {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), M(0x1E1512, 0.4));
      const a = i * 1.7, r = 0.03 + (i % 3) * 0.03;
      pearl.position.set(0.16 + Math.cos(a) * r, 0.17, 0.02 + Math.sin(a) * r);
      tea.add(pearl);
    }
    // شيكر وأكواب تيك أواي
    const shaker = cyl(0.06, 0.055, 0.2, 14, M(C.steel, 0.3, 0.65));
    shaker.position.set(0.42, 0.1, -0.06); tea.add(shaker);
    for (let i = 0; i < 3; i++) {
      const tc = cyl(0.055, 0.042, 0.14, 14, M(0xF6F0E4, 0.4));
      tc.position.set(0.6, 0.07 + i * 0.03, 0.1); tea.add(tc);
    }
    const straw = cyl(0.012, 0.012, 0.24, 8, M(0x6E2438, 0.45));
    straw.position.set(0.68, 0.12, -0.08); straw.rotation.z = 0.2; tea.add(straw);
    const teaLamp = fx.indicator(0x8FC24A, 0.06, 0.025, 0.02);
    teaLamp.position.set(0.16, 0.02, 0.17); tea.add(teaLamp);
    mk('tea', 'محطة الشاي والبوبا', tea, -1.6, L.backCounterZ, backStand(-1.6), BACK_VIEW,
       { lamp: teaLamp });

    /* ---------- ٦) ماكينة التلج (السطح الشمال) ---------- */
    const ice = new THREE.Group();
    const iceBody = box(0.62, 0.74, 0.56, M(0xE4E7EA, 0.5, 0.3));
    iceBody.position.y = 0.37; ice.add(iceBody);
    const iceLid = box(0.66, 0.05, 0.6, M(C.steel, 0.4, 0.6));
    iceLid.position.y = 0.76; ice.add(iceLid);
    const iceScr = box(0.16, 0.08, 0.02, new THREE.MeshStandardMaterial({
      color: 0x14202A, emissive: 0x2E7FA8, emissiveIntensity: 0.6, roughness: 0.3 }));
    iceScr.position.set(0, 0.55, 0.29); ice.add(iceScr);
    const iceSlot = box(0.26, 0.12, 0.03, M(0x2B2E31, 0.7));
    iceSlot.position.set(0, 0.22, 0.29); ice.add(iceSlot);
    const iceLamp = fx.indicator(0x49AEEF, 0.06, 0.025, 0.02);
    iceLamp.position.set(0.2, 0.42, 0.29); ice.add(iceLamp);
    // حوض مكعبات مكشوف قدّامها — المكعبات جوه الماكينة مش بتتشاف
    const tub = cyl(0.17, 0.14, 0.14, 18, M(C.steel, 0.4, 0.4));
    tub.position.set(0, 0.07, 0.62); ice.add(tub);
    for (let i = 0; i < 9; i++) {
      const cube = box(0.055, 0.055, 0.055, new THREE.MeshPhysicalMaterial({
        color: 0xEAF6FF, transmission: 0.7, roughness: 0.12, transparent: true, opacity: 0.85 }));
      const a = i * 1.7;
      cube.position.set(Math.cos(a) * 0.08, 0.13 + (i % 3) * 0.02, 0.62 + Math.sin(a) * 0.08);
      cube.rotation.set(i * 1.1, i * 0.7, i * 1.9);
      ice.add(cube); fx.spin(cube, 0.18);
    }
    const scoop = cyl(0.05, 0.05, 0.06, 12, M(C.steel, 0.35, 0.6));
    scoop.rotation.x = Math.PI / 2.4;
    scoop.position.set(0.24, 0.05, 0.6); ice.add(scoop);
    mk('ice', 'محطة الثلج', ice, L.leftCounterX, -4.6, leftStand(-4.6), LEFT_VIEW,
       { lamp: iceLamp });

    /* ---------- ٧) سخّان المياه والحلة ---------- */
    const brew = new THREE.Group();
    const plate = box(0.5, 0.07, 0.44, M(C.black, 0.5, 0.2));
    plate.position.y = 0.035; brew.add(plate);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 22),
      new THREE.MeshStandardMaterial({ color: 0x8A3A22, emissive: 0xC0431F,
        emissiveIntensity: 0.35, roughness: 0.5 }));
    coil.rotation.x = Math.PI / 2; coil.position.y = 0.075; brew.add(coil);
    const pot = cyl(0.16, 0.15, 0.2, 22, M(0xC8CBCE, 0.28, 0.75));
    pot.position.y = 0.19; brew.add(pot);
    const potLid = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
      M(0xC8CBCE, 0.28, 0.75));
    potLid.position.y = 0.29; brew.add(potLid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), M(C.black, 0.6));
    knob.position.y = 0.35; brew.add(knob);
    const potHandle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), M(C.black, 0.6));
    potHandle.position.set(0.19, 0.2, 0); potHandle.rotation.y = Math.PI / 2; brew.add(potHandle);
    const brewPlume = fx.steam(brew, 0, 0.36, 0, 0.14, 0.62, 8);
    const brewLamp = fx.indicator(0xF2603C, 0.06, 0.025, 0.02);
    brewLamp.position.set(0.19, 0.035, 0.22); brew.add(brewLamp);
    // سخّان مياه ستانلس جنبها
    const boiler = cyl(0.13, 0.13, 0.34, 18, M(C.steel, 0.3, 0.7));
    boiler.position.set(-0.02, 0.17, -0.42); brew.add(boiler);
    const boilerTap = box(0.05, 0.06, 0.06, M(C.black, 0.5));
    boilerTap.position.set(-0.02, 0.1, -0.28); brew.add(boilerTap);
    const boilerGauge = decal('96°', 0.09, 0.04, { fg: '#2A211A', size: 76 });
    boilerGauge.position.set(-0.02, 0.24, -0.29); brew.add(boilerGauge);
    mk('brew', 'محطة سخان المياه', brew, L.leftCounterX, -2.4, leftStand(-2.4), LEFT_VIEW,
       { lamp: brewLamp, plume: brewPlume });

    return { stations, roots };
  };
})(window);
