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
  const [lbDocs, tlbDocs, cmtDocs, slbDocs, llbDocs, libsDocs, aliasDocs, configDocs, voteDocs, feedDocs, bookDocs, purchaseDocs, readerDocs, giftDocs] = await Promise.all([
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
  ]);
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
  libsDocs.forEach(d => libs.set(d._id, { name: d.name || '', balance: d.balance || 0, lastActive: d.lastActive || Date.now(), pendingBoostHint: d.pendingBoostHint || 0, usedCodes: d.usedCodes || [], ownedCosmetics: d.ownedCosmetics || [], equippedCosmetic: d.equippedCosmetic || null, equippedFont: d.equippedFont || null, equippedBubble: d.equippedBubble || null, equippedBackground: d.equippedBackground || null, equippedNameEffect: d.equippedNameEffect || null, equippedTitle: d.equippedTitle || null, equippedCursorSnake: d.equippedCursorSnake || null, equippedAvatar: d.equippedAvatar || null, equippedP4Token: d.equippedP4Token || null, equippedTtt: d.equippedTtt || null, equippedChess: d.equippedChess || null, equippedSnakeSkin: d.equippedSnakeSkin || null, equippedClickFx: d.equippedClickFx || null, equippedEmojiPack: d.equippedEmojiPack || null, equippedVictoryBan: d.equippedVictoryBan || null, equippedSoundPack: d.equippedSoundPack || null, equippedEmotes: Array.isArray(d.equippedEmotes) ? d.equippedEmotes : (d.equippedEmote ? [d.equippedEmote] : []), refundCardsUsedAt: d.refundCardsUsedAt || [], ownedBooks: d.ownedBooks || [], honorTitle: d.honorTitle || null, pendingHonorModal: d.pendingHonorModal || null, streak: d.streak || null, challenges: d.challenges || null, history: Array.isArray(d.history) ? d.history : [] }));
  aliasDocs.forEach(d => playerIdAliases.set(d._id, d.canonId));
  voteDocs.forEach(d => snakeVotes.set(d._id, d.vote));
  feedDocs.forEach(d => feedVideos.push({ _id: d._id, url: d.url, titre: d.titre || '', ordre: d.ordre || 0, actif: d.actif !== false, createdAt: d.createdAt || Date.now() }));
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
  const streakDoc = configDocs.find(d => d._id === 'rank1StreakSince');
  if (streakDoc) rank1StreakSince = streakDoc.value;
  const rank1NameDoc = configDocs.find(d => d._id === 'rank1GlobalName');
  if (rank1NameDoc) rank1Global = rank1NameDoc.value;
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
    .updateOne({ _id: id }, { $set: { name: entry.name, balance: entry.balance, lastActive: entry.lastActive, pendingBoostHint: entry.pendingBoostHint, usedCodes: entry.usedCodes || [], ownedCosmetics: entry.ownedCosmetics || [], equippedCosmetic: entry.equippedCosmetic || null, equippedFont: entry.equippedFont || null, equippedBubble: entry.equippedBubble || null, equippedBackground: entry.equippedBackground || null, equippedNameEffect: entry.equippedNameEffect || null, equippedTitle: entry.equippedTitle || null, equippedCursorSnake: entry.equippedCursorSnake || null, equippedAvatar: entry.equippedAvatar || null, equippedP4Token: entry.equippedP4Token || null, equippedTtt: entry.equippedTtt || null, equippedChess: entry.equippedChess || null, equippedSnakeSkin: entry.equippedSnakeSkin || null, equippedClickFx: entry.equippedClickFx || null, equippedEmojiPack: entry.equippedEmojiPack || null, equippedVictoryBan: entry.equippedVictoryBan || null, equippedSoundPack: entry.equippedSoundPack || null, equippedEmotes: entry.equippedEmotes || [], refundCardsUsedAt: entry.refundCardsUsedAt || [], ownedBooks: entry.ownedBooks || [], honorTitle: entry.honorTitle || null, pendingHonorModal: entry.pendingHonorModal || null, streak: entry.streak || null, challenges: entry.challenges || null, history: Array.isArray(entry.history) ? entry.history.slice(0, 20) : [] } }, { upsert: true })
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
const CHALLENGE_METRICS = ['gamesWon', 'gamesPlayed', 'triviaCorrect', 'triviaGames', 'snakeEaten', 'luffyRun', 'luffyGames'];
const CHALLENGE_ALL_DONE_BONUS = 30; // bonus « journée parfaite » quand les 3 défis sont réclamés

