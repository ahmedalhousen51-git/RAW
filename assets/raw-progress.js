/* ==========================================================================
   RAW — تتبّع الإتقان: نتايج كل عملية، مستوى المهارة، والإنجازات

   بيتخزّن في localStorage، فنورة بتفتكر الجلسات اللي فاتت وبتغيّر كلامها
   حسب مستواك. لو التخزين مقفول (تصفّح خاص) بيشتغل عادي في الذاكرة بس.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const KEY = 'raw.progress.v1';
  const LEVELS = [
    { at: 0,  id: 'trainee', name: 'متدرّب' },
    { at: 6,  id: 'junior',  name: 'باريستا' },
    { at: 18, id: 'senior',  name: 'باريستا أول' },
    { at: 40, id: 'master',  name: 'معلّم' }
  ];

  const BADGES = [
    { id: 'first',    name: 'أول شوت',        test: s => s.runs >= 1 },
    { id: 'perfect3', name: 'تلات مرات ممتاز', test: s => s.great >= 3 },
    { id: 'clean10',  name: 'عشر عمليات نضيفة', test: s => s.great >= 10 },
    { id: 'allStations', name: 'لفّيت المطبخ كله', test: s => Object.keys(s.byStation).length >= 7 },
    { id: 'matcha',   name: 'رغوة مثالية',     test: s => (s.byStation.tea || {}).great >= 1 },
    { id: 'served5',  name: 'خمس مشروبات اتقدّمت', test: s => s.served >= 5 },
    { id: 'score90',  name: 'مشروب فوق ٩٠',    test: s => s.bestDrink >= 90 }
  ];

  function blank() {
    return { runs: 0, great: 0, ok: 0, bad: 0, served: 0, bestDrink: 0,
             byStation: {}, badges: [], sessions: 0, lastSeen: 0 };
  }

  /* التصفّح الخاص أو الذاكرة المليانة بيرموا استثناء — ساعتها بنكمّل في الذاكرة
     عشان الجلسة الحالية على الأقل تفضل شغّالة. */
  let memoryBackup = null;
  let storageOK = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return memoryBackup || blank();
      return Object.assign(blank(), JSON.parse(raw));
    } catch (e) {
      storageOK = false;
      return memoryBackup || blank();
    }
  }
  function save(s) {
    memoryBackup = s;
    if (!storageOK) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) {
      storageOK = false;
      console.warn('RAW: التخزين المحلي مش متاح — التقدّم هيفضل في الذاكرة بس');
    }
  }

  const stats = load();
  const returning = stats.runs > 0;          // شافها قبل كده؟
  stats.sessions++;
  stats.lastSeen = Date.now();
  save(stats);

  function level() {
    let cur = LEVELS[0];
    for (let i = 0; i < LEVELS.length; i++) if (stats.great >= LEVELS[i].at) cur = LEVELS[i];
    return cur;
  }

  /** تسجيل نتيجة عملية ماكينة: 'great' | 'ok' | 'bad' */
  function record(stationId, rating) {
    stats.runs++;
    stats[rating] = (stats[rating] || 0) + 1;
    const st = stats.byStation[stationId] || (stats.byStation[stationId] = { runs: 0, great: 0 });
    st.runs++;
    if (rating === 'great') st.great++;
    save(stats);
    return fresh();
  }

  /** تسجيل مشروب اتقدّم بدرجته */
  function serve(score, name) {
    stats.served++;
    if (score > stats.bestDrink) stats.bestDrink = score;
    if (!stats.drinks) stats.drinks = [];
    stats.drinks.unshift({ name: name || 'مشروب من غير اسم', score: score, at: Date.now() });
    stats.drinks = stats.drinks.slice(0, 12);
    save(stats);
    return fresh();
  }

  /** الإنجازات اللي اتفتحت دلوقتي بس (عشان نعرضها مرة واحدة) */
  function fresh() {
    const got = [];
    BADGES.forEach(b => {
      if (stats.badges.indexOf(b.id) > -1) return;
      if (b.test(stats)) { stats.badges.push(b.id); got.push(b); }
    });
    if (got.length) save(stats);
    return got;
  }

  /** نسبة الإتقان: كام في المية من العمليات طلعت ممتازة */
  function mastery() {
    return stats.runs ? Math.round((stats.great / stats.runs) * 100) : 0;
  }

  /** سطر ترحيب بيتغيّر حسب التاريخ */
  function greeting() {
    const lv = level();
    if (!returning) return 'أهلاً! أنا نورة. قرّب من أي ماكينة وأنا معاك خطوة بخطوة.';
    if (stats.great >= 18) return 'رجعت يا ' + lv.name + '! المطبخ بتاعك زي ما سبته.';
    if (stats.runs >= 6) return 'أهلاً بيك تاني — آخر مرة كان إتقانك ' + mastery() + '٪.';
    return 'أهلاً بيك تاني! نكمّل من حيث ما وقفنا.';
  }

  RAW.progress = {
    stats, returning, record, serve, mastery, greeting, badges: BADGES,
    get persistent() { return storageOK; },
    get level() { return level(); },
    reset() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      Object.assign(stats, blank());
    }
  };
})(window);
