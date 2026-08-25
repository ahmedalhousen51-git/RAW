/* ==========================================================================
   RAW — الواجهة العامة: لوحة المخزون، اسم المحطة عند الاقتراب، وزرار الصوت.
   لوحة تحكّم الماكينة نفسها في raw-console-ui.js.
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
    { k: 'ice',      n: 'تلج وخلط',  c: '#BFE0F2', at: 'ice'      },
    { k: 'tea',      n: 'ماتشا وبوبا', c: '#8A6242', at: 'tea'    }
  ];

  RAW.ui = function (els, hooks) {
    const h = hooks || {};
    const buttons = [];

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

    /* اسم المحطة عند الاقتراب — بيختفي لما لوحة الماكينة تفتح */
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

    /* زرار الصوت */
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

    return { setNear, say, markAt };
  };
  RAW.ui.STOCK = STOCK;
})(window);
