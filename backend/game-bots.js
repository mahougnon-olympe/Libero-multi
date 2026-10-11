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
// Tables de position (vue des Blancs, ligne 0 = 8e rangee).
const PST = {
  p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
  // Roi en fin de partie : il doit monter au centre.
  ke: [[-50,-40,-30,-20,-20,-30,-40,-50],[-30,-20,-10,0,0,-10,-20,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-30,0,0,0,0,-30,-30],[-50,-30,-30,-30,-30,-30,-30,-50]],
};
const MATE = 100000;
const PASSED = [0, 120, 80, 50, 30, 15, 10, 0]; // bonus du pion passe selon sa rangee (vue des Blancs)

// Evaluation du point de vue de `side` : materiel, placement, paire de fous,
// structure de pions (doubles, isoles, passes), roi au centre en finale,
// developpement en ouverture.
function chessEval(chess, side) {
  const board = chess.board();
  let s = 0, nonPawn = 0;
  const pawns = { w: [], b: [] }, bishops = { w: 0, b: 0 };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c]; if (!sq) continue;
    if (sq.type === 'p') pawns[sq.color].push([r, c]);
    else if (sq.type !== 'k') nonPawn += P_VAL[sq.type];
    if (sq.type === 'b') bishops[sq.color]++;
  }
  const endgame = nonPawn <= 2600;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c]; if (!sq) continue;
    const tbl = sq.type === 'k' && endgame ? PST.ke : PST[sq.type];
    const v = P_VAL[sq.type] + tbl[sq.color === 'w' ? r : 7 - r][c];
    s += sq.color === side ? v : -v;
  }
  for (const col of ['w', 'b']) {
    let v = bishops[col] >= 2 ? 30 : 0;
    const mine = pawns[col], theirs = pawns[col === 'w' ? 'b' : 'w'];
    const files = Array(8).fill(0); mine.forEach(([, c]) => files[c]++);
    for (const [r, c] of mine) {
      if (files[c] > 1) v -= 12;                                         // pion double
      if (!(files[c - 1] || 0) && !(files[c + 1] || 0)) v -= 12;          // pion isole
      const ahead = col === 'w' ? (rr => rr < r) : (rr => rr > r);
      const passed = !theirs.some(([rr, cc]) => Math.abs(cc - c) <= 1 && ahead(rr));
      if (passed) v += PASSED[col === 'w' ? r : 7 - r] * (endgame ? 1.5 : 1);
    }
    s += col === side ? v : -v;
  }
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

const _mvv = m => (m.captured ? 10 * P_VAL[m.captured] - P_VAL[m.piece] + 1000 : 0) + (m.promotion ? 900 : 0);
function orderMoves(moves, ttMove) {
  return moves.sort((a, b) => {
    const ta = ttMove && a.from + a.to === ttMove ? 1e6 : 0, tb = ttMove && b.from + b.to === ttMove ? 1e6 : 0;
    return (tb + _mvv(b) + (b.san.includes('+') ? 50 : 0)) - (ta + _mvv(a) + (a.san.includes('+') ? 50 : 0));
  });
}
// Cle d'une position (sans les compteurs de coups) pour le livre et les modeles.
function chessKey(fenOrChess) {
  const f = typeof fenOrChess === 'string' ? fenOrChess : fenOrChess.fen();
  return f.split(' ').slice(0, 4).join(' ');
}

