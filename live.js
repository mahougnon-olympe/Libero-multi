/* Quiz en direct : tournoi en trois sessions (quart, demi, finale), avec spectateurs.
   Les regles sont annoncees avant chaque etape. Charge a la demande par app.js (_liveLoad). */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const D = {
    fr: {
      title: 'Quiz en direct', back: 'Retour', sub: 'Le tournoi du week-end',
      sess: { q: 'Quart de finale', s: 'Demi-finale', f: 'Finale' },
      st: { scheduled: 'À VENIR', lobby: 'OUVERT', live: 'EN COURS', done: 'TERMINÉ', cancelled: 'ANNULÉ' },
      whenLine: (day, hour) => `${day} ${hour}`, qline: (a, b) => `${a} questions (${b})`, qual: n => n === 1 ? 'le 1er gagne' : `${n} passent`,
      detail: s => `${s.themeQ + s.flagQ} questions · ${Math.round(s.timeMs / 1000)} s`,
      players: n => `${n} joueur${n > 1 ? 's' : ''}`, qualified: n => `${n} qualifié${n > 1 ? 's' : ''}`,
      prize: 'Le 1er de la finale gagne un prix', prizeTbd: 'Prix à annoncer', prizeIs: 'Prix du champion',
      join: s => `Rejoindre : ${s}`, watch: 'Regarder sans jouer', notEl: 'Réservé aux joueurs qualifiés. Tu peux regarder.', closed: "Pas de session ouverte pour l'instant.",
      next: (n, t) => `Prochaine session : ${n}, ${t}`, opensIn: t => `Ouvre dans ${t}`, youIn: 'Tu es inscrit(e)',
      rulesH: 'Les règles du jeu', ready: "J'ai compris, je suis prêt", flagRound: n => `Manche drapeaux : ${n} drapeau${n > 1 ? 'x' : ''} à reconnaître`,
      rQ: n => ['questions', `${n}`], rules: {
        q: (s, th) => [[`${s.themeQ + s.flagQ}`, 'questions', `${s.themeQ} de culture générale, puis ${s.flagQ} drapeau${s.flagQ > 1 ? 'x' : ''}`], [`${Math.round(s.timeMs / 1000)} s`, 'par question', 'plus tu réponds vite, plus tu gagnes (1000 à 500 pts)'], [`${s.qualify}`, 'places', `les ${s.qualify} meilleurs passent à la suite`], ['0', 'pénalité', 'une mauvaise réponse ne retire rien']],
        f: (s, th) => [[`${s.themeQ + s.flagQ}`, 'questions', `${s.themeQ} de culture générale très difficiles, puis ${s.flagQ} drapeau${s.flagQ > 1 ? 'x' : ''}`], [`${Math.round(s.timeMs / 1000)} s`, 'par question', 'tout se joue à la seconde'], ['1', 'champion', 'le 1er gagne le prix, tous les yeux sont sur vous'], ['0', 'pénalité', 'une mauvaise réponse ne retire rien']],
      },
      themes: { benin: 'Bénin', history: 'Histoire', geography: 'Géographie', science: 'Sciences', sport: 'Sport', cinema: 'Cinéma', music: 'Musique', flag: 'Drapeaux' },
      nextBtn: 'Suivant', prevBtn: 'Précédent', drawSoon: 'Les thèmes seront tirés au sort en direct, juste avant le départ.', readyQ: 'Prêt à jouer ?', drawH: 'Tirage des thèmes', drawFix: 'Le Bénin est toujours au programme', drawN: (a, b) => `Tirage du thème ${a} sur ${b}...`, drawSum: l => `Au programme : ${l}`, startsIn: 'Départ dans', testChip: 'TEST', code: 'Code organisateur', codePh: 'Code', codeGo: 'Ouvrir', codeBad: 'Code inconnu ou test terminé.', errBad: 'Code inconnu ou test terminé.',
      lobbyH: 'Le quiz commence dans', inRoom: n => `${n} joueur${n > 1 ? 's' : ''} dans la salle`, stay: 'Ne quitte pas : tu es dans la salle', watching: n => `${n} regardent`,
      q: (a, b) => `Question ${a} sur ${b}`, answered: (a, b) => `${a} / ${b} ont répondu`, manche: 'MANCHE DRAPEAUX', manche2: 'Devine le drapeau', whichFlag: 'À quel pays appartient ce drapeau ?',
      readonly: 'Lecture seule : tu ne peux pas répondre', spec: 'SPECTATEUR', rest: 'Joueurs restants', all: 'Tout le tournoi', mode: 'Choisis comment regarder',
      serie: n => `Série de ${n}`, lbH: n => `Classement après la question ${n}`, you: 'Toi', yourRank: (r, n) => `Tu es ${r}${r === 1 ? 'er' : 'e'} sur ${n}`,
      endH: s => `${s} terminé`, qualifiedS: 'QUALIFIÉ', outS: 'ÉLIMINÉ', rankOf: n => `sur ${n} joueurs`, nextStep: (n, t) => `Prochaine étape : ${n}, ${t}`, outMsg: 'Bien joué ! Tu peux encore suivre la suite en spectateur.',
      follow: 'Suivre les joueurs restants', seeAll: 'Voir tout le tournoi', champ: 'Champion du Quiz en direct', yourPrize: 'Ton prix', prizeSoon: "Annoncé bientôt. Il apparaîtra ici.", libsWon: n => `+${n} Libs`,
      over: 'Tournoi terminé', thanks: 'Merci à tous les joueurs', toProg: 'Voir le programme', leave: 'Quitter la salle', errNotQ: "Tu n'es pas qualifié(e) pour cette session.", errLate: 'Trop tard pour rejoindre cette session.', errClosed: "Cette session n'est pas ouverte.", errAbort: "L'organisateur a arrêté la session.",
      day: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], bk: ['Quart', 'Demi', 'Finale'], cta: 'Quiz en direct', ctaLive: 'En direct maintenant', ctaSoon: 'Salle ouverte, rejoins-nous', ctaNext: 'Tournoi du week-end', pill: 'EN DIRECT',
    },
    en: {
      title: 'Live quiz', back: 'Back', sub: 'The weekend tournament',
      sess: { q: 'Quarterfinal', s: 'Semifinal', f: 'Final' },
      st: { scheduled: 'UPCOMING', lobby: 'OPEN', live: 'LIVE', done: 'FINISHED', cancelled: 'CANCELLED' },
      whenLine: (day, hour) => `${day} ${hour}`,
      detail: s => `${s.themeQ + s.flagQ} questions · ${Math.round(s.timeMs / 1000)} s`, qual: n => n === 1 ? 'winner takes it' : `${n} go through`,
      players: n => `${n} player${n > 1 ? 's' : ''}`, qualified: n => `${n} qualified`,
      prize: 'The winner of the final gets a prize', prizeTbd: 'Prize to be announced', prizeIs: "Champion's prize",
      join: s => `Join: ${s}`, watch: 'Watch without playing', notEl: 'Reserved for qualified players. You can watch.', closed: 'No session open right now.',
      next: (n, t) => `Next session: ${n}, ${t}`, opensIn: t => `Opens in ${t}`, youIn: "You're in",
      rulesH: 'The rules', ready: "Got it, I'm ready", flagRound: n => `Flag round: ${n} flag${n > 1 ? 's' : ''} to recognise`,
      rules: {
        q: (s) => [[`${s.themeQ + s.flagQ}`, 'questions', `${s.themeQ} general knowledge, then ${s.flagQ} flag${s.flagQ > 1 ? 's' : ''}`], [`${Math.round(s.timeMs / 1000)} s`, 'per question', 'the faster you answer, the more you earn (1000 to 500 pts)'], [`${s.qualify}`, 'places', `the best ${s.qualify} go through`], ['0', 'penalty', 'a wrong answer takes nothing away']],
        f: (s) => [[`${s.themeQ + s.flagQ}`, 'questions', `${s.themeQ} very hard general knowledge, then ${s.flagQ} flag${s.flagQ > 1 ? 's' : ''}`], [`${Math.round(s.timeMs / 1000)} s`, 'per question', 'every second counts'], ['1', 'champion', 'the winner gets the prize, all eyes are on you'], ['0', 'penalty', 'a wrong answer takes nothing away']],
      },
      themes: { benin: 'Benin', history: 'History', geography: 'Geography', science: 'Science', sport: 'Sport', cinema: 'Cinema', music: 'Music', flag: 'Flags' },
      nextBtn: 'Next', prevBtn: 'Back', drawSoon: 'The themes will be drawn live, just before the start.', readyQ: 'Ready to play?', drawH: 'Theme draw', drawFix: 'Benin is always on the programme', drawN: (a, b) => `Drawing theme ${a} of ${b}...`, drawSum: l => `On the programme: ${l}`, startsIn: 'Starts in', testChip: 'TEST', code: 'Organiser code', codePh: 'Code', codeGo: 'Open', codeBad: 'Unknown code or test over.', errBad: 'Unknown code or test over.',
      lobbyH: 'The quiz starts in', inRoom: n => `${n} player${n > 1 ? 's' : ''} in the room`, stay: "Don't leave: you're in the room", watching: n => `${n} watching`,
      q: (a, b) => `Question ${a} of ${b}`, answered: (a, b) => `${a} / ${b} answered`, manche: 'FLAG ROUND', manche2: 'Guess the flag', whichFlag: 'Which country does this flag belong to?',
      readonly: "Read only: you can't answer", spec: 'SPECTATOR', rest: 'Remaining players', all: 'Whole tournament', mode: 'Choose how to watch',
      serie: n => `Streak of ${n}`, lbH: n => `Ranking after question ${n}`, you: 'You', yourRank: (r, n) => `You are ${r}${r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th'} of ${n}`,
      endH: s => `${s} finished`, qualifiedS: 'QUALIFIED', outS: 'OUT', rankOf: n => `out of ${n} players`, nextStep: (n, t) => `Next step: ${n}, ${t}`, outMsg: 'Well played! You can still follow the rest as a spectator.',
      follow: 'Follow the remaining players', seeAll: 'See the whole tournament', champ: 'Live Quiz champion', yourPrize: 'Your prize', prizeSoon: 'Announced soon. It will appear here.', libsWon: n => `+${n} Libs`,
      over: 'Tournament over', thanks: 'Thanks to all the players', toProg: 'See the schedule', leave: 'Leave the room', errNotQ: "You're not qualified for this session.", errLate: 'Too late to join this session.', errClosed: 'This session is not open.', errAbort: 'The organiser stopped the session.',
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], bk: ['Quarter', 'Semi', 'Final'], cta: 'Live quiz', ctaLive: 'Live right now', ctaSoon: 'Room open, join us', ctaNext: 'Weekend tournament', pill: 'LIVE',
    },
  };
  const U = () => D[L()];
  const $ = (s, r = document) => r.querySelector(s);
  const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => (typeof _escHtml === 'function' ? _escHtml(s) : String(s));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snd = n => { try { window._sound?.play(n); } catch {} };
  const wait = ms => new Promise(r => setTimeout(r, reduce() ? 0 : ms));
  const KEY = 'libero_live';
  const COL = ['#ffb3b3', '#b3d4ff', '#b9f0c2', '#ffe08a', '#d9c2ff', '#ffc9a1', '#9fe3e0', '#f5b3e0'];
  const THEME_LIST = ['benin', 'history', 'geography', 'science', 'sport', 'cinema', 'music'];
  const pname = () => (localStorage.getItem('playerName') || '').trim();

  let root = null, body = null, info = null, off = 0;
  let V = { role: null, mode: 'remaining', code: '', themes: null, sid: null, view: 'prog', q: null, picked: -1, my: null, prev: null, tm: null, cdt: null, lastBoard: null, rulesSid: null };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ role: V.role, mode: V.mode, code: V.code })); } catch {} };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } };
  const now = () => Date.now() + off;
  const av = (name, portrait, i) => {
    try { if (window.LiberoPortrait) return portrait ? LiberoPortrait.svg(portrait) : LiberoPortrait.blank(); } catch {}
    return `<span style="font-weight:800">${esc((name || '?')[0].toUpperCase())}</span>`;
  };

  function loadCss() { if (document.getElementById('live-css')) return; const l = document.createElement('link'); l.id = 'live-css'; l.rel = 'stylesheet'; l.href = 'live.css?v=3'; document.head.appendChild(l); }
  function ensure() {
    loadCss();
    if (root) return;
    const host = document.getElementById('screen-home')?.parentNode || document.body;
    root = el(`<div id="screen-live" class="screen"><div class="lv" id="lv"><div class="lv-top" id="lv-top"></div><div id="lv-body"></div></div><canvas id="lv-fx"></canvas></div>`);
    host.appendChild(root);
    body = $('#lv-body', root);
  }
  function top(extra) {
    const d = U();
    $('#lv-top', root).innerHTML = `<button class="lv-back" id="lv-back">${d.back}</button><span class="lv-live" id="lv-live" ${['lobby', 'q', 'board'].includes(V.view) ? '' : 'style="display:none"'}><i></i>${d.pill}</span>${V.role === 'spec' ? `<span class="lv-eye">${d.spec}</span>` : ''}<span class="lv-n" id="lv-n">${extra || ''}</span>`;
    $('#lv-back', root).onclick = () => { if (V.role) leave(); else showScreen('events'); };
  }
  function scene(html, view) { V.view = view; clearInterval(V.cdt); body.innerHTML = `<div class="lv-scene lv-sc-${view}">${html}</div>`; top(); window.scrollTo?.(0, 0); }
  function curtain(t, s, mark) {
    return new Promise(res => {
      const c = el(`<div class="lv-cur${mark ? ' mark' : ''}"><div><b>${esc(t)}</b><span>${esc(s || '')}</span></div></div>`);
      document.body.appendChild(c);
      if (reduce()) { setTimeout(() => { c.remove(); res(); }, 400); return; }
      c.animate([{ clipPath: 'circle(0 at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', offset: .3 }, { clipPath: 'circle(150% at 50% 50%)', offset: .7 }, { clipPath: 'circle(0 at 50% 50%)' }], { duration: 1500, easing: 'ease' }).onfinish = () => { c.remove(); res(); };
    });
  }
  function confetti() {
    const c = $('#lv-fx', root); if (!c || reduce()) return;
    const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const P = [...Array(150)].map(() => ({ x: Math.random() * c.width, y: -20 - Math.random() * 200, vx: Math.random() * 2 - 1, vy: 2 + Math.random() * 3, r: Math.random() * 6, w: 4 + Math.random() * 6, col: COL[Math.floor(Math.random() * 8)] }));
    let n = 0; (function f() { x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.col; x.fillRect(-p.w / 2, -3, p.w, 6); x.restore(); }); if (++n < 280) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height); })();
  }
  const fmtT = ms => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : m ? `${m} min` : `${s} s`; };
  const when = ms => { const d = new Date(ms + 3600000); const dd = U().day[d.getUTCDay()]; return `${dd} ${d.getUTCHours()} h${d.getUTCMinutes() ? ' ' + String(d.getUTCMinutes()).padStart(2, '0') : ''}`; };
  const S = id => info && info.sessions.find(s => s.id === id);

  // ── Programme ──
  function prog() {
    ensure(); showScreen('live');
    const d = U(); if (!info) { scene(`<p class="lv-hand">${d.sub}</p>`, 'prog'); socket.emit('live-get', { playerId: getPlayerId(), code: V.code }); return; }
    const act = info.sessions.find(s => (s.status === 'lobby' || s.status === 'live') && s.me.eligible && !s.me.joined) || info.sessions.find(s => s.status === 'lobby' || s.status === 'live');
    let h = `<h1 class="lv-h1">${d.title}${info.test ? ` <span class="lv-chip gray">${d.testChip}</span>` : ''}</h1><p class="lv-hand">${d.sub}</p>`;
    h += info.sessions.map(s => {
      const chipC = s.status === 'done' ? 'ok' : s.status === 'live' ? 'red' : s.status === 'lobby' ? 'red' : 'gray';
      const lines = [`${when(s.start)} · ${d.detail(s)} · ${d.qual(s.qualify)}`];
      if (s.status === 'done') lines.push(`<b>${s.players}</b> ${d.players(s.players).replace(/^\d+ /, '')}, ${d.qualified(s.qualified)}` + (s.top.length ? ` · ${s.top.map(t => esc(t.name)).join(', ')}` : ''));
      else if (s.me.eligible && s.id !== 'q') lines.push(d.youIn);
      return `<div class="lv-sess${act && act.id === s.id ? ' now' : ''}"><div class="lv-row"><h3>${d.sess[s.id]}</h3><span class="lv-chip ${chipC}">${d.st[s.status]}</span></div>${lines.map(l => `<div class="lv-m">${l}</div>`).join('')}</div>`;
    }).join('');
    const prize = L() === 'en' ? info.prize.en : info.prize.fr;
    h += `<div class="lv-prize">${prize ? `${d.prizeIs} : ${esc(prize)}` : d.prizeTbd}</div>`;
    if (act) {
      const wait2 = act.start - now();
      if (act.me.eligible) h += `<button class="lv-btn" id="lv-join">${act.me.joined ? d.youIn : d.join(d.sess[act.id])}</button>`;
      else h += `<p class="lv-ghost">${d.notEl}</p>`;
      h += `<button class="lv-btn alt" id="lv-watch">${d.watch}</button>`;
    } else {
      const nx = info.sessions.find(s => s.status === 'scheduled');
      h += nx ? `<p class="lv-ghost">${d.next(d.sess[nx.id], when(nx.start))}</p>` : `<p class="lv-ghost">${d.over}</p>`;
      if (nx || info.sessions.some(s => s.status === 'done')) h += `<button class="lv-btn alt" id="lv-watch">${d.watch}</button>`;
    }
    h += `<button class="lv-link" id="lv-code">${V.code ? '' : d.code}</button>`;
    scene(h, 'prog');
    const cd = $('#lv-code', root);
    if (cd) cd.onclick = () => {
      cd.outerHTML = `<div class="lv-codebox"><input id="lv-codein" maxlength="8" placeholder="${d.codePh}" autocomplete="off" autocapitalize="characters"><button class="lv-btn" id="lv-codego">${d.codeGo}</button></div>`;
      const go = () => { const v = ($('#lv-codein', root).value || '').trim().toUpperCase(); if (!v) return; V.code = v; save(); socket.emit('live-get', { playerId: getPlayerId(), code: v }); };
      $('#lv-codego', root).onclick = go; $('#lv-codein', root).onkeydown = e => { if (e.key === 'Enter') go(); }; $('#lv-codein', root).focus();
    };
    const j = $('#lv-join', root); if (j) j.onclick = () => rules(act.id);
    const w = $('#lv-watch', root); if (w) w.onclick = chooseWatch;
  }
  function chooseWatch() {
    const d = U();
    scene(`<h1 class="lv-h1">${d.watch}</h1><p class="lv-hand">${d.mode}</p><button class="lv-btn" data-m="remaining">${d.follow}</button><button class="lv-btn alt" data-m="all">${d.seeAll}</button><button class="lv-btn alt" id="lv-cancel">${d.back}</button>`, 'watch');
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => watch(b.dataset.m));
    $('#lv-cancel', root).onclick = prog;
  }
  function watch(mode) { V.role = 'spec'; V.mode = mode; save(); socket.emit('live-watch', { playerId: getPlayerId(), mode, code: V.code }); specIdle(); }
  function specIdle() { if (V.role === 'spec' && ['prog', 'watch', 'rules'].includes(V.view)) bracket(); }

  // ── Regles annoncees avant la session : une par une, le temps de bien lire ──
  const STEP_MS = 6000;
  function rules(sid) {
    const s = S(sid); if (!s) return prog();
    const d = U(), key = sid === 'f' ? 'f' : 'q', rows = d.rules[key](s);
    V.rulesSid = sid; let i = 0, tm = null;
    const total = rows.length + 1; // les regles, puis « pret ? »
    scene(`<div class="lv-row"><span class="lv-chip red">${d.sess[sid].toUpperCase()}</span>${info && info.test ? `<span class="lv-chip gray">${d.testChip}</span>` : ''}</div><p class="lv-hand">${d.rulesH}</p>
      <div class="lv-rs-big" id="lv-rb"></div><div class="lv-dots" id="lv-dots">${'<i></i>'.repeat(total)}</div><div class="lv-rtimer" id="lv-rt"><i></i></div><div class="lv-done" id="lv-rd"></div>
      <div class="lv-nav"><button class="lv-btn alt" id="lv-rp">${d.prevBtn}</button><button class="lv-btn" id="lv-rn">${d.nextBtn}</button></div>`, 'rules');
    const big = $('#lv-rb', root), dots = $('#lv-dots', root), done = $('#lv-rd', root), tbar = $('#lv-rt', root).firstElementChild;
    function show() {
      clearTimeout(tm);
      big.style.animation = 'none'; void big.offsetWidth; big.style.animation = '';
      if (i < rows.length) { const r = rows[i]; big.innerHTML = `<b>${esc(r[0])}</b><h3>${esc(r[1])}</h3><p>${esc(r[2])}</p>`; }
      else big.innerHTML = `<h3>${d.readyQ}</h3><p>${d.drawSoon}</p><button class="lv-btn" id="lv-ok" style="margin-top:10px">${d.ready}</button>`;
      dots.querySelectorAll('i').forEach((x, k) => { x.className = k < i ? 'd' : k === i ? 'on' : ''; });
      done.innerHTML = rows.slice(0, Math.min(i, rows.length)).map(r => `<span>${esc(r[0])} ${esc(r[1])}</span>`).join('');
      $('#lv-rp', root).disabled = i === 0; $('#lv-rn', root).style.visibility = i >= total - 1 ? 'hidden' : '';
      try { tbar.getAnimations().forEach(a => a.cancel()); } catch {}
      if (i < total - 1) { if (!reduce()) tbar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: STEP_MS, fill: 'forwards', easing: 'linear' }); tm = setTimeout(() => { i++; show(); }, STEP_MS); }
      else tbar.style.transform = 'scaleX(0)';
      const ok = $('#lv-ok', root); if (ok) ok.onclick = () => { V.role = 'player'; save(); socket.emit('live-join', { playerId: getPlayerId(), name: pname() || 'Anonyme', code: V.code }); };
    }
    $('#lv-rn', root).onclick = () => { if (i < total - 1) { i++; show(); } };
    $('#lv-rp', root).onclick = () => { if (i > 0) { i--; show(); } };
    V.rulesStop = () => clearTimeout(tm);
    show();
  }

  // ── Tirage des themes, a la vue de tous ──
  async function drawScene(d0) {
    if (!V.role) return;
    const d = U(), themes = d0.themes, replay = d0.replay !== false && !reduce();
    V.themes = themes;
    const tile = (t, i) => `<div class="lv-dw${t === 'benin' ? ' bj' : ''}" data-t="${t}"><i style="background:${COL[i]}">${d.themes[t][0]}</i>${d.themes[t]}${t === 'benin' ? '<span class="lock">FIXE</span>' : ''}</div>`;
    scene(`<span class="lv-eye" style="align-self:flex-start">${d.drawH}</span><p class="lv-hand" id="lv-dh">${d.drawH}</p><div class="lv-draw" id="lv-dg">${THEME_LIST.map(tile).join('')}<div class="lv-dw flag" style="grid-column:span 2">${d.themes.flag}<br><small>${L() === 'en' ? 'always last' : 'toujours en dernier'}</small></div></div><div class="lv-slot" id="lv-slot"></div><div class="lv-ans" id="lv-ds"></div><div class="lv-sum" id="lv-sum" style="opacity:0"></div><div class="lv-cd" id="lv-cd" style="font-size:40px">0:00</div>`, 'draw');
    const tiles = [...$('#lv-dg', root).querySelectorAll('.lv-dw[data-t]')], by = t => tiles.find(x => x.dataset.t === t);
    const sum = () => { $('#lv-sum', root).textContent = d.drawSum(themes.map(t => d.themes[t]).join(', ') + ' + ' + d.themes.flag.toLowerCase()); $('#lv-sum', root).style.opacity = 1; };
    V.cdt = setInterval(tickLobby, 250); tickLobby();
    const rest = themes.slice(1);
    if (!replay) { by('benin').classList.add('won'); rest.forEach(t => by(t).classList.add('won')); tiles.forEach(x => { if (!themes.includes(x.dataset.t)) x.classList.add('out'); }); sum(); return; }
    const mine = V.view; snd('quiz-start');
    $('#lv-ds', root).textContent = d.drawFix; by('benin').classList.add('won'); await wait(1800);
    const slot = $('#lv-slot', root); slot.innerHTML = rest.map(() => '<div class="lv-reel"><div>?</div></div>').join('');
    const reels = [...slot.querySelectorAll('.lv-reel')], pool = THEME_LIST.slice(1), chosen = [];
    for (let n = 0; n < rest.length; n++) {
      if (V.view !== 'draw') return;
      $('#lv-ds', root).textContent = d.drawN(n + 1, rest.length);
      const txt = reels[n].firstElementChild, avail = pool.filter(p => !chosen.includes(p));
      await new Promise(res => { let k = 0; const total = 16 + n * 4; (function spin() { if (V.view !== 'draw') return res(); const p = avail[k % avail.length]; tiles.forEach(t => t.classList.remove('spin')); by(p).classList.add('spin'); txt.textContent = d.themes[p]; k++; if (k > total) return res(); setTimeout(spin, Math.min(170, 60 + k * 5)); })(); });
      tiles.forEach(t => t.classList.remove('spin')); const win = rest[n]; chosen.push(win); by(win).classList.add('won'); txt.textContent = d.themes[win]; reels[n].classList.add('stop'); await wait(900);
    }
    if (V.view !== 'draw') return;
    tiles.forEach(x => { if (!themes.includes(x.dataset.t)) x.classList.add('out'); }); $('#lv-ds', root).textContent = ''; sum();
  }

  // ── Salle d'attente ──
  function lobby(d0) {
    const d = U(); V.sid = d0.sid; off = d0.now - Date.now(); V.startAt = d0.startAt;
    if (V.view === 'draw') { top(d0.specs ? d.watching(d0.specs) : ''); return; }
    if (V.view !== 'lobby') {
      scene(`<h1 class="lv-h1">${d.sess[d0.sid]}</h1><p class="lv-hand">${d.lobbyH}</p><div class="lv-cd" id="lv-cd">0:00</div><div class="lv-box"><div class="lv-ans" id="lv-in"></div></div><p class="lv-ghost">${V.role === 'spec' ? '' : d.stay}</p><p class="lv-ghost" style="opacity:.8">${d.drawSoon}</p>`, 'lobby');
      V.cdt = setInterval(tickLobby, 250);
    }
    V.startAt = d0.startAt; $('#lv-in', root).innerHTML = `<b>${d0.n}</b> ${d.inRoom(d0.n).replace(/^\d+ /, '')}`;
    top(d0.specs ? d.watching(d0.specs) : ''); tickLobby();
  }
  function tickLobby() {
    const c = $('#lv-cd', root); if (!c || !V.startAt) return;
    const s = Math.max(0, Math.ceil((V.startAt - now()) / 1000));
    c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; c.classList.toggle('hot', s <= 3 && s > 0);
  }

  // ── Question ──
  const flagName = c => { try { return window.FlagsData.name(c, L()); } catch { return c; } };
  function choiceTxt(q, c) { return q.kind === 'flag' ? flagName(c.code) : c[L()]; }
  async function showQ(q) {
    const d = U(); V.q = q; V.picked = -1; V.prev = V.lastBoard; off = q.now - Date.now();
    if (q.newManche) await curtain(d.manche2, d.themes.flag, true);
    const ro = V.role === 'spec';
    const flag = q.kind === 'flag' ? `<div class="lv-flag" id="lv-flag">${typeof _flagImgHtml === 'function' ? _flagImgHtml(q.flag) : ''}</div>` : '';
    scene(`<div class="lv-qh"><span>${d.q(q.num, q.total)}</span><span class="lv-chip ${q.kind === 'flag' ? 'mark' : ''}">${q.kind === 'flag' ? d.manche : d.themes[q.theme] || ''}</span></div>
      <div class="lv-bar" id="lv-bar"><i></i></div>
      <div class="lv-q">${q.kind === 'flag' ? d.whichFlag : esc(q.q[L()])}</div>${flag}
      <div class="lv-ch${ro ? ' lv-ro' : ''}" id="lv-ch">${q.c.map((c, k) => `<button class="lv-c" data-k="${k}"><b>${'ABCD'[k]}</b>${esc(choiceTxt(q, c))}<span class="pc"></span></button>`).join('')}</div>
      <div class="lv-ans" id="lv-ans"></div>${ro ? `<div class="lv-ghost">${d.readonly}</div><div class="lv-feed" id="lv-feed"></div>` : '<div id="lv-stk"></div>'}<div class="lv-gain" id="lv-gain"></div>`, 'q');
    top(ro ? '' : '');
    $('#lv-ans', root).innerHTML = d.answered(0, '…').replace('…', '');
    startBar(q.endAt - off, q.timeMs);
    if (!ro) body.querySelectorAll('.lv-c').forEach(b => b.onclick = () => pick(+b.dataset.k));
    if (q.revealing) $('#lv-ch', root).classList.add('lv-ro');
  }
  function startBar(endAt, total) {
    const bar = $('#lv-bar', root); if (!bar) return;
    const i = bar.firstElementChild, left = Math.max(0, endAt - Date.now());
    try { i.getAnimations().forEach(a => a.cancel()); } catch {}
    if (!reduce()) i.animate([{ transform: `scaleX(${Math.min(1, left / total)})` }, { transform: 'scaleX(0)' }], { duration: left, fill: 'forwards', easing: 'linear' });
    clearTimeout(V.tm); bar.classList.remove('urgent');
    V.tm = setTimeout(() => bar.classList.add('urgent'), Math.max(0, left - 4000));
  }
  function pick(k) {
    if (V.role !== 'player' || !V.q) return;
    V.picked = k; body.querySelectorAll('.lv-c').forEach(b => b.classList.toggle('pick', +b.dataset.k === k));
    socket.emit('live-answer', { num: V.q.num, idx: k });
  }
  function onAnswered(d) {
    const a = $('#lv-ans', root); if (a) a.innerHTML = `<b>${d.n}</b> / ${d.total} ${U().answered(0, 0).replace(/^0 \/ 0 /, '')}`;
    const f = $('#lv-feed', root); if (f && d.feed) d.feed.forEach(n => f.insertAdjacentHTML('beforeend', `<span>${esc(n)}</span>`));
  }
  async function onReveal(r) {
    const q = V.q; if (!q) return; clearTimeout(V.tm);
    const ch = $('#lv-ch', root); if (!ch) return;
    ch.classList.add('lv-rev');
    ch.querySelectorAll('.lv-c').forEach(b => { const k = +b.dataset.k; b.style.setProperty('--w', r.pct[k] + '%'); b.querySelector('.pc').style.width = r.pct[k] + '%'; b.classList.remove('pick'); b.classList.add(k === r.a ? 'ok' : (k === V.picked ? 'bad' : 'no')); });
    const bar = $('#lv-bar', root); if (bar) try { bar.firstElementChild.getAnimations().forEach(a => a.pause()); } catch {}
    if (V.picked === r.a) snd('correct'); else if (V.picked >= 0) snd('wrong');
    V.lastReveal = r; await wait(3300);
    if (V.view === 'q') board(r);
  }
  function onMe(m) {
    V.my = m; if (m.quiet) return;
    const g = $('#lv-gain', root); if (g && V.view === 'q') {
      g.textContent = m.delta > 0 ? `+${m.delta}` : '0'; g.classList.toggle('zero', !(m.delta > 0));
      if (!reduce()) g.animate([{ opacity: 0, transform: 'translate(-50%,20px) scale(.5)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.15)', offset: .25 }, { opacity: 0, transform: 'translate(-50%,-60px)' }], { duration: 1500, fill: 'forwards' }); else g.style.opacity = 1;
      if (m.streak >= 2) $('#lv-stk', root)?.insertAdjacentHTML('beforeend', `<span class="lv-streak">${U().serie(m.streak)}</span>`);
    }
  }

  // ── Classement entre les questions ──
  function board(r) {
    const d = U(), prevNames = (V.prev || []).map(x => x.name);
    const me = pname();
    const rows = r.board;
    const html = `<p class="lv-hand">${d.lbH(r.num)}</p><div class="lv-lb" id="lv-lb">${rows.map((x, i) => `<div class="lv-r${x.name === me && V.role === 'player' ? ' me' : ''}" data-n="${esc(x.name)}"><span class="rk">${i + 1}</span><span class="av">${av(x.name, x.portrait)}</span>${x.name === me && V.role === 'player' ? d.you : esc(x.name)}<span class="d">${x.delta > 0 ? '+' + x.delta : ''}</span><span class="sc">${x.score - (x.delta || 0)}</span></div>`).join('')}</div>` +
      (V.role === 'player' && V.my ? `<p class="lv-mine">${d.yourRank(V.my.rank, V.my.total)} · ${V.my.score} pts</p>` : '');
    const old = {}; document.querySelectorAll('.lv-r').forEach(x => { old[x.dataset.n] = x.getBoundingClientRect().top; });
    scene(html, 'board');
    // les scores comptent jusqu'a leur valeur ; les lignes glissent depuis leur ancienne place
    body.querySelectorAll('.lv-r').forEach((row, i) => {
      const n = row.dataset.n, x = rows[i], sc = row.querySelector('.sc'), from = x.score - (x.delta || 0), t0 = performance.now();
      if (!reduce()) (function tick(t) { const f = Math.min(1, (t - t0) / 900); sc.textContent = Math.round(from + (x.score - from) * f); if (f < 1) requestAnimationFrame(tick); })(t0); else sc.textContent = x.score;
      const was = prevNames.indexOf(n); if (was > i || (was < 0 && V.prev)) row.classList.add('up');
    });
    V.lastBoard = rows;
  }

  // ── Fin de session ──
  async function onResult(r) {
    const d = U(), me = V.my;
    const q = r.qualified, next = r.next;
    if (r.final) return finale(r);
    scene(`<p class="lv-hand" style="text-align:center">${d.endH(d.sess[r.sid])}</p><div class="lv-rank">${r.rank}<small>${d.rankOf(r.total)}</small></div><div class="lv-stamp ${q ? '' : 'out'}" id="lv-stamp">${q ? d.qualifiedS : d.outS}</div><div class="lv-box" style="text-align:center;font-size:13px">${q && next ? esc(d.nextStep(d.sess[next.id], when(next.start))) : esc(d.outMsg)}</div>` +
      (q ? `<button class="lv-btn alt" id="lv-prog">${d.toProg}</button>` : `<button class="lv-btn" data-m="remaining">${d.follow}</button><button class="lv-btn alt" data-m="all">${d.seeAll}</button>`), 'result');
    await wait(500); $('#lv-stamp', root)?.classList.add('go'); if (q) { await wait(800); confetti(); }
    const pgb = $('#lv-prog', root); if (pgb) pgb.onclick = () => { leave(true); };
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => watch(b.dataset.m));
    if (q) V.role = 'player'; else V.role = null; save();
  }
  async function finale(r) {
    const d = U(); const w = r.champion;
    // podium des trois premiers + champion + prix
    const t = (V.endTop || []);
    scene(`<p class="lv-hand" style="text-align:center">${d.endH(d.sess.f)}</p><div class="lv-pod" id="lv-pod">${[1, 0, 2].map(i => t[i] ? `<div class="lv-st s${i + 1}"><div class="who"><i>${av(t[i].name, t[i].portrait)}</i>${esc(t[i].name)}</div>${i + 1}</div>` : '').join('')}</div><p class="lv-mine">${d.yourRank(r.rank, r.total)} · ${r.score} pts${r.reward ? ' · ' + d.libsWon(r.reward) : ''}</p><button class="lv-btn alt" id="lv-prog2">${d.toProg}</button>`, 'result');
    await wait(300); $('#lv-pod', root)?.classList.add('go'); await wait(2200); confetti();
    $('#lv-prog2', root).onclick = () => leave(true);
    V.role = null; save();
  }
  async function onEnd(e) {
    V.endTop = e.top; V.lastBoard = null;
    if (V.role !== 'spec') return;
    const d = U();
    scene(`<p class="lv-hand" style="text-align:center">${d.endH(d.sess[e.sid])}</p><div class="lv-pod" id="lv-pod">${[1, 0, 2].map(i => e.top[i] ? `<div class="lv-st s${i + 1}"><div class="who"><i>${av(e.top[i].name, e.top[i].portrait)}</i>${esc(e.top[i].name)}</div>${i + 1}</div>` : '').join('')}</div><div class="lv-ghost">${d.players(e.players)} · ${d.qualified(e.qualified)}</div>`, 'result');
    await wait(300); $('#lv-pod', root)?.classList.add('go'); await wait(2000); confetti();
    if (e.final && e.champion) { await wait(3000); champion(e.champion); } else { await wait(4000); bracket(); }
  }
  async function champion(c) {
    const d = U(), prize = L() === 'en' ? info?.prize?.en : info?.prize?.fr;
    scene(`<div class="lv-champ"><span class="lv-hand">${d.champ}</span><div class="av">${av(c.name, c.portrait)}</div><b>${esc(c.name)}</b></div><div class="lv-gift" id="lv-gift"><div class="lid"></div><div class="bx"></div><div class="rb"></div></div><div class="lv-prize"><span class="lv-hand">${d.yourPrize}</span><br>${prize ? esc(prize) : d.prizeSoon}</div><button class="lv-btn alt" id="lv-prog3">${d.toProg}</button>`, 'prize');
    await wait(900); $('#lv-gift', root)?.classList.add('go'); confetti();
    $('#lv-prog3', root).onclick = () => leave(true);
  }

  // ── Spectateur : tout le tournoi ──
  function bracket() {
    const d = U(); if (!info) { socket.emit('live-get', { playerId: getPlayerId(), code: V.code }); return; }
    const cols = info.sessions.map((s, i) => `<div class="col"><h4>${d.bk[i]}</h4><div class="num">${s.status === 'done' ? s.players : s.players || '·'}</div>${s.top.map(t => `<div class="pl">${esc(t.name)}</div>`).join('') || `<div class="pl" style="opacity:.5">${d.st[s.status]}</div>`}</div>`).join('');
    scene(`<div class="lv-tabs"><button data-m="remaining" class="${V.mode === 'remaining' ? 'on' : ''}">${d.rest}</button><button data-m="all" class="${V.mode === 'all' ? 'on' : ''}">${d.all}</button></div><div class="lv-bk">${cols}</div><div class="lv-ghost">${(info.active ? d.st.live : d.closed)}</div>`, 'bk');
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { V.mode = b.dataset.m; save(); bracket(); });
  }

  // ── Sortie et reprise ──
  function leave(toProg) {
    try { socket.emit('live-leave'); } catch {}
    V.role = null; V.q = null; V.lastBoard = null; clearTimeout(V.tm); clearInterval(V.cdt); save();
    try { sessionStorage.removeItem(KEY); } catch {}
    if (toProg) prog(); else showScreen('events');
  }
  function err(code) {
    const d = U(); const m = { badcode: d.errBad, notqualified: d.errNotQ, late: d.errLate, closed: d.errClosed, aborted: d.errAbort }[code] || d.errClosed;
    try { showCursorSnakeToast(m); } catch {}
    if (V.role === 'player' && V.view === 'rules') { V.role = null; save(); }
    if (code === 'aborted') { V.role = null; try { sessionStorage.removeItem(KEY); } catch {} }
    if (code === 'badcode') { V.code = ''; save(); socket.emit('live-get', { playerId: getPlayerId(), code: '' }); return; }
    if (['prog', 'rules', 'watch'].includes(V.view) || code === 'aborted') prog();
  }
  function restore() {
    ensure(); const s = load(); V.code = s.code || '';
    if (s.role === 'player') { V.role = 'player'; socket.emit('live-join', { playerId: getPlayerId(), name: pname() || 'Anonyme', code: V.code }); }
    else if (s.role === 'spec') { V.role = 'spec'; V.mode = s.mode || 'remaining'; socket.emit('live-watch', { playerId: getPlayerId(), mode: V.mode, code: V.code }); }
    showScreen('live'); if (!s.role) prog(); else scene('', 'prog');
  }

  // ── Evenements serveur ──
  function on(ev, d) {
    if (!root && ev !== 'live-info') return;
    d = d || {};
    switch (ev) {
      case 'live-info': info = d; off = d.now - Date.now(); if (root && root.classList.contains('active') && ['prog'].includes(V.view)) prog(); else if (V.view === 'bk') bracket(); break;
      case 'live-phase': socket.emit('live-get', { playerId: getPlayerId(), code: V.code }); break;
      case 'live-joined': V.sid = d.sid; break;
      case 'live-watching': V.mode = d.mode; break;
      case 'live-lobby': if (V.role) lobby(d); break;
      case 'live-draw': if (V.role) drawScene(d); break;
      case 'live-start': if (V.role) { V.lastBoard = null; snd('quiz-start'); curtain(U().sess[d.sid], '', false); } break;
      case 'live-q': if (V.role) { clearInterval(V.cdt); showQ(d); } break;
      case 'live-answered': if (V.view === 'q') onAnswered(d); break;
      case 'live-countdown': if (V.view === 'q' && V.q) { V.q.endAt = d.endAt; startBar(d.endAt - off, V.q.timeMs); } break;
      case 'live-reveal': if (V.role && V.view === 'q') onReveal(d); break;
      case 'live-me': if (V.role === 'player') onMe(d); break;
      case 'live-end': onEnd(d); break;
      case 'live-result': if (V.role === 'player') onResult(d); break;
      case 'live-error': err(d.code); break;
    }
  }
  function open() { ensure(); try { sessionStorage.removeItem(KEY); } catch {} V = Object.assign(V, { role: null, view: 'prog', code: '' }); prog(); socket.emit('live-get', { playerId: getPlayerId(), code: V.code }); }
  function resume() { if (V.role === 'player') socket.emit('live-join', { playerId: getPlayerId(), name: pname() || 'Anonyme', code: V.code }); else if (V.role === 'spec') socket.emit('live-watch', { playerId: getPlayerId(), mode: V.mode, code: V.code }); }
  window.LiberoLive = { open, restore, resume, on, info: () => info };
})();
