require('dotenv').config();
const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const { MongoClient } = require('mongodb');
const connect4   = require('./game');
const tictactoe  = require('./game-tictactoe');
const chessGame  = require('./game-chess');
const checkers   = require('./game-checkers');
const ludo       = require('./game-ludo');
const triviaGame = require('./game-trivia');
const bots       = require('./game-bots');

// Origines autorisées : le(s) domaine(s) du site (variable ALLOWED_ORIGINS, liste
// séparée par des virgules). Si non définie, on retombe sur FRONTEND_URL, sinon
// '*' (utile en développement local). Restreindre l'origine empêche un site tiers
// d'agir sur l'API au nom d'un visiteur.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
function resolveAllowedOrigin(origin) {
  if (!ALLOWED_ORIGINS.length) return '*';           // dev : pas de restriction
  if (origin && ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return origin;
  return ALLOWED_ORIGINS[0];                          // origine par défaut
}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers.origin));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  // En-têtes de sécurité de base
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// `verify` conserve le corps brut : indispensable pour contrôler la signature
// HMAC des webhooks FedaPay (le moindre re-encodage JSON invaliderait la signature).
app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*' } });

const rooms           = new Map();
const leaderboard     = new Map();
const triviaRooms     = new Map();
const triviaLeaderboard = new Map();
const snakeLeaderboard  = new Map();
const luffyLeaderboard  = new Map();
const snakeVotes        = new Map(); // playerId -> 'yes'|'no'
const comments        = [];
const feedVideos      = []; // [{ _id, url, titre, ordre, actif, createdAt }]
const feedBooks       = []; // [{ _id, titre, auteur, categorie, couverture, url, description, ordre, actif, createdAt }]
const suggestions     = []; // [{ _id, title, description, authorId, authorName, up[], down[], status, pinned, createdAt }]
const accounts        = new Map(); // pseudoLower -> { pseudo, salt, hash, playerId, createdAt } (compte optionnel pseudo+mdp)

// ── Livres exclusifs ────────────────────────────────────────────────────────
// Les chapitres vivent dans backend/books/ (jamais sur le site statique) et ne
// sortent que par l'API ; au-delà de `freeChapters`, la suite se débloque en Libs.
const LIBERO_BOOKS = {
  'affaire-endormie': {
    id: 'affaire-endormie',
    titre: "L'Affaire endormie · Tome 1",
    auteur: 'Libero',
    categorie: 'Roman',
    categorieEn: 'Novel',
    description: "Tome 1 de la série. L'agent spécial Yaris Cole, exilé aux archives de Las Vegas, tombe sur un carton d'homicides non résolus qui n'aurait jamais dû respirer à nouveau. Chapitre 1 gratuit · débloque la suite avec tes Libs.",
    descriptionEn: "Volume 1 of the series. Special agent Yaris Cole, exiled to the Las Vegas archives, stumbles upon a box of unsolved homicides that was never meant to breathe again. Chapter 1 is free · unlock the rest with your Libs.",
    totalChapters: 10,
    freeChapters: 1,
    copyright: '© 2026 Libero · Tous droits réservés. Toute reproduction, diffusion ou traduction, même partielle, est interdite sans autorisation écrite de l\'auteur.',
    copyrightEn: '© 2026 Libero · All rights reserved. Any reproduction, distribution or translation, in whole or in part, is prohibited without the author\'s written permission.',
    chapterTitlesEn: {
      1: 'Box No. 7', 2: 'Ten Names on a Wall', 3: 'Widow No. 3', 4: 'Visiting Room',
      5: 'The Case Breathes', 6: 'False Lead', 7: 'The Class Photo', 8: 'The Eleventh Child',
      9: 'The Man Who Hands Out the Boxes', 10: 'The List Is Complete',
    },
    packs: [
      { id: 'p2', price: 1000, from: 2, to: 5,  requires: null },
      { id: 'p3', price: 2000, from: 6, to: 10, requires: 'p2' },
    ],
  },
  'life-of-georgia': {
    id: 'life-of-georgia',
    titre: 'Life of Georgia',
    auteur: "O'Bros",
    categorie: 'Roman',
    categorieEn: 'Novel',
    description: "Une jeune fille d'origine campagnarde découvre, au détour d'une innocente bagarre, des pouvoirs surnaturels qu'elle ignorait. Cette découverte l'attache à quelqu'un qu'elle pourra peut-être changer avec le temps. Débloque le livre entier avec tes Libs.",
    descriptionEn: "A young country girl discovers, in the midst of an innocent fight, supernatural powers she never knew she had. This discovery binds her to someone she may be able to change over time. Unlock the whole book with your Libs.",
    totalChapters: 12,
    freeChapters: 0,
    copyright: '© 2020 O\'Bros · Tous droits réservés. Toute reproduction, diffusion ou traduction, même partielle, est interdite sans autorisation écrite de l\'auteur.',
    copyrightEn: '© 2020 O\'Bros · All rights reserved. Any reproduction, distribution or translation, in whole or in part, is prohibited without the author\'s written permission.',
    chapterTitlesEn: {
      1: 'The Arrival of Georgia', 2: 'The Rape', 3: 'Revenge', 4: 'The Quest for the Fairy Lake',
      5: 'The Wassa Forest', 6: 'The Three Twin Mountains', 7: 'Kadel\'s Shadow',
      8: 'The Village of the Forgotten', 9: 'The Words That Had to Be Said',
      10: 'The Battle of the Lake', 11: 'The Fairies\' Water', 12: 'What We Become',
    },
    packs: [
      { id: 'full', price: 2000, from: 1, to: 12, requires: null },
    ],
  },
  'life-of-georgia-2': {
    id: 'life-of-georgia-2',
    dir: 'life-of-georgia/tome-2',        // les chapitres vivent dans un sous-dossier du tome 1
    titre: "Life of Georgia · Tome 2 : L'Héritière d'Aboula",
    auteur: "O'Bros",
    categorie: 'Roman',
    categorieEn: 'Novel',
    description: "Quinze ans après la chute de Kadel, Georgia a disparu. Naya, seize ans, fuit un mariage arrangé avec un don que personne ne comprend : elle voit la magie, les mensonges et les marques invisibles. Et ce qu'elle voit revenir sur les routes la terrifie. Réservé aux lecteurs qui ont débloqué le Tome 1.",
    descriptionEn: "Fifteen years after Kadel's fall, Georgia has vanished. Naya, sixteen, flees an arranged marriage with a gift nobody understands: she sees magic, lies and invisible marks. And what she sees returning along the roads terrifies her. Reserved for readers who unlocked Volume 1.",
    firstChapter: 13,
    totalChapters: 20,
    freeChapters: 0,
    copyright: '© 2026 O\'Bros · Tous droits réservés. Toute reproduction, diffusion ou traduction, même partielle, est interdite sans autorisation écrite de l\'auteur.',
    copyrightEn: '© 2026 O\'Bros · All rights reserved. Any reproduction, distribution or translation, in whole or in part, is prohibited without the author\'s written permission.',
    chapterTitlesEn: {
      13: 'The Girl Who Saw Too Much', 14: 'The Arranged Marriage', 15: 'The Road and the Mark',
      16: 'Aboula Without Georgia', 17: 'What the Old Witch Knew', 18: 'The Weary Prince',
      19: 'The Stone Prison', 20: "Nobody's Student", 21: 'The Villages That Fell Silent',
      22: 'The Return to Toko', 23: 'The Silent Lake', 24: "Georgia's Trail",
      25: 'The Trap in the Ruins', 26: "Sètondji's Offer", 27: 'The Army of the Marked',
      28: 'The Words That Had to Be Heard', 29: 'The Flaw', 30: 'The Girl Without Magic',
      31: 'The Trial of the Builder', 32: 'What We Pass On',
    },
    // Pas de pack à acheter : l'accès est offert à ceux qui possèdent le tome 1.
    accessVia: { bookId: 'life-of-georgia', packId: 'full' },
    packs: [],
  },
};

// Titre anglais d'un chapitre (« Chapter N: … »), ou null si pas de traduction.
function bookChapterTitleEn(book, num) {
  const t = book.chapterTitlesEn?.[num];
  return t ? `Chapter ${num}: ${t}` : null;
}
const bookChapters = new Map(); // bookId -> Map(num -> { num, titre, content, contentEn })
(function loadBookChapters() {
  for (const book of Object.values(LIBERO_BOOKS)) {
    const dir = path.join(__dirname, 'books', book.dir || book.id);
    const chapters = new Map();
    bookChapters.set(book.id, chapters);
    book.hasCover = fs.existsSync(path.join(dir, 'couverture.jpeg'));
    let files = [];
    // On ne charge que les originaux français ici ; la version anglaise
    // (chapitre-NN.en.md) est associée juste après si le fichier existe.
    try { files = fs.readdirSync(dir).filter(f => /^chapitre-\d+\.md$/.test(f)); }
    catch { console.warn(`⚠️  Dossier livre introuvable : ${dir}`); continue; }
    for (const f of files) {
      const num = parseInt(f.match(/(\d+)/)[1], 10);
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const titleLine = content.split('\n').find(l => /^#{1,2}\s*Chapitre\s+\d+/i.test(l));
      const titre = titleLine ? titleLine.replace(/^#{1,2}\s*/, '').trim() : `Chapitre ${num}`;
      // Traduction anglaise du chapitre, si disponible.
      let contentEn = null;
      const enPath = path.join(dir, `chapitre-${String(num).padStart(2, '0')}.en.md`);
      try { if (fs.existsSync(enPath)) contentEn = fs.readFileSync(enPath, 'utf8'); } catch { /* pas de traduction */ }
      chapters.set(num, { num, titre, content, contentEn });
    }
    const translated = [...chapters.values()].filter(c => c.contentEn).length;
    console.log(`📖 Livre « ${book.titre} » : ${chapters.size} chapitre(s) chargé(s)${translated ? ` (${translated} traduit·s EN)` : ''}.`);
  }
})();

function bookPackFor(book, num) {
  if (num <= (book.freeChapters || 0)) return null; // gratuit
  return book.packs.find(p => num >= p.from && num <= p.to) || null;
}

function canReadChapter(book, entry, num) {
  // Suite réservée : le livre entier n'est lisible que par les détenteurs d'un
  // pack d'un AUTRE livre (ex. le tome 2 est offert aux acheteurs du tome 1).
  if (book.accessVia) {
    const key = `${book.accessVia.bookId}:${book.accessVia.packId}`;
    return !!entry && Array.isArray(entry.ownedBooks) && entry.ownedBooks.includes(key);
  }
  const pack = bookPackFor(book, num);
  if (!pack) return true;
  return !!entry && Array.isArray(entry.ownedBooks) && entry.ownedBooks.includes(`${book.id}:${pack.id}`);
}
const libs            = new Map();
const MAX_BALANCE              = 19999;
const REFUND_CARD_MAX          = 2;
const REFUND_CARD_COOLDOWN_MS  = 30 * 24 * 3600 * 1000;

// ── Codes promo ─────────────────────────────────────────────────────────────
// Définis par la variable d'environnement PROMO_CODES (JSON, ex.
// {"MONCODE":100}) afin de rester HORS du code source public et de pouvoir être
// changés sans redéploiement. Repli sur les valeurs historiques si non définie.
const PROMO_CODES = (() => {
  try {
    const parsed = JSON.parse(process.env.PROMO_CODES || '');
    if (parsed && typeof parsed === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(parsed)) {
        const amt = Math.floor(Number(v));
        if (k && Number.isFinite(amt) && amt > 0) out[String(k).trim().toUpperCase()] = amt;
      }
      if (Object.keys(out).length) return out;
    }
  } catch { /* format invalide → repli */ }
  return { EMAR: 30, NODE: 1000 };
})();
const PROMO_FILL_CODE = (process.env.PROMO_FILL_CODE || 'SDFT').trim().toUpperCase();
const socketPlayerIds = new Map();
const playerIdAliases = new Map();
// Codes cadeaux : un joueur paie un cosmetique pour l'offrir, ce qui genere un
// code que le destinataire echange. code -> { cosmeticId, fromName, createdAt, redeemedBy, redeemedAt }
const giftCodes = new Map();

// Archive des comptes reinitialises : snapshot complet pris juste AVANT la
// suppression. L'admin est prevenu sur le dashboard et peut restituer les
// donnees (sur l'ancien identifiant ou sur le nouveau compte du joueur) ou
// vider le cache. archiveId -> snapshot
const resetArchive = new Map();

// ── Tournoi du samedi ────────────────────────────────────────────────────────
// Chaque samedi (heure du Benin), les joueurs marquent des points de tournoi :
// victoire classique +10, bonne reponse de quiz +2, ⚡ mange au Snake +1.
// A la fin du samedi, le meilleur gagne 2000 Libs et le titre honorifique
// « Champion de la semaine » (garde jusqu'au tournoi suivant).
const TOURNAMENT_REWARD = 2000;
let tournament = { week: null, scores: {}, champion: null }; // scores: pid -> {name, pts}
function _beninDay(ts = Date.now()) { return new Date(ts + 3_600_000); }
function isTournamentDay() { return _beninDay().getUTCDay() === 6; }
function _tournamentTodayKey() { return _beninDay().toISOString().slice(0, 10); }
let _tournamentSaveTimer = null;
function dbSaveTournament() {
  if (!db) return;
  clearTimeout(_tournamentSaveTimer);
  _tournamentSaveTimer = setTimeout(() => {
    db.collection('server_config')
      .updateOne({ _id: 'tournament' }, { $set: { value: JSON.parse(JSON.stringify(tournament)) } }, { upsert: true })
      .catch(() => {});
  }, 2000);
}

// ── Stats quotidiennes (graphiques du dashboard : visites + parties / jour) ──
const dailyStats = new Map(); // 'YYYY-MM-DD' -> { visits, games }
function bumpDaily(field, n = 1) {
  const k = _tournamentTodayKey();
  const d = dailyStats.get(k) || { visits: 0, games: 0 };
  d[field] = (d[field] || 0) + n;
  dailyStats.set(k, d);
  if (db) db.collection('daily_stats').updateOne({ _id: k }, { $inc: { [field]: n } }, { upsert: true }).catch(() => {});
}

// ── Alertes fraude (memoire) : plusieurs comptes neufs depuis la meme IP ────
const fraudAlerts = [];        // { at, msg }
const _ipNewAccounts = new Map(); // ip -> [timestamps]
function recordNewAccount(ip) {
  if (!ip) return;
  const now = Date.now();
  const arr = (_ipNewAccounts.get(ip) || []).filter(t => now - t < 86_400_000);
  arr.push(now);
  _ipNewAccounts.set(ip, arr);
  if (arr.length === 4) { // au 4e compte en 24h, une seule alerte
    const masked = String(ip).replace(/\.\d+$/, '.x');
    fraudAlerts.unshift({ at: now, msg: `4 comptes ou plus créés en 24h depuis la même IP (${masked}).` });
    if (fraudAlerts.length > 50) fraudAlerts.pop();
    adminAlert('🚨 Alerte fraude', `4 comptes ou plus créés en 24h depuis ${masked}.`);
  }
}

// ── Annonces (bandeau News), gerees depuis le dashboard admin ────────────────
const announcements = []; // { _id, text, textEn, at }

// Compteurs globaux de parties solo (Snake / Libero Run), pour le tableau de
// bord admin. Persistes dans server_config (sauvegarde debouncee).
const gameCounters = { snakeGames: 0, luffyGames: 0 };
let _gameCountersTimer = null;
function dbSaveGameCounters() {
  if (!db) return;
  clearTimeout(_gameCountersTimer);
  _gameCountersTimer = setTimeout(() => {
    db.collection('server_config')
      .updateOne({ _id: 'game_counters' }, { $set: { value: { ...gameCounters } } }, { upsert: true })
      .catch(() => {});
  }, 3000);
}

// ── Lecteurs par livre ──────────────────────────────────────────────────────
// Ensemble des joueurs distincts ayant ouvert un livre (livre exclusif ou livre
// du catalogue). Sert à afficher « N lecteurs » sur chaque livre.
const bookReaders = new Map(); // bookId -> Set(playerId)
function bookReaderCount(bookId) { return bookReaders.get(bookId)?.size || 0; }
function dbAddBookReader(bookId, playerId) {
  if (!db) return;
  db.collection('book_readers')
    .updateOne({ _id: bookId }, { $addToSet: { readers: playerId } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde lecteur livre:', e));
}

// ── Achat de Libs avec de l'argent réel (FedaPay) ───────────────────────────
// Le mapping pack → nombre de Libs et le prix vivent UNIQUEMENT côté serveur.
// Le client n'envoie jamais qu'un id de pack, jamais un montant.
const LIBS_PACKS = {
  decouverte: { libs: 250,  bonus: 0,   priceFCFA: 500,  label: 'Pack Découverte : 250 ⚡' },
  populaire:  { libs: 525,  bonus: 25,  priceFCFA: 1000, label: 'Pack Populaire : 525 ⚡ (+25)', featured: true },
  pro:        { libs: 1100, bonus: 100, priceFCFA: 2000, label: 'Pack Pro : 1100 ⚡ (+100)' },
  mega:       { libs: 2300, bonus: 300, priceFCFA: 4000, label: 'Pack Méga : 2300 ⚡ (+300)' },
  ultime:     { libs: 4800, bonus: 800, priceFCFA: 8000, label: 'Pack Ultime : 4800 ⚡ (+800)' },
};
const libsPurchases = new Map(); // transactionId -> { _id, playerId, packId, libsAmount, status, credited, createdAt, updatedAt }
const libsCheckoutRateMap = new Map(); // ip -> [timestamps]

// ── Évent Snake du week-end : les ⚡ mangés créditent le solde de Libs ───────
const snakeLibsGames = new Map(); // socket.id -> { playerId, startedAt, eats, lastEatAt }
function isSnakeEventDay() {
  if (process.env.SNAKE_EVENT_FORCE === '1') return true; // hook de test uniquement
  const d = new Date(Date.now() + 3_600_000).getUTCDay(); // heure du Bénin (UTC+1)
  return d === 5 || d === 6 || d === 0; // vendredi 00:00 → lundi 00:00
}

let rank1Global      = null;
let rank1StreakSince  = 0;

// ── Persistance MongoDB ────────────────────────────────────────────────────
let mongoClient = null;
let db          = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI non définie — scores non persistants entre les redémarrages.');
    return;
  }
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db('libero');
    console.log('✅ MongoDB connecté.');
  } catch (e) {
    console.error('❌ Connexion MongoDB échouée — scores non persistants :', e.message);
    db = null;
  }
}

async function loadData() {
  if (!db) return;
  const [lbDocs, tlbDocs, cmtDocs, slbDocs, llbDocs, libsDocs, aliasDocs, configDocs, voteDocs, feedDocs, bookDocs, purchaseDocs, readerDocs, giftDocs, resetDocs, annDocs, dailyDocs, pushDocs] = await Promise.all([
    db.collection('leaderboard').find().toArray(),
    db.collection('trivia_leaderboard').find().toArray(),
    db.collection('comments').find().sort({ date: 1 }).toArray(),
    db.collection('snake_leaderboard').find().toArray(),
    db.collection('luffy_leaderboard').find().toArray(),
    db.collection('libs').find().toArray(),
    db.collection('player_aliases').find().toArray(),
    db.collection('server_config').find().toArray(),
    db.collection('snake_votes').find().toArray(),
    db.collection('feed_videos').find().toArray(),
    db.collection('feed_books').find().toArray(),
    db.collection('libs_purchases').find().toArray(),
    db.collection('book_readers').find().toArray(),
    db.collection('gift_codes').find().toArray(),
    db.collection('reset_archive').find().toArray(),
    db.collection('announcements').find().sort({ at: -1 }).toArray(),
    db.collection('daily_stats').find().toArray(),
    db.collection('push_subs').find().toArray(),
  ]);
  annDocs.forEach(d => announcements.push({ _id: d._id, text: d.text, textEn: d.textEn || '', at: d.at }));
  // Migration unique : les deux news historiques (codees en dur dans le HTML avant)
  // deviennent des annonces gerables depuis le dashboard (modifier / supprimer).
  const newsSeeded = configDocs.find(d => d._id === 'news_seeded');
  if (!newsSeeded) {
    const seeds = [
      { _id: 'news-book',
        text: '📚 Nouveau dans Lecture : le roman ⭐ L\'Affaire endormie, Tome 1, écrit par le créateur ! Chapitre 1 gratuit, la suite se débloque avec tes Libs.',
        textEn: '📚 New in Reading: the novel ⭐ L\'Affaire endormie, Tome 1, written by the creator! Chapter 1 is free, unlock the rest with your Libs.',
        at: Date.now() - 1 },
      { _id: 'news-georgia',
        text: '⭐ Life of Georgia : la saga exclusive est complète ! Débloque le Tome 1 pour 2000 ⚡ dans la section Lecture, et le Tome 2, « L\'Héritière d\'Aboula », t\'est offert. Disponible en français et en anglais.',
        textEn: '⭐ Life of Georgia: the exclusive saga is complete! Unlock Volume 1 for 2000 ⚡ in the Reading section, and Volume 2, "The Heiress of Aboula", comes free with it. Available in French and English.',
        at: Date.now() },
    ];
    for (const s of seeds) {
      if (!announcements.some(a => a._id === s._id)) {
        announcements.unshift(s);
        db.collection('announcements').insertOne({ ...s }).catch(() => {});
      }
    }
    announcements.sort((a, b) => b.at - a.at);
    db.collection('server_config').updateOne({ _id: 'news_seeded' }, { $set: { value: true } }, { upsert: true }).catch(() => {});
  }
  dailyDocs.forEach(d => dailyStats.set(d._id, { visits: d.visits || 0, games: d.games || 0 }));
  pushDocs.forEach(d => { if (d.sub) pushSubs.set(d._id, d.sub); });
  db.collection('admin_audit').find().sort({ at: -1 }).limit(200).toArray()
    .then(docs => docs.forEach(d => adminAudits.push({ at: d.at, action: d.action, details: d.details || {} })))
    .catch(() => {});
  db.collection('bug_reports').find().sort({ at: 1 }).limit(BUG_REPORT_MAX).toArray()
    .then(docs => docs.forEach(d => bugReports.push({
      id: d.id || String(d.at), text: d.text || '', contact: d.contact || '', name: d.name || '',
      ref: d.ref || '', page: d.page || '', lang: d.lang || 'fr', ua: d.ua || '', at: d.at || 0, resolved: !!d.resolved,
    })))
    .catch(() => {});
  db.collection('server_errors').find().sort({ at: -1 }).limit(SERVER_ERROR_MAX).toArray()
    .then(docs => docs.forEach(d => serverErrors.push({
      id: d.id || String(d.at), at: d.at || 0, where: d.where || 'app', message: d.message || '', stack: d.stack || '',
    })))
    .catch(() => {});
  // Anti-repetition des quiz : restaure les questions deja vues par joueur.
  db.collection('trivia_seen').find().toArray()
    .then(docs => docs.forEach(d => {
      const ids = Array.isArray(d.ids) ? d.ids.slice(-TRIVIA_SEEN_MAX) : [];
      if (d._id && ids.length) triviaSeen.set(d._id, { set: new Set(ids), order: ids.slice() });
    }))
    .catch(() => {});
  resetDocs.forEach(d => resetArchive.set(d._id, d));
  giftDocs.forEach(d => giftCodes.set(d._id, { cosmeticId: d.cosmeticId, fromName: d.fromName || '', createdAt: d.createdAt || Date.now(), redeemedBy: d.redeemedBy || null, redeemedAt: d.redeemedAt || null }));
  lbDocs.forEach(d  => leaderboard.set(d._id, { name: d.name || '', wins: d.wins, losses: d.losses, draws: d.draws }));
  tlbDocs.forEach(d => triviaLeaderboard.set(d._id, { name: d.name || '', points: d.points, games: d.games }));
  cmtDocs.forEach(d => {
    // Les anciens commentaires (sans champ `approved`) sont considérés validés
    // pour ne pas disparaître ; les nouveaux naissent en attente de modération.
    comments.push({ _id: d._id, pseudo: d.pseudo, message: d.message, date: d.date, approved: d.approved !== false, autoDeleteAt: d.autoDeleteAt || null });
    if (Array.isArray(d.likedBy) && d.likedBy.length) commentLikeMap.set(d._id.toString(), new Set(d.likedBy));
  });
  slbDocs.forEach(d => snakeLeaderboard.set(d._id, { name: d.name || '', hs: d.hs }));
  llbDocs.forEach(d => luffyLeaderboard.set(d._id, { name: d.name || '', hs: d.hs }));
  libsDocs.forEach(d => libs.set(d._id, { name: d.name || '', balance: d.balance || 0, lastActive: d.lastActive || Date.now(), pendingBoostHint: d.pendingBoostHint || 0, usedCodes: d.usedCodes || [], ownedCosmetics: d.ownedCosmetics || [], equippedCosmetic: d.equippedCosmetic || null, equippedFont: d.equippedFont || null, equippedBubble: d.equippedBubble || null, equippedBackground: d.equippedBackground || null, equippedNameEffect: d.equippedNameEffect || null, equippedTitle: d.equippedTitle || null, equippedCursorSnake: d.equippedCursorSnake || null, equippedAvatar: d.equippedAvatar || null, equippedP4Token: d.equippedP4Token || null, equippedTtt: d.equippedTtt || null, equippedChess: d.equippedChess || null, equippedSnakeSkin: d.equippedSnakeSkin || null, equippedClickFx: d.equippedClickFx || null, equippedEmojiPack: d.equippedEmojiPack || null, equippedVictoryBan: d.equippedVictoryBan || null, equippedSoundPack: d.equippedSoundPack || null, equippedEmotes: Array.isArray(d.equippedEmotes) ? d.equippedEmotes : (d.equippedEmote ? [d.equippedEmote] : []), refundCardsUsedAt: d.refundCardsUsedAt || [], ownedBooks: d.ownedBooks || [], honorTitle: d.honorTitle || null, pendingHonorModal: d.pendingHonorModal || null, streak: d.streak || null, challenges: d.challenges || null, lifetime: d.lifetime || {}, permClaimed: d.permClaimed || [], referredBy: d.referredBy || null, referralRewarded: !!d.referralRewarded, referrals: d.referrals || 0, xp: d.xp || 0, iq: d.iq ?? null, iqAt: d.iqAt || 0, wheelDay: d.wheelDay || null, friends: Array.isArray(d.friends) ? d.friends : [], friendRequests: Array.isArray(d.friendRequests) ? d.friendRequests : [], pendingGifts: Array.isArray(d.pendingGifts) ? d.pendingGifts : [], giftSentDay: d.giftSentDay || null, vipUntil: d.vipUntil || 0, dailyGiftDay: d.dailyGiftDay || null, badges: Array.isArray(d.badges) ? d.badges : [], onboardRewards: Array.isArray(d.onboardRewards) ? d.onboardRewards : [], history: Array.isArray(d.history) ? d.history : [] }));
  aliasDocs.forEach(d => playerIdAliases.set(d._id, d.canonId));
  voteDocs.forEach(d => snakeVotes.set(d._id, d.vote));
  feedDocs.forEach(d => feedVideos.push({
    _id: d._id, url: d.url, titre: d.titre || '', auteur: d.auteur || '', description: d.description || '',
    ordre: d.ordre || 0, actif: d.actif !== false, pending: !!d.pending,
    submittedBy: d.submittedBy || null, submittedName: d.submittedName || '',
    likes: Array.isArray(d.likes) ? d.likes : [], views: d.views || 0, shares: d.shares || 0,
    comments: Array.isArray(d.comments) ? d.comments : [],
    createdAt: d.createdAt || Date.now(),
  }));
  bookDocs.forEach(d => feedBooks.push({
    _id: d._id, titre: d.titre || '', auteur: d.auteur || '', categorie: d.categorie || '',
    couverture: d.couverture || '', url: d.url || '', description: d.description || '',
    ordre: d.ordre || 0, actif: d.actif !== false, createdAt: d.createdAt || Date.now(),
  }));
  purchaseDocs.forEach(d => libsPurchases.set(d._id, {
    _id: d._id, playerId: d.playerId, packId: d.packId, libsAmount: d.libsAmount || 0,
    status: d.status || 'waiting_payment', credited: !!d.credited,
    createdAt: d.createdAt || Date.now(), updatedAt: d.updatedAt || Date.now(),
  }));
  readerDocs.forEach(d => bookReaders.set(d._id, new Set(Array.isArray(d.readers) ? d.readers : [])));
  const nextDistDoc = configDocs.find(d => d._id === 'nextDistributionAt');
  if (nextDistDoc) nextDistributionAt = nextDistDoc.value;
  const tDoc = configDocs.find(d => d._id === 'tournament');
  if (tDoc?.value) tournament = { week: tDoc.value.week || null, scores: tDoc.value.scores || {}, champion: tDoc.value.champion || null };
  const gcDoc = configDocs.find(d => d._id === 'game_counters');
  if (gcDoc?.value) { gameCounters.snakeGames = gcDoc.value.snakeGames || 0; gameCounters.luffyGames = gcDoc.value.luffyGames || 0; }
  const streakDoc = configDocs.find(d => d._id === 'rank1StreakSince');
  if (streakDoc) rank1StreakSince = streakDoc.value;
  const rank1NameDoc = configDocs.find(d => d._id === 'rank1GlobalName');
  if (rank1NameDoc) rank1Global = rank1NameDoc.value;
  const flashDoc = configDocs.find(d => d._id === 'flash_offer');
  if (flashDoc?.value && flashDoc.value.endsAt > Date.now()) flashOffer = flashDoc.value;
  const shopOvDoc = configDocs.find(d => d._id === 'shop_overrides');
  if (Array.isArray(shopOvDoc?.value)) shopOvDoc.value.forEach(([id, o]) => { if (o && (!o.until || o.until > Date.now())) shopOverrides.set(id, o); });
  const bannedDoc = configDocs.find(d => d._id === 'banned_words');
  if (Array.isArray(bannedDoc?.value)) bannedWords = bannedDoc.value.filter(w => typeof w === 'string');
  const bpoDoc = configDocs.find(d => d._id === 'book_price_overrides');
  if (bpoDoc?.value && typeof bpoDoc.value === 'object') bookPriceOverrides = bpoDoc.value;
  const alertDoc = configDocs.find(d => d._id === 'admin_alert_subs');
  if (Array.isArray(alertDoc?.value)) adminAlertSubs = alertDoc.value.filter(x => typeof x === 'string');
  const maintDoc = configDocs.find(d => d._id === 'maintenance');
  if (maintDoc?.value && typeof maintDoc.value === 'object') maintenance = { on: !!maintDoc.value.on, message: maintDoc.value.message || '', messageEn: maintDoc.value.messageEn || '' };
  db.collection('scheduled_tasks').find().toArray()
    .then(docs => { scheduledTasks = docs.map(d => ({ id: d.id || d._id, kind: d.kind, at: d.at || 0, fireAt: d.fireAt || 0, done: !!d.done, title: d.title || '', body: d.body || '', text: d.text || '', textEn: d.textEn || '', segment: d.segment || 'all' })); })
    .catch(() => {});
  db.collection('admin_challenges').find().toArray()
    .then(docs => { adminChallenges = docs.map(d => ({ _id: d._id, kind: d.kind, metric: d.metric, goal: d.goal, reward: d.reward, label: d.label, labelEn: d.labelEn || '', at: d.at })); })
    .catch(() => {});
  db.collection('accounts').find().toArray()
    .then(docs => docs.forEach(d => accounts.set(d._id, { pseudo: d.pseudo, salt: d.salt, hash: d.hash, playerId: d.playerId, createdAt: d.createdAt })))
    .catch(() => {});
  db.collection('suggestions').find().toArray()
    .then(docs => docs.forEach(d => suggestions.push({
      _id: d._id, title: d.title || '', description: d.description || '',
      authorId: d.authorId || null, authorName: d.authorName || 'Anonyme',
      up: Array.isArray(d.up) ? d.up : [], down: Array.isArray(d.down) ? d.down : [],
      status: d.status || 'open', pinned: !!d.pinned, reply: d.reply || '', createdAt: d.createdAt || Date.now(),
    })))
    .catch(() => {});
  console.log(`📦 Chargé: ${lbDocs.length} classique, ${tlbDocs.length} quiz, ${slbDocs.length} snake, ${llbDocs.length} luffy, ${cmtDocs.length} commentaires, ${libsDocs.length} libs, ${aliasDocs.length} alias, ${voteDocs.length} votes snake, ${feedDocs.length} vidéos feed, ${bookDocs.length} livres, ${purchaseDocs.length} achats Libs.`);
}

