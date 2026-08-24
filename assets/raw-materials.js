/* ==========================================================================
   RAW — الخامات والتكستشرات
   كل خامة بتترسم على canvas مرة واحدة وتتكرر، فمفيش أصول خارجية بتتحمّل.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /* لوحة الألوان: بيج كريمي، خشب دافئ، رخام عاجي، زمردي، ونحاس هادي */
  const C = {
    tile:      0xE9E0D0, tileEdge: 0xDCD2C0, grout: 0xCBBFA9,
    plaster:   0xEDE3D3,
    floor:     0x6B4A33, floorAlt: 0x7A5739,
    wood:      0x8A6242, woodDark: 0x4B3324, woodWarm: 0x9C724C,
    marble:    0xF1EADC, marbleVein: 0xCEC2AC, marbleEdge: 0xDED2BC,
    emerald:   0x2E5A4B, emeraldDeep: 0x224437,
    brass:     0xB08A4A, brassDim: 0x8E6E3A,
    steel:     0xB7BBC0, steelDark: 0x6B7075, black: 0x222427,
    cream:     0xF6F0E4, glass: 0xD8E4E8
  };

  RAW.materials = function (THREE) {
    const cache = {};

    /* خامة قياسية مع كاش عشان ما نكرّرش نفس المادة ٥٠ مرة */
    function M(color, rough, metal) {
      const key = color + '|' + rough + '|' + metal;
      if (cache[key]) return cache[key];
      const m = new THREE.MeshStandardMaterial({
        color: color,
        roughness: rough == null ? 0.8 : rough,
        metalness: metal || 0
      });
      cache[key] = m;
      return m;
    }
    const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const cyl = (rt, rb, h, seg, mat) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 18), mat);

    const hex = n => '#' + n.toString(16).padStart(6, '0');
    function canvas(w, h) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      return cv;
    }
    function finish(cv, rx, ry) {
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx || 1, ry || 1);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }

    /* بلاط subway مستطيل بفواصل رفيعة وترتيب متعاقب */
    const tileCache = {};
    function tileTex(rx, ry) {
      const key = rx + 'x' + ry;
      if (tileCache[key]) return tileCache[key];
      const cv = canvas(256, 128), g = cv.getContext('2d');
      g.fillStyle = hex(C.grout); g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 2; row++) {
        const off = row % 2 ? -64 : 0;
        for (let i = -1; i < 3; i++) {
          const x = off + i * 128 + 2, y = row * 64 + 2;
          // تفاوت خفيف بين البلاطات عشان ما تبانش مسطّحة
          const j = ((i + row * 3) % 3) - 1;
          g.fillStyle = hex(j === 0 ? C.tile : (j > 0 ? C.tileEdge : C.cream));
          g.fillRect(x, y, 124, 60);
          const grad = g.createLinearGradient(x, y, x, y + 60);
          grad.addColorStop(0, 'rgba(255,255,255,.35)');
          grad.addColorStop(1, 'rgba(150,135,115,.12)');
          g.fillStyle = grad; g.fillRect(x, y, 124, 60);
        }
      }
      tileCache[key] = finish(cv, rx, ry);
      return tileCache[key];
    }

    /* أرضية خشب: ألواح طولية بعروق وتفاوت بسيط في اللون */
    let floorTexCache = null;
    function floorTex(rx, ry) {
      if (floorTexCache) return floorTexCache;
      const cv = canvas(512, 512), g = cv.getContext('2d');
      g.fillStyle = hex(C.floor); g.fillRect(0, 0, 512, 512);
      const planks = 6, pw = 512 / planks;
      for (let i = 0; i < planks; i++) {
        const tone = [0x6E4C34, 0x7A573C, 0x63432D, 0x815E41, 0x6A4930, 0x745133][i % 6];
        g.fillStyle = hex(tone);
        g.fillRect(i * pw, 0, pw - 1.5, 512);
        // عروق طولية
        for (let v = 0; v < 26; v++) {
          const x = i * pw + 4 + Math.random() * (pw - 10);
          g.strokeStyle = 'rgba(40,26,15,' + (0.05 + Math.random() * 0.1) + ')';
          g.lineWidth = 0.6 + Math.random() * 1.6;
          g.beginPath();
          g.moveTo(x, 0);
          for (let y = 0; y <= 512; y += 64) g.lineTo(x + (Math.random() - 0.5) * 5, y);
          g.stroke();
        }
        // فواصل بين الألواح
        g.fillStyle = 'rgba(35,22,12,.45)';
        g.fillRect(i * pw + pw - 2, 0, 2, 512);
        // وصلات عرضية متبادلة
        g.fillRect(i * pw, (i % 2 ? 170 : 330), pw, 2);
      }
      floorTexCache = finish(cv, rx, ry);
      return floorTexCache;
    }

    /* رخام عاجي بعروق هادية — مش أبيض ساطع */
    let marbleTexCache = null;
    function marbleTex() {
      if (marbleTexCache) return marbleTexCache;
      const cv = canvas(512, 512), g = cv.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 512, 512);
      bg.addColorStop(0, hex(C.marble));
      bg.addColorStop(1, '#E7DECD');
      g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = 'rgba(150,138,116,' + (0.10 + Math.random() * 0.16) + ')';
        g.lineWidth = 0.8 + Math.random() * 3;
        g.beginPath();
        let x = Math.random() * 512, y = -20;
        g.moveTo(x, y);
        while (y < 532) { x += (Math.random() - 0.45) * 90; y += 40 + Math.random() * 40; g.lineTo(x, y); }
        g.stroke();
      }
      marbleTexCache = finish(cv, 1, 1);
      return marbleTexCache;
    }

    /* لوحات الكتابة — بتتحوّل لـdecal مسطّح بيتحجب زي أي mesh */
    function textTex(text, opt) {
      opt = opt || {};
      const cv = canvas(512, opt.tall ? 256 : 128), g = cv.getContext('2d');
      if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, cv.width, cv.height); }
      g.font = '700 ' + (opt.size || 64) + 'px Inter, Helvetica, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = opt.fg || '#fff';
      const reps = opt.repeat || 1;
      for (let i = 0; i < reps; i++) g.fillText(text, (cv.width / reps) * (i + 0.5), cv.height / 2);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      if (opt.turn) { t.wrapS = THREE.RepeatWrapping; t.offset.x = opt.turn; }
      return t;
    }
    function decal(text, w, h, opt) {
      opt = opt || {};
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: textTex(text, opt), transparent: !opt.bg, depthWrite: false }));
    }

    /* الرخام كخامة كاملة (نفس النسخة لكل الأسطح) */
    const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.42, metalness: 0.04 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(9, 8), roughness: 0.8, metalness: 0.02 });
    const glassMat = () => new THREE.MeshPhysicalMaterial({
      color: 0xDCE7EA, transmission: 0.6, roughness: 0.14, transparent: true, opacity: 0.55, metalness: 0
    });

    return { C, M, box, cyl, tileTex, floorTex, marbleTex, textTex, decal, marbleMat, floorMat, glassMat, hex };
  };
})(window);
