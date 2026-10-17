/* Coffre-fort des cadeaux du tournoi (Quiz en direct). Charge a la demande par app.js (_giftLoad).
   Rendu dans un shadow DOM : le style du site ne touche pas l'animation, et inversement.
   L'etat est sur le serveur (stage 0 = coffre ferme, 1 = coffre ouvert + Libs verses, 2 = enveloppe ouverte + objets donnes). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const KEY = 'libero_livegift';
  const D = {
    fr: {
      ttl: { gold: 'Un cadeau emballé vous attend', silver: 'Un cadeau emballé vous attend', bronze: 'Un cadeau emballé vous attend', violet: 'Coffre du finaliste', ice: 'Coffre du demi-finaliste', wood: 'Coffre du participant' },
      sub: { gold: 'Champion du tournoi', silver: 'Vice-champion du tournoi', bronze: 'Sur le podium du tournoi', violet: 'Tu as atteint la finale', ice: 'Tu as atteint la demi-finale', wood: "Merci d'avoir joué le tournoi" },
      rank: n => `Ton rang final : ${n}`, open: 'Ouvrir le coffre', tip: "Touche l'enveloppe pour l'ouvrir", done: 'Terminer', close: 'Fermer', equip: 'Équiper', equipped: 'Équipé',
      excl: 'Inédit', shop: 'Boutique', libs: 'Libs', brand: 'LIBERO  VAULT', prev: 'Mode essai', err: 'Connexion perdue, réessaie.', bonus: 'Bonus', pf: 'Cadre de portrait', bub: 'Bulle de chat', ttl2: 'Titre',
      cats: { color: 'Couleur de pseudo', bubble: 'Bulle de chat', font: 'Police', nameeffect: 'Effet de pseudo' },
    },
    en: {
      ttl: { gold: 'A wrapped gift is waiting for you', silver: 'A wrapped gift is waiting for you', bronze: 'A wrapped gift is waiting for you', violet: 'Finalist vault', ice: 'Semifinalist vault', wood: 'Participant vault' },
      sub: { gold: 'Tournament champion', silver: 'Tournament runner-up', bronze: 'On the tournament podium', violet: 'You reached the final', ice: 'You reached the semifinal', wood: 'Thanks for playing the tournament' },
      rank: n => `Your final rank: ${n}`, open: 'Open the vault', tip: 'Tap the envelope to open it', done: 'Done', close: 'Close', equip: 'Equip', equipped: 'Equipped',
      excl: 'Exclusive', shop: 'Shop', libs: 'Libs', brand: 'LIBERO  VAULT', prev: 'Test mode', err: 'Connection lost, try again.', bonus: 'Bonus', pf: 'Portrait frame', bub: 'Chat bubble', ttl2: 'Title',
      cats: { color: 'Name color', bubble: 'Chat bubble', font: 'Font', nameeffect: 'Name effect' },
    },
  };
  const U = () => D[L()];
  // Palette du coffre selon le rang general (rang 1 a 3 : or, argent, bronze ; 4 a 10 ; 11 a 15 ; 16 et plus)
  const PAL = {
    gold: '--m1:#f2c94e;--m2:#a8741a;--gl:#ffe18a;--p1:#f7e7b0;--p2:#d9b25a',
    silver: '--m1:#e4ebf3;--m2:#8793a3;--gl:#d9edff;--p1:#f4f7fb;--p2:#b6c2d1',
    bronze: '--m1:#dc9558;--m2:#8a4d1f;--gl:#ffbf85;--p1:#f2d3b0;--p2:#c0804a',
    violet: '--m1:#bc9ff4;--m2:#6a4ab5;--gl:#dcc7ff;--p1:#e3d6fa;--p2:#9b82d6',
    ice: '--m1:#aee0f7;--m2:#4f8db0;--gl:#cdf2ff;--p1:#e2f4fc;--p2:#8fc4de',
    wood: '--m1:#9a9a9a;--m2:#4e4e4e;--gl:#ffd9a0;--p1:#e8d5b0;--p2:#b9996a',
  };
  const CONF = { gold: ['#ffd84a', '#ff6b5b', '#fff', '#7bd6ff'], silver: ['#e3eaf2', '#9ec9ff', '#fff'], bronze: ['#e3a566', '#ffcf8a', '#fff'], violet: ['#b69af0', '#fff', '#e0c8ff'], ice: ['#c9f0ff', '#fff', '#8fd3f2'], wood: ['#ffd9a0'] };
  const NCONF = { gold: 90, silver: 70, bronze: 50, violet: 36, ice: 22, wood: 0 };
  const PF = { gold: ['#e0a82e', 'shine crown'], silver: ['#cfd8e3', 'shine'], bronze: ['#c8803f', 'shine'], finalist: ['#b69af0', 'stars'], semi: ['#8fd3f2', ''] };
  const BUB = { gold: 'gold', silver: 'silver', bronze: 'bronze' };
  const TTLC = { champion: '#e0a82e', vice: '#cfd8e3', podium: '#c8803f', finalist: '#b69af0', semi: '#8fd3f2' };

  let host = null, root = null, st = null, G = null, TM = [], P = [], raf = 0, AC = null, pend = 0, pendT = 0, closed = true, opening = false;
  const $ = s => root.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (ms, fn) => { TM.push(setTimeout(fn, ms)); };
  const prm = () => { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { return false; } };

  // ── Sons (synthese, comme dans la maquette) : respectent le reglage « effets sonores » du site ──
  const sfxOn = () => (typeof sfxEnabled === 'undefined' || !!sfxEnabled);
  const vol = () => (typeof sfxVolume === 'number' && !isNaN(sfxVolume) ? Math.max(0.05, Math.min(1, sfxVolume * 2)) : 1);
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return AC; }
  function tone(f, d, ty, v, sl) { if (!sfxOn()) return; const a = ac(); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(), n = a.currentTime; o.type = ty || 'sine'; o.frequency.setValueAtTime(f, n); if (sl) o.frequency.exponentialRampToValueAtTime(sl, n + d); g.gain.setValueAtTime((v || .12) * vol(), n); g.gain.exponentialRampToValueAtTime(.0001, n + d); o.connect(g); g.connect(a.destination); o.start(); o.stop(n + d); } catch {} }
  function noise(d, v, fq, ty) { if (!sfxOn()) return; const a = ac(); if (!a) return; try { const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), da = b.getChannelData(0); for (let i = 0; i < n; i++) da[i] = Math.random() * 2 - 1; const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = ty || 'lowpass'; f.frequency.value = fq || 800; const g = a.createGain(); g.gain.setValueAtTime(v * vol(), a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); s.connect(f); f.connect(g); g.connect(a.destination); s.start(); } catch {} }
  const SFX = {
    tick() { tone(2100, .04, 'square', .05); },
    clunk() { tone(95, .4, 'sine', .5, 38); noise(.22, .3, 500); },
    hiss() { noise(1.8, .16, 2500, 'highpass'); },
    whirr() { tone(180, 1, 'sawtooth', .04, 640); },
    boom() { tone(62, 1, 'sine', .7, 28); noise(.6, .4, 220); },
    chime() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 1, 'sine', .12), i * 100)); },
    coin() { tone(2400 + Math.random() * 900, .1, 'triangle', .04); },
  };

  // ── Particules (canvas) : pieces d'or, etincelles, poussiere ──
  function fxInit() { const c = $('#fx'); if (!c) return; c.width = st.offsetWidth; c.height = st.offsetHeight; }
  function runFx() {
    if (raf) return;
    (function loop() {
      const c = $('#fx'); if (!c || closed) { raf = 0; return; }
      const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      P = P.filter(p => {
        p.t++;
        if (p.k === 'coin') {
          p.x += p.vx; p.y += p.vy; p.vy += .34; p.r += p.vr; const w = Math.abs(Math.cos(p.r)) * p.s;
          x.save(); x.translate(p.x, p.y); const g = x.createRadialGradient(-w * .3, -p.s * .3, 1, 0, 0, p.s); g.addColorStop(0, '#fff6b8'); g.addColorStop(.5, '#f0b936'); g.addColorStop(1, '#8a5d00');
          x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, Math.max(1, w), p.s, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(90,50,0,.7)'; x.lineWidth = 1; x.stroke();
          if (w < 2.5) { x.fillStyle = '#fff'; x.globalAlpha = .9; x.fillRect(-1, -p.s, 2, p.s * 2); } x.restore();
          if (p.y > c.height + 20) return false;
          if (p.y > c.height - 6 && p.vy > 0 && Math.random() < .02) SFX.coin();
          return true;
        }
        if (p.k === 'spark') { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.a -= .022; if (p.a <= 0) return false; x.strokeStyle = 'rgba(255,' + (200 + p.t % 50) + ',120,' + p.a + ')'; x.lineWidth = p.w; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); x.stroke(); return true; }
        if (p.k === 'dust') { p.x += p.vx; p.y += p.vy; if (p.t >= p.life) return false; if (p.t < 0) return true; const al = p.a * Math.sin(Math.PI * p.t / p.life), g2 = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s); g2.addColorStop(0, 'rgba(255,240,180,' + al + ')'); g2.addColorStop(1, 'rgba(255,240,180,0)'); x.fillStyle = g2; x.beginPath(); x.arc(p.x, p.y, p.s, 0, 7); x.fill(); return true; }
        return false;
      });
      raf = P.length ? requestAnimationFrame(loop) : 0;
    })();
  }
  function cspark(x, y, n, pw) { for (let i = 0; i < n; i++) { const an = Math.random() * 6.28, sp = (pw || 3) * (.4 + Math.random()); P.push({ k: 'spark', t: 0, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 1.5, g: .12, a: 1, w: 1 + Math.random() * 1.6 }); } runFx(); }
  function fountain(x, y, ms) { const n = Math.round(ms / 16); for (let i = 0; i < n; i++) T(i * 16, () => { for (let q = 0; q < (Math.random() < .5 ? 1 : 2); q++) P.push({ k: 'coin', t: 0, x: x + (Math.random() - .5) * 60, y, vx: (Math.random() - .5) * 7, vy: -(9 + Math.random() * 9), r: Math.random() * 6, vr: .15 + Math.random() * .3, s: 6 + Math.random() * 5 }); runFx(); if (i % 6 === 0) SFX.coin(); }); }
  function dust(x, y) { for (let i = 0; i < 70; i++) P.push({ k: 'dust', t: -Math.round(Math.random() * 120), x: x + (Math.random() - .5) * 200, y: y + (Math.random() - .2) * 200, vx: (Math.random() - .5) * .25, vy: -.15 - Math.random() * .35, s: 2 + Math.random() * 3, a: .55 + Math.random() * .4, life: 300 + Math.random() * 300 }); runFx(); }
  function ctr(el) { const r = el.getBoundingClientRect(), sr = st.getBoundingClientRect(); return [r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2]; }
  function fxEl(cls, x, y, ms) { const e = document.createElement('div'); e.className = cls; e.style.left = x + 'px'; e.style.top = y + 'px'; st.appendChild(e); void e.offsetWidth; e.classList.add('go'); T(ms || 3000, () => e.remove()); return e; }
  function burst() { const cf = $('#cf'); if (!cf) return; const cc = CONF[G.tier] || ['#fff'], n = prm() ? 0 : NCONF[G.tier] || 0; for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.style.left = Math.random() * 100 + '%'; e.style.background = cc[i % cc.length]; e.style.animationDuration = (2.4 + Math.random() * 1.8) + 's'; e.style.animationDelay = (Math.random() * .7) + 's'; cf.appendChild(e); } }

  // ── Le coffre-fort (HTML identique a la maquette) ──
  function vaultHtml() {
    let b = '', sp = '', th = '', dn = '', bars = '', k = 0, i;
    for (i = 0; i < 12; i++) b += `<div class="bolt" style="--r:${i * 30}deg"></div>`;
    for (i = 0; i < 3; i++) sp += `<div class="spoke" style="--r:${i * 60}deg"></div>`;
    for (i = 1; i <= 7; i++) th += `<div class="vt" style="transform:translateZ(${-i * 2.4}px);filter:brightness(${(1 - i * .06).toFixed(2)})"></div>`;
    for (i = 0; i < 10; i++) dn += `<span class="dn" style="--a:${i * 36}deg">${i * 10}</span>`;
    [5, 4, 3, 2, 1].forEach(n => { bars += '<div class="brow">'; for (let j = 0; j < n; j++) bars += `<div class="bar" style="--k:${k++}"></div>`; bars += '</div>'; });
    return `<div class="vault" id="vault"><div class="vframe"><div class="rv" style="left:18px;top:60px"></div><div class="rv" style="right:18px;top:60px"></div><div class="rv" style="left:18px;bottom:18px"></div><div class="rv" style="right:18px;bottom:18px"></div><div class="lamps"><i class="lamp"></i><i class="lamp"></i><i class="lamp"></i></div><div class="lcd" id="lcd">00</div><div class="led" id="led"></div>` +
      `<div class="vin"><div class="shelf"></div><div class="bars">${bars}</div></div><div class="vleak"></div><div class="hinge" style="top:20%"></div><div class="hinge" style="bottom:12%"></div>` +
      `<div class="vdoor" id="vdoor">${th}${b}<div class="dial" id="dial">${dn}</div><div class="wheel" id="wheel">${sp}<div class="hub"></div></div></div><div class="vbrand">${U().brand}</div></div></div>`;
  }
  function mount(g) {
    let ready;
    const d = U();
    root.innerHTML = '';
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'live-gift.css?v=1';
    ready = new Promise(res => { link.onload = res; link.onerror = res; setTimeout(res, 3500); }); root.appendChild(link);
    const wrap = document.createElement('div'); wrap.className = 'ov'; wrap.setAttribute('style', PAL[g.tier] || PAL.wood);
    wrap.innerHTML = `<div class="stage" id="stage"><button class="x" id="x" type="button">${d.close}</button>${g.test ? `<span class="prev">${d.prev}</span>` : ''}` +
      `<div class="vig"></div><div class="rays"></div><div class="beam"></div><canvas id="fx"></canvas><div class="confetti" id="cf"></div><div class="flash" id="flash"></div>` +
      `<h2 class="ttl">${esc(d.ttl[g.tier])}</h2><div class="sub">${esc(d.sub[g.tier])}</div><div class="rk">${esc(d.rank(g.rank))}</div>` +
      `<div class="scene">${vaultHtml()}</div><div class="btnrow" id="btns"></div>` +
      `<div class="reward"><div class="libs" id="libs"><i></i><b data-count="${+g.libs || 0}">0</b><small>${d.libs}</small></div>` +
      `<div class="genv" id="genv"><div class="gfo"></div><div class="gbody"></div><div class="gfront"></div><div class="gline"></div><div class="gfc"></div><div class="gseal"><div class="sh l">L</div><div class="sh r">L</div></div></div>` +
      `<div class="gtip" id="gtip">${d.tip}</div><div class="items" id="items"></div></div>` +
      `<div class="btnrow" id="btns2"></div></div>`;
    root.appendChild(wrap);
    st = $('#stage');
    $('#x').onclick = close;
    return ready;
  }

  // ── Sequence d'ouverture du coffre-fort (identique a la maquette) ──
  function openVault(done) {
    const v = $('#vault'), dial = $('#dial'), lamps = [].slice.call(v.querySelectorAll('.lamp')), lcd = $('#lcd'), led = $('#led'), door = $('#vdoor'), wheel = $('#wheel'), sc = st.querySelector('.scene');
    const c = ctr(v.querySelector('.vin'));
    st.classList.add('dark');
    const stops = [[420, 200, '27'], [1250, -150, '81'], [2080, 260, '44']];
    stops.forEach((s, i) => {
      T(s[0], () => { dial.style.transform = 'rotate(' + s[1] + 'deg)'; SFX.whirr(); });
      T(s[0] + 800, () => { SFX.tick(); lamps[i].classList.add('on'); lcd.textContent = s[2]; v.classList.remove('vib'); void v.offsetWidth; v.classList.add('vib'); cspark(c[0] - 90 + i * 40, c[1] - 120, 8, 2.4); });
    });
    T(3050, () => { SFX.clunk(); lcd.textContent = 'OPEN'; v.classList.remove('vib'); void v.offsetWidth; v.classList.add('vib2'); cspark(c[0], c[1], 26, 5); });
    T(3250, () => { wheel.classList.add('spin'); SFX.whirr(); v.classList.add('vib2'); });
    T(3300, () => { sc.style.transform = 'scale(1.12)'; });
    T(4350, () => {
      v.classList.add('leak1'); door.classList.add('unlock');
      [].slice.call(v.querySelectorAll('.bolt')).forEach((b, i) => T(i * 60, () => { const a = i * 30 * Math.PI / 180; cspark(c[0] + Math.cos(a) * 102, c[1] + Math.sin(a) * 102, 7, 3.2); if (i % 3 === 0) SFX.clunk(); }));
    });
    T(5200, () => {
      v.classList.remove('vib2'); v.classList.add('leak2'); SFX.hiss();
      [[-125, -40, -70, -60], [125, -40, 70, -60], [0, -135, 10, -90], [-120, 90, -60, -10], [120, 90, 60, -10], [0, 150, 20, 60]].forEach((p, i) => {
        const e = document.createElement('div'); e.className = 'steam'; e.style.left = (c[0] + p[0] - 45) + 'px'; e.style.top = (c[1] + p[1] - 45) + 'px'; e.style.setProperty('--sx', p[2] + 'px'); e.style.setProperty('--sy', p[3] + 'px'); e.style.setProperty('--sd', (i * .12) + 's'); st.appendChild(e); void e.offsetWidth; e.classList.add('go'); T(3200, () => e.remove());
      });
    });
    T(5900, () => { led.classList.add('on'); SFX.clunk(); cspark(c[0], c[1], 18, 4); });
    T(6300, () => {
      SFX.boom(); door.classList.add('swing'); st.classList.remove('dark'); st.classList.add('opened');
      $('#flash').classList.add('go'); fxEl('shock', c[0], c[1], 1500); fxEl('flare', c[0], c[1], 2800);
      [[-110, -70], [-60, -38], [70, 44], [130, 80]].forEach((g, i) => { fxEl('ghost', c[0] + g[0], c[1] + g[1], 2600).style.animationDelay = (i * .08) + 's'; });
      sc.style.transform = 'scale(1.04)';
    });
    T(6700, () => { SFX.chime(); fountain(c[0], c[1] + 10, 1300); burst(); cspark(c[0], c[1], 60, 8); dust(c[0], c[1] - 20); });
    T(7500, () => cspark(c[0], c[1] - 40, 40, 6));
    T(8600, done);
  }
  // Coffre deja ouvert (reprise apres F5, ou rang deja vu) : on montre l'etat final sans rejouer la sequence
  function vaultOpenedStatic() {
    const v = $('#vault'), door = $('#vdoor'), sc = st.querySelector('.scene');
    door.style.transition = 'none'; door.classList.add('unlock', 'swing');
    v.querySelectorAll('.lamp').forEach(l => l.classList.add('on')); $('#lcd').textContent = 'OPEN'; $('#led').classList.add('on'); v.classList.add('leak2');
    st.classList.add('opened'); sc.style.transform = 'scale(1.04)';
    void door.offsetWidth; door.style.transition = '';
  }

  // ── Libs et enveloppe qui sortent du coffre, objets qui sortent de l'enveloppe ──
  function fly(el, from, delay, dur, cb) {
    const to = ctr(el), dx = from[0] - to[0], dy = from[1] - to[1];
    if (!el.animate || prm()) { el.style.opacity = 1; cb && T(delay + 200, cb); return; }
    const an = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(.15) rotate(-25deg)`, opacity: 0 }, { transform: `translate(${dx * .4}px,${dy * .4 - 110}px) scale(.85) rotate(12deg)`, opacity: 1, offset: .5 }, { transform: 'translate(0,0) scale(1.06) rotate(-3deg)', opacity: 1, offset: .82 }, { transform: 'none', opacity: 1 }], { duration: dur, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
    an.onfinish = () => { el.style.opacity = 1; el.style.transform = 'none'; an.cancel(); const t2 = ctr(el); cspark(t2[0], t2[1], 8, 3); cb && cb(); };
    T(delay, () => { cspark(from[0], from[1], 10, 3); });
  }
  function countUp(el, from, delay) { const to = +el.dataset.count || 0, s = performance.now() + delay; (function f(n) { if (closed) return; const q = Math.min(1, Math.max(0, (n - s) / 1300)); el.textContent = Math.round(from + (to - from) * q); if (q < 1) requestAnimationFrame(f); })(performance.now()); }
  function emerge() {
    const sc = st.querySelector('.scene'), o = ctr(sc), from = [o[0], o[1] - 40], libs = $('#libs'), g = $('#genv');
    fxInit();
    fly(libs, from, 0, 1100, () => countUp(libs.querySelector('b'), 0, 0));
    fly(g, from, 700, 1300, () => { envReady(g); try { g.scrollIntoView({ behavior: prm() ? 'auto' : 'smooth', block: 'center' }); } catch {} });
  }
  function envReady(g) { g.classList.add('ready'); $('#gtip').classList.add('on'); g.onclick = askEnvelope; opening = false; }

  // ── Objets du coffre ──
  function nameOf(id, type) {
    try { if (type === 'font' && typeof _FONT_DISPLAY_NAMES !== 'undefined' && _FONT_DISPLAY_NAMES[id]) return _FONT_DISPLAY_NAMES[id]; if (typeof _cosmeticNameById === 'function') return _cosmeticNameById(id); } catch {}
    return id;
  }
  function myPt() { try { const s = typeof myPortrait !== 'undefined' && myPortrait && typeof _ptSvg === 'function' ? _ptSvg(myPortrait) : ''; return s || (typeof _ptBlank === 'function' ? _ptBlank() : '') || ''; } catch { return ''; } }
  function itemList(g) {
    const d = U(), out = [];
    (g.items || []).forEach(id => {
      const nm = nameOf(id, ''), k = id.split('-').pop();
      if (id.startsWith('pframe-')) { const f = PF[k] || PF.gold; out.push({ id, type: 'pframe', html: `<div class="av ${f[1]}" style="--fc:${f[0]}"><span class="avi">${myPt()}</span></div><div class="nm">${esc(nm)}</div><span class="cat">${d.pf}</span><span class="tag">${d.excl}</span>` }); }
      else if (id.startsWith('bubble-')) { out.push({ id, type: 'bubble', html: `<div class="bub ${BUB[k] || 'gold'}">${esc(nm)}</div><span class="cat">${d.bub}</span><span class="tag">${d.excl}</span>` }); }
      else if (id.startsWith('title-')) { out.push({ id, type: 'title', html: `<span class="ttlbadge" style="--fc:${TTLC[k] || '#e0a82e'}">${esc(nm)}</span><span class="cat">${d.ttl2}</span><span class="tag">${d.excl}</span>` }); }
    });
    if (g.shop) out.push({ id: g.shop, type: g.shopType || 'bubble', shop: true, html: `<div class="roul nm">${esc(nameOf(g.shop, g.shopType))}</div><span class="cat">${esc(d.cats[g.shopType] || '')}</span><span class="tag shop">${d.shop}</span>` });
    if (g.bonus) out.push({ id: '', type: '', html: `<b>${g.bonus}</b><span class="cat">${d.libs}</span><span class="tag shop">${d.bonus}</span>` });
    return out;
  }
  function buildSlots(g) {
    const items = $('#items'), d = U(), list = itemList(g);
    items.innerHTML = list.map((it, i) => `<div class="slot" data-i="${i}">${it.html}${it.id && !g.test ? `<button class="eqb" type="button" data-id="${esc(it.id)}" data-t="${it.type}">${d.equip}</button>` : ''}</div>`).join('');
    items.querySelectorAll('.eqb').forEach(b => b.onclick = () => {
      try { socket.emit('equip-cosmetic', { cosmeticId: b.dataset.id, type: b.dataset.t, playerId: getPlayerId() }); } catch {}
      items.querySelectorAll('.eqb').forEach(o => { if (o.dataset.t === b.dataset.t) { o.disabled = false; o.textContent = d.equip; } });
      b.disabled = true; b.textContent = d.equipped;
    });
    return list;
  }
  function roulette(slot, g) {
    const r = slot.querySelector('.roul'); if (!r || !g.shop) return;
    const maps = { color: 'shopCosmeticNames', bubble: 'shopBubbleNames', nameeffect: 'shopNameEffectNames' }; let names = [];
    try { const m = (typeof t === 'function' ? t() : {})[maps[g.shopType]]; if (m) names = Object.values(m); } catch {}
    const final = nameOf(g.shop, g.shopType); if (names.length < 3 || prm()) { r.textContent = final; return; }
    let k = 0, n = 0; const id = setInterval(() => { if (closed) return clearInterval(id); r.textContent = names[(k += 1 + Math.floor(Math.random() * 3)) % names.length]; if (++n > 14) { clearInterval(id); r.textContent = final; } }, 90);
  }
  function flyItems() {
    const g = $('#genv'), o = ctr(g), from = [o[0], o[1] - 30], list = buildSlots(G);
    fxInit(); g.classList.add('open'); $('#gtip').classList.remove('on');
    const slots = [].slice.call(st.querySelectorAll('.slot'));
    slots.forEach(s => { s.style.opacity = 0; });
    try { $('#items').scrollIntoView({ behavior: prm() ? 'auto' : 'smooth', block: 'center' }); } catch {}
    slots.forEach((s, i) => { fly(s, from, 900 + i * 520, 1000, null); if (list[i].shop) T(1900 + i * 520, () => roulette(s, G)); });
    SFX.chime(); burst();
    T(900 + slots.length * 520 + 1200, () => { opening = false; finalButtons(); });
  }
  function finalButtons() {
    const b = $('#btns2'); if (!b) return;
    b.innerHTML = `<button class="btn" id="end" type="button">${U().done}</button>`;
    try { b.scrollIntoView({ behavior: prm() ? 'auto' : 'smooth', block: 'end' }); } catch {}
    $('#end').onclick = close;
  }

  // ── Interactions ──
  function askOpen() {
    if (opening) return; opening = true; $('#btns').innerHTML = '';
    pend = 1; clearTimeout(pendT); pendT = setTimeout(() => failPending(), 6000);
    try { socket.emit('live-gift-open', { playerId: getPlayerId(), stage: 1, preview: !!G.test }); } catch { failPending(); }
  }
  function askEnvelope() {
    const g = $('#genv'); if (opening || g.classList.contains('open')) return; opening = true; g.classList.remove('ready'); g.onclick = null;
    pend = 2; clearTimeout(pendT); pendT = setTimeout(() => failPending(), 6000);
    try { socket.emit('live-gift-open', { playerId: getPlayerId(), stage: 2, preview: !!G.test }); } catch { failPending(); }
  }
  function failPending() {
    const was = pend; pend = 0; opening = false;
    try { showCursorSnakeToast(U().err); } catch {}
    if (was === 1) showOpenBtn(); else if (was === 2) envReady($('#genv'));
  }
  function showOpenBtn() { const b = $('#btns'); if (!b) return; b.innerHTML = `<button class="btn" id="go" type="button">${U().open}</button>`; $('#go').onclick = askOpen; }

  // reponse serveur (stage mis a jour)
  function on(g) {
    if (!g) { if (!closed && !G) close(); return; }
    if (closed || !G) return;
    G = Object.assign({}, G, g);
    if (pend === 1 && g.stage >= 1) { pend = 0; clearTimeout(pendT); prm() ? (vaultOpenedStatic(), emerge()) : openVault(emerge); }
    else if (pend === 2 && g.stage >= 2) { pend = 0; clearTimeout(pendT); flyItems(); }
    else if (pend) { /* serveur n'a pas avance : on laisse le delai d'erreur */ }
  }

  // ── Ouverture / fermeture ──
  function ensureHost() {
    if (host) return;
    host = document.createElement('div'); host.id = 'live-gift-host'; root = host.attachShadow({ mode: 'open' }); document.body.appendChild(host);
  }
  async function open(g) {
    if (!g) return;
    ensureHost(); closed = false; opening = false; pend = 0; clearTimeout(pendT); TM.forEach(clearTimeout); TM = []; P = []; G = Object.assign({}, g);
    try { sessionStorage.setItem(KEY, G.test ? 'p:' + G.rank : '1'); } catch {}
    host.style.display = ''; document.documentElement.style.overflow = 'hidden';
    await mount(G); if (closed) return; fxInit();
    if (G.stage === 0) { showOpenBtn(); return; }
    // reprise : coffre deja ouvert (Libs deja verses)
    vaultOpenedStatic();
    const libs = $('#libs'); libs.style.opacity = 1; libs.querySelector('b').textContent = +G.libs || 0;
    const g2 = $('#genv'); g2.style.opacity = 1;
    if (G.stage === 1) { envReady(g2); return; }
    g2.classList.add('open'); buildSlots(G).length; st.querySelectorAll('.slot').forEach(s => { s.style.opacity = 1; }); finalButtons();
  }
  function close() {
    closed = true; TM.forEach(clearTimeout); TM = []; P = []; pend = 0; clearTimeout(pendT); cancelAnimationFrame(raf); raf = 0;
    if (root) root.innerHTML = '';
    if (host) host.style.display = 'none';
    document.documentElement.style.overflow = '';
    try { sessionStorage.removeItem(KEY); } catch {}
    G = null; window._liveGiftSync?.();
  }
  window.LiberoGift = { open, close, on, isOpen: () => !closed };
})();
