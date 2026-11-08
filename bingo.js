/* Bingo Libero : ta grille de 9 objectifs du week-end. Charge a la demande par app.js (_bingoLoad).
   Le serveur (backend/bingo.js) choisit la grille, compte les objectifs et paie les lignes : ici on affiche et on anime. */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = ms => reduce ? 10 : ms;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const ICON = {
    ludoWin: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
    word3: '<path d="M5 18l4-12 4 12M6.5 14h5M16 8v10M16 18h3"/>',
    giftFriend: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M12 10v10M4 14h16M12 10c-3 0-4-4-1-4s1 4 1 4zm0 0c3 0 4-4 1-4s-1 4-1 4z"/>',
    hardBot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
    uno3: '<rect x="6" y="4" width="10" height="15" rx="2"/><path d="M10 9l4 7M14 9l-4 7"/>',
    quiz8: '<circle cx="12" cy="12" r="8"/><path d="M9.500 10a2.500 2.500 0 015 0c0 2-2.500 2-2.500 4M12 17h.01"/>',
    snake50: '<path d="M4 17c4 0 4-5 8-5s4 5 8 5M18 17l2-3"/>',
    addFriend: '<circle cx="10" cy="9" r="3.5"/><path d="M3.500 19c.8-3.500 3-5 6.500-5s5.700 1.500 6.500 5M18 8v6M15 11h6"/>',
    friendWin: '<path d="M7 4h10v5a5 5 0 01-10 0zM12 14v4M8 20h8M4 5h3M17 5h3"/>',
    chessEnd: '<path d="M9 20h6M10 20v-3l-2-3 2-2-1-4 3-3 3 3-1 4 2 2-2 3v3"/>',
    flagsPlay: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    checkersWin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
    connect4Win: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><circle cx="12" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/><circle cx="8" cy="15" r="1.5"/><circle cx="12" cy="15" r="1.5"/>',
    tttWin: '<path d="M9 4v16M15 4v16M4 9h16M4 15h16"/>',
    luffy: '<path d="M4 18h16M7 18l3-8 3 5 3-9"/>',
  };
  const TX = {
    fr: {
      title: 'Bingo Libero', close: 'Fermer', cap: 'Ta grille', sheet: 'Ma grille', cardOf: n => `grille de ${n}`, goals: 'Objectifs', lines: 'Lignes', lineRow: n => `Lignes complètes : 150 × ${n}`, fullRow: 'Grille complète',
      endsIn: 'Fin dans', until: '(lundi 00:00, heure du Bénin)', hint: 'Les objectifs se valident tout seuls pendant que tu joues.', done: 'FAIT', recv: 'REÇU',
      rules: ['<b>150 Libs</b> par ligne, colonne ou diagonale, une seule fois chacune.', '<b>1000 Libs</b> pour la grille complète, en plus des lignes.', 'Ta grille est à toi seul. Elle se ferme lundi à 00:00.'],
      toastT: 'Objectif validé', toastLine: n => `Ligne complète : +${n} Libs`, toastFull: n => `Grille complète : +${n} Libs`, step: (n, m) => `${n} sur ${m}`,
      full: 'Bravo, grille complète !', fullT: 'Total gagné', lineSum: n => `${n} lignes complètes`, endT: 'Bingo terminé', endMsg: 'Le Bingo est fini. Retrouve ton bilan ci-dessous.', wait: 'Le Bingo commence samedi à 00:00.', closedStamp: 'CLÔTURÉ', bingo: 'BINGO !', libs: 'Libs',
      ends: 'Libs gagnés', loading: 'Chargement',
      g: {
        ludoWin: "Gagner une partie de Ludo contre d'autres joueurs", word3: 'Trouver Le Mot du jour en 3 essais maximum', giftFriend: 'Offrir un cadeau à un ami', hardBot: 'Battre le robot difficile (échecs, dames ou Puissance 4)', uno3: "Jouer 3 parties de Uno avec d'autres joueurs",
        quiz8: 'Réussir un quiz avec au moins 8 bonnes réponses', snake50: 'Faire 50 points au Snake', addFriend: 'Ajouter un ami', friendWin: 'Gagner contre un ami', chessEnd: "Terminer une partie d'échecs", flagsPlay: 'Jouer une partie de drapeaux', checkersWin: 'Gagner une partie de dames',
        connect4Win: 'Gagner au Puissance 4', tttWin: 'Gagner au Morpion', luffy: 'Faire 20 points à Libero Run',
      },
    },
    en: {
      title: 'Libero Bingo', close: 'Close', cap: 'Your card', sheet: 'My card', cardOf: n => `${n}'s card`, goals: 'Goals', lines: 'Lines', lineRow: n => `Completed lines: 150 × ${n}`, fullRow: 'Full card',
      endsIn: 'Ends in', until: '(Monday 00:00, Benin time)', hint: 'Goals are validated automatically while you play.', done: 'DONE', recv: 'PAID',
      rules: ['<b>150 Libs</b> per row, column or diagonal, once each.', '<b>1000 Libs</b> for the full card, on top of the lines.', 'Your card is yours alone. It closes on Monday at 00:00.'],
      toastT: 'Goal done', toastLine: n => `Line complete: +${n} Libs`, toastFull: n => `Full card: +${n} Libs`, step: (n, m) => `${n} of ${m}`,
      full: 'Well done, full card!', fullT: 'Total won', lineSum: n => `${n} lines completed`, endT: 'Bingo is over', endMsg: 'The Bingo has ended. Your summary is below.', wait: 'Bingo starts on Saturday at 00:00.', closedStamp: 'CLOSED', bingo: 'BINGO!', libs: 'Libs',
      ends: 'Libs won', loading: 'Loading',
      g: {
        ludoWin: 'Win a Ludo game against other players', word3: 'Find The Word of the day in 3 tries or fewer', giftFriend: 'Give a gift to a friend', hardBot: 'Beat the hard robot (chess, checkers or Connect 4)', uno3: 'Play 3 Uno games with other players',
        quiz8: 'Finish a quiz with at least 8 correct answers', snake50: 'Score 50 points at Snake', addFriend: 'Add a friend', friendWin: 'Win against a friend', chessEnd: 'Finish a chess game', flagsPlay: 'Play a flags game', checkersWin: 'Win a checkers game',
        connect4Win: 'Win at Connect 4', tttWin: 'Win at Tic Tac Toe', luffy: 'Score 20 points in Libero Run',
      },
    },
  };
  const X = () => TX[L()];

  let host = null, sh = null, V = null, sock = null, T = [], UI = { shown: {}, lines: {}, full: false, lastLibs: 0 };
  const q = s => sh.querySelector(s), qa = s => [].slice.call(sh.querySelectorAll(s));
  const later = (f, ms) => { T.push(setTimeout(f, ms)); };
  const clearT = () => { T.forEach(clearTimeout); T = []; };
  const pid = () => getPlayerId();

  /* ───────── Sons ───────── */
  let AC = null;
  const sfxOn = () => (typeof sfxEnabled === 'undefined' || !!sfxEnabled);
  const vol = () => (typeof sfxVolume === 'number' && !isNaN(sfxVolume) ? Math.max(0.05, Math.min(1, sfxVolume * 2)) : 1);
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return AC; };
  function tone(f, d, type, v, delay, f2) { if (!sfxOn()) return; const c = ac(); if (!c) return; try { const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime((v || .15) * vol(), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .02); } catch (_) {} }
  function noise(d, v, delay) { if (!sfxOn()) return; const c = ac(); if (!c) return; try { const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = (v || .2) * vol(); s.connect(g); g.connect(c.destination); s.start(c.currentTime + (delay || 0)); } catch (_) {} }
  const SND = {
    stamp() { tone(150, .18, 'sine', .5, 0, 50); noise(.05, .25); }, tick() { tone(700, .04, 'square', .05); }, whoosh() { noise(.25, .08); },
    coin(k) { tone(988, .09, 'square', .07, (k || 0) * .06); tone(1319, .18, 'square', .07, (k || 0) * .06 + .07); }, ding() { tone(1175, .4, 'sine', .2); tone(1568, .5, 'sine', .15, .1); },
    line() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .18, i * .09)); }, bingo() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .35, 'triangle', .2, i * .11)); tone(130, .9, 'sawtooth', .08, 0); }, page() { noise(.3, .1); },
  };
  const snd = (n, a) => { try { if (SND[n]) SND[n](a); } catch (_) {} };

  /* ───────── Briques d'animation ───────── */
  function countTo(el, from, to, ms, fmt) { const t0 = performance.now(); ms = D(ms); fmt = fmt || (v => v); (function f(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); })(t0); }
  function getC(v) { return getComputedStyle(host).getPropertyValue(v).trim() || '#888'; }
  function cannons(pts, count) { if (reduce) return; const m = q('.main'); if (!m) return; const cv = document.createElement('canvas'); cv.className = 'cv'; q('.bg-wrap').appendChild(cv); const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, cx = cv.getContext('2d'); const col = [getC('--mark'), getC('--red'), getC('--board'), getC('--ok'), getC('--card2')], ln = getC('--line'), P = [];
    pts.forEach(p => { for (let i = 0; i < count; i++) { const a = (p.a + (Math.random() - .5) * .9), s = 9 + Math.random() * 9; P.push({ x: p.x * w, y: p.y * h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 9 + Math.random() * 7, c: col[i % 5], str: Math.random() < .2 }); } });
    const t0 = performance.now(); (function f(t) { cx.clearRect(0, 0, w, h); let alive = 0; P.forEach(p => { p.vy += .28; p.vx *= .992; p.vy *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y < h + 30) { alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.strokeStyle = ln; cx.lineWidth = 1.2; if (p.str) cx.fillRect(-1.5, -p.h * 1.5, 3, p.h * 3); else { cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); } cx.restore(); } }); if (alive && t - t0 < 6000) requestAnimationFrame(f); else cv.remove(); })(t0); }
  function flyCoins(fromEl, n) { if (reduce) return; const t = q('.bal'); if (!t || !fromEl) return; const tr = t.getBoundingClientRect(), fr = fromEl.getBoundingClientRect(), wrap = q('.bg-wrap').getBoundingClientRect();
    for (let k = 0; k < n; k++) { const c = document.createElement('div'); c.className = 'coin'; c.style.cssText = 'position:absolute;left:0;top:0;z-index:20;pointer-events:none;width:22px;height:22px'; c.textContent = 'L'; q('.bg-wrap').appendChild(c);
      const x0 = fr.left - wrap.left + fr.width / 2 - 11, y0 = fr.top - wrap.top + fr.height / 2 - 11, x1 = tr.left - wrap.left + 14, y1 = tr.top - wrap.top + tr.height / 2 - 11, a = Math.random() * 6.28, r = 40 + Math.random() * 50, mx = x0 + Math.cos(a) * r, my = y0 + Math.sin(a) * r - 30;
      const an = c.animate([{ transform: `translate(${x0}px,${y0}px) scale(.3)`, opacity: 0 }, { transform: `translate(${mx}px,${my}px) scale(1.2) rotate(180deg)`, opacity: 1, offset: .35 }, { transform: `translate(${x1}px,${y1}px) scale(.7) rotate(540deg)`, opacity: 1 }], { duration: D(1000), delay: D(k * 70), easing: 'cubic-bezier(.45,0,.35,1)', fill: 'both' });
      later(() => snd('coin', k % 3), k * 70 + 850); an.onfinish = () => c.remove(); } }
  function floatTxt(x, y, txt) { const g = q('.grid'); if (!g) return; const e = document.createElement('div'); e.className = 'float'; e.textContent = txt; e.style.left = x + 'px'; e.style.top = y + 'px'; g.appendChild(e); e.animate([{ opacity: 0, transform: 'translateY(10px) scale(.6)' }, { opacity: 1, transform: 'translateY(-14px) scale(1.2)', offset: .3 }, { opacity: 1, transform: 'translateY(-40px) scale(1)', offset: .75 }, { opacity: 0, transform: 'translateY(-56px)' }], { duration: D(1500), fill: 'forwards' }).onfinish = () => e.remove(); }
  const STAMPER = '<svg viewBox="0 0 52 70"><ellipse cx="26" cy="64" rx="22" ry="5" fill="rgba(0,0,0,.18)"/><rect x="6" y="52" width="40" height="12" rx="4" fill="var(--board)" stroke="var(--line)" stroke-width="2"/><rect x="20" y="22" width="12" height="32" rx="3" fill="var(--card2)" stroke="var(--line)" stroke-width="2"/><circle cx="26" cy="14" r="12" fill="var(--board)" stroke="var(--line)" stroke-width="2"/><circle cx="22" cy="10" r="3.5" fill="rgba(255,255,255,.4)"/></svg>';
  const PEN = '<svg viewBox="0 0 34 34"><g transform="rotate(-40 17 17)"><rect x="12" y="2" width="10" height="22" rx="3" fill="var(--board)" stroke="var(--line)" stroke-width="2"/><path d="M12 24h10l-2 7h-6z" fill="var(--mark)" stroke="var(--line)" stroke-width="2"/></g></svg>';
  const tl = i => q(`.tile[data-i="${i}"]`);
  const tileC = i => { const t = tl(i); return { x: t.offsetLeft + t.offsetWidth / 2, y: t.offsetTop + t.offsetHeight / 2 }; };
  function stampTile(i, cb) { const t = tl(i); if (!t) { if (cb) cb(); return; } const fx = q('.fx'), c = tileC(i), st = document.createElement('div'); st.className = 'stamper'; st.innerHTML = STAMPER; st.style.left = (c.x - 26) + 'px'; st.style.top = (c.y - 60) + 'px'; fx.appendChild(st);
    const dur = D(720); snd('whoosh');
    st.animate([{ transform: 'translate(30px,-90px) rotate(18deg) scale(1.35)', opacity: 0 }, { transform: 'translate(14px,-50px) rotate(10deg) scale(1.2)', opacity: 1, offset: .25 }, { transform: 'translate(0,-6px) rotate(-3deg) scale(1)', opacity: 1, offset: .55 }, { transform: 'translate(0,3px) rotate(0) scale(.94,.9)', opacity: 1, offset: .64 }, { transform: 'translate(0,-8px) rotate(0) scale(1)', opacity: 1, offset: .74 }, { transform: 'translate(-24px,-80px) rotate(-12deg) scale(1.2)', opacity: 0 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => st.remove();
    later(() => { t.classList.add('done'); snd('stamp');
      const rg = document.createElement('div'); rg.className = 'rip'; rg.style.cssText = `left:${c.x - 20}px;top:${c.y - 20}px;width:40px;height:40px`; fx.appendChild(rg); rg.animate([{ opacity: .9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(2.6)' }], { duration: D(600), easing: 'ease-out' }).onfinish = () => rg.remove();
      for (let k = 0; k < 12; k++) { const d = document.createElement('div'); d.className = 'inkdot'; d.style.left = (c.x - 3) + 'px'; d.style.top = (c.y - 3) + 'px'; fx.appendChild(d); const a = k / 12 * 6.28 + Math.random() * .4, r = 26 + Math.random() * 26; d.animate([{ opacity: 1, transform: 'translate(0,0) scale(1)' }, { opacity: .9, transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.8)`, offset: .6 }, { opacity: 0, transform: `translate(${Math.cos(a) * r * 1.2}px,${Math.sin(a) * r * 1.2 + 10}px) scale(.3)` }], { duration: D(700), easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => d.remove(); }
      t.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9) translateY(3px)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: D(380) });
      q('.grid').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(1.5px,2px)' }, { transform: 'translate(-1px,-1px)' }, { transform: 'translate(0,0)' }], { duration: D(220) });
      if (cb) cb(); }, dur * .58); }
  function placeHl() { const g = q('.grid'); if (!g) return; const w = g.clientWidth, gap = 6, c = (w - 2 * gap) / 3, th = Math.round(c * .2); const ctr = i => ({ x: (i % 3) * (c + gap) + c / 2, y: Math.floor(i / 3) * (c + gap) + c / 2 });
    LINES.forEach((Ln, k) => { const h = g.querySelector(`.hl[data-l="${k}"]`), a = ctr(Ln[0]), b = ctr(Ln[2]), dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), len = d + c * .55, ang = Math.atan2(dy, dx) * 180 / Math.PI, ux = dx / d, uy = dy / d;
      h.dataset.rot = `rotate(${ang}deg) `; h.dataset.sx = a.x - ux * c * .27; h.dataset.sy = a.y - uy * c * .27; h.dataset.ex = b.x + ux * c * .27; h.dataset.ey = b.y + uy * c * .27;
      h.style.width = len + 'px'; h.style.height = th + 'px'; h.style.left = h.dataset.sx + 'px'; h.style.top = (parseFloat(h.dataset.sy) - th / 2) + 'px'; h.style.transformOrigin = '0 50%'; h.style.transform = h.dataset.rot + (UI.lines[k] ? 'scaleX(1)' : 'scaleX(0)'); }); }
  function sweep(k, cb) { const g = q('.grid'), h = g.querySelector(`.hl[data-l="${k}"]`), fx = q('.fx'), pen = document.createElement('div'); pen.className = 'pen'; pen.innerHTML = PEN; fx.appendChild(pen);
    const sx = +h.dataset.sx, sy = +h.dataset.sy, ex = +h.dataset.ex, ey = +h.dataset.ey, dur = D(900);
    h.animate([{ transform: h.dataset.rot + 'scaleX(0)' }, { transform: h.dataset.rot + 'scaleX(1)' }], { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    pen.animate([{ transform: `translate(${sx - 6}px,${sy - 26}px)`, opacity: 0 }, { transform: `translate(${sx - 6}px,${sy - 26}px)`, opacity: 1, offset: .08 }, { transform: `translate(${ex - 6}px,${ey - 26}px)`, opacity: 1, offset: .92 }, { transform: `translate(${ex + 10}px,${ey - 40}px)`, opacity: 0 }], { duration: dur + D(150), easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }).onfinish = () => pen.remove();
    snd('whoosh'); LINES[k].forEach((i, n) => later(() => { const t = tl(i); t.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-7px) rotate(${(n - 1) * 2}deg)` }, { transform: 'translateY(0)' }], { duration: D(380), easing: 'ease-out' }); snd('tick'); }, dur * (.15 + n * .32)));
    later(() => { const e = tileC(LINES[k][2]); floatTxt(e.x - 20, e.y - 20, '+' + V.line); if (cb) cb(); }, dur + D(60)); }

  /* ───────── Ecran ───────── */
  function build() {
    if (host) return;
    host = document.createElement('div'); host.id = 'bingo-root'; document.body.appendChild(host);
    sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<link rel="stylesheet" href="bingo.css?v=1"><div class="bg-wrap"><div class="bar"><button class="cl" data-a="close" type="button"></button><div class="tt"></div><span class="bal" id="bal"><span class="coin">L</span><b id="balv">0</b></span></div><div class="main" id="main"></div><div class="toast" id="toast"><div class="ti"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.500 4.500L19 7"/></svg></div><div><b id="toastT"></b><small id="toastS"></small></div></div></div>';
    sh.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a && a.dataset.a === 'close') close(); });
    const sync = () => { host.dataset.theme = document.documentElement.classList.contains('light') ? 'light' : 'dark'; };
    sync(); new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  const isOpen = () => host && host.hasAttribute('data-open');
  function open() { build(); host.setAttribute('data-open', ''); document.body.style.overflow = 'hidden'; try { sessionStorage.setItem('libero_bingo', '1'); } catch (_) {} UI.shown = {}; UI.lines = {}; UI.full = false; render(); if (sock) sock.emit('bingo-get', { playerId: pid() }); }
  function close() { clearT(); if (host) host.removeAttribute('data-open'); document.body.style.overflow = ''; try { sessionStorage.removeItem('libero_bingo'); } catch (_) {} }
  const leftTxt = () => { const ms = Math.max(0, V.end - (V._at ? performance.timeOrigin + performance.now() + (V.now - V._at) : Date.now())), s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${d} j ${h} h ${m} min`; };
  const tileHTML = (g, i) => { const x = X(), t = x.g[g.id] || g.id; return `<div class="tile" data-i="${i}"><svg viewBox="0 0 24 24">${ICON[g.id] || ICON.ludoWin}</svg><span class="t">${esc(t)}</span><div class="pr">${g.n > 1 ? g.p + ' / ' + g.n : ''}</div><div class="stamp"><b>${esc(x.done)}</b></div></div>`; };
  function render() {
    if (!host) return; const x = X(); q('.cl').textContent = x.close; q('.tt').textContent = x.title; const main = q('#main');
    if (!V || !V.grid) { main.innerHTML = `<div class="hint" style="margin-top:40px">${esc(!V ? x.loading + '...' : x.wait)}</div>`; return; }
    clearT(); const nDone = V.grid.filter(g => g.done).length, nl = V.lines.length;
    main.innerHTML = `${V.phase === 'ended' ? `<div class="closed">${esc(x.closedStamp)}</div>` : ''}<div class="rays" id="ry"></div><div class="ring" id="rn"></div><div class="bigstamp" id="bs"><b>${esc(x.bingo)}</b></div><p class="cap">${esc(V.phase === 'ended' ? x.endT : x.cap)}</p>${V.phase === 'live' ? `<div class="cd"><span>${esc(x.endsIn)}</span><b id="cdv">${leftTxt()}</b><span>${esc(x.until)}</span></div>` : ''}<div class="sheet" id="shx"><div class="sh-top"><h3>${esc(x.sheet)}</h3><span class="hand">${esc(x.cardOf(localStorage.getItem('playerName') || ''))}</span></div><div class="grid" id="gr">${V.grid.map(tileHTML).join('')}${LINES.map((_, k) => `<div class="hl" data-l="${k}"></div>`).join('')}<div class="fx"></div></div></div><div class="counters"><div class="c" id="c1">${esc(x.goals)}<b id="cn">${nDone} / 9</b></div><div class="c" id="c2">${esc(x.lines)}<b id="cl2">${nl} / 8</b></div></div><div class="progress"><i id="pg" style="width:${nDone / 9 * 100}%"></i></div><div class="pays"><div class="pay${nl ? ' got' : ''}" id="pL"><span id="pLt">${esc(x.lineRow(nl))}</span><span class="tag">${esc(x.recv)}</span><b id="pLv">${nl * V.line}</b></div><div class="pay${V.fullDone ? ' got' : ''}" id="pF"><span>${esc(x.fullRow)}</span><span class="tag">${esc(x.recv)}</span><b>${V.full}</b></div></div><div class="hint">${esc(x.hint)}</div><div class="rules">${x.rules.map(r => `<div>${r}</div>`).join('')}</div><div id="recw"></div>`;
    q('#balv').textContent = V.libs || 0;
    qa('.tile').forEach((t, i) => { const g = V.grid[i]; if (g.done) { t.classList.add('done', 'inst'); UI.shown[g.id] = 1; } });
    UI.lines = {}; V.lines.forEach(k => { UI.lines[k] = 1; }); placeHl(); UI.full = !!V.fullDone; UI.lastLibs = V.libs || 0;
    if (V.fullDone || V.phase === 'ended') recap();
    if (V.phase === 'live') { const cd = q('#cdv'); T.push(setInterval(() => { const c = q('#cdv'); if (c) c.textContent = leftTxt(); }, 30000)); }
  }
  function recap() { const x = X(), w = q('#recw'); if (!w) return; const libs = V.libs || 0; w.innerHTML = `<div class="rec"><svg class="trophy" viewBox="0 0 60 60"><path d="M18 8h24v14a12 12 0 01-24 0zM18 12h-8c0 8 4 12 9 12M42 12h8c0 8-4 12-9 12M30 34v10M20 52h20M23 44h14v8H23z"/></svg><h3>${esc(V.fullDone ? x.full : x.endT)}</h3><div class="r"><span>${esc(x.goals)}</span><b>${V.grid.filter(g => g.done).length} / 9</b></div><div class="r"><span>${esc(x.lineSum(V.lines.length))}</span><b>${V.lines.length * V.line}</b></div>${V.fullDone ? `<div class="r"><span>${esc(x.fullRow)}</span><b>${V.full}</b></div>` : ''}<div class="r tot"><span>${esc(x.fullT)}</span><b>${libs} ${esc(x.libs)}</b></div></div>`; }
  function setCtr(n, l) { const a = q('#cn'), b = q('#cl2'); if (!a) return; const pn = parseInt(a.textContent), pl = parseInt(b.textContent); const bump = e => { e.classList.remove('up'); void e.offsetWidth; e.classList.add('up'); };
    if (n !== pn) { countTo(a, pn, n, 500, v => v + ' / 9'); bump(q('#c1')); } if (l !== pl) { countTo(b, pl, l, 500, v => v + ' / 8'); bump(q('#c2')); } q('#pg').style.width = (n / 9 * 100) + '%'; }
  function toast(t, s) { const e = q('#toast'); if (!e) return; q('#toastT').textContent = t; q('#toastS').textContent = s || ''; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); snd('ding'); later(() => e.classList.remove('on'), 2800); }

  /* ───────── Etat et evenements du serveur ───────── */
  function setState(v) { V = v; V._at = performance.timeOrigin + performance.now(); if (isOpen() && !UI.busy) render(); }
  // Un objectif vient d'etre valide : on tamponne, on surligne les lignes, on fait voler les pieces.
  function onEvent(ev) {
    if (!ev) return;
    if (ev.state) { const wasOpen = isOpen(); if (ev.type === 'goal' && wasOpen && V && V.grid) return animate(ev); setState(ev.state); return; }
    if (ev.type === 'step' && V && V.grid && isOpen()) { const g = V.grid.find(o => o.id === ev.id); if (g) { g.p = ev.p; const i = V.grid.indexOf(g), t = tl(i); if (t) { t.querySelector('.pr').textContent = ev.p + ' / ' + ev.n; t.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: D(400) }); snd('tick'); toast(X().toastT, X().step(ev.p, ev.n)); } } }
  }
  function animate(ev) {
    const x = X(), prev = V, nv = ev.state; UI.busy = true; clearT(); let t0 = 200;
    const idx = ev.ids.map(id => nv.grid.findIndex(g => g.id === id)).filter(i => i >= 0);
    idx.forEach((i, k) => { later(() => stampTile(i, () => { if (k === idx.length - 1) setCtr(nv.grid.filter(g => g.done).length, UI.lines ? Object.keys(UI.lines).length : 0); }), t0); toastLater(x.toastT, x.g[nv.grid[i].id], t0 + 400); t0 += 1300; });
    nv.grid.forEach((g, i) => { if (g.n > 1 && !idx.includes(i) && g.p && prev && prev.grid && prev.grid[i] && prev.grid[i].p !== g.p) { const t = tl(i); if (t) t.querySelector('.pr').textContent = g.p + ' / ' + g.n; } });
    const newLines = ev.lines || [];
    newLines.forEach(k => { later(() => sweep(k, () => { UI.lines[k] = 1; snd('line'); }), t0); t0 += 1100; });
    if (ev.libs > 0) later(() => { flyCoins(tl(idx[idx.length - 1] != null ? idx[idx.length - 1] : 0), ev.full ? 14 : 6 + newLines.length * 3); const bal = q('#balv'); countTo(bal, UI.lastLibs, nv.libs, 900); const b = q('#bal'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); UI.lastLibs = nv.libs;
      const pl = q('#pL'); if (pl) { pl.classList.add('got'); q('#pLt').textContent = x.lineRow(nv.lines.length); q('#pLv').textContent = nv.lines.length * nv.line; const tg = pl.querySelector('.tag'); tg.classList.remove('slam'); void tg.offsetWidth; tg.classList.add('slam'); snd('stamp'); }
      setCtr(nv.grid.filter(g => g.done).length, nv.lines.length); }, t0), t0 += 1200;
    if (newLines.length && !ev.full) toastLater(x.toastT, x.toastLine(ev.libs), t0 - 1100);
    if (ev.full) { later(() => bingoShow(nv), t0); t0 += 5200; }
    later(() => { UI.busy = false; V = nv; V._at = performance.timeOrigin + performance.now(); const sc = q('.main'); if (sc && !ev.full) { /* etat final deja affiche */ } }, t0);
  }
  function toastLater(t, s, ms) { later(() => toast(t, s), ms); }
  function bingoShow(nv) {
    const x = X(), wrap = q('.bg-wrap'); wrap.classList.add('shake'); snd('bingo'); q('#ry').classList.add('go'); const rn = q('#rn'); rn.animate([{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(11)' }], { duration: D(900), easing: 'ease-out' });
    q('#bs').animate([{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-11deg) scale(4)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-11deg) scale(.9)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-11deg) scale(1)' }], { duration: D(650), easing: 'cubic-bezier(.34,1.4,.64,1)', fill: 'forwards' });
    cannons([{ x: 0, y: .95, a: -1.0 }, { x: 1, y: .95, a: -2.14 }], 34); const pf = q('#pF'); if (pf) { pf.classList.add('got'); const tg = pf.querySelector('.tag'); tg.classList.add('slam'); }
    later(() => { wrap.classList.remove('shake'); }, 700);
    later(() => { const b = q('#bs'); if (b) b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(500), fill: 'forwards' }); const r = q('#ry'); if (r) r.style.display = 'none'; V = nv; recap(); const w = q('#recw'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, D(3600));
  }
  function init(socket) { if (sock) return; sock = socket; }
  function restore() { try { if (sessionStorage.getItem('libero_bingo') && V && V.phase !== 'before') open(); } catch (_) {} }
  window.LiberoBingo = { init, setState, onEvent, open, close, restore, isOpen, TX };
})();
