const { Chess } = require('chess.js');

// ══════════════════════════════════════════════════════════════════
//  TIC TAC TOE : minimax parfait (arbre petit, solution exacte)
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

// ── Robot qui apprend les joueurs ──────────────────────────────────────────
// 1) Il ne joue que des coups « parfaits » (minimax exact) : il ne perd jamais.
// 2) Parmi eux, il choisit celui qui donne le plus de chances de GAGNER contre
//    ce joueur-la, en predisant ses reponses : ce que CE joueur a deja joue dans
//    la meme position, ce que jouent les joueurs en general, et des reflexes
//    humains par defaut (finir une ligne, bloquer, aimer le centre).
// Les positions sont rangees a une symetrie pres (8 rotations / miroirs).
const TTT_SYMS = [
  [0,1,2,3,4,5,6,7,8], [6,3,0,7,4,1,8,5,2], [8,7,6,5,4,3,2,1,0], [2,5,8,1,4,7,0,3,6],
  [2,1,0,5,4,3,8,7,6], [6,7,8,3,4,5,0,1,2], [0,3,6,1,4,7,2,5,8], [8,5,2,7,4,1,6,3,0],
];
// Cle canonique d'une position du point de vue du joueur qui doit jouer.
function tttCanon(board, mover) {
  let best = null, bt = 0;
  for (let t = 0; t < 8; t++) {
    let k = '';
    for (let i = 0; i < 9; i++) { const v = board[TTT_SYMS[t][i]]; k += v === null ? '.' : (v === mover ? 'x' : 'o'); }
    if (best === null || k < best) { best = k; bt = t; }
  }
  return { key: best, t: bt }; // case canonique i <-> case reelle TTT_SYMS[t][i]
}
// Enregistre un coup joue par un humain dans un modele { cle: [9 compteurs] }.
function tttLearn(model, board, mover, cell, maxKeys = 4000) {
  if (!model || cell < 0 || cell > 8) return;
  const { key, t } = tttCanon(board, mover);
  const ci = TTT_SYMS[t].indexOf(cell);
  if (!model[key]) {
    if (Object.keys(model).length >= maxKeys) return;
    model[key] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  model[key][ci]++;
}
function tttEmpties(b) { const e = []; for (let i = 0; i < 9; i++) if (b[i] === null) e.push(i); return e; }
const tttOther = p => (p === 'Y' ? 'R' : 'Y');
function tttWinsNow(b, p, i) { b[i] = p; const w = tttWinner(b) === p; b[i] = null; return w; }

// Prediction : probabilite de chaque case pour l'humain `mover`.
function tttPredict(board, mover, models) {
  const emp = tttEmpties(board);
  const prior = {}; let ptot = 0;
  for (const i of emp) {
    let w = i === 4 ? 2 : ([0, 2, 6, 8].includes(i) ? 1.5 : 1);
    if (tttWinsNow(board, mover, i)) w += 20;            // finir sa ligne
    else if (tttWinsNow(board, tttOther(mover), i)) w += 12; // bloquer
    prior[i] = w; ptot += w;
  }
  const { key, t } = tttCanon(board, mover);
  const seen = {}; let stot = 0;
  for (const [m, weight] of models) {
    const c = m && m[key]; if (!c) continue;
    for (let ci = 0; ci < 9; ci++) if (c[ci]) { const real = TTT_SYMS[t][ci]; if (board[real] === null) { seen[real] = (seen[real] || 0) + c[ci] * weight; stot += c[ci] * weight; } }
  }
  const PRIOR = 4; // poids des reflexes par defaut face aux donnees apprises
  const out = {}; const tot = stot + PRIOR;
  for (const i of emp) out[i] = ((seen[i] || 0) + PRIOR * prior[i] / ptot) / tot;
  return out;
}

// Valeur exacte (minimax) memoisee : +1 le robot gagne, 0 nul, -1 il perd.
const _mmMemo = new Map();
function tttExact(b, toMove) {
  const k = b.map(v => v || '.').join('') + toMove;
  if (_mmMemo.has(k)) return _mmMemo.get(k);
  const w = tttWinner(b);
  let v;
  if (w) v = w === 'Y' ? 1 : -1;
  else {
    const emp = tttEmpties(b);
    if (!emp.length) v = 0;
    else {
      v = toMove === 'Y' ? -2 : 2;
      for (const i of emp) { b[i] = toMove; const s = tttExact(b, tttOther(toMove)); b[i] = null; v = toMove === 'Y' ? Math.max(v, s) : Math.min(v, s); }
    }
  }
  _mmMemo.set(k, v); return v;
}
// Esperance de gain : le robot joue parfaitement, l'humain selon la prediction.
// Gagner tot vaut un peu plus que gagner tard.
function tttExpect(b, toMove, models, depth, memo) {
  const k = b.map(v => v || '.').join('') + toMove;
  if (memo.has(k)) return memo.get(k);
  const w = tttWinner(b);
  let v;
  if (w) v = w === 'Y' ? 1 + (9 - depth) * 0.02 : -1;
  else {
    const emp = tttEmpties(b);
    if (!emp.length) v = 0;
    else if (toMove === 'Y') {
      const best = tttExact(b, 'Y');
      v = -Infinity;
      for (const i of emp) { b[i] = 'Y'; if (tttExact(b, 'R') === best) v = Math.max(v, tttExpect(b, 'R', models, depth + 1, memo)); b[i] = null; }
    } else {
      const pr = tttPredict(b, 'R', models); v = 0;
      for (const i of emp) { b[i] = 'R'; v += pr[i] * tttExpect(b, 'Y', models, depth + 1, memo); b[i] = null; }
    }
  }
  memo.set(k, v); return v;
}

function botMoveTTT(board, difficulty = 'hard', ctx = {}) {
  if (difficulty === 'easy') return tttRandomMove(board);
  if (difficulty === 'medium' && Math.random() < 0.35) return tttRandomMove(board);
  const b = [...board];
  const emp = tttEmpties(b);
  if (!emp.length) return -1;
  // Modeles : ce joueur (poids fort) puis tous les joueurs.
  const models = [[ctx.player, 3], [ctx.global, 1]];
  const best = tttExact(b, 'Y');
  const memo = new Map();
  const scored = [];
  for (const i of emp) {
    b[i] = 'Y';
    if (tttExact(b, 'R') === best) scored.push({ i, s: tttExpect(b, 'R', models, 1, memo) });
    b[i] = null;
  }
  const top = Math.max(...scored.map(x => x.s));
  // Variete : on tire au sort parmi les coups (presque) aussi bons.
  const good = scored.filter(x => x.s >= top - 0.015);
  return good[Math.floor(Math.random() * good.length)].i;
}

// ══════════════════════════════════════════════════════════════════
//  CONNECT4 : minimax avec élagage alpha-bêta (profondeur 5-6)
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
//  CHESS : minimax 3 demi-coups + élagage alpha-bêta
//  Bot joue les Noirs (Y), humain joue les Blancs (R)
// ══════════════════════════════════════════════════════════════════
const P_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Tables de position (vue des Blancs, ligne 0 = 8e rangee) : le bot sait ou une
// piece est bien placee (centre, developpement, roi a l'abri), pas seulement les prises.
const PST = {
  p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
};
const MATE = 100000;

// Score du point de vue de `side` ('w' ou 'b') : materiel + placement.
function chessEval(chess, side) {
  let s = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (!sq) continue;
    const v = P_VAL[sq.type] + PST[sq.type][sq.color === 'w' ? r : 7 - r][c];
    s += sq.color === side ? v : -v;
  }
  // Ouverture : developper cavaliers et fous avant de sortir la dame.
  if (chess.moveNumber() <= 10) {
    for (const col of ['w', 'b']) {
      const home = col === 'w' ? 7 : 0, row = board[home];
      let undeveloped = 0;
      [1, 2, 5, 6].forEach(c => { const p = row[c]; if (p && p.color === col && (p.type === 'n' || p.type === 'b')) undeveloped++; });
      const q = row[3]; const queenOut = !(q && q.color === col && q.type === 'q');
      const pen = undeveloped * 12 + (queenOut && undeveloped >= 2 ? 55 : 0);
      s += col === side ? -pen : pen;
    }
  }
  return s;
}

