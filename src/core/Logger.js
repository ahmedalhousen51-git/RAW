/* ==========================================================================
   RAW — نظام تسجيل موحّد

   بدل console.log المتناثر: مستويات، بادئة موحّدة، وإمكانية تقفيل كل حاجة
   في الإنتاج بسطر واحد (`RAW.core.logger.setLevel('NONE')`).
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const core = RAW.core = RAW.core || {};

  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
  let current = LEVELS.INFO;

  function out(level, args) {
    if (current > LEVELS[level]) return;
    const prefix = '[RAW:' + level + ']';
    const fn = { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }[level];
    (console[fn] || console.log).apply(console, [prefix].concat(args));
  }

  core.logger = {
    /** @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'NONE'} level */
    setLevel(level) { if (LEVELS[level] !== undefined) current = LEVELS[level]; return level; },
    get level() { return Object.keys(LEVELS).filter(k => LEVELS[k] === current)[0]; },
    debug() { out('DEBUG', [].slice.call(arguments)); },
    info()  { out('INFO',  [].slice.call(arguments)); },
    warn()  { out('WARN',  [].slice.call(arguments)); },
    error() { out('ERROR', [].slice.call(arguments)); }
  };
})(window);
