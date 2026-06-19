require('dotenv').config();
const express    = require('express');
const http       = require('http');
const fs         = require('fs');
const path       = require('path');
const { Server } = require('socket.io');
const connect4   = require('./game');
const tictactoe  = require('./game-tictactoe');
const chessGame  = require('./game-chess');
const triviaGame = require('./game-trivia');
const bots       = require('./game-bots');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms           = new Map();
const leaderboard     = new Map();
const triviaRooms     = new Map();
const triviaLeaderboard = new Map();
const comments        = [];

// ── Persistance ────────────────────────────────────────────────────────────
const DATA_FILE   = path.join(__dirname, 'data.json');
const BACKUP_FILE = path.join(require('os').homedir(), '.libero_backup.json');
let saveTimer = null;

function parseData(raw) {
  const json = JSON.parse(raw);
  if (json.leaderboard)       json.leaderboard.forEach(([k, v])       => leaderboard.set(k, v));
  if (json.triviaLeaderboard) json.triviaLeaderboard.forEach(([k, v]) => triviaLeaderboard.set(k, v));
  if (Array.isArray(json.comments)) comments.push(...json.comments);
}

function loadData() {
  // Essaie le fichier principal, sinon le miroir de sauvegarde
  for (const file of [DATA_FILE, BACKUP_FILE]) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      parseData(raw);
      console.log(`Classements chargés depuis ${path.basename(file)}`);
      return;
    } catch { /* essaie le suivant */ }
  }
}

function buildPayload() {
  return JSON.stringify({
    leaderboard:       [...leaderboard.entries()],
    triviaLeaderboard: [...triviaLeaderboard.entries()],
    comments,
    savedAt: new Date().toISOString(),
  }, null, 2);
}

function saveDataSync() {
  const data = buildPayload();
  try { fs.writeFileSync(DATA_FILE,   data); } catch (e) { console.error('Erreur sauvegarde principale :', e); }
  try { fs.writeFileSync(BACKUP_FILE, data); } catch (e) { console.error('Erreur sauvegarde miroir :', e); }
}

function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = buildPayload();
    fs.writeFile(DATA_FILE,   data, err => { if (err) console.error('Erreur sauvegarde principale :', err); });
    fs.writeFile(BACKUP_FILE, data, err => { if (err) console.error('Erreur sauvegarde miroir :', err); });
  }, 1000);
}

// Sauvegarde synchrone à l'arrêt propre du serveur
function onShutdown(signal) {
  console.log(`\n${signal} reçu — sauvegarde des classements…`);
  saveDataSync();
  console.log('Sauvegarde OK. Arrêt.');
  process.exit(0);
}
process.on('SIGTERM', () => onShutdown('SIGTERM'));
process.on('SIGINT',  () => onShutdown('SIGINT'));

// Auto-save périodique toutes les 2 minutes
setInterval(saveDataSync, 2 * 60 * 1000);

loadData();

const CODE_CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECONNECT_MS = 30_000;
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

function updateLeaderboard(name, result) {
  if (!name) return;
  const e = leaderboard.get(name) || { wins: 0, losses: 0, draws: 0 };
  if (result === 'win')  e.wins++;
  if (result === 'loss') e.losses++;
  if (result === 'draw') e.draws++;
  leaderboard.set(name, e);
  saveData();
}

