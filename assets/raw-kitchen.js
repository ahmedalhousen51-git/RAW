/* ==========================================================================
   RAW — مطبخ الكافيه ثلاثي الأبعاد (three.js)

   الملف ده بيركّب المشهد من المكوّنات: الخامات، الإضاءة، الغرفة، المحطات،
   الشخصية، والكاميرا — وبيمسك الحركة والاصطدام والتفاعل.

   التجربة بتبدأ بلقطة واسعة، مفيش محطة بتفتح لوحدها، والشخصية بتبدأ في نص
   الفراغ المفتوح قدّام الجزيرة.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  // مسار السكربت ده نفسه — عشان نلاقي نسخة three المحلية جنب المشروع
  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  const VERSION = '1.1.0';
  const LOCAL = '../vendor/three.module.min.js';
  const CDN   = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  let THREE = null, loading = null;

  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  /* النسخة المحلية الأول (بتشتغل على أي سيرفر من غير إنترنت)، والـCDN
     احتياطي — مهم لو الصفحة اتفتحت من file:// حيث الـmodule المحلي بيتمنع. */
  function load() {
    if (loading) return loading;
    if (!webglOK()) { loading = Promise.resolve(null); return loading; }
    const url = new URL(LOCAL, HERE).href;
    loading = import(url)
      .catch(() => import(CDN))
      .then(m => (THREE = m))
      .catch(e => { console.error('RAW: three.js لم يتحمّل —', e); return null; });
    return loading;
  }

  /* نقطة بداية الباريستا: نص الفراغ المفتوح، بعيد عن أي محطة */
  const START = { x: 0.2, z: 2.3 };
  const REACH = 1.7;            // نطاق التفاعل حوالين نقطة الوقوف
  const BODY  = 0.34;           // نصف قطر الشخصية للاصطدام
  const SPEED = 2.6;            // متر/ثانية

  function build(host, o) {
    o = o || {};
    const W = host.clientWidth || 960, H = host.clientHeight || 600;

    /* ---------- الراندرر والمشهد ---------- */
    // وضع الحركة المخفّضة: بيحترم إعداد النظام — من غير ميلة كاميرا ولا دخول بطيء
    RAW.reduceMotion = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    /* الموبايل بيبدأ بدقة كاملة زي الديسكتوب — الشاشة الحديثة كثافتها عالية،
       ولو نزّلنا الـpixel ratio الصورة بتطلع مغبّشة. التخفيف بيحصل بعدين بس
       لو الجهاز فعلاً مش لاحق (شوف quality()). */
    const renderer = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance',
      precision: coarse ? 'mediump' : 'highp'      // كروت الموبايل أسرع بكتير في mediump
    });
    const MAXPR = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(MAXPR);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // منحنى سينمائي: الستانلس والرخام بيرجعوا بدل ما يتحرقوا أبيض
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.info.autoReset = false;      // بنعدّ الفريم كله (المشهد + مرورات المعالجة)
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xE7DFD2);
    scene.fog = new THREE.Fog(0xE7DFD2, 26, 46);

    const cam = new THREE.PerspectiveCamera(44, W / H, 0.1, 90);

    /* ---------- المكوّنات ---------- */
    const mats = RAW.materials(THREE);
    const fx = RAW.fx(THREE);
    const room = RAW.room(THREE, scene, mats, fx);
    const lights = RAW.lighting(THREE, scene, mats, room.cove);
    if (coarse) {
      lights.key.shadow.mapSize.set(1024, 1024);
      renderer.shadowMap.type = THREE.PCFShadowMap;          // أرخص من PCFSoft
    }
    lights.setTime(o.time || lights.timeOfDay());       // لون الإضاءة حسب وقت اليوم
    const st = RAW.stations(THREE, scene, mats, fx);
    const stations = st.stations, stationRoots = st.roots;
    const chef = RAW.character(THREE, scene, mats);
    chef.root.position.set(START.x, 0, START.z);

    // الكوباية بتقف على الجزيرة، وبتتنقل مع نورة لما تفتح محطة
    const drink = RAW.drink(THREE, scene, mats, fx);
    const CUP_HOME = { x: RAW.layout.island.x + 1.15, y: RAW.layout.counterY + 0.05,
                       z: RAW.layout.island.z + 0.35 };
    drink.placeAt(CUP_HOME.x, CUP_HOME.y, CUP_HOME.z);
    drink.onPour = info => { if (RAW.sfx) RAW.sfx.pour(info); };

    // الإيدين: مسك الأدوات والصبّ والتقليب — بيتحطّ بعد الكوباية والشخصية
    const hands = RAW.hands(THREE, scene, mats, fx, {
      chef: chef, drink: drink,
      onAction: (kind, info) => { if (o.onHand) o.onHand(kind, info); }
    });

    // تأثيرات الماكينات وهي شغّالة (خيط الإسبريسو، الدوامة، الرغوة، التلج…)
    const machines = RAW.machinery(THREE, scene, mats, fx, { stations: stations, drink: drink });
    let runInfo = null;

    const atmos = RAW.atmos(THREE, renderer, scene, mats);
    // طبقة المعالجة: بلوم + vignette + حبيبات + تباين — دي اللي بتدّي العمق
    const post = RAW.post ? RAW.post(THREE, renderer, scene, cam) : null;
    atmos.tune();                                        // قوة الانعكاس لكل خامة
    if (coarse) atmos.setDust(0.28);
    atmos.setShaft(lights.presets[lights.current].shaft);

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const rig = RAW.cameraRig(THREE, cam, renderer.domElement, onTap);

    /* نورة بتتابع الماوس: بنرمي شعاع من الكاميرا ونقف عند نفس بُعدها،
       فالنقطة تفضل في مستوى جسمها بدل ما تبص في الأرض. */
    const lookPt = new THREE.Vector3();
    let lookFresh = 0;
    function onPointerMove(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, cam);
      const d = cam.position.distanceTo(chef.root.position);
      ray.ray.at(Math.max(1.2, d), lookPt);
      lookPt.y = Math.max(0.8, Math.min(2.4, lookPt.y));
      lookFresh = 3.5;                       // بعد كام ثانية سكون بترجع لشغلها
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    /* ---------- اللقطة السينمائية ----------
       أول ما تقف عند ماكينة: سبوت بيتسلّط عليها، الضباب بيقرب فيغيّم المطبخ
       ورا الماكينة، والإضاءة المحيطة بتخفت شوية عشان الماكينة تبقى البطل. */
    const spot = new THREE.SpotLight(0xFFF0D8, 0, 9, 0.62, 0.62, 1.4);
    spot.position.set(0, 3.2, 0);
    scene.add(spot);
    scene.add(spot.target);
    const FOG0 = { near: scene.fog.near, far: scene.fog.far };
    let hemiBase = lights.hemi.intensity, ambBase = lights.amb.intensity;
    let cineMix = 0, holdWide = false;
    function recaptureLightBase() {
      hemiBase = lights.hemi.intensity / Math.max(0.001, 1 - 0.45 * cineMix);
      ambBase = lights.amb.intensity / Math.max(0.001, 1 - 0.5 * cineMix);
    }
    function cinematic(dt, st) {
      const want = st ? 1 : 0;
      cineMix += (want - cineMix) * Math.min(1, dt * 2.4);
      if (cineMix < 0.002 && !st) cineMix = 0;
      if (st) {
        const p = st.obj.position;
        spot.position.set(p.x + st.view.x * 0.35, p.y + 1.9, p.z + st.view.z * 0.3);
        spot.target.position.copy(p);
        spot.target.updateMatrixWorld();
      }
      spot.intensity = cineMix * 22;
      scene.fog.near = FOG0.near + (7 - FOG0.near) * cineMix;
      scene.fog.far = FOG0.far + (23 - FOG0.far) * cineMix;
      lights.hemi.intensity = hemiBase * (1 - 0.45 * cineMix);
      lights.amb.intensity = ambBase * (1 - 0.5 * cineMix);
    }

    /* ---------- الحركة والاصطدام ---------- */
    const goal = chef.root.position.clone();
    const keys = Object.create(null);
    let current = null;                    // المحطة اللي هو واقف عندها
    let blocked = false;                   // متحشورة في حاجة دلوقتي؟
    const touchIn = { x: 0, z: 0 };        // إدخال الجويستيك على الموبايل
    let pending = null;                    // محطة اتطلبت بزرار/كليك، تفتح لوحتها لما يوصل
    const tmp = new THREE.Vector3();

    function onKeyDown(e) {
      keys[e.code] = true;
      if (e.code === 'Escape') { if (o.onEscape) o.onEscape(); return; }
      // الضغطة المستمرة بتكرّر keydown — من غير الحارس ده اللوحة بتفتح وتقفل بسرعة
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) {
        if (current && o.onInteract) o.onInteract(pub(current));
      }
      // التفاعل اليدوي: G مسك/سيب · F صبّ · R رجّ · K تقليب · C تنظيف
      if (!e.repeat) {
        if (e.code === 'KeyG') { hands.held ? hands.drop() : hands.grab(); }
        else if (e.code === 'KeyF') hands.pourStart();
        else if (e.code === 'KeyR') hands.shakeStart();
        else if (e.code === 'KeyK') hands.stirToggle();
        else if (e.code === 'KeyC') hands.cleanStart();
        else if (e.code === 'KeyV') rig.reset();          // رجّع زاوية الكاميرا
      }
      if (MOVE_CODES.indexOf(e.code) > -1) e.preventDefault();
    }
    function onKeyUp(e) {
      keys[e.code] = false;
      if (e.code === 'KeyF') hands.pourStop();
      else if (e.code === 'KeyR') hands.shakeStop();
      else if (e.code === 'KeyC') hands.cleanStop();
    }
    const MOVE_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
    addEventListener('keydown', onKeyDown, { passive: false });
    addEventListener('keyup', onKeyUp);

    /* الاصطدام: مستطيلات على الأرض، بندفع الشخصية بره أقرب ضلع.
       مهم إن ده يشتغل بعد الحركة بس — عشان ما يزقّهاش لمحطة في أول frame. */
    function collide(p) {
      const obs = room.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const b = obs[i];
        const x0 = b.x0 - BODY, x1 = b.x1 + BODY, z0 = b.z0 - BODY, z1 = b.z1 + BODY;
        if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
          const dl = p.x - x0, dr = x1 - p.x, db = p.z - z0, df = z1 - p.z;
          const m = Math.min(dl, dr, db, df);
          if (m === dl) p.x = x0; else if (m === dr) p.x = x1;
          else if (m === db) p.z = z0; else p.z = z1;
        }
      }
      p.x = Math.max(-7.4, Math.min(7.4, p.x));
      p.z = Math.max(-6.0, Math.min(6.8, p.z));
    }

    function nearestStation() {
      let best = null, bd = REACH;
      for (const k in stations) {
        const s = stations[k];
        const d = Math.hypot(chef.root.position.x - s.at.x, chef.root.position.z - s.at.z);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }

    const pub = s => s ? { id: s.id, label: s.label } : null;

    /* تشغيل الماكينة: لمبة بتنبض، بخار أقوى لحظة، وصوت */
    function operate(s) {
      if (!s) return false;
      if (s.lamp) fx.flash(s.lamp.material, 2.2, 1.0);
      if (s.plume) s.plume.userData.boost = 1;
      if (RAW.sfx) RAW.sfx.machine(s.id, s.obj.position);   // الصوت جاي من مكان الماكينة
      if (o.onOperate) o.onOperate(pub(s));
      return true;
    }

    /* أثر تشغيل الماكينة على الكوباية — الكميات واللون والحرارة بتيجي من
       القيم اللي المستخدم ظبّطها في لوحة التحكّم. */
    function serve(stationId, spec, values, contents) {
      const f = spec && spec.fx;
      if (!f) return false;
      values = values || {};
      // المكوّنات اللي المستخدم حطّها في الماكينة بتغلب على اللون الافتراضي
      const blend = (contents && contents.length && RAW.ingredients)
        ? RAW.ingredients.mix(contents) : null;
      const num = k => (typeof values[k] === 'number' ? values[k] : 0);

      let amount = f.amount != null ? f.amount : num(f.amountFrom) * (f.per || 0.02);
      let temp = f.tempFrom ? num(f.tempFrom) + (f.tempOffset || 0) : f.temp;
      let color = f.color;
      if (f.colorFrom && spec.controls) {
        const ctl = spec.controls.filter(c => c.k === f.colorFrom)[0];
        const opt = ctl && ctl.options ? ctl.options.filter(o => o.v === values[f.colorFrom])[0] : null;
        if (opt && opt.col != null) color = opt.col;
      }

      if (blend) {
        color = blend.color;
        temp = (temp == null ? 24 : temp) + blend.temp;
        amount = (amount || 0.1) + contents.length * 0.025;
      }

      if (f.act === 'pour') {
        drink.pour({ amount: amount, color: color, tempC: temp });
      } else if (f.act === 'ice') {
        // الجرامات بتتحوّل مكعبات: المكعب التجاري ~١٧ جرام
        const cubes = f.gramsFrom ? Math.round(num(f.gramsFrom) / (f.perCube || 17))
                                  : (f.countFrom ? num(f.countFrom) : 6);
        drink.addIce(Math.max(1, cubes));
        machines.dropCubes(Math.min(6, Math.max(2, Math.round(cubes / 2))));   // مكعبات بتقع من الماكينة
      } else if (f.act === 'heat') {
        drink.state.temp = Math.max(drink.state.temp, temp || 90);
        drink.stir();
      } else if (f.act === 'stir') {
        drink.stir();
        if (color != null) drink.pour({ amount: blend ? amount : 0.01, color: color, tempC: temp });
        if (RAW.sfx) RAW.sfx.stir();
      }

      // أي ماكينة فيها مكوّنات بتصبّ خليطها في الكوباية — مش بس ماكينات الصبّ
      if (blend && f.act !== 'pour') {
        drink.pour({ amount: amount, color: blend.color, tempC: temp });
      }

      // القطع (بوبا/جيلي) والرغوة بتنزل في الكوباية
      if (blend) {
        blend.bits.forEach(b => drink.addBits(b.c, b.bits === 'ball' ? 8 : 5, b.bits));
        if (blend.foam) drink.state.foam = Math.min(1, drink.state.foam + blend.foam);
        machines.setContents(stationId, []);          // الماكينة اتفرّغت في الكوباية
      }
      return true;
    }

    /* دوسة على المشهد: ماكينة الأول، وبعدين الأرض.
       الأرضية plane كبير ورا كل حاجة، فلو اتفحصت الأول مش هتقدر تدوس ماكينة أبداً. */
    function onTap(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, cam);
      const hitM = ray.intersectObjects(stationRoots, true);
      if (hitM.length) {
        let n = hitM[0].object;
        while (n && !n.userData.stationId) n = n.parent;
        if (n) { request(n.userData.stationId); return; }
      }
      const hitF = ray.intersectObject(room.floor);
      if (hitF.length) {
        goal.set(hitF[0].point.x, 0, hitF[0].point.z);
        collide(goal);
        pending = null;
        if (o.onFloorTap) o.onFloorTap();      // دوسة على الأرض = اقفل اللوحة وامشي
      }
    }

    /* الكوباية بتروح مع نورة للمحطة اللي فتحتها، وبترجع الجزيرة بعدها */
    function cupTo(id) {
      if (hands.held && hands.held.id === 'cup') return false;   // في إيدها دلوقتي
      const s = id && stations[id];
      if (!s) { drink.moveTo(CUP_HOME.x, CUP_HOME.z, CUP_HOME.y); return false; }
      // الإسبريسو: الكوباية بتتحط تحت رأس التحضير بالظبط عشان الشوت ينزل فيها
      if (id === 'espresso') {
        drink.moveTo(s.obj.position.x, s.obj.position.z + 0.34, RAW.layout.counterY + 0.05);
        return true;
      }
      // على الرخام قدّام الماكينة شوية، في ناحية نورة
      const p = s.obj.position;
      const towards = s.at.clone().sub(p).setY(0).normalize().multiplyScalar(0.32);
      drink.moveTo(p.x + towards.x, p.z + towards.z, RAW.layout.counterY + 0.05);
      return true;
    }

    /* طلب محطة: يمشي لها، ولما يوصل تتفتح لوحتها */
    function request(id) {
      const s = stations[id];
      if (!s) return false;
      if (current === s) {
        holdWide = false;
        rig.setFocus(s);
        if (o.onArrive) o.onArrive(pub(s));
        return true;
      }
      goal.set(s.at.x, 0, s.at.z);
      pending = id;
      return true;
    }

    /* ---------- الجودة ----------
       ٣ مستويات: عالية (دقة الشاشة كاملة) · متوسطة · خفيفة. بنبدأ بالعالية،
       وبنقيس الأداء مرتين: لو مش لاحق ننزل درجة، ولو لسه مش لاحق ننزل تانية.
       والمستخدم يقدر يختار بنفسه من زرار الجودة. */
    const QUALITY = {
      high: { pr: MAXPR,                 shadow: coarse ? 1024 : 2048, dust: coarse ? 0.3 : 0.5,
              shadows: true,  env: !coarse, detail: true,  glass: !coarse, lite: coarse, post: 'high' },
      mid:  { pr: Math.min(MAXPR, 1.6),  shadow: 1024, dust: 0.18,
              shadows: true,  env: false,   detail: !coarse, glass: false, lite: true, post: 'mid' },
      low:  { pr: Math.min(MAXPR, 1.15), shadow: 512,  dust: 0,
              shadows: false, env: false,   detail: false, glass: false,   lite: true, post: 'off' }
    };
    /* الـtransmission بيخلّي three ترسم المشهد كله مرة زيادة في render target
       كل فريم. على الموبايل ده وحده بياكل نص الأداء، فبنحوّله لشفافية عادية. */
    function setGlass(real) {
      scene.traverse(n => {
        const list = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
        list.forEach(m => {
          if (m.userData.tr === undefined) {
            if (!m.transmission) return;
            m.userData.tr = m.transmission;
            m.userData.op = m.opacity;
          }
          if (real) {
            m.transmission = m.userData.tr;
            m.opacity = m.userData.op;
          } else {
            // شفافية عادية بدل الانكسار: بنخليها أوضح شوية عشان اللي جوّه يبان
            m.transmission = 0;
            m.transparent = true;
            m.opacity = Math.min(m.userData.op, 0.42);
            if (m.roughness !== undefined) m.roughness = Math.min(m.roughness, 0.15);
          }
          m.needsUpdate = true;
        });
      });
    }

    let qLevel = coarse ? 'mid' : 'high';
    // أقصى عدد بكسلات نرسمها في الفريم — الشاشات الكبيرة بكثافة عالية بتقتل الموبايل
    const PIXEL_BUDGET = coarse ? 1400000 : 4200000;
    function fitPixelRatio(want) {
      const w = host.clientWidth || 960, h = host.clientHeight || 600;
      const cap = Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h));
      return Math.max(1, Math.min(want, cap));
    }

    function applyQuality(name) {
      const q = QUALITY[name] || QUALITY.high;
      qLevel = QUALITY[name] ? name : 'high';
      renderer.setPixelRatio(fitPixelRatio(q.pr));
      renderer.shadowMap.enabled = q.shadows;
      lights.key.castShadow = q.shadows;
      lights.key.shadow.mapSize.set(q.shadow, q.shadow);
      if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; }
      atmos.setDust(q.dust);
      atmos.setEnv(q.env);                 // الانعكاسات ٦ رندرات كل مرة
      room.setDetail(q.detail);
      setGlass(q.glass);                   // الزجاج الحقيقي = رندر زيادة كل فريم
      lights.setLite(q.lite);              // أنوار أقل = شيدر أخف
      fx.setLite(q.lite);
      if (post) post.setLevel(q.post);
      resize();
      return qLevel;
    }
    applyQuality(qLevel);                  // الموبايل بيبدأ على المتوسط من أول فريم

    let fpsN = 0, fpsT = 0, fpsNow = 0;   // عدّاد إطارات مستمر للتشخيص
    let warmup = 0;                       // أول ثواني التحميل مش بتتحسب
    let qFrames = 0, qTime = 0, qStage = coarse ? 1 : 0;    // الموبايل بيبدأ من المتوسط
    function quality(dt) {
      fpsN++; fpsT += dt;
      if (fpsT >= 1) { fpsNow = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
      // أول ٤ ثواني بتتحمّل فيها التكستشرات والشيدرات — القياس فيها مضلّل،
      // فالجهاز القوي كان ممكن ينزل جودة بالغلط. بنعدّيها من غير حكم.
      if (warmup < 4) { warmup += dt; qFrames = 0; qTime = 0; return; }
      if (qStage > 1) return;
      qFrames++; qTime += dt;
      if (qTime < (qStage === 0 ? 2.2 : 3.5)) return;
      const fps = qFrames / qTime;
      qFrames = 0; qTime = 0;
      if (fps >= 45) { qStage = 2; return; }         // الجهاز لاحق — سيبها عالية
      qStage++;
      applyQuality(qStage === 1 ? 'mid' : 'low');
      if (qStage >= 2) qStage = 2;
      console.info('RAW: الجودة نزلت لـ' + qLevel + ' — ' + fps.toFixed(0) + ' إطار/ث');
    }

    /* ---------- منفّذ المهام التلقائية ----------
       سلسلة خطوات، كل خطوة ليها فعل وشرط انتهاء (أو وقت). بتخلّي نورة تعمل
       سيناريو كامل بضغطة واحدة: تروح للإبريق، تمسكه، تقف جنب الكوباية، تصبّ،
       وترجّعه مكانه. */
    let task = null;
    function runTask(steps, name) {
      task = { steps: steps, i: 0, t: 0, name: name || '' };
    }
    function tickTask(dt) {
      if (!task) return;
      const st = task.steps[task.i];
      if (!st) { task = null; if (o.onTask) o.onTask('done'); return; }
      if (!st._on) { st._on = true; task.t = 0; if (st.go) st.go(); }
      task.t += dt;
      const over = st.until ? st.until() : (task.t >= (st.wait || 0));
      if (over || task.t > (st.timeout || 9)) {
        if (!over && st.fail) st.fail();
        task.i++;
        task.t = 0;
      }
    }
    function cancelTask() { task = null; }

    const distTo = v => Math.hypot(chef.root.position.x - v.x, chef.root.position.z - v.z);

    /** سيناريو صبّ اللبن كامل بضغطة واحدة */
    function autoPourMilk() {
      if (task) return { ok: false, why: 'في حاجة بتحصل دلوقتي' };
      const jug = hands.pos('jug');
      if (!jug) return { ok: false, why: 'مفيش إبريق لبن' };
      if (hands.held && hands.held.id === 'cup') return { ok: false, why: 'سيبي الكوباية الأول' };
      const cupAt = () => { drink.group.getWorldPosition(tmp); return tmp.clone(); };
      const home = chef.root.position.clone();

      runTask([
        // ١) امشي للإبريق
        { go() { const j = hands.pos('jug'); goal.set(j.x, 0, j.z + 0.75); collide(goal); pending = null; },
          until: () => distTo(hands.pos('jug')) < 1.5, timeout: 7 },
        // ٢) امسكيه
        { go() { if (!hands.holding('jug')) { hands.drop(); hands.grabId('jug'); } }, wait: 0.55 },
        // ٣) امشي لجنب الكوباية
        { go() { const c = cupAt(); goal.set(c.x + 0.35, 0, c.z + 0.7); collide(goal); },
          until: () => distTo(cupAt()) < 1.1, timeout: 8 },
        // ٤) صبّي
        { go() { chef.look(cupAt()); hands.pourStart(); }, wait: 2.4 },
        // ٥) وقّفي الصبّ
        { go() { hands.pourStop(); }, wait: 0.4 },
        // ٦) رجّعي الإبريق مكانه وارجعي
        { go() { hands.drop(); goal.copy(home); }, wait: 0.5 }
      ], 'milk');
      return { ok: true };
    }

    /* ---------- الحلقة ---------- */
    let last = performance.now(), raf = 0, stepTimer = 0, paused = false;
    function tick() {
      raf = requestAnimationFrame(tick);
      // وقفة كاملة (شاشة "لفّ الموبايل" مثلاً): مفيش حساب ولا رسم
      if (paused) { last = performance.now(); return; }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // الأسهم/WASD بيحرّكوه على طول، والدوس على الأرض بيحدّد هدف
      let ix = 0, iz = 0;
      if (keys.ArrowLeft  || keys.KeyA) ix -= 1;
      if (keys.ArrowRight || keys.KeyD) ix += 1;
      if (keys.ArrowUp    || keys.KeyW) iz -= 1;
      if (keys.ArrowDown  || keys.KeyS) iz += 1;

      const p = chef.root.position;
      let moving = false, faceX = 0, faceZ = 0;
      const wasX = p.x, wasZ = p.z;
      let want = 0;                                   // الخطوة اللي كانت المفروض تتاخد

      // الجويستيك على الموبايل بيدي إدخال تدريجي (٠..١) زي الأسهم بالظبط
      if (!ix && !iz && (touchIn.x || touchIn.z)) { ix = touchIn.x; iz = touchIn.z; }

      if (ix || iz) {
        /* الحركة نسبة للكاميرا: "فوق" يعني لقدّام بالنسبة للي انت شايفه،
           مش دايماً ناحية الحيطة الخلفية — ده اللي بيخلي الدوران ٣٦٠ مريح. */
        const yaw = rig.yaw();
        const fwd = -iz, cs = Math.cos(yaw), sn = Math.sin(yaw);
        const dirX = ix * cs - fwd * sn;
        const dirZ = -ix * sn - fwd * cs;
        tmp.set(dirX, 0, dirZ);
        const mag = Math.min(1, Math.hypot(ix, iz));
        tmp.normalize().multiplyScalar(SPEED * dt * mag);
        want = tmp.length();
        p.x += tmp.x; p.z += tmp.z;
        collide(p);
        goal.set(p.x, 0, p.z);
        pending = null;
        moving = true; faceX = dirX; faceZ = dirZ;
      } else {
        const dx = goal.x - p.x, dz = goal.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.06) {
          const stepLen = Math.min(d, SPEED * dt);
          want = stepLen;
          p.x += (dx / d) * stepLen; p.z += (dz / d) * stepLen;
          collide(p);
          moving = true; faceX = dx; faceZ = dz;
        }
      }

      /* خبطت في ترابيزة أو دولاب؟ الاصطدام بيرجّعها مكانها، فلو المسافة اللي
         اتحركتها فعلاً شبه صفر يبقى هي واقفة — نوقف دورة المشي بدل ما تفضل
         بتمشي في مكانها، ونلغي هدف الدوسة عشان ما تفضلش تزنّ على الحاجز. */
      if (moving && want > 0.0001) {
        const done = Math.hypot(p.x - wasX, p.z - wasZ);
        if (done < want * 0.35) {
          moving = false;
          if (!ix && !iz) goal.set(p.x, 0, p.z);      // كانت رايحة لنقطة → الغيها
          if (!blocked) { blocked = true; if (o.onBlocked) o.onBlocked(); }
        } else blocked = false;
      } else if (!moving) blocked = false;

      if (moving) {
        // يلف ناحية الحركة بأقصر طريق — lerp عادي بيلفّه الطريق الطويل عند ±π
        const want = Math.atan2(faceX, faceZ);
        let diff = want - chef.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        chef.root.rotation.y += diff * Math.min(1, dt * 11);
        stepTimer -= dt;
        if (stepTimer <= 0) { stepTimer = 0.34; if (RAW.sfx) RAW.sfx.step(); }
      }
      // وهو واقف عند محطة، يلتفت ناحيتها — مش فاضل مبحلق في الأوضة
      if (!moving && current) {
        const want = Math.atan2(current.obj.position.x - p.x, current.obj.position.z - p.z);
        let diff = want - chef.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        chef.root.rotation.y += diff * Math.min(1, dt * 6);
      }
      // البصّة: على الماوس لو اتحرك من شوية، وإلا على المحطة اللي قدامها
      lookFresh = Math.max(0, lookFresh - dt);
      if (lookFresh > 0) chef.look(lookPt);
      else if (current) chef.look(current.obj.position);
      else chef.look(null);

      chef.update(dt, moving, 1);
      fx.update(dt);
      tickTask(dt);
      hands.update(dt);
      machines.tick(dt, now, runInfo);
      drink.update(dt, now);
      atmos.update(dt, now);

      // المحطة اللي هو عندها دلوقتي
      const near = nearestStation();
      if (near !== current) {
        current = near;
        holdWide = false;                         // خرجت من نطاق المحطة → التركيز يرجع طبيعي
        rig.setFocus(near);                       // اللقطة القريبة بس لما يوصل
        if (o.onStation) o.onStation(pub(near));
        if (near && pending === near.id) {
          pending = null;
          if (o.onArrive) o.onArrive(pub(near));
        }
      }

      quality(dt);
      const shot = holdWide ? null : current;
      cinematic(dt, shot);
      rig.update(dt, p);
      if (RAW.sfx && RAW.sfx.listener) RAW.sfx.listener(cam);
      if (o.onTick) o.onTick(dt);           // العدّاد بتاع لوحة الماكينة بيمشي مع الفريمات
      renderer.info.reset();
      if (post) post.render(dt); else renderer.render(scene, cam);
    }
    tick();

    /* ---------- المقاسات ---------- */
    function resize() {
      const w = host.clientWidth || W, h = host.clientHeight || H;
      renderer.setPixelRatio(fitPixelRatio((QUALITY[qLevel] || QUALITY.high).pr));
      renderer.setSize(w, h, false);
      if (post) post.resize();
      cam.aspect = w / h;
      cam.fov = rig.fit(cam.aspect);          // الشاشة الطولية بتاخد زاوية أوسع
      room.setCeiling(cam.aspect >= 0.75);    // الطولي: من غير سقف عشان الكادر يمتلي
      cam.updateProjectionMatrix();
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);
    addEventListener('resize', resize);

    /* ---------- الواجهة البرمجية ---------- */
    return {
      stations: Object.keys(stations),
      station(id) { return pub(stations[id]); },
      /** يمشي للمحطة، ولما يوصل تتفتح لوحتها */
      goTo(id) { return request(id); },
      /** ينقله فوراً من غير مشي (للاختبار والروابط) */
      place(id) {
        const s = stations[id];
        if (!s) return false;
        chef.root.position.set(s.at.x, 0, s.at.z);
        goal.copy(chef.root.position);
        return true;
      },
      /** يحطّه في أي نقطة على الأرض فوراً (للاختبار وربط الصفحات) */
      teleport(x, z) {
        chef.root.position.set(x, 0, z);
        collide(chef.root.position);
        goal.copy(chef.root.position);
        pending = null;
        return true;
      },
      /** أثر خطوة على المشروب (بينده من لوحة العمل) */
      serve,
      /** بيوري المكوّنات جوه الماكينة (قطع في الخلاط، لون في البوّل) */
      showContents(stationId, ids) { machines.setContents(stationId, ids || []); return true; },
      /** ينقل الكوباية لمحطة، أو يرجّعها للجزيرة لو null */
      cupTo,
      /** حالة المشروب: المستوى والحرارة والتلج */
      drink() {
        return { level: +drink.level.toFixed(2), temp: Math.round(drink.state.temp),
                 ice: drink.iceCount };
      },
      /** كوباية جديدة */
      newCup() { drink.reset(); cupTo(null); return true; },
      /** يرجّع الكاميرا للقطة الواسعة وهي واقفة مكانها (بعد ما تخلص شغلها) */
      unfocus() { holdWide = true; rig.setFocus(null); return true; },
      /** يرجّع التركيز على المحطة اللي هي عندها */
      refocus() { holdWide = false; rig.setFocus(current); return !!current; },
      /** حالة تشغيل الماكينة الحالية — بتتبعت من لوحة التحكّم كل فريم */
      machineRun(info) { runInfo = info || null; },
      machineState() { return machines.state(); },
      /** وضع المشاهدة: بيخفي مؤشرات التفاعل من المشهد كمان */
      setCinema(on) { hands.setRingVisible(!on); return true; },
      /** وقف/شغّل المشهد (بتستخدمها شاشة "لفّ الموبايل") */
      pause(on) { paused = !!on; return paused; },
      /** يرجّع الكاميرا لزاويتها الافتراضية */
      resetView() { return rig.reset(); },
      /** الجودة: 'high' · 'mid' · 'low' — بتوقف القياس التلقائي لما تختار بنفسك */
      setQuality(name) { qStage = 2; return applyQuality(name); },
      quality() { return qLevel; },
      /** إدخال حركة تدريجي (جويستيك اللمس): كل قيمة من -١ لـ١ */
      move(x, z) {
        touchIn.x = Math.max(-1, Math.min(1, x || 0));
        touchIn.z = Math.max(-1, Math.min(1, z || 0));
      },
      /** واقفة في حاجة دلوقتي؟ */
      isBlocked() { return blocked; },
      /** سيناريو كامل: تجيب الإبريق، تقف جنب الكوباية، تصبّ، وترجّعه */
      pourMilk() { return autoPourMilk(); },
      busy() { return !!task; },
      cancelTask,
      /** التفاعل اليدوي: مسك، سيب، صبّ، رجّ، تقليب، تنظيف */
      hands: {
        grab: () => hands.grab(),
        grabId: id => hands.grabId(id),
        drop: () => hands.drop(),
        toggle: () => (hands.held ? hands.drop() : hands.grab()),
        pourStart: () => hands.pourStart(),
        pourStop: () => hands.pourStop(),
        shakeStart: () => hands.shakeStart(),
        shakeStop: () => hands.shakeStop(),
        stir: on => hands.stirToggle(on),
        cleanStart: () => hands.cleanStart(),
        cleanStop: () => hands.cleanStop(),
        state: () => hands.state()
      },
      /** نورة: تعبير مؤقت */
      express(kind, secs) { chef.express(kind, secs); },
      /** الإضاءة حسب الوقت: 'morning' · 'noon' · 'sunset' · 'night' */
      setTime(id) { const p = lights.setTime(id); recaptureLightBase(); atmos.setShaft(p.shaft); atmos.refresh(); return p.name; },
      nextTime() { const p = lights.nextTime(); recaptureLightBase(); atmos.setShaft(p.shaft); atmos.refresh(); return p.name; },
      timeName() { return lights.presets[lights.current].name; },
      /** أرقام الأداء: عدد الـdraw calls والمثلثات والمجسمات */
      stats() {
        const i = renderer.info;
        return { version: VERSION, fps: fpsNow, calls: i.render.calls, triangles: i.render.triangles,
                 geometries: i.memory.geometries, textures: i.memory.textures,
                 quality: qLevel, post: !!(post && post.enabled) };
      },
      /** المحطة اللي هو واقف عندها دلوقتي */
      at() { return current ? current.id : null; },
      /** تشغيل ماكينة — الافتراضي اللي هو واقف عندها */
      use(id) { return operate(id ? stations[id] : current); },
      /** الهدف اللي ماشي ناحيته، أو null لو وصل */
      goalAt() {
        const p = chef.root.position;
        return Math.hypot(goal.x - p.x, goal.z - p.z) > 0.06
          ? { x: +goal.x.toFixed(2), z: +goal.z.toFixed(2) } : null;
      },
      where() {
        const p = chef.root.position;
        return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
      },
      camera: cam,
      scene: scene,
      cup: drink.group,
      destroy() {
        cancelAnimationFrame(raf);
        removeEventListener('keydown', onKeyDown);
        removeEventListener('keyup', onKeyUp);
        removeEventListener('resize', resize);
        if (ro) ro.disconnect();
        rig.dispose();
        if (post) post.dispose();
        hands.dispose();
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        atmos.dispose();
        scene.traverse(n => {
          if (n.isMesh) {
            if (n.geometry) n.geometry.dispose();
            const m = n.material;
            if (Array.isArray(m)) m.forEach(x => x && x.dispose && x.dispose());
            else if (m && m.dispose) m.dispose();
          }
        });
        // الخامات والتكستشرات المشتركة (كاش raw-materials) بتتحرّر هنا بس —
        // مش عند تغيير المحطة، لأنها متشاركة بين كل حاجة في المشهد.
        if (mats.dispose) mats.dispose();
        renderer.dispose();
        renderer.forceContextLoss && renderer.forceContextLoss();
        if (renderer.domElement.parentNode) renderer.domElement.remove();
      }
    };
  }

  function mount(host, opts) {
    return load().then(m => {
      if (!m || !host) return null;
      try {
        return build(host, opts);
      } catch (e) {
        console.error('RAW: فشل بناء المشهد —', e);
        return null;
      }
    });
  }

  RAW.kitchen = { mount, supported: webglOK, version: VERSION };
})(window);
