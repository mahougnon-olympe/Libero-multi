// Moteur du jeu de cartes Uno (2 a 10 joueurs). Pur : aucun reseau, aucune horloge.
// Carte : { id, c: 'R'|'Y'|'G'|'B'|'W', v: '0'..'9' | 'S' (passe) | 'R' (sens) | 'D' (+2) | 'W' (joker) | 'F' (joker +4) }
// Etat  : { seats:[ids], hands:{id:[cartes]}, draw:[], discard:[], dir:1|-1, turn:index, color, drawn:null|cardId,
//           called:{id:true}, winner:null|id, seq }
const COLORS = ['R', 'Y', 'G', 'B'];
const MAX_PLAYERS = 10, HAND = 7;

function buildDeck() {
  const deck = []; let id = 0;
  const add = (c, v, n) => { for (let i = 0; i < n; i++) deck.push({ id: id++, c, v }); };
  for (const c of COLORS) {
    add(c, '0', 1);
    for (let n = 1; n <= 9; n++) add(c, String(n), 2);
    add(c, 'S', 2); add(c, 'R', 2); add(c, 'D', 2);
  }
  add('W', 'W', 4); add('W', 'F', 4);
  return deck;
}
function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function createState(seats, rnd = Math.random) {
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > MAX_PLAYERS) throw new Error('uno: 2 a 10 joueurs');
  const draw = shuffle(buildDeck(), rnd);
  const hands = {}; seats.forEach(id => { hands[id] = []; });
  for (let r = 0; r < HAND; r++) for (const id of seats) hands[id].push(draw.pop());
  // La premiere carte retournee est toujours un chiffre : pas d'effet au depart.
  let first = draw.pop();
  while (!/^[0-9]$/.test(first.v)) { draw.unshift(first); first = draw.pop(); }
  const turn = Math.floor(rnd() * seats.length);
  return { seats: seats.slice(), hands, draw, discard: [first], dir: 1, turn, color: first.c, drawn: null, called: {}, winner: null, seq: 0 };
}

const top = s => s.discard[s.discard.length - 1];
const current = s => s.seats[s.turn];
const nextIdx = (s, from = s.turn, steps = 1) => ((from + s.dir * steps) % s.seats.length + s.seats.length * steps) % s.seats.length;
function playable(s, card) { const t = top(s); return card.c === 'W' || card.c === s.color || card.v === t.v; }

// Pioche n cartes pour un joueur (remelange la defausse si besoin).
function drawCards(s, id, n, rnd = Math.random) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!s.draw.length) {
      if (s.discard.length <= 1) break;
      const keep = s.discard.pop();
      s.draw = shuffle(s.discard, rnd); s.discard = [keep];
    }
    const c = s.draw.pop(); s.hands[id].push(c); got.push(c);
  }
  return got;
}

// Joue une carte. Renvoie { ok, error?, ev } ; ev decrit ce qu'il s'est passe (pour les animations).
function play(s, id, cardId, color, uno, rnd = Math.random) {
  if (s.winner) return { ok: false, error: 'over' };
  if (current(s) !== id) return { ok: false, error: 'turn' };
  const hand = s.hands[id], i = hand.findIndex(c => c.id === cardId);
  if (i < 0) return { ok: false, error: 'card' };
  const card = hand[i];
  if (s.drawn != null && s.drawn !== cardId) return { ok: false, error: 'drawn' };
  if (!playable(s, card)) return { ok: false, error: 'rule' };
  const wild = card.c === 'W';
  if (wild && !COLORS.includes(color)) return { ok: false, error: 'color' };
  hand.splice(i, 1); s.discard.push(card); s.drawn = null;
  s.color = wild ? color : card.c;
  const ev = { t: 'play', seat: s.seats.indexOf(id), card, color: s.color };
  if (hand.length === 1 && uno) s.called[id] = true;      // UNO annonce avant de poser l'avant-derniere carte
  if (hand.length === 0) { s.winner = id; ev.win = true; return { ok: true, ev }; }
  let steps = 1;
  if (card.v === 'R') { if (s.seats.length === 2) steps = 2; else s.dir = -s.dir; ev.reverse = true; }
  if (card.v === 'S') { steps = 2; ev.skip = nextIdx(s); }
  if (card.v === 'D' || card.v === 'F') {
    const victim = s.seats[nextIdx(s)], n = card.v === 'D' ? 2 : 4;
    ev.draw = { seat: s.seats.indexOf(victim), cards: drawCards(s, victim, n, rnd) }; steps = 2;
  }
  // Une carte restante sans UNO annonce : 2 cartes de penalite.
  if (hand.length === 1 && !s.called[id]) ev.penalty = { seat: s.seats.indexOf(id), cards: drawCards(s, id, 2, rnd) };
  if (hand.length !== 1) delete s.called[id];
  s.turn = nextIdx(s, s.turn, steps);
  return { ok: true, ev };
}

