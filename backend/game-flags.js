// Questions du jeu « Devine le drapeau » pour les salons (les reponses sont des CODES pays : chaque joueur voit le nom dans sa langue).
const F = require('./flags-data');
const CONTINENTS = ['AF', 'EU', 'AS', 'AM', 'OC'];
// niveau : 'easy' (pays connus), 'medium' (connus + courants), 'hard' / 'extreme' / '' (tous)
function pool(level, continent) {
  const maxL = level === 'easy' ? 1 : level === 'medium' ? 2 : 3;
  let list = F.LIST.filter(x => x.l <= maxL);
  if (CONTINENTS.includes(continent)) list = list.filter(x => x.k === continent);
  return list;
}
function pickQuestions({ amount = 10, level = '', continent = '' } = {}) {
  const list = pool(level, continent).slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, Math.min(amount, list.length)).map(x => ({ question: 'flag:' + x.c, flag: x.c, choices: F.choices(x.c, 4), correct: x.c }));
}
module.exports = { pickQuestions, pool, CONTINENTS };
