// ── Undercover : salons de 4 a 10 joueurs, chacun sur son telephone ───────────
// Moteur serveur : roles, mots secrets, indices a tour de role, debat, vote, elimination,
// derniere chance de Mr. White. server.js lui donne ses outils via `ctx`.
// Identite = playerId (jamais diffuse). Chaque joueur recoit un etat personnalise : son mot, jamais
// celui des autres, et les roles ne sont reveles qu'a l'elimination ou a la fin de la partie.
const WORDS = require('./undercover-words');
const BOT = require('./undercover-bots');

const MIN = 4, MAX = 10, DEF_MAX = 8;
const T = { reveal: 25000, revealMin: 5000, clue: 30000, debate: 25000, vote: 30000, revote: 20000, verdict: 8500, guess: 25000, guessRes: 5000, grace: 60000, wait: 5 * 60000 };
if (process.env.UC_TIME_SCALE) for (const k of Object.keys(T)) T[k] = Math.max(200, Math.round(T[k] * +process.env.UC_TIME_SCALE)); // essais automatiques seulement
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Roles selon le nombre de joueurs : 4 = 1 Undercover ; 5 a 7 = 1 Undercover + Mr. White ; 8 a 10 = 2 Undercover + Mr. White
// Reglage des roles par l'hote : cfg = null (auto) ou { und, white }. Les civils doivent rester majoritaires.
const maxUnd = (n, w) => Math.max(0, Math.ceil((n - 2 * w) / 2) - 1);
const okRoles = (n, c) => !!c && c.und >= 1 && (c.white === 0 || c.white === 1) && n - c.und - c.white > c.und + c.white && n - c.und - c.white >= 2;
const rolesFor = n => (n <= 4 ? { und: 1, white: 0 } : n <= 7 ? { und: 1, white: 1 } : { und: 2, white: 1 });

