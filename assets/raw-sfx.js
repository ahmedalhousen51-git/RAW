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
    function noise(dur, freq, q, vol, type) {
      const c = ensure(); if (!c) return;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain(); g.gain.value = vol == null ? 0.12 : vol;
      src.connect(f); f.connect(g); g.connect(master);
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
      pour, clink, stir, ambience,
      click()   { blip(520, 0.06, 'triangle', 0.1); },
      confirm() { blip(660, 0.09, 'sine', 0.12); setTimeout(() => blip(880, 0.12, 'sine', 0.1), 70); },
      error()   { blip(220, 0.16, 'sawtooth', 0.09); },
      step()    { noise(0.09, 260, 0.9, 0.05, 'lowpass'); },
      machine(id) {
        switch (id) {
          case 'espresso': noise(1.1, 900, 1.4, 0.1); blip(140, 0.5, 'sawtooth', 0.05); break;
          case 'grinder':  noise(1.0, 420, 0.7, 0.14, 'lowpass'); break;
          case 'syrup':    blip(380, 0.12, 'square', 0.07); setTimeout(() => blip(300, 0.14, 'square', 0.06), 130); break;
          case 'milk':     noise(1.2, 2400, 2.2, 0.09); break;
          case 'ice':      for (let i = 0; i < 5; i++) setTimeout(() => noise(0.1, 2600 + Math.random() * 1200, 3, 0.07), i * 90); break;
          case 'tea':      noise(0.9, 700, 1.1, 0.07); break;
          default:         noise(1.0, 520, 1.0, 0.08); break;
        }
      }
    };
  })();
})(window);
