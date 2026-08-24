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

    return {
      get on() { return on; },
      set on(v) { on = !!v; if (!on && ctx) { try { ctx.suspend(); } catch (e) {} } },
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
