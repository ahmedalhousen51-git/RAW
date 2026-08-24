/* ==========================================================================
   RAW — الغرفة: الأرضية، الجدران، البلاط، الخزائن، الرفوف، الجزيرة،
   منطقة الطعام، والتفاصيل الصغيرة.

   كل الأبعاد بالمتر. الأوضة على شكل L: سطح عمل طويل على الجدار الخلفي
   وعودة على الجدار الشمال، وفراغ مفتوح واضح في نص الأوضة.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /* حدود الأوضة ونقاط ثابتة بيستعملها الباقي (المحطات، الاصطدام، الكاميرا) */
  const L = {
    minX: -8.06, maxX: 8.06, backZ: -7.06, frontZ: 7.4,   // مراكز الجدران
    wallH: 3.9, wallT: 0.24,
    wallFaceZ: -6.94, wallFaceX: -7.94, rightFaceX: 7.94, // أوجه الجدران من جوه
    counterY: 0.95, counterD: 0.72,
    backCounterZ: -6.58,                                   // مركز سطح العمل الخلفي
    leftCounterX: -7.58,
    island: { x: -0.7, z: -0.9, w: 3.2, d: 1.4 },
    table:  { x: -4.1, z: 2.4, w: 1.7, d: 0.95 }
  };
  RAW.layout = L;

  RAW.room = function (THREE, scene, mats, fx) {
    const { C, M, box, cyl, decal } = mats;
    const obstacles = [];
    const add = (m) => { scene.add(m); return m; };
    // مستطيل اصطدام على مستوى الأرض
    const block = (x, z, w, d) => obstacles.push({
      x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2
    });

    /* ---------- الأرضية ---------- */
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16.2, 14.6), mats.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.2);
    floor.receiveShadow = true;
    add(floor);

    /* ---------- الجدران ---------- */
    const plaster = M(C.plaster, 0.92);
    const backWall = box(16.6, L.wallH, L.wallT, plaster);
    backWall.position.set(0, L.wallH / 2, L.backZ);
    backWall.receiveShadow = true; add(backWall);

    const leftWall = box(L.wallT, L.wallH, 14.6, plaster);
    leftWall.position.set(L.minX, L.wallH / 2, 0.2);
    leftWall.receiveShadow = true; add(leftWall);

    const rightWall = box(L.wallT, L.wallH, 14.6, plaster);
    rightWall.position.set(L.maxX, L.wallH / 2, 0.2);
    rightWall.receiveShadow = true; add(rightWall);

    // بلاط subway على الجدار الخلفي — من الأرض لحد 3.05
    const tilePanel = box(15.9, 3.05, 0.06,
      new THREE.MeshStandardMaterial({ map: mats.tileTex(14, 7), roughness: 0.42, metalness: 0.03 }));
    tilePanel.position.set(0, 1.525, L.wallFaceZ);
    tilePanel.receiveShadow = true; add(tilePanel);

    // وبلاط على الجزء اللي وراه سطح العمل الشمال بس
    const tileLeft = box(0.06, 3.05, 5.4,
      new THREE.MeshStandardMaterial({ map: mats.tileTex(5, 7), roughness: 0.42, metalness: 0.03 }));
    tileLeft.position.set(L.wallFaceX, 1.525, -3.8);
    tileLeft.receiveShadow = true; add(tileLeft);

    // وزرة خشب خفيفة عند الأرض
    const skirtMat = M(C.woodDark, 0.8);
    const skirtBack = box(16.2, 0.12, 0.05, skirtMat);
    skirtBack.position.set(0, 0.06, L.wallFaceZ + 0.04); add(skirtBack);
    const skirtRight = box(0.05, 0.12, 14.2, skirtMat);
    skirtRight.position.set(L.rightFaceX - 0.04, 0.06, 0.2); add(skirtRight);

    /* ---------- السقف + شعاع خشب ---------- */
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16.2, 14.6), M(0xF0E7D9, 0.95));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, L.wallH, 0.2); add(ceil);
    [-3.4, 1.6].forEach(z => {
      const beam = box(16.2, 0.22, 0.34, M(C.woodDark, 0.85));
      beam.position.set(0, L.wallH - 0.12, z); add(beam);
    });

    /* ---------- نوافذ على اليمين: ضوء نهار ناعم ---------- */
    [1.4, 4.4].forEach(z => {
      const frame = box(0.1, 2.1, 1.5, M(C.cream, 0.7));
      frame.position.set(L.rightFaceX - 0.04, 2.0, z); add(frame);
      const pane = box(0.04, 1.85, 1.28, new THREE.MeshBasicMaterial({ color: 0xF3F8FF }));
      pane.position.set(L.rightFaceX - 0.11, 2.0, z); add(pane);
      const bar = box(0.05, 1.9, 0.05, M(C.woodDark, 0.8));
      bar.position.set(L.rightFaceX - 0.12, 2.0, z); add(bar);
    });

    /* ---------- أسطح العمل والخزائن السفلية ---------- */
    function counterRun(x, z, w, d, rot) {
      const g = new THREE.Group();
      const cab = box(w, 0.88, d, M(C.wood, 0.82));
      cab.position.y = 0.44; cab.castShadow = cab.receiveShadow = true; g.add(cab);
      // فواصل رأسية بسيطة بين الأبواب + مقابض نحاس
      const n = Math.max(1, Math.round(w / 0.9));
      for (let i = 0; i <= n; i++) {
        const px = -w / 2 + i * (w / n);
        const seam = box(0.025, 0.8, 0.03, M(C.woodDark, 0.85));
        seam.position.set(px, 0.44, d / 2 + 0.005); g.add(seam);
        if (i < n) {
          const pull = cyl(0.012, 0.012, 0.16, 8, M(C.brass, 0.35, 0.8));
          pull.rotation.z = Math.PI / 2;
          pull.position.set(px + (w / n) / 2, 0.74, d / 2 + 0.03); g.add(pull);
        }
      }
      // قاعدة غامقة (toe kick) عشان الخزانة تبان قايمة على الأرض
      const kick = box(w - 0.08, 0.1, d - 0.12, M(C.woodDark, 0.9));
      kick.position.y = 0.05; g.add(kick);
      // الرخام
      const top = box(w + 0.06, 0.05, d + 0.06, mats.marbleMat);
      top.position.y = 0.925; top.castShadow = top.receiveShadow = true; g.add(top);
      const edge = box(w + 0.08, 0.035, d + 0.08, M(C.marbleEdge, 0.55));
      edge.position.y = 0.885; g.add(edge);
      g.position.set(x, 0, z);
      g.rotation.y = rot || 0;
      add(g);
      return g;
    }
    counterRun(0, L.backCounterZ, 15.6, L.counterD, 0);
    block(0, L.backCounterZ, 15.6, L.counterD);
    counterRun(L.leftCounterX, -3.8, 5.0, L.counterD, Math.PI / 2);
    block(L.leftCounterX, -3.8, L.counterD, 5.0);

    // حوض غسيل صغير في الطرف الشمال من السطح الخلفي
    const sink = box(0.8, 0.12, 0.5, M(C.steel, 0.35, 0.7));
    sink.position.set(-5.6, 0.9, L.backCounterZ); add(sink);
    const tap = cyl(0.025, 0.025, 0.42, 10, M(C.brass, 0.3, 0.85));
    tap.position.set(-5.6, 1.14, L.backCounterZ - 0.28); add(tap);
    const spout = cyl(0.022, 0.022, 0.3, 10, M(C.brass, 0.3, 0.85));
    spout.rotation.x = Math.PI / 2;
    spout.position.set(-5.6, 1.33, L.backCounterZ - 0.14); add(spout);

    /* ---------- خزائن علوية زمردية ---------- */
    function upperRun(x, w) {
      const g = new THREE.Group();
      const body = box(w, 1.0, 0.36, M(C.emerald, 0.62));
      body.castShadow = body.receiveShadow = true; g.add(body);
      const n = Math.max(1, Math.round(w / 0.75));
      for (let i = 0; i <= n; i++) {
        const px = -w / 2 + i * (w / n);
        const seam = box(0.02, 0.94, 0.02, M(C.emeraldDeep, 0.7));
        seam.position.set(px, 0, 0.19); g.add(seam);
        if (i < n) {
          const pull = cyl(0.011, 0.011, 0.13, 8, M(C.brass, 0.32, 0.82));
          pull.position.set(px + (w / n) / 2, -0.3, 0.21); g.add(pull);
        }
      }
      const cornice = box(w + 0.06, 0.05, 0.4, M(C.emeraldDeep, 0.6));
      cornice.position.y = 0.52; g.add(cornice);
      g.position.set(x, 2.45, L.wallFaceZ + 0.19);
      add(g);
      return g;
    }
    upperRun(-5.2, 4.8);
    upperRun(5.4, 4.4);

    /* ---------- الرف الخشبي الطويل + الإضاءة المخفية تحته ---------- */
    const shelfMat = M(C.woodWarm, 0.78);
    [1.95, 2.55].forEach((y, k) => {
      const sh = box(5.6, 0.07, 0.3, shelfMat);
      sh.position.set(0.1, y, L.wallFaceZ + 0.16);
      sh.castShadow = true; sh.receiveShadow = true; add(sh);
      // كتائف
      [-2.6, 0.1, 2.7].forEach(x => {
        const br = box(0.06, 0.16, 0.26, M(C.woodDark, 0.85));
        br.position.set(x + 0.1 * (k ? 0 : 0), y - 0.11, L.wallFaceZ + 0.15); add(br);
      });
    });
    // شريط الإضاءة المخفي: مجسّم مضيء رقيق تحت الرف السفلي
    const cove = box(5.4, 0.03, 0.1, new THREE.MeshStandardMaterial({
      color: 0xFFE7C2, emissive: 0xFFD9A0, emissiveIntensity: 0.9, roughness: 0.4
    }));
    cove.position.set(0.1, 1.9, L.wallFaceZ + 0.2); add(cove);

    /* أكواب وعُلب وبرطمانات على الرفوف — أحجام وألوان متفاوتة بهدوء */
    const jarCols = [0x2E5A4B, 0x8A6242, 0xB08A4A, 0x6E2438, 0x4B3324];
    for (let i = 0; i < 8; i++) {
      const h = 0.2 + (i % 3) * 0.05;
      const jar = cyl(0.085, 0.085, h, 16, M(jarCols[i % jarCols.length], 0.55));
      jar.position.set(-2.35 + i * 0.42, 2.6 + h / 2, L.wallFaceZ + 0.16);
      jar.castShadow = true; add(jar);
      const lid = cyl(0.09, 0.09, 0.03, 16, M(C.brass, 0.35, 0.8));
      lid.position.set(jar.position.x, 2.6 + h + 0.015, jar.position.z); add(lid);
    }
    for (let i = 0; i < 9; i++) {                 // فناجين مقلوبة على الرف السفلي
      const cup = cyl(0.055, 0.042, 0.09, 14, M(C.cream, 0.4));
      cup.position.set(-2.4 + i * 0.6, 2.045, L.wallFaceZ + 0.14);
      cup.castShadow = true; add(cup);
    }
    // علب بن على الرف السفلي من اليمين
    ['RAW', 'RAW'].forEach((t, i) => {
      const bag = box(0.24, 0.34, 0.14, M(0x33261E, 0.75));
      bag.position.set(1.85 + i * 0.32, 2.17, L.wallFaceZ + 0.16);
      bag.castShadow = true; add(bag);
      const lab = decal(t, 0.16, 0.07, { fg: '#E8DFD0', size: 90 });
      lab.position.set(bag.position.x, 2.2, L.wallFaceZ + 0.235); add(lab);
    });

    /* ---------- قضيب نحاسي للأدوات على الجدار ---------- */
    const rail = cyl(0.018, 0.018, 3.4, 10, M(C.brass, 0.3, 0.85));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-5.2, 1.75, L.wallFaceZ + 0.1); add(rail);
    for (let i = 0; i < 6; i++) {
      const x = -6.6 + i * 0.56;
      const hook = cyl(0.008, 0.008, 0.1, 6, M(C.brassDim, 0.35, 0.8));
      hook.position.set(x, 1.7, L.wallFaceZ + 0.1); add(hook);
      if (i % 3 === 0) {                              // مصفاة
        const sieve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16),
          M(C.steel, 0.4, 0.6));
        sieve.rotation.x = Math.PI / 2;
        sieve.position.set(x, 1.55, L.wallFaceZ + 0.1); sieve.castShadow = true; add(sieve);
      } else if (i % 3 === 1) {                        // معلقة
        const sp = cyl(0.012, 0.012, 0.3, 8, M(C.steel, 0.35, 0.7));
        sp.position.set(x, 1.5, L.wallFaceZ + 0.1); add(sp);
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M(C.steel, 0.35, 0.7));
        bowl.scale.set(1, 0.4, 1.3);
        bowl.position.set(x, 1.35, L.wallFaceZ + 0.1); add(bowl);
      } else {                                          // إبريق صغير
        const jug = cyl(0.07, 0.06, 0.16, 14, M(C.steel, 0.35, 0.65));
        jug.position.set(x, 1.5, L.wallFaceZ + 0.1); jug.castShadow = true; add(jug);
      }
    }

    /* ---------- تفاصيل صغيرة على السطح الخلفي ---------- */
    const TOPY = L.counterY + 0.05;
    // برج أكواب تيك أواي
    for (let i = 0; i < 3; i++) {
      const tc = cyl(0.055, 0.042, 0.14, 14, M(0xF2EADA, 0.45));
      tc.position.set(-4.62, TOPY + 0.07 + i * 0.035, L.backCounterZ + 0.12);
      tc.castShadow = true; add(tc);
    }
    // علبة مناديل
    const nap = box(0.2, 0.12, 0.12, M(C.woodWarm, 0.7));
    nap.position.set(-4.05, TOPY + 0.06, L.backCounterZ + 0.1);
    nap.castShadow = true; add(nap);
    // لوح تقطيع وعليه كرواسون
    const board = box(0.44, 0.03, 0.26, M(0x8E6842, 0.75));
    board.position.set(-3.3, TOPY + 0.015, L.backCounterZ + 0.08);
    board.castShadow = true; add(board);
    for (let i = 0; i < 3; i++) {
      const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.06, 5, 10), M(0xD9A661, 0.7));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(-3.42 + i * 0.12, TOPY + 0.06, L.backCounterZ + 0.08);
      roll.castShadow = true; add(roll);
    }
    // نبتة صغيرة
    const pot = cyl(0.09, 0.07, 0.13, 14, M(0xB07A55, 0.7));
    pot.position.set(-2.55, TOPY + 0.065, L.backCounterZ + 0.06);
    pot.castShadow = true; add(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0x3F6B3C, 0.85));
      leaf.scale.set(1, 0.55, 0.8);
      leaf.position.set(-2.55 + Math.cos(i * 1.3) * 0.06, TOPY + 0.16 + (i % 2) * 0.05,
                        L.backCounterZ + 0.06 + Math.sin(i * 1.3) * 0.06);
      leaf.castShadow = true; add(leaf);
    }
    // برطمانات مكوّنات
    [[-0.7, 0x8A6242], [-0.42, 0xE0D6C2]].forEach(([x, col]) => {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xEDE8DC, transmission: 0.35,
          roughness: 0.22, transparent: true, opacity: 0.86 }));
      jar.position.set(x, TOPY + 0.1, L.backCounterZ + 0.1); add(jar);
      const fill = cyl(0.068, 0.068, 0.12, 14, M(col, 0.8));
      fill.position.set(x, TOPY + 0.07, L.backCounterZ + 0.1); add(fill);
      const cap = cyl(0.08, 0.08, 0.02, 16, M(C.brass, 0.35, 0.8));
      cap.position.set(x, TOPY + 0.21, L.backCounterZ + 0.1); add(cap);
    });
    // ميزان صغير جنب المطحنة
    const scaleB = box(0.18, 0.03, 0.16, M(C.black, 0.5));
    scaleB.position.set(2.34, TOPY + 0.015, L.backCounterZ + 0.14); add(scaleB);
    const scaleS = box(0.07, 0.012, 0.04, new THREE.MeshStandardMaterial({
      color: 0x0F2A3A, emissive: 0x1E5C86, emissiveIntensity: 0.5, roughness: 0.35 }));
    scaleS.position.set(2.34, TOPY + 0.032, L.backCounterZ + 0.2); add(scaleS);

    /* ---------- الجزيرة الوسطية ---------- */
    const isl = new THREE.Group();
    const iw = L.island.w, id = L.island.d;
    const ibase = box(iw, 0.88, id, M(C.woodDark, 0.8));
    ibase.position.y = 0.44; ibase.castShadow = ibase.receiveShadow = true; isl.add(ibase);
    for (let i = 0; i <= 3; i++) {                        // فواصل واجهة
      const seam = box(0.025, 0.8, 0.02, M(0x3A281C, 0.85));
      seam.position.set(-iw / 2 + i * (iw / 3), 0.44, id / 2 + 0.01); isl.add(seam);
    }
    const ikick = box(iw - 0.1, 0.1, id - 0.12, M(0x2E2016, 0.9));
    ikick.position.y = 0.05; isl.add(ikick);
    const itop = box(iw + 0.14, 0.06, id + 0.14, mats.marbleMat);
    itop.position.y = 0.92; itop.castShadow = itop.receiveShadow = true; isl.add(itop);
    const iedge = box(iw + 0.16, 0.035, id + 0.16, M(C.marbleEdge, 0.55));
    iedge.position.y = 0.875; isl.add(iedge);
    isl.position.set(L.island.x, 0, L.island.z);
    add(isl);
    block(L.island.x, L.island.z, iw + 0.14, id + 0.14);

    // قضيب نحاسي فوق الجزيرة بأكواب معلقة
    const barRail = cyl(0.022, 0.022, iw - 0.2, 10, M(C.brass, 0.3, 0.85));
    barRail.rotation.z = Math.PI / 2;
    barRail.position.set(L.island.x, 2.05, L.island.z); add(barRail);
    [-1.2, -0.6, 0, 0.6, 1.2].forEach((dx, i) => {
      const drop = cyl(0.007, 0.007, 0.18, 6, M(C.brassDim, 0.35, 0.8));
      drop.position.set(L.island.x + dx, 1.96, L.island.z); add(drop);
      const mugCol = [C.cream, 0x2E5A4B, C.cream, 0x6E2438, C.cream][i];
      const mug = cyl(0.065, 0.055, 0.11, 14, M(mugCol, 0.45));
      mug.position.set(L.island.x + dx, 1.81, L.island.z);
      mug.castShadow = true; add(mug);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), M(mugCol, 0.45));
      handle.position.set(L.island.x + dx + 0.08, 1.81, L.island.z);
      handle.rotation.y = Math.PI / 2; add(handle);
    });

    // شغل نص التحضير على الجزيرة: صنية، فناجين، وحبوب بن مبعوترة
    const tray = box(0.7, 0.03, 0.44, M(C.woodWarm, 0.7));
    tray.position.set(L.island.x - 0.9, 0.965, L.island.z + 0.05);
    tray.castShadow = true; add(tray);
    [-0.16, 0.16].forEach(dx => {
      const saucer = cyl(0.1, 0.1, 0.015, 18, M(C.cream, 0.35));
      saucer.position.set(L.island.x - 0.9 + dx, 0.99, L.island.z + 0.05); add(saucer);
      const cup = cyl(0.06, 0.048, 0.075, 16, M(C.cream, 0.32));
      cup.position.set(L.island.x - 0.9 + dx, 1.035, L.island.z + 0.05);
      cup.castShadow = true; add(cup);
    });
    const beanMat = M(0x3B2318, 0.8);
    for (let i = 0; i < 12; i++) {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), beanMat);
      bean.scale.set(1, 0.7, 1.3);
      bean.position.set(L.island.x + 0.7 + (Math.random() - 0.5) * 0.7, 0.965,
                        L.island.z + (Math.random() - 0.5) * 0.7);
      bean.rotation.y = i * 1.1; add(bean);
    }
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x2E5A4B, 0.5));
    bowl.rotation.x = Math.PI; bowl.position.set(L.island.x + 1.1, 1.11, L.island.z - 0.2);
    bowl.castShadow = true; add(bowl);

    /* ---------- منطقة الطعام ---------- */
    const t = L.table;
    const tableG = new THREE.Group();
    const ttop = box(t.w, 0.06, t.d, M(C.woodWarm, 0.6));
    ttop.position.y = 0.74; ttop.castShadow = ttop.receiveShadow = true; tableG.add(ttop);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => {
      const leg = box(0.08, 0.72, 0.08, M(C.woodDark, 0.8));
      leg.position.set(p[0] * (t.w / 2 - 0.12), 0.36, p[1] * (t.d / 2 - 0.12));
      leg.castShadow = true; tableG.add(leg);
    });
    tableG.position.set(t.x, 0, t.z);
    add(tableG);
    block(t.x, t.z, t.w, t.d);

    function chair(x, z, rot) {
      const g = new THREE.Group();
      const seat = box(0.44, 0.05, 0.42, M(C.woodWarm, 0.65));
      seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
      const back = box(0.44, 0.5, 0.05, M(C.woodWarm, 0.65));
      back.position.set(0, 0.7, -0.19); back.castShadow = true; g.add(back);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => {
        const leg = box(0.05, 0.45, 0.05, M(C.woodDark, 0.8));
        leg.position.set(p[0] * 0.18, 0.225, p[1] * 0.17); g.add(leg);
      });
      g.position.set(x, 0, z); g.rotation.y = rot;
      add(g);
      block(x, z, 0.5, 0.5);
      return g;
    }
    chair(t.x - 1.25, t.z, Math.PI / 2);
    chair(t.x + 1.25, t.z, -Math.PI / 2);

    // فازة صغيرة على الطاولة
    const vase = cyl(0.06, 0.08, 0.18, 14, M(0x6E2438, 0.5));
    vase.position.set(t.x, 0.86, t.z); vase.castShadow = true; add(vase);
    for (let i = 0; i < 4; i++) {
      const stem = cyl(0.006, 0.006, 0.22, 6, M(0x3E5C3A, 0.8));
      stem.position.set(t.x + (i - 1.5) * 0.03, 1.03, t.z);
      stem.rotation.z = (i - 1.5) * 0.14; add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M(0x4F7A46, 0.8));
      leaf.scale.set(1, 0.5, 0.6);
      leaf.position.set(t.x + (i - 1.5) * 0.09, 1.14, t.z); add(leaf);
    }

    /* ---------- سبت وأكياس بن على الأرض عند الشمال ---------- */
    const sack = cyl(0.24, 0.28, 0.5, 14, M(0xA8946F, 0.9));
    sack.position.set(-7.0, 0.25, 0.6); sack.castShadow = true; add(sack);
    const sackLab = decal('RAW BEANS', 0.3, 0.09, { fg: '#4B3324', size: 60 });
    sackLab.position.set(-6.98, 0.3, 0.86); add(sackLab);

    /* ---------- كراسي بار عند الجزيرة ---------- */
    [-1.0, 0.4].forEach(dx => {
      const g = new THREE.Group();
      const seat = cyl(0.19, 0.19, 0.06, 18, M(C.woodWarm, 0.6));
      seat.position.y = 0.7; seat.castShadow = true; g.add(seat);
      const post = cyl(0.045, 0.055, 0.7, 12, M(C.steelDark, 0.5, 0.5));
      post.position.y = 0.35; g.add(post);
      const foot = cyl(0.2, 0.2, 0.03, 18, M(C.steelDark, 0.5, 0.5));
      foot.position.y = 0.02; g.add(foot);
      g.position.set(L.island.x + dx, 0, L.island.z + 1.25);
      add(g);
      block(g.position.x, g.position.z, 0.42, 0.42);
    });

    return { floor, obstacles, layout: L };
  };
})(window);
