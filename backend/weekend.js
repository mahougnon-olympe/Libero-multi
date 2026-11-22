// ── Week-end du 28 nov. 2026 : Defi du robot difficile + Week-end des duels ──────
// Samedi 28 nov. 00:00 au lundi 30 nov. 00:00 (heure du Benin).
// - Defi du robot : chaque victoire contre le robot DIFFICILE (echecs, dames, Puissance 4) tamponne une
//   case de la carte de 5 cases ; carte pleine = 300 Libs, payes une seule fois.
// - Duels : le dimanche seulement, un duel gagne contre un ami avec une mise rapporte un bonus de 20 % de la
//   mise de l'adversaire, paye par le site (plafond 100 Libs par duel, 500 Libs par joueur sur le week-end).
// Le serveur l'alimente avec `weekend.event(pid, {...})` (parties) et `weekend.duelWin(...)` (mises).
const CFG = {
  edition: '2026-11-28',
  start: '2026-11-28T00:00:00+01:00',
  duelStart: '2026-11-29T00:00:00+01:00',
  end: '2026-11-30T00:00:00+01:00',
  slots: 5, cardLibs: 300,
  pct: 20, perDuelCap: 100, weekendCap: 500,
};
const BOT_GAMES = ['chess', 'checkers', 'connect4'];

module.exports = function createWeekend(ctx) {
  const { io } = ctx;
  const cfg = Object.assign({}, CFG);
  if (process.env.WK_START) cfg.start = process.env.WK_START;
  if (process.env.WK_DUEL_START) cfg.duelStart = process.env.WK_DUEL_START;
  if (process.env.WK_END) cfg.end = process.env.WK_END;
  const offset = Number(process.env.WK_NOW_OFFSET || 0);
  const now = () => Date.now() + offset;
  const T0 = () => Date.parse(cfg.start), TD = () => Date.parse(cfg.duelStart), T1 = () => Date.parse(cfg.end);
  let st = { edition: cfg.edition, players: {}, ann: {} };
  let saveT = null;
  const save = () => { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { ctx.saveConfig('wk_state', st); } catch (_) {} }, 1500); };
  const phase = () => { const t = now(); return t < T0() ? 'before' : t < T1() ? 'live' : 'ended'; };
  const duelLive = () => { const t = now(); return t >= TD() && t < T1(); };
  function player(pid, create) {
    let p = st.players[pid];
    if (!p && create) { p = st.players[pid] = { wins: [], libs: 0, duel: 0, full: false }; save(); }
    return p;
  }
  function view(pid) {
    const out = { phase: phase(), duelLive: duelLive(), now: now(), start: T0(), duelStart: TD(), end: T1(),
      slots: cfg.slots, cardLibs: cfg.cardLibs, pct: cfg.pct, perDuelCap: cfg.perDuelCap, weekendCap: cfg.weekendCap };
    const p = pid ? st.players[pid] : null;
    out.wins = p ? p.wins.slice() : []; out.full = !!(p && p.full); out.libs = p ? p.libs : 0; out.duel = p ? p.duel : 0;
    return out;
  }
  const named = pid => { const e = pid && ctx.getEntry(pid); return !!(e && e.name && e.name !== 'Anonyme'); };

  // Fin d'une partie : seule une victoire contre le robot difficile compte.
  function event(pid, e) {
    try {
      if (!pid || !e || phase() !== 'live' || e.k !== 'played') return;
      if (!(e.won && e.humans === 1 && e.diff === 'hard' && BOT_GAMES.includes(e.game))) return;
      if (!named(pid)) return;
      const p = player(pid, true);
      if (p.wins.length >= cfg.slots) return;
      p.wins.push(e.game);
      let libs = 0, fullNow = false;
      if (p.wins.length >= cfg.slots && !p.full) { p.full = true; fullNow = true; libs = cfg.cardLibs; p.libs += libs; ctx.credit(pid, libs); }
      save();
      ctx.emitTo(pid, 'wk-event', { type: 'stamp', game: e.game, n: p.wins.length, libs, full: fullNow, state: view(pid) });
      if (fullNow && ctx.adminAlert) { try { const en = ctx.getEntry(pid); ctx.adminAlert('Defi du robot', `${en && en.name} a rempli sa carte.`); } catch (_) {} }
    } catch (err) { if (ctx.logError) ctx.logError('weekend.event', err); }
  }

  // Un duel avec mise est gagne : bonus du site (dimanche seulement, contre un ami).
  function duelWin(winnerPid, otherStake) {
    try {
      if (!winnerPid || !duelLive() || !(otherStake > 0) || !named(winnerPid)) return 0;
      const p = player(winnerPid, true);
      const room = Math.max(0, cfg.weekendCap - p.duel);
      const bonus = Math.min(cfg.perDuelCap, Math.round(otherStake * cfg.pct / 100), room);
      if (bonus <= 0) return 0;
      p.duel += bonus; p.libs += bonus; ctx.credit(winnerPid, bonus); save();
      ctx.emitTo(winnerPid, 'wk-event', { type: 'duel', bonus, state: view(winnerPid) });
      return bonus;
    } catch (err) { if (ctx.logError) ctx.logError('weekend.duelWin', err); return 0; }
  }

  // ── Annonces : debut samedi, duels dimanche matin (jamais entre 22 h et 8 h) ──
  const MSG = {
    start: [['Le Défi du robot difficile commence !', 'Bats le robot difficile 5 fois ce week-end : 300 Libs à la carte pleine.'], ['The hard bot challenge starts!', 'Beat the hard bot 5 times this weekend: 300 Libs for a full card.']],
    duel: [['Week-end des duels : dernier jour', 'Aujourd\'hui, chaque mise gagnée contre un ami rapporte +20 % de bonus.'], ['Duel weekend: last day', 'Today every stake won against a friend earns a +20% bonus.']],
  };
  function announce(kind) {
    if (st.ann[kind]) return;
    const h = ctx.beninHour ? ctx.beninHour() : 12; if (h >= 22 || h < 8) return;
    try { ctx.pushAll(MSG[kind][0], MSG[kind][1]); } catch (_) {}
    st.ann[kind] = true; save();
  }
  let sig = null;
  function tick() {
    const s = phase() + (duelLive() ? ':duel' : '');
    if (sig !== null && sig !== s) io.emit('wk-changed'); sig = s;
    if (phase() === 'live') { announce('start'); if (duelLive()) announce('duel'); }
  }

  function attach(socket) {
    socket.on('wk-get', ({ playerId } = {}) => { const pid = ctx.safePlayerId(playerId); socket.emit('wk-state', view(pid)); });
  }
  function load(saved) { if (saved && typeof saved === 'object' && saved.edition === cfg.edition) st = Object.assign(st, saved); }
  function start() { setInterval(tick, 20_000); setTimeout(tick, 5000); }
  function admin(action) {
    if (action === 'reset') { st = { edition: cfg.edition, players: {}, ann: {} }; save(); io.emit('wk-changed'); return { ok: true }; }
    const ps = Object.values(st.players);
    return { ok: true, phase: phase(), duelLive: duelLive(), players: ps.length, full: ps.filter(p => p.full).length,
      stamps: ps.reduce((s, p) => s + p.wins.length, 0), libsPaid: ps.reduce((s, p) => s + p.libs, 0), duelBonusPaid: ps.reduce((s, p) => s + p.duel, 0) };
  }
  return { attach, load, start, event, duelWin, view, admin, phase, tick, _st: () => st };
};
