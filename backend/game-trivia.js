const https = require('https');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Anglais : Open Trivia DB ───────────────────────────────────────────────────
function fetchQuestionsEN(category, amount = 10, difficulty = '') {
  const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? `&difficulty=${difficulty}` : '';
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${category}&type=multiple&encode=url3986${diff}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 10000);
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          if (json.response_code !== 0) { reject(new Error('code:' + json.response_code)); return; }
          resolve(json.results.map(q => {
            const choices = shuffle([...q.incorrect_answers, q.correct_answer].map(decodeURIComponent));
            return { question: decodeURIComponent(q.question), choices, correct: decodeURIComponent(q.correct_answer) };
          }));
        } catch (e) { reject(e); }
      });
    }).on('error', e => { clearTimeout(timeout); reject(e); });
  });
}

// ── Traduction FR via Google Translate (sans clé) ─────────────────────────────
function translateTextFR(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(text)}`;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(text), 8000);
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          const translated = json[0].map(chunk => chunk[0]).join('');
          resolve(translated || text);
        } catch { resolve(text); }
      });
    }).on('error', () => { clearTimeout(timeout); resolve(text); });
  });
}

// Traduit question + choix en un seul appel API (séparateur |||)
async function translateQuestionFR(q) {
  const correctIdx = q.choices.indexOf(q.correct);
  const SEP = ' ||| ';
  const joined = [q.question, ...q.choices].join(SEP);
  const translated = await translateTextFR(joined);

  let parts = translated.split(SEP);
  if (parts.length !== q.choices.length + 1) {
    parts = translated.split('|||').map(s => s.trim());
  }
  if (parts.length !== q.choices.length + 1) {
    const texts = await Promise.all([q.question, ...q.choices].map(t => translateTextFR(t)));
    parts = texts;
  }

  const tChoices = parts.slice(1, q.choices.length + 1);
  return {
    question: parts[0],
    choices: tChoices,
    correct: tChoices[correctIdx] ?? q.correct,
  };
}

// ── API principale ─────────────────────────────────────────────────────────────
async function fetchQuestions(category, amount = 10, lang = 'fr', difficulty = '') {
  const questions = await fetchQuestionsEN(category, amount, difficulty);
  if (lang !== 'fr') return questions;
  return Promise.all(questions.map(translateQuestionFR));
}

// Requêtes séquentielles pour éviter le rate-limit OpenTDB sur les multi-catégories
async function fetchQuestionsMulti(categories, totalAmount, lang = 'fr', difficulty = '') {
  const perCat = Math.max(2, Math.ceil(totalAmount / categories.length));
  const results = [];
  for (const cat of categories) {
    try {
      const qs = await fetchQuestions(cat, perCat, lang, difficulty);
      results.push(...qs);
    } catch { /* catégorie sans résultats ou rate-limitée, on continue */ }
  }
  if (results.length === 0) throw new Error('no questions');
  return shuffle(results).slice(0, totalAmount);
}

module.exports = { fetchQuestions, fetchQuestionsMulti };
