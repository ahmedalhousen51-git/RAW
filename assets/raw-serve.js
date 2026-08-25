/* ==========================================================================
   RAW — تقديم المشروب ومراجعته

   بعد ما تلفّ على المحطات وتجهّز الكوباية، بتقدّمها: اللعبة بتحسب درجة جودة
   من نتايج العمليات اللي عملتها، نورة بتراجع، وانت بتسمّي المشروب ويتحفظ في
   سجلّك.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const WORTH = { great: 100, ok: 72, bad: 42 };

  RAW.serve = function (host, hooks) {
    const h = hooks || {};
    let ops = [];                  // العمليات من آخر تقديم
    let open = false;

    const card = document.createElement('section');
    card.className = 'raw-serve';
    card.innerHTML =
      '<header><b>مراجعة المشروب</b>' +
      '<button type="button" class="raw-hud-x" data-x>✕</button></header>' +
      '<div class="score"><b data-score>—</b><small>درجة الجودة</small></div>' +
      '<ul class="lines" data-lines></ul>' +
      '<p class="review" data-review>—</p>' +
      '<label class="name">اسم المشروب' +
      '<input type="text" maxlength="28" placeholder="لاتيه الصبح مثلاً" data-name></label>' +
      '<button type="button" class="raw-run" data-go>قدّم واحفظ</button>';
    host.appendChild(card);

    const $ = sel => card.querySelector(sel);
    $('[data-x]').addEventListener('click', () => close());

    /** تسجيل عملية ماكينة خلصت */
    function add(stationId, rating) {
      ops.push({ id: stationId, rating: rating });
    }
    function count() { return ops.length; }
    function clear() { ops = []; }

    /* الدرجة: متوسط جودة العمليات + مكافأة على التنوّع */
    function score(drink) {
      if (!ops.length) return { total: 0, lines: ['مفيش عمليات لسه — قرّب من ماكينة وابدأ.'] };
      let sum = 0, great = 0;
      const seen = {};
      ops.forEach(o => {
        sum += WORTH[o.rating] || 50;
        if (o.rating === 'great') great++;
        seen[o.id] = 1;
      });
      const avg = sum / ops.length;
      const variety = Math.min(1, Object.keys(seen).length / 3);
      let total = Math.round(avg * 0.85 + variety * 15);

      const lines = [
        ops.length + ' عمليات · ' + great + ' منها ممتازة',
        'تنوّع: ' + Object.keys(seen).length + ' محطات'
      ];
      // كوباية شبه فاضية أو مليانة زيادة بتخصم
      if (drink) {
        if (drink.level < 0.25) { total -= 8; lines.push('الكوباية ناقصة — الزبون هيزعل'); }
        else if (drink.level > 0.85) { total -= 5; lines.push('مليانة لحد الحافة'); }
        else lines.push('مستوى الكوباية مظبوط');
        if (drink.temp > 70) lines.push('بتتقدّم سخنة (' + drink.temp + '°م)');
        else if (drink.temp < 12) lines.push('بتتقدّم مثلجة (' + drink.temp + '°م)');
        else if (drink.ice === 0 && drink.temp < 40) { total -= 6; lines.push('فترت قبل ما تتقدّم'); }
      }
      total = Math.max(5, Math.min(100, total));
      return { total: total, lines: lines };
    }

    function review(n) {
      if (n >= 92) return 'ده مشروب يتباع في القايمة — شغل نضيف من أول لآخر.';
      if (n >= 78) return 'حلو جداً! فيه لمسة صغيرة كمان وتبقى مثالية.';
      if (n >= 60) return 'مقبول، بس فيه خطوات محتاجة دقة أكتر.';
      return 'نعيدها تاني؟ ركّز على الأرقام اللي طلعت بره المدى.';
    }

    function show(drink) {
      const s = score(drink);
      $('[data-score]').textContent = s.total;
      $('[data-score]').className = s.total >= 85 ? 'good' : (s.total >= 60 ? 'warn' : 'bad');
      const ul = $('[data-lines]');
      ul.innerHTML = '';
      s.lines.forEach(l => {
        const li = document.createElement('li');
        li.textContent = l;
        ul.appendChild(li);
      });
      $('[data-review]').textContent = review(s.total);
      $('[data-name]').value = '';
      card.classList.add('on');
      open = true;
      if (h.onOpen) h.onOpen(s.total);

      $('[data-go]').onclick = () => {
        const name = ($('[data-name]').value || '').trim();
        const badges = RAW.progress ? RAW.progress.serve(s.total, name) : [];
        if (h.onServe) h.onServe(s.total, name, badges);
        clear();
        close();
      };
    }
    function close() {
      card.classList.remove('on');
      open = false;
      if (h.onClose) h.onClose();
    }

    return { add, clear, count, show, close, score, get isOpen() { return open; } };
  };
})(window);