module.exports = function createUndercover(ctx) {
  const { io } = ctx;
  const rooms = new Map();
  const sockInfo = new Map();   // socket.id -> { code, pid }
  const hits = new Map();       // socket.id -> [timestamps] (anti-rafale)

  const player = (room, pid) => room.players.find(p => p.pid === pid);
  const lang = p => (p && p.lang === 'en' ? 'en' : 'fr');
  const word = (g, role, l) => (role === 'civil' ? g.pair.civ[l] : role === 'undercover' ? g.pair.und[l] : null);
  const roleOf = (g, pid) => g.roles[pid];
  const idxOf = (room, pid) => room.players.findIndex(p => p.pid === pid);
  const aliveHumans = room => room.g.alive.filter(pid => { const p = player(room, pid); return p && p.connected && !p.bot; });
  const aliveVoters = room => room.g.alive.filter(pid => { const p = player(room, pid); return p && p.connected; });
  const isBot = (room, pid) => { const p = player(room, pid); return !!(p && p.bot); };
  const hasHuman = room => room.players.some(p => !p.bot && p.connected);
  // Le robot joue apres un petit delai, seulement si la partie en est toujours a la meme etape.
  const later = (room, ms, fn) => {
    const g = room.g, ph = g.phase, rd = g.round, sc = Math.max(30, Math.round(ms * (T.clue / 30000)));
    setTimeout(() => { if (rooms.get(room.code) === room && room.g === g && g.phase === ph && g.round === rd && room.status === 'playing') fn(); }, sc);
  };
  const allClues = g => g.clues.filter(c => c.text).map(c => c.text);
  const botWord = (room, pid) => word(room.g, roleOf(room.g, pid), room.blang || 'fr');
  const limited = (sid, max = 24, win = 5000) => {
    const now = Date.now(), a = (hits.get(sid) || []).filter(t => now - t < win);
    if (a.length >= max) { hits.set(sid, a); return true; }
    a.push(now); hits.set(sid, a); return false;
  };

  // ── Etats envoyes aux joueurs ──
  const effN = room => Math.min(MAX, Math.max(MIN, room.players.filter(p => p.connected).length));
  const resolveRoles = (room, n) => (okRoles(n, room.cfg) ? room.cfg : rolesFor(n));
  function view(room, pid) {
    const g = room.g, me = idxOf(room, pid), p = player(room, pid), l = lang(p);
    const base = { code: room.code, status: room.status, host: room.host === pid, max: room.max, min: MIN, seq: room.seq, me };
    if (!room.g) { const n = effN(room), r = resolveRoles(room, n); base.rl = { n, und: r.und, white: r.white, auto: !room.cfg, undMax0: maxUnd(n, 0), undMax1: maxUnd(n, 1), whiteOk: n >= 5, reset: !!room.rolesReset }; }
    base.players = room.players.map(q => {
      const i = idxOf(room, q.pid), o = { name: q.name, connected: q.connected, host: q.pid === room.host, portrait: q.bot ? null : (ctx.portraitOf(q.pid, q.name) || null) };
      if (q.bot) o.bot = true;
      if (g) {
        o.alive = g.alive.includes(q.pid);
        const out = g.out.find(x => x.pid === q.pid);
        if (out) { o.out = { round: out.round, how: out.how }; o.role = out.role; }
        if (room.status === 'finished') o.role = g.roles[q.pid];
        if (g.phase === 'reveal' || g.phase === 'debate') o.ready = g.ready.has(q.pid);
        if (g.phase === 'vote' || g.phase === 'revote') o.voted = g.votes[q.pid] != null;
        void i;
      }
      return o;
    });
    if (!g) return base;
    Object.assign(base, { phase: g.phase, round: g.round, phaseEnd: g.phaseEnd, phaseTotal: g.phaseTotal, order: g.order.map(x => idxOf(room, x)), turn: g.phase === 'clues' ? idxOf(room, g.cur) : -1,
      clues: g.clues.map(c => ({ r: c.r, p: idxOf(room, c.pid), t: c.text })), chat: g.chat.slice(-30).map(c => ({ p: idxOf(room, c.pid), t: c.text })) });
    const role = g.roles[pid];
    base.myWord = word(g, role, l); base.iAmWhite = role === 'white'; base.alive = g.alive.includes(pid);
    base.cands = g.phase === 'revote' ? g.cands.map(x => idxOf(room, x)) : null;
    base.myVote = g.votes[pid] != null ? idxOf(room, g.votes[pid]) : null;
    if (g.tally) base.tally = { counts: Object.fromEntries(Object.entries(g.tally.counts).map(([k, v]) => [idxOf(room, k), v])), votes: Object.fromEntries(Object.entries(g.tally.votes).map(([k, v]) => [idxOf(room, k), idxOf(room, v)])), tie: !!g.tally.tie };
    if (g.last) base.last = { p: idxOf(room, g.last.pid), role: g.last.role, civ: g.pair.civ[l], und: g.pair.und[l], how: g.last.how };
    if (g.guess) base.guess = { p: idxOf(room, g.guess.pid), ok: g.guess.ok == null ? null : g.guess.ok, text: g.guess.text || '' };
    base.winner = g.winner;
    if (room.status === 'finished') { base.civWord = g.pair.civ[l]; base.undWord = g.pair.und[l]; base.reveal = room.players.map(q => ({ p: idxOf(room, q.pid), role: g.roles[q.pid] })).filter(x => x.role); }
    return base;
  }
  function emit(room, ev) {
    room.seq = (room.seq || 0) + 1;
    if (!room.g && room.cfg && !okRoles(effN(room), room.cfg)) { room.cfg = null; room.rolesReset = true; }
    for (const p of room.players) {
      if (!p.sid) continue;
      const v = view(room, p.pid); v.ev = ev || null;
      io.to(p.sid).emit(room.g ? 'uc-state' : 'uc-lobby', v);
    }
  }
  const clearT = room => { clearTimeout(room.timer); room.timer = null; };
  function setPhase(room, name, ms, onEnd) {
    const g = room.g; clearT(room);
    g.phase = name; g.phaseTotal = ms; g.phaseEnd = Date.now() + ms;
    room.timer = setTimeout(() => { room.timer = null; onEnd && onEnd(); }, ms);
  }

  // ── Deroulement ──
  function start(room) {
    const humans = room.players.filter(p => p.connected);
    if (humans.length < MIN) return false;
    room.players = humans;                                    // les joueurs partis ne participent pas
    const n = room.players.length, r = resolveRoles(room, n), pids = shuffle(room.players.map(p => p.pid)), roles = {};
    pids.forEach((pid, i) => { roles[pid] = i < r.und ? 'undercover' : i < r.und + r.white ? 'white' : 'civil'; });
    const pr = WORDS[Math.floor(Math.random() * WORDS.length)], swap = Math.random() < .5;
    const w = (a, b) => ({ fr: a, en: b });
    const civ = swap ? w(pr[1], pr[3]) : w(pr[0], pr[2]), und = swap ? w(pr[0], pr[2]) : w(pr[1], pr[3]);
    room.rolesReset = false; room.status = 'playing'; room.played = room.players.map(p => p.pid);
    room.blang = lang(room.players.find(p => !p.bot && p.pid === room.host) || room.players.find(p => !p.bot));
    room.g = { pair: { civ, und }, roles, alive: room.players.map(p => p.pid), out: [], round: 0, phase: 'reveal', phaseEnd: 0, phaseTotal: 0, order: [], cur: null, clues: [], ready: new Set(), votes: {}, cands: [], tally: null, last: null, guess: null, winner: null, chat: [], starter: Math.floor(Math.random() * n) };
    room.players.forEach(p => { p.afk = 0; });
    setPhase(room, 'reveal', T.reveal, () => beginClues(room));
    room.g.revealAt = Date.now();
    emit(room, { t: 'start' });
    return true;
  }
  function beginClues(room) {
    const g = room.g; if (!g || room.status !== 'playing') return;
    g.round++; g.votes = {}; g.cands = []; g.tally = null; g.last = null; g.guess = null; g.ready = new Set();
    // l'ordre de parole tourne : le premier de la manche est le suivant dans les sieges
    const seats = room.players.map(p => p.pid), alive = seats.filter(pid => g.alive.includes(pid));
    let s = g.starter % seats.length; for (let k = 0; k < seats.length; k++) { const pid = seats[(s + k) % seats.length]; if (g.alive.includes(pid)) { s = (s + k) % seats.length; break; } }
    const startIdx = alive.indexOf(seats[s]);
    g.order = alive.slice(startIdx).concat(alive.slice(0, startIdx)); g.starter = s + 1;
    g.turnI = -1; nextSpeaker(room);
  }
  function nextSpeaker(room) {
    const g = room.g; if (!g || room.status !== 'playing') return;
    g.turnI++;
    if (g.turnI >= g.order.length) { return beginDebate(room); }
    g.cur = g.order[g.turnI];
    const p = player(room, g.cur), gone = !p || !p.connected;
    setPhase(room, 'clues', gone ? 1500 : T.clue, () => { pushClue(room, g.cur, ''); });
    emit(room, { t: 'turn', p: idxOf(room, g.cur) });
    if (isBot(room, g.cur)) botClue(room, g.cur);
  }
  function botClue(room, pid) {
    later(room, 1200 + Math.random() * 2600, () => {
      const g = room.g; if (g.cur !== pid) return;
      pushClue(room, pid, BOT.clueFor(room.blang || 'fr', botWord(room, pid), allClues(g)));
    });
  }
  function pushClue(room, pid, text) {
    const g = room.g; if (!g || g.phase !== 'clues' || g.cur !== pid) return false;
    g.clues.push({ r: g.round, pid, text });
    if (!text) { const p = player(room, pid); if (p) p.afk = (p.afk || 0) + 1; } else { const p = player(room, pid); if (p) p.afk = 0; }
    emit(room, { t: 'clue', p: idxOf(room, pid), text });
    nextSpeaker(room);
    return true;
  }
  function beginDebate(room) {
    const g = room.g; g.cur = null; g.ready = new Set();
    setPhase(room, 'debate', T.debate, () => beginVote(room, false));
    emit(room, { t: 'debate' });
    g.accuse = {};
    g.alive.filter(pid => isBot(room, pid)).forEach(pid => botTalk(room, pid));
  }
  // Clues par joueur (tous tours confondus), pour les choix des robots.
  function cluesByPid(g) { const m = {}; g.alive.forEach(pid => { m[pid] = []; }); g.clues.forEach(c => { if (m[c.pid]) m[c.pid].push(c.text); }); return m; }
  function botPick(room, pid, targets) {
    const g = room.g, l = room.blang || 'fr', b = botOf(room, pid);
    return BOT.chooseVote(l, b, botWord(room, pid), targets, cluesByPid(g), g.accuse || {});
  }
  const botOf = (room, pid) => player(room, pid).persona || { name: '', mood: 'careful' };
  function botTalk(room, pid) {
    const b = botOf(room, pid), n = b.mood === 'chatty' ? 2 : b.mood === 'sharp' ? 1 : (Math.random() < .5 ? 1 : 0);
    for (let k = 0; k < n; k++) later(room, 1500 + Math.random() * 16000, () => {
      const g = room.g, l = room.blang || 'fr', others = g.alive.filter(x => x !== pid), r = Math.random();
      let text;
      if (r < .6 && others.length) { const t = botPick(room, pid, others); g.accuse[t] = (g.accuse[t] || 0) + 1; text = BOT.sayLine(l, 'accuse', player(room, t).name); }
      else text = BOT.sayLine(l, r < .8 ? 'defend' : 'neutral', '');
      g.chat.push({ pid, text }); if (g.chat.length > 60) g.chat.shift();
      emit(room, { t: 'say', p: idxOf(room, pid), text });
    });
  }
  function beginVote(room, again) {
    const g = room.g; if (!g || room.status !== 'playing') return;
    g.votes = {}; g.ready = new Set();
    setPhase(room, again ? 'revote' : 'vote', again ? T.revote : T.vote, () => tally(room));
    emit(room, { t: again ? 'revote' : 'vote' });
    g.alive.filter(pid => isBot(room, pid)).forEach(pid => later(room, 1500 + Math.random() * 9000, () => {
      if (g.votes[pid] != null) return;
      const pool = (again ? g.cands : g.alive).filter(x => x !== pid && g.alive.includes(x));
      if (!pool.length) return;
      g.votes[pid] = botPick(room, pid, pool);
      emit(room, { t: 'voted', p: idxOf(room, pid) });
      checkAllVoted(room);
    }));
  }
  function tally(room) {
    const g = room.g; if (!g || (g.phase !== 'vote' && g.phase !== 'revote')) return;
    clearT(room);
    const counts = {}; for (const [v, t] of Object.entries(g.votes)) if (t != null) counts[t] = (counts[t] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts)), tops = Object.keys(counts).filter(k => counts[k] === max);
    if (!tops.length) { // personne n'a vote : le sort decide
      const pick = shuffle(g.alive)[0]; return eliminate(room, pick, { counts: {}, votes: {}, tie: true }, 'random');
    }
    if (tops.length > 1 && g.phase === 'vote') { // egalite : un second vote entre les ex aequo
      g.cands = tops; g.tally = { counts, votes: Object.assign({}, g.votes), tie: true };
      setPhase(room, 'tie', 3200, () => beginVote(room, true));
      emit(room, { t: 'tie' });
      return;
    }
    const pick = tops.length > 1 ? shuffle(tops)[0] : tops[0];
    eliminate(room, pick, { counts, votes: Object.assign({}, g.votes), tie: false }, tops.length > 1 ? 'random' : 'vote');
  }
  function eliminate(room, pid, tl, how) {
    const g = room.g; clearT(room);
    g.tally = tl; g.alive = g.alive.filter(x => x !== pid);
    const role = g.roles[pid]; g.out.push({ pid, round: g.round, role, how }); g.last = { pid, role, how };
    setPhase(room, 'verdict', T.verdict, () => afterVerdict(room));
    emit(room, { t: 'elim', p: idxOf(room, pid), role });
  }
  function infiltrators(g) { return g.alive.filter(pid => g.roles[pid] !== 'civil'); }
  function afterVerdict(room) {
    const g = room.g; if (!g || room.status !== 'playing') return;
    if (g.last && g.last.role === 'white' && g.last.how !== 'left') {
      g.guess = { pid: g.last.pid, ok: null, text: '' };
      setPhase(room, 'guess', T.guess, () => resolveGuess(room, ''));
      emit(room, { t: 'guess' });
      if (isBot(room, g.last.pid)) later(room, 2500 + Math.random() * 3000, () => {
        const l = room.blang || 'fr', w = BOT.bestGuess(l, allClues(g)) || '';
        resolveGuess(room, w);
      });
      return;
    }
    checkWin(room);
  }
  function resolveGuess(room, text) {
    const g = room.g; if (!g || g.phase !== 'guess') return;
    clearT(room);
    const ok = !!text && (norm(text) === norm(g.pair.civ.fr) || norm(text) === norm(g.pair.civ.en));
    g.guess.ok = ok; g.guess.text = String(text || '').slice(0, 30);
    if (ok) { g.winner = 'white'; return finish(room); }
    setPhase(room, 'guessres', T.guessRes, () => checkWin(room));
    emit(room, { t: 'guessres', ok: false });
  }
  function checkWin(room) {
    const g = room.g; if (!g || room.status !== 'playing') return;
    const inf = infiltrators(g).length, civ = g.alive.length - inf;
    if (inf === 0) g.winner = 'civils';
    else if (civ <= inf) g.winner = 'infiltrators';
    if (g.winner) return finish(room);
    if (room.solo ? !hasHuman(room) : aliveHumans(room).length < 2) return abort(room);
    beginClues(room);
  }
  function finish(room) {
    const g = room.g; clearT(room);
    room.status = 'finished'; g.phase = 'end'; g.phaseEnd = 0;
    const win = pid => (g.winner === 'civils' ? g.roles[pid] === 'civil' : g.winner === 'white' ? g.roles[pid] === 'white' : g.roles[pid] !== 'civil');
    try { ctx.bumpDaily('games'); } catch {}
    (room.played || []).forEach(pid => {
      const p = player(room, pid) || (room.left || []).find(x => x.pid === pid); if (!p || p.bot) return;
      const res = win(pid) ? 'win' : 'loss';
      // Contre des robots : historique et XP reduite, mais ni classement ni defi de victoires.
      try {
        if (!room.solo) ctx.updateLeaderboard(pid, p.name, res);
        // Parti en cours de partie : defaite notee, mais ni XP ni partie comptee.
        const gone = (room.left || []).some(x => x.pid === pid);
        ctx.pushHistory(pid, { game: 'undercover', result: res }, { noXp: gone }); ctx.updateLastActive(pid, p.name);
        if (res === 'win' && !room.solo && !gone) ctx.bumpChallenge(pid, 'gamesWon');
        if (!gone) ctx.xp(pid, room.solo ? (res === 'win' ? 12 : 5) : (res === 'win' ? 25 : 10));
      } catch {}
    });
    try { ctx.refreshBoards(); } catch {}
    emit(room, { t: 'end', winner: g.winner });
  }
  function abort(room) {
    clearT(room); room.status = 'waiting'; room.g = null;
    for (const p of room.players) { const e = p.sid; if (e) io.to(e).emit('uc-error', { message: 'aborted' }); }
    emit(room, null);
  }
  function forfeit(room, pid) {
    const g = room.g; if (!g || room.status !== 'playing' || !g.alive.includes(pid)) return;
    const wasCur = g.phase === 'clues' && g.cur === pid;
    g.alive = g.alive.filter(x => x !== pid); g.out.push({ pid, round: g.round, role: g.roles[pid], how: 'left' });
    delete g.votes[pid]; g.ready.delete(pid);
    const inf = infiltrators(g).length, civ = g.alive.length - inf;
    if (inf === 0) g.winner = 'civils'; else if (civ <= inf) g.winner = 'infiltrators';
    if (g.winner) { return finish(room); }
    if (g.alive.length < 3) return abort(room);
    if (wasCur) { g.clues.push({ r: g.round, pid, text: '' }); nextSpeaker(room); return; }
    if (g.phase === 'vote' || g.phase === 'revote') checkAllVoted(room);
    emit(room, { t: 'left', p: idxOf(room, pid) });
  }
  function checkAllVoted(room) {
    const g = room.g; if (!g || (g.phase !== 'vote' && g.phase !== 'revote')) return;
    const need = aliveVoters(room);
    if (need.every(pid => g.votes[pid] != null)) tally(room);
  }
  function removePlayer(room, pid) {
    const p = player(room, pid); if (!p) return;
    clearTimeout(p.fgt);
    if (room.status === 'playing' && room.g && room.played && room.played.includes(pid)) {
      (room.left = room.left || []).push({ pid, name: p.name });
      p.connected = false; p.sid = null;               // le siege reste visible (grise) jusqu'a la fin de la partie
      forfeit(room, pid);
    } else if (room.status === 'finished') {
      p.connected = false; p.sid = null;               // reste dans le recapitulatif, retire au prochain depart
      emit(room, null);
    } else {
      room.players = room.players.filter(x => x.pid !== pid);
    }
    if (room.solo && !hasHuman(room)) { clearT(room); rooms.delete(room.code); return; }
    if (room.host === pid) { const nh = room.players.find(x => x.connected && !x.bot) || room.players.find(x => x.connected) || room.players[0]; room.host = nh ? nh.pid : null; }
    if (!room.players.some(x => x.connected) && room.status !== 'playing') { clearT(room); rooms.delete(room.code); return; }
    if (room.status === 'waiting') emit(room, null);
  }

  // ── Sockets ──
  function attachSock(socket, room, p) {
    clearTimeout(p.fgt);
    p.sid = socket.id; p.connected = true;
    sockInfo.set(socket.id, { code: room.code, pid: p.pid });
    socket.join(room.code);
    socket.emit('uc-joined', { code: room.code });
    emit(room, null);
    // un joueur qui revient pendant son tour d'indice : on laisse le temps normal
    if (room.status === 'playing' && room.g && room.g.phase === 'clues' && room.g.cur === p.pid) { /* delai deja en cours */ }
  }
  const mine = socket => { const i = sockInfo.get(socket.id); const room = i && rooms.get(i.code); return room && player(room, i.pid) ? { room, pid: i.pid } : null; };
  function tryJoin(socket, code, name, playerId, lg) {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return false;
    const pid = ctx.safePlayerId(playerId) || ('g' + socket.id), known = player(room, pid);
    if (known) { known.lang = lg === 'en' ? 'en' : known.lang; attachSock(socket, room, known); return true; }
    if (room.status !== 'waiting') { socket.emit('uc-error', { message: 'started' }); return true; }
    if (room.players.length >= room.max) { socket.emit('uc-error', { message: 'full' }); return true; }
    const p = { pid, name: ctx.sanitizeName(name, 'Anonyme'), sid: socket.id, connected: true, lang: lg === 'en' ? 'en' : 'fr', afk: 0 };
    room.players.push(p);
    attachSock(socket, room, p);
    return true;
  }
  function attach(socket) {
    socket.on('create-uc-room', ({ name = '', playerId, lang: lg, bots } = {}) => {
      if (limited(socket.id, 5, 30000)) return;
      const old = mine(socket); if (old) { socket.leave(old.room.code); removePlayer(old.room, old.pid); }
      const pid = ctx.safePlayerId(playerId) || ('g' + socket.id), code = ctx.generateCode();
      const p = { pid, name: ctx.sanitizeName(name, 'Anonyme'), sid: socket.id, connected: true, lang: lg === 'en' ? 'en' : 'fr', afk: 0 };
      const room = { code, host: pid, players: [p], status: 'waiting', g: null, seq: 0, timer: null, max: DEF_MAX, played: [], left: [] };
      rooms.set(code, room);
      // Seul contre des robots (3 a 9) : la partie demarre tout de suite.
      const nb = Math.floor(+bots) || 0;
      if (nb >= 3 && nb <= MAX - 1) {
        room.solo = true; room.max = nb + 1;
        BOT.shuffle(BOT.BOTS).slice(0, nb).forEach((b, i) => room.players.push({ pid: 'bot' + (i + 1), name: b.name, persona: b, bot: true, sid: null, connected: true, lang: p.lang, afk: 0 }));
      }
      attachSock(socket, room, p);
      socket.emit('uc-created', { code });
      if (room.solo) start(room);
    });
    socket.on('join-uc-room', ({ code, name = '', playerId, lang: lg } = {}) => { if (!tryJoin(socket, code, name, playerId, lg)) socket.emit('uc-error', { message: 'notfound' }); });
    socket.on('reconnect-uc-room', ({ code, playerId, lang: lg } = {}) => {
      const room = rooms.get(String(code || '').toUpperCase().trim()), pid = ctx.safePlayerId(playerId), p = room && pid ? player(room, pid) : null;
      if (!p || (room.status === 'finished' && !room.players.includes(p))) { socket.emit('uc-reconnect-failed'); return; }
      if (lg === 'en' || lg === 'fr') p.lang = lg;
      attachSock(socket, room, p);
    });
    socket.on('uc-set-max', ({ max } = {}) => {
      const m = mine(socket); if (!m || m.room.status !== 'waiting' || m.room.host !== m.pid) return;
      m.room.max = Math.max(Math.max(MIN, m.room.players.length), Math.min(MAX, Math.floor(+max) || DEF_MAX));
      emit(m.room, null);
    });
    socket.on('uc-set-roles', ({ auto, und, white } = {}) => {
      const m = mine(socket); if (!m || m.room.status !== 'waiting' || m.room.host !== m.pid) return;
      const room = m.room, n = effN(room); room.rolesReset = false;
      if (auto) room.cfg = null;
      else {
        const w = n >= 5 && white ? 1 : 0, u = Math.min(maxUnd(n, w), Math.max(1, Math.floor(+und) || 1));
        room.cfg = okRoles(n, { und: u, white: w }) ? { und: u, white: w } : null;
      }
      emit(room, null);
    });
    socket.on('uc-start', () => {
      const m = mine(socket); if (!m || m.room.status !== 'waiting' || m.room.host !== m.pid) return;
      if (m.room.players.filter(p => p.connected).length < MIN) { socket.emit('uc-error', { message: 'need4' }); return; }
      start(m.room);
    });
    socket.on('uc-restart', () => {
      const m = mine(socket); if (!m || m.room.status !== 'finished' || m.room.host !== m.pid) return;
      const room = m.room; clearT(room);
      room.players = room.players.filter(p => p.connected); room.g = null; room.status = 'waiting'; room.left = [];
      if (room.players.length >= MIN) start(room); else emit(room, null);
    });
    socket.on('uc-ready', () => {
      const m = mine(socket); if (!m || limited(socket.id)) return;
      const g = m.room.g; if (!g || !g.alive.includes(m.pid)) return;
      if (g.phase !== 'reveal' && g.phase !== 'debate') return;
      g.ready.add(m.pid);
      const all = aliveHumans(m.room).every(pid => g.ready.has(pid));
      if (all && g.phase === 'reveal') { const wait = Math.max(0, T.revealMin - (Date.now() - g.revealAt)); clearT(m.room); m.room.timer = setTimeout(() => { m.room.timer = null; beginClues(m.room); }, wait); emit(m.room, null); }
      else if (all && g.phase === 'debate') beginVote(m.room, false);
      else emit(m.room, null);
    });
    socket.on('uc-clue', ({ text } = {}) => {
      const m = mine(socket); if (!m || limited(socket.id)) return;
      const g = m.room.g; if (!g || g.phase !== 'clues' || g.cur !== m.pid) return;
      const raw = String(text || '').trim().replace(/\s+/g, ' ');
      const w = raw.slice(0, 24);
      if (!w) return;
      if (/\s/.test(w)) { socket.emit('uc-error', { message: 'oneword' }); return; }
      const own = word(g, g.roles[m.pid], lang(player(m.room, m.pid)));
      if (own && norm(own) === norm(w)) { socket.emit('uc-error', { message: 'sameword' }); return; }
      try { if (ctx.containsBanned(w)) { socket.emit('uc-error', { message: 'banned' }); return; } } catch {}
      pushClue(m.room, m.pid, w);
    });
    socket.on('uc-say', ({ text } = {}) => {
      const m = mine(socket); if (!m || limited(socket.id, 8, 5000)) return;
      const g = m.room.g; if (!g || !['debate', 'vote', 'revote', 'tie'].includes(g.phase) || !g.alive.includes(m.pid)) return;
      const t = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 100); if (!t) return;
      try { if (ctx.containsBanned(t)) { socket.emit('uc-error', { message: 'banned' }); return; } } catch {}
      g.chat.push({ pid: m.pid, text: t }); if (g.chat.length > 60) g.chat.shift();
      emit(m.room, { t: 'say', p: idxOf(m.room, m.pid), text: t });
    });
    socket.on('uc-vote', ({ idx } = {}) => {
      const m = mine(socket); if (!m || limited(socket.id)) return;
      const g = m.room.g; if (!g || (g.phase !== 'vote' && g.phase !== 'revote') || !g.alive.includes(m.pid)) return;
      const target = m.room.players[Math.floor(Number(idx))]; if (!target || target.pid === m.pid || !g.alive.includes(target.pid)) return;
      if (g.phase === 'revote' && !g.cands.includes(target.pid)) return;
      if (g.votes[m.pid] != null) return;                              // un vote est definitif
      g.votes[m.pid] = target.pid;
      emit(m.room, { t: 'voted', p: idxOf(m.room, m.pid) });
      checkAllVoted(m.room);
    });
    socket.on('uc-guess', ({ text } = {}) => {
      const m = mine(socket); if (!m || limited(socket.id)) return;
      const g = m.room.g; if (!g || g.phase !== 'guess' || !g.guess || g.guess.pid !== m.pid) return;
      resolveGuess(m.room, String(text || '').slice(0, 30));
    });
    socket.on('leave-uc-room', () => {
      const m = mine(socket); sockInfo.delete(socket.id);
      if (!m) return;
      socket.leave(m.room.code); removePlayer(m.room, m.pid);
    });
    socket.on('disconnect', () => {
      const i = sockInfo.get(socket.id); sockInfo.delete(socket.id); hits.delete(socket.id);
      const room = i && rooms.get(i.code), p = room && player(room, i.pid);
      if (!p || p.sid !== socket.id) return;
      p.connected = false; p.sid = null;
      const code = i.code, pid = i.pid;
      p.fgt = setTimeout(() => { const r = rooms.get(code), q = r && player(r, pid); if (q && !q.connected) removePlayer(r, pid); }, room.status === 'playing' ? T.grace : T.wait);
      // pendant son tour d'indice / vote : on n'attend pas
      if (room.status === 'playing' && room.g) {
        const g = room.g;
        if (g.phase === 'clues' && g.cur === pid) { clearT(room); room.timer = setTimeout(() => { room.timer = null; pushClue(room, pid, ''); }, 1500); }
        if (g.phase === 'vote' || g.phase === 'revote') checkAllVoted(room);
        if (g.phase === 'reveal' || g.phase === 'debate') { const all = aliveHumans(room).length && aliveHumans(room).every(x => g.ready.has(x)); if (all && g.phase === 'debate') beginVote(room, false); }
        if (!room.solo && aliveHumans(room).length < 2 && room.status === 'playing') { abort(room); return; }
      }
      emit(room, null);
    });
  }
  return { attach, tryJoin, hasCode: c => rooms.has(c), _rooms: rooms, _t: { rolesFor, okRoles, maxUnd, resolveRoles, norm, start, view } };
};