function dbUpsertLeaderboard(id, entry) {
  if (!db) return;
  db.collection('leaderboard')
    .updateOne({ _id: id }, { $set: { name: entry.name, wins: entry.wins, losses: entry.losses, draws: entry.draws } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde classement:', e));
}

function dbUpsertTriviaLeaderboard(id, entry) {
  if (!db) return;
  db.collection('trivia_leaderboard')
    .updateOne({ _id: id }, { $set: { name: entry.name, points: entry.points, games: entry.games } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde classement quiz:', e));
}

function dbUpsertSnakeLeaderboard(id, entry) {
  if (!db) return;
  db.collection('snake_leaderboard')
    .updateOne({ _id: id }, { $set: { name: entry.name, hs: entry.hs } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde classement snake:', e));
}

function dbUpsertLuffyLeaderboard(id, entry) {
  if (!db) return;
  db.collection('luffy_leaderboard')
    .updateOne({ _id: id }, { $set: { name: entry.name, hs: entry.hs } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde classement luffy:', e));
}

function safePlayerId(id) {
  const raw = typeof id === 'string' && id.trim() ? id.trim().slice(0, 64) : null;
  if (!raw) return null;
  return playerIdAliases.get(raw) || raw;
}

// Assainit un pseudo AVANT stockage : retire les caractères HTML/contrôle pour
// qu'aucun nom ne puisse injecter de code dans un classement, un salon ou le chat
// (défense côté serveur, au point d'entrée unique — les rendus restent sûrs
// quelle que soit la page).
function sanitizeName(name, fallback = '') {
  const cleaned = String(name == null ? '' : name)
    .replace(/[<>&"'` -]/g, '')
    .trim()
    .slice(0, 20)
    .trim();
  // Auto-moderation : un pseudo contenant un mot interdit est refuse (repli).
  if (cleaned && containsBanned(cleaned)) return fallback;
  return cleaned || fallback;
}

function dbUpsertAlias(from, to) {
  if (!db) return;
  db.collection('player_aliases')
    .updateOne({ _id: from }, { $set: { canonId: to } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde alias:', e));
}

function dbInsertComment(comment) {
  if (!db) return;
  db.collection('comments')
    .insertOne(comment)
    .catch(e => console.error('Erreur sauvegarde commentaire:', e));
}

// Supprime des commentaires (modération admin).
function dbDeleteComments(ids) {
  if (!db || !ids.length) return;
  db.collection('comments')
    .deleteMany({ _id: { $in: ids } })
    .catch(e => console.error('Erreur suppression commentaire:', e));
}

// Persiste le statut de modération (validé / masqué) d'un commentaire.
function dbUpdateCommentApproved(commentId, approved) {
  if (!db || !commentId) return;
  db.collection('comments')
    .updateOne({ _id: commentId }, { $set: { approved } })
    .catch(e => console.error('Erreur mise à jour modération commentaire:', e));
}

// Persiste la minuterie de suppression automatique d'un commentaire.
function dbUpdateCommentAutoDelete(commentId, autoDeleteAt) {
  if (!db || !commentId) return;
  db.collection('comments')
    .updateOne({ _id: commentId }, { $set: { autoDeleteAt } })
    .catch(e => console.error('Erreur mise à jour minuterie commentaire:', e));
}

// Persiste la liste des joueurs ayant liké : les likes survivent aux redémarrages.
function dbUpdateCommentLikes(commentId, likedBy) {
  if (!db || !commentId) return;
  db.collection('comments')
    .updateOne({ _id: commentId }, { $set: { likedBy } })
    .catch(e => console.error('Erreur sauvegarde likes commentaire:', e));
}

function dbInsertFeedVideo(video) {
  if (!db) return;
  db.collection('feed_videos')
    .insertOne(video)
    .catch(e => console.error('Erreur sauvegarde vidéo feed:', e));
}

function dbDeleteFeedVideo(id) {
  if (!db) return;
  db.collection('feed_videos')
    .deleteOne({ _id: id })
    .catch(e => console.error('Erreur suppression vidéo feed:', e));
}

function dbUpdateFeedVideo(id, fields) {
  if (!db) return;
  db.collection('feed_videos')
    .updateOne({ _id: id }, { $set: fields })
    .catch(e => console.error('Erreur mise a jour vidéo feed:', e));
}

function dbInsertSuggestion(s) {
  if (!db) return;
  db.collection('suggestions').insertOne(s).catch(e => console.error('Erreur sauvegarde suggestion:', e));
}
function dbUpdateSuggestion(id, fields) {
  if (!db) return;
  db.collection('suggestions').updateOne({ _id: id }, { $set: fields }).catch(e => console.error('Erreur mise a jour suggestion:', e));
}
function dbDeleteSuggestion(id) {
  if (!db) return;
  db.collection('suggestions').deleteOne({ _id: id }).catch(e => console.error('Erreur suppression suggestion:', e));
}

function dbInsertFeedBook(book) {
  if (!db) return;
  db.collection('feed_books')
    .insertOne(book)
    .catch(e => console.error('Erreur sauvegarde livre:', e));
}

function dbDeleteFeedBook(id) {
  if (!db) return;
  db.collection('feed_books')
    .deleteOne({ _id: id })
    .catch(e => console.error('Erreur suppression livre:', e));
}

function dbUpsertLibsPurchase(cartId, purchase) {
  if (!db) return;
  db.collection('libs_purchases')
    .updateOne({ _id: cartId }, { $set: {
      playerId: purchase.playerId, packId: purchase.packId, libsAmount: purchase.libsAmount,
      status: purchase.status, credited: purchase.credited,
      createdAt: purchase.createdAt, updatedAt: purchase.updatedAt,
    } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde achat Libs:', e));
}

function dbUpsertLibs(id, entry) {
  if (!db) return;
  db.collection('libs')
    .updateOne({ _id: id }, { $set: { name: entry.name, balance: entry.balance, lastActive: entry.lastActive, pendingBoostHint: entry.pendingBoostHint, usedCodes: entry.usedCodes || [], ownedCosmetics: entry.ownedCosmetics || [], equippedCosmetic: entry.equippedCosmetic || null, equippedFont: entry.equippedFont || null, equippedBubble: entry.equippedBubble || null, equippedBackground: entry.equippedBackground || null, equippedNameEffect: entry.equippedNameEffect || null, equippedTitle: entry.equippedTitle || null, equippedCursorSnake: entry.equippedCursorSnake || null, equippedAvatar: entry.equippedAvatar || null, equippedP4Token: entry.equippedP4Token || null, equippedTtt: entry.equippedTtt || null, equippedChess: entry.equippedChess || null, equippedSnakeSkin: entry.equippedSnakeSkin || null, equippedClickFx: entry.equippedClickFx || null, equippedEmojiPack: entry.equippedEmojiPack || null, equippedVictoryBan: entry.equippedVictoryBan || null, equippedSoundPack: entry.equippedSoundPack || null, equippedEmotes: entry.equippedEmotes || [], refundCardsUsedAt: entry.refundCardsUsedAt || [], ownedBooks: entry.ownedBooks || [], honorTitle: entry.honorTitle || null, pendingHonorModal: entry.pendingHonorModal || null, streak: entry.streak || null, challenges: entry.challenges || null, lifetime: entry.lifetime || {}, permClaimed: entry.permClaimed || [], referredBy: entry.referredBy || null, referralRewarded: !!entry.referralRewarded, referrals: entry.referrals || 0, xp: entry.xp || 0, iq: entry.iq ?? null, iqAt: entry.iqAt || 0, wheelDay: entry.wheelDay || null, friends: entry.friends || [], friendRequests: entry.friendRequests || [], pendingGifts: entry.pendingGifts || [], giftSentDay: entry.giftSentDay || null, vipUntil: entry.vipUntil || 0, dailyGiftDay: entry.dailyGiftDay || null, badges: entry.badges || [], onboardRewards: entry.onboardRewards || [], history: Array.isArray(entry.history) ? entry.history.slice(0, 20) : [] } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde libs:', e));
}

// ── FedaPay : achat de Libs avec de l'argent réel ───────────────────────────
// Aucune requête FedaPay n'est jamais faite depuis le frontend : la clé secrète
// (FEDAPAY_SECRET_KEY) reste strictement côté serveur. L'environnement (sandbox
// ou live) se déduit du préfixe de la clé (sk_sandbox_… / sk_live_…).
function fedapayApiBase() {
  if (process.env.FEDAPAY_API_BASE) return process.env.FEDAPAY_API_BASE; // tests locaux
  const key = process.env.FEDAPAY_SECRET_KEY || '';
  return key.startsWith('sk_live') ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
}

async function fedapayRequest(method, path, body) {
  const key = process.env.FEDAPAY_SECRET_KEY;
  if (!key) throw new Error('FEDAPAY_SECRET_KEY non configurée');
  const res = await fetch(`${fedapayApiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `FedaPay ${method} ${path} → ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Statuts FedaPay (pending/approved/declined/canceled/…) → statuts internes,
// pour que le frontend et l'historique d'achats gardent le même vocabulaire
// qu'avant (waiting_payment/completed/payment_failed/abandoned).
function normalizeFedapayStatus(status) {
  switch (status) {
    case 'approved':    return 'completed';
    case 'pending':     return 'waiting_payment';
    case 'declined':    return 'payment_failed';
    case 'canceled':
    case 'expired':     return 'abandoned';
    default:            return status || 'waiting_payment';
  }
}

// Crée la transaction FedaPay puis génère le lien de paiement.
async function createFedapayCheckout({ amountFCFA, description, email, firstName, lastName, phone, meta }) {
  const frontendUrl = process.env.FRONTEND_URL;
  const txBody = {
    description,
    amount: amountFCFA,
    currency: { iso: 'XOF' },
    custom_metadata: meta,
    customer: {
      firstname: firstName,
      lastname:  lastName,
      email,
      ...(phone ? { phone_number: { number: phone, country: 'bj' } } : {}),
    },
  };
  if (frontendUrl) txBody.callback_url = `${frontendUrl.replace(/\/$/, '')}/?libs_return=1`;
  const created = await fedapayRequest('POST', '/transactions', txBody);
  const tx = created['v1/transaction'] || created.transaction || created;
  if (!tx?.id) throw new Error('Réponse FedaPay inattendue à la création de transaction');
  const tokenRes = await fedapayRequest('POST', `/transactions/${tx.id}/token`);
  const paymentUrl = tokenRes.url || tokenRes['v1/token']?.url;
  if (!paymentUrl) throw new Error('FedaPay n\'a pas renvoyé d\'URL de paiement');
  return { transaction: tx, paymentUrl };
}

async function fetchFedapayTransaction(transactionId) {
  const data = await fedapayRequest('GET', `/transactions/${encodeURIComponent(transactionId)}`);
  return data['v1/transaction'] || data.transaction || data;
}

// Crédit atomique — SEUL point de garde contre le double crédit.
// Les appelants (verify + relance périodique) vérifient déjà `credited` avant
// leur propre appel réseau (await), mais deux vérifications concurrentes du
// même panier peuvent toutes deux passer ce premier test avant que l'une des
// deux ne crédite. Comme cette fonction ne contient aucun `await`, elle
// s'exécute sans céder la main : re-vérifier `credited` ici, en tout premier,
// ferme cette fenêtre de course — la seconde exécution s'arrête net.
// Source de vérité unique — jamais déclenché par le simple retour du navigateur.
function creditLibsPurchase(purchase) {
  if (purchase.credited) return false;
  const entry = getLibsEntry(purchase.playerId);
  if (!entry) return false;
  entry.balance = Math.min(MAX_BALANCE, entry.balance + purchase.libsAmount);
  libs.set(purchase.playerId, entry);
  dbUpsertLibs(purchase.playerId, entry);
  purchase.credited  = true;
  purchase.status    = 'completed';
  purchase.updatedAt = Date.now();
  libsPurchases.set(purchase._id, purchase);
  dbUpsertLibsPurchase(purchase._id, purchase);
  for (const [sockId, pid] of socketPlayerIds.entries()) {
    if (pid === purchase.playerId) io.to(sockId).emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: purchase.libsAmount, nextAt: nextDistributionAt });
  }
  console.log(`[💳] +${purchase.libsAmount} Libs crédités (achat FedaPay ${purchase._id}) → ${entry.name || purchase.playerId}`);
  adminAlert('💳 Nouvel achat', `${entry.name || 'Un joueur'} a acheté ${purchase.libsAmount} Libs.`);
  return true;
}

// ── Défis quotidiens · Série de connexion · Historique de parties ───────────
// Jour calendaire à l'heure du Bénin (UTC+1), au format AAAA-MM-JJ.
function _dayKey(offsetDays = 0) {
  return new Date(Date.now() + 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

// Envoie un événement à tous les sockets actifs d'un joueur donné.
function _emitToPlayer(id, event, payload) {
  for (const [sockId, pid] of socketPlayerIds.entries()) {
    if (pid === id) io.to(sockId).emit(event, payload);
  }
}

// Trois défis par jour ; les compteurs se réinitialisent chaque jour.
// Chaque « slot » possède plusieurs variantes qui tournent avec le jour :
// un joueur ne refait donc jamais le même défi deux jours de suite.
// Le 3ᵉ slot dépend du jour : Snake le week-end (évent), Luffy Runner en semaine.
const CHALLENGE_POOL = {
  A: [ // parties classiques
    { id: 'wins3', metric: 'gamesWon',    goal: 3, reward: 40 },
    { id: 'play5', metric: 'gamesPlayed', goal: 5, reward: 35 },
  ],
  B: [ // quiz culture générale
    { id: 'trivia5',  metric: 'triviaCorrect', goal: 5,  reward: 40 },
    { id: 'trivia12', metric: 'triviaCorrect', goal: 12, reward: 60 },
    { id: 'quiz2',    metric: 'triviaGames',   goal: 2,  reward: 35 },
  ],
  WEEKEND: [ // évent Snake
    { id: 'snake30', metric: 'snakeEaten', goal: 30, reward: 50 },
    { id: 'snake60', metric: 'snakeEaten', goal: 60, reward: 80 },
  ],
  WEEKDAY: [ // Luffy Runner
    { id: 'luffy12000', metric: 'luffyRun',   goal: 12000, reward: 50 },
    { id: 'luffyGames3', metric: 'luffyGames', goal: 3,    reward: 35 },
  ],
};
const CHALLENGE_METRICS = ['gamesWon', 'gamesPlayed', 'triviaCorrect', 'triviaGames', 'snakeEaten', 'luffyRun', 'luffyGames', 'wheelSpins', 'ludoWins', 'giftsSent'];
const CHALLENGE_ALL_DONE_BONUS = 30; // bonus « journée parfaite » quand les 3 défis sont réclamés

// ── Défis permanents ─────────────────────────────────────────────────────────
// Contrairement aux défis du jour, la progression ne se remet JAMAIS à zéro
// (compteurs à vie dans entry.lifetime). Objectifs volontairement très durs,
// récompenses à la hauteur (jusqu'à 5000 ⚡). Réclamables une seule fois.
const PERMANENT_CHALLENGES = [
  { id: 'perm_wins50',     metric: 'gamesWon',      goal: 50,      reward: 500  },
  { id: 'perm_wins250',    metric: 'gamesWon',      goal: 250,     reward: 2500 },
  { id: 'perm_play500',    metric: 'gamesPlayed',   goal: 500,     reward: 3000 },
  { id: 'perm_trivia1000', metric: 'triviaCorrect', goal: 1000,    reward: 3500 },
  { id: 'perm_snake2000',  metric: 'snakeEaten',    goal: 2000,    reward: 2500 },
  { id: 'perm_luffy500k',  metric: 'luffyRun',      goal: 500_000, reward: 4000 },
  { id: 'perm_streak30',   metric: 'streakDays',    goal: 30,      reward: 5000 },
  { id: 'perm_wheel30',    metric: 'wheelSpins',    goal: 30,      reward: 800  },
  { id: 'perm_ludo25',     metric: 'ludoWins',      goal: 25,      reward: 1500 },
  { id: 'perm_gift5',      metric: 'giftsSent',     goal: 5,       reward: 1000 },
];

// Defis crees par l'admin depuis le dashboard (quotidiens ou permanents),
// avec libelle FR/EN, metrique, objectif et recompense. Mongo `admin_challenges`.
let adminChallenges = []; // { _id, kind:'daily'|'permanent', metric, goal, reward, label, labelEn, at }
function adminDaily()     { return adminChallenges.filter(c => c.kind === 'daily'); }
function adminPermanent() { return adminChallenges.filter(c => c.kind === 'permanent'); }

function getLifetime(entry) {
  if (!entry.lifetime || typeof entry.lifetime !== 'object') entry.lifetime = {};
  return entry.lifetime;
}

// ── Badges / hauts faits (calcules depuis les stats, non stockes) ────────────
// Renvoie la liste des badges obtenus par un joueur, pour la fiche joueur et le
// profil. Chaque badge : { id, icon, label (fr), labelEn }.
const BADGE_DEFS = [
  { id: 'level10', icon: '🎓', label: 'Niveau 10',        labelEn: 'Level 10',        test: c => c.level >= 10 },
  { id: 'level25', icon: '🏅', label: 'Niveau 25',        labelEn: 'Level 25',        test: c => c.level >= 25 },
  { id: 'level50', icon: '👑', label: 'Niveau 50',        labelEn: 'Level 50',        test: c => c.level >= 50 },
  { id: 'win1',    icon: '⚔️', label: 'Première victoire', labelEn: 'First win',       test: c => c.wins >= 1 },
  { id: 'win25',   icon: '🛡️', label: '25 victoires',     labelEn: '25 wins',         test: c => c.wins >= 25 },
  { id: 'win100',  icon: '🏆', label: '100 victoires',    labelEn: '100 wins',        test: c => c.wins >= 100 },
  { id: 'quiz500', icon: '🧠', label: 'Cerveau (500 pts quiz)', labelEn: 'Brain (500 quiz pts)', test: c => c.quizPoints >= 500 },
  { id: 'snake50', icon: '🐍', label: 'Serpent d\'or (50)', labelEn: 'Golden snake (50)', test: c => c.snakeHs >= 50 },
  { id: 'streak7', icon: '🔥', label: 'Série de 7 jours',  labelEn: '7-day streak',    test: c => c.streak >= 7 },
  { id: 'streak30',icon: '☄️', label: 'Série de 30 jours', labelEn: '30-day streak',   test: c => c.streak >= 30 },
  { id: 'vip',     icon: '💎', label: 'Membre VIP',        labelEn: 'VIP member',      test: c => c.vip },
  { id: 'friend5', icon: '🤝', label: '5 amis',            labelEn: '5 friends',       test: c => c.friends >= 5 },
  { id: 'ref1',    icon: '📣', label: 'Parrain',           labelEn: 'Referrer',        test: c => c.referrals >= 1 },
  { id: 'iq',      icon: '🧩', label: 'Test de QI passé',  labelEn: 'IQ test taken',   test: c => c.iq },
  { id: 'wheel',   icon: '🎡', label: 'Roue tournée',      labelEn: 'Spun the wheel',  test: c => c.wheelSpins >= 1 },
];
function computeBadges(pid, entry) {
  const lt = getLifetime(entry);
  const lb = leaderboard.get(pid) || {};
  const ctx = {
    level: levelFromXp(entry.xp || 0),
    wins: (lb.wins || 0),
    quizPoints: (triviaLeaderboard.get(pid)?.points || 0),
    snakeHs: (snakeLeaderboard.get(pid)?.hs || 0),
    streak: (entry.streak?.longest || entry.streak?.count || 0),
    vip: (entry.vipUntil || 0) > Date.now(),
    friends: (entry.friends || []).length,
    referrals: entry.referrals || 0,
    iq: entry.iq != null,
    wheelSpins: lt.wheelSpins || 0,
  };
  return BADGE_DEFS.filter(b => { try { return b.test(ctx); } catch { return false; } })
    .map(b => ({ id: b.id, icon: b.icon, label: b.label, labelEn: b.labelEn }));
}

function allPermanentChallenges() {
  return [
    ...PERMANENT_CHALLENGES,
    ...adminPermanent().map(c => ({ id: c._id, metric: c.metric, goal: c.goal, reward: c.reward, label: c.label, labelEn: c.labelEn })),
  ];
}
function permanentPayload(entry) {
  const lt = getLifetime(entry);
  const claimed = Array.isArray(entry.permClaimed) ? entry.permClaimed : [];
  return allPermanentChallenges().map(ch => ({
    id: ch.id, goal: ch.goal, reward: ch.reward, label: ch.label, labelEn: ch.labelEn,
    progress: Math.min(ch.goal, lt[ch.metric] || 0),
    done: (lt[ch.metric] || 0) >= ch.goal,
    claimed: claimed.includes(ch.id),
  }));
}

// Liste des défis actifs du jour : la variante de chaque slot tourne avec le
// numéro du jour (heure du Bénin), donc change forcément d'un jour à l'autre.
function activeChallenges() {
  const dayNum = Math.floor((Date.now() + 3_600_000) / 86_400_000);
  const slotC  = isSnakeEventDay() ? CHALLENGE_POOL.WEEKEND : CHALLENGE_POOL.WEEKDAY;
  return [
    CHALLENGE_POOL.A[dayNum % CHALLENGE_POOL.A.length],
    CHALLENGE_POOL.B[dayNum % CHALLENGE_POOL.B.length],
    slotC[dayNum % slotC.length],
    // Defis quotidiens crees par l'admin : actifs tous les jours tant qu'ils
    // existent (les compteurs et reclamations, eux, se remettent a zero chaque jour).
    ...adminDaily().map(c => ({ id: c._id, metric: c.metric, goal: c.goal, reward: c.reward, label: c.label, labelEn: c.labelEn })),
  ];
}

function getChallenges(entry) {
  const today = _dayKey();
  if (!entry.challenges || entry.challenges.date !== today) {
    entry.challenges = { date: today, progress: {}, claimed: [] };
  }
  // Garantit que tous les compteurs existent (rétro-compat après un déploiement
  // en cours de journée : sinon un nouveau métrique ne progresserait jamais).
  const p = entry.challenges.progress;
  for (const m of CHALLENGE_METRICS) if (!(m in p)) p[m] = 0;
  return entry.challenges;
}

function challengesPayload(entry) {
  const c = getChallenges(entry);
  return activeChallenges().map(ch => ({
    id: ch.id, goal: ch.goal, reward: ch.reward, label: ch.label, labelEn: ch.labelEn,
    progress: Math.min(ch.goal, c.progress[ch.metric] || 0),
    done: (c.progress[ch.metric] || 0) >= ch.goal,
    claimed: c.claimed.includes(ch.id),
  }));
}

// Fait progresser un défi et notifie le joueur (barres de progression en direct).
const TOURNAMENT_POINTS = { gamesWon: 10, triviaCorrect: 2, snakeEaten: 1 };
let _tournamentEmitTimer = null;
function tournamentPayload() {
  const top = Object.values(tournament.scores || {})
    .sort((a, b) => b.pts - a.pts).slice(0, 10);
  const now = _beninDay();
  // Prochain samedi 00:00 (Benin) ou fin du samedi en cours
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
  const daysToSat = (6 - d.getUTCDay() + 7) % 7 || 7;
  const nextAt = d.getTime() + daysToSat * 86_400_000 - 3_600_000;
  const endsAt = d.getTime() + 86_400_000 - 3_600_000;
  return { active: isTournamentDay(), top, champion: tournament.champion, reward: TOURNAMENT_REWARD, endsAt: isTournamentDay() ? endsAt : null, nextAt: isTournamentDay() ? null : nextAt };
}
function bumpTournament(id, entry, metric, amount) {
  if (!isTournamentDay()) return;
  const pts = (TOURNAMENT_POINTS[metric] || 0) * amount;
  if (!pts) return;
  const today = _tournamentTodayKey();
  if (tournament.week !== today) { finalizeTournament(); tournament.week = today; tournament.scores = {}; }
  const sc = tournament.scores[id] || { name: entry.name, pts: 0 };
  sc.pts += pts; sc.name = entry.name;
  tournament.scores[id] = sc;
  dbSaveTournament();
  clearTimeout(_tournamentEmitTimer);
  _tournamentEmitTimer = setTimeout(() => io.emit('tournament-update', tournamentPayload()), 800);
}
function finalizeTournament() {
  const entries = Object.entries(tournament.scores || {});
  if (!tournament.week || !entries.length) { tournament.week = null; tournament.scores = {}; return; }
  const [pid, best] = entries.sort((a, b) => b[1].pts - a[1].pts)[0];
  const entry = getLibsEntry(pid);
  if (entry) {
    const tGain = Math.round(TOURNAMENT_REWARD * vipMult(entry));
    entry.balance = Math.min(MAX_BALANCE, entry.balance + tGain);
    libs.set(pid, entry);
    dbUpsertLibs(pid, entry);
    _emitToPlayer(pid, 'libs-update', { balance: entry.balance, delta: tGain, nextAt: nextDistributionAt });
    sendPush(pid, { title: '🏆 Champion de la semaine !', body: `Bravo ${best.name} : tu remportes le tournoi et ${tGain} Libs !`, url: 'https://libero-multi.vercel.app' });
  }
  tournament.champion = { name: best.name, pts: best.pts, week: tournament.week };
  tournament.week = null; tournament.scores = {};
  dbSaveTournament();
  refreshAllHonorTitles();
  io.emit('tournament-update', tournamentPayload());
  console.log(`[🏆] Tournoi termine : ${best.name} (${best.pts} pts) +${TOURNAMENT_REWARD} ⚡`);
}
// Cloture automatique : des qu'on n'est plus samedi, le tournoi en cours est finalise.
setInterval(() => { if (tournament.week && tournament.week !== _tournamentTodayKey()) finalizeTournament(); }, 5 * 60_000);

function bumpChallenge(id, metric, amount = 1) {
  if (!id) return;
  const entry = getLibsEntry(id);
  if (!entry || !entry.name || entry.name === 'Anonyme') return;
  bumpTournament(id, entry, metric, amount);
  const c = getChallenges(entry);
  if (!(metric in c.progress)) return;
  c.progress[metric] += amount;
  // Compteur à vie (défis permanents) : ne se remet jamais à zéro.
  const lt = getLifetime(entry);
  lt[metric] = (lt[metric] || 0) + amount;
  libs.set(id, entry);
  dbUpsertLibs(id, entry);
  _emitToPlayer(id, 'challenges-update', { challenges: challengesPayload(entry), permanent: permanentPayload(entry) });
  // La carte « Mon QI » affiche le nombre de quiz restants : tenue a jour en direct.
  if (metric === 'triviaGames') {
    _emitToPlayer(id, 'iq-progress', { done: lt.triviaGames || 0, needed: IQ_UNLOCK_QUIZZES, unlocked: (lt.triviaGames || 0) >= IQ_UNLOCK_QUIZZES });
  }
}

// Met à jour la série de connexion une fois par jour et renvoie le bonus gagné.
function touchStreak(entry) {
  const today = _dayKey();
  let s = (entry.streak && typeof entry.streak === 'object') ? entry.streak : { lastDay: null, count: 0, longest: 0 };
  if (s.lastDay === today) return { streak: s, bonus: 0 };
  s.count   = (s.lastDay === _dayKey(1)) ? (s.count || 0) + 1 : 1;
  s.lastDay = today;
  s.longest = Math.max(s.longest || 0, s.count);
  entry.streak = s;
  // Metrique a vie pour le defi permanent « serie de 30 jours ».
  const lt = getLifetime(entry);
  lt.streakDays = Math.max(lt.streakDays || 0, s.count);
  const bonus = Math.min(s.count, 7) * 5; // de 5 (jour 1) à 35 (jour 7+) Libs
  return { streak: s, bonus };
}

// Ajoute une partie en tête de l'historique (limité aux 20 dernières).
const REFERRAL_REWARD = 100;
function maybeRewardReferral(id, entry) {
  if (!entry.referredBy || entry.referralRewarded) return;
  const refId = entry.referredBy;
  const refEntry = libs.get(refId);
  entry.referralRewarded = true;
  entry.balance = Math.min(MAX_BALANCE, entry.balance + REFERRAL_REWARD);
  _emitToPlayer(id, 'libs-update', { balance: entry.balance, delta: REFERRAL_REWARD, nextAt: nextDistributionAt });
  _emitToPlayer(id, 'referral-reward', { role: 'filleul', amount: REFERRAL_REWARD, name: refEntry?.name || '' });
  if (refEntry) {
    refEntry.balance = Math.min(MAX_BALANCE, refEntry.balance + REFERRAL_REWARD);
    refEntry.referrals = (refEntry.referrals || 0) + 1;
    libs.set(refId, refEntry);
    dbUpsertLibs(refId, refEntry);
    _emitToPlayer(refId, 'libs-update', { balance: refEntry.balance, delta: REFERRAL_REWARD, nextAt: nextDistributionAt });
    _emitToPlayer(refId, 'referral-reward', { role: 'parrain', amount: REFERRAL_REWARD, name: entry.name });
    // Parrain et filleul deviennent automatiquement amis : ils peuvent se defier.
    makeFriends(refId, id);
  }
}

// Lie deux joueurs en amis (mutuel), dans la limite de 30 chacun.
function makeFriends(idA, idB) {
  if (!idA || !idB || idA === idB) return false;
  const a = getLibsEntry(idA), b = getLibsEntry(idB);
  if (!a || !b) return false;
  if (!a.friends.includes(idB) && a.friends.length < 30) a.friends.push(idB);
  if (!b.friends.includes(idA) && b.friends.length < 30) b.friends.push(idA);
  a.friendRequests = (a.friendRequests || []).filter(p => p !== idB);
  b.friendRequests = (b.friendRequests || []).filter(p => p !== idA);
  libs.set(idA, a); libs.set(idB, b);
  dbUpsertLibs(idA, a); dbUpsertLibs(idB, b);
  _emitToPlayer(idA, 'friends-list', friendsPayload(a));
  _emitToPlayer(idB, 'friends-list', friendsPayload(b));
  return true;
}

// Depose un cadeau chez un joueur : credite tout de suite, et le message
// (avec bouton OK) est affiche en direct ou a la prochaine connexion.
function deliverGift(pid, { fromName, libsAmount = 0, cosmeticId = null, vip = false }) {
  const entry = getLibsEntry(pid);
  if (!entry) return false;
  const gift = { id: crypto.randomUUID(), fromName: String(fromName || '').slice(0, 20), libs: Math.max(0, Math.floor(libsAmount)), cosmeticId: cosmeticId || null, vip: !!vip, at: Date.now() };
  if (!Array.isArray(entry.pendingGifts)) entry.pendingGifts = [];
  entry.pendingGifts.push(gift);
  entry.pendingGifts = entry.pendingGifts.slice(-10);
  libs.set(pid, entry);
  dbUpsertLibs(pid, entry);
  _emitToPlayer(pid, 'gift-received', gift);
  return true;
}

// ── Niveaux et XP ────────────────────────────────────────────────────────────
// Courbe : niveau = 1 + racine(xp/100). Niveau 2 a 100 XP, 5 a 1600, 10 a 8100,
// 25 a 57600, 50 a 240100. Chaque niveau gagne rapporte 20 x niveau Libs, et les
// paliers 10/25/50 ajoutent un gros bonus.
const XP_MILESTONE_BONUS = { 10: 500, 25: 1500, 50: 5000 };
const IQ_UNLOCK_QUIZZES = 10;              // quiz termines pour debloquer le test de QI
const IQ_RETAKE_MS = 3 * 24 * 3600 * 1000; // 3 jours entre deux tests

// Roue de la fortune : lots (dans l'ordre des cases de la roue cote client)
// et poids en pourcentage.
const WHEEL_PRIZES  = [5, 10, 20, 50, 100, 250];
const WHEEL_WEIGHTS = [30, 25, 20, 15, 8, 2];

// ── Cadeau du jour (theme ete / canicule) ────────────────────────────────────
// Un petit lot aleatoire offert a la 1re connexion de la journee, pour creer
// l'habitude. Remplace l'ancien bonus de Libs de la serie de connexion.
const SUMMER_GIFT_COSMETICS = [
  'bg-vagues', 'bg-aurore-deg', 'bg-particules', 'bg-pluie', 'bg-crepuscule',
  'emote-cool', 'emote-fire', 'emote-heart', 'emote-laugh', 'emote-clap',
];
const SUMMER_EMOJIRAIN = ['☀️🌴🍹', '🏖️🌊🐚', '🍉🍦🕶️', '🌺🦩🥥'];
// Tire le cadeau du jour et le remet directement au joueur. Renvoie le payload
// a envoyer au client (pour la modale), ou null si deja recu aujourd'hui.
function drawDailyGift(entry) {
  const today = _dayKey();
  if (entry.dailyGiftDay === today) return null;
  entry.dailyGiftDay = today;
  const owned = new Set(entry.ownedCosmetics || []);
  const freeCosmetics = SUMMER_GIFT_COSMETICS.filter(id => !owned.has(id));
  const roll = Math.random();
  let gift;
  if (freeCosmetics.length && roll < 0.35) {
    const id = freeCosmetics[Math.floor(Math.random() * freeCosmetics.length)];
    (entry.ownedCosmetics = entry.ownedCosmetics || []).push(id);
    const type = id.startsWith('emote-') ? 'emote' : 'cosmetic';
    gift = { type, cosmeticId: id };
  } else if (roll < 0.5) {
    // Pluie d'emojis d'ete (cote client, juste un theme suggere).
    gift = { type: 'emojirain', emojis: SUMMER_EMOJIRAIN[Math.floor(Math.random() * SUMMER_EMOJIRAIN.length)] };
  } else {
    // Petit lot de Libs (jamais gros, c'est le cadeau d'habitude).
    const amounts = [10, 15, 20, 25, 30, 40, 60];
    const weights = [26, 22, 18, 14, 10, 6, 4];
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), amt = amounts[0];
    for (let i = 0; i < amounts.length; i++) { r -= weights[i]; if (r <= 0) { amt = amounts[i]; break; } }
    entry.balance = Math.min(MAX_BALANCE, (entry.balance || 0) + amt);
    gift = { type: 'libs', amount: amt };
  }
  return gift;
}

// ── Offre flash ───────────────────────────────────────────────────────────────
// Un cosmetique en promo pendant quelques heures, gere depuis le dashboard.
// Persiste dans server_config 'flash_offer' pour survivre aux redemarrages.
let flashOffer = null; // { cosmeticId, discount (10-90), endsAt }
function flashPayload() {
  if (!flashOffer || flashOffer.endsAt <= Date.now()) return { offer: null };
  const cosm = COSMETICS.find(c => c.id === flashOffer.cosmeticId);
  if (!cosm) return { offer: null };
  return { offer: {
    cosmeticId: cosm.id, type: cosm.type, price: cosm.price,
    flashPrice: flashPriceFor(cosm.id, cosm.price),
    discount: flashOffer.discount, endsAt: flashOffer.endsAt,
  } };
}
function flashPriceFor(cosmeticId, price) {
  if (!flashOffer || flashOffer.endsAt <= Date.now() || flashOffer.cosmeticId !== cosmeticId) return price;
  return Math.max(1, Math.round(price * (100 - flashOffer.discount) / 100));
}
function dbSaveFlashOffer() {
  if (!db) return;
  db.collection('server_config').updateOne({ _id: 'flash_offer' }, { $set: { value: flashOffer } }, { upsert: true }).catch(() => {});
}

// ── Catalogue boutique pilote par l'admin ─────────────────────────────────────
// Par defaut, seules certaines familles sont en vente (meme liste que le
// client). L'admin peut forcer un article dedans ou dehors, avec un compte a
// rebours optionnel de disparition. Persiste dans server_config 'shop_overrides'.
const DEFAULT_SHOP_TYPES = new Set(['color', 'font', 'nameeffect', 'title', 'background', 'cursorsnake', 'snakeskin']);
const shopOverrides = new Map(); // cosmeticId -> { inShop, until }
function pruneShopOverrides() {
  let changed = false;
  for (const [id, o] of shopOverrides.entries()) {
    if (o.until && o.until <= Date.now()) { shopOverrides.delete(id); changed = true; }
  }
  if (changed) { dbSaveShopOverrides(); io.emit('shop-overrides', shopOverridesPayload()); }
}
setInterval(pruneShopOverrides, 60_000);
function shopHas(cosm) {
  // Les emotes ne sont JAMAIS vendues dans la boutique d'objets : elles ont
  // leur propre rayon dans la section Emotes du profil (voir emoteAvailable).
  if (cosm.type === 'emote') return false;
  const o = shopOverrides.get(cosm.id);
  if (o) return o.inShop && (!o.until || o.until > Date.now());
  return DEFAULT_SHOP_TYPES.has(cosm.type);
}
// Disponibilite d'une emote dans la section Emotes du profil : disponible par
// defaut, l'admin peut la retirer (override inShop:false) ou fixer un compte a
// rebours (override inShop:true + until).
function emoteAvailable(id) {
  const o = shopOverrides.get(id);
  if (o) return o.inShop && (!o.until || o.until > Date.now());
  return true;
}
function shopOverridesPayload() {
  const out = {};
  for (const [id, o] of shopOverrides.entries()) {
    if (o.until && o.until <= Date.now()) continue;
    out[id] = { inShop: o.inShop, until: o.until || null };
  }
  return { overrides: out };
}
function dbSaveShopOverrides() {
  if (!db) return;
  db.collection('server_config').updateOne({ _id: 'shop_overrides' }, { $set: { value: [...shopOverrides.entries()] } }, { upsert: true }).catch(() => {});
}

// ── Journal d'audit admin ─────────────────────────────────────────────────────
// Trace toutes les actions d'administration (cadeaux, restitutions,
// suppressions, annonces, push...) avec date, en memoire + Mongo `admin_audit`.
const adminAudits = []; // { at, action, details }
function adminAudit(action, details = {}) {
  const entry = { at: Date.now(), action, details };
  adminAudits.unshift(entry);
  if (adminAudits.length > 200) adminAudits.pop();
  if (db) db.collection('admin_audit').insertOne({ ...entry }).catch(() => {});
}

// ── Journal d'erreurs serveur (visible dans le dashboard) ─────────────────────
// Permet au proprietaire d'etre alerte des soucis avant les joueurs, sans
// dependance externe (pas de compte Sentry a gerer).
const serverErrors = []; // { at, where, message, stack }
const SERVER_ERROR_MAX = 100;
function logServerError(where, err) {
  try {
    const message = (err && err.message) ? String(err.message) : String(err);
    const stack   = (err && err.stack) ? String(err.stack).slice(0, 2000) : '';
    const entry = { id: crypto.randomUUID(), at: Date.now(), where: String(where || 'app').slice(0, 60), message: message.slice(0, 500), stack };
    serverErrors.unshift(entry);
    if (serverErrors.length > SERVER_ERROR_MAX) serverErrors.pop();
    if (db) db.collection('server_errors').insertOne({ ...entry }).catch(() => {});
    console.error(`[⚠️ ${entry.where}]`, message);
    adminAlert('⚠️ Erreur serveur', `${entry.where}: ${message.slice(0, 120)}`, { throttleErr: true });
  } catch (_) {}
}
process.on('uncaughtException',  e => logServerError('uncaughtException', e));
process.on('unhandledRejection', e => logServerError('unhandledRejection', e));

// ── Etat admin persiste dans server_config ───────────────────────────────────
function saveConfig(id, value) {
  if (db) db.collection('server_config').updateOne({ _id: id }, { $set: { value } }, { upsert: true }).catch(() => {});
}
let scheduledTasks   = [];              // { id, kind:'announce'|'push', at, fireAt, done, ... }
let bannedWords      = [];              // mots interdits (minuscules)
let bookPriceOverrides = {};            // 'bookId:packId' -> prix
let adminAlertSubs   = [];              // playerIds recevant les alertes admin
let maintenance      = { on: false, message: '', messageEn: '' };

function containsBanned(str) {
  if (!bannedWords.length || !str) return false;
  const low = String(str).toLowerCase();
  return bannedWords.some(w => w && low.includes(w));
}
// Alerte poussee vers les appareils du proprietaire (jamais bloquant).
let _lastAlertErrAt = 0;
function adminAlert(title, body, opts = {}) {
  try {
    if (!adminAlertSubs.length) return;
    // Les alertes d'erreur sont limitees a une toutes les 10 min pour ne pas spammer.
    if (opts.throttleErr) { const now = Date.now(); if (now - _lastAlertErrAt < 10 * 60_000) return; _lastAlertErrAt = now; }
    sendPush(adminAlertSubs.slice(), { title, body, url: 'https://libero-multi.vercel.app/stats.html' });
  } catch (_) {}
}
// Prix effectif d'un pack de livre (override admin sinon prix de base).
function bookPackPrice(bookId, pack) {
  const k = `${bookId}:${pack.id}`;
  return Object.prototype.hasOwnProperty.call(bookPriceOverrides, k) ? bookPriceOverrides[k] : pack.price;
}

// Publie une annonce (immediate) : memoire + Mongo + diffusion + push a tous.
function publishAnnouncement(text, textEn) {
  const a = { _id: crypto.randomUUID(), text, textEn: textEn || '', at: Date.now() };
  announcements.unshift(a);
  if (announcements.length > 20) announcements.pop();
  if (db) db.collection('announcements').insertOne({ ...a }).catch(() => {});
  io.emit('announcements-update', { announcements: announcements.slice(0, 5).map(x => ({ id: x._id, text: x.text, textEn: x.textEn || '', at: x.at })) });
  sendPush(null, { title: "📣 Libero's Multi", body: text.slice(0, 180), url: 'https://libero-multi.vercel.app' });
  return a;
}

// ── Taches programmees (annonce/push a une date/heure) ──
function _persistTask(t) {
  if (db) db.collection('scheduled_tasks').updateOne({ id: t.id }, { $set: t }, { upsert: true }).catch(() => {});
}
function _runScheduledTasks() {
  const now = Date.now();
  for (const t of scheduledTasks) {
    if (t.done || t.fireAt > now) continue;
    try {
      if (t.kind === 'announce') {
        if (t.text) publishAnnouncement(t.text, t.textEn);
      } else if (t.kind === 'push') {
        const target = t.segment === 'all' ? null : _segmentPlayerIds(t.segment);
        sendPush(target, { title: t.title || "Libero's Multi", body: t.body || '', url: 'https://libero-multi.vercel.app' });
      }
      adminAudit('scheduled-fire', { kind: t.kind, segment: t.segment });
    } catch (e) { logServerError('scheduled task', e); }
    t.done = true; _persistTask(t);
  }
}
setInterval(_runScheduledTasks, 30_000);

// ── Notifications push (web-push) ────────────────────────────────────────────
// Activees seulement si les cles VAPID sont dans l'environnement (Render).
// Abonnements en memoire + Mongo `push_subs` (cle = playerId canonique).
let webpush = null;
const pushSubs = new Map(); // playerId -> subscription
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:mohounkpevi@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('🔔 Notifications push activées.');
  } catch (e) { console.error('web-push indisponible:', e.message); webpush = null; }
}
// target : null = tous les abonnes, une chaine = un joueur, un tableau = plusieurs joueurs.
// Renvoie le nombre d'abonnements effectivement vises.
function sendPush(target, payload) {
  if (!webpush) return 0;
  const body = JSON.stringify(payload);
  let entries;
  if (target == null)            entries = [...pushSubs.entries()];
  else if (Array.isArray(target)) entries = target.map(id => [id, pushSubs.get(id)]);
  else                            entries = [[target, pushSubs.get(target)]];
  let count = 0;
  for (const [id, sub] of entries) {
    if (!sub) continue;
    count++;
    webpush.sendNotification(sub, body).catch(err => {
      // Abonnement expire ou revoque : on le retire.
      if (err.statusCode === 404 || err.statusCode === 410) {
        pushSubs.delete(id);
        if (db) db.collection('push_subs').deleteOne({ _id: id }).catch(() => {});
      }
    });
  }
  return count;
}

// Ensemble des playerId d'un segment (pour les push ciblees).
const PUSH_BIG_LIBS = 1000; // seuil « gros joueur »
function _segmentPlayerIds(segment) {
  const now = Date.now();
  const ids = [];
  for (const [pid, e] of libs.entries()) {
    if (segment === 'inactive7') {
      if (!e.name || e.name === 'Anonyme') continue;
      if ((now - (e.lastActive || 0)) >= 7 * 86_400_000) ids.push(pid);
    } else if (segment === 'active7') {
      if ((now - (e.lastActive || 0)) < 7 * 86_400_000) ids.push(pid);
    } else if (segment === 'vip') {
      if ((e.vipUntil || 0) > now) ids.push(pid);
    } else if (segment === 'big') {
      if ((e.balance || 0) >= PUSH_BIG_LIBS) ids.push(pid);
    }
  }
  return ids;
}

// Pass VIP : 30 jours, +20% sur les gains de Libs (serie, defis, roue, tournoi).
const VIP_PRICE = 2000;
const VIP_DURATION_MS = 30 * 24 * 3600 * 1000;
function vipMult(entry) { return (entry && entry.vipUntil > Date.now()) ? 1.2 : 1; }

// Liste d'amis : projection publique (jamais les playerId secrets, uniquement
// le code public 8 hex, le pseudo, le niveau et la presence).
function friendsPayload(entry) {
  const online = new Set(socketPlayerIds.values());
  const friends = (entry.friends || []).map(pid => {
    const f = libs.get(pid);
    if (!f || !f.name || f.name === 'Anonyme') return null;
    return { ref: _playerRef(pid).slice(0, 8), name: f.name, level: levelFromXp(f.xp || 0), online: online.has(pid) };
  }).filter(Boolean);
  // Demandes recues en attente : affichees dans la fenetre Mes amis.
  const requests = (entry.friendRequests || []).map(pid => {
    const f = libs.get(pid);
    if (!f || !f.name || f.name === 'Anonyme') return null;
    return { ref: _playerRef(pid).slice(0, 8), name: f.name, level: levelFromXp(f.xp || 0) };
  }).filter(Boolean);
  return { friends, requests };
}
function levelFromXp(xp) { return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100)); }
function awardXp(id, entry, amount) {
  if (!id || !entry || !(amount > 0)) return;
  const before = levelFromXp(entry.xp || 0);
  entry.xp = (entry.xp || 0) + Math.floor(amount);
  const after = levelFromXp(entry.xp);
  let reward = 0;
  if (after > before) {
    for (let lv = before + 1; lv <= after; lv++) reward += lv * 20 + (XP_MILESTONE_BONUS[lv] || 0);
    entry.balance = Math.min(MAX_BALANCE, entry.balance + reward);
    _emitToPlayer(id, 'libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: reward, nextAt: nextDistributionAt });
  }
  _emitToPlayer(id, 'xp-update', { xp: entry.xp, level: after, gained: Math.floor(amount), levelUp: after > before ? after : null, reward: reward || undefined });
}

// ── Onboarding gamifie : 3 mini-etapes recompensees en Libs ──────────────────
const ONBOARD_STEPS = { play: 50, win: 100, perso: 50 };
// Marque une etape comme faite (une seule fois), credite et notifie le joueur.
function completeOnboardStep(id, entry, step) {
  if (!ONBOARD_STEPS[step]) return;
  if (!entry || !entry.name || entry.name === 'Anonyme') return;
  if (!Array.isArray(entry.onboardRewards)) entry.onboardRewards = [];
  if (entry.onboardRewards.includes(step)) return;
  entry.onboardRewards.push(step);
  const reward = ONBOARD_STEPS[step];
  entry.balance = Math.min(MAX_BALANCE, (entry.balance || 0) + reward);
  libs.set(id, entry);
  dbUpsertLibs(id, entry);
  _emitToPlayer(id, 'onboard-update', { steps: entry.onboardRewards, reward, step, balance: entry.balance });
  for (const [sockId, pid] of socketPlayerIds.entries()) {
    if (pid === id) io.to(sockId).emit('libs-update', { balance: entry.balance, delta: reward });
  }
}

function pushHistory(id, item) {
  if (!id) return;
  const entry = getLibsEntry(id);
  if (!entry || !entry.name || entry.name === 'Anonyme') return;
  maybeRewardReferral(id, entry); // 1re partie d'un filleul -> +100 ⚡ chacun
  completeOnboardStep(id, entry, 'play');
  if (item.result === 'win') completeOnboardStep(id, entry, 'win');
  // XP : chaque partie en rapporte, gagner ou briller au quiz en rapporte plus.
  awardXp(id, entry, 25 + (item.result === 'win' ? 25 : 0) + (item.game === 'trivia' ? Math.min(60, (item.score || 0) * 2) : 0));
  if (!Array.isArray(entry.history)) entry.history = [];
  entry.history.unshift({ game: item.game, result: item.result || null, score: item.score ?? null, at: Date.now() });
  entry.history = entry.history.slice(0, 20);
  libs.set(id, entry);
  dbUpsertLibs(id, entry);
  _emitToPlayer(id, 'history-update', { history: entry.history });
  // Toute partie inscrite à l'historique compte pour le défi « jouer N parties ».
  bumpChallenge(id, 'gamesPlayed');
}

function getCosmeticByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedCosmetic) return e.equippedCosmetic;
  }
  return null;
}

function getFontByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedFont) return e.equippedFont;
  }
  return null;
}

function getNameEffectByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedNameEffect) return e.equippedNameEffect;
  }
  return null;
}

function getTitleByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedTitle) return e.equippedTitle;
  }
  return null;
}

function getHonorTitleByName(name) {
  if (name === 'Libero') return 'honor-creator';
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.honorTitle) return e.honorTitle;
  }
  return null;
}

function getAvatarByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedAvatar) return e.equippedAvatar;
  }
  return null;
}

function getCursorSnakeByName(name) {
  for (const [, e] of libs.entries()) {
    if (e.name === name && e.equippedCursorSnake) return e.equippedCursorSnake;
  }
  return null;
}

function dbSaveNextDistributionAt() {
  if (!db) return;
  db.collection('server_config')
    .updateOne({ _id: 'nextDistributionAt' }, { $set: { value: nextDistributionAt } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde nextDistributionAt:', e));
}

function dbSaveRank1Streak() {
  if (!db) return;
  db.collection('server_config')
    .updateOne({ _id: 'rank1StreakSince' }, { $set: { value: rank1StreakSince } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde rank1StreakSince:', e));
  db.collection('server_config')
    .updateOne({ _id: 'rank1GlobalName' }, { $set: { value: rank1Global } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde rank1GlobalName:', e));
}

async function resetLibsBalancesOnce() {
  if (!db) return;
  const flag = await db.collection('server_config').findOne({ _id: 'libs_reset_done' });
  if (flag) return;
  const promises = [];
  for (const [id, entry] of libs.entries()) {
    if (entry.name === 'Libero') continue;
    entry.balance = 0;
    libs.set(id, entry);
    promises.push(db.collection('libs').updateOne({ _id: id }, { $set: { balance: 0 } }).catch(() => {}));
  }
  await Promise.all(promises);
  await db.collection('server_config').insertOne({ _id: 'libs_reset_done', value: true });
  console.log('💸 Soldes Libs remis à 0 (sauf Libero).');
}

// ── Libs : constantes ──────────────────────────────────────────────────────
const DECAY_GRACE_MS  = 48 * 3_600_000;
const DECAY_PERIOD_MS = 24 * 3_600_000;
const DECAY_AMOUNT    = 10;
const LIBS_REWARDS    = [10, 5, 3];
const SERVER_ANNOUNCEMENT = {
  id:    'libero-thanks-2026-06',
  msgFr: 'Libero vous remercie ! Merci de jouer et de soutenir le projet. Votre presence fait vivre cette communaute. A bientot !',
  msgEn: 'Libero thanks you! Thank you for playing and supporting the project. Your presence brings this community to life. See you soon!',
};
const SHOP_ITEMS      = [
  { id: 'boost_hint_10', price: 3, amount: 10 },
  { id: 'boost_hint_20', price: 5, amount: 20 },
];
const COSMETICS = [
  { id: 'rainbow',         type: 'color', price: 100 },
  { id: 'galaxy',          type: 'color', price: 100 },
  { id: 'silver',          type: 'color', price: 20  },
  { id: 'bronze',          type: 'color', price: 20  },
  { id: 'gold',            type: 'color', price: 70  },
  { id: 'diamond',         type: 'color', price: 70  },
  { id: 'font-orbitron',   type: 'font',  price: 100 },
  { id: 'font-rajdhani',   type: 'font',  price: 100 },
  { id: 'font-chakra',     type: 'font',  price: 100 },
  { id: 'font-audiowide',  type: 'font',  price: 100 },
  { id: 'font-exo2',       type: 'font',  price: 100 },
  { id: 'font-bungee',     type: 'font',  price: 90  },
  { id: 'font-blackops',   type: 'font',  price: 90  },
  { id: 'font-russo',      type: 'font',  price: 90  },
  { id: 'font-pressstart', type: 'font',  price: 10  },
  { id: 'font-vt323',      type: 'font',  price: 10  },
  { id: 'font-sharetech',  type: 'font',  price: 50  },
  { id: 'font-majormono',  type: 'font',  price: 50  },
  { id: 'font-cinzel',     type: 'font',  price: 200 },
  { id: 'font-tektur',     type: 'font',  price: 200 },
  { id: 'font-pacifico',   type: 'font',  price: 5   },
  { id: 'font-lobster',    type: 'font',  price: 5   },
  { id: 'font-fredoka',    type: 'font',  price: 5   },
  { id: 'font-monoton',    type: 'font',  price: 0   },
  { id: 'bubble-ardoise',       type: 'bubble', price: 5   },
  { id: 'bubble-ocean',         type: 'bubble', price: 10  },
  { id: 'bubble-menthe',        type: 'bubble', price: 10  },
  { id: 'bubble-corail',        type: 'bubble', price: 12  },
  { id: 'bubble-ambre',         type: 'bubble', price: 15  },
  { id: 'bubble-lavande',       type: 'bubble', price: 20  },
  { id: 'bubble-rubis',         type: 'bubble', price: 25  },
  { id: 'bubble-emeraude',      type: 'bubble', price: 30  },
  { id: 'bubble-indigo',        type: 'bubble', price: 40  },
  { id: 'bubble-magenta',       type: 'bubble', price: 50  },
  { id: 'bubble-cyan',          type: 'bubble', price: 50  },
  { id: 'bubble-crepuscule',    type: 'bubble', price: 70  },
  { id: 'bubble-aurore',        type: 'bubble', price: 80  },
  { id: 'bubble-sunset',        type: 'bubble', price: 90  },
  { id: 'bubble-tropical',      type: 'bubble', price: 100 },
  { id: 'bubble-arcade',        type: 'bubble', price: 120 },
  { id: 'bubble-galaxie',       type: 'bubble', price: 140 },
  { id: 'bubble-verre',         type: 'bubble', price: 170 },
  { id: 'bubble-or',            type: 'bubble', price: 180 },
  { id: 'bubble-holographique', type: 'bubble', price: 190 },
  { id: 'bubble-cameleon',      type: 'bubble', price: 200 },
  { id: 'bg-nuit',         type: 'background', price: 10  },
  { id: 'bg-ardoise',      type: 'background', price: 15  },
  { id: 'bg-brume',        type: 'background', price: 25  },
  { id: 'bg-aurore-deg',   type: 'background', price: 40  },
  { id: 'bg-crepuscule',   type: 'background', price: 50  },
  { id: 'bg-cyber',        type: 'background', price: 70  },
  { id: 'bg-circuit',      type: 'background', price: 80  },
  { id: 'bg-hexagones',    type: 'background', price: 90  },
  { id: 'bg-etoile',       type: 'background', price: 100 },
  { id: 'bg-particules',   type: 'background', price: 120 },
  { id: 'bg-pluie',        type: 'background', price: 140 },
  { id: 'bg-vagues',       type: 'background', price: 150 },
  { id: 'bg-synthwave',    type: 'background', price: 170 },
  { id: 'bg-nebuleuse',    type: 'background', price: 190 },
  { id: 'bg-aurores',      type: 'background', price: 210 },
  { id: 'bg-galaxie',      type: 'background', price: 240 },
  { id: 'bg-tempete',      type: 'background', price: 270 },
  { id: 'bg-hologramme',   type: 'background', price: 300 },
  // Effets de pseudo animés
  { id: 'nameeffect-blink',     type: 'nameeffect',  price: 90  },
  { id: 'nameeffect-pulse',     type: 'nameeffect',  price: 100 },
  { id: 'nameeffect-gradient',  type: 'nameeffect',  price: 120 },
  { id: 'nameeffect-sparks',    type: 'nameeffect',  price: 130 },
  { id: 'nameeffect-glitch',    type: 'nameeffect',  price: 160 },
  { id: 'nameeffect-rainbow',   type: 'nameeffect',  price: 180 },
  // Titres
  { id: 'title-tactician',      type: 'title',       price: 15  },
  { id: 'title-strategist',     type: 'title',       price: 40  },
  { id: 'title-quizmaster',     type: 'title',       price: 60  },
  { id: 'title-snakeking',      type: 'title',       price: 60  },
  { id: 'title-unbeaten',       type: 'title',       price: 90  },
  { id: 'title-champion',       type: 'title',       price: 100 },
  { id: 'title-legend',         type: 'title',       price: 130 },
  { id: 'honor-rank1-global',   type: 'title',       price: 0,  honorary: true },
  { id: 'honor-weekly-champ',   type: 'title',       price: 0,  honorary: true },
  // Skins du serpent curseur
  { id: 'cursorsnake-pixel',    type: 'cursorsnake', price: 50  },
  { id: 'cursorsnake-neon',     type: 'cursorsnake', price: 80  },
  { id: 'cursorsnake-comet',    type: 'cursorsnake', price: 110 },
  { id: 'cursorsnake-electric', type: 'cursorsnake', price: 130 },
  { id: 'cursorsnake-stars',    type: 'cursorsnake', price: 160 },
  { id: 'cursorsnake-fire',     type: 'cursorsnake', price: 200 },
  // Avatars
  { id: 'avatar-gamepad',       type: 'avatar',      price: 15  },
  { id: 'avatar-cat',           type: 'avatar',      price: 15  },
  { id: 'avatar-lightning',     type: 'avatar',      price: 25  },
  { id: 'avatar-rocket',        type: 'avatar',      price: 40  },
  { id: 'avatar-robot',         type: 'avatar',      price: 70  },
  { id: 'avatar-skull',         type: 'avatar',      price: 90  },
  { id: 'avatar-crown',         type: 'avatar',      price: 120 },
  // Jetons Puissance 4
  { id: 'p4token-goldsilver',   type: 'p4token',     price: 50  },
  { id: 'p4token-neon',         type: 'p4token',     price: 80  },
  { id: 'p4token-lavalice',     type: 'p4token',     price: 110 },
  { id: 'p4token-galaxy',       type: 'p4token',     price: 140 },
  // Symboles Morpion
  { id: 'ttt-neon',             type: 'ttt',         price: 20  },
  { id: 'ttt-sunmoon',          type: 'ttt',         price: 40  },
  { id: 'ttt-heartstar',        type: 'ttt',         price: 50  },
  { id: 'ttt-catdog',           type: 'ttt',         price: 80  },
  { id: 'ttt-skulllightning',   type: 'ttt',         price: 100 },
  // Thèmes d'échiquier
  { id: 'chess-cyber',          type: 'chess',       price: 100 },
  { id: 'chess-frost',          type: 'chess',       price: 130 },
  { id: 'chess-neon',           type: 'chess',       price: 170 },
  { id: 'chess-marble',         type: 'chess',       price: 200 },
  // Skins Snake (évents)
  { id: 'snakeskin-gems',       type: 'snakeskin',   price: 50  },
  { id: 'snakeskin-cyber',      type: 'snakeskin',   price: 80  },
  { id: 'snakeskin-lava',       type: 'snakeskin',   price: 120 },
  { id: 'snakeskin-galaxy',     type: 'snakeskin',   price: 140 },
  { id: 'snakeskin-rainbow',    type: 'snakeskin',   price: 180 },
  // Particules de clic
  { id: 'clickfx-bubbles',      type: 'clickfx',     price: 15  },
  { id: 'clickfx-confetti',     type: 'clickfx',     price: 30  },
  { id: 'clickfx-neon',         type: 'clickfx',     price: 60  },
  { id: 'clickfx-stars',        type: 'clickfx',     price: 90  },
  { id: 'clickfx-firework',     type: 'clickfx',     price: 130 },
  // Packs d'émojis
  { id: 'emojipack-animals',    type: 'emojipack',   price: 10  },
  { id: 'emojipack-hearts',     type: 'emojipack',   price: 15  },
  { id: 'emojipack-party',      type: 'emojipack',   price: 25  },
  { id: 'emojipack-gaming',     type: 'emojipack',   price: 40  },
  { id: 'emojipack-cosmos',     type: 'emojipack',   price: 70  },
  // Bannières de victoire
  { id: 'victoryban-neon',      type: 'victoryban',  price: 90  },
  { id: 'victoryban-confetti',  type: 'victoryban',  price: 110 },
  { id: 'victoryban-flames',    type: 'victoryban',  price: 150 },
  { id: 'victoryban-lightning', type: 'victoryban',  price: 170 },
  { id: 'victoryban-crown',     type: 'victoryban',  price: 200 },
  // Packs de sons
  { id: 'soundpack-8bit',       type: 'soundpack',   price: 40  },
  { id: 'soundpack-retro',      type: 'soundpack',   price: 60  },
  { id: 'soundpack-crystal',    type: 'soundpack',   price: 80  },
  { id: 'soundpack-cyber',      type: 'soundpack',   price: 100 },
  { id: 'soundpack-epic',       type: 'soundpack',   price: 130 },
  // Emotes
  { id: 'emote-hello',        type: 'emote',       price: 0  },
  { id: 'emote-gg',           type: 'emote',       price: 0  },
  { id: 'emote-sad',          type: 'emote',       price: 0  },
  { id: 'emote-wellplayed',   type: 'emote',       price: 10 },
  { id: 'emote-laugh',        type: 'emote',       price: 15 },
  { id: 'emote-think',        type: 'emote',       price: 15 },
  { id: 'emote-cool',         type: 'emote',       price: 20 },
  { id: 'emote-clap',         type: 'emote',       price: 25 },
  { id: 'emote-fire',         type: 'emote',       price: 30 },
  { id: 'emote-heart',        type: 'emote',       price: 30 },
  { id: 'emote-cry',          type: 'emote',       price: 35 },
  { id: 'emote-angry',        type: 'emote',       price: 40 },
  { id: 'emote-shock',        type: 'emote',       price: 45 },
  { id: 'emote-easy',         type: 'emote',       price: 50 },
  { id: 'emote-eyes',         type: 'emote',       price: 55 },
  { id: 'emote-skull',        type: 'emote',       price: 60 },
  { id: 'emote-party',        type: 'emote',       price: 65 },
  { id: 'emote-rocket',       type: 'emote',       price: 70 },
  { id: 'emote-omg',          type: 'emote',       price: 80 },
  { id: 'emote-crown',        type: 'emote',       price: 100},
];

const ROTATION_INTERVAL_MS = 24 * 3600 * 1000;

const BUNDLES = [
  { id:'bundle-debutant',    nameFr:'Pack Débutant',          nameEn:'Starter Pack',           items:['silver','bubble-ardoise','bg-nuit','boost_hint_10'], totalPrice:38,  bundlePrice:25,  featured:false },
  { id:'bundle-retro',       nameFr:'Pack Rétro',             nameEn:'Retro Pack',             items:['font-vt323','font-pressstart','bg-cyber','bubble-ocean'], totalPrice:100, bundlePrice:75, featured:false },
  { id:'bundle-neon-arcade', nameFr:'Pack Néon Arcade',       nameEn:'Neon Arcade Pack',       items:['bubble-arcade','bg-pluie','font-audiowide'], totalPrice:360, bundlePrice:270, featured:true },
  { id:'bundle-galaxie',     nameFr:'Pack Galaxie',           nameEn:'Galaxy Pack',            items:['bubble-galaxie','bg-galaxie','galaxy'], totalPrice:480, bundlePrice:360, featured:false },
  { id:'bundle-prestige-or', nameFr:'Pack Prestige Or',       nameEn:'Gold Prestige Pack',     items:['bubble-or','gold','font-cinzel'], totalPrice:450, bundlePrice:340, featured:false },
  { id:'bundle-hologramme',  nameFr:'Pack Hologramme Ultime', nameEn:'Ultimate Hologram Pack', items:['bubble-holographique','bg-hologramme','font-tektur'], totalPrice:690, bundlePrice:500, featured:true },
];

function _equippedPayload(entry) {
  return {
    equippedCosmetic:    entry.equippedCosmetic    || null,
    equippedFont:        entry.equippedFont        || null,
    equippedBubble:      entry.equippedBubble      || null,
    equippedBackground:  entry.equippedBackground  || null,
    equippedNameEffect:  entry.equippedNameEffect  || null,
    equippedTitle:       entry.equippedTitle       || null,
    equippedCursorSnake: entry.equippedCursorSnake || null,
    equippedAvatar:      entry.equippedAvatar      || null,
    equippedP4Token:     entry.equippedP4Token     || null,
    equippedTtt:         entry.equippedTtt         || null,
    equippedChess:       entry.equippedChess       || null,
    equippedSnakeSkin:   entry.equippedSnakeSkin   || null,
    equippedClickFx:     entry.equippedClickFx     || null,
    equippedEmojiPack:   entry.equippedEmojiPack   || null,
    equippedVictoryBan:  entry.equippedVictoryBan  || null,
    equippedSoundPack:   entry.equippedSoundPack   || null,
    equippedEmotes:      entry.equippedEmotes      || [],
    honorTitle:          entry.honorTitle          || null,
  };
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getShopRotation() {
  const period  = Math.floor(Date.now() / ROTATION_INTERVAL_MS);
  const resetAt = (period + 1) * ROTATION_INTERVAL_MS;
  const legendary    = COSMETICS.filter(c => c.price > 150).map(c => c.id);
  const nonLegendary = COSMETICS.filter(c => c.price > 0 && c.price <= 150).map(c => c.id);
  const featured = seededShuffle(legendary,    period * 99991 + 3571).slice(0, 2);
  const featSet  = new Set(featured);
  const daily    = seededShuffle(nonLegendary, period * 31337 + 7919)
                     .filter(id => !featSet.has(id)).slice(0, 6);
  return { featured, daily, resetAt };
}

function applyDecay(entry) {
  if (!entry.lastActive) return entry;
  const elapsed = Date.now() - entry.lastActive;
  if (elapsed <= DECAY_GRACE_MS) return entry;
  const periods = Math.floor((elapsed - DECAY_GRACE_MS) / DECAY_PERIOD_MS);
  if (periods <= 0) return entry;
  entry.balance    = Math.max(0, entry.balance - periods * DECAY_AMOUNT);
  entry.lastActive = entry.lastActive + periods * DECAY_PERIOD_MS;
  return entry;
}

function getRefundCardsInfo(entry) {
  const now = Date.now();
  if (!entry.refundCardsUsedAt) entry.refundCardsUsedAt = [];
  entry.refundCardsUsedAt = entry.refundCardsUsedAt.filter(t => now - t < REFUND_CARD_COOLDOWN_MS);
  const available = REFUND_CARD_MAX - entry.refundCardsUsedAt.length;
  const nextRefill = available < REFUND_CARD_MAX && entry.refundCardsUsedAt.length > 0
    ? Math.min(...entry.refundCardsUsedAt) + REFUND_CARD_COOLDOWN_MS
    : null;
  return { available, nextRefill };
}

// Fonds d'ecran offerts a tous les joueurs (nouveaux comme anciens) : ils
// apparaissent dans le casier de chacun sans achat, injectes a chaque chargement.
const FREE_COSMETICS = ['bg-nuit', 'bg-ardoise', 'bg-brume', 'emote-hello', 'emote-gg', 'emote-sad'];

// Genere un code cadeau unique (8 caracteres, sans O/0/I/1 pour eviter les confusions).
function _makeGiftCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (giftCodes.has(code));
  return code;
}

function getLibsEntry(id) {
  if (!id) return null;
  let entry = libs.get(id);
  if (!entry) {
    entry = { name: '', balance: 0, lastActive: Date.now(), pendingBoostHint: 0, usedCodes: [], ownedCosmetics: [], equippedCosmetic: null, equippedFont: null, equippedBubble: null, equippedBackground: null, equippedNameEffect: null, equippedTitle: null, equippedCursorSnake: null, equippedAvatar: null, equippedP4Token: null, equippedTtt: null, equippedChess: null, equippedSnakeSkin: null, equippedClickFx: null, equippedEmojiPack: null, equippedVictoryBan: null, equippedSoundPack: null, equippedEmotes: [], refundCardsUsedAt: [], ownedBooks: [], honorTitle: null, pendingHonorModal: null, streak: null, challenges: null, lifetime: {}, permClaimed: [], referredBy: null, referralRewarded: false, referrals: 0, xp: 0, iq: null, iqAt: 0, wheelDay: null, friends: [], friendRequests: [], pendingGifts: [], giftSentDay: null, vipUntil: 0, dailyGiftDay: null, badges: [], onboardRewards: [], history: [] };
    libs.set(id, entry);
  }
  if (typeof entry.xp !== 'number') entry.xp = 0;
  if (!('iq' in entry)) entry.iq = null;
  if (!('iqAt' in entry)) entry.iqAt = 0;
  if (!('wheelDay' in entry)) entry.wheelDay = null;
  if (!Array.isArray(entry.friends)) entry.friends = [];
  if (!Array.isArray(entry.friendRequests)) entry.friendRequests = [];
  if (!Array.isArray(entry.pendingGifts)) entry.pendingGifts = [];
  if (typeof entry.vipUntil !== 'number') entry.vipUntil = 0;
  if (!entry.usedCodes)          entry.usedCodes          = [];
  if (!entry.ownedCosmetics)     entry.ownedCosmetics     = [];
  FREE_COSMETICS.forEach(c => { if (!entry.ownedCosmetics.includes(c)) entry.ownedCosmetics.push(c); });
  if (!entry.refundCardsUsedAt)  entry.refundCardsUsedAt  = [];
  if (!Array.isArray(entry.ownedBooks)) entry.ownedBooks  = [];
  if (!('equippedCosmetic'    in entry)) entry.equippedCosmetic    = null;
  if (!('equippedFont'        in entry)) entry.equippedFont        = null;
  if (!('equippedBubble'      in entry)) entry.equippedBubble      = null;
  if (!('equippedBackground'  in entry)) entry.equippedBackground  = null;
  if (!('equippedNameEffect'  in entry)) entry.equippedNameEffect  = null;
  if (!('equippedTitle'       in entry)) entry.equippedTitle       = null;
  if (!('equippedCursorSnake' in entry)) entry.equippedCursorSnake = null;
  if (!('equippedAvatar'      in entry)) entry.equippedAvatar      = null;
  if (!('equippedP4Token'     in entry)) entry.equippedP4Token     = null;
  if (!('equippedTtt'         in entry)) entry.equippedTtt         = null;
  if (!('equippedChess'       in entry)) entry.equippedChess       = null;
  if (!('equippedSnakeSkin'   in entry)) entry.equippedSnakeSkin   = null;
  if (!('equippedClickFx'     in entry)) entry.equippedClickFx     = null;
  if (!('equippedEmojiPack'   in entry)) entry.equippedEmojiPack   = null;
  if (!('equippedVictoryBan'  in entry)) entry.equippedVictoryBan  = null;
  if (!('equippedSoundPack'   in entry)) entry.equippedSoundPack   = null;
  if (!Array.isArray(entry.equippedEmotes)) entry.equippedEmotes = entry.equippedEmote ? [entry.equippedEmote] : [];
  if (!('honorTitle'          in entry)) entry.honorTitle          = null;
  if (!('pendingHonorModal'   in entry)) entry.pendingHonorModal   = null;
  if (!('streak' in entry) || typeof entry.streak !== 'object') entry.streak = null;
  if (!('challenges' in entry)) entry.challenges = null;
  if (!entry.lifetime || typeof entry.lifetime !== 'object') entry.lifetime = {};
  if (!Array.isArray(entry.permClaimed)) entry.permClaimed = [];
  if (!Array.isArray(entry.history)) entry.history = [];
  const prevBal = entry.balance;
  applyDecay(entry);
  if (entry.balance !== prevBal) dbUpsertLibs(id, entry);
  return entry;
}

function updateLastActive(id, name) {
  if (!id) return;
  const entry = getLibsEntry(id);
  entry.lastActive = Date.now();
  if (name && name !== 'Anonyme') entry.name = name;
  libs.set(id, entry);
  dbUpsertLibs(id, entry);
}

let nextDistributionAt = 0;

function refreshAllHonorTitles() {
  const newR1Global = getGlobalLeaderboardData()[0]?.name || null;
  if (newR1Global !== rank1Global) {
    rank1Global      = newR1Global;
    rank1StreakSince = Date.now();
    dbSaveRank1Streak();
  }
  // Pas de sortie anticipée quand le nom du n°1 n'a pas changé : la boucle
  // ci-dessous est auto-reparatrice (elle ne reecrit que ce qui differe).
  // Cela recolle le titre si l'entree du n°1 l'a perdu (reinitialisation,
  // restauration SAV, nouvel appareil sous le meme pseudo...).
  for (const [id, entry] of libs.entries()) {
    if (entry.name === 'Libero') continue;
    const name = entry.name;
    if (!name || name === 'Anonyme') continue;

    const weeklyChamp = tournament.champion?.name || null;
    const newHonor = (name === rank1Global) ? 'honor-rank1-global'
                   : (weeklyChamp && name === weeklyChamp) ? 'honor-weekly-champ' : null;
    if (entry.honorTitle === newHonor) continue;

    entry.honorTitle = newHonor;
    entry.pendingHonorModal = newHonor !== null ? newHonor : null;
    libs.set(id, entry);
    dbUpsertLibs(id, entry);

    for (const [sockId, pid] of socketPlayerIds.entries()) {
      if (pid === id) io.to(sockId).emit('libs-update', { honorTitle: entry.honorTitle, pendingHonorModal: entry.pendingHonorModal });
    }
  }
}

function distributeLibs() {
  nextDistributionAt = Date.now() + 5 * 3_600_000;
  dbSaveNextDistributionAt();
  const ranked = getGlobalLeaderboardData();
  ranked.forEach((rankEntry, i) => {
    if (!rankEntry.name || rankEntry.name === 'Anonyme') return;
    // Top 3 : récompense pleine. Rangs 4 à 10 : lot de consolation de 2 Libs.
    // Tous les autres membres du classement global : 1 Lib.
    let reward = i < 3 ? LIBS_REWARDS[i] : (i < 10 ? 2 : 1);
    if (i === 0 && rank1StreakSince) {
      const streakDays = (Date.now() - rank1StreakSince) / 86400000;
      reward += Math.floor(streakDays / 3) * 5;
    }
    const matchingIds = new Set();
    for (const [id, e] of leaderboard.entries())       { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const [id, e] of triviaLeaderboard.entries()) { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const [id, e] of snakeLeaderboard.entries())  { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const [id, e] of luffyLeaderboard.entries())  { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const id of matchingIds) {
      const entry = getLibsEntry(id);
      entry.name    = rankEntry.name;
      entry.balance = Math.min(MAX_BALANCE, entry.balance + reward);
      libs.set(id, entry);
      dbUpsertLibs(id, entry);
      for (const [sockId, pid] of socketPlayerIds.entries()) {
        if (pid === id) io.to(sockId).emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: reward, nextAt: nextDistributionAt });
      }
    }
    if (matchingIds.size > 0) console.log(`[⚡] +${reward} Libs → ${rankEntry.name} (rang ${i + 1})`);
  });
}

const CODE_CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECONNECT_MS        = 30_000;
const TRIVIA_RECONNECT_MS = 20_000;
const VALID_GAMES  = new Set(['connect4', 'tictactoe', 'chess', 'checkers', 'ludo']);

const TRIVIA_CATEGORIES = {
  9: 'Culture Générale', 23: 'Histoire',       22: 'Géographie',
  17: 'Sciences',        21: 'Sports',          11: 'Cinéma',
  12: 'Musique',         14: 'Télévision',      19: 'Mathématiques',
  20: 'Informatique',    25: 'Arts',            27: 'Animaux',
  30: 'SVT',             31: 'Anglais',         32: 'Bénin',
};
const TRIVIA_COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2'];
const TRIVIA_Q_COUNT = 10;
const TRIVIA_TIME_MS = 30_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code) || triviaRooms.has(code)); // unique aux deux sections
  return code;
}

function createInitialState(gameType) {
  switch (gameType) {
    case 'connect4':  return { board: connect4.createBoard(), currentPlayer: 'R' };
    case 'tictactoe': return tictactoe.createState();
    case 'chess':     return chessGame.createState();
    case 'checkers':  return checkers.createState();
    case 'ludo':      return ludo.createState();
  }
}

// ── Leaderboard helpers ────────────────────────────────────────────────────

function updateLeaderboard(id, name, result) {
  if (!id) return;
  const e = leaderboard.get(id) || { name, wins: 0, losses: 0, draws: 0 };
  e.name = name;
  if (result === 'win')  e.wins++;
  if (result === 'loss') e.losses++;
  if (result === 'draw') e.draws++;
  leaderboard.set(id, e);
  dbUpsertLeaderboard(id, e);
  refreshAllHonorTitles();
}

function getLeaderboardData() {
  const byName = new Map();
  for (const [id, s] of leaderboard.entries()) {
    const name = s.name || id;
    const ex = byName.get(name) || { name, wins: 0, losses: 0, draws: 0 };
    ex.wins   += s.wins;
    ex.losses += s.losses;
    ex.draws  += s.draws;
    byName.set(name, ex);
  }
  return [...byName.values()]
    .sort((a, b) => b.wins - a.wins || (b.wins - b.losses) - (a.wins - a.losses) || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(e => ({ ...e, cosmetic: getCosmeticByName(e.name), font: getFontByName(e.name), nameEffect: getNameEffectByName(e.name), title: getTitleByName(e.name), honorTitle: getHonorTitleByName(e.name), avatar: getAvatarByName(e.name), cursorSnake: getCursorSnakeByName(e.name) }));
}

// ── Trivia leaderboard helpers ─────────────────────────────────────────────

function updateTriviaLeaderboard(id, name, points) {
  if (!id) return;
  const e = triviaLeaderboard.get(id) || { name, points: 0, games: 0 };
  e.name = name;
  e.points += Math.max(0, parseInt(points) || 0);
  e.games++;
  triviaLeaderboard.set(id, e);
  dbUpsertTriviaLeaderboard(id, e);
  refreshAllHonorTitles();
}

function getTriviaLeaderboardData() {
  const byName = new Map();
  for (const [id, s] of triviaLeaderboard.entries()) {
    const name = s.name || id;
    const ex = byName.get(name) || { name, points: 0, games: 0 };
    ex.points += s.points;
    ex.games  += s.games;
    byName.set(name, ex);
  }
  return [...byName.values()]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(e => ({ ...e, cosmetic: getCosmeticByName(e.name), font: getFontByName(e.name), nameEffect: getNameEffectByName(e.name), title: getTitleByName(e.name), honorTitle: getHonorTitleByName(e.name), avatar: getAvatarByName(e.name), cursorSnake: getCursorSnakeByName(e.name) }));
}

function updateSnakeLeaderboard(id, name, hs) {
  if (!id) return false;
  const isNew = !snakeLeaderboard.has(id);
  const existing = snakeLeaderboard.get(id) || { name, hs: 0 };
  existing.name = name;
  const improved = hs > existing.hs;
  if (improved) existing.hs = hs;
  snakeLeaderboard.set(id, existing);
  if (improved || isNew) { dbUpsertSnakeLeaderboard(id, existing); refreshAllHonorTitles(); }
  return improved ? 'improved' : isNew ? 'registered' : false;
}

function getSnakeLeaderboardData() {
  const byName = new Map();
  for (const [id, s] of snakeLeaderboard.entries()) {
    if (s.hs <= 0) continue;
    const displayName = s.name || id;
    const existing = byName.get(displayName);
    if (!existing || s.hs > existing.hs) byName.set(displayName, { name: displayName, hs: s.hs });
  }
  return [...byName.values()]
    .sort((a, b) => b.hs - a.hs || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(e => ({ ...e, cosmetic: getCosmeticByName(e.name), font: getFontByName(e.name), nameEffect: getNameEffectByName(e.name), title: getTitleByName(e.name), honorTitle: getHonorTitleByName(e.name), avatar: getAvatarByName(e.name), cursorSnake: getCursorSnakeByName(e.name) }));
}

function updateLuffyLeaderboard(id, name, hs) {
  if (!id) return false;
  const isNew = !luffyLeaderboard.has(id);
  const existing = luffyLeaderboard.get(id) || { name, hs: 0 };
  existing.name = name;
  const improved = hs > existing.hs;
  if (improved) existing.hs = hs;
  luffyLeaderboard.set(id, existing);
  if (improved || isNew) { dbUpsertLuffyLeaderboard(id, existing); refreshAllHonorTitles(); }
  return improved ? 'improved' : isNew ? 'registered' : false;
}

function getLuffyLeaderboardData() {
  const byName = new Map();
  for (const [id, s] of luffyLeaderboard.entries()) {
    if (s.hs <= 0) continue;
    const displayName = s.name || id;
    const existing = byName.get(displayName);
    if (!existing || s.hs > existing.hs) byName.set(displayName, { name: displayName, hs: s.hs });
  }
  return [...byName.values()]
    .sort((a, b) => b.hs - a.hs || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(e => ({ ...e, cosmetic: getCosmeticByName(e.name), font: getFontByName(e.name), nameEffect: getNameEffectByName(e.name), title: getTitleByName(e.name), honorTitle: getHonorTitleByName(e.name), avatar: getAvatarByName(e.name), cursorSnake: getCursorSnakeByName(e.name) }));
}

function getGlobalLeaderboardData() {
  const ids = new Set([...leaderboard.keys(), ...triviaLeaderboard.keys(), ...snakeLeaderboard.keys(), ...luffyLeaderboard.keys()]);
  const byName = new Map();
  for (const id of ids) {
    const c  = leaderboard.get(id)       || { name: '', wins: 0 };
    const tr = triviaLeaderboard.get(id) || { name: '', points: 0 };
    const sk = snakeLeaderboard.get(id)  || { name: '', hs: 0 };
    const lf = luffyLeaderboard.get(id)  || { name: '', hs: 0 };
    const name = c.name || tr.name || sk.name || lf.name;
    if (!name) continue;
    const existing = byName.get(name) || { name, wins: 0, triviaPoints: 0, snakeHs: 0, luffyHs: 0 };
    existing.wins         = Math.max(existing.wins, c.wins || 0);
    existing.triviaPoints = Math.max(existing.triviaPoints, tr.points || 0);
    existing.snakeHs      = Math.max(existing.snakeHs, sk.hs || 0);
    existing.luffyHs      = Math.max(existing.luffyHs, lf.hs || 0);
    byName.set(name, existing);
  }
  return [...byName.values()]
    .map(e => ({ ...e, globalScore: e.wins * 10 + e.triviaPoints + e.snakeHs * 10 + Math.round(e.luffyHs / 10) }))
    .filter(e => e.globalScore > 0)
    .sort((a, b) => b.globalScore - a.globalScore || a.name.localeCompare(b.name))
    .slice(0, 50)
    .map(e => ({ ...e, cosmetic: getCosmeticByName(e.name), font: getFontByName(e.name), nameEffect: getNameEffectByName(e.name), title: getTitleByName(e.name), honorTitle: getHonorTitleByName(e.name), avatar: getAvatarByName(e.name), cursorSnake: getCursorSnakeByName(e.name) }));
}

// ── Trivia room helpers ────────────────────────────────────────────────────

function getTriviaRoomState(room) {
  return {
    code:         room.code,
    hostId:       room.hostId,
    categoryName: room.categoryName,
    status:       room.status,
    players: [...room.players.entries()].filter(([, p]) => !p.disconnected).map(([sid, p]) => ({
      socketId: sid, name: p.name, colorIndex: p.colorIndex, score: p.score,
    })),
  };
}

// Usage interne uniquement : contient le playerId (secret), ne jamais émettre tel quel.
function getRoomScores(room) {
  return [...room.players.entries()]
    .filter(([, p]) => !p.disconnected)
    .map(([sid, p]) => ({ socketId: sid, name: p.name, playerId: p.playerId, score: p.score, colorIndex: p.colorIndex }))
    .sort((a, b) => b.score - a.score);
}

// Projection sûre pour diffusion aux clients : retire le playerId (jeton d'identité
// secret qui, s'il fuitait, permettrait d'usurper le compte d'un autre joueur).
function publicScores(room) {
  return getRoomScores(room).map(({ playerId, ...rest }) => rest);
}

// Anti-répétition : ids des questions déjà servies à chaque joueur (mémoire
// process, plafonné). Un joueur ne revoit une question que si tout son pool
// sur le thème/difficulté demandés a déjà été vu.
const triviaSeen = new Map(); // playerId -> { set: Set<qid>, order: [qid] }
const TRIVIA_SEEN_MAX = 500;
function triviaSeenFor(playerId) {
  if (!playerId) return null;
  let e = triviaSeen.get(playerId);
  if (!e) { e = { set: new Set(), order: [] }; triviaSeen.set(playerId, e); }
  return e;
}
function _persistTriviaSeen(pid, e) {
  if (db) db.collection('trivia_seen').updateOne({ _id: pid }, { $set: { ids: e.order.slice(-TRIVIA_SEEN_MAX) } }, { upsert: true }).catch(() => {});
}
function markTriviaSeen(playerIds, questions) {
  for (const pid of playerIds) {
    const e = triviaSeenFor(pid);
    if (!e) continue;
    let changed = false;
    for (const q of questions) {
      if (!q.id || e.set.has(q.id)) continue;
      e.set.add(q.id);
      e.order.push(q.id);
      changed = true;
    }
    while (e.order.length > TRIVIA_SEEN_MAX) e.set.delete(e.order.shift());
    // Persiste pour que l'anti-repetition survive aux redemarrages du serveur.
    if (changed) _persistTriviaSeen(pid, e);
  }
}

function startTriviaGame(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  try {
    const cats = room.categories || [room.category];
    const lang = room.lang || 'fr';
    const diff = room.difficulty || '';
    // Union des questions déjà vues par les joueurs du salon : personne ne revoit les siennes.
    const seen = new Set();
    const pids = [...room.players.values()].map(p => p.playerId).filter(Boolean);
    for (const pid of pids) for (const id of (triviaSeen.get(pid)?.set || [])) seen.add(id);
    room.questions = triviaGame.pickQuestions({ cats, amount: room.totalQ, lang, diff, seen });
    room.totalQ = room.questions.length; // au cas où le pool serait plus court que demandé
    markTriviaSeen(pids, room.questions);
  } catch {
    io.to(code).emit('trivia-error', { message: 'Impossible de charger les questions. Réessaie.' });
    room.status = 'waiting';
    return;
  }
  room.status   = 'question';
  room.currentQ = 0;
  io.to(code).emit('trivia-start', { totalQuestions: room.totalQ, categoryName: room.categoryName });
  sendTriviaQuestion(code);
}

function sendTriviaQuestion(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  const q = room.questions[room.currentQ];
  room.answersThisRound = new Map();
  room.status = 'question';
  room.questionStartAt = Date.now(); // pour le bonus de vitesse
  io.to(code).emit('trivia-question', {
    questionNum:    room.currentQ + 1,
    totalQuestions: room.totalQ,
    question:       q.question,
    choices:        q.choices,
    timeLimit:      (room.timeMs || TRIVIA_TIME_MS) / 1000,
    scores:         publicScores(room),
  });
  room.timer = setTimeout(() => revealTriviaAnswer(code), room.timeMs || TRIVIA_TIME_MS);
}

function revealTriviaAnswer(code) {
  const room = triviaRooms.get(code);
  if (!room || room.status !== 'question') return;
  clearTimeout(room.timer);
  room.timer  = null;
  room.status = 'reveal';

  const correct = room.questions[room.currentQ].correct;
  const correctSocketIds = [];
  const gains = {}; // socketId -> { pts, fast } pour les animations côté client
  for (const [sid, ans] of room.answersThisRound) {
    if (ans && ans.choice === correct) {
      const p = room.players.get(sid);
      if (p) {
        // Bonus de vitesse : répondre dans les 40% premiers du temps double le point.
        const elapsed = (ans.at || Date.now()) - (room.questionStartAt || 0);
        const fast = elapsed <= (room.timeMs || TRIVIA_TIME_MS) * 0.4;
        const pts  = fast ? 2 : 1;
        p.score += pts;
        gains[sid] = { pts, fast };
        correctSocketIds.push(sid);
        bumpChallenge(p.playerId, 'triviaCorrect');
      }
    }
  }
  io.to(code).emit('trivia-reveal', { correct, correctSocketIds, gains, scores: publicScores(room) });
  room.revealTimer = setTimeout(() => nextTriviaQuestion(code), 3500);
}

function nextTriviaQuestion(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  room.currentQ++;
  if (room.currentQ >= room.totalQ) finishTriviaGame(code);
  else sendTriviaQuestion(code);
}

function finishTriviaGame(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  room.status = 'finished';
  bumpDaily('games');
  const scores = getRoomScores(room);

  for (const s of scores) {
    updateTriviaLeaderboard(s.playerId || s.name, s.name, s.score);
    updateLastActive(s.playerId, s.name);
    pushHistory(s.playerId, { game: 'trivia', result: null, score: s.score });
    bumpChallenge(s.playerId, 'triviaGames'); // défi « termine N quiz »
  }
  io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  io.emit('global-leaderboard-update', getGlobalLeaderboardData());

  io.to(code).emit('trivia-finished', { scores: scores.map(({ playerId, ...rest }) => rest) });
  setTimeout(() => triviaRooms.delete(code), 60_000);
}

// ── Bot : calcule et joue le coup du robot ─────────────────────────────────

function scheduleBotMove(code) {
  setTimeout(() => {
    const room = rooms.get(code);
    if (!room || !room.vsBot || room.status !== 'playing') return;
    if (room.state.currentPlayer !== 'Y') return;

    let newState, status, winner;

    const diff = room.botDifficulty || 'medium';
    switch (room.gameType) {
      case 'tictactoe': {
        const cell = bots.botMoveTTT(room.state.board, diff);
        if (cell === -1) return;
        const res = tictactoe.applyMove(room.state, cell);
        if (!res) return;
        newState = { board: res.board, currentPlayer: res.currentPlayer, winLine: res.winLine };
        status = res.status; winner = res.winner;
        break;
      }
      case 'connect4': {
        const col = bots.botMoveConnect4(room.state.board, diff);
        if (col === -1) return;
        const board = room.state.board.map(r => [...r]);
        const row   = connect4.dropPiece(board, col, 'Y');
        if (row === -1) return;
        status = 'playing'; winner = null;
        if (connect4.checkWin(board, row, col, 'Y')) { status = 'won'; winner = 'Y'; }
        else if (connect4.checkDraw(board))           { status = 'draw'; }
        newState = { board, currentPlayer: status === 'playing' ? 'R' : 'Y' };
        break;
      }
      case 'chess': {
        const move = bots.botMoveChess(room.state.fen, diff);
        if (!move) return;
        const res = chessGame.applyMove(room.state, move);
        if (!res) return;
        newState = { fen: res.fen, currentPlayer: res.currentPlayer, isCheck: res.isCheck };
        status = res.status; winner = res.winner;
        break;
      }
      case 'checkers': {
        const move = checkers.botMove(room.state, diff);
        if (!move) { // le bot ne peut plus bouger : le joueur humain gagne
          room.status = 'won'; room.winner = 'R';
          io.to(code).emit('game-update', { gameType: room.gameType, state: room.state, status: 'won', winner: 'R' });
          const humanName = room.playerNames.R, humanId = room.playerIds?.R || humanName;
          if (humanName) { updateLeaderboard(humanId, humanName, 'win'); updateLastActive(humanId, humanName); io.emit('leaderboard-update', getLeaderboardData()); io.emit('global-leaderboard-update', getGlobalLeaderboardData()); }
          return;
        }
        const res = checkers.applyMove(room.state, move);
        if (!res) return;
        newState = { board: res.board, currentPlayer: res.currentPlayer, mustFrom: res.mustFrom, lastMove: res.lastMove };
        status = res.status; winner = res.winner;
        break;
      }
      case 'ludo': {
        const move = ludo.botMove(room.state, diff);
        if (!move) return;
        const res = ludo.applyMove(room.state, move);
        if (!res) return;
        newState = res.state;
        status = res.status; winner = res.winner;
        break;
      }
      default: return;
    }

    room.state  = newState;
    room.status = status;
    room.winner = winner;
    io.to(code).emit('game-update', { gameType: room.gameType, state: newState, status, winner });

    if (status !== 'playing') {
      const humanName = room.playerNames.R;
      const humanId   = room.playerIds?.R || humanName;
      if (humanName) {
        if (status === 'won') {
          updateLeaderboard(humanId, humanName, winner === 'R' ? 'win' : 'loss');
        } else {
          updateLeaderboard(humanId, humanName, 'draw');
        }
        updateLastActive(humanId, humanName);
        io.emit('leaderboard-update', getLeaderboardData());
        io.emit('global-leaderboard-update', getGlobalLeaderboardData());
      }
    } else if (room.state.currentPlayer === 'Y') {
      // Dames : rafle multiple, le bot rejoue avec la même pièce.
      scheduleBotMove(code);
    }
  }, 700);
}

// ── Socket ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let roomCode      = null;
  let myPlayer      = null;
  let triviaRoomCode = null;

  // Anti-abus : limite la cadence des actions économiques sur CE socket, pour
  // qu'un playerId éventuellement divulgué ne puisse pas être vidé/harcelé en
  // rafale. Renvoie true si l'action est autorisée maintenant.
  const _actionTimes = new Map(); // action -> [timestamps]
  function allowAction(action, max = 12, windowMs = 10_000) {
    const now = Date.now();
    const arr = (_actionTimes.get(action) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) { _actionTimes.set(action, arr); return false; }
    arr.push(now);
    _actionTimes.set(action, arr);
    return true;
  }

  socket.emit('server-announcement', SERVER_ANNOUNCEMENT);
  socket.on('announcement-dismissed', () => {});

  // ── Créer une room ──────────────────────────────────────────────────────
  socket.on('create-room', ({ gameType = 'connect4', name = '', vsBot = false, botDifficulty = 'medium', playerId, stake = 0 } = {}) => {
    if (!VALID_GAMES.has(gameType)) return;
    const playerName = sanitizeName(name, 'Anonyme');
    const diff = ['easy', 'medium', 'hard'].includes(botDifficulty) ? botDifficulty : 'medium';
    // Duel avec mise : montants fixes, jamais contre le bot, solde suffisant exige.
    let duelStake = [25, 50, 100].includes(Number(stake)) && !vsBot ? Number(stake) : 0;
    if (duelStake > 0) {
      const pid = safePlayerId(playerId);
      const entry = pid ? getLibsEntry(pid) : null;
      if (!entry || !entry.name || entry.name === 'Anonyme' || entry.balance < duelStake) {
        socket.emit('error', { message: 'stake_insufficient' });
        return;
      }
    }

    const code = generateCode();
    rooms.set(code, {
      code,
      gameType,
      state: createInitialState(gameType),
      players:     { R: socket.id, Y: vsBot ? 'bot' : null },
      playerNames: { R: playerName, Y: vsBot ? '🤖 Robot' : null },
      playerIds:   { R: safePlayerId(playerId) || playerName, Y: null },
      status: vsBot ? 'playing' : 'waiting',
      vsBot,
      botDifficulty: diff,
      winner: null,
      stake: duelStake,
      potPaid: false,
      restartVotes: new Set(),
      reconnectTimers: { R: null, Y: null },
    });

    roomCode = code;
    myPlayer = 'R';
    socket.join(code);

    if (vsBot) {
      socket.emit('game-start', { gameType, state: createInitialState(gameType), yourPlayer: 'R', vsBot: true, botDifficulty: diff, code });
    } else {
      socket.emit('room-created', { code, gameType, stake: duelStake });
    }
  });

  // ── Mises de duel : encaissement au depart, reglement a la fin ────────────
  function _collectStake(room) {
    if (!room.stake || room.potPaid) return true;
    const ids = [room.playerIds?.R, room.playerIds?.Y].map(safePlayerId);
    if (!ids[0] || !ids[1]) return false;
    const entries = ids.map(getLibsEntry);
    if (entries.some(e => !e || e.balance < room.stake)) return false;
    entries.forEach((e, i) => {
      e.balance -= room.stake;
      libs.set(ids[i], e);
      dbUpsertLibs(ids[i], e);
      _emitToPlayer(ids[i], 'libs-update', { balance: e.balance, delta: -room.stake, nextAt: nextDistributionAt });
    });
    room.potPaid = true;
    return true;
  }
  function _settleStake(room, outcome, winnerRole) {
    if (!room.stake || !room.potPaid) return;
    room.potPaid = false;
    const pot = room.stake * 2;
    if (outcome === 'won') {
      const pid = safePlayerId(room.playerIds?.[winnerRole]);
      if (pid) {
        const e = getLibsEntry(pid);
        e.balance = Math.min(MAX_BALANCE, e.balance + pot);
        libs.set(pid, e);
        dbUpsertLibs(pid, e);
        _emitToPlayer(pid, 'libs-update', { balance: e.balance, delta: pot, nextAt: nextDistributionAt });
      }
      io.to(room.code).emit('stake-result', { outcome: 'won', winnerRole, pot });
    } else { // nul ou partie annulee : chacun recupere sa mise
      for (const role of ['R', 'Y']) {
        const pid = safePlayerId(room.playerIds?.[role]);
        if (!pid) continue;
        const e = getLibsEntry(pid);
        e.balance = Math.min(MAX_BALANCE, e.balance + room.stake);
        libs.set(pid, e);
        dbUpsertLibs(pid, e);
        _emitToPlayer(pid, 'libs-update', { balance: e.balance, delta: room.stake, nextAt: nextDistributionAt });
      }
      io.to(room.code).emit('stake-result', { outcome: 'refund', pot: room.stake });
    }
  }

  // ── Tentatives de jointure (renvoient true si le code correspond à ce
  //    type de salle, qu'elle ait été rejointe ou pleine/déjà lancée). ──────
  function tryJoinClassic(code, name, playerId) {
    const key  = (code || '').toUpperCase().trim();
    const room = rooms.get(key);
    if (!room) return false;
    if (room.players.Y) { socket.emit('error', { message: 'Cette room est déjà pleine.' }); return true; }

    const playerName = sanitizeName(name, 'Anonyme');
    // Duel avec mise : le joignant doit etre nomme et avoir le solde.
    if (room.stake > 0) {
      const jid = safePlayerId(playerId);
      const je  = jid ? getLibsEntry(jid) : null;
      if (!je || !je.name || je.name === 'Anonyme' || je.balance < room.stake) {
        socket.emit('error', { message: 'stake_insufficient_join', stake: room.stake });
        return true;
      }
    }
    room.players.Y     = socket.id;
    room.playerNames.Y = playerName;
    if (room.playerIds) room.playerIds.Y = safePlayerId(playerId) || playerName;
    room.status = 'playing';
    roomCode = key;
    myPlayer = 'Y';
    socket.join(key);

    if (room.stake > 0 && !_collectStake(room)) room.stake = 0; // filet de securite

    for (const p of ['R', 'Y']) {
      io.to(room.players[p]).emit('game-start', {
        gameType:   room.gameType,
        state:      room.state,
        yourPlayer: p,
        code:       key,
        stake:      room.stake || 0,
      });
    }
    return true;
  }

  function tryJoinTrivia(code, name, playerId) {
    const key  = (code || '').toUpperCase().trim();
    const room = triviaRooms.get(key);
    if (!room) return false;
    if (room.status !== 'waiting') { socket.emit('trivia-error', { message: 'La partie a déjà commencé.' }); return true; }
    if (room.players.size >= 6)    { socket.emit('trivia-error', { message: 'Le salon est complet (6 joueurs max).' }); return true; }

    const playerName = sanitizeName(name, 'Anonyme');
    const colorIndex = room.players.size;
    room.players.set(socket.id, { name: playerName, playerId: safePlayerId(playerId) || playerName, colorIndex, score: 0 });
    triviaRoomCode = key;
    socket.join(key);
    socket.emit('trivia-room-joined', { code: key, categoryName: room.categoryName });
    io.to(key).emit('trivia-room-updated', getTriviaRoomState(room));
    return true;
  }

  // ── Rejoindre une room ──────────────────────────────────────────────────
  // On tente d'abord le type de la section courante, puis l'autre : ainsi un
  // code de Jeux Classiques saisi dans le Quiz (et inversement) lance quand
  // même la bonne partie au lieu d'afficher une erreur.
  socket.on('join-room', ({ code, name = '', playerId } = {}) => {
    if (tryJoinClassic(code, name, playerId)) return;
    if (tryJoinTrivia(code, name, playerId))  return;
    socket.emit('error', { message: 'Room introuvable. Vérifie le code.' });
  });

  // Jointure universelle (utilisée par les liens de partage) : peu importe la
  // section, on résout le type de salle à partir du code seul.
  socket.on('join-by-code', ({ code, name = '', playerId } = {}) => {
    if (tryJoinClassic(code, name, playerId)) return;
    if (tryJoinTrivia(code, name, playerId))  return;
    socket.emit('join-code-failed', { message: 'Partie introuvable. Vérifie le lien ou le code.' });
  });

  // ── Reconnexion après reload ────────────────────────────────────────────
  socket.on('reconnect-room', ({ code, player }) => {
    const key  = (code || '').toUpperCase().trim();
    const room = rooms.get(key);

    if (!room || (player !== 'R' && player !== 'Y')) { socket.emit('reconnect-failed'); return; }

    const storedId     = room.players[player];
    const storedSocket = storedId ? io.sockets.sockets.get(storedId) : null;
    if (storedSocket?.connected) { socket.emit('reconnect-failed'); return; }

    if (room.reconnectTimers[player]) {
      clearTimeout(room.reconnectTimers[player]);
      room.reconnectTimers[player] = null;
    }

    room.players[player] = socket.id;
    roomCode = key;
    myPlayer = player;
    socket.join(key);

    socket.emit('reconnect-success', {
      gameType:     room.gameType,
      state:        room.state,
      yourPlayer:   player,
      status:       room.status,
      winner:       room.winner,
      roomCode:     room.code,
      vsBot:        room.vsBot || false,
      botDifficulty: room.botDifficulty || null,
    });

    if (room.vsBot && room.status === 'playing' && room.state.currentPlayer === 'Y') {
      scheduleBotMove(roomCode);
    }

    const other = player === 'R' ? 'Y' : 'R';
    if (room.players[other] && room.players[other] !== 'bot') io.to(room.players[other]).emit('opponent-reconnected');
  });

  // ── Jouer un coup ───────────────────────────────────────────────────────
  socket.on('make-move', (move) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;
    if (room.state.currentPlayer !== myPlayer) return;

    let newState, status, winner;

    switch (room.gameType) {

      case 'connect4': {
        const col = parseInt(move.col, 10);
        if (isNaN(col) || col < 0 || col >= 7) return;

        const board = room.state.board.map(r => [...r]);
        const row   = connect4.dropPiece(board, col, myPlayer);
        if (row === -1) return;

        status = 'playing'; winner = null;
        if (connect4.checkWin(board, row, col, myPlayer)) { status = 'won';  winner = myPlayer; }
        else if (connect4.checkDraw(board))               { status = 'draw'; }

        newState = { board, currentPlayer: status === 'playing' ? (myPlayer === 'R' ? 'Y' : 'R') : myPlayer };
        break;
      }

      case 'tictactoe': {
        const result = tictactoe.applyMove(room.state, move.cell);
        if (!result) return;
        newState = { board: result.board, currentPlayer: result.currentPlayer, winLine: result.winLine };
        status   = result.status;
        winner   = result.winner;
        break;
      }

      case 'chess': {
        const result = chessGame.applyMove(room.state, move);
        if (!result) return;
        newState = { fen: result.fen, currentPlayer: result.currentPlayer, isCheck: result.isCheck };
        status   = result.status;
        winner   = result.winner;
        break;
      }

      case 'checkers': {
        const result = checkers.applyMove(room.state, move);
        if (!result) return;
        newState = { board: result.board, currentPlayer: result.currentPlayer, mustFrom: result.mustFrom, lastMove: result.lastMove };
        status   = result.status;
        winner   = result.winner;
        break;
      }

      case 'ludo': {
        const result = ludo.applyMove(room.state, move);
        if (!result) return;
        newState = result.state;
        status   = result.status;
        winner   = result.winner;
        break;
      }

      default: return;
    }

    room.state  = newState;
    room.status = status;
    room.winner = winner;

    io.to(roomCode).emit('game-update', { gameType: room.gameType, state: newState, status, winner });

    if (status !== 'playing') {
      bumpDaily('games');
      if (!room.vsBot) {
        _settleStake(room, status, winner);
        if (status === 'won') {
          const loserRole = winner === 'R' ? 'Y' : 'R';
          updateLeaderboard(room.playerIds?.[winner]    || room.playerNames[winner],   room.playerNames[winner],   'win');
          updateLeaderboard(room.playerIds?.[loserRole] || room.playerNames[loserRole], room.playerNames[loserRole], 'loss');
          updateLastActive(room.playerIds?.[winner],    room.playerNames[winner]);
          updateLastActive(room.playerIds?.[loserRole], room.playerNames[loserRole]);
          pushHistory(room.playerIds?.[winner],    { game: room.gameType, result: 'win' });
          pushHistory(room.playerIds?.[loserRole], { game: room.gameType, result: 'loss' });
          bumpChallenge(room.playerIds?.[winner], 'gamesWon');
          if (room.gameType === 'ludo') bumpChallenge(room.playerIds?.[winner], 'ludoWins');
        } else {
          updateLeaderboard(room.playerIds?.R || room.playerNames.R, room.playerNames.R, 'draw');
          updateLeaderboard(room.playerIds?.Y || room.playerNames.Y, room.playerNames.Y, 'draw');
          updateLastActive(room.playerIds?.R, room.playerNames.R);
          updateLastActive(room.playerIds?.Y, room.playerNames.Y);
          pushHistory(room.playerIds?.R, { game: room.gameType, result: 'draw' });
          pushHistory(room.playerIds?.Y, { game: room.gameType, result: 'draw' });
        }
        io.emit('leaderboard-update', getLeaderboardData());
        io.emit('global-leaderboard-update', getGlobalLeaderboardData());
      } else {
        // Solo vs bot (toutes difficultés) : enregistrer le joueur humain
        const humanName = room.playerNames.R;
        const humanId   = room.playerIds?.R || humanName;
        if (humanName) {
          if (status === 'won') {
            const humanWon = winner === 'R';
            updateLeaderboard(humanId, humanName, humanWon ? 'win' : 'loss');
            pushHistory(room.playerIds?.R, { game: room.gameType, result: humanWon ? 'win' : 'loss' });
            if (humanWon) bumpChallenge(room.playerIds?.R, 'gamesWon');
            if (humanWon && room.gameType === 'ludo') bumpChallenge(room.playerIds?.R, 'ludoWins');
          } else {
            updateLeaderboard(humanId, humanName, 'draw');
            pushHistory(room.playerIds?.R, { game: room.gameType, result: 'draw' });
          }
          updateLastActive(humanId, humanName);
          io.emit('leaderboard-update', getLeaderboardData());
          io.emit('global-leaderboard-update', getGlobalLeaderboardData());
        }
      }
    } else if (room.vsBot) {
      scheduleBotMove(roomCode);
    }
  });

  // ── Coups légaux (échecs et dames) ──────────────────────────────────────
  socket.on('get-moves', ({ square }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing' || room.state.currentPlayer !== myPlayer) {
      socket.emit('legal-moves', { square, moves: [] });
      return;
    }
    if (room.gameType === 'chess') {
      socket.emit('legal-moves', { square, moves: chessGame.getLegalMoves(room.state.fen, square) });
    } else if (room.gameType === 'checkers') {
      socket.emit('legal-moves', { square, moves: checkers.getLegalMoves(room.state, square) });
    } else {
      socket.emit('legal-moves', { square, moves: [] });
    }
  });

  // ── Rejouer ─────────────────────────────────────────────────────────────
  socket.on('request-restart', () => {
    const room = rooms.get(roomCode);
    if (!room || (room.status !== 'won' && room.status !== 'draw')) return;

    if (room.vsBot) {
      room.state  = createInitialState(room.gameType);
      room.status = 'playing';
      room.winner = null;
      socket.emit('game-start', { gameType: room.gameType, state: room.state, yourPlayer: 'R', vsBot: true, botDifficulty: room.botDifficulty });
      return;
    }

    room.restartVotes.add(socket.id);

    if (room.restartVotes.size >= 2) {
      room.state  = createInitialState(room.gameType);
      room.status = 'playing';
      room.winner = null;
      room.restartVotes.clear();
      // Revanche : on remet la meme mise si les deux peuvent payer, sinon 0.
      if (room.stake > 0 && !_collectStake(room)) {
        room.stake = 0;
        io.to(room.code).emit('stake-result', { outcome: 'cancelled' });
      }

      for (const p of ['R', 'Y']) {
        io.to(room.players[p]).emit('game-start', {
          gameType:   room.gameType,
          state:      room.state,
          yourPlayer: p,
          stake:      room.stake || 0,
        });
      }
    } else {
      socket.to(roomCode).emit('restart-requested');
      socket.emit('restart-vote-sent');
    }
  });

  // ── Refuser une revanche ─────────────────────────────────────────────────
  socket.on('decline-restart', () => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.restartVotes.clear();
    socket.to(roomCode).emit('restart-declined'); // prévient celui qui a proposé
  });

  // ── Annuler une partie en attente (le créateur ne reste pas coincé) ───────
  socket.on('cancel-room', () => {
    const room = rooms.get(roomCode);
    if (room && room.status === 'waiting') rooms.delete(roomCode);
    roomCode = null;
    myPlayer = null;
  });

  // ── Classement ───────────────────────────────────────────────────────────
  socket.on('get-leaderboard', () => {
    socket.emit('leaderboard-update', getLeaderboardData());
    socket.emit('global-leaderboard-update', getGlobalLeaderboardData());
  });

  socket.on('get-global-leaderboard', () => {
    socket.emit('global-leaderboard-update', getGlobalLeaderboardData());
  });

  socket.on('get-snake-leaderboard', () => {
    socket.emit('snake-leaderboard-update', getSnakeLeaderboardData());
  });

  socket.on('get-luffy-leaderboard', () => {
    socket.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
  });

  socket.on('check-pseudo', ({ name, playerId } = {}) => {
    const cleanName = sanitizeName(name);
    const id = safePlayerId(playerId);
    if (!cleanName || cleanName === 'Anonyme' || !id) {
      socket.emit('pseudo-check-result', { taken: false });
      return;
    }
    const taken = [leaderboard, triviaLeaderboard, snakeLeaderboard, luffyLeaderboard].some(map => {
      for (const [k, v] of map.entries()) {
        if (v.name === cleanName && k !== id) return true;
      }
      return false;
    });
    socket.emit('pseudo-check-result', { taken });
  });

  socket.on('rename-player', ({ name, playerId } = {}) => {
    if (!allowAction('rename', 8, 60_000)) { socket.emit('rename-result', { ok: false, error: 'rate' }); return; }
    const newName = sanitizeName(name);
    const id = safePlayerId(playerId);
    if (!newName || newName === 'Anonyme' || !id) {
      socket.emit('rename-result', { ok: false, error: 'invalid' });
      return;
    }
    const taken = [leaderboard, triviaLeaderboard, snakeLeaderboard, luffyLeaderboard].some(map => {
      for (const [k, v] of map.entries()) {
        if (v.name === newName && k !== id) return true;
      }
      return false;
    });
    if (taken) { socket.emit('rename-result', { ok: false, error: 'taken' }); return; }
    let changed = false;
    [[leaderboard, dbUpsertLeaderboard], [triviaLeaderboard, dbUpsertTriviaLeaderboard],
     [snakeLeaderboard, dbUpsertSnakeLeaderboard], [luffyLeaderboard, dbUpsertLuffyLeaderboard], [libs, dbUpsertLibs]].forEach(([map, upsert]) => {
      const entry = map.get(id);
      if (entry) { entry.name = newName; map.set(id, entry); upsert(id, entry); changed = true; }
    });
    if (changed) {
      refreshAllHonorTitles();
      io.emit('leaderboard-update', getLeaderboardData());
      io.emit('global-leaderboard-update', getGlobalLeaderboardData());
      io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
      io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
      io.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
    }
    socket.emit('rename-result', { ok: true });
  });

  socket.on('submit-snake-score', ({ name, hs, playerId } = {}) => {
    const playerName = sanitizeName(name);
    if (!playerName || typeof hs !== 'number') return;
    const id = safePlayerId(playerId) || playerName;
    const result = updateSnakeLeaderboard(id, playerName, Math.max(0, Math.floor(hs)));
    updateLastActive(id, playerName);
    if (result === 'improved') {
      io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
      io.emit('global-leaderboard-update', getGlobalLeaderboardData());
    } else if (result === 'registered') {
      io.emit('global-leaderboard-update', getGlobalLeaderboardData());
    }
  });

  socket.on('submit-luffy-score', ({ name, hs, playerId } = {}) => {
    const playerName = sanitizeName(name);
    if (!playerName || typeof hs !== 'number') return;
    const id = safePlayerId(playerId) || playerName;
    const result = updateLuffyLeaderboard(id, playerName, Math.max(0, Math.floor(hs)));
    updateLastActive(id, playerName);
    if (result === 'improved' || result === 'registered') {
      io.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
    }
  });

  // ── Évent Snake : chaque ⚡ mangé est crédité en Libs, en direct ──────────
  // Le crédit se fait au fil de la partie (pas en une fois à la fin) : un
  // refresh en pleine partie ne perd donc rien. Le serveur ne fait pas
  // confiance au client : chaque « miam » doit être plausible dans le temps.
  socket.on('snake-game-start', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id || !isSnakeEventDay()) return;
    snakeLibsGames.set(socket.id, { playerId: id, startedAt: Date.now(), eats: 0, lastEatAt: 0 });
  });

  socket.on('snake-eat', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id || !isSnakeEventDay()) return;
    const game = snakeLibsGames.get(socket.id);
    if (!game || game.playerId !== id) return; // partie jamais déclarée
    const now = Date.now();
    // Plausibilité : atteindre un ⚡ demande de traverser le plateau (≥ 300 ms
    // entre deux prises, et pas plus d'un ⚡ toutes les ~0,7 s en moyenne),
    // plafond de 200 ⚡ par partie.
    if (game.eats >= 200) return;
    if (now - game.lastEatAt < 300) return;
    if (game.eats + 1 > (now - game.startedAt) / 700 + 2) return;
    game.eats++;
    game.lastEatAt = now;
    const entry = getLibsEntry(id);
    if (!entry) return;
    bumpChallenge(id, 'snakeEaten'); // compte pour le défi même au solde plafonné
    if (entry.balance >= MAX_BALANCE) return;
    entry.balance = Math.min(MAX_BALANCE, entry.balance + 1);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: 1, nextAt: nextDistributionAt });
  });

  // ── Quitter la room (retour menu) ───────────────────────────────────────
  socket.on('leave-room', () => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.players[myPlayer] !== socket.id) return;

    if (room.reconnectTimers[myPlayer]) {
      clearTimeout(room.reconnectTimers[myPlayer]);
      room.reconnectTimers[myPlayer] = null;
    }

    const other = myPlayer === 'R' ? 'Y' : 'R';
    if (room.status !== 'waiting' && room.players[other]) {
      io.to(room.players[other]).emit('player-disconnected');
    }
    rooms.delete(roomCode);
    roomCode = null;
    myPlayer = null;
  });

  // ── Trivia : créer un salon ──────────────────────────────────────────────
  socket.on('create-trivia-room', ({ categories, name = '', lang = 'fr', difficulty = '', amount, playerId } = {}) => {
    const cats = [].concat(categories || []).map(c => parseInt(c)).filter(c => TRIVIA_CATEGORIES[c]);
    if (cats.length === 0) return;
    const playerName = sanitizeName(name, 'Anonyme');
    const roomLang = ['fr', 'en'].includes(lang) ? lang : 'fr';
    // 'extreme' = questions pointues (pool hard) + chrono reduit a 15 s.
    const roomDiff = ['easy', 'medium', 'hard', 'extreme'].includes(difficulty) ? difficulty : '';
    const rawN = parseInt(amount) || TRIVIA_Q_COUNT;
    const totalQ = Math.round(Math.min(40, Math.max(10, rawN)) / 5) * 5;
    const code = generateCode();
    const players = new Map();
    players.set(socket.id, { name: playerName, playerId: safePlayerId(playerId) || playerName, colorIndex: 0, score: 0 });
    const catNames = cats.map(c => TRIVIA_CATEGORIES[c]);
    const categoryName = cats.length <= 2 ? catNames.join(' · ') : `Mix (${cats.length})`;
    triviaRooms.set(code, {
      code, hostId: socket.id, categories: cats,
      categoryName,
      lang: roomLang, difficulty: roomDiff,
      timeMs: roomDiff === 'extreme' ? 15_000 : TRIVIA_TIME_MS,
      players, questions: null, currentQ: -1,
      status: 'waiting', answersThisRound: new Map(),
      timer: null, revealTimer: null, totalQ,
    });
    triviaRoomCode = code;
    socket.join(code);
    socket.emit('trivia-room-created', { code, categoryName, roomState: getTriviaRoomState(triviaRooms.get(code)) });
  });

  // ── Trivia : rejoindre ───────────────────────────────────────────────────
  socket.on('join-trivia-room', ({ code, name = '', playerId } = {}) => {
    if (tryJoinTrivia(code, name, playerId))  return;
    if (tryJoinClassic(code, name, playerId)) return;
    socket.emit('trivia-error', { message: 'Salon introuvable. Vérifie le code.' });
  });

  // ── Trivia : démarrer ────────────────────────────────────────────────────
  socket.on('start-trivia', () => {
    const room = triviaRooms.get(triviaRoomCode);
    if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
    room.status = 'loading';
    startTriviaGame(triviaRoomCode);
  });

  // ── Trivia : répondre ────────────────────────────────────────────────────
  socket.on('trivia-answer', ({ choice } = {}) => {
    const room = triviaRooms.get(triviaRoomCode);
    if (!room || room.status !== 'question') return;
    if (room.answersThisRound.has(socket.id)) return;
    if (!room.players.has(socket.id)) return;
    room.answersThisRound.set(socket.id, { choice: String(choice), at: Date.now() });
    io.to(triviaRoomCode).emit('trivia-player-answered', { socketId: socket.id });
    const connectedIds = [...room.players.keys()].filter(sid => io.sockets.sockets.get(sid)?.connected);
    if (connectedIds.every(sid => room.answersThisRound.has(sid))) {
      clearTimeout(room.timer);
      revealTriviaAnswer(triviaRoomCode);
    }
  });

  // ── Trivia : quitter ─────────────────────────────────────────────────────
  socket.on('leave-trivia-room', () => {
    if (!triviaRoomCode) return;
    const room = triviaRooms.get(triviaRoomCode);
    if (room) {
      room.players.delete(socket.id);
      clearTimeout(room.timer);
      clearTimeout(room.revealTimer);
      if (room.players.size === 0) {
        triviaRooms.delete(triviaRoomCode);
      } else {
        if (room.hostId === socket.id) room.hostId = [...room.players.keys()][0];
        socket.leave(triviaRoomCode);
        io.to(triviaRoomCode).emit('trivia-room-updated', getTriviaRoomState(room));
      }
    }
    triviaRoomCode = null;
  });

  // ── Trivia : fetch questions solo (proxy pour éviter le CORS côté client) ────
  socket.on('fetch-trivia-solo', ({ categories = [], amount = 10, lang = 'fr', difficulty = '', playerId } = {}) => {
    const cats = [].concat(categories).map(c => parseInt(c)).filter(c => TRIVIA_CATEGORIES[c]);
    if (!cats.length) { socket.emit('trivia-solo-error'); return; }
    const l = ['fr', 'en'].includes(lang) ? lang : 'fr';
    const rawN = parseInt(amount) || 10;
    const n = Math.round(Math.min(40, Math.max(10, rawN)) / 5) * 5;
    const d = ['easy', 'medium', 'hard', 'extreme'].includes(difficulty) ? difficulty : '';
    const pid = safePlayerId(playerId);
    try {
      const qs = triviaGame.pickQuestions({ cats, amount: n, lang: l, diff: d, seen: triviaSeen.get(pid)?.set });
      if (pid) markTriviaSeen([pid], qs);
      socket.emit('trivia-solo-questions', qs);
    } catch { socket.emit('trivia-solo-error'); }
  });

  // ── Trivia : classement ──────────────────────────────────────────────────
  socket.on('get-trivia-leaderboard', () => {
    socket.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  });

  // ── Trivia : fin de partie solo ──────────────────────────────────────────
  socket.on('solo-trivia-finished', ({ name, score, playerId } = {}) => {
    const playerName = sanitizeName(name, 'Anonyme');
    const id = safePlayerId(playerId) || playerName;
    updateTriviaLeaderboard(id, playerName, score);
    updateLastActive(id, playerName);
    const pid = safePlayerId(playerId);
    if (pid && typeof score === 'number') {
      pushHistory(pid, { game: 'trivia', result: null, score: Math.max(0, Math.floor(score)) });
      bumpChallenge(pid, 'triviaCorrect', Math.max(0, Math.floor(score)));
      bumpChallenge(pid, 'triviaGames'); // défi « termine N quiz »
    }
    io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
    io.emit('global-leaderboard-update', getGlobalLeaderboardData());
  });

  // ── Fin de partie solo (Snake / Luffy) : historique + défis ──────────────
  socket.on('solo-game-over', ({ playerId, game, score } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    if (!['snake', 'luffy'].includes(game)) return;
    const sc = Math.max(0, Math.floor(Number(score) || 0));
    // Compteur global de parties jouées (affiché sur le tableau de bord admin).
    if (game === 'snake') gameCounters.snakeGames++; else gameCounters.luffyGames++;
    dbSaveGameCounters();
    bumpDaily('games');
    pushHistory(id, { game, result: null, score: sc });
    // Défis Luffy Runner (hors week-end) : score cumulé + nombre de parties.
    if (game === 'luffy' && sc > 0) bumpChallenge(id, 'luffyRun', sc);
    if (game === 'luffy') bumpChallenge(id, 'luffyGames');
  });

  // ── Défis quotidiens ──────────────────────────────────────────────────────
  socket.on('get-challenges', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('challenges-update', { challenges: [], permanent: [] }); return; }
    const entry = getLibsEntry(id);
    socket.emit('challenges-update', { challenges: challengesPayload(entry), permanent: permanentPayload(entry) });
  });

  socket.on('claim-challenge', ({ playerId, challengeId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('claim-challenge-result', { ok: false, error: 'invalid' }); return; }
    if (!allowAction('claim', 20, 60_000)) { socket.emit('claim-challenge-result', { ok: false, error: 'rate' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('claim-challenge-result', { ok: false, error: 'anonymous' }); return; }

    // Défi permanent : progression à vie, réclamable une seule fois,
    // sans bonus « journée parfaite ».
    const permDef = allPermanentChallenges().find(c => c.id === challengeId);
    if (permDef) {
      const lt = getLifetime(entry);
      if ((lt[permDef.metric] || 0) < permDef.goal) { socket.emit('claim-challenge-result', { ok: false, error: 'not_done' }); return; }
      if (entry.permClaimed.includes(permDef.id)) { socket.emit('claim-challenge-result', { ok: false, error: 'already' }); return; }
      entry.permClaimed.push(permDef.id);
      const permGain = Math.round(permDef.reward * vipMult(entry));
      entry.balance = Math.min(MAX_BALANCE, entry.balance + permGain);
      libs.set(id, entry);
      dbUpsertLibs(id, entry);
      socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: permGain, nextAt: nextDistributionAt });
      socket.emit('challenges-update', { challenges: challengesPayload(entry), permanent: permanentPayload(entry) });
      socket.emit('claim-challenge-result', { ok: true, challengeId, reward: permGain, allDoneBonus: 0 });
      return;
    }

    const def = activeChallenges().find(c => c.id === challengeId);
    if (!def) { socket.emit('claim-challenge-result', { ok: false, error: 'invalid' }); return; }
    const c = getChallenges(entry);
    if ((c.progress[def.metric] || 0) < def.goal) { socket.emit('claim-challenge-result', { ok: false, error: 'not_done' }); return; }
    if (c.claimed.includes(def.id)) { socket.emit('claim-challenge-result', { ok: false, error: 'already' }); return; }
    c.claimed.push(def.id);
    // Bonus « journée parfaite » : les 3 défis du jour réclamés → +30 ⚡ offerts.
    const todays  = activeChallenges();
    const allDone = todays.every(ch => c.claimed.includes(ch.id));
    const bonus   = allDone ? CHALLENGE_ALL_DONE_BONUS : 0;
    const dayGain = Math.round((def.reward + bonus) * vipMult(entry));
    entry.balance = Math.min(MAX_BALANCE, entry.balance + dayGain);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: dayGain, nextAt: nextDistributionAt });
    socket.emit('challenges-update', { challenges: challengesPayload(entry), permanent: permanentPayload(entry) });
    socket.emit('claim-challenge-result', { ok: true, challengeId, reward: Math.round(def.reward * vipMult(entry)), allDoneBonus: bonus });
  });

  // ── Historique des parties ────────────────────────────────────────────────
  socket.on('get-history', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('history-update', { history: [] }); return; }
    const entry = getLibsEntry(id);
    socket.emit('history-update', { history: Array.isArray(entry.history) ? entry.history : [] });
  });

  // ── Lecteurs par livre : un joueur qui ouvre un livre compte comme lecteur ──
  socket.on('book-read', ({ playerId, bookId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id || !bookId || typeof bookId !== 'string' || bookId.length > 80) return;
    if (!allowAction('book-read', 30, 60_000)) return;
    let set = bookReaders.get(bookId);
    if (!set) { set = new Set(); bookReaders.set(bookId, set); }
    if (set.has(id)) return; // déjà comptabilisé
    set.add(id);
    dbAddBookReader(bookId, id);
    io.emit('book-readers-update', { bookId, count: set.size });
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on('send-message', ({ text }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.Y) return;
    const clean = String(text || '').trim().slice(0, 200);
    if (!clean) return;
    const pid = socketPlayerIds.get(socket.id);
    const bubbleColor = (pid && libs.get(pid)?.equippedBubble) || null;
    io.to(roomCode).emit('new-message', { player: myPlayer, text: clean, timestamp: Date.now(), bubbleColor });
  });

  socket.on('send-emote', ({ emoteId } = {}) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.Y) return;
    const pid = socketPlayerIds.get(socket.id);
    const entry = pid ? libs.get(pid) : null;
    const VALID_EMOTES = COSMETICS.filter(c => c.type === 'emote').map(c => c.id);
    if (!VALID_EMOTES.includes(emoteId)) return;
    if (!entry || !entry.ownedCosmetics?.includes(emoteId)) return;
    io.to(roomCode).emit('emote-received', { player: myPlayer, emoteId, timestamp: Date.now() });
  });

  // ── Libs ─────────────────────────────────────────────────────────────────────
  socket.on('get-libs', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('libs-update', { balance: 0, pendingBoostHint: 0 }); return; }
    socketPlayerIds.set(socket.id, id);
    // Alerte fraude : plusieurs comptes tout neufs crees depuis la meme IP.
    if (!libs.has(id)) {
      const ip = (socket.handshake.headers['x-forwarded-for']?.split(',')[0] || socket.handshake.address || '').trim();
      recordNewAccount(ip);
    }
    const entry = getLibsEntry(id);

    // Série de connexion : on garde le compteur (défis, tournoi), mais le bonus
    // de Libs est retiré au profit du Cadeau du jour (ci-dessous).
    let dailyGift = null;
    if (entry.name && entry.name !== 'Anonyme') {
      const { streak } = touchStreak(entry);
      dailyGift = drawDailyGift(entry); // null si déjà reçu aujourd'hui
      libs.set(id, entry);
      dbUpsertLibs(id, entry);
      socket.emit('streak-update', { count: streak.count, longest: streak.longest, bonus: 0 });
      if (dailyGift) socket.emit('daily-gift', dailyGift);
    }

    const { available: refundCards, nextRefill: refundCardsNextRefill } = getRefundCardsInfo(entry);
    socket.emit('libs-update', { name: entry.name || '', refCode: _playerRef(id).slice(0, 8), referrals: entry.referrals || 0, xp: entry.xp || 0, level: levelFromXp(entry.xp || 0), iq: entry.iq ?? null, iqUnlocked: (getLifetime(entry).triviaGames || 0) >= IQ_UNLOCK_QUIZZES, iqQuizDone: getLifetime(entry).triviaGames || 0, vipUntil: entry.vipUntil || 0, balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt, refundCards, refundCardsNextRefill, pendingHonorModal: entry.pendingHonorModal || null, badges: computeBadges(id, entry), onboard: entry.onboardRewards || [], hasAccount: [...accounts.values()].some(a => a.playerId === id), delta: (dailyGift && dailyGift.type === 'libs') ? dailyGift.amount : undefined });
    socket.emit('challenges-update', { challenges: challengesPayload(entry), permanent: permanentPayload(entry) });
    // Livraisons en attente : demandes d'amis et cadeaux recus hors ligne.
    const reqs = (entry.friendRequests || []).map(p => {
      const e = libs.get(p);
      return e && e.name && e.name !== 'Anonyme' ? { ref: _playerRef(p).slice(0, 8), name: e.name, level: levelFromXp(e.xp || 0) } : null;
    }).filter(Boolean);
    if (reqs.length) socket.emit('friend-requests', { requests: reqs });
    (entry.pendingGifts || []).forEach(g => socket.emit('gift-received', g));
  });

  // ── Parrainage : le filleul (nouveau compte) declare son parrain ─────────
  socket.on('set-referrer', ({ playerId, ref } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const code = String(ref || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 8);
    if (code.length !== 8) return;
    const entry = getLibsEntry(id);
    // Uniquement les comptes vraiment neufs : jamais de partie jouee, pas deja parraines.
    if (entry.referredBy || entry.referralRewarded || (entry.history || []).length) return;
    if (_playerRef(id).slice(0, 8) === code) return; // pas d'auto-parrainage
    let refPid = null;
    for (const p of _allPlayerIds()) { if (_playerRef(p).slice(0, 8) === code) { refPid = p; break; } }
    if (!refPid || refPid === id) return;
    entry.referredBy = refPid;
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('referrer-set', { ok: true });
  });

  // ── Test de QI (approximatif, ludique) ───────────────────────────────────
  // Debloque apres IQ_UNLOCK_QUIZZES quiz termines. Le client envoie les
  // reponses brutes (bonnes reponses, total, temps moyen), le serveur calcule
  // et borne la valeur : jamais de QI fourni directement par le client.
  socket.on('iq-submit', ({ playerId, correct, total, avgMs } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if ((getLifetime(entry).triviaGames || 0) < IQ_UNLOCK_QUIZZES) {
      socket.emit('iq-update', { error: 'locked' }); return;
    }
    if (Date.now() - (entry.iqAt || 0) < IQ_RETAKE_MS) {
      socket.emit('iq-update', { error: 'cooldown', nextAt: (entry.iqAt || 0) + IQ_RETAKE_MS, iq: entry.iq }); return;
    }
    const tot = Math.max(1, Math.min(30, Math.floor(Number(total) || 0)));
    const ok  = Math.max(0, Math.min(tot, Math.floor(Number(correct) || 0)));
    const ms  = Math.max(1000, Math.min(60000, Math.floor(Number(avgMs) || 30000)));
    // Precision (70 a 130) + bonus de vitesse (jusqu'a +10 si reponse moyenne < 8 s).
    const speedBonus = ms < 8000 ? 10 : ms < 15000 ? 6 : ms < 25000 ? 3 : 0;
    const iq = Math.max(65, Math.min(145, Math.round(70 + (ok / tot) * 60 + (ok / tot >= 0.5 ? speedBonus : 0))));
    entry.iq = iq; entry.iqAt = Date.now();
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('iq-update', { iq, at: entry.iqAt, nextAt: entry.iqAt + IQ_RETAKE_MS });
  });

  // ── Roue de la fortune (1 tour gratuit par jour, joueurs nommes) ─────────
  socket.on('spin-wheel', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('wheel-result', { error: 'noname' }); return; }
    const today = _tournamentTodayKey();
    if (entry.wheelDay === today) { socket.emit('wheel-result', { error: 'done' }); return; }
    // Tirage pondere sur WHEEL_PRIZES (indices alignes avec la roue du client).
    let roll = Math.random() * 100, idx = 0;
    for (let i = 0; i < WHEEL_WEIGHTS.length; i++) { roll -= WHEEL_WEIGHTS[i]; if (roll <= 0) { idx = i; break; } }
    const prize = Math.round(WHEEL_PRIZES[idx] * vipMult(entry));
    entry.wheelDay = today;
    bumpChallenge(id, 'wheelSpins');
    entry.balance = Math.min(MAX_BALANCE, entry.balance + prize);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('wheel-result', { index: idx, prize, balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
  });

  // ── Amis : DEMANDE d'ami (l'autre accepte ou refuse), amitie mutuelle ────
  // La cible est designee par son code 8 hex (le meme que le parrainage) OU
  // par son pseudo exact (fiche joueur des classements).
  function _resolveFriendTarget(ref, name) {
    const code = String(ref || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 8);
    if (code.length === 8) {
      for (const p of _allPlayerIds()) { if (_playerRef(p).slice(0, 8) === code) return p; }
      return null;
    }
    const wanted = String(name || '').trim();
    if (!wanted) return null;
    for (const [p, e] of libs.entries()) { if (e.name === wanted) return p; }
    return null;
  }
  socket.on('add-friend', ({ playerId, ref, name } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('friends-error', { reason: 'noname' }); return; }
    const pid = _resolveFriendTarget(ref, name);
    if (!pid || pid === id) { socket.emit('friends-error', { reason: ref ? 'notfound' : 'invalid' }); return; }
    const target = libs.get(pid);
    if (!target || !target.name || target.name === 'Anonyme') { socket.emit('friends-error', { reason: 'notfound' }); return; }
    if (entry.friends.includes(pid)) { socket.emit('friends-error', { reason: 'already' }); return; }
    if (entry.friends.length >= 30) { socket.emit('friends-error', { reason: 'full' }); return; }
    // Si l'autre m'avait deja demande : acceptation automatique (mutuel).
    if ((entry.friendRequests || []).includes(pid)) {
      makeFriends(id, pid);
      socket.emit('friend-request-sent', { name: target.name, accepted: true });
      return;
    }
    if (!Array.isArray(target.friendRequests)) target.friendRequests = [];
    if (!target.friendRequests.includes(id)) {
      target.friendRequests.push(id);
      target.friendRequests = target.friendRequests.slice(-20);
      libs.set(pid, target);
      dbUpsertLibs(pid, target);
    }
    socket.emit('friend-request-sent', { name: target.name, accepted: false });
    _emitToPlayer(pid, 'friend-request', { ref: _playerRef(id).slice(0, 8), name: entry.name, level: levelFromXp(entry.xp || 0) });
  });
  socket.on('respond-friend', ({ playerId, ref, accept } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    const pid = (entry.friendRequests || []).find(p => _playerRef(p).slice(0, 8) === String(ref || ''));
    if (!pid) return;
    entry.friendRequests = entry.friendRequests.filter(p => p !== pid);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    if (accept) {
      makeFriends(id, pid);
      _emitToPlayer(pid, 'friend-accepted', { name: entry.name });
    } else {
      socket.emit('friends-list', friendsPayload(entry));
    }
  });
  socket.on('remove-friend', ({ playerId, ref } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    // Retrait UNILATERAL : seul celui qui retire perd l'ami de sa liste.
    entry.friends = entry.friends.filter(p => _playerRef(p).slice(0, 8) !== String(ref || ''));
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('friends-list', friendsPayload(entry));
  });
  // Cadeau de Libs a un ami (500 max par jour tous cadeaux confondus).
  socket.on('gift-friend', ({ playerId, ref, amount } = {}) => {
    if (!allowAction('giftfriend', 10, 60_000)) { socket.emit('gift-friend-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('gift-friend-result', { ok: false, error: 'noname' }); return; }
    const pid = entry.friends.find(p => _playerRef(p).slice(0, 8) === String(ref || ''));
    if (!pid) { socket.emit('gift-friend-result', { ok: false, error: 'notfriend' }); return; }
    const amt = Math.floor(Number(amount) || 0);
    if (amt < 10 || amt > 500) { socket.emit('gift-friend-result', { ok: false, error: 'amount' }); return; }
    const today = _tournamentTodayKey();
    const sent = (entry.giftSentDay && entry.giftSentDay.day === today) ? entry.giftSentDay.total : 0;
    if (sent + amt > 500) { socket.emit('gift-friend-result', { ok: false, error: 'daily', left: Math.max(0, 500 - sent) }); return; }
    if (entry.balance < amt) { socket.emit('gift-friend-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= amt;
    entry.giftSentDay = { day: today, total: sent + amt };
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    bumpChallenge(id, 'giftsSent');
    const target = getLibsEntry(pid);
    target.balance = Math.min(MAX_BALANCE, target.balance + amt);
    deliverGift(pid, { fromName: entry.name, libsAmount: amt });
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
    socket.emit('gift-friend-result', { ok: true, amount: amt, name: target.name });
  });
  // Le destinataire clique OK : le message de cadeau ne se remontre plus.
  socket.on('gift-ack', ({ playerId, giftId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    entry.pendingGifts = (entry.pendingGifts || []).filter(g => g.id !== String(giftId));
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
  });
  // Fiche joueur (classements) : niveau + statut d'amitie, par pseudo.
  socket.on('get-player-card', ({ playerId, name } = {}) => {
    const id = safePlayerId(playerId);
    const wanted = String(name || '').trim();
    let pid = null, target = null;
    for (const [p, e] of libs.entries()) { if (e.name === wanted) { pid = p; target = e; break; } }
    if (!pid) { socket.emit('player-card', { name: wanted, notFound: true }); return; }
    const me = id ? getLibsEntry(id) : null;
    const online = new Set(socketPlayerIds.values());
    socket.emit('player-card', {
      name: target.name,
      level: levelFromXp(target.xp || 0),
      vip: (target.vipUntil || 0) > Date.now(),
      online: online.has(pid),
      isMe: pid === id,
      isFriend: !!me && me.friends.includes(pid),
      requested: !!target.friendRequests && !!id && target.friendRequests.includes(id),
      badges: computeBadges(pid, target),
      honorTitle: target.honorTitle || null,
    });
  });
  socket.on('get-friends', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    socket.emit('friends-list', friendsPayload(getLibsEntry(id)));
  });
  // Defi direct : l'ami en ligne recoit une invitation avec le code du salon.
  socket.on('challenge-friend', ({ playerId, ref, code, game } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') return;
    const pid = entry.friends.find(p => _playerRef(p).slice(0, 8) === String(ref || ''));
    if (!pid) return;
    _emitToPlayer(pid, 'friend-challenge', {
      fromName: entry.name,
      code: String(code || '').toUpperCase().slice(0, 4),
      game: String(game || '').slice(0, 20),
    });
  });

  // ── Notifications push : abonnement / desabonnement ──────────────────────
  socket.on('push-subscribe', ({ playerId, sub } = {}) => {
    const id = safePlayerId(playerId);
    if (!id || !sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return;
    pushSubs.set(id, sub);
    if (db) db.collection('push_subs').updateOne({ _id: id }, { $set: { sub, at: Date.now() } }, { upsert: true }).catch(() => {});
    socket.emit('push-subscribed', { ok: true });
  });
  socket.on('push-unsubscribe', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    pushSubs.delete(id);
    if (db) db.collection('push_subs').deleteOne({ _id: id }).catch(() => {});
  });

  // ── Pass VIP : 30 jours, paye en Libs, +20% sur les gains ────────────────
  socket.on('buy-vip', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('vip-result', { error: 'noname' }); return; }
    if (entry.balance < VIP_PRICE) { socket.emit('vip-result', { error: 'insufficient', price: VIP_PRICE }); return; }
    // Plafond : impossible de stocker plus de 3 mois de VIP (2 mois restants + 30 j achetes).
    if ((entry.vipUntil || 0) - Date.now() > 60 * 24 * 3600 * 1000) {
      socket.emit('vip-result', { error: 'max', vipUntil: entry.vipUntil }); return;
    }
    entry.balance -= VIP_PRICE;
    entry.vipUntil = Math.max(Date.now(), entry.vipUntil || 0) + VIP_DURATION_MS;
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('vip-result', { vipUntil: entry.vipUntil });
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, vipUntil: entry.vipUntil, nextAt: nextDistributionAt });
  });

  // Offrir un Pass VIP a un ami (paye par l'offreur, credite chez l'ami, message OK).
  socket.on('gift-vip', ({ playerId, ref } = {}) => {
    if (!allowAction('giftvip', 10, 60_000)) { socket.emit('gift-vip-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('gift-vip-result', { ok: false, error: 'noname' }); return; }
    const pid = entry.friends.find(p => _playerRef(p).slice(0, 8) === String(ref || ''));
    if (!pid) { socket.emit('gift-vip-result', { ok: false, error: 'notfriend' }); return; }
    if (entry.balance < VIP_PRICE) { socket.emit('gift-vip-result', { ok: false, error: 'insufficient' }); return; }
    const target = getLibsEntry(pid);
    // Meme plafond de 3 mois chez le destinataire.
    if ((target.vipUntil || 0) - Date.now() > 60 * 24 * 3600 * 1000) {
      socket.emit('gift-vip-result', { ok: false, error: 'targetmax', name: target.name }); return;
    }
    entry.balance -= VIP_PRICE;
    target.vipUntil = Math.max(Date.now(), target.vipUntil || 0) + VIP_DURATION_MS;
    libs.set(id, entry); libs.set(pid, target);
    dbUpsertLibs(id, entry); dbUpsertLibs(pid, target);
    _emitToPlayer(pid, 'libs-update', { vipUntil: target.vipUntil, nextAt: nextDistributionAt });
    deliverGift(pid, { fromName: entry.name, vip: true });
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
    socket.emit('gift-vip-result', { ok: true, name: target.name });
  });

  // ── Tournoi du samedi ─────────────────────────────────────────────────────
  socket.on('get-tournament', () => socket.emit('tournament-update', tournamentPayload()));

  socket.on('get-shop', () => {
    socket.emit('shop-items', SHOP_ITEMS);
  });

  socket.on('get-shop-rotation', () => {
    socket.emit('shop-rotation', getShopRotation());
  });

  socket.on('get-flash-offer', () => socket.emit('flash-offer', flashPayload()));
  socket.on('get-shop-overrides', () => socket.emit('shop-overrides', shopOverridesPayload()));

  socket.on('get-snake-vote', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    const yes = [...snakeVotes.values()].filter(v => v === 'yes').length;
    const no  = [...snakeVotes.values()].filter(v => v === 'no').length;
    socket.emit('snake-vote-update', { yes, no, myVote: id ? (snakeVotes.get(id) || null) : null });
  });

  socket.on('submit-snake-vote', ({ playerId, vote } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    if (vote !== 'yes' && vote !== 'no') return;
    snakeVotes.set(id, vote);
    if (db) db.collection('snake_votes').updateOne({ _id: id }, { $set: { vote } }, { upsert: true }).catch(() => {});
    const yes = [...snakeVotes.values()].filter(v => v === 'yes').length;
    const no  = [...snakeVotes.values()].filter(v => v === 'no').length;
    io.emit('snake-vote-update', { yes, no, myVote: null });
    socket.emit('snake-vote-update', { yes, no, myVote: vote });
  });

  socket.on('buy-bundle', ({ playerId, bundleId } = {}) => {
    if (!allowAction('buy')) { socket.emit('buy-bundle-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('buy-bundle-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('buy-bundle-result', { ok: false, error: 'anonymous' }); return; }
    const bundle = BUNDLES.find(b => b.id === bundleId);
    if (!bundle) { socket.emit('buy-bundle-result', { ok: false, error: 'invalid' }); return; }
    const bundleCosmetics = bundle.items.filter(itemId => COSMETICS.some(c => c.id === itemId));
    const bundleBoosts    = bundle.items.filter(itemId => SHOP_ITEMS.some(s => s.id === itemId));
    const unownedCosmetics = bundleCosmetics.filter(itemId => !entry.ownedCosmetics.includes(itemId));
    if (unownedCosmetics.length === 0 && bundleBoosts.length === 0) {
      socket.emit('buy-bundle-result', { ok: false, error: 'all_owned' }); return;
    }
    const getItemPrice = itemId => {
      const cosm = COSMETICS.find(c => c.id === itemId);
      if (cosm) return cosm.price;
      const boost = SHOP_ITEMS.find(s => s.id === itemId);
      return boost ? boost.price : 0;
    };
    const unownedValue = unownedCosmetics.reduce((s, id) => s + getItemPrice(id), 0)
                       + bundleBoosts.reduce((s, id) => s + getItemPrice(id), 0);
    const adjustedPrice = Math.max(1, Math.round(bundle.bundlePrice * unownedValue / bundle.totalPrice));
    if (entry.balance < adjustedPrice) { socket.emit('buy-bundle-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= adjustedPrice;
    unownedCosmetics.forEach(itemId => { if (!entry.ownedCosmetics.includes(itemId)) entry.ownedCosmetics.push(itemId); });
    bundleBoosts.forEach(itemId => {
      const item = SHOP_ITEMS.find(s => s.id === itemId);
      if (item) entry.pendingBoostHint = (entry.pendingBoostHint || 0) + item.amount;
    });
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
    socket.emit('buy-bundle-result', { ok: true, bundleId, adjustedPrice, granted: unownedCosmetics });
  });

  socket.on('buy-boost', ({ itemId, playerId } = {}) => {
    if (!allowAction('buy')) { socket.emit('buy-boost-result', { ok: false, error: 'rate' }); return; }
    const id   = safePlayerId(playerId);
    const item = SHOP_ITEMS.find(s => s.id === itemId);
    if (!id || !item) { socket.emit('buy-boost-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (entry.balance < item.price) {
      socket.emit('buy-boost-result', { ok: false, error: 'insufficient', balance: entry.balance });
      return;
    }
    entry.balance -= item.price;
    entry.pendingBoostHint = (entry.pendingBoostHint || 0) + item.amount;
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('buy-boost-result', { ok: true, balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, itemId });
  });

  socket.on('redeem-code', ({ code, playerId, name } = {}) => {
    if (!allowAction('redeem', 10, 60_000)) { socket.emit('redeem-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('redeem-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    const cleanName = sanitizeName(name);
    if (cleanName && cleanName !== 'Anonyme') entry.name = cleanName;
    if (!entry.name || entry.name === 'Anonyme') {
      socket.emit('redeem-result', { ok: false, error: 'anonymous' }); return;
    }
    const normalCode = String(code || '').trim().toUpperCase();
    const isLibero   = entry.name === 'Libero';
    const isFillCode = normalCode === PROMO_FILL_CODE;
    const reward     = isFillCode ? Math.max(0, MAX_BALANCE - entry.balance) : PROMO_CODES[normalCode];
    if (!reward) {
      socket.emit('redeem-result', { ok: false, error: isFillCode ? 'already_used' : 'invalid' }); return;
    }
    // Le propriétaire (Libero) peut rejouer ses codes autant qu'il veut (tests).
    const unlimited = isLibero && !isFillCode;
    if (!unlimited && entry.usedCodes.includes(normalCode)) {
      socket.emit('redeem-result', { ok: false, error: 'already_used' }); return;
    }
    entry.balance = Math.min(MAX_BALANCE, entry.balance + reward);
    if (!unlimited) entry.usedCodes.push(normalCode);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: reward, nextAt: nextDistributionAt });
    socket.emit('redeem-result', { ok: true, delta: reward });
  });

  // ── Offrir un cosmetique ou un pack ──────────────────────────────────────
  // L'acheteur paie le prix (cosmetique ou pack complet) et recoit un code
  // cadeau a partager (ou un lien ?gift=CODE). Le destinataire l'echange
  // (redeem-gift) pour l'ajouter a son casier.
  socket.on('gift-cosmetic', ({ playerId, cosmeticId, bundleId } = {}) => {
    if (!allowAction('buy')) { socket.emit('gift-cosmetic-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('gift-cosmetic-result', { ok: false, error: 'anonymous' }); return; }
    let price, rec;
    if (bundleId) {
      const bundle = BUNDLES.find(b => b.id === bundleId);
      if (!bundle) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
      price = bundle.bundlePrice; // pack complet : le destinataire recoit tout
      rec = { bundleId, fromName: entry.name, createdAt: Date.now(), redeemedBy: null, redeemedAt: null };
    } else {
      const cosmetic = COSMETICS.find(c => c.id === cosmeticId);
      if (!cosmetic || cosmetic.honorary || cosmetic.price <= 0) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
      price = cosmetic.price;
      rec = { cosmeticId, fromName: entry.name, createdAt: Date.now(), redeemedBy: null, redeemedAt: null };
    }
    if (entry.balance < price) { socket.emit('gift-cosmetic-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= price;
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    const code = _makeGiftCode();
    giftCodes.set(code, rec);
    if (db) db.collection('gift_codes').updateOne({ _id: code }, { $set: rec }, { upsert: true }).catch(() => {});
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
    socket.emit('gift-cosmetic-result', { ok: true, code, cosmeticId: rec.cosmeticId || null, bundleId: rec.bundleId || null });
    bumpChallenge(id, 'giftsSent');
  });

  // Offrir un cosmetique/pack DIRECTEMENT a un ami (sans code) : debite l'offreur,
  // credite l'ami tout de suite, message avec bouton OK chez lui.
  socket.on('gift-cosmetic-friend', ({ playerId, cosmeticId, bundleId, ref } = {}) => {
    if (!allowAction('buy')) { socket.emit('gift-cosmetic-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('gift-cosmetic-result', { ok: false, error: 'anonymous' }); return; }
    const pid = entry.friends.find(p => _playerRef(p).slice(0, 8) === String(ref || ''));
    if (!pid) { socket.emit('gift-cosmetic-result', { ok: false, error: 'notfriend' }); return; }
    const target = getLibsEntry(pid);
    let price, granted = [], boostAdded = 0;
    if (bundleId) {
      const bundle = BUNDLES.find(b => b.id === bundleId);
      if (!bundle) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
      price = bundle.bundlePrice;
      const bundleCosmetics = bundle.items.filter(itemId => COSMETICS.some(c => c.id === itemId));
      const bundleBoosts    = bundle.items.filter(itemId => SHOP_ITEMS.some(s => s.id === itemId));
      granted = bundleCosmetics.filter(itemId => !target.ownedCosmetics.includes(itemId));
      if (!granted.length && !bundleBoosts.length) { socket.emit('gift-cosmetic-result', { ok: false, error: 'target_owns' }); return; }
      if (entry.balance < price) { socket.emit('gift-cosmetic-result', { ok: false, error: 'insufficient' }); return; }
      granted.forEach(itemId => target.ownedCosmetics.push(itemId));
      bundleBoosts.forEach(itemId => { const it = SHOP_ITEMS.find(s => s.id === itemId); if (it) { target.pendingBoostHint = (target.pendingBoostHint || 0) + it.amount; boostAdded += it.amount; } });
    } else {
      const cosmetic = COSMETICS.find(c => c.id === cosmeticId);
      if (!cosmetic || cosmetic.honorary || cosmetic.price <= 0) { socket.emit('gift-cosmetic-result', { ok: false, error: 'invalid' }); return; }
      price = cosmetic.price;
      if (target.ownedCosmetics.includes(cosmeticId)) { socket.emit('gift-cosmetic-result', { ok: false, error: 'target_owns' }); return; }
      if (entry.balance < price) { socket.emit('gift-cosmetic-result', { ok: false, error: 'insufficient' }); return; }
      target.ownedCosmetics.push(cosmeticId);
      granted = [cosmeticId];
    }
    entry.balance -= price;
    libs.set(id, entry); libs.set(pid, target);
    dbUpsertLibs(id, entry); dbUpsertLibs(pid, target);
    _emitToPlayer(pid, 'libs-update', { ownedCosmetics: target.ownedCosmetics, pendingBoostHint: target.pendingBoostHint, ..._equippedPayload(target), nextAt: nextDistributionAt });
    deliverGift(pid, { fromName: entry.name, cosmeticId: granted[0] || null });
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
    socket.emit('gift-cosmetic-result', { ok: true, toFriend: target.name });
    bumpChallenge(id, 'giftsSent');
  });

  // ── Recevoir un cadeau (cosmetique ou pack) ──────────────────────────────
  // Pas de pseudo obligatoire : le cadeau est deja paye par l'offreur, aucun
  // risque de farm. Le pseudo est quand meme enregistre s'il est fourni.
  socket.on('redeem-gift', ({ code, playerId, name } = {}) => {
    if (!allowAction('redeem', 10, 60_000)) { socket.emit('redeem-gift-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('redeem-gift-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    const cleanName = sanitizeName(name);
    if (cleanName && cleanName !== 'Anonyme') entry.name = cleanName;
    const g = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rec = giftCodes.get(g);
    if (!rec) { socket.emit('redeem-gift-result', { ok: false, error: 'invalid' }); return; }
    if (rec.redeemedBy) { socket.emit('redeem-gift-result', { ok: false, error: 'used' }); return; }
    let granted = [], boostAdded = 0;
    if (rec.bundleId) {
      const bundle = BUNDLES.find(b => b.id === rec.bundleId);
      if (!bundle) { socket.emit('redeem-gift-result', { ok: false, error: 'invalid' }); return; }
      const bundleCosmetics = bundle.items.filter(itemId => COSMETICS.some(c => c.id === itemId));
      const bundleBoosts    = bundle.items.filter(itemId => SHOP_ITEMS.some(s => s.id === itemId));
      granted = bundleCosmetics.filter(itemId => !entry.ownedCosmetics.includes(itemId));
      if (!granted.length && !bundleBoosts.length) { socket.emit('redeem-gift-result', { ok: false, error: 'already_owned' }); return; }
      granted.forEach(itemId => entry.ownedCosmetics.push(itemId));
      bundleBoosts.forEach(itemId => {
        const item = SHOP_ITEMS.find(s => s.id === itemId);
        if (item) { entry.pendingBoostHint = (entry.pendingBoostHint || 0) + item.amount; boostAdded += item.amount; }
      });
    } else {
      const cosmetic = COSMETICS.find(c => c.id === rec.cosmeticId);
      if (!cosmetic) { socket.emit('redeem-gift-result', { ok: false, error: 'invalid' }); return; }
      if (entry.ownedCosmetics.includes(rec.cosmeticId)) { socket.emit('redeem-gift-result', { ok: false, error: 'already_owned' }); return; }
      entry.ownedCosmetics.push(rec.cosmeticId);
      granted = [rec.cosmeticId];
    }
    rec.redeemedBy = id; rec.redeemedAt = Date.now();
    giftCodes.set(g, rec);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    if (db) db.collection('gift_codes').updateOne({ _id: g }, { $set: { redeemedBy: id, redeemedAt: rec.redeemedAt } }).catch(() => {});
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
    socket.emit('redeem-gift-result', { ok: true, cosmeticId: rec.cosmeticId || null, bundleId: rec.bundleId || null, granted, boostAdded, fromName: rec.fromName });
    // Message « Untel t'a offert un cadeau » avec bouton OK.
    deliverGift(id, { fromName: rec.fromName || '', cosmeticId: granted[0] || rec.cosmeticId || rec.bundleId || null });
  });

  // ── Réinitialiser le compte ──────────────────────────────────────────────
  // Suppression totale et définitive de la progression : le joueur disparaît
  // de tous les classements et de toutes les données serveur. Le playerId
  // (secret) fait office de preuve de propriété.
  socket.on('reset-account', ({ playerId } = {}) => {
    if (!allowAction('reset', 3, 60_000)) { socket.emit('reset-account-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('reset-account-result', { ok: false, error: 'invalid' }); return; }
    // Snapshot complet AVANT suppression : l'admin est prevenu sur le dashboard
    // et peut restituer la progression (ou vider ce cache).
    const _e = libs.get(id);
    if (_e || leaderboard.get(id) || triviaLeaderboard.get(id) || snakeLeaderboard.get(id) || luffyLeaderboard.get(id)) {
      const arch = {
        _id: crypto.randomUUID(), at: Date.now(),
        playerId: id,
        name: _e?.name || leaderboard.get(id)?.name || triviaLeaderboard.get(id)?.name || snakeLeaderboard.get(id)?.name || luffyLeaderboard.get(id)?.name || 'Anonyme',
        libs: _e ? JSON.parse(JSON.stringify(_e)) : null,
        leaderboard: leaderboard.get(id) ? { ...leaderboard.get(id) } : null,
        trivia: triviaLeaderboard.get(id) ? { ...triviaLeaderboard.get(id) } : null,
        snake: snakeLeaderboard.get(id) ? { ...snakeLeaderboard.get(id) } : null,
        luffy: luffyLeaderboard.get(id) ? { ...luffyLeaderboard.get(id) } : null,
        restoredAt: null,
      };
      resetArchive.set(arch._id, arch);
      if (db) db.collection('reset_archive').insertOne({ ...arch }).catch(() => {});
    }
    libs.delete(id);
    leaderboard.delete(id);
    triviaLeaderboard.delete(id);
    snakeLeaderboard.delete(id);
    luffyLeaderboard.delete(id);
    snakeVotes.delete(id);
    // Alias : on retire les redirections qui partent de cet id ou y mènent.
    for (const [from, to] of [...playerIdAliases.entries()]) {
      if (from === id || to === id) playerIdAliases.delete(from);
    }
    if (db) {
      db.collection('libs').deleteOne({ _id: id }).catch(() => {});
      db.collection('leaderboard').deleteOne({ _id: id }).catch(() => {});
      db.collection('trivia_leaderboard').deleteOne({ _id: id }).catch(() => {});
      db.collection('snake_leaderboard').deleteOne({ _id: id }).catch(() => {});
      db.collection('luffy_leaderboard').deleteOne({ _id: id }).catch(() => {});
      db.collection('snake_votes').deleteOne({ _id: id }).catch(() => {});
      db.collection('player_aliases').deleteMany({ $or: [{ _id: id }, { canonId: id }] }).catch(() => {});
    }
    // Tous les classements se mettent à jour en direct pour tout le monde.
    io.emit('leaderboard-update', getLeaderboardData());
    io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
    io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
    io.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
    io.emit('global-leaderboard-update', getGlobalLeaderboardData());
    socket.emit('reset-account-result', { ok: true });
  });

  socket.on('buy-cosmetic', ({ playerId, cosmeticId } = {}) => {
    if (!allowAction('buy')) { socket.emit('buy-cosmetic-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('buy-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('buy-cosmetic-result', { ok: false, error: 'anonymous' }); return; }
    const cosmetic = COSMETICS.find(c => c.id === cosmeticId);
    if (!cosmetic) { socket.emit('buy-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    if (cosmetic.honorary) { socket.emit('buy-cosmetic-result', { ok: false, error: 'honorary' }); return; }
    if (entry.ownedCosmetics.includes(cosmeticId)) { socket.emit('buy-cosmetic-result', { ok: false, error: 'already_owned' }); return; }
    // Une emote retiree par l'admin de la section Emotes ne peut plus etre achetee.
    if (cosmetic.type === 'emote' && !emoteAvailable(cosmeticId)) { socket.emit('buy-cosmetic-result', { ok: false, error: 'unavailable' }); return; }
    const price = flashPriceFor(cosmeticId, cosmetic.price);
    if (entry.balance < price) { socket.emit('buy-cosmetic-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= price;
    entry.ownedCosmetics.push(cosmeticId);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
    socket.emit('buy-cosmetic-result', { ok: true, cosmeticId });
  });

  // Achat d'un pack de chapitres du livre exclusif (même modèle que buy-cosmetic).
  socket.on('buy-book-pack', ({ playerId, bookId, packId } = {}) => {
    if (!allowAction('buy')) { socket.emit('buy-book-pack-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('buy-book-pack-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('buy-book-pack-result', { ok: false, error: 'anonymous' }); return; }
    const book = LIBERO_BOOKS[bookId];
    if (!book) { socket.emit('buy-book-pack-result', { ok: false, error: 'invalid' }); return; }
    const pack = book.packs.find(p => p.id === packId);
    if (!pack) { socket.emit('buy-book-pack-result', { ok: false, error: 'invalid' }); return; }
    const key = `${book.id}:${pack.id}`;
    if (entry.ownedBooks.includes(key)) { socket.emit('buy-book-pack-result', { ok: false, error: 'already_owned' }); return; }
    // Progression séquentielle : un pack peut exiger d'avoir débloqué le précédent.
    if (pack.requires && !entry.ownedBooks.includes(`${book.id}:${pack.requires}`)) {
      socket.emit('buy-book-pack-result', { ok: false, error: 'requires_previous' }); return;
    }
    // On ne vend pas un pack dont aucun chapitre n'est encore publié.
    const chapters = bookChapters.get(book.id) || new Map();
    let anyAvailable = false;
    for (let n = pack.from; n <= pack.to; n++) if (chapters.has(n)) { anyAvailable = true; break; }
    if (!anyAvailable) { socket.emit('buy-book-pack-result', { ok: false, error: 'not_available' }); return; }
    const effPrice = bookPackPrice(book.id, pack);
    if (entry.balance < effPrice) { socket.emit('buy-book-pack-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= effPrice;
    entry.ownedBooks.push(key);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
    socket.emit('buy-book-pack-result', { ok: true, packId });
    console.log(`[📖] ${entry.name} a débloqué ${key} (−${effPrice} Libs)`);
  });

  socket.on('honor-modal-seen', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    if (entry.pendingHonorModal) {
      entry.pendingHonorModal = null;
      libs.set(id, entry);
      dbUpsertLibs(id, entry);
    }
  });

  socket.on('equip-cosmetic', ({ playerId, cosmeticId, type, remove } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) return;
    const entry = getLibsEntry(id);
    let cosmType = type;
    if (cosmeticId !== null) {
      const cosm = COSMETICS.find(c => c.id === cosmeticId);
      cosmType = cosm ? cosm.type : 'color';
    }
    if (cosmeticId === null || entry.ownedCosmetics.includes(cosmeticId)) {
      if      (cosmType === 'font')        entry.equippedFont        = cosmeticId;
      else if (cosmType === 'bubble')      entry.equippedBubble      = cosmeticId;
      else if (cosmType === 'background')  entry.equippedBackground  = cosmeticId;
      else if (cosmType === 'nameeffect')  entry.equippedNameEffect  = cosmeticId;
      else if (cosmType === 'title')       entry.equippedTitle       = cosmeticId;
      else if (cosmType === 'cursorsnake') entry.equippedCursorSnake = cosmeticId;
      else if (cosmType === 'avatar')      entry.equippedAvatar      = cosmeticId;
      else if (cosmType === 'p4token')     entry.equippedP4Token     = cosmeticId;
      else if (cosmType === 'ttt')         entry.equippedTtt         = cosmeticId;
      else if (cosmType === 'chess')       entry.equippedChess       = cosmeticId;
      else if (cosmType === 'snakeskin')   entry.equippedSnakeSkin   = cosmeticId;
      else if (cosmType === 'clickfx')     entry.equippedClickFx     = cosmeticId;
      else if (cosmType === 'emojipack')   entry.equippedEmojiPack   = cosmeticId;
      else if (cosmType === 'victoryban')  entry.equippedVictoryBan  = cosmeticId;
      else if (cosmType === 'soundpack')   entry.equippedSoundPack   = cosmeticId;
      else if (cosmType === 'emote') {
        const arr = entry.equippedEmotes || [];
        if (remove) { entry.equippedEmotes = arr.filter(e => e !== cosmeticId); }
        else if (!arr.includes(cosmeticId) && arr.length < 5) { entry.equippedEmotes = [...arr, cosmeticId]; }
      }
      else entry.equippedCosmetic = cosmeticId;
      libs.set(id, entry);
      dbUpsertLibs(id, entry);
      // Onboarding : equiper un cosmetique valide l'etape "personnalisation".
      if (cosmeticId !== null && !remove) completeOnboardStep(id, entry, 'perso');
      socket.emit('equip-cosmetic-result', { ok: true, ..._equippedPayload(entry) });
      io.emit('leaderboard-update', getLeaderboardData());
      io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
      io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
      io.emit('global-leaderboard-update', getGlobalLeaderboardData());
    } else {
      socket.emit('equip-cosmetic-result', { ok: false, error: 'not_owned' });
    }
  });

  socket.on('refund-cosmetic', ({ playerId, cosmeticId } = {}) => {
    if (!allowAction('buy')) { socket.emit('refund-cosmetic-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('refund-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.ownedCosmetics.includes(cosmeticId)) {
      socket.emit('refund-cosmetic-result', { ok: false, error: 'not_owned' }); return;
    }
    const { available } = getRefundCardsInfo(entry);
    if (available <= 0) {
      socket.emit('refund-cosmetic-result', { ok: false, error: 'no_cards' }); return;
    }
    const cosmetic = COSMETICS.find(c => c.id === cosmeticId);
    if (!cosmetic) { socket.emit('refund-cosmetic-result', { ok: false, error: 'invalid' }); return; }
    entry.ownedCosmetics     = entry.ownedCosmetics.filter(c => c !== cosmeticId);
    if (entry.equippedCosmetic    === cosmeticId) entry.equippedCosmetic    = null;
    if (entry.equippedFont        === cosmeticId) entry.equippedFont        = null;
    if (entry.equippedBubble      === cosmeticId) entry.equippedBubble      = null;
    if (entry.equippedBackground  === cosmeticId) entry.equippedBackground  = null;
    if (entry.equippedNameEffect  === cosmeticId) entry.equippedNameEffect  = null;
    if (entry.equippedTitle       === cosmeticId) entry.equippedTitle       = null;
    if (entry.equippedCursorSnake === cosmeticId) entry.equippedCursorSnake = null;
    if (entry.equippedAvatar      === cosmeticId) entry.equippedAvatar      = null;
    if (entry.equippedP4Token     === cosmeticId) entry.equippedP4Token     = null;
    if (entry.equippedTtt         === cosmeticId) entry.equippedTtt         = null;
    if (entry.equippedChess       === cosmeticId) entry.equippedChess       = null;
    if (entry.equippedSnakeSkin   === cosmeticId) entry.equippedSnakeSkin   = null;
    if (entry.equippedClickFx     === cosmeticId) entry.equippedClickFx     = null;
    if (entry.equippedEmojiPack   === cosmeticId) entry.equippedEmojiPack   = null;
    if (entry.equippedVictoryBan  === cosmeticId) entry.equippedVictoryBan  = null;
    if (entry.equippedSoundPack   === cosmeticId) entry.equippedSoundPack   = null;
    entry.equippedEmotes = (entry.equippedEmotes || []).filter(e => e !== cosmeticId);
    entry.balance = Math.min(MAX_BALANCE, entry.balance + cosmetic.price);
    entry.refundCardsUsedAt.push(Date.now());
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    const { available: refundCards, nextRefill: refundCardsNextRefill } = getRefundCardsInfo(entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt, refundCards, refundCardsNextRefill });
    socket.emit('refund-cosmetic-result', { ok: true, cosmeticId, refundCards, delta: cosmetic.price });
    io.emit('leaderboard-update', getLeaderboardData());
    io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
    io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
    io.emit('global-leaderboard-update', getGlobalLeaderboardData());
  });

  socket.on('activate-quiz-boost', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('quiz-boost-status', { active: false, pendingBoostHint: 0 }); return; }
    const entry = getLibsEntry(id);
    socket.emit('quiz-boost-status', { active: entry.pendingBoostHint > 0, balance: entry.balance, pendingBoostHint: entry.pendingBoostHint });
  });

  socket.on('use-boost-hint', ({ playerId, solo } = {}) => {
    const pid = safePlayerId(playerId) || socketPlayerIds.get(socket.id);
    if (pid) {
      const entry = getLibsEntry(pid);
      if (entry.pendingBoostHint > 0) {
        entry.pendingBoostHint--;
        libs.set(pid, entry);
        dbUpsertLibs(pid, entry);
        socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
      }
    }
    if (solo) return;
    const room = triviaRooms.get(triviaRoomCode);
    if (!room || room.status !== 'question') { socket.emit('boost-hint-result', { eliminateChoice: null }); return; }
    const q = room.questions[room.currentQ];
    if (!q) { socket.emit('boost-hint-result', { eliminateChoice: null }); return; }
    const wrongs    = q.choices.filter(c => c !== q.correct);
    const eliminate = wrongs[Math.floor(Math.random() * wrongs.length)] ?? null;
    socket.emit('boost-hint-result', { eliminateChoice: eliminate });
  });

  // ── Déconnexion ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    socketPlayerIds.delete(socket.id);
    snakeLibsGames.delete(socket.id);
    // Jeu classique
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room && room.players[myPlayer] === socket.id) {
        room.players[myPlayer] = null;
        if (room.status === 'waiting') {
          rooms.delete(roomCode);
        } else {
          const other = myPlayer === 'R' ? 'Y' : 'R';
          if (room.players[other]) io.to(room.players[other]).emit('opponent-reconnecting');
          room.reconnectTimers[myPlayer] = setTimeout(() => {
            if (room.players[myPlayer] !== null) return;
            _settleStake(room, 'cancel'); // partie annulee : mises remboursees
            if (room.players[other]) io.to(room.players[other]).emit('player-disconnected');
            rooms.delete(roomCode);
          }, RECONNECT_MS);
        }
      }
    }

    // Salon trivia : fenêtre de grâce avant suppression
    if (triviaRoomCode) {
      const troom = triviaRooms.get(triviaRoomCode);
      if (troom) {
        const player = troom.players.get(socket.id);
        if (player) {
          player.disconnected = true;
          if (!troom.reconnectTimers) troom.reconnectTimers = new Map();
          troom.reconnectTimers.set(socket.id, setTimeout(() => {
            troom.players.delete(socket.id);
            if (troom.reconnectTimers) troom.reconnectTimers.delete(socket.id);
            const activePlayers = [...troom.players.values()].filter(p => !p.disconnected);
            if (activePlayers.length === 0) {
              clearTimeout(troom.timer);
              clearTimeout(troom.revealTimer);
              triviaRooms.delete(triviaRoomCode);
            } else {
              if (troom.hostId === socket.id) {
                const nextSid = [...troom.players.entries()].find(([, p]) => !p.disconnected)?.[0];
                if (nextSid) troom.hostId = nextSid;
              }
              if (troom.status === 'waiting') {
                io.to(triviaRoomCode).emit('trivia-room-updated', getTriviaRoomState(troom));
              } else if (troom.status === 'question') {
                const connectedIds = [...troom.players.keys()].filter(sid => {
                  const p = troom.players.get(sid);
                  return !p.disconnected && io.sockets.sockets.get(sid)?.connected;
                });
                if (connectedIds.length > 0 && connectedIds.every(sid => troom.answersThisRound.has(sid))) {
                  clearTimeout(troom.timer);
                  revealTriviaAnswer(triviaRoomCode);
                }
              }
            }
          }, TRIVIA_RECONNECT_MS));
        }
      }
    }
  });

  // ── Reconnexion salon trivia ──────────────────────────────────────────────
  socket.on('reconnect-trivia-room', ({ code, mySocketId } = {}) => {
    const key   = (code || '').toUpperCase().trim();
    const troom = triviaRooms.get(key);
    if (!troom) { socket.emit('trivia-reconnect-failed'); return; }

    const player = troom.players.get(mySocketId);
    if (!player || !player.disconnected) { socket.emit('trivia-reconnect-failed'); return; }

    // Annuler le timer de suppression
    if (troom.reconnectTimers?.has(mySocketId)) {
      clearTimeout(troom.reconnectTimers.get(mySocketId));
      troom.reconnectTimers.delete(mySocketId);
    }

    // Migrer vers le nouveau socket.id
    troom.players.delete(mySocketId);
    player.disconnected = false;
    troom.players.set(socket.id, player);

    if (troom.hostId === mySocketId) troom.hostId = socket.id;
    if (troom.answersThisRound.has(mySocketId)) {
      const ans = troom.answersThisRound.get(mySocketId);
      troom.answersThisRound.delete(mySocketId);
      troom.answersThisRound.set(socket.id, ans);
    }

    triviaRoomCode = key;
    socket.join(key);

    const reconnectData = {
      code: key,
      status:     troom.status,
      scores:     publicScores(troom),
      colorIndex: player.colorIndex,
      hostId:     troom.hostId,
    };

    if (troom.status === 'question' && troom.questions?.[troom.currentQ]) {
      const q = troom.questions[troom.currentQ];
      reconnectData.question = {
        questionNum:    troom.currentQ + 1,
        totalQuestions: troom.totalQ,
        question:       q.question,
        choices:        q.choices,
        timeLimit:      TRIVIA_TIME_MS / 1000,
        scores:         publicScores(troom),
      };
    }

    socket.emit('trivia-reconnect-success', reconnectData);
    io.to(key).emit('trivia-room-updated', getTriviaRoomState(troom));
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Compteur de visites ──────────────────────────────────────────────────────
// Le front envoie un ping une fois par session avec un identifiant de visiteur
// stable (stocké dans son localStorage). On compte le total de visites et les
// visiteurs uniques. La consultation se fait via /admin/stats (clé admin).
const DAY_MS      = 86_400_000;
const BENIN_OFFSET = 3_600_000; // UTC+1, sans changement d'heure
// Repli mémoire si MongoDB est indisponible (perdu au redémarrage).
const visitFallback = { totalVisits: 0, uniqueVisitors: 0, seen: new Set() };
const visitRateMap  = new Map(); // ip → [timestamps]

app.post('/api/visit', async (req, res) => {
  bumpDaily('visits');
  try {
    const raw = typeof req.body?.visitorId === 'string' ? req.body.visitorId : '';
    const visitorId = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!visitorId) return res.json({ ok: false });

    // Anti-abus léger : 30 pings max / 10 min / IP.
    const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
    const now = Date.now();
    const hits = (visitRateMap.get(ip) || []).filter(ts => now - ts < 10 * 60_000);
    if (hits.length >= 30) return res.json({ ok: false });
    hits.push(now);
    visitRateMap.set(ip, hits);

    let isNew = false;
    if (db) {
      const r = await db.collection('visitors').updateOne(
        { _id: visitorId },
        { $set: { last: now }, $setOnInsert: { first: now }, $inc: { visits: 1 } },
        { upsert: true }
      );
      isNew = !!(r.upsertedCount || r.upsertedId);
      await db.collection('visit_stats').updateOne(
        { _id: 'totals' },
        { $inc: { totalVisits: 1, uniqueVisitors: isNew ? 1 : 0 } },
        { upsert: true }
      );
    } else {
      visitFallback.totalVisits += 1;
      if (!visitFallback.seen.has(visitorId)) { visitFallback.seen.add(visitorId); visitFallback.uniqueVisitors += 1; isNew = true; }
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ── Journal des questions posées à l'assistant (chatbot local) ───────────────
// Le bot répond côté navigateur ; ce ping sert uniquement à ce que l'admin voie
// ce que les joueurs demandent. Anonyme (aucun identifiant joueur).
const botLogs = []; // ring buffer en mémoire, {q, lang, at}
const BOT_LOG_MAX = 300;
const botLogRateMap = new Map(); // ip -> [timestamps]

app.post('/api/bot-log', (req, res) => {
  try {
    const raw = typeof req.body?.q === 'string' ? req.body.q : '';
    const q = raw.trim().slice(0, 200);
    if (!q) return res.json({ ok: false });
    const lang = req.body?.lang === 'en' ? 'en' : 'fr';

    const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
    const now = Date.now();
    const hits = (botLogRateMap.get(ip) || []).filter(ts => now - ts < 10 * 60_000);
    if (hits.length >= 60) return res.json({ ok: false });
    hits.push(now);
    botLogRateMap.set(ip, hits);

    const entry = { id: crypto.randomUUID(), q, lang, at: now, flagged: false };
    botLogs.push(entry);
    if (botLogs.length > BOT_LOG_MAX) botLogs.shift();
    if (db) db.collection('bot_logs').insertOne({ ...entry }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ── Signalements de bugs par les joueurs ──
const bugReports = []; // ring buffer memoire
const BUG_REPORT_MAX = 500;
const bugReportRateMap = new Map(); // ip -> [timestamps]
app.post('/api/bug-report', (req, res) => {
  try {
    const text = sanitizeText(typeof req.body?.text === 'string' ? req.body.text : '', 1000);
    if (!text || text.length < 5) return res.status(400).json({ ok: false });
    const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
    const now = Date.now();
    const hits = (bugReportRateMap.get(ip) || []).filter(ts => now - ts < 60 * 60_000);
    if (hits.length >= 10) return res.status(429).json({ ok: false }); // 10/h/IP
    hits.push(now); bugReportRateMap.set(ip, hits);
    const entry = {
      id: crypto.randomUUID(),
      text,
      contact: sanitizeText(typeof req.body?.contact === 'string' ? req.body.contact : '', 80),
      name: sanitizeText(typeof req.body?.name === 'string' ? req.body.name : '', 30),
      ref: req.body?.playerId ? _playerRef(String(req.body.playerId)) : '',
      page: sanitizeText(typeof req.body?.page === 'string' ? req.body.page : '', 30),
      lang: req.body?.lang === 'en' ? 'en' : 'fr',
      ua: sanitizeText(typeof req.body?.ua === 'string' ? req.body.ua : '', 200),
      at: now, resolved: false,
    };
    bugReports.push(entry);
    if (bugReports.length > BUG_REPORT_MAX) bugReports.shift();
    if (db) db.collection('bug_reports').insertOne({ ...entry }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// Reference opaque d'un joueur pour l'admin : hash du playerId (jamais le vrai
// identifiant secret, pour qu'il ne puisse pas fuiter du tableau de bord).
function _playerRef(pid) {
  return crypto.createHash('sha256').update(String(pid)).digest('hex').slice(0, 16);
}
function _allPlayerIds() {
  const ids = new Set();
  for (const k of leaderboard.keys())       ids.add(k);
  for (const k of triviaLeaderboard.keys())  ids.add(k);
  for (const k of snakeLeaderboard.keys())   ids.add(k);
  for (const k of luffyLeaderboard.keys())   ids.add(k);
  for (const k of libs.keys())               ids.add(k);
  return ids;
}

// Agrège les joueurs à partir des différents classements + soldes de Libs.
function _aggregatePlayers() {
  const map = new Map(); // pid -> stats
  const get = pid => {
    if (!map.has(pid)) map.set(pid, { name: '', wins: 0, losses: 0, draws: 0, points: 0, quizzes: 0, snakeHs: 0, luffyHs: 0, libs: 0 });
    return map.get(pid);
  };
  const setName = (p, n) => { if (n && (!p.name || p.name === 'Anonyme')) p.name = n; };
  for (const [pid, v] of leaderboard)       { const p = get(pid); setName(p, v.name); p.wins = v.wins || 0; p.losses = v.losses || 0; p.draws = v.draws || 0; }
  for (const [pid, v] of triviaLeaderboard) { const p = get(pid); setName(p, v.name); p.points = v.points || 0; p.quizzes = v.games || 0; }
  for (const [pid, v] of snakeLeaderboard)  { const p = get(pid); setName(p, v.name); p.snakeHs = v.hs || 0; }
  for (const [pid, v] of luffyLeaderboard)  { const p = get(pid); setName(p, v.name); p.luffyHs = v.hs || 0; }
  for (const [pid, v] of libs)              { const p = get(pid); setName(p, v.name); p.libs = v.balance || 0; p.lastActive = v.lastActive || 0; }
  return [...map.entries()]
    .map(([pid, p]) => ({ ...p, name: p.name || 'Anonyme', games: p.wins + p.losses + p.draws, lastActive: p.lastActive || 0, ref: _playerRef(pid) }))
    .sort((a, b) => (b.games + b.quizzes) - (a.games + a.quizzes))
    .slice(0, 300);
}

// Detail complet d'un joueur (clé admin requise) : stats + streak + cosmétiques
// possédés + équipements + historique + achats. Identifié par sa reference hashée.
// Admin : restauration manuelle d'un compte (SAV, ex. reinitialisation par
// erreur). Re-credite solde, cosmetiques, classements et serie sur le compte
// vise par sa ref. Chaque champ est optionnel : seuls ceux fournis sont ecrits.
app.post('/admin/restore-player', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const b = req.body || {};
  const wantRef = String(b.ref || '');
  let pid = null;
  for (const id of _allPlayerIds()) { if (_playerRef(id) === wantRef) { pid = id; break; } }
  if (pid === null) return res.status(404).json({ error: 'Joueur introuvable.' });
  const entry = getLibsEntry(pid);
  const name  = entry.name || 'Anonyme';
  const num = v => Math.max(0, Math.floor(Number(v) || 0));

  if (b.balance !== undefined) entry.balance = Math.min(MAX_BALANCE, num(b.balance));
  if (Array.isArray(b.addCosmetics)) {
    b.addCosmetics.forEach(cid => {
      if (COSMETICS.some(c => c.id === cid) && !entry.ownedCosmetics.includes(cid)) entry.ownedCosmetics.push(cid);
    });
  }
  if (b.streakCount !== undefined) {
    const n = num(b.streakCount);
    entry.streak = { lastDay: _dayKey(), count: n, longest: Math.max(n, entry.streak?.longest || 0) };
    const lt = getLifetime(entry);
    lt.streakDays = Math.max(lt.streakDays || 0, n);
  }
  libs.set(pid, entry);
  dbUpsertLibs(pid, entry);

  if (b.wins !== undefined || b.losses !== undefined || b.draws !== undefined) {
    const lb = leaderboard.get(pid) || { name, wins: 0, losses: 0, draws: 0 };
    if (b.wins   !== undefined) lb.wins   = num(b.wins);
    if (b.losses !== undefined) lb.losses = num(b.losses);
    if (b.draws  !== undefined) lb.draws  = num(b.draws);
    lb.name = name;
    leaderboard.set(pid, lb);
    dbUpsertLeaderboard(pid, lb);
  }
  if (b.points !== undefined || b.quizzes !== undefined) {
    const tlb = triviaLeaderboard.get(pid) || { name, points: 0, games: 0 };
    if (b.points  !== undefined) tlb.points = num(b.points);
    if (b.quizzes !== undefined) tlb.games  = num(b.quizzes);
    tlb.name = name;
    triviaLeaderboard.set(pid, tlb);
    dbUpsertTriviaLeaderboard(pid, tlb);
  }
  if (b.snakeHs !== undefined) {
    const slb = { name, hs: num(b.snakeHs) };
    snakeLeaderboard.set(pid, slb);
    dbUpsertSnakeLeaderboard(pid, slb);
  }
  if (b.luffyHs !== undefined) {
    const llb = { name, hs: num(b.luffyHs) };
    luffyLeaderboard.set(pid, llb);
    dbUpsertLuffyLeaderboard(pid, llb);
  }

  io.emit('leaderboard-update', getLeaderboardData());
  io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
  io.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
  io.emit('global-leaderboard-update', getGlobalLeaderboardData());
  _emitToPlayer(pid, 'libs-update', { name: entry.name || '', balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
  adminAudit('restore-player', { ref: String(req.body?.ref || '') });
  res.json({ ok: true, name, balance: entry.balance, owned: entry.ownedCosmetics.length });
});

// Admin : restitue un compte reinitialise depuis l'archive. Par defaut sur son
// ancien identifiant ; targetRef (ref d'un joueur actuel) permet de restituer
// sur le nouveau compte du joueur. Les cosmetiques s'ajoutent a ceux du compte
// cible, le reste (solde, stats, classements) reprend les valeurs archivees.
app.post('/admin/reset-restore', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { id, targetRef } = req.body || {};
  const arch = resetArchive.get(String(id || ''));
  if (!arch) return res.status(404).json({ error: 'Archive introuvable.' });
  let pid = arch.playerId;
  if (targetRef) {
    pid = null;
    for (const p of _allPlayerIds()) { if (_playerRef(p) === String(targetRef)) { pid = p; break; } }
    if (pid === null) return res.status(404).json({ error: 'Compte cible introuvable.' });
  }
  const name = arch.name || 'Anonyme';
  if (arch.libs) {
    const target = getLibsEntry(pid);
    const merged = { ...JSON.parse(JSON.stringify(arch.libs)) };
    merged.name = target.name || name;
    // Union des cosmetiques : on ne retire rien de ce que le compte cible a deja.
    (target.ownedCosmetics || []).forEach(c => { if (!merged.ownedCosmetics.includes(c)) merged.ownedCosmetics.push(c); });
    libs.set(pid, merged);
    dbUpsertLibs(pid, merged);
  }
  if (arch.leaderboard) { const v = { ...arch.leaderboard, name }; leaderboard.set(pid, v);       dbUpsertLeaderboard(pid, v); }
  if (arch.trivia)      { const v = { ...arch.trivia, name };      triviaLeaderboard.set(pid, v); dbUpsertTriviaLeaderboard(pid, v); }
  if (arch.snake)       { const v = { ...arch.snake, name };       snakeLeaderboard.set(pid, v);  dbUpsertSnakeLeaderboard(pid, v); }
  if (arch.luffy)       { const v = { ...arch.luffy, name };       luffyLeaderboard.set(pid, v);  dbUpsertLuffyLeaderboard(pid, v); }
  arch.restoredAt = Date.now();
  resetArchive.set(arch._id, arch);
  if (db) db.collection('reset_archive').updateOne({ _id: arch._id }, { $set: { restoredAt: arch.restoredAt } }).catch(() => {});
  io.emit('leaderboard-update', getLeaderboardData());
  io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
  io.emit('luffy-leaderboard-update', getLuffyLeaderboardData());
  io.emit('global-leaderboard-update', getGlobalLeaderboardData());
  const e2 = libs.get(pid);
  if (e2) _emitToPlayer(pid, 'libs-update', { name: e2.name || '', balance: e2.balance, pendingBoostHint: e2.pendingBoostHint, ownedCosmetics: e2.ownedCosmetics, ..._equippedPayload(e2), nextAt: nextDistributionAt });
  adminAudit('reset-restore', { id: String(req.body?.id || ''), targetRef: String(req.body?.targetRef || '') });
  res.json({ ok: true, name, restoredTo: targetRef ? 'target' : 'original' });
});

// Admin : supprime une entree de l'archive (ou tout le cache sans :id).
app.delete('/admin/reset-archive/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const id = String(req.params.id || '');
  if (!resetArchive.has(id)) return res.status(404).json({ error: 'Archive introuvable.' });
  resetArchive.delete(id);
  if (db) db.collection('reset_archive').deleteOne({ _id: id }).catch(() => {});
  res.json({ ok: true });
});
app.delete('/admin/reset-archive', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const n = resetArchive.size;
  resetArchive.clear();
  if (db) db.collection('reset_archive').deleteMany({}).catch(() => {});
  res.json({ ok: true, cleared: n });
});

app.get('/admin/player/:ref', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const wantRef = String(req.params.ref || '');
  let pid = null;
  for (const id of _allPlayerIds()) { if (_playerRef(id) === wantRef) { pid = id; break; } }
  if (pid === null) return res.status(404).json({ error: 'Joueur introuvable.' });

  const lb  = leaderboard.get(pid)       || {};
  const tlb = triviaLeaderboard.get(pid) || {};
  const slb = snakeLeaderboard.get(pid)  || {};
  const llb = luffyLeaderboard.get(pid)  || {};
  const e   = libs.get(pid)              || {};
  const name = e.name || lb.name || tlb.name || slb.name || llb.name || 'Anonyme';

  const purchases = [...libsPurchases.values()]
    .filter(p => p.playerId === pid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(p => ({ packId: p.packId, libsAmount: p.libsAmount || 0, status: p.credited ? 'completed' : (p.status || 'pending'), at: p.createdAt || 0 }));

  res.json({
    name,
    wins: lb.wins || 0, losses: lb.losses || 0, draws: lb.draws || 0,
    points: tlb.points || 0, quizzes: tlb.games || 0,
    snakeHs: slb.hs || 0, luffyHs: llb.hs || 0,
    libs: e.balance || 0,
    streak: e.streak || null,
    owned: Array.isArray(e.ownedCosmetics) ? e.ownedCosmetics : [],
    honorTitle: e.honorTitle || null,
    equipped: {
      color: e.equippedCosmetic || null, font: e.equippedFont || null, bubble: e.equippedBubble || null,
      background: e.equippedBackground || null, nameEffect: e.equippedNameEffect || null, title: e.equippedTitle || null,
      cursorSnake: e.equippedCursorSnake || null, avatar: e.equippedAvatar || null, p4Token: e.equippedP4Token || null,
      ttt: e.equippedTtt || null, chess: e.equippedChess || null, snakeSkin: e.equippedSnakeSkin || null,
      clickFx: e.equippedClickFx || null, emojiPack: e.equippedEmojiPack || null, victoryBan: e.equippedVictoryBan || null,
      soundPack: e.equippedSoundPack || null, emotes: Array.isArray(e.equippedEmotes) ? e.equippedEmotes : [],
    },
    history: (Array.isArray(e.history) ? e.history : []).slice(-40).reverse(),
    purchases,
  });
});

// Consultation privée du tableau de bord complet (clé admin requise).
app.get('/admin/stats', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  try {
    const now = Date.now();
    const startOfToday = Math.floor((now + BENIN_OFFSET) / DAY_MS) * DAY_MS - BENIN_OFFSET;
    const online = io.engine?.clientsCount || 0;

    // Visites
    let visits = { totalVisits: 0, uniqueVisitors: 0, today: 0, week: 0 };
    if (db) {
      const totals = await db.collection('visit_stats').findOne({ _id: 'totals' }) || {};
      visits.totalVisits    = totals.totalVisits || 0;
      visits.uniqueVisitors = totals.uniqueVisitors || 0;
      visits.today = await db.collection('visitors').countDocuments({ last: { $gte: startOfToday } });
      visits.week  = await db.collection('visitors').countDocuments({ last: { $gte: now - 7 * DAY_MS } });
    } else {
      visits.totalVisits    = visitFallback.totalVisits;
      visits.uniqueVisitors = visitFallback.uniqueVisitors;
      visits.today = visits.week = visitFallback.uniqueVisitors;
    }

    // Joueurs + parties
    const players = _aggregatePlayers();
    const classicResults = players.reduce((s, p) => s + p.games, 0);
    const classicWins     = players.reduce((s, p) => s + p.wins, 0);
    const quizzes         = players.reduce((s, p) => s + p.quizzes, 0);
    const quizPoints      = players.reduce((s, p) => s + p.points, 0);
    const snakePlayers    = players.filter(p => p.snakeHs > 0).length;
    const luffyPlayers    = players.filter(p => p.luffyHs > 0).length;

    // Commentaires (avec statut de modération)
    const commentsPayload = comments.slice().reverse().map(_adminCommentView);
    const commentsApproved = commentsPayload.filter(c => c.approved).length;
    const commentsPending  = commentsPayload.length - commentsApproved;

    // Achats en argent réel
    const purchasesAll = [...libsPurchases.values()];
    const purchasesDone = purchasesAll.filter(p => p.credited || p.status === 'completed');
    const libsSold = purchasesDone.reduce((s, p) => s + (p.libsAmount || 0), 0);
    const recentPurchases = purchasesAll
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 50)
      .map(p => ({
        name: (libs.get(p.playerId)?.name) || 'Anonyme',
        packId: p.packId, libsAmount: p.libsAmount || 0,
        status: p.credited ? 'completed' : (p.status || 'pending'),
        at: p.createdAt || 0,
      }));

    // Journal du chatbot
    let botLogsOut = botLogs.slice(-100).reverse();
    if (db) {
      try {
        const docs = await db.collection('bot_logs').find().sort({ at: -1 }).limit(100).toArray();
        // Les anciennes entrees (avant le flag) n'ont pas d'id : on utilise leur
        // timestamp comme identifiant de repli, suffisant pour flaguer.
        if (docs.length) botLogsOut = docs.map(d => ({ id: d.id || String(d.at), q: d.q, lang: d.lang, at: d.at, flagged: !!d.flagged }));
      } catch (e) {}
    } else {
      botLogsOut = botLogsOut.map(d => ({ id: d.id || String(d.at), q: d.q, lang: d.lang, at: d.at, flagged: !!d.flagged }));
    }

    res.json({
      // compat : les champs de visite restent à la racine
      totalVisits: visits.totalVisits, uniqueVisitors: visits.uniqueVisitors,
      today: visits.today, week: visits.week, online,
      totals: {
        players: players.length, classicResults, classicWins, quizzes, quizPoints,
        snakePlayers, luffyPlayers,
        snakeGames: gameCounters.snakeGames, luffyGames: gameCounters.luffyGames,
        commentsApproved, commentsPending, commentsTotal: commentsPayload.length,
        purchasesCount: purchasesDone.length, libsSold,
      },
      daily: (() => {
        const out = [];
        for (let i = 29; i >= 0; i--) {
          const k = new Date(Date.now() + 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
          const d = dailyStats.get(k) || {};
          out.push({ d: k, visits: d.visits || 0, games: d.games || 0 });
        }
        return out;
      })(),
      fraudAlerts: fraudAlerts.slice(0, 20),
      announcements: announcements.slice(0, 20).map(a => ({ id: a._id, text: a.text, textEn: a.textEn || '', at: a.at })),
      audit: adminAudits.slice(0, 50),
      pushSubscribers: pushSubs.size,
      flashOffer: flashPayload().offer,
      // Joueurs qui decrochent : actifs autrefois, silencieux depuis 7 jours ou plus.
      inactive7: (() => {
        const now = Date.now();
        const out = [];
        for (const [pid, e] of libs.entries()) {
          if (!e.name || e.name === 'Anonyme' || !(e.history || []).length) continue;
          const days = Math.floor((now - (e.lastActive || 0)) / 86_400_000);
          if (days >= 7) out.push({ ref: _playerRef(pid), name: e.name, days, balance: e.balance || 0 });
        }
        return out.sort((a, b) => a.days - b.days).slice(0, 30);
      })(),
      players,
      comments: commentsPayload,
      purchases: recentPurchases,
      botLogs: botLogsOut,
      bugReports: bugReports.slice(-100).reverse().map(b => ({
        id: b.id, text: b.text, contact: b.contact, name: b.name, page: b.page,
        lang: b.lang, ua: b.ua, at: b.at, resolved: !!b.resolved,
      })),
      serverErrors: serverErrors.slice(0, 50),
      pushAudience: (() => {
        const out = { all: pushSubs.size };
        for (const seg of ['inactive7', 'active7', 'vip', 'big']) {
          out[seg] = _segmentPlayerIds(seg).filter(id => pushSubs.has(id)).length;
        }
        return out;
      })(),
      scheduled: scheduledTasks.slice().sort((a, b) => a.fireAt - b.fireAt).map(t => ({
        id: t.id, kind: t.kind, fireAt: t.fireAt, done: !!t.done, segment: t.segment,
        title: t.title, body: t.body, text: t.text,
      })),
      bannedWords,
      maintenance,
      alertRecipients: adminAlertSubs.length,
      bookPrices: Object.values(LIBERO_BOOKS).map(b => ({
        id: b.id, titre: b.titre,
        packs: b.packs.map(p => ({ id: p.id, from: p.from, to: p.to, basePrice: p.price, price: bookPackPrice(b.id, p) })),
      })),
      // Comparaison de periodes : 7 derniers jours vs les 7 precedents.
      periods: (() => {
        const dayKey = i => new Date(Date.now() + 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
        let vThis = 0, gThis = 0, vPrev = 0, gPrev = 0;
        for (let i = 0; i < 7; i++)  { const d = dailyStats.get(dayKey(i))      || {}; vThis += d.visits || 0; gThis += d.games || 0; }
        for (let i = 7; i < 14; i++) { const d = dailyStats.get(dayKey(i))      || {}; vPrev += d.visits || 0; gPrev += d.games || 0; }
        const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0);
        return { visitsThis: vThis, visitsPrev: vPrev, visitsPct: pct(vThis, vPrev), gamesThis: gThis, gamesPrev: gPrev, gamesPct: pct(gThis, gPrev) };
      })(),
      // Comptes reinitialises (cache restituable) : les plus recents d'abord.
      resets: [...resetArchive.values()]
        .sort((a, b) => (b.at || 0) - (a.at || 0))
        .map(r => ({
          id: r._id, name: r.name, at: r.at, restoredAt: r.restoredAt || null,
          balance: r.libs?.balance || 0,
          owned: (r.libs?.ownedCosmetics || []).length,
          wins: r.leaderboard?.wins || 0, losses: r.leaderboard?.losses || 0,
          points: r.trivia?.points || 0,
          snakeHs: r.snake?.hs || 0, luffyHs: r.luffy?.hs || 0,
          streak: r.libs?.streak?.count || 0,
        })),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── Commentaires joueurs ─────────────────────────────────────────────────────
const commentRateMap     = new Map(); // ip → [timestamps]
const commentLikeMap     = new Map(); // commentId (string) → Set<playerId>
const commentLikeRateMap = new Map(); // ip → [timestamps]

function _newsCommentsPayload() {
  // Seuls les commentaires validés par l'admin sont affichés publiquement.
  return comments.filter(c => c._id && c.approved).slice(-3).reverse()
    .map(c => ({
      id:     c._id.toString(),
      pseudo: c.pseudo || 'Anonyme',
      message: c.message,
      date:   c.date,
      likes:  commentLikeMap.get(c._id.toString())?.size || 0,
    }));
}

app.get('/api/comments', (_req, res) => res.json(_newsCommentsPayload()));

// Like/délike d'un commentaire : compté par joueur (pas par IP, plusieurs
// joueurs partagent souvent la même IP mobile), et re-cliquer retire le like.
app.post('/api/comment-like', (req, res) => {
  const { id, playerId } = req.body || {};
  const pid = safePlayerId(playerId);
  if (!id || typeof id !== 'string' || !pid) return res.json({ ok: false });

  // Anti-spam : 60 changements de like par IP par heure.
  const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
  const now = Date.now();
  const times = (commentLikeRateMap.get(ip) || []).filter(t => now - t < 3_600_000);
  if (times.length >= 60) return res.status(429).json({ ok: false, error: 'rate_limited' });
  times.push(now);
  commentLikeRateMap.set(ip, times);

  const comment = comments.find(c => c._id && c._id.toString() === id);
  if (!comment) return res.json({ ok: false });
  if (!commentLikeMap.has(id)) commentLikeMap.set(id, new Set());
  const set   = commentLikeMap.get(id);
  const liked = !set.has(pid);
  if (liked) set.add(pid); else set.delete(pid);
  dbUpdateCommentLikes(comment._id, [...set]);
  io.emit('news-comments-update', _newsCommentsPayload());
  res.json({ ok: true, likes: set.size, liked });
});

app.post('/api/comment', (req, res) => {
  const { pseudo, message } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    return res.status(400).json({ error: 'Message trop court.' });
  }
  if (message.trim().length > 1000) {
    return res.status(400).json({ error: 'Message trop long (max 1000 caractères).' });
  }
  if (containsBanned(message) || containsBanned(pseudo)) {
    return res.status(400).json({ error: 'Ton message contient un terme interdit.' });
  }

  // Limite : 3 commentaires par IP par heure
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const times = (commentRateMap.get(ip) || []).filter(t => now - t < 3_600_000);
  if (times.length >= 3) {
    const oldest    = Math.min(...times);
    const waitMs    = 3_600_000 - (now - oldest);
    const waitMins  = Math.ceil(waitMs / 60_000);
    const waitStr   = waitMins <= 1 ? 'moins d\'une minute' : `${waitMins} minutes`;
    return res.status(429).json({ error: `Limite atteinte (3/h). Réessaie dans ${waitStr}.`, waitMs });
  }
  times.push(now);
  commentRateMap.set(ip, times);

  const comment = {
    _id:     'c_' + crypto.randomUUID(),
    pseudo:  pseudo?.trim() || 'Anonyme',
    message: message.trim(),
    date:    new Date().toISOString(),
    approved: false, // en attente de modération : n'apparaît pas avant validation
  };
  comments.push(comment);
  dbInsertComment(comment);
  // Pas de broadcast public (le commentaire est en attente) : le tableau de bord
  // admin le verra via /admin/comments.
  io.emit('news-comments-update', _newsCommentsPayload());

  console.log(`[💬] ${pseudo?.trim() || 'Anonyme'} : ${message.trim().slice(0, 80)}`);
  res.json({ ok: true });
});

// ── Achat de Libs avec de l'argent réel (FedaPay) ───────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public : liste des packs. Tous les packs sont disponibles dès que la clé
// FedaPay est configurée (les transactions sont créées à la volée, plus de
// produit à déclarer un par un comme avec Maketou).
app.get('/api/libs/packs', (_req, res) => {
  const configured = !!process.env.FEDAPAY_SECRET_KEY;
  res.json(Object.entries(LIBS_PACKS).map(([id, p]) => ({
    id, libs: p.libs, bonus: p.bonus || 0, priceFCFA: p.priceFCFA,
    featured: !!p.featured, available: configured,
  })));
});

// Initie un achat : crée une transaction FedaPay et renvoie l'URL de paiement.
app.post('/api/libs/checkout', async (req, res) => {
  const { playerId, packId, email, firstName, lastName, phone } = req.body || {};
  const id = safePlayerId(playerId);
  if (!id) return res.status(400).json({ error: 'invalid_player' });

  // Limite anti-brute-force en tout premier, avant toute autre vérification :
  // 5 tentatives d'achat par IP par heure (même modèle que les commentaires).
  const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
  const now = Date.now();
  const times = (libsCheckoutRateMap.get(ip) || []).filter(t => now - t < 3_600_000);
  if (times.length >= 5) return res.status(429).json({ error: 'rate_limited' });
  times.push(now);
  libsCheckoutRateMap.set(ip, times);

  const entry = getLibsEntry(id);
  if (!entry.name || entry.name === 'Anonyme') return res.status(403).json({ error: 'anonymous' });

  const pack = LIBS_PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'invalid_pack' });

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'invalid_email' });
  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) return res.status(400).json({ error: 'invalid_name' });
  if (!lastName  || typeof lastName  !== 'string' || !lastName.trim())  return res.status(400).json({ error: 'invalid_name' });

  // La disponibilité (clé FedaPay configurée) se vérifie en dernier : un client
  // doit d'abord corriger sa saisie avant d'apprendre que le pack est indisponible.
  if (!process.env.FEDAPAY_SECRET_KEY) return res.status(503).json({ error: 'pack_unavailable' });

  try {
    const { transaction, paymentUrl } = await createFedapayCheckout({
      amountFCFA: pack.priceFCFA,
      description: `Libero's Multi : ${pack.label}`,
      email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
      phone: phone ? String(phone).trim().slice(0, 30) : undefined,
      meta: { playerId: id, packId },
    });
    const purchase = {
      _id: String(transaction.id), playerId: id, packId, libsAmount: pack.libs,
      status: normalizeFedapayStatus(transaction.status), credited: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    libsPurchases.set(purchase._id, purchase);
    dbUpsertLibsPurchase(purchase._id, purchase);
    console.log(`[🛒] Transaction FedaPay créée : ${purchase._id} (${pack.label}) → ${entry.name}`);
    res.json({ ok: true, cartId: purchase._id, redirectUrl: paymentUrl });
  } catch (e) {
    console.error('Erreur checkout FedaPay:', e.message);
    res.status(502).json({ error: 'checkout_failed' });
  }
});

// Vérifie une transaction auprès de FedaPay et crédite si (et seulement si) le
// paiement est confirmé côté serveur. Le retour du navigateur ne prouve rien
// à lui seul — c'est cette route (ou le webhook) qui décide, jamais le client.
app.post('/api/libs/verify', async (req, res) => {
  const { playerId, cartId } = req.body || {};
  const id = safePlayerId(playerId);
  if (!id || !cartId || typeof cartId !== 'string') return res.status(400).json({ error: 'invalid' });

  const purchase = libsPurchases.get(cartId);
  if (!purchase || purchase.playerId !== id) return res.status(404).json({ error: 'not_found' });
  if (purchase.credited) return res.json({ status: 'completed', alreadyCredited: true });

  let tx;
  try { tx = await fetchFedapayTransaction(cartId); }
  catch (e) { console.error('Erreur vérif FedaPay:', e.message); return res.status(502).json({ error: 'verify_failed' }); }

  const metaPlayerId = tx.custom_metadata?.playerId;
  if (metaPlayerId && metaPlayerId !== id) {
    console.warn(`[⚠️] custom_metadata.playerId FedaPay ne correspond pas pour la transaction ${cartId}`);
    return res.status(403).json({ error: 'mismatch' });
  }

  const status = normalizeFedapayStatus(tx.status);
  if (status === 'completed') {
    creditLibsPurchase(purchase);
    return res.json({ status: 'completed', libsAdded: purchase.libsAmount, newBalance: libs.get(id).balance });
  }
  if (status !== purchase.status) {
    purchase.status = status;
    purchase.updatedAt = Date.now();
    libsPurchases.set(cartId, purchase);
    dbUpsertLibsPurchase(cartId, purchase);
  }
  res.json({ status });
});

// ── Webhook FedaPay ─────────────────────────────────────────────────────────
// FedaPay notifie ce endpoint dès qu'une transaction change d'état : le crédit
// arrive donc même si le joueur ferme l'onglet après avoir payé. La signature
// HMAC (en-tête x-fedapay-signature, format `t=<timestamp>,s=<hex>`, SHA-256 de
// `timestamp.corpsBrut`) garantit que la requête vient bien de FedaPay.
function verifyFedapaySignature(rawBody, header, secret) {
  if (!rawBody || !header || !secret) return false;
  let ts = null; const sigs = [];
  for (const part of String(header).split(',')) {
    const [k, v] = part.split('=', 2).map(s => s && s.trim());
    if (k === 't') ts = v;
    else if (k === 's' && v) sigs.push(v);
  }
  if (!ts || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // anti-rejeu : 5 min
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const expBuf = Buffer.from(expected);
  return sigs.some(s => {
    const buf = Buffer.from(s);
    return buf.length === expBuf.length && crypto.timingSafeEqual(buf, expBuf);
  });
}

app.post('/api/libs/webhook', (req, res) => {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'webhook_not_configured' });
  if (!verifyFedapaySignature(req.rawBody, req.headers['x-fedapay-signature'], secret)) {
    console.warn('[⚠️] Webhook FedaPay rejeté : signature invalide');
    return res.status(400).json({ error: 'invalid_signature' });
  }

  const event  = req.body || {};
  const entity = event.entity || {};
  const purchase = entity.id != null ? libsPurchases.get(String(entity.id)) : null;
  // Toujours répondre 200 aux événements qui ne nous concernent pas (autres
  // entités, transactions inconnues) pour que FedaPay ne les rejoue pas en boucle.
  if (!purchase) return res.json({ ok: true });

  if (event.name === 'transaction.approved') {
    creditLibsPurchase(purchase);
  } else if (['transaction.declined', 'transaction.canceled', 'transaction.updated'].includes(event.name) && !purchase.credited) {
    const status = normalizeFedapayStatus(entity.status);
    if (status !== 'completed' && status !== purchase.status) {
      purchase.status = status;
      purchase.updatedAt = Date.now();
      libsPurchases.set(purchase._id, purchase);
      dbUpsertLibsPurchase(purchase._id, purchase);
    }
  }
  res.json({ ok: true });
});

// ── Contrôle d'accès admin ──────────────────────────────────────────────────
// Comparaison à temps constant + limite anti-brute-force par IP.
const adminAttempts = new Map(); // ip -> [timestamps des échecs]
function isAdmin(req) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false; // fail closed : pas de clé configurée = pas d'accès
  const ip  = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
  const now = Date.now();
  const fails = (adminAttempts.get(ip) || []).filter(ts => now - ts < 15 * 60_000);
  if (fails.length >= 10) { adminAttempts.set(ip, fails); return false; } // 10 échecs / 15 min
  // La clé peut venir d'un en-tête (recommandé, non journalisé) ou du query
  // string (compat. historique — apparaît dans les logs, à éviter).
  const provided = req.headers['x-admin-key'] || req.query.key || '';
  const given    = Buffer.from(String(provided));
  const expected = Buffer.from(adminKey);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) { fails.push(now); adminAttempts.set(ip, fails); }
  else adminAttempts.delete(ip);
  return ok;
}

function _adminCommentView(c) {
  return {
    id:       c._id?.toString(),
    pseudo:   c.pseudo || 'Anonyme',
    message:  c.message,
    date:     c.date,
    approved: !!c.approved,
    autoDeleteAt: c.autoDeleteAt || null,
    likes:    commentLikeMap.get(c._id?.toString())?.size || 0,
  };
}

app.get('/admin/comments', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  res.json(comments.slice().reverse().map(_adminCommentView)); // plus récent en premier
});

// Admin : valide (affiche) ou masque un commentaire.
// Annonces (bandeau News) : lecture publique, gestion admin.
app.get('/api/announcements', (req, res) => {
  res.json({ announcements: announcements.slice(0, 5).map(a => ({ id: a._id, text: a.text, textEn: a.textEn || '', at: a.at })) });
});
// Admin : defis personnalises (quotidiens ou permanents).
app.get('/admin/challenges', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  res.json({ challenges: adminChallenges, metrics: CHALLENGE_METRICS.concat('streakDays') });
});
app.post('/admin/challenge', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { kind, metric, goal, reward, label, labelEn } = req.body || {};
  if (!['daily', 'permanent'].includes(kind)) return res.status(400).json({ error: 'kind = daily ou permanent.' });
  if (!CHALLENGE_METRICS.concat('streakDays').includes(String(metric))) return res.status(400).json({ error: 'Métrique inconnue : ' + metric });
  const g = Math.max(1, Math.min(1_000_000, Math.floor(Number(goal) || 0)));
  const r = Math.max(1, Math.min(10_000, Math.floor(Number(reward) || 0)));
  const lbl = String(label || '').trim().slice(0, 80);
  if (!lbl) return res.status(400).json({ error: 'Libellé (FR) requis.' });
  const c = { _id: 'adm_' + crypto.randomUUID().slice(0, 8), kind, metric: String(metric), goal: g, reward: r, label: lbl, labelEn: String(labelEn || '').trim().slice(0, 80), at: Date.now() };
  adminChallenges.push(c);
  if (db) db.collection('admin_challenges').insertOne({ ...c }).catch(() => {});
  adminAudit('challenge-create', { id: c._id, kind, metric: c.metric, goal: g, reward: r, label: lbl });
  // Tous les joueurs connectes voient le nouveau defi tout de suite.
  for (const [sockId, pid] of socketPlayerIds.entries()) {
    const e = libs.get(pid);
    if (e) io.to(sockId).emit('challenges-update', { challenges: challengesPayload(e), permanent: permanentPayload(e) });
  }
  res.json({ ok: true, challenge: c });
});
app.delete('/admin/challenge/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = adminChallenges.findIndex(c => c._id === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Défi introuvable.' });
  const [c] = adminChallenges.splice(idx, 1);
  if (db) db.collection('admin_challenges').deleteOne({ _id: c._id }).catch(() => {});
  adminAudit('challenge-delete', { id: c._id, label: c.label });
  for (const [sockId, pid] of socketPlayerIds.entries()) {
    const e = libs.get(pid);
    if (e) io.to(sockId).emit('challenges-update', { challenges: challengesPayload(e), permanent: permanentPayload(e) });
  }
  res.json({ ok: true });
});

// Admin : catalogue complet des cosmetiques, mise en boutique / retrait,
// avec compte a rebours optionnel de disparition (affiche sur l'article).
app.get('/admin/cosmetics', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  pruneShopOverrides();
  res.json({
    cosmetics: COSMETICS.filter(c => !c.honorary).map(c => {
      const o = shopOverrides.get(c.id);
      const isEmote = c.type === 'emote';
      return { id: c.id, type: c.type, price: c.price,
        defaultInShop: isEmote ? true : DEFAULT_SHOP_TYPES.has(c.type),
        emote: isEmote,
        override: o ? { inShop: o.inShop, until: o.until || null } : null,
        effective: isEmote ? emoteAvailable(c.id) : shopHas(c) };
    }),
  });
});
app.post('/admin/cosmetic-shop', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { cosmeticId, inShop, hours } = req.body || {};
  const cosm = COSMETICS.find(c => c.id === String(cosmeticId) && !c.honorary);
  if (!cosm) return res.status(400).json({ error: 'Cosmétique inconnu : ' + cosmeticId });
  const h = Number(hours) > 0 ? Math.min(24 * 30, Math.floor(Number(hours))) : 0;
  if (inShop === null || inShop === undefined) {
    shopOverrides.delete(cosm.id); // retour au comportement par defaut
  } else {
    shopOverrides.set(cosm.id, { inShop: !!inShop, until: (inShop && h) ? Date.now() + h * 3_600_000 : null });
  }
  dbSaveShopOverrides();
  io.emit('shop-overrides', shopOverridesPayload());
  adminAudit('shop-toggle', { cosmeticId: cosm.id, inShop: !!inShop, hours: h || undefined });
  res.json({ ok: true, override: shopOverrides.get(cosm.id) || null });
});

// Admin : lancer / retirer une offre flash (promo courte sur un cosmetique).
app.post('/admin/flash', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { cosmeticId, discount, hours } = req.body || {};
  const cosm = COSMETICS.find(c => c.id === String(cosmeticId) && !c.honorary && c.price > 0);
  if (!cosm) return res.status(400).json({ error: 'Cosmétique inconnu ou gratuit : ' + cosmeticId });
  const disc = Math.max(10, Math.min(90, Math.floor(Number(discount) || 50)));
  const hrs  = Math.max(1, Math.min(72, Math.floor(Number(hours) || 2)));
  flashOffer = { cosmeticId: cosm.id, discount: disc, endsAt: Date.now() + hrs * 3_600_000 };
  dbSaveFlashOffer();
  io.emit('flash-offer', flashPayload());
  sendPush(null, { title: '⚡ Offre flash !', body: `-${disc}% sur un cosmétique pendant ${hrs}h dans la boutique !`, url: 'https://libero-multi.vercel.app' });
  adminAudit('flash-offer', { cosmeticId: cosm.id, discount: disc, hours: hrs });
  res.json({ ok: true, offer: flashPayload().offer });
});
app.delete('/admin/flash', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  flashOffer = null;
  dbSaveFlashOffer();
  io.emit('flash-offer', { offer: null });
  adminAudit('flash-offer-clear', {});
  res.json({ ok: true });
});

// Cle publique VAPID pour l'abonnement push cote client.
app.get('/api/push-key', (req, res) => {
  res.json({ key: webpush ? process.env.VAPID_PUBLIC_KEY : null });
});

// Statut public : sert la banniere de maintenance cote site.
app.get('/api/status', (req, res) => {
  res.json({ maintenance: !!maintenance.on, message: maintenance.message || '', messageEn: maintenance.messageEn || '' });
});

// Admin : notification push manuelle a tous les abonnes.
app.post('/admin/push', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  if (!webpush) return res.status(503).json({ error: 'Push non configuré (clés VAPID manquantes).' });
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const body  = String(req.body?.body || '').trim().slice(0, 200);
  if (!title && !body) return res.status(400).json({ error: 'Titre ou texte requis.' });
  const segment = ['all', 'inactive7', 'active7', 'vip', 'big'].includes(req.body?.segment) ? req.body.segment : 'all';
  const target = segment === 'all' ? null : _segmentPlayerIds(segment);
  const sent = sendPush(target, { title: title || "Libero's Multi", body, url: 'https://libero-multi.vercel.app' });
  adminAudit('push', { title, body, segment, sent });
  res.json({ ok: true, sent, segment, subscribers: pushSubs.size });
});

// Estimation de l'audience (abonnes joignables) par segment, pour le dashboard.
app.get('/admin/push-audience', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const out = { all: pushSubs.size };
  for (const seg of ['inactive7', 'active7', 'vip', 'big']) {
    out[seg] = _segmentPlayerIds(seg).filter(id => pushSubs.has(id)).length;
  }
  res.json({ ok: true, audience: out });
});

// ── Taches programmees (annonce/push a une date/heure) ──
app.post('/admin/schedule', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const kind = req.body?.kind === 'push' ? 'push' : 'announce';
  const fireAt = Number(req.body?.fireAt) || 0;
  if (!fireAt || fireAt < Date.now() - 60_000) return res.status(400).json({ error: 'Date invalide (dans le passé).' });
  const t = { id: crypto.randomUUID(), kind, at: Date.now(), fireAt, done: false, segment: 'all', title: '', body: '', text: '', textEn: '' };
  if (kind === 'announce') {
    t.text   = String(req.body?.text || '').trim().slice(0, 300);
    t.textEn = String(req.body?.textEn || '').trim().slice(0, 300);
    if (!t.text) return res.status(400).json({ error: 'Texte manquant.' });
  } else {
    t.title = String(req.body?.title || '').trim().slice(0, 80);
    t.body  = String(req.body?.body || '').trim().slice(0, 200);
    t.segment = ['all', 'inactive7', 'active7', 'vip', 'big'].includes(req.body?.segment) ? req.body.segment : 'all';
    if (!t.title && !t.body) return res.status(400).json({ error: 'Titre ou texte requis.' });
  }
  scheduledTasks.push(t); _persistTask(t);
  adminAudit('schedule-add', { kind, fireAt });
  res.json({ ok: true, id: t.id });
});
app.delete('/admin/schedule/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const id = String(req.params.id || '');
  scheduledTasks = scheduledTasks.filter(t => t.id !== id);
  if (db) db.collection('scheduled_tasks').deleteOne({ id }).catch(() => {});
  res.json({ ok: true });
});

// ── Mots interdits (auto-moderation) ──
app.get('/admin/banned-words', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  res.json({ ok: true, words: bannedWords });
});
app.post('/admin/banned-words', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const w = String(req.body?.word || '').trim().toLowerCase().slice(0, 40);
  if (!w) return res.status(400).json({ error: 'Mot manquant.' });
  if (!bannedWords.includes(w)) { bannedWords.push(w); saveConfig('banned_words', bannedWords); }
  res.json({ ok: true, words: bannedWords });
});
app.delete('/admin/banned-words/:word', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const w = String(req.params.word || '').toLowerCase();
  bannedWords = bannedWords.filter(x => x !== w);
  saveConfig('banned_words', bannedWords);
  res.json({ ok: true, words: bannedWords });
});

// ── Prix des livres (override admin) ──
app.get('/admin/book-prices', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const books = Object.values(LIBERO_BOOKS).map(b => ({
    id: b.id, titre: b.titre,
    packs: b.packs.map(p => ({ id: p.id, from: p.from, to: p.to, basePrice: p.price, price: bookPackPrice(b.id, p) })),
  }));
  res.json({ ok: true, books });
});
app.post('/admin/book-price', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const bookId = String(req.body?.bookId || '');
  const packId = String(req.body?.packId || '');
  const book = LIBERO_BOOKS[bookId];
  if (!book || !book.packs.some(p => p.id === packId)) return res.status(404).json({ error: 'Pack introuvable.' });
  const key = `${bookId}:${packId}`;
  if (req.body?.price === null || req.body?.price === '') {
    delete bookPriceOverrides[key]; // retour au prix de base
  } else {
    const price = Math.max(0, Math.min(100_000, Math.floor(Number(req.body?.price) || 0)));
    bookPriceOverrides[key] = price;
  }
  saveConfig('book_price_overrides', bookPriceOverrides);
  adminAudit('book-price', { bookId, packId, price: bookPriceOverrides[key] ?? 'base' });
  res.json({ ok: true, price: bookPriceOverrides[key] ?? book.packs.find(p => p.id === packId).price });
});

// ── Destinataires des alertes admin (par ref joueur) ──
app.post('/admin/alert-recipient', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const ref = String(req.body?.ref || '');
  let pid = null;
  for (const id of _allPlayerIds()) { if (_playerRef(id) === ref) { pid = id; break; } }
  if (!pid) return res.status(404).json({ error: 'Joueur introuvable.' });
  const on = req.body?.on !== false;
  if (on && !adminAlertSubs.includes(pid)) adminAlertSubs.push(pid);
  if (!on) adminAlertSubs = adminAlertSubs.filter(x => x !== pid);
  saveConfig('admin_alert_subs', adminAlertSubs);
  res.json({ ok: true, on, count: adminAlertSubs.length, subscribed: pushSubs.has(pid) });
});

// ── Mode maintenance ──
app.post('/admin/maintenance', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  maintenance = {
    on: !!req.body?.on,
    message:   String(req.body?.message   || '').trim().slice(0, 300),
    messageEn: String(req.body?.messageEn || '').trim().slice(0, 300),
  };
  saveConfig('maintenance', maintenance);
  adminAudit('maintenance', { on: maintenance.on });
  res.json({ ok: true, maintenance });
});

// ── Sauvegarde JSON en un clic ──
app.get('/admin/export/backup', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const dump = {
    at: new Date().toISOString(),
    libs: [...libs.entries()].map(([id, e]) => ({ id, ...e })),
    leaderboard: [...leaderboard.entries()],
    triviaLeaderboard: [...triviaLeaderboard.entries()],
    snakeLeaderboard: [...snakeLeaderboard.entries()],
    luffyLeaderboard: [...luffyLeaderboard.entries()],
    announcements, suggestions,
    tournament, gameCounters,
    config: { bannedWords, bookPriceOverrides, maintenance, adminAlertSubs: adminAlertSubs.length },
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=libero-backup-${Date.now()}.json`);
  res.send(JSON.stringify(dump, null, 2));
});

app.post('/admin/announce', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const text   = String(req.body?.text || '').trim().slice(0, 300);
  const textEn = String(req.body?.textEn || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Texte manquant.' });
  // Avec un id : modification d'une annonce existante (texte FR/EN), date conservée.
  if (req.body?.id) {
    const ex = announcements.find(x => x._id === String(req.body.id));
    if (!ex) return res.status(404).json({ error: 'Annonce introuvable.' });
    ex.text = text; ex.textEn = textEn;
    if (db) db.collection('announcements').updateOne({ _id: ex._id }, { $set: { text, textEn } }).catch(() => {});
    io.emit('announcements-update', { announcements: announcements.slice(0, 5).map(x => ({ id: x._id, text: x.text, textEn: x.textEn || '', at: x.at })) });
    return res.json({ ok: true, id: ex._id });
  }
  const a = publishAnnouncement(text, textEn);
  res.json({ ok: true, id: a._id });
});
app.delete('/admin/announce/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = announcements.findIndex(a => a._id === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Annonce introuvable.' });
  announcements.splice(idx, 1);
  if (db) db.collection('announcements').deleteOne({ _id: String(req.params.id) }).catch(() => {});
  io.emit('announcements-update', { announcements: announcements.slice(0, 5).map(x => ({ id: x._id, text: x.text, textEn: x.textEn || '', at: x.at })) });
  res.json({ ok: true });
});

// Admin : cadeau direct a un joueur (Libs et/ou cosmetique) depuis sa fiche.
app.post('/admin/gift', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { ref, libs: libsAmount, cosmeticId } = req.body || {};
  let pid = null;
  for (const id of _allPlayerIds()) { if (_playerRef(id) === String(ref || '')) { pid = id; break; } }
  if (pid === null) return res.status(404).json({ error: 'Joueur introuvable.' });
  const entry = getLibsEntry(pid);
  const amount = Math.max(0, Math.min(10_000, Math.floor(Number(libsAmount) || 0)));
  let grantedCosmetic = null;
  if (cosmeticId) {
    const cosm = COSMETICS.find(c => c.id === String(cosmeticId) && !c.honorary);
    if (!cosm) return res.status(400).json({ error: 'Cosmétique inconnu : ' + cosmeticId });
    if (!entry.ownedCosmetics.includes(cosm.id)) { entry.ownedCosmetics.push(cosm.id); grantedCosmetic = cosm.id; }
  }
  if (amount > 0) entry.balance = Math.min(MAX_BALANCE, entry.balance + amount);
  libs.set(pid, entry);
  dbUpsertLibs(pid, entry);
  _emitToPlayer(pid, 'libs-update', { balance: entry.balance, delta: amount || undefined, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt });
  // Message de cadeau (avec bouton OK) chez le destinataire, meme hors ligne.
  deliverGift(pid, { fromName: 'Libero', libsAmount: amount, cosmeticId: grantedCosmetic });
  adminAudit('gift', { ref: String(ref || ''), libs: amount, cosmeticId: grantedCosmetic });
  res.json({ ok: true, name: entry.name || 'Anonyme', balance: entry.balance, grantedCosmetic });
});

// Admin : exports CSV (joueurs + achats).
function _csvEscape(v) { const x = String(v ?? ''); return /[",;\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
app.get('/admin/export/players', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const rows = [['pseudo','victoires','defaites','nuls','points_quiz','quiz_joues','record_snake','record_run','libs','cosmetiques','serie','parrainages']];
  for (const p of _aggregatePlayers()) {
    const e = [...libs.values()].find(x => x.name === p.name) || {};
    rows.push([p.name, p.wins, p.losses, p.draws, p.points, p.quizzes, p.snakeHs, p.luffyHs, p.libs, (e.ownedCosmetics || []).length, e.streak?.count || 0, e.referrals || 0]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=joueurs.csv');
  res.send('\uFEFF' + rows.map(r => r.map(_csvEscape).join(';')).join('\n'));
});
app.get('/admin/export/purchases', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const rows = [['pseudo','pack','libs','statut','date']];
  for (const p of [...libsPurchases.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    rows.push([(libs.get(p.playerId)?.name) || 'Anonyme', p.packId || '', p.libsAmount || 0, p.credited ? 'completed' : (p.status || 'pending'), p.createdAt ? new Date(p.createdAt).toISOString() : '']);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=achats.csv');
  res.send('\uFEFF' + rows.map(r => r.map(_csvEscape).join(';')).join('\n'));
});

// Admin : flague / deflague une question posee au chatbot (suivi des questions
// interessantes ou problematiques). Persiste dans bot_logs.
app.post('/admin/botlog-flag', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { id, flagged } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Id manquant.' });
  const flag = flagged !== false;
  const mem = botLogs.find(e => (e.id || String(e.at)) === String(id));
  if (mem) mem.flagged = flag;
  if (db) {
    db.collection('bot_logs')
      .updateOne({ $or: [{ id: String(id) }, { at: Number(id) || -1 }] }, { $set: { flagged: flag } })
      .catch(() => {});
  }
  res.json({ ok: true, flagged: flag });
});

// Admin : marque un signalement de bug comme traite (ou non).
app.post('/admin/bug-resolve', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { id, resolved } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Id manquant.' });
  const done = resolved !== false;
  const mem = bugReports.find(b => String(b.id) === String(id));
  if (mem) mem.resolved = done;
  if (db) db.collection('bug_reports').updateOne({ id: String(id) }, { $set: { resolved: done } }).catch(() => {});
  res.json({ ok: true, resolved: done });
});

// Admin : supprime un signalement de bug.
app.delete('/admin/bug-report/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const id = String(req.params.id || '');
  const idx = bugReports.findIndex(b => String(b.id) === id);
  if (idx !== -1) bugReports.splice(idx, 1);
  if (db) db.collection('bug_reports').deleteOne({ id }).catch(() => {});
  res.json({ ok: true });
});

// Admin : vide le journal d'erreurs serveur (memoire + Mongo).
app.delete('/admin/server-errors', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  serverErrors.length = 0;
  if (db) db.collection('server_errors').deleteMany({}).catch(() => {});
  res.json({ ok: true });
});

app.post('/admin/comment-approve', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { id, approved } = req.body || {};
  const comment = comments.find(c => c._id && c._id.toString() === String(id));
  if (!comment) return res.status(404).json({ error: 'Commentaire introuvable.' });
  comment.approved = approved !== false; // true par défaut, false pour masquer
  dbUpdateCommentApproved(comment._id, comment.approved);
  io.emit('news-comments-update', _newsCommentsPayload());
  res.json({ ok: true, approved: comment.approved });
});

// Admin : programme (ou annule) la suppression automatique d'un commentaire.
// delayMs > 0 : supprimé dans ce délai. delayMs falsy : annule la minuterie.
// La minuterie est purement admin : elle n'apparaît jamais sur le site public.
app.post('/admin/comment-schedule', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { id, delayMs } = req.body || {};
  const comment = comments.find(c => c._id && c._id.toString() === String(id));
  if (!comment) return res.status(404).json({ error: 'Commentaire introuvable.' });
  const ms = parseInt(delayMs, 10);
  comment.autoDeleteAt = (ms && ms > 0) ? Date.now() + Math.min(ms, 90 * DAY_MS) : null;
  dbUpdateCommentAutoDelete(comment._id, comment.autoDeleteAt);
  res.json({ ok: true, autoDeleteAt: comment.autoDeleteAt });
});

// Balayage périodique : supprime les commentaires dont la minuterie a expiré.
function _sweepExpiredComments() {
  const now = Date.now();
  const expired = comments.filter(c => c.autoDeleteAt && c.autoDeleteAt <= now);
  if (!expired.length) return;
  const ids = expired.map(c => c._id);
  for (const c of expired) {
    const idx = comments.indexOf(c);
    if (idx !== -1) comments.splice(idx, 1);
    commentLikeMap.delete(c._id?.toString());
  }
  dbDeleteComments(ids);
  io.emit('news-comments-update', _newsCommentsPayload());
  console.log(`[⏳] ${expired.length} commentaire(s) supprimé(s) par minuterie.`);
}
setInterval(_sweepExpiredComments, 30_000);

// Admin : supprime un commentaire par _id (/admin/comment/:id) ou tous ceux
// d'un pseudo (/admin/comment?pseudo=sassy). Sert à la modération.
function _adminDeleteComment(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const wantPseudo = typeof req.query.pseudo === 'string' ? req.query.pseudo.trim().toLowerCase() : '';
  let removed = [];
  if (req.params.id) {
    const idx = comments.findIndex(c => c._id && c._id.toString() === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire introuvable.' });
    removed = comments.splice(idx, 1);
  } else if (wantPseudo) {
    const ids = new Set();
    for (let i = comments.length - 1; i >= 0; i--) {
      if ((comments[i].pseudo || '').trim().toLowerCase() === wantPseudo) {
        ids.add(comments[i]._id);
        removed.push(comments.splice(i, 1)[0]);
      }
    }
    if (!removed.length) return res.status(404).json({ error: 'Aucun commentaire pour ce pseudo.' });
  } else {
    return res.status(400).json({ error: 'Fournir un id (/admin/comment/:id) ou ?pseudo=...' });
  }
  const ids = removed.map(c => c._id);
  for (const id of ids) commentLikeMap.delete(id.toString());
  dbDeleteComments(ids);
  io.emit('news-comments-update', _newsCommentsPayload());
  console.log(`[🗑️] ${removed.length} commentaire(s) supprimé(s) par admin${wantPseudo ? ` (pseudo « ${wantPseudo} »)` : ''}.`);
  res.json({ ok: true, deleted: removed.length });
}
app.delete('/admin/comment/:id', _adminDeleteComment);
app.delete('/admin/comment',     _adminDeleteComment);

// Consultation des achats de Libs (audit) — jamais purgée par /admin/reset.
app.get('/admin/libs-purchases', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  res.json([...libsPurchases.values()].sort((a, b) => b.createdAt - a.createdAt));
});

// ── Feed vidéos (façon TikTok) ──────────────────────────────────────────────
// MongoDB ne stocke que les URLs + métadonnées : les fichiers vidéo sont hébergés
// en externe (Bunny.net / Cloudinary / …).
// Vue publique d'une vidéo (jamais l'identifiant secret du joueur qui a soumis) :
// on expose les compteurs sociaux + si le joueur courant a liké.
function _publicVideo(v, playerId) {
  return {
    id: v._id, url: v.url, titre: v.titre, auteur: v.auteur || '', description: v.description || '',
    ordre: v.ordre,
    likeCount: (v.likes || []).length,
    liked: !!(playerId && (v.likes || []).includes(playerId)),
    views: v.views || 0, shares: v.shares || 0,
    commentCount: (v.comments || []).length,
  };
}

function _findVideo(id) { return feedVideos.find(v => v._id === id) || null; }

// Assainit un texte libre (commentaire vidéo) : garde le texte mais neutralise
// tout HTML pour éviter l'injection au rendu.
function sanitizeText(s, max = 400) {
  return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, max);
}

// Publie une vidéo active (retire les soumissions en attente) triée par ordre.
function _activeFeedVideos(playerId) {
  return feedVideos
    .filter(v => v.actif && !v.pending)
    .sort((a, b) => (a.ordre - b.ordre) || (a.createdAt - b.createdAt))
    .map(v => _publicVideo(v, playerId));
}

// Public : liste des vidéos actives, triées par ordre (playerId optionnel pour l'état "liké").
app.get('/api/feed-videos', (req, res) => res.json(_activeFeedVideos(safePlayerId(req.query.playerId))));

// Public : like / unlike (bascule) d'une vidéo.
app.post('/api/feed-video/:id/like', (req, res) => {
  const pid = safePlayerId((req.body || {}).playerId);
  if (!pid) return res.status(400).json({ error: 'Joueur requis.' });
  const v = _findVideo(req.params.id);
  if (!v || !v.actif || v.pending) return res.status(404).json({ error: 'Vidéo introuvable.' });
  v.likes = v.likes || [];
  const i = v.likes.indexOf(pid);
  if (i === -1) v.likes.push(pid); else v.likes.splice(i, 1);
  dbUpdateFeedVideo(v._id, { likes: v.likes });
  res.json({ ok: true, likeCount: v.likes.length, liked: i === -1 });
});

// Public : incrémente le compteur de vues (best-effort, appelé une fois par lecture côté client).
app.post('/api/feed-video/:id/view', (req, res) => {
  const v = _findVideo(req.params.id);
  if (!v || !v.actif || v.pending) return res.status(404).json({ error: 'Vidéo introuvable.' });
  v.views = (v.views || 0) + 1;
  dbUpdateFeedVideo(v._id, { views: v.views });
  res.json({ ok: true, views: v.views });
});

// Public : incrémente le compteur de partages.
app.post('/api/feed-video/:id/share', (req, res) => {
  const v = _findVideo(req.params.id);
  if (!v || !v.actif || v.pending) return res.status(404).json({ error: 'Vidéo introuvable.' });
  v.shares = (v.shares || 0) + 1;
  dbUpdateFeedVideo(v._id, { shares: v.shares });
  res.json({ ok: true, shares: v.shares });
});

// Public : commentaires d'une vidéo (les plus récents en premier).
app.get('/api/feed-video/:id/comments', (req, res) => {
  const v = _findVideo(req.params.id);
  if (!v) return res.status(404).json({ error: 'Vidéo introuvable.' });
  res.json((v.comments || []).slice().sort((a, b) => b.at - a.at)
    .map(c => ({ id: c.id, name: c.name, text: c.text, at: c.at })));
});

// Public : ajoute un commentaire à une vidéo (visible immédiatement ; l'admin peut supprimer).
app.post('/api/feed-video/:id/comment', (req, res) => {
  const { playerId, name, text } = req.body || {};
  const v = _findVideo(req.params.id);
  if (!v || !v.actif || v.pending) return res.status(404).json({ error: 'Vidéo introuvable.' });
  const clean = sanitizeText(text, 400);
  if (clean.length < 1) return res.status(400).json({ error: 'Message vide.' });
  if (containsBanned(clean)) return res.status(400).json({ error: 'Ton message contient un terme interdit.' });
  // Limite : 10 commentaires vidéo / IP / 10 min.
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const key = 'vid:' + ip;
  const times = (commentRateMap.get(key) || []).filter(t => now - t < 600_000);
  if (times.length >= 10) return res.status(429).json({ error: 'Trop de commentaires, réessaie plus tard.' });
  times.push(now); commentRateMap.set(key, times);
  const comment = { id: 'vc_' + crypto.randomUUID(), playerId: safePlayerId(playerId) || null, name: sanitizeName(name, 'Anonyme'), text: clean, at: now };
  v.comments = v.comments || [];
  v.comments.push(comment);
  dbUpdateFeedVideo(v._id, { comments: v.comments });
  res.json({ ok: true, comment: { id: comment.id, name: comment.name, text: comment.text, at: comment.at }, commentCount: v.comments.length });
});

// Public : un joueur propose une vidéo (lien) ; elle passe en attente de modération.
app.post('/api/feed-video/submit', (req, res) => {
  const { playerId, name, url, titre, description } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: 'URL invalide (http/https requis).' });
  }
  const pid = safePlayerId(playerId);
  // Limite : 3 propositions / IP / jour.
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const key = 'sub:' + ip;
  const times = (commentRateMap.get(key) || []).filter(t => now - t < 86_400_000);
  if (times.length >= 3) return res.status(429).json({ error: 'Limite de propositions atteinte (3/jour).' });
  times.push(now); commentRateMap.set(key, times);
  const video = {
    _id:       'fv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    url:       url.trim(),
    titre:     sanitizeText(titre, 200),
    auteur:    sanitizeName(name, 'Anonyme'),
    description: sanitizeText(description, 400),
    ordre:     0, actif: false, pending: true,
    submittedBy: pid, submittedName: sanitizeName(name, 'Anonyme'),
    likes: [], views: 0, shares: 0, comments: [],
    createdAt: now,
  };
  feedVideos.push(video);
  dbInsertFeedVideo(video);
  console.log(`[🎬📥] Proposition vidéo : ${video.titre || '(sans titre)'} par ${video.submittedName} → ${video.url}`);
  res.json({ ok: true });
});

// Admin : liste TOUTES les vidéos (actives, masquées, en attente).
app.get('/admin/feed-videos', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const all = feedVideos.slice().sort((a, b) => {
    if (!!a.pending !== !!b.pending) return a.pending ? -1 : 1; // en attente en tête
    return (a.ordre - b.ordre) || (a.createdAt - b.createdAt);
  }).map(v => ({
    id: v._id, url: v.url, titre: v.titre, auteur: v.auteur || '', description: v.description || '',
    ordre: v.ordre, actif: !!v.actif, pending: !!v.pending, submittedName: v.submittedName || '',
    likeCount: (v.likes || []).length, views: v.views || 0, shares: v.shares || 0,
    comments: (v.comments || []).map(c => ({ id: c.id, name: c.name, text: c.text, at: c.at })),
    createdAt: v.createdAt,
  }));
  res.json(all);
});

// Admin : ajoute une vidéo (url + titre + auteur + description).
app.post('/admin/feed-video', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { url, titre, auteur, description, ordre, actif } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: 'URL invalide (http/https requis).' });
  }
  const maxOrdre = feedVideos.reduce((m, v) => Math.max(m, v.ordre || 0), 0);
  const video = {
    _id:       'fv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    url:       url.trim(),
    titre:     sanitizeText(titre, 200),
    auteur:    sanitizeText(auteur, 40),
    description: sanitizeText(description, 400),
    ordre:     Number.isFinite(+ordre) ? +ordre : maxOrdre + 1,
    actif:     actif !== false, pending: false, submittedBy: null, submittedName: '',
    likes: [], views: 0, shares: 0, comments: [],
    createdAt: Date.now(),
  };
  feedVideos.push(video);
  dbInsertFeedVideo(video);
  adminAudit('feed-video-add', { id: video._id, titre: video.titre, url: video.url });
  console.log(`[🎬] Vidéo feed ajoutée : ${video.titre || '(sans titre)'} → ${video.url}`);
  res.json({ ok: true, video: { id: video._id, url: video.url, titre: video.titre, ordre: video.ordre } });
});

// Admin : modifie une vidéo (titre/auteur/description/ordre/actif) ou approuve une proposition.
app.patch('/admin/feed-video/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const v = _findVideo(req.params.id);
  if (!v) return res.status(404).json({ error: 'Vidéo introuvable.' });
  const b = req.body || {};
  const fields = {};
  if (typeof b.titre === 'string')       fields.titre = v.titre = sanitizeText(b.titre, 200);
  if (typeof b.auteur === 'string')      fields.auteur = v.auteur = sanitizeText(b.auteur, 40);
  if (typeof b.description === 'string') fields.description = v.description = sanitizeText(b.description, 400);
  if (Number.isFinite(+b.ordre))         fields.ordre = v.ordre = +b.ordre;
  if (typeof b.actif === 'boolean')      fields.actif = v.actif = b.actif;
  if (b.approve === true) { // publier une proposition
    v.pending = false; v.actif = true;
    const maxOrdre = feedVideos.reduce((m, x) => Math.max(m, x.ordre || 0), 0);
    if (!v.ordre) v.ordre = maxOrdre + 1;
    fields.pending = false; fields.actif = true; fields.ordre = v.ordre;
  }
  dbUpdateFeedVideo(v._id, fields);
  adminAudit('feed-video-edit', { id: v._id, fields });
  res.json({ ok: true, video: { id: v._id, ordre: v.ordre, actif: v.actif, pending: v.pending } });
});

// Admin : supprime une vidéo.
app.delete('/admin/feed-video/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = feedVideos.findIndex(v => v._id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Vidéo introuvable.' });
  const [removed] = feedVideos.splice(idx, 1);
  dbDeleteFeedVideo(removed._id);
  adminAudit('feed-video-delete', { id: removed._id, titre: removed.titre });
  console.log(`[🗑️] Vidéo feed supprimée : ${removed.titre || '(sans titre)'}`);
  res.json({ ok: true });
});

// Admin : supprime un commentaire d'une vidéo.
app.delete('/admin/feed-video/:id/comment/:cid', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const v = _findVideo(req.params.id);
  if (!v) return res.status(404).json({ error: 'Vidéo introuvable.' });
  v.comments = (v.comments || []).filter(c => c.id !== req.params.cid);
  dbUpdateFeedVideo(v._id, { comments: v.comments });
  res.json({ ok: true, commentCount: v.comments.length });
});

// ── Idées & suggestions (tableau communautaire type Steam) ──────────────────
const SUGGESTION_STATUSES = ['open', 'planned', 'done', 'rejected'];
function _findSuggestion(id) { return suggestions.find(s => s._id === id) || null; }

// Vue publique : compteurs + le vote du joueur courant (jamais son id secret).
function _publicSuggestion(s, playerId) {
  const up = (s.up || []).length, down = (s.down || []).length;
  return {
    id: s._id, title: s.title, description: s.description, authorName: s.authorName || 'Anonyme',
    up, down, score: up - down,
    myVote: playerId && (s.up || []).includes(playerId) ? 1 : (playerId && (s.down || []).includes(playerId) ? -1 : 0),
    mine: !!(playerId && s.authorId === playerId),
    status: s.status || 'open', pinned: !!s.pinned, reply: s.reply || '', createdAt: s.createdAt,
  };
}
// Tri : epinglees d'abord, puis meilleur score, puis plus recentes.
function _sortSuggestions(a, b) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  const sa = (a.up || []).length - (a.down || []).length, sb = (b.up || []).length - (b.down || []).length;
  return (sb - sa) || (b.createdAt - a.createdAt);
}

// Public : liste des suggestions (playerId optionnel pour l'etat de vote).
app.get('/api/suggestions', (req, res) => {
  const pid = safePlayerId(req.query.playerId);
  res.json(suggestions.slice().sort(_sortSuggestions).map(s => _publicSuggestion(s, pid)));
});

// Public : poste une nouvelle suggestion (pseudo requis).
app.post('/api/suggestions', (req, res) => {
  const { playerId, name, title, description } = req.body || {};
  const pid = safePlayerId(playerId);
  const cleanTitle = sanitizeText(title, 120);
  const cleanDesc  = sanitizeText(description, 800);
  const cleanName  = sanitizeName(name, '');
  if (!pid) return res.status(400).json({ error: 'Joueur requis.' });
  if (!cleanName || cleanName === 'Anonyme') return res.status(400).json({ error: 'Pseudo requis.' });
  if (cleanTitle.length < 4) return res.status(400).json({ error: 'Titre trop court.' });
  if (containsBanned(cleanTitle) || containsBanned(cleanDesc)) return res.status(400).json({ error: 'Ta suggestion contient un terme interdit.' });
  // Limite : 5 suggestions / IP / jour.
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const key = 'sugg:' + ip;
  const times = (commentRateMap.get(key) || []).filter(t => now - t < 86_400_000);
  if (times.length >= 5) return res.status(429).json({ error: 'Limite atteinte (5 suggestions/jour).' });
  times.push(now); commentRateMap.set(key, times);
  const s = {
    _id: 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: cleanTitle, description: cleanDesc,
    authorId: pid, authorName: cleanName,
    up: [pid], down: [], status: 'open', pinned: false, createdAt: now, // l'auteur vote pour d'office
  };
  suggestions.push(s);
  dbInsertSuggestion(s);
  console.log(`[💡] Suggestion de ${cleanName} : ${cleanTitle}`);
  res.json({ ok: true, suggestion: _publicSuggestion(s, pid) });
});

// Public : vote (dir = 1 pour, -1 contre, 0 pour retirer son vote) ; un seul vote par joueur.
app.post('/api/suggestion/:id/vote', (req, res) => {
  const { playerId, dir } = req.body || {};
  const pid = safePlayerId(playerId);
  if (!pid) return res.status(400).json({ error: 'Joueur requis.' });
  const s = _findSuggestion(req.params.id);
  if (!s) return res.status(404).json({ error: 'Suggestion introuvable.' });
  s.up = (s.up || []).filter(x => x !== pid);
  s.down = (s.down || []).filter(x => x !== pid);
  if (+dir === 1) s.up.push(pid);
  else if (+dir === -1) s.down.push(pid);
  dbUpdateSuggestion(s._id, { up: s.up, down: s.down });
  res.json({ ok: true, ...(_publicSuggestion(s, pid)) });
});

// Public : l'auteur supprime sa propre suggestion.
app.delete('/api/suggestion/:id', (req, res) => {
  const pid = safePlayerId((req.body || {}).playerId);
  const idx = suggestions.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Suggestion introuvable.' });
  if (!pid || suggestions[idx].authorId !== pid) return res.status(403).json({ error: 'Non autorise.' });
  const [removed] = suggestions.splice(idx, 1);
  dbDeleteSuggestion(removed._id);
  res.json({ ok: true });
});

// Admin : liste complete (tout statut).
app.get('/admin/suggestions', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  res.json(suggestions.slice().sort(_sortSuggestions).map(s => {
    const up = (s.up || []).length, down = (s.down || []).length;
    return { id: s._id, title: s.title, description: s.description, authorName: s.authorName || 'Anonyme',
      up, down, score: up - down, status: s.status || 'open', pinned: !!s.pinned, reply: s.reply || '', createdAt: s.createdAt };
  }));
});

// Admin : change le statut / epingle une suggestion.
app.patch('/admin/suggestion/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const s = _findSuggestion(req.params.id);
  if (!s) return res.status(404).json({ error: 'Suggestion introuvable.' });
  const b = req.body || {};
  const fields = {};
  if (typeof b.status === 'string' && SUGGESTION_STATUSES.includes(b.status)) fields.status = s.status = b.status;
  if (typeof b.pinned === 'boolean') fields.pinned = s.pinned = b.pinned;
  if (typeof b.reply === 'string') fields.reply = s.reply = sanitizeText(b.reply, 300);
  dbUpdateSuggestion(s._id, fields);
  adminAudit('suggestion-edit', { id: s._id, fields });
  res.json({ ok: true, status: s.status, pinned: s.pinned });
});

// Admin : supprime une suggestion.
app.delete('/admin/suggestion/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = suggestions.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Suggestion introuvable.' });
  const [removed] = suggestions.splice(idx, 1);
  dbDeleteSuggestion(removed._id);
  adminAudit('suggestion-delete', { id: removed._id, title: removed.title });
  res.json({ ok: true });
});

// ── Compte optionnel (pseudo + mot de passe) ────────────────────────────────
// Lie un pseudo + mot de passe a un playerId (la progression). Permet de se
// reconnecter sur un autre appareil. Le code de recuperation reste en secours.
// Hachage avec le module crypto natif (scrypt), aucune dependance externe.
function _hashPw(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function dbUpsertAccount(key, acc) {
  if (!db) return;
  db.collection('accounts').updateOne({ _id: key }, { $set: acc }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde compte:', e));
}
// Anti brute-force : limite les tentatives de login par IP.
function _accountRateLimited(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const key = 'acct:' + ip;
  const times = (commentRateMap.get(key) || []).filter(t => now - t < 600_000);
  if (times.length >= 12) return true;
  times.push(now); commentRateMap.set(key, times);
  return false;
}

// Creer un compte : lie le pseudo+mdp au playerId courant (progression actuelle).
app.post('/api/account/register', (req, res) => {
  const { pseudo, password, playerId } = req.body || {};
  const clean = sanitizeName(pseudo, '');
  const pid = safePlayerId(playerId);
  if (!clean || clean === 'Anonyme') return res.status(400).json({ error: 'Pseudo invalide.' });
  if (!password || String(password).length < 4) return res.status(400).json({ error: 'Mot de passe trop court (4 min).' });
  if (!pid) return res.status(400).json({ error: 'Joueur requis.' });
  const key = clean.toLowerCase();
  if (accounts.has(key)) return res.status(409).json({ error: 'Ce pseudo a deja un compte.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const acc = { pseudo: clean, salt, hash: _hashPw(password, salt), playerId: pid, createdAt: Date.now() };
  accounts.set(key, acc);
  dbUpsertAccount(key, acc);
  console.log(`[🔑] Compte cree : ${clean}`);
  res.json({ ok: true, pseudo: clean });
});

// Se connecter : renvoie le playerId lie (le client le restaure + recharge).
app.post('/api/account/login', (req, res) => {
  if (_accountRateLimited(req)) return res.status(429).json({ error: 'Trop de tentatives, reessaie plus tard.' });
  const { pseudo, password } = req.body || {};
  const clean = sanitizeName(pseudo, '');
  const acc = accounts.get((clean || '').toLowerCase());
  if (!acc) return res.status(404).json({ error: 'Compte introuvable.' });
  const h = _hashPw(password || '', acc.salt);
  let ok = false;
  try { ok = h.length === acc.hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(acc.hash)); } catch { ok = false; }
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  res.json({ ok: true, playerId: acc.playerId, pseudo: acc.pseudo });
});

// Changer son mot de passe : exige l'ancien (preuve d'identite), pose le nouveau.
app.post('/api/account/change-password', (req, res) => {
  if (_accountRateLimited(req)) return res.status(429).json({ error: 'Trop de tentatives, reessaie plus tard.' });
  const { pseudo, oldPassword, newPassword } = req.body || {};
  const clean = sanitizeName(pseudo, '');
  const acc = accounts.get((clean || '').toLowerCase());
  if (!acc) return res.status(404).json({ error: 'Compte introuvable.' });
  const h = _hashPw(oldPassword || '', acc.salt);
  let ok = false;
  try { ok = h.length === acc.hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(acc.hash)); } catch { ok = false; }
  if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Nouveau mot de passe trop court (4 min).' });
  const salt = crypto.randomBytes(16).toString('hex');
  acc.salt = salt;
  acc.hash = _hashPw(newPassword, salt);
  const key = (clean || '').toLowerCase();
  accounts.set(key, acc);
  dbUpsertAccount(key, acc);
  console.log(`[🔑] Mot de passe change : ${acc.pseudo}`);
  res.json({ ok: true });
});

// SAV : liste des comptes (pseudo seul, pas de hash) pour le dashboard.
app.get('/admin/accounts', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const list = [...accounts.values()]
    .map(a => ({ pseudo: a.pseudo, ref: _playerRef(a.playerId), createdAt: a.createdAt || 0 }))
    .sort((x, y) => (y.createdAt - x.createdAt));
  res.json({ accounts: list });
});

// SAV : reinitialisation admin du mot de passe (aucun e-mail sur les comptes,
// donc seul le proprietaire peut depanner un joueur qui a oublie son mdp).
app.post('/admin/account-reset', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { pseudo, newPassword } = req.body || {};
  const clean = sanitizeName(pseudo, '');
  const key = (clean || '').toLowerCase();
  const acc = accounts.get(key);
  if (!acc) return res.status(404).json({ error: 'Compte introuvable.' });
  if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Mot de passe trop court (4 min).' });
  const salt = crypto.randomBytes(16).toString('hex');
  acc.salt = salt;
  acc.hash = _hashPw(newPassword, salt);
  accounts.set(key, acc);
  dbUpsertAccount(key, acc);
  adminAudit('account-reset', { pseudo: acc.pseudo });
  console.log(`[🔑] Mot de passe reinitialise (admin) : ${acc.pseudo}`);
  res.json({ ok: true, pseudo: acc.pseudo });
});

// ── Lecture (catalogue de livres) ───────────────────────────────────────────
// Même modèle que le feed vidéos : MongoDB ne stocke que les métadonnées et
// URLs, les fichiers (couvertures, PDF) sont hébergés en externe.
const _isHttpUrl = s => /^https?:\/\//i.test(s);

function _activeFeedBooks() {
  return feedBooks
    .filter(b => b.actif)
    .sort((a, b) => (a.ordre - b.ordre) || (a.createdAt - b.createdAt))
    .map(b => ({ id: b._id, titre: b.titre, auteur: b.auteur, categorie: b.categorie,
      couverture: b.couverture, url: b.url, description: b.description, ordre: b.ordre, readers: bookReaderCount(b._id) }));
}

// Public : liste des livres actifs, triés par ordre.
app.get('/api/feed-books', (_req, res) => res.json(_activeFeedBooks()));

// ── Livres exclusifs : métadonnées + accès aux chapitres ────────────────────
// Renvoie la fiche d'un livre et l'état de déblocage du joueur (jamais le texte).
function bookFiche(book, entry) {
  const bookChs  = bookChapters.get(book.id) || new Map();
  const chapters = [];
  // Un tome peut ne pas commencer au chapitre 1 (le tome 2 reprend au 13).
  const first = book.firstChapter || 1;
  for (let n = first; n < first + book.totalChapters; n++) {
    const ch   = bookChs.get(n);
    const pack = bookPackFor(book, n);
    chapters.push({
      num: n,
      titre: ch ? ch.titre : `Chapitre ${n}`,
      titreEn: bookChapterTitleEn(book, n) || `Chapter ${n}`,
      disponible: !!ch,                      // écrit et publié ?
      gratuit: !pack && !book.accessVia,
      unlocked: canReadChapter(book, entry, n),
      pack: pack ? pack.id : null,
      hasEn: !!(ch && ch.contentEn),         // traduction anglaise disponible ?
    });
  }
  // Condition d'accès inter-livres (fiche : le front explique comment débloquer).
  const accessVia = book.accessVia ? {
    bookId: book.accessVia.bookId,
    titre:  LIBERO_BOOKS[book.accessVia.bookId]?.titre || book.accessVia.bookId,
    owned:  !!entry && Array.isArray(entry.ownedBooks) &&
            entry.ownedBooks.includes(`${book.accessVia.bookId}:${book.accessVia.packId}`),
  } : null;
  return {
    accessVia,
    id: book.id, titre: book.titre, auteur: book.auteur,
    categorie: book.categorie, categorieEn: book.categorieEn || book.categorie,
    description: book.description, descriptionEn: book.descriptionEn || book.description,
    copyright: book.copyright, copyrightEn: book.copyrightEn || book.copyright,
    hasCover: !!book.hasCover, readers: bookReaderCount(book.id),
    packs: book.packs.map(p => ({
      id: p.id, price: bookPackPrice(book.id, p), from: p.from, to: p.to, requires: p.requires,
      owned: !!entry && entry.ownedBooks.includes(`${book.id}:${p.id}`),
    })),
    chapters,
  };
}

// Public : toutes les fiches des livres exclusifs (pour le catalogue).
app.get('/api/books', (req, res) => {
  const id    = safePlayerId(req.query.playerId);
  const entry = id ? getLibsEntry(id) : null;
  res.json(Object.values(LIBERO_BOOKS).map(book => bookFiche(book, entry)));
});

app.get('/api/book/:bookId', (req, res) => {
  const book = LIBERO_BOOKS[req.params.bookId];
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  const id    = safePlayerId(req.query.playerId);
  const entry = id ? getLibsEntry(id) : null;
  res.json(bookFiche(book, entry));
});

// Couverture du livre (image publique — c'est la vitrine, pas le contenu payant).
app.get('/api/book/:bookId/couverture', (req, res) => {
  const book = LIBERO_BOOKS[req.params.bookId];
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  const file = path.join(__dirname, 'books', book.dir || book.id, 'couverture.jpeg');
  res.sendFile(file, { maxAge: '1d' }, err => { if (err && !res.headersSent) res.status(404).json({ error: 'Couverture introuvable.' }); });
});

// Contenu d'un chapitre — contrôle d'accès côté serveur.
app.get('/api/book/:bookId/chapitre/:num', (req, res) => {
  const book = LIBERO_BOOKS[req.params.bookId];
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  const num = parseInt(req.params.num, 10);
  const ch  = (bookChapters.get(book.id) || new Map()).get(num);
  if (!ch) return res.status(404).json({ error: 'Chapitre indisponible.' });
  const id    = safePlayerId(req.query.playerId);
  const entry = id ? getLibsEntry(id) : null;
  if (!canReadChapter(book, entry, num)) return res.status(403).json({ error: 'Chapitre verrouillé.' });
  // Langue demandée : 'en' sert la traduction si elle existe, sinon on retombe
  // sur l'original français en signalant que c'est la version originale.
  const wantEn   = String(req.query.lang || '').toLowerCase() === 'en';
  const useEn    = wantEn && !!ch.contentEn;
  res.json({
    num: ch.num, titre: ch.titre, titreEn: bookChapterTitleEn(book, num) || ch.titre,
    content: useEn ? ch.contentEn : ch.content,
    lang: useEn ? 'en' : 'fr',
    fallback: wantEn && !ch.contentEn, // EN demandé mais indisponible → original FR affiché
    copyright: book.copyright, copyrightEn: book.copyrightEn || book.copyright,
  });
});

// Admin : ajoute un livre.
app.post('/admin/feed-book', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { titre, auteur, categorie, couverture, url, description, ordre, actif } = req.body || {};
  if (!titre || typeof titre !== 'string' || !titre.trim()) {
    return res.status(400).json({ error: 'Titre requis.' });
  }
  // Les URLs doivent être http(s) : évite l'injection de liens javascript: dans la fiche.
  const cover = (couverture || '').toString().trim();
  const link  = (url || '').toString().trim();
  if (cover && !_isHttpUrl(cover)) return res.status(400).json({ error: 'URL de couverture invalide (http/https requis).' });
  if (link  && !_isHttpUrl(link))  return res.status(400).json({ error: 'URL de lecture invalide (http/https requis).' });
  const maxOrdre = feedBooks.reduce((m, b) => Math.max(m, b.ordre || 0), 0);
  const book = {
    _id:         'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    titre:       titre.trim().slice(0, 200),
    auteur:      (auteur || '').toString().trim().slice(0, 120),
    categorie:   (categorie || '').toString().trim().slice(0, 60),
    couverture:  cover.slice(0, 500),
    url:         link.slice(0, 500),
    description: (description || '').toString().trim().slice(0, 1000),
    ordre:       Number.isFinite(+ordre) ? +ordre : maxOrdre + 1,
    actif:       actif !== false,
    createdAt:   Date.now(),
  };
  feedBooks.push(book);
  dbInsertFeedBook(book);
  console.log(`[📚] Livre ajouté : ${book.titre}${book.auteur ? ' — ' + book.auteur : ''}`);
  res.json({ ok: true, book: { id: book._id, titre: book.titre, auteur: book.auteur, categorie: book.categorie, couverture: book.couverture, url: book.url, description: book.description, ordre: book.ordre } });
});

// Admin : supprime un livre.
app.delete('/admin/feed-book/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = feedBooks.findIndex(b => b._id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Livre introuvable.' });
  const [removed] = feedBooks.splice(idx, 1);
  dbDeleteFeedBook(removed._id);
  console.log(`[🗑️] Livre supprimé : ${removed.titre || '(sans titre)'}`);
  res.json({ ok: true });
});

app.get('/admin/reset', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  leaderboard.clear();
  triviaLeaderboard.clear();
  snakeLeaderboard.clear();
  luffyLeaderboard.clear();
  libs.clear();
  feedVideos.length = 0;
  feedBooks.length = 0;
  if (db) {
    await Promise.all([
      db.collection('leaderboard').deleteMany({}),
      db.collection('trivia_leaderboard').deleteMany({}),
      db.collection('snake_leaderboard').deleteMany({}),
      db.collection('luffy_leaderboard').deleteMany({}),
      db.collection('libs').deleteMany({}),
      db.collection('feed_videos').deleteMany({}),
      db.collection('feed_books').deleteMany({}),
    ]);
  }
  io.emit('leaderboard-update', []);
  io.emit('trivia-leaderboard-update', []);
  io.emit('snake-leaderboard-update', []);
  io.emit('luffy-leaderboard-update', []);
  io.emit('global-leaderboard-update', []);
  io.emit('libs-update', { balance: 0, pendingBoostHint: 0 });
  res.json({ ok: true, message: 'Classements réinitialisés.' });
});

async function mergeDuplicateNames() {
  let merged = 0;

  async function mergeMap(map, collection, mergeEntries) {
    const byName = new Map();
    for (const [id, e] of map.entries()) {
      const name = (e.name || '').trim();
      if (!name || name === 'Anonyme') continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push([id, e]);
    }
    for (const entries of byName.values()) {
      if (entries.length < 2) continue;
      const [canonId, canon] = mergeEntries(entries);
      for (const [dupId] of entries) {
        if (dupId === canonId) continue;
        playerIdAliases.set(dupId, canonId);
        dbUpsertAlias(dupId, canonId);
        map.delete(dupId);
        if (db) await db.collection(collection).deleteOne({ _id: dupId }).catch(() => {});
      }
      map.set(canonId, canon);
      merged++;
    }
  }

  await mergeMap(leaderboard, 'leaderboard', entries => {
    entries.sort((a, b) => b[1].wins - a[1].wins);
    const [canonId, canon] = entries[0];
    for (const [, e] of entries.slice(1)) { canon.wins += e.wins; canon.losses += e.losses; canon.draws += e.draws; }
    dbUpsertLeaderboard(canonId, canon);
    return [canonId, canon];
  });

  await mergeMap(triviaLeaderboard, 'trivia_leaderboard', entries => {
    entries.sort((a, b) => b[1].points - a[1].points);
    const [canonId, canon] = entries[0];
    for (const [, e] of entries.slice(1)) { canon.points += e.points; canon.games += e.games; }
    dbUpsertTriviaLeaderboard(canonId, canon);
    return [canonId, canon];
  });

  await mergeMap(snakeLeaderboard, 'snake_leaderboard', entries => {
    entries.sort((a, b) => b[1].hs - a[1].hs);
    const [canonId, canon] = entries[0];
    dbUpsertSnakeLeaderboard(canonId, canon);
    return [canonId, canon];
  });

  await mergeMap(luffyLeaderboard, 'luffy_leaderboard', entries => {
    entries.sort((a, b) => b[1].hs - a[1].hs);
    const [canonId, canon] = entries[0];
    dbUpsertLuffyLeaderboard(canonId, canon);
    return [canonId, canon];
  });

  await mergeMap(libs, 'libs', entries => {
    entries.sort((a, b) => b[1].balance - a[1].balance);
    const [canonId, canon] = entries[0];
    if (!canon.usedCodes) canon.usedCodes = [];
    for (const [, e] of entries.slice(1)) {
      canon.balance          += e.balance || 0;
      canon.pendingBoostHint += e.pendingBoostHint || 0;
      canon.lastActive        = Math.max(canon.lastActive || 0, e.lastActive || 0);
      (e.usedCodes || []).forEach(c => { if (!canon.usedCodes.includes(c)) canon.usedCodes.push(c); });
    }
    dbUpsertLibs(canonId, canon);
    return [canonId, canon];
  });

  if (merged > 0) console.log(`🔀 ${merged} groupe(s) de doublons fusionnés.`);
}

(async () => {
  await connectDB();
  await loadData();
  await mergeDuplicateNames();
  await resetLibsBalancesOnce();
  refreshAllHonorTitles(); // recolle le titre honorifique du n°1 si besoin

  const DIST_INTERVAL = 5 * 3_600_000;
  const now = Date.now();
  if (nextDistributionAt > now) {
    const delay = nextDistributionAt - now;
    console.log(`⏳ Prochaine distribution Libs dans ${Math.round(delay / 60000)} min.`);
    setTimeout(() => { distributeLibs(); setInterval(distributeLibs, DIST_INTERVAL); }, delay);
  } else {
    distributeLibs();
    setInterval(distributeLibs, DIST_INTERVAL);
  }

  function _cleanExpiredComments() {
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const toDelete = [];
    const remaining = [];
    for (const c of comments) {
      const old     = new Date(c.date).getTime() < cutoff;
      const hasLike = c._id && (commentLikeMap.get(c._id.toString())?.size || 0) > 0;
      if (old && !hasLike) toDelete.push(c._id);
      else remaining.push(c);
    }
    if (!toDelete.length) return;
    comments.length = 0;
    comments.push(...remaining);
    db.collection('comments').deleteMany({ _id: { $in: toDelete } })
      .catch(e => console.error('Erreur suppression commentaires expirés:', e));
    console.log(`[🗑️] ${toDelete.length} commentaire(s) sans like supprimé(s) après 12h`);
  }

  _cleanExpiredComments();
  setInterval(_cleanExpiredComments, 60 * 60 * 1000);

  function _celebrateMostLiked() {
    let top = null, topLikes = 0;
    for (const c of comments) {
      if (!c._id) continue;
      const count = commentLikeMap.get(c._id.toString())?.size || 0;
      if (count > topLikes) { topLikes = count; top = c; }
    }
    if (!top || topLikes === 0) return;
    io.emit('comment-star', { pseudo: top.pseudo, message: top.message, likes: topLikes });
    console.log(`[🏆] Commentaire du jour : ${top.pseudo} (${topLikes} ❤️)`);
  }
  setInterval(_celebrateMostLiked, 24 * 60 * 60 * 1000);

  // ── Bot keep-alive ──────────────────────────────────────────────────────────
  // L'hébergeur (Render free) endort le serveur après ~15 min sans trafic, ce
  // qui impose un long délai de réveil au premier visiteur. On s'auto-ping via
  // l'URL publique toutes les 10 min pour compter comme du trafic entrant.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || '';
  if (SELF_URL) {
    const ping = () => {
      fetch(`${SELF_URL}/health`)
        .then(r => { if (!r.ok) console.warn(`[⏰] Keep-alive : réponse ${r.status}`); })
        .catch(e => console.warn('[⏰] Keep-alive échoué :', e.message));
    };
    setInterval(ping, 10 * 60 * 1000);
    console.log(`⏰ Keep-alive activé → ${SELF_URL}/health toutes les 10 min.`);
  } else {
    console.log('⏰ Keep-alive inactif (RENDER_EXTERNAL_URL / SELF_URL non définie).');
  }

  // ── Filet de sécurité : re-vérification périodique des achats Libs ─────────
  // Le webhook FedaPay est la voie normale de confirmation ; cet intervalle
  // rattrape les cas où il aurait été manqué (serveur endormi/redémarré au
  // moment de la notification, webhook pas encore configuré, etc.).
  async function _recheckPendingLibsPurchases() {
    const cutoff = Date.now() - 48 * 3_600_000;
    const pending = [...libsPurchases.values()].filter(p => !p.credited && p.status === 'waiting_payment' && p.createdAt > cutoff);
    for (const purchase of pending) {
      try {
        const tx = await fetchFedapayTransaction(purchase._id);
        if (tx.custom_metadata?.playerId && tx.custom_metadata.playerId !== purchase.playerId) continue;
        const status = normalizeFedapayStatus(tx.status);
        if (status === 'completed') {
          creditLibsPurchase(purchase);
        } else if (status !== purchase.status) {
          purchase.status = status;
          purchase.updatedAt = Date.now();
          libsPurchases.set(purchase._id, purchase);
          dbUpsertLibsPurchase(purchase._id, purchase);
        }
      } catch (e) {
        console.error(`Erreur re-vérif achat Libs ${purchase._id}:`, e.message);
      }
    }
  }
  setInterval(_recheckPendingLibsPurchases, 10 * 60 * 1000);

  // Filet de securite Express : toute erreur non geree dans une route est
  // journalisee (dashboard) au lieu de passer inapercue.
  app.use((err, req, res, next) => {
    logServerError(`route ${req.method} ${req.path}`, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
})();
