// ── Quiz culture générale : banque de questions locale ───────────────────────
// Les questions vivent dans trivia-questions.js (bilingue FR/EN, 3 vraies
// difficultés par thème). Plus d'API externe : fini les répétitions dues aux
// petits pools d'OpenTDB, les difficultés fantaisistes des traductions
// automatiques et le rate-limit qui cassait la sélection multi-thèmes.
const BANK = require('./trivia-questions');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFFS = ['easy', 'medium', 'hard'];

// Toutes les questions d'un thème pour une difficulté donnée ('' = toutes),
// chacune munie d'un id stable `cat:diff:index` (sert à l'anti-répétition).
function poolFor(cat, diff) {
  const catBank = BANK[cat];
  if (!catBank) return [];
  // 'extreme' : questions du pool `extreme` du thème si présent, sinon repli
  // sur les questions `hard` (le chrono raccourci est géré côté serveur).
  let diffs;
  if (diff === 'extreme') diffs = catBank.extreme ? ['extreme'] : ['hard'];
  else diffs = DIFFS.includes(diff) ? [diff] : DIFFS;
  const out = [];
  for (const d of diffs) {
    (catBank[d] || []).forEach((q, i) => out.push({ id: `${cat}:${d}:${i}`, q }));
  }
  return out;
}

// Formate une question pour le jeu : langue choisie, choix mélangés.
function present(entry, lang) {
  const { q } = entry;
  const question = lang === 'en' ? q.e : q.f;
  const choices  = lang === 'en' ? q.ec : q.fc;
  const correct  = choices[q.a];
  return { id: entry.id, question, choices: shuffle(choices), correct };
}

// Sélectionne `amount` questions mélangées sur les thèmes demandés.
// - `seen` (Set d'ids) : questions déjà servies au(x) joueur(s), évitées tant
//   que le pool le permet ; on n'y repioche que si tout a déjà été vu.
// - Multi-thèmes : chaque thème fournit sa part, puis tout est mélangé,
//   pour un vrai mix au lieu d'un seul thème.
function pickQuestions({ cats, amount = 10, lang = 'fr', diff = '', seen = null } = {}) {
  const wanted  = Math.max(1, amount);
  const perCat  = Math.ceil(wanted / cats.length);
  const chosen  = [];
  const leftovers = [];

  for (const cat of cats) {
    const pool    = shuffle(poolFor(cat, diff));
    const unseen  = pool.filter(e => !seen || !seen.has(e.id));
    const already = pool.filter(e => seen && seen.has(e.id));
    const take    = unseen.slice(0, perCat);
    // Pas assez d'inédites dans ce thème : on complète avec des déjà-vues.
    if (take.length < perCat) take.push(...already.slice(0, perCat - take.length));
    chosen.push(...take);
    leftovers.push(...unseen.slice(perCat), ...already.slice(Math.max(0, perCat - unseen.length)));
  }

  // Complète si certains thèmes étaient trop courts, puis mélange le tout.
  let final = chosen;
  if (final.length < wanted) final = final.concat(shuffle(leftovers).slice(0, wanted - final.length));
  final = shuffle(final).slice(0, wanted);
  return final.map(e => present(e, lang));
}

module.exports = { pickQuestions };
