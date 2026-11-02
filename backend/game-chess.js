const { Chess } = require('chess.js');

// R = Blancs (joue en premier), Y = Noirs
// Cle de position pour la triple repetition : placement, trait, roques et prise en passant (sans les compteurs de coups).
const posKey = fen => String(fen).split(' ').slice(0, 4).join(' ');
function createState() {
  const chess = new Chess();
  return { fen: chess.fen(), currentPlayer: 'R', isCheck: false, hist: [posKey(chess.fen())] };
}

// move: { from, to, promotion? }
// Retourne le nouvel état ou null si coup invalide
function applyMove(state, move) {
  let chess;
  try { chess = new Chess(state.fen); } catch { return null; }

  // Vérifier que c'est bien le tour du bon joueur
  const expected = state.currentPlayer === 'R' ? 'w' : 'b';
  if (chess.turn() !== expected) return null;

  try {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  } catch { return null; }

  let status = 'playing';
  let winner = null;

  if (chess.isCheckmate()) {
    status = 'won';
    // Le joueur dont c'est maintenant le tour est en échec et mat → l'autre a gagné
    winner = chess.turn() === 'b' ? 'R' : 'Y';
  }
  // Historique des positions (la partie est recreee a chaque coup depuis la position seule, donc on le garde ici).
  const key = posKey(chess.fen());
  const hist = (Array.isArray(state.hist) && state.hist.length ? state.hist : [posKey(state.fen)]).concat(key).slice(-200);
  let drawReason = null;
  if (status === 'playing') {
    if (chess.isStalemate()) drawReason = 'stalemate';
    else if (chess.isInsufficientMaterial()) drawReason = 'material';
    else if (hist.filter(k => k === key).length >= 3) drawReason = 'repetition';
    else if (chess.isDrawByFiftyMoves()) drawReason = 'fifty';
    if (drawReason) status = 'draw';
  }

  return {
    fen: chess.fen(),
    currentPlayer: chess.turn() === 'w' ? 'R' : 'Y',
    isCheck: chess.isCheck(),
    status,
    winner,
    hist,
    drawReason,
  };
}

// Retourne les cases de destination légales pour une pièce sur `square`
function getLegalMoves(fen, square) {
  let chess;
  try { chess = new Chess(fen); } catch { return []; }
  try {
    return chess.moves({ square, verbose: true }).map(m => m.to);
  } catch { return []; }
}

module.exports = { createState, applyMove, getLegalMoves };