// Pioche une carte (jamais deux fois de suite). Si elle est jouable on peut la poser ou passer, sinon le tour passe.
function draw(s, id, rnd = Math.random) {
  if (s.winner) return { ok: false, error: 'over' };
  if (current(s) !== id) return { ok: false, error: 'turn' };
  if (s.drawn != null) return { ok: false, error: 'drawn' };
  const got = drawCards(s, id, 1, rnd);
  const ev = { t: 'draw', seat: s.seats.indexOf(id), cards: got };
  const c = got[0];
  if (c && playable(s, c)) { s.drawn = c.id; ev.canPlay = c.id; }
  else s.turn = nextIdx(s);
  delete s.called[id];
  return { ok: true, ev };
}
function pass(s, id) {
  if (s.winner || current(s) !== id || s.drawn == null) return { ok: false, error: 'turn' };
  s.drawn = null; s.turn = nextIdx(s);
  return { ok: true, ev: { t: 'pass', seat: s.seats.indexOf(id) } };
}
function call(s, id) {
  if (s.winner || !s.hands[id] || s.hands[id].length > 2) return { ok: false, error: 'uno' };
  s.called[id] = true;
  return { ok: true, ev: { t: 'uno', seat: s.seats.indexOf(id) } };
}

// Un joueur abandonne : ses cartes retournent sous la pioche, le jeu continue ; il n'en reste qu'un, il gagne.
function forfeit(s, id, rnd = Math.random) {
  const i = s.seats.indexOf(id);
  if (i < 0 || s.winner) return { ok: false };
  const wasTurn = i === s.turn;
  s.draw = shuffle(s.draw.concat(s.hands[id]), rnd);
  delete s.hands[id]; delete s.called[id];
  s.seats.splice(i, 1);
  if (s.seats.length === 1) { s.winner = s.seats[0]; s.turn = 0; return { ok: true }; }
  if (s.dir === 1) s.turn = i < s.turn ? s.turn - 1 : (wasTurn ? i % s.seats.length : s.turn);
  else s.turn = i < s.turn ? s.turn - 1 : (wasTurn ? (i - 1 + s.seats.length) % s.seats.length : s.turn);
  if (wasTurn) s.drawn = null;
  return { ok: true };
}

// Robot : joue la meilleure carte, sinon pioche (et joue la carte piochee si possible).
function botAct(s, id) {
  const hand = s.hands[id];
  const pick = list => {
    const nextCount = s.hands[s.seats[nextIdx(s)]].length;
    const score = c => (c.c === 'W' ? (nextCount <= 2 ? 5 : -2) : 0) + (['S', 'R', 'D'].includes(c.v) ? (nextCount <= 3 ? 4 : 1) : 0) + (/^\d$/.test(c.v) ? 2 : 0) + (c.c === s.color ? 1 : 0) + (c.v === top(s).v ? .5 : 0);
    return list.slice().sort((a, b) => score(b) - score(a))[0];
  };
  const bestColor = h => { const n = {}; h.forEach(c => { if (c.c !== 'W') n[c.c] = (n[c.c] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || COLORS[Math.floor(Math.random() * 4)]; };
  const cand = s.drawn != null ? hand.filter(c => c.id === s.drawn) : hand.filter(c => playable(s, c));
  if (cand.length) {
    const c = pick(cand), rest = hand.filter(x => x.id !== c.id);
    return { act: 'play', cardId: c.id, color: c.c === 'W' ? bestColor(rest) : null, uno: hand.length === 2 };
  }
  return s.drawn != null ? { act: 'pass' } : { act: 'draw' };
}

// Vue d'un joueur : sa main en clair, le reste en nombres.
function view(s, id) {
  return {
    hand: (s.hands[id] || []).map(c => ({ id: c.id, c: c.c, v: c.v })),
    counts: s.seats.map(p => s.hands[p].length),
    top: top(s), color: s.color, dir: s.dir, turn: s.turn, drawLeft: s.draw.length, drawn: s.drawn,
    winner: s.winner ? s.seats.indexOf(s.winner) : null, called: s.seats.map(p => !!s.called[p]),
  };
}

module.exports = { COLORS, MAX_PLAYERS, buildDeck, shuffle, createState, playable, play, draw, pass, call, forfeit, botAct, view, current };
