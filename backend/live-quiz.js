// ── Quiz en direct : tournoi en 3 sessions (quart, demi, finale) ─────────────
// Moteur serveur pur : la planification, les manches (culture + drapeaux), les points,
// les qualifications et les spectateurs. server.js lui donne ses outils via `ctx`.
const liveBank = require('./trivia-live');
const flagsGame = require('./game-flags');

const DEFAULT_CFG = {
  lobbyMin: 5,                         // la salle ouvre N minutes avant
  prize: { fr: '', en: '' },           // texte du prix du champion (vide = a annoncer)
  rewards: { 1: 0, 2: 0, 3: 0 },       // Libs verses aux trois premiers de la finale
  sessions: [
    { id: 'q', start: '2026-10-17T18:00:00+01:00', level: 'medium',  themeQ: 10, flagQ: 5, flagLevel: 'easy',   timeMs: 15000, qualify: 50 },
    { id: 's', start: '2026-10-18T15:00:00+01:00', level: 'hard',    themeQ: 10, flagQ: 5, flagLevel: 'medium', timeMs: 15000, qualify: 10 },
    { id: 'f', start: '2026-10-18T19:00:00+01:00', level: 'extreme', themeQ: 12, flagQ: 8, flagLevel: 'hard',   timeMs: 10000, qualify: 1 },
  ],
};
const REVEAL_MS = 7000;                // correction + classement entre deux questions
const LATE_Q = 3;                      // on peut entrer au quart jusqu'a la question 3

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