// Liste des défis actifs du jour : la variante de chaque slot tourne avec le
// numéro du jour (heure du Bénin), donc change forcément d'un jour à l'autre.
function activeChallenges() {
  const dayNum = Math.floor((Date.now() + 3_600_000) / 86_400_000);
  const slotC  = isSnakeEventDay() ? CHALLENGE_POOL.WEEKEND : CHALLENGE_POOL.WEEKDAY;
  return [
    CHALLENGE_POOL.A[dayNum % CHALLENGE_POOL.A.length],
    CHALLENGE_POOL.B[dayNum % CHALLENGE_POOL.B.length],
    slotC[dayNum % slotC.length],
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
    id: ch.id, goal: ch.goal, reward: ch.reward,
    progress: Math.min(ch.goal, c.progress[ch.metric] || 0),
    done: (c.progress[ch.metric] || 0) >= ch.goal,
    claimed: c.claimed.includes(ch.id),
  }));
}

// Fait progresser un défi et notifie le joueur (barres de progression en direct).
function bumpChallenge(id, metric, amount = 1) {
  if (!id) return;
  const entry = getLibsEntry(id);
  if (!entry || !entry.name || entry.name === 'Anonyme') return;
  const c = getChallenges(entry);
  if (!(metric in c.progress)) return;
  c.progress[metric] += amount;
  libs.set(id, entry);
  dbUpsertLibs(id, entry);
  _emitToPlayer(id, 'challenges-update', { challenges: challengesPayload(entry) });
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
  const bonus = Math.min(s.count, 7) * 5; // de 5 (jour 1) à 35 (jour 7+) Libs
  return { streak: s, bonus };
}

