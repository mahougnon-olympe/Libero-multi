// Jeu de dames : deux regles au choix du createur de la partie.
//  - 'en'   : anglaises (8x8, 12 pions, prise vers l'avant, dame d'une case).
//  - 'intl' : internationales (10x10, 20 pions, prise arriere, dame volante,
//             prise majoritaire, pieces prises retirees a la fin de la rafle).
// Ci-dessous d'abord le moteur anglais (historique), puis l'international.
// Plateau : 64 cases (row-major, row 0 en haut). Cases sombres = (r+c)%2===1.
// Pions : 'r' pion rouge, 'R' dame rouge, 'y' pion jaune, 'Y' dame jaune.
// Rouge (joueur R) part en bas (rangs 5-7) et avance vers le haut (row--).
// Jaune (joueur Y) part en haut (rangs 0-2) et avance vers le bas (row++).

const SIZE = 8;
const idx = (r, c) => r * SIZE + c;
const rc  = i => [Math.floor(i / SIZE), i % SIZE];
const inB = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function enCreateState() {
  const board = Array(64).fill(null);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 !== 1) continue; // seulement les cases sombres
      if (r <= 2)      board[idx(r, c)] = 'y';
      else if (r >= 5) board[idx(r, c)] = 'r';
    }
  }
  return { board, currentPlayer: 'R', mustFrom: null, variant: 'en' };
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
function enGetLegalMoves(state, from) {
  from = parseInt(from, 10);
  const { board, currentPlayer, mustFrom } = state;
  if (ownerOf(board[from]) !== currentPlayer) return [];
  if (mustFrom !== null && mustFrom !== from) return [];
  if (mustFrom !== null) return pieceCaptures(board, from).map(m => m.to);
  if (allCaptures(board, currentPlayer).length) return pieceCaptures(board, from).map(m => m.to);
  return pieceSimple(board, from).map(m => m.to);
}

// Applique un coup {from,to}. Retourne le nouvel état + status/winner, ou null.
function enApplyMove(state, move) {
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

  return { board, currentPlayer: nextPlayer, mustFrom: mustFromNext, status, winner, lastMove: { from, to }, variant: 'en' };
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

function enBotMove(state, diff) {
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
      const after = enApplyMove(state, { from: m.from, to: m.to });
      if (after && after.currentPlayer !== state.currentPlayer) {
        s -= allCaptures(after.board, after.currentPlayer).length * 4; // évite l'exposition
      }
    }
    return { m, s };
  });
  const max = Math.max(...scored.map(x => x.s));
  return _pick(scored.filter(x => x.s === max).map(x => x.m));
}



// ══ Dames internationales (10x10) ═══════════════════════════════════════════
const N = 10;
const iIdx = (r, c) => r * N + c;
const iRc  = i => [Math.floor(i / N), i % N];
const iIn  = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const iPromoRow = pl => (pl === 'R' ? 0 : N - 1);

function intlCreateState() {
  const board = Array(N * N).fill(null);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r <= 3) board[iIdx(r, c)] = 'y';
    else if (r >= 6) board[iIdx(r, c)] = 'r';
  }
  return { board, currentPlayer: 'R', mustFrom: null, variant: 'intl', seqs: null, pendingOver: [] };
}