module.exports = function createLive(ctx) {
  const { io } = ctx;
  let cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  let state = { done: {}, used: [], champion: null };
  let run = null;
  const sockPid = new Map();           // socket.id -> playerId
  const specs = new Set();             // socket.id des spectateurs
  let tickT = null;

  const startMs = s => Date.parse(s.start);
  const idx = id => cfg.sessions.findIndex(s => s.id === id);
  const sess = id => cfg.sessions.find(s => s.id === id);

  function load(c, s) {
    if (c && typeof c === 'object') cfg = Object.assign({}, DEFAULT_CFG, c, { rewards: Object.assign({}, DEFAULT_CFG.rewards, c.rewards || {}), prize: Object.assign({}, DEFAULT_CFG.prize, c.prize || {}), sessions: Array.isArray(c.sessions) && c.sessions.length ? c.sessions : DEFAULT_CFG.sessions });
    if (s && typeof s === 'object') state = Object.assign({ done: {}, used: [], champion: null }, s);
  }
  const saveCfg = () => ctx.saveConfig('live_cfg', cfg);
  const saveState = () => ctx.saveConfig('live_state', state);

  function eligible(sid, pid) {
    if (!pid) return false;
    const i = idx(sid); if (i < 0) return false;
    if (i === 0) return true;
    const prev = state.done[cfg.sessions[i - 1].id];
    return !!(prev && prev.qualified.includes(pid));
  }
  function status(s) {
    const d = state.done[s.id];
    if (d) return 'done';
    if (s.cancelled) return 'cancelled';
    if (run && run.sid === s.id) return run.status === 'lobby' ? 'lobby' : 'live';
    const i = idx(s.id);
    if (i > 0 && !state.done[cfg.sessions[i - 1].id]) return 'scheduled';
    return Date.now() >= startMs(s) - cfg.lobbyMin * 60000 ? 'lobby' : 'scheduled';
  }
  function info(pid) {
    const sessions = cfg.sessions.map(s => {
      const d = state.done[s.id];
      const mine = d && pid ? d.ranking.find(r => r.pid === pid) : null;
      return {
        id: s.id, start: startMs(s), level: s.level, themeQ: s.themeQ, flagQ: s.flagQ, timeMs: s.timeMs, qualify: s.qualify,
        status: status(s), players: d ? d.players : (run && run.sid === s.id ? run.players.size : 0),
        top: d ? d.ranking.slice(0, 3).map(r => ({ name: r.name, score: r.score, portrait: r.portrait || null })) : [],
        qualified: d ? d.qualified.length : 0,
        me: { eligible: eligible(s.id, pid), joined: !!(run && run.sid === s.id && pid && run.players.has(pid)), rank: mine ? mine.rank : null, score: mine ? mine.score : null, qualified: !!(d && pid && d.qualified.includes(pid)) },
      };
    });
    return { now: Date.now(), lobbyMin: cfg.lobbyMin, sessions, prize: cfg.prize, champion: state.champion, specs: specs.size, active: run ? { sid: run.sid, status: run.status } : null };
  }
  const phase = () => io.emit('live-phase', { sid: run ? run.sid : null, status: run ? run.status : null });

  // ── Questions ──
  function buildQuestions(s) {
    const used = new Set(state.used);
    const themes = shuffle(liveBank.THEMES);
    const out = [];
    const order = { medium: ['medium', 'hard', 'extreme'], hard: ['hard', 'extreme', 'medium'], extreme: ['extreme', 'hard', 'medium'] }[s.level] || ['medium'];
    const pools = {};
    for (const t of themes) {
      pools[t] = [];
      for (const lv of order) { const arr = liveBank.LIVE[t][lv] || []; arr.forEach((q, i) => { const id = `live:${t}:${lv}:${i}`; if (!used.has(id)) pools[t].push({ id, t, lv, q }); }); if (pools[t].length >= 5) break; }
      pools[t] = shuffle(pools[t]);
    }
    // tour de role entre les themes pour un vrai mix
    let guard = 0;
    while (out.length < s.themeQ && guard++ < 500) {
      let added = false;
      for (const t of themes) { if (out.length >= s.themeQ) break; const e = pools[t].shift(); if (e) { out.push(e); added = true; } }
      if (!added) break;
    }
    const themed = out.map(e => {
      used.add(e.id);
      const ch = shuffle(e.q.fc.map((f, i) => ({ fr: f, en: e.q.ec[i], ok: i === e.q.a })));
      return { kind: 'theme', theme: e.t, q: { fr: e.q.f, en: e.q.e }, c: ch.map(x => ({ fr: x.fr, en: x.en })), a: ch.findIndex(x => x.ok), id: e.id };
    });
    const fl = flagsGame.pickQuestions({ amount: s.flagQ, level: s.flagLevel || 'easy' }).map(f => {
      const ch = shuffle(f.choices); return { kind: 'flag', theme: 'flag', flag: f.flag, c: ch.map(code => ({ code })), a: ch.indexOf(f.correct), id: 'flag:' + f.flag };
    });
    state.used = [...used]; saveState();
    return themed.concat(fl);
  }

  // ── Cycle d'une session ──
  function openLobby(s) {
    const i = idx(s.id), start = Math.max(startMs(s), Date.now() + 15000);
    run = { sid: s.id, s, status: 'lobby', startAt: start, players: new Map(), questions: [], cur: -1, qStart: 0, qEnd: 0, ans: new Map(), timer: null, feed: [] };
    phase();
  }
  function begin() {
    if (!run || run.status !== 'lobby') return;
    if (!run.players.size) { // personne : on reporte de 2 minutes plutot que de jouer a vide
      run.startAt = Date.now() + 120000; return;
    }
    run.questions = buildQuestions(run.s);
    run.status = 'question'; run.cur = -1;
    phase();
    io.to('live').emit('live-start', { sid: run.sid, total: run.questions.length, players: run.players.size });
    setTimeout(nextQ, 4000);
  }
  function qPayload() {
    const q = run.questions[run.cur];
    return { sid: run.sid, num: run.cur + 1, total: run.questions.length, kind: q.kind, theme: q.theme, q: q.q || null, flag: q.flag || null, c: q.c, endAt: run.qEnd, now: Date.now(), timeMs: run.s.timeMs, newManche: q.kind === 'flag' && (run.cur === 0 || run.questions[run.cur - 1].kind !== 'flag') };
  }
  function nextQ() {
    if (!run) return;
    run.cur++;
    if (run.cur >= run.questions.length) return finish();
    run.status = 'question'; run.ans = new Map(); run.qStart = Date.now() + 600; run.qEnd = run.qStart + run.s.timeMs;
    io.to('live').emit('live-q', qPayload());
    run.timer = setTimeout(reveal, run.qEnd - Date.now());
    run.prog = setInterval(() => { if (!run || run.status !== 'question') return; io.to('live').emit('live-answered', { n: run.ans.size, total: run.players.size, feed: run.feed.splice(0, 8) }); }, 1000);
  }
  function reveal() {
    if (!run || run.status !== 'question') return;
    clearTimeout(run.timer); clearInterval(run.prog);
    run.status = 'reveal';
    const q = run.questions[run.cur], total = run.s.timeMs;
    const counts = q.c.map(() => 0); let n = 0;
    for (const [pid, a] of run.ans) {
      const p = run.players.get(pid); if (!p) continue;
      counts[a.idx]++; n++;
      p.lastDelta = 0; p.lastOk = false; p.lastPick = a.idx;
      if (a.idx === q.a) {
        const el = Math.min(total, Math.max(0, a.at - run.qStart));
        const pts = Math.round(1000 - 500 * (el / total));
        p.score += pts; p.correct++; p.time += el; p.lastDelta = pts; p.lastOk = true;
        p.streak = (p.streak || 0) + 1;
      } else p.streak = 0;
    }
    for (const [pid, p] of run.players) if (!run.ans.has(pid)) { p.lastDelta = 0; p.lastOk = false; p.lastPick = -1; p.streak = 0; }
    const rank = ranking();
    const pct = counts.map(c => (n ? Math.round(c / n * 100) : 0));
    io.to('live').emit('live-reveal', { sid: run.sid, num: run.cur + 1, a: q.a, pct, answered: n, total: run.players.size, board: rank.slice(0, 7).map(r => ({ name: r.name, score: r.score, delta: r.lastDelta, portrait: r.portrait || null })), last: run.cur + 1 >= run.questions.length });
    for (const [sid, pid] of sockPid) {
      const p = run.players.get(pid); if (!p || specs.has(sid)) continue;
      const r = rank.find(x => x.pid === pid);
      io.to(sid).emit('live-me', { rank: r ? r.rank : null, score: p.score, delta: p.lastDelta, ok: p.lastOk, pick: p.lastPick, streak: p.streak || 0, total: run.players.size });
    }
    run.timer = setTimeout(nextQ, REVEAL_MS);
  }
  function ranking() {
    const arr = [...run.players.values()].sort((a, b) => b.score - a.score || a.time - b.time || a.name.localeCompare(b.name));
    arr.forEach((p, i) => { p.rank = i + 1; });
    return arr;
  }
  function finish() {
    clearTimeout(run.timer); clearInterval(run.prog);
    const s = run.s, rank = ranking();
    const qualified = s.qualify ? rank.filter(p => p.score > 0).slice(0, s.qualify).map(p => p.pid) : [];
    const final = idx(s.id) === cfg.sessions.length - 1;
    state.done[s.id] = {
      at: Date.now(), players: rank.length, qualified,
      ranking: rank.slice(0, 200).map(p => ({ pid: p.pid, name: p.name, score: p.score, rank: p.rank, time: p.time, portrait: p.portrait || null })),
    };
    if (final && rank[0]) {
      state.champion = { pid: rank[0].pid, name: rank[0].name, portrait: rank[0].portrait || null, at: Date.now() };
      [1, 2, 3].forEach(k => { const w = rank[k - 1], amt = Math.floor(+cfg.rewards[k] || 0); if (w && amt > 0) ctx.credit(w.pid, amt, 'live'); });
    }
    saveState();
    for (const p of rank) { try { ctx.xp(p.pid, 20 + 3 * p.correct); } catch {} }
    const top = rank.slice(0, 3).map(p => ({ name: p.name, score: p.score, portrait: p.portrait || null }));
    io.to('live').emit('live-end', { sid: s.id, top, players: rank.length, qualified: qualified.length, final, champion: final ? state.champion : null, next: nextSession(s.id) });
    for (const [sid, pid] of sockPid) {
      const p = run.players.get(pid); if (!p || specs.has(sid)) continue;
      io.to(sid).emit('live-result', { sid: s.id, rank: p.rank, score: p.score, correct: p.correct, total: rank.length, qualified: qualified.includes(pid), final, reward: final && p.rank <= 3 ? Math.floor(+cfg.rewards[p.rank] || 0) : 0, next: nextSession(s.id) });
    }
    run = null; phase();
  }
  function nextSession(sid) { const n = cfg.sessions[idx(sid) + 1]; return n ? { id: n.id, start: startMs(n) } : null; }

  // ── Horloge ──
  const NAMES = { q: ['Quart de finale', 'Quarterfinal'], s: ['Demi-finale', 'Semifinal'], f: ['Finale', 'Final'] };
  function remind() {
    state.reminded = state.reminded || {};
    for (const s of cfg.sessions) {
      if (state.done[s.id] || s.cancelled || state.reminded[s.id]) continue;
      const left = startMs(s) - Date.now();
      if (left > 0 && left <= 45 * 60000 && left > 20 * 60000) {
        state.reminded[s.id] = true; saveState();
        const n = NAMES[s.id] || [s.id, s.id];
        try { ctx.pushAll([`Quiz en direct : ${n[0]} dans 45 min`, "Prépare-toi, la salle ouvre bientôt. C'est dans l'onglet Évents."], [`Live quiz: ${n[1]} in 45 min`, "Get ready, the room opens soon. Find it in the Events tab."]); } catch {}
      }
    }
  }
  function tick() {
    try {
      remind();
      if (run && run.status === 'lobby') {
        io.to('live').emit('live-lobby', { sid: run.sid, n: run.players.size, specs: specs.size, startAt: run.startAt, now: Date.now() });
        if (Date.now() >= run.startAt) begin();
      } else if (!run) {
        for (const s of cfg.sessions) {
          const i = idx(s.id);
          if (state.done[s.id] || s.cancelled) continue;
          if (i > 0 && !state.done[cfg.sessions[i - 1].id]) break;
          if (Date.now() >= startMs(s) - cfg.lobbyMin * 60000) openLobby(s);
          break;
        }
      }
    } catch (e) { console.error('live tick', e); }
  }
  function start() { if (!tickT) tickT = setInterval(tick, 1000); }

  // ── Sockets ──
  function snapshot(socket, pid) {
    if (!run) return;
    if (run.status === 'lobby') socket.emit('live-lobby', { sid: run.sid, n: run.players.size, specs: specs.size, startAt: run.startAt, now: Date.now() });
    else if (run.status === 'question' && run.cur >= 0) socket.emit('live-q', qPayload());
    else if (run.status === 'reveal') {
      socket.emit('live-q', Object.assign(qPayload(), { revealing: true }));
    }
    const p = pid && run.players.get(pid);
    if (p) { const r = ranking(); socket.emit('live-me', { rank: p.rank, score: p.score, delta: p.lastDelta || 0, ok: !!p.lastOk, pick: p.lastPick ?? -1, streak: p.streak || 0, total: run.players.size, quiet: true }); void r; }
  }
  function attach(socket, getPid) {
    socket.on('live-get', ({ playerId } = {}) => { const pid = ctx.safePlayerId(playerId); socket.emit('live-info', info(pid)); });
    socket.on('live-join', ({ playerId, name } = {}) => {
      const pid = ctx.safePlayerId(playerId);
      if (!pid) return socket.emit('live-error', { code: 'noid' });
      if (!run) return socket.emit('live-error', { code: 'closed' });
      if (!eligible(run.sid, pid)) return socket.emit('live-error', { code: 'notqualified' });
      const late = run.status !== 'lobby';
      if (late && !(run.sid === 'q' && run.cur < LATE_Q) && !run.players.has(pid)) return socket.emit('live-error', { code: 'late' });
      let p = run.players.get(pid);
      if (!p) { p = { pid, name: ctx.sanitizeName(name, 'Anonyme'), score: 0, correct: 0, time: 0, rank: 0, lastDelta: 0, portrait: ctx.portraitOf(pid, name) }; run.players.set(pid, p); }
      sockPid.set(socket.id, pid); specs.delete(socket.id); socket.join('live');
      socket.emit('live-joined', { sid: run.sid, name: p.name });
      snapshot(socket, pid);
    });
    socket.on('live-watch', ({ playerId, mode } = {}) => {
      const pid = ctx.safePlayerId(playerId);
      sockPid.set(socket.id, pid || ('g' + socket.id)); specs.add(socket.id); socket.join('live');
      socket.emit('live-watching', { mode: mode === 'all' ? 'all' : 'remaining', sid: run ? run.sid : null });
      socket.emit('live-info', info(pid));
      snapshot(socket, null);
    });
    socket.on('live-leave', () => {
      const pid = sockPid.get(socket.id);
      if (run && run.status === 'lobby' && pid && !specs.has(socket.id)) run.players.delete(pid);
      sockPid.delete(socket.id); specs.delete(socket.id); socket.leave('live');
    });
    socket.on('live-answer', ({ num, idx: i } = {}) => {
      if (!run || run.status !== 'question' || specs.has(socket.id)) return;
      const pid = sockPid.get(socket.id); if (!pid || !run.players.has(pid)) return;
      if (Number(num) !== run.cur + 1) return;
      const k = Math.floor(Number(i)); if (!(k >= 0 && k < 4)) return;
      const now = Date.now(); if (now > run.qEnd + 400) return;
      const first = !run.ans.has(pid);
      run.ans.set(pid, { idx: k, at: now });
      if (first) { run.feed.push(run.players.get(pid).name); socket.emit('live-ack', { num: Number(num), idx: k }); }
      if (run.ans.size >= run.players.size && run.qEnd - now > 3000) { clearTimeout(run.timer); run.qEnd = now + 3000; run.timer = setTimeout(reveal, 3000); io.to('live').emit('live-countdown', { endAt: run.qEnd }); }
    });
    socket.on('disconnect', () => { sockPid.delete(socket.id); specs.delete(socket.id); });
  }

  // ── Admin ──
  function admin(body) {
    body = body || {};
    if (body.cfg) {
      const c = body.cfg;
      if (c.lobbyMin != null) cfg.lobbyMin = Math.max(1, Math.min(60, +c.lobbyMin || 5));
      if (c.prize) cfg.prize = { fr: String(c.prize.fr || '').slice(0, 200), en: String(c.prize.en || '').slice(0, 200) };
      if (c.rewards) [1, 2, 3].forEach(k => { if (c.rewards[k] != null) cfg.rewards[k] = Math.max(0, Math.min(100000, Math.floor(+c.rewards[k] || 0))); });
      if (Array.isArray(c.sessions)) c.sessions.forEach(u => {
        const s = sess(u.id); if (!s || state.done[s.id] || (run && run.sid === s.id && run.status !== 'lobby')) return;
        if (u.start && !isNaN(Date.parse(u.start))) s.start = u.start;
        if (u.qualify != null) s.qualify = Math.max(1, Math.floor(+u.qualify || 1));
        if (u.themeQ != null) s.themeQ = Math.max(0, Math.min(30, Math.floor(+u.themeQ)));
        if (u.flagQ != null) s.flagQ = Math.max(0, Math.min(20, Math.floor(+u.flagQ)));
        if (u.timeMs != null) s.timeMs = Math.max(5000, Math.min(60000, Math.floor(+u.timeMs)));
        if (u.cancelled != null) s.cancelled = !!u.cancelled;
      });
      saveCfg();
    }
    if (body.action === 'reset') { if (run) { clearTimeout(run.timer); clearInterval(run.prog); run = null; } state = { done: {}, used: [], champion: null, reminded: {} }; saveState(); }
    if (body.action === 'reset-used') { state.used = []; saveState(); }
    if (body.action === 'abort' && run) { clearTimeout(run.timer); clearInterval(run.prog); io.to('live').emit('live-error', { code: 'aborted' }); run = null; }
    phase();
    return { cfg, done: Object.fromEntries(Object.entries(state.done).map(([k, v]) => [k, { players: v.players, qualified: v.qualified.length, top: v.ranking.slice(0, 3) }])), champion: state.champion, active: run ? { sid: run.sid, status: run.status, players: run.players.size } : null, usedCount: state.used.length };
  }
  return { load, start, attach, admin, info };
};
