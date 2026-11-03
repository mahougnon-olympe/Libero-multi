// Moteur du jeu de cartes Uno (2 a 10 joueurs). Pur : aucun reseau, aucune horloge.
// Carte : { id, c: 'R'|'Y'|'G'|'B'|'W', v: '0'..'9' | 'S' (passe) | 'R' (sens) | 'D' (+2) | 'W' (joker) | 'F' (joker +4) }
// Etat  : { seats:[ids], hands:{id:[cartes]}, draw:[], discard:[], dir:1|-1, turn:index, color, drawn:null|cardId,
//           called:{id:true}, winner:null|id, seq }
const COLORS = ['R', 'Y', 'G', 'B'];
const MAX_PLAYERS = 10, HAND = 7;
// Regles reglables par l'hote (modeles : classique, chaos, rapide). `hand` = cartes au depart (5 a 10).
const RULE_KEYS = ['stack', 'swap', 'jump', 'drawuntil', 'chal', 'pen4', 'five', 'chain'];
const DEFAULT_OPTS = { stack: false, swap: false, jump: false, drawuntil: false, chal: false, pen4: false, five: false, chain: false, chainSecs: 6, hand: 7 };
const CHAIN_MAX = 4; // « Enchainer les cartes » : 4 cartes au maximum par tour
function normOpts(o, players = MAX_PLAYERS) {
  const out = Object.assign({}, DEFAULT_OPTS);
  if (o && typeof o === 'object') for (const k of RULE_KEYS) if (o[k] != null) out[k] = !!o[k];
  out.chainSecs = [4, 6, 8].includes(Math.floor(+(o && o.chainSecs))) ? Math.floor(+o.chainSecs) : 6;
  const h = Math.floor(+(o && o.hand)); out.hand = Number.isFinite(h) ? Math.max(5, Math.min(10, h)) : 7;
  while (out.hand > 5 && out.hand * players > 90) out.hand--;
  return out;
}

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

function createState(seats, rnd = Math.random, opts) {
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > MAX_PLAYERS) throw new Error('uno: 2 a 10 joueurs');
  const draw = shuffle(buildDeck(), rnd);
  const o = normOpts(opts, seats.length);
  const hands = {}; seats.forEach(id => { hands[id] = []; });
  for (let r = 0; r < o.hand; r++) for (const id of seats) hands[id].push(draw.pop());
  // La premiere carte retournee est toujours un chiffre : pas d'effet au depart.
  let first = draw.pop();
  while (!/^[0-9]$/.test(first.v)) { draw.unshift(first); first = draw.pop(); }
  const turn = Math.floor(rnd() * seats.length);
  return { seats: seats.slice(), hands, draw, discard: [first], dir: 1, turn, color: first.c, drawn: null, called: {}, winner: null, seq: 0, opts: o, pend: null, chain: null };
}

