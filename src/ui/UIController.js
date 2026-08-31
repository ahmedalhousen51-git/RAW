/* ==========================================================================
   RAW — مدير الواجهة

   بيملك: لوحة المخزون · شريط اسم المحطة · فقاعة نورة · الإشعارات · شريط
   الكوباية · أزرار الإعدادات (صوت/جودة/وقت/كاميرا/إغلاق/مشاهدة) · الاختصارات.

   بيتكلّم مع اللعبة بطريقتين:
     · مباشرة عبر `api` (المشهد) للحاجات البسيطة: جودة، وقت، كاميرا، مشي.
     · وبأحداث على الناقل للحاجات اللي محتاجة لوحات تانية:
       `ui:close-all` · `ui:serve` · `ui:pick` · `ui:cinema`
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const ui = RAW.ui = RAW.ui || {};
  const H = () => ui.helpers;
  const core = () => RAW.core || {};
  const bus = () => core().bus;
  const store = () => core().state;
  const log = () => core().logger;

  /** المخزون: كل صنف مربوط بالمحطة اللي بتقدّمه */
  const STOCK = [
    { k: 'espresso', n: 'إسبريسو',     c: '#3B2318', at: 'espresso' },
    { k: 'beans',    n: 'بن للطحن',    c: '#5C3A22', at: 'grinder'  },
    { k: 'syrup',    n: 'سيرب 1883',   c: '#C2334D', at: 'syrup'    },
    { k: 'milk',     n: 'لبن',         c: '#EADFC8', at: 'milk'     },
    { k: 'ice',      n: 'تلج وخلط',    c: '#BFE0F2', at: 'ice'      },
    { k: 'tea',      n: 'ماتشا وبوبا', c: '#8A6242', at: 'tea'      }
  ];
  const QNAMES = { high: 'عالية', mid: 'متوسطة', low: 'خفيفة' };
  const QORDER = ['high', 'mid', 'low'];

  class UIController {
    /**
     * @param {Object} els عناصر الـDOM الأساسية
     * @param {Object} [opts] { onPick, onServe, onCloseAll, onCinema }
     */
    constructor(els, opts) {
      this.els = els || {};
      this.opts = opts || {};
      this._api = null;
      this._offs = [];          // دوال إلغاء الاشتراك
      this._stockBtns = [];
      this._sayTimer = 0;
      this._cupTimer = 0;
      this._ready = false;
    }

    /** تهيئة: بناء الأزرار وربط الأحداث */
    init() {
      if (this._ready) return this;
      if (!this.els.stock) { log() && log().warn('UIController: عنصر المخزون ناقص'); return this; }
      this._buildStock();
      this._bindPanel();
      this._bindShortcuts();
      this._bindBus();
      this._ready = true;
      log() && log().info('UIController جاهز');
      bus() && bus().emit('ui:ready', this);
      return this;
    }

    /** ربط المشهد بعد ما يتحمّل */
    attach(api) {
      this._api = api;
      this._syncSettings();
      this._startCupLoop();
      return this;
    }

    /* ---------------- المخزون ---------------- */
    _buildStock() {
      const h = H();
      STOCK.forEach(s => {
        const b = h.el('button', '', '<i style="--c:' + s.c + '"></i><span>' + s.n + '</span>');
        b.type = 'button';
        b.dataset.go = s.at;
        b.addEventListener('click', () => this._pick(s.at));
        this.els.stock.appendChild(b);
        this._stockBtns.push(b);
      });
    }

    _pick(stationId) {
      RAW.sfx && RAW.sfx.click();
      if (this.opts.onPick) this.opts.onPick(stationId);
      else if (this._api) this._api.goTo(stationId);
      bus() && bus().emit('ui:pick', stationId);
    }

    /** تعليم المحطة اللي هي واقفة عندها */
    markAt(id) {
      this._stockBtns.forEach(b => b.classList.toggle('at', b.dataset.go === id));
    }

    /* ---------------- شريط اسم المحطة ---------------- */
    setNear(st, hint) {
      this.markAt(st ? st.id : null);
      const tag = this.els.tag;
      if (!tag) return;
      if (!st) { tag.classList.remove('on'); return; }
      tag.innerHTML = st.label + '<small>' + (hint || 'دوس على المحطة عشان تشتغل') + '</small>';
      tag.classList.add('on');
    }

    /** رسالة سريعة على شريط المحطة (مش فقاعة نورة) */
    tagSay(st, msg) {
      if (!st || !this.els.tag) return;
      this.els.tag.innerHTML = st.label + '<small>' + msg + '</small>';
      this.els.tag.classList.add('on');
    }

    /* ---------------- نورة ---------------- */
    /** @param {string} line @param {'calm'|'happy'|'oops'} [mood] */
    say(line, mood) {
      const nora = this.els.nora, txt = this.els.noraText;
      if (!nora || !txt) return;
      clearTimeout(this._sayTimer);
      nora.classList.add('on');
      txt.textContent = line;
      nora.dataset.mood = mood || 'calm';
      // بتختفي بعد ٥ ثواني — إلا لو جت رسالة جديدة
      this._sayTimer = setTimeout(() => {
        if (txt.textContent === line) nora.classList.remove('on');
      }, 5000);
    }
    hideSay() { if (this.els.nora) this.els.nora.classList.remove('on'); }

    /* ---------------- الإشعارات ---------------- */
    toast(msg, kind, opts) { return H().toast(this.els.toasts, msg, kind, opts); }

    /* ---------------- شريط الكوباية ---------------- */
    _startCupLoop() {
      clearInterval(this._cupTimer);
      const box = H().byId('cup');
      const serveBtn = H().byId('serveBtn');
      if (!box || !this._api) return;
      this._cupTimer = setInterval(() => {
        const d = this._api.drink();
        const has = d.level > 0.01 || d.ice > 0;
        box.hidden = !has;
        if (has) {
          H().byId('cupTemp').textContent = d.temp + '°م';
          H().byId('cupFill').textContent = Math.round(d.level * 100) + '%';
          H().byId('cupIce').textContent = d.ice ? d.ice + ' تلج' : 'من غير تلج';
        }
        if (serveBtn) serveBtn.hidden = !(d.level >= 0.15 && (this.opts.canServe ? this.opts.canServe() : true));
        store() && store().patch('drink', d);
        // لو القياس التلقائي نزّل الجودة، الزرار بيوري الوضع الجديد
        const q = this._api.quality();
        if (q !== this._lastQ) { this._lastQ = q; this._paintQuality(q); }
      }, 500);
    }

    /** شارة المستوى والإتقان */
    updateRank(levelName, mastery) {
      const el = H().byId('rank');
      if (el) el.textContent = levelName + ' · إتقان ' + mastery + '٪';
    }

    /* ---------------- أزرار اللوحة ---------------- */
    _bindPanel() {
      const h = H();
      const on = (id, ev, fn) => {
        const el = h.byId(id);
        if (el) el.addEventListener(ev, fn);
        return el;
      };

      // طيّ/فتح المخزون
      on('stockToggle', 'click', () => {
        const panel = document.querySelector('.raw-stock');
        const folded = panel.classList.toggle('folded');
        h.byId('stockToggle').setAttribute('aria-expanded', String(!folded));
        RAW.sfx && RAW.sfx.click();
      });

      // الصوت
      on('sound', 'click', () => {
        const next = !RAW.sfx.on;
        RAW.sfx.on = next;
        RAW.sfx.ambience(next);
        this._paintSound(next);
        store() && store().patch('settings', { soundOn: next });
        if (next) RAW.sfx.click();
      });

      // الجودة
      on('quality', 'click', () => {
        if (!this._api) return;
        RAW.sfx && RAW.sfx.click();
        const next = QORDER[(QORDER.indexOf(this._api.quality()) + 1) % QORDER.length];
        this._paintQuality(this._api.setQuality(next));
      });

      // وقت اليوم
      on('time', 'click', () => {
        if (!this._api) return;
        RAW.sfx && RAW.sfx.click();
        h.byId('time').textContent = 'الوقت: ' + this._api.nextTime();
        store() && store().patch('settings', { timeOfDay: this._api.timeKey() });
      });

      // رجوع زاوية الكاميرا
      on('resetCam', 'click', () => {
        if (this._api) this._api.resetView();
        RAW.sfx && RAW.sfx.click();
      });

      // إغلاق الكل
      on('closeAll', 'click', () => { this.closeAll(); RAW.sfx && RAW.sfx.click(); });

      // وضع المشاهدة
      on('cinema', 'click', () => this.cinema(true));
      on('cinemaBack', 'click', () => this.cinema(false));

      // تقديم المشروب
      on('serveBtn', 'click', () => {
        RAW.sfx && RAW.sfx.click();
        if (this.opts.onServe) this.opts.onServe();
        bus() && bus().emit('ui:serve');
      });

      // التعليمات بتختفي بعد أول تفاعل
      const seen = () => document.body.classList.add('seen-help');
      ['keydown', 'pointerdown'].forEach(ev => addEventListener(ev, seen, { once: true, passive: true }));
    }

    _paintSound(on) {
      const b = H().byId('sound');
      if (!b) return;
      b.textContent = on ? 'الصوت: شغّال' : 'الصوت: مقفول';
      b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', String(on));
    }
    _paintQuality(q) {
      const b = H().byId('quality');
      if (b) b.textContent = 'الجودة: ' + (QNAMES[q] || q);
    }

    /* ---------------- الإعدادات المحفوظة ---------------- */
    _syncSettings() {
      const S = store();
      if (!S || !this._api) return;
      S.restore();
      const cfg = S.get('settings') || {};
      if (cfg.quality && cfg.quality !== this._api.quality()) this._paintQuality(this._api.setQuality(cfg.quality));
      else this._paintQuality(this._api.quality());
      if (cfg.timeOfDay) H().byId('time').textContent = 'الوقت: ' + this._api.setTime(cfg.timeOfDay);
      else H().byId('time').textContent = 'الوقت: ' + this._api.timeName();
      if (cfg.soundOn === false && RAW.sfx.on) { RAW.sfx.on = false; this._paintSound(false); }
      // أي تغيير في الإعدادات بيتحفظ فوراً
      this._offs.push(bus().on(core().EVENTS.STATE_CHANGE, e => {
        if (e.path.indexOf('settings.') === 0) S.persist();
      }));
    }

    /* ---------------- أوضاع عامة ---------------- */
    /** وضع المشاهدة: بيخفي الواجهة كلها ومؤشرات المشهد */
    cinema(on) {
      document.body.classList.toggle('cinema', on);
      if (on) this.closeAll();
      if (this._api) this._api.setCinema(on);
      store() && store().patch('ui', { cinema: on });
      bus() && bus().emit('ui:cinema', on);
      RAW.sfx && RAW.sfx.click();
    }

    /** طلب إغلاق كل اللوحات (اللي عنده لوحة بيسمع الحدث) */
    closeAll() {
      this.hideSay();
      if (this.opts.onCloseAll) this.opts.onCloseAll();
      bus() && bus().emit('ui:close-all');
    }

    /** حالة اللوحة المفتوحة — بتتحكم في تخطيط الواجهة */
    setPaneled(on) {
      const wrap = H().byId('wrap');
      if (wrap) wrap.classList.toggle('focus', on);
      store() && store().patch('ui', { paneled: on, hudOpen: on });
    }

    /* ---------------- الاختصارات ---------------- */
    _bindShortcuts() {
      this._onKey = e => {
        if (e.repeat) return;
        if (e.code === 'KeyH') this.cinema(!document.body.classList.contains('cinema'));
        else if (e.code === 'KeyM' && this._api) {
          const r = this._api.pourMilk();
          if (!r.ok) this.toast(r.why, 'warn');
        } else if (e.code === 'Escape') {
          if (document.body.classList.contains('cinema')) this.cinema(false);
          else this.closeAll();
        }
      };
      addEventListener('keydown', this._onKey);
    }

    /* ---------------- ربط الناقل ---------------- */
    _bindBus() {
      const B = bus();
      if (!B) return;
      const E = core().EVENTS;
      // المحطة القريبة بتتعرض تلقائياً — من غير ما index.html يتدخّل
      this._offs.push(B.on(E.STATION_NEAR, st => {
        this.setNear(st, st ? 'دوس على الماكينة أو اضغط E' : '');
      }));
    }

    /* ---------------- تنظيف ---------------- */
    dispose() {
      this._offs.forEach(off => { try { off(); } catch (e) {} });
      this._offs = [];
      clearTimeout(this._sayTimer);
      clearInterval(this._cupTimer);
      removeEventListener('keydown', this._onKey);
      this._ready = false;
      log() && log().debug('UIController: اتنضّف');
    }
  }

  ui.UIController = UIController;
  ui.STOCK = STOCK;
})(window);
