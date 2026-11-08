// ── Evenement « ZyX le grand » : la boutique piratee ─────────────────────────
// Du lundi 9 au vendredi 13 novembre 2026 (heure du Benin). Un hacker a verrouille la boutique
// avec un cadenas a 6 chiffres. Six enigmes donnent les six chiffres. Le premier joueur qui
// ouvre le cadenas recoit un ticket de 6 articles gratuits (non remboursables) et devient
// « maitre de la boutique » jusqu'a son 6e article (ou 7 jours).
// Moteur serveur pur : le code et les reponses ne quittent JAMAIS le serveur. server.js lui
// donne ses outils via `ctx`. Les farces du hacker sont uniquement visuelles (client) : ce module
// ne touche aux Libs, aux achats et aux comptes que par les voies expliquees plus bas.
const crypto = require('crypto');

const DEFAULT_CFG = {
  edition: '2026-11-09',
  start: '2026-11-09T00:00:00+01:00',
  end: '2026-11-13T23:59:59+01:00',
  mult: 1.5,                    // hausse des prix des cosmetiques et des packs (arrondie a 5 Libs)
  ticketSlots: 6,
  ticketDays: 7,
  answerTries: 5, answerWindowMs: 10 * 60_000,   // 5 essais par enigme et par tranche de 10 minutes
  codeTries: 3, codeWindowMs: 60 * 60_000,       // 3 essais de code par heure
  hint1Ms: 15 * 60_000, hint2Ms: 30 * 60_000,    // les indices de Libe se debloquent apres l'ouverture
  enigmas: [
    { id: 'anagram', digit: 4, answers: ['CRAIE'],   release: '2026-11-09T00:00:00+01:00' },
    { id: 'mirror',  digit: 2, answers: ['TROUSSE'], release: '2026-11-09T00:00:00+01:00' },
    { id: 'initials',digit: 3, answers: ['CLEF'],    release: '2026-11-09T00:00:00+01:00' },
    { id: 'path',    digit: 9, answers: ['PORTE'],   release: '2026-11-10T18:00:00+01:00' },
    { id: 'liars',   digit: 1, answers: ['REGLE'],   release: '2026-11-11T18:00:00+01:00' },
    { id: 'caesar',  digit: 6, answers: ['CADENAS'], release: '2026-11-12T18:00:00+01:00' },
  ],
};
// Articles qui ne peuvent PAS etre pris avec le ticket : exclusifs, honorifiques, calendrier Halloween.
const EXCLUDED_PREFIX = ['pframe-live', 'title-live', 'bubble-live'];

function norm(s) { return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 24); }

