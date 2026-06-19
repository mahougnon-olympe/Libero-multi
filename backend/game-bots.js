const { Chess } = require('chess.js');

// ══════════════════════════════════════════════════════════════════
//  TIC TAC TOE — minimax parfait (arbre petit, solution exacte)
// ══════════════════════════════════════════════════════════════════
const TTT_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function tttWinner(board) {
  for (const [a,b,c] of TTT_LINES)
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  return null;
}

function tttMinimax(board, isMaximizing) {
  const w = tttWinner(board);
  if (w === 'Y') return 10;
  if (w === 'R') return -10;
  const empties = board.reduce((a, v, i) => v === null ? [...a, i] : a, []);
  if (!empties.length) return 0;

  let best = isMaximizing ? -Infinity : Infinity;
  for (const i of empties) {
    board[i] = isMaximizing ? 'Y' : 'R';
    const s = tttMinimax(board, !isMaximizing);
    board[i] = null;
    best = isMaximizing ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

function tttRandomMove(board) {
  const empties = board.reduce((a, v, i) => v === null ? [...a, i] : a, []);
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : -1;
}

function botMoveTTT(board, difficulty = 'hard') {
  if (difficulty === 'easy') return tttRandomMove(board);
  if (difficulty === 'medium' && Math.random() < 0.35) return tttRandomMove(board);
  const b = [...board];
  let best = -Infinity, cell = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== null) continue;
    b[i] = 'Y';
    const s = tttMinimax(b, false);
    b[i] = null;
    if (s > best) { best = s; cell = i; }
  }
  return cell;
}

// ══════════════════════════════════════════════════════════════════
//  CONNECT4 — minimax avec élagage alpha-bêta (profondeur 5-6)
// ══════════════════════════════════════════════════════════════════
const ROWS = 6, COLS = 7;

function c4ValidCols(board) {
  return Array.from({ length: COLS }, (_, c) => c).filter(c => board[0][c] === null);
}

function c4Drop(board, col, player) {
  const b = board.map(r => [...r]);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!b[r][col]) { b[r][col] = player; return b; }
  }
  return null;
}

function c4Win(board, player) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if ([0,1,2,3].every(i => board[r][c+i] === player)) return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c < COLS; c++)
      if ([0,1,2,3].every(i => board[r+i][c] === player)) return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if ([0,1,2,3].every(i => board[r+i][c+i] === player)) return true;
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if ([0,1,2,3].every(i => board[r-i][c+i] === player)) return true;
  return false;
}

function c4ScoreWindow(w, player) {
  const opp = player === 'Y' ? 'R' : 'Y';
  const mine = w.filter(c => c === player).length;
  const oppN = w.filter(c => c === opp).length;
  const empty = w.filter(c => c === null).length;
  if (mine === 4) return 100;
  if (mine === 3 && empty === 1) return 5;
  if (mine === 2 && empty === 2) return 2;
  if (oppN === 3 && empty === 1) return -4;
  return 0;
}

function c4Eval(board) {
  let score = 0;
  const mid = Math.floor(COLS / 2);
  score += board.map(r => r[mid]).filter(c => c === 'Y').length * 3;

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS-4; c++)
      score += c4ScoreWindow([board[r][c],board[r][c+1],board[r][c+2],board[r][c+3]], 'Y');
  for (let r = 0; r <= ROWS-4; r++)
    for (let c = 0; c < COLS; c++)
      score += c4ScoreWindow([board[r][c],board[r+1][c],board[r+2][c],board[r+3][c]], 'Y');
  for (let r = 0; r <= ROWS-4; r++)
    for (let c = 0; c <= COLS-4; c++)
      score += c4ScoreWindow([board[r][c],board[r+1][c+1],board[r+2][c+2],board[r+3][c+3]], 'Y');
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS-4; c++)
      score += c4ScoreWindow([board[r][c],board[r-1][c+1],board[r-2][c+2],board[r-3][c+3]], 'Y');
  return score;
}

function c4Minimax(board, depth, alpha, beta, isMax) {
  const cols = c4ValidCols(board);
  if (c4Win(board, 'Y')) return { score:  1_000_000 };
  if (c4Win(board, 'R')) return { score: -1_000_000 };
  if (!cols.length || depth === 0) return { score: c4Eval(board) };

  let best = { score: isMax ? -Infinity : Infinity };
  for (const col of cols) {
    const b = c4Drop(board, col, isMax ? 'Y' : 'R');
    const res = c4Minimax(b, depth - 1, alpha, beta, !isMax);
    if (isMax ? res.score > best.score : res.score < best.score)
      best = { score: res.score, col };
    if (isMax) alpha = Math.max(alpha, best.score);
    else       beta  = Math.min(beta,  best.score);
    if (alpha >= beta) break;
  }
  return best;
}

function botMoveConnect4(board, difficulty = 'hard') {
  const cols = c4ValidCols(board);
  if (!cols.length) return -1;
  if (difficulty === 'easy') return cols[Math.floor(Math.random() * cols.length)];
  const pieces = board.flat().filter(c => c !== null).length;
  const depth = difficulty === 'medium' ? 3 : (pieces < 12 ? 4 : pieces < 26 ? 5 : 6);
  const res = c4Minimax(board, depth, -Infinity, Infinity, true);
  return res.col !== undefined ? res.col : cols[Math.floor(Math.random() * cols.length)];
}

// ══════════════════════════════════════════════════════════════════
//  CHESS — minimax 3 demi-coups + élagage alpha-bêta
//  Bot joue les Noirs (Y), humain joue les Blancs (R)
// ══════════════════════════════════════════════════════════════════
const P_VAL = { p: 10, n: 30, b: 32, r: 50, q: 90, k: 0 };

function chessEval(chess) {
  let s = 0;
  for (const row of chess.board())
    for (const sq of row)
      if (sq) s += (sq.color === 'b' ? 1 : -1) * (P_VAL[sq.type] || 0);
  return s;
}

function chessMinimax(chess, depth, alpha, beta, isBlack) {
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) return chess.turn() === 'b' ? -10000 : 10000;
    return 0;
  }
  if (depth === 0) return chessEval(chess);

  const moves = chess.moves({ verbose: true });
  // Tri : captures en priorité (meilleure pruning)
  moves.sort((a, b) => (P_VAL[b.captured] || 0) - (P_VAL[a.captured] || 0));

  let best = isBlack ? -Infinity : Infinity;
  for (const m of moves) {
    chess.move(m);
    const s = chessMinimax(chess, depth - 1, alpha, beta, !isBlack);
    chess.undo();
    if (isBlack) { if (s > best) best = s; alpha = Math.max(alpha, best); }
    else         { if (s < best) best = s; beta  = Math.min(beta,  best); }
    if (alpha >= beta) break;
  }
  return best;
}

function botMoveChess(fen, difficulty = 'hard') {
  let chess;
  try { chess = new Chess(fen); } catch { return null; }

  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  if (difficulty === 'easy') {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion || 'q' };
  }

  moves.sort((a, b) => (P_VAL[b.captured] || 0) - (P_VAL[a.captured] || 0));

  const depth = difficulty === 'medium' ? 1 : 2;

  let bestScore = -Infinity, bestMove = moves[0];
  for (const m of moves) {
    chess.move(m);
    const s = chessMinimax(chess, depth, -Infinity, Infinity, false);
    chess.undo();
    if (s > bestScore) { bestScore = s; bestMove = m; }
  }

  return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || 'q' };
}

module.exports = { botMoveTTT, botMoveConnect4, botMoveChess };
