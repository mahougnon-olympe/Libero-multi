// Ludo de 2 à 4 joueurs (4 pions chacun, piste de 52 cases + colonne d'arrivée).
// Positions d'un pion (valeur relative au joueur) :
//   -1        : dans la base (il faut un 6 pour sortir)
//   0 à 51    : sur la piste commune (0 = case de départ du joueur)
//   52 à 56   : colonne d'arrivée (privée, aucune capture possible)
//   57        : arrivé (le pion a terminé son tour complet)
// Couleurs dans l'ordre du plateau (sens des aiguilles d'une montre) :
//   R (bas gauche) -> G (haut gauche) -> Y (haut droite) -> B (bas droite).
// Cases absolues : R entre en 0, G en 13, Y en 26, B en 39 ; abs = (start + rel) % 52.
// Cases étoilées (aucune capture) : les 4 départs + 4 étoiles classiques.
// Un 6 fait rejouer. Une capture renvoie les pions adverses de la case en base
// et fait rejouer. Le premier qui amène ses 4 pions à l'arrivée gagne.
// À 2 joueurs (contre un ami ou le bot) on joue R contre Y, coins opposés.
//
// Réglages de règles (state.opts, choisis par l'hôte du salon ; tout est actif par défaut) :
//   barrage     : deux pions de même couleur sur une case de piste ne peuvent pas être capturés ;
//   three6      : le troisième 6 de suite fait perdre le tour ;
//   replayHome  : faire rentrer un pion à l'arrivée fait rejouer ;
//   threeTries  : tous les pions en base (aucun sur le plateau) : jusqu'à 3 lancers pour sortir ;
//   exact       : il faut le nombre exact pour rentrer (sinon un dé trop grand suffit).
// Une partie sans state.opts (ancienne) garde les règles d'origine (LEGACY_OPTS).

const TRACK = 52;
const HOME_START = 52; // première case de la colonne d'arrivée (relatif)
const DONE = 57;
const COLORS = ['R', 'G', 'Y', 'B'];
const START_ABS = { R: 0, G: 13, Y: 26, B: 39 };
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const DEFAULT_OPTS = { barrage: true, three6: true, replayHome: true, threeTries: true, exact: true };
const LEGACY_OPTS = { barrage: false, three6: false, replayHome: false, threeTries: false, exact: true };
function normOpts(o) {
  const r = {};
  Object.keys(DEFAULT_OPTS).forEach(k => { r[k] = (o && typeof o[k] === 'boolean') ? o[k] : DEFAULT_OPTS[k]; });
  return r;
}
const optsOf = state => state.opts || LEGACY_OPTS;

const absOf = (player, rel) => (rel >= 0 && rel < TRACK) ? (START_ABS[player] + rel) % TRACK : null;

// Les couleurs en jeu, toujours dans l'ordre du plateau (donc l'ordre des tours).
function orderOf(roles) { return COLORS.filter(c => (roles || []).includes(c)); }

function createState(roles = ['R', 'Y'], opts) {
  const order = orderOf(roles);
  const pawns = {}, stats = {};
  order.forEach(c => { pawns[c] = [-1, -1, -1, -1]; stats[c] = { captures: 0, sixes: 0, homes: 0 }; });
  return {
    pawns,
    order,             // couleurs en jeu, dans l'ordre des tours
    out: [],           // couleurs qui ont abandonné
    dice: null,        // valeur du dé si le joueur doit maintenant bouger
    lastDice: null,    // dernier dé lancé (compatibilité)
    lastRolls: {},     // dernier lancer de CHAQUE joueur : { R: 3, Y: 6 }
    rollNo: 0,         // numéro du lancer (le client s'en sert pour animer le bon dé)
    lastRoller: null,  // qui a lancé le dernier dé (pour animer SON dé)
    currentPlayer: order[0],
    lastMove: null,    // { player, pawn, from, to, captured, victims, home } pour l'animation
    opts: normOpts(opts),
    sixes: 0,          // 6 de suite dans le tour en cours
    tries: 0,          // lancers ratés avec tous les pions en base
    stats,             // { R: { captures, sixes, homes } } pour l'écran de fin
    ev: null,          // dernier événement de règle : { t: 'three6' | 'retry' | 'nomove' | 'barrage', player }
    ranking: null,     // classement final (couleurs), rempli quand la partie est finie
  };
}

const orderFrom = state => (state.order && state.order.length) ? state.order : ['R', 'Y'];

// Joueur suivant dans l'ordre des tours.
function nextPlayer(state, player) {
  const order = orderFrom(state);
  const i = order.indexOf(player);
  return order[(i + 1) % order.length];
}