const top = s => s.discard[s.discard.length - 1];
const current = s => s.seats[s.turn];
const nextIdx = (s, from = s.turn, steps = 1) => ((from + s.dir * steps) % s.seats.length + s.seats.length * steps) % s.seats.length;
function playable(s, card) {
  if (s.pend) return !!(s.opts && s.opts.stack) && card.v === s.pend.v;   // une pioche en attente : on ne peut que la renvoyer
  const t = top(s); return card.c === 'W' || card.c === s.color || card.v === t.v;
}
const seatOf = (s, id) => s.seats.indexOf(id);

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
// `target` : siege qui echange sa main avec nous (carte 7, regle « 7 et 0 »).
function play(s, id, cardId, color, uno, rnd = Math.random, target) {
  if (s.winner) return { ok: false, error: 'over' };
  const O = s.opts || DEFAULT_OPTS;
  const hand = s.hands[id]; if (!hand) return { ok: false, error: 'card' };
  const chainPrev = s.chain && s.chain.by === id ? s.chain : null; // « Enchainer les cartes » : on continue sa chaine
  if (s.chain && !chainPrev) s.chain = null;                          // chaine d'un autre (ne devrait pas arriver) : on l'oublie
  if (chainPrev && chainPrev.n >= CHAIN_MAX) return { ok: false, error: 'rule' };
  const i = hand.findIndex(c => c.id === cardId);
  if (i < 0) return { ok: false, error: 'card' };
  const card = hand[i];
  let jumped = false;
  if (current(s) !== id) {
    // Jouer hors tour : la meme carte exacte que celle du dessus (ni joker, ni pioche en attente).
    const t = top(s);
    if (!(O.jump && !s.pend && !s.chain && s.drawn == null && card.c !== 'W' && card.c === t.c && card.v === t.v && card.c === s.color)) return { ok: false, error: 'turn' };
    jumped = true; s.turn = seatOf(s, id);
  }
  if (s.drawn != null && s.drawn !== cardId) return { ok: false, error: 'drawn' };
  if (!playable(s, card)) return { ok: false, error: 'rule' };
  const wild = card.c === 'W';
  if (wild && !COLORS.includes(color)) return { ok: false, error: 'color' };
  const prevColor = s.color;
  hand.splice(i, 1); s.discard.push(card); s.drawn = null;
  s.color = wild ? color : card.c;
  const ev = { t: 'play', seat: seatOf(s, id), card, color: s.color };
  if (jumped) ev.jump = true;
  if (hand.length === 1 && uno) s.called[id] = true;      // UNO annonce avant de poser l'avant-derniere carte
  if (hand.length === 0) { s.winner = id; s.chain = null; ev.win = true; return { ok: true, ev }; }
  // Enchainer : une carte posee ne passe pas la main tant que le joueur peut et veut en poser une autre (effets cumules a la fin).
  const cards = (chainPrev ? chainPrev.cards : []).concat(card);
  const swapCard = O.swap && (card.v === '7' || card.v === '0');
  const goOn = O.chain && !s.pend && !jumped && cards.length < CHAIN_MAX && !wild && !swapCard
    && (hand.length >= 2 || s.called[id]) && hand.some(c => playable(s, c));
  if (goOn) {
    s.chain = { by: id, n: cards.length, cards };
    ev.chain = { n: cards.length, max: CHAIN_MAX };
    if (hand.length !== 1) delete s.called[id];
    return { ok: true, ev };
  }
  s.chain = null;
  let steps = 1;
  if (cards.length > 1) { ev.chainEnd = { n: cards.length }; steps = chainEffects(s, id, cards, ev, O, prevColor, rnd); }
  else if (card.v === 'R') { if (s.seats.length === 2) steps = 2; else s.dir = -s.dir; ev.reverse = true; }
  if (cards.length === 1 && card.v === 'S') { steps = 2; ev.skip = nextIdx(s); }
  if (cards.length === 1 && (card.v === 'D' || card.v === 'F')) {
    const victim = s.seats[nextIdx(s)], n = card.v === 'D' ? 2 : 4;
    if (O.stack || (card.v === 'F' && O.chal)) {
      // La pioche attend la reponse de la victime : renvoyer la meme carte, relever le defi (+4), ou piocher.
      const prev = s.pend && s.pend.v === card.v ? s.pend.n : 0;
      s.pend = { n: prev + n, v: card.v };
      if (card.v === 'F' && O.chal) s.pend.ch = { by: id, had: hand.some(c => c.c !== 'W' && c.c === prevColor), prevColor };
      ev.pend = { n: s.pend.n, v: s.pend.v, seat: seatOf(s, victim), ch: !!s.pend.ch };
    } else { ev.draw = { seat: seatOf(s, victim), cards: drawCards(s, victim, n, rnd) }; steps = 2; }
  }
  // Une carte restante sans UNO annonce : 2 cartes de penalite (4 avec la regle « penalite de 4 »).
  if (hand.length === 1 && !s.called[id]) ev.penalty = { seat: seatOf(s, id), cards: drawCards(s, id, O.pen4 ? 4 : 2, rnd) };
  if (hand.length !== 1) delete s.called[id];
  if (O.swap && card.v === '7') {
    let t = Number.isInteger(target) && target >= 0 && target < s.seats.length && target !== seatOf(s, id) ? target : -1;
    if (t < 0) { let best = 1e9; s.seats.forEach((p, k) => { if (p !== id && s.hands[p].length < best) { best = s.hands[p].length; t = k; } }); }
    const other = s.seats[t], tmp = s.hands[id]; s.hands[id] = s.hands[other]; s.hands[other] = tmp;
    delete s.called[id]; delete s.called[other];
    ev.swap = { from: seatOf(s, id), to: t };
  } else if (O.swap && card.v === '0') {
    const old = s.seats.map(p => s.hands[p]);
    s.seats.forEach((p, k) => { s.hands[s.seats[nextIdx(s, k)]] = old[k]; });
    s.called = {}; ev.rotate = true;
  }
  s.turn = nextIdx(s, s.turn, steps);
  // Regle de la communaute « Cinq cartes » (proposee par warren) : chaque carte posee fait piocher 5 cartes au joueur qui joue ensuite
  // (sauf si une pioche +2/+4 l'attend deja : on n'empile pas).
  if (O.five && !s.pend) { const who = s.seats[s.turn]; ev.five = { seat: s.turn, cards: drawCards(s, who, 5, rnd) }; delete s.called[who]; }
  return { ok: true, ev };
}

