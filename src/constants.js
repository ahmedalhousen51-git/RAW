/* ==========================================================================
   RAW — الثوابت العامة (أسماء الأحداث ومفاتيح الحالة)

   ملاحظة على النمط: الملفات دي مكتوبة IIFE مش ES Modules، عشان الصفحة تفضل
   تشتغل بالدبل-كليك من `file://` (المتصفح بيمنع import من ملف محلي). نفس
   الفصل ونفس الـAPI — التحويل لـESM بعدين = شيل الغلاف وحطّ export.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const core = RAW.core = RAW.core || {};

  /** أسماء الأحداث — مكان واحد يمنع أخطاء الكتابة */
  core.EVENTS = {
    // دورة الحياة
    SCENE_READY:    'scene:ready',
    TICK:           'tick',
    RESIZE:         'resize',
    DESTROY:        'destroy',

    // الحالة
    STATE_CHANGE:   'state:change',
    STATE_RESET:    'state:reset',
    STATE_RESTORED: 'state:restored',

    // اللعب
    STATION_NEAR:   'station:near',
    STATION_OPEN:   'station:open',
    STATION_CLOSE:  'station:close',
    MACHINE_RUN:    'machine:run',
    MACHINE_DONE:   'machine:done',
    DRINK_CHANGE:   'drink:change',
    CHARACTER_POSE: 'character:pose',
    TOOL_GRAB:      'tool:grab',
    TOOL_DROP:      'tool:drop',

    // الواجهة
    UI_TOAST:       'ui:toast',
    UI_SAY:         'ui:say',
    QUALITY_CHANGE: 'quality:change'
  };
})(window);
