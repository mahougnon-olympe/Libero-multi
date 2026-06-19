const { Chess } = require('chess.js');

// R = Blancs (joue en premier), Y = Noirs
function createState() {
  const chess = new Chess();
  return { fen: chess.fen(), currentPlayer: 'R', isCheck: false };
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
  } else if (chess.isDraw()) {
    status = 'draw';
  }

  return {
    fen: chess.fen(),
    currentPlayer: chess.turn() === 'w' ? 'R' : 'Y',
    isCheck: chess.isCheck(),
    status,
    winner,
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
