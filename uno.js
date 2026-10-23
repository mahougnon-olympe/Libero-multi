/* Uno : salon, table ronde, animations et skins de cartes. Charge a la demande par app.js (_unoLoad). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const D = {
    fr: { title: 'Uno', lobby: 'Salon Uno', code: 'Code du salon', copy: 'Copier le code', share: 'Partager le lien', copied: 'Code copié',
      addBot: 'Ajouter un robot', rmBot: 'Retirer un robot', start: 'Lancer la partie', leave: 'Quitter', host: 'Hôte', bot: 'Robot', away: 'Reconnexion',
      need2: 'Il faut au moins 2 joueurs.', waitHost: "En attente de l'hôte pour lancer la partie.", hint: '2 à 10 joueurs. Ajoute des robots pour jouer seul.',
      shuffle: 'On mélange les cartes', dealing: n => `On distribue ${n} cartes chacun`, flip: 'On retourne la première carte', go: "C'est parti !",
      yourTurn: 'À toi de jouer', playDrawn: 'Pose la carte piochée ou passe', turnOf: n => `${n} joue`, pass: 'Passer', uno: 'UNO !', deck: 'Pioche', pile: 'Défausse',
      pickColor: 'Choisis une couleur', rev: 'Le sens du jeu s’inverse', skipT: n => `${n} passe son tour`, plus: (n, k) => `${n} pioche ${k} cartes`, pen: (n, k) => `${n} a oublié UNO : +${k}`,
      unoOf: n => `${n} : UNO !`, win: 'Victoire !', winOf: n => `${n} gagne`, again: 'Rejouer', menu: 'Quitter', left: n => `${n} a quitté la partie`,
      leaveAsk: 'Quitter la partie ?', leaveText: 'Tu abandonnes la partie en cours : elle comptera comme une défaite.', leaveText2: 'Tu quittes le salon.', leaveOk: 'Quitter',
      cards: n => `${n} carte${n > 1 ? 's' : ''}`, err: { started: 'La partie a déjà commencé.', full: 'Le salon est complet (10 joueurs).', notfound: 'Salon introuvable. Vérifie le code.', need2: 'Il faut au moins 2 joueurs.', stake_short: 'Un joueur n’a pas assez de Libs (ou pas de pseudo) pour la mise.' },
      rulesTitle: 'Règle la partie', rulesHost: "Seul l'hôte règle les règles. Tu les vois ici.", presets: { classic: 'Classique', chaos: 'Chaos', fast: 'Rapide' },
      rules: { stack: ['Cumul des +2 et +4', 'Un +2 peut être renvoyé sur un +2, un +4 sur un +4'], swap: ['7 et 0', '7 échange ta main avec quelqu’un, 0 fait tourner les mains'], jump: ['Jouer hors tour', 'Poser la même carte exacte avant son tour'], drawuntil: ['Piocher jusqu’à jouer', 'On pioche jusqu’à avoir une carte jouable'], chal: ['Défi du +4', 'On peut contester un +4'], pen4: ['Pénalité UNO de 4', '4 cartes au lieu de 2 si UNO oublié'] },
      handLbl: 'Cartes au départ', handSub: 'Chacun reçoit ce nombre de cartes', stakeLbl: 'Mise', stakeNone: 'Sans', stakeNote: 'Chaque joueur paie la mise, le gagnant prend le pot (remboursé si la partie est abandonnée par tous). Seuls les humains paient.',
      commTitle: 'Règles de la communauté', commBy: n => `par ${n}`, commNote: 'Ces règles sont jouées sur la parole des joueurs.', commLine: 'Règles maison : ',
      propTitle: 'Propose ta règle', propPh: 'Ex : si on pose un 5, tout le monde pioche une carte', propSend: 'Envoyer', propInfo: n => `${n}/140 · 2 propositions par jour`, propOk: "Merci ! Ta règle est en attente de validation par l'organisateur.",
      propErr: { rate: 'Doucement, réessaie dans un instant.', name: 'Choisis un pseudo avant de proposer une règle.', short: 'Écris une règle un peu plus précise.', banned: 'Ce texte contient un mot interdit.', limit: "Tu as déjà proposé 2 règles aujourd'hui.", invalid: 'Impossible pour le moment.' },
      ruleOk: t => `Ta règle a été validée : « ${t} »`, ruleNo: t => `Ta règle n'a pas été retenue : « ${t} »`,
      chal: 'Contester le +4', pendT: (n, k) => `${n} doit piocher ${k} cartes ou renvoyer`, pendCap: k => `Renvoie la même carte ou pioche ${k} cartes`, pickTarget: 'Échanger ta main avec qui ?',
      swapT: (a, b) => `${a} échange sa main avec ${b}`, rotT: 'Toutes les mains tournent', jumpT: n => `${n} joue hors tour`, chalWon: n => `Défi réussi : ${n} pioche`, chalLost: n => `Défi raté : ${n} pioche 2 de plus`,
      stakeWon: (n, p) => `${n} gagne le pot : ${p} Libs`, stakeRefund: 'Mises remboursées', pot: p => `Pot ${p} Libs`,
      skins: { classic: 'Classique brillant', felt: 'Papier cartonné', gold: 'Noir et or', metal: 'Métal brossé', neon: 'Néon' }, rank: 'Classement', cardsLeft: 'cartes restantes' },
    en: { title: 'Uno', lobby: 'Uno room', code: 'Room code', copy: 'Copy the code', share: 'Share the link', copied: 'Code copied',
      addBot: 'Add a robot', rmBot: 'Remove a robot', start: 'Start the game', leave: 'Leave', host: 'Host', bot: 'Robot', away: 'Reconnecting',
      need2: 'You need at least 2 players.', waitHost: 'Waiting for the host to start the game.', hint: '2 to 10 players. Add robots to play alone.',
      shuffle: 'Shuffling the cards', dealing: n => `Dealing ${n} cards each`, flip: 'Turning over the first card', go: "Let's go!",
      yourTurn: 'Your turn', playDrawn: 'Play the drawn card or pass', turnOf: n => `${n} is playing`, pass: 'Pass', uno: 'UNO!', deck: 'Draw pile', pile: 'Discard',
      pickColor: 'Pick a colour', rev: 'The direction reverses', skipT: n => `${n} skips a turn`, plus: (n, k) => `${n} draws ${k} cards`, pen: (n, k) => `${n} forgot UNO: +${k}`,
      unoOf: n => `${n}: UNO!`, win: 'Victory!', winOf: n => `${n} wins`, again: 'Play again', menu: 'Leave', left: n => `${n} left the game`,
      leaveAsk: 'Leave the game?', leaveText: 'You give up the game in progress: it will count as a loss.', leaveText2: 'You leave the room.', leaveOk: 'Leave',
      cards: n => `${n} card${n > 1 ? 's' : ''}`, err: { started: 'The game has already started.', full: 'The room is full (10 players).', notfound: 'Room not found. Check the code.', need2: 'You need at least 2 players.', stake_short: 'A player does not have enough Libs (or no nickname) for the stake.' },
      rulesTitle: 'Set the game', rulesHost: 'Only the host sets the rules. You can see them here.', presets: { classic: 'Classic', chaos: 'Chaos', fast: 'Fast' },
      rules: { stack: ['Stack +2 and +4', 'A +2 can be sent back on a +2, a +4 on a +4'], swap: ['7 and 0', '7 swaps your hand with someone, 0 rotates all hands'], jump: ['Play out of turn', 'Play the exact same card before your turn'], drawuntil: ['Draw until you can play', 'You draw until you get a playable card'], chal: ['Challenge the +4', 'You can challenge a +4'], pen4: ['UNO penalty of 4', '4 cards instead of 2 if you forget UNO'] },
      handLbl: 'Starting cards', handSub: 'Everyone gets this many cards', stakeLbl: 'Stake', stakeNone: 'None', stakeNote: 'Every player pays the stake, the winner takes the pot (refunded if everyone abandons). Only humans pay.',
      commTitle: 'Community rules', commBy: n => `by ${n}`, commNote: 'These rules are played on the players’ honour.', commLine: 'House rules: ',
      propTitle: 'Suggest your rule', propPh: 'E.g. when someone plays a 5, everyone draws a card', propSend: 'Send', propInfo: n => `${n}/140 · 2 suggestions per day`, propOk: 'Thanks! Your rule is waiting for the organiser to approve it.',
      propErr: { rate: 'Easy, try again in a moment.', name: 'Pick a nickname before suggesting a rule.', short: 'Write a slightly more precise rule.', banned: 'This text contains a banned word.', limit: 'You already suggested 2 rules today.', invalid: 'Not possible right now.' },
      ruleOk: t => `Your rule was approved: "${t}"`, ruleNo: t => `Your rule was not kept: "${t}"`,
      chal: 'Challenge the +4', pendT: (n, k) => `${n} must draw ${k} cards or send it back`, pendCap: k => `Send back the same card or draw ${k} cards`, pickTarget: 'Swap your hand with whom?',
      swapT: (a, b) => `${a} swaps hands with ${b}`, rotT: 'All hands rotate', jumpT: n => `${n} plays out of turn`, chalWon: n => `Challenge won: ${n} draws`, chalLost: n => `Challenge lost: ${n} draws 2 more`,
      stakeWon: (n, p) => `${n} wins the pot: ${p} Libs`, stakeRefund: 'Stakes refunded', pot: p => `Pot ${p} Libs`,
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
    const l = document.createElement('link'); l.id = 'uno-css'; l.rel = 'stylesheet'; l.href = 'uno.css?v=3'; document.head.appendChild(l);
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
        <div class="un-rules" id="un-rules"></div>
        <div class="un-prop" id="un-prop"><b id="un-prop-t"></b><textarea id="un-prop-x" maxlength="140" rows="2"></textarea><div class="row"><small id="un-prop-n"></small><button class="btn btn-secondary" id="un-prop-s"></button></div><small id="un-prop-m" class="msg"></small></div>
        <div class="un-acts"><button class="btn btn-secondary" id="un-addbot"></button><button class="btn btn-secondary" id="un-rmbot"></button></div>
        <div class="un-acts"><button class="btn btn-primary" id="un-start"></button><button class="btn tear-btn" id="un-leave"></button></div>
      </div>
      <div class="un-table">
        <div class="un-top"><button class="un-menu" id="un-menu"></button><span class="un-codeb" id="un-codeb"></span></div>
        <div class="un-ring"></div><div class="un-dir" id="un-dir"></div>
        <div id="un-pls"></div>
        <div class="un-center"><div class="un-deck" id="un-deck"><div id="un-deck-c"></div><span class="un-lbl" id="un-deck-l"></span></div>
          <div class="un-disc" id="un-disc"><span class="un-colorbar" id="un-cb"></span><div id="un-disc-c"></div><span class="un-lbl" id="un-disc-l"></span></div></div>
        <div class="un-cust" id="un-cust"></div>
        <div class="un-cap" id="un-cap"></div>
        <button class="btn btn-primary un-btn-chal" id="un-chal"></button>
        <button class="btn btn-secondary un-btn-pass" id="un-pass"></button>
        <button class="un-btn-uno" id="un-uno"></button>
        <div class="un-hand" id="un-hand"></div>
        <div class="un-picker" id="un-picker"><div class="box"><b id="un-pk-t"></b><div class="cols">
          <button data-c="R" style="background:var(--cR)"></button><button data-c="Y" style="background:var(--cY)"></button><button data-c="B" style="background:var(--cB)"></button><button data-c="G" style="background:var(--cG)"></button></div></div></div>
        <div class="un-picker" id="un-tpick"><div class="box"><b id="un-tp-t"></b><div class="tgs" id="un-tp-l"></div></div></div>
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
    $('#un-chal', root).onclick = () => { snd('click'); socket.emit('uno-challenge'); };
    $('#un-rules', root).onclick = rulesClick;
    const px = $('#un-prop-x', root);
    px.oninput = () => { $('#un-prop-n', root).textContent = U().propInfo(px.value.length); };
    $('#un-prop-s', root).onclick = () => { const t = px.value.trim(); if (!t) return; socket.emit('uno-propose-rule', { playerId: getPlayerId(), text: t }); };
    $('#un-tpick', root).onclick = e => {
      const b = e.target.closest('button[data-t]');
      if (!b) { if (e.target.id === 'un-tpick') { S.pendingWild = null; $('#un-tpick', root).classList.remove('on'); } return; }
      const id = S.pendingWild; S.pendingWild = null; $('#un-tpick', root).classList.remove('on');
      if (id != null) { snd('piece-place'); socket.emit('uno-play', { cardId: id, color: null, uno: false, target: +b.dataset.t }); }
    };
    $('#un-pass', root).onclick = () => { snd('click'); socket.emit('uno-pass'); };
    $('#un-uno', root).onclick = () => { snd('click-ok'); socket.emit('uno-call'); };
    $('#un-hand', root).onclick = e => {
      const c = e.target.closest('.uc'); if (!c || !c.classList.contains('ok')) return;
      const id = +c.dataset.id, cd = S.v.hand.find(x => x.id === id); if (!cd) return;
      if (!canAct() && !(canJump(cd) && !S.busy)) return;
      if (cd.v === '7' && S.v.opts && S.v.opts.swap && S.v.players.length > 2) { S.pendingWild = id; showTargets(); return; }
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
    renderRules(v);
  }
  // ── Regles de la partie (salon) ─────────────────────────────────────────────
  const RK = ['stack', 'swap', 'jump', 'drawuntil', 'chal', 'pen4'];
  const PRE = { classic: { stack: 0, swap: 0, jump: 0, drawuntil: 0, chal: 0, pen4: 0, hand: 7 }, chaos: { stack: 1, swap: 1, jump: 1, drawuntil: 1, chal: 1, pen4: 1, hand: 7 }, fast: { stack: 1, swap: 0, jump: 0, drawuntil: 1, chal: 0, pen4: 0, hand: 5 } };
  const STAKES = [0, 50, 100, 250, 500];
  const sameOpts = (o, p) => RK.every(k => !!o[k] === !!p[k]) && o.hand === p.hand;
  function renderRules(v) {
    const o = v.opts || PRE.classic, host = !!v.youHost, u = U(), dis = host ? '' : ' disabled';
    const cur = Object.keys(PRE).find(k => sameOpts(o, PRE[k]));
    let h = `<h3>${u.rulesTitle}</h3>${host ? '' : `<p class="un-hint">${u.rulesHost}</p>`}<div class="chips">${Object.keys(PRE).map(k => `<button type="button" class="chip${cur === k ? ' on' : ''}" data-pre="${k}"${dis}>${u.presets[k]}</button>`).join('')}</div>`;
    h += RK.map(k => `<div class="rl"><span>${u.rules[k][0]}<small>${u.rules[k][1]}</small></span><button type="button" class="tg${o[k] ? ' on' : ''}" data-rk="${k}" aria-pressed="${!!o[k]}"${dis}></button></div>`).join('');
    h += `<div class="rl"><span>${u.handLbl}<small>${u.handSub}</small></span><span class="stp"><button type="button" data-hand="-1"${dis}>-</button><b>${o.hand}</b><button type="button" data-hand="1"${dis}>+</button></span></div>`;
    const rules = v.rules || [];
    if (rules.length) h += `<h3 class="sub">${u.commTitle}</h3><p class="un-hint">${u.commNote}</p>` + rules.map(r => `<div class="rl"><span>${esc(r.text)}<small>${u.commBy(esc(r.author || ''))}</small></span><button type="button" class="tg${(v.cust || []).includes(r.id) ? ' on' : ''}" data-cust="${esc(r.id)}"${dis}></button></div>`).join('');
    h += `<h3 class="sub">${u.stakeLbl}</h3><div class="chips">${STAKES.map(x => `<button type="button" class="chip${(v.stake || 0) === x ? ' on' : ''}" data-stake="${x}"${dis}>${x ? x : u.stakeNone}</button>`).join('')}</div><p class="un-hint">${u.stakeNote}</p>`;
    $('#un-rules', root).innerHTML = h;
    $('#un-prop-t', root).textContent = u.propTitle; $('#un-prop-x', root).placeholder = u.propPh; $('#un-prop-s', root).textContent = u.propSend;
    $('#un-prop-n', root).textContent = u.propInfo($('#un-prop-x', root).value.length);
  }
  function rulesClick(e) {
    const v = S.v; if (!v || !v.youHost || v.status !== 'waiting') return;
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const o = Object.assign({}, v.opts || PRE.classic); let cust = (v.cust || []).slice(), stake = v.stake || 0;
    if (b.dataset.pre) Object.assign(o, PRE[b.dataset.pre]);
    else if (b.dataset.rk) o[b.dataset.rk] = !o[b.dataset.rk];
    else if (b.dataset.hand) o.hand = Math.max(5, Math.min(10, o.hand + (+b.dataset.hand)));
    else if (b.dataset.cust) { const id = b.dataset.cust; cust = cust.includes(id) ? cust.filter(x => x !== id) : cust.concat(id); }
    else if (b.dataset.stake != null) stake = +b.dataset.stake;
    else return;
    snd('click'); socket.emit('uno-set-opts', { opts: o, cust, stake });
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
    $('#un-menu', root).textContent = U().menu;
    $('#un-pk-t', root).textContent = U().pickColor;
    const my = v.turn === v.mySeat && v.status === 'playing' && v.mySeat >= 0;
    $('#un-deck', root).classList.toggle('can', my && v.drawn == null);
    $('#un-tpick', root).classList.remove('on');
    $('#un-pass', root).textContent = U().pass; $('#un-pass', root).classList.toggle('on', my && v.drawn != null);
    $('#un-uno', root).textContent = U().uno;
    $('#un-uno', root).classList.toggle('on', v.status === 'playing' && v.mySeat >= 0 && v.hand.length === 2 && !v.called[v.mySeat]);
    $('#un-cap', root).textContent = v.status !== 'playing' ? '' : my ? (v.pend ? U().pendCap(v.pend.n) : v.drawn != null ? U().playDrawn : U().yourTurn) : U().turnOf(v.players[v.turn]?.name || '');
    const ch = $('#un-chal', root); ch.textContent = U().chal; ch.classList.toggle('on', !!(my && v.pend && v.pend.ch));
    $('#un-cust', root).textContent = v.custText && v.custText.length ? U().commLine + v.custText.join(' · ') : '';
    $('#un-codeb', root).textContent = v.code + (v.stake ? ' · ' + U().pot(v.stake * (v.players.filter(p => !p.bot).length)) : '');
    // Main
    const hand = $('#un-hand', root);
    hand.innerHTML = v.hand.map(c => card(c, my ? (isPlayable(v, c) ? 'ok' : 'no') : (canJump(c) ? 'ok' : ''))).join('');
    layoutHand(v);
    timer(v);
    // Fin
    const end = $('#un-end', root);
    if (v.status === 'finished') showEnd(v); else end.classList.remove('on');
  }
  function isPlayable(v, c) {
    if (v.pend) return !!(v.opts && v.opts.stack) && c.v === v.pend.v;
    if (v.drawn != null && c.id !== v.drawn) return false; return c.c === 'W' || c.c === v.color || c.v === v.top.v;
  }
  function canJump(c) { const v = S.v; return !!(v && v.status === 'playing' && v.mySeat >= 0 && v.turn !== v.mySeat && v.opts && v.opts.jump && !v.pend && v.drawn == null && c.c !== 'W' && v.top && c.c === v.top.c && c.v === v.top.v && c.c === v.color); }
  function showTargets() {
    const v = S.v; $('#un-tp-t', root).textContent = U().pickTarget;
    $('#un-tp-l', root).innerHTML = v.players.map((p, i) => i === v.mySeat ? '' : `<button class="btn btn-secondary" data-t="${i}">${esc(p.name)} (${v.counts[i]})</button>`).join('');
    $('#un-tpick', root).classList.add('on');
  }
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
      if (ev.jump) { big(U().jumpT(ev.name || ''), 'var(--accent)', 30); await wait(450); }
      if (ev.pend) { big(U().pendT(prev.players[ev.pend.seat]?.name || '', ev.pend.n), 'var(--cR)', 30); await wait(700); }
      if (ev.swap) { big(U().swapT(prev.players[ev.swap.from]?.name || '', prev.players[ev.swap.to]?.name || ''), 'var(--accent)', 30); await wait(800); }
      if (ev.rotate) { big(U().rotT, 'var(--accent)', 30); await wait(800); }
      if (ev.draw) { big(U().plus(prev.players[ev.draw.seat]?.name || '', ev.draw.n), 'var(--cR)', 30); await drawFlights(prev, ev.draw.seat, ev.draw.n); }
      if (ev.penalty) { big(U().pen(prev.players[ev.penalty.seat]?.name || '', ev.penalty.n), 'var(--cR)', 30); await drawFlights(prev, ev.penalty.seat, ev.penalty.n); }
      if (ev.win) { await winAnim(v); }
    } else if (ev.t === 'draw') {
      await drawFlights(prev, ev.seat, ev.n);
    } else if (ev.t === 'challenge') {
      big((ev.won ? U().chalWon : U().chalLost)(prev.players[ev.draw.seat]?.name || ''), 'var(--cR)', 30);
      await drawFlights(prev, ev.draw.seat, ev.draw.n);
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
    $('#un-cap', root).textContent = U().dealing(v.hand.length || 7);
    const n = v.players.length, order = Array.from({ length: n }, (_, i) => (v.mySeat >= 0 ? v.mySeat : 0) + i).map(i => i % n);
    const flights = [], gap = n > 4 ? 55 : 70; let idx = 0;
    for (let r = 0; r < (v.hand.length || 7); r++) for (const seat of order) { flights.push(fly(back('lg'), { x: d.x, y: d.y, w: d.w, h: d.h }, seatRect(v, seat), { d: 420, delay: idx++ * gap })); }
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
    if (ev === 'uno-joined') { S.code = d.code; saveSess(d.code); if (!S.checked) { S.checked = true; checkMyRules(); } return; }
    if (ev === 'uno-created') { return; }
    if (ev === 'uno-lobby') { if (S.queue.length || S.busy) { /* revient au salon apres une partie */ S.queue = []; } renderLobby(d); return; }
    if (ev === 'uno-state') { S.code = d.code; S.queue.push(d); pump(); return; }
    if (ev === 'uno-propose-result') {
      const m = $('#un-prop-m', root);
      if (d.ok) { m.textContent = U().propOk; m.className = 'msg ok'; $('#un-prop-x', root).value = ''; $('#un-prop-n', root).textContent = U().propInfo(0); }
      else { m.textContent = U().propErr[d.error] || U().propErr.invalid; m.className = 'msg'; }
      return;
    }
    if (ev === 'uno-stake') { toast(d.outcome === 'won' ? U().stakeWon(d.winner || '', d.pot) : U().stakeRefund); return; }
    if (ev === 'uno-rule-result' || ev === 'uno-my-rules') { ruleNews(ev === 'uno-my-rules' ? d : [d]); return; }
    if (ev === 'uno-error') { toast(U().err[d.message] || U().err.notfound); if (!S.v) { clearSess(); try { showScreen('home'); } catch {} } return; }
    if (ev === 'uno-reconnect-failed') { clearSess(); try { if (sessionStorage.getItem('libero_screen') === 'uno') { sessionStorage.removeItem('libero_screen'); showScreen('home'); } } catch {} return; }
  }
  // Les auteurs sont prevenus (cloche) quand une de leurs regles est validee ou refusee.
  function ruleNews(list) {
    let seen = {}; try { seen = JSON.parse(localStorage.getItem('libero_uno_rules_seen') || '{}'); } catch {}
    (Array.isArray(list) ? list : []).forEach(r => {
      if (!r || r.status === 'pending' || seen[r.id] === r.status) return;
      seen[r.id] = r.status;
      try { window._notify?.add({ type: 'uno-rule', icon: r.status === 'ok' ? '✓' : '✕', text: (r.status === 'ok' ? U().ruleOk : U().ruleNo)(r.text || '') }); } catch {}
    });
    try { localStorage.setItem('libero_uno_rules_seen', JSON.stringify(seen)); } catch {}
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
  function checkMyRules() { try { socket.emit('uno-my-rules', { playerId: getPlayerId() }); } catch {} }
  function reconnect() { const c = savedCode(); if (c) socket.emit('reconnect-uno-room', { code: c, playerId: getPlayerId() }); return !!c; }
  window.LiberoUno = { _s: S, on, checkMyRules, create, reconnect, preview, card, back, SKIN_IDS, skinName: id => U().skins[id] || id, saved: savedCode, clearSession: clearSess, loadCss };
})();
