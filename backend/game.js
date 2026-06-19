const ROWS = 6;
const COLS = 7;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// Returns the row where the piece landed, or -1 if column is full
function dropPiece(board, col, player) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][col]) {
      board[row][col] = player;
      return row;
    }
  }
  return -1;
}

function checkWin(board, row, col, player) {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal ↘
    [1, -1], // diagonal ↙
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      count++;
    }

    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      count++;
    }

    if (count >= 4) return true;
  }

  return false;
}

// Draw if the top row is completely filled
function checkDraw(board) {
  return board[0].every(cell => cell !== null);
}

module.exports = { createBoard, dropPiece, checkWin, checkDraw };
