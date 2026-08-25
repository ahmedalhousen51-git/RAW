/* ==========================================================================
   RAW — أصوات خفيفة مركّبة بـWebAudio (مفيش ملفات خارجية خالص)
   الصوت اختياري تماماً: لو الـAudioContext مش متاح، المشهد يكمّل عادي.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.sfx = (function () {
    let ctx = null, master = null, on = true, broken = false;

    function ensure() {
      if (broken || !on) return null;
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { broken = true; return null; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        return ctx;
      } catch (e) { broken = true; return null; }
    }

    /* الصوت المكاني: كل ماكينة صوتها جاي من مكانها في الأوضة.
       بنوصّل على panner لو اتبعت نقطة، وإلا على الماستر عادي. */
    function sink(at) {
      const c = ensure(); if (!c) return null;
      if (!at) return master;
      try {
        const p = c.createPanner();
        p.panningModel = 'HRTF';
        p.distanceModel = 'inverse';
        p.refDistance = 2.2; p.maxDistance = 26; p.rolloffFactor = 1.1;
        if (p.positionX) {
          p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z;
        } else p.setPosition(at.x, at.y, at.z);
        p.connect(master);
        return p;
      } catch (e) { return master; }
    }

    /** بيتنده كل فريم: أذن المستمع بتقعد مكان الكاميرا */
    function listener(cam) {
      if (!ctx || !on || !cam) return;
      const l = ctx.listener;
      try {
        if (l.positionX) {
          l.positionX.value = cam.position.x;
          l.positionY.value = cam.position.y;
          l.positionZ.value = cam.position.z;
          const d = cam.getWorldDirection(listener._v || (listener._v = { x: 0, y: 0, z: -1 }));
          l.forwardX.value = d.x; l.forwardY.value = d.y; l.forwardZ.value = d.z;
          l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
        } else {
          l.setPosition(cam.position.x, cam.position.y, cam.position.z);
        }
      } catch (e) {}
    }

    function blip(freq, dur, type, vol) {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(vol == null ? 0.16 : vol, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }

    // ضجيج مفلتر — أساس صوت المكن والصب والبخار
    function noise(dur, freq, q, vol, type, at) {
      const c = ensure(); if (!c) return;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain(); g.gain.value = vol == null ? 0.12 : vol;
      src.connect(f); f.connect(g); g.connect(sink(at) || master);
      src.start();
    }

    /* صوت الصبّ: نغمته بتعلى كل ما الكوباية تملى — عمود الهوا بيقصر */
    function pour(opt) {
      const c = ensure(); if (!c) return;
      opt = opt || {};
      const secs = Math.max(0.25, Math.min(3.2, opt.secs || 1.1));
      const f0 = 340 + (opt.from || 0) * 620;
      const f1 = 340 + (opt.to == null ? 0.5 : opt.to) * 1150;
      const len = Math.floor(c.sampleRate * secs);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(f0, c.currentTime);
      bp.frequency.linearRampToValueAtTime(f1, c.currentTime + secs);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3200;
      const g = c.createGain();
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.13, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.13, c.currentTime + secs - 0.12);
      g.gain.linearRampToValueAtTime(0, c.currentTime + secs);
      src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
      src.start();
    }

    /* رنة تلج على الزجاج */
    function clink() {
      const c = ensure(); if (!c) return;
      [1860, 2540, 3320].forEach((f, i) => {
        setTimeout(() => blip(f * (0.94 + Math.random() * 0.12), 0.09, 'triangle', 0.05), i * 45);
      });
      noise(0.12, 5200, 3, 0.04);
    }

    /* ملعقة بتلف في الكوباية */
    function stir() {
      for (let i = 0; i < 4; i++) setTimeout(() => noise(0.08, 1500 + Math.random() * 900, 2.4, 0.035), i * 120);
    }

    /* همهمة المكان: مكيّف وماكينات شغالة تحت في الخلفية */
    let amb = null;
    function ambience(want) {
      const c = ensure();
      if (!c) return;
      if (want && !amb) {
        const len = Math.floor(c.sampleRate * 2);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
        const g = c.createGain(); g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.035, c.currentTime + 1.4);
        const hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 62;
        const hg = c.createGain(); hg.gain.value = 0.012;
        src.connect(lp); lp.connect(g); g.connect(master);
        hum.connect(hg); hg.connect(master);
        src.start(); hum.start();
        amb = { src, hum, g, hg };
      } else if (!want && amb) {
        try { amb.src.stop(); amb.hum.stop(); } catch (e) {}
        amb = null;
      }
    }

    return {
      get on() { return on; },
      set on(v) {
        on = !!v;
        if (!on) { ambience(false); if (ctx) { try { ctx.suspend(); } catch (e) {} } }
        else if (ctx) { try { ctx.resume(); } catch (e) {} }
      },
      pour, clink, stir, ambience, listener,
      grab()  { blip(300, 0.05, 'triangle', 0.09); noise(0.06, 900, 1.6, 0.05); },
      drop()  { blip(180, 0.07, 'sine', 0.08); noise(0.09, 500, 1.2, 0.06, 'lowpass'); },
      shake() { for (let i = 0; i < 8; i++) setTimeout(() => noise(0.07, 1800 + Math.random() * 1400, 2.6, 0.05), i * 130); },
      water() { noise(0.22, 1400, 0.9, 0.05); },
      stirTick(power) { noise(0.05, 900 + (power || 0.5) * 1400, 2.2, 0.03 + (power || 0) * 0.03); },
      click()   { blip(520, 0.06, 'triangle', 0.1); },
      confirm() { blip(660, 0.09, 'sine', 0.12); setTimeout(() => blip(880, 0.12, 'sine', 0.1), 70); },
      error()   { blip(220, 0.16, 'sawtooth', 0.09); },
      step()    { noise(0.09, 260, 0.9, 0.05, 'lowpass'); },
      machine(id, at) {
        switch (id) {
          case 'espresso': noise(1.1, 900, 1.4, 0.1, 'bandpass', at); blip(140, 0.5, 'sawtooth', 0.05); break;
          case 'grinder':  noise(1.0, 420, 0.7, 0.14, 'lowpass', at); break;
          case 'syrup':    blip(380, 0.12, 'square', 0.07); setTimeout(() => blip(300, 0.14, 'square', 0.06), 130); break;
          case 'milk':     noise(1.2, 2400, 2.2, 0.09, 'bandpass', at); break;
          case 'ice':      for (let i = 0; i < 5; i++) setTimeout(() => noise(0.1, 2600 + Math.random() * 1200, 3, 0.07, 'bandpass', at), i * 90); break;
          case 'tea':      noise(0.9, 700, 1.1, 0.07, 'bandpass', at); break;
          case 'brew':     noise(1.2, 320, 0.8, 0.09, 'lowpass', at); break;
          default:         noise(1.0, 520, 1.0, 0.08, 'bandpass', at); break;
        }
      }
    };
  })();
})(window);