function getLeaderboardData() {
  return [...leaderboard.entries()]
    .map(([name, s]) => ({ name, wins: s.wins, losses: s.losses, draws: s.draws }))
    .sort((a, b) => b.wins - a.wins || (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 10);
}

// ── Trivia leaderboard helpers ─────────────────────────────────────────────

function updateTriviaLeaderboard(name, points) {
  if (!name) return;
  const e = triviaLeaderboard.get(name) || { points: 0, games: 0 };
  e.points += Math.max(0, parseInt(points) || 0);
  e.games++;
  triviaLeaderboard.set(name, e);
  saveData();
}

function getTriviaLeaderboardData() {
  return [...triviaLeaderboard.entries()]
    .map(([name, s]) => ({ name, points: s.points, games: s.games }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
}

// ── Trivia room helpers ────────────────────────────────────────────────────

function getTriviaRoomState(room) {
  return {
    code:         room.code,
    hostId:       room.hostId,
    categoryName: room.categoryName,
    status:       room.status,
    players: [...room.players.entries()].map(([sid, p]) => ({
      socketId: sid, name: p.name, colorIndex: p.colorIndex, score: p.score,
    })),
  };
}

function getRoomScores(room) {
  return [...room.players.entries()]
    .map(([sid, p]) => ({ socketId: sid, name: p.name, score: p.score, colorIndex: p.colorIndex }))
    .sort((a, b) => b.score - a.score);
}

async function startTriviaGame(code) {
  const room = triviaRooms.get(code);
  if (!room) return;
  try {
    const cats = room.categories || [room.category];
    const lang = room.lang || 'fr';
    room.questions = cats.length === 1
      ? await triviaGame.fetchQuestions(cats[0], room.totalQ, lang)
      : await triviaGame.fetchQuestionsMulti(cats, room.totalQ, lang);
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
    updateTriviaLeaderboard(s.name, s.score);
  }
  io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());

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

    if (status !== 'playing' && ['medium', 'hard'].includes(room.botDifficulty)) {
      const humanName = room.playerNames.R;
      if (humanName) {
        if (status === 'won') {
          updateLeaderboard(humanName, winner === 'R' ? 'win' : 'loss');
        } else {
          updateLeaderboard(humanName, 'draw');
        }
        io.emit('leaderboard-update', getLeaderboardData());
      }
    }
  }, 700);
}

