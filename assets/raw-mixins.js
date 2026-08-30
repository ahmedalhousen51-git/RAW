/* ==========================================================================
   RAW — لوحة المكوّنات: بتظهر جوه لوحة الماكينة نفسها

   بتوري بس المكوّنات اللي الماكينة دي بتقبلها، وبتحتفظ بقايمة اللي اتحط في كل
   ماكينة، وبتخلّي نورة تقترح الناقص. السحب والإفلات شغّال على الشاشات الكبيرة،
   والدوسة شغّالة في كل مكان.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const MAX = { ice: 5, espresso: 3, tea: 4, milk: 3, syrup: 3, brew: 2, grinder: 1 };

  RAW.mixins = function (hooks) {
    const h = hooks || {};
    const bag = {};                    // machineId -> [itemId]
    // على الموبايل قسم المكوّنات بيبدأ مطوي عشان اللوحة تفضل صغيرة
    let cat = null, current = null, host = null;
    let shown = !(RAW.isTouch && RAW.isTouch());
    const ING = RAW.ingredients;

    const contents = m => (bag[m] || (bag[m] = []));
    const limit = m => MAX[m] || 4;

    function add(m, id) {
      const item = ING.byId[id];
      if (!item) return { ok: false, why: 'مكوّن مش معروف' };
      if (item.at.indexOf(m) < 0) return { ok: false, why: item.n + ' مش بتتحط في الماكينة دي' };
      const list = contents(m);
      if (list.length >= limit(m)) return { ok: false, why: 'الماكينة اتملت — امسح حاجة الأول' };
      if (list.indexOf(id) > -1) return { ok: false, why: item.n + ' متحطّة خلاص' };
      list.push(id);
      if (h.onAdd) h.onAdd(m, item, list.slice());
      render();
      return { ok: true, item: item };
    }
    function remove(m, id) {
      const list = contents(m);
      const i = list.indexOf(id);
      if (i < 0) return false;
      list.splice(i, 1);
      if (h.onChange) h.onChange(m, list.slice());
      render();
      return true;
    }
    function clear(m) {
      bag[m] = [];
      if (h.onChange) h.onChange(m, []);
      render();
    }

    /* ---------- البناء ---------- */
    const el = (tag, cls, html) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html != null) n.innerHTML = html;
      return n;
    };
    const hex = c => '#' + c.toString(16).padStart(6, '0');

    function render() {
      if (!host || !current) return;
      const m = current;
      const items = ING.forMachine(m);
      const cats = ING.CATS.filter(c => items.some(i => i.cat === c.id));
      if (!cats.some(c => c.id === cat)) cat = cats.length ? cats[0].id : null;
      const list = contents(m);

      host.innerHTML = '';

      // ترويسة القسم مع زرار إخفاء/إظهار
      const head = el('div', 'raw-mix-head');
      head.appendChild(el('span', 'ttl', '🧪 المكوّنات'));
      const tg = el('button', 'raw-mix-toggle', shown ? 'إخفاء ▴' : 'إظهار ▾');
      tg.type = 'button';
      tg.addEventListener('click', () => { shown = !shown; render(); if (RAW.sfx) RAW.sfx.click(); });
      head.appendChild(tg);
      host.appendChild(head);

      // اللي اتحط في الماكينة
      const bin = el('div', 'raw-bin');
      bin.appendChild(el('span', 'lab', 'في الماكينة (' + list.length + '/' + limit(m) + ')'));
      const strip = el('div', 'items');
      if (!list.length) strip.appendChild(el('i', 'empty', 'فاضية'));
      list.forEach(id => {
        const it = ING.byId[id];
        const chip = el('button', 'in', '<b style="background:' + hex(it.c) + '"></b>' + it.n + '<em>✕</em>');
        chip.type = 'button';
        chip.title = 'شيله';
        chip.addEventListener('click', () => { remove(m, id); if (RAW.sfx) RAW.sfx.click(); });
        strip.appendChild(chip);
      });
      bin.appendChild(strip);
      if (list.length) {
        const clr = el('button', 'clr', 'امسح الكل');
        clr.type = 'button';
        clr.addEventListener('click', () => { clear(m); if (RAW.sfx) RAW.sfx.click(); });
        bin.appendChild(clr);
      }
      host.appendChild(bin);

      if (!shown) return;                 // مطوية: بيفضل بس اللي في الماكينة

      // تبويبات الفئات — مع عدد المتاح في كل فئة
      const tabs = el('div', 'raw-cats');
      cats.forEach(c => {
        const n = items.filter(i => i.cat === c.id).length;
        const b = el('button', 'cat' + (c.id === cat ? ' on' : ''), c.icon + ' ' + c.n + ' (' + n + ')');
        b.type = 'button';
        b.addEventListener('click', () => { cat = c.id; render(); if (RAW.sfx) RAW.sfx.click(); });
        tabs.appendChild(b);
      });
      host.appendChild(tabs);

      // المكوّنات نفسها
      const grid = el('div', 'raw-ing');
      items.filter(i => i.cat === cat).forEach(it => {
        const inBag = list.indexOf(it.id) > -1;
        const b = el('button', 'ing' + (inBag ? ' on' : ''),
          '<b style="background:' + hex(it.c) + '"></b><span class="nm">' + it.n +
          '</span>' + (it.d ? '<small>' + it.d + '</small>' : ''));
        b.type = 'button';
        if (it.d) b.title = it.n + ' — ' + it.d;
        b.draggable = true;
        b.dataset.id = it.id;
        b.addEventListener('click', () => {
          const r = inBag ? (remove(m, it.id), { ok: true }) : add(m, it.id);
          if (RAW.sfx) (r.ok ? RAW.sfx.click() : RAW.sfx.error());
          if (!r.ok && h.onError) h.onError(r.why);
        });
        // السحب والإفلات: بتسحبه وترميه على الماكينة في المشهد
        b.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/raw-ing', it.id);
          e.dataTransfer.effectAllowed = 'copy';
        });
        grid.appendChild(b);
      });
      host.appendChild(grid);

      // اقتراح نورة
      const tip = ING.suggest(list, m);
      if (tip) {
        const t = el('button', 'raw-tip', '💡 ' + ING.byId[tip.id].n + ' — ' + tip.why);
        t.type = 'button';
        t.addEventListener('click', () => {
          const r = add(m, tip.id);
          if (RAW.sfx) (r.ok ? RAW.sfx.confirm() : RAW.sfx.error());
        });
        host.appendChild(t);
      }

      // وصفة اتطابقت؟
      const rec = ING.matchRecipe(list);
      if (rec) host.appendChild(el('div', 'raw-recipe', '⭐ وصفة «' + rec.n + '» اكتملت'));
    }

    /** بتتنده من لوحة الماكينة: بتبني المكوّنات جوه العنصر ده */
    function mount(container, machineId) {
      host = container;
      current = machineId;
      cat = null;
      render();
    }
    function unmount() { host = null; current = null; }

    return {
      mount, unmount, render, add, remove, clear, contents,
      limit, judge: ids => ING.judge(ids),
      get active() { return current; }
    };
  };
})(window);
