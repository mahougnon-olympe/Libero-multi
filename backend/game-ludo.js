// Ludo 1 contre 1 (4 pions chacun, piste de 52 cases + colonne d'arrivée).
// Positions d'un pion (valeur relative au joueur) :
//   -1        : dans la base (il faut un 6 pour sortir)
//   0 à 51    : sur la piste commune (0 = case de départ du joueur)
//   52 à 56   : colonne d'arrivée (privée, aucune capture possible)
//   57        : arrivé (le pion a terminé son tour complet)
// Cases absolues : R entre en 0, Y en 26 ; abs = (start + rel) % 52.
// Cases étoilées (aucune capture) : les 2 départs + 6 étoiles classiques.
// Un 6 fait rejouer. Une capture renvoie les pions adverses de la case en base.

const TRACK = 52;
const HOME_START = 52; // première case de la colonne d'arrivée (relatif)
const DONE = 57;
const START_ABS = { R: 0, Y: 26 };
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function createState() {
  return {
    pawns: { R: [-1, -1, -1, -1], Y: [-1, -1, -1, -1] },
    dice: null,        // valeur du dé si le joueur doit maintenant bouger
    lastDice: null,    // dernier dé lancé (affichage client)
    currentPlayer: 'R',
    lastMove: null,    // { player, pawn, from, to, captured } pour l'animation
  };
}

const other = p => (p === 'R' ? 'Y' : 'R');
const absOf = (player, rel) => (rel >= 0 && rel < TRACK) ? (START_ABS[player] + rel) % TRACK : null;

// Indices des pions jouables avec le dé courant.
function playablePawns(state, player) {
  const dice = state.dice;
  if (!dice) return [];
  const out = [];
  state.pawns[player].forEach((pos, i) => {
    if (pos === DONE) return;
    if (pos === -1) { if (dice === 6) out.push(i); return; }
    if (pos + dice <= DONE) out.push(i);
  });
  return out;
}

// Applique un coup : { roll: true } (lancer le dé) ou { pawn: 0-3 }.
// Renvoie null si le coup est illégal, sinon { state, status, winner }.
function applyMove(state, move) {
  const player = state.currentPlayer;
  const s = {
    pawns: { R: [...state.pawns.R], Y: [...state.pawns.Y] },
    dice: state.dice, lastDice: state.lastDice,
    currentPlayer: player, lastMove: null,
  };

  if (move && move.roll) {
    if (s.dice !== null) return null; // il faut d'abord jouer le dé en cours
    const d = 1 + Math.floor(Math.random() * 6);
    s.dice = d; s.lastDice = d;
    // Aucun pion jouable : le tour passe tout de suite (le dé reste visible).
    if (!playablePawns(s, player).length) {
      s.dice = null;
      s.currentPlayer = other(player);
    }
    return { state: s, status: 'playing', winner: null };
  }

  const i = Number(move && move.pawn);
  if (s.dice === null || !Number.isInteger(i) || i < 0 || i > 3) return null;
  if (!playablePawns(s, player).includes(i)) return null;

  const from = s.pawns[player][i];
  const to   = from === -1 ? 0 : from + s.dice;
  s.pawns[player][i] = to;

  // Capture : pions adverses sur la même case absolue de piste, hors étoiles.
  let captured = 0;
  const abs = absOf(player, to);
  if (abs !== null && !SAFE_ABS.has(abs)) {
    const opp = other(player);
    s.pawns[opp] = s.pawns[opp].map(p => {
      if (absOf(opp, p) === abs) { captured++; return -1; }
      return p;
    });
  }
  s.lastMove = { player, pawn: i, from, to, captured };

  const won = s.pawns[player].every(p => p === DONE);
  const replay = (s.lastDice === 6 || captured > 0) && !won;
  s.dice = null;
  s.currentPlayer = won ? player : (replay ? player : other(player));
  return { state: s, status: won ? 'won' : 'playing', winner: won ? player : null };
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

  const opp = other(player);
  const score = (i) => {
    const from = state.pawns[player][i];
    const to = from === -1 ? 0 : from + state.dice;
    let sc = 0;
    if (to === DONE) sc += 90;                                    // terminer un pion
    const abs = absOf(player, to);
    if (abs !== null && !SAFE_ABS.has(abs)
        && state.pawns[opp].some(p => absOf(opp, p) === abs)) sc += 100; // capturer
    if (from === -1) sc += 40;                                    // sortir de la base
    if (abs !== null && SAFE_ABS.has(abs)) sc += 15;              // se mettre a l'abri
    if (to >= HOME_START) sc += 25;                               // entrer dans la colonne
    sc += to;                                                     // sinon avancer le plus loin
    if (difficulty === 'hard' && abs !== null && !SAFE_ABS.has(abs)) {
      // Eviter de finir a portee (1-6 cases) d'un pion adverse.
      for (const p of state.pawns[opp]) {
        const oa = absOf(opp, p);
        if (oa === null) continue;
        const dist = (abs - oa + TRACK) % TRACK;
        if (dist >= 1 && dist <= 6) { sc -= 30; break; }
      }
    }
    return sc;
  };
  let best = playable[0], bestSc = -Infinity;
  for (const i of playable) { const sc = score(i); if (sc > bestSc) { bestSc = sc; best = i; } }
  return { pawn: best };
}

module.exports = { createState, applyMove, playablePawns, botMove };