// ── Socket ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let roomCode      = null;
  let myPlayer      = null;
  let triviaRoomCode = null;

  // ── Créer une room ──────────────────────────────────────────────────────
  socket.on('create-room', ({ gameType = 'connect4', name = '', vsBot = false, botDifficulty = 'medium' } = {}) => {
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
  socket.on('join-room', ({ code, name = '' }) => {
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
    const key  = (code || '').toUpperCase().trim();
    const room = rooms.get(key);

    if (!room)          { socket.emit('error', { message: 'Room introuvable. Vérifie le code.' }); return; }
    if (room.players.Y) { socket.emit('error', { message: 'Cette room est déjà pleine.' });        return; }

    room.players.Y    = socket.id;
    room.playerNames.Y = playerName;
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
          updateLeaderboard(room.playerNames[winner], 'win');
          updateLeaderboard(room.playerNames[loserRole], 'loss');
        } else {
          updateLeaderboard(room.playerNames.R, 'draw');
          updateLeaderboard(room.playerNames.Y, 'draw');
        }
        io.emit('leaderboard-update', getLeaderboardData());
      } else if (['medium', 'hard'].includes(room.botDifficulty)) {
        // Solo vs bot (moyen/difficile) : enregistrer uniquement le joueur humain
        const humanName = room.playerNames.R;
        if (humanName) {
          if (status === 'won') {
            updateLeaderboard(humanName, winner === 'R' ? 'win' : 'loss');
          } else {
            updateLeaderboard(humanName, 'draw');
          }
          io.emit('leaderboard-update', getLeaderboardData());
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
  socket.on('create-trivia-room', ({ categories, name = '', lang = 'fr' } = {}) => {
    const cats = [].concat(categories || []).map(c => parseInt(c)).filter(c => TRIVIA_CATEGORIES[c]);
    if (cats.length === 0) return;
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
    const roomLang = ['fr', 'en'].includes(lang) ? lang : 'fr';
    const code = generateCode();
    const players = new Map();
    players.set(socket.id, { name: playerName, colorIndex: 0, score: 0 });
    const catNames = cats.map(c => TRIVIA_CATEGORIES[c]);
    const categoryName = cats.length <= 2 ? catNames.join(' · ') : `Mix (${cats.length})`;
    triviaRooms.set(code, {
      code, hostId: socket.id, categories: cats,
      categoryName,
      lang: roomLang,
      players, questions: null, currentQ: -1,
      status: 'waiting', answersThisRound: new Map(),
      timer: null, revealTimer: null, totalQ: TRIVIA_Q_COUNT,
    });
    triviaRoomCode = code;
    socket.join(code);
    socket.emit('trivia-room-created', { code, categoryName, roomState: getTriviaRoomState(triviaRooms.get(code)) });
  });

  // ── Trivia : rejoindre ───────────────────────────────────────────────────
  socket.on('join-trivia-room', ({ code, name = '' } = {}) => {
    const key  = (code || '').toUpperCase().trim();
    const room = triviaRooms.get(key);
    const playerName = String(name).trim().slice(0, 20) || 'Anonyme';
    if (!room)                   { socket.emit('trivia-error', { message: 'Salon introuvable. Vérifie le code.' }); return; }
    if (room.status !== 'waiting') { socket.emit('trivia-error', { message: 'La partie a déjà commencé.' });        return; }
    if (room.players.size >= 6)  { socket.emit('trivia-error', { message: 'Le salon est complet (6 joueurs max).' }); return; }
    const colorIndex = room.players.size;
    room.players.set(socket.id, { name: playerName, colorIndex, score: 0 });
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
  socket.on('fetch-trivia-solo', async ({ categories = [], amount = 10, lang = 'fr' } = {}) => {
    const cats = [].concat(categories).map(c => parseInt(c)).filter(c => TRIVIA_CATEGORIES[c]);
    if (!cats.length) { socket.emit('trivia-solo-error'); return; }
    const l = ['fr', 'en'].includes(lang) ? lang : 'fr';
    const n = Math.min(20, Math.max(1, parseInt(amount) || 10));
    try {
      const qs = cats.length === 1
        ? await triviaGame.fetchQuestions(cats[0], n, l)
        : await triviaGame.fetchQuestionsMulti(cats, n, l);
      socket.emit('trivia-solo-questions', qs);
    } catch { socket.emit('trivia-solo-error'); }
  });

  // ── Trivia : classement ──────────────────────────────────────────────────
  socket.on('get-trivia-leaderboard', () => {
    socket.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  });

  // ── Trivia : fin de partie solo ──────────────────────────────────────────
  socket.on('solo-trivia-finished', ({ name, score } = {}) => {
    const playerName = String(name || '').trim().slice(0, 20) || 'Anonyme';
    updateTriviaLeaderboard(playerName, score);
    io.emit('trivia-leaderboard-update', getTriviaLeaderboardData());
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on('send-message', ({ text }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.Y) return;
    const clean = String(text || '').trim().slice(0, 200);
    if (!clean) return;
    io.to(roomCode).emit('new-message', { player: myPlayer, text: clean, timestamp: Date.now() });
  });

  // ── Déconnexion ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.players[myPlayer] !== socket.id) return;

    room.players[myPlayer] = null;

    if (room.status === 'waiting') { rooms.delete(roomCode); return; }

    const other = myPlayer === 'R' ? 'Y' : 'R';
    if (room.players[other]) io.to(room.players[other]).emit('opponent-reconnecting');

    room.reconnectTimers[myPlayer] = setTimeout(() => {
      if (room.players[myPlayer] !== null) return;
      if (room.players[other]) io.to(room.players[other]).emit('player-disconnected');
      rooms.delete(roomCode);
    }, RECONNECT_MS);

    // Déconnexion d'un salon trivia
    if (triviaRoomCode) {
      const troom = triviaRooms.get(triviaRoomCode);
      if (troom) {
        troom.players.delete(socket.id);
        if (troom.players.size === 0) {
          clearTimeout(troom.timer);
          clearTimeout(troom.revealTimer);
          triviaRooms.delete(triviaRoomCode);
        } else {
          if (troom.hostId === socket.id) troom.hostId = [...troom.players.keys()][0];
          if (troom.status === 'waiting') {
            io.to(triviaRoomCode).emit('trivia-room-updated', getTriviaRoomState(troom));
          } else if (troom.status === 'question') {
            const connectedIds = [...troom.players.keys()].filter(sid => io.sockets.sockets.get(sid)?.connected);
            if (connectedIds.length > 0 && connectedIds.every(sid => troom.answersThisRound.has(sid))) {
              clearTimeout(troom.timer);
              revealTriviaAnswer(triviaRoomCode);
            }
          }
        }
      }
    }
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Commentaires joueurs ─────────────────────────────────────────────────────
const commentRateMap = new Map(); // ip → [timestamps]

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
    return res.status(429).json({ error: 'Limite atteinte. Réessaie dans une heure.' });
  }
  times.push(now);
  commentRateMap.set(ip, times);

  comments.push({
    pseudo:  pseudo?.trim() || 'Anonyme',
    message: message.trim(),
    date:    new Date().toISOString(),
  });
  saveData();

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

app.get('/admin/reset', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    return res.status(401).json({ error: 'Clé invalide.' });
  }
  leaderboard.clear();
  triviaLeaderboard.clear();
  saveData();
  io.emit('leaderboard-update', []);
  io.emit('trivia-leaderboard-update', []);
  res.json({ ok: true, message: 'Classements réinitialisés.' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