// Toutes les rafles possibles pour la piece en `from` : listes d'etapes {to, over}.
// Les pieces prises restent sur le damier pendant la rafle (elles bloquent) et ne
// peuvent pas etre sautees deux fois. La case de depart est consideree vide.
function intlSeqsFrom(board, from) {
  const p = board[from]; if (!p) return [];
  const me = ownerOf(p), king = isKing(p);
  const out = [];
  const dfs = (pos, jumped, path) => {
    let extended = false;
    const [r, c] = iRc(pos);
    for (const [dr, dc] of DIAG) {
      if (king) {
        let rr = r + dr, cc = c + dc;
        while (iIn(rr, cc) && (board[iIdx(rr, cc)] === null || iIdx(rr, cc) === from)) { rr += dr; cc += dc; }
        if (!iIn(rr, cc)) continue;
        const over = iIdx(rr, cc), q = board[over];
        if (!q || ownerOf(q) === me || jumped.includes(over)) continue;
        let lr = rr + dr, lc = cc + dc;
        while (iIn(lr, lc) && (board[iIdx(lr, lc)] === null || iIdx(lr, lc) === from)) {
          const to = iIdx(lr, lc);
          extended = true;
          dfs(to, [...jumped, over], [...path, { to, over }]);
          lr += dr; lc += dc;
        }
      } else {
        const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
        if (!iIn(tr, tc)) continue;
        const over = iIdx(mr, mc), q = board[over], to = iIdx(tr, tc);
        if (!q || ownerOf(q) === me || jumped.includes(over)) continue;
        if (board[to] !== null && to !== from) continue;
        extended = true;
        dfs(to, [...jumped, over], [...path, { to, over }]);
      }
    }
    if (!extended && path.length) out.push(path);
  };
  dfs(from, [], []);
  return out;
}
// Rafles legales du joueur : seulement celles qui prennent le PLUS de pieces.
function intlMaxSeqs(board, player) {
  let all = [];
  for (let i = 0; i < N * N; i++) if (ownerOf(board[i]) === player) intlSeqsFrom(board, i).forEach(s => all.push({ from: i, steps: s }));
  if (!all.length) return [];
  const max = Math.max(...all.map(x => x.steps.length));
  return all.filter(x => x.steps.length === max);
}
function intlSimple(board, i) {
  const p = board[i]; if (!p) return [];
  const [r, c] = iRc(i); const out = [];
  if (isKing(p)) {
    for (const [dr, dc] of DIAG) { let rr = r + dr, cc = c + dc; while (iIn(rr, cc) && board[iIdx(rr, cc)] === null) { out.push(iIdx(rr, cc)); rr += dr; cc += dc; } }
  } else {
    const dr = ownerOf(p) === 'R' ? -1 : 1;
    for (const dc of [-1, 1]) { const rr = r + dr, cc = c + dc; if (iIn(rr, cc) && board[iIdx(rr, cc)] === null) out.push(iIdx(rr, cc)); }
  }
  return out;
}
function intlCanMove(board, player) {
  if (intlMaxSeqs(board, player).length) return true;
  for (let i = 0; i < N * N; i++) if (ownerOf(board[i]) === player && intlSimple(board, i).length) return true;
  return false;
}

function intlGetLegalMoves(state, from) {
  from = parseInt(from, 10);
  const { board, currentPlayer, mustFrom } = state;
  if (ownerOf(board[from]) !== currentPlayer) return [];
  if (mustFrom !== null && mustFrom !== undefined) {
    if (mustFrom !== from) return [];
    return [...new Set((state.seqs || []).map(s => s[0].to))];
  }
  const caps = intlMaxSeqs(board, currentPlayer);
  if (caps.length) return [...new Set(caps.filter(x => x.from === from).map(x => x.steps[0].to))];
  return intlSimple(board, from);
}

