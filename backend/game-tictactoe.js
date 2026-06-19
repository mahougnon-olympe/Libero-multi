const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // lignes
  [0,3,6],[1,4,7],[2,5,8], // colonnes
  [0,4,8],[2,4,6],          // diagonales
];

function createState() {
  return { board: Array(9).fill(null), currentPlayer: 'R' };
}

function checkWinner(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], winLine: line };
    }
  }
  return null;
}

// Retourne le nouvel état ou null si coup invalide
function applyMove(state, cell) {
  const idx = parseInt(cell, 10);
  if (isNaN(idx) || idx < 0 || idx > 8 || state.board[idx] !== null) return null;

  const board = [...state.board];
  board[idx] = state.currentPlayer;

  const win = checkWinner(board);
  if (win) return { board, currentPlayer: state.currentPlayer, status: 'won', winner: win.winner, winLine: win.winLine };
  if (board.every(c => c !== null)) return { board, currentPlayer: state.currentPlayer, status: 'draw', winner: null, winLine: null };

  return { board, currentPlayer: state.currentPlayer === 'R' ? 'Y' : 'R', status: 'playing', winner: null, winLine: null };
}

module.exports = { createState, applyMove };