function orderMoves(moves) {
  // Prises (victime chere, attaquant bon marche) puis promotions et echecs en tete.
  return moves.sort((a, b) =>
    ((b.captured ? 10 * P_VAL[b.captured] - P_VAL[b.piece] : 0) + (b.promotion ? 800 : 0) + (b.san.includes('+') ? 50 : 0)) -
    ((a.captured ? 10 * P_VAL[a.captured] - P_VAL[a.piece] : 0) + (a.promotion ? 800 : 0) + (a.san.includes('+') ? 50 : 0)));
}

// Negamax alpha-beta : score du point de vue du joueur dont c'est le tour.
function negamax(chess, depth, alpha, beta, ply) {
  if (chess.isCheckmate()) return -MATE + ply;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  if (depth === 0) return chessEval(chess, chess.turn());
  let best = -Infinity;
  for (const m of orderMoves(chess.moves({ verbose: true }))) {
    chess.move(m);
    const s = -negamax(chess, depth - 1, -beta, -alpha, ply + 1);
    chess.undo();
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

function botMoveChess(fen, difficulty = 'hard') {
  let chess;
  try { chess = new Chess(fen); } catch { return null; }

  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const pick = m => ({ from: m.from, to: m.to, promotion: m.promotion || 'q' });

  if (difficulty === 'easy') {
    // Facile : souvent au hasard, mais saisit une prise gratuite de temps en temps.
    const caps = moves.filter(m => m.captured);
    if (caps.length && Math.random() < 0.4) return pick(caps[Math.floor(Math.random() * caps.length)]);
    return pick(moves[Math.floor(Math.random() * moves.length)]);
  }

  // Moyen : 2 demi-coups, choisit parmi les coups a 40 points du meilleur.
  // Difficile : 3 demi-coups, choisit parmi les coups a 12 points du meilleur.
  const depth = difficulty === 'medium' ? 1 : 2;
  const opening = (+fen.split(' ')[5] || 1) <= 8;
  const margin = difficulty === 'medium' ? 40 : (opening ? 25 : 15);
  const scored = [];
  let top = -Infinity;
  for (const m of orderMoves(moves)) {
    chess.move(m);
    // Fenetre a la racine : un coup nettement moins bon que le meilleur est coupe tot
    // (on garde seulement ceux qui restent dans la marge de variete).
    const lo = top === -Infinity ? -Infinity : top - margin - 1;
    const sc = -negamax(chess, depth, -Infinity, -lo, 1);
    chess.undo();
    if (sc > top) top = sc;
    scored.push({ m, s: sc });
  }
  const best = Math.max(...scored.map(x => x.s));
  // Variete : jamais toujours le meme coup quand plusieurs se valent.
  const good = scored.filter(x => x.s >= best - margin && (best < MATE - 100 || x.s === best));
  return pick(good[Math.floor(Math.random() * good.length)].m);
}

module.exports = { botMoveTTT, tttLearn, botMoveConnect4, botMoveChess };
