// ── Quiz en direct : tournoi en 3 sessions (quart, demi, finale) ─────────────
// Moteur serveur pur : la planification, les manches (culture + drapeaux), les points,
// les qualifications et les spectateurs. server.js lui donne ses outils via `ctx`.
const liveBank = require('./trivia-live');
const flagsGame = require('./game-flags');

const DEFAULT_CFG = {
  lobbyMin: 10,                        // la salle ouvre N minutes avant
  prize: { fr: '', en: '' },           // texte du prix du champion (vide = a annoncer)
  rewards: { 1: 5000, 2: 3000, 3: 1500 },       // Libs verses aux trois premiers de la finale
  sessions: [
    { id: 'q', start: '2026-10-17T18:00:00+01:00', level: 'medium',  themeQ: 10, flagQ: 5, flagLevel: 'easy',   timeMs: 15000, qualify: 50 },
    { id: 's', start: '2026-10-18T15:00:00+01:00', level: 'hard',    themeQ: 10, flagQ: 5, flagLevel: 'medium', timeMs: 15000, qualify: 10 },
    { id: 'f', start: '2026-10-18T19:00:00+01:00', level: 'extreme', themeQ: 12, flagQ: 8, flagLevel: 'hard',   timeMs: 10000, qualify: 1 },
  ],
};
const REVEAL_MS = 5500;                // la correction reste a l'ecran (comme le quiz de culture generale)
const RANK_MS = 3800;                  // puis le classement s'anime (sauf apres la derniere question)
const LATE_Q = 3;
const DRAW_LEAD_MS = 40000;            // le tirage des themes se fait 40 s avant le depart, devant tout le monde                      // on peut entrer au quart jusqu'a la question 3

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

