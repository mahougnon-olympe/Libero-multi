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

const TRACK = 52;
const HOME_START = 52; // première case de la colonne d'arrivée (relatif)
const DONE = 57;
const COLORS = ['R', 'G', 'Y', 'B'];
const START_ABS = { R: 0, G: 13, Y: 26, B: 39 };
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const absOf = (player, rel) => (rel >= 0 && rel < TRACK) ? (START_ABS[player] + rel) % TRACK : null;

// Les couleurs en jeu, toujours dans l'ordre du plateau (donc l'ordre des tours).
function orderOf(roles) { return COLORS.filter(c => (roles || []).includes(c)); }

function createState(roles = ['R', 'Y']) {
  const order = orderOf(roles);
  const pawns = {};
  order.forEach(c => { pawns[c] = [-1, -1, -1, -1]; });
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
    lastMove: null,    // { player, pawn, from, to, captured } pour l'animation
  };
}

const orderFrom = state => (state.order && state.order.length) ? state.order : ['R', 'Y'];

// Joueur suivant dans l'ordre des tours.
function nextPlayer(state, player) {
  const order = orderFrom(state);
  const i = order.indexOf(player);
  return order[(i + 1) % order.length];
}

// Indices des pions jouables avec le dé courant.
function playablePawns(state, player) {
  const dice = state.dice;
  if (!dice || !state.pawns[player]) return [];
  const out = [];
  state.pawns[player].forEach((pos, i) => {
    if (pos === DONE) return;
    if (pos === -1) { if (dice === 6) out.push(i); return; }
    if (pos + dice <= DONE) out.push(i);
  });
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
  };
}

// Applique un coup : { roll: true } (lancer le dé) ou { pawn: 0-3 }.
// Renvoie null si le coup est illégal, sinon { state, status, winner }.
function applyMove(state, move) {
  const player = state.currentPlayer;
  if (!state.pawns[player]) return null;
  const s = cloneState(state);

  if (move && move.roll) {
    if (s.dice !== null) return null; // il faut d'abord jouer le dé en cours
    const d = 1 + Math.floor(Math.random() * 6);
    s.dice = d; s.lastDice = d;
    s.lastRolls[player] = d; s.rollNo += 1; s.lastRoller = player;
    // Aucun pion jouable : le tour passe tout de suite (le dé reste visible).
    if (!playablePawns(s, player).length) {
      s.dice = null;
      s.currentPlayer = nextPlayer(s, player);
    }
    return { state: s, status: 'playing', winner: null };
  }

  const i = Number(move && move.pawn);
  if (s.dice === null || !Number.isInteger(i) || i < 0 || i > 3) return null;
  if (!playablePawns(s, player).includes(i)) return null;

  const from = s.pawns[player][i];
  const to   = from === -1 ? 0 : from + s.dice;
  s.pawns[player][i] = to;

  // Capture : pions de TOUTES les autres couleurs sur la même case absolue de
  // piste, hors étoiles.
  let captured = 0;
  const abs = absOf(player, to);
  if (abs !== null && !SAFE_ABS.has(abs)) {
    for (const opp of s.order) {
      if (opp === player) continue;
      s.pawns[opp] = s.pawns[opp].map(p => {
        if (absOf(opp, p) === abs) { captured++; return -1; }
        return p;
      });
    }
  }
  s.lastMove = { player, pawn: i, from, to, captured };

  const won = s.pawns[player].every(p => p === DONE);
  const replay = (s.lastDice === 6 || captured > 0) && !won;
  s.dice = null;
  s.currentPlayer = won ? player : (replay ? player : nextPlayer(s, player));
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
    return { state: s, status: winner ? 'won' : 'draw', winner };
  }
  if (wasCurrent) { s.dice = null; s.currentPlayer = next; }
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
  const oppPawns = () => opps.flatMap(o => state.pawns[o].map(p => ({ o, abs: absOf(o, p) })));
  const score = (i) => {
    const from = state.pawns[player][i];
    const to = from === -1 ? 0 : from + state.dice;
    let sc = 0;
    if (to === DONE) sc += 90;                                    // terminer un pion
    const abs = absOf(player, to);
    if (abs !== null && !SAFE_ABS.has(abs)
        && oppPawns().some(x => x.abs === abs)) sc += 100;        // capturer
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

module.exports = { COLORS, START_ABS, createState, applyMove, forfeit, nextPlayer, orderOf, playablePawns, botMove };
