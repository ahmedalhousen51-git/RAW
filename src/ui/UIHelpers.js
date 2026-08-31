/* ==========================================================================
   RAW — دوال مساعدة للواجهة

   كل تعامل مع الـDOM بيعدّي من هنا: إنشاء عناصر، بحث، إشعارات. الهدف إن
   UIController يبقى منطق بس، من غير تفاصيل DOM متناثرة.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const ui = RAW.ui = RAW.ui || {};

  const helpers = {
    /**
     * إنشاء عنصر.
     * @param {string} tag @param {string} [cls] @param {string} [html] @param {Object} [attrs]
     * @returns {HTMLElement}
     */
    el(tag, cls, html, attrs) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html != null) n.innerHTML = html;
      if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
      return n;
    },

    /** عنصر بنص عادي (آمن من HTML injection) */
    text(tag, cls, txt) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      n.textContent = txt == null ? '' : txt;
      return n;
    },

    /** تبديل فئة، مع تأخير اختياري */
    toggleClass(node, cls, force, delay) {
      if (!node) return;
      if (delay) setTimeout(() => node.classList.toggle(cls, force), delay);
      else node.classList.toggle(cls, force);
    },

    find(parent, sel) { return parent ? parent.querySelector(sel) : null; },
    findAll(parent, sel) { return parent ? Array.prototype.slice.call(parent.querySelectorAll(sel)) : []; },
    byId(id) { return document.getElementById(id); },

    /**
     * إشعار: بيمنع التكرار المتتالي، بيطوّل المهم، وبيسيب ٣ على الأكتر.
     * @returns {HTMLElement|null}
     */
    toast(container, msg, kind, opts) {
      if (!container) return null;
      opts = opts || {};
      const now = performance.now();
      if (msg === helpers._lastToast && now - helpers._lastToastAt < 2500) return null;
      helpers._lastToast = msg;
      helpers._lastToastAt = now;

      const t = helpers.text('div', 'raw-toast ' + (kind || ''), msg);
      container.appendChild(t);
      while (container.children.length > 3) container.removeChild(container.firstChild);

      const long = opts.long != null ? opts.long
        : (kind === 'bad' || /⭐|إنجاز|اتقدّم|ممتاز/.test(msg));
      setTimeout(() => t.classList.add('in'), 10);
      setTimeout(() => {
        t.classList.remove('in');
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
      }, opts.duration || (long ? 4200 : 2300));
      return t;
    },
    _lastToast: '',
    _lastToastAt: 0
  };

  ui.helpers = helpers;
})(window);
