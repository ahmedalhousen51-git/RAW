/* ==========================================================================
   RAW — طبقة المعالجة البعدية (Post-processing) مكتوبة من الصفر

   من غير أي addons خارجية عشان ما نكسرش التشغيل من file:// — المشهد بيترسم في
   render target، وبعدين:
     ١) bright pass: بنسحب المناطق المضيئة بس (ربع الدقة)
     ٢) blur أفقي ورأسي عليها  →  bloom
     ٣) composite: المشهد + البلوم + vignette + حبيبات فيلم + كونتراست
   النتيجة: عمق وتباين وإحساس سينمائي بدل الصورة المسطّحة.
   ========================================================================== */
(function (global) {
  'use strict';
  const RAW = global.RAW = global.RAW || {};

  const VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  /* بنسحب اللي فوق عتبة معيّنة بس — الباقي أسود */
  const BRIGHT = `
    uniform sampler2D tDiffuse; uniform float threshold; uniform float softness;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(threshold, threshold + softness, l);
      gl_FragColor = vec4(c * k, 1.0);
    }
  `;

  /* تمويه بتسع عيّنات في اتجاه واحد */
  const BLUR = `
    uniform sampler2D tDiffuse; uniform vec2 dir;
    varying vec2 vUv;
    void main() {
      vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
      sum += texture2D(tDiffuse, vUv + dir * 1.3846) * 0.316216;
      sum += texture2D(tDiffuse, vUv - dir * 1.3846) * 0.316216;
      sum += texture2D(tDiffuse, vUv + dir * 3.2308) * 0.070270;
      sum += texture2D(tDiffuse, vUv - dir * 3.2308) * 0.070270;
      gl_FragColor = sum;
    }
  `;

  /* التركيب النهائي: بلوم + vignette + حبيبات + منحنى تباين خفيف */
  const COMPOSITE = `
    uniform sampler2D tDiffuse; uniform sampler2D tBloom;
    uniform float bloom; uniform float vignette; uniform float grain;
    uniform float contrast; uniform float saturation; uniform float time;
    varying vec2 vUv;
    float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 glow = texture2D(tBloom, vUv).rgb;
      vec3 c = base + glow * bloom;

      // تباين وتشبّع خفيف — بيدّي الأجسام حواف أوضح
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);

      // vignette: الأطراف بتغمق فالعين تروح للنص
      vec2 q = vUv - 0.5;
      float v = 1.0 - dot(q, q) * vignette;
      c *= clamp(v, 0.0, 1.0);

      // حبيبات فيلم خفيفة — بتكسر التسطيح الرقمي
      c += (rand(vUv + fract(time)) - 0.5) * grain;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `;

  RAW.post = function (THREE, renderer, scene, camera) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    const W = () => Math.max(2, Math.floor(size.x * pr));
    const H = () => Math.max(2, Math.floor(size.y * pr));

    const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                  type: THREE.UnsignedByteType };
    const rtScene = new THREE.WebGLRenderTarget(W(), H(), Object.assign({
      samples: renderer.capabilities.isWebGL2 ? 4 : 0
    }, opt));
    rtScene.texture.colorSpace = THREE.SRGBColorSpace;   // المشهد بيتخزّن جاهز للعرض
    const rtA = new THREE.WebGLRenderTarget(Math.floor(W() / 4), Math.floor(H() / 4), opt);
    const rtB = new THREE.WebGLRenderTarget(Math.floor(W() / 4), Math.floor(H() / 4), opt);
    rtA.texture.colorSpace = rtB.texture.colorSpace = THREE.SRGBColorSpace;

    // كاميرا ولوح كامل الشاشة للمرور على الشيدرات
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(quadGeo, null);
    quad.frustumCulled = false;
    quadScene.add(quad);

    const mBright = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BRIGHT,
      uniforms: { tDiffuse: { value: null }, threshold: { value: 0.82 }, softness: { value: 0.2 } },
      depthTest: false, depthWrite: false
    });
    const mBlur = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BLUR,
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false
    });
    const mComp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: COMPOSITE,
      uniforms: {
        tDiffuse: { value: null }, tBloom: { value: null },
        bloom: { value: 0.55 }, vignette: { value: 0.5 }, grain: { value: 0.022 },
        contrast: { value: 1.09 }, saturation: { value: 1.06 }, time: { value: 0 }
      },
      depthTest: false, depthWrite: false
    });

    let on = true, announced = false;

    function pass(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target || null);
      renderer.render(quadScene, quadCam);
    }

    function render(dt) {
      if (on && !announced) {
        announced = true;                 // أول فريم بعد ما الشيدرات تتجمّع
        console.info('RAW: post-processing جاهزة');
        if (window.RAWHud && window.RAWHud.toast) {
          setTimeout(() => window.RAWHud.toast('✨ التأثيرات السينمائية جاهزة', 'good'), 400);
        }
      }
      if (!on) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      // ١) المشهد
      renderer.setRenderTarget(rtScene);
      renderer.clear();
      renderer.render(scene, camera);

      // ٢) المناطق المضيئة
      mBright.uniforms.tDiffuse.value = rtScene.texture;
      pass(mBright, rtA);

      // ٣) تمويه أفقي ثم رأسي
      mBlur.uniforms.tDiffuse.value = rtA.texture;
      mBlur.uniforms.dir.value.set(1 / rtA.width, 0);
      pass(mBlur, rtB);
      mBlur.uniforms.tDiffuse.value = rtB.texture;
      mBlur.uniforms.dir.value.set(0, 1 / rtA.height);
      pass(mBlur, rtA);

      // ٤) التركيب على الشاشة
      mComp.uniforms.tDiffuse.value = rtScene.texture;
      mComp.uniforms.tBloom.value = rtA.texture;
      mComp.uniforms.time.value += dt || 0.016;
      pass(mComp, null);
    }

    function resize() {
      renderer.getSize(size);
      const p = renderer.getPixelRatio();
      rtScene.setSize(Math.max(2, size.x * p), Math.max(2, size.y * p));
      rtA.setSize(Math.max(2, size.x * p / 4), Math.max(2, size.y * p / 4));
      rtB.setSize(Math.max(2, size.x * p / 4), Math.max(2, size.y * p / 4));
    }

    /** ضبط قوة التأثيرات — الجودة الواطية بتقفلها خالص */
    function setLevel(name) {
      if (name === 'off') { on = false; return; }
      on = true;
      const p = {
        high: { bloom: 0.55, vignette: 0.5,  grain: 0.022, contrast: 1.09, sat: 1.07 },
        mid:  { bloom: 0.42, vignette: 0.38, grain: 0.016, contrast: 1.06, sat: 1.05 }
      }[name] || { bloom: 0.5, vignette: 0.8, grain: 0.02, contrast: 1.08, sat: 1.05 };
      mComp.uniforms.bloom.value = p.bloom;
      mComp.uniforms.vignette.value = p.vignette;
      mComp.uniforms.grain.value = p.grain;
      mComp.uniforms.contrast.value = p.contrast;
      mComp.uniforms.saturation.value = p.sat;
    }

    function dispose() {
      rtScene.dispose(); rtA.dispose(); rtB.dispose();
      quadGeo.dispose(); mBright.dispose(); mBlur.dispose(); mComp.dispose();
    }

    return { render, resize, setLevel, dispose, get enabled() { return on; } };
  };
})(window);
