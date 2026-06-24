require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const { MongoClient } = require('mongodb');
const connect4   = require('./game');
const tictactoe  = require('./game-tictactoe');
const chessGame  = require('./game-chess');
const triviaGame = require('./game-trivia');
const bots       = require('./game-bots');

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms           = new Map();
const leaderboard     = new Map();
const triviaRooms     = new Map();
const triviaLeaderboard = new Map();
const snakeLeaderboard  = new Map();
const snakeVotes        = new Map(); // playerId -> 'yes'|'no'
const comments        = [];
const libs            = new Map();
const MAX_BALANCE              = 19999;
const REFUND_CARD_MAX          = 2;
const REFUND_CARD_COOLDOWN_MS  = 30 * 24 * 3600 * 1000;
const socketPlayerIds = new Map();
const playerIdAliases = new Map();

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
  const [lbDocs, tlbDocs, cmtDocs, slbDocs, libsDocs, aliasDocs, configDocs, voteDocs] = await Promise.all([
    db.collection('leaderboard').find().toArray(),
    db.collection('trivia_leaderboard').find().toArray(),
    db.collection('comments').find().sort({ date: 1 }).toArray(),
    db.collection('snake_leaderboard').find().toArray(),
    db.collection('libs').find().toArray(),
    db.collection('player_aliases').find().toArray(),
    db.collection('server_config').find().toArray(),
    db.collection('snake_votes').find().toArray(),
  ]);
  lbDocs.forEach(d  => leaderboard.set(d._id, { name: d.name || '', wins: d.wins, losses: d.losses, draws: d.draws }));
  tlbDocs.forEach(d => triviaLeaderboard.set(d._id, { name: d.name || '', points: d.points, games: d.games }));
  cmtDocs.forEach(d => comments.push({ _id: d._id, pseudo: d.pseudo, message: d.message, date: d.date }));
  slbDocs.forEach(d => snakeLeaderboard.set(d._id, { name: d.name || '', hs: d.hs }));
  libsDocs.forEach(d => libs.set(d._id, { name: d.name || '', balance: d.balance || 0, lastActive: d.lastActive || Date.now(), pendingBoostHint: d.pendingBoostHint || 0, usedCodes: d.usedCodes || [], ownedCosmetics: d.ownedCosmetics || [], equippedCosmetic: d.equippedCosmetic || null, equippedFont: d.equippedFont || null, equippedBubble: d.equippedBubble || null, equippedBackground: d.equippedBackground || null, equippedNameEffect: d.equippedNameEffect || null, equippedTitle: d.equippedTitle || null, equippedCursorSnake: d.equippedCursorSnake || null, equippedAvatar: d.equippedAvatar || null, equippedP4Token: d.equippedP4Token || null, equippedTtt: d.equippedTtt || null, equippedChess: d.equippedChess || null, equippedSnakeSkin: d.equippedSnakeSkin || null, equippedClickFx: d.equippedClickFx || null, equippedEmojiPack: d.equippedEmojiPack || null, equippedVictoryBan: d.equippedVictoryBan || null, equippedSoundPack: d.equippedSoundPack || null, equippedEmotes: Array.isArray(d.equippedEmotes) ? d.equippedEmotes : (d.equippedEmote ? [d.equippedEmote] : []), refundCardsUsedAt: d.refundCardsUsedAt || [], honorTitle: d.honorTitle || null, pendingHonorModal: d.pendingHonorModal || null }));
  aliasDocs.forEach(d => playerIdAliases.set(d._id, d.canonId));
  voteDocs.forEach(d => snakeVotes.set(d._id, d.vote));
  const nextDistDoc = configDocs.find(d => d._id === 'nextDistributionAt');
  if (nextDistDoc) nextDistributionAt = nextDistDoc.value;
  const streakDoc = configDocs.find(d => d._id === 'rank1StreakSince');
  if (streakDoc) rank1StreakSince = streakDoc.value;
  const rank1NameDoc = configDocs.find(d => d._id === 'rank1GlobalName');
  if (rank1NameDoc) rank1Global = rank1NameDoc.value;
  console.log(`📦 Chargé: ${lbDocs.length} classique, ${tlbDocs.length} quiz, ${slbDocs.length} snake, ${cmtDocs.length} commentaires, ${libsDocs.length} libs, ${aliasDocs.length} alias, ${voteDocs.length} votes snake.`);
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

