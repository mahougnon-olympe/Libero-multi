/* Devine le drapeau : accueil, parties solo (serie, contre la montre, drapeau du jour) et animations.
   Les salons a plusieurs reutilisent l'ecran du quiz (voir app.js). Charge a la demande par app.js (_flagsLoad). */
(function () {
  'use strict';
  const F = window.FlagsData;
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const D = {
    fr: { title: 'Devine le drapeau', sub: 'Trouve le pays avant la fin du chrono.', back: 'Retour', pseudoPh: 'Ton pseudo (optionnel)', needName: 'Choisis un pseudo pour jouer.',
      who: 'Avec qui ?', whoOpts: { solo: 'Seul', friend: 'Avec des amis', code: "J'ai un code" }, mode: 'Mode', level: 'Niveau', cont: 'Continent', start: 'Commencer', create: 'Créer un salon', join: 'Rejoindre', codePh: 'Code à 4 lettres', code: 'Code du salon', nbq: 'Nombre de drapeaux',
      modes: { serie: ['Série', "3 vies, jusqu'où iras-tu ?"], chrono: ['Contre la montre', '60 secondes, une erreur coûte 3 s'], salon: ['Salon entre amis', '2 à 20 joueurs, points selon la vitesse'], jour: ['Drapeau du jour', 'Un drapeau par jour, avec des indices'] },
      levels: { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', extreme: 'Extrême' }, conts: { all: 'Tous', AF: 'Afrique', EU: 'Europe', AS: 'Asie', AM: 'Amériques', OC: 'Océanie' },
      note: { code: 'Demande le code à celui qui a créé le salon. Les réglages sont les siens.', serie: 'En solo. Difficile et Extrême passent en saisie du nom.', chrono: 'Dès que tu reconnais, réponds : chaque seconde compte.', salon: 'Un salon de quiz : même drapeau pour tous, classement en direct.', jour: 'Le même drapeau pour tout le monde, aujourd\'hui. 3 essais.' },
      lb: 'Classement Drapeaux', lbEmpty: 'Aucun score pour l\'instant.', lbPts: 'drapeaux', lbChrono: 'contre la montre', play: 'Jouer', recSerie: 'Record série', recChrono: 'Record chrono', myRank: 'Mon rang', yourFlags: 'Tes drapeaux', foundLbl: 'drapeaux trouvés', question: 'Quel est ce pays ?', typeIt: 'Écris le nom du pays', send: 'Valider', skip: 'Passer', letters: n => `${n} lettres`,
      streak: n => `Série de ${n} !`, good: 'Bravo !', wasIt: n => `C'était : ${n}`, oops: 'Oups', go: "C'est parti !", sec: 's', lives: 'Vies', found: n => `${n} drapeau${n > 1 ? 'x' : ''}`,
      over: 'Partie terminée', record: 'Nouveau record', again: 'Rejouer', quit: 'Quitter', leaveAsk: 'Quitter la partie ?', leaveText: 'Ta partie en cours sera perdue.', leaveOk: 'Quitter',
      allFound: 'Tu les as tous trouvés !', timeUp: 'Temps écoulé', dayDone: n => `Tu as déjà joué aujourd'hui. Prochain drapeau dans ${n}.`, daySolved: 'Trouvé !', dayFail: n => `C'était : ${n}`,
      hint1: c => `Indice : continent ${c}`, hint2: l => `Indice : commence par ${l}`, hint3: n => `Indice : ${n} lettres`, tries: n => `${n} essai${n > 1 ? 's' : ''}`, wrong: 'Pas ce pays, essaie encore',
      kTitle: 'Drapeaux', hubErr: 'Impossible de rejoindre ce salon.' },
    en: { title: 'Guess the flag', sub: 'Find the country before the timer runs out.', back: 'Back', pseudoPh: 'Your nickname (optional)', needName: 'Pick a nickname to play.',
      who: 'Who with?', whoOpts: { solo: 'Alone', friend: 'With friends', code: 'I have a code' }, mode: 'Mode', level: 'Level', cont: 'Continent', start: 'Start', create: 'Create a room', join: 'Join', codePh: '4-letter code', code: 'Room code', nbq: 'Number of flags',
      modes: { serie: ['Streak', 'How far can you go with 3 lives?'], chrono: ['Time attack', '60 seconds, a mistake costs 3 s'], salon: ['Room with friends', '2 to 20 players, points by speed'], jour: ['Flag of the day', 'One flag a day, with hints'] },
      levels: { easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme' }, conts: { all: 'All', AF: 'Africa', EU: 'Europe', AS: 'Asia', AM: 'Americas', OC: 'Oceania' },
      note: { code: 'Ask the room creator for the code. The settings are theirs.', serie: 'Solo. Hard and Extreme switch to typing the name.', chrono: 'Answer as soon as you recognise it: every second counts.', salon: 'A quiz room: same flag for everyone, live ranking.', jour: 'The same flag for everyone, today. 3 tries.' },
      lb: 'Flags ranking', lbEmpty: 'No score yet.', lbPts: 'flags', lbChrono: 'time attack', play: 'Play', recSerie: 'Streak record', recChrono: 'Time record', myRank: 'My rank', yourFlags: 'Your flags', foundLbl: 'flags found', question: 'Which country is this?', typeIt: 'Type the country name', send: 'Submit', skip: 'Skip', letters: n => `${n} letters`,
      streak: n => `Streak of ${n}!`, good: 'Well done!', wasIt: n => `It was: ${n}`, oops: 'Oops', go: "Let's go!", sec: 's', lives: 'Lives', found: n => `${n} flag${n > 1 ? 's' : ''}`,
      over: 'Game over', record: 'New record', again: 'Play again', quit: 'Leave', leaveAsk: 'Leave the game?', leaveText: 'Your current game will be lost.', leaveOk: 'Leave',
      allFound: 'You found them all!', timeUp: "Time's up", dayDone: n => `You already played today. Next flag in ${n}.`, daySolved: 'Found it!', dayFail: n => `It was: ${n}`,
      hint1: c => `Hint: continent ${c}`, hint2: l => `Hint: starts with ${l}`, hint3: n => `Hint: ${n} letters`, tries: n => `${n} ${n > 1 ? 'tries' : 'try'}`, wrong: 'Not that country, try again',
      kTitle: 'Flags', hubErr: 'Unable to join this room.' },
  };
  const U = () => D[L()];
  const $ = (s, r = document) => r.querySelector(s);
  const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => (typeof _escHtml === 'function' ? _escHtml(s) : String(s));
  const snd = n => { try { window._sound?.play(n); } catch {} };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = (e, k, o) => e.animate(k, { fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)', ...o });
  const wait = ms => new Promise(r => setTimeout(r, reduce() ? 0 : ms));
  const toast = m => { try { showCursorSnakeToast(m); } catch {} };
  const nm = c => F.name(c, L());
  const HEART = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" fill="${on ? 'var(--red)' : 'none'}" stroke="var(--text)" stroke-width="2"/></svg>`;
  const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#ff7a1a" stroke="#1d2433" stroke-width="1.6"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7 7 .8-5.3 4.8 1.6 7.4L12 18l-6.3 4 1.6-7.4L2 9.8 9 9z" fill="#ffd23f" stroke="#1d2433" stroke-width="1.6"/></svg>';
  const flagImg = (c, cls = '') => (typeof _flagImgHtml === 'function' ? _flagImgHtml(c, cls) : `<span class="flag-frame"><img class="flag-img" src="assets/flags/${c.toLowerCase()}.svg" alt=""></span>`);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ── Preferences ─────────────────────────────────────────────────────────────
  const PK = 'libero_flag_prefs', RUN = 'libero_flag_run', DAYK = 'libero_flag_day', BESTK = 'libero_flag_best';
  const rd = (k, d) => { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const P = rd(PK, { mode: 'serie', level: 'medium', cont: 'all', nb: 10 });
  const WK = 'libero_flag_who';
  const getWho = () => { try { return sessionStorage.getItem(WK) || ''; } catch { return ''; } };
  const setWho = v => { try { v ? sessionStorage.setItem(WK, v) : sessionStorage.removeItem(WK); } catch {} };
  const bestOf = m => (rd(BESTK, {}))[m] || 0;
  const setBest = (m, v) => { const b = rd(BESTK, {}); if (v > (b[m] || 0)) { b[m] = v; wr(BESTK, b); return true; } return false; };

  // ── Ecrans ──────────────────────────────────────────────────────────────────
  let home = null, game = null, S = null, raf = 0, tick = 0, S_rows = [];
  const ordEn = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  function loadCss() { if (document.getElementById('flags-css')) return; const l = document.createElement('link'); l.id = 'flags-css'; l.rel = 'stylesheet'; l.href = 'flags.css?v=5'; document.head.appendChild(l); }
  function ensure() {
    loadCss();
    if (home) return;
    const host = document.getElementById('screen-home')?.parentNode || document.body;
    home = el(`<div id="screen-flag-home" class="screen">
      <button class="btn-back" id="fh-back"></button>
      <div class="fh-grid" id="fh-grid">
        <div class="fh-bunting" id="fh-bunting" aria-hidden="true"></div>
        <div class="fh-head"><h1 id="fh-title"></h1><p class="subtitle" id="fh-sub"></p></div>
        <div class="fh-stats" id="fh-stats"></div>
        <div class="fh-name"><input id="fh-name" type="text" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" /></div>
        <div class="fh-who-box"><p class="fh-lab" id="fh-l-who"></p><div class="who-row" id="fh-who"></div></div>
        <div class="fh-modes-box"><p class="fh-lab" id="fh-l-mode"></p><div class="fh-modes" id="fh-modes"></div></div>
        <div class="fh-opts-box">
          <div id="fh-opts">
            <p class="fh-lab" id="fh-l-level"></p><div class="fh-chips" id="fh-levels"></div>
            <p class="fh-lab" id="fh-l-cont"></p><div class="fh-chips" id="fh-conts"></div>
          </div>
          <div id="fh-nb"><p class="fh-lab" id="fh-l-nb"></p><div class="fh-chips" id="fh-nbs"></div></div>
          <p class="fh-note" id="fh-note"></p>
          <div class="fh-join" id="fh-joinbox"><input id="fh-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" /><button class="btn btn-secondary" id="fh-join"></button></div>
          <p class="fh-err hidden" id="fh-err"></p>
        </div>
        <div class="fh-play" id="fh-go"></div>
        <div class="lb-card fh-lb-card"><div class="lb-header"><span></span><span class="lb-title" id="fh-lb-t"></span></div><div class="lb-list" id="fh-lb"></div></div>
      </div>
    </div>`);
    game = el(`<div id="screen-flag-game" class="screen"><div class="fg" id="fg"></div></div>`);
    host.appendChild(home); host.appendChild(game);
    $('#fh-back', home).onclick = () => showScreen('quiz-hub');
    $('#fh-name', home).addEventListener('input', e => {
      const v = e.target.value; localStorage.setItem('playerName', v.trim());
      ['input-trivia-name', 'input-name'].forEach(id => { const o = document.getElementById(id); if (o) o.value = v; });
      try { triggerRename(v.trim()); } catch {}
    });
    $('#fh-code', home).addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
    $('#fh-join', home).onclick = joinRoom;
    $('#fh-code', home).addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  }
  function renderHome() {
    ensure(); const d = U(), me = (localStorage.getItem('playerName') || '').trim();
    $('#fh-back', home).textContent = d.back; $('#fh-title', home).textContent = d.title; $('#fh-sub', home).textContent = d.sub;
    const ni = $('#fh-name', home); ni.placeholder = d.pseudoPh; if (document.activeElement !== ni) ni.value = me;
    const bn = ['FR', 'JP', 'BJ', 'CI', 'IT', 'NL', 'NG'];
    $('#fh-bunting', home).innerHTML = `<svg viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 10 Q100 46 200 16 T400 10" fill="none" stroke="var(--text)" stroke-width="2.5"/></svg>` + bn.map((c, i) => `<span class="fb" style="left:${i * 14.2 + 1}%;top:${[16, 28, 34, 22, 14, 28, 34][i]}px;animation-delay:${i * .25}s"><img src="assets/flags/${c.toLowerCase()}.svg" alt="" draggable="false"></span>`).join('');
    const rk = (S_rows || []).findIndex(r => r.name === me);
    const mine = rk >= 0 ? S_rows[rk] : null, rs = Math.max(bestOf('serie'), mine ? mine.points : 0), rc = Math.max(bestOf('chrono'), mine ? mine.games : 0);
    $('#fh-stats', home).innerHTML = `<div><b>${rs}</b><small>${d.recSerie}</small></div><div><b>${rc}</b><small>${d.recChrono}</small></div><div><b>${rk >= 0 ? (L() === 'en' ? ordEn(rk + 1) : (rk === 0 ? '1er' : (rk + 1) + 'e')) : '-'}</b><small>${d.myRank}</small></div>`;
    const who = getWho(); home.dataset.who = who;
    $('#fh-l-who', home).textContent = d.who;
    $('#fh-who', home).innerHTML = ['solo', 'friend', 'code'].map(k => `<button type="button" class="who-btn${who === k ? ' active' : ''}" data-w="${k}">${d.whoOpts[k]}</button>`).join('');
    if (who === 'solo' && P.mode === 'salon') P.mode = 'serie';
    $('#fh-l-mode', home).textContent = d.mode; $('#fh-l-level', home).textContent = d.level; $('#fh-l-cont', home).textContent = d.cont; $('#fh-l-nb', home).textContent = d.nbq;
    const flagOf = { serie: 'FR', chrono: 'JP', salon: 'BJ', jour: 'NL' };
    $('#fh-modes', home).innerHTML = Object.keys(d.modes).filter(k => k !== 'salon').map(k => `<button type="button" class="fh-mode" data-m="${k}" aria-pressed="${P.mode === k}"><span class="fi"><img src="assets/flags/${flagOf[k].toLowerCase()}.svg" alt="" draggable="false"></span><b>${d.modes[k][0]}</b><small>${d.modes[k][1]}</small></button>`).join('');
    const chips = (id, obj, key) => { $('#' + id, home).innerHTML = Object.keys(obj).map(k => `<button type="button" class="fh-chip" data-v="${k}" aria-pressed="${P[key] === k}">${obj[k]}</button>`).join(''); };
    chips('fh-levels', d.levels, 'level');
    const CC = { all: ['FR', 'JP', 'BJ', 'BR'], AF: ['NG', 'SN', 'CI', 'ML'], EU: ['FR', 'DE', 'IT', 'NL'], AS: ['JP', 'IN', 'CN', 'KR'], AM: ['BR', 'CA', 'AR', 'MX'], OC: ['AU', 'NZ', 'FJ', 'PG'] };
    $('#fh-conts', home).innerHTML = Object.keys(d.conts).map(k => `<button type="button" class="fh-ct" data-v="${k}" aria-pressed="${P.cont === k}"><span class="ph">${CC[k].map(c => `<img src="assets/flags/${c.toLowerCase()}.svg" alt="" draggable="false">`).join('')}</span><b>${d.conts[k]}</b></button>`).join('');
    $('#fh-nbs', home).innerHTML = [10, 20, 30].map(n => `<button type="button" class="fh-chip" data-v="${n}" aria-pressed="${P.nb === n}">${n}</button>`).join('');
    const solo = who === 'solo', fr = who === 'friend', cd = who === 'code';
    $('.fh-modes-box', home).style.display = solo ? '' : 'none';
    $('#fh-opts', home).style.display = ((solo && P.mode !== 'jour') || fr) ? '' : 'none';
    $('#fh-nb', home).style.display = fr ? '' : 'none';
    $('#fh-note', home).style.display = who ? '' : 'none';
    $('#fh-note', home).textContent = d.note[solo ? P.mode : fr ? 'salon' : 'code'];
    $('#fh-joinbox', home).style.display = cd ? '' : 'none';
    const go = $('#fh-go', home);
    go.style.display = (solo || fr) ? '' : 'none';
    go.innerHTML = `<button class="btn btn-primary" id="fh-start">${fr ? d.create : d.play}</button>`;
    $('#fh-code', home).placeholder = d.codePh; $('#fh-join', home).textContent = d.join;
    $('#fh-start', home).onclick = startFromHome;
    home.querySelectorAll('#fh-who .who-btn').forEach(b => b.onclick = () => { setWho(b.dataset.w); clearErr(); renderHome(); });
    home.querySelectorAll('.fh-mode').forEach(b => b.onclick = () => { P.mode = b.dataset.m; wr(PK, P); renderHome(); });
    home.querySelectorAll('#fh-levels .fh-chip').forEach(b => b.onclick = () => { P.level = b.dataset.v; wr(PK, P); renderHome(); });
    home.querySelectorAll('#fh-conts .fh-ct').forEach(b => b.onclick = () => { P.cont = b.dataset.v; wr(PK, P); renderHome(); });
    home.querySelectorAll('#fh-nbs .fh-chip').forEach(b => b.onclick = () => { P.nb = +b.dataset.v; wr(PK, P); renderHome(); });
    $('#fh-lb-t', home).textContent = d.lb;
    if (!$('#fh-lb', home).dataset.ok) $('#fh-lb', home).innerHTML = `<p class="lb-empty">${d.lbEmpty}</p>`;
  }
  function showHome(keepWho) {
    ensure(); if (keepWho !== true) setWho(''); renderHome(); showScreen('flag-home');
    try { socket.emit('get-flags-leaderboard'); } catch {}
  }
  function renderLb(rows) {
    S_rows = rows || [];
    if (!home) return; const lb = $('#fh-lb', home); lb.dataset.ok = '1';
    if (!rows || !rows.length) { lb.innerHTML = `<p class="lb-empty">${U().lbEmpty}</p>`; }
    else if (typeof _renderFlagsLb === 'function') _renderFlagsLb(lb, rows, U().lbPts, U().lbChrono);
    renderHome();
  }
  function err(m) { if (!home) return; const e = $('#fh-err', home); e.textContent = m; e.classList.remove('hidden'); }
  function clearErr() { if (home) $('#fh-err', home).classList.add('hidden'); }
  window._flagsErr = m => { err(m); };

  function startFromHome() {
    clearErr();
    const name = (localStorage.getItem('playerName') || '').trim();
    if (!name) { err(U().needName); $('#fh-name', home).focus(); return; }
    if (getWho() === 'friend') {
      const diff = P.level === 'easy' ? 'easy' : P.level === 'medium' ? 'medium' : P.level === 'hard' ? 'hard' : 'extreme';
      socket.emit('create-trivia-room', { kind: 'flags', name, lang: L(), difficulty: diff, amount: P.nb, playerId: getPlayerId(), continent: P.cont === 'all' ? '' : P.cont });
      return;
    }
    if (P.mode === 'jour') return startDay();
    startRun(P.mode);
  }
  function joinRoom() {
    clearErr(); const name = (localStorage.getItem('playerName') || '').trim();
    if (!name) { err(U().needName); return; }
    const code = $('#fh-code', home).value.trim().toUpperCase();
    if (code.length !== 4) { err(U().codePh); return; }
    socket.emit('join-trivia-room', { code, name, playerId: getPlayerId() });
  }

  // ── Partie solo ─────────────────────────────────────────────────────────────
  const typed = () => P.level === 'hard' || P.level === 'extreme';
  function poolFor(level, cont) {
    const maxL = level === 'easy' ? 1 : level === 'medium' ? 2 : 3;
    return F.LIST.filter(x => x.l <= maxL && (cont === 'all' || x.k === cont)).map(x => x.c);
  }
  function startRun(mode) {
    ensure();
    const deck = shuffle(poolFor(P.level, P.cont));
    S = { mode, level: P.level, cont: P.cont, type: typed(), deck, i: -1, lives: 3, score: 0, streak: 0, left: 60000, busy: false, over: false, qStart: 0, cur: null, tries: 0, results: [] };
    saveRun(); showGame(); intro().then(next);
  }
  function startDay() {
    const day = dayKey(), st = rd(DAYK, {});
    ensure();
    if (st.day === day && st.over) { showGame(); S = { mode: 'jour', day, cur: st.code, over: true, done: true, solved: st.solved }; renderDayDone(); return; }
    const code = dayCode(day);
    S = { mode: 'jour', type: true, day, cur: code, tries: st.day === day ? (st.tries ?? 3) : 3, qStart: st.day === day && st.qStart ? st.qStart : Date.now(), over: false, busy: false, score: 0 };
    saveDay(); showGame(); renderDay();
  }
  const dayKey = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  function dayCode(day) {
    let h = 7; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const list = F.LIST.filter(x => x.l <= 2).map(x => x.c).sort();
    return list[h % list.length];
  }
  function saveRun() { if (!S || S.mode === 'jour') return; try { sessionStorage.setItem(RUN, JSON.stringify({ mode: S.mode, level: S.level, cont: S.cont, type: S.type, deck: S.deck, i: S.i, lives: S.lives, score: S.score, streak: S.streak, left: S.left, cur: S.cur, results: S.results })); } catch {} }
  function saveDay() { if (!S || S.mode !== 'jour') return; wr(DAYK, { day: S.day, code: S.cur, tries: S.tries, qStart: S.qStart, over: !!S.over, solved: !!S.solved }); }
  function clearRun() { try { sessionStorage.removeItem(RUN); } catch {} }

  function showGame() {
    ensure(); clearInterval(tick); cancelAnimationFrame(raf);
    document.body.classList.add('screen-flag-game-active');
    showScreen('flag-game');
  }
  const fg = () => $('#fg', game);
  function frame() { return `<div class="fg-hud" id="fg-hud"></div><div class="fg-bar" id="fg-bar"><i></i></div><div class="fg-main"><div class="fg-stage" id="fg-stage"></div><div class="fg-side"><div class="fg-cap" id="fg-cap"></div><div id="fg-ans"></div></div></div>`; }
  function hud() {
    if (!S || !$('#fg-hud')) return; const d = U();
    const q = `<button class="fg-q" id="fg-quit" type="button">${d.quit}</button>`;
    if (S.mode === 'serie') $('#fg-hud').innerHTML = `${q}<span class="fg-hearts" aria-label="${d.lives}">${[0, 1, 2].map(i => HEART(i < S.lives)).join('')}</span><span class="fg-streak">${FLAME}<b id="fg-sk">${S.streak}</b></span><span id="fg-sc">${d.found(S.score)}</span>`;
    else if (S.mode === 'chrono') $('#fg-hud').innerHTML = `${q}<span id="fg-left">${Math.ceil(S.left / 1000)}${d.sec}</span><span class="fg-streak">${FLAME}<b id="fg-sk">${S.streak}</b></span><span id="fg-sc">${d.found(S.score)}</span>`;
    else $('#fg-hud').innerHTML = `${q}<span>${d.modes.jour[0]}</span><span id="fg-tries">${d.tries(S.tries)}</span>`;
    $('#fg-quit').onclick = quit;
  }
  async function quit() {
    if (!S || S.over) { leaveToHome(); return; }
    const ok = await _slateConfirm({ title: U().leaveAsk, text: U().leaveText, ok: U().leaveOk });
    if (ok) { clearRun(); S.over = true; leaveToHome(); }
  }
  function leaveToHome() { clearInterval(tick); cancelAnimationFrame(raf); clearRun(); S = null; document.body.classList.remove('screen-flag-game-active'); showHome(); }
  window._flagsQuit = () => { if (game && game.classList.contains('active')) { quit(); return true; } return false; };

  async function intro() {
    fg().innerHTML = frame(); hud();
    const d = U(); $('#fg-bar').style.visibility = 'hidden';
    if (reduce()) return;
    snd('quiz-start');
    for (const n of ['3', '2', '1']) {
      const c = el(`<div class="fg-count">${n}</div>`); fg().appendChild(c);
      A(c, [{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'scale(1)', offset: .35 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 560 });
      await wait(560); c.remove();
    }
    big(d.go, '#1d2433', 14, 'var(--yellow, #ffe169)');
  }
  function big(text, color, topPct, bg) {
    const b = el(`<div class="fg-big" style="color:${color};top:${topPct}%;${bg ? `background:${bg};padding:2px 14px;border-radius:10px;` : ''}">${esc(text)}</div>`);
    fg().appendChild(b); b.style.marginLeft = (-b.offsetWidth / 2) + 'px';
    if (!reduce()) A(b, [{ opacity: 0, transform: 'scale(.3) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1.1) rotate(-4deg)', offset: .3 }, { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: .8 }, { opacity: 0, transform: 'translateY(-26px) rotate(-4deg)' }], { duration: 1300 });
    setTimeout(() => b.remove(), reduce() ? 900 : 1300);
  }

  function limitMs() { return S.type ? (S.level === 'extreme' ? 12000 : 20000) : 12000; }
  async function next() {
    if (!S || S.over) return;
    S.i++; S.busy = false; S.tries = 1;
    if (S.i >= S.deck.length) { return end(U().allFound); }
    S.cur = S.deck[S.i]; saveRun();
    renderQuestion();
  }
  function renderQuestion(resume) {
    const d = U(); fg().innerHTML = frame(); hud();
    const stage = $('#fg-stage'); stage.innerHTML = flagImg(S.cur);
    if (!S.type) stage.classList.add('blur');
    $('#fg-cap').textContent = S.type ? d.typeIt : d.question;
    const bar = $('#fg-bar'); bar.style.visibility = ''; const lim = limitMs();
    S.qStart = Date.now(); S.limit = lim;
    if (S.type) {
      const name = nm(S.cur), parts = F.norm(name).split(' ');
      $('#fg-ans').innerHTML = `<div class="fg-type"><div class="fg-slots" id="fg-slots">${parts.map(p => [...p].map(() => '<i></i>').join('')).join('<i class="gap"></i>')}</div><div class="fg-in"><input id="fg-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="${d.typeIt}"><button class="btn btn-primary" id="fg-send" type="button">${d.send}</button></div><p class="fg-hint" id="fg-hint">${d.letters(parts.join('').length)}</p><button class="btn btn-secondary" id="fg-skip" type="button">${d.skip}</button></div>`;
      const inp = $('#fg-input'); inp.focus({ preventScroll: true });
      inp.addEventListener('input', () => mirror(inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitTyped(); });
      $('#fg-send').onclick = submitTyped; $('#fg-skip').onclick = () => finishQ(null, true);
    } else {
      const ch = F.choices(S.cur, 4);
      $('#fg-ans').innerHTML = `<div class="fg-opts">${ch.map(c => `<button class="fg-opt" type="button" data-c="${c}"><i class="fg-let">${'ABCD'[ch.indexOf(c)]}</i>${esc(nm(c))}</button>`).join('')}</div>`;
      $('#fg-ans').querySelectorAll('.fg-opt').forEach(b => b.onclick = () => { if (!S.busy) finishQ(b.dataset.c, false, b); });
    }
    if (!reduce() && !resume) A(stage, [{ opacity: 0, transform: 'translateY(-40px) scale(.7)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 520 });
    loop();
  }
  function mirror(v) {
    const slots = [...document.querySelectorAll('#fg-slots i:not(.gap)')], ls = [...F.norm(v).replace(/ /g, '')];
    slots.forEach((s, i) => { s.textContent = ls[i] || ''; });
  }
  // Boucle du chrono : anneau de temps, flou qui se precise, secondes du contre-la-montre.
  function loop() {
    cancelAnimationFrame(raf); let lastSec = -1, prev = performance.now();
    const step = now => {
      if (!S || S.over || S.busy) return;
      const dt = now - prev; prev = now;
      const el = Date.now() - S.qStart, f = Math.min(1, el / S.limit);
      const bar = $('#fg-bar i'); if (bar) { bar.style.transform = `scaleX(${1 - f})`; bar.style.background = f > .66 ? 'var(--red)' : f > .4 ? '#f3c431' : 'var(--green, #1f9d55)'; }
      const st = $('#fg-stage'); if (st && !S.type) st.style.setProperty('--bl', (14 * (1 - Math.min(1, f * 1.15))).toFixed(1) + 'px');
      if (S.mode === 'chrono') { S.left -= dt; const sec = Math.ceil(S.left / 1000); const l = $('#fg-left'); if (l && sec !== lastSec) { l.textContent = Math.max(0, sec) + U().sec; lastSec = sec; if (sec <= 5 && sec > 0) snd('tick'); } if (S.left <= 0) { S.left = 0; end(U().timeUp); return; } }
      const remain = S.limit - el;
      if (S.mode !== 'chrono' && Math.ceil(remain / 1000) <= 3 && Math.ceil(remain / 1000) !== lastSec) { lastSec = Math.ceil(remain / 1000); if (remain > 0) snd(lastSec === 1 ? 'tick-final' : 'tick'); }
      if (el >= S.limit) { finishQ(null, false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function submitTyped() {
    if (!S || S.busy) return; const v = $('#fg-input').value.trim(); if (!v) return;
    finishQ(v, false);
  }
  async function finishQ(answer, skipped, btn) {
    if (!S || S.busy || S.over) return;
    const right = !skipped && answer != null && (S.type ? F.match(S.cur, answer) : answer === S.cur);
    S.busy = true; cancelAnimationFrame(raf);
    if (S.mode !== 'jour') (S.results = S.results || []).push({ c: S.cur, ok: !!right });
    const d = U(), stage = $('#fg-stage'); if (stage) { stage.classList.remove('blur'); stage.style.removeProperty('--bl'); }
    if (S.mode === 'jour') return dayAnswer(right, answer);
    if (right) {
      S.score++; S.streak++; snd('quiz-ok'); if (btn) btn.classList.add('ok');
      $('#fg-ans').querySelectorAll('.fg-opt').forEach(b => { if (b !== btn) b.classList.add('dim'); b.disabled = true; });
      $('#fg-cap').textContent = d.good; hud(); fxGood(btn);
      if (S.streak % 5 === 0) { big(d.streak(S.streak), '#ff7a1a', 12); fxFlame(); }
      await wait(S.streak % 5 === 0 ? 1100 : 650);
    } else {
      S.streak = 0; snd('quiz-bad');
      if (S.mode === 'serie') S.lives--; else S.left = Math.max(0, S.left - 3000);
      if (btn) btn.classList.add('ko');
      $('#fg-ans').querySelectorAll('.fg-opt').forEach(b => { b.disabled = true; if (b.dataset.c === S.cur) b.classList.add('ok'); else if (b !== btn) b.classList.add('dim'); });
      if (S.type) { const sl = $('#fg-slots'); if (sl) { [...sl.querySelectorAll('i:not(.gap)')].forEach((s, i) => { s.textContent = [...F.norm(nm(S.cur)).replace(/ /g, '')][i] || ''; }); } $('#fg-input')?.blur(); }
      $('#fg-cap').textContent = d.wasIt(nm(S.cur)); hud(); fxBad(btn);
      await wait(1500);
    }
    if (!S || S.over) return;
    saveRun();
    if (S.mode === 'serie' && S.lives <= 0) return end(d.over);
    if (S.mode === 'chrono' && S.left <= 0) return end(d.timeUp);
    next();
  }
  function fxGood(btn) {
    if (reduce()) return; const f = $('#fg-stage .flag-frame');
    if (f) A(f, [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-4deg) scale(1.1)' }, { transform: 'rotate(0) scale(1)' }], { duration: 500, fill: 'none' });
    if (btn) A(btn, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 360, fill: 'none' });
    const r = (f || fg()).getBoundingClientRect(), b = fg().getBoundingClientRect();
    for (let i = 0; i < 16; i++) {
      const p = el(`<div class="fg-fx" style="width:8px;height:8px;border-radius:50%;left:${r.left - b.left + r.width / 2}px;top:${r.top - b.top + r.height / 2}px;background:${['#ffd23f', '#e2485d', '#1f9d55', '#0a6cff'][i % 4]}"></div>`); fg().appendChild(p);
      A(p, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 280}px,${-60 - Math.random() * 70}px)`, opacity: 1, offset: .5 }, { transform: `translate(${(Math.random() - .5) * 320}px,70px)`, opacity: 0 }], { duration: 900 + Math.random() * 400 }).onfinish = () => p.remove();
    }
  }
  function fxBad(btn) {
    if (reduce()) return;
    if (btn) A(btn, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 420, fill: 'none' });
    else { const f = $('#fg-stage'); if (f) A(f, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }], { duration: 380, fill: 'none' }); }
    const h = S.mode === 'serie' ? document.querySelector('.fg-hearts svg:nth-child(' + (S.lives + 1) + ')') : null; if (h) A(h, [{ transform: 'scale(1)' }, { transform: 'scale(1.8) rotate(12deg)', offset: .3 }, { transform: 'scale(.9)' }], { duration: 600, fill: 'none' });
  }
  function fxFlame() {
    const f = document.querySelector('.fg-streak svg'); if (f && !reduce()) A(f, [{ transform: 'scale(1)' }, { transform: 'scale(2.2) rotate(-10deg)' }, { transform: 'scale(1)' }], { duration: 800, fill: 'none' });
    const r = el('<div class="fg-fx" style="inset:0;box-shadow:inset 0 0 40px 10px rgba(255,122,26,.5)"></div>'); fg().appendChild(r);
    if (!reduce()) A(r, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 1100 }).onfinish = () => r.remove(); else r.remove();
  }

  // ── Fin de partie ───────────────────────────────────────────────────────────
  async function end(title) {
    if (!S || S.over) return; S.over = true; cancelAnimationFrame(raf); clearRun();
    const d = U(), mode = S.mode, score = S.score;
    const record = score > 0 && setBest(mode, score);
    try { socket.emit('flags-solo-finished', { playerId: getPlayerId(), mode, score }); } catch {}
    const th = mode === 'chrono' ? [8, 15, 25] : [5, 10, 20], stars = th.filter(x => score >= x).length;
    snd(score > 0 ? 'win' : 'lose');
    const recap = (S.results || []).map(r => `<span class="fe-f${r.ok ? '' : ' no'}" title="${esc(nm(r.c))}">${flagImg(r.c)}</span>`).join('');
    fg().innerHTML = `<div class="fe"><div class="fe-left"><h3>${esc(title || d.over)}</h3><div class="num" id="fg-cnt">0</div><div class="fe-sub">${d.foundLbl}</div><div class="stars" id="fg-stars"></div>${record ? `<span class="rec">${d.record}</span>` : ''}<div class="acts"><button class="btn btn-primary" id="fg-again">${d.again}</button><button class="btn tear-btn" id="fg-out">${d.quit}</button></div></div><div class="fe-right"><p class="fh-lab">${d.yourFlags}</p><div class="fe-recap">${recap}</div></div></div>`;
    const t0 = performance.now(); (function f() { const p = Math.min(1, (performance.now() - t0) / (reduce() ? 1 : 1200)); const c = $('#fg-cnt'); if (c) c.textContent = Math.round(score * p); if (p < 1) requestAnimationFrame(f); })();
    [0, 1, 2].forEach(i => { const st = el(STAR); if (i >= stars) st.style.opacity = '.25'; $('#fg-stars').appendChild(st); if (i < stars && !reduce()) A(st, [{ opacity: 0, transform: 'scale(0) rotate(-90deg)' }, { opacity: 1, transform: 'scale(1.3) rotate(10deg)', offset: .6 }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 500, delay: 800 + i * 250 }); });
    $('#fg-again').onclick = () => startRun(mode); $('#fg-out').onclick = leaveToHome;
    setTimeout(() => { try { socket.emit('get-flags-leaderboard'); } catch {} }, 600);
  }

  // ── Drapeau du jour ─────────────────────────────────────────────────────────
  function untilTomorrow() {
    const n = new Date(Date.now() + 3_600_000), t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1)), ms = t - n;
    return `${Math.floor(ms / 3_600_000)} h ${String(Math.floor(ms % 3_600_000 / 60000)).padStart(2, '0')}`;
  }
  function renderDay() {
    const d = U(); fg().innerHTML = frame(); hud();
    $('#fg-bar').style.visibility = 'hidden';
    $('#fg-stage').innerHTML = flagImg(S.cur); $('#fg-cap').textContent = d.typeIt;
    const parts = F.norm(nm(S.cur)).split(' ');
    $('#fg-ans').innerHTML = `<div class="fg-type"><div class="fg-slots" id="fg-slots">${parts.map(p => [...p].map(() => '<i></i>').join('')).join('<i class="gap"></i>')}</div><div class="fg-in"><input id="fg-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="${d.typeIt}"><button class="btn btn-primary" id="fg-send" type="button">${d.send}</button></div><p class="fg-hint" id="fg-hint"></p></div>`;
    const inp = $('#fg-input'); inp.addEventListener('input', () => mirror(inp.value)); inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitDay(); });
    $('#fg-send').onclick = submitDay;
    clearInterval(tick);
    const hints = () => {
      if (!S || S.over) return; const s = (Date.now() - S.qStart) / 1000, me = F.byCode[S.cur], full = F.norm(nm(S.cur)).replace(/ /g, '');
      const arr = []; if (s >= 10) arr.push(d.hint1(d.conts[me.k])); if (s >= 20) arr.push(d.hint2(full[0].toUpperCase())); if (s >= 30) arr.push(d.hint3(full.length));
      const h = $('#fg-hint'); if (h) h.textContent = arr.join(' · ');
    };
    hints(); tick = setInterval(hints, 1000);
  }
  function submitDay() { if (!S || S.busy || S.over) return; const v = $('#fg-input').value.trim(); if (!v) return; S.busy = true; dayAnswer(F.match(S.cur, v), v); }
  async function dayAnswer(right) {
    const d = U(); clearInterval(tick);
    if (right) {
      S.solved = true; S.over = true; S.score = 1; snd('win'); $('#fg-cap').textContent = d.daySolved; fxGood(); saveDay();
      await wait(1200); finishDay();
    } else {
      S.tries--; saveDay(); hud();
      if (S.tries <= 0) { S.over = true; S.solved = false; S.score = 0; snd('quiz-bad'); $('#fg-cap').textContent = d.dayFail(nm(S.cur)); fxBad(); saveDay(); await wait(1500); finishDay(); }
      else { snd('quiz-bad'); $('#fg-cap').textContent = d.wrong; fxBad(); S.busy = false; const i = $('#fg-input'); if (i) { i.value = ''; mirror(''); i.focus(); } hudHints(); }
    }
  }
  function hudHints() { /* les indices continuent d'arriver avec le temps */ }
  function finishDay() {
    try { socket.emit('flags-solo-finished', { playerId: getPlayerId(), mode: 'jour', score: S.solved ? 1 : 0 }); } catch {}
    renderDayDone();
  }
  function renderDayDone() {
    const d = U(); fg().innerHTML = frame(); hud(); $('#fg-bar').style.visibility = 'hidden';
    $('#fg-stage').innerHTML = flagImg(S.cur);
    $('#fg-cap').textContent = S.solved ? d.daySolved : d.dayFail(nm(S.cur));
    $('#fg-ans').innerHTML = `<p class="fg-hint">${d.dayDone(untilTomorrow())}</p><div class="fg-end-acts" style="display:flex;gap:8px;justify-content:center"><button class="btn tear-btn" id="fg-out">${d.quit}</button></div>`;
    $('#fg-out').onclick = leaveToHome; document.getElementById('fg-hud') && ($('#fg-hud').innerHTML = `<button class="fg-q" id="fg-quit" type="button">${d.quit}</button><span>${d.modes.jour[0]}</span><span></span>`, $('#fg-quit').onclick = leaveToHome);
  }

  // ── Reprise apres F5 ────────────────────────────────────────────────────────
  function restore() {
    ensure();
    let st = null; try { st = JSON.parse(sessionStorage.getItem(RUN) || 'null'); } catch {}
    const screen = sessionStorage.getItem('libero_screen');
    if (screen === 'flag-game') {
      if (st && st.deck) { S = Object.assign({ busy: false, over: false, tries: 1, qStart: 0, results: [] }, st); S.i = Math.max(0, st.i); showGame(); renderQuestion(true); return true; }
      const day = rd(DAYK, {}); if (day.day === dayKey() && !day.over) { startDay(); return true; }
      if (day.day === dayKey() && day.over) { startDay(); return true; }
    }
    showHome(true); return false;
  }
  function on(ev, d) {
    if (ev === 'flags-leaderboard') renderLb(d.rows); else if (ev === 'flags-leaderboard-update') { if (home && home.classList.contains('active')) socket.emit('get-flags-leaderboard'); }
  }
  window.LiberoFlags = { showHome, restore, on, renderHome };
})();
