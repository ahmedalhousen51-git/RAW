/* ==========================================================================
   RAW — الإعدادات المركزية

   كل الأرقام السحرية المتناثرة مكانها هنا. أي تعديل على الأداء أو الفيزياء
   بيتم من ملف واحد بدل ما تدوّر في الكود.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};
  const core = RAW.core = RAW.core || {};

  core.CONFIG = {
    version: '1.1.6',

    /** مستويات الجودة — القيم دي بتتطابق مع QUALITY في raw-kitchen.js */
    quality: {
      high: { pixelRatio: 2.0,  shadowMapSize: 2048, post: 'high', transmission: true,  particles: 1.0 },
      mid:  { pixelRatio: 1.6,  shadowMapSize: 1024, post: 'mid',  transmission: false, particles: 0.6 },
      low:  { pixelRatio: 1.15, shadowMapSize: 512,  post: 'off',  transmission: false, particles: 0.3 }
    },

    /** حدود الأداء */
    performance: {
      pixelBudgetMobile: 1400000,
      pixelBudgetDesktop: 4200000,
      warmupSeconds: 4,          // مبنقيسش الأداء قبلها (تحميل التكستشرات)
      fpsThreshold: 45,
      firstCheckSeconds: 2.2,
      checkInterval: 3.5,
      envRefreshSeconds: 8
    },

    /** فيزياء المشروب */
    drink: {
      maxLevel: 0.92,
      roomTemp: 22,
      coolTau: 95,               // ثابت زمني للتبريد بالثواني
      coolTauWithIce: 26,
      cubeGrams: 17
    },

    /** سلوك الماكينات */
    machines: {
      timeScale: 0.36,           // ثانية ماكينة = ٠.٣٦ ثانية حقيقية
      autoCloseDelay: 2.8,
      espressoTarget: 30,
      espressoTolerance: 2
    },

    /** الكاميرا */
    camera: {
      orbitHeight: 1.35,
      distMin: 3.2,
      distMax: 16,
      focusDamping: 2,
      orbitDamping: 7
    },

    /** التفاعل اليدوي */
    hands: { reach: 1.75, shakeSeconds: 3.4, cleanSeconds: 2.2 }
  };
})(window);
