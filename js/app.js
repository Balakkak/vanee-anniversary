/* ============================================================
   ส่วนหน้าเว็บ: ล็อกรหัส, ตัวนับเวลา, จดหมาย, คูปอง, จิ๊กซอว์, อัลบั้ม, ฉากจบ
   ข้อความทั้งหมดอยู่ใน js/config.js
   ============================================================ */
(function () {
  'use strict';

  var C = window.CONFIG, PHOTOS = window.PHOTOS || [], Galaxy = window.Galaxy;
  var body = document.body;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function photoById(id) { for (var i = 0; i < PHOTOS.length; i++) if (PHOTOS[i].id === id) return PHOTOS[i]; return PHOTOS[0]; }

  // ---------- เวลาที่คบกัน ----------
  var START = new Date(C.startDate);
  function together() {
    var now = new Date();
    var m = (now.getFullYear() - START.getFullYear()) * 12 + now.getMonth() - START.getMonth();
    if (now.getDate() < START.getDate()) m--;
    m = Math.max(0, m);
    var ms = Math.max(0, now - START), days = Math.floor(ms / 864e5);
    var th, en;
    if (m >= 12) {
      var y = Math.floor(m / 12), r = m % 12;
      th = y + ' ปี' + (r ? ' ' + r + ' เดือน' : ''); en = y + (y > 1 ? ' YEARS' : ' YEAR');
    } else if (m >= 1) { th = m + ' เดือน'; en = m + (m > 1 ? ' MONTHS' : ' MONTH'); }
    else { th = days + ' วัน'; en = days + ' DAYS'; }
    return { ms: ms, days: days, th: th, en: en };
  }
  var T0 = together();

  $('#hudKicker').textContent = 'ครบรอบ ' + T0.th + ' ของเรา';
  $('#hudNames').textContent = C.hisName + ' ♡ ' + C.herName;

  var cD = $('#cDays'), cH = $('#cHours'), cM = $('#cMins'), cS = $('#cSecs');
  function tick() {
    var s = Math.floor(together().ms / 1000);
    cD.textContent = Math.floor(s / 86400);
    cH.textContent = pad2(Math.floor(s / 3600) % 24);
    cM.textContent = pad2(Math.floor(s / 60) % 60);
    cS.textContent = pad2(s % 60);
  }
  tick(); setInterval(tick, 1000);

  // ---------- แจ้งเตือนสั้น ๆ ----------
  var toastEl = $('#toast'), toastTimer = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2800);
  }

  // ---------- หัวใจโปรย ----------
  var FX = (function () {
    var cv = $('#fx'), ctx = cv.getContext('2d'), parts = [], running = false, dpr = 1, rainUntil = 0, prev = 0;
    var COLORS = ['#ff7ac3', '#ffb3e0', '#ffffff', '#c9a4ff', '#ff5aa8'];
    function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
    size(); window.addEventListener('resize', size);
    function add(x, y, vx, vy, s) {
      parts.push({ x: x, y: y, vx: vx, vy: vy, s: s, rot: (Math.random() - 0.5) * 0.8, vr: (Math.random() - 0.5) * 2, life: 0, max: 1.6 + Math.random() * 1.4, c: COLORS[(Math.random() * COLORS.length) | 0] });
    }
    function loop(now) {
      var dt = Math.min(0.05, (now - prev) / 1000) || 0.016; prev = now;
      if (now < rainUntil && Math.random() < 0.55) add(Math.random() * innerWidth, -20, (Math.random() - 0.5) * 40, 60 + Math.random() * 90, 7 + Math.random() * 10);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life += dt; p.vy += 130 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        var a = Math.min(1, (p.max - p.life) / 0.6);
        if (a <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s);
        ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(0, 0.9);
        ctx.bezierCurveTo(-1.5, -0.1, -0.75, -1.15, 0, -0.38);
        ctx.bezierCurveTo(0.75, -1.15, 1.5, -0.1, 0, 0.9);
        ctx.fill(); ctx.restore();
      }
      if (parts.length || now < rainUntil) requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    }
    function kick() { if (!running) { running = true; prev = performance.now(); requestAnimationFrame(loop); } }
    return {
      burst: function (x, y, n) {
        for (var i = 0; i < (n || 26); i++) {
          var a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
          add(x, y, Math.cos(a) * v, Math.sin(a) * v - 160, 6 + Math.random() * 9);
        }
        kick();
      },
      burstAt: function (node, n) { var r = node.getBoundingClientRect(); this.burst(r.left + r.width / 2, r.top + r.height / 2, n); },
      rain: function (ms) { rainUntil = performance.now() + ms; kick(); }
    };
  })();

  // ---------- เพลง ----------
  // ค่าเริ่มต้นคือทำนองกล่องดนตรีที่เว็บสังเคราะห์เอง แล้วเล่นผ่านแท็ก <audio>
  // (วิธีนี้ยังมีเสียงแม้ iPhone/iPad เปิดสวิตช์ปิดเสียงไว้ และไม่ต้องมีไฟล์เพลง)
  var Music = (function () {
    var el = null, on = true, playing = false, ready = false, started = false, fadeT = 0, building = false;
    var STEP = 0.4, SR = 32000, LOOP = STEP * 32;
    var CHORDS = [[48, 60, 64, 67, 71, 74], [45, 57, 60, 64, 67, 72], [41, 53, 57, 60, 64, 69], [43, 55, 59, 62, 67, 71]];
    var PAT = [1, 3, 2, 4, 5, 4, 3, 2];
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function pluck(c, bus, t, m, vel) {
      var g = c.createGain(), o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
      o.type = 'sine'; o.frequency.value = hz(m);
      o2.type = 'sine'; o2.frequency.value = hz(m) * 3; g2.gain.value = 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
      o.start(t); o2.start(t); o.stop(t + 1.8); o2.stop(t + 1.8);
    }
    function padNote(c, out, t, m, dur, vol, type) {
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 650;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 1.1);
      g.gain.setValueAtTime(vol, t + dur - 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.0);
      o.connect(f); f.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 1.1);
    }
    function wav(samples) {
      var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      function str(o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      str(36, 'data'); v.setUint32(40, n * 2, true);
      for (var i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
      return new Blob([buf], { type: 'audio/wav' });
    }
    // เรนเดอร์ 2 รอบแล้วตัดรอบที่ 2 มาวน เพื่อให้ต่อกันเนียนไม่สะดุด
    function build() {
      if (building || ready) return; building = true;
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return;
      try {
        var c = new OAC(1, Math.ceil(SR * LOOP * 2), SR);
        var master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
        var bus = c.createGain(); bus.connect(master);
        var delay = c.createDelay(2), fb = c.createGain(), wet = c.createGain(), lp = c.createBiquadFilter();
        delay.delayTime.value = STEP * 1.5; fb.gain.value = 0.36; wet.gain.value = 0.34; lp.type = 'lowpass'; lp.frequency.value = 2400;
        bus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
        for (var step = 0; step < 64; step++) {
          var t = step * STEP, bar = (step >> 3) % 4, i = step & 7, ch = CHORDS[bar];
          if (i === 0) { padNote(c, master, t, ch[0], STEP * 8, 0.09, 'sine'); padNote(c, master, t, ch[1], STEP * 8, 0.035, 'triangle'); padNote(c, master, t, ch[3], STEP * 8, 0.03, 'triangle'); }
          pluck(c, bus, t, ch[PAT[i]] + 12, i === 0 ? 0.2 : (i % 2 ? 0.09 : 0.13));
          if (i === 6 && (step >> 5) % 2 === 1) pluck(c, bus, t + STEP / 2, ch[5] + 12, 0.07);
        }
        var done = function (b) {
          var d = b.getChannelData(0), from = Math.round(SR * LOOP), out = d.slice(from, from + Math.round(SR * LOOP)), peak = 0, k;
          for (k = 0; k < out.length; k++) peak = Math.max(peak, Math.abs(out[k]));
          var gain = peak > 0 ? 0.6 / peak : 1;                     // ปรับให้ดังพอสำหรับลำโพงมือถือ
          for (k = 0; k < out.length; k++) out[k] *= gain;
          el = new Audio(); el.loop = true; el.preload = 'auto'; el.muted = true; el.setAttribute('playsinline', '');
          el.src = URL.createObjectURL(wav(out)); ready = true; sync();
        };
        var r = c.startRendering(); if (r && r.then) r.then(done); else c.oncomplete = function (e) { done(e.renderedBuffer); };
      } catch (err) { if (window.console) console.warn('สร้างเพลงไม่สำเร็จ', err); }
    }
    function fade(to) {
      clearInterval(fadeT);
      try { fadeT = setInterval(function () {
        var v = el.volume + (to > el.volume ? 0.05 : -0.05);
        if (Math.abs(v - to) < 0.06) { v = to; clearInterval(fadeT); }
        el.volume = Math.max(0, Math.min(1, v));
      }, 90); } catch (_) {}
    }
    function sync() {
      if (!el) return;
      var audible = on && playing;
      if (audible) { el.muted = false; if (started) fade(1); }
      else { el.muted = true; }
      if (el.paused && (started || playing)) { var p = el.play(); if (p && p.catch) p.catch(function () { started = false; }); }
    }
    // เรียกทุกครั้งที่ผู้ใช้แตะ/กดคีย์ เพราะเบราว์เซอร์อนุญาตให้เริ่มเสียงได้เฉพาะตอนนั้น
    function prime() {
      if (C.musicFile && !el) {
        el = new Audio(C.musicFile); el.loop = true; el.muted = true; ready = true;
        el.addEventListener('error', function () { el = null; ready = false; C.musicFile = ''; build(); });
      }
      if (!C.musicFile) build();
      if (!el || !ready) return;
      if (el.paused) { var p = el.play(); if (p && p.then) p.then(function () { started = true; sync(); }, function () {}); }
      else { started = true; sync(); }
    }
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, prime, { passive: true, capture: true }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && playing) { prime(); sync(); } });
    build();
    return {
      prime: prime,
      play: function () { playing = true; if (el) { try { el.currentTime = 0; } catch (_) {} } prime(); sync(); },
      toggle: function () { on = !on; if (on) prime(); sync(); return on; }
    };
  })();

  var soundBtn = $('#sound');
  soundBtn.addEventListener('click', function () {
    var on = Music.toggle();
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  // ---------- จักรวาล ----------
  Galaxy.init($('#space'));
  var words = C.galaxyWords.map(function (w) { return w.replace('{n}', T0.en); });
  (function () {
    var done = false;
    function go() { if (!done) { done = true; Galaxy.setWords(words); } }
    if (document.fonts && document.fonts.load) {
      document.fonts.load('600 84px "Prompt"').then(go, go);
      setTimeout(go, 2500);
    } else go();
  })();

  // ---------- สิ่งที่เปิดดูแล้ว ----------
  var NEED = ['letter', 'coupon', 'puzzle', 'album'], seen = {}, unlockedToast = false;
  var giftBtn = $('#dock .gift');
  function remaining() { return NEED.filter(function (k) { return !seen[k]; }).length; }
  function refreshSeen() {
    $$('#dock button').forEach(function (b) { b.classList.toggle('seen', !!seen[b.dataset.open]); });
    $$('.orb.feature').forEach(function (o) { o.classList.toggle('seen', !!seen[o.dataset.open]); });
    var left = C.lockFinale ? remaining() : 0;
    if (left > 0) { giftBtn.dataset.left = left; giftBtn.classList.remove('ready'); }
    else { delete giftBtn.dataset.left; giftBtn.classList.add('ready'); }
  }

  // ---------- ของลอยในกาแล็กซี ----------
  var orbBox = $('#orbs'), TAU = Math.PI * 2;
  var FEATURES = [
    { open: 'letter', ico: '💌', tag: 'จดหมาย' },
    { open: 'coupon', ico: '🎟️', tag: 'คูปองรัก' },
    { open: 'puzzle', ico: '🧩', tag: 'จิ๊กซอว์' },
    { open: 'finale', ico: '🎁', tag: 'เซอร์ไพรส์' }
  ];
  FEATURES.forEach(function (f, i) {
    var b = el('button', 'orb feature'); b.type = 'button'; b.dataset.open = f.open;
    b.setAttribute('aria-label', f.tag);
    b.appendChild(el('span', 'in', f.ico)); b.appendChild(el('span', 'tag', f.tag));
    b.addEventListener('click', function () { openPanel(f.open); });
    orbBox.appendChild(b);
    Galaxy.attach(b, { r: 9, theta: i * TAU / 4 + 0.35, y: 2.2 + (i % 2) * 1.2 });
  });
  (C.floatingPhotos || []).forEach(function (id, j, arr) {
    var p = photoById(id), b = el('button', 'orb photo'); b.type = 'button';
    b.setAttribute('aria-label', 'เปิดรูปความทรงจำ');
    var inner = el('span', 'in'), img = new Image(); img.src = p.thumb; img.alt = ''; img.draggable = false;
    inner.appendChild(img); b.appendChild(inner);
    b.addEventListener('click', function () { openPanel('album', PHOTOS.indexOf(p)); });
    orbBox.appendChild(b);
    Galaxy.attach(b, { r: 12.5 + (j % 3) * 1.6, theta: j * TAU / arr.length + 1.15, y: 1.0 + ((j * 5) % 4) * 1.6, speed: 0.8 });
  });

  // ---------- หน้าต่างของขวัญ ----------
  var modal = $('#modal'), sheet = $('#sheet'), closeBtn = $('#modalClose'), current = null, lastFocus = null, hideTimer = 0;
  var META = {
    letter: { title: '💌 จดหมายถึงเตง', sub: '' },
    coupon: { title: '🎟️ คูปองรัก', sub: 'เลือก 1 ใบ แล้วเก็บไว้ใช้กับเค้าได้เลย' },
    puzzle: { title: '🧩 ต่อจิ๊กซอว์ให้ครบ', sub: 'แตะ 2 ชิ้นเพื่อสลับที่กัน' },
    album: { title: '📸 ความทรงจำของเรา', sub: '' },
    final: { title: '', sub: '' }
  };
  function openPanel(name, arg) {
    if (name === 'finale') return startFinale();
    clearTimeout(hideTimer);
    current = name; lastFocus = document.activeElement;
    $('#modalTitle').textContent = META[name].title;
    $('#modalSub').textContent = META[name].sub;
    $$('.panel', sheet).forEach(function (p) { p.classList.toggle('on', p.dataset.panel === name); });
    sheet.classList.toggle('wide', name === 'album');
    closeBtn.textContent = name === 'final' ? 'กลับไปเที่ยวจักรวาลต่อ ✦' : 'ปิด ✦';
    modal.hidden = false; sheet.scrollTop = 0;
    requestAnimationFrame(function () { requestAnimationFrame(function () { modal.classList.add('open'); }); });
    if (name === 'letter') Letter.open();
    if (name === 'coupon') Coupon.open();
    if (name === 'puzzle') Puzzle.open();
    if (name === 'album') Album.open(arg);
    if (NEED.indexOf(name) >= 0) { seen[name] = true; refreshSeen(); }
    closeBtn.focus({ preventScroll: true });
  }
  function closePanel() {
    if (!current) return;
    var was = current; current = null;
    modal.classList.remove('open');
    hideTimer = setTimeout(function () { modal.hidden = true; }, 460);
    if (was === 'letter') Letter.stop();
    if (was === 'final') endFinale();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (_) {} }
    if (C.lockFinale && remaining() === 0 && !unlockedToast && was !== 'final') {
      unlockedToast = true;
      setTimeout(function () { toast('ปลดล็อกเซอร์ไพรส์สุดท้ายแล้ว 🎁 กดดูได้เลย', 4200); FX.burstAt(giftBtn, 18); }, 500);
    }
  }
  closeBtn.addEventListener('click', closePanel);
  modal.addEventListener('pointerdown', function (e) { if (e.target === modal) closePanel(); });
  $$('#dock button').forEach(function (b) { b.addEventListener('click', function () { openPanel(b.dataset.open); }); });

  // ---------- จดหมาย (พิมพ์ทีละตัวอักษร) ----------
  var Letter = (function () {
    var box = $('#letterBody'), timer = 0, done = false;
    var parts = [{ cls: 'to', text: C.letter.to }]
      .concat(C.letter.body.map(function (t) { return { cls: '', text: t.replace('{n}', T0.th) }; }))
      .concat([{ cls: 'sign', text: C.letter.sign }]);
    function split(t) {
      if (window.Intl && Intl.Segmenter) { var out = []; var it = new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(t); for (var s of it) out.push(s.segment); return out; }
      return Array.from(t);
    }
    function full() {
      clearTimeout(timer); box.innerHTML = '';
      parts.forEach(function (p) { box.appendChild(el('p', p.cls, p.text)); });
      done = true;
    }
    function type() {
      box.innerHTML = ''; var pi = 0, ci = 0, chars = split(parts[0].text), node = el('p', parts[0].cls + ' typing');
      box.appendChild(node);
      (function next() {
        if (ci < chars.length) {
          node.textContent += chars[ci++];
          if (sheet.scrollHeight > sheet.clientHeight) sheet.scrollTop = sheet.scrollHeight;
          timer = setTimeout(next, /[ .,!?]/.test(chars[ci - 1]) ? 70 : 34);
        } else {
          node.classList.remove('typing'); pi++;
          if (pi >= parts.length) { done = true; return; }
          chars = split(parts[pi].text); ci = 0; node = el('p', parts[pi].cls + ' typing'); box.appendChild(node);
          timer = setTimeout(next, 420);
        }
      })();
    }
    box.addEventListener('click', function () { if (!done) full(); });
    return { open: function () { if (done) full(); else type(); }, stop: function () { if (!done) full(); } };
  })();

  // ---------- คูปองรัก ----------
  var Coupon = (function () {
    var box = $('#cards'), again = $('#reshuffle'), dealt = false;
    function deal() {
      var old = $('.ticket', box.parentNode); if (old) old.remove();
      box.innerHTML = ''; box.classList.remove('picked'); again.hidden = true;
      var pool = C.coupons.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 5);
      pool.forEach(function (c, i) {
        var b = el('button', 'card'); b.type = 'button'; b.setAttribute('aria-label', 'การ์ดใบที่ ' + (i + 1));
        b.style.animation = 'rise .6s cubic-bezier(.22,1,.36,1) ' + (i * 80) + 'ms both';
        var inner = el('span', 'card-in');
        inner.appendChild(el('span', 'face back', '♥')); inner.appendChild(el('span', 'face front', c.icon));
        b.appendChild(inner);
        b.addEventListener('click', function () { pick(b, c); });
        box.appendChild(b);
      });
      dealt = true;
    }
    function pick(b, c) {
      if (box.classList.contains('picked')) return;
      b.style.animation = 'none';
      b.classList.add('flip'); box.classList.add('picked');
      setTimeout(function () {
        var t = el('div', 'ticket');
        t.appendChild(el('small', '', 'LOVE COUPON'));
        t.appendChild(el('strong', '', c.icon + ' ' + c.title));
        t.appendChild(el('span', '', c.text));
        t.appendChild(el('em', '', 'ใช้ได้ 1 ครั้ง · ไม่มีวันหมดอายุ · แคปหน้าจอเก็บไว้ได้เลย'));
        box.parentNode.insertBefore(t, again);
        again.hidden = false;
        FX.burstAt(b, 30);
        sheet.scrollTop = sheet.scrollHeight;
      }, 650);
    }
    again.addEventListener('click', deal);
    return { open: function () { if (!dealt) deal(); } };
  })();

  // ---------- จิ๊กซอว์ (แตะ 2 ชิ้นเพื่อสลับ) ----------
  var Puzzle = (function () {
    var box = $('#puzzle'), status = $('#puzzleStatus'), reset = $('#puzzleReset'), N = 3, order = [], sel = -1, built = false, solved = false;
    function shuffle() {
      order = []; for (var i = 0; i < N * N; i++) order.push(i);
      do { order.sort(function () { return Math.random() - 0.5; }); } while (correct() > 2);
    }
    function correct() { var n = 0; for (var i = 0; i < order.length; i++) if (order[i] === i) n++; return n; }
    function paint(btn, piece) {
      btn.style.backgroundPosition = ((piece % N) * 100 / (N - 1)) + '% ' + (Math.floor(piece / N) * 100 / (N - 1)) + '%';
    }
    function build() {
      shuffle(); box.innerHTML = ''; box.classList.remove('solved'); solved = false; sel = -1; reset.hidden = false;
      status.classList.remove('done');
      order.forEach(function (piece, pos) {
        var b = el('button', 'piece'); b.type = 'button'; b.setAttribute('aria-label', 'ช่องที่ ' + (pos + 1));
        paint(b, piece);
        b.addEventListener('click', function () { tap(pos); });
        box.appendChild(b);
      });
      update(); built = true;
    }
    function update() { status.textContent = 'ถูกที่แล้ว ' + correct() + ' / ' + (N * N) + ' ชิ้น'; }
    function tap(pos) {
      if (solved) return;
      var btns = box.children;
      if (sel < 0) { sel = pos; btns[pos].classList.add('sel'); return; }
      if (sel === pos) { btns[pos].classList.remove('sel'); sel = -1; return; }
      var a = sel, t = order[a]; order[a] = order[pos]; order[pos] = t; sel = -1;
      [a, pos].forEach(function (i) {
        var b = btns[i]; b.classList.remove('sel', 'swap'); paint(b, order[i]);
        void b.offsetWidth; b.classList.add('swap');
      });
      update();
      if (correct() === N * N) {
        solved = true; box.classList.add('solved'); reset.hidden = true;
        status.textContent = C.puzzleDone; status.classList.add('done');
        setTimeout(function () { FX.burstAt(box, 44); }, 500);
      }
    }
    reset.addEventListener('click', build);
    return { open: function () { if (!built) build(); } };
  })();

  // ---------- อัลบั้ม ----------
  var Album = (function () {
    var img = $('#albumImg'), cap = $('#albumCap'), date = $('#albumDate'), frame = $('#polaroid'), thumbs = $('#thumbs'), idx = 0, built = false;
    function build() {
      PHOTOS.forEach(function (p, i) {
        var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'รูปที่ ' + (i + 1));
        var t = new Image(); t.loading = 'lazy'; t.src = p.thumb; t.alt = '';
        b.appendChild(t); b.addEventListener('click', function () { show(i); });
        thumbs.appendChild(b);
      });
      built = true;
    }
    function show(i) {
      idx = (i + PHOTOS.length) % PHOTOS.length;
      var p = PHOTOS[idx];
      img.src = p.src; img.width = p.w; img.height = p.h; img.alt = C.captions[p.id] || 'รูปความทรงจำ';
      cap.textContent = C.captions[p.id] || '';
      date.textContent = p.date || '';
      $('#modalSub').textContent = 'รูปที่ ' + (idx + 1) + ' จาก ' + PHOTOS.length;
      frame.style.transform = 'rotate(' + (((idx * 7) % 5) - 2) * 0.7 + 'deg)';
      frame.classList.remove('in'); void frame.offsetWidth; frame.classList.add('in');
      $$('button', thumbs).forEach(function (b, k) { b.classList.toggle('on', k === idx); });
      var tb = thumbs.children[idx];
      if (tb) thumbs.scrollLeft = tb.offsetLeft - thumbs.clientWidth / 2 + tb.offsetWidth / 2;
      var nx = PHOTOS[(idx + 1) % PHOTOS.length]; (new Image()).src = nx.src;   // โหลดรูปถัดไปรอไว้
    }
    $('#albumPrev').addEventListener('click', function () { show(idx - 1); });
    $('#albumNext').addEventListener('click', function () { show(idx + 1); });
    var sx = null;
    frame.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    frame.addEventListener('pointerup', function (e) {
      if (sx == null) return; var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
    });
    frame.addEventListener('pointercancel', function () { sx = null; });
    return {
      open: function (i) { if (!built) build(); show(typeof i === 'number' && i >= 0 ? i : idx); },
      step: function (d) { show(idx + d); }
    };
  })();

  // ---------- ฉากจบ ----------
  var fA = $('#finaleA'), fB = $('#finaleB'), fNext = $('#finaleNext'), finaleTimers = [], inFinale = false;
  fA.textContent = C.finale.lines[0]; fB.textContent = C.finale.lines[1];
  (function () {
    var p = photoById(C.finale.photo), im = $('#finalImg');
    im.src = p.src; im.width = p.w; im.height = p.h; im.alt = 'รูปคู่ของเรา';
    $('#finalKicker').textContent = C.finale.title;
  })();
  function startFinale() {
    if (inFinale) return;
    var left = C.lockFinale ? remaining() : 0;
    if (left > 0) { toast('ยังเปิดไม่ครบเลยน้า เหลืออีก ' + left + ' อย่าง ลองเปิดดูให้ครบก่อนนะ 🔒', 3400); return; }
    inFinale = true;
    body.classList.add('is-finale'); body.classList.remove('show-hint');
    Galaxy.finale(true);
    finaleTimers.push(setTimeout(function () { fA.classList.add('show'); }, 900));
  }
  Galaxy.on('finaleFormed', function () {
    if (!inFinale) return;
    fB.classList.add('show');
    FX.rain(2600);
    finaleTimers.push(setTimeout(function () { fNext.classList.add('show'); }, 2600));
  });
  fNext.addEventListener('click', function () {
    $('#finalMsg').textContent = C.finale.message.replace('{days}', together().days);
    fNext.classList.remove('show');
    openPanel('final');
    FX.rain(5200);
  });
  function endFinale() {
    finaleTimers.forEach(clearTimeout); finaleTimers = [];
    fA.classList.remove('show'); fB.classList.remove('show'); fNext.classList.remove('show');
    body.classList.remove('is-finale'); inFinale = false;
    Galaxy.finale(false);
  }

  // ---------- หน้าแรก: ใส่รหัส ----------
  var code = '', wrong = 0, opening = false;
  var dots = $('#dots'), gateMsg = $('#gateMsg'), keypad = $('#keypad');
  function paintDots() { $$('i', dots).forEach(function (d, i) { d.classList.toggle('on', i < code.length); }); }
  function press(k) {
    if (opening || !C.passcode) return;
    Music.prime();
    if (k === 'del') code = code.slice(0, -1);
    else if (code.length < C.passcode.length) code += k;
    paintDots();
    if (code.length === C.passcode.length) {
      if (code === C.passcode) {
        opening = true; dots.classList.add('win');
        gateMsg.classList.remove('warn'); gateMsg.textContent = 'ถูกต้อง ♡';
        FX.burstAt(dots, 36);
        setTimeout(unlock, 900);
      } else {
        wrong++; dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
        gateMsg.classList.add('warn');
        gateMsg.textContent = wrong >= 3 ? C.passcodeHint : 'ยังไม่ใช่น้า ลองนึกดูอีกที';
        setTimeout(function () { code = ''; paintDots(); }, 450);
      }
    }
  }
  keypad.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) press(b.dataset.k); });
  if (!C.passcode) {
    keypad.hidden = true; dots.hidden = true; gateMsg.hidden = true;
    $('#gateAsk').textContent = 'มีของขวัญชิ้นหนึ่ง รอให้เตงเปิดอยู่';
    var go = $('#gateOpen'); go.hidden = false;
    go.addEventListener('click', function () { if (opening) return; opening = true; Music.prime(); FX.burstAt(go, 36); setTimeout(unlock, 500); });
  }

  function unlock() {
    body.classList.remove('is-locked'); body.classList.add('is-intro');
    Music.play();
    Galaxy.start();
    setTimeout(function () { body.classList.add('title-in'); }, 2400);
  }
  Galaxy.on('ready', function () {
    body.classList.remove('is-intro', 'title-in'); body.classList.add('is-live', 'show-hint');
    refreshSeen();
    setTimeout(function () { body.classList.remove('show-hint'); }, 9000);
  });

  // ---------- คีย์บอร์ด ----------
  document.addEventListener('keydown', function (e) {
    if (body.classList.contains('is-locked')) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      return;
    }
    if (!current) return;
    if (e.key === 'Escape') closePanel();
    else if (current === 'album' && e.key === 'ArrowLeft') Album.step(-1);
    else if (current === 'album' && e.key === 'ArrowRight') Album.step(1);
  });

  // โหลดรูปที่ต้องใช้แน่ ๆ รอไว้ก่อน
  (new Image()).src = 'photos/puzzle.jpg';
  refreshSeen();
})();