// Effets cumules d'une chaine de cartes, appliques une seule fois a la fin du tour. Renvoie le nombre de sieges dont on avance.
// Sens : chaque « Sens inverse » le retourne (a deux joueurs il compte comme un « Passe »). « Passe » : un siege saute par carte.
// Pioche : les +2 / +4 s'additionnent ; la victime est le joueur suivant et saute son tour (un « Passe » dans la chaine est alors absorbe).
function chainEffects(s, id, cards, ev, O, prevColor, rnd = Math.random) {
  const two = s.seats.length === 2;
  let skips = 0, revs = 0, drawN = 0, lastV = null;
  for (const c of cards) {
    if (c.v === 'S') skips++;
    else if (c.v === 'R') revs++;
    else if (c.v === 'D') { drawN += 2; lastV = 'D'; }
    else if (c.v === 'F') { drawN += 4; lastV = 'F'; }
  }
  if (revs) ev.reverse = true;
  if (!two && revs % 2 === 1) s.dir = -s.dir;
  const skipLike = skips + (two ? revs : 0);
  let steps = 1 + skipLike;
  if (skipLike) ev.skip = nextIdx(s);
  if (drawN) {
    const pending = O.stack || (lastV === 'F' && O.chal);
    if (pending) {
      const victim = s.seats[nextIdx(s, s.turn, 1 + skipLike)];
      s.pend = { n: drawN, v: lastV };
      if (lastV === 'F' && O.chal) s.pend.ch = { by: id, had: s.hands[id].some(c => c.c !== 'W' && c.c === prevColor), prevColor };
      ev.pend = { n: drawN, v: lastV, seat: seatOf(s, victim), ch: !!s.pend.ch };
    } else {
      const victim = s.seats[nextIdx(s)];
      ev.draw = { seat: seatOf(s, victim), cards: drawCards(s, victim, drawN, rnd) };
      steps = 1 + Math.max(skipLike, 1);
    }
  }
  return steps;
}
// Fin volontaire (ou par le temps) d'une chaine : on applique les effets cumules et la main passe.
function endChain(s, id, rnd = Math.random) {
  const ch = s.chain;
  if (s.winner || !ch || ch.by !== id || current(s) !== id) return { ok: false, error: 'turn' };
  s.chain = null;
  const ev = { t: 'chainend', seat: seatOf(s, id), chainEnd: { n: ch.cards.length } };
  const steps = chainEffects(s, id, ch.cards, ev, s.opts || DEFAULT_OPTS, s.color, rnd);
  s.turn = nextIdx(s, s.turn, steps);
  if (s.opts && s.opts.five && !s.pend) { const who = s.seats[s.turn]; ev.five = { seat: s.turn, cards: drawCards(s, who, 5, rnd) }; delete s.called[who]; }
  return { ok: true, ev };
}

