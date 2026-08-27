/* ==========================================================================
   RAW — محرّك لوحات تحكم الماكينات

   بيبني اللوحة من الوصف اللي في raw-consoles.js: شاشة LCD، لمبات، شرايط،
   أزرار، عدّاد تنازلي بشريط تقدّم، تقييم بعد كل عملية، وتعليق من نورة.

   الحالة بتفضل محفوظة لكل ماكينة: القيم، عدد المرات، ومستوى الماء.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  // ثواني الماكينة بتجري أسرع من ثواني الحقيقة — ٢٨ ثانية استخلاص بتاخد ~١٠
  const TIME_SCALE = 0.36;
  const AR = n => String(n);

  RAW.console = function (els, hooks) {
    const h = hooks || {};
    const state = {};                 // حالة كل ماكينة
    let spec = null, station = null;  // المفتوح دلوقتي
    let run = null;                   // العملية الشغّالة
    let closeTimer = 0;

    function machine(id) {
      if (state[id]) return state[id];
      const sp = RAW.consoles[id];
      const values = {};
      sp.controls.forEach(c => {
        values[c.k] = c.type === 'counter' ? 0 : (c.type === 'choice' ? c.def : c.def);
      });
      state[id] = { power: !sp.power, values: values, runs: 0, water: 100, care: false, last: null };
      return state[id];
    }

    /* ---------- بناء اللوحة ---------- */
    const el = (tag, cls, html) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html != null) n.innerHTML = html;
      return n;
    };

    function build() {
      const m = machine(station.id);
      els.hud.innerHTML = '';

      /* الترويسة: اسم الماكينة + اللمبات + زرار الخروج */
      const head = el('header', 'raw-hud-head');
      head.appendChild(el('div', 'raw-hud-id',
        '<span class="ico">' + spec.icon + '</span>' +
        '<span class="txt"><b>' + spec.model + '</b><small>' + spec.sub + '</small></span>'));
      const leds = el('div', 'raw-leds',
        '<i class="led ready" title="جاهز"></i>' +
        '<i class="led busy" title="تشغيل"></i>' +
        '<i class="led warn" title="تحذير"></i>');
      head.appendChild(leds);
      const x = el('button', 'raw-hud-x', '✕');
      x.type = 'button';
      x.title = 'رجوع للمطبخ';
      x.addEventListener('click', () => { close(); if (h.onClose) h.onClose(); });
      head.appendChild(x);
      els.hud.appendChild(head);

      /* شاشة LCD */
      const lcd = el('div', 'raw-lcd');
      spec.readouts.forEach(r => {
        const cell = el('div', 'raw-lcd-cell',
          '<span class="ic">' + r.icon + '</span>' +
          '<span class="val" data-r="' + r.k + '">—</span>' +
          '<span class="un">' + r.unit + '</span>');
        lcd.appendChild(cell);
      });
      els.hud.appendChild(lcd);

      /* مفتاح التشغيل + مؤشر الماء */
      const bar = el('div', 'raw-hud-bar');
      if (spec.power) {
        const pw = el('button', 'raw-power', '⏻ <span>' + (m.power ? 'شغّالة' : 'مطفية') + '</span>');
        pw.type = 'button';
        pw.classList.toggle('on', m.power);
        pw.addEventListener('click', () => {
          if (run) return;
          m.power = !m.power;
          pw.classList.toggle('on', m.power);
          pw.querySelector('span').textContent = m.power ? 'شغّالة' : 'مطفية';
          press();
          if (h.onPower) h.onPower(station, m.power);
          say(m.power ? spec.voice.hint : 'الماكينة مطفية — دوسي على المفتاح.');
          paint();
        });
        bar.appendChild(pw);
      }
      if (spec.gauge) {
        bar.appendChild(el('div', 'raw-gauge',
          '<span>' + spec.gauge.label + '</span>' +
          '<i><b data-gauge></b></i>'));
      }
      if (spec.care) {
        const care = el('button', 'raw-care', spec.care.label);
        care.type = 'button';
        care.addEventListener('click', () => {
          m.care = false;
          press();
          toast('اتنضّفت — الماكينة جاهزة', 'good');
          paint();
        });
        bar.appendChild(care);
      }
      if (bar.children.length) els.hud.appendChild(bar);

      /* التحكّمات */
      const ctrls = el('div', 'raw-ctrls');
      spec.controls.forEach(c => {
        if (c.type === 'slider') ctrls.appendChild(slider(c, m));
        else if (c.type === 'choice') ctrls.appendChild(choice(c, m));
        else if (c.type === 'counter') ctrls.appendChild(counter(c, m));
      });
      els.hud.appendChild(ctrls);

      /* زرار التشغيل + شريط التقدّم */
      const go = el('button', 'raw-run', spec.action.label);
      go.type = 'button';
      go.addEventListener('click', () => {
        if (run && run.manual) stopManual();
        else start();
      });
      els.hud.appendChild(go);
      els.hud.appendChild(el('div', 'raw-prog', '<i data-prog></i><span data-count></span>'));
      els.hud.appendChild(el('div', 'raw-note', ''));

      paint();
    }

    /* شريط ضبط بقيمة ومدى صح مرسوم عليه */
    function slider(c, m) {
      const wrap = el('div', 'raw-ctrl');
      wrap.appendChild(el('div', 'row',
        '<span>' + c.label + '</span><output data-out="' + c.k + '">—</output>'));
      const track = el('div', 'raw-track');
      const okFrom = ((c.ok[0] - c.min) / (c.max - c.min)) * 100;
      const okTo = ((c.ok[1] - c.min) / (c.max - c.min)) * 100;
      track.appendChild(el('i', 'ok'));
      track.querySelector('.ok').style.insetInlineStart = okFrom + '%';
      track.querySelector('.ok').style.width = (okTo - okFrom) + '%';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.dataset.k = c.k;
      inp.min = c.min; inp.max = c.max; inp.step = c.step;
      inp.value = m.values[c.k];
      inp.addEventListener('input', () => {
        // أثناء التشغيل الشريط بيتقفل — إلا لو ده الشريط اللي الماوس بيحرّكه
        if (run) { inp.value = m.values[c.k]; return; }
        m.values[c.k] = parseFloat(inp.value);
        paint();
        if (h.onValue) h.onValue(station, c.k, m.values[c.k]);
      });
      inp.addEventListener('change', press);
      track.appendChild(inp);
      wrap.appendChild(track);
      if (c.liveHint) wrap.appendChild(el('div', 'hint live-hint', c.liveHint));
      return wrap;
    }

    /* أزرار اختيار دائرية (النكهات) */
    function choice(c, m) {
      const wrap = el('div', 'raw-ctrl');
      wrap.appendChild(el('div', 'row', '<span>' + c.label + '</span><output data-out="' + c.k + '">—</output>'));
      const row = el('div', 'raw-choice');
      c.options.forEach(o => {
        const b = el('button', 'chip', '<i style="background:' + o.c + '"></i>' + o.n);
        b.type = 'button';
        b.dataset.v = o.v;
        b.addEventListener('click', () => {
          if (run) return;
          m.values[c.k] = o.v;
          press();
          paint();
          if (h.onValue) h.onValue(station, c.k, o.v);
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      return wrap;
    }

    /* عدّاد ضغطات ليه هدف */
    function counter(c, m) {
      const wrap = el('div', 'raw-ctrl');
      wrap.appendChild(el('div', 'row',
        '<span>' + c.label + '</span><output data-out="' + c.k + '">—</output>'));
      const row = el('div', 'raw-counter');
      const minus = el('button', 'cbtn', '−'); minus.type = 'button';
      const plus = el('button', 'cbtn', '+'); plus.type = 'button';
      const dots = el('div', 'dots');
      for (let i = 0; i < c.max; i++) dots.appendChild(el('i'));
      const bump = d => {
        if (run) return;
        m.values[c.k] = Math.max(0, Math.min(c.max, (m.values[c.k] || 0) + d));
        press();
        paint();
        if (h.onValue) h.onValue(station, c.k, m.values[c.k]);
      };
      minus.addEventListener('click', () => bump(-1));
      plus.addEventListener('click', () => bump(1));
      row.appendChild(minus); row.appendChild(dots); row.appendChild(plus);
      wrap.appendChild(row);
      wrap.appendChild(el('div', 'hint', 'الهدف: ' + AR(c.target) + ' ضخة'));
      return wrap;
    }

    /* ---------- تحديث القراءات ---------- */
    function paint() {
      if (!spec) return;
      const m = machine(station.id);
      // شاشة LCD
      spec.readouts.forEach(r => {
        const node = els.hud.querySelector('[data-r="' + r.k + '"]');
        if (!node) return;
        let v;
        if (run && run.live === r.k) v = run.liveShown;
        else if (r.counter) v = m.runs;
        else if (r.k === 'ml' && spec.controls.some(c => c.k === 'pumps')) {
          v = (m.values.pumps || 0) * (spec.mlPerPump || 5);   // كل ضخة ٥ مل بالظبط
        } else v = m.values[r.k];
        if (typeof v === 'number') node.textContent = v.toFixed(r.digits);
        else node.textContent = v == null ? '—' : String(v);
      });
      // قيم التحكّمات
      spec.controls.forEach(c => {
        const out = els.hud.querySelector('[data-out="' + c.k + '"]');
        const val = m.values[c.k];
        if (out) {
          if (c.type === 'choice') {
            const o = c.options.filter(x => x.v === val)[0];
            out.textContent = o ? o.n : '—';
          } else {
            out.textContent = val + (c.unit ? ' ' + c.unit : '');
            out.classList.toggle('off', c.ok && (val < c.ok[0] || val > c.ok[1]));
            if (c.target != null) out.classList.toggle('off', val !== c.target);
          }
        }
        if (c.type === 'choice') {
          els.hud.querySelectorAll('.raw-choice .chip').forEach(b => {
            b.classList.toggle('on', b.dataset.v === val);
          });
        }
        const inp = els.hud.querySelector('input[data-k="' + c.k + '"]');
        if (inp && String(inp.value) !== String(val)) inp.value = val;
        if (c.type === 'counter') {
          const dots = els.hud.querySelectorAll('.raw-counter .dots i');
          for (let i = 0; i < dots.length; i++) {
            dots[i].classList.toggle('on', i < (val || 0));
            dots[i].classList.toggle('goal', i === c.target - 1);
          }
        }
      });
      // مؤشر الماء
      const gauge = els.hud.querySelector('[data-gauge]');
      if (gauge) {
        gauge.style.width = m.water + '%';
        gauge.classList.toggle('low', m.water < 25);
      }
      // زرار الصيانة
      const care = els.hud.querySelector('.raw-care');
      if (care) care.classList.toggle('due', m.care);
      // اللمبات
      const ready = els.hud.querySelector('.led.ready');
      const busy = els.hud.querySelector('.led.busy');
      const warn = els.hud.querySelector('.led.warn');
      if (ready) ready.classList.toggle('on', m.power && !run);
      if (busy) busy.classList.toggle('on', !!run);
      if (warn) warn.classList.toggle('on', m.care || m.water < 25 || m.last === 'bad');
      // زرار التشغيل
      const go = els.hud.querySelector('.raw-run');
      if (go) {
        const manualRunning = run && run.manual;
        go.disabled = !!run && !manualRunning;      // زرار الإيقاف بيفضل شغّال
        go.classList.toggle('stop', !!manualRunning);
        go.textContent = manualRunning ? spec.action.stop
          : (run ? (spec.action.busy || 'شغّالة…') : spec.action.label);
      }
    }

    /* ---------- التشغيل ---------- */
    function start() {
      if (run || !spec) return;
      const m = machine(station.id);
      if (spec.power && !m.power) {
        toast('شغّلي الماكينة الأول', 'bad');
        say('دوسي على مفتاح التشغيل.', 'oops');
        if (h.onError) h.onError(station);
        return;
      }
      if (m.care) {
        toast(spec.care.note, 'bad');
        say('نضّفي الرأس الأول عشان الطعم ما يبوظش.', 'oops');
        if (h.onError) h.onError(station);
        return;
      }
      if (spec.gauge && m.water < 8) {
        toast('الخزان فاضي — محتاج تعبئة', 'bad');
        if (h.onError) h.onError(station);
        return;
      }
      press();
      const act = spec.action;
      if (act.manual) {
        // استخلاص يدوي: العدّاد بيطلع وانت اللي بتوقفه
        run = { manual: true, t: 0, shown: 0, liveShown: 0, live: act.live, max: act.max || 60 };
      } else {
        const secsSpec = act.secs;
        const shown = typeof secsSpec === 'string' ? (m.values[secsSpec] || 10) : secsSpec;
        run = { t: 0, dur: Math.max(1.2, shown * TIME_SCALE), shown: shown };
      }
      if (act.live && !act.manual) {
        // تحكّم حيّ بالماوس: الحركة يمين وشمال بتغيّر القيمة طول العملية
        run.live = act.live;
        run.inBand = 0; run.total = 0;
        addEventListener('pointermove', onLiveMove);
      }
      say(spec.voice.run, 'calm');
      if (h.onRun) h.onRun(station, spec, m.values);
      paint();
    }

    /* بيتنده من حلقة المشهد عشان العدّاد يمشي مع الفريمات */
    function tick(dt) {
      if (closeTimer > 0) {
        closeTimer -= dt;
        if (closeTimer <= 0 && h.onFinish) h.onFinish(station);
      }
      if (!run) return;
      run.t += dt;
      const prog = els.hud.querySelector('[data-prog]');
      const count = els.hud.querySelector('[data-count]');

      if (run.manual) {
        // ثواني الماكينة بتعدّ طالع، والهدف علامة على الشريط
        run.shown = run.t / TIME_SCALE;
        run.liveShown = Math.round(run.shown * 10) / 10;
        const target = spec.action.target || 30;
        const k = Math.min(1, run.shown / (target * 1.35));
        if (prog) {
          prog.style.width = (k * 100) + '%';
          prog.classList.toggle('near', Math.abs(run.shown - target) <= (spec.action.tol || 2));
        }
        if (count) count.textContent = run.liveShown.toFixed(1) + ' ث';
        paint();
        if (run.shown >= run.max) stopManual(true);
        return;
      }

      if (run.live) {
        // كام ثانية فضلت جوه المدى المضبوط — ده أساس تقييم الخفق
        const c = spec.controls.filter(x => x.k === run.live)[0];
        const v = machine(station.id).values[run.live];
        run.total += dt;
        if (c && c.ok && v >= c.ok[0] && v <= c.ok[1]) run.inBand += dt;
      }
      const k = Math.min(1, run.t / run.dur);
      if (prog) prog.style.width = (k * 100) + '%';
      if (count) count.textContent = Math.ceil(run.shown * (1 - k)) + ' ث';
      if (k >= 1) finish();
    }

    /* الماوس بيحرّك القيمة الحيّة: يمين = أكبر (الشاشة عربي، فبنعكس المحور) */
    function onLiveMove(e) {
      if (!run || !run.live || !spec) return;
      const c = spec.controls.filter(x => x.k === run.live)[0];
      if (!c) return;
      const m = machine(station.id);
      const k = 1 - Math.max(0, Math.min(1, e.clientX / (window.innerWidth || 1)));
      const raw = c.min + (c.max - c.min) * k;
      m.values[c.k] = Math.round(raw / c.step) * c.step;
      paint();
    }

    /* إيقاف الاستخلاص اليدوي — الدقة بتتقاس من فرق الثواني عن الهدف */
    function stopManual(auto) {
      if (!run || !run.manual) return;
      const m = machine(station.id);
      const act = spec.action;
      m.values[act.live] = Math.round(run.shown * 10) / 10;
      run.autoStopped = !!auto;
      if (!auto) press();
      finish();
    }

    function finish() {
      const m = machine(station.id);
      const wasRun = run;
      run = null;
      removeEventListener('pointermove', onLiveMove);
      const prog = els.hud.querySelector('[data-prog]');
      const count = els.hud.querySelector('[data-count]');
      if (prog) prog.style.width = '0%';
      if (count) count.textContent = '';

      // التقييم: كل تحكّم بره مداه بيخصم، وكمان دقة التوقيت وجودة الخفق
      const misses = [];
      const liveKey = wasRun && wasRun.live;
      spec.controls.forEach(c => {
        if (c.live && liveKey === c.k) return;                 // ده بيتقيّم بالوقت مش بالقيمة
        const v = m.values[c.k];
        if (c.ok && (v < c.ok[0] || v > c.ok[1])) misses.push(v < c.ok[0] ? c.low : c.high);
        else if (c.target != null && v !== c.target) misses.push(v < c.target ? c.low : c.high);
      });

      let perfect = false, penalty = 0;      // الأخطاء التقيلة بتتحسب مرتين
      if (wasRun && wasRun.manual) {
        const target = spec.action.target || 30;
        const tol = spec.action.tol || 2;
        const off = Math.abs(m.values[spec.action.live] - target);
        if (wasRun.autoStopped) { misses.push('سبت الشوت يجري لحد ما اتحرق!'); penalty += 2; }
        else if (off > tol * 2) {
          misses.push(m.values[spec.action.live] < target ? 'زمن الاستخلاص قصير جداً!' : 'استخلاص طويل — الطعم هيمرّ.');
          penalty += 1;
        }
        else if (off > tol) misses.push('الفرق ' + off.toFixed(1) + ' ثانية عن الـ٣٠ — قرّبها أكتر.');
        else perfect = true;
      }
      if (wasRun && wasRun.live && !wasRun.manual) {
        const share = wasRun.total ? wasRun.inBand / wasRun.total : 0;
        m.lastShare = Math.round(share * 100);
        if (share < 0.45) {
          misses.push('الزاوية كانت بره المضبوط أغلب الوقت (' + m.lastShare + '٪).');
          penalty += 1;
        }
        else if (share < 0.75) misses.push('ثبّت الزاوية أكتر — قعدت ' + m.lastShare + '٪ بس جوه المدى.');
        else perfect = true;
      }

      const score = misses.length + penalty;
      const rating = score === 0 ? 'great' : (score === 1 ? 'ok' : 'bad');
      m.last = rating;
      m.runs++;
      if (spec.gauge) m.water = Math.max(0, m.water - (spec.gauge.drain || 5));
      if (spec.care && m.runs % spec.care.every === 0) m.care = true;

      const label = { great: 'ممتاز', ok: 'جيد', bad: 'يحتاج تحسين' }[rating];
      const kind = rating === 'great' ? 'good' : (rating === 'ok' ? 'warn' : 'bad');
      toast(label + (misses.length ? ' — ' + misses[0] : ''), kind);
      say(spec.voice[rating], rating === 'bad' ? 'oops' : 'happy');
      const note = els.hud.querySelector('.raw-note');
      if (note) {
        note.textContent = misses.length ? misses.join(' · ') : 'كل الأرقام جوه المدى المضبوط.';
        note.className = 'raw-note ' + kind;
      }
      if (perfect && rating === 'great' && spec.action.perfect) toast(spec.action.perfect, 'good');

      // التقدّم بيتسجّل الأول عشان شارة المستوى تبان محدّثة في نفس اللحظة
      let got = [];
      if (RAW.progress) got = RAW.progress.record(station.id, rating);
      if (h.onDone) h.onDone(station, spec, m.values, rating);
      got.forEach((b, i) => setTimeout(() => toast('🏅 إنجاز: ' + b.name, 'good'), 700 + i * 600));
      paint();
      closeTimer = rating === 'bad' ? 0 : 2.8;      // الرجوع التلقائي بعد نجاح بس
    }

    /* ---------- نورة والإشعارات ---------- */
    function say(line, mood) {
      if (!els.nora) return;
      els.nora.classList.add('on');
      els.noraText.textContent = line;
      els.nora.dataset.mood = mood || 'calm';
    }
    function toast(msg, kind) {
      if (!els.toasts) return;
      const t = el('div', 'raw-toast ' + (kind || ''), msg);
      els.toasts.appendChild(t);
      setTimeout(() => t.classList.add('in'), 10);
      setTimeout(() => {
        t.classList.remove('in');
        setTimeout(() => t.remove(), 350);
      }, 2600);
    }
    // لمسة فيزيائية: اهتزاز خفيف على الموبايل + صوت زرار
    function press() {
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
      if (RAW.sfx) RAW.sfx.click();
    }

    /* ---------- فتح وقفل ---------- */
    function open(stObj) {
      station = stObj;
      spec = RAW.consoles[stObj.id];
      if (!spec) return false;
      closeTimer = 0;
      build();
      els.hud.classList.add('on');
      if (els.nora) { els.nora.classList.add('on'); }
      // نورة بتغيّر أسلوبها حسب مستواك: المبتدئ بياخد الشرح كامل، المتمكّن لأ
      const pr = RAW.progress;
      const mine = pr && pr.stats.byStation[station.id];
      if (pr && mine && mine.great >= 3) say('عارفة إنك متعوّد عليها — يلا بينا.');
      else say(spec.voice.hint);
      return true;
    }
    function close() {
      if (!spec) return;
      run = null;
      removeEventListener('pointermove', onLiveMove);
      closeTimer = 0;
      els.hud.classList.remove('on');
      if (els.nora) els.nora.classList.remove('on');
      spec = null; station = null;
    }
    function isOpen() { return !!spec; }
    /** حالة التشغيل الحالية للتأثيرات ثلاثية الأبعاد: { id, k, values } */
    function progress() {
      if (!run || !station) return null;
      const k = run.manual
        ? Math.min(1, run.shown / ((spec.action.target || 30) * 1.2))
        : Math.min(1, run.t / run.dur);
      return { id: station.id, k: k, values: machine(station.id).values };
    }
    function current() { return station; }
    function busy() { return !!run; }

    return { open, close, isOpen, current, busy, tick, toast, say, state, progress };
  };
})(window);
