/* Undercover : salon a distance (4 a 10 joueurs, chacun sur son telephone). Charge a la demande par app.js (_ucLoad).
   Rendu dans un shadow DOM : le style du site ne touche pas le jeu, et inversement. Style cahier (jour) / ardoise (nuit). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const D = {
    fr: {
      title: 'Undercover', lobby: 'Salon Undercover', code: 'Code du salon', register: 'Registre de la classe', copy: 'Copier le code', share: 'Partager le lien', copied: 'Code copié',
      start: 'Lancer la partie', leave: 'Quitter', need4: 'Il faut au moins 4 joueurs.', waitHost: "En attente de l'hôte pour lancer la partie.", hint: '4 à 10 joueurs, chacun sur son téléphone. Indices écrits, 30 secondes chacun.',
      maxLbl: 'Joueurs maximum', rolesTxt: (c, u, w) => `${c} civils, ${u} Undercover${w ? ', 1 Mr. White' : ''}`, host: 'Hôte', away: 'Reconnexion',
      shuffle: 'On mélange les rôles...', dealt: 'Les cartes sont distribuées', yourWord: 'Ton mot secret', hold: 'Maintiens la carte\npour voir ton mot', yourWordIs: 'Ton mot', same: 'Tu ne sais pas si les autres ont le même mot.',
      whiteTitle: 'Tu es Mr. White', whiteTxt: "Tu n'as aucun mot. Écoute les indices et bluffe !", ready: 'Je suis prêt', readyDone: 'Prêt, on attend les autres', hush: 'Chut : les autres regardent aussi leur carte',
      center: 'Un indice,\nun seul mot', seeWord: 'Clique pour voir ton mot', yourTurn: 'À toi : un seul mot', send: 'Envoyer', said: 'Mots déjà dits', skipped: '(passé)', writes: n => `${n} écrit son indice...`, phold: 'Ton indice',
      debate: 'On en discute', toVote: 'Passer au vote', waitVote: 'Prêt pour le vote', debateSub: 'Débat libre avant le vote', say: 'Écris un message', whoIs: "Qui est l'intrus ?", voteBtn: 'Voter', voted: 'Vote envoyé. On attend les autres...', pick: 'Touche un joueur, puis vote',
      tie: 'Égalité ! Second vote entre les ex aequo', voteCount: (a, b) => `${a} / ${b} ont voté`, verdict: 'Le verdict est tombé...', wasX: n => `${n} était`, hisWord: 'Son mot', civHad: w => `Les civils avaient « ${w} »`, hisWordNone: 'Aucun mot',
      roles: { civil: 'Civil', undercover: 'Undercover', white: 'Mr. White' }, byLot: 'Égalité : le sort a désigné ce joueur.', left: 'a quitté la partie',
      guessT: 'Dernière chance : devine le mot des civils', guessing: n => `${n} réfléchit...`, guessPh: 'Ton mot', guessGo: 'Valider', miss: 'RATÉ', hit: 'BIEN VU !', wasWhite: n => `${n} est éliminé : c'était Mr. White !`,
      win: { civils: 'LES CIVILS GAGNENT', infiltrators: 'LES INFILTRÉS GAGNENT', white: 'MR. WHITE GAGNE' }, youWin: 'Tu as gagné', youLose: 'Tu as perdu', again: 'Rejouer', waitAgain: "L'hôte peut relancer une partie.", xp: n => `+${n} XP`,
      spect: 'Tu es éliminé : tu regardes la suite.', round: n => `Manche ${n}`, leaveAsk: 'Quitter la partie ?', leaveText: 'Tu abandonnes la partie en cours : elle comptera comme une défaite.', leaveText2: 'Tu quittes le salon.', leaveOk: 'Quitter',
      err: { started: 'La partie a déjà commencé.', full: 'Le salon est complet.', notfound: 'Salon introuvable. Vérifie le code.', need4: 'Il faut au moins 4 joueurs.', oneword: 'Un seul mot, sans espace.', sameword: 'Tu ne peux pas dire ton propre mot.', banned: 'Ce mot est interdit.', aborted: 'Partie arrêtée : pas assez de joueurs.' } },
    en: {
      title: 'Undercover', lobby: 'Undercover room', code: 'Room code', register: 'Class register', copy: 'Copy the code', share: 'Share the link', copied: 'Code copied',
      start: 'Start the game', leave: 'Leave', need4: 'You need at least 4 players.', waitHost: 'Waiting for the host to start the game.', hint: '4 to 10 players, each on their own phone. Written clues, 30 seconds each.',
      maxLbl: 'Max players', rolesTxt: (c, u, w) => `${c} civilians, ${u} Undercover${w ? ', 1 Mr. White' : ''}`, host: 'Host', away: 'Reconnecting',
      shuffle: 'Shuffling the roles...', dealt: 'The cards are dealt', yourWord: 'Your secret word', hold: 'Hold the card\nto see your word', yourWordIs: 'Your word', same: "You don't know if the others have the same word.",
      whiteTitle: 'You are Mr. White', whiteTxt: 'You have no word. Listen to the clues and bluff!', ready: "I'm ready", readyDone: 'Ready, waiting for the others', hush: 'Shh: the others are looking at their card too',
      center: 'One clue,\none word', seeWord: 'Click to see your word', yourTurn: 'Your turn: one word', send: 'Send', said: 'Words so far', skipped: '(passed)', writes: n => `${n} is writing a clue...`, phold: 'Your clue',
      debate: "Let's talk", toVote: 'Go to the vote', waitVote: 'Ready to vote', debateSub: 'Open debate before the vote', say: 'Write a message', whoIs: 'Who is the impostor?', voteBtn: 'Vote', voted: 'Vote sent. Waiting for the others...', pick: 'Tap a player, then vote',
      tie: 'Tie! Second vote between the tied players', voteCount: (a, b) => `${a} / ${b} voted`, verdict: 'The verdict is in...', wasX: n => `${n} was`, hisWord: 'Their word', civHad: w => `The civilians had "${w}"`, hisWordNone: 'No word',
      roles: { civil: 'Civilian', undercover: 'Undercover', white: 'Mr. White' }, byLot: 'Tie: luck picked this player.', left: 'left the game',
      guessT: "Last chance: guess the civilians' word", guessing: n => `${n} is thinking...`, guessPh: 'Your word', guessGo: 'Confirm', miss: 'MISSED', hit: 'WELL SPOTTED!', wasWhite: n => `${n} is out: it was Mr. White!`,
      win: { civils: 'THE CIVILIANS WIN', infiltrators: 'THE IMPOSTORS WIN', white: 'MR. WHITE WINS' }, youWin: 'You won', youLose: 'You lost', again: 'Play again', waitAgain: 'The host can start another game.', xp: n => `+${n} XP`,
      spect: "You're out: you're watching the rest.", round: n => `Round ${n}`, leaveAsk: 'Leave the game?', leaveText: 'You give up the game in progress: it will count as a loss.', leaveText2: 'You leave the room.', leaveOk: 'Leave',
      err: { started: 'The game has already started.', full: 'The room is full.', notfound: 'Room not found. Check the code.', need4: 'You need at least 4 players.', oneword: 'One word only, no spaces.', sameword: "You can't say your own word.", banned: 'This word is not allowed.', aborted: 'Game stopped: not enough players.' } },
  };
  const U = () => D[L()];
  const $$ = (s, r) => [].slice.call((r || root).querySelectorAll(s));
  const $ = (s, r) => (r || root).querySelector(s);
  const esc = s => (typeof _escHtml === 'function' ? _escHtml(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { return false; } };
  const toast = m => { try { showCursorSnakeToast(m); } catch {} };
  const nl = s => esc(s).replace(/\n/g, '<br>');

  const S = { peek: false, code: null, v: null, cur: null, key: '', dealt: false, said: 0, sel: null, voteSent: false, tm: [], pa: [], raf: 0, chatN: 0, typedN: 0, shownVerdict: '' };
  const SESS = 'libero_uc';
  const saveSess = code => { try { sessionStorage.setItem(SESS, code); localStorage.setItem(SESS, JSON.stringify({ code, at: Date.now() })); } catch {} };
  const clearSess = () => { try { sessionStorage.removeItem(SESS); localStorage.removeItem(SESS); } catch {} S.code = null; S.v = null; S.cur = null; S.key = ''; S.dealt = false; S.peek = false; };
  function savedCode() {
    try { const a = sessionStorage.getItem(SESS); if (a) return a; const b = JSON.parse(localStorage.getItem(SESS) || 'null'); if (b && Date.now() - b.at < 2 * 3600e3) return b.code; } catch {}
    return null;
  }
  const T = (ms, f) => { S.tm.push(setTimeout(f, ms)); };
  const clearTm = () => { S.tm.forEach(t => { clearTimeout(t); clearInterval(t); }); S.tm = []; };

  // ── Sons (synthese, comme dans la maquette) : respectent le reglage « effets sonores » du site ──
  let AC = null;
  const sfxOn = () => (typeof sfxEnabled === 'undefined' || !!sfxEnabled);
  const vol = () => (typeof sfxVolume === 'number' && !isNaN(sfxVolume) ? Math.max(0.05, Math.min(1, sfxVolume * 2)) : 1);
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return AC; };
  function tone(f, d, ty, v, sl) { if (!sfxOn()) return; const a = ac(); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(), n = a.currentTime; o.type = ty || 'sine'; o.frequency.setValueAtTime(f, n); if (sl) o.frequency.exponentialRampToValueAtTime(sl, n + d); g.gain.setValueAtTime((v || .1) * vol(), n); g.gain.exponentialRampToValueAtTime(.0001, n + d); o.connect(g); g.connect(a.destination); o.start(); o.stop(n + d); } catch {} }
  function noise(d, v, fq, ty) { if (!sfxOn()) return; const a = ac(); if (!a) return; try { const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), da = b.getChannelData(0); for (let i = 0; i < n; i++) da[i] = Math.random() * 2 - 1; const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = ty || 'lowpass'; f.frequency.value = fq || 800; const g = a.createGain(); g.gain.setValueAtTime(v * vol(), a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); s.connect(f); f.connect(g); g.connect(a.destination); s.start(); } catch {} }
  const SX = {
    pop() { tone(700, .12, 'sine', .12, 1100); }, tick() { tone(1900, .04, 'square', .04); }, scr() { noise(.25, .08, 3500, 'highpass'); }, thud() { tone(80, .35, 'sine', .5, 40); noise(.15, .2, 400); },
    boom() { tone(60, .8, 'sine', .6, 28); noise(.4, .3, 250); }, flip() { noise(.12, .12, 2200, 'bandpass'); }, chime() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, .9, 'sine', .1), i * 100)); },
    drum() { for (let i = 0; i < 10; i++) setTimeout(() => tone(110, .08, 'sine', .25, 70), i * 110); }, bad() { tone(220, .5, 'sawtooth', .08, 110); },
  };

  // ── Hote et ecran ──
  let host = null, root = null, ph = null, fx = null;
  function ensure() {
    if (host) return;
    host = document.createElement('div'); host.id = 'screen-undercover'; host.className = 'screen';
    host.style.cssText = 'padding:0;gap:0;justify-content:flex-start;align-items:stretch';
    root = host.attachShadow({ mode: 'open' });
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'undercover.css?v=4'; root.appendChild(link);
    const wrap = document.createElement('div'); wrap.className = 'root'; wrap.innerHTML = '<div class="ph" id="ph"></div><canvas id="fx"></canvas>';
    root.appendChild(wrap);
    (document.getElementById('screen-home')?.parentNode || document.body).appendChild(host);
    ph = $('#ph'); fx = $('#fx');
    syncTheme();
    try { new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch {}
    ph.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act, b); });
  }
  function syncTheme() { const w = root && $('.root'); if (w) w.classList.toggle('lt', document.documentElement.classList.contains('light')); }
  function setScene(html, key) {
    ensure(); if (!host.classList.contains('active')) showScreen('undercover');
    clearTm(); ph.innerHTML = html; S.key = key; syncTheme();
    try { window.scrollTo(0, 0); } catch {}
  }

  // ── Briques ──
  function portrait(p) { try { if (window.LiberoPortrait) return p ? LiberoPortrait.svg(p) : LiberoPortrait.blank(); } catch {} return ''; }
  function pf(p, s) { return `<span class="pf" style="--s:${s || 52}px">${portrait(p && p.portrait)}</span>`; }
  const pfI = (v, i, s) => pf(v.players[i], s);
  function hdr(t, rd) { return `<div class="top"><button class="back" data-act="back" aria-label="${esc(U().leave)}">&#8592;</button><span class="ttl">${esc(t)}</span><span class="rd">${esc(rd || '')}</span></div>`; }
  function rolesCounts(n) { const u = n <= 7 ? 1 : 2, w = n <= 4 ? 0 : 1; return [n - u - w, u, w]; }
  function posOf(v, i, n) { const rel = (i - v.me + n) % n, a = Math.PI / 2 + rel * 2 * Math.PI / n; return [160 + Math.cos(a) * 128, 155 + Math.sin(a) * 120]; }
  function av(v, i, size) {
    const p = v.players[i], me = i === v.me;
    return `<div class="av${me ? ' me' : ''}${p.alive === false ? ' out' : ''}${p.connected ? '' : ' off'}" data-i="${i}"><div class="rg"><svg viewBox="0 0 70 70"><circle class="a" cx="35" cy="35" r="31.5"/><circle class="b" cx="35" cy="35" r="31.5"/></svg></div>${pf(p, size)}<span class="nm">${esc(p.name)}</span><div class="pen"><svg viewBox="0 0 34 26"><path d="M4 22q5-10 10-4t10-8" stroke="var(--red)" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M22 4l8 6-12 10-8 2 2-8z" fill="#ffe169" stroke="#22252b" stroke-width="1.6" stroke-linejoin="round"/></svg></div><div class="bub"></div></div>`;
  }
  function table(v, center) {
    const n = v.players.length, size = n > 7 ? 42 : 52; let h = `<div class="table" id="tb"><div class="top2" id="tc">${center}</div>`;
    for (let i = 0; i < n; i++) { const p = posOf(v, i, n); h += `<div class="seat" style="left:${p[0]}px;top:${p[1]}px">${av(v, i, size)}</div>`; }
    return h + '</div>';
  }
  const seat = i => $(`.av[data-i="${i}"]`);
  function myCard(v) {
    const white = v.myWord == null || v.myWord === '';
    return `<div class="scard${S.peek ? ' open' : ''}" data-act="peek"><div class="in"><div class="sa"><span class="q">?</span>${esc(U().seeWord)}</div><div class="sb">${white ? `<b>MR. WHITE</b>` : `<span class="sm">${esc(U().yourWordIs)}</span><b>${esc(v.myWord)}</b>`}</div></div></div>`;
  }
  function typeInto(el, txt, ms, done) {
    if (reduce()) { el.textContent = txt; done && done(); return; }
    let k = 0; el.textContent = ''; const id = setInterval(() => { el.textContent = txt.slice(0, ++k); if (k >= txt.length) { clearInterval(id); done && done(); } }, ms || 90); S.tm.push(id);
  }
  function ringFor(i, v) {
    const e = seat(i); if (!e) return; const b = e.querySelector('.rg .b'); if (!b) return;
    const total = (v.phaseTotal || 30000) / 1000, el = Math.max(0, total - Math.max(0, (v.phaseEnd - Date.now()) / 1000));
    b.style.animation = 'none'; void b.getBoundingClientRect(); b.style.animation = `tmr ${total}s linear -${el}s forwards`;
  }
  function timerBar(v) { const total = (v.phaseTotal || 20000) / 1000, el = Math.max(0, total - Math.max(0, (v.phaseEnd - Date.now()) / 1000)); return `<div class="bar2"><i style="animation:tmr2 ${total}s linear -${el}s forwards"></i></div>`; }
  function confetti(n) {
    if (!fx || reduce()) return; const W = fx.width = fx.offsetWidth, H = fx.height = fx.offsetHeight, x = fx.getContext('2d'), col = ['#e2485d', '#e0a800', '#173a8a', '#1f8a54', '#fff27a'];
    for (let i = 0; i < n; i++) S.pa.push({ x: Math.random() * W, y: -10 - Math.random() * H * .4, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6, vr: .2, c: col[i % 5] });
    if (S.raf) return;
    (function f() { x.clearRect(0, 0, W, H); S.pa = S.pa.filter(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y > H + 10) return false; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-4, -6, 8, 12); x.restore(); return true; }); S.raf = S.pa.length ? requestAnimationFrame(f) : 0; })();
  }

  // ── Actions des boutons ──
  function act(a, el) {
    const v = S.v;
    if (a === 'back') return leave(true);
    if (a === 'copy') { try { navigator.clipboard.writeText(S.code); } catch {} return toast(U().copied); }
    if (a === 'share') { const url = `${location.origin}${location.pathname}?join=${S.code}`; try { if (navigator.share) { navigator.share({ title: "Libero's Multi", text: `Undercover : ${S.code}`, url }); return; } } catch { return; } try { navigator.clipboard.writeText(url); } catch {} return toast(U().copied); }
    if (a === 'start') return socket.emit('uc-start');
    if (a === 'max-') return socket.emit('uc-set-max', { max: (v.max || 8) - 1 });
    if (a === 'max+') return socket.emit('uc-set-max', { max: (v.max || 8) + 1 });
    if (a === 'ready') { el.disabled = true; el.textContent = U().readyDone; return socket.emit('uc-ready'); }
    if (a === 'tovote') { el.disabled = true; el.textContent = U().waitVote; return socket.emit('uc-ready'); }
    if (a === 'send') return sendClue();
    if (a === 'say') return sendSay();
    if (a === 'vote') return castVote(el);
    if (a === 'guess') { const i = $('#gi'); if (i && i.value.trim()) { socket.emit('uc-guess', { text: i.value.trim() }); el.disabled = true; } return; }
    if (a === 'again') return socket.emit('uc-restart');
    if (a === 'quit') return leave(false, true);
    if (a === 'peek') { S.peek = !S.peek; return $$('.scard').forEach(x => x.classList.toggle('open', S.peek)); }
    if (a === 'pick') { if (S.voteSent) return; S.sel = +el.dataset.i; $$('.vc').forEach(x => x.classList.toggle('sel', x === el)); SX.pop(); const b = $('#vb'); if (b) b.disabled = false; }
  }
  async function leave(ask, fromEnd) {
    const v = S.v, playing = v && v.status === 'playing' && v.alive !== false;
    if (ask && !fromEnd) {
      const ok = await _slateConfirm({ title: U().leaveAsk, text: playing ? U().leaveText : U().leaveText2, ok: U().leaveOk });
      if (!ok) return;
    }
    socket.emit('leave-uc-room'); clearSess(); clearTm(); S.pa = [];
    try { sessionStorage.removeItem('libero_screen'); } catch {}
    showScreen('home');
  }

  // ── Salon ──
  function lobbyHtml(v) {
    const n = v.players.length, c = rolesCounts(Math.max(4, n)), ok = n >= v.min;
    return hdr(U().lobby, '') + `<div class="lobby"><div class="sm">${U().code}</div><div class="code">${(S.code || '').split('').map((ch, i) => `<b style="animation-delay:${.1 + i * .3}s">${esc(ch)}</b>`).join('')}</div>
      <div class="row2"><button class="btn alt" data-act="copy">${U().copy}</button><button class="btn alt" data-act="share">${U().share}</button></div>
      <div class="reg"><span class="tape"></span><div class="sm" style="text-align:left;margin-bottom:2px">${U().register} (${n}/${v.max})</div><div id="rows">${v.players.map(p => `<div class="rw${p.connected ? '' : ' off'}">${pf(p, 32)}<span>${esc(p.name)}${p.host ? ' <small class="sm">' + U().host + '</small>' : ''}</span><svg class="tk" viewBox="0 0 22 22"><path d="M3 12l5 5 11-12"/></svg></div>`).join('')}</div></div>
      ${v.host ? `<div class="mx"><span class="sm">${U().maxLbl}</span><button class="sq" data-act="max-" ${v.max <= Math.max(v.min, n) ? 'disabled' : ''}>-</button><b>${v.max}</b><button class="sq" data-act="max+" ${v.max >= 10 ? 'disabled' : ''}>+</button></div>` : ''}
      <div class="sm">${U().rolesTxt(c[0], c[1], c[2])}<br>${v.host ? U().hint : U().waitHost}</div>
      <div class="foot" style="margin-top:auto;width:100%">${v.host ? `<button class="btn${ok ? ' pulse' : ''}" data-act="start" ${ok ? '' : 'disabled'}>${ok ? U().start : U().need4}</button>` : ''}</div></div>`;
  }
  function renderLobby(v) { S.v = v; S.cur = 'lobby'; setScene(lobbyHtml(v), 'lobby'); }

  // ── Distribution : melange, puis les cartes volent jusqu'aux joueurs ──
  function dealAnim(v, then) {
    const n = v.players.length;
    setScene(hdr(U().title, U().round(1)) + `<div class="body"><div class="cap" id="dc">${U().shuffle}</div>${table(v, '<div class="deck sh" id="dk" style="width:60px;height:84px"><i></i><i></i><i></i><i></i><i></i><i></i></div>')}</div>`, 'deal');
    SX.flip();
    const tb = $('#tb'), d0 = [145, 134];
    T(1700, () => {
      $('#dk').style.display = 'none'; $('#dc').textContent = U().dealt;
      for (let i = 0; i < n; i++) T(i * 280, () => {
        const c = document.createElement('div'); c.className = 'cardc'; c.style.left = d0[0] + 'px'; c.style.top = d0[1] + 'px'; tb.appendChild(c);
        const s = posOf(v, i, n), to = [(s[0] - 160) * .52, (s[1] - 155) * .52];
        c.animate([{ transform: 'translate(0,0) rotate(0deg) scale(.9)' }, { transform: `translate(${to[0] * .6}px,${to[1] * .6 - 30}px) rotate(${180 + i * 40}deg) scale(1.15)`, offset: .55 }, { transform: `translate(${to[0]}px,${to[1]}px) rotate(${i * 60 - 20}deg) scale(1)` }], { duration: 560, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
        SX.flip();
      });
    });
    T(1700 + n * 280 + 700, then);
  }

  // ── Ma carte ──
  function revealHtml(v) {
    const white = v.iAmWhite;
    return hdr(U().title, U().round(1)) + `<div class="body"><div class="cap">${white ? U().whiteTitle : U().yourWord}</div>
      <div class="flip" id="fl"><div class="in"><div class="fa"><span class="q">?</span>${nl(U().hold)}</div>
      <div class="fb">${white ? `<div class="wd" style="font-size:1.6rem">MR. WHITE</div><div class="sm">${esc(U().whiteTxt)}</div>` : `<div class="sm">${U().yourWordIs}</div><div class="wd">${esc(v.myWord || '')}</div><svg class="scrib" viewBox="0 0 170 14"><path d="M4 9q40-9 80-2t82-3"/></svg><div class="sm">${U().same}</div>`}</div></div></div>
      <div id="rt">${timerBar(v)}</div><div class="rdyrow" id="rdy" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center"></div><div class="sm">${U().hush}</div></div>
      <div class="foot"><button class="btn" data-act="ready" id="rb">${U().ready}</button></div>`;
  }
  function renderReveal(v) {
    setScene(revealHtml(v), 'reveal');
    const f = $('#fl'); let demo = true;
    const on = () => { f.classList.add('on'); SX.flip(); }, off = () => { f.classList.remove('on'); SX.flip(); };
    f.onpointerdown = e => { e.preventDefault(); demo = false; on(); };
    f.onpointerup = f.onpointerleave = f.onpointercancel = () => { if (f.classList.contains('on')) off(); };
    f.oncontextmenu = e => e.preventDefault();
    refreshReveal(v);
  }
  function refreshReveal(v) {
    const r = $('#rdy'); if (!r) return;
    r.innerHTML = v.players.map(p => p.alive === false ? '' : `<span style="opacity:${p.ready ? 1 : .35};display:inline-flex;align-items:center;gap:2px">${pf(p, 28)}${p.ready ? '<svg viewBox="0 0 22 22" width="14" height="14"><path d="M3 12l5 5 11-12" stroke="var(--ok)" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>' : ''}</span>`).join('');
    const me = v.players[v.me], b = $('#rb'); if (b && me && me.ready) { b.disabled = true; b.textContent = U().readyDone; }
  }

  // ── Indices ──
  function cluesHtml(v) {
    return hdr(U().title, U().round(v.round)) + `<div class="body"><div class="colL">${myCard(v)}</div><div class="colA">${table(v, `<span>${nl(U().center)}</span>`)}</div>
      <div class="colB"><div class="box" style="padding:4px 8px"><div class="sm" style="text-align:left">${U().said}</div><div class="said" id="said"></div></div>
      <div id="mine" style="width:100%"></div></div></div>`;
  }
  function renderClues(v) { setScene(cluesHtml(v), 'clues:' + v.round); S.said = 0; S.typedN = v.clues.length; refreshClues(v, true); }
  function chipHtml(v, c, fresh) { const t = c.t || U().skipped; return `<span class="ck${c.t ? '' : ' sk'}">${pfI(v, c.p, 22)}${esc(t)}</span>`; }
  function refreshClues(v, first) {
    const n = v.players.length, cur = v.round, mine = v.clues.filter(c => c.r === cur);
    $$('.av').forEach(a => {
      const i = +a.dataset.i, spk = v.turn === i;
      a.classList.toggle('spk', spk); a.classList.toggle('dim', v.turn >= 0 && !spk);
      const pen = a.querySelector('.pen'); pen.classList.toggle('on', spk && i !== v.me);
      if (spk) ringFor(i, v);
      const c = mine.find(x => x.p === i), b = a.querySelector('.bub');
      if (c && !b.dataset.t) { b.dataset.t = '1'; const txt = c.t || U().skipped; b.classList.add('show'); if (!first && v.ev && v.ev.t === 'clue' && v.ev.p === i) { SX.pop(); typeInto(b, txt, 80); } else b.textContent = txt; }
      if (!c) { b.classList.remove('show'); delete b.dataset.t; b.textContent = ''; }
    });
    $('#said').innerHTML = v.clues.map(c => chipHtml(v, c)).join('');
    if (v.ev && v.ev.t === 'turn' && v.ev.p !== v.me) SX.scr();
    const m = $('#mine'), myTurn = v.turn === v.me && v.alive !== false;
    if (!myTurn && v.alive === false) { if (!m.firstChild) m.innerHTML = `<div class="spect">${U().spect}</div>`; }
    else if (myTurn && !$('#ci')) {
      m.innerHTML = `<div class="sm" style="margin-bottom:2px">${U().yourTurn}</div><div class="inpw"><input id="ci" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(U().phold)}"><button class="btn" data-act="send">${U().send}</button></div>${timerBar(v)}`;
      const i = $('#ci'); i.onkeydown = e => { if (e.key === 'Enter') sendClue(); }; setTimeout(() => { try { i.focus(); } catch {} }, 120); SX.tick();
    } else if (!myTurn && $('#ci')) m.innerHTML = '';
  }
  function sendClue() { const i = $('#ci'); if (!i) return; const t = i.value.trim(); if (!t) return; socket.emit('uc-clue', { text: t }); i.value = ''; }

  // ── Debat et vote ──
  function chatHtml(v) { return v.chat.map(c => `<div class="msg${c.p === v.me ? ' me' : ''}">${pfI(v, c.p, 30)}<span class="t">${esc(c.t)}</span></div>`).join(''); }
  function chatBox(v, h) { return `<div class="chat" id="chat" style="max-height:${h}px;overflow-y:auto;width:100%">${chatHtml(v)}</div>${v.alive !== false ? `<div class="chatin"><input id="si" maxlength="100" placeholder="${esc(U().say)}" autocomplete="off"><button class="btn alt" data-act="say">&#10148;</button></div>` : `<div class="spect">${U().spect}</div>`}`; }
  function sendSay() { const i = $('#si'); if (!i || !i.value.trim()) return; socket.emit('uc-say', { text: i.value.trim() }); i.value = ''; i.focus(); }
  function bindSay() { const i = $('#si'); if (i) i.onkeydown = e => { if (e.key === 'Enter') sendSay(); }; }
  function renderDebate(v) {
    setScene(hdr(U().title, U().round(v.round)) + `<div class="body"><div class="colL">${myCard(v)}</div><div class="colA"><div class="cap">${U().debate}</div><div class="sm">${U().debateSub}</div>
      <div id="dbp" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center"></div><div id="dbt" style="width:100%">${timerBar(v)}</div></div><div class="colB">${chatBox(v, 250)}</div></div>
      <div class="foot">${v.alive !== false ? `<button class="btn" data-act="tovote" id="tvb">${U().toVote}</button>` : ''}</div>`, 'debate:' + v.round);
    S.chatN = v.chat.length; bindSay(); refreshDebate(v, true);
  }
  function refreshDebate(v, first) {
    const d = $('#dbp'); if (d) d.innerHTML = v.players.map(p => p.alive === false ? '' : `<span style="position:relative;opacity:${p.ready ? 1 : .55}">${pf(p, 36)}${p.ready ? '<svg viewBox="0 0 22 22" width="16" height="16" style="position:absolute;right:-4px;bottom:-4px;background:var(--card);border-radius:50%"><path d="M3 12l5 5 11-12" stroke="var(--ok)" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>' : ''}</span>`).join('');
    updateChat(v); const me = v.players[v.me], b = $('#tvb'); if (b && me && me.ready) { b.disabled = true; b.textContent = U().waitVote; }
  }
  function updateChat(v) {
    const c = $('#chat'); if (!c) return;
    if (v.chat.length !== S.chatN) { const fresh = v.chat.length > S.chatN; c.innerHTML = chatHtml(v); c.scrollTop = c.scrollHeight; if (fresh) SX.pop(); S.chatN = v.chat.length; }
  }
  function voteHtml(v) {
    const tie = v.phase === 'tie' ? `<div class="spect" style="border-color:var(--red);color:var(--red)">${U().tie}</div>` : '';
    const cards = v.players.map((p, i) => {
      if (i === v.me || p.alive === false) return '';
      if (v.cands && v.cands.length && !v.cands.includes(i)) return '';
      return `<div class="vc${S.sel === i ? ' sel' : ''}" data-act="pick" data-i="${i}">${pf(p, 50)}${esc(p.name)}<svg class="circ" viewBox="0 0 80 66"><ellipse cx="40" cy="31" rx="34" ry="28"/></svg><span class="tally" id="ty${i}"></span></div>`;
    }).join('');
    return hdr(U().title, U().round(v.round)) + `<div class="body"><div class="colL">${myCard(v)}</div><div class="colA"><div class="cap">${U().whoIs}</div>${tie}<div class="vg" id="vg">${cards}</div>
      <div style="display:flex;align-items:center;gap:12px;width:100%;justify-content:center"><div class="urn" id="urn"><div class="slot"></div><div class="jar"></div></div><div class="sm" style="text-align:left" id="vs">${v.__static ? '' : U().pick}</div></div></div>
      <div class="colB">${v.__static ? '' : chatBox(v, 110)}</div></div><div class="foot">${v.alive !== false ? `<button class="btn" data-act="vote" id="vb" disabled>${U().voteBtn}</button>` : ''}</div>`;
  }
  function renderVote(v) { S.sel = null; S.voteSent = false; S.chatN = v.chat.length; setScene(voteHtml(v), v.phase + ':' + v.round); bindSay(); refreshVote(v); }
  function refreshVote(v) {
    const done = v.myVote != null, vs = $('#vs'), b = $('#vb'), voted = v.players.filter(p => p.voted).length, need = v.players.filter(p => p.alive !== false && p.connected).length;
    if (done) { S.voteSent = true; S.sel = v.myVote; $$('.vc').forEach(x => x.classList.toggle('sel', +x.dataset.i === v.myVote)); if (vs) vs.textContent = U().voted; if (b) b.disabled = true; }
    else if (vs && v.alive !== false) vs.textContent = S.sel != null ? U().voteCount(voted, need) : U().pick;
    if (done && vs) vs.innerHTML = esc(U().voted) + `<br><small>${esc(U().voteCount(voted, need))}</small>`;
    updateChat(v);
    if (v.ev && v.ev.t === 'voted' && v.ev.p !== v.me) { flySlip(null); }
  }
  function flySlip(fromEl, name) {
    const urn = $('#urn'); if (!urn || reduce()) return;
    const s = document.createElement('div'); s.className = 'slip fl'; s.textContent = name || ''; s.style.left = '0'; s.style.top = '0'; ph.appendChild(s);
    const pr = ph.getBoundingClientRect(), ur = urn.getBoundingClientRect(), fr = fromEl ? fromEl.getBoundingClientRect() : { left: pr.left + pr.width * (.2 + Math.random() * .6), top: pr.top + 120, width: 0, height: 0 };
    const from = [fr.left - pr.left + fr.width / 2, fr.top - pr.top + fr.height / 2], to = [ur.left - pr.left + ur.width / 2 - 12, ur.top - pr.top + 4];
    const a = s.animate([{ transform: `translate(${from[0]}px,${from[1]}px) rotate(0deg) scale(.8)`, opacity: 1 }, { transform: `translate(${from[0] + (to[0] - from[0]) * .5}px,${from[1] + (to[1] - from[1]) * .5 - 50}px) rotate(200deg) scale(1.1)`, opacity: 1, offset: .55 }, { transform: `translate(${to[0]}px,${to[1]}px) rotate(320deg) scale(.6)`, opacity: .9 }], { duration: 760, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
    a.onfinish = () => { s.remove(); urn.classList.remove('jig'); void urn.offsetWidth; urn.classList.add('jig'); SX.tick(); };
  }
  function castVote(btn) {
    const v = S.v; if (S.sel == null || S.voteSent || !v) return;
    S.voteSent = true; btn.disabled = true; flySlip(btn, v.players[S.sel].name); socket.emit('uc-vote', { idx: S.sel }); SX.pop();
  }

  // ── Depouillement, verdict ──
  function tallyMarks(v) {
    const counts = (v.tally && v.tally.counts) || {};
    Object.keys(counts).forEach((k, j) => { const el = $('#ty' + k); if (!el) return; for (let n = 0; n < counts[k]; n++) T(500 + j * 300 + n * 380, () => { const i = document.createElement('i'); el.appendChild(i); SX.scr(); if (n === 3) { const x = document.createElement('i'); x.className = 'x'; el.appendChild(x); } }); });
  }
  function renderVerdict(v) {
    const total = v.phaseTotal, el = Math.max(0, total - Math.max(0, v.phaseEnd - Date.now())), skipTally = el > 2600 || reduce();
    const L2 = v.last, who = v.players[L2.p], role = L2.role;
    const dark = () => {
      const w = $('.root'); w.classList.add('dark');
      const cap = U().verdict;
      ph.insertAdjacentHTML('beforeend', `<div class="vig"></div><div class="verd" id="vd"><div class="cap" id="vt" style="opacity:0">${esc(cap)}</div><div id="vw" style="position:relative;width:150px;height:150px;opacity:0;transform:scale(.2)"><span class="pin"></span><div class="big pf" id="bg" style="animation:none;transform:none;opacity:1">${portrait(who.portrait)}</div><svg class="xs" id="xs" viewBox="0 0 170 170" style="width:150px;height:150px;left:0;top:0;margin:0"><path d="M30 30L140 140"/><path d="M140 30L30 140"/></svg></div><div class="rc" id="rc" style="display:none"><div class="sm">${esc(U().wasX(who.name))}</div><span class="stamp" style="margin:4px 0">${esc(U().roles[role].toUpperCase())}</span>${role === 'white' ? `<div class="sm">${U().hisWordNone}</div>` : `<div class="sm">${U().hisWord}</div><div style="font-family:'Archivo Black',sans-serif;font-size:2rem">${esc(role === 'civil' ? L2.civ : L2.und)}</div>`}<div class="sm" style="font-size:.78rem">${esc(U().civHad(L2.civ))}</div>${L2.how === 'random' ? `<div class="sm" style="font-size:.75rem">${U().byLot}</div>` : ''}</div></div>`);
      const bd = $('.body', ph); if (bd) { bd.style.transition = 'opacity .8s'; bd.style.opacity = .12; }
      const t0 = skipTally ? 0 : 2600, base = Math.max(0, el - t0);
      const at = (ms, f) => { const d = ms - base; if (d < -200 && skipTally) { f(true); } else T(Math.max(0, d), () => f(false)); };
      at(200, () => { $('#vt').style.animation = 'pop3 .6s forwards'; SX.drum(); });
      at(1700, () => { const w2 = $('#vw'); w2.style.transition = 'transform .7s cubic-bezier(.3,1.5,.5,1),opacity .4s'; w2.style.opacity = 1; w2.style.transform = 'scale(1)'; SX.thud(); });
      at(3000, () => { $('#xs').classList.add('go'); SX.scr(); });
      at(3900, () => { const w2 = $('#vw'); w2.style.transition = 'transform 1s,filter 1s'; w2.style.transform = 'translateY(10px) rotate(-12deg) scale(.7)'; w2.style.filter = 'grayscale(1) brightness(.75)'; for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.className = 'shred'; s.style.left = (42 + Math.random() * 16) + '%'; s.style.top = '34%'; s.style.setProperty('--dx', ((Math.random() - .5) * 260) + 'px'); s.style.setProperty('--dy', (60 + Math.random() * 160) + 'px'); $('#vd').appendChild(s); } SX.bad(); });
      at(4600, () => { const w2 = $('#vw'); w2.style.transition = 'transform .6s'; w2.style.transform = 'translateY(-6px) rotate(-12deg) scale(.5)'; w2.style.marginBottom = '-44px'; w2.style.marginTop = '-36px'; $('#rc').style.display = 'flex'; SX.boom(); });
    };
    setScene(voteHtml(Object.assign({}, v, { cands: null, alive: false, __static: true })).replace(/<div class="foot">[\s\S]*$/, ''), 'verdict:' + v.round + ':' + L2.p);
    $$('.vc').forEach(c => c.style.pointerEvents = 'none');
    $('#vs').textContent = '';
    if (skipTally) dark(); else { tallyMarks(v); T(2600, dark); const w = $('.vc[data-i="' + (v.tally && Object.keys(v.tally.counts).sort((a, b) => v.tally.counts[b] - v.tally.counts[a])[0]) + '"]'); if (w) T(2200, () => { w.classList.add('win'); SX.thud(); }); }
  }
  function renderTie(v) {
    S.sel = null; setScene(voteHtml(Object.assign({}, v, { cands: null, alive: false, __static: true })).replace(/<div class="foot">[\s\S]*$/, ''), 'tie:' + v.round);
    $$('.vc').forEach(c => c.style.pointerEvents = 'none'); tallyMarks(v); SX.drum();
  }

  // ── Mr. White : derniere chance ──
  function renderGuess(v) {
    const g = v.guess, p = v.players[g.p], mineG = g.p === v.me;
    setScene(hdr(U().title, U().round(v.round)) + `<div class="body"><div class="cap">${esc(U().wasWhite(p.name))}</div><div class="av out" style="margin:4px 0">${pf(p, 84)}<span class="nm" style="font-size:.9rem">${esc(p.name)}</span></div>
      <div class="slate" id="sl"><div class="cap" style="font-size:1.35rem">${esc(U().guessT)}</div>
      ${mineG ? `<div class="inpw" style="max-width:300px"><input id="gi" maxlength="30" autocomplete="off" placeholder="${esc(U().guessPh)}" style="font-family:Caveat,cursive;font-size:1.6rem;background:rgba(255,255,255,.08);color:var(--chalk);border-color:rgba(255,255,255,.4)"><button class="btn" data-act="guess">${U().guessGo}</button></div>${timerBar(v)}` : `<div class="sm" style="color:#a7b3ab" id="gm">${esc(U().guessing(p.name))}</div>${timerBar(v)}`}
      <div class="eraser" id="er"></div></div><div id="gr" style="min-height:44px"></div></div>`, 'guess:' + v.round);
    if (mineG) { const i = $('#gi'); i.onkeydown = e => { if (e.key === 'Enter') { $('[data-act=guess]').click(); } }; setTimeout(() => { try { i.focus(); } catch {} }, 150); }
    SX.drum();
  }
  function renderGuessRes(v) {
    const g = v.guess, p = v.players[g.p];
    setScene(hdr(U().title, U().round(v.round)) + `<div class="body"><div class="cap">${esc(U().wasWhite(p.name))}</div><div class="av out" style="margin:4px 0">${pf(p, 84)}<span class="nm" style="font-size:.9rem">${esc(p.name)}</span></div>
      <div class="slate" id="sl"><div class="cap" style="font-size:1.35rem">${esc(U().guessT)}</div><div class="gs" id="gs"><span style="font-family:Caveat,cursive;font-size:2.6rem">${esc(g.text || '...')}</span></div><div class="eraser" id="er"></div></div><div id="gr" style="min-height:44px"></div></div>`, 'guessres:' + v.round);
    T(500, () => { $('#er').classList.add('go'); SX.flip(); }); T(1100, () => { $('#gs').style.opacity = 0; $('#sl').classList.add('shake'); SX.bad(); }); T(1500, () => { $('#gr').innerHTML = `<span class="stamp">${U().miss}</span>`; SX.thud(); });
  }

  // ── Fin de partie ──
  function renderEnd(v) {
    const win = v.winner, mine = (v.reveal.find(r => r.p === v.me) || {}).role;
    const iWon = win === 'civils' ? mine === 'civil' : win === 'white' ? mine === 'white' : mine && mine !== 'civil';
    const roleLine = r => r === 'white' ? [U().roles.white, U().hisWordNone] : r === 'undercover' ? [U().roles.undercover, v.undWord] : [U().roles.civil, v.civWord];
    setScene(hdr(U().title, '') + `<div class="body" style="padding-top:22px"><span class="stamp ok" style="font-size:1.1rem">${esc(U().win[win] || '')}</span><div class="sm">${iWon ? U().youWin : U().youLose} · ${U().xp(iWon ? 25 : 10)}</div>
      <div class="rr" id="rr">${v.players.map((p, i) => { const r = (v.reveal.find(x => x.p === i) || {}).role, l = r ? roleLine(r) : ['', '']; return `<div class="rolec" data-i="${i}">${pf(p, 46)}<b>${esc(p.name)}</b><div class="in"><div class="fa">?</div><div class="fb"><span style="color:${r === 'civil' ? 'var(--ok)' : 'var(--red)'}">${esc(l[0])}</span>${esc(l[1])}</div></div></div>`; }).join('')}</div></div>
      <div class="foot">${v.host ? `<button class="btn" data-act="again">${U().again}</button>` : `<span class="sm">${U().waitAgain}</span>`}<button class="btn alt" data-act="quit">${U().leave}</button></div>`, 'end');
    $$('.rolec').forEach((e, j) => T(600 + j * 450, () => { e.classList.add('on'); SX.flip(); }));
    T(600 + v.players.length * 450 + 200, () => { if (iWon) { confetti(70); SX.chime(); } else SX.bad(); });
  }

  // ── File des etats ──
  function handle(v) {
    const prev = S.v; S.v = v; S.code = v.code;
    const key = v.phase === 'clues' ? 'clues:' + v.round : v.phase === 'debate' ? 'debate:' + v.round : (v.phase === 'vote' || v.phase === 'revote') ? v.phase + ':' + v.round : v.phase === 'verdict' ? 'verdict:' + v.round + ':' + (v.last && v.last.p) : v.phase === 'tie' ? 'tie:' + v.round : v.phase === 'guess' ? 'guess:' + v.round : v.phase === 'guessres' ? 'guessres:' + v.round : v.phase;
    if (S.key === key && key !== 'reveal') { refreshScene(v); return; }
    if (S.key === key && key === 'reveal') { refreshReveal(v); return; }
    const ph0 = v.phase;
    if (ph0 === 'reveal') {
      if (!S.dealt && v.ev && v.ev.t === 'start' && !reduce()) { S.dealt = true; S.key = 'deal'; dealAnim(v, () => { if (S.v && S.v.phase === 'reveal') renderReveal(S.v); }); return; }
      if (S.key === 'deal') return;
      S.dealt = true; renderReveal(v); return;
    }
    S.dealt = true;
    if (ph0 === 'clues') return renderClues(v);
    if (ph0 === 'debate') return renderDebate(v);
    if (ph0 === 'vote' || ph0 === 'revote') return renderVote(v);
    if (ph0 === 'tie') return renderTie(v);
    if (ph0 === 'verdict') return renderVerdict(v);
    if (ph0 === 'guess') return renderGuess(v);
    if (ph0 === 'guessres') return renderGuessRes(v);
    if (ph0 === 'end') return renderEnd(v);
    void prev;
  }
  function refreshScene(v) {
    const p = v.phase;
    if (p === 'clues') refreshClues(v, false);
    else if (p === 'debate') refreshDebate(v, false);
    else if (p === 'vote' || p === 'revote') refreshVote(v);
  }

  // ── Evenements serveur ──
  function on(ev, d) {
    ensure();
    if (ev === 'uc-joined') { S.code = d.code; saveSess(d.code); return; }
    if (ev === 'uc-created') return;
    if (ev === 'uc-lobby') { S.code = d.code; S.dealt = false; S.shownVerdict = ''; renderLobby(d); return; }
    if (ev === 'uc-state') { S.code = d.code; handle(d); return; }
    if (ev === 'uc-error') { toast(U().err[d.message] || U().err.notfound); if (!S.v && d.message !== 'oneword' && d.message !== 'sameword' && d.message !== 'banned') { clearSess(); try { showScreen('home'); } catch {} } return; }
    if (ev === 'uc-reconnect-failed') { clearSess(); try { if (sessionStorage.getItem('libero_screen') === 'undercover') { sessionStorage.removeItem('libero_screen'); showScreen('home'); } } catch {} }
  }
  function create() {
    const name = (typeof getPlayerName === 'function' ? getPlayerName() : '') || (localStorage.getItem('playerName') || '').trim();
    socket.emit('create-uc-room', { name, playerId: getPlayerId(), lang: L() });
  }
  function reconnect() { const c = savedCode(); if (c) socket.emit('reconnect-uc-room', { code: c, playerId: getPlayerId(), lang: L() }); return !!c; }
  function back() { if (!host || !host.classList.contains('active')) return false; leave(true); return true; }
  window.LiberoUC = { on, create, reconnect, back, saved: savedCode, clearSession: clearSess, _s: S };
})();