// Case d'arrivée d'un pion avec le dé donné (valeur relative), ou null s'il ne peut pas bouger.
function reach(state, pos, dice) {
  if (pos === DONE) return null;
  if (pos === -1) return dice === 6 ? 0 : null;
  const to = pos + dice;
  if (to <= DONE) return to;
  return optsOf(state).exact ? null : DONE;
}

// Indices des pions jouables avec le dé courant.
function playablePawns(state, player) {
  const dice = state.dice;
  if (!dice || !state.pawns[player]) return [];
  const out = [];
  state.pawns[player].forEach((pos, i) => { if (reach(state, pos, dice) !== null) out.push(i); });
  return out;
}

function cloneState(state) {
  const pawns = {};
  Object.keys(state.pawns).forEach(c => { pawns[c] = [...state.pawns[c]]; });
  return {
    pawns, order: [...orderFrom(state)], out: [...(state.out || [])],
    dice: state.dice, lastDice: state.lastDice,
    lastRolls: { ...(state.lastRolls || {}) }, rollNo: state.rollNo || 0, lastRoller: state.lastRoller || null,
    currentPlayer: state.currentPlayer, lastMove: null,
    opts: state.opts ? { ...state.opts } : undefined, sixes: state.sixes || 0, tries: state.tries || 0,
    stats: JSON.parse(JSON.stringify(state.stats || {})), ev: null, ranking: state.ranking ? [...state.ranking] : null,
  };
}

const statOf = (s, c) => (s.stats[c] || (s.stats[c] = { captures: 0, sixes: 0, homes: 0 }));

// Passe la main au joueur suivant (les compteurs du tour repartent à zéro).
function endTurn(s, player) {
  s.dice = null; s.sixes = 0; s.tries = 0;
  s.currentPlayer = nextPlayer(s, player);
}

// Tous les pions encore en jeu sont en base (aucun sur le plateau).
function allInBase(s, player) {
  const p = s.pawns[player];
  return p.some(x => x === -1) && p.every(x => x === -1 || x === DONE);
}

// Classement final : pions rentrés, puis distance parcourue ; le vainqueur est en tête.
function finalRanking(s, winner) {
  const score = c => { const p = s.pawns[c] || []; return p.filter(x => x === DONE).length * 1000 + p.reduce((a, x) => a + Math.max(0, x), 0); };
  const rest = orderFrom(s).filter(c => c !== winner).sort((a, b) => score(b) - score(a));
  return [winner, ...rest, ...[...(s.out || [])].reverse()];
}

// Applique un coup : { roll: true } (lancer le dé) ou { pawn: 0-3 }.
// Renvoie null si le coup est illégal, sinon { state, status, winner }.
function applyMove(state, move) {
  const player = state.currentPlayer;
  if (!state.pawns[player]) return null;
  const s = cloneState(state);
  const o = optsOf(s);

  if (move && move.roll) {
    if (s.dice !== null) return null; // il faut d'abord jouer le dé en cours
    const d = 1 + Math.floor(Math.random() * 6);
    s.dice = d; s.lastDice = d;
    s.lastRolls[player] = d; s.rollNo += 1; s.lastRoller = player;
    if (d === 6) { statOf(s, player).sixes++; s.sixes++; } else s.sixes = 0;
    // Trois 6 de suite : le tour est perdu (le dé reste visible).
    if (o.three6 && s.sixes >= 3) {
      endTurn(s, player);
      s.ev = { t: 'three6', player };
      return { state: s, status: 'playing', winner: null };
    }
    // Aucun pion jouable : le tour passe tout de suite (le dé reste visible),
    // sauf quand tous les pions sont en base : on a droit à trois lancers pour sortir.
    if (!playablePawns(s, player).length) {
      if (o.threeTries && allInBase(s, player)) {
        s.tries++;
        if (s.tries < 3) { s.dice = null; s.ev = { t: 'retry', player, left: 3 - s.tries }; return { state: s, status: 'playing', winner: null }; }
      }
      endTurn(s, player);
      s.ev = { t: 'nomove', player };
    }
    return { state: s, status: 'playing', winner: null };
  }

  const i = Number(move && move.pawn);
  if (s.dice === null || !Number.isInteger(i) || i < 0 || i > 3) return null;
  if (!playablePawns(s, player).includes(i)) return null;

  const from = s.pawns[player][i];
  const to   = reach(s, from, s.dice);
  s.pawns[player][i] = to;
  s.tries = 0;

  // Capture : pions des autres couleurs sur la même case absolue de piste, hors étoiles.
  // Avec le barrage, deux pions d'une même couleur sur la case ne peuvent pas être pris.
  let captured = 0, blocked = false;
  const victims = [];
  const abs = absOf(player, to);
  if (abs !== null && !SAFE_ABS.has(abs)) {
    for (const opp of s.order) {
      if (opp === player) continue;
      const here = [];
      s.pawns[opp].forEach((p, k) => { if (absOf(opp, p) === abs) here.push(k); });
      if (o.barrage && here.length >= 2) { blocked = true; continue; }
      here.forEach(k => { victims.push({ player: opp, pawn: k, from: s.pawns[opp][k] }); s.pawns[opp][k] = -1; captured++; });
    }
  }
  const home = to === DONE;
  s.lastMove = { player, pawn: i, from, to, captured, victims, home };
  if (blocked) s.ev = { t: 'barrage', player };
  const st = statOf(s, player);
  st.captures += captured; if (home) st.homes++;

  const won = s.pawns[player].every(p => p === DONE);
  const replay = (s.lastDice === 6 || captured > 0 || (o.replayHome && home)) && !won;
  s.dice = null;
  if (won) { s.currentPlayer = player; s.ranking = finalRanking(s, player); }
  else if (replay) s.currentPlayer = player;
  else { s.sixes = 0; s.currentPlayer = nextPlayer(s, player); }
  return { state: s, status: won ? 'won' : 'playing', winner: won ? player : null };
}