// Ajoute une partie en tête de l'historique (limité aux 20 dernières).
function pushHistory(id, item) {
  if (!id) return;
  const entry = getLibsEntry(id);
  if (!entry || !entry.name || entry.name === 'Anonyme') return;
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
  { id: 'emote-gg',             type: 'emote',       price: 5   },
  { id: 'emote-wellplayed',     type: 'emote',       price: 10  },
  { id: 'emote-fire',           type: 'emote',       price: 30  },
  { id: 'emote-easy',           type: 'emote',       price: 50  },
  { id: 'emote-omg',            type: 'emote',       price: 80  },
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
const FREE_COSMETICS = ['bg-nuit', 'bg-ardoise', 'bg-brume'];

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
    entry = { name: '', balance: 0, lastActive: Date.now(), pendingBoostHint: 0, usedCodes: [], ownedCosmetics: [], equippedCosmetic: null, equippedFont: null, equippedBubble: null, equippedBackground: null, equippedNameEffect: null, equippedTitle: null, equippedCursorSnake: null, equippedAvatar: null, equippedP4Token: null, equippedTtt: null, equippedChess: null, equippedSnakeSkin: null, equippedClickFx: null, equippedEmojiPack: null, equippedVictoryBan: null, equippedSoundPack: null, equippedEmotes: [], refundCardsUsedAt: [], ownedBooks: [], honorTitle: null, pendingHonorModal: null, streak: null, challenges: null, history: [] };
    libs.set(id, entry);
  }
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
  if (newR1Global === rank1Global) return;
  rank1Global     = newR1Global;
  rank1StreakSince = Date.now();
  dbSaveRank1Streak();

  for (const [id, entry] of libs.entries()) {
    if (entry.name === 'Libero') continue;
    const name = entry.name;
    if (!name || name === 'Anonyme') continue;

    const newHonor = (name === rank1Global) ? 'honor-rank1-global' : null;
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
const VALID_GAMES  = new Set(['connect4', 'tictactoe', 'chess', 'checkers']);

const TRIVIA_CATEGORIES = {
  9: 'Culture Générale', 23: 'Histoire',       22: 'Géographie',
  17: 'Sciences',        21: 'Sports',          11: 'Cinéma',
  12: 'Musique',         14: 'Télévision',      19: 'Mathématiques',
  20: 'Informatique',    25: 'Arts',            27: 'Animaux',
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
function markTriviaSeen(playerIds, questions) {
  for (const pid of playerIds) {
    const e = triviaSeenFor(pid);
    if (!e) continue;
    for (const q of questions) {
      if (!q.id || e.set.has(q.id)) continue;
      e.set.add(q.id);
      e.order.push(q.id);
    }
    while (e.order.length > TRIVIA_SEEN_MAX) e.set.delete(e.order.shift());
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
  io.to(code).emit('trivia-question', {
    questionNum:    room.currentQ + 1,
    totalQuestions: room.totalQ,
    question:       q.question,
    choices:        q.choices,
    timeLimit:      TRIVIA_TIME_MS / 1000,
    scores:         publicScores(room),
  });
  room.timer = setTimeout(() => revealTriviaAnswer(code), TRIVIA_TIME_MS);
}

function revealTriviaAnswer(code) {
  const room = triviaRooms.get(code);
  if (!room || room.status !== 'question') return;
  clearTimeout(room.timer);
  room.timer  = null;
  room.status = 'reveal';

  const correct = room.questions[room.currentQ].correct;
  const correctSocketIds = [];
  for (const [sid, choice] of room.answersThisRound) {
    if (choice === correct) {
      const p = room.players.get(sid);
      if (p) { p.score++; correctSocketIds.push(sid); bumpChallenge(p.playerId, 'triviaCorrect'); }
    }
  }
  io.to(code).emit('trivia-reveal', { correct, correctSocketIds, scores: publicScores(room) });
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
  socket.on('create-room', ({ gameType = 'connect4', name = '', vsBot = false, botDifficulty = 'medium', playerId } = {}) => {
    if (!VALID_GAMES.has(gameType)) return;
    const playerName = sanitizeName(name, 'Anonyme');
    const diff = ['easy', 'medium', 'hard'].includes(botDifficulty) ? botDifficulty : 'medium';

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
      restartVotes: new Set(),
      reconnectTimers: { R: null, Y: null },
    });

    roomCode = code;
    myPlayer = 'R';
    socket.join(code);

    if (vsBot) {
      socket.emit('game-start', { gameType, state: createInitialState(gameType), yourPlayer: 'R', vsBot: true, botDifficulty: diff, code });
    } else {
      socket.emit('room-created', { code, gameType });
    }
  });

  // ── Tentatives de jointure (renvoient true si le code correspond à ce
  //    type de salle, qu'elle ait été rejointe ou pleine/déjà lancée). ──────
  function tryJoinClassic(code, name, playerId) {
    const key  = (code || '').toUpperCase().trim();
    const room = rooms.get(key);
    if (!room) return false;
    if (room.players.Y) { socket.emit('error', { message: 'Cette room est déjà pleine.' }); return true; }

    const playerName = sanitizeName(name, 'Anonyme');
    room.players.Y     = socket.id;
    room.playerNames.Y = playerName;
    if (room.playerIds) room.playerIds.Y = safePlayerId(playerId) || playerName;
    room.status = 'playing';
    roomCode = key;
    myPlayer = 'Y';
    socket.join(key);

    for (const p of ['R', 'Y']) {
      io.to(room.players[p]).emit('game-start', {
        gameType:   room.gameType,
        state:      room.state,
        yourPlayer: p,
        code:       key,
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

      default: return;
    }

    room.state  = newState;
    room.status = status;
    room.winner = winner;

    io.to(roomCode).emit('game-update', { gameType: room.gameType, state: newState, status, winner });

    if (status !== 'playing') {
      if (!room.vsBot) {
        if (status === 'won') {
          const loserRole = winner === 'R' ? 'Y' : 'R';
          updateLeaderboard(room.playerIds?.[winner]    || room.playerNames[winner],   room.playerNames[winner],   'win');
          updateLeaderboard(room.playerIds?.[loserRole] || room.playerNames[loserRole], room.playerNames[loserRole], 'loss');
          updateLastActive(room.playerIds?.[winner],    room.playerNames[winner]);
          updateLastActive(room.playerIds?.[loserRole], room.playerNames[loserRole]);
          pushHistory(room.playerIds?.[winner],    { game: room.gameType, result: 'win' });
          pushHistory(room.playerIds?.[loserRole], { game: room.gameType, result: 'loss' });
          bumpChallenge(room.playerIds?.[winner], 'gamesWon');
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

      for (const p of ['R', 'Y']) {
        io.to(room.players[p]).emit('game-start', {
          gameType:   room.gameType,
          state:      room.state,
          yourPlayer: p,
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
    const roomDiff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : '';
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
    room.answersThisRound.set(socket.id, String(choice));
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
    const d = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : '';
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
    pushHistory(id, { game, result: null, score: sc });
    // Défis Luffy Runner (hors week-end) : score cumulé + nombre de parties.
    if (game === 'luffy' && sc > 0) bumpChallenge(id, 'luffyRun', sc);
    if (game === 'luffy') bumpChallenge(id, 'luffyGames');
  });

  // ── Défis quotidiens ──────────────────────────────────────────────────────
  socket.on('get-challenges', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('challenges-update', { challenges: [] }); return; }
    socket.emit('challenges-update', { challenges: challengesPayload(getLibsEntry(id)) });
  });

  socket.on('claim-challenge', ({ playerId, challengeId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('claim-challenge-result', { ok: false, error: 'invalid' }); return; }
    if (!allowAction('claim', 20, 60_000)) { socket.emit('claim-challenge-result', { ok: false, error: 'rate' }); return; }
    const entry = getLibsEntry(id);
    if (!entry.name || entry.name === 'Anonyme') { socket.emit('claim-challenge-result', { ok: false, error: 'anonymous' }); return; }
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
    entry.balance = Math.min(MAX_BALANCE, entry.balance + def.reward + bonus);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, delta: def.reward + bonus, nextAt: nextDistributionAt });
    socket.emit('challenges-update', { challenges: challengesPayload(entry) });
    socket.emit('claim-challenge-result', { ok: true, challengeId, reward: def.reward, allDoneBonus: bonus });
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
    const VALID_EMOTES = ['emote-gg','emote-wellplayed','emote-fire','emote-easy','emote-omg'];
    if (!VALID_EMOTES.includes(emoteId)) return;
    if (!entry || !entry.ownedCosmetics?.includes(emoteId)) return;
    io.to(roomCode).emit('emote-received', { player: myPlayer, emoteId, timestamp: Date.now() });
  });

  // ── Libs ─────────────────────────────────────────────────────────────────────
  socket.on('get-libs', ({ playerId } = {}) => {
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('libs-update', { balance: 0, pendingBoostHint: 0 }); return; }
    socketPlayerIds.set(socket.id, id);
    const entry = getLibsEntry(id);

    // Série de connexion : bonus quotidien croissant, réservé aux joueurs nommés
    // (empêche le farm avec des identités fraîches anonymes).
    let streakBonus = 0;
    if (entry.name && entry.name !== 'Anonyme') {
      const { streak, bonus } = touchStreak(entry);
      streakBonus = bonus;
      if (bonus > 0) {
        entry.balance = Math.min(MAX_BALANCE, entry.balance + bonus);
        libs.set(id, entry);
      }
      dbUpsertLibs(id, entry);
      socket.emit('streak-update', { count: streak.count, longest: streak.longest, bonus });
    }

    const { available: refundCards, nextRefill: refundCardsNextRefill } = getRefundCardsInfo(entry);
    socket.emit('libs-update', { name: entry.name || '', balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt, refundCards, refundCardsNextRefill, pendingHonorModal: entry.pendingHonorModal || null, delta: streakBonus || undefined });
    socket.emit('challenges-update', { challenges: challengesPayload(entry) });
  });

  socket.on('get-shop', () => {
    socket.emit('shop-items', SHOP_ITEMS);
  });

  socket.on('get-shop-rotation', () => {
    socket.emit('shop-rotation', getShopRotation());
  });

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
  });

  // ── Réinitialiser le compte ──────────────────────────────────────────────
  // Suppression totale et définitive de la progression : le joueur disparaît
  // de tous les classements et de toutes les données serveur. Le playerId
  // (secret) fait office de preuve de propriété.
  socket.on('reset-account', ({ playerId } = {}) => {
    if (!allowAction('reset', 3, 60_000)) { socket.emit('reset-account-result', { ok: false, error: 'rate' }); return; }
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('reset-account-result', { ok: false, error: 'invalid' }); return; }
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
    if (entry.balance < cosmetic.price) { socket.emit('buy-cosmetic-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= cosmetic.price;
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
    if (entry.balance < pack.price) { socket.emit('buy-book-pack-result', { ok: false, error: 'insufficient' }); return; }
    entry.balance -= pack.price;
    entry.ownedBooks.push(key);
    libs.set(id, entry);
    dbUpsertLibs(id, entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, nextAt: nextDistributionAt });
    socket.emit('buy-book-pack-result', { ok: true, packId });
    console.log(`[📖] ${entry.name} a débloqué ${key} (−${pack.price} Libs)`);
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

    const entry = { q, lang, at: now };
    botLogs.push(entry);
    if (botLogs.length > BOT_LOG_MAX) botLogs.shift();
    if (db) db.collection('bot_logs').insertOne(entry).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
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
  for (const [pid, v] of libs)              { const p = get(pid); setName(p, v.name); p.libs = v.balance || 0; }
  return [...map.entries()]
    .map(([pid, p]) => ({ ...p, name: p.name || 'Anonyme', games: p.wins + p.losses + p.draws, ref: _playerRef(pid) }))
    .sort((a, b) => (b.games + b.quizzes) - (a.games + a.quizzes))
    .slice(0, 300);
}

// Detail complet d'un joueur (clé admin requise) : stats + streak + cosmétiques
// possédés + équipements + historique + achats. Identifié par sa reference hashée.
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
        if (docs.length) botLogsOut = docs.map(d => ({ q: d.q, lang: d.lang, at: d.at }));
      } catch (e) {}
    }

    res.json({
      // compat : les champs de visite restent à la racine
      totalVisits: visits.totalVisits, uniqueVisitors: visits.uniqueVisitors,
      today: visits.today, week: visits.week, online,
      totals: {
        players: players.length, classicResults, classicWins, quizzes, quizPoints,
        snakePlayers, luffyPlayers,
        commentsApproved, commentsPending, commentsTotal: commentsPayload.length,
        purchasesCount: purchasesDone.length, libsSold,
      },
      players,
      comments: commentsPayload,
      purchases: recentPurchases,
      botLogs: botLogsOut,
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
function _activeFeedVideos() {
  return feedVideos
    .filter(v => v.actif)
    .sort((a, b) => (a.ordre - b.ordre) || (a.createdAt - b.createdAt))
    .map(v => ({ id: v._id, url: v.url, titre: v.titre, ordre: v.ordre }));
}

// Public : liste des vidéos actives, triées par ordre.
app.get('/api/feed-videos', (_req, res) => res.json(_activeFeedVideos()));

// Admin : ajoute une vidéo (url + titre).
app.post('/admin/feed-video', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const { url, titre, ordre, actif } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: 'URL invalide (http/https requis).' });
  }
  const maxOrdre = feedVideos.reduce((m, v) => Math.max(m, v.ordre || 0), 0);
  const video = {
    _id:       'fv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    url:       url.trim(),
    titre:     (titre || '').toString().trim().slice(0, 200),
    ordre:     Number.isFinite(+ordre) ? +ordre : maxOrdre + 1,
    actif:     actif !== false,
    createdAt: Date.now(),
  };
  feedVideos.push(video);
  dbInsertFeedVideo(video);
  console.log(`[🎬] Vidéo feed ajoutée : ${video.titre || '(sans titre)'} → ${video.url}`);
  res.json({ ok: true, video: { id: video._id, url: video.url, titre: video.titre, ordre: video.ordre } });
});

// Admin : supprime une vidéo.
app.delete('/admin/feed-video/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Clé invalide.' });
  const idx = feedVideos.findIndex(v => v._id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Vidéo introuvable.' });
  const [removed] = feedVideos.splice(idx, 1);
  dbDeleteFeedVideo(removed._id);
  console.log(`[🗑️] Vidéo feed supprimée : ${removed.titre || '(sans titre)'}`);
  res.json({ ok: true });
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
      id: p.id, price: p.price, from: p.from, to: p.to, requires: p.requires,
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

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
})();
