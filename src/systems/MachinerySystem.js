/* ==========================================================================
   RAW — الماكينات وهي بتشتغل (MachinerySystem) · كلاس

   لما تشغّل ماكينة، تشوفها بتشتغل فعلاً: الإسبريسو بينزل خيط ويعمل كريما،
   الخلاط بيلف ويعمل دوامة، المضرب بيخفق ويطلّع رغوة، التلج بيقع ويتراكم،
   والحلة بتغلي وغطاها بيرجّ.

   المحرّك بياخد من لوحة التحكّم: { id, k, values } — k من ٠ لـ١ نسبة التقدّم.

   بنية الكلاس: `this.r` فيه كل مجسّمات المشهد (بتتبني مرة واحدة)، والحالة
   المتغيّرة (المحطة الشغّالة، سرعات الدوران، مستويات الرغوة) على `this`
   مباشرة. الدوال اللي بتشتغل كل فريم بقت ميثودز.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const bus = () => RAW.core && RAW.core.bus;
  const log = () => RAW.core && RAW.core.logger;

  class MachinerySystem {
    /**
     * @param {Object} deps {THREE, scene, mats, fx, stations, drink}
     */
    constructor(deps) {
      const d = deps || {};
      if (!d.THREE || !d.scene || !d.mats || !d.fx || !d.stations || !d.drink) {
        const l = log(); if (l) l.error('MachinerySystem: ناقص اعتماديات');
        throw new Error('MachinerySystem: missing dependencies');
      }
      this.THREE = d.THREE;
      this.scene = d.scene;
      this.mats = d.mats;
      this.fx = d.fx;
      this.stations = d.stations;
      this.drink = d.drink;
      this.TOP = RAW.layout.counterY + 0.05;
      this._tmp = new d.THREE.Vector3();

      /* الحالة المتغيّرة — كانت متغيّرات في الـclosure */
      this.cur = null; this.curK = 0; this.curVals = null; this.cool = 0;
      this.espShake = 0;
      this.blendSpin = 0; this.blendJitter = 0; this.pile = 0;
      this.teaFoamLevel = 0; this.whiskPhase = 0;
      this.milkFoamLevel = 0; this.milkSpin = 0; this.milkJitter = 0;
      this.chunkLife = 0;

      this.r = this._build();          // كل مجسّمات المشهد

      const l = log(); if (l) l.debug('MachinerySystem جاهز');
    }

    /* ====================== البناء (مرة واحدة) ====================== */
    _build() {
      const THREE = this.THREE, scene = this.scene, fx = this.fx;
      const { C, M, box, cyl } = this.mats;
      const stations = this.stations, drink = this.drink;
      const TOP = this.TOP;

      /* ---------- خيط السائل: أسطوانة رفيعة بتتمد من فوهة لحد الكوباية ---------- */
      function makeStream(colour, radius) {
        // خامة واضحة: السائل النازل لازم يبان على خلفية الماكينة الغامقة
        const mat = new THREE.MeshStandardMaterial({
          color: colour, roughness: 0.12, metalness: 0.05,
          emissive: colour, emissiveIntensity: 0.35,
          transparent: true, opacity: 0.95
        });
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, 1, 8), mat);
        m.visible = false;
        scene.add(m);
        // بتوصل بين نقطتين: الطول والمكان بيتحسبوا كل فريم
        m.userData.span = function (from, toY) {
          const h = Math.max(0.02, from.y - toY);
          m.scale.set(1, h, 1);
          m.position.set(from.x, from.y - h / 2, from.z);
        };
        return m;
      }

      /* رشة صغيرة عند نقطة سقوط الخيط — بتخلي التدفق محسوس */
      function makeSplash(colour) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.03, 16),
          new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0,
            side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        scene.add(m);
        m.userData.hit = function (x, y, z, power) {
          m.position.set(x, y + 0.002, z);
          m.material.opacity = 0.5 * power;
          m.scale.setScalar(0.7 + Math.random() * 0.5);
        };
        return m;
      }

      /* ---------- بركة قطرات صغيرة تتعاد بدل ما نعمل جديدة كل مرة ---------- */
      function makeDrops(n, colour, size) {
        const mat = new THREE.MeshStandardMaterial({
          color: colour, roughness: 0.2, transparent: true, opacity: 0.9
        });
        const g = new THREE.Group();
        const list = [];
        for (let i = 0; i < n; i++) {
          const d = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 6), mat);
          d.visible = false;
          d.userData = { v: 0, on: false, floor: 0 };
          g.add(d);
          list.push(d);
        }
        scene.add(g);
        return {
          drops: list,
          spawn(from, floorY, spread) {
            for (let i = 0; i < list.length; i++) {
              const d = list[i];
              if (d.userData.on) continue;
              d.position.set(from.x + (Math.random() - 0.5) * (spread || 0.02),
                             from.y, from.z + (Math.random() - 0.5) * (spread || 0.02));
              d.userData.on = true; d.userData.v = 0; d.userData.floor = floorY;
              d.visible = true;
              return d;
            }
            return null;
          },
          update(dt) {
            for (let i = 0; i < list.length; i++) {
              const d = list[i];
              if (!d.userData.on) continue;
              d.userData.v += 9.8 * dt;
              d.position.y -= d.userData.v * dt;
              if (d.position.y <= d.userData.floor) {
                d.userData.on = false; d.visible = false;
              }
            }
          },
          clear() { list.forEach(d => { d.userData.on = false; d.visible = false; }); }
        };
      }

      /* ====================== ☕ الإسبريسو ====================== */
      const esp = stations.espresso;
      const espHead = new THREE.Vector3(esp.obj.position.x, TOP + 0.19, esp.obj.position.z + 0.34);
      const espStream = makeStream(0x6B3B18, 0.019);
      const espDrops = makeDrops(8, 0x3A2010, 0.007);
      const espSplash = makeSplash(0x8A5726);

      /* ====================== 🧪 السيرب ====================== */
      const syr = stations.syrup;
      const syrNozzle = new THREE.Vector3(syr.obj.position.x, TOP + 0.5, syr.obj.position.z + 0.05);
      const syrStream = makeStream(0xC2334D, 0.014);
      const syrDrops = makeDrops(6, 0xC2334D, 0.006);

      /* ====================== 🔥 السخّان ====================== */
      const brew = stations.brew;
      const brewStream = makeStream(0xDCC9A6, 0.015);
      const brewNozzle = new THREE.Vector3(brew.obj.position.x + 0.02, TOP + 0.24, brew.obj.position.z - 0.28);
      // الغطا والملف بيتحركوا: بندوّر عليهم جوه المجموعة
      let potLid = null, coil = null;
      brew.obj.traverse(n => {
        if (!n.isMesh) return;
        if (n.geometry && n.geometry.type === 'TorusGeometry' && !coil) coil = n;
        if (n.geometry && n.geometry.type === 'SphereGeometry' && n.position.y > 0.25 && !potLid) potLid = n;
      });
      const lidY = potLid ? potLid.position.y : 0;

      /* ====================== 🧊 الخلاط + ماكينة التلج ====================== */
      const ice = stations.ice;
      const blender = new THREE.Group();
      // برطمان زجاج
      const jarMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF, transmission: 0.95, roughness: 0.06, thickness: 0.02,
        ior: 1.45, transparent: true, opacity: 1, depthWrite: false
      });
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.24, 22, 1, true), jarMat);
      jar.position.y = 0.16; blender.add(jar);
      const jarBase = cyl(0.095, 0.095, 0.06, 20, M(C.black, 0.5, 0.3));
      jarBase.position.y = 0.03; blender.add(jarBase);
      // سائل جوّه
      const blendMat = new THREE.MeshPhysicalMaterial({
        color: 0xD9A05B, roughness: 0.18, clearcoat: 0.7, transparent: true, opacity: 0.95
      });
      const blendLiquid = cyl(0.094, 0.082, 0.13, 20, blendMat);
      blendLiquid.position.y = 0.125; blender.add(blendLiquid);
      // الدوامة: قمع مقلوب بيغور مع السرعة
      const vortex = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.1, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xF0D6AE, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      vortex.position.y = 0.19; blender.add(vortex);
      // الشفرات
      const blades = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = box(0.075, 0.004, 0.016, M(C.steel, 0.25, 0.85));
        b.rotation.y = (i / 3) * Math.PI * 2;
        b.rotation.z = 0.28;
        blades.add(b);
      }
      blades.position.y = 0.075; blender.add(blades);
      // فقاقيع ورذاذ
      const blendBubbles = [];
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.004 + (i % 3) * 0.002, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xFFF3DE, transparent: true, opacity: 0 }));
        b.userData = { a: Math.random() * 6.28, r: 0.02 + Math.random() * 0.055, t: Math.random() };
        blender.add(b); blendBubbles.push(b);
      }
      const spray = [];
      for (let i = 0; i < 10; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xF3DCB6, transparent: true, opacity: 0 }));
        const a = Math.random() * 6.28;
        s.position.set(Math.cos(a) * 0.088, 0.13 + Math.random() * 0.1, Math.sin(a) * 0.088);
        blender.add(s); spray.push(s);
      }
      blender.position.set(ice.obj.position.x + 0.02, TOP, ice.obj.position.z + 1.05);
      blender.traverse(n => { if (n.isMesh && n !== jar) n.castShadow = true; });
      scene.add(blender);

      // مكعبات بتقع من فتحة ماكينة التلج
      const iceChute = new THREE.Vector3(ice.obj.position.x, TOP + 0.22, ice.obj.position.z + 0.29);
      const fallCubes = [];
      const cubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xF2FAFF, roughness: 0.07, clearcoat: 1, transparent: true, opacity: 0.7
      });
      for (let i = 0; i < 10; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), cubeMat);
        c.visible = false;
        c.userData = { on: false, v: 0, spin: new THREE.Vector3(), rest: 0 };
        scene.add(c);
        fallCubes.push(c);
      }

      /* ====================== 🍵 الماتشا ====================== */
      const tea = stations.tea;
      const matcha = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        M(0xF2EADA, 0.5));
      bowl.rotation.x = Math.PI;
      bowl.position.y = 0.085; matcha.add(bowl);
      const bowlBase = cyl(0.04, 0.045, 0.012, 16, M(0xE6DCC8, 0.6));
      bowlBase.position.y = 0.006; matcha.add(bowlBase);
      const teaMat = new THREE.MeshPhysicalMaterial({ color: 0x3E5C24, roughness: 0.2, clearcoat: 0.8 });
      const teaLiquid = cyl(0.072, 0.05, 0.03, 20, teaMat);
      teaLiquid.position.y = 0.045; matcha.add(teaLiquid);
      // الرغوة: قرص بيكبر ويفتح لونه
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xBFD79A, roughness: 0.85, transparent: true, opacity: 0 });
      const teaFoam = cyl(0.07, 0.068, 0.008, 20, foamMat);
      teaFoam.position.y = 0.061; matcha.add(teaFoam);
      // المضرب اللي بيخفق
      const whisk = new THREE.Group();
      const wHandle = cyl(0.02, 0.023, 0.07, 10, M(0xD9C79A, 0.75));
      wHandle.position.y = 0.06; whisk.add(wHandle);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const t = cyl(0.003, 0.003, 0.055, 5, M(0xE8DBB6, 0.7));
        t.position.set(Math.cos(a) * 0.016, 0.008, Math.sin(a) * 0.016);
        t.rotation.z = Math.cos(a) * 0.3;
        t.rotation.x = -Math.sin(a) * 0.3;
        whisk.add(t);
      }
      whisk.position.set(0, 0.075, 0);
      whisk.visible = false;
      matcha.add(whisk);
      // رغوة ميكروية: كور صغيرة بتظهر تدريجياً على السطح
      const microFoam = [];
      const microMat = new THREE.MeshStandardMaterial({ color: 0xD8E9B4, roughness: 0.95, transparent: true, opacity: 0 });
      for (let i = 0; i < 16; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.008 + (i % 3) * 0.004, 7, 6), microMat);
        const a = (i / 16) * Math.PI * 2, r = 0.018 + (i % 4) * 0.013;
        f.position.set(Math.cos(a) * r, 0.063, Math.sin(a) * r);
        f.scale.setScalar(0.2);
        matcha.add(f); microFoam.push(f);
      }
      // بودرة ماتشا بتتنثر أول ما تبدأ
      const powder = [];
      const powderMat = new THREE.MeshBasicMaterial({ color: 0x7FA83C, transparent: true, opacity: 0 });
      for (let i = 0; i < 12; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 5, 4), powderMat);
        d.userData = { a: Math.random() * 6.28, r: Math.random() * 0.05, t: Math.random() };
        matcha.add(d); powder.push(d);
      }
      const teaBubbles = [];
      for (let i = 0; i < 10; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xEAF3D8, transparent: true, opacity: 0 }));
        b.userData = { a: Math.random() * 6.28, r: 0.015 + Math.random() * 0.05, t: Math.random() };
        matcha.add(b); teaBubbles.push(b);
      }
      matcha.position.set(tea.obj.position.x + 0.55, TOP, tea.obj.position.z + 0.16);
      matcha.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(matcha);

      /* ====================== ⚙️ المطحنة ====================== */
      const grinder = stations.grinder;
      const grounds = [];
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x4A3120, roughness: 0.95, transparent: true, opacity: 0 });
      for (let i = 0; i < 10; i++) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), groundMat);
        g.userData = { t: Math.random(), x: (Math.random() - 0.5) * 0.03, z: (Math.random() - 0.5) * 0.03 };
        scene.add(g);
        grounds.push(g);
      }

      /* ====================== 🥛 اللبن ====================== */
      const milk = stations.milk;
      const milkRig = new THREE.Group();
      const steelM = M(C.steel, 0.26, 0.75);
      // إبريق التبخير
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.17, 20, 1, true), steelM);
      pit.position.y = 0.085; milkRig.add(pit);
      const pitBase = cyl(0.062, 0.062, 0.008, 18, steelM);
      pitBase.position.y = 0.004; milkRig.add(pitBase);
      const pitSpout = box(0.05, 0.04, 0.05, steelM);
      pitSpout.position.set(0, 0.165, 0.07); pitSpout.rotation.x = 0.6; milkRig.add(pitSpout);
      const pitHandle = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 6, 12), steelM);
      pitHandle.position.set(-0.093, 0.08, 0); pitHandle.rotation.y = Math.PI / 2; milkRig.add(pitHandle);
      // اللبن جوّه: المستوى والرغوة بيعلوا مع التبخير
      const milkMat = new THREE.MeshPhysicalMaterial({ color: 0xFBF4E6, roughness: 0.28, clearcoat: 0.6 });
      const milkBody = cyl(0.07, 0.06, 0.1, 18, milkMat);
      milkBody.position.y = 0.06; milkRig.add(milkBody);
      const milkFoamMat = new THREE.MeshStandardMaterial({ color: 0xFFFDF7, roughness: 0.9, transparent: true, opacity: 0 });
      const milkFoam = cyl(0.069, 0.068, 0.012, 18, milkFoamMat);
      milkFoam.position.y = 0.112; milkRig.add(milkFoam);
      // دوامة اللبن (whirlpool) — علامة التبخير الصح
      const milkSwirl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.05, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xFFF6E4, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false }));
      milkSwirl.position.y = 0.115; milkRig.add(milkSwirl);
      // لانس البخار داخل في اللبن
      const wandArm = cyl(0.011, 0.009, 0.24, 10, M(C.steelDark, 0.3, 0.8));
      wandArm.position.set(0.035, 0.2, -0.02); wandArm.rotation.z = 0.42; milkRig.add(wandArm);
      const wandTip = cyl(0.009, 0.007, 0.03, 8, M(C.steelDark, 0.3, 0.8));
      wandTip.position.set(0.005, 0.095, -0.005); milkRig.add(wandTip);
      // فقاقيع دقيقة
      const milkBubbles = [];
      for (let i = 0; i < 12; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.003 + (i % 3) * 0.0015, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
        b.userData = { a: Math.random() * 6.28, r: 0.015 + Math.random() * 0.04, t: Math.random() };
        milkRig.add(b); milkBubbles.push(b);
      }
      milkRig.position.set(milk.obj.position.x + 0.42, TOP, milk.obj.position.z + 0.2);
      milkRig.traverse(n => { if (n.isMesh) n.castShadow = true; });
      scene.add(milkRig);
      const milkSteam = fx.steam(milkRig, 0, 0.2, 0, 0.07, 0.42, 10, 0.022);

      /* ====================== عرض المكوّنات جوه الماكينة ====================== */
      // قطع بتظهر في برطمان الخلاط، وبتصغّر وتختفي وهو بيخلط
      const chunks = [];
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03),
          new THREE.MeshStandardMaterial({ color: 0xE0475B, roughness: 0.55 }));
        c.visible = false;
        c.userData = { a: Math.random() * 6.28, r: 0.03 + Math.random() * 0.035, ph: Math.random() * 6 };
        blender.add(c);
        chunks.push(c);
      }

        return {
          espHead, espStream, espDrops, espSplash, syr, syrNozzle, syrStream, syrDrops, brew, brewStream, brewNozzle, potLid, coil, lidY, ice, blender, jar, jarMat, blendMat, blendLiquid, vortex, blades, blendBubbles, spray, iceChute, fallCubes, chunks, tea, matcha, teaMat, teaLiquid, foamMat, teaFoam, whisk, microFoam, microMat, powder, powderMat, teaBubbles, grinder, grounds, groundMat, milk, milkRig, milkMat, milkBody, milkFoamMat, milkFoam, milkSwirl, milkBubbles, milkSteam, esp
        };
    }

    /** بيتنده لما المكوّنات تتغيّر: بيوري اللي اتحط جوه الماكينة */
    setContents(id, ids) {
      const ING = RAW.ingredients;
      if (!ING) return;
      const list = (ids || []).map(x => ING.byId[x]).filter(Boolean);
      if (id === 'ice') {
        this.chunkLife = list.length ? 1 : 0;
        this.r.chunks.forEach((c, i) => {
          const it = list[i % Math.max(1, list.length)];
          c.visible = !!list.length && i < Math.max(list.length, 3);
          if (it) c.material.color.setHex(it.c);
          c.scale.setScalar(1);
        });
        // لون السائل في البرطمان بيقرب من خليط المكوّنات
        const m = ING.mix(ids || []);
        if (m) this.r.blendMat.color.setHex(m.color);
      } else if (id === 'tea') {
        const m = ING.mix(ids || []);
        if (m) { this.r.teaMat.color.setHex(m.color); this.teaFoamLevel = 0; this.r.foamMat.opacity = 0; }
      } else if (id === 'espresso') {
        const m = ING.mix(ids || []);
        if (m) this.r.espStream.material.color.setHex(m.color);
      }
    }

    /* ====================== التشغيل ====================== */

    /** بيتنده كل فريم من الحلقة: run = { id, k, values } أو null */
    tick(dt, now, run) {
      const id = run && run.id;
      if (id !== this.cur) { this.exit(this.cur); this.cur = id; this.enter(this.cur); }
      this.curK = run ? run.k : 0;
      this.curVals = run ? run.values : null;
      if (this.cur) this.machineRun(this.cur, this.curK, dt, now, this.curVals || {});
      this.settle(dt, now);
      this.r.espDrops.update(dt);
      this.r.syrDrops.update(dt);
      this.updateFallingCubes(dt);
    }

    enter(id) {
      if (id === 'ice') { this.blendJitter = 0; }
      if (id === 'tea') { this.r.whisk.visible = true; this.whiskPhase = 0; }
      if (id === 'espresso') { this.drink.state.foam = Math.max(this.drink.state.foam, 0.05); }
    }
    exit(id) {
      if (!id) return;
      this.r.espStream.visible = false;
      this.r.syrStream.visible = false;
      this.r.brewStream.visible = false;
      if (id === 'tea') this.r.whisk.visible = false;
      this.cool = 1.6;                        // وقت هدوء بعد الوقفة
    }

    machineRun(id, k, dt, now, v) {
      switch (id) {
        case 'espresso': this.runEspresso(k, dt, now); break;
        case 'grinder':  this.runGrinder(k, dt, now); break;
        case 'syrup':    this.runSyrup(k, dt, now, v); break;
        case 'milk':     this.runMilk(k, dt, now, v); break;
        case 'ice':      this.runBlender(k, dt, now, v); break;
        case 'tea':      this.runMatcha(k, dt, now, v); break;
        case 'brew':     this.runBrew(k, dt, now, v); break;
      }
    }

    /* ---------- ☕ ---------- */
    runEspresso(k, dt, now) {
      // هدف الخيط: الكوباية لو قريبة، وإلا صنية التصريف
      this.drink.group.getWorldPosition(this._tmp);
      const cupNear = Math.hypot(this._tmp.x - this.r.espHead.x, this._tmp.z - this.r.espHead.z) < 0.75;
      const target = cupNear ? this._tmp.y + this.drink.level * 0.115 : this.TOP + 0.02;
      const from = this.r.espHead;

      if (k < 0.14) {
        // مرحلة القطرات: بطيئة وغامقة
        this.r.espStream.visible = false;
        if (Math.random() < dt * 9) this.r.espDrops.spawn(from, target, 0.012);
      } else if (k < 0.9) {
        this.r.espStream.visible = true;
        this.r.espStream.userData.span(from, target);
        const w = 0.9 + Math.sin(now * 0.02) * 0.1;
        this.r.espStream.scale.x = this.r.espStream.scale.z = w;
        // اللون بيفتح من غامق لدهبي مع التقدّم
        this.r.espStream.material.color.setHex(k < 0.35 ? 0x3A2010 : (k < 0.7 ? 0x6B3B18 : 0x8A5726));
        this.r.espSplash.userData.hit(from.x, target, from.z, 1);
        if (cupNear) {
          this.drink.state.wobble = Math.min(1, this.drink.state.wobble + dt * 0.8);
          this.drink.state.foam = Math.min(0.55, this.drink.state.foam + dt * 0.12);   // الكريما
        }
      } else {
        // بيخف في الآخر
        this.r.espStream.visible = true;
        this.r.espStream.userData.span(from, target);
        const w = Math.max(0.15, (1 - k) * 6);
        this.r.espStream.scale.x = this.r.espStream.scale.z = w;
        this.r.espStream.material.color.setHex(0xA97B45);
        if (Math.random() < dt * 5) this.r.espDrops.spawn(from, target, 0.01);
      }
      if (this.r.esp.plume) this.r.esp.plume.userData.boost = Math.max(this.r.esp.plume.userData.boost, 0.5);
      this.espShake = 0.5 + k * 0.5;
    }

    /* ---------- ⚙️ ---------- */
    runGrinder(k, dt, now) {
      const chute = this.r.grinder.obj.position;
      this.r.groundMat.opacity = 0.95;
      for (let i = 0; i < this.r.grounds.length; i++) {
        const g = this.r.grounds[i], u = g.userData;
        u.t += dt * 2.2;
        if (u.t > 1) { u.t = 0; u.x = (Math.random() - 0.5) * 0.03; u.z = (Math.random() - 0.5) * 0.03; }
        g.position.set(chute.x + u.x, this.TOP + 0.22 - u.t * 0.2, chute.z + 0.2 + u.z);
        g.visible = true;
      }
    }

    /* ---------- 🧪 ---------- */
    runSyrup(k, dt, now, v) {
      this.drink.group.getWorldPosition(this._tmp);
      const near = Math.hypot(this._tmp.x - this.r.syrNozzle.x, this._tmp.z - this.r.syrNozzle.z) < 1.1;
      const target = near ? this._tmp.y + this.drink.level * 0.115 : this.TOP + 0.02;
      const spec = RAW.consoles.syrup.controls.filter(c => c.k === 'flavor')[0];
      const opt = spec && spec.options.filter(o => o.v === v.flavor)[0];
      const col = opt ? opt.col : 0xC2334D;
      this.r.syrStream.material.color.setHex(col);
      this.r.syrDrops.drops.forEach(d => d.material.color.setHex(col));
      // ضخات: تدفق نابض مع كل ضخة
      const pulse = (Math.sin(k * Math.PI * (v.pumps || 2) * 2) + 1) / 2;
      this.r.syrStream.visible = pulse > 0.25;
      if (this.r.syrStream.visible) {
        this.r.syrStream.userData.span(this.r.syrNozzle, target);
        this.r.syrStream.scale.x = this.r.syrStream.scale.z = 0.6 + pulse * 0.7;
        if (near) this.drink.state.wobble = Math.min(1, this.drink.state.wobble + dt * 0.9);
      } else if (Math.random() < dt * 4) this.r.syrDrops.spawn(this.r.syrNozzle, target, 0.008);
    }

    /* ---------- 🥛 ---------- */
    runMilk(k, dt, now, v) {
      const wantFoam = (v.foam == null ? 35 : v.foam) / 100;
      const heat = (v.heat || 64) / 78;
      this.r.milkSteam.userData.boost = 0.6 + heat * 0.6;
      if (this.r.milk.lamp) this.r.milk.lamp.material.emissiveIntensity = 0.4 + Math.sin(now * 0.02) * 0.3;

      // الرغوة بتزيد لحد النسبة المطلوبة، والمستوى بيعلى معاها
      this.milkFoamLevel = Math.min(wantFoam, this.milkFoamLevel + dt * 0.42);
      this.r.milkFoamMat.opacity = Math.min(1, 0.25 + this.milkFoamLevel * 1.6);
      this.r.milkFoam.scale.y = 0.5 + this.milkFoamLevel * 6;
      this.r.milkFoam.position.y = 0.112 + this.milkFoamLevel * 0.02;
      this.r.milkBody.scale.y = 1 + this.milkFoamLevel * 0.25;
      this.r.milkBody.position.y = 0.06 + this.milkFoamLevel * 0.012;
      // الدوامة بتلف في وش اللبن
      this.milkSpin += dt * (3 + heat * 5);
      this.r.milkSwirl.rotation.y = this.milkSpin;
      this.r.milkSwirl.material.opacity = 0.25 + Math.sin(now * 0.01) * 0.1 + this.milkFoamLevel * 0.3;
      this.r.milkSwirl.scale.set(1 + Math.sin(this.milkSpin) * 0.06, 0.8 + this.milkFoamLevel, 1 + Math.cos(this.milkSpin) * 0.06);
      this.r.milkSwirl.position.y = 0.115 + this.milkFoamLevel * 0.02;
      // فقاقيع دقيقة بتطلع من طرف اللانس
      for (let i = 0; i < this.r.milkBubbles.length; i++) {
        const b = this.r.milkBubbles[i], u = b.userData;
        u.t += dt * (1.2 + heat * 1.4);
        if (u.t > 1) u.t -= 1;
        b.position.set(Math.cos(u.a + this.milkSpin * 0.4) * u.r * (0.4 + u.t * 0.6),
                       0.03 + u.t * 0.09,
                       Math.sin(u.a + this.milkSpin * 0.4) * u.r * (0.4 + u.t * 0.6));
        b.material.opacity = Math.sin(u.t * Math.PI) * 0.75;
      }
      // اللبن بيسخن فبيبقى أفتح وأدفى
      this.r.milkMat.color.lerp(new this.THREE.Color(0xFFFAF0), dt * 0.4);
      this.milkJitter = 0.5 + heat * 0.5;
      // اللي في الكوباية بياخد رغوة كمان
      this.drink.state.foam = Math.min(1, this.drink.state.foam + dt * 0.12 * (wantFoam * 2));
    }

    /* ---------- 🧊 الخلاط ---------- */
    runBlender(k, dt, now, v) {
      const speed = (v.speed || 6) / 10;
      this.blendSpin += dt * speed * 46;
      this.r.blades.rotation.y = this.blendSpin;
      // الدوامة بتغور مع السرعة
      this.r.vortex.material.opacity = 0.15 + speed * 0.4;
      this.r.vortex.scale.set(0.8 + speed * 0.5, 0.6 + speed * 1.5, 0.8 + speed * 0.5);
      this.r.vortex.position.y = 0.2 - speed * 0.02;
      // مستوى السائل بيعلى شوية من الهوا
      this.r.blendLiquid.scale.y = 1 + speed * 0.16;
      this.r.blendLiquid.position.y = 0.125 + speed * 0.01;
      // فقاقيع
      for (let i = 0; i < this.r.blendBubbles.length; i++) {
        const b = this.r.blendBubbles[i], u = b.userData;
        u.t += dt * (0.6 + speed * 1.6);
        if (u.t > 1) u.t -= 1;
        b.position.set(Math.cos(u.a + this.blendSpin * 0.05) * u.r, 0.07 + u.t * 0.13,
                       Math.sin(u.a + this.blendSpin * 0.05) * u.r);
        b.material.opacity = Math.sin(u.t * Math.PI) * (0.3 + speed * 0.5);
      }
      // رذاذ على جوانب البرطمان في السرعات العالية
      const sp = Math.max(0, speed - 0.5) * 1.6;
      this.r.spray.forEach(s => { s.material.opacity = sp * (0.4 + Math.random() * 0.3); });
      // القطع بتتفتفت وتختفي مع الخلط
      if (this.chunkLife > 0) {
        this.chunkLife = Math.max(0, this.chunkLife - dt * 0.5 * (0.5 + speed));
        this.r.chunks.forEach(c => {
          if (!c.visible) return;
          const u = c.userData;
          c.scale.setScalar(Math.max(0.05, this.chunkLife));
          c.position.set(Math.cos(u.a + this.blendSpin * 0.12) * u.r * this.chunkLife,
                         0.09 + Math.sin(now * 0.004 + u.ph) * 0.015,
                         Math.sin(u.a + this.blendSpin * 0.12) * u.r * this.chunkLife);
          c.rotation.y += dt * 6 * speed;
          if (this.chunkLife <= 0.06) c.visible = false;
        });
      }
      // اهتزاز
      this.blendJitter = speed;
      // لون السائل بيتجانس
      this.r.blendMat.color.lerp(new this.THREE.Color(0xE8C48A), dt * 0.35);
      if (this.r.ice.lamp) this.r.ice.lamp.material.emissiveIntensity = 0.4 + speed * Math.abs(Math.sin(now * 0.03));
    }

    /* ---------- 🍵 الماتشا ---------- */
    runMatcha(k, dt, now, v) {
      this.r.whisk.visible = true;
      const angle = (v.angle || 45) / 90;
      this.whiskPhase += dt * (7 + angle * 7);
      // حركة W: رايح جاي مع ميل حسب الزاوية المضبوطة
      this.r.whisk.position.x = Math.sin(this.whiskPhase) * 0.03;
      this.r.whisk.position.z = Math.sin(this.whiskPhase * 2) * 0.012;
      this.r.whisk.position.y = 0.075 + Math.abs(Math.sin(this.whiskPhase)) * 0.004;
      this.r.whisk.rotation.z = -Math.sin(this.whiskPhase) * 0.5 * (0.4 + angle);
      this.r.whisk.rotation.x = Math.cos(this.whiskPhase) * 0.2;
      // بودرة بتتنثر في أول الخفق
      const dust = Math.max(0, 1 - k * 4);
      this.r.powderMat.opacity = dust * 0.8;
      for (let i = 0; i < this.r.powder.length; i++) {
        const d = this.r.powder[i], u = d.userData;
        u.t += dt * 1.4;
        if (u.t > 1) u.t -= 1;
        d.position.set(Math.cos(u.a + this.whiskPhase * 0.2) * u.r, 0.08 + u.t * 0.05 * dust,
                       Math.sin(u.a + this.whiskPhase * 0.2) * u.r);
      }
      // الرغوة بتزيد، واللون بيفتح
      this.teaFoamLevel = Math.min(1, this.teaFoamLevel + dt * (0.16 + angle * 0.2));
      // رغوة ميكروية: الكور بتكبر وتظهر مع الخفق
      this.r.microMat.opacity = Math.min(0.95, this.teaFoamLevel * 1.3);
      for (let i = 0; i < this.r.microFoam.length; i++) {
        const f = this.r.microFoam[i];
        const grow = Math.min(1, this.teaFoamLevel * 1.4 - (i / this.r.microFoam.length) * 0.3);
        f.scale.setScalar(Math.max(0.15, grow));
        f.position.y = 0.063 + this.teaFoamLevel * 0.012 + Math.sin(this.whiskPhase * 0.6 + i) * 0.002;
      }
      // تموّج السطح مع حركة المضرب
      this.r.teaLiquid.scale.x = 1 + Math.sin(this.whiskPhase) * 0.03;
      this.r.teaLiquid.scale.z = 1 + Math.cos(this.whiskPhase) * 0.03;
      this.r.foamMat.opacity = this.teaFoamLevel * 0.95;
      this.r.teaFoam.scale.y = 0.6 + this.teaFoamLevel * 2.6;
      this.r.teaFoam.position.y = 0.061 + this.teaFoamLevel * 0.008;
      this.r.teaMat.color.lerp(new this.THREE.Color(0x6E9B3A), dt * 0.5);
      this.r.foamMat.color.lerp(new this.THREE.Color(0xD8E9B4), dt * 0.4);
      for (let i = 0; i < this.r.teaBubbles.length; i++) {
        const b = this.r.teaBubbles[i], u = b.userData;
        u.t += dt * 1.6;
        if (u.t > 1) u.t -= 1;
        b.position.set(Math.cos(u.a) * u.r, 0.05 + u.t * 0.02, Math.sin(u.a) * u.r);
        b.material.opacity = Math.sin(u.t * Math.PI) * 0.6 * this.teaFoamLevel;
      }
    }

    /* ---------- 🔥 السخّان ---------- */
    runBrew(k, dt, now, v) {
      const heat = Math.min(1, k * 1.6);
      if (this.r.coil) this.r.coil.material.emissiveIntensity = 0.35 + heat * 1.8;
      if (this.r.potLid) {
        this.r.potLid.position.y = this.r.lidY + Math.abs(Math.sin(now * 0.05)) * 0.006 * heat;
        this.r.potLid.rotation.z = Math.sin(now * 0.06) * 0.02 * heat;
      }
      if (this.r.brew.plume) this.r.brew.plume.userData.boost = Math.max(this.r.brew.plume.userData.boost, heat);
      // في آخر التسخين بينزل خيط مية في الكوباية لو قريبة
      this.drink.group.getWorldPosition(this._tmp);
      const near = Math.hypot(this._tmp.x - this.r.brewNozzle.x, this._tmp.z - this.r.brewNozzle.z) < 1.2;
      if (k > 0.75 && near) {
        this.r.brewStream.visible = true;
        this.r.brewStream.userData.span(this.r.brewNozzle, this._tmp.y + this.drink.level * 0.115);
        this.drink.state.wobble = Math.min(1, this.drink.state.wobble + dt * 0.7);
      } else this.r.brewStream.visible = false;
    }

    /* ---------- التلج بيقع ---------- */
    dropCubes(n) {
      let made = 0;
      for (let i = 0; i < this.r.fallCubes.length && made < n; i++) {
        const c = this.r.fallCubes[i];
        if (c.userData.on) continue;
        c.position.set(this.r.iceChute.x + (Math.random() - 0.5) * 0.05, this.r.iceChute.y,
                       this.r.iceChute.z + (Math.random() - 0.5) * 0.05);
        c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        c.userData.on = true;
        c.userData.v = 0;
        c.userData.rest = this.TOP + 0.06 + this.pile * 0.012;
        c.userData.spin.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        c.visible = true;
        this.pile = Math.min(8, this.pile + 1);
        made++;
      }
      if (RAW.sfx) RAW.sfx.clink();
    }
    updateFallingCubes(dt) {
      for (let i = 0; i < this.r.fallCubes.length; i++) {
        const c = this.r.fallCubes[i], u = c.userData;
        if (!u.on) continue;
        u.v += 9.8 * dt;
        c.position.y -= u.v * dt;
        c.rotation.x += u.spin.x * dt;
        c.rotation.y += u.spin.y * dt;
        if (c.position.y <= u.rest) {
          c.position.y = u.rest;
          if (u.v > 1.2) { u.v = -u.v * 0.32; c.position.y += 0.001; }   // نطة خفيفة
          else { u.v = 0; u.spin.multiplyScalar(0.4); }
        }
      }
    }

    /* الجسيمات اللي شفافيتها صفر لسه بتترسم — فبنخفيها خالص وهي مش شغّالة.
       ده بيوفّر ~٦٠ draw call على الموبايل. */
    idleHide() {
      const ice_ = this.cur === 'ice', tea_ = this.cur === 'tea', milk_ = this.cur === 'milk', gr_ = this.cur === 'grinder';
      this.r.blendBubbles.forEach(b => (b.visible = ice_ || b.material.opacity > 0.02));
      this.r.spray.forEach(sp => (sp.visible = ice_ || sp.material.opacity > 0.02));
      this.r.vortex.visible = ice_ || this.r.vortex.material.opacity > 0.02;
      this.r.teaBubbles.forEach(b => (b.visible = tea_ || b.material.opacity > 0.02));
      this.r.powder.forEach(d => (d.visible = tea_ && this.r.powderMat.opacity > 0.02));
      this.r.microFoam.forEach(f => (f.visible = this.teaFoamLevel > 0.04));
      this.r.milkBubbles.forEach(b => (b.visible = milk_ || b.material.opacity > 0.02));
      this.r.grounds.forEach(g => (g.visible = gr_ || this.r.groundMat.opacity > 0.02));
      this.r.espSplash.visible = this.r.espSplash.material.opacity > 0.02;
    }

    /* ---------- الهدوء بعد الوقفة ---------- */
    settle(dt, now) {
      this.idleHide();
      // اهتزاز الكوباية والبرطمان
      if (this.espShake > 0) {
        this.espShake = Math.max(0, this.espShake - dt * 1.4);
        if (!this.drink.state.moveTo) {
          this.drink.group.position.x += (Math.random() - 0.5) * 0.002 * this.espShake;
          this.drink.group.position.z += (Math.random() - 0.5) * 0.002 * this.espShake;
        }
      }
      if (this.blendJitter > 0) {
        this.r.blender.position.x = this.r.ice.obj.position.x + 0.02 + (Math.random() - 0.5) * 0.004 * this.blendJitter;
        this.r.blender.rotation.z = (Math.random() - 0.5) * 0.006 * this.blendJitter;
        if (this.cur !== 'ice') this.blendJitter = Math.max(0, this.blendJitter - dt * 1.6);
      }
      if (this.cur !== 'ice') {
        this.r.blades.rotation.y += dt * this.blendJitter * 20;
        this.r.vortex.material.opacity = Math.max(0, this.r.vortex.material.opacity - dt * 0.8);
        this.r.blendBubbles.forEach(b => { b.material.opacity = Math.max(0, b.material.opacity - dt * 0.9); });
        this.r.spray.forEach(s => { s.material.opacity = Math.max(0, s.material.opacity - dt * 1.2); });
        this.r.blendLiquid.scale.y += (1 - this.r.blendLiquid.scale.y) * Math.min(1, dt * 2);
      }
      if (this.cur !== 'grinder') this.r.groundMat.opacity = Math.max(0, this.r.groundMat.opacity - dt * 2.5);
      if (this.cur !== 'tea') {
        this.r.whisk.visible = false;
        this.r.teaBubbles.forEach(b => { b.material.opacity = Math.max(0, b.material.opacity - dt * 0.8); });
        this.r.powderMat.opacity = Math.max(0, this.r.powderMat.opacity - dt * 1.5);
        this.r.teaLiquid.scale.x += (1 - this.r.teaLiquid.scale.x) * Math.min(1, dt * 3);
        this.r.teaLiquid.scale.z += (1 - this.r.teaLiquid.scale.z) * Math.min(1, dt * 3);
      }
      if (this.cur !== 'milk') {
        this.r.milkSteam.userData.boost = Math.max(0, this.r.milkSteam.userData.boost - dt * 0.8);
        this.r.milkSwirl.material.opacity = Math.max(0, this.r.milkSwirl.material.opacity - dt * 0.9);
        this.r.milkBubbles.forEach(b => { b.material.opacity = Math.max(0, b.material.opacity - dt * 1.1); });
        if (this.milkJitter > 0) this.milkJitter = Math.max(0, this.milkJitter - dt * 1.5);
      } else if (this.milkJitter > 0) {
        this.r.milkRig.position.x = this.r.milk.obj.position.x + 0.42 + (Math.random() - 0.5) * 0.003 * this.milkJitter;
      }
      if (this.cur !== 'brew' && this.r.coil) {
        this.r.coil.material.emissiveIntensity = Math.max(0.35, this.r.coil.material.emissiveIntensity - dt * 0.9);
        if (this.r.potLid) { this.r.potLid.position.y += (this.r.lidY - this.r.potLid.position.y) * Math.min(1, dt * 3); }
      }
      this.r.espSplash.material.opacity = Math.max(0, this.r.espSplash.material.opacity - dt * 2.2);
      if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    }

    /* ====================== حالة ونضافة ====================== */

    /** حالة للتشخيص */
    state() { return { running: this.cur, k: +this.curK.toFixed(2), pile: this.pile }; }

    dispose() {
      const r = this.r;
      [r.espStream, r.syrStream, r.brewStream, r.espSplash,
       r.blender, r.matcha, r.milkRig].forEach(o => { if (o) this.scene.remove(o); });
      r.fallCubes.forEach(c => this.scene.remove(c));
      r.grounds.forEach(g => this.scene.remove(g));
      r.espDrops.clear(); r.syrDrops.clear();
      /* الهندسات والخامات بتتحرّر في `raw-kitchen.destroy()` وهو بيمشي على
         المشهد كله — فمش بنحرّرها هنا عشان ما نسيبش حاجة من غير تحرير. */
    }
  }

  RAW.systems = RAW.systems || {};
  RAW.systems.MachinerySystem = MachinerySystem;

  /* اسم قديم متوافق: `RAW.machinery(THREE, scene, mats, fx, {stations, drink})` */
  RAW.machinery = (THREE, scene, mats, fx, deps) => new MachinerySystem(
    Object.assign({ THREE, scene, mats, fx }, deps || {}));
})(window);