module.exports = function createLive(ctx) {
  const { io } = ctx;
  let cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  let state = { done: {}, used: [], champion: null };
  let run = null;
  const sockPid = new Map();           // socket.id -> playerId
  const sockRun = new Map();           // socket.id -> session (reelle ou test) suivie par ce socket
  const tests = new Map();             // code -> session de test lancee par l'organisateur
  const specs = new Set();             // socket.id des spectateurs
  let tickT = null;

  const startMs = s => Date.parse(s.start);
  const idx = id => cfg.sessions.findIndex(s => s.id === id);
  const sess = id => cfg.sessions.find(s => s.id === id);

  function load(c, s) {
    if (c && c.lobbyMin === 5) c.lobbyMin = 10;
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
  function info(pid, tr) {
    if (tr) {
      const s = tr.s;
      return { now: Date.now(), lobbyMin: cfg.lobbyMin, test: true, code: tr.code, prize: cfg.prize, champion: null, specs: countSpecs(tr), active: { sid: tr.sid, status: tr.status },
        sessions: [{ id: s.id, start: tr.startAt, level: s.level, themeQ: s.themeQ, flagQ: s.flagQ, timeMs: s.timeMs, qualify: s.qualify, status: tr.status === 'lobby' ? 'lobby' : 'live', players: tr.players.size, top: [], qualified: 0, me: { eligible: true, joined: !!(pid && tr.players.has(pid)), rank: null, score: null, qualified: false } }] };
    }
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
  const BOT_NAMES = ['Koffi', 'Maya', 'Ibrahim', 'Sènami', 'Dossou', 'Léa', 'Yao', 'Aïcha', 'Tom', 'Zoé', 'Fatou', 'Moussa', 'Awa', 'Kévin', 'Nadia', 'Jonas', 'Esther', 'Bilal', 'Clarisse', 'Rodrigue'];
  function buildQuestions(r) {
    const s = r.s, used = new Set(r.test ? r.usedTest : state.used);
    const themes = (r.themes && r.themes.length ? r.themes : ['benin']).slice();
    const order = { medium: ['medium', 'hard', 'extreme'], hard: ['hard', 'extreme', 'medium'], extreme: ['extreme', 'hard', 'medium'] }[s.level] || ['medium'];
    const pools = {};
    for (const t of themes) {
      pools[t] = [];
      for (const lv of order) { const arr = (liveBank.LIVE[t] && liveBank.LIVE[t][lv]) || []; arr.forEach((q, i) => { const id = `live:${t}:${lv}:${i}`; if (!used.has(id)) pools[t].push({ id, t, lv, q }); }); if (pools[t].length >= 6) break; }
      pools[t] = shuffle(pools[t]);
    }
    const out = []; let guard = 0;
    while (out.length < s.themeQ && guard++ < 500) {
      let added = false;
      for (const t of themes) { if (out.length >= s.themeQ) break; const e = pools[t].shift(); if (e) { out.push(e); added = true; } }
      if (!added) break;
    }
    const themed = shuffle(out).map(e => {
      used.add(e.id);
      const ch = shuffle(e.q.fc.map((f, i) => ({ fr: f, en: e.q.ec[i], ok: i === e.q.a })));
      return { kind: 'theme', theme: e.t, q: { fr: e.q.f, en: e.q.e }, c: ch.map(x => ({ fr: x.fr, en: x.en })), a: ch.findIndex(x => x.ok), id: e.id };
    });
    const fl = flagsGame.pickQuestions({ amount: s.flagQ, level: s.flagLevel || 'easy' }).map(f => {
      const ch = shuffle(f.choices); return { kind: 'flag', theme: 'flag', flag: f.flag, c: ch.map(code => ({ code })), a: ch.indexOf(f.correct), id: 'flag:' + f.flag };
    });
    if (r.test) r.usedTest = [...used]; else { state.used = [...used]; saveState(); }
    return themed.concat(fl);
  }
  function drawThemes() { return ['benin'].concat(shuffle(liveBank.DRAW_THEMES).slice(0, 3)); }

  // ── Cycle d'une session (reel ou test) ──
  const room = r => r.room;
  const emit = (r, ev, d) => io.to(r.room).emit(ev, d);
  function newRun(s, o) {
    return Object.assign({ sid: s.id, s: Object.assign({}, s), status: 'lobby', startAt: 0, players: new Map(), questions: [], cur: -1, qStart: 0, qEnd: 0, ans: new Map(), timer: null, prog: null, feed: [], themes: null, drawn: false, room: 'live', test: false, usedTest: [] }, o || {});
  }
  function openLobby(s) {
    const start = Math.max(startMs(s), Date.now() + 15000);
    run = newRun(s, { startAt: start });
    phase();
  }
  function doDraw(r) {
    if (r.drawn) return;
    r.themes = drawThemes(); r.drawn = true;
    emit(r, 'live-draw', { sid: r.sid, themes: r.themes, flagQ: r.s.flagQ, now: Date.now() });
  }
  function begin(r) {
    if (r.status !== 'lobby') return;
    if (!r.players.size) { r.startAt = Date.now() + 120000; return; } // personne : on reporte plutot que de jouer a vide
    if (!r.drawn) doDraw(r);
    r.questions = buildQuestions(r);
    r.status = 'question'; r.cur = -1;
    if (!r.test) phase();
    emit(r, 'live-start', { sid: r.sid, total: r.questions.length, players: r.players.size });
    setTimeout(() => nextQ(r), 4000);
  }
  function qPayload(r) {
    const q = r.questions[r.cur];
    return { sid: r.sid, num: r.cur + 1, total: r.questions.length, kind: q.kind, theme: q.theme, q: q.q || null, flag: q.flag || null, c: q.c, endAt: r.qEnd, now: Date.now(), timeMs: r.s.timeMs, newManche: q.kind === 'flag' && (r.cur === 0 || r.questions[r.cur - 1].kind !== 'flag'), top: ranking(r).slice(0, 3).map(p => ({ name: p.name, score: p.score })) };
  }
  function nextQ(r) {
    if (!alive(r)) return;
    r.cur++;
    if (r.cur >= r.questions.length) return finish(r);
    r.status = 'question'; r.ans = new Map(); r.qStart = Date.now() + 600; r.qEnd = r.qStart + r.s.timeMs;
    emit(r, 'live-q', qPayload(r));
    r.timer = setTimeout(() => reveal(r), r.qEnd - Date.now());
    r.prog = setInterval(() => { if (!alive(r) || r.status !== 'question') return; emit(r, 'live-answered', { n: r.ans.size, total: r.players.size, feed: r.feed.splice(0, 8) }); }, 1000);
    // les robots (tests) repondent comme des humains : a des moments varies, avec une chance de se tromper
    const q = r.questions[r.cur], num = r.cur + 1;
    for (const p of r.players.values()) {
      if (!p.bot) continue;
      if (Math.random() < 0.04) continue; // un robot distrait ne repond pas
      const delay = 1500 + Math.random() * (r.s.timeMs * 0.8);
      setTimeout(() => {
        if (!alive(r) || r.status !== 'question' || r.cur + 1 !== num) return;
        const ok = Math.random() < p.skill;
        const idx = ok ? q.a : [0, 1, 2, 3].filter(i => i !== q.a)[Math.floor(Math.random() * 3)];
        r.ans.set(p.pid, { idx, at: Date.now() }); r.feed.push(p.name);
        if (r.ans.size >= r.players.size && r.qEnd - Date.now() > 3000) shorten(r);
      }, delay);
    }
  }
  function shorten(r) { clearTimeout(r.timer); r.qEnd = Date.now() + 3000; r.timer = setTimeout(() => reveal(r), 3000); emit(r, 'live-countdown', { endAt: r.qEnd }); }
  const alive = r => !!r && (r === run || (r.test && tests.has(r.code)));
  function reveal(r) {
    if (!alive(r) || r.status !== 'question') return;
    clearTimeout(r.timer); clearInterval(r.prog);
    r.status = 'reveal';
    const q = r.questions[r.cur], total = r.s.timeMs;
    const counts = q.c.map(() => 0); let n = 0;
    for (const [pid, a] of r.ans) {
      const p = r.players.get(pid); if (!p) continue;
      if (a.idx >= 0) { counts[a.idx]++; n++; }
      p.lastDelta = 0; p.lastOk = false; p.lastPick = a.idx;
      if (a.idx >= 0 && a.idx === q.a) {
        const el = Math.min(total, Math.max(0, a.at - r.qStart));
        const pts = Math.round(1000 - 500 * (el / total));
        p.score += pts; p.correct++; p.time += el; p.lastDelta = pts; p.lastOk = true;
        p.streak = (p.streak || 0) + 1;
      } else p.streak = 0;
    }
    for (const [pid, p] of r.players) if (!r.ans.has(pid)) { p.lastDelta = 0; p.lastOk = false; p.lastPick = -1; p.streak = 0; }
    const rank = ranking(r);
    const pct = counts.map(c => (n ? Math.round(c / n * 100) : 0));
    emit(r, 'live-reveal', { sid: r.sid, num: r.cur + 1, a: q.a, pct, answered: n, total: r.players.size, board: rank.slice(0, 7).map(x => ({ name: x.name, score: x.score, delta: x.lastDelta, portrait: x.portrait || null })), last: r.cur + 1 >= r.questions.length });
    for (const [sid, pid] of sockPid) {
      if (sockRun.get(sid) !== r) continue;
      const p = r.players.get(pid); if (!p || specs.has(sid)) continue;
      io.to(sid).emit('live-me', { rank: p.rank, score: p.score, delta: p.lastDelta, ok: p.lastOk, pick: p.lastPick, streak: p.streak || 0, total: r.players.size });
    }
    r.timer = setTimeout(() => nextQ(r), r.cur + 1 >= r.questions.length ? REVEAL_MS : REVEAL_MS + RANK_MS);
  }
  function ranking(r) {
    const arr = [...r.players.values()].sort((a, b) => b.score - a.score || a.time - b.time || a.name.localeCompare(b.name));
    arr.forEach((p, i) => { p.rank = i + 1; });
    return arr;
  }
  function finish(r) {
    clearTimeout(r.timer); clearInterval(r.prog);
    const s = r.s, rank = ranking(r);
    const qualified = s.qualify ? rank.filter(p => p.score > 0).slice(0, s.qualify).map(p => p.pid) : [];
    const final = idx(s.id) === cfg.sessions.length - 1;
    const next = r.test ? null : nextSession(s.id);
    if (!r.test) {
      state.done[s.id] = {
        at: Date.now(), players: rank.length, qualified,
        ranking: rank.slice(0, 200).map(p => ({ pid: p.pid, name: p.name, score: p.score, rank: p.rank, time: p.time, portrait: p.portrait || null })),
      };
      if (final && rank[0]) {
        state.champion = { pid: rank[0].pid, name: rank[0].name, portrait: rank[0].portrait || null, at: Date.now() };
        [1, 2, 3].forEach(k => { const w = rank[k - 1], amt = Math.floor(+cfg.rewards[k] || 0); if (w && amt > 0) ctx.credit(w.pid, amt, 'live'); });
      }
      saveState();
      for (const p of rank) { if (!p.bot) { try { ctx.xp(p.pid, 20 + 3 * p.correct); } catch {} } }
    }
    const top = rank.slice(0, 8).map(p => ({ name: p.name, score: p.score, portrait: p.portrait || null }));
    emit(r, 'live-end', { sid: s.id, top, players: rank.length, qualified: qualified.length, final, champion: final ? (r.test ? { name: rank[0] && rank[0].name, portrait: null } : state.champion) : null, next, test: r.test });
    for (const [sid, pid] of sockPid) {
      if (sockRun.get(sid) !== r) continue;
      const p = r.players.get(pid); if (!p || specs.has(sid)) continue;
      io.to(sid).emit('live-result', { sid: s.id, rank: p.rank, score: p.score, correct: p.correct, total: rank.length, qualified: qualified.includes(pid), final, reward: !r.test && final && p.rank <= 3 ? Math.floor(+cfg.rewards[p.rank] || 0) : 0, next, test: r.test });
    }
    if (r.test) setTimeout(() => { tests.delete(r.code); }, 120000);
    else { run = null; phase(); }
    r.status = 'done';
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
  const rnd = n => Math.floor(Math.random() * n);
  function randPortrait() { return { face: rnd(5), skin: [2, 4, 6, 8, 10, 12][rnd(6)], brows: rnd(4), eyes: rnd(4), mouth: rnd(4), marks: rnd(3), beard: rnd(5) < 3 ? 0 : rnd(4), hair: rnd(8), hairCol: rnd(8), acc: 0, top: rnd(4), topCol: rnd(8), bg: rnd(6), frame: 0 }; }
  function addBots(r, n) {
    for (let i = 0; i < n && r.botAdded < r.botTotal; i++, r.botAdded++) {
      const k = r.botAdded, base2 = BOT_NAMES[k % BOT_NAMES.length], nm = k < BOT_NAMES.length ? base2 : base2 + ' ' + (Math.floor(k / BOT_NAMES.length) + 1);
      r.players.set('bot' + k, { pid: 'bot' + k, bot: true, name: nm, score: 0, correct: 0, time: 0, rank: 0, lastDelta: 0, skill: 0.3 + Math.random() * 0.6, portrait: randPortrait() });
    }
  }
  function launchRun(r) { if (!r || r.status !== 'lobby' || r.launched) return false; r.launched = true; r.startAt = Date.now() + DRAW_LEAD_MS; return true; }
  function tickRun(r) {
    if (r.status !== 'lobby') return;
    if (r.manual && !r.launched) { // attend que l'organisateur lance le quiz depuis le tableau de bord
      if (r.test && r.botAdded < r.botTotal && r.botFrom) addBots(r, Math.max(0, Math.floor((r.botTotal - 2) * Math.min(1, (Date.now() - r.botFrom) / 45000)) + 2 - r.botAdded));
      emit(r, 'live-lobby', { sid: r.sid, n: r.players.size, specs: countSpecs(r), startAt: 0, waiting: true, now: Date.now(), test: r.test, wall: wall(r) });
      return;
    }
    if (r.test && r.botAdded < r.botTotal && r.botFrom) addBots(r, Math.max(0, Math.floor((r.botTotal - 2) * Math.min(1, (Date.now() - r.botFrom) / Math.max(5000, r.startAt - 5000 - r.botFrom))) + 2 - r.botAdded));
    emit(r, 'live-lobby', { sid: r.sid, n: r.players.size, specs: countSpecs(r), startAt: r.startAt, now: Date.now(), test: r.test, wall: wall(r) });
    if (!r.drawn && Date.now() >= r.startAt - DRAW_LEAD_MS) doDraw(r);
    if (Date.now() >= r.startAt) begin(r);
  }
  function wall(r) { const out = []; for (const p of r.players.values()) out.push({ name: p.name, portrait: p.portrait || null }); return out.slice(-24); } // les 24 derniers arrives : on voit les entrees
  function countSpecs(r) { let n = 0; for (const sid of specs) if (sockRun.get(sid) === r) n++; return n; }
  function tick() {
    try {
      remind();
      for (const r of tests.values()) tickRun(r);
      if (run && run.status === 'lobby') tickRun(run);
      else if (!run) {
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
  function snapshot(socket, pid, r) {
    if (!r) return;
    if (r.status === 'lobby') socket.emit('live-lobby', { sid: r.sid, n: r.players.size, specs: countSpecs(r), startAt: r.manual && !r.launched ? 0 : r.startAt, waiting: !!(r.manual && !r.launched), now: Date.now(), test: r.test, wall: wall(r) });
    if (r.drawn) socket.emit('live-draw', { sid: r.sid, themes: r.themes, flagQ: r.s.flagQ, now: Date.now(), replay: false });
    if (r.status === 'question' && r.cur >= 0) socket.emit('live-q', qPayload(r));
    else if (r.status === 'reveal') socket.emit('live-q', Object.assign(qPayload(r), { revealing: true }));
    const p = pid && r.players.get(pid);
    if (p && r.cur >= 0) socket.emit('live-me', { rank: p.rank, score: p.score, delta: p.lastDelta || 0, ok: !!p.lastOk, pick: p.lastPick ?? -1, streak: p.streak || 0, total: r.players.size, quiet: true });
  }
  function target(code) { const c = String(code || '').toUpperCase().trim(); return c ? (tests.get(c) || null) : run; }
  function attach(socket) {
    socket.on('live-get', ({ playerId, code } = {}) => { const pid = ctx.safePlayerId(playerId); const r = code ? tests.get(String(code).toUpperCase().trim()) : null; if (code && !r) return socket.emit('live-error', { code: 'badcode' }); socket.emit('live-info', info(pid, r)); });
    socket.on('live-join', ({ playerId, name, code } = {}) => {
      const pid = ctx.safePlayerId(playerId);
      if (!pid) return socket.emit('live-error', { code: 'noid' });
      const r = target(code);
      if (code && !r) return socket.emit('live-error', { code: 'badcode' });
      if (!r) return socket.emit('live-error', { code: 'closed' });
      if (!r.test && !eligible(r.sid, pid)) return socket.emit('live-error', { code: 'notqualified' });
      const late = r.status !== 'lobby';
      if (late && !r.players.has(pid) && !(r.test || (r.sid === 'q' && r.cur < LATE_Q))) return socket.emit('live-error', { code: 'late' });
      let p = r.players.get(pid);
      if (!p) { p = { pid, name: ctx.sanitizeName(name, 'Anonyme'), score: 0, correct: 0, time: 0, rank: 0, lastDelta: 0, portrait: ctx.portraitOf(pid, name) }; r.players.set(pid, p); }
      leaveRoom(socket);
      if (r.test && !r.botFrom) r.botFrom = Date.now();
      sockPid.set(socket.id, pid); sockRun.set(socket.id, r); specs.delete(socket.id); socket.join(r.room);
      socket.emit('live-joined', { sid: r.sid, name: p.name, test: r.test });
      snapshot(socket, pid, r);
    });
    socket.on('live-watch', ({ playerId, mode, code } = {}) => {
      const pid = ctx.safePlayerId(playerId);
      const r = target(code);
      if (code && !r) return socket.emit('live-error', { code: 'badcode' });
      leaveRoom(socket);
      sockPid.set(socket.id, pid || ('g' + socket.id)); specs.add(socket.id);
      if (r) { if (r.test && !r.botFrom) r.botFrom = Date.now(); sockRun.set(socket.id, r); socket.join(r.room); }
      socket.emit('live-watching', { mode: mode === 'all' ? 'all' : 'remaining', sid: r ? r.sid : null });
      socket.emit('live-info', info(pid, code ? r : null));
      snapshot(socket, null, r);
    });
    socket.on('live-leave', () => {
      const r = sockRun.get(socket.id), pid = sockPid.get(socket.id);
      if (r && r.status === 'lobby' && pid && !specs.has(socket.id)) r.players.delete(pid);
      leaveRoom(socket);
    });
    socket.on('live-answer', ({ num, idx: i } = {}) => {
      const r = sockRun.get(socket.id);
      if (!r || r.status !== 'question' || specs.has(socket.id)) return;
      const pid = sockPid.get(socket.id); if (!pid || !r.players.has(pid)) return;
      if (Number(num) !== r.cur + 1) return;
      const k = Math.floor(Number(i)); if (!(k >= 0 && k < 4)) return;
      const now = Date.now(); if (now > r.qEnd + 400) return;
      const first = !r.ans.has(pid);
      r.ans.set(pid, { idx: k, at: now });
      if (first) { r.feed.push(r.players.get(pid).name); socket.emit('live-ack', { num: Number(num), idx: k }); }
      if (r.ans.size >= r.players.size && r.qEnd - now > 3000) shorten(r);
    });
    socket.on('live-skip', ({ num } = {}) => {
      const r = sockRun.get(socket.id);
      if (!r || r.status !== 'question' || specs.has(socket.id)) return;
      const pid = sockPid.get(socket.id); if (!pid || !r.players.has(pid) || Number(num) !== r.cur + 1) return;
      if (!r.ans.has(pid)) { r.ans.set(pid, { idx: -1, at: Date.now() }); r.feed.push(r.players.get(pid).name); }
      if (r.ans.size >= r.players.size && r.qEnd - Date.now() > 3000) shorten(r);
    });
    socket.on('disconnect', () => leaveRoom(socket, true));
  }
  function leaveRoom(socket, dropped) {
    const r = sockRun.get(socket.id);
    if (r) { try { socket.leave(r.room); } catch {} }
    sockRun.delete(socket.id); sockPid.delete(socket.id); specs.delete(socket.id);
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
    if (body.action === 'test') {
      const base = sess(body.sid) || cfg.sessions[0];
      const o = Object.assign({}, base);
      if (body.timeMs != null) o.timeMs = Math.max(3000, Math.min(60000, Math.floor(+body.timeMs) || o.timeMs));
      if (body.themeQ != null) o.themeQ = Math.max(0, Math.min(30, Math.floor(+body.themeQ)));
      if (body.flagQ != null) o.flagQ = Math.max(0, Math.min(20, Math.floor(+body.flagQ)));
      let code; do { code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join(''); } while (tests.has(code));
      const lobbySec = Math.max(20, Math.min(600, Math.floor(+body.lobbySec) || 60));
      const manual = body.manual !== false;
      const r = newRun(o, { test: true, code, room: 'live-t-' + code, startAt: manual ? 0 : Date.now() + lobbySec * 1000, manual });
      const nb = Math.max(0, Math.min(300, Math.floor(+body.bots) || 0));
      // les robots arrivent un par un pendant l'attente, comme de vrais joueurs (photo de profil comprise)
      r.botTotal = nb; r.botAdded = 0; r.botFrom = 0; // les robots arrivent des qu'un humain est dans la salle, jusqu'a 5 s avant le depart
      addBots(r, Math.min(nb, 2));
      tests.set(code, r);
      return { test: { code, sid: r.sid, bots: nb, startAt: r.startAt, manual } };
    }
    if (body.action === 'launch') {
      let n = 0;
      if (body.code) { if (launchRun(tests.get(String(body.code).toUpperCase()))) n++; }
      else { for (const r of tests.values()) if (launchRun(r)) n++; if (run && run.status === 'lobby' && !run.launched) { run.launched = true; run.startAt = Math.min(run.startAt, Date.now() + DRAW_LEAD_MS); n++; } }
      return { launched: n };
    }
    if (body.action === 'test-stop') { for (const r of tests.values()) { clearTimeout(r.timer); clearInterval(r.prog); io.to(r.room).emit('live-error', { code: 'aborted' }); } tests.clear(); }
    if (body.action === 'abort' && run) { clearTimeout(run.timer); clearInterval(run.prog); io.to('live').emit('live-error', { code: 'aborted' }); run = null; }
    if (body && Object.keys(body).length) phase(); // une simple lecture (tableau de bord) ne previent pas tous les joueurs
    return { cfg, done: Object.fromEntries(Object.entries(state.done).map(([k, v]) => [k, { players: v.players, qualified: v.qualified.length, top: v.ranking.slice(0, 3) }])), champion: state.champion, active: run ? { sid: run.sid, status: run.status, players: run.players.size } : null, usedCount: state.used.length, tests: [...tests.values()].map(r => ({ code: r.code, sid: r.sid, status: r.status, players: r.players.size, startAt: r.startAt, manual: !!r.manual, launched: !!r.launched })) };
  }
  return { load, start, attach, admin, info };
};
