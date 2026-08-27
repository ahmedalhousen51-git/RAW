/* ==========================================================================
   RAW — الإيدين: مسك الأدوات، الإفلات، الصبّ، الرجّ، التقليب، والتنظيف

   نورة بتمسك الأداة فعلاً: بتتعلّق في قبضة إيدها، وبتتحرك معاها، وبتترمي
   ظلها معاها. التقليب مش زرار — بتلفّ الماوس بحركة دائرية والسائل بيلفّ معاك.

   الأحداث بتترمي لبرّه عن طريق opts.onAction عشان التقييم والصوت يشتغلوا.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const REACH = 1.75;            // مدى وصول الإيد
  const SURFACE_Y = 0.95;        // وش الرخام
  const SHAKE_SECS = 3.4;

  RAW.hands = function (THREE, scene, mats, fx, opts) {
    const o = opts || {};
    const chef = o.chef, drink = o.drink;
    const { C, M, box, cyl } = mats;
    const L = RAW.layout;

    /* الأسطح اللي ينفع تسيب عليها حاجة */
    const SURFACES = [
      { x0: -7.9, x1: 7.9, z0: -6.94, z1: -6.22, y: SURFACE_Y },   // السطح الخلفي
      { x0: -7.94, x1: -7.22, z0: -6.3, z1: -1.3, y: SURFACE_Y },  // السطح الشمال
      { x0: -2.3, x1: 0.9, z0: -1.6, z1: -0.2, y: SURFACE_Y },     // الجزيرة
      { x0: -4.95, x1: -3.25, z0: 1.93, z1: 2.87, y: 0.77 }        // ترابيزة الطعام
    ];
    const SINK = new THREE.Vector3(-5.6, SURFACE_Y, L.backCounterZ);

    /* ---------- حلقة التحديد ---------- */
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2FE0B0, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.115, 26), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 3;
    scene.add(ring);

    /* ---------- الأدوات ---------- */
    const items = [];
    function register(id, name, obj, cfg) {
      cfg = cfg || {};
      obj.userData.grabId = id;
      const it = {
        id: id, name: name, obj: obj,
        home: { p: obj.position.clone(), q: obj.quaternion.clone() },
        carry: cfg.carry || { p: new THREE.Vector3(0, -0.02, 0.04), e: new THREE.Euler(0, 0, 0) },
        pour: cfg.pour || null,          // { kind, color, temp, rate }
        stir: !!cfg.stir,
        shake: cfg.shake || null,        // { effect }
        dirty: false,
        held: false
      };
      items.push(it);
      return it;
    }

    const steel = M(C.steel, 0.3, 0.72);
    const dark = M(0x2A2521, 0.6);

    /* الكوباية نفسها — أهم حاجة تتمسك */
    register('cup', 'الكوباية', drink.group, {
      carry: { p: new THREE.Vector3(0, -0.06, 0.05), e: new THREE.Euler(0, 0, 0) },
      pour: { kind: 'drain', rate: 0.5 }, stir: false,
      shake: { effect: 'mix' }
    });

    /* مضرب الماتشا (Chasen) */
    const chasen = new THREE.Group();
    const chHandle = cyl(0.026, 0.03, 0.09, 12, M(0xD9C79A, 0.75));
    chHandle.position.y = 0.045; chasen.add(chHandle);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tine = cyl(0.0035, 0.0035, 0.075, 5, M(0xE8DBB6, 0.7));
      tine.position.set(Math.cos(a) * 0.022, 0.125, Math.sin(a) * 0.022);
      tine.rotation.z = Math.cos(a) * 0.32;
      tine.rotation.x = -Math.sin(a) * 0.32;
      chasen.add(tine);
    }
    chasen.position.set(-1.15, SURFACE_Y, L.backCounterZ + 0.2);
    chasen.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(chasen);
    register('chasen', 'مضرب الماتشا', chasen, {
      carry: { p: new THREE.Vector3(0, -0.1, 0.03), e: new THREE.Euler(-0.5, 0, 0) },
      stir: true
    });

    /* إبريق اللبن */
    const jug = new THREE.Group();
    const jugBody = cyl(0.062, 0.052, 0.14, 18, steel);
    jugBody.position.y = 0.07; jug.add(jugBody);
    const jugSpout = box(0.04, 0.032, 0.04, steel);
    jugSpout.position.set(0, 0.135, 0.055); jugSpout.rotation.x = 0.55; jug.add(jugSpout);
    const jugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), steel);
    jugHandle.position.set(-0.08, 0.065, 0); jugHandle.rotation.y = Math.PI / 2; jug.add(jugHandle);
    const jugMilk = cyl(0.055, 0.05, 0.08, 16, M(0xF6EFE0, 0.35));
    jugMilk.position.y = 0.055; jug.add(jugMilk);
    jug.position.set(1.85, SURFACE_Y, L.backCounterZ + 0.16);
    jug.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(jug);
    register('jug', 'إبريق اللبن', jug, {
      carry: { p: new THREE.Vector3(0, -0.06, 0.05), e: new THREE.Euler(0, 0, 0) },
      pour: { kind: 'milk', color: 0xC79A6B, temp: 62, rate: 0.16 }
    });

    /* ملعقة التقليب الطويلة */
    const spoon = new THREE.Group();
    const spStick = cyl(0.006, 0.006, 0.19, 8, steel);
    spStick.position.y = 0.095; spoon.add(spStick);
    const spBowl = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), steel);
    spBowl.scale.set(1, 0.42, 1.35);
    spBowl.position.y = 0.008; spoon.add(spBowl);
    spoon.position.set(L.island.x + 0.55, SURFACE_Y, L.island.z + 0.3);
    spoon.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(spoon);
    register('spoon', 'ملعقة التقليب', spoon, {
      carry: { p: new THREE.Vector3(0, -0.12, 0.03), e: new THREE.Euler(-0.35, 0, 0) },
      stir: true
    });

    /* البورتافلتر */
    const porta = new THREE.Group();
    const pBasket = cyl(0.055, 0.05, 0.035, 16, steel);
    pBasket.position.y = 0.018; porta.add(pBasket);
    const pGrounds = cyl(0.048, 0.046, 0.016, 14, M(0x4A3120, 0.9));
    pGrounds.position.y = 0.03; porta.add(pGrounds);
    const pHandle = cyl(0.016, 0.016, 0.11, 10, dark);
    pHandle.rotation.z = Math.PI / 2;
    pHandle.position.set(0.08, 0.018, 0); porta.add(pHandle);
    porta.position.set(5.85, SURFACE_Y, L.backCounterZ + 0.22);
    porta.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(porta);
    register('porta', 'البورتافلتر', porta, {
      carry: { p: new THREE.Vector3(0, -0.05, 0.07), e: new THREE.Euler(0, 0, -0.3) },
      shake: { effect: 'knock' }
    });

    /* زجاجة السيرب */
    const bottle = new THREE.Group();
    const bBody = cyl(0.036, 0.036, 0.16, 14, M(0xC2334D, 0.32));
    bBody.position.y = 0.08; bottle.add(bBody);
    const bNeck = cyl(0.016, 0.016, 0.04, 10, M(0x241C16, 0.5));
    bNeck.position.y = 0.18; bottle.add(bNeck);
    bottle.position.set(6.35, SURFACE_Y, L.backCounterZ + 0.2);
    bottle.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(bottle);
    register('bottle', 'زجاجة السيرب', bottle, {
      carry: { p: new THREE.Vector3(0, -0.08, 0.05), e: new THREE.Euler(0, 0, 0) },
      pour: { kind: 'syrup', color: 0x7A2E3C, temp: 24, rate: 0.06 }
    });

    /* مصفاة الماتشا */
    const sieve = new THREE.Group();
    const svRim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 18), steel);
    svRim.rotation.x = Math.PI / 2; svRim.position.y = 0.02; sieve.add(svRim);
    const svMesh = cyl(0.05, 0.05, 0.002, 18, M(0xBFC4C8, 0.5, 0.4));
    svMesh.position.y = 0.02; sieve.add(svMesh);
    const svHandle = cyl(0.006, 0.006, 0.07, 8, steel);
    svHandle.rotation.z = Math.PI / 2;
    svHandle.position.set(0.08, 0.02, 0); sieve.add(svHandle);
    sieve.position.set(-1.95, SURFACE_Y, L.backCounterZ + 0.2);
    sieve.traverse(n => { if (n.isMesh) n.castShadow = true; });
    scene.add(sieve);
    register('sieve', 'المصفاة', sieve, {
      carry: { p: new THREE.Vector3(0, -0.05, 0.06), e: new THREE.Euler(-0.25, 0, 0) },
      shake: { effect: 'sift' }
    });

    /* ---------- الحالة ---------- */
    let held = null, near = null;
    let tween = null;                 // انتقال ناعم للأداة وهي بتتمسك أو تتساب
    let pouring = false, shaking = 0, cleaning = 0;
    let stirMode = false, stirAngle = 0, stirTurns = 0, stirPower = 0, stirIdle = 0;
    let lastPt = null, centre = null;
    const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    const fire = (kind, info) => { if (o.onAction) o.onAction(kind, info || {}); };

    /* ---------- مساعدات ---------- */
    function chefPos() { return chef.root.position; }
    function dist2D(v) {
      const p = chefPos();
      return Math.hypot(v.x - p.x, v.z - p.z);
    }
    function worldOf(it) {
      it.obj.getWorldPosition(tmp);
      return tmp.clone();
    }
    /** أقرب أداة في متناول الإيد */
    function candidate() {
      if (held) return null;
      let best = null, bd = REACH;
      items.forEach(it => {
        if (it.held) return;
        const d = dist2D(worldOf(it));
        if (d < bd) { bd = d; best = it; }
      });
      return best;
    }
    /** الكوباية لو كانت قريبة (سايبها على السطح) */
    function cupNear() {
      const cup = items[0];
      if (cup.held) return null;
      return dist2D(worldOf(cup)) < 1.4 ? cup : null;
    }
    /** أقرب سطح تحت نقطة */
    function surfaceAt(x, z) {
      for (let i = 0; i < SURFACES.length; i++) {
        const s = SURFACES[i];
        if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s.y;
      }
      return 0;
    }
    function startTween(obj, toP, toQ, dur) {
      tween = {
        obj: obj, t: 0, dur: dur || 0.32,
        fromP: obj.position.clone(), fromQ: obj.quaternion.clone(),
        toP: toP.clone(), toQ: toQ.clone()
      };
    }

    /* ---------- مسك وإفلات ---------- */
    function grab() {
      if (held) return false;
      const it = near || candidate();
      if (!it) return false;
      chef.setPose('reach');
      chef.grip.attach(it.obj);                 // بيحافظ على المكان في العالم
      const q = new THREE.Quaternion().setFromEuler(it.carry.e);
      startTween(it.obj, it.carry.p, q, 0.3);
      it.held = true;
      held = it;
      setTimeout(() => { if (held === it) chef.setPose('carry'); }, 320);
      if (RAW.sfx) RAW.sfx.grab();
      fire('grab', { id: it.id, name: it.name });
      return true;
    }

    /** مسك أداة معيّنة بالاسم (لو في متناول الإيد) */
    function grabId(id) {
      if (held) return false;
      const it = items.filter(x => x.id === id)[0];
      if (!it || it.held) return false;
      if (dist2D(worldOf(it)) > REACH) return false;
      near = it;
      return grab();
    }

    function drop() {
      if (!held) return false;
      const it = held;
      // قدّامها بنص متر، على أقرب سطح
      const p = chefPos();
      const fx2 = Math.sin(chef.root.rotation.y), fz = Math.cos(chef.root.rotation.y);
      const x = p.x + fx2 * 0.55, z = p.z + fz * 0.55;
      const y = surfaceAt(x, z);
      scene.attach(it.obj);
      startTween(it.obj, new THREE.Vector3(x, y, z), it.home.q.clone(), 0.28);
      it.held = false;
      held = null;
      pouring = false; shaking = 0; stirMode = false;
      chef.setPose('idle');
      if (RAW.sfx) RAW.sfx.drop();
      fire('drop', { id: it.id, name: it.name, onSurface: y > 0.1 });
      return true;
    }

    /* ---------- الصبّ ---------- */
    function pourStart() {
      if (!held || !held.pour) return false;
      pouring = true;
      chef.setPose('pour');
      if (RAW.sfx) RAW.sfx.pour({ from: drink.level, to: Math.min(1, drink.level + 0.25), secs: 1.4 });
      fire('pour-start', { id: held.id });
      return true;
    }
    function pourStop() {
      if (!pouring) return false;
      pouring = false;
      chef.setPose(held ? 'carry' : 'idle');
      fire('pour-stop', { id: held ? held.id : null });
      return true;
    }
    function pourStep(dt) {
      if (!pouring || !held) return;
      const src = held.pour;
      if (src.kind === 'drain') {
        // بتفرّغ الكوباية
        if (drink.level <= 0.001) { pourStop(); return; }
        drink.drain(src.rate * dt);
        held.dirty = true;
      } else {
        const target = held.id === 'cup' ? null : cupNear();
        if (!target && held.id !== 'cup') {
          // مفيش كوباية قريبة — بتتكب على السطح
          if (!pourStep.warned) { fire('spill', { id: held.id }); pourStep.warned = true; }
          return;
        }
        pourStep.warned = false;
        drink.pour({ amount: src.rate * dt, color: src.color, tempC: src.temp });
        held.dirty = true;
      }
    }

    /* ---------- الرجّ ---------- */
    function shakeStart() {
      if (!held || !held.shake) return false;
      shaking = 0.0001;
      chef.setPose('shake');
      if (RAW.sfx) RAW.sfx.shake();
      fire('shake-start', { id: held.id });
      return true;
    }
    function shakeStop(done) {
      if (!shaking) return false;
      const p = Math.min(1, shaking / SHAKE_SECS);
      shaking = 0;
      chef.setPose(held ? 'carry' : 'idle');
      fire('shake-stop', { id: held ? held.id : null, progress: +p.toFixed(2), done: !!done });
      return true;
    }
    function shakeStep(dt) {
      if (!shaking || !held) return;
      shaking += dt;
      const it = held;
      // اهتزاز سريع محسوس
      it.obj.position.x = it.carry.p.x + (Math.random() - 0.5) * 0.02;
      it.obj.position.y = it.carry.p.y + (Math.random() - 0.5) * 0.02;
      if (shaking >= SHAKE_SECS) {
        const eff = it.shake.effect;
        if (eff === 'mix') { drink.stir(); }
        else if (eff === 'sift') { drink.pour({ amount: 0.02, color: 0x6E8B3D }); }
        else if (eff === 'knock') { it.dirty = false; }
        if (RAW.sfx) RAW.sfx.confirm();
        shakeStop(true);
      }
    }

    /* ---------- التقليب بحركة دائرية ---------- */
    function stirToggle(on) {
      const want = on == null ? !stirMode : !!on;
      if (want) {
        if (!held || !held.stir) return false;
        if (!cupNear() && !items[0].held) return false;
        stirMode = true; stirTurns = 0; stirPower = 0; stirIdle = 0;
        RAW.stirring = true;
        lastPt = null; centre = null;
        chef.setPose('stir');
        addEventListener('pointermove', onStirMove);
        fire('stir-start', { id: held.id });
      } else {
        if (!stirMode) return false;
        stirMode = false;
        RAW.stirring = false;
        removeEventListener('pointermove', onStirMove);
        chef.setPose(held ? 'carry' : 'idle');
        fire('stir-stop', { turns: +stirTurns.toFixed(2), power: +stirPower.toFixed(2) });
      }
      return true;
    }

    /* الدوران بيتقاس من الزاوية حوالين مركز متحرّك للحركة */
    function onStirMove(e) {
      const pt = { x: e.clientX, y: e.clientY };
      if (!centre) centre = { x: pt.x, y: pt.y };
      centre.x += (pt.x - centre.x) * 0.06;      // المركز بيتبع الحركة ببطء
      centre.y += (pt.y - centre.y) * 0.06;
      if (lastPt) {
        const a1 = Math.atan2(lastPt.y - centre.y, lastPt.x - centre.x);
        const a2 = Math.atan2(pt.y - centre.y, pt.x - centre.x);
        let d = a2 - a1;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const r = Math.hypot(pt.x - centre.x, pt.y - centre.y);
        if (r > 18) {                             // الحركات الصغيرة مش دوران
          stirAngle += d;
          stirTurns += Math.abs(d) / (Math.PI * 2);
          stirPower = Math.min(1, stirPower + Math.abs(d) * 0.55);
          stirIdle = 0;
        }
      }
      lastPt = pt;
    }

    function stirStep(dt) {
      if (!stirMode) return;
      stirIdle += dt;
      stirPower = Math.max(0, stirPower - dt * 0.85);
      if (stirPower > 0.08) {
        drink.state.swirl = Math.max(drink.state.swirl, stirPower * 2.4);
        drink.state.wobble = Math.min(1, drink.state.wobble + stirPower * dt * 2.2);
        if (held && held.id === 'chasen') drink.state.foam = Math.min(1, (drink.state.foam || 0) + stirPower * dt * 0.5);
        held && (held.dirty = true);
        if (RAW.sfx && Math.random() < dt * 6) RAW.sfx.stirTick(stirPower);
      }
      // الأداة بتلف مع الحركة
      if (held) {
        held.obj.rotation.z = Math.sin(stirAngle) * 0.28;
        held.obj.rotation.x = held.carry.e.x + Math.cos(stirAngle) * 0.2;
      }
      if (stirIdle > 2.5) stirToggle(false);      // سكوت طويل = خلاص
    }

    /* ---------- التنظيف ---------- */
    function cleanStart() {
      if (!held) return false;
      if (dist2D(SINK) > 1.9) { fire('clean-far', {}); return false; }
      cleaning = 0.0001;
      chef.setPose('shake');
      fire('clean-start', { id: held.id });
      return true;
    }
    function cleanStep(dt) {
      if (!cleaning || !held) return;
      cleaning += dt;
      if (RAW.sfx && Math.random() < dt * 4) RAW.sfx.water();
      if (cleaning >= 2.2) {
        held.dirty = false;
        if (held.id === 'cup') drink.reset();
        cleaning = 0;
        chef.setPose('carry');
        if (RAW.sfx) RAW.sfx.confirm();
        fire('clean-done', { id: held.id });
      }
    }
    function cleanStop() { cleaning = 0; if (held) chef.setPose('carry'); }

    /* ---------- التحديث ---------- */
    function update(dt) {
      // انتقال الأداة وهي بتتمسك أو تتساب
      if (tween) {
        tween.t += dt;
        const k = Math.min(1, tween.t / tween.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOutQuad
        tween.obj.position.lerpVectors(tween.fromP, tween.toP, e);
        tween.obj.quaternion.slerpQuaternions(tween.fromQ, tween.toQ, e);
        if (k >= 1) tween = null;
      }

      // الحلقة الخضرا حوالين الأداة اللي في متناول الإيد
      const cand = candidate();
      if (cand !== near) { near = cand; fire('near', near ? { id: near.id, name: near.name } : null); }
      if (near && !tween) {
        const w = worldOf(near);
        ring.position.set(w.x, Math.max(0.02, w.y - 0.005), w.z);
        ringMat.opacity = 0.42 + Math.sin(performance.now() * 0.005) * 0.16;
      } else {
        ringMat.opacity = Math.max(0, ringMat.opacity - dt * 2);
      }

      // الأداة المتمسكة بتميل وهي بتصبّ
      if (held && !tween) {
        const tilt = pouring ? -1.15 : 0;
        held.obj.rotation.z += (tilt + (stirMode ? held.obj.rotation.z : 0) - held.obj.rotation.z) * Math.min(1, dt * 6);
        if (!shaking && !stirMode) {
          held.obj.position.lerp(held.carry.p, Math.min(1, dt * 8));
        }
      }

      pourStep(dt);
      shakeStep(dt);
      stirStep(dt);
      cleanStep(dt);
    }

    function state() {
      return {
        held: held ? { id: held.id, name: held.name, dirty: held.dirty,
                       canPour: !!held.pour, canShake: !!held.shake, canStir: !!held.stir } : null,
        near: near ? { id: near.id, name: near.name } : null,
        pouring: pouring, stirring: stirMode,
        shakeProgress: shaking ? Math.min(1, shaking / SHAKE_SECS) : 0,
        cleanProgress: cleaning ? Math.min(1, cleaning / 2.2) : 0,
        stirTurns: +stirTurns.toFixed(2), stirPower: +stirPower.toFixed(2),
        atSink: dist2D(SINK) < 1.9
      };
    }

    function dispose() {
      removeEventListener('pointermove', onStirMove);
      scene.remove(ring);
    }

    return { update, grab, grabId, drop, pourStart, pourStop, shakeStart, shakeStop,
             stirToggle, cleanStart, cleanStop, state, items, dispose,
             get held() { return held; }, get near() { return near; } };
  };
})(window);
