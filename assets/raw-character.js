/* ==========================================================================
   RAW — نورة، الباريستا

   مجسّم stylized بطول واقعي (~١.٧٥ م) فيه:
   · دورة مشي ونَفَس وهي واقفة
   · راسها وعينيها بيتابعوا الماوس (أو المحطة اللي قدامها)
   · رمشة كل كام ثانية
   · تعبيرات: ابتسامة أوسع لما الخطوة تظبط، ودهشة لما تغلط
   · ظل ناعم على الأرض مضمون مهما كانت الإضاءة
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
    const hairM = M(0x241A14, 0.9);
    const dark  = M(0x1F1B18, 0.45);

    const legs = [], arms = [];
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.48, 5, 12), pants);
      leg.position.set(s * 0.1, 0.49, 0);
      root.add(leg); legs.push(leg);
      const shoe = box(0.12, 0.07, 0.24, M(0x2A2521, 0.7));
      shoe.position.set(s * 0.1, 0.035, 0.045);
      root.add(shoe);
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 14), shirt);
    torso.position.y = 1.12; root.add(torso);
    // مريلة الشغل + رباط الوسط
    const apron = box(0.31, 0.5, 0.07, apronM);
    apron.position.set(0, 0.98, 0.15); root.add(apron);
    const apronTop = box(0.2, 0.21, 0.06, apronM);
    apronTop.position.set(0, 1.29, 0.16); root.add(apronTop);
    const tie = box(0.4, 0.05, 0.15, M(0x224437, 0.85));
    tie.position.set(0, 1.04, 0.09); root.add(tie);

    [-1, 1].forEach(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.22, 1.36, 0);
      root.add(pivot); arms.push(pivot);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.28, 5, 12), shirt);
      upper.position.y = -0.18; pivot.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.2, 5, 12), skin);
      fore.position.y = -0.42; pivot.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), skin);
      hand.position.y = -0.56; pivot.add(hand);
    });

    const neck = cyl(0.05, 0.055, 0.09, 12, skin);
    neck.position.y = 1.45; root.add(neck);

    /* الراس كلها في group واحدة عشان تلف ناحية اللي بتبصله */
    const headG = new THREE.Group();
    headG.position.y = 1.47;
    root.add(headG);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 18), skin);
    head.position.y = 0.13; headG.add(head);
    // شعر: طاقية + غرة + كعكة من ورا
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.137, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2.3), hairM);
    hair.position.y = 0.144; headG.add(hair);
    const fringe = new THREE.Mesh(
      new THREE.SphereGeometry(0.139, 22, 8, -0.95, 1.9, 0.5, 0.44), hairM);
    fringe.position.y = 0.144; headG.add(fringe);
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), hairM);
    backHair.scale.set(1, 1.15, 0.62);
    backHair.position.set(0, 0.1, -0.055); headG.add(backHair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), hairM);
    bun.position.set(0, 0.17, -0.115); headG.add(bun);
    const bunTie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14), M(0x6E2438, 0.6));
    bunTie.rotation.x = Math.PI / 2.4;
    bunTie.position.set(0, 0.135, -0.1); headG.add(bunTie);

    const eyeWhiteM = M(0xFFFFFF, 0.25);
    const eyes = [], pupils = [], brows = [];
    [-1, 1].forEach(s => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.027, 12, 10), eyeWhiteM);
      w.position.set(s * 0.048, 0.138, 0.108); headG.add(w); eyes.push(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 10, 8), dark);
      p.position.set(s * 0.048, 0.138, 0.127); headG.add(p); pupils.push(p);
      const b = box(0.048, 0.011, 0.01, dark);
      b.position.set(s * 0.048, 0.186, 0.114); headG.add(b); brows.push(b);
    });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0075, 8, 14, Math.PI), dark);
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.079, 0.112); headG.add(smile);
    const blush = [];
    [-1, 1].forEach(s => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12),
        new THREE.MeshBasicMaterial({ color: 0xD98A86, transparent: true, opacity: 0.22 }));
      b.position.set(s * 0.072, 0.105, 0.104);
      b.rotation.y = s * 0.5;
      headG.add(b); blush.push(b);
    });

    // طاقية الشيف
    const capBand = cyl(0.142, 0.142, 0.045, 20, M(0xF7F3EA, 0.7));
    capBand.position.y = 0.208; headG.add(capBand);
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), M(0xFBF8F1, 0.75));
    capTop.scale.set(1, 0.72, 1);
    capTop.position.y = 0.27; headG.add(capTop);
    const capPuff = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M(0xFBF8F1, 0.75));
    capPuff.position.set(0.03, 0.34, -0.02); headG.add(capPuff);

    // وشاح أخضر زمردي حوالين الرقبة
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 8, 18), M(0x149B83, 0.75));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.44; root.add(scarf);
    const scarfTail = box(0.07, 0.16, 0.04, M(0x149B83, 0.75));
    scarfTail.position.set(0.05, 1.35, 0.09);
    scarfTail.rotation.z = -0.25; root.add(scarfTail);

    // فوطة على الكتف — تفصيلة كافيه صغيرة
    const towel = box(0.09, 0.19, 0.05, M(0xE0D6C2, 0.85));
    towel.position.set(-0.19, 1.31, 0.02); towel.rotation.z = 0.2; root.add(towel);

    root.traverse(n => { if (n.isMesh) n.castShadow = true; });

    /* ظل ناعم تحت الرجلين */
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g2 = cv.getContext('2d');
    const grad = g2.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(35,25,18,.5)');
    grad.addColorStop(1, 'rgba(35,25,18,0)');
    g2.fillStyle = grad; g2.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    root.add(blob);

    scene.add(root);

    /* ---------- الحالة ---------- */
    let phase = 0;
    let blinkIn = 2 + Math.random() * 3, blinkT = 0;
    let mood = 'calm', moodT = 0;
    const lookAt = new THREE.Vector3();
    let looking = false;
    let yawWant = 0, pitchWant = 0, yawNow = 0, pitchNow = 0;
    const headWorld = new THREE.Vector3();

    /** تبصّ لنقطة في العالم (مكان الماوس على الأرض مثلاً) */
    function look(v) {
      if (!v) { looking = false; return; }
      looking = true;
      lookAt.copy(v);
    }
    /** تعبير مؤقت: 'happy' لما الخطوة تظبط، 'oops' لما تغلط */
    function express(kind, secs) {
      mood = kind || 'calm';
      moodT = secs || 1.6;
    }

    function update(dt, moving, speed) {
      /* المشي والنَفَس */
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
        const br = Math.sin(phase) * 0.5 + 0.5;
        torso.scale.set(1 + br * 0.012, 1 + br * 0.008, 1 + br * 0.012);
        arms[0].rotation.x = Math.sin(phase) * 0.05;
        arms[1].rotation.x = -Math.sin(phase) * 0.05;
        legs[0].rotation.x = legs[1].rotation.x = 0;
        root.position.y = br * 0.008;
        torso.rotation.z = 0;
      }

      /* الراس بتتابع النقطة — بزاوية محدودة زي الرقبة الحقيقية */
      if (looking) {
        headG.getWorldPosition(headWorld);
        const dx = lookAt.x - headWorld.x, dz = lookAt.z - headWorld.z;
        const dy = lookAt.y - headWorld.y;
        const flat = Math.max(0.001, Math.hypot(dx, dz));
        let yaw = Math.atan2(dx, dz) - root.rotation.y;
        while (yaw > Math.PI) yaw -= Math.PI * 2;
        while (yaw < -Math.PI) yaw += Math.PI * 2;
        yawWant = Math.max(-0.72, Math.min(0.72, yaw));
        pitchWant = Math.max(-0.34, Math.min(0.34, -Math.atan2(dy, flat)));
      } else {
        yawWant = 0; pitchWant = 0;
      }
      const k = Math.min(1, dt * 5.5);
      yawNow += (yawWant - yawNow) * k;
      pitchNow += (pitchWant - pitchNow) * k;
      headG.rotation.y = yawNow;
      headG.rotation.x = pitchNow;
      // العينين بتزيح شوية كمان — من غير كده البصّة تبان جامدة
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        pupils[i].position.x = s * 0.048 + yawNow * 0.016;
        pupils[i].position.y = 0.138 - pitchNow * 0.012;
      }

      /* الرمشة */
      blinkIn -= dt;
      if (blinkIn <= 0 && blinkT <= 0) { blinkT = 0.13; blinkIn = 2.6 + Math.random() * 4; }
      if (blinkT > 0) {
        blinkT -= dt;
        const shut = Math.sin(Math.max(0, blinkT) / 0.13 * Math.PI);
        const sy = 1 - shut * 0.92;
        eyes[0].scale.y = eyes[1].scale.y = sy;
        pupils[0].scale.y = pupils[1].scale.y = sy;
      } else {
        eyes[0].scale.y = eyes[1].scale.y = 1;
        pupils[0].scale.y = pupils[1].scale.y = 1;
      }

      /* التعبيرات */
      if (moodT > 0) { moodT -= dt; if (moodT <= 0) mood = 'calm'; }
      const wantSmile = mood === 'happy' ? 1.45 : (mood === 'oops' ? 0.55 : 1);
      const wantBrow = mood === 'happy' ? 0.196 : (mood === 'oops' ? 0.206 : 0.186);
      const wantBlush = mood === 'happy' ? 0.4 : 0.22;
      smile.scale.x += (wantSmile - smile.scale.x) * Math.min(1, dt * 7);
      smile.scale.y += ((mood === 'oops' ? 1.5 : 1) - smile.scale.y) * Math.min(1, dt * 7);
      for (let i = 0; i < 2; i++) {
        brows[i].position.y += (wantBrow - brows[i].position.y) * Math.min(1, dt * 7);
        blush[i].material.opacity += (wantBlush - blush[i].material.opacity) * Math.min(1, dt * 4);
      }
    }

    return { root, update, look, express, name: 'نورة' };
  };
})(window);
