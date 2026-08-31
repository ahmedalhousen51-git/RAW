/* ==========================================================================
   RAW — إدارة الحالة المركزية

   مصدر واحد للحقيقة. أي تغيير بيتبثّ على الناقل، فالواجهة بتتحدّث لوحدها بدل
   ما كل مكوّن ينده على التاني. الحفظ بيشمل الإعدادات بس — الحالة اللحظية
   (مكان الشخصية، تشغيل الماكينة) مالهاش لازمة تتخزّن.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const core = RAW.core = RAW.core || {};
  const KEY = 'raw.state.v1';

  /** الحالة الافتراضية */
  function blank() {
    return {
      // المشهد
      ready: false,
      // المحطات
      currentStation: null,          // id أو null
      machineRun: null,              // { id, k, values }
      // الكوباية
      drink: { level: 0, temp: 22, ice: 0, contents: [] },
      character: { pose: 'idle', mood: 'calm' },
      // الأدوات
      heldTool: null,                // id أو null
      nearTool: null,
      // الواجهة
      ui: { hudOpen: false, serveOpen: false, cinema: false, paneled: false },
      // الإعدادات (دي اللي بتتحفظ)
      settings: { quality: 'high', soundOn: true, timeOfDay: null }
    };
  }

  class StateManager {
    constructor(bus) {
      this._bus = bus;
      this._state = blank();
      this._storageOK = true;
    }

    /** الحالة كاملة — للقراءة (متغيّرش فيها مباشرة، استعمل set) */
    get state() { return this._state; }

    /**
     * قراءة قيمة بمسار: `get('drink.level')`
     * @param {string} path
     */
    get(path) {
      const parts = String(path).split('.');
      let cur = this._state;
      for (let i = 0; i < parts.length; i++) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[parts[i]];
      }
      return cur;
    }

    /**
     * كتابة قيمة بمسار مع بثّ التغيير. المسار الغلط بيتسجّل ومبيكسرش حاجة.
     * @param {string} path
     * @param {*} value
     * @returns {boolean} اتغيّرت فعلاً؟
     */
    set(path, value) {
      const parts = String(path).split('.');
      let cur = this._state;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
          core.logger && core.logger.warn('StateManager: مسار مش موجود — ' + path);
          return false;
        }
        cur = cur[parts[i]];
      }
      const key = parts[parts.length - 1];
      const old = cur[key];
      if (old === value) return false;
      cur[key] = value;
      this._bus.emit(core.EVENTS.STATE_CHANGE, { path: path, value: value, old: old });
      return true;
    }

    /** كتابة مجموعة قيم مرة واحدة: `patch('drink', {level: .3, temp: 60})` */
    patch(path, obj) {
      let changed = false;
      Object.keys(obj || {}).forEach(k => {
        if (this.set(path ? path + '.' + k : k, obj[k])) changed = true;
      });
      return changed;
    }

    /** رجوع للحالة الافتراضية (الإعدادات المحفوظة بتفضل) */
    reset(keepSettings) {
      const settings = keepSettings ? this._state.settings : null;
      this._state = blank();
      if (settings) this._state.settings = settings;
      this._bus.emit(core.EVENTS.STATE_RESET, this._state);
    }

    /** حفظ الإعدادات بس */
    persist() {
      if (!this._storageOK) return false;
      try {
        localStorage.setItem(KEY, JSON.stringify(this._state.settings));
        return true;
      } catch (e) {
        this._storageOK = false;
        core.logger && core.logger.warn('StateManager: التخزين المحلي مش متاح');
        return false;
      }
    }

    /** استرجاع الإعدادات المحفوظة */
    restore() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return false;
        Object.assign(this._state.settings, JSON.parse(raw));
        this._bus.emit(core.EVENTS.STATE_RESTORED, this._state.settings);
        return true;
      } catch (e) {
        this._storageOK = false;
        return false;
      }
    }

    /** نسخة للتشخيص */
    snapshot() { return JSON.parse(JSON.stringify(this._state)); }
  }

  core.StateManager = StateManager;
  core.state = new StateManager(core.bus);
})(window);