function safePlayerId(id) {
  const raw = typeof id === 'string' && id.trim() ? id.trim().slice(0, 64) : null;
  if (!raw) return null;
  return playerIdAliases.get(raw) || raw;
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

function dbUpsertLibs(id, entry) {
  if (!db) return;
  db.collection('libs')
    .updateOne({ _id: id }, { $set: { name: entry.name, balance: entry.balance, lastActive: entry.lastActive, pendingBoostHint: entry.pendingBoostHint, usedCodes: entry.usedCodes || [], ownedCosmetics: entry.ownedCosmetics || [], equippedCosmetic: entry.equippedCosmetic || null, equippedFont: entry.equippedFont || null, equippedBubble: entry.equippedBubble || null, equippedBackground: entry.equippedBackground || null, equippedNameEffect: entry.equippedNameEffect || null, equippedTitle: entry.equippedTitle || null, equippedCursorSnake: entry.equippedCursorSnake || null, equippedAvatar: entry.equippedAvatar || null, equippedP4Token: entry.equippedP4Token || null, equippedTtt: entry.equippedTtt || null, equippedChess: entry.equippedChess || null, equippedSnakeSkin: entry.equippedSnakeSkin || null, equippedClickFx: entry.equippedClickFx || null, equippedEmojiPack: entry.equippedEmojiPack || null, equippedVictoryBan: entry.equippedVictoryBan || null, equippedSoundPack: entry.equippedSoundPack || null, equippedEmotes: entry.equippedEmotes || [], refundCardsUsedAt: entry.refundCardsUsedAt || [], honorTitle: entry.honorTitle || null, pendingHonorModal: entry.pendingHonorModal || null } }, { upsert: true })
    .catch(e => console.error('Erreur sauvegarde libs:', e));
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

function getLibsEntry(id) {
  if (!id) return null;
  let entry = libs.get(id);
  if (!entry) {
    entry = { name: '', balance: 0, lastActive: Date.now(), pendingBoostHint: 0, usedCodes: [], ownedCosmetics: [], equippedCosmetic: null, equippedFont: null, equippedBubble: null, equippedBackground: null, equippedNameEffect: null, equippedTitle: null, equippedCursorSnake: null, equippedAvatar: null, equippedP4Token: null, equippedTtt: null, equippedChess: null, equippedSnakeSkin: null, equippedClickFx: null, equippedEmojiPack: null, equippedVictoryBan: null, equippedSoundPack: null, equippedEmotes: [], refundCardsUsedAt: [], honorTitle: null, pendingHonorModal: null };
    libs.set(id, entry);
  }
  if (!entry.usedCodes)          entry.usedCodes          = [];
  if (!entry.ownedCosmetics)     entry.ownedCosmetics     = [];
  if (!entry.refundCardsUsedAt)  entry.refundCardsUsedAt  = [];
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
  const top3 = getGlobalLeaderboardData().slice(0, 3);
  top3.forEach((rankEntry, i) => {
    if (!rankEntry.name || rankEntry.name === 'Anonyme') return;
    let reward = LIBS_REWARDS[i];
    if (i === 0 && rank1StreakSince) {
      const streakDays = (Date.now() - rank1StreakSince) / 86400000;
      reward += Math.floor(streakDays / 3) * 5;
    }
    const matchingIds = new Set();
    for (const [id, e] of leaderboard.entries())       { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const [id, e] of triviaLeaderboard.entries()) { if (e.name === rankEntry.name) matchingIds.add(id); }
    for (const [id, e] of snakeLeaderboard.entries())  { if (e.name === rankEntry.name) matchingIds.add(id); }
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
const VALID_GAMES  = new Set(['connect4', 'tictactoe', 'chess']);

const TRIVIA_CATEGORIES = {
  9: 'Culture Générale', 23: 'Histoire',       22: 'Géographie',
  17: 'Sciences',        21: 'Sports',          11: 'Cinéma',
  12: 'Musique',         14: 'Télévision',      19: 'Mathématiques',
  20: 'Informatique',    25: 'Arts',            27: 'Animaux',
};
const TRIVIA_COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2'];
const TRIVIA_Q_COUNT = 10;
const TRIVIA_TIME_MS = 20_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function createInitialState(gameType) {
  switch (gameType) {
    case 'connect4':  return { board: connect4.createBoard(), currentPlayer: 'R' };
    case 'tictactoe': return tictactoe.createState();
    case 'chess':     return chessGame.createState();
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

function getGlobalLeaderboardData() {
  const ids = new Set([...leaderboard.keys(), ...triviaLeaderboard.keys(), ...snakeLeaderboard.keys()]);
  const byName = new Map();
  for (const id of ids) {
    const c  = leaderboard.get(id)       || { name: '', wins: 0 };
    const tr = triviaLeaderboard.get(id) || { name: '', points: 0 };
    const sk = snakeLeaderboard.get(id)  || { name: '', hs: 0 };
    const name = c.name || tr.name || sk.name;
    if (!name) continue;
    const existing = byName.get(name) || { name, wins: 0, triviaPoints: 0, snakeHs: 0 };
    existing.wins         = Math.max(existing.wins, c.wins || 0);
    existing.triviaPoints = Math.max(existing.triviaPoints, tr.points || 0);
    existing.snakeHs      = Math.max(existing.snakeHs, sk.hs || 0);
    byName.set(name, existing);
  }
  return [...byName.values()]
    .map(e => ({ ...e, globalScore: e.wins * 10 + e.triviaPoints + e.snakeHs * 10 }))
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

function getRoomScores(room) {
  return [...room.players.entries()]
    .filter(([, p]) => !p.disconnected)
    .map(([sid, p]) => ({ socketId: sid, name: p.name, playerId: p.playerId, score: p.score, colorIndex: p.colorIndex }))
    .sort((a, b) => b.score - a.score);
}

async function startTriviaGame(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  try {
    const cats = room.categories || [room.category];
    const lang = room.lang || 'fr';
    const diff = room.difficulty || '';
    room.questions = cats.length === 1
      ? await triviaGame.fetchQuestions(cats[0], room.totalQ, lang, diff)
      : await triviaGame.fetchQuestionsMulti(cats, room.totalQ, lang, diff);
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
    timeLimit:      20,
    scores:         getRoomScores(room),
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
      if (p) { p.score++; correctSocketIds.push(sid); }
    }
  }
  io.to(code).emit('trivia-reveal', { correct, correctSocketIds, scores: getRoomScores(room) });
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
  }
  io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  io.emit('global-leaderboard-update', getGlobalLeaderboardData());

  io.to(code).emit('trivia-finished', { scores });
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
    }
  }, 700);
}

// ── Socket ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let roomCode      = null;
  let myPlayer      = null;
  let triviaRoomCode = null;

  socket.emit('server-announcement', SERVER_ANNOUNCEMENT);
  socket.on('announcement-dismissed', () => {});

  // ── Créer une room ──────────────────────────────────────────────────────
  socket.on('create-room', ({ gameType = 'connect4', name = '', vsBot = false, botDifficulty = 'medium', playerId } = {}) => {
    if (!VALID_GAMES.has(gameType)) return;
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
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
      socket.emit('game-start', { gameType, state: createInitialState(gameType), yourPlayer: 'R', vsBot: true, botDifficulty: diff });
    } else {
      socket.emit('room-created', { code, gameType });
    }
  });

  // ── Rejoindre une room ──────────────────────────────────────────────────
  socket.on('join-room', ({ code, name = '', playerId } = {}) => {
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
    const key  = (code || '').toUpperCase().trim();
    const room = rooms.get(key);

    if (!room)          { socket.emit('error', { message: 'Room introuvable. Vérifie le code.' }); return; }
    if (room.players.Y) { socket.emit('error', { message: 'Cette room est déjà pleine.' });        return; }

    room.players.Y     = socket.id;
    room.playerNames.Y = playerName;
    if (room.playerIds) room.playerIds.Y = safePlayerId(playerId) || playerName;
    room.status       = 'playing';
    roomCode = key;
    myPlayer = 'Y';
    socket.join(key);

    for (const p of ['R', 'Y']) {
      io.to(room.players[p]).emit('game-start', {
        gameType:     room.gameType,
        state:        room.state,
        yourPlayer:   p,
      });
    }
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
      gameType:   room.gameType,
      state:      room.state,
      yourPlayer: player,
      status:     room.status,
      winner:     room.winner,
      roomCode:   room.code,
    });

    const other = player === 'R' ? 'Y' : 'R';
    if (room.players[other]) io.to(room.players[other]).emit('opponent-reconnected');
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
        } else {
          updateLeaderboard(room.playerIds?.R || room.playerNames.R, room.playerNames.R, 'draw');
          updateLeaderboard(room.playerIds?.Y || room.playerNames.Y, room.playerNames.Y, 'draw');
          updateLastActive(room.playerIds?.R, room.playerNames.R);
          updateLastActive(room.playerIds?.Y, room.playerNames.Y);
        }
        io.emit('leaderboard-update', getLeaderboardData());
        io.emit('global-leaderboard-update', getGlobalLeaderboardData());
      } else {
        // Solo vs bot (toutes difficultés) : enregistrer le joueur humain
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
      }
    } else if (room.vsBot) {
      scheduleBotMove(roomCode);
    }
  });

  // ── Coups légaux (échecs uniquement) ────────────────────────────────────
  socket.on('get-moves', ({ square }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameType !== 'chess' || room.state.currentPlayer !== myPlayer) {
      socket.emit('legal-moves', { square, moves: [] });
      return;
    }
    socket.emit('legal-moves', { square, moves: chessGame.getLegalMoves(room.state.fen, square) });
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

  socket.on('check-pseudo', ({ name, playerId } = {}) => {
    const cleanName = String(name || '').trim().slice(0, 20);
    const id = safePlayerId(playerId);
    if (!cleanName || cleanName === 'Anonyme' || !id) {
      socket.emit('pseudo-check-result', { taken: false });
      return;
    }
    const taken = [leaderboard, triviaLeaderboard, snakeLeaderboard].some(map => {
      for (const [k, v] of map.entries()) {
        if (v.name === cleanName && k !== id) return true;
      }
      return false;
    });
    socket.emit('pseudo-check-result', { taken });
  });

  socket.on('rename-player', ({ name, playerId } = {}) => {
    const newName = String(name || '').trim().slice(0, 20);
    const id = safePlayerId(playerId);
    if (!newName || newName === 'Anonyme' || !id) {
      socket.emit('rename-result', { ok: false, error: 'invalid' });
      return;
    }
    const taken = [leaderboard, triviaLeaderboard, snakeLeaderboard].some(map => {
      for (const [k, v] of map.entries()) {
        if (v.name === newName && k !== id) return true;
      }
      return false;
    });
    if (taken) { socket.emit('rename-result', { ok: false, error: 'taken' }); return; }
    let changed = false;
    [[leaderboard, dbUpsertLeaderboard], [triviaLeaderboard, dbUpsertTriviaLeaderboard],
     [snakeLeaderboard, dbUpsertSnakeLeaderboard], [libs, dbUpsertLibs]].forEach(([map, upsert]) => {
      const entry = map.get(id);
      if (entry) { entry.name = newName; map.set(id, entry); upsert(id, entry); changed = true; }
    });
    if (changed) {
      refreshAllHonorTitles();
      io.emit('leaderboard-update', getLeaderboardData());
      io.emit('global-leaderboard-update', getGlobalLeaderboardData());
      io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
      io.emit('snake-leaderboard-update', getSnakeLeaderboardData());
    }
    socket.emit('rename-result', { ok: true });
  });

  socket.on('submit-snake-score', ({ name, hs, playerId } = {}) => {
    const playerName = String(name || '').trim().slice(0, 20);
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
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
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
    const key  = (code || '').toUpperCase().trim();
    const room = triviaRooms.get(key);
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
    if (!room)                   { socket.emit('trivia-error', { message: 'Salon introuvable. Vérifie le code.' }); return; }
    if (room.status !== 'waiting') { socket.emit('trivia-error', { message: 'La partie a déjà commencé.' });        return; }
    if (room.players.size >= 6)  { socket.emit('trivia-error', { message: 'Le salon est complet (6 joueurs max).' }); return; }
    const colorIndex = room.players.size;
    room.players.set(socket.id, { name: playerName, playerId: safePlayerId(playerId) || playerName, colorIndex, score: 0 });
    triviaRoomCode = key;
    socket.join(key);
    socket.emit('trivia-room-joined', { code: key, categoryName: room.categoryName });
    io.to(key).emit('trivia-room-updated', getTriviaRoomState(room));
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
  socket.on('fetch-trivia-solo', async ({ categories = [], amount = 10, lang = 'fr', difficulty = '' } = {}) => {
    const cats = [].concat(categories).map(c => parseInt(c)).filter(c => TRIVIA_CATEGORIES[c]);
    if (!cats.length) { socket.emit('trivia-solo-error'); return; }
    const l = ['fr', 'en'].includes(lang) ? lang : 'fr';
    const rawN = parseInt(amount) || 10;
    const n = Math.round(Math.min(40, Math.max(10, rawN)) / 5) * 5;
    const d = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : '';
    try {
      const qs = cats.length === 1
        ? await triviaGame.fetchQuestions(cats[0], n, l, d)
        : await triviaGame.fetchQuestionsMulti(cats, n, l, d);
      socket.emit('trivia-solo-questions', qs);
    } catch { socket.emit('trivia-solo-error'); }
  });

  // ── Trivia : classement ──────────────────────────────────────────────────
  socket.on('get-trivia-leaderboard', () => {
    socket.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  });

  // ── Trivia : fin de partie solo ──────────────────────────────────────────
  socket.on('solo-trivia-finished', ({ name, score, playerId } = {}) => {
    const playerName = String(name || '').trim().slice(0, 20) || 'Anonyme';
    const id = safePlayerId(playerId) || playerName;
    updateTriviaLeaderboard(id, playerName, score);
    updateLastActive(id, playerName);
    io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
    io.emit('global-leaderboard-update', getGlobalLeaderboardData());
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
    const { available: refundCards, nextRefill: refundCardsNextRefill } = getRefundCardsInfo(entry);
    socket.emit('libs-update', { balance: entry.balance, pendingBoostHint: entry.pendingBoostHint, ownedCosmetics: entry.ownedCosmetics, ..._equippedPayload(entry), nextAt: nextDistributionAt, refundCards, refundCardsNextRefill, pendingHonorModal: entry.pendingHonorModal || null });
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
    const id = safePlayerId(playerId);
    if (!id) { socket.emit('redeem-result', { ok: false, error: 'invalid' }); return; }
    const entry = getLibsEntry(id);
    const cleanName = String(name || '').trim();
    if (cleanName && cleanName !== 'Anonyme') entry.name = cleanName;
    if (!entry.name || entry.name === 'Anonyme') {
      socket.emit('redeem-result', { ok: false, error: 'anonymous' }); return;
    }
    const PROMOS = { 'EMAR': 30, 'NODE': 1000 };
    const normalCode = String(code || '').trim().toUpperCase();
    const isLibero   = entry.name === 'Libero';
    const isFillCode = normalCode === 'SDFT';
    const reward     = isFillCode ? Math.max(0, MAX_BALANCE - entry.balance) : PROMOS[normalCode];
    if (!reward) {
      socket.emit('redeem-result', { ok: false, error: isFillCode ? 'already_used' : 'invalid' }); return;
    }
    const unlimited = isLibero && normalCode === 'NODE';
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

  socket.on('buy-cosmetic', ({ playerId, cosmeticId } = {}) => {
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
      scores:     getRoomScores(troom),
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
        scores:         getRoomScores(troom),
      };
    }

    socket.emit('trivia-reconnect-success', reconnectData);
    io.to(key).emit('trivia-room-updated', getTriviaRoomState(troom));
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Commentaires joueurs ─────────────────────────────────────────────────────
const commentRateMap    = new Map(); // ip → [timestamps]
const commentLikeMap    = new Map(); // commentId (string) → Set<ip>
const commentLikeIpMap  = new Map(); // ip → Set<commentId>

app.get('/api/comments', (_req, res) => {
  const recent = comments.slice(-5).reverse()
    .filter(c => c._id)
    .map(c => ({
      id:     c._id.toString(),
      pseudo: c.pseudo || 'Anonyme',
      message: c.message,
      date:   c.date,
      likes:  commentLikeMap.get(c._id.toString())?.size || 0,
    }));
  res.json(recent);
});

app.post('/api/comment-like', (req, res) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
  const { id } = req.body || {};
  if (!id || typeof id !== 'string') return res.json({ ok: false });
  const ipSet = commentLikeIpMap.get(ip) || new Set();
  if (ipSet.has(id)) return res.json({ ok: false, error: 'already_liked' });
  if (!commentLikeMap.has(id)) commentLikeMap.set(id, new Set());
  commentLikeMap.get(id).add(ip);
  ipSet.add(id);
  commentLikeIpMap.set(ip, ipSet);
  res.json({ ok: true, likes: commentLikeMap.get(id).size });
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
    pseudo:  pseudo?.trim() || 'Anonyme',
    message: message.trim(),
    date:    new Date().toISOString(),
  };
  comments.push(comment);
  dbInsertComment(comment);

  console.log(`[💬] ${pseudo?.trim() || 'Anonyme'} : ${message.trim().slice(0, 80)}`);
  res.json({ ok: true });
});

app.get('/admin/comments', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.query.key !== adminKey) {
    return res.status(401).json({ error: 'Clé invalide.' });
  }
  res.json(comments.slice().reverse()); // plus récent en premier
});

app.get('/admin/reset', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    return res.status(401).json({ error: 'Clé invalide.' });
  }
  leaderboard.clear();
  triviaLeaderboard.clear();
  snakeLeaderboard.clear();
  libs.clear();
  if (db) {
    await Promise.all([
      db.collection('leaderboard').deleteMany({}),
      db.collection('trivia_leaderboard').deleteMany({}),
      db.collection('snake_leaderboard').deleteMany({}),
      db.collection('libs').deleteMany({}),
    ]);
  }
  io.emit('leaderboard-update', []);
  io.emit('trivia-leaderboard-update', []);
  io.emit('snake-leaderboard-update', []);
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

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
})();