module.exports = function createHacker(ctx) {
  const { io } = ctx;
  let cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  if (process.env.HK_START) cfg.start = process.env.HK_START;
  if (process.env.HK_END) cfg.end = process.env.HK_END;
  const T0 = () => Date.parse(cfg.start), T1 = () => Date.parse(cfg.end);
  const offset = Number(process.env.HK_NOW_OFFSET || 0);
  const now = () => Date.now() + offset;
  // Etat persistant (un seul document) : joueurs, cadenas ouvert, ticket, fin, annonces deja envoyees.
  let st = { edition: cfg.edition, players: {}, unlocked: null, ticket: null, ended: null, ann: {}, free: {}, paid: {} };
  let saveT = null;
  function save() {
    if (saveT) return;
    saveT = setTimeout(() => { saveT = null; try { ctx.saveConfig('hk_state', st); } catch (_) {} }, 1500);
  }
  const code = () => cfg.enigmas.map(e => e.digit).join('');
  function player(pid) {
    const p = st.players[pid] || (st.players[pid] = { sol: [], tr: {}, ct: [], open: {} });
    return p;
  }
  function phase() {
    const t = now();
    if (t < T0()) return 'before';
    if (st.ended) return 'ended';
    if (st.unlocked) return 'open';
    if (t >= T1()) return 'ended';
    return 'locked';
  }
  const active = () => now() >= T0();                       // les prix restent plus eleves apres l'evenement
  function released(i) { return now() >= Date.parse(cfg.enigmas[i].release); }
  function recent(arr, win) { const t = now(); return (arr || []).filter(x => t - x < win); }

  // ── Prix : hausse de 50 % (arrondie a 5 Libs) des cosmetiques et packs, des le debut ──
  function priceOf(base) {
    base = Math.round(Number(base) || 0);
    if (!active() || base <= 0) return base;
    return Math.max(5, Math.round(base * cfg.mult / 5) * 5);
  }
  // La boutique est fermee tant que le cadenas n'est pas ouvert (dépenses de Libs seulement).
  function shopLocked() { return phase() === 'locked'; }
  // Articles pris avec le ticket : non remboursables. Sinon, on rembourse ce qui a ete paye.
  function isFree(pid, id) { return (st.free[pid] || []).includes(id); }
  function paid(pid, id, price) { (st.paid[pid] || (st.paid[pid] = {}))[id] = price; save(); }
  function refundAmount(pid, id, base) { const p = (st.paid[pid] || {})[id]; return p != null ? p : base; }

  function eligible(c) {
    if (!c || c.honorary || !(c.price > 0)) return false;
    if (EXCLUDED_PREFIX.some(p => String(c.id).startsWith(p))) return false;
    return ctx.canTake ? ctx.canTake(c) : true;
  }

  // ── Vue d'un joueur ───────────────────────────────────────────────────────
  function view(pid) {
    const ph = phase(), p = pid ? player(pid) : { sol: [], tr: {}, ct: [], open: {} }, t = now();
    const tk = st.ticket;
    const out = {
      phase: ph, now: t, start: T0(), end: T1(), mult: active() ? cfg.mult : 1,
      enigmas: cfg.enigmas.map((e, i) => {
        const solved = !!p.sol[i], rel = Date.parse(e.release);
        const used = recent((p.tr || {})[i], cfg.answerWindowMs);
        const opened = (p.open || {})[i] || 0;
        const el = opened ? t - opened : 0;
        return { i, id: e.id, release: rel, open: t >= rel, solved, digit: solved ? e.digit : null,
          left: Math.max(0, cfg.answerTries - used.length), retryAt: used.length >= cfg.answerTries ? Math.min.apply(null, used) + cfg.answerWindowMs : 0,
          hint: !opened ? 0 : el >= cfg.hint2Ms ? 2 : el >= cfg.hint1Ms ? 1 : 0, hintAt: opened ? [opened + cfg.hint1Ms, opened + cfg.hint2Ms] : null };
      }),
      codeLeft: Math.max(0, cfg.codeTries - recent(p.ct, cfg.codeWindowMs).length),
      codeRetryAt: recent(p.ct, cfg.codeWindowMs).length >= cfg.codeTries ? Math.min.apply(null, recent(p.ct, cfg.codeWindowMs)) + cfg.codeWindowMs : 0,
      owner: tk ? { name: tk.name, at: tk.at, used: tk.items.length, slots: cfg.ticketSlots, expiresAt: tk.expiresAt, mine: tk.pid === pid, active: !st.ended } : null,
      unlocked: st.unlocked ? { name: st.unlocked.name, at: st.unlocked.at, tries: st.unlocked.tries, mine: st.unlocked.pid === pid } : null,
      ended: st.ended ? { at: st.ended.at, reason: st.ended.reason } : null,
    };
    if (tk && tk.pid === pid) out.ticket = { items: tk.items.slice(), free: (st.free[pid] || []).slice() };
    return out;
  }
  function pushView(pid) { if (pid && ctx.emitToPlayer) ctx.emitToPlayer(pid, 'hk-state', view(pid)); }
  function broadcast(ev) { io.emit('hk-event', ev); }

  // ── Annonces (notification push a tous, hors 22 h - 8 h) ──────────────────
  const MSG = {
    start:  [['Boutique piratée !', 'ZyX a verrouillé la boutique. Résous ses énigmes et ouvre le cadenas avant vendredi.'], ['Shop hacked!', 'ZyX locked the shop. Solve his riddles and crack the padlock before Friday.']],
    e3:     [['Nouvelle énigme de ZyX', 'Une énigme de plus vient d\'apparaître dans le carnet.'], ['New riddle from ZyX', 'Another riddle just appeared in the notebook.']],
    e4:     [['Nouvelle énigme de ZyX', 'Une énigme de plus vient d\'apparaître dans le carnet.'], ['New riddle from ZyX', 'Another riddle just appeared in the notebook.']],
    e5:     [['Dernière énigme demain', 'Plus qu\'une énigme à découvrir, puis le cadenas.'], ['One more riddle tomorrow', 'One last riddle, then the padlock.']],
    last:   [['Dernier jour !', 'Le cadenas de ZyX se referme pour de bon ce soir à minuit.'], ['Last day!', 'ZyX\'s padlock closes for good tonight at midnight.']],
    unlock: n => [['Le cadenas est ouvert !', `La boutique appartient à ${n}. Elle rouvre, aux nouveaux prix.`], ['The padlock is open!', `The shop belongs to ${n}. It reopens, at the new prices.`]],
    end:    [['La boutique est libérée', 'ZyX a quitté les lieux. Les prix restent plus élevés.'], ['The shop is free', 'ZyX has left. Prices stay higher.']],
    over:   [['Fin du piratage', 'Personne n\'a ouvert le cadenas. ZyX s\'en va et laisse les prix plus élevés.'], ['End of the hack', 'Nobody opened the padlock. ZyX leaves and keeps the prices higher.']],
  };
  function announce(kind, arg) {
    if (st.ann[kind]) return true;
    const h = ctx.beninHour ? ctx.beninHour() : 12;
    if ((h >= 22 || h < 8) && kind !== 'unlock') return false;
    const m = typeof MSG[kind] === 'function' ? MSG[kind](arg) : MSG[kind];
    try { ctx.pushAll(m[0], m[1]); } catch (_) {}
    st.ann[kind] = true; save();
    return true;
  }
  function finish(reason) {
    if (st.ended) return;
    st.ended = { at: now(), reason };
    save();
    broadcast({ type: 'ended', reason });
    io.emit('hk-state-changed');
    announce(reason === 'over' ? 'over' : 'end');
  }
  function tick() {
    const t = now(), ph = phase();
    if (ph === 'before') return;
    if (ph === 'locked' || ph === 'open') {
      if (t >= T0()) announce('start');
      if (ph === 'locked') {
        if (t >= Date.parse(cfg.enigmas[3].release)) announce('e3');
        if (t >= Date.parse(cfg.enigmas[4].release)) announce('e4');
        if (t >= Date.parse(cfg.enigmas[5].release)) announce('e5');
        if (t >= T1() - 8 * 3600_000) announce('last');
      }
    }
    if (ph === 'locked' && t >= T1()) { st.ended = { at: t, reason: 'over' }; save(); broadcast({ type: 'ended', reason: 'over' }); io.emit('hk-state-changed'); announce('over'); }
    if (st.ticket && !st.ended && t >= st.ticket.expiresAt) finish('expired');
  }

  // ── Sockets ───────────────────────────────────────────────────────────────
  function attach(socket, allow) {
    const pidOf = p => ctx.safePlayerId(p);
    socket.on('hk-get', ({ playerId } = {}) => { socket.emit('hk-state', view(pidOf(playerId))); });
    socket.on('hk-open', ({ playerId, i } = {}) => {
      const pid = pidOf(playerId); i = Math.floor(Number(i)); if (!pid || !(i >= 0 && i < 6) || !released(i) || phase() !== 'locked') return;
      const p = player(pid); if (!p.open[i]) { p.open[i] = now(); save(); } socket.emit('hk-state', view(pid));
    });
    socket.on('hk-answer', ({ playerId, i, text } = {}) => {
      if (!allow('hkans', 20, 60_000)) { socket.emit('hk-answer-result', { ok: false, error: 'rate' }); return; }
      const pid = pidOf(playerId); i = Math.floor(Number(i));
      if (!pid || !(i >= 0 && i < 6)) { socket.emit('hk-answer-result', { ok: false, error: 'invalid' }); return; }
      if (phase() !== 'locked') { socket.emit('hk-answer-result', { ok: false, error: 'closed', i }); return; }
      if (!released(i)) { socket.emit('hk-answer-result', { ok: false, error: 'locked', i }); return; }
      const e = ctx.getEntry(pid); if (!e || !e.name || e.name === 'Anonyme') { socket.emit('hk-answer-result', { ok: false, error: 'anonymous', i }); return; }
      const p = player(pid);
      if (p.sol[i]) { socket.emit('hk-answer-result', { ok: true, i, digit: cfg.enigmas[i].digit, already: true }); return; }
      const used = recent(p.tr[i], cfg.answerWindowMs);
      if (used.length >= cfg.answerTries) { socket.emit('hk-answer-result', { ok: false, error: 'wait', i, retryAt: Math.min.apply(null, used) + cfg.answerWindowMs }); return; }
      const good = cfg.enigmas[i].answers.includes(norm(text));
      if (good) { p.sol[i] = 1; save(); socket.emit('hk-answer-result', { ok: true, i, digit: cfg.enigmas[i].digit }); pushView(pid); return; }
      used.push(now()); p.tr[i] = used; save();
      socket.emit('hk-answer-result', { ok: false, error: 'wrong', i, left: Math.max(0, cfg.answerTries - used.length), retryAt: used.length >= cfg.answerTries ? Math.min.apply(null, used) + cfg.answerWindowMs : 0 });
    });
    socket.on('hk-code', ({ playerId, code: c } = {}) => {
      if (!allow('hkcode', 6, 60_000)) { socket.emit('hk-code-result', { ok: false, error: 'rate' }); return; }
      const pid = pidOf(playerId);
      if (!pid) { socket.emit('hk-code-result', { ok: false, error: 'invalid' }); return; }
      const ph = phase();
      if (ph === 'open') { socket.emit('hk-code-result', { ok: false, error: 'late', owner: st.unlocked && st.unlocked.name, ago: now() - st.unlocked.at }); return; }
      if (ph !== 'locked') { socket.emit('hk-code-result', { ok: false, error: 'closed' }); return; }
      const e = ctx.getEntry(pid); if (!e || !e.name || e.name === 'Anonyme') { socket.emit('hk-code-result', { ok: false, error: 'anonymous' }); return; }
      const p = player(pid), used = recent(p.ct, cfg.codeWindowMs);
      if (used.length >= cfg.codeTries) { socket.emit('hk-code-result', { ok: false, error: 'wait', retryAt: Math.min.apply(null, used) + cfg.codeWindowMs }); return; }
      const guess = String(c == null ? '' : c).replace(/\D/g, '').slice(0, 6);
      if (guess === code()) {
        // Premier code juste : Node traite les evenements un par un, donc un seul joueur passe ici.
        const t = now();
        used.push(t); p.ct = used;
        st.unlocked = { pid, name: e.name, at: t, tries: used.length };
        st.ticket = { pid, name: e.name, at: t, expiresAt: t + cfg.ticketDays * 86400_000, items: [] };
        st.free[pid] = st.free[pid] || [];
        save();
        socket.emit('hk-code-result', { ok: true, owner: e.name });
        pushView(pid);
        broadcast({ type: 'unlocked', owner: e.name, at: t });
        io.emit('hk-state-changed');
        announce('unlock', e.name);
        if (ctx.adminAlert) try { ctx.adminAlert('Cadenas ouvert', `${e.name} a ouvert le cadenas de ZyX en ${used.length} essai(s).`); } catch (_) {}
        return;
      }
      used.push(now()); p.ct = used; save();
      socket.emit('hk-code-result', { ok: false, error: 'wrong', left: Math.max(0, cfg.codeTries - used.length), retryAt: used.length >= cfg.codeTries ? Math.min.apply(null, used) + cfg.codeWindowMs : 0 });
    });
    // Prendre un article avec le ticket : gratuit, non remboursable.
    socket.on('hk-take', ({ playerId, cosmeticId } = {}) => {
      if (!allow('hktake', 12, 60_000)) { socket.emit('hk-take-result', { ok: false, error: 'rate' }); return; }
      const pid = pidOf(playerId), tk = st.ticket;
      if (!pid || !tk || tk.pid !== pid || st.ended) { socket.emit('hk-take-result', { ok: false, error: 'noticket' }); return; }
      if (tk.items.length >= cfg.ticketSlots) { socket.emit('hk-take-result', { ok: false, error: 'full' }); return; }
      const c = ctx.cosmetic(cosmeticId);
      if (!eligible(c)) { socket.emit('hk-take-result', { ok: false, error: 'ineligible' }); return; }
      const e = ctx.getEntry(pid);
      if (e.ownedCosmetics.includes(cosmeticId)) { socket.emit('hk-take-result', { ok: false, error: 'owned' }); return; }
      ctx.grant(pid, e, cosmeticId);
      (st.free[pid] || (st.free[pid] = [])).push(cosmeticId);
      tk.items.push({ k: 'take', id: cosmeticId, at: now() });
      save();
      socket.emit('hk-take-result', { ok: true, cosmeticId, used: tk.items.length, slots: cfg.ticketSlots });
      pushView(pid); io.emit('hk-state-changed');
      if (tk.items.length >= cfg.ticketSlots) finish('done');
    });
    // Offrir un de ses articles gratuits a un ami : il compte comme un des 6.
    socket.on('hk-gift', ({ playerId, cosmeticId, ref } = {}) => {
      if (!allow('hkgift', 8, 60_000)) { socket.emit('hk-take-result', { ok: false, error: 'rate' }); return; }
      const pid = pidOf(playerId), tk = st.ticket;
      if (!pid || !tk || tk.pid !== pid || st.ended) { socket.emit('hk-take-result', { ok: false, error: 'noticket' }); return; }
      if (tk.items.length >= cfg.ticketSlots) { socket.emit('hk-take-result', { ok: false, error: 'full' }); return; }
      if (!isFree(pid, cosmeticId)) { socket.emit('hk-take-result', { ok: false, error: 'notfree' }); return; }
      const e = ctx.getEntry(pid), fid = ctx.friendByRef(e, ref);
      if (!fid) { socket.emit('hk-take-result', { ok: false, error: 'notfriend' }); return; }
      const target = ctx.getEntry(fid);
      if (target.ownedCosmetics.includes(cosmeticId)) { socket.emit('hk-take-result', { ok: false, error: 'target_owns' }); return; }
      ctx.revoke(pid, e, cosmeticId);
      st.free[pid] = (st.free[pid] || []).filter(x => x !== cosmeticId);
      ctx.grant(fid, target, cosmeticId);
      ctx.deliverGift(fid, { fromName: e.name, cosmeticId });
      tk.items.push({ k: 'gift', id: cosmeticId, to: target.name, at: now() });
      save();
      socket.emit('hk-take-result', { ok: true, gift: true, cosmeticId, to: target.name, used: tk.items.length, slots: cfg.ticketSlots });
      pushView(pid); io.emit('hk-state-changed');
      if (tk.items.length >= cfg.ticketSlots) finish('done');
    });
  }

  function load(saved, cfgOverride) {
    if (cfgOverride && typeof cfgOverride === 'object') cfg = Object.assign(cfg, cfgOverride);
    if (process.env.HK_START) cfg.start = process.env.HK_START;
    if (process.env.HK_END) cfg.end = process.env.HK_END;
    if (saved && typeof saved === 'object' && saved.edition === cfg.edition) st = Object.assign(st, saved);
  }
  function start() { setInterval(tick, 20_000); setTimeout(tick, 4000); }
  // Reinitialisation (pour les tests locaux ou une nouvelle edition decidee par le proprietaire).
  function reset() { st = { edition: cfg.edition, players: {}, unlocked: null, ticket: null, ended: null, ann: {}, free: {}, paid: {} }; save(); }
  return { load, attach, start, view, phase, priceOf, shopLocked, isFree, paid, refundAmount, eligible, active, reset, tick, _st: () => st, _cfg: () => cfg, _code: code };
};
module.exports.norm = norm;
