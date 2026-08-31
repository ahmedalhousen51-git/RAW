/* ==========================================================================
   RAW — ناقل الأحداث المركزي

   بيستبدل الـcallbacks المتناثرة: أي مكوّن بيبعت حدث، وأي مكوّن تاني بيسمعه،
   من غير ما يعرفوا بعض. الاشتراك بيرجّع دالة إلغاء عشان التنظيف يبقى سهل.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const core = RAW.core = RAW.core || {};
  const log = () => core.logger;

  class EventBus {
    constructor() {
      /** @type {Map<string, Array<{cb: Function, ctx: any, once: boolean}>>} */
      this._listeners = new Map();
    }

    /**
     * اشتراك في حدث.
     * @param {string} event اسم الحدث (من RAW.core.EVENTS)
     * @param {Function} cb الدالة اللي هتتنده
     * @param {any} [ctx] السياق (this) جوه الدالة
     * @returns {Function} دالة إلغاء الاشتراك
     */
    on(event, cb, ctx) {
      if (typeof cb !== 'function') throw new TypeError('EventBus.on: callback لازم يكون دالة');
      if (!this._listeners.has(event)) this._listeners.set(event, []);
      const entry = { cb: cb, ctx: ctx || null, once: false };
      this._listeners.get(event).push(entry);
      return () => this.off(event, cb, ctx);
    }

    /** زي on بس بتتنفّذ مرة واحدة وبعدين بتلغي نفسها */
    once(event, cb, ctx) {
      const off = this.on(event, function (data) {
        off();
        cb.call(ctx || null, data);
      }, ctx);
      return off;
    }

    /** إلغاء اشتراك محدّد */
    off(event, cb, ctx) {
      const list = this._listeners.get(event);
      if (!list) return false;
      let removed = false;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].cb === cb && list[i].ctx === (ctx || null)) { list.splice(i, 1); removed = true; }
      }
      if (!list.length) this._listeners.delete(event);
      return removed;
    }

    /**
     * بثّ حدث. خطأ في أي مستمع مبيوقفش الباقيين.
     * @param {string} event
     * @param {*} [data]
     */
    emit(event, data) {
      const list = this._listeners.get(event);
      if (!list || !list.length) return 0;
      // نسخة عشان لو مستمع لغى نفسه أثناء التنفيذ
      const copy = list.slice();
      let n = 0;
      for (let i = 0; i < copy.length; i++) {
        try { copy[i].cb.call(copy[i].ctx, data); n++; }
        catch (e) { log() && log().error('EventBus: خطأ في مستمع "' + event + '"', e); }
      }
      return n;
    }

    /** عدد المستمعين لحدث (للتشخيص) */
    listenerCount(event) {
      return event == null
        ? Array.from(this._listeners.values()).reduce((a, l) => a + l.length, 0)
        : (this._listeners.get(event) || []).length;
    }

    /** أسماء الأحداث اللي ليها مستمعين */
    events() { return Array.from(this._listeners.keys()); }

    /** تنظيف كامل (أو حدث واحد) */
    clear(event) {
      if (event) this._listeners.delete(event);
      else this._listeners.clear();
    }
  }

  core.EventBus = EventBus;
  /** النسخة المشتركة اللي المشروع كله بيستعملها */
  core.bus = new EventBus();
})(window);
