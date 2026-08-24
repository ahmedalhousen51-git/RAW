/* ==========================================================================
   RAW — واجهة عربية فوق المشهد: لوحة المخزون، شريط التعليمات، اسم المحطة،
   ولوحة العمل اللي بتفتح بعد التفاعل بس (مش عند التشغيل).
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /* المخزون: كل صنف مربوط بالمحطة اللي بتقدّمه */
  const STOCK = [
    { k: 'espresso', n: 'إسبريسو',   c: '#3B2318', at: 'espresso' },
    { k: 'beans',    n: 'بن للطحن',  c: '#5C3A22', at: 'grinder'  },
    { k: 'syrup',    n: 'سيرب 1883', c: '#C2334D', at: 'syrup'    },
    { k: 'milk',     n: 'لبن',       c: '#EADFC8', at: 'milk'     },
    { k: 'ice',      n: 'تلج',       c: '#BFE0F2', at: 'ice'      },
    { k: 'tea',      n: 'شاي وبوبا', c: '#8A6242', at: 'tea'      }
  ];

  RAW.ui = function (els, hooks) {
    const h = hooks || {};
    const buttons = [];
    let openStation = null;                 // المحطة المفتوحة في لوحة العمل
    let step = 0, value = 0;
    const progress = {};                    // آخر خطوة وصلها كل محطة

    /* ---------- لوحة المخزون ---------- */
    STOCK.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.go = s.at;
      b.innerHTML = '<i style="--c:' + s.c + '"></i><span>' + s.n + '</span>';
      b.addEventListener('click', () => { if (h.onPick) h.onPick(s.at); });
      els.stock.appendChild(b);
      buttons.push(b);
    });
    function markAt(id) {
      buttons.forEach(b => b.classList.toggle('at', b.dataset.go === id));
    }

    /* ---------- اسم المحطة عند الاقتراب ---------- */
    function setNear(st, hint) {
      markAt(st ? st.id : null);
      if (!st) { els.tag.classList.remove('on'); return; }
      els.tag.innerHTML = st.label + '<small>' + (hint || 'دوس على المحطة عشان تشتغل') + '</small>';
      els.tag.classList.add('on');
    }
    function say(st, msg) {
      if (!st) return;
      els.tag.innerHTML = st.label + '<small>' + msg + '</small>';
      els.tag.classList.add('on');
    }

    /* ---------- لوحة العمل ---------- */
    function fmt(n) { return (Math.round(n * 10) / 10).toString(); }

    function render() {
      if (!openStation) return;
      const rec = RAW.recipes[openStation.id];
      const s = rec.steps[step];
      els.panelName.textContent = openStation.label;
      els.panelStep.textContent = 'الخطوة ' + (step + 1) + ' من ' + rec.steps.length;
      els.panelTitle.textContent = s.t;
      els.panelDesc.textContent = s.d;
      els.panelMsg.textContent = '';
      els.panelMsg.className = 'raw-msg';
      if (s.v) {
        els.panelCtl.hidden = false;
        els.panelRange.min = s.v.min;
        els.panelRange.max = s.v.max;
        els.panelRange.step = s.v.step;
        value = (value >= s.v.min && value <= s.v.max) ? value : s.v.def;
        els.panelRange.value = value;
        els.panelLabel.textContent = s.v.label;
        els.panelValue.textContent = fmt(value) + (s.v.unit ? ' ' + s.v.unit : '');
        els.panelRange.oninput = () => {
          value = parseFloat(els.panelRange.value);
          els.panelValue.textContent = fmt(value) + (s.v.unit ? ' ' + s.v.unit : '');
        };
      } else {
        els.panelCtl.hidden = true;
      }
      els.panelOk.textContent = (step === rec.steps.length - 1) ? 'خلّص التحضير' : 'تأكيد الخطوة';
    }

    function open(st) {
      openStation = st;
      step = progress[st.id] || 0;
      const rec = RAW.recipes[st.id];
      if (step >= rec.steps.length) step = 0;
      value = rec.steps[step].v ? rec.steps[step].v.def : 0;
      els.panel.classList.add('on');
      render();
    }
    function close() {
      if (!openStation) return;
      openStation = null;
      els.panel.classList.remove('on');
    }
    function isOpen() { return !!openStation; }
    function current() { return openStation; }

    function confirmStep() {
      if (!openStation) return;
      const rec = RAW.recipes[openStation.id];
      const s = rec.steps[step];
      if (s.v) {
        const okRange = s.v.ok;
        if (value < okRange[0] || value > okRange[1]) {
          els.panelMsg.textContent = 'برّه المدى الصح: من ' + okRange[0] + ' لـ' + okRange[1] +
            (s.v.unit ? ' ' + s.v.unit : '') + '. ظبّطها وجرّب تاني.';
          els.panelMsg.className = 'raw-msg bad';
          if (h.onError) h.onError(openStation);
          return;
        }
      }
      if (h.onConfirm) h.onConfirm(openStation, s, value);
      if (step < rec.steps.length - 1) {
        step++;
        progress[openStation.id] = step;
        const nxt = rec.steps[step];
        value = nxt.v ? nxt.v.def : 0;
        render();
        els.panelMsg.textContent = 'تمام — عدّينا للخطوة اللي بعدها.';
        els.panelMsg.className = 'raw-msg good';
      } else {
        progress[openStation.id] = 0;
        els.panelMsg.textContent = 'تمام! ' + openStation.label + ' خلصت صح.';
        els.panelMsg.className = 'raw-msg good';
        if (h.onDone) h.onDone(openStation);
      }
    }

    els.panelOk.addEventListener('click', confirmStep);
    els.panelClose.addEventListener('click', () => { close(); if (h.onClose) h.onClose(); });

    /* ---------- زرار الصوت ---------- */
    if (els.sound) {
      els.sound.addEventListener('click', () => {
        const on = !RAW.sfx.on;
        RAW.sfx.on = on;
        els.sound.classList.toggle('off', !on);
        els.sound.setAttribute('aria-pressed', String(on));
        els.sound.title = on ? 'الصوت شغّال' : 'الصوت مقفول';
        if (on) RAW.sfx.click();
      });
    }

    return { setNear, say, open, close, isOpen, current, markAt, render };
  };
  RAW.ui.STOCK = STOCK;
})(window);
