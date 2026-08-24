/* ==========================================================================
   RAW — كوباية التحضير: فيزياء سائل مبسّطة بس محسوسة

   · سطح السائل بيتموّج ويهتز، والاهتزاز بيعلى لما تصب أو تقلّب أو تتحرك الكوباية.
   · السائل بيتخبط في الجناب (سلوشينج) لما الكوباية تتحرك — نابض بيخمد.
   · فقاعات بتطلع من القاع لحد السطح.
   · تيار حمل حراري: دوران بطيء في السائل طول ما هو سخن.
   · مكعبات التلج بتعوم، بتهتز مع السطح، وبتدوب مع الوقت فترفع المستوى وتبرّد.
   · الحرارة بتنزل لحرارة الأوضة، والبخار بيقل معاها، والكوباية الباردة بيتكثّف
     عليها ندى.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const R = 0.043;            // نصف قطر الكوباية من فوق
  const RB = 0.034;           // من تحت
  const H = 0.125;            // ارتفاع الكوباية
  const ROOM_C = 22;          // حرارة الأوضة
  const MAX = 0.92;           // أقصى امتلاء قبل ما يفيض

  RAW.drink = function (THREE, scene, mats, fx) {
    const { C, M, cyl } = mats;
    const group = new THREE.Group();

    /* ---------- الزجاج ---------- */
    // زجاج حقيقي: بيعتمد على الـtransmission مش على opacity — الـopacity الواطية
    // كانت بتخلّيه بقعة بيضا وبتخفي السائل اللي جوّاه
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xFFFFFF, transmission: 0.96, roughness: 0.04, thickness: 0.02,
      ior: 1.45, transparent: true, opacity: 1, metalness: 0,
      attenuationColor: new THREE.Color(0xDCEAEE), attenuationDistance: 0.6,
      specularIntensity: 0.9, clearcoat: 0.25, clearcoatRoughness: 0.08,
      depthWrite: false
    });
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(R, RB, H, 26, 1, true), glassMat);
    glass.position.y = H / 2;
    group.add(glass);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(RB, RB, 0.008, 26), glassMat);
    base.position.y = 0.004;
    group.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.003, 6, 26), glassMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = H;
    group.add(rim);

    /* ---------- السائل ---------- */
    // الجسم: أسطوانة بتتمدّد في Y حسب المستوى
    /* مهم: السائل والتلج والفقاقيع من غير transmission خالص.
       three بتستبعد أي مجسّم transmissive من الخلفية اللي بيشوفها الزجاج،
       فلو السائل كان transmissive كان بيختفي أول ما تبص من خلال الكوباية. */
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x3B2318, roughness: 0.14, metalness: 0.02,
      transparent: true, opacity: 0.95,
      clearcoat: 0.75, clearcoatRoughness: 0.08
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.955, RB * 0.97, 1, 24, 1, true), bodyMat);
    const bodyBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(RB * 0.97, RB * 0.97, 0.004, 24), bodyMat);
    bodyBottom.position.y = 0.006;

    // السطح: قرص بيتحرّك رأسه لكل vertex — ده اللي بيدّي إحساس السائل الحي
    const surfGeo = new THREE.CircleGeometry(R * 0.955, 30, 0, Math.PI * 2);
    const surfMat = new THREE.MeshPhysicalMaterial({
      color: 0x4A2C1C, roughness: 0.06, metalness: 0.05,
      clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide
    });
    const surface = new THREE.Mesh(surfGeo, surfMat);
    surface.rotation.x = -Math.PI / 2;
    const rest = surfGeo.attributes.position.array.slice();   // النسخة الساكنة

    // كل السائل جوه pivot بيميل لوحده — السلوشينج
    const liquid = new THREE.Group();
    liquid.add(body, bodyBottom, surface);
    group.add(liquid);

    /* ---------- الفقاقيع ---------- */
    const bubbles = [];
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xFFF3E0, roughness: 0.05, clearcoat: 1,
      transparent: true, opacity: 0.5
    });
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.0035 + (i % 3) * 0.0018, 7, 6), bubbleMat.clone());
      const a = i * 2.1, rr = R * (0.15 + (i % 4) * 0.17);
      b.userData = { x: Math.cos(a) * rr, z: Math.sin(a) * rr, t: i / 10, k: 0.55 + (i % 5) * 0.18 };
      b.visible = false;
      liquid.add(b);
      bubbles.push(b);
    }

    /* ---------- التلج ---------- */
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xF2FAFF, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.62, metalness: 0
    });
    const iceGeo = new THREE.BoxGeometry(1, 1, 1);
    const ice = [];

    /* ---------- الندى على برّه ---------- */
    const dewMat = new THREE.MeshPhysicalMaterial({
      color: 0xE8F4FA, roughness: 0.04, clearcoat: 1,
      transparent: true, opacity: 0
    });
    const dew = [];
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0035 + (i % 3) * 0.0015, 6, 5), dewMat);
      const a = i * 1.9, y = 0.02 + (i % 5) * 0.021;
      const rr = RB + (R - RB) * (y / H);
      d.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      d.scale.set(1, 1.35, 0.6);
      group.add(d);
      dew.push(d);
    }

    /* ---------- البخار ---------- */
    const plume = fx.steam(group, 0, H + 0.01, 0, 0.05, 0.34, 7);

    scene.add(group);

    /* ---------- الحالة ---------- */
    const st = {
      level: 0,            // 0..MAX من ارتفاع الكوباية
      target: 0,
      temp: ROOM_C,
      pouring: 0,          // ثواني فاضلة في الصبّة الحالية
      wobble: 0,           // شدة التموّج
      swirl: 0,            // دوران التقليب/الحمل الحراري
      tilt: new THREE.Vector2(),   // ميل السلوشينج
      tiltV: new THREE.Vector2(),
      home: new THREE.Vector3(),
      moveTo: null,
      onPour: null         // callback للصوت
    };
    const colTarget = new THREE.Color(0x3B2318);
    const tmpV = new THREE.Vector3();
    let lastPos = new THREE.Vector3();

    function setLevelMeshes() {
      const h = st.level * H;
      const show = h > 0.002;
      body.visible = bodyBottom.visible = surface.visible = show;
      if (!show) return;
      body.scale.y = h;
      body.position.y = h / 2 + 0.004;
      surface.position.y = h + 0.004;
    }
    setLevelMeshes();

    /* ---------- الأوامر ---------- */
    /** صبّة: كمية (0..1 من الكوباية)، لون، وحرارة */
    function pour(opt) {
      opt = opt || {};
      const amount = Math.max(0.02, Math.min(MAX, opt.amount == null ? 0.2 : opt.amount));
      st.target = Math.min(MAX, st.target + amount);
      st.pouring = Math.max(st.pouring, amount * 6.5);      // مدة الصبّ بالثواني
      st.wobble = Math.min(1, st.wobble + 0.6);
      if (opt.color != null) colTarget.set(opt.color);
      if (opt.tempC != null) {
        // الحرارة الجديدة = خلط بين اللي في الكوباية واللي بينزل
        const before = st.level, after = st.level + amount;
        st.temp = (st.temp * before + opt.tempC * amount) / Math.max(0.001, after);
      }
      if (st.onPour) st.onPour({ from: st.level / MAX, to: st.target / MAX, secs: st.pouring });
      return true;
    }

    /** تلج: عدد المكعبات */
    function addIce(n) {
      n = Math.max(1, Math.min(12, n | 0));
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(iceGeo, iceMat);
        const s = 0.016 + Math.random() * 0.007;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.55;
        c.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
        c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        c.scale.setScalar(s);
        c.userData = { s0: s, spin: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6 };
        liquid.add(c);
        ice.push(c);
      }
      st.wobble = Math.min(1, st.wobble + 0.45);
      st.temp = Math.max(3, st.temp - n * 1.8);            // التلج بيبرّد على طول
      return ice.length;
    }

    /** تقليب: بيلف السائل ويعمل تموّج */
    function stir() {
      st.swirl = Math.min(2.6, st.swirl + 1.7);
      st.wobble = Math.min(1, st.wobble + 0.5);
    }

    /** نقل الكوباية لمكان تاني على السطح (بتتزحلق وبتتخبط جوه) */
    function moveTo(x, z, y) {
      st.moveTo = new THREE.Vector3(x, y == null ? group.position.y : y, z);
    }
    function placeAt(x, y, z) {
      group.position.set(x, y, z);
      lastPos.copy(group.position);
      st.home.set(x, y, z);
      st.moveTo = null;
    }
    function reset() {
      st.level = st.target = 0;
      st.temp = ROOM_C;
      st.swirl = 0;
      while (ice.length) liquid.remove(ice.pop());
      setLevelMeshes();
    }

    /* ---------- التحديث ---------- */
    function update(dt, now) {
      // الانتقال لمكان جديد
      if (st.moveTo) {
        tmpV.copy(st.moveTo).sub(group.position);
        const d = tmpV.length();
        if (d < 0.004) { group.position.copy(st.moveTo); st.moveTo = null; }
        else group.position.addScaledVector(tmpV.normalize(), Math.min(d, dt * 1.9));
      }

      // السلوشينج: تسارع الكوباية بيدفع السائل، ونابض بيرجّعه
      tmpV.copy(group.position).sub(lastPos);
      lastPos.copy(group.position);
      const push = 26;
      st.tiltV.x += (-tmpV.z * push - st.tilt.x * 22 * dt) ;
      st.tiltV.y += ( tmpV.x * push - st.tilt.y * 22 * dt);
      st.tiltV.multiplyScalar(Math.max(0, 1 - dt * 4.5));
      st.tilt.x += st.tiltV.x * dt;
      st.tilt.y += st.tiltV.y * dt;
      const cap = 0.16;
      st.tilt.x = Math.max(-cap, Math.min(cap, st.tilt.x));
      st.tilt.y = Math.max(-cap, Math.min(cap, st.tilt.y));
      liquid.rotation.x = st.tilt.x;
      liquid.rotation.z = st.tilt.y;
      if (Math.abs(st.tiltV.x) + Math.abs(st.tiltV.y) > 0.25) st.wobble = Math.min(1, st.wobble + dt * 1.6);

      // الصبّ: المستوى بيطلع بالتدريج
      if (st.pouring > 0) {
        st.pouring = Math.max(0, st.pouring - dt);
        const rate = (st.target - st.level) * Math.min(1, dt * 3.4);
        st.level = Math.min(st.target, st.level + Math.max(rate, dt * 0.02));
        st.wobble = Math.min(1, st.wobble + dt * 1.1);
        setLevelMeshes();
      } else if (st.level < st.target - 0.001) {
        st.level = Math.min(st.target, st.level + dt * 0.12);
        setLevelMeshes();
      }

      // لون السائل بيتمزج بالتدريج (لبن على إسبريسو، سيرب، شاي)
      bodyMat.color.lerp(colTarget, Math.min(1, dt * 1.6));
      surfMat.color.copy(bodyMat.color).multiplyScalar(1.18);

      // الحرارة بتروح لحرارة الأوضة، والتلج بيسرّع التبريد
      const tau = ice.length ? 26 : 95;
      st.temp += (ROOM_C - st.temp) * (1 - Math.exp(-dt / tau));

      // البخار بيقل مع البرودة
      const hot = Math.max(0, Math.min(1, (st.temp - 42) / 46));
      plume.userData.boost = hot * (st.level > 0.05 ? 1 : 0);
      plume.position.y = 0.006 + st.level * H;

      // تيار الحمل الحراري: دوران بطيء طول ما هو سخن، وبيزيد بالتقليب
      st.swirl = Math.max(hot * 0.45, st.swirl - dt * 0.9);
      liquid.rotation.y += st.swirl * dt * 0.9;

      // تموّج السطح: موجتين متعاكستين بتخمد لحد ما تسكن
      st.wobble = Math.max(0, st.wobble - dt * 0.55);
      if (surface.visible) {
        const pos = surfGeo.attributes.position;
        const arr = pos.array;
        const amp = 0.0012 + st.wobble * 0.006;
        const t = now * 0.001;
        for (let i = 0; i < arr.length; i += 3) {
          const x = rest[i], y = rest[i + 1];
          const rr = Math.sqrt(x * x + y * y) / (R * 0.955);
          const edge = 1 - rr * 0.55;                  // الوسط بيتحرك أكتر من الحافة
          arr[i + 2] = rest[i + 2]
            + Math.sin(rr * 22 - t * 7.5) * amp * edge
            + Math.sin(x * 90 + t * 5.2) * amp * 0.45 * edge
            + Math.cos(y * 78 - t * 4.1) * amp * 0.4 * edge;
        }
        pos.needsUpdate = true;
      }

      // الفقاقيع: بتشتغل لما يكون فيه سائل، وبتكتر لما يكون سخن أو مقلّب
      const bActive = st.level > 0.08;
      const bSpeed = 0.35 + hot * 0.7 + st.swirl * 0.3;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i], u = b.userData;
        b.visible = bActive && (i < 4 + Math.round(hot * 6));
        if (!b.visible) continue;
        u.t += dt * bSpeed * u.k;
        if (u.t > 1) u.t -= 1;
        const top = st.level * H;
        b.position.set(u.x * (0.6 + u.t * 0.4), 0.008 + u.t * Math.max(0.01, top - 0.012), u.z * (0.6 + u.t * 0.4));
        b.material.opacity = Math.sin(u.t * Math.PI) * 0.55;
      }

      // التلج: بيعوم على السطح، بيهتز معاه، وبيدوب
      const surfY = st.level * H;
      for (let i = ice.length - 1; i >= 0; i--) {
        const c = ice[i], u = c.userData;
        const melt = Math.max(0, (st.temp - 1) * 0.00055 + 0.00012);
        const s = c.scale.x - melt * dt * 60 * 0.016;
        if (s <= u.s0 * 0.3) {
          liquid.remove(c);
          ice.splice(i, 1);
          st.target = Math.min(MAX, st.target + 0.012);   // اللي داب بيرفع المستوى
          st.temp = Math.max(1, st.temp - 0.6);
          st.wobble = Math.min(1, st.wobble + 0.2);
          continue;
        }
        c.scale.setScalar(s);
        c.rotation.y += u.spin * dt;
        const bob = Math.sin(now * 0.004 + u.ph) * (0.0015 + st.wobble * 0.004);
        c.position.y = Math.max(s * 0.5, surfY - s * 0.45 + bob);
      }

      // الندى: بيظهر لما الكوباية تبرد، وبيختفي لما تسخن
      const cold = Math.max(0, Math.min(1, (16 - st.temp) / 12));
      dewMat.opacity += (cold * 0.75 - dewMat.opacity) * Math.min(1, dt * 0.6);
      dewMat.visible = dewMat.opacity > 0.02;
    }

    return {
      group, state: st, update,
      pour, addIce, stir, moveTo, placeAt, reset,
      get temp() { return st.temp; },
      get level() { return st.level / MAX; },
      get iceCount() { return ice.length; },
      set onPour(fn) { st.onPour = fn; }
    };
  };
})(window);
