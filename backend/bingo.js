// ── Bingo Libero : un week-end, une grille de 9 objectifs par joueur ─────────────
// Du samedi 14 nov. 2026 00:00 au lundi 16 nov. 00:00 (heure du Benin). Chaque joueur recoit SA grille (tiree
// au hasard dans une reserve), ses objectifs se valident tout seuls pendant qu'il joue, chaque ligne rapporte
// 150 Libs (une seule fois) et la grille complete 1000 Libs. Moteur serveur : server.js l'alimente avec
// `bingo.event(pid, {...})` aux endroits ou le jeu sait deja ce qui s'est passe.
const crypto = require('crypto');

const CFG = {
  edition: '2026-11-14',
  start: '2026-11-14T00:00:00+01:00',
  end: '2026-11-16T00:00:00+01:00',
  line: 150, full: 1000,
};
// Reserve d'objectifs. `n` = nombre de fois, `m` = fonction qui dit si un evenement compte.
// Evenements : played {game, humans, won, friend, diff}, quiz {score}, score {game, score}, friend, giftFriend, word {tries}
const POOL = [
  { id: 'ludoWin',    n: 1, m: e => e.k === 'played' && e.game === 'ludo' && e.won && e.humans >= 2 },
  { id: 'word3',      n: 1, m: e => e.k === 'word' && e.tries >= 1 && e.tries <= 3 },
  { id: 'giftFriend', n: 1, m: e => e.k === 'giftFriend' },
  { id: 'hardBot',    n: 1, m: e => e.k === 'played' && ['chess', 'checkers', 'connect4'].includes(e.game) && e.humans === 1 && e.won && e.diff === 'hard' },
  { id: 'uno3',       n: 3, m: e => e.k === 'played' && e.game === 'uno' && e.humans >= 2 },
  { id: 'quiz8',      n: 1, m: e => e.k === 'quiz' && e.score >= 8 },
  { id: 'snake50',    n: 1, m: e => e.k === 'score' && e.game === 'snake' && e.score >= 50 },
  { id: 'addFriend',  n: 1, m: e => e.k === 'friend' },
  { id: 'friendWin',  n: 1, m: e => e.k === 'played' && ['chess', 'checkers', 'connect4', 'tictactoe', 'ludo'].includes(e.game) && e.won && e.friend },
  { id: 'chessEnd',   n: 1, m: e => e.k === 'played' && e.game === 'chess' },
  { id: 'flagsPlay',  n: 1, m: e => e.k === 'played' && e.game === 'flags' },
  { id: 'checkersWin',n: 1, m: e => e.k === 'played' && e.game === 'checkers' && e.won },
  { id: 'connect4Win',n: 1, m: e => e.k === 'played' && e.game === 'connect4' && e.won },
  { id: 'tttWin',     n: 1, m: e => e.k === 'played' && e.game === 'tictactoe' && e.won },
  { id: 'luffy',      n: 1, m: e => e.k === 'score' && e.game === 'luffy' && e.score >= 20 },
];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

