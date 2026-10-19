/* Quiz mixte : themes de culture generale et drapeaux dans la meme partie.
   Deux facons de regler : « Rapide » (part de drapeaux, ordre, continent) et « Parcours » (une suite de manches).
   Les parties se jouent dans le salon de quiz existant (serveur : kind 'mix'). Charge a la demande par app.js (_mixLoad). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const PK = 'libero_mix';
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => (typeof _escHtml === 'function' ? _escHtml(String(s)) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const DEF = { tab: 'fast', cats: [], diff: '', pct: 40, ord: 'mix', cont: 'all', nb: 10, rounds: [{ k: 't', n: 6 }, { k: 'f', n: 5 }], who: '' };
  let P = Object.assign({}, DEF, rd(PK, {}));
  if (!Array.isArray(P.rounds) || !P.rounds.length) P.rounds = DEF.rounds.map(r => ({ ...r }));
  const save = () => wr(PK, P);
  const PRE = { tour: [{ k: 't', n: 5 }, { k: 'f', n: 5 }, { k: 't', n: 5 }, { k: 'fc', n: 5, c: 'AF' }], afr: [{ k: 'fc', n: 8, c: 'AF' }, { k: 't', n: 6 }, { k: 'fc', n: 6, c: 'AF' }], benin: [{ k: 't', n: 7 }, { k: 'f', n: 5 }] };
  const CONTS = ['AF', 'EU', 'AS', 'AM', 'OC'];
  const FLS = ['bj', 'fr', 'jp', 'br', 'ng', 'za', 'ca'];

  const D = {
    fr: {
      back: 'Retour', title: 'Quiz mixte', sub: 'Thèmes et drapeaux dans la même partie', pseudoPh: 'Ton pseudo',
      tabs: { fast: 'Rapide', path: 'Parcours' }, themes: 'Thèmes (sélection multiple) :', diff: 'Difficulté :',
      diffs: { '': 'Mixte', easy: 'Facile', medium: 'Moyen', hard: 'Difficile', extreme: 'Extrême' },
      flagsLbl: 'Drapeaux', share: p => `Part des drapeaux : ${p} %`, order: 'Ordre', orders: { mix: 'Mélangé', alt: 'En alternance', end: 'Drapeaux à la fin' },
      cont: 'Continent des drapeaux', conts: { all: 'Tous', AF: 'Afrique', EU: 'Europe', AS: 'Asie', AM: 'Amériques', OC: 'Océanie' }, nb: 'Nombre de questions',
      preview: (t, f) => `Aperçu : ${t} questions de thèmes et ${f} drapeaux`,
      presets: 'Parcours prêts à jouer', presetNames: { tour: 'Tour du monde', afr: 'Spécial Afrique', benin: 'Bénin et drapeaux' }, rounds: 'Tes manches',
      types: { t: 'Thèmes', f: 'Drapeaux', fc: "Drapeaux d'un continent" }, q: 'questions', add: '+ Ajouter une manche', max: '6 manches au maximum',
      sum: (q, r, m) => `${q} questions en ${r} manche${r > 1 ? 's' : ''}, environ ${m} min`, banner: 'Entre deux manches, une bannière annonce la suite.',
      themesUsed: 'Thèmes choisis', who: 'Avec qui ?', whoOpts: { solo: 'Seul', friend: 'Avec des amis', code: "J'ai un code" },
      play: 'Jouer', create: 'Créer une partie', codePh: 'Code à 4 lettres', join: 'Rejoindre',
      errName: 'Choisis un pseudo pour jouer.', errTheme: 'Choisis au moins un thème.', errDiff: 'Choisis une difficulté.', err4: 'Entre le code à 4 lettres.', remove: 'Retirer', up: 'Monter', down: 'Descendre',
    },
    en: {
      back: 'Back', title: 'Mixed quiz', sub: 'Themes and flags in the same game', pseudoPh: 'Your nickname',
      tabs: { fast: 'Quick', path: 'Path' }, themes: 'Themes (multiple choice):', diff: 'Difficulty:',
      diffs: { '': 'Mixed', easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme' },
      flagsLbl: 'Flags', share: p => `Share of flags: ${p}%`, order: 'Order', orders: { mix: 'Shuffled', alt: 'Alternating', end: 'Flags at the end' },
      cont: 'Continent of the flags', conts: { all: 'All', AF: 'Africa', EU: 'Europe', AS: 'Asia', AM: 'Americas', OC: 'Oceania' }, nb: 'Number of questions',
      preview: (t, f) => `Preview: ${t} theme questions and ${f} flags`,
      presets: 'Ready-made paths', presetNames: { tour: 'World tour', afr: 'Africa special', benin: 'Benin and flags' }, rounds: 'Your rounds',
      types: { t: 'Themes', f: 'Flags', fc: 'Flags of a continent' }, q: 'questions', add: '+ Add a round', max: '6 rounds maximum',
      sum: (q, r, m) => `${q} questions in ${r} round${r > 1 ? 's' : ''}, about ${m} min`, banner: 'Between two rounds, a banner announces what comes next.',
      themesUsed: 'Chosen themes', who: 'Who with?', whoOpts: { solo: 'Alone', friend: 'With friends', code: 'I have a code' },
      play: 'Play', create: 'Create a game', codePh: '4-letter code', join: 'Join',
      errName: 'Pick a nickname to play.', errTheme: 'Pick at least one theme.', errDiff: 'Pick a difficulty.', err4: 'Enter the 4-letter code.', remove: 'Remove', up: 'Move up', down: 'Move down',
    },
  };
  const U = () => D[L()];

  let home = null;
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
  function loadCss() { if (document.getElementById('mix-css')) return; const l = document.createElement('link'); l.id = 'mix-css'; l.rel = 'stylesheet'; l.href = 'mix.css?v=3'; document.head.appendChild(l); }

  function ensure() {
    loadCss();
    if (home) return;
    const host = document.getElementById('screen-home')?.parentNode || document.body;
    home = el(`<div id="screen-mix-home" class="screen">
      <button class="btn-back" id="mx-back"></button>
      <div class="logo"><h1 id="mx-title"></h1><p class="subtitle" id="mx-sub"></p></div>
      <div class="card who-card mx-card" id="mx-card">
        <input id="mx-name" type="text" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" />
        <div class="mx-seg" id="mx-seg" role="tablist"></div>
        <p class="trivia-theme-label" id="mx-l-themes"></p><div id="mx-themes" class="trivia-themes"></div>
        <p class="trivia-theme-label" id="mx-l-diff"></p><div class="trivia-diff-row" id="mx-diff"></div>
        <div id="mx-fast"></div><div id="mx-path"></div>
        <p class="trivia-theme-label" id="mx-l-who"></p><div class="who-row" id="mx-who"></div>
        <div class="mx-act" id="mx-act"></div>
        <p class="error-msg hidden" id="mx-err"></p>
      </div>
    </div>`);
    host.appendChild(home);
    $('#mx-back', home).onclick = () => showScreen('quiz-hub');
    $('#mx-name', home).addEventListener('input', e => {
      const v = e.target.value; localStorage.setItem('playerName', v.trim());
      ['input-trivia-name', 'input-name'].forEach(id => { const o = document.getElementById(id); if (o) o.value = v; });
      try { triggerRename(v.trim()); } catch {}
    });
  }

  // Suite des questions (apercu) : meme logique que le serveur.
  function seq(nb, pct, ord) {
    const nf = Math.min(nb - 1, Math.max(1, Math.round(nb * pct / 100))), nt = nb - nf, a = [];
    if (ord === 'end') { for (let i = 0; i < nt; i++) a.push('t'); for (let i = 0; i < nf; i++) a.push('f'); }
    else if (ord === 'alt') { let x = nt, y = nf; while (x + y > 0) { if (x > 0) { a.push('t'); x--; } if (y > 0) { a.push('f'); y--; } } }
    else { const bag = []; for (let i = 0; i < nt; i++) bag.push('t'); for (let i = 0; i < nf; i++) bag.push('f'); let s = 7; for (let i = bag.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } return bag; }
    return a;
  }
  function strip(a) { let f = 0; return '<div class="mx-strip">' + a.map(x => x === 't' ? '<span class="mx-sq t">?</span>' : `<span class="mx-sq"><img src="assets/flags/${FLS[(f++) % FLS.length]}.svg" alt=""></span>`).join('') + '</div>'; }
  const needThemes = () => P.tab === 'fast' || P.rounds.some(r => r.k === 't');

  function render() {
    ensure(); const d = U(), me = (localStorage.getItem('playerName') || '').trim();
    $('#mx-back', home).textContent = d.back; $('#mx-title', home).textContent = d.title; $('#mx-sub', home).textContent = d.sub;
    const ni = $('#mx-name', home); ni.placeholder = d.pseudoPh; if (document.activeElement !== ni) ni.value = me;
    $('#mx-seg', home).innerHTML = ['fast', 'path'].map(k => `<button type="button" role="tab" aria-selected="${P.tab === k}" data-t="${k}">${d.tabs[k]}</button>`).join('');
    // Themes : meme presentation que Culture Generale, mais une selection a part.
    $('#mx-l-themes', home).textContent = d.themes;
    $('#mx-themes', home).innerHTML = t().triviaCats.map(c => `
      <button class="theme-btn${P.cats.includes(c.id) ? ' active' : ''}" data-id="${c.id}">
        <span class="theme-photo"><img src="assets/quiz/${c.id}.webp?v=2" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.parentNode.classList.add('no-photo')"><span class="theme-art-wrap">${typeof _themeArt === 'function' ? _themeArt(c.id) : ''}</span></span>
        <span class="theme-name">${c.name}</span>
      </button>`).join('');
    $('#mx-l-diff', home).textContent = d.diff;
    $('#mx-diff', home).innerHTML = Object.keys(d.diffs).map(k => `<button type="button" class="diff-btn${P.diff === k ? ' active' : ''}" data-d="${k}">${d.diffs[k]}</button>`).join('');
    const chips = (list, cur, attr) => '<div class="mx-chips">' + list.map(x => `<button type="button" class="mx-chip" aria-pressed="${String(x[0]) === String(cur)}" data-${attr}="${x[0]}">${x[1]}</button>`).join('') + '</div>';
    // Rapide
    const fast = $('#mx-fast', home), path = $('#mx-path', home);
    fast.style.display = P.tab === 'fast' ? '' : 'none'; path.style.display = P.tab === 'path' ? '' : 'none';
    const seqA = seq(P.nb, P.pct, P.ord), nf = seqA.filter(x => x === 'f').length;
    fast.innerHTML = `<p class="trivia-theme-label">${d.flagsLbl}</p>
      <div class="mx-box"><label class="mx-lab">${d.share(P.pct)}</label><input class="mx-rng" id="mx-pct" type="range" min="10" max="90" step="10" value="${P.pct}" aria-label="${d.share(P.pct)}">
      <p class="mx-sub">${d.order}</p>${chips(Object.keys(d.orders).map(k => [k, d.orders[k]]), P.ord, 'o')}
      <p class="mx-sub">${d.cont}</p>${chips(Object.keys(d.conts).map(k => [k, d.conts[k]]), P.cont, 'c')}</div>
      <p class="trivia-theme-label">${d.nb}</p>${chips([10, 20, 30, 40].map(n => [n, n]), P.nb, 'n')}
      <div class="mx-box"><p class="mx-sub" style="margin:0 0 6px">${d.preview(P.nb - nf, nf)}</p>${strip(seqA)}</div>`;
    // Parcours
    const tot = P.rounds.reduce((a, r) => a + r.n, 0), colr = { t: 'a', f: 'b', fc: 'c' };
    path.innerHTML = `<p class="trivia-theme-label">${d.presets}</p>${chips(Object.keys(d.presetNames).map(k => [k, d.presetNames[k]]), '', 'p')}
      <p class="trivia-theme-label">${d.rounds}</p>` + P.rounds.map((r, i) => `<div class="mx-rd"><div class="mx-rt"><span class="mx-n">${i + 1}</span>
        <select class="mx-sel" data-i="${i}" aria-label="${d.rounds}">${['t', 'f', 'fc'].map(k => `<option value="${k}"${k === r.k ? ' selected' : ''}>${d.types[k]}</option>`).join('')}</select>
        <span class="mx-mv"><button type="button" class="mx-mini" data-up="${i}" aria-label="${d.up}">&uarr;</button><button type="button" class="mx-mini" data-dn="${i}" aria-label="${d.down}">&darr;</button><button type="button" class="mx-mini" data-rm="${i}" aria-label="${d.remove}">&times;</button></span></div>
        <div class="mx-rt"><button type="button" class="mx-mini" data-m="${i}">-</button><b>${r.n}</b> ${d.q}<button type="button" class="mx-mini" data-pl="${i}">+</button>
        ${r.k === 'fc' ? `<select class="mx-sel mx-csel" data-ci="${i}">${CONTS.map(c => `<option value="${c}"${c === (r.c || 'AF') ? ' selected' : ''}>${d.conts[c]}</option>`).join('')}</select>` : ''}
        ${r.k === 't' ? `<span class="mx-chip" aria-pressed="true" style="margin-left:auto">${d.themesUsed}</span>` : ''}</div></div>`).join('') +
      (P.rounds.length < 6 ? `<button type="button" class="mx-chip" id="mx-add">${d.add}</button>` : `<span class="mx-sub">${d.max}</span>`) +
      `<div class="mx-box"><p class="mx-sub" style="margin:0 0 6px"><b>${d.sum(tot, P.rounds.length, Math.max(1, Math.round(tot * 22 / 60)))}</b></p><div class="mx-tl">${P.rounds.map(r => `<i class="${colr[r.k]}" style="width:${r.n / tot * 100}%"></i>`).join('')}</div><p class="mx-sub" style="margin:6px 0 0">${d.banner}</p></div>`;
    // Avec qui ?
    $('#mx-l-who', home).textContent = d.who;
    $('#mx-who', home).innerHTML = ['solo', 'friend', 'code'].map(k => `<button type="button" class="who-btn${P.who === k ? ' active' : ''}" data-w="${k}">${d.whoOpts[k]}</button>`).join('');
    const act = $('#mx-act', home);
    act.innerHTML = P.who === 'code'
      ? `<div class="join-group"><input id="mx-code" type="text" maxlength="4" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="${d.codePh}" /><button class="btn btn-primary" id="mx-join">${d.join}</button></div>`
      : (P.who ? `<button class="btn btn-primary" id="mx-start">${P.who === 'friend' ? d.create : d.play}</button>` : '');
    bind();
  }

  function bind() {
    const rr = () => { save(); render(); };
    home.querySelectorAll('#mx-seg [data-t]').forEach(b => b.onclick = () => { P.tab = b.dataset.t; clearErr(); rr(); });
    home.querySelectorAll('#mx-themes .theme-btn').forEach(b => b.onclick = () => { const id = parseInt(b.dataset.id); P.cats = P.cats.includes(id) ? P.cats.filter(c => c !== id) : [...P.cats, id]; b.classList.toggle('active'); save(); clearErr(); });
    home.querySelectorAll('#mx-diff [data-d]').forEach(b => b.onclick = () => { P.diff = b.dataset.d; clearErr(); rr(); });
    const pct = $('#mx-pct', home); if (pct) pct.oninput = () => { P.pct = +pct.value; save(); render(); };
    home.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { P.ord = b.dataset.o; rr(); });
    home.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { P.cont = b.dataset.c; rr(); });
    home.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { P.nb = +b.dataset.n; rr(); });
    home.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { P.rounds = PRE[b.dataset.p].map(r => ({ ...r })); if (b.dataset.p === 'benin' && !P.cats.includes(32)) P.cats.push(32); rr(); });
    home.querySelectorAll('.mx-sel[data-i]').forEach(s => s.onchange = () => { const q = P.rounds[+s.dataset.i]; q.k = s.value; q.c = s.value === 'fc' ? (q.c || 'AF') : ''; rr(); });
    home.querySelectorAll('.mx-csel').forEach(s => s.onchange = () => { P.rounds[+s.dataset.ci].c = s.value; rr(); });
    const mv = (i, j) => { if (j < 0 || j >= P.rounds.length) return; const x = P.rounds; [x[i], x[j]] = [x[j], x[i]]; rr(); };
    home.querySelectorAll('[data-up]').forEach(b => b.onclick = () => mv(+b.dataset.up, +b.dataset.up - 1));
    home.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => mv(+b.dataset.dn, +b.dataset.dn + 1));
    home.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (P.rounds.length > 1) { P.rounds.splice(+b.dataset.rm, 1); rr(); } });
    home.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { const q = P.rounds[+b.dataset.pl]; q.n = Math.min(15, q.n + 1); rr(); });
    home.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const q = P.rounds[+b.dataset.m]; q.n = Math.max(3, q.n - 1); rr(); });
    const ad = $('#mx-add', home); if (ad) ad.onclick = () => { P.rounds.push({ k: 'f', n: 5 }); rr(); };
    home.querySelectorAll('#mx-who [data-w]').forEach(b => b.onclick = () => { P.who = b.dataset.w; clearErr(); rr(); });
    const st = $('#mx-start', home); if (st) st.onclick = () => go(P.who === 'solo');
    const jn = $('#mx-join', home), cd = $('#mx-code', home);
    if (cd) { cd.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); }); cd.addEventListener('keydown', e => { if (e.key === 'Enter') join(); }); }
    if (jn) jn.onclick = join;
  }
  function err(m) { const e = $('#mx-err', home); if (e) { e.textContent = m; e.classList.remove('hidden'); } }
  function clearErr() { const e = home && $('#mx-err', home); if (e) e.classList.add('hidden'); }

  // Cree le salon (seul = on lance tout de suite, avec des amis = on attend dans le salon).
  function go(solo) {
    const d = U(), name = (localStorage.getItem('playerName') || '').trim();
    if (!name) return err(d.errName);
    if (typeof _nameTaken !== 'undefined' && _nameTaken) return err(t().errNameTaken);
    if (needThemes() && !P.cats.length) return err(d.errTheme);
    clearErr();
    const mix = P.tab === 'path' ? { mode: 'path', rounds: P.rounds.map(r => ({ k: r.k, n: r.n, c: r.k === 'fc' ? (r.c || 'AF') : '' })) } : { mode: 'fast', flagPct: P.pct, order: P.ord, continent: P.cont === 'all' ? '' : P.cont };
    window._mixAutoStart = !!solo;
    socket.emit('create-trivia-room', { kind: 'mix', mix, categories: P.cats, name, lang: L(), difficulty: P.diff, amount: P.nb, playerId: getPlayerId() });
  }
  function join() {
    const d = U(), name = (localStorage.getItem('playerName') || '').trim(), code = ($('#mx-code', home).value || '').trim().toUpperCase();
    if (!name) return err(d.errName);
    if (code.length !== 4) return err(d.err4);
    clearErr();
    socket.emit('join-trivia-room', { code, name, playerId: getPlayerId() });
  }

  function open() { ensure(); render(); showScreen('mix-home'); }
  function restore() { open(); }
  window.LiberoMix = { open, restore, err: m => { if (home && home.classList.contains('active')) err(m); }, render: () => { if (home && home.classList.contains('active')) render(); } };
})();
