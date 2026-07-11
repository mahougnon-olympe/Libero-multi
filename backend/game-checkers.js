// Jeu de dames (draughts 8x8, 12 pions chacun, prise obligatoire).
// Plateau : 64 cases (row-major, row 0 en haut). Cases sombres = (r+c)%2===1.
// Pions : 'r' pion rouge, 'R' dame rouge, 'y' pion jaune, 'Y' dame jaune.
// Rouge (joueur R) part en bas (rangs 5-7) et avance vers le haut (row--).
// Jaune (joueur Y) part en haut (rangs 0-2) et avance vers le bas (row++).

const SIZE = 8;
const idx = (r, c) => r * SIZE + c;
const rc  = i => [Math.floor(i / SIZE), i % SIZE];
const inB = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function createState() {
  const board = Array(64).fill(null);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 !== 1) continue; // seulement les cases sombres
      if (r <= 2)      board[idx(r, c)] = 'y';
      else if (r >= 5) board[idx(r, c)] = 'r';
    }
  }
  return { board, currentPlayer: 'R', mustFrom: null };
}

const ownerOf = p => !p ? null : (p === 'r' || p === 'R') ? 'R' : 'Y';
const isKing  = p => p === 'R' || p === 'Y';
const promoteRow = player => (player === 'R' ? 0 : 7);

function dirsFor(p) {
  if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return ownerOf(p) === 'R' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

// Prises possibles pour la pièce en i : [{to, over}].
function pieceCaptures(board, i) {
  const p = board[i]; if (!p) return [];
  const [r, c] = rc(i);
  const out = [];
  for (const [dr, dc] of dirsFor(p)) {
    const mr = r + dr, mc = c + dc;         // case sautée
    const tr = r + 2 * dr, tc = c + 2 * dc; // case d'arrivée
    if (!inB(tr, tc)) continue;
    const mid = board[idx(mr, mc)];
    if (mid && ownerOf(mid) !== ownerOf(p) && board[idx(tr, tc)] === null) {
      out.push({ to: idx(tr, tc), over: idx(mr, mc) });
    }
  }
  return out;
}

// Déplacements simples (sans prise) pour la pièce en i : [{to}].
function pieceSimple(board, i) {
  const p = board[i]; if (!p) return [];
  const [r, c] = rc(i);
  const out = [];
  for (const [dr, dc] of dirsFor(p)) {
    const tr = r + dr, tc = c + dc;
    if (inB(tr, tc) && board[idx(tr, tc)] === null) out.push({ to: idx(tr, tc) });
  }
  return out;
}

function allCaptures(board, player) {
  const res = [];
  for (let i = 0; i < 64; i++) if (ownerOf(board[i]) === player) {
    for (const cap of pieceCaptures(board, i)) res.push({ from: i, ...cap });
  }
  return res;
}
function allSimple(board, player) {
  const res = [];
  for (let i = 0; i < 64; i++) if (ownerOf(board[i]) === player) {
    for (const mv of pieceSimple(board, i)) res.push({ from: i, ...mv });
  }
  return res;
}

// Coups légaux (destinations) pour une pièce, en respectant la prise obligatoire
// et la contrainte de multi-prise (mustFrom).
function getLegalMoves(state, from) {
  from = parseInt(from, 10);
  const { board, currentPlayer, mustFrom } = state;
  if (ownerOf(board[from]) !== currentPlayer) return [];
  if (mustFrom !== null && mustFrom !== from) return [];
  if (mustFrom !== null) return pieceCaptures(board, from).map(m => m.to);
  if (allCaptures(board, currentPlayer).length) return pieceCaptures(board, from).map(m => m.to);
  return pieceSimple(board, from).map(m => m.to);
}

// Applique un coup {from,to}. Retourne le nouvel état + status/winner, ou null.
function applyMove(state, move) {
  const from = parseInt(move.from, 10), to = parseInt(move.to, 10);
  if (isNaN(from) || isNaN(to)) return null;
  const { board: b0, currentPlayer, mustFrom } = state;
  if (ownerOf(b0[from]) !== currentPlayer) return null;
  if (mustFrom !== null && mustFrom !== from) return null;

  const forced = allCaptures(b0, currentPlayer);
  let chosen, isCapture = false;
  if (mustFrom !== null || forced.length) {
    chosen = pieceCaptures(b0, from).find(m => m.to === to);
    if (!chosen) return null;
    isCapture = true;
  } else {
    chosen = pieceSimple(b0, from).find(m => m.to === to);
    if (!chosen) return null;
  }

  const board = b0.slice();
  const p = board[from];
  board[from] = null;
  if (isCapture) board[chosen.over] = null;
  board[to] = p;

  // Promotion (termine le tour, même en pleine rafle)
  const [tr] = rc(to);
  let promoted = false;
  if (!isKing(p) && tr === promoteRow(currentPlayer)) {
    board[to] = currentPlayer === 'R' ? 'R' : 'Y';
    promoted = true;
  }

  let nextPlayer = currentPlayer, mustFromNext = null, status = 'playing', winner = null;
  if (isCapture && !promoted && pieceCaptures(board, to).length) {
    mustFromNext = to; // rafle obligatoire avec la même pièce
  } else {
    nextPlayer = currentPlayer === 'R' ? 'Y' : 'R';
    const oppHasPiece = board.some(x => ownerOf(x) === nextPlayer);
    const oppCanMove  = allCaptures(board, nextPlayer).length || allSimple(board, nextPlayer).length;
    if (!oppHasPiece || !oppCanMove) { status = 'won'; winner = currentPlayer; }
  }

  return { board, currentPlayer: nextPlayer, mustFrom: mustFromNext, status, winner, lastMove: { from, to } };
}

// ── Bot ──────────────────────────────────────────────────────────────────────
function _legalMovesForBot(state) {
  const { board, currentPlayer, mustFrom } = state;
  if (mustFrom !== null) return pieceCaptures(board, mustFrom).map(m => ({ from: mustFrom, ...m }));
  const caps = allCaptures(board, currentPlayer);
  if (caps.length) return caps;
  return allSimple(board, currentPlayer);
}
const _pick = a => a[Math.floor(Math.random() * a.length)];

function botMove(state, diff) {
  const moves = _legalMovesForBot(state);
  if (!moves.length) return null;
  if (diff === 'easy') return _pick(moves);

  const scored = moves.map(m => {
    let s = 0;
    if (m.over !== undefined) s += 12;                 // prendre est prioritaire
    const [tr] = rc(m.to);
    const p = state.board[m.from];
    if (!isKing(p) && tr === promoteRow(state.currentPlayer)) s += 6; // promotion
    s += state.currentPlayer === 'R' ? (7 - tr) : tr;  // avancer vers la dame
    if (diff === 'hard') {
      const after = applyMove(state, { from: m.from, to: m.to });
      if (after && after.currentPlayer !== state.currentPlayer) {
        s -= allCaptures(after.board, after.currentPlayer).length * 4; // évite l'exposition
      }
    }
    return { m, s };
  });
  const max = Math.max(...scored.map(x => x.s));
  return _pick(scored.filter(x => x.s === max).map(x => x.m));
}

module.exports = { createState, getLegalMoves, applyMove, botMove };