class Timeout extends Error {}
// Recherche : negamax alpha-beta + table de transposition + recherche des
// prises jusqu'au calme (quiescence) pour ne plus perdre une piece au-dela de l'horizon.
function makeSearcher(deadline) {
  const TT = new Map();
  let nodes = 0;
  function quiesce(chess, alpha, beta, qd) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
    const stand = chessEval(chess, chess.turn());
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return stand;
    const caps = orderMoves(chess.moves({ verbose: true }).filter(m => m.captured || m.promotion));
    for (const m of caps) {
      if (stand + P_VAL[m.captured || 'p'] + 200 < alpha && !m.promotion) continue; // prise inutile (delta)
      chess.move(m);
      const sc = -quiesce(chess, -beta, -alpha, qd + 1);
      chess.undo();
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function negamax(chess, depth, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
    if (chess.isCheckmate()) return -MATE + ply;
    if (chess.isDraw()) return 0;
    const inCheck = chess.inCheck ? chess.inCheck() : chess.isCheck();
    if (depth <= 0 && !inCheck) return quiesce(chess, alpha, beta, 0);
    if (depth <= 0) depth = 1; // echec : on prolonge d'un demi-coup
    const key = chess.fen();
    const hit = TT.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === 0) return hit.score;
      if (hit.flag === 1 && hit.score >= beta) return hit.score;
      if (hit.flag === -1 && hit.score <= alpha) return hit.score;
    }
    const a0 = alpha;
    let best = -Infinity, bestMove = null;
    for (const m of orderMoves(chess.moves({ verbose: true }), hit && hit.move)) {
      chess.move(m);
      const sc = -negamax(chess, depth - 1, -beta, -alpha, ply + 1);
      chess.undo();
      if (sc > best) { best = sc; bestMove = m.from + m.to; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    TT.set(key, { depth, score: best, flag: best <= a0 ? -1 : (best >= beta ? 1 : 0), move: bestMove });
    return best;
  }
  return { negamax, quiesce, TT };
}

// Joue le coup du robot. ctx = { book, player } (facultatif) :
//  - book   : livre d'ouvertures commun { cle: { coup: [parties, points] } }, rempli au fil des parties ;
//  - player : modele du joueur en face { cle: { coup: nombre } } (ses habitudes).
function botMoveChess(fen, difficulty = 'hard', ctx = {}) {
  let chess;
  try { chess = new Chess(fen); } catch { return null; }
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const pick = m => ({ from: m.from, to: m.to, promotion: m.promotion || 'q' });

  if (difficulty === 'easy') {
    const caps = moves.filter(m => m.captured);
    if (caps.length && Math.random() < 0.4) return pick(caps[Math.floor(Math.random() * caps.length)]);
    return pick(moves[Math.floor(Math.random() * moves.length)]);
  }

  const hard = difficulty !== 'medium';
  const deadline = Date.now() + (hard ? 800 : 250);
  const maxDepth = hard ? 8 : 2;
  const opening = chess.moveNumber() <= 10;
  const margin = hard ? (opening ? 20 : 12) : 40;
  const S = makeSearcher(deadline);

  // Approfondissement progressif : on garde les scores de la derniere profondeur terminee.
  let scored = orderMoves(moves).map(m => ({ m, s: 0 }));
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      const next = [];
      let top = -Infinity;
      for (const { m } of scored) {
        chess.move(m);
        const lo = top === -Infinity ? -Infinity : top - 60; // fenetre : seuls les coups proches comptent
        const sc = -S.negamax(chess, depth - 1, -Infinity, -lo, 1);
        chess.undo();
        if (sc > top) top = sc;
        next.push({ m, s: sc });
      }
      scored = next.sort((a, b) => b.s - a.s);
      if (top >= MATE - 100) break; // mat trouve
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      try { while (chess.fen() !== fen) chess.undo(); } catch {}
      chess = new Chess(fen);
      break;
    }
  }
  const best = scored[0].s;
  let cands = scored.filter(x => x.s >= best - margin && (best < MATE - 100 || x.s === best));

  // Livre d'ouvertures appris : en ouverture, un coup sur (a 40 points du meilleur)
  // qui a souvent mene a la victoire passe devant.
  const key = chessKey(chess);
  const bk = ctx.book && ctx.book[key];
  if (bk && opening && best < MATE - 100) {
    const safe = scored.filter(x => x.s >= best - 40);
    const rated = safe.map(x => { const st = bk[x.m.from + x.m.to + (x.m.promotion || '')]; return { ...x, r: st && st[0] >= 2 ? (st[1] + 0.5) / (st[0] + 1) : null }; }).filter(x => x.r !== null);
    const good = rated.filter(x => x.r >= 0.55).sort((a, b) => b.r - a.r);
    if (good.length) cands = good.slice(0, 3);
  }

  // Habitudes du joueur : si on sait ce qu'il repond souvent apres un coup, on
  // verifie si cette reponse habituelle est une erreur pour lui, et on la provoque.
  if (ctx.player && cands.length > 1 && best < MATE - 100) {
    const S2 = makeSearcher(Date.now() + 250);
    try {
      cands = cands.slice(0, 6).map(x => {
        chess.move(x.m);
        const habits = ctx.player[chessKey(chess)];
        let exp = x.s;
        if (habits) {
          const tot = Object.values(habits).reduce((a, b) => a + b, 0);
          const [uci, cnt] = Object.entries(habits).sort((a, b) => b[1] - a[1])[0];
          const reply = chess.moves({ verbose: true }).find(r => r.from + r.to + (r.promotion || '') === uci);
          if (reply && tot >= 1) {
            chess.move(reply);
            const v = S2.negamax(chess, 1, -Infinity, Infinity, 2); // score pour le robot apres sa reponse habituelle
            chess.undo();
            const p = Math.min(0.85, cnt / (tot + 1));
            exp = p * v + (1 - p) * x.s;
          }
        }
        chess.undo();
        return { ...x, e: exp };
      });
      const topE = Math.max(...cands.map(x => x.e));
      cands = cands.filter(x => x.e >= topE - 5);
    } catch (e) { chess = new Chess(fen); }
  }
  return pick(cands[Math.floor(Math.random() * cands.length)].m);
}

// ── Apprentissage aux echecs ──
// Livre commun : apres chaque partie, chaque coup des 12 premiers coups recoit le
// resultat du point de vue de celui qui l'a joue (1 gagne, 0,5 nul, 0 perdu).
function chessBookUpdate(book, log, result, maxKeys = 30000) {
  if (!book || !Array.isArray(log)) return;
  for (const e of log) {
    if (e.n > 12) continue;
    if (!book[e.key]) { if (Object.keys(book).length >= maxKeys) continue; book[e.key] = {}; }
    const st = book[e.key][e.uci] || (book[e.key][e.uci] = [0, 0]);
    st[0]++;
    st[1] += result === 'draw' ? 0.5 : (result === e.color ? 1 : 0);
  }
}
// Modele du joueur : on compte ses coups dans chaque position.
function chessLearnPlayer(model, key, uci, maxKeys = 600) {
  if (!model) return;
  if (!model[key]) { if (Object.keys(model).length >= maxKeys) return; model[key] = {}; }
  model[key][uci] = (model[key][uci] || 0) + 1;
}

module.exports = { botMoveTTT, tttLearn, botMoveConnect4, botMoveChess, chessKey, chessBookUpdate, chessLearnPlayer };
