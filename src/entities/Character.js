/* ==========================================================================
   RAW — نورة، الباريستا (Character) · كلاس

   مجسّم stylized بطول واقعي (~١.٧٥ م) فيه:
   · دورة مشي ونَفَس وهي واقفة
   · راسها وعينيها بيتابعوا الماوس (أو المحطة اللي قدامها)
   · رمشة كل كام ثانية
   · تعبيرات: ابتسامة أوسع لما الخطوة تظبط، ودهشة لما تغلط
   · ظل ناعم على الأرض مضمون مهما كانت الإضاءة

   الفرق عن النسخة القديمة (`assets/raw-character.js`): نفس المجسّم ونفس
   الأنيميشن بالحرف، بس في كلاس، والوضعية والمزاج بيتبثّوا على الناقل.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const bus   = () => RAW.core && RAW.core.bus;
  const store = () => RAW.core && RAW.core.state;
  const log   = () => RAW.core && RAW.core.logger;
  const EV    = k => (RAW.core && RAW.core.EVENTS && RAW.core.EVENTS[k]) || null;

  /* وضعية الإيد: idle · reach (بتمد) · carry (شايلة) · pour · stir · shake */
  const POSES = {
    idle:  { arm: 0,     fore: 0,    lean: 0 },
    reach: { arm: -1.35, fore: 0.25, lean: 0.12 },
    carry: { arm: -0.95, fore: 0.15, lean: 0 },
    pour:  { arm: -1.15, fore: 0.1,  lean: 0.05 },
    stir:  { arm: -1.1,  fore: 0.2,  lean: 0.08 },
    shake: { arm: -1.05, fore: 0.2,  lean: 0.03 }
  };

  class Character {
    /**
     * @param {Object} THREE مكتبة three.js
     * @param {Object} scene المشهد
     * @param {Object} mats  خامات المشروع (raw-materials)
     */
    constructor(THREE, scene, mats) {
      if (!THREE || !scene || !mats) {
        const l = log(); if (l) l.error('Character: ناقص اعتماديات');
        throw new Error('Character: missing dependencies');
      }
      this.THREE = THREE;
      this.scene = scene;
      this.mats = mats;
      this.name = 'نورة';

      /* الحالة */
      this.pose = 'idle';
      this.mood = 'calm';
      this._moodT = 0;
      this._phase = 0;
      this._poseT = 0;
      this._lean = 0;
      this._stirPhase = 0;
      this._blinkIn = 2 + Math.random() * 3;
      this._blinkT = 0;
      this._looking = false;
      this._lookAt = new THREE.Vector3();
      this._headWorld = new THREE.Vector3();
      this._yawWant = 0; this._pitchWant = 0;
      this._yawNow = 0;  this._pitchNow = 0;

      this.legs = [];
      this.arms = [];
      this.eyes = [];
      this.pupils = [];
      this.brows = [];
      this.blush = [];

      this.root = new THREE.Group();
      this._buildBody();
      this._buildHead();
      this._buildOutfit();
      // الظلال قبل ما نضيف قرص الظل الناعم — القرص نفسه ميرميش ظل
      this.root.traverse(n => { if (n.isMesh) n.castShadow = true; });
      this._buildShadow();

      /* قبضة اليد اليمين: أي أداة بتتمسك بتتعلّق هنا */
      this.grip = new THREE.Group();
      this.grip.position.set(0, -0.6, 0.07);
      this.arms[1].add(this.grip);

      scene.add(this.root);

      const l = log(); if (l) l.debug('Character جاهزة');
    }

    /* ==================== البناء ==================== */

    _buildBody() {
      const THREE = this.THREE, { M, box } = this.mats;
      const root = this.root;
      const skin  = this._skin  = M(0xE8C49E, 0.78);
      const shirt = this._shirt = M(0xF4EFE4, 0.82);
      const pants = M(0x3A3B3F, 0.88);

      [-1, 1].forEach(s => {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.48, 5, 12), pants);
        leg.position.set(s * 0.1, 0.49, 0);
        root.add(leg); this.legs.push(leg);
        const shoe = box(0.12, 0.07, 0.24, M(0x2A2521, 0.7));
        shoe.position.set(s * 0.1, 0.035, 0.045);
        root.add(shoe);
      });

      this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 14), shirt);
      this.torso.position.y = 1.12;
      root.add(this.torso);

      [-1, 1].forEach(s => {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.22, 1.36, 0);
        root.add(pivot); this.arms.push(pivot);
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.28, 5, 12), shirt);
        upper.position.y = -0.18; pivot.add(upper);
        const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.2, 5, 12), skin);
        fore.position.y = -0.42; pivot.add(fore);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), skin);
        hand.position.y = -0.56; pivot.add(hand);
      });
    }

    _buildHead() {
      const THREE = this.THREE, { M, box, cyl } = this.mats;
      const root = this.root;
      const skin = this._skin;
      const hairM = M(0x241A14, 0.9);
      const dark  = M(0x1F1B18, 0.45);

      const neck = cyl(0.05, 0.055, 0.09, 12, skin);
      neck.position.y = 1.45; root.add(neck);

      /* الراس كلها في group واحدة عشان تلف ناحية اللي بتبصله */
      const headG = this.headG = new THREE.Group();
      headG.position.y = 1.47;
      root.add(headG);

      this.head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 18), skin);
      this.head.position.y = 0.13; headG.add(this.head);

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
      [-1, 1].forEach(s => {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.027, 12, 10), eyeWhiteM);
        w.position.set(s * 0.048, 0.138, 0.108); headG.add(w); this.eyes.push(w);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 10, 8), dark);
        p.position.set(s * 0.048, 0.138, 0.127); headG.add(p); this.pupils.push(p);
        const b = box(0.048, 0.011, 0.01, dark);
        b.position.set(s * 0.048, 0.186, 0.114); headG.add(b); this.brows.push(b);
      });

      this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0075, 8, 14, Math.PI), dark);
      this.smile.rotation.z = Math.PI;
      this.smile.position.set(0, 0.079, 0.112); headG.add(this.smile);

      [-1, 1].forEach(s => {
        const b = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12),
          new THREE.MeshBasicMaterial({ color: 0xD98A86, transparent: true, opacity: 0.22 }));
        b.position.set(s * 0.072, 0.105, 0.104);
        b.rotation.y = s * 0.5;
        headG.add(b); this.blush.push(b);
      });
    }

    _buildOutfit() {
      const THREE = this.THREE, { M, box, cyl } = this.mats;
      const root = this.root, headG = this.headG;
      const apronM = M(0x2E5A4B, 0.85);

      // مريلة الشغل + رباط الوسط
      const apron = box(0.31, 0.5, 0.07, apronM);
      apron.position.set(0, 0.98, 0.15); root.add(apron);
      const apronTop = box(0.2, 0.21, 0.06, apronM);
      apronTop.position.set(0, 1.29, 0.16); root.add(apronTop);
      const tie = box(0.4, 0.05, 0.15, M(0x224437, 0.85));
      tie.position.set(0, 1.04, 0.09); root.add(tie);

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
    }

    /** ظل ناعم تحت الرجلين — بيضمن إن الشخصية مش سايبة في الهوا */
    _buildShadow() {
      const THREE = this.THREE;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g2 = cv.getContext('2d');
      const grad = g2.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(35,25,18,.5)');
      grad.addColorStop(1, 'rgba(35,25,18,0)');
      g2.fillStyle = grad; g2.fillRect(0, 0, 128, 128);
      this._blobTex = new THREE.CanvasTexture(cv);
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86),
        new THREE.MeshBasicMaterial({ map: this._blobTex, transparent: true, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.012;
      this.root.add(blob);
      this._blob = blob;
    }

    /* ==================== التحكّم ==================== */

    /** تبصّ لنقطة في العالم (مكان الماوس على الأرض مثلاً) */
    look(v) {
      if (!v) { this._looking = false; return; }
      this._looking = true;
      this._lookAt.copy(v);
    }

    /** وضعية الإيد والجسم */
    setPose(name) {
      const next = POSES[name] ? name : 'idle';
      if (next === this.pose) return;          // من غير بثّ مكرّر
      this.pose = next;
      const b = bus(), s = store();
      if (b) b.emit(EV('CHARACTER_POSE') || 'character:pose', next);
      if (s) s.patch('character', { pose: next });
    }

    currentPose() { return this.pose; }

    /** تعبير مؤقت: 'happy' لما الخطوة تظبط، 'oops' لما تغلط */
    express(kind, secs) {
      this.mood = kind || 'calm';
      this._moodT = secs || 1.6;
      const s = store();
      if (s) s.patch('character', { mood: this.mood });
    }

    /* ==================== التحديث (كل فريم) ==================== */

    update(dt, moving, speed) {
      const root = this.root, torso = this.torso;
      const arms = this.arms, legs = this.legs, headG = this.headG;

      /* المشي والنَفَس */
      if (moving) {
        this._phase += dt * (6.2 * (speed || 1));
        const sw = Math.sin(this._phase);
        arms[0].rotation.x = sw * 0.6;
        if (this.pose === 'idle') arms[1].rotation.x = -sw * 0.6;
        legs[0].rotation.x = -sw * 0.5;
        legs[1].rotation.x = sw * 0.5;
        root.position.y = Math.abs(Math.sin(this._phase)) * 0.035;
        torso.rotation.z = sw * 0.03;
        torso.scale.setScalar(1);
      } else {
        this._phase += dt * 1.6;
        const br = Math.sin(this._phase) * 0.5 + 0.5;
        torso.scale.set(1 + br * 0.012, 1 + br * 0.008, 1 + br * 0.012);
        arms[0].rotation.x = Math.sin(this._phase) * 0.05;
        if (this.pose === 'idle') arms[1].rotation.x = -Math.sin(this._phase) * 0.05;
        legs[0].rotation.x = legs[1].rotation.x = 0;
        root.position.y = br * 0.008;
        torso.rotation.z = 0;
      }

      /* الوضعية بتتغلّب على أرجحة الدراع اليمين */
      const P = POSES[this.pose] || POSES.idle;
      this._poseT += dt;
      const kp = Math.min(1, dt * 8);
      arms[1].rotation.x += (P.arm - arms[1].rotation.x) * kp;
      arms[1].rotation.z += ((this.pose === 'idle' ? 0 : -0.18) - arms[1].rotation.z) * kp;
      this._lean += (P.lean - this._lean) * kp;
      torso.rotation.x = this._lean;
      // حركة صغيرة مستمرة حسب الوضعية: تقليب دايري، ورج سريع
      if (this.pose === 'stir') {
        this._stirPhase += dt * 7;
        arms[1].rotation.x += Math.sin(this._stirPhase) * 0.09;
        arms[1].rotation.z += Math.cos(this._stirPhase) * 0.12;
      } else if (this.pose === 'shake') {
        this._stirPhase += dt * 26;
        arms[1].rotation.x += Math.sin(this._stirPhase) * 0.14;
      }

      /* الراس بتتابع النقطة — بزاوية محدودة زي الرقبة الحقيقية */
      if (this._looking) {
        headG.getWorldPosition(this._headWorld);
        const dx = this._lookAt.x - this._headWorld.x, dz = this._lookAt.z - this._headWorld.z;
        const dy = this._lookAt.y - this._headWorld.y;
        const flat = Math.max(0.001, Math.hypot(dx, dz));
        let yaw = Math.atan2(dx, dz) - root.rotation.y;
        while (yaw > Math.PI) yaw -= Math.PI * 2;
        while (yaw < -Math.PI) yaw += Math.PI * 2;
        this._yawWant = Math.max(-0.72, Math.min(0.72, yaw));
        this._pitchWant = Math.max(-0.34, Math.min(0.34, -Math.atan2(dy, flat)));
      } else {
        this._yawWant = 0; this._pitchWant = 0;
      }
      const k = Math.min(1, dt * 5.5);
      this._yawNow += (this._yawWant - this._yawNow) * k;
      this._pitchNow += (this._pitchWant - this._pitchNow) * k;
      headG.rotation.y = this._yawNow;
      headG.rotation.x = this._pitchNow;
      // العينين بتزيح شوية كمان — من غير كده البصّة تبان جامدة
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        this.pupils[i].position.x = s * 0.048 + this._yawNow * 0.016;
        this.pupils[i].position.y = 0.138 - this._pitchNow * 0.012;
      }

      /* الرمشة */
      this._blinkIn -= dt;
      if (this._blinkIn <= 0 && this._blinkT <= 0) { this._blinkT = 0.13; this._blinkIn = 2.6 + Math.random() * 4; }
      if (this._blinkT > 0) {
        this._blinkT -= dt;
        const shut = Math.sin(Math.max(0, this._blinkT) / 0.13 * Math.PI);
        const sy = 1 - shut * 0.92;
        this.eyes[0].scale.y = this.eyes[1].scale.y = sy;
        this.pupils[0].scale.y = this.pupils[1].scale.y = sy;
      } else {
        this.eyes[0].scale.y = this.eyes[1].scale.y = 1;
        this.pupils[0].scale.y = this.pupils[1].scale.y = 1;
      }

      /* التعبيرات */
      if (this._moodT > 0) { this._moodT -= dt; if (this._moodT <= 0) this.mood = 'calm'; }
      const wantSmile = this.mood === 'happy' ? 1.45 : (this.mood === 'oops' ? 0.55 : 1);
      const wantBrow  = this.mood === 'happy' ? 0.196 : (this.mood === 'oops' ? 0.206 : 0.186);
      const wantBlush = this.mood === 'happy' ? 0.4 : 0.22;
      this.smile.scale.x += (wantSmile - this.smile.scale.x) * Math.min(1, dt * 7);
      this.smile.scale.y += ((this.mood === 'oops' ? 1.5 : 1) - this.smile.scale.y) * Math.min(1, dt * 7);
      for (let i = 0; i < 2; i++) {
        this.brows[i].position.y += (wantBrow - this.brows[i].position.y) * Math.min(1, dt * 7);
        this.blush[i].material.opacity += (wantBlush - this.blush[i].material.opacity) * Math.min(1, dt * 4);
      }
    }

    /* ==================== التنظيف ==================== */

    dispose() {
      if (this._blobTex) this._blobTex.dispose();
      this.scene.remove(this.root);
    }
  }

  Character.POSES = POSES;

  RAW.entities = RAW.entities || {};
  RAW.entities.Character = Character;

  /* اسم قديم متوافق: `RAW.character(THREE, scene, mats)` */
  RAW.character = (THREE, scene, mats) => new Character(THREE, scene, mats);
})(window);