module.exports = function createBingo(ctx) {
  const { io } = ctx;
  let cfg = Object.assign({}, CFG);
  if (process.env.BINGO_START) cfg.start = process.env.BINGO_START;
  if (process.env.BINGO_END) cfg.end = process.env.BINGO_END;
  const offset = Number(process.env.BINGO_NOW_OFFSET || process.env.HK_NOW_OFFSET || 0);
  const now = () => Date.now() + offset;
  const T0 = () => Date.parse(cfg.start), T1 = () => Date.parse(cfg.end);
  let st = { edition: cfg.edition, players: {}, ann: {} };
  let saveT = null;
  const save = () => { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { ctx.saveConfig('bingo_state', st); } catch (_) {} }, 1500); };
  const phase = () => { const t = now(); return t < T0() ? 'before' : t < T1() ? 'live' : 'ended'; };

  // Grille de ce joueur : 9 objectifs tires de facon stable (meme grille a chaque appel et apres un redemarrage).
  const SOCIAL = ['ludoWin', 'giftFriend', 'uno3', 'addFriend', 'friendWin'];   // il faut d'autres joueurs
  function gridFor(pid) {
    // 6 objectifs qu'on peut faire seul + 3 qui demandent d'autres joueurs, tires et ranges de facon stable.
    const seed = crypto.createHash('sha256').update(cfg.edition + ':' + pid).digest();
    let k = 0; const rnd = n => seed[k++ % seed.length] % n;
    const pick = (ids, n) => { const a = ids.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(rnd(a.length), 1)[0]); return out; };
    const solo = POOL.map(o => o.id).filter(id => !SOCIAL.includes(id));
    const g = pick(solo, 6).concat(pick(SOCIAL, 3));
    for (let i = g.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = g[i]; g[i] = g[j]; g[j] = t; }
    return g;
  }
  function player(pid, create) {
    let p = st.players[pid];
    if (!p && create) { p = st.players[pid] = { grid: gridFor(pid), prog: {}, done: [], lines: [], full: false, libs: 0, at: now() }; save(); }
    return p;
  }
  const objective = id => POOL.find(o => o.id === id);
  function view(pid) {
    const ph = phase(), p = pid && ph !== 'before' ? player(pid, true) : null;
    const out = { phase: ph, now: now(), start: T0(), end: T1(), line: cfg.line, full: cfg.full };
    if (p) {
      out.grid = p.grid.map((id, i) => { const o = objective(id); return { id, n: o.n, p: Math.min(o.n, p.prog[id] || 0), done: p.done.includes(id) }; });
      out.lines = p.lines.slice(); out.fullDone = !!p.full; out.libs = p.libs;
    }
    return out;
  }
  function lineDone(p, L) { return L.every(i => p.done.includes(p.grid[i])); }

  // Un evenement de jeu arrive : on avance les objectifs concernes, puis on paie les lignes et la grille.
  function event(pid, e) {
    try {
      if (!pid || phase() !== 'live' || !e) return;
      const ent = ctx.getEntry(pid); if (!ent || !ent.name || ent.name === 'Anonyme') return;
      const p = player(pid, true), gained = [];
      for (const id of p.grid) {
        if (p.done.includes(id)) continue;
        const o = objective(id);
        if (!o.m(e)) continue;
        p.prog[id] = (p.prog[id] || 0) + 1;
        if (p.prog[id] >= o.n) { p.done.push(id); gained.push(id); }
        else ctx.emitTo(pid, 'bingo-event', { type: 'step', id, p: p.prog[id], n: o.n });
      }
      if (!gained.length) { if (e.k) save(); return; }
      let libs = 0; const newLines = [];
      LINES.forEach((L, li) => { if (!p.lines.includes(li) && lineDone(p, L)) { p.lines.push(li); newLines.push(li); libs += cfg.line; } });
      let fullNow = false;
      if (!p.full && p.done.length >= 9) { p.full = true; fullNow = true; libs += cfg.full; }
      p.libs += libs;
      if (libs > 0) ctx.credit(pid, libs);
      save();
      ctx.emitTo(pid, 'bingo-event', { type: 'goal', ids: gained, lines: newLines, libs, full: fullNow, state: view(pid) });
      if (fullNow && ctx.adminAlert) { try { ctx.adminAlert('Bingo complet', `${ent.name} a rempli sa grille de Bingo.`); } catch (_) {} }
    } catch (err) { if (ctx.logError) ctx.logError('bingo.event', err); }
  }

  // ── Annonces : debut samedi, rappel dimanche soir (jamais entre 22 h et 8 h) ──
  const MSG = {
    start: [['Le Bingo Libero commence !', 'Ta grille de 9 objectifs t\'attend. 150 Libs par ligne, 1000 Libs la grille.'], ['Libero Bingo starts!', 'Your 9-goal card is waiting. 150 Libs per line, 1000 Libs for the full card.']],
    last: [['Dernières heures du Bingo', 'Il reste quelques heures pour finir ta grille avant lundi.'], ['Last hours of Bingo', 'A few hours left to finish your card before Monday.']],
  };
  function announce(kind) {
    if (st.ann[kind]) return;
    const h = ctx.beninHour ? ctx.beninHour() : 12; if (h >= 22 || h < 8) return;
    try { ctx.pushAll(MSG[kind][0], MSG[kind][1]); } catch (_) {}
    st.ann[kind] = true; save();
  }
  let sig = null;
  function tick() {
    const ph = phase(); if (sig !== null && sig !== ph) io.emit('bingo-changed'); sig = ph;
    if (ph === 'live') { announce('start'); if (now() >= T1() - 8 * 3600_000 && now() < T1() - 2 * 3600_000) announce('last'); }
  }

  function attach(socket, allow) {
    socket.on('bingo-get', ({ playerId } = {}) => { const pid = ctx.safePlayerId(playerId); socket.emit('bingo-state', view(pid)); });
    // Le Mot du jour se joue dans le navigateur : il nous dit en combien d'essais. Une fois par jour et par joueur.
    socket.on('bingo-word', ({ playerId, tries } = {}) => {
      if (!allow('bingoword', 6, 60_000)) return;
      const pid = ctx.safePlayerId(playerId); tries = Math.floor(Number(tries));
      if (!pid || !(tries >= 1 && tries <= 6) || phase() !== 'live') return;
      const p = player(pid, true), day = new Date(now() + 3600_000).toISOString().slice(0, 10);
      if (p.wordDay === day) return;
      p.wordDay = day; save();
      event(pid, { k: 'word', tries });
    });
  }
  function load(saved) { if (saved && typeof saved === 'object' && saved.edition === cfg.edition) st = Object.assign(st, saved); }
  function start() { setInterval(tick, 20_000); setTimeout(tick, 4500); }
  function admin(action) {
    if (action === 'reset') { st = { edition: cfg.edition, players: {}, ann: {} }; save(); io.emit('bingo-changed'); return { ok: true }; }
    const n = Object.keys(st.players).length, ps = Object.values(st.players);
    return { ok: true, phase: phase(), players: n, withLine: ps.filter(p => p.lines.length).length, full: ps.filter(p => p.full).length, libsPaid: ps.reduce((s, p) => s + p.libs, 0) };
  }
  return { attach, load, start, event, view, admin, phase, tick, _st: () => st, POOL, LINES };
};
