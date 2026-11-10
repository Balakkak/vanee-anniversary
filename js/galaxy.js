/* ============================================================
   ฉากจักรวาล 3 มิติ (WebGL ล้วน ไม่ใช้ไลบรารีภายนอก)
   - กาแล็กซีก้นหอยจากอนุภาค ~43,000 จุด
   - หัวใจอนุภาคที่เต้นเป็นจังหวะ
   - ข้อความนอนอยู่บนระนาบกาแล็กซี
   - ฉากจบ: อนุภาคทั้งกาแล็กซีรวมตัวเป็นรูปถ่าย
   ============================================================ */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var FOV = 50 * Math.PI / 180;
  var OMEGA = 0.05;            // ความเร็วหมุนของจานกาแล็กซี (rad/s)
  var HEART_Y = 7.6;           // ความสูงของจุดกึ่งกลางหัวใจ
  var HEART_S = 0.23;          // สเกลของเส้นโค้งหัวใจ
  var PORTRAIT_H = 11;         // ความสูงของรูปอนุภาคในฉากจบ
  var PORTRAIT_CY = 5.2;

  // ---------- คณิตศาสตร์เมทริกซ์ 4x4 (column-major) ----------
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    var l = 1 / Math.hypot(zx, zy, zz); zx *= l; zy *= l; zz *= l;
    // up = (0,1,0)  →  x = up × z
    var xx = zz, xy = 0, xz = -zx;
    l = 1 / Math.hypot(xx, xy, xz); xx *= l; xz *= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1
    ]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function toward(v, target, step) { return v < target ? Math.min(target, v + step) : Math.max(target, v - step); }
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  // ---------- Shaders ----------
  var GALAXY_VS = [
    'precision highp float;',
    'attribute vec4 aGal;',    // รัศมี, มุม, ความสูง, ขนาด
    'attribute vec4 aRnd;',    // ทิศสุ่ม xyz, seed
    'attribute vec3 aCol;',
    'attribute vec3 aTgt;',    // ตำแหน่งในรูปถ่าย
    'attribute vec4 aTCol;',   // สีของพิกเซลในรูปถ่าย
    'uniform mat4 uView, uProj;',
    'uniform float uTime, uRot, uForm, uMorph, uPx, uTSize;',
    'varying vec4 vCol;',
    'varying float vMorph;',
    'void main(){',
    '  float seed = aRnd.w;',
    '  float ang = aGal.y + uRot + 0.03 * sin(uTime * 0.2 + seed * 40.0);',
    '  vec3 g = vec3(cos(ang) * aGal.x, aGal.z + 0.05 * sin(uTime * 0.7 + seed * 60.0), sin(ang) * aGal.x);',
    // บิ๊กแบง: ระเบิดออกจากจุดเดียว แล้วค่อยรวมตัวเป็นก้นหอย
    '  float f = clamp((uForm - seed * 0.3) / 0.7, 0.0, 1.0);',
    '  float e = 1.0 - pow(1.0 - f, 3.0);',
    '  vec3 p = g * e + aRnd.xyz * (34.0 * sin(3.14159 * f) * (1.0 - 0.6 * f));',
    // ฉากจบ: ไหลไปรวมกันเป็นรูปถ่าย
    '  float m = clamp(uMorph * 1.35 - seed * 0.35, 0.0, 1.0);',
    '  m = m * m * (3.0 - 2.0 * m);',
    '  vec3 t = aTgt;',
    '  t.z += 0.10 * sin(t.x * 1.3 + t.y * 0.9 + uTime * 1.4) * m;',
    '  p = mix(p, t, m) + aRnd.xyz * (3.0 * sin(3.14159 * m));',
    '  vec4 mv = uView * vec4(p, 1.0);',
    '  gl_Position = uProj * mv;',
    '  float tw = 0.62 + 0.38 * sin(uTime * (1.0 + seed * 2.0) + seed * 80.0);',
    '  float a = mix(tw * smoothstep(0.0, 0.08, f), aTCol.a, m);',
    '  vCol = vec4(mix(aCol, aTCol.rgb, m), a);',
    '  vMorph = m;',
    '  gl_PointSize = max(1.0, uPx * mix(aGal.w, uTSize, m) / max(0.5, -mv.z));',
    '}'
  ].join('\n');

  var GALAXY_FS = [
    'precision mediump float;',
    'varying vec4 vCol;',
    'varying float vMorph;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float soft = smoothstep(0.5, 0.0, d); soft *= soft;',
    '  float crisp = smoothstep(0.5, 0.30, d);',
    '  float a = mix(soft, crisp, vMorph) * vCol.a;',
    // alpha = 0 → บวกแสง (เรืองแสง), alpha = a → ทับปกติ (รูปถ่าย)
    '  gl_FragColor = vec4(vCol.rgb * a, a * vMorph);',
    '}'
  ].join('\n');

  var HEART_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'attribute vec4 aRnd;',    // seed, ขนาด, ชนิด (0 = หัวใจ, 1 = สายธารจากใจกลาง), ความสว่าง
    'attribute vec3 aCol;',
    'uniform mat4 uView, uProj;',
    'uniform float uTime, uGrow, uBeat, uRot, uAlpha, uPx, uHY, uTip;',
    'varying vec4 vCol;',
    'void main(){',
    '  vec3 p; float a = aRnd.w;',
    '  if (aRnd.z < 0.5) {',
    '    vec3 h = aPos;',
    '    float yN = clamp((h.y - uTip) / (3.2 - uTip), 0.0, 1.0);',
    '    float f = clamp((uGrow * 1.7 - yN * 0.55 - aRnd.x * 0.25) / 0.8, 0.0, 1.0);',
    '    f = f * f * (3.0 - 2.0 * f);',
    '    h.xy *= 1.0 + uBeat * 0.07;',
    '    h += 0.06 * vec3(sin(uTime * 1.3 + aRnd.x * 50.0), cos(uTime * 1.1 + aRnd.x * 80.0), sin(uTime * 0.9 + aRnd.x * 30.0));',
    '    float sa = aRnd.x * 18.85 + uTime;',
    '    vec3 s = vec3(cos(sa) * aRnd.x * 1.4, -uHY + 0.2, sin(sa) * aRnd.x * 1.4);',
    '    p = mix(s, h, f);',
    '    float sw = (1.0 - f) * 5.0; float c = cos(sw), sn = sin(sw);',
    '    p.xz = vec2(c * p.x - sn * p.z, sn * p.x + c * p.z);',
    '    a *= smoothstep(0.0, 0.2, f) * (0.75 + 0.25 * sin(uTime * 2.2 + aRnd.x * 90.0)) * (1.0 + uBeat * 0.5);',
    '  } else {',
    '    float u = fract(aRnd.x + uTime * 0.16);',
    '    float rad = 0.05 + 1.7 * pow(1.0 - u, 4.0);',
    '    float an = aRnd.x * 100.0 + uTime * 1.4 + u * 9.0;',
    '    p = vec3(cos(an) * rad, mix(-uHY + 0.1, uTip, u), sin(an) * rad);',
    '    a *= smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.85, u) * uGrow;',
    '  }',
    '  float c2 = cos(uRot), s2 = sin(uRot);',
    '  p.xz = vec2(c2 * p.x + s2 * p.z, -s2 * p.x + c2 * p.z);',
    '  p.y += uHY;',
    '  vec4 mv = uView * vec4(p, 1.0);',
    '  gl_Position = uProj * mv;',
    '  vCol = vec4(aCol, a * uAlpha);',
    '  gl_PointSize = max(1.0, uPx * aRnd.y / max(0.5, -mv.z));',
    '}'
  ].join('\n');

  var GLOW_FS = [
    'precision mediump float;',
    'varying vec4 vCol;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float s = smoothstep(0.5, 0.0, d); s *= s;',
    '  gl_FragColor = vec4(vCol.rgb * s * vCol.a, 0.0);',
    '}'
  ].join('\n');

  var STAR_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'attribute vec4 aCol;',    // rgb, ขนาด (px)
    'attribute float aSeed;',
    'uniform mat4 uView, uProj;',
    'uniform float uTime, uDpr;',
    'varying vec4 vCol;',
    'void main(){',
    '  gl_Position = uProj * uView * vec4(aPos, 1.0);',
    '  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.4) + aSeed * 100.0);',
    '  vCol = vec4(aCol.rgb, tw);',
    '  gl_PointSize = aCol.a * uDpr;',
    '}'
  ].join('\n');

  var LABEL_VS = [
    'precision highp float;',
    'attribute vec2 aQ;',
    'uniform mat4 uVP;',
    'uniform vec3 uC, uR, uU;',
    'uniform vec2 uS;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec3 p = uC + uR * (aQ.x * uS.x) + uU * (aQ.y * uS.y);',
    '  vUV = vec2(aQ.x + 0.5, 0.5 - aQ.y);',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var LABEL_FS = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform float uA;',
    'varying vec2 vUV;',
    'void main(){ gl_FragColor = vec4(texture2D(uTex, vUV).rgb * uA, 0.0); }'
  ].join('\n');

  // พื้นหลังเนบิวลา (วาดในแคนวาสเองเพื่อให้แสงของอนุภาคบวกทับได้ถูกต้องทุกเบราว์เซอร์)
  var BG_VS = 'attribute vec2 aQ; void main(){ gl_Position = vec4(aQ * 2.0, 0.0, 1.0); }';
  var BG_FS = [
    'precision mediump float;',
    'uniform vec2 uRes;',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 k = vec2(uRes.x / uRes.y, 1.0);',
    '  vec3 col = mix(vec3(0.082, 0.027, 0.157), vec3(0.027, 0.012, 0.059), smoothstep(0.0, 0.8, length((uv - 0.5) * k)));',
    '  float n1 = smoothstep(0.8, 0.0, length((uv - vec2(0.74, 0.84)) * k));',
    '  col += vec3(0.48, 0.20, 0.66) * 0.30 * n1 * n1;',
    '  float n2 = smoothstep(0.75, 0.0, length((uv - vec2(0.10, 0.10)) * k));',
    '  col += vec3(1.0, 0.31, 0.63) * 0.13 * n2 * n2;',
    '  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // ---------- สถานะ ----------
  var canvas, gl = null, dpr = 1, W = 1, H = 1, aspect = 1;
  var progs = {}, bufs = {}, counts = {};
  var labels = [], anchors = [];
  var proj, view, vp;
  var time = 0, last = 0, running = false, startedAt = -1, readyFired = false;
  var S = { form: 0, grow: 0, labelA: 0, heartA: 1, morph: 0, anchorA: 0 };
  var T = { form: 0, grow: 0, labelA: 0, heartA: 1, morph: 0, anchorA: 0 };
  var cam = { az: 0.6, pol: 1.35, dist: 14, ty: 3.4 };
  var vel = { az: 0, pol: 0 };
  var tween = null, finaleOn = false, dragging = false, idleFor = 99;
  var listeners = { ready: [], finaleFormed: [] };

  function defaultDist() { return aspect >= 1.2 ? 32 : 32 + (1.2 - aspect) * 26; }
  function finaleDist() {
    var t = Math.tan(FOV / 2), pw = PORTRAIT_H * 0.75;
    // เผื่อที่ด้านบนให้ข้อความ และด้านล่างให้ปุ่ม
    return Math.max((PORTRAIT_H / 2) / t * 1.6, (pw / 2) / (t * aspect) * 1.14);
  }

  // ---------- WebGL helpers ----------
  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var o = { p: p, u: {}, a: {} }, i, info;
    var nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < nu; i++) { info = gl.getActiveUniform(p, i); o.u[info.name] = gl.getUniformLocation(p, info.name); }
    var na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < na; i++) { info = gl.getActiveAttrib(p, i); o.a[info.name] = gl.getAttribLocation(p, info.name); }
    return o;
  }
  function buffer(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  // ผูก attribute จากบัฟเฟอร์แบบ interleaved: layout = [[name, size], ...]
  function bind(prog, buf, layout, stride) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    var off = 0;
    for (var i = 0; i < layout.length; i++) {
      var loc = prog.a[layout[i][0]];
      if (loc !== undefined && loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, layout[i][1], gl.FLOAT, false, stride * 4, off * 4);
      }
      off += layout[i][1];
    }
  }

  // ---------- สร้างข้อมูลอนุภาค ----------
  var GAL_LAYOUT = [['aGal', 4], ['aRnd', 4], ['aCol', 3], ['aTgt', 3], ['aTCol', 4]];
  var HEART_LAYOUT = [['aPos', 3], ['aRnd', 4], ['aCol', 3]];
  var STAR_LAYOUT = [['aPos', 3], ['aCol', 4], ['aSeed', 1]];

  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function galaxyColor(t) {
    var c0 = [1.0, 0.88, 0.92], c1 = [1.0, 0.42, 0.74], c2 = [0.72, 0.42, 1.0], c3 = [0.42, 0.50, 1.0];
    if (t < 0.25) return lerp3(c0, c1, t / 0.25);
    if (t < 0.62) return lerp3(c1, c2, (t - 0.25) / 0.37);
    return lerp3(c2, c3, clamp((t - 0.62) / 0.38, 0, 1));
  }

  function buildGalaxy() {
    var P = window.PORTRAIT, pw = P ? P.w : 180, ph = P ? P.h : 240;
    var px = null;
    if (P) {
      var bin = atob(P.data); px = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) px[k] = bin.charCodeAt(k);
    }
    var N = pw * ph, stride = 18, d = new Float32Array(N * stride), R = 14;
    var spacing = PORTRAIT_H / (ph - 1);
    for (var i = 0; i < N; i++) {
      var o = i * stride, k2 = Math.random(), r, th, y, size, bright, col;
      if (k2 < 0.14) {                         // ใจกลางสว่าง
        r = Math.abs(gauss()) * 1.25; th = Math.random() * TAU;
        y = gauss() * 0.5 * Math.exp(-r * 0.5);
        size = 0.07 + Math.pow(Math.random(), 3) * 0.2; bright = 0.5;
      } else if (k2 < 0.78) {                  // แขนก้นหอย 2 แขน
        var t = Math.pow(Math.random(), 0.8);
        r = 1.2 + t * (R - 1.2);
        th = Math.floor(Math.random() * 2) * Math.PI + r * 0.36 + gauss() * (0.75 + r * 0.17) / r;
        r += gauss() * 0.3;
        y = gauss() * 0.2 * (1.2 - t * 0.7);
        size = 0.06 + Math.pow(Math.random(), 3) * 0.24; bright = 0.85;
      } else {                                 // ฝุ่นดาวทั่วจาน
        r = Math.sqrt(Math.random()) * R * 1.12; th = Math.random() * TAU;
        y = gauss() * 0.28;
        size = 0.05 + Math.random() * 0.1; bright = 0.6;
      }
      col = galaxyColor(clamp(r / R, 0, 1));
      if (Math.random() < 0.05) { col = [1, 0.95, 1]; size *= 1.9; bright = 1; }   // ดาวประกาย
      var v = 0.75 + Math.random() * 0.25;
      d[o] = r; d[o + 1] = th; d[o + 2] = y; d[o + 3] = size;
      // ทิศสุ่มบนทรงกลม
      var z = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - z * z);
      d[o + 4] = s * Math.cos(a); d[o + 5] = z; d[o + 6] = s * Math.sin(a); d[o + 7] = Math.random();
      d[o + 8] = col[0] * v * bright; d[o + 9] = col[1] * v * bright; d[o + 10] = col[2] * v * bright;
      var gx = i % pw, gy = (i / pw) | 0;
      d[o + 11] = (gx - (pw - 1) / 2) * spacing;
      d[o + 12] = PORTRAIT_CY + ((ph - 1) / 2 - gy) * spacing;
      d[o + 13] = 0;
      if (px) {
        d[o + 14] = px[i * 4] / 255; d[o + 15] = px[i * 4 + 1] / 255; d[o + 16] = px[i * 4 + 2] / 255; d[o + 17] = px[i * 4 + 3] / 255;
      } else {
        d[o + 14] = col[0]; d[o + 15] = col[1]; d[o + 16] = col[2]; d[o + 17] = 0.5;
      }
    }
    bufs.galaxy = buffer(d); counts.galaxy = N; counts.galStride = stride;
    counts.tSize = spacing * 1.55;
  }

  function heartXY(t) {
    var s = Math.sin(t);
    return [16 * s * s * s * HEART_S, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * HEART_S];
  }
  function buildHeart() {
    var M = 9000, ST = 700, stride = 10, d = new Float32Array((M + ST) * stride), i, o;
    for (i = 0; i < M; i++) {
      o = i * stride;
      var t = Math.random() * TAU, h = heartXY(t), x, y, z, size, bright;
      if (i < M * 0.58) {                       // เส้นขอบหนาแน่น
        x = h[0] + gauss() * 0.11; y = h[1] + gauss() * 0.11; z = gauss() * 0.22;
        size = 0.09 + Math.pow(Math.random(), 3) * 0.2; bright = 0.85;
      } else {                                  // เนื้อในบาง ๆ
        var k = Math.sqrt(Math.random()) * 0.94;
        x = h[0] * k; y = h[1] * k; z = gauss() * 0.45 * (1 - k * 0.6);
        size = 0.07 + Math.random() * 0.1; bright = 0.42;
      }
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = Math.random(); d[o + 4] = size; d[o + 5] = 0; d[o + 6] = bright;
      var w = Math.random();
      d[o + 7] = 1.0; d[o + 8] = 0.5 + w * 0.38; d[o + 9] = 0.78 + w * 0.22;
      if (Math.random() < 0.06) { d[o + 8] = 0.95; d[o + 9] = 1; d[o + 4] *= 1.7; d[o + 6] = 1; }
    }
    for (i = M; i < M + ST; i++) {
      o = i * stride;
      d[o + 3] = Math.random(); d[o + 4] = 0.07 + Math.random() * 0.1; d[o + 5] = 1; d[o + 6] = 0.7;
      d[o + 7] = 1.0; d[o + 8] = 0.7; d[o + 9] = 0.95;
    }
    bufs.heart = buffer(d); counts.heart = M + ST; counts.heartStride = stride;
  }
  function buildStars() {
    var N = 2600, stride = 8, d = new Float32Array(N * stride);
    for (var i = 0; i < N; i++) {
      var o = i * stride, z = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - z * z), r = 80 + Math.random() * 70;
      d[o] = s * Math.cos(a) * r; d[o + 1] = z * r; d[o + 2] = s * Math.sin(a) * r;
      var c = Math.random(), b = 0.35 + Math.random() * 0.65;
      d[o + 3] = (c < 0.25 ? 1.0 : 0.85) * b; d[o + 4] = (c < 0.25 ? 0.7 : 0.85) * b; d[o + 5] = (c > 0.8 ? 1.0 : 0.95) * b;
      d[o + 6] = 1.2 + Math.pow(Math.random(), 4) * 3.2;
      d[o + 7] = Math.random();
    }
    bufs.stars = buffer(d); counts.stars = N; counts.starStride = stride;
  }

  // ---------- ข้อความบนระนาบกาแล็กซี ----------
  function makeLabelTexture(text) {
    var c = document.createElement('canvas'), x = c.getContext('2d');
    var font = '600 84px "Prompt", "Noto Sans Thai", "Thonburi", system-ui, sans-serif';
    x.font = font;
    if ('letterSpacing' in x) x.letterSpacing = '10px';
    var tw = Math.ceil(x.measureText(text).width) + 120;
    c.width = Math.min(2048, tw); c.height = 200;
    x.font = font;
    if ('letterSpacing' in x) x.letterSpacing = '10px';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var g = x.createLinearGradient(0, 40, 0, 160);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffb3e0');
    x.fillStyle = g;
    x.shadowColor = 'rgba(255, 90, 190, 0.95)'; x.shadowBlur = 30;
    x.fillText(text, c.width / 2, 104, c.width - 60);
    x.shadowBlur = 10;
    x.fillText(text, c.width / 2, 104, c.width - 60);
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex: t, aspect: c.width / c.height };
  }
  function setWords(words) {
    if (!gl) return;
    labels = [];
    var n = words.length;
    for (var i = 0; i < n; i++) {
      var L = makeLabelTexture(words[i]);
      L.r = 6.2 + (i % 3) * 3.1 + Math.random() * 0.8;
      L.theta = (i / n) * TAU + (i % 3) * 0.5;
      L.h = 1.35 + (i % 3 === 2 ? 0.45 : 0) + (i === 0 ? 0.35 : 0);
      labels.push(L);
    }
  }

  // ---------- กล้อง ----------
  function eye() {
    var sp = Math.sin(cam.pol);
    return [cam.dist * sp * Math.sin(cam.az), cam.ty + cam.dist * Math.cos(cam.pol), cam.dist * sp * Math.cos(cam.az)];
  }
  function tweenCam(to, dur) {
    // เลือกทางหมุนที่สั้นที่สุด
    var az = cam.az % TAU; if (az > Math.PI) az -= TAU; if (az < -Math.PI) az += TAU;
    cam.az = az;
    tween = { from: { az: cam.az, pol: cam.pol, dist: cam.dist, ty: cam.ty }, to: to, t: 0, dur: dur };
    vel.az = vel.pol = 0;
  }
  function updateCamera(dt) {
    if (tween) {
      tween.t += dt / tween.dur;
      var k = ease(clamp(tween.t, 0, 1)), f = tween.from, t = tween.to;
      for (var key in t) cam[key] = f[key] + (t[key] - f[key]) * k;
      if (tween.t >= 1) tween = null;
      return;
    }
    if (finaleOn) {                             // แกว่งเบา ๆ ให้รูปดูมีมิติ
      cam.az = Math.sin(time * 0.35) * 0.14;
      cam.pol = Math.PI / 2 - 0.03 + Math.sin(time * 0.27) * 0.04;
      return;
    }
    if (!dragging) {
      idleFor += dt;
      cam.az += vel.az * dt; cam.pol += vel.pol * dt;
      var damp = Math.exp(-3.2 * dt); vel.az *= damp; vel.pol *= damp;
      cam.az += 0.045 * clamp((idleFor - 1.2) / 2, 0, 1) * dt;   // หมุนเองช้า ๆ เมื่อไม่ได้ลาก
    }
    cam.pol = clamp(cam.pol, 0.5, 1.48);
  }

  // ---------- วาด ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    aspect = W / H;
    var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (gl) gl.viewport(0, 0, cw, ch);
    proj = perspective(FOV, aspect, 0.3, 500);
    if (startedAt >= 0 && !tween) {
      if (finaleOn) cam.dist = finaleDist();
      else cam.dist = clamp(cam.dist, 10, defaultDist() * 1.8);
    }
  }

  function heartBeat() {
    var ph = (time % 1.3) / 1.3;
    var a = (ph - 0.08) * 13, b = (ph - 0.30) * 11;
    return Math.exp(-a * a) + 0.65 * Math.exp(-b * b);
  }

  function render() {
    var px = canvas.height / (2 * Math.tan(FOV / 2));
    var p;

    p = progs.bg; gl.useProgram(p.p);
    bind(p, bufs.quad, [['aQ', 2]], 2);
    gl.uniform2f(p.u.uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ดาวพื้นหลัง
    p = progs.stars; gl.useProgram(p.p);
    bind(p, bufs.stars, STAR_LAYOUT, counts.starStride);
    gl.uniformMatrix4fv(p.u.uView, false, view); gl.uniformMatrix4fv(p.u.uProj, false, proj);
    gl.uniform1f(p.u.uTime, time); gl.uniform1f(p.u.uDpr, dpr);
    gl.drawArrays(gl.POINTS, 0, counts.stars);

    // กาแล็กซี / รูปถ่ายอนุภาค
    if (S.form > 0) {
      p = progs.galaxy; gl.useProgram(p.p);
      bind(p, bufs.galaxy, GAL_LAYOUT, counts.galStride);
      gl.uniformMatrix4fv(p.u.uView, false, view); gl.uniformMatrix4fv(p.u.uProj, false, proj);
      gl.uniform1f(p.u.uTime, time); gl.uniform1f(p.u.uRot, time * OMEGA);
      gl.uniform1f(p.u.uForm, S.form); gl.uniform1f(p.u.uMorph, S.morph);
      gl.uniform1f(p.u.uPx, px); gl.uniform1f(p.u.uTSize, counts.tSize);
      gl.drawArrays(gl.POINTS, 0, counts.galaxy);
    }

    // ข้อความบนระนาบ — หันตามกล้องเสมอเพื่อให้อ่านออกทุกมุม
    if (S.labelA > 0.001 && labels.length) {
      p = progs.label; gl.useProgram(p.p);
      bind(p, bufs.quad, [['aQ', 2]], 2);
      gl.uniformMatrix4fv(p.u.uVP, false, vp);
      gl.uniform3f(p.u.uR, Math.cos(cam.az), 0, -Math.sin(cam.az));
      // มองเฉียงต่ำมาก ๆ ตัวอักษรจะค่อย ๆ ตั้งขึ้นเพื่อให้ยังอ่านออก
      var lift = clamp((cam.pol - 1.05) / 0.4, 0, 1) * 0.9, lf = Math.sqrt(1 - lift * lift);
      gl.uniform3f(p.u.uU, -Math.sin(cam.az) * lf, lift, -Math.cos(cam.az) * lf);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(p.u.uTex, 0);
      for (var i = 0; i < labels.length; i++) {
        var L = labels[i], th = L.theta + time * OMEGA;
        gl.bindTexture(gl.TEXTURE_2D, L.tex);
        gl.uniform3f(p.u.uC, Math.cos(th) * L.r, 0.25, Math.sin(th) * L.r);
        gl.uniform2f(p.u.uS, L.h * L.aspect, L.h);
        gl.uniform1f(p.u.uA, S.labelA * 0.9);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    // หัวใจ
    if (S.grow > 0 && S.heartA > 0.001) {
      p = progs.heart; gl.useProgram(p.p);
      bind(p, bufs.heart, HEART_LAYOUT, counts.heartStride);
      gl.uniformMatrix4fv(p.u.uView, false, view); gl.uniformMatrix4fv(p.u.uProj, false, proj);
      gl.uniform1f(p.u.uTime, time); gl.uniform1f(p.u.uGrow, S.grow);
      gl.uniform1f(p.u.uBeat, heartBeat());
      gl.uniform1f(p.u.uRot, cam.az + Math.sin(time * 0.4) * 0.45);
      gl.uniform1f(p.u.uAlpha, S.heartA); gl.uniform1f(p.u.uPx, px);
      gl.uniform1f(p.u.uHY, HEART_Y); gl.uniform1f(p.u.uTip, -17 * HEART_S);
      gl.drawArrays(gl.POINTS, 0, counts.heart);
    }
  }

  // ---------- ของลอย (DOM) ที่ผูกกับตำแหน่ง 3 มิติ ----------
  function updateAnchors() {
    var alpha = S.anchorA;
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i], el = a.el;
      if (alpha <= 0.001) {
        if (a.shown) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; a.shown = false; }
        continue;
      }
      var th = a.theta + time * OMEGA * a.speed;
      var x = Math.cos(th) * a.r, y = a.y + Math.sin(time * a.bob + a.phase) * 0.4, z = Math.sin(th) * a.r;
      var cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (cw < 1) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; a.shown = false; continue; }
      var sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw * 0.5 + 0.5) * W;
      var sy = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw * 0.5) * H;
      var sc = clamp(cam.dist / cw, 0.55, 1.25);
      el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')';
      el.style.opacity = (alpha * clamp(0.45 + sc * 0.6, 0, 1)).toFixed(2);
      el.style.zIndex = String(2000 - Math.round(cw * 10));
      el.style.pointerEvents = alpha > 0.6 ? 'auto' : 'none';
      a.shown = true;
    }
  }

  function fire(name) { var l = listeners[name]; for (var i = 0; i < l.length; i++) l[i](); }

  function updateTimeline(dt) {
    if (startedAt >= 0) {
      var e = time - startedAt;
      T.form = 1;
      if (e > 3.4) T.grow = 1;
      if (!finaleOn) {
        if (e > 6.0) T.labelA = 1;
        if (e > 6.6) T.anchorA = 1;
      }
      if (e > 7.4 && !readyFired) { readyFired = true; fire('ready'); }
    }
    S.form = toward(S.form, T.form, dt / 5.2);
    S.grow = toward(S.grow, T.grow, dt / 4.2);
    S.labelA = toward(S.labelA, T.labelA, dt / 1.6);
    S.anchorA = toward(S.anchorA, T.anchorA, dt / 1.0);
    S.heartA = toward(S.heartA, T.heartA, dt / 1.4);
    var before = S.morph;
    S.morph = toward(S.morph, T.morph, dt / 4.6);
    if (before < 1 && S.morph >= 1) fire('finaleFormed');
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = clamp((now - last) / 1000, 0, 0.05) || 0; last = now;
    time += dt;
    updateTimeline(dt);
    updateCamera(dt);
    view = lookAt(eye(), [0, cam.ty, 0]);
    vp = mul(proj, view);
    if (gl) render();
    updateAnchors();
  }

  // ---------- ควบคุมด้วยนิ้ว/เมาส์ ----------
  function bindControls() {
    var pts = {}, n = 0, pinch = 0;
    function locked() { return finaleOn || tween || startedAt < 0; }
    canvas.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; n = Object.keys(pts).length;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
      dragging = true; idleFor = 0; pinch = 0;
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId]; if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (locked()) return;
      if (n === 1) {
        cam.az -= dx * 0.0055; cam.pol = clamp(cam.pol - dy * 0.0045, 0.5, 1.48);
        vel.az = -dx * 0.0055 * 40; vel.pol = -dy * 0.0045 * 40;
      } else if (n === 2) {
        var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) cam.dist = clamp(cam.dist * pinch / d, 10, defaultDist() * 1.8);
        pinch = d;
      }
    });
    function up(e) {
      delete pts[e.pointerId]; n = Object.keys(pts).length; pinch = 0;
      if (n === 0) { dragging = false; idleFor = 0; }
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (locked()) return;
      cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 10, defaultDist() * 1.8);
      idleFor = 0;
    }, { passive: false });
  }

  // ---------- API ----------
  var Galaxy = {
    ok: false,
    init: function (cv) {
      canvas = cv;
      try {
        gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
        if (!gl) throw new Error('no webgl');
        progs.bg = program(BG_VS, BG_FS);
        progs.galaxy = program(GALAXY_VS, GALAXY_FS);
        progs.heart = program(HEART_VS, GLOW_FS);
        progs.stars = program(STAR_VS, GLOW_FS);
        progs.label = program(LABEL_VS, LABEL_FS);
        buildGalaxy(); buildHeart(); buildStars();
        bufs.quad = buffer(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]));
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        Galaxy.ok = true;
      } catch (err) {
        if (window.console) console.warn('WebGL ใช้ไม่ได้ — แสดงพื้นหลังแบบธรรมดาแทน:', err);
        gl = null;
      }
      resize();
      window.addEventListener('resize', resize);
      bindControls();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) running = false;
        else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      });
      running = true; last = performance.now();
      requestAnimationFrame(frame);
      return Galaxy.ok;
    },
    setWords: setWords,
    // เริ่มบิ๊กแบง
    start: function () {
      if (startedAt >= 0) return;
      startedAt = time;
      cam.az = 0.9; cam.pol = 1.38; cam.dist = 13; cam.ty = 2.4;
      tweenCam({ az: -0.35, pol: 1.17, dist: defaultDist(), ty: 4.3 }, 7.2);
    },
    // ผูก element ให้ลอยอยู่ที่ตำแหน่ง (รัศมี, มุม, ความสูง) ในกาแล็กซี
    attach: function (el, o) {
      anchors.push({ el: el, r: o.r, theta: o.theta, y: o.y, speed: o.speed || 1, bob: 0.6 + Math.random() * 0.5, phase: Math.random() * TAU, shown: false });
      el.style.opacity = '0'; el.style.pointerEvents = 'none';
    },
    finale: function (on) {
      if (startedAt < 0 || on === finaleOn) return;
      finaleOn = on;
      if (on) {
        T.morph = 1; T.heartA = 0; T.labelA = 0; T.anchorA = 0;
        tweenCam({ az: 0, pol: Math.PI / 2 - 0.03, dist: finaleDist(), ty: PORTRAIT_CY + 0.45 }, 4.4);
      } else {
        T.morph = 0; T.heartA = 1; T.labelA = 1; T.anchorA = 1;
        tweenCam({ az: -0.35, pol: 1.17, dist: defaultDist(), ty: 4.3 }, 4.0);
      }
    },
    on: function (name, fn) { listeners[name].push(fn); }
  };
  window.Galaxy = Galaxy;
})();
