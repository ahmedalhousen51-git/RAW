/* ==========================================================================
   RAW — مواصفات لوحات تحكم الماكينات

   كل محطة ليها لوحة زي لوحة الماكينة الحقيقية: شاشة LCD، لمبات LED، مفاتيح
   وشرايط ضبط، وزرار تشغيل بيشتغل بعدّاد تنازلي. المحرك (raw-console-ui.js)
   بيقرأ الوصف ده ويبني الواجهة، فزيادة ماكينة جديدة = إضافة إدخال هنا بس.

   أنواع التحكّمات:
     slider  — شريط بقيمة رقمية ومدى صح [ok]
     choice  — أزرار اختيار (نكهات مثلاً)
     counter — عدّاد ضغطات ليه هدف
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  RAW.consoles = {

    /* ---------------- ☕ الإسبريسو ---------------- */
    espresso: {
      icon: '☕', model: 'RAW ESPRESSO · M32', sub: 'ماكينة الإسبريسو',
      power: true,
      readouts: [
        { k: 'temp', icon: '🔥', unit: '°C', digits: 1 },
        { k: 'pressure', icon: '💨', unit: 'bar', digits: 1 },
        { k: 'time', icon: '⏱', unit: 's', digits: 0 },
        { k: 'shots', icon: '☕', unit: '', digits: 0, counter: true }
      ],
      controls: [
        { k: 'temp', type: 'slider', label: 'ضبط الحرارة', min: 85, max: 95, step: 0.5,
          def: 92, ok: [90, 94], unit: '°C',
          low: 'الحرارة واطية — الشوت هيطلع حامض.',
          high: 'الحرارة عالية — البن هيتحرق.' },
        { k: 'pressure', type: 'slider', label: 'ضبط الضغط', min: 8, max: 12, step: 0.1,
          def: 9.2, ok: [8.8, 9.6], unit: 'bar',
          low: 'الضغط ضعيف — المية هتعدّي بسرعة.',
          high: 'الضغط عالي — الشوت هيبقى مخنوق.' },
        { k: 'time', type: 'slider', label: 'وقت الاستخلاص', min: 20, max: 38, step: 1,
          def: 28, ok: [25, 30], unit: 'ث',
          low: 'زمن الاستخلاص قصير جداً!',
          high: 'استخلاص طويل — الطعم هيمرّ.' }
      ],
      gauge: { k: 'water', label: 'مستوى الماء', drain: 6 },
      action: { label: '☕ استخلاص الشوت', busy: 'بتسحب الشوت…', secs: 'time', sound: 'espresso' },
      fx: { act: 'pour', amount: 0.17, color: 0x2C1A11, tempFrom: 'temp', tempOffset: -4 },
      care: { every: 5, label: '🧼 تنظيف الرأس', note: 'الرأس محتاجة تنظيف بعد ٥ شوتات' },
      voice: {
        hint: 'ظبّط الحرارة ٩٢ والضغط ٩.٢ يبقى استخلاص نضيف.',
        run: 'استنى… الكريما بتتكوّن.',
        great: 'شوت نضيف! كريما لونها بندقي ظابطة.',
        ok: 'ماشي الحال، بس فيه حاجة محتاجة ظبط.',
        bad: 'الشوت ده مش هينفع — بصّي على اللي بره المدى.'
      }
    },

    /* ---------------- ⚙️ المطحنة ---------------- */
    grinder: {
      icon: '⚙️', model: 'RAW GRINDER · EK', sub: 'محطة طحن البن',
      power: true,
      readouts: [
        { k: 'dose', icon: '⚖️', unit: 'g', digits: 1 },
        { k: 'fine', icon: '🌀', unit: '', digits: 0 },
        { k: 'runs', icon: '🔁', unit: '', digits: 0, counter: true }
      ],
      controls: [
        { k: 'fine', type: 'slider', label: 'نعومة الطحن', min: 1, max: 10, step: 1,
          def: 5, ok: [4, 6], unit: '',
          low: 'الطحن ناعم أوي — هيخنق الفلتر.',
          high: 'الطحن خشن — المية هتعدّي من غير طعم.' },
        { k: 'dose', type: 'slider', label: 'الجرعة', min: 13, max: 23, step: 0.5,
          def: 18, ok: [17, 19], unit: 'جم',
          low: 'الجرعة قليلة — الشوت هيطلع خفيف.',
          high: 'الجرعة تقيلة — الفلتر مش هيسعها.' }
      ],
      action: { label: '⚙️ ابدأ الطحن', busy: 'بتطحن…', secs: 6, sound: 'grinder' },
      fx: { act: 'stir' },
      voice: {
        hint: 'للإسبريسو: نعومة ٥ وجرعة ١٨ جرام.',
        run: 'البن بينزل في الفلتر…',
        great: 'جرعة مظبوطة — سوّيها ودكّها.',
        ok: 'قريبة، بس ظبّطي رقم منهم.',
        bad: 'الطحن ده هيبوّظ الشوت — راجعي الأرقام.'
      }
    },

    /* ---------------- 🧪 السيرب ---------------- */
    syrup: {
      icon: '🧪', model: 'RAW SYRUP BAR · 1883', sub: 'محطة السيرب',
      power: false,
      readouts: [
        { k: 'pumps', icon: '🔻', unit: 'ضخة', digits: 0 },
        { k: 'ml', icon: '💧', unit: 'ml', digits: 0 }
      ],
      controls: [
        { k: 'flavor', type: 'choice', label: 'النكهة',
          options: [
            { v: 'vanilla', n: 'فانيلا', c: '#E8D9B8', col: 0xC9A96B },
            { v: 'caramel', n: 'كراميل', c: '#B87333', col: 0x9A5C27 },
            { v: 'hazelnut', n: 'بندق', c: '#8A5A3B', col: 0x6E4527 },
            { v: 'rose', n: 'ورد', c: '#D98A9E', col: 0xA84A62 }
          ], def: 'vanilla' },
        { k: 'pumps', type: 'counter', label: 'عدّاد الضخات', target: 2, max: 6,
          low: 'ضخة واحدة بس — الطعم مش هيبان.',
          high: 'ضخات كتير — الحلاوة هتغرق المشروب.' }
      ],
      action: { label: '🔻 اضخّ السيرب', busy: 'بتضخّ…', secs: 2, sound: 'syrup' },
      fx: { act: 'pour', per: 0.035, amountFrom: 'pumps', colorFrom: 'flavor', temp: 24 },
      voice: {
        hint: 'اختاري النكهة وادّي ضختين — ده الهدف.',
        run: 'السيرب نازل في الكوباية…',
        great: 'ضختين بالظبط — توازن حلو.',
        ok: 'الكمية قريبة من المضبوط.',
        bad: 'عدد الضخات بره المضبوط.'
      }
    },

    /* ---------------- 🥛 اللبن ---------------- */
    milk: {
      icon: '🥛', model: 'RAW STEAM WAND', sub: 'محطة اللبن',
      power: true,
      readouts: [
        { k: 'ml', icon: '🥛', unit: 'ml', digits: 0 },
        { k: 'heat', icon: '🌡', unit: '°C', digits: 0 },
        { k: 'foam', icon: '☁️', unit: '%', digits: 0 }
      ],
      controls: [
        { k: 'ml', type: 'slider', label: 'كمية اللبن', min: 80, max: 380, step: 10,
          def: 200, ok: [150, 250], unit: 'مل',
          low: 'لبن قليل — الإبريق هيلطش.',
          high: 'لبن كتير — مش هيدخل الكوباية.' },
        { k: 'heat', type: 'slider', label: 'حرارة التبخير', min: 50, max: 78, step: 1,
          def: 64, ok: [60, 68], unit: '°C',
          low: 'حرارة واطية — مفيش حلاوة طبيعية.',
          high: 'فوق ٦٨ اللبن بيتحرق ويبوظ.' },
        { k: 'foam', type: 'slider', label: 'نسبة الرغوة', min: 0, max: 100, step: 5,
          def: 35, ok: [25, 55], unit: '%',
          low: 'رغوة قليلة — اللاتيه هيبقى سايح.',
          high: 'رغوة كتير — ده كابتشينو مش لاتيه.' }
      ],
      action: { label: '💨 بخّر اللبن', busy: 'بتبخّر…', secs: 7, sound: 'milk' },
      fx: { act: 'pour', per: 0.0016, amountFrom: 'ml', color: 0xC79A6B, tempFrom: 'heat' },
      voice: {
        hint: '٢٠٠ مل على ٦٤ درجة، والرغوة حوالين ٣٥٪.',
        run: 'صوت التبخير لازم يبقى ناعم مش صفير.',
        great: 'لبن حريري — يستاهل لاتيه آرت.',
        ok: 'كويس، بس فيه رقم محتاج ظبط.',
        bad: 'اللبن ده اتحرق أو طلع سايح.'
      }
    },

    /* ---------------- 🧊 الثلج والخلط ---------------- */
    ice: {
      icon: '🧊', model: 'RAW ICE & BLEND', sub: 'محطة الثلج والخلط',
      power: true,
      readouts: [
        { k: 'cubes', icon: '🧊', unit: '', digits: 0 },
        { k: 'speed', icon: '🌀', unit: '', digits: 0 },
        { k: 'blend', icon: '⏱', unit: 's', digits: 0 }
      ],
      controls: [
        { k: 'cubes', type: 'slider', label: 'عدد المكعبات', min: 2, max: 14, step: 1,
          def: 7, ok: [5, 9], unit: '',
          low: 'تلج قليل — المشروب هيسخن بسرعة.',
          high: 'تلج كتير — هيميّع الطعم وهو بيدوب.' },
        { k: 'speed', type: 'slider', label: 'سرعة الخلط', min: 1, max: 10, step: 1,
          def: 6, ok: [5, 8], unit: '',
          low: 'سرعة واطية — التلج مش هيتكسر.',
          high: 'سرعة عالية — هيبقى مية.' },
        { k: 'blend', type: 'slider', label: 'مدة الخلط', min: 5, max: 40, step: 1,
          def: 18, ok: [12, 25], unit: 'ث',
          low: 'خلط قصير — هيفضل قطع.',
          high: 'خلط طويل — القوام هيروح.' }
      ],
      action: { label: '🧊 شغّل الخلاط', busy: 'بتخلط…', secs: 'blend', sound: 'ice' },
      fx: { act: 'ice', countFrom: 'cubes' },
      voice: {
        hint: '٧ مكعبات وسرعة ٦ لمدة ١٨ ثانية.',
        run: 'الشفرات بتلف — سيبيها تاخد وقتها.',
        great: 'قوام ناعم ومتماسك.',
        ok: 'قريب، بس القوام مش مثالي.',
        bad: 'الخلطة دي طلعت مية أو قطع.'
      }
    },

    /* ---------------- 🍵 الماتشا والشاي ---------------- */
    tea: {
      icon: '🍵', model: 'RAW MATCHA · TEA BAR', sub: 'محطة الماتشا والبوبا',
      power: false,
      readouts: [
        { k: 'angle', icon: '📐', unit: '°', digits: 0 },
        { k: 'whisk', icon: '⏱', unit: 's', digits: 0 },
        { k: 'water', icon: '🌡', unit: '°C', digits: 0 }
      ],
      controls: [
        { k: 'water', type: 'slider', label: 'حرارة المياه', min: 60, max: 95, step: 1,
          def: 75, ok: [70, 80], unit: '°C',
          low: 'مياه باردة — الماتشا مش هتدوب.',
          high: 'فوق ٨٠ الماتشا بتمرّ.' },
        { k: 'angle', type: 'slider', label: 'زاوية الخفق', min: 0, max: 90, step: 5,
          def: 45, ok: [35, 55], unit: '°',
          low: 'الزاوية واطية — الخفق مش هيرغّي.',
          high: 'زاوية عالية — هتنطّطي الماتشا بره.' },
        { k: 'whisk', type: 'slider', label: 'مدة الخفق', min: 10, max: 60, step: 5,
          def: 30, ok: [20, 40], unit: 'ث',
          low: 'خفق قصير — هيفضل تكتّل.',
          high: 'خفق طويل — الرغوة هتقع تاني.' }
      ],
      action: { label: '🍵 ابدأ الخفق', busy: 'بتخفقي…', secs: 'whisk', sound: 'tea' },
      fx: { act: 'pour', amount: 0.3, color: 0x6E8B3D, tempFrom: 'water' },
      voice: {
        hint: 'الزاوية المثالية ٤٥ درجة ومياه ٧٥.',
        run: 'حركة W مش دواير — كده الرغوة بتطلع.',
        great: 'رغوة ناعمة ولون أخضر فاتح — تمام.',
        ok: 'كويسة، بس الرغوة كان ممكن تبقى أنعم.',
        bad: 'الماتشا اتكتّلت — راجعي الزاوية والحرارة.'
      }
    },

    /* ---------------- 🔥 سخّان المياه ---------------- */
    brew: {
      icon: '🔥', model: 'RAW BOILER · 5L', sub: 'محطة سخان المياه',
      power: true,
      readouts: [
        { k: 'temp', icon: '🌡', unit: '°C', digits: 0 },
        { k: 'mins', icon: '⏱', unit: 'د', digits: 0 }
      ],
      controls: [
        { k: 'temp', type: 'slider', label: 'حرارة المياه', min: 78, max: 100, step: 1,
          def: 94, ok: [90, 96], unit: '°C',
          low: 'أقل من ٩٠ — الاستخلاص هيبقى ناقص.',
          high: 'مية بتغلي — هتحرق البن.' },
        { k: 'mins', type: 'slider', label: 'مدة التسخين', min: 1, max: 7, step: 1,
          def: 3, ok: [2, 4], unit: 'دقيقة',
          low: 'وقت قصير — الحرارة مش هتثبت.',
          high: 'تسخين طويل — المية هتفقد أكسجينها.' }
      ],
      gauge: { k: 'water', label: 'خزان المياه', drain: 8 },
      action: { label: '🔥 سخّن', busy: 'بتسخّن…', secs: 5, sound: 'brew' },
      fx: { act: 'pour', amount: 0.22, color: 0xC8A87A, tempFrom: 'temp' },
      voice: {
        hint: '٩٤ درجة لمدة ٣ دقايق — ده المضبوط.',
        run: 'المية بتقرب من درجتها…',
        great: 'حرارة ثابتة — جاهزة للتحضير.',
        ok: 'ماشي، بس ظبّطي رقم منهم.',
        bad: 'الحرارة دي مش هتنفع للتحضير.'
      }
    }
  };
})(window);
