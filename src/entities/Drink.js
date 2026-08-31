/* ==========================================================================
   RAW — كوباية التحضير (Drink) · كلاس

   فيزياء سائل مبسّطة بس محسوسة:
   · سطح السائل بيتموّج ويهتز، والاهتزاز بيعلى لما تصب أو تقلّب أو تتحرك الكوباية.
   · السائل بيتخبط في الجناب (سلوشينج) لما الكوباية تتحرك — نابض بيخمد.
   · فقاعات بتطلع من القاع لحد السطح.
   · تيار حمل حراري: دوران بطيء في السائل طول ما هو سخن.
   · مكعبات التلج بتعوم، بتهتز مع السطح، وبتدوب فترفع المستوى وتبرّد.
   · الحرارة بتنزل لحرارة الأوضة، والبخار بيقل معاها، والباردة بيتكثّف عليها ندى.

   الفرق عن النسخة القديمة (`assets/raw-drink.js`): نفس الفيزياء بالحرف، بس في
   كلاس بحالة على `this`، وبيبثّ `drink:change` على الناقل وبيحدّث الحالة
   المركزية عند كل أمر (صبّ · تفريغ · تلج · تقليب · تصفير).
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /* الوصول للنواة بيتأجّل لوقت الاستعمال — الترتيب في الصفحة مش شرط */
  const bus   = () => RAW.core && RAW.core.bus;
  const store = () => RAW.core && RAW.core.state;
  const log   = () => RAW.core && RAW.core.logger;
  const EV    = k => (RAW.core && RAW.core.EVENTS && RAW.core.EVENTS[k]) || null;

  const R      = 0.043;    // نصف قطر الكوباية من فوق
  const RB     = 0.034;    // من تحت
  const H      = 0.125;    // ارتفاع الكوباية
  const ROOM_C = 22;       // حرارة الأوضة
  const MAX    = 0.92;     // أقصى امتلاء قبل ما يفيض

  class Drink {
    /**
     * @param {Object} THREE مكتبة three.js (بتتحمّل ديناميكياً فبتتبعت هنا)
     * @param {Object} scene المشهد
     * @param {Object} mats  خامات المشروع (raw-materials)
     * @param {Object} fx    مؤثرات المشروع (raw-fx) — محتاجينها للبخار
     */
    constructor(THREE, scene, mats, fx) {
      if (!THREE || !scene || !mats || !fx) {
        const l = log(); if (l) l.error('Drink: ناقص اعتماديات');
        throw new Error('Drink: missing dependencies');
      }
      this.THREE = THREE;
      this.scene = scene;
      this.mats = mats;
      this.fx = fx;

      /* الحالة الفيزيائية — مكشوفة كـ`state` لأن الأيدين والماكينات بتكتب فيها
         مباشرة (`drink.state.foam`، `drink.state.swirl`) */
      this.state = {
        level: 0,          // 0..MAX من ارتفاع الكوباية
        target: 0,
        temp: ROOM_C,
        pouring: 0,        // ثواني فاضلة في الصبّة الحالية
        foam: 0,           // رغوة من ٠ لـ١
        wobble: 0,         // شدة التموّج
        swirl: 0,          // دوران التقليب/الحمل الحراري
        tilt: new THREE.Vector2(),
        tiltV: new THREE.Vector2(),
        home: new THREE.Vector3(),
        moveTo: null,
        onPour: null       // callback للصوت
      };

      this.ice = [];
      this.bits = [];
      this.bubbles = [];
      this.dew = [];
      this._colTarget = new THREE.Color(0x3B2318);
      this._tmpV = new THREE.Vector3();
      this._lastPos = new THREE.Vector3();

      this.group = new THREE.Group();
      this.liquid = new THREE.Group();

      this._buildGlass();
      this._buildLiquid();
      this._buildBubbles();
      this._buildDew();
      this.plume = fx.steam(this.group, 0, H + 0.01, 0, 0.05, 0.34, 7);

      scene.add(this.group);
      this._setLevelMeshes();

      const l = log(); if (l) l.debug('Drink جاهزة');
    }

    /* ==================== البناء ==================== */

    _buildGlass() {
      const THREE = this.THREE;
      // زجاج حقيقي: بيعتمد على الـtransmission مش على opacity — الـopacity
      // الواطية كانت بتخلّيه بقعة بيضا وبتخفي السائل اللي جوّاه
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF, transmission: 0.96, roughness: 0.04, thickness: 0.02,
        ior: 1.45, transparent: true, opacity: 1, metalness: 0,
        attenuationColor: new THREE.Color(0xDCEAEE), attenuationDistance: 0.6,
        specularIntensity: 0.9, clearcoat: 0.25, clearcoatRoughness: 0.08,
        depthWrite: false
      });
      this.glassMat = glassMat;

      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(R, RB, H, 26, 1, true), glassMat);
      glass.position.y = H / 2;
      this.group.add(glass);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(RB, RB, 0.008, 26), glassMat);
      base.position.y = 0.004;
      this.group.add(base);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.003, 6, 26), glassMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = H;
      this.group.add(rim);
    }

    _buildLiquid() {
      const THREE = this.THREE;
      /* مهم: السائل والتلج والفقاقيع من غير transmission خالص.
         three بتستبعد أي مجسّم transmissive من الخلفية اللي بيشوفها الزجاج،
         فلو السائل كان transmissive كان بيختفي أول ما تبص من خلال الكوباية. */
      this.bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x3B2318, roughness: 0.14, metalness: 0.02,
        transparent: true, opacity: 0.95,
        clearcoat: 0.75, clearcoatRoughness: 0.08
      });
      this.body = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.955, RB * 0.97, 1, 24, 1, true), this.bodyMat);
      this.bodyBottom = new THREE.Mesh(
        new THREE.CylinderGeometry(RB * 0.97, RB * 0.97, 0.004, 24), this.bodyMat);
      this.bodyBottom.position.y = 0.006;

      // السطح: قرص بيتحرّك رأسه لكل vertex — ده اللي بيدّي إحساس السائل الحي
      const surfGeo = new THREE.CircleGeometry(R * 0.955, 30, 0, Math.PI * 2);
      this.surfMat = new THREE.MeshPhysicalMaterial({
        color: 0x4A2C1C, roughness: 0.06, metalness: 0.05,
        clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide
      });
      this.surface = new THREE.Mesh(surfGeo, this.surfMat);
      this.surface.rotation.x = -Math.PI / 2;
      this._surfGeo = surfGeo;
      this._rest = surfGeo.attributes.position.array.slice();   // النسخة الساكنة

      /* الرغوة — بتتكوّن من الخفق والرجّ */
      this.foamMat = new THREE.MeshPhysicalMaterial({
        color: 0xFDF6E8, roughness: 0.75, clearcoat: 0.3,
        transparent: true, opacity: 0
      });
      this.foam = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.95, R * 0.9, 0.012, 24), this.foamMat);
      this.foam.visible = false;

      // كل السائل جوه pivot بيميل لوحده — السلوشينج
      this.liquid.add(this.body, this.bodyBottom, this.surface, this.foam);
      this.group.add(this.liquid);

      // خامة التلج بتتشارك بين كل المكعبات
      this.iceMat = new THREE.MeshPhysicalMaterial({
        color: 0xF2FAFF, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04,
        transparent: true, opacity: 0.62, metalness: 0
      });
      this.iceGeo = new THREE.BoxGeometry(1, 1, 1);
    }

    _buildBubbles() {
      const THREE = this.THREE;
      const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFF3E0, roughness: 0.05, clearcoat: 1,
        transparent: true, opacity: 0.5
      });
      for (let i = 0; i < 10; i++) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.0035 + (i % 3) * 0.0018, 7, 6), bubbleMat.clone());
        const a = i * 2.1, rr = R * (0.15 + (i % 4) * 0.17);
        b.userData = { x: Math.cos(a) * rr, z: Math.sin(a) * rr, t: i / 10, k: 0.55 + (i % 5) * 0.18 };
        b.visible = false;
        this.liquid.add(b);
        this.bubbles.push(b);
      }
    }

    _buildDew() {
      const THREE = this.THREE;
      this.dewMat = new THREE.MeshPhysicalMaterial({
        color: 0xE8F4FA, roughness: 0.04, clearcoat: 1,
        transparent: true, opacity: 0
      });
      for (let i = 0; i < 16; i++) {
        const d = new THREE.Mesh(
          new THREE.SphereGeometry(0.0035 + (i % 3) * 0.0015, 6, 5), this.dewMat);
        const a = i * 1.9, y = 0.02 + (i % 5) * 0.021;
        const rr = RB + (R - RB) * (y / H);
        d.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        d.scale.set(1, 1.35, 0.6);
        this.group.add(d);
        this.dew.push(d);
      }
    }

    _setLevelMeshes() {
      const h = this.state.level * H;
      const show = h > 0.002;
      this.body.visible = this.bodyBottom.visible = this.surface.visible = show;
      if (!show) return;
      this.body.scale.y = h;
      this.body.position.y = h / 2 + 0.004;
      this.surface.position.y = h + 0.004;
    }

    /* ==================== الأوامر ==================== */

    /** صبّة: كمية (0..1 من الكوباية)، لون، وحرارة */
    pour(opt) {
      opt = opt || {};
      const st = this.state;
      const amount = Math.max(0.02, Math.min(MAX, opt.amount == null ? 0.2 : opt.amount));
      st.target = Math.min(MAX, st.target + amount);
      st.pouring = Math.max(st.pouring, amount * 6.5);      // مدة الصبّ بالثواني
      st.wobble = Math.min(1, st.wobble + 0.6);
      if (opt.color != null) this._colTarget.set(opt.color);
      if (opt.tempC != null) {
        // الحرارة الجديدة = خلط بين اللي في الكوباية واللي بينزل
        const before = st.level, after = st.level + amount;
        st.temp = (st.temp * before + opt.tempC * amount) / Math.max(0.001, after);
      }
      if (st.onPour) st.onPour({ from: st.level / MAX, to: st.target / MAX, secs: st.pouring });
      this._changed('pour', { amount });
      return true;
    }

    /** تفريغ: بتشيل من السائل (صبّ في حاجة تانية أو في المغسلة) */
    drain(amount) {
      const st = this.state;
      const a = Math.max(0, amount || 0.05);
      st.target = Math.max(0, st.target - a);
      st.level = Math.max(0, st.level - a);
      st.wobble = Math.min(1, st.wobble + a * 2);
      st.foam = Math.max(0, st.foam - a * 1.5);
      this._setLevelMeshes();
      if (st.level <= 0.002) {
        st.temp = ROOM_C;
        while (this.ice.length) this.liquid.remove(this.ice.pop());
      }
      this._changed('drain', { amount: a });
      return st.level;
    }

    /** تلج: عدد المكعبات */
    addIce(n) {
      const THREE = this.THREE, st = this.state;
      n = Math.max(1, Math.min(12, n | 0));
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(this.iceGeo, this.iceMat);
        const s = 0.016 + Math.random() * 0.007;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.55;
        c.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
        c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        c.scale.setScalar(s);
        c.userData = { s0: s, spin: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6 };
        this.liquid.add(c);
        this.ice.push(c);
      }
      st.wobble = Math.min(1, st.wobble + 0.45);
      st.temp = Math.max(3, st.temp - n * 1.8);            // التلج بيبرّد على طول
      this._changed('ice', { count: n });
      return this.ice.length;
    }

    /** قطع عايمة: بوبا أو جيلي — بتقعد تحت وبتتحرك مع السائل */
    addBits(colour, n, kind) {
      const THREE = this.THREE, st = this.state;
      const mat = new THREE.MeshPhysicalMaterial({
        color: colour == null ? 0x1E1512 : colour, roughness: 0.35, clearcoat: 0.8,
        transparent: true, opacity: 0.95
      });
      const geo = kind === 'cube'
        ? new THREE.BoxGeometry(0.016, 0.016, 0.016)
        : new THREE.SphereGeometry(0.011, 8, 7);
      for (let i = 0; i < Math.max(1, Math.min(14, n || 6)); i++) {
        const b = new THREE.Mesh(geo, mat);
        const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.6;
        b.position.set(Math.cos(a) * r, 0.012 + Math.random() * 0.01, Math.sin(a) * r);
        b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        b.userData = { a, r, ph: Math.random() * 6 };
        this.liquid.add(b);
        this.bits.push(b);
      }
      st.wobble = Math.min(1, st.wobble + 0.4);
      this._changed('bits', { total: this.bits.length });
      return this.bits.length;
    }

    /** تقليب: بيلف السائل ويعمل تموّج */
    stir() {
      const st = this.state;
      st.swirl = Math.min(2.6, st.swirl + 1.7);
      st.wobble = Math.min(1, st.wobble + 0.5);
      this._changed('stir');
    }

    /** نقل الكوباية لمكان تاني على السطح (بتتزحلق وبتتخبط جوه) */
    moveTo(x, z, y) {
      this.state.moveTo = new this.THREE.Vector3(
        x, y == null ? this.group.position.y : y, z);
    }

    /** حطّها في مكان فوراً من غير انزلاق */
    placeAt(x, y, z) {
      this.group.position.set(x, y, z);
      this._lastPos.copy(this.group.position);
      this.state.home.set(x, y, z);
      this.state.moveTo = null;
    }

    /** كوباية جديدة: فاضية وباردة ومن غير تلج ولا قطع */
    reset() {
      const st = this.state;
      st.level = st.target = 0;
      st.temp = ROOM_C;
      st.swirl = 0;
      st.foam = 0;
      while (this.ice.length) this.liquid.remove(this.ice.pop());
      while (this.bits.length) this.liquid.remove(this.bits.pop());
      this._setLevelMeshes();
      this._changed('reset');
    }

    /* ==================== التحديث (كل فريم) ==================== */

    update(dt, now) {
      const st = this.state, group = this.group, liquid = this.liquid;
      const tmpV = this._tmpV;

      // الانتقال لمكان جديد
      if (st.moveTo) {
        tmpV.copy(st.moveTo).sub(group.position);
        const d = tmpV.length();
        if (d < 0.004) { group.position.copy(st.moveTo); st.moveTo = null; }
        else group.position.addScaledVector(tmpV.normalize(), Math.min(d, dt * 1.9));
      }

      // السلوشينج: تسارع الكوباية بيدفع السائل، ونابض بيرجّعه
      tmpV.copy(group.position).sub(this._lastPos);
      this._lastPos.copy(group.position);
      const push = 26;
      st.tiltV.x += (-tmpV.z * push - st.tilt.x * 22 * dt);
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
        this._setLevelMeshes();
      } else if (st.level < st.target - 0.001) {
        st.level = Math.min(st.target, st.level + dt * 0.12);
        this._setLevelMeshes();
      }

      // الرغوة: بتقعد فوق السطح وبتنزل ببطء لو سبتها
      st.foam = Math.max(0, Math.min(1, st.foam - dt * 0.035));
      this.foamMat.opacity = st.foam * 0.92;
      this.foam.visible = st.foam > 0.02 && st.level > 0.02;
      if (this.foam.visible) {
        this.foam.position.y = st.level * H + 0.004 + st.foam * 0.006;
        this.foam.scale.y = 0.4 + st.foam * 2.2;
      }

      // لون السائل بيتمزج بالتدريج (لبن على إسبريسو، سيرب، شاي)
      this.bodyMat.color.lerp(this._colTarget, Math.min(1, dt * 1.6));
      this.surfMat.color.copy(this.bodyMat.color).multiplyScalar(1.18);

      // الحرارة بتروح لحرارة الأوضة، والتلج بيسرّع التبريد
      const tau = this.ice.length ? 26 : 95;
      st.temp += (ROOM_C - st.temp) * (1 - Math.exp(-dt / tau));

      // البخار بيقل مع البرودة
      const hot = Math.max(0, Math.min(1, (st.temp - 42) / 46));
      this.plume.userData.boost = hot * (st.level > 0.05 ? 1 : 0);
      this.plume.position.y = 0.006 + st.level * H;

      // تيار الحمل الحراري: دوران بطيء طول ما هو سخن، وبيزيد بالتقليب
      st.swirl = Math.max(hot * 0.45, st.swirl - dt * 0.9);
      liquid.rotation.y += st.swirl * dt * 0.9;

      // تموّج السطح: موجتين متعاكستين بتخمد لحد ما تسكن
      st.wobble = Math.max(0, st.wobble - dt * 0.55);
      if (this.surface.visible) {
        const pos = this._surfGeo.attributes.position;
        const arr = pos.array, rest = this._rest;
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
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i], u = b.userData;
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
      for (let i = this.ice.length - 1; i >= 0; i--) {
        const c = this.ice[i], u = c.userData;
        const melt = Math.max(0, (st.temp - 1) * 0.00055 + 0.00012);
        const s = c.scale.x - melt * dt * 60 * 0.016;
        if (s <= u.s0 * 0.3) {
          this.liquid.remove(c);
          this.ice.splice(i, 1);
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

      // القطع العايمة بتترجرج مع التقليب
      for (let i = 0; i < this.bits.length; i++) {
        const b = this.bits[i], u = b.userData;
        b.position.x = Math.cos(u.a + st.swirl * now * 0.0004) * u.r;
        b.position.z = Math.sin(u.a + st.swirl * now * 0.0004) * u.r;
        b.position.y = 0.012 + Math.abs(Math.sin(now * 0.002 + u.ph)) * 0.004 * (1 + st.wobble * 2);
        b.rotation.y += dt * (0.4 + st.swirl);
      }

      // الندى: بيظهر لما الكوباية تبرد، وبيختفي لما تسخن
      const cold = Math.max(0, Math.min(1, (16 - st.temp) / 12));
      this.dewMat.opacity += (cold * 0.75 - this.dewMat.opacity) * Math.min(1, dt * 0.6);
      this.dewMat.visible = this.dewMat.opacity > 0.02;
    }

    /* ==================== الناقل والحالة ==================== */

    /** بيتنده عند كل أمر — مش كل فريم، عشان الناقل ما يتخنقش */
    _changed(action, data) {
      const snap = {
        action,
        level: this.level,                 // منسوب مُطبَّع 0..1
        temp: this.state.temp,
        ice: this.ice.length,
        foam: this.state.foam,
        data: data || {}
      };
      const b = bus(), s = store();
      if (b) b.emit(EV('DRINK_CHANGE') || 'drink:change', snap);
      if (s) s.patch('drink', { level: snap.level, temp: snap.temp, ice: snap.ice });
    }

    /* ==================== قراءات ==================== */

    get temp()     { return this.state.temp; }
    get level()    { return this.state.level / MAX; }
    get iceCount() { return this.ice.length; }
    set onPour(fn) { this.state.onPour = fn; }
    get onPour()   { return this.state.onPour; }

    /* ==================== التنظيف ==================== */

    dispose() {
      this.state.onPour = null;
      this.scene.remove(this.group);
      // الخامات والهندسات بتتحرّر مع `mats.dispose()` في raw-kitchen.destroy
    }
  }

  /* ثوابت الكوباية متاحة لمين يحتاجها (raw-machinery بتحسب ارتفاع الصبّة) */
  Drink.R = R; Drink.RB = RB; Drink.H = H; Drink.ROOM_C = ROOM_C; Drink.MAX = MAX;

  RAW.entities = RAW.entities || {};
  RAW.entities.Drink = Drink;

  /* اسم قديم متوافق: `RAW.drink(THREE, scene, mats, fx)` */
  RAW.drink = (THREE, scene, mats, fx) => new Drink(THREE, scene, mats, fx);
})(window);