// Pioche une carte (jamais deux fois de suite). Si elle est jouable on peut la poser ou passer, sinon le tour passe.
// Avec une pioche en attente (+2 / +4), on la prend en entier et le tour passe. « Piocher jusqu'a jouer » : on pioche jusqu'a une carte jouable.
function draw(s, id, rnd = Math.random) {
  if (s.winner) return { ok: false, error: 'over' };
  if (s.chain) return { ok: false, error: 'chain' };
  if (current(s) !== id) return { ok: false, error: 'turn' };
  if (s.drawn != null) return { ok: false, error: 'drawn' };
  const seat = seatOf(s, id);
  if (s.pend) {
    const got = drawCards(s, id, s.pend.n, rnd); s.pend = null;
    s.turn = nextIdx(s); delete s.called[id];
    return { ok: true, ev: { t: 'draw', seat, cards: got, forced: true } };
  }
  const until = !!(s.opts && s.opts.drawuntil);
  let got = [];
  for (let k = 0; k < (until ? 40 : 1); k++) {
    const one = drawCards(s, id, 1, rnd); if (!one.length) break;
    got.push(one[0]); if (playable(s, one[0])) break;
  }
  const ev = { t: 'draw', seat, cards: got };
  const c = got[got.length - 1];
  if (c && playable(s, c)) { s.drawn = c.id; ev.canPlay = c.id; }
  else s.turn = nextIdx(s);
  delete s.called[id];
  return { ok: true, ev };
}
// Defi du +4 : si le joueur avait une carte de la couleur precedente, c'est lui qui pioche ; sinon la victime pioche 2 de plus.
function challenge(s, id, rnd = Math.random) {
  if (s.winner || current(s) !== id || !s.pend || !s.pend.ch) return { ok: false, error: 'turn' };
  const ch = s.pend.ch, n = s.pend.n, victim = seatOf(s, id), by = seatOf(s, ch.by);
  s.pend = null;
  if (ch.had && by >= 0) {
    const cards = drawCards(s, ch.by, n, rnd); s.color = ch.prevColor;
    return { ok: true, ev: { t: 'challenge', seat: victim, won: true, by, draw: { seat: by, cards } } };
  }
  const cards = drawCards(s, id, n + 2, rnd); s.turn = nextIdx(s); delete s.called[id];
  return { ok: true, ev: { t: 'challenge', seat: victim, won: false, by, draw: { seat: victim, cards } } };
}
function pass(s, id) {
  if (s.winner || s.chain || current(s) !== id || s.drawn == null) return { ok: false, error: 'turn' };
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
  if (s.chain && s.chain.by === id) s.chain = null;
  s.draw = shuffle(s.draw.concat(s.hands[id]), rnd);
  delete s.hands[id]; delete s.called[id];
  s.seats.splice(i, 1);
  if (s.seats.length === 1) { s.winner = s.seats[0]; s.turn = 0; return { ok: true }; }
  if (s.dir === 1) s.turn = i < s.turn ? s.turn - 1 : (wasTurn ? i % s.seats.length : s.turn);
  else s.turn = i < s.turn ? s.turn - 1 : (wasTurn ? (i - 1 + s.seats.length) % s.seats.length : s.turn);
  if (wasTurn) { s.drawn = null; s.pend = null; }
  else if (s.pend && s.pend.ch && s.pend.ch.by === id) delete s.pend.ch;
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
  if (s.chain && s.chain.by === id) {            // en pleine chaine : il continue parfois (2 a 3 cartes), sinon il termine son tour
    const more = hand.filter(c => playable(s, c));
    if (!more.length || s.chain.n >= 3 || Math.random() > (s.opts && s.opts.chain ? .6 : 0)) return { act: 'endchain' };
  }
  const cand = s.drawn != null ? hand.filter(c => c.id === s.drawn) : hand.filter(c => playable(s, c));
  if (cand.length) {
    const c = pick(cand), rest = hand.filter(x => x.id !== c.id);
    let target = null;
    if (c.v === '7') { let best = 1e9; s.seats.forEach((p, k) => { if (p !== id && s.hands[p].length < best) { best = s.hands[p].length; target = k; } }); }
    return { act: 'play', cardId: c.id, color: c.c === 'W' ? bestColor(rest) : null, uno: hand.length === 2, target };
  }
  if (s.pend && s.pend.ch && Math.random() < .3) return { act: 'challenge' };
  return s.drawn != null ? { act: 'pass' } : { act: 'draw' };
}

// Vue d'un joueur : sa main en clair, le reste en nombres.
function view(s, id) {
  return {
    hand: (s.hands[id] || []).map(c => ({ id: c.id, c: c.c, v: c.v })),
    counts: s.seats.map(p => s.hands[p].length),
    top: top(s), color: s.color, dir: s.dir, turn: s.turn, drawLeft: s.draw.length, drawn: s.drawn,
    winner: s.winner ? s.seats.indexOf(s.winner) : null, called: s.seats.map(p => !!s.called[p]),
    chain: s.chain ? { n: s.chain.n, by: seatOf(s, s.chain.by) } : null, opts: s.opts || DEFAULT_OPTS, pend: s.pend ? { n: s.pend.n, v: s.pend.v, ch: !!s.pend.ch } : null,
  };
}

module.exports = { CHAIN_MAX, endChain, COLORS, MAX_PLAYERS, RULE_KEYS, DEFAULT_OPTS, normOpts, buildDeck, shuffle, createState, playable, play, draw, challenge, pass, call, forfeit, botAct, view, current };
