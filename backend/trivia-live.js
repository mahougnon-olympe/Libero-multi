// ── Banque RÉSERVÉE au Quiz en direct (tournoi) ──────────────────────────────
// Ces questions n'apparaissent dans AUCUN quiz habituel : personne ne peut s'y
// être entraîné. Elles ne rejoignent la banque normale qu'après le tournoi
// (voir `releaseLive` dans game-trivia.js).
// Ligne : [question FR, question EN, bonne reponse, faux 1, faux 2, faux 3]
// Un choix peut etre bilingue : "texte FR|texte EN". Difficultes : medium, hard, extreme.
const RAW = { benin: {}, history: {}, geography: {}, science: {}, sport: {}, cinema: {}, music: {} };
const T = (theme, level, rows) => { RAW[theme][level] = rows; };
module.exports.RAW = RAW;
module.exports.T = T;

require('./trivia-live-history');
require('./trivia-live-geo-sci');
require('./trivia-live-sport-cine-music');
require('./trivia-live-benin');

const split = s => { const p = String(s).split('|'); return [p[0], p.length > 1 ? p[1] : p[0]]; };
// Format interne identique a trivia-questions.js : { f, fc, e, ec, a:0 } (choix melanges au service).
function expand() {
  const out = {};
  for (const theme of Object.keys(RAW)) {
    out[theme] = {};
    for (const level of Object.keys(RAW[theme])) {
      out[theme][level] = RAW[theme][level].map(([f, e, ...c]) => {
        const ch = c.map(split);
        return { f, e, fc: ch.map(x => x[0]), ec: ch.map(x => x[1]), a: 0 };
      });
    }
  }
  return out;
}
// Garde-fou : on retire toute question du direct qui ressemble a une question de la banque normale
// (meme bonne reponse et au moins 3 mots importants communs, ou meme enonce).
const BANK = require('./trivia-questions');
const norm = s => s.toLowerCase().replace(/[^a-zà-ÿ0-9 ]/g, '').trim();
const words = s => new Set(norm(s).split(' ').filter(w => w.length > 4));
function overlapsBank(q) {
  const w = words(q.f), n = norm(q.f);
  for (const c in BANK) for (const d in BANK[c]) for (const o of BANK[c][d]) {
    if (norm(o.f) === n) return true;
    if (o.fc[o.a] === q.fc[0]) { const ow = words(o.f); let k = 0; w.forEach(x => { if (ow.has(x)) k++; }); if (k >= 3) return true; }
  }
  return false;
}
const FULL = expand();
const LIVE = {};
for (const t in FULL) { LIVE[t] = {}; for (const l in FULL[t]) LIVE[t][l] = FULL[t][l].filter(q => !overlapsBank(q)); }
module.exports.LIVE = LIVE;
module.exports.DROPPED = () => { let n = 0; for (const t in FULL) for (const l in FULL[t]) n += FULL[t][l].length - LIVE[t][l].length; return n; };
module.exports.THEMES = Object.keys(RAW);
module.exports.DRAW_THEMES = Object.keys(RAW).filter(t => t !== 'benin'); // le Benin est toujours au programme, hors tirage