// Un joueur quitte la partie (abandon ou déconnexion trop longue) : ses pions
// quittent le plateau et les autres continuent. S'il n'en reste qu'un, il gagne.
function forfeit(state, role) {
  const order = orderFrom(state);
  if (!order.includes(role)) return { state, status: 'playing', winner: null };
  const s = cloneState(state);
  const wasCurrent = s.currentPlayer === role;
  const next = wasCurrent ? nextPlayer(s, role) : s.currentPlayer;
  s.order = order.filter(c => c !== role);
  s.out.push(role);
  delete s.pawns[role];
  delete s.lastRolls[role];
  if (s.order.length <= 1) {
    const winner = s.order[0] || null;
    s.dice = null;
    s.currentPlayer = winner;
    if (winner) s.ranking = finalRanking(s, winner);
    return { state: s, status: winner ? 'won' : 'draw', winner };
  }
  if (wasCurrent) { s.dice = null; s.sixes = 0; s.tries = 0; s.currentPlayer = next; }
  return { state: s, status: 'playing', winner: null };
}

// ── Bot ──────────────────────────────────────────────────────────────────────
// Renvoie UNE action atomique ({roll:true} ou {pawn:i}) ; la boucle du serveur
// le rappelle tant que c'est son tour (relance sur 6, dé à jouer...).
function botMove(state, difficulty = 'medium') {
  const player = state.currentPlayer;
  if (state.dice === null) return { roll: true };
  const playable = playablePawns(state, player);
  if (!playable.length) return null; // ne devrait pas arriver (le tour a passé)
  if (difficulty === 'easy') return { pawn: playable[Math.floor(Math.random() * playable.length)] };

  const opps = orderFrom(state).filter(c => c !== player);
  // Des pions adverses prenables sur cette case (un barrage de deux pions d'une couleur ne l'est pas).
  const capturable = abs => opps.some(o => {
    const n = state.pawns[o].filter(p => absOf(o, p) === abs).length;
    return n > 0 && !(optsOf(state).barrage && n >= 2);
  });
  const oppPawns = () => opps.flatMap(o => state.pawns[o].map(p => ({ o, abs: absOf(o, p) })));
  const score = (i) => {
    const from = state.pawns[player][i];
    const to = reach(state, from, state.dice);
    let sc = 0;
    if (to === DONE) sc += 90;                                    // terminer un pion
    const abs = absOf(player, to);
    if (abs !== null && !SAFE_ABS.has(abs) && capturable(abs)) sc += 100;   // capturer
    if (abs !== null && optsOf(state).barrage && state.pawns[player].some((p, k) => k !== i && absOf(player, p) === abs)) sc += 12; // former un barrage
    if (from === -1) sc += 40;                                    // sortir de la base
    if (abs !== null && SAFE_ABS.has(abs)) sc += 15;              // se mettre a l'abri
    if (to >= HOME_START) sc += 25;                               // entrer dans la colonne
    sc += to;                                                     // sinon avancer le plus loin
    if (difficulty === 'hard' && abs !== null && !SAFE_ABS.has(abs)) {
      // Eviter de finir a portee (1-6 cases) d'un pion adverse.
      for (const x of oppPawns()) {
        if (x.abs === null) continue;
        const dist = (abs - x.abs + TRACK) % TRACK;
        if (dist >= 1 && dist <= 6) { sc -= 30; break; }
      }
    }
    return sc;
  };
  let best = playable[0], bestSc = -Infinity;
  for (const i of playable) { const sc = score(i); if (sc > bestSc) { bestSc = sc; best = i; } }
  return { pawn: best };
}

module.exports = { COLORS, START_ABS, DEFAULT_OPTS, normOpts, createState, applyMove, forfeit, nextPlayer, orderOf, playablePawns, botMove };
