/* ==========================================================================
   RAW — المكوّنات والمكسات

   كل مكوّن ليه لون وطعم وقوام وحرارة، والماكينات اللي بتقبله. المزج بيحسب
   اللون الناتج والحلاوة والقوام والحرارة، ونورة بتقيّم التوازن وتقترح ناقص.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  /* الماكينات: ice = الخلاط · espresso · syrup · milk · tea (ماتشا) · brew */
  const CATS = [
    { id: 'fruit',  n: 'فواكه',   icon: '🍓' },
    { id: 'milk',   n: 'حليب',    icon: '🥛' },
    { id: 'syrup',  n: 'سيرب',    icon: '🧴' },
    { id: 'coffee', n: 'قهوة',    icon: '☕' },
    { id: 'matcha', n: 'ماتشا',   icon: '🍵' },
    { id: 'addin',  n: 'إضافات',  icon: '🧋' },
    { id: 'ice',    n: 'ثلج',     icon: '🧊' }
  ];

  /* c = اللون · sweet = حلاوة · body = قوام · temp = حرارة بتضيفها/تسحبها
     at = الماكينات اللي بتقبل المكوّن · bits = قطع بتعوم في المشروب */
  const ITEMS = [
    // 🍓 فواكه — للخلاط
    { id: 'strawberry', n: 'فراولة', cat: 'fruit', c: 0xD8465C, sweet: 2, body: 2, temp: -2, at: ['ice'] },
    { id: 'mango',      n: 'مانجو',  cat: 'fruit', c: 0xE9A23B, sweet: 3, body: 3, temp: -2, at: ['ice'] },
    { id: 'berry',      n: 'توت',    cat: 'fruit', c: 0x7B3E8F, sweet: 2, body: 2, temp: -2, at: ['ice'] },
    { id: 'banana',     n: 'موز',    cat: 'fruit', c: 0xE7D68A, sweet: 2, body: 4, temp: -1, at: ['ice'] },
    { id: 'pineapple',  n: 'أناناس', cat: 'fruit', c: 0xE8C64A, sweet: 3, body: 2, temp: -2, at: ['ice'] },

    // 🥛 حليب — للخلاط والماتشا واللبن
    { id: 'whole',   n: 'حليب كامل', cat: 'milk', c: 0xF7F0E2, sweet: 1, body: 3, temp: 0,  at: ['ice', 'milk', 'tea'] },
    { id: 'oat',     n: 'شوفان',     cat: 'milk', c: 0xE9DCC2, sweet: 1, body: 3, temp: 0,  at: ['ice', 'milk', 'tea'] },
    { id: 'almond',  n: 'لوز',       cat: 'milk', c: 0xEFE2CC, sweet: 1, body: 2, temp: 0,  at: ['ice', 'milk', 'tea'] },
    { id: 'coconut', n: 'جوز هند',   cat: 'milk', c: 0xF6F3EA, sweet: 2, body: 3, temp: 0,  at: ['ice', 'milk', 'tea'] },
    { id: 'conden',  n: 'مكثف',      cat: 'milk', c: 0xEED9A8, sweet: 4, body: 4, temp: 0,  at: ['ice', 'milk', 'tea'] },

    // 🧴 سيرب — لمحطة السيرب وكل حاجة
    { id: 'vanilla',  n: 'فانيلا',  cat: 'syrup', c: 0xC9A96B, sweet: 3, body: 1, temp: 0, at: ['syrup', 'ice', 'tea', 'milk'] },
    { id: 'caramel',  n: 'كراميل',  cat: 'syrup', c: 0x9A5C27, sweet: 4, body: 2, temp: 0, at: ['syrup', 'ice', 'tea', 'milk'] },
    { id: 'hazel',    n: 'بندق',    cat: 'syrup', c: 0x6E4527, sweet: 3, body: 1, temp: 0, at: ['syrup', 'ice', 'tea', 'milk'] },
    { id: 'cocosyr',  n: 'جوز هند', cat: 'syrup', c: 0xE4D9C0, sweet: 3, body: 1, temp: 0, at: ['syrup', 'ice', 'tea', 'milk'] },
    { id: 'lotus',    n: 'لوتس',    cat: 'syrup', c: 0xB2793C, sweet: 4, body: 2, temp: 0, at: ['syrup', 'ice', 'tea', 'milk'] },

    // ☕ قهوة — لماكينة الإسبريسو
    { id: 'espresso', n: 'إسبريسو',  cat: 'coffee', c: 0x2C1A11, sweet: 0, body: 2, temp: 24, at: ['espresso'] },
    { id: 'coldbrew', n: 'كولد برو', cat: 'coffee', c: 0x3E2416, sweet: 0, body: 1, temp: -6, at: ['espresso', 'ice'] },
    { id: 'turkish',  n: 'تركية',    cat: 'coffee', c: 0x241309, sweet: 1, body: 3, temp: 22, at: ['espresso', 'brew'] },

    // 🍵 ماتشا
    { id: 'matchapure', n: 'ماتشا عضوي', cat: 'matcha', c: 0x5E8B2A, sweet: 0, body: 2, temp: 0, at: ['tea'] },
    { id: 'matchaswt',  n: 'ماتشا حلو',  cat: 'matcha', c: 0x7FA83C, sweet: 3, body: 2, temp: 0, at: ['tea'] },

    // 🧋 إضافات — بتتحط في الكوباية وبتعوم
    { id: 'boba',    n: 'بوبا',       cat: 'addin', c: 0x1E1512, sweet: 3, body: 2, temp: 0, at: ['tea', 'ice'], bits: 'ball' },
    { id: 'jelly',   n: 'جيلي',       cat: 'addin', c: 0xD4A24C, sweet: 2, body: 1, temp: 0, at: ['tea', 'ice'], bits: 'cube' },
    { id: 'pudding', n: 'بودينغ',     cat: 'addin', c: 0xEFD79A, sweet: 3, body: 3, temp: 0, at: ['tea', 'ice'], bits: 'cube' },
    { id: 'aloe',    n: 'ألوفيرا',    cat: 'addin', c: 0xC9E6BE, sweet: 1, body: 1, temp: -1, at: ['tea', 'ice'], bits: 'cube' },
    { id: 'cheese',  n: 'رغوة جبنة',  cat: 'addin', c: 0xFAF0DC, sweet: 2, body: 4, temp: 0, at: ['tea', 'ice'], foam: 0.5 },

    // 🧊 ثلج
    { id: 'iceCube',  n: 'ثلج عادي',  cat: 'ice', c: 0xEAF6FF, sweet: 0, body: 0, temp: -14, at: ['ice'] },
    { id: 'iceCrush', n: 'ثلج مجروش', cat: 'ice', c: 0xF2FAFF, sweet: 0, body: 1, temp: -16, at: ['ice'] }
  ];

  const byId = {};
  ITEMS.forEach(i => (byId[i.id] = i));

  /** المكوّنات اللي الماكينة دي بتقبلها */
  function forMachine(m) { return ITEMS.filter(i => i.at.indexOf(m) > -1); }

  /** مزج: بيرجّع اللون والطعم والقوام والحرارة */
  function mix(ids) {
    const list = ids.map(id => byId[id]).filter(Boolean);
    if (!list.length) return null;
    let r = 0, g = 0, b = 0, sweet = 0, body = 0, temp = 0;
    list.forEach(it => {
      r += (it.c >> 16) & 255; g += (it.c >> 8) & 255; b += it.c & 255;
      sweet += it.sweet; body += it.body; temp += it.temp;
    });
    const n = list.length;
    return {
      color: (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n),
      sweet: sweet, body: body / n, temp: temp,
      bits: list.filter(i => i.bits),
      foam: list.reduce((a, i) => a + (i.foam || 0), 0),
      cats: list.map(i => i.cat),
      list: list
    };
  }

  /** تقييم التوازن — ده اللي نورة بتتكلّم منه */
  function judge(ids) {
    const m = mix(ids);
    if (!m) return { stars: 0, note: 'الماكينة فاضية — ضيف مكوّن الأول.' };
    const has = c => m.cats.indexOf(c) > -1;
    const base = has('coffee') || has('matcha') || has('fruit');
    const liquid = has('milk') || has('ice');
    let stars = 3;
    const notes = [];

    if (!base) { stars--; notes.push('ناقص أساس (قهوة أو ماتشا أو فاكهة)'); }
    if (!liquid) { stars--; notes.push('ناقص سايل — حليب أو ثلج'); }
    if (m.sweet > 8) { stars--; notes.push('حلاوة زيادة عن اللزوم'); }
    else if (m.sweet >= 2 && m.sweet <= 7) stars++;
    if (ids.length > 5) { stars--; notes.push('مكوّنات كتير — الطعم هيتلخبط'); }
    if (has('coffee') && has('matcha')) { stars--; notes.push('قهوة وماتشا مع بعض؟ جريئة'); }
    if (has('fruit') && has('coffee')) { stars--; notes.push('فاكهة مع قهوة — مزيج صعب'); }

    stars = Math.max(1, Math.min(5, stars));
    const good = ['محتاج شغل', 'ماشي', 'حلو', 'حلو جداً', 'تحفة!'][stars - 1];
    return { stars: stars, note: notes.length ? (good + ' — ' + notes[0]) : good, mix: m };
  }

  /** اقتراح نورة: إيه الناقص */
  function suggest(ids, machine) {
    const m = mix(ids);
    const has = c => m && m.cats.indexOf(c) > -1;
    if (!m) {
      if (machine === 'ice') return { id: 'strawberry', why: 'ابدأ بفاكهة — الفراولة أضمن حاجة.' };
      if (machine === 'tea') return { id: 'matchapure', why: 'ابدأ بمسحوق الماتشا.' };
      if (machine === 'espresso') return { id: 'espresso', why: 'حطّ جرعة إسبريسو الأول.' };
      return { id: 'vanilla', why: 'ابدأ بنكهة.' };
    }
    if (has('fruit') && !has('milk')) return { id: 'oat', why: 'حليب الشوفان بيدّي الفاكهة قوام حريري.' };
    if (has('coffee') && !has('milk')) return { id: 'whole', why: 'حليب كامل مع الإسبريسو = لاتيه.' };
    if (has('matcha') && m.sweet < 2) return { id: 'cocosyr', why: 'سيرب جوز الهند بيكسر مرارة الماتشا.' };
    if ((has('fruit') || has('coffee')) && !has('ice') && machine === 'ice')
      return { id: 'iceCube', why: 'تلج يخلّيه بارد ومتماسك.' };
    if (!m.bits.length && (machine === 'tea' || machine === 'ice'))
      return { id: 'boba', why: 'بوبا في القاع بتحوّله لمشروب كامل.' };
    return null;
  }

  /* وصفات جاهزة: لو المكوّنات طابقت، فيه مكافأة */
  const RECIPES = [
    { id: 'strawlatte', n: 'فراولة لاتيه', need: ['strawberry', 'whole', 'vanilla'], m: 'ice' },
    { id: 'matchalatte', n: 'ماتشا لاتيه', need: ['matchapure', 'oat', 'cocosyr'], m: 'tea' },
    { id: 'lotuscaramel', n: 'لوتس كراميل', need: ['espresso', 'whole', 'lotus'], m: 'espresso' },
    { id: 'mangoboba', n: 'مانجو بوبا', need: ['mango', 'coconut', 'boba'], m: 'ice' },
    { id: 'coldbrewtonic', n: 'كولد برو مثلج', need: ['coldbrew', 'iceCube'], m: 'ice' }
  ];
  /** بيرجّع الوصفة اللي المكوّنات طابقتها */
  function matchRecipe(ids) {
    return RECIPES.filter(r => r.need.every(x => ids.indexOf(x) > -1))[0] || null;
  }

  RAW.ingredients = { CATS, ITEMS, byId, forMachine, mix, judge, suggest, RECIPES, matchRecipe };
})(window);
