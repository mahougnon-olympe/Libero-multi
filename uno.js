/* Uno : salon, table ronde, animations et skins de cartes. Charge a la demande par app.js (_unoLoad). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const D = {
    fr: { title: 'Uno', lobby: 'Salon Uno', code: 'Code du salon', copy: 'Copier le code', share: 'Partager le lien', copied: 'Code copié',
      addBot: 'Ajouter un robot', rmBot: 'Retirer un robot', start: 'Lancer la partie', leave: 'Quitter', host: 'Hôte', bot: 'Robot', away: 'Reconnexion',
      need2: 'Il faut au moins 2 joueurs.', waitHost: "En attente de l'hôte pour lancer la partie.", hint: '2 à 10 joueurs. Ajoute des robots pour jouer seul.',
      shuffle: 'On mélange les cartes', dealing: 'On distribue 7 cartes chacun', flip: 'On retourne la première carte', go: "C'est parti !",
      yourTurn: 'À toi de jouer', playDrawn: 'Pose la carte piochée ou passe', turnOf: n => `${n} joue`, pass: 'Passer', uno: 'UNO !', deck: 'Pioche', pile: 'Défausse',
      pickColor: 'Choisis une couleur', rev: 'Le sens du jeu s’inverse', skipT: n => `${n} passe son tour`, plus: (n, k) => `${n} pioche ${k} cartes`, pen: n => `${n} a oublié UNO : +2`,
      unoOf: n => `${n} : UNO !`, win: 'Victoire !', winOf: n => `${n} gagne`, again: 'Rejouer', menu: 'Quitter', left: n => `${n} a quitté la partie`,
      leaveAsk: 'Quitter la partie ?', leaveText: 'Tu abandonnes la partie en cours : elle comptera comme une défaite.', leaveText2: 'Tu quittes le salon.', leaveOk: 'Quitter',
      cards: n => `${n} carte${n > 1 ? 's' : ''}`, err: { started: 'La partie a déjà commencé.', full: 'Le salon est complet (10 joueurs).', notfound: 'Salon introuvable. Vérifie le code.', need2: 'Il faut au moins 2 joueurs.' },
      skins: { classic: 'Classique brillant', felt: 'Papier cartonné', gold: 'Noir et or', metal: 'Métal brossé', neon: 'Néon' }, rank: 'Classement', cardsLeft: 'cartes restantes' },
    en: { title: 'Uno', lobby: 'Uno room', code: 'Room code', copy: 'Copy the code', share: 'Share the link', copied: 'Code copied',
      addBot: 'Add a robot', rmBot: 'Remove a robot', start: 'Start the game', leave: 'Leave', host: 'Host', bot: 'Robot', away: 'Reconnecting',
      need2: 'You need at least 2 players.', waitHost: 'Waiting for the host to start the game.', hint: '2 to 10 players. Add robots to play alone.',
      shuffle: 'Shuffling the cards', dealing: 'Dealing 7 cards each', flip: 'Turning over the first card', go: "Let's go!",
      yourTurn: 'Your turn', playDrawn: 'Play the drawn card or pass', turnOf: n => `${n} is playing`, pass: 'Pass', uno: 'UNO!', deck: 'Draw pile', pile: 'Discard',
      pickColor: 'Pick a colour', rev: 'The direction reverses', skipT: n => `${n} skips a turn`, plus: (n, k) => `${n} draws ${k} cards`, pen: n => `${n} forgot UNO: +2`,
      unoOf: n => `${n}: UNO!`, win: 'Victory!', winOf: n => `${n} wins`, again: 'Play again', menu: 'Leave', left: n => `${n} left the game`,
      leaveAsk: 'Leave the game?', leaveText: 'You give up the game in progress: it will count as a loss.', leaveText2: 'You leave the room.', leaveOk: 'Leave',
      cards: n => `${n} card${n > 1 ? 's' : ''}`, err: { started: 'The game has already started.', full: 'The room is full (10 players).', notfound: 'Room not found. Check the code.', need2: 'You need at least 2 players.' },
      skins: { classic: 'Glossy classic', felt: 'Cardstock', gold: 'Black and gold', metal: 'Brushed metal', neon: 'Neon' }, rank: 'Ranking', cardsLeft: 'cards left' },
  };
  const U = () => D[L()];
  const SKIN_IDS = ['classic', 'felt', 'gold', 'metal', 'neon'];
  const COL = { R: 'var(--cR)', Y: 'var(--cY)', G: 'var(--cG)', B: 'var(--cB)' };
  const SYM = { S: '⊘', R: '⇄', D: '+2', F: '+4', W: '' };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => (typeof _escHtml === 'function' ? _escHtml(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const snd = n => { try { window._sound?.play(n); } catch {} };

  // ── Cartes ──────────────────────────────────────────────────────────────────
  function card(c, cls = '') {
    if (!c) return `<div class="uc back ${cls}"><div class="f"><span class="o"></span><span class="n"><b>UNO</b><small>by LIBERO</small></span></div></div>`;
    const s = SYM[c.v] ?? c.v;
    const k = (c.v in SYM && c.v !== 'D') || c.c === 'W' ? ' k' : '';
    return `<div class="uc ${c.c}${k} ${cls}" data-id="${c.id ?? ''}"><div class="f"><span class="o"></span><span class="t">${s}</span><span class="n">${s}</span><span class="b">${s}</span></div></div>`;
  }
  const back = cls => card(null, cls);
  // Apercu de skin pour la boutique : trois cartes en eventail.
  function preview(target, skin) {
    loadCss();
    target.classList.add('uno-cards');
    target.dataset.skin = skin || 'classic';
    target.innerHTML = `<div class="uc-prev">${card({ c: 'R', v: '7' }, '')}${card({ c: 'Y', v: 'D' }, '')}${card({ c: 'W', v: 'F' }, '')}${back('')}</div>`;
    target.querySelectorAll('.uc').forEach((c, i) => { c.style.transform = `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 3}px)`; });
  }
  function loadCss() {
    if (document.getElementById('uno-css')) return;
    const l = document.createElement('link'); l.id = 'uno-css'; l.rel = 'stylesheet'; l.href = 'uno.css?v=2'; document.head.appendChild(l);
  }

  // ── Etat ────────────────────────────────────────────────────────────────────
  const S = { code: null, v: null, view: null, queue: [], busy: false, pendingWild: null, tmr: null };
  const sk = () => window._myUnoSkin && SKIN_IDS.includes(window._myUnoSkin) ? window._myUnoSkin : 'classic';
  const SESS = 'libero_uno';
  const saveSess = code => { try { sessionStorage.setItem(SESS, code); localStorage.setItem(SESS, JSON.stringify({ code, at: Date.now() })); } catch {} };
  const clearSess = () => { try { sessionStorage.removeItem(SESS); localStorage.removeItem(SESS); } catch {} S.code = null; S.v = null; };
  function savedCode() {
    try {
      const a = sessionStorage.getItem(SESS); if (a) return a;
      const b = JSON.parse(localStorage.getItem(SESS) || 'null');
      if (b && Date.now() - b.at < 2 * 3600_000) return b.code;
    } catch {}
    return null;
  }

  // ── Ecran ───────────────────────────────────────────────────────────────────
  let root = null;
  function ensure() {
    loadCss();
    if (root) return root;
    root = el(`<div id="screen-uno" class="screen uno-cards" data-view="lobby">
      <div class="un-lobby">
        <h2 id="un-l-title"></h2>
        <div class="un-code" id="un-code"></div>
        <div class="un-share"><button class="btn btn-secondary" id="un-copy"></button><button class="btn btn-secondary" id="un-share"></button></div>
        <ul class="un-seats" id="un-seats"></ul>
        <p class="un-hint" id="un-hint"></p>
        <div class="un-acts"><button class="btn btn-secondary" id="un-addbot"></button><button class="btn btn-secondary" id="un-rmbot"></button></div>
        <div class="un-acts"><button class="btn btn-primary" id="un-start"></button><button class="btn tear-btn" id="un-leave"></button></div>
      </div>
      <div class="un-table">
        <div class="un-top"><button class="un-menu" id="un-menu"></button><span class="un-codeb" id="un-codeb"></span></div>
        <div class="un-ring"></div><div class="un-dir" id="un-dir"></div>
        <div id="un-pls"></div>
        <div class="un-center"><div class="un-deck" id="un-deck"><div id="un-deck-c"></div><span class="un-lbl" id="un-deck-l"></span></div>
          <div class="un-disc" id="un-disc"><span class="un-colorbar" id="un-cb"></span><div id="un-disc-c"></div><span class="un-lbl" id="un-disc-l"></span></div></div>
        <div class="un-cap" id="un-cap"></div>
        <button class="btn btn-secondary un-btn-pass" id="un-pass"></button>
        <button class="un-btn-uno" id="un-uno"></button>
        <div class="un-hand" id="un-hand"></div>
        <div class="un-picker" id="un-picker"><div class="box"><b id="un-pk-t"></b><div class="cols">
          <button data-c="R" style="background:var(--cR)"></button><button data-c="Y" style="background:var(--cY)"></button><button data-c="B" style="background:var(--cB)"></button><button data-c="G" style="background:var(--cG)"></button></div></div></div>
        <div class="un-end" id="un-end"><div class="box"><h3 id="un-e-t"></h3><div id="un-e-list" style="width:100%;display:grid;gap:6px"></div><div class="acts"><button class="btn btn-primary" id="un-again"></button><button class="btn tear-btn" id="un-quit"></button></div></div></div>
      </div></div>`);
    const host = document.getElementById('screen-home')?.parentNode || document.body;
    host.appendChild(root);
    bind();
    return root;
  }
  function bind() {
    $('#un-copy', root).onclick = async () => { try { await navigator.clipboard.writeText(S.code); } catch {} toast(U().copied); };
    $('#un-share', root).onclick = async () => {
      const url = `${location.origin}${location.pathname}?join=${S.code}`;
      try { if (navigator.share) { await navigator.share({ title: "Libero's Multi", text: `Uno : ${S.code}`, url }); return; } } catch { return; }
      try { await navigator.clipboard.writeText(url); } catch {} toast(U().copied);
    };
    $('#un-addbot', root).onclick = () => socket.emit('uno-add-bot');
    $('#un-rmbot', root).onclick = () => socket.emit('uno-remove-bot');
    $('#un-start', root).onclick = () => socket.emit('start-uno');
    $('#un-leave', root).onclick = () => leave(false);
    $('#un-menu', root).onclick = () => leave(true);
    $('#un-quit', root).onclick = () => leave(false, true);
    $('#un-again', root).onclick = () => socket.emit('uno-restart');
    $('#un-deck', root).onclick = () => { if (canAct() && S.v.drawn == null) { snd('click'); socket.emit('uno-draw'); } };
    $('#un-pass', root).onclick = () => { snd('click'); socket.emit('uno-pass'); };
    $('#un-uno', root).onclick = () => { snd('click-ok'); socket.emit('uno-call'); };
    $('#un-hand', root).onclick = e => {
      const c = e.target.closest('.uc'); if (!c || !c.classList.contains('ok') || !canAct()) return;
      const id = +c.dataset.id, cd = S.v.hand.find(x => x.id === id); if (!cd) return;
      if (cd.c === 'W') { S.pendingWild = id; $('#un-picker', root).classList.add('on'); return; }
      snd('piece-place'); socket.emit('uno-play', { cardId: id, color: null, uno: false });
    };
    $('#un-picker', root).onclick = e => {
      const b = e.target.closest('button[data-c]');
      if (!b) { if (e.target.id === 'un-picker') { S.pendingWild = null; $('#un-picker', root).classList.remove('on'); } return; }
      const id = S.pendingWild; S.pendingWild = null; $('#un-picker', root).classList.remove('on');
      if (id != null) { snd('piece-place'); socket.emit('uno-play', { cardId: id, color: b.dataset.c, uno: false }); }
    };
    window.addEventListener('resize', () => { if (S.v && S.view === 'table') layoutHand(S.v); });
  }
  const toast = m => { try { showCursorSnakeToast(m); } catch {} };
  const canAct = () => !!(S.v && S.v.status === 'playing' && S.v.mySeat >= 0 && S.v.turn === S.v.mySeat && !S.busy);
  async function leave(ask, fromEnd) {
    const playing = S.v && S.v.status === 'playing' && S.v.mySeat >= 0;
    if (ask || playing) {
      const ok = await _slateConfirm({ title: U().leaveAsk, text: playing ? U().leaveText : U().leaveText2, ok: U().leaveOk });
      if (!ok) return;
    }
    socket.emit('leave-uno-room'); clearSess(); S.queue = []; S.busy = false;
    try { sessionStorage.removeItem('libero_screen'); } catch {}
    showScreen('home'); void fromEnd;
  }
  function setView(v) {
    ensure(); S.view = v; root.dataset.view = v; root.dataset.skin = sk();
    if (!root.classList.contains('active')) showScreen('uno');
  }

  // ── Avatars ─────────────────────────────────────────────────────────────────
  const robotSvg = '<svg viewBox="0 0 40 40"><rect x="8" y="12" width="24" height="20" rx="6" fill="#9aa4b2" stroke="#1d2433" stroke-width="2"/><circle cx="15" cy="21" r="3" fill="#1d2433"/><circle cx="25" cy="21" r="3" fill="#1d2433"/><path d="M20 12V6" stroke="#1d2433" stroke-width="2"/><circle cx="20" cy="5" r="2.5" fill="#e2485d"/><path d="M15 27h10" stroke="#1d2433" stroke-width="2" stroke-linecap="round"/></svg>';
  function avatar(p) {
    if (p.bot) return robotSvg;
    try { if (window.LiberoPortrait) return p.portrait ? LiberoPortrait.svg(p.portrait) : LiberoPortrait.blank(); } catch {}
    return esc((p.name || '?').slice(0, 1).toUpperCase());
  }

  // ── Salon ───────────────────────────────────────────────────────────────────
  function renderLobby(v) {
    setView('lobby'); S.v = v; S.code = v.code;
    $('#un-l-title', root).textContent = U().lobby; $('#un-code', root).textContent = v.code;
    $('#un-copy', root).textContent = U().copy; $('#un-share', root).textContent = U().share;
    $('#un-hint', root).textContent = v.youHost ? U().hint : U().waitHost;
    $('#un-addbot', root).textContent = U().addBot; $('#un-rmbot', root).textContent = U().rmBot;
    $('#un-start', root).textContent = U().start; $('#un-leave', root).textContent = U().leave;
    $('#un-seats', root).innerHTML = v.players.map(p => `<li class="un-seat${p.connected ? '' : ' off'}"><span class="av">${avatar(p)}</span><span>${esc(p.name)}</span><span class="tg">${p.bot ? U().bot : p.host ? U().host : (p.connected ? '' : U().away)}</span></li>`).join('');
    const n = v.players.length, bots = v.players.filter(p => p.bot).length;
    $('#un-addbot', root).style.display = v.youHost && n < 10 ? '' : 'none';
    $('#un-rmbot', root).style.display = v.youHost && bots ? '' : 'none';
    $('#un-start', root).style.display = v.youHost ? '' : 'none';
    $('#un-start', root).disabled = n < 2;
  }

  // ── Table ───────────────────────────────────────────────────────────────────
  function others(v) {
    const n = v.players.length, me = v.mySeat, out = [];
    if (me < 0) { for (let i = 0; i < n; i++) out.push(i); return out; }
    for (let k = 1; k < n; k++) out.push((me + k) % n);
    return out;
  }
  function coords(k, m) {
    const a = Math.PI - (k + .5) * Math.PI / m, c = Math.cos(a);
    const zig = m > 5 && Math.abs(c) < .72 && k % 2 ? 11 : 0;      // en haut les pastilles se serrent : une sur deux descend
    return { x: 50 + (m > 5 ? 43 : 41) * c, y: 38 - 26 * Math.sin(a) + zig };
  }
  function plHtml(v, seat, k, m) {
    const p = v.players[seat], c = coords(k, m), cnt = v.counts[seat], mini = m > 5 ? 0 : Math.min(cnt, 6);
    return `<div class="un-pl${m > 5 ? ' dense' : ''}${v.turn === seat && v.status === 'playing' ? ' turn' : ''}${p.connected ? '' : ' off'}" data-seat="${seat}" style="left:${c.x}%;top:${c.y}%">
      <span class="say"></span><div class="pill" title="${esc(p.name)}"><span class="av">${avatar(p)}</span><span class="nm">${esc(p.name)}</span><em>${cnt}</em></div>
      <div class="mini">${Array.from({ length: mini }, () => back('xs')).join('')}</div><div class="tm"><i></i></div></div>`;
  }
  function render(v) {
    setView('table'); S.v = v; S.code = v.code;
    root.dataset.skin = sk();
    const ot = others(v);
    $('#un-pls', root).innerHTML = ot.map((seat, k) => plHtml(v, seat, k, ot.length)).join('');
    $('#un-deck-c', root).innerHTML = back('lg'); $('#un-deck-l', root).textContent = U().deck;
    $('#un-disc-c', root).innerHTML = v.top ? card(v.top, 'lg') : ''; $('#un-disc-l', root).textContent = U().pile;
    $('#un-cb', root).style.setProperty('--curc', COL[v.color] || 'transparent');
    $('#un-dir', root).textContent = v.dir === 1 ? '↻' : '↺';
    $('#un-codeb', root).textContent = v.code; $('#un-menu', root).textContent = U().menu;
    $('#un-pk-t', root).textContent = U().pickColor;
    const my = v.turn === v.mySeat && v.status === 'playing' && v.mySeat >= 0;
    $('#un-deck', root).classList.toggle('can', my && v.drawn == null);
    $('#un-pass', root).textContent = U().pass; $('#un-pass', root).classList.toggle('on', my && v.drawn != null);
    $('#un-uno', root).textContent = U().uno;
    $('#un-uno', root).classList.toggle('on', v.status === 'playing' && v.mySeat >= 0 && v.hand.length === 2 && !v.called[v.mySeat]);
    $('#un-cap', root).textContent = v.status !== 'playing' ? '' : my ? (v.drawn != null ? U().playDrawn : U().yourTurn) : U().turnOf(v.players[v.turn]?.name || '');
    // Main
    const hand = $('#un-hand', root);
    hand.innerHTML = v.hand.map(c => card(c, my ? (isPlayable(v, c) ? 'ok' : 'no') : '')).join('');
    layoutHand(v);
    timer(v);
    // Fin
    const end = $('#un-end', root);
    if (v.status === 'finished') showEnd(v); else end.classList.remove('on');
  }
  function isPlayable(v, c) { if (v.drawn != null && c.id !== v.drawn) return false; return c.c === 'W' || c.c === v.color || c.v === v.top.v; }
  function layoutHand(v) {
    const hand = $('#un-hand', root), cs = hand.querySelectorAll('.uc'); if (!cs.length) return;
    const w = hand.clientWidth - 16, cw = cs[0].offsetWidth || 60, n = cs.length;
    const ov = n * cw <= w ? Math.min(6, (w - n * cw) / Math.max(1, n - 1)) * -1 + 0 : -((n * cw - w) / (n - 1));
    hand.style.setProperty('--ov', (n * cw <= w ? -8 : ov) + 'px');
  }
  function timer(v) {
    clearInterval(S.tmr);
    root.querySelectorAll('.un-pl .tm i').forEach(i => { i.getAnimations().forEach(a => a.cancel()); });
    if (v.status !== 'playing' || !v.turnEnd) return;
    const left = v.turnEnd - Date.now(); if (left <= 0) return;
    const pill = root.querySelector(`.un-pl[data-seat="${v.turn}"] .tm i`);
    if (pill && !reduce()) pill.animate([{ transform: `scaleX(${Math.min(1, left / (v.turnTotal || 40000))})` }, { transform: 'scaleX(0)' }], { duration: left, fill: 'forwards', easing: 'linear' });
    if (v.turn === v.mySeat) {
      let lastTick = -1;
      S.tmr = setInterval(() => { const s = Math.ceil((v.turnEnd - Date.now()) / 1000); if (s <= 5 && s > 0 && s !== lastTick) { lastTick = s; snd(s === 1 ? 'tick-final' : 'tick'); } if (s <= 0) clearInterval(S.tmr); }, 250);
    }
  }
  function showEnd(v) {
    const end = $('#un-end', root), win = v.winner, me = v.mySeat;
    $('#un-e-t', root).textContent = win === me ? U().win : U().winOf(v.players[win]?.name || '');
    const order = v.players.map((p, i) => ({ p, i, n: v.counts[i] })).sort((a, b) => (a.i === win ? -1 : b.i === win ? 1 : a.n - b.n));
    $('#un-e-list', root).innerHTML = order.map((o, r) => `<div class="un-seat"><b>${r + 1}</b><span class="av">${avatar(o.p)}</span><span>${esc(o.p.name)}</span><span class="tg">${o.i === win ? '' : U().cards(o.n)}</span></div>`).join('');
    $('#un-again', root).textContent = U().again; $('#un-quit', root).textContent = U().leave;
    $('#un-again', root).style.display = v.youHost ? '' : 'none';
    end.classList.add('on');
  }

  // ── Animations ──────────────────────────────────────────────────────────────
  const A = (e, k, o) => e.animate(k, { fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)', ...o });
  const wait = ms => new Promise(r => setTimeout(r, reduce() ? 0 : ms));
  const tbl = () => $('.un-table', root);
  const rect = e => { const a = e.getBoundingClientRect(), b = tbl().getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
  const seatEl = seat => root.querySelector(`.un-pl[data-seat="${seat}"] .pill`);
  const handRect = () => { const h = $('#un-hand', root), r = rect(h); return { x: r.x + r.w / 2 - 30, y: r.y + r.h - 96, w: 60, h: 88 }; };
  function fly(html, from, to, o = {}) {
    const e = el(html); e.classList.add('un-fx');
    e.style.cssText += `left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px;--fs:${Math.round(from.w * .55)}px`;
    tbl().appendChild(e);
    const sc = to.w / from.w;
    const an = A(e, [{ transform: 'translate(0,0) rotate(0) scale(1)' }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(${o.rot || 0}deg) scale(${sc})`, transformOrigin: '0 0' }], { duration: reduce() ? 1 : (o.d || 480), delay: o.delay || 0 });
    return new Promise(res => { an.onfinish = () => { if (!o.keep) e.remove(); res(e); }; });
  }
  function big(text, color, y = 38, bg) {
    const b = el(`<div class="un-big" style="color:${color};${bg ? `background:${bg};padding:2px 14px;border-radius:10px;` : ''}">${esc(text)}</div>`);
    b.style.left = '50%'; b.style.top = y + '%'; tbl().appendChild(b);
    const w = b.offsetWidth; b.style.marginLeft = (-w / 2) + 'px';
    if (!reduce()) A(b, [{ opacity: 0, transform: 'scale(.3) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1.1) rotate(-4deg)', offset: .3 }, { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: .8 }, { opacity: 0 }], { duration: 1400 });
    setTimeout(() => b.remove(), reduce() ? 900 : 1450);
  }
  const deckRect = () => rect($('#un-deck-c .uc', root) || $('#un-deck', root));
  const discRect = () => rect($('#un-disc', root));
  const seatRect = (v, seat) => { if (seat === v.mySeat) return handRect(); const e = seatEl(seat); const r = e ? rect(e) : { x: 100, y: 40, w: 60, h: 28 }; return { x: r.x + r.w / 2 - 15, y: r.y, w: 30, h: 44 }; };
  async function drawFlights(prev, seat, n, delay = 0) {
    const d = deckRect(); const fs = [];
    for (let i = 0; i < Math.min(n, 6); i++) { fs.push(fly(back('lg'), { x: d.x, y: d.y, w: d.w, h: d.h }, seatRect(prev, seat), { d: 520, delay: delay + i * 150 })); snd('pop'); }
    await Promise.all(fs);
  }
  async function animate(v, prev) {
    const ev = v.ev; if (!ev || reduce()) { if (ev && ev.t === 'win') snd(v.winner === v.mySeat ? 'win' : 'lose'); return; }
    if (ev.t === 'deal') return dealAnim(v);
    if (!prev) return;
    if (ev.t === 'play') {
      const mine = ev.seat === prev.mySeat;
      let from;
      if (mine) { const ce = root.querySelector(`#un-hand .uc[data-id="${ev.card.id}"]`); if (ce) { from = rect(ce); ce.style.visibility = 'hidden'; } }
      if (!from) { const r = seatRect(prev, ev.seat); from = { x: r.x, y: r.y, w: 60, h: 88 }; }
      const dr = discRect(); snd('piece-place');
      await fly(card(ev.card, ''), from, { x: dr.x, y: dr.y, w: 76, h: 112 }, { rot: 6, d: 460 });
      const cb = $('#un-cb', root); cb.style.setProperty('--curc', COL[ev.color] || 'transparent');
      if (ev.card.c === 'W') { A(cb, [{ opacity: .2 }, { opacity: 1 }, { opacity: 1 }], { duration: 500, fill: 'none' }); }
      if (ev.reverse) { const d = $('#un-dir', root); A(d, [{ transform: 'translate(-50%,-108px) rotate(0) scale(1)' }, { transform: 'translate(-50%,-108px) rotate(-360deg) scale(1.9)', offset: .6 }, { transform: 'translate(-50%,-108px) rotate(-360deg) scale(1)' }], { duration: 900, fill: 'none' }); big(U().rev, 'var(--accent)', 30); await wait(500); }
      if (ev.skip != null) { const e = seatEl(ev.skip); if (e) { const r = rect(e); const b = el('<div class="un-big" style="color:var(--cR);font-size:46px">⊘</div>'); b.style.left = (r.x + r.w / 2 - 20) + 'px'; b.style.top = (r.y - 8) + 'px'; tbl().appendChild(b); A(b, [{ opacity: 0, transform: 'scale(2.6) rotate(-30deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)', offset: .4 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1200 }); setTimeout(() => b.remove(), 1250); } big(U().skipT(prev.players[ev.skip]?.name || ''), 'var(--accent)', 30); await wait(600); }
      if (ev.draw) { big(U().plus(prev.players[ev.draw.seat]?.name || '', ev.draw.n), 'var(--cR)', 30); await drawFlights(prev, ev.draw.seat, ev.draw.n); }
      if (ev.penalty) { big(U().pen(prev.players[ev.penalty.seat]?.name || ''), 'var(--cR)', 30); await drawFlights(prev, ev.penalty.seat, ev.penalty.n); }
      if (ev.win) { await winAnim(v); }
    } else if (ev.t === 'draw') {
      await drawFlights(prev, ev.seat, ev.n);
    } else if (ev.t === 'uno') {
      const e = seatEl(ev.seat) || $('#un-uno', root), r = rect(e); snd('success');
      for (let i = 0; i < 2; i++) { const g = el('<div class="un-fx" style="width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:4px solid var(--cR)"></div>'); g.style.left = (r.x + r.w / 2) + 'px'; g.style.top = (r.y + r.h / 2) + 'px'; tbl().appendChild(g); A(g, [{ opacity: .9, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(2.6)' }], { duration: 900, delay: i * 200 }); setTimeout(() => g.remove(), 1200); }
      big(U().unoOf(ev.name || ''), 'var(--cR)', 28);
      await wait(500);
    } else if (ev.t === 'left') { toast(U().left(ev.name || '')); }
  }
  async function winAnim(v) {
    snd(v.winner === v.mySeat ? 'win' : 'lose');
    const cols = ['R', 'Y', 'G', 'B'], w = tbl().clientWidth, h = tbl().clientHeight;
    for (let i = 0; i < 26; i++) {
      const e = el(card({ c: cols[i % 4], v: String(i % 10) }, 'sm')); e.classList.add('un-fx'); e.style.left = Math.random() * (w - 30) + 'px'; e.style.top = '-50px'; e.style.position = 'absolute'; tbl().appendChild(e);
      const an = A(e, [{ transform: 'translateY(0) rotate(0)' }, { transform: `translateY(${h + 80}px) rotate(${(Math.random() - .5) * 720}deg)` }], { duration: 1800 + Math.random() * 1400, delay: Math.random() * 700, easing: 'cubic-bezier(.3,.1,.6,1)' });
      an.onfinish = () => e.remove();
    }
    big(v.winner === v.mySeat ? U().win : U().winOf(v.players[v.winner]?.name || ''), '#1d2433', 26, 'var(--yellow, #ffe169)');
    await wait(1400);
  }
  async function dealAnim(v) {
    // Table vide, puis melange, distribution, premiere carte.
    const shell = Object.assign({}, v, { counts: v.counts.map(() => 0), hand: [], top: null });
    render(shell); $('#un-cap', root).textContent = U().shuffle; snd('click');
    await wait(60);
    const d = deckRect();
    for (let k = 0; k < 4; k++) [-1, 1].forEach(sg => { const e = el(back('lg')); e.classList.add('un-fx'); e.style.left = d.x + 'px'; e.style.top = d.y + 'px'; tbl().appendChild(e); A(e, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${sg * 46}px,${-sg * 6}px) rotate(${sg * 9}deg)`, offset: .5 }, { transform: 'translate(0,0) rotate(0)' }], { duration: 480, delay: k * 180 + (sg > 0 ? 90 : 0), fill: 'none' }).onfinish = () => e.remove(); });
    await wait(1100);
    $('#un-cap', root).textContent = U().dealing;
    const n = v.players.length, order = Array.from({ length: n }, (_, i) => (v.mySeat >= 0 ? v.mySeat : 0) + i).map(i => i % n);
    const flights = [], gap = n > 4 ? 55 : 70; let idx = 0;
    for (let r = 0; r < 7; r++) for (const seat of order) { flights.push(fly(back('lg'), { x: d.x, y: d.y, w: d.w, h: d.h }, seatRect(v, seat), { d: 420, delay: idx++ * gap })); }
    await Promise.all(flights);
    $('#un-cap', root).textContent = U().flip;
    const dr = discRect();
    const fl = fly(back('lg'), { x: d.x, y: d.y, w: d.w, h: d.h }, { x: dr.x, y: dr.y, w: dr.w, h: dr.h }, { d: 500 });
    await fl;
    big(U().go, '#1d2433', 24, 'var(--yellow, #ffe169)'); snd('opponent-joined');
  }

  // ── File des etats : un a la fois, animation puis rendu ─────────────────────
  async function pump() {
    if (S.busy) return; S.busy = true;
    try {
      while (S.queue.length) {
        const v = S.queue.shift(), prev = S.v && S.view === 'table' ? S.v : null;
        // Un etat deja depasse (reconnexion) : on saute les animations s'il y en a trop en attente.
        if (S.queue.length > 3) { render(v); continue; }
        setView('table');
        try { await animate(v, prev); } catch {}
        render(v);
        if (v.ev && v.ev.t === 'play' && v.ev.win) { /* la scene de fin est deja jouee */ }
      }
    } finally { S.busy = false; }
  }

  // ── Evenements serveur ──────────────────────────────────────────────────────
  function on(ev, d) {
    ensure();
    if (ev === 'uno-joined') { S.code = d.code; saveSess(d.code); return; }
    if (ev === 'uno-created') { return; }
    if (ev === 'uno-lobby') { if (S.queue.length || S.busy) { /* revient au salon apres une partie */ S.queue = []; } renderLobby(d); return; }
    if (ev === 'uno-state') { S.code = d.code; S.queue.push(d); pump(); return; }
    if (ev === 'uno-error') { toast(U().err[d.message] || U().err.notfound); if (!S.v) { clearSess(); try { showScreen('home'); } catch {} } return; }
    if (ev === 'uno-reconnect-failed') { clearSess(); try { if (sessionStorage.getItem('libero_screen') === 'uno') { sessionStorage.removeItem('libero_screen'); showScreen('home'); } } catch {} return; }
  }
  function create(opts = {}) {
    const name = (typeof getPlayerName === 'function' ? getPlayerName() : '') || (localStorage.getItem('playerName') || '').trim();
    socket.emit('create-uno-room', { name, playerId: getPlayerId() });
    const bots = Math.max(0, Math.min(9, opts.bots | 0));
    if (bots) {
      const once = ({ code }) => { socket.off('uno-created', once); for (let i = 0; i < bots; i++) socket.emit('uno-add-bot'); setTimeout(() => socket.emit('start-uno'), 350); };
      socket.on('uno-created', once);
    }
  }
  function reconnect() { const c = savedCode(); if (c) socket.emit('reconnect-uno-room', { code: c, playerId: getPlayerId() }); return !!c; }
  window.LiberoUno = { _s: S, on, create, reconnect, preview, card, back, SKIN_IDS, skinName: id => U().skins[id] || id, saved: savedCode, clearSession: clearSess, loadCss };
})();