function intlApplyMove(state, move) {
  const from = parseInt(move.from, 10), to = parseInt(move.to, 10);
  if (isNaN(from) || isNaN(to)) return null;
  const { board: b0, currentPlayer, mustFrom } = state;
  if (ownerOf(b0[from]) !== currentPlayer) return null;
  const midRafle = mustFrom !== null && mustFrom !== undefined;
  if (midRafle && mustFrom !== from) return null;

  let seqs = midRafle ? (state.seqs || []) : null, pending = midRafle ? (state.pendingOver || []).slice() : [];
  if (!midRafle) {
    const caps = intlMaxSeqs(b0, currentPlayer);
    if (caps.length) seqs = caps.filter(x => x.from === from).map(x => x.steps);
  }
  const board = b0.slice();
  const p = board[from];
  let nextSeqs = null, captureDone = false;
  if (seqs) {
    const match = seqs.filter(s => s[0].to === to);
    if (!match.length) return null;
    pending.push(match[0][0].over);
    nextSeqs = match.map(s => s.slice(1)).filter(s => s.length);
    captureDone = !nextSeqs.length;
  } else if (!intlSimple(b0, from).includes(to)) return null;
  board[from] = null; board[to] = p;

  if (seqs && !captureDone) {
    // La rafle continue : meme joueur, meme piece ; pieces prises encore visibles.
    return { board, currentPlayer, mustFrom: to, variant: 'intl', seqs: nextSeqs, pendingOver: pending, status: 'playing', winner: null, lastMove: { from, to } };
  }
  pending.forEach(i => { board[i] = null; });
  // Promotion seulement si le pion TERMINE son coup sur la derniere rangee.
  if (!isKing(p) && iRc(to)[0] === iPromoRow(currentPlayer)) board[to] = currentPlayer === 'R' ? 'R' : 'Y';
  const next = currentPlayer === 'R' ? 'Y' : 'R';
  let status = 'playing', winner = null;
  if (!board.some(x => ownerOf(x) === next) || !intlCanMove(board, next)) { status = 'won'; winner = currentPlayer; }
  return { board, currentPlayer: next, mustFrom: null, variant: 'intl', seqs: null, pendingOver: [], status, winner, lastMove: { from, to } };
}

// Bot international : prend toujours une rafle legale (la regle force le maximum),
// sinon prefere avancer en securite, promouvoir et ne pas offrir de prise.
function intlBotMove(state, diff) {
  const { board, currentPlayer, mustFrom } = state;
  let moves;
  if (mustFrom !== null && mustFrom !== undefined) moves = [...new Set((state.seqs || []).map(s => s[0].to))].map(to => ({ from: mustFrom, to }));
  else {
    const caps = intlMaxSeqs(board, currentPlayer);
    if (caps.length) moves = caps.map(x => ({ from: x.from, to: x.steps[0].to, over: true }));
    else { moves = []; for (let i = 0; i < N * N; i++) if (ownerOf(board[i]) === currentPlayer) intlSimple(board, i).forEach(to => moves.push({ from: i, to })); }
  }
  if (!moves.length) return null;
  if (diff === 'easy') return _pick(moves);
  const scored = moves.map(m => {
    let s = 0;
    const p = board[m.from], [tr, tc] = iRc(m.to);
    if (!isKing(p)) { s += currentPlayer === 'R' ? (N - 1 - tr) * 0.6 : tr * 0.6; if (tr === iPromoRow(currentPlayer)) s += 8; }
    if (tc === 0 || tc === N - 1) s += 0.5; // bord = moins exposé
    const after = intlApplyMove(state, { from: m.from, to: m.to });
    if (after && after.currentPlayer !== currentPlayer) {
      const opp = intlMaxSeqs(after.board, after.currentPlayer);
      const lose = opp.length ? opp[0].steps.length : 0;
      s -= lose * (diff === 'hard' ? 6 : 3);
      if (after.status === 'won') s += 100;
    }
    return { m, s };
  });
  const max = Math.max(...scored.map(x => x.s));
  const best = scored.filter(x => x.s >= max - (diff === 'hard' ? 0.3 : 1.5));
  const m = _pick(best).m;
  return { from: m.from, to: m.to };
}

// ── Aiguillage selon la regle de la partie ──
const isIntl = st => st && st.variant === 'intl';
function createState(variant) { return variant === 'intl' ? intlCreateState() : enCreateState(); }
function getLegalMoves(state, from) { return isIntl(state) ? intlGetLegalMoves(state, from) : enGetLegalMoves(state, from); }
function applyMove(state, move) { return isIntl(state) ? intlApplyMove(state, move) : enApplyMove(state, move); }
function botMove(state, diff) { return isIntl(state) ? intlBotMove(state, diff) : enBotMove(state, diff); }

module.exports = { createState, getLegalMoves, applyMove, botMove };
