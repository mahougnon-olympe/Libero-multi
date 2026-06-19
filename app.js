// ── État global ─────────────────────────────────────────────────────────────
let myPlayer        = null;   // 'R' | 'Y'
let gameActive      = false;
let currentRoomCode = null;
let currentGame     = null;   // 'connect4' | 'tictactoe' | 'chess'
let selectedGameType = 'connect4';
let isBotGame = false;
let currentTurnPlayer = null;

// ── Langue ───────────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('lang') || 'fr';

const TRIVIA_API_CAT_MAP = {
  9:'general_knowledge', 23:'history', 22:'geography', 17:'science',
  21:'sport_and_leisure', 11:'film_and_tv', 12:'music', 14:'film_and_tv',
  19:'science', 20:'science', 25:'arts_and_literature', 27:'general_knowledge',
};

const DICT = {
  fr: {
    siteTitle:'Jeux Multijoueur', siteSubtitle:'Choisissez votre catégorie',
    classicTitle:'Jeux Classiques', classicDesc:'Puissance 4 · Morpion · Échecs',
    triviaTitle:'Culture Générale', triviaDesc:'Quiz par thèmes · Solo & Multi',
    homeSubtitle:'2 joueurs • Temps réel',
    botLabel:'🤖 Jouer seul contre le robot :',
    botEasy:'😊 Facile', botMedium:'🎯 Moyen', botHard:'💀 Difficile',
    btnCreate:'Créer une partie multijoueur',
    namePh:'Ton pseudo (optionnel)', codePh:'Code à 4 lettres',
    btnJoin:'Rejoindre', dividerJoin:'ou rejoindre', lbTitle:'Classement',
    lbEmpty:'Aucune partie jouée pour l\'instant.',
    lbW:'V', lbL:'D', lbD:'N',
    btnCopyCode:'Copier le code', codeCopied:'Copié !',
    waitingFor:'En attente d\'un adversaire…', shareCode:'Partage ce code :',
    waitingHint:'La partie démarre automatiquement dès que ton adversaire rejoint.',
    myTurn:'Ton tour', oppTurn:'Adversaire joue…', botThinking:'🤖 Robot réfléchit…',
    youWon:'🏆 Tu as gagné !', youLost:'😞 Tu as perdu.', gameDraw:'🤝 Match nul !',
    btnRestart:'Rejouer', btnMenu:'Menu principal',
    restartPending:'En attente de l\'adversaire…',
    chatTitle:'Chat', chatClear:'Vider', chatPh:'Envoyer un message…',
    dcReconnecting:'Connexion interrompue',
    dcReconnectingMsg:'L\'adversaire se reconnecte… (30 s)',
    dcDisconnected:'Adversaire déconnecté',
    dcDisconnectedMsg:'L\'adversaire a quitté la partie.',
    btnBackHome:'Retour à l\'accueil', backLabel:'Retour',
    promoTitle:'Promouvoir le pion',
    games:{ connect4:'Puissance 4', tictactoe:'Tic Tac Toe', chess:'Échecs' },
    playerNames:{
      connect4:{ R:'Rouge', Y:'Jaune' },
      tictactoe:{ R:'Croix', Y:'Rond' },
      chess:{ R:'Blancs', Y:'Noirs' },
    },
    diffLabels:{ easy:'Facile', medium:'Moyen', hard:'Difficile' },
    triviaHomeTitle:'🧠 Culture Générale',
    triviaHomeSubtitle:'Choisis un ou plusieurs thèmes et joue !',
    triviaNamePh:'Ton pseudo (optionnel)',
    triviaThemesLabel:'Thèmes (sélection multiple) :',
    btnSolo:'▶ Solo', btnCreateTrivia:'+ Créer un salon',
    triviaCodePh:'Code à 4 lettres', btnJoinTrivia:'Rejoindre',
    triviaLbTitle:'Classement Quiz',
    triviaLbEmpty:'Aucune partie jouée pour l\'instant.',
    triviaLbPts:'pts', triviaLbGames:'quiz',
    triviaWaitTitle:'En attente de joueurs…', triviaWaitCode:'Code du salon :',
    btnTriviaCopy:'Copier le code', btnStartTrivia:'▶ Démarrer la partie',
    btnLeaveTrivia:'Quitter le salon',
    triviaWaitHint:'1 à 6 joueurs. Démarre dès que tu es prêt·e.',
    triviaCorrect:'✅ Bonne réponse !', triviaWrong:'❌ La réponse était : ',
    triviaFinishedTitle:'Résultats finaux', btnLeaveGame:'Retour au menu',
    errNoTheme:'Choisis au moins un thème pour commencer.',
    errLoadQ:'Impossible de charger les questions. Vérifie ta connexion.',
    err4Letters:'Entre un code à 4 lettres.',
    soloLoading:'⏳ Chargement…',
    mixLabel:n => `🎲 Mix (${n} thèmes)`,
    colLabel:n => `Jouer colonne ${n}`,
    restartRequested:"\nL'adversaire veut rejouer !",
    errConnect:'Impossible de joindre le serveur. Réessaie.',
    help:{ title:'Aide', tabs:{ general:'Général', quiz:'Quiz', connect4:'Puissance 4', ttt:'Morpion', chess:'Échecs' } },
    triviaCats:[
      { id:9,  name:'Culture G.', icon:'🧠' }, { id:23, name:'Histoire',   icon:'📜' },
      { id:22, name:'Géographie', icon:'🌍' }, { id:17, name:'Sciences',   icon:'🔬' },
      { id:21, name:'Sports',     icon:'⚽' }, { id:11, name:'Cinéma',     icon:'🎬' },
      { id:12, name:'Musique',    icon:'🎵' }, { id:14, name:'Télévision', icon:'📺' },
      { id:19, name:'Maths',      icon:'🔢' }, { id:20, name:'Info',       icon:'💻' },
      { id:25, name:'Arts',       icon:'🎨' }, { id:27, name:'Animaux',    icon:'🐾' },
    ],
  },
  en: {
    siteTitle:'Multiplayer Games', siteSubtitle:'Choose your category',
    classicTitle:'Classic Games', classicDesc:'Connect 4 · Tic Tac Toe · Chess',
    triviaTitle:'General Knowledge', triviaDesc:'Themed quizzes · Solo & Multi',
    homeSubtitle:'2 players • Real time',
    botLabel:'🤖 Play solo against the bot:',
    botEasy:'😊 Easy', botMedium:'🎯 Medium', botHard:'💀 Hard',
    btnCreate:'Create a multiplayer game',
    namePh:'Your username (optional)', codePh:'4-letter code',
    btnJoin:'Join', dividerJoin:'or join', lbTitle:'Leaderboard',
    lbEmpty:'No games played yet.',
    lbW:'W', lbL:'L', lbD:'D',
    btnCopyCode:'Copy code', codeCopied:'Copied!',
    waitingFor:'Waiting for an opponent…', shareCode:'Share this code:',
    waitingHint:'The game starts automatically when your opponent joins.',
    myTurn:'Your turn', oppTurn:'Opponent playing…', botThinking:'🤖 Bot thinking…',
    youWon:'🏆 You won!', youLost:'😞 You lost.', gameDraw:'🤝 Draw!',
    btnRestart:'Play again', btnMenu:'Main menu',
    restartPending:'Waiting for opponent…',
    chatTitle:'Chat', chatClear:'Clear', chatPh:'Send a message…',
    dcReconnecting:'Connection lost',
    dcReconnectingMsg:'Opponent is reconnecting… (30 s)',
    dcDisconnected:'Opponent disconnected',
    dcDisconnectedMsg:'Your opponent left the game.',
    btnBackHome:'Back to home', backLabel:'Back',
    promoTitle:'Promote pawn',
    games:{ connect4:'Connect 4', tictactoe:'Tic Tac Toe', chess:'Chess' },
    playerNames:{
      connect4:{ R:'Red', Y:'Yellow' },
      tictactoe:{ R:'Cross', Y:'Circle' },
      chess:{ R:'White', Y:'Black' },
    },
    diffLabels:{ easy:'Easy', medium:'Medium', hard:'Hard' },
    triviaHomeTitle:'🧠 General Knowledge',
    triviaHomeSubtitle:'Choose one or more themes and play!',
    triviaNamePh:'Your username (optional)',
    triviaThemesLabel:'Themes (multiple selection):',
    btnSolo:'▶ Solo', btnCreateTrivia:'+ Create a room',
    triviaCodePh:'4-letter code', btnJoinTrivia:'Join',
    triviaLbTitle:'Quiz Leaderboard',
    triviaLbEmpty:'No games played yet.',
    triviaLbPts:'pts', triviaLbGames:'quiz',
    triviaWaitTitle:'Waiting for players…', triviaWaitCode:'Room code:',
    btnTriviaCopy:'Copy code', btnStartTrivia:'▶ Start game',
    btnLeaveTrivia:'Leave room',
    triviaWaitHint:'1 to 6 players. Start whenever you\'re ready.',
    triviaCorrect:'✅ Correct!', triviaWrong:'❌ The answer was: ',
    triviaFinishedTitle:'Final Results', btnLeaveGame:'Back to menu',
    errNoTheme:'Choose at least one theme to start.',
    errLoadQ:'Could not load questions. Check your connection.',
    err4Letters:'Enter a 4-letter code.',
    soloLoading:'⏳ Loading…',
    mixLabel:n => `🎲 Mix (${n} themes)`,
    colLabel:n => `Play column ${n}`,
    restartRequested:'\nOpponent wants to play again!',
    errConnect:'Cannot reach the server. Please try again.',
    help:{ title:'Help', tabs:{ general:'General', quiz:'Quiz', connect4:'Connect 4', ttt:'Tic Tac Toe', chess:'Chess' } },
    triviaCats:[
      { id:9,  name:'General',   icon:'🧠' }, { id:23, name:'History',   icon:'📜' },
      { id:22, name:'Geography', icon:'🌍' }, { id:17, name:'Science',   icon:'🔬' },
      { id:21, name:'Sports',    icon:'⚽' }, { id:11, name:'Movies',    icon:'🎬' },
      { id:12, name:'Music',     icon:'🎵' }, { id:14, name:'TV',        icon:'📺' },
      { id:19, name:'Maths',     icon:'🔢' }, { id:20, name:'Computing', icon:'💻' },
      { id:25, name:'Arts',      icon:'🎨' }, { id:27, name:'Animals',   icon:'🐾' },
    ],
  },
};

function t() { return DICT[currentLang]; }

function applyLang() {
  const d = t();
  document.documentElement.lang = currentLang;
  document.title = d.siteTitle;
  const bl = $('btn-lang');
  if (bl) bl.textContent = currentLang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR';

  // Landing
  const lt = $('landing-title');   if (lt) lt.textContent = d.siteTitle;
  const ls = $('landing-subtitle'); if (ls) ls.textContent = d.siteSubtitle;
  const bc = $('btn-go-classic');
  if (bc) { bc.querySelector('h2').textContent = d.classicTitle; bc.querySelector('p').textContent = d.classicDesc; }
  const bgt = $('btn-go-trivia');
  if (bgt) { bgt.querySelector('h2').textContent = d.triviaTitle; bgt.querySelector('p').textContent = d.triviaDesc; }

  // Home classic
  const hs = $('home-subtitle');   if (hs) hs.textContent = d.homeSubtitle;
  const gnc = $('gn-connect4');    if (gnc) gnc.textContent = d.games.connect4;
  const gntt = $('gn-tictactoe'); if (gntt) gntt.textContent = d.games.tictactoe;
  const gnch = $('gn-chess');     if (gnch) gnch.textContent = d.games.chess;
  const blp = $('bot-label-p');   if (blp) blp.textContent = d.botLabel;
  document.querySelectorAll('.bot-btn').forEach(b => {
    const key = 'bot' + b.dataset.diff[0].toUpperCase() + b.dataset.diff.slice(1);
    b.textContent = d[key];
  });
  const bcc = $('btn-create');    if (bcc) bcc.textContent = d.btnCreate;
  const inp = $('input-name');    if (inp) inp.placeholder = d.namePh;
  const inc = $('input-code');    if (inc) inc.placeholder = d.codePh;
  const bj  = $('btn-join');      if (bj)  bj.textContent  = d.btnJoin;
  const djt = $('divider-join-text'); if (djt) djt.textContent = d.dividerJoin;
  const lbc = $('lb-title-classic'); if (lbc) lbc.textContent = d.lbTitle;
  const bco = $('btn-copy');      if (bco) bco.textContent = d.btnCopyCode;
  const bba = $('btn-back-classic'); if (bba) bba.textContent = `← ${d.backLabel}`;

  // Waiting screen
  const wt = $('waiting-title');  if (wt) wt.textContent = d.waitingFor;
  const ws = $('waiting-share');  if (ws) ws.textContent = d.shareCode;
  const wh = $('waiting-hint');   if (wh) wh.textContent = d.waitingHint;

  // Game screen
  const brs = $('btn-restart');   if (brs) brs.textContent = d.btnRestart;
  const bmu = $('btn-menu');      if (bmu) bmu.textContent = d.btnMenu;
  const rpe = $('restart-pending'); if (rpe) rpe.textContent = d.restartPending;
  const cts = $('chat-title-span'); if (cts) cts.textContent = d.chatTitle;
  const bclc = $('btn-clear-chat'); if (bclc) bclc.textContent = d.chatClear;
  const ci  = $('chat-input');    if (ci) ci.placeholder = d.chatPh;
  const pt  = $('promo-title');   if (pt) pt.textContent = d.promoTitle;

  // Trivia home
  const tht  = $('trivia-home-title');    if (tht)  tht.textContent  = d.triviaHomeTitle;
  const thsu = $('trivia-home-subtitle'); if (thsu) thsu.textContent = d.triviaHomeSubtitle;
  const itn  = $('input-trivia-name');    if (itn)  itn.placeholder  = d.triviaNamePh;
  const ttl  = $('trivia-theme-label');   if (ttl)  ttl.textContent  = d.triviaThemesLabel;
  const bso  = $('btn-solo-trivia');      if (bso)  bso.textContent  = d.btnSolo;
  const bct2 = $('btn-create-trivia');    if (bct2) bct2.textContent = d.btnCreateTrivia;
  const itc  = $('input-trivia-code');    if (itc)  itc.placeholder  = d.triviaCodePh;
  const bjt2 = $('btn-join-trivia');      if (bjt2) bjt2.textContent = d.btnJoinTrivia;
  const lbtt = $('lb-title-trivia');      if (lbtt) lbtt.textContent = d.triviaLbTitle;
  const btc  = $('btn-trivia-copy');      if (btc)  btc.textContent  = d.btnTriviaCopy;
  const bbth = $('btn-back-trivia-home'); if (bbth) bbth.textContent = `← ${d.backLabel}`;

  // Trivia waiting
  const twt  = $('trivia-waiting-title');  if (twt)  twt.textContent  = d.triviaWaitTitle;
  const tws  = $('trivia-waiting-share');  if (tws)  tws.textContent  = d.triviaWaitCode;
  const twh  = $('trivia-waiting-hint');   if (twh)  twh.textContent  = d.triviaWaitHint;
  const bstt = $('btn-start-trivia');      if (bstt) bstt.textContent = d.btnStartTrivia;
  const bltw = $('btn-leave-trivia-wait'); if (bltw) bltw.textContent = d.btnLeaveTrivia;

  // Trivia game
  const tft  = $('tg-finished-title');     if (tft)  tft.textContent  = d.triviaFinishedTitle;
  const bltg = $('btn-leave-trivia-game'); if (bltg) bltg.textContent = d.btnLeaveGame;

  // Help modal
  const hmt = $('help-modal-title'); if (hmt) hmt.textContent = d.help.title;
  document.querySelectorAll('.help-tab').forEach(tab => {
    const lbl = d.help.tabs[tab.dataset.tab];
    if (lbl) tab.textContent = lbl;
  });

  // Rebuild trivia themes (garde les sélections actives)
  $('trivia-themes').innerHTML = '';
}

// État échecs
let selectedSquare  = null;
let availableMoves  = [];
let currentFen      = null;
let lastMove        = null;   // { from, to }
let pendingPromoMove = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Socket ───────────────────────────────────────────────────────────────────
const socket = io(window.BACKEND_URL, { transports: ['websocket', 'polling'] });

// ── Navigation ───────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  if (window._tutoOnScreen) window._tutoOnScreen(name);
}

// ── Trivia : constantes ───────────────────────────────────────────────────────
const TRIVIA_COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2'];

// ── Trivia : état ─────────────────────────────────────────────────────────────
let selectedTriviaCategories = [];
let triviaRoomCode         = null;
let triviaIsHost           = false;
let triviaIsSolo           = false;
let triviaAnsweredThis     = false;
let triviaChoiceSelected   = null;
let triviaTimerInterval    = null;
let triviaQuestions        = [];
let triviaCurrentQ         = 0;
let triviaScore            = 0;
let triviaMySocketId       = null;

// ── Données par type de jeu ──────────────────────────────────────────────────
const PLAYER_ICONS = {
  connect4:  { R: '🔴', Y: '🟡' },
  tictactoe: { R: '✕',  Y: '○' },
  chess:     { R: '♔',  Y: '♚' },
};

// ── Landing ───────────────────────────────────────────────────────────────────
$('btn-go-classic').addEventListener('click', () => showScreen('home'));
$('btn-go-trivia').addEventListener('click',  () => { buildTriviaThemes(); showScreen('trivia-home'); socket.emit('get-trivia-leaderboard'); });
$('btn-back-classic').addEventListener('click', () => showScreen('landing'));

// ── Pseudo ────────────────────────────────────────────────────────────────────
$('input-name').value = localStorage.getItem('playerName') || '';
$('input-name').addEventListener('input', e => {
  localStorage.setItem('playerName', e.target.value.trim());
});
function getPlayerName() { return ($('input-name').value.trim()) || ''; }

// ── Sélecteur de jeu (accueil) ───────────────────────────────────────────────
document.querySelectorAll('.game-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGameType = btn.dataset.game;
  });
});

// ── Accueil ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.bot-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    clearError();
    socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), vsBot: true, botDifficulty: btn.dataset.diff });
  });
});

$('btn-create').addEventListener('click', () => {
  clearError();
  socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName() });
});

$('btn-join').addEventListener('click', joinRoom);
$('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('input-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

function joinRoom() {
  const code = $('input-code').value.trim().toUpperCase();
  if (code.length !== 4) { showError(t().err4Letters); return; }
  clearError();
  currentRoomCode = code;
  socket.emit('join-room', { code, name: getPlayerName() });
}

function showError(msg) { const e = $('error-msg'); e.textContent = msg; e.classList.remove('hidden'); }
function clearError()   { $('error-msg').classList.add('hidden'); }

// ── Session (reload) ──────────────────────────────────────────────────────────
function saveSession(code, player) {
  sessionStorage.setItem('p4session', JSON.stringify({ roomCode: code, player }));
}
function clearSession() { sessionStorage.removeItem('p4session'); }

// ── Attente ───────────────────────────────────────────────────────────────────
$('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('room-code').textContent).then(() => {
    $('btn-copy').textContent = t().codeCopied;
    setTimeout(() => { $('btn-copy').textContent = t().btnCopyCode; }, 2000);
  });
});

// ── Header joueurs ────────────────────────────────────────────────────────────
function setPlayerBadges(gameType, yourPlayer) {
  const icons = PLAYER_ICONS[gameType];
  const names = t().playerNames[gameType];
  $('badge-r-icon').textContent = icons.R;
  $('badge-y-icon').textContent = icons.Y;
  $('label-r').textContent = names.R;
  $('label-y').textContent = names.Y;
  $('badge-r').classList.toggle('you', yourPlayer === 'R');
  $('badge-y').classList.toggle('you', yourPlayer === 'Y');
}

function updateTurnUI(currentPlayer, gameType) {
  currentTurnPlayer = currentPlayer;
  const isMyTurn = currentPlayer === myPlayer;
  $('turn-indicator').textContent = isMyTurn ? t().myTurn : (isBotGame ? t().botThinking : t().oppTurn);
  $('badge-r').classList.toggle('active', currentPlayer === 'R');
  $('badge-y').classList.toggle('active', currentPlayer === 'Y');

  // Activer/désactiver les contrôles selon le jeu
  if (gameType === 'connect4') setArrowsEnabled(isMyTurn && gameActive);
  if (gameType === 'tictactoe') setTTTEnabled(isMyTurn && gameActive);
  // Chess : géré par selectedSquare + clic
}

// ── Retour au menu principal ──────────────────────────────────────────────────
function goToHome() {
  socket.emit('leave-room');
  clearSession();

  myPlayer = null;
  gameActive = false;
  isBotGame = false;
  currentRoomCode = null;
  currentGame = null;
  currentTurnPlayer = null;
  selectedSquare = null;
  availableMoves = [];
  currentFen = null;
  lastMove = null;
  pendingPromoMove = null;

  $('board-area').innerHTML = '';
  $('game-status').classList.add('hidden');
  $('overlay-disconnect').classList.add('hidden');
  $('overlay-promotion').classList.add('hidden');
  clearChat();
  clearError();
  showScreen('home');
}

// ── Fin de partie ─────────────────────────────────────────────────────────────
function showGameOver(status, winner) {
  gameActive = false;
  if (currentGame === 'connect4') setArrowsEnabled(false);
  if (currentGame === 'tictactoe') setTTTEnabled(false);

  const isWinner = winner === myPlayer;
  if (status === 'won') {
    $('status-text').textContent = isWinner ? t().youWon : t().youLost;
  } else {
    $('status-text').textContent = t().gameDraw;
  }
  $('game-status').classList.remove('hidden');
  $('btn-restart').classList.remove('hidden');
  $('btn-restart').disabled = false;
  $('restart-pending').classList.add('hidden');
  $('btn-menu').classList.remove('hidden');
}

// ── Appliquer l'état de jeu (game-start / reconnect-success) ─────────────────
function applyGameState({ gameType, state, yourPlayer, status, winner }) {
  currentGame = gameType;
  myPlayer    = yourPlayer;
  gameActive  = status === 'playing';
  currentTurnPlayer = state.currentPlayer;

  setPlayerBadges(gameType, yourPlayer);
  $('game-status').classList.add('hidden');
  $('btn-restart').classList.remove('hidden');
  $('btn-restart').disabled = false;
  $('restart-pending').classList.add('hidden');
  $('btn-menu').classList.add('hidden');

  clearChat();
  buildGameBoard(gameType, state, yourPlayer);

  if (status === 'playing') {
    updateTurnUI(state.currentPlayer, gameType);
  } else {
    $('turn-indicator').textContent = '';
    showGameOver(status, winner);
  }
}

// ── Construction du plateau selon le type de jeu ──────────────────────────────
function buildGameBoard(gameType, state, yourPlayer) {
  const area = $('board-area');
  area.innerHTML = '';
  selectedSquare = null;
  availableMoves = [];

  switch (gameType) {
    case 'connect4':  buildConnect4(area, state.board); break;
    case 'tictactoe': buildTTT(area, state.board);      break;
    case 'chess':     buildChess(area, state, yourPlayer); break;
  }
}

function updateGameBoard(gameType, state) {
  switch (gameType) {
    case 'connect4':  updateConnect4(state.board);                          break;
    case 'tictactoe': updateTTT(state.board, state.winLine);                break;
    case 'chess':     updateChess(state.fen, state.isCheck, state.currentPlayer); break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUISSANCE 4
// ══════════════════════════════════════════════════════════════════════════════
function buildConnect4(container, board) {
  const arrows = document.createElement('div');
  arrows.id = 'col-arrows';
  arrows.className = 'col-arrows';

  for (let col = 0; col < 7; col++) {
    const btn = document.createElement('button');
    btn.className = 'col-btn';
    btn.textContent = '▼';
    btn.dataset.col = col;
    btn.setAttribute('aria-label', t().colLabel(col + 1));
    btn.addEventListener('click', () => { if (gameActive) socket.emit('make-move', { col }); });
    arrows.appendChild(btn);
  }

  const boardEl = document.createElement('div');
  boardEl.id = 'c4-board';
  boardEl.className = 'c4-board';

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      boardEl.appendChild(cell);
    }
  }

  container.appendChild(arrows);
  container.appendChild(boardEl);
  updateConnect4(board);
}

function updateConnect4(board) {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = document.querySelector(`.c4-cell[data-row="${row}"][data-col="${col}"]`);
      if (!cell) continue;
      const val = board[row][col];
      const wasEmpty = !cell.classList.contains('red') && !cell.classList.contains('yellow');
      cell.classList.remove('red', 'yellow', 'win');
      if (val === 'R') { cell.classList.add('red');    if (wasEmpty) void cell.offsetWidth; }
      if (val === 'Y') { cell.classList.add('yellow'); if (wasEmpty) void cell.offsetWidth; }
    }
  }
}

function highlightConnect4Win(board, winner) {
  const ROWS = 6, COLS = 7;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  const winning = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== winner) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== winner) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) cells.forEach(([row, col]) => winning.add(`${row}-${col}`));
      }
    }
  }
  winning.forEach(k => {
    const [row, col] = k.split('-');
    document.querySelector(`.c4-cell[data-row="${row}"][data-col="${col}"]`)?.classList.add('win');
  });
}

function setArrowsEnabled(enabled) {
  document.querySelectorAll('.col-btn').forEach(b => { b.disabled = !enabled; });
}

// ══════════════════════════════════════════════════════════════════════════════
// TIC TAC TOE
// ══════════════════════════════════════════════════════════════════════════════
function buildTTT(container, board) {
  const boardEl = document.createElement('div');
  boardEl.className = 'ttt-board';

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'ttt-cell';
    cell.dataset.idx = i;
    cell.addEventListener('click', () => {
      if (!gameActive || cell.classList.contains('played')) return;
      socket.emit('make-move', { cell: i });
    });
    boardEl.appendChild(cell);
  }

  container.appendChild(boardEl);
  updateTTT(board, null);
}

function updateTTT(board, winLine) {
  document.querySelectorAll('.ttt-cell').forEach((cell, i) => {
    cell.classList.remove('ttt-r', 'ttt-y', 'played', 'win-cell');
    const val = board[i];
    if (val === 'R') { cell.textContent = '✕'; cell.classList.add('ttt-r', 'played'); }
    else if (val === 'Y') { cell.textContent = '○'; cell.classList.add('ttt-y', 'played'); }
    else { cell.textContent = ''; }
    if (winLine?.includes(i)) cell.classList.add('win-cell');
  });
}

function setTTTEnabled(enabled) {
  document.querySelectorAll('.ttt-cell').forEach(c => {
    c.style.cursor = (enabled && !c.classList.contains('played')) ? 'pointer' : 'default';
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ÉCHECS
// ══════════════════════════════════════════════════════════════════════════════
const CHESS_UNICODE = {
  K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
  k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
};

function parseFenBoard(fen) {
  const board = {};
  const ranks = fen.split(' ')[0].split('/');
  for (let ri = 0; ri < 8; ri++) {
    let fi = 0;
    for (const ch of ranks[ri]) {
      if (isNaN(ch)) {
        board[`${String.fromCharCode(97 + fi)}${8 - ri}`] = ch;
        fi++;
      } else { fi += parseInt(ch); }
    }
  }
  return board;
}

function isPawnPromotion(from, to, fenBoard) {
  const piece = fenBoard[from];
  if (piece === 'P' && to[1] === '8') return true;
  if (piece === 'p' && to[1] === '1') return true;
  return false;
}

function buildChess(container, state, yourPlayer) {
  currentFen = state.fen;
  lastMove   = null;
  const flipped = yourPlayer === 'Y';

  // Rangée de labels de fichiers (a-h)
  function makeFilesRow(flipped) {
    const row = document.createElement('div');
    row.style.cssText = `display:grid;grid-template-columns:16px repeat(8,var(--chess-cell)) 16px;`;
    row.appendChild(document.createElement('span'));
    for (let c = 0; c < 8; c++) {
      const fi = flipped ? 7 - c : c;
      const span = document.createElement('span');
      span.className = 'chess-coord';
      span.textContent = String.fromCharCode(97 + fi);
      row.appendChild(span);
    }
    row.appendChild(document.createElement('span'));
    return row;
  }

  // Ligne centrale (rangs + plateau + rangs)
  const midRow = document.createElement('div');
  midRow.style.cssText = 'display:grid;grid-template-columns:16px auto 16px;align-items:center;';

  const leftRanks  = document.createElement('div');
  leftRanks.style.cssText = `display:grid;grid-template-rows:repeat(8,var(--chess-cell));`;
  const rightRanks = leftRanks.cloneNode();

  for (let r = 0; r < 8; r++) {
    const rank = flipped ? r + 1 : 8 - r;
    const mkSpan = () => {
      const s = document.createElement('span');
      s.className = 'chess-coord';
      s.textContent = rank;
      return s;
    };
    leftRanks.appendChild(mkSpan());
    rightRanks.appendChild(mkSpan());
  }

  const boardEl = document.createElement('div');
  boardEl.id = 'chess-board';
  boardEl.className = 'chess-board';

  for (let gridRow = 0; gridRow < 8; gridRow++) {
    for (let gridCol = 0; gridCol < 8; gridCol++) {
      const rank    = flipped ? gridRow + 1 : 8 - gridRow;
      const fileIdx = flipped ? 7 - gridCol : gridCol;
      const square  = `${String.fromCharCode(97 + fileIdx)}${rank}`;
      const isLight = (gridRow + gridCol) % 2 === 0;

      const sq = document.createElement('div');
      sq.className = `chess-sq ${isLight ? 'light' : 'dark'}`;
      sq.dataset.sq = square;
      sq.addEventListener('click', () => onChessClick(square));
      boardEl.appendChild(sq);
    }
  }

  midRow.appendChild(leftRanks);
  midRow.appendChild(boardEl);
  midRow.appendChild(rightRanks);

  const wrapper = document.createElement('div');
  wrapper.className = 'chess-wrapper';
  wrapper.appendChild(makeFilesRow(flipped));
  wrapper.appendChild(midRow);
  wrapper.appendChild(makeFilesRow(flipped));

  container.appendChild(wrapper);
  updateChess(state.fen, state.isCheck, state.currentPlayer);
}

function updateChess(fen, isCheck, currentPlayer) {
  currentFen = fen;
  const fenBoard = parseFenBoard(fen);

  document.querySelectorAll('.chess-sq').forEach(sq => {
    const square = sq.dataset.sq;
    const piece  = fenBoard[square];

    // Réinitialiser
    sq.classList.remove('selected', 'can-move', 'has-piece', 'in-check', 'last-move');

    // Pièce
    sq.innerHTML = '';
    if (piece) {
      const sp = document.createElement('span');
      sp.className = piece === piece.toUpperCase() ? 'cp-w' : 'cp-b';
      sp.textContent = CHESS_UNICODE[piece];
      sq.appendChild(sp);
    }

    // Dernier coup
    if (lastMove && (square === lastMove.from || square === lastMove.to)) {
      sq.classList.add('last-move');
    }

    // Roi en échec
    if (isCheck) {
      const kingPiece = currentPlayer === 'R' ? 'K' : 'k';
      if (piece === kingPiece) sq.classList.add('in-check');
    }
  });

  // Re-appliquer la sélection si une case est encore sélectionnée
  if (selectedSquare) {
    document.querySelector(`.chess-sq[data-sq="${selectedSquare}"]`)?.classList.add('selected');
    availableMoves.forEach(mv => {
      const el = document.querySelector(`.chess-sq[data-sq="${mv}"]`);
      if (el) {
        el.classList.add('can-move');
        if (el.firstChild) el.classList.add('has-piece');
      }
    });
  }
}

function clearChessSelection() {
  selectedSquare = null;
  availableMoves = [];
  document.querySelectorAll('.chess-sq.selected, .chess-sq.can-move, .chess-sq.has-piece').forEach(el => {
    el.classList.remove('selected', 'can-move', 'has-piece');
  });
}

function onChessClick(square) {
  if (!gameActive || currentTurnPlayer !== myPlayer) return;

  // Clic sur une case cible → jouer le coup
  if (selectedSquare && availableMoves.includes(square)) {
    const from = selectedSquare;
    const to   = square;
    clearChessSelection();

    const fenBoard = parseFenBoard(currentFen);
    if (isPawnPromotion(from, to, fenBoard)) {
      pendingPromoMove = { from, to };
      showPromoModal(myPlayer);
    } else {
      lastMove = { from, to };
      socket.emit('make-move', { from, to });
    }
    return;
  }

  // Clic sur une pièce → sélectionner
  clearChessSelection();
  const fenBoard = parseFenBoard(currentFen);
  const piece = fenBoard[square];
  if (!piece) return;

  // Vérifier que c'est bien notre pièce
  const isWhitePiece = piece === piece.toUpperCase();
  if ((myPlayer === 'R') !== isWhitePiece) return;

  selectedSquare = square;
  document.querySelector(`.chess-sq[data-sq="${square}"]`)?.classList.add('selected');
  socket.emit('get-moves', { square });
}

// ── Promotion du pion ─────────────────────────────────────────────────────────
function showPromoModal(player) {
  const choices = [
    { piece: 'q', icon: player === 'R' ? '♕' : '♛', label: 'Dame' },
    { piece: 'r', icon: player === 'R' ? '♖' : '♜', label: 'Tour' },
    { piece: 'b', icon: player === 'R' ? '♗' : '♝', label: 'Fou' },
    { piece: 'n', icon: player === 'R' ? '♘' : '♞', label: 'Cavalier' },
  ];

  const container = $('promo-choices');
  container.innerHTML = '';
  choices.forEach(({ piece, icon, label }) => {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    const cls = player === 'R' ? 'cp-w' : 'cp-b';
    btn.innerHTML = `<span class="${cls}">${icon}</span><span>${label}</span>`;
    btn.addEventListener('click', () => {
      $('overlay-promotion').classList.add('hidden');
      if (pendingPromoMove) {
        lastMove = { ...pendingPromoMove };
        socket.emit('make-move', { ...pendingPromoMove, promotion: piece });
        pendingPromoMove = null;
      }
    });
    container.appendChild(btn);
  });

  $('overlay-promotion').classList.remove('hidden');
}

// ── Rejouer ───────────────────────────────────────────────────────────────────
$('btn-restart').addEventListener('click', () => {
  socket.emit('request-restart');
  if (!isBotGame) {
    $('btn-restart').disabled = true;
    $('restart-pending').classList.remove('hidden');
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────
$('btn-clear-chat').addEventListener('click', () => { $('chat-messages').innerHTML = ''; });

$('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  socket.emit('send-message', { text });
  input.value = '';
});

function appendMessage({ player, text, timestamp }) {
  const time = new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const mine = player === myPlayer;
  const msg  = document.createElement('div');
  msg.className = `msg ${mine ? 'msg-mine' : 'msg-theirs'}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  const meta = document.createElement('span');
  meta.className = 'msg-meta';
  meta.textContent = time;

  msg.appendChild(bubble);
  msg.appendChild(meta);

  const el = $('chat-messages');
  el.appendChild(msg);
  el.scrollTop = el.scrollHeight;
}

function clearChat() {
  $('chat-messages').innerHTML = '';
  $('chat-input').value = '';
}

// ── Classement ────────────────────────────────────────────────────────────────
function renderLeaderboard(data) {
  const list = $('leaderboard-list');
  if (!data || data.length === 0) {
    list.innerHTML = `<p class="lb-empty">${t().lbEmpty}</p>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const classes = ['gold', 'silver', 'bronze'];
  list.innerHTML = data.map((entry, i) => `
    <div class="lb-row">
      <span class="lb-rank ${classes[i] || ''}">${medals[i] || i + 1}</span>
      <span class="lb-name">${entry.name}</span>
      <div class="lb-stats">
        <span class="lb-w">${entry.wins}${t().lbW}</span>
        <span class="lb-l">${entry.losses}${t().lbL}</span>
        <span class="lb-d">${entry.draws}${t().lbD}</span>
      </div>
    </div>
  `).join('');
}

// ── Trivia : utilitaires ──────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTriviaName() { return ($('input-trivia-name').value.trim()) || ''; }

function getCategoryLabel(ids) {
  const cats = t().triviaCats;
  const names = ids.map(id => {
    const c = cats.find(c => c.id === id);
    return c ? `${c.icon} ${c.name}` : '';
  }).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(' · ');
  return t().mixLabel(names.length);
}


function showTriviaError(msg) { const e = $('trivia-error-msg'); e.textContent = msg; e.classList.remove('hidden'); }
function clearTriviaError()   { $('trivia-error-msg').classList.add('hidden'); }

function goToTriviaHome() {
  if (triviaRoomCode) socket.emit('leave-trivia-room');
  stopTriviaTimer();
  triviaRoomCode = null; triviaIsHost = false; triviaIsSolo = false;
  triviaAnsweredThis = false; triviaChoiceSelected = null;
  triviaQuestions = []; triviaCurrentQ = 0; triviaScore = 0;
  selectedTriviaCategories = [];
  document.querySelectorAll('#trivia-themes .theme-btn').forEach(b => b.classList.remove('active'));
  $('tg-choices').innerHTML = '';
  $('tg-reveal').classList.add('hidden');
  $('tg-finished').classList.add('hidden');
  clearTriviaError();
  showScreen('trivia-home');
}

// ── Trivia : thèmes ───────────────────────────────────────────────────────────
function buildTriviaThemes() {
  const container = $('trivia-themes');
  container.innerHTML = t().triviaCats.map(c => `
    <button class="theme-btn${selectedTriviaCategories.includes(c.id) ? ' active' : ''}" data-id="${c.id}">
      <span>${c.icon}</span>
      <span>${c.name}</span>
    </button>
  `).join('');
  container.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const id = parseInt(btn.dataset.id);
      if (btn.classList.contains('active')) {
        if (!selectedTriviaCategories.includes(id)) selectedTriviaCategories.push(id);
      } else {
        selectedTriviaCategories = selectedTriviaCategories.filter(c => c !== id);
      }
      clearTriviaError();
    });
  });
}

// Pseudo trivia sync avec classique
$('input-trivia-name').value = localStorage.getItem('playerName') || '';
$('input-trivia-name').addEventListener('input', e => {
  localStorage.setItem('playerName', e.target.value.trim());
});

// Boutons trivia home
$('btn-back-trivia-home').addEventListener('click', () => { clearTriviaError(); showScreen('landing'); });

$('btn-solo-trivia').addEventListener('click', () => {
  if (!selectedTriviaCategories.length) { showTriviaError(t().errNoTheme); return; }
  clearTriviaError();
  $('btn-solo-trivia').disabled = true;
  $('btn-solo-trivia').textContent = t().soloLoading;
  socket.emit('fetch-trivia-solo', { categories: selectedTriviaCategories, amount: 10, lang: currentLang });
});

$('btn-create-trivia').addEventListener('click', () => {
  if (!selectedTriviaCategories.length) { showTriviaError(t().errNoTheme); return; }
  clearTriviaError();
  socket.emit('create-trivia-room', { categories: selectedTriviaCategories, name: getTriviaName(), lang: currentLang });
});

$('btn-join-trivia').addEventListener('click',  joinTriviaRoom);
$('input-trivia-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinTriviaRoom(); });
$('input-trivia-code').addEventListener('input',   e => { e.target.value = e.target.value.toUpperCase(); });

function joinTriviaRoom() {
  const code = $('input-trivia-code').value.trim().toUpperCase();
  if (code.length !== 4) { showTriviaError(t().err4Letters); return; }
  clearTriviaError();
  socket.emit('join-trivia-room', { code, name: getTriviaName() });
}

// ── Trivia : salle d'attente ──────────────────────────────────────────────────
$('btn-trivia-copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('trivia-room-code').textContent).then(() => {
    $('btn-trivia-copy').textContent = t().codeCopied;
    setTimeout(() => { $('btn-trivia-copy').textContent = t().btnTriviaCopy; }, 2000);
  });
});
$('btn-start-trivia').addEventListener('click', () => { socket.emit('start-trivia'); });
$('btn-leave-trivia-wait').addEventListener('click', goToTriviaHome);

function renderTriviaWaitPlayers(players, hostId) {
  $('trivia-wait-players').innerHTML = players.map(p => `
    <div class="tw-chip" style="background:${TRIVIA_COLORS[p.colorIndex] || '#64748b'}">
      <div class="tw-chip-dot"></div>
      <span>${p.name}${p.socketId === hostId ? ' 👑' : ''}</span>
    </div>
  `).join('');
  const isHost = players.some(p => p.socketId === triviaMySocketId && p.socketId === hostId);
  $('btn-start-trivia').classList.toggle('hidden', !isHost);
}

// ── Trivia : timer ────────────────────────────────────────────────────────────
function startTriviaTimer(seconds, onExpire) {
  stopTriviaTimer();
  let rem = seconds;
  $('tg-timer').textContent = rem;
  $('tg-timer').classList.remove('warning');
  triviaTimerInterval = setInterval(() => {
    rem--;
    $('tg-timer').textContent = rem;
    $('tg-timer').classList.toggle('warning', rem <= 5);
    if (rem <= 0) { stopTriviaTimer(); onExpire(); }
  }, 1000);
}
function stopTriviaTimer() {
  if (triviaTimerInterval) { clearInterval(triviaTimerInterval); triviaTimerInterval = null; }
}

// ── Trivia : affichage question ───────────────────────────────────────────────
const LETTERS = ['A','B','C','D'];

function showTriviaQuestion({ questionNum, totalQuestions, question, choices, timeLimit, scores }) {
  triviaAnsweredThis = false; triviaChoiceSelected = null;
  $('tg-q-num').textContent = `Q ${questionNum} / ${totalQuestions}`;
  $('tg-question').textContent = question;
  $('tg-reveal').classList.add('hidden');
  $('tg-finished').classList.add('hidden');
  if (scores) renderTriviaScores(scores);

  $('tg-choices').innerHTML = choices.map((c, i) => `
    <button class="tg-choice" data-choice="${c.replace(/"/g,'&quot;')}">
      <span class="tg-choice-letter">${LETTERS[i]}</span>
      <span>${c}</span>
    </button>
  `).join('');
  $('tg-choices').querySelectorAll('.tg-choice').forEach(btn => {
    btn.addEventListener('click', () => onTriviaChoice(btn.dataset.choice, btn));
  });
  startTriviaTimer(timeLimit, () => onTriviaTimeUp());
}

function onTriviaChoice(choice, btn) {
  if (triviaAnsweredThis) return;
  triviaAnsweredThis = true; triviaChoiceSelected = choice;
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = true);
  btn.classList.add('wrong'); // will be corrected at reveal
  if (triviaIsSolo) {
    stopTriviaTimer();
    soloReveal(choice);
  } else {
    socket.emit('trivia-answer', { choice });
  }
}

function onTriviaTimeUp() {
  if (triviaAnsweredThis) return;
  triviaAnsweredThis = true;
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = true);
  if (triviaIsSolo) soloReveal(null);
}

function showTriviaReveal({ correct, correctSocketIds, scores, myChoice }) {
  stopTriviaTimer();
  $('tg-choices').querySelectorAll('.tg-choice').forEach(btn => {
    const c = btn.dataset.choice;
    btn.classList.remove('wrong');
    if (c === correct) btn.classList.add('correct');
    else if (c === myChoice) btn.classList.add('wrong');
    else btn.classList.add('dimmed');
  });
  if (scores) renderTriviaScores(scores);
  const gotIt = triviaIsSolo ? myChoice === correct
    : (correctSocketIds || []).includes(triviaMySocketId);
  $('tg-reveal').textContent  = gotIt ? t().triviaCorrect : `${t().triviaWrong}${correct}`;
  $('tg-reveal').className    = `tg-reveal ${gotIt ? 'ok' : 'ko'}`;
}

function renderTriviaScores(scores) {
  $('tg-scores').innerHTML = scores.map(s => `
    <div class="tg-score-chip" style="background:${TRIVIA_COLORS[s.colorIndex] || '#64748b'}">
      <span>${s.name}</span>
      <span class="tg-score-check">${s.score}pt</span>
    </div>
  `).join('');
}

function showTriviaFinished(scores) {
  stopTriviaTimer();
  $('tg-choices').innerHTML = '';
  $('tg-reveal').classList.add('hidden');
  const medals = ['🥇','🥈','🥉'];
  $('tg-final-scores').innerHTML = scores.map((s, i) => `
    <div class="tg-final-row" style="background:${TRIVIA_COLORS[s.colorIndex] || '#64748b'}">
      <span class="tg-final-rank">${medals[i] || (i+1)+'.'}</span>
      <span class="tg-final-name">${s.name}</span>
      <span class="tg-final-score">${s.score} / ${triviaQuestions.length || 10} pts</span>
    </div>
  `).join('');
  $('tg-finished').classList.remove('hidden');
}

$('btn-leave-trivia-game').addEventListener('click', goToTriviaHome);

// ── Trivia solo : logique locale ──────────────────────────────────────────────
function soloNextQuestion() {
  if (triviaCurrentQ >= triviaQuestions.length) {
    const name = getTriviaName() || 'Anonyme';
    const scores = [{ name, score: triviaScore, colorIndex: 0 }];
    $('tg-q-num').textContent = '';
    $('tg-timer').textContent = '–';
    showTriviaFinished(scores);
    socket.emit('solo-trivia-finished', { name, score: triviaScore, total: triviaQuestions.length });
    return;
  }
  const q = triviaQuestions[triviaCurrentQ];
  showTriviaQuestion({ questionNum: triviaCurrentQ + 1, totalQuestions: triviaQuestions.length, question: q.question, choices: q.choices, timeLimit: 20, scores: null });
}

function soloReveal(myChoice) {
  const q = triviaQuestions[triviaCurrentQ];
  if (myChoice === q.correct) triviaScore++;
  showTriviaReveal({ correct: q.correct, correctSocketIds: [], scores: null, myChoice });
  triviaCurrentQ++;
  setTimeout(soloNextQuestion, 3000);
}

// ── Trivia : classement ───────────────────────────────────────────────────────
function renderTriviaLeaderboard(data) {
  const list = $('trivia-lb-list');
  if (!data || data.length === 0) { list.innerHTML = `<p class="lb-empty">${t().triviaLbEmpty}</p>`; return; }
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = data.map((entry, i) => `
    <div class="lb-row">
      <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i] || i+1}</span>
      <span class="lb-name">${entry.name}</span>
      <div class="lb-stats">
        <span class="lb-w">${entry.points} ${t().triviaLbPts}</span>
        <span class="lb-d">${entry.games} ${t().triviaLbGames}</span>
      </div>
    </div>
  `).join('');
}

// ── Overlay déconnexion ───────────────────────────────────────────────────────
function showReconnectingOverlay() {
  $('dc-icon').textContent  = '⏳';
  $('dc-title').textContent = t().dcReconnecting;
  $('dc-msg').textContent   = t().dcReconnectingMsg;
  $('btn-home').classList.add('hidden');
  $('overlay-disconnect').classList.remove('hidden');
}
function showDisconnectedOverlay() {
  $('dc-icon').textContent  = '⚠️';
  $('dc-title').textContent = t().dcDisconnected;
  $('dc-msg').textContent   = t().dcDisconnectedMsg;
  $('btn-home').classList.remove('hidden');
  $('overlay-disconnect').classList.remove('hidden');
}
function hideOverlay() { $('overlay-disconnect').classList.add('hidden'); }

$('btn-home').addEventListener('click', goToHome);

// ── Aide ──────────────────────────────────────────────────────────────────────
$('btn-help').addEventListener('click', () => {
  $('overlay-help').classList.remove('hidden');
});
document.getElementById('btn-help-game').addEventListener('click', () => {
  $('overlay-help').classList.remove('hidden');
});
$('btn-help-close').addEventListener('click', () => {
  $('overlay-help').classList.add('hidden');
});
$('overlay-help').addEventListener('click', e => {
  if (e.target === $('overlay-help')) $('overlay-help').classList.add('hidden');
});

document.querySelectorAll('.help-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.help-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`help-tab-${tab.dataset.tab}`).classList.add('active');
  });
});
$('btn-menu').addEventListener('click', goToHome);

$('btn-quit').addEventListener('click', () => {
  const msg = gameActive
    ? 'Quitter en cours de partie ? Tu abandonneras la partie en cours.'
    : 'Retourner au menu ?';
  if (confirm(msg)) goToHome();
});

// ── Événements Socket.IO ──────────────────────────────────────────────────────

// ── Socket Trivia ─────────────────────────────────────────────────────────────
socket.on('trivia-room-created', ({ code, categoryName, roomState }) => {
  triviaRoomCode = code; triviaIsHost = true;
  $('trivia-room-code').textContent = code;
  $('trivia-wait-theme').textContent = categoryName;
  renderTriviaWaitPlayers(roomState.players, roomState.hostId);
  showScreen('trivia-waiting');
});

socket.on('trivia-room-joined', ({ code, categoryName }) => {
  triviaRoomCode = code; triviaIsHost = false;
  $('trivia-room-code').textContent = code;
  $('trivia-wait-theme').textContent = categoryName;
  showScreen('trivia-waiting');
});

socket.on('trivia-room-updated', (roomState) => {
  renderTriviaWaitPlayers(roomState.players, roomState.hostId);
});

socket.on('trivia-start', ({ totalQuestions, categoryName }) => {
  triviaIsSolo = false;
  triviaQuestions = { length: totalQuestions };
  $('tg-theme-label').textContent = categoryName;
  $('tg-scores').innerHTML = '';
  $('tg-finished').classList.add('hidden');
  showScreen('trivia-game');
});

socket.on('trivia-question', (data) => {
  showTriviaQuestion(data);
});

socket.on('trivia-player-answered', ({ socketId }) => {
  // Marquer visuellement qu'un joueur a répondu dans les scores
  document.querySelectorAll('.tg-score-chip').forEach(chip => {
    if (chip.dataset.sid === socketId) chip.style.outline = '2px solid #fff';
  });
});

socket.on('trivia-reveal', (data) => {
  showTriviaReveal({ ...data, myChoice: triviaChoiceSelected });
});

socket.on('trivia-finished', ({ scores }) => {
  showTriviaFinished(scores);
});

socket.on('trivia-solo-questions', (questions) => {
  $('btn-solo-trivia').disabled = false;
  $('btn-solo-trivia').textContent = t().btnSolo;
  triviaQuestions = shuffle(questions).slice(0, 10);
  if (!triviaQuestions.length) { showTriviaError(t().errLoadQ); return; }
  triviaIsSolo = true; triviaCurrentQ = 0; triviaScore = 0; triviaRoomCode = null;
  $('tg-theme-label').textContent = getCategoryLabel(selectedTriviaCategories);
  $('tg-scores').innerHTML = '';
  $('tg-finished').classList.add('hidden');
  showScreen('trivia-game');
  soloNextQuestion();
});

socket.on('trivia-solo-error', () => {
  showTriviaError(t().errLoadQ);
  $('btn-solo-trivia').disabled = false;
  $('btn-solo-trivia').textContent = t().btnSolo;
});

socket.on('trivia-leaderboard-update', (data) => { renderTriviaLeaderboard(data); });
socket.on('trivia-error', ({ message }) => { showTriviaError(message); showScreen('trivia-home'); });

// ── Reconnexion automatique après reload + chargement du classement ───────────
socket.on('connect', () => {
  triviaMySocketId = socket.id;
  socket.emit('get-leaderboard');
  socket.emit('get-trivia-leaderboard');
  const saved = sessionStorage.getItem('p4session');
  if (!saved) return;
  try {
    const { roomCode, player } = JSON.parse(saved);
    socket.emit('reconnect-room', { code: roomCode, player });
  } catch { clearSession(); }
});

socket.on('room-created', ({ code, gameType }) => {
  currentRoomCode = code;
  currentGame     = gameType;
  $('room-code').textContent     = code;
  $('waiting-game-name').textContent = t().games[gameType];
  showScreen('waiting');
});

socket.on('game-start', ({ gameType, state, yourPlayer, vsBot, botDifficulty }) => {
  isBotGame = !!vsBot;
  saveSession(currentRoomCode, yourPlayer);
  applyGameState({ gameType, state, yourPlayer, status: 'playing', winner: null });
  $('chat').classList.toggle('hidden', isBotGame);
  if (isBotGame) {
    const diffLabel = t().diffLabels[botDifficulty] || '';
    $('label-y').textContent = diffLabel ? `🤖 Robot (${diffLabel})` : '🤖 Robot';
  }
  showScreen('game');
});

socket.on('reconnect-success', ({ gameType, state, yourPlayer, status, winner, roomCode }) => {
  currentRoomCode = roomCode;
  saveSession(roomCode, yourPlayer);
  hideOverlay();
  applyGameState({ gameType, state, yourPlayer, status, winner });
  showScreen('game');
});

socket.on('reconnect-failed', () => { clearSession(); });

socket.on('game-update', ({ gameType, state, status, winner }) => {
  if (gameType === 'chess') lastMove = null; // sera mis à jour via onChessClick
  updateGameBoard(gameType, state);

  if (status === 'playing') {
    updateTurnUI(state.currentPlayer, gameType);
    // Surligner la victoire Connect4
  } else {
    $('turn-indicator').textContent = '';
    if (gameType === 'connect4' && winner) highlightConnect4Win(state.board, winner);
    if (gameType === 'tictactoe' && state.winLine) updateTTT(state.board, state.winLine);
    showGameOver(status, winner);
  }
});

socket.on('legal-moves', ({ square, moves }) => {
  if (square !== selectedSquare) return;
  availableMoves = moves;
  moves.forEach(mv => {
    const el = document.querySelector(`.chess-sq[data-sq="${mv}"]`);
    if (el) {
      el.classList.add('can-move');
      if (el.textContent) el.classList.add('has-piece');
    }
  });
});

socket.on('opponent-reconnecting', () => {
  gameActive = false;
  if (currentGame === 'connect4') setArrowsEnabled(false);
  showReconnectingOverlay();
});

socket.on('opponent-reconnected', () => {
  hideOverlay();
  gameActive = true;
  if (currentGame === 'connect4') setArrowsEnabled(currentTurnPlayer === myPlayer);
});

socket.on('player-disconnected', () => {
  gameActive = false;
  clearSession();
  showDisconnectedOverlay();
});

socket.on('restart-requested', () => {
  if (!$('game-status').classList.contains('hidden')) {
    $('status-text').textContent += t().restartRequested;
  }
});

socket.on('new-message',       (msg)  => { appendMessage(msg); });
socket.on('leaderboard-update', (data) => {
  renderLeaderboard(data);
  const name = localStorage.getItem('playerName') || '';
  const idx  = name ? data.findIndex(e => e.name === name) : -1;
  if (idx !== -1) {
    const rank = idx + 1;
    const wins = data[idx].wins || 0;
    const rankBonus = [8, 5, 3, 1, 0][Math.min(4, rank - 1)];
    cursorSnake.update(4 + Math.min(6, wins) + rankBonus, rank);
  }
});

socket.on('error', ({ message }) => { showError(message); });
socket.on('connect_error', () => { showError(t().errConnect); });

// ── Langue ───────────────────────────────────────────────────────────────────
$('btn-lang').addEventListener('click', () => {
  currentLang = currentLang === 'fr' ? 'en' : 'fr';
  localStorage.setItem('lang', currentLang);
  applyLang();
  buildTriviaThemes();
});

// Init langue au chargement
applyLang();

// ── Particules ─────────────────────────────────────────────────────────────────
function spawnParticles(x, y) {
  const palette = ['#6366f1','#818cf8','#a5b4fc','#c7d2fe','#60a5fa','#e879f9','#38bdf8'];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = 3 + Math.random() * 5;
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:${palette[i % palette.length]};pointer-events:none;z-index:9999;`;
    document.body.appendChild(p);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist  = 32 + Math.random() * 68;
    const tx    = Math.cos(angle) * dist;
    const ty    = Math.sin(angle) * dist;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
    ], { duration: 420 + Math.random() * 360, easing: 'cubic-bezier(0,.9,.57,1)', fill: 'forwards' })
    .onfinish = () => p.remove();
  }
}

document.addEventListener('click', e => {
  if (e.target.closest('.btn-primary, .landing-card')) spawnParticles(e.clientX, e.clientY);
}, { passive: true });

// ── Thème adaptatif selon l'heure ─────────────────────────────────────────────
(function () {
  let lastLight = null;
  let clockTimer = null;

  function applyThemeByTime() {
    const h = new Date().getHours();
    const isLight = h >= 7 && h < 20;

    if (isLight !== lastLight) {
      document.documentElement.classList.toggle('light', isLight);
      showThemeClock(isLight ? '☀️ Thème jour' : '🌙 Thème nuit');
      lastLight = isLight;
    }
  }

  function showThemeClock(label) {
    let el = document.getElementById('theme-clock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'theme-clock';
      document.body.appendChild(el);
    }
    el.textContent = label;
    el.classList.add('visible');
    clearTimeout(clockTimer);
    clockTimer = setTimeout(() => el.classList.remove('visible'), 3000);
  }

  applyThemeByTime();
  setInterval(applyThemeByTime, 60_000);
})();

// ── Serpent curseur ───────────────────────────────────────────────────────────
const cursorSnake = (() => {
  const MAX = 18, MIN = 4, GAP = 13, HEAD_SZ = 12, TAIL_SZ = 5;
  let segs = [], mx = -999, my = -999, curHue = 140;
  let enabled = localStorage.getItem('snakeEnabled') !== 'false';
  let pendingLen = MIN, pendingRank = 0;

  function hueFor(rank) {
    return rank === 1 ? 48 : rank === 2 ? 205 : rank === 3 ? 22 : 140;
  }

  function build(len, h) {
    segs.forEach(s => s.el.remove());
    segs = [];
    curHue = h;
    if (!enabled) return;
    for (let i = 0; i < len; i++) {
      const p  = len > 1 ? i / (len - 1) : 0;
      const sz = HEAD_SZ - p * (HEAD_SZ - TAIL_SZ);
      const el = document.createElement('div');
      el.style.cssText =
        `position:fixed;border-radius:50%;pointer-events:none;user-select:none;` +
        `z-index:${999 - i};transform:translate(-50%,-50%);` +
        `width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;` +
        `background:hsl(${h},${(80 - p * 20).toFixed(0)}%,${(58 - p * 22).toFixed(0)}%);` +
        `opacity:${(1 - p * 0.82).toFixed(2)};` +
        (i === 0 ? `box-shadow:0 0 8px 3px hsl(${h},80%,65%);` : '');
      document.body.appendChild(el);
      segs.push({ el, x: -999, y: -999 });
    }
  }

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0]; mx = t.clientX; my = t.clientY;
  }, { passive: true });

  (function tick() {
    if (segs.length) {
      segs[0].x += (mx - segs[0].x) * 0.18;
      segs[0].y += (my - segs[0].y) * 0.18;
      for (let i = 1; i < segs.length; i++) {
        const pr = segs[i - 1], cu = segs[i];
        const dx = pr.x - cu.x, dy = pr.y - cu.y;
        const d  = Math.hypot(dx, dy);
        if (d > GAP) { const r = (d - GAP) / d * 0.5; cu.x += dx * r; cu.y += dy * r; }
      }
      segs.forEach(s => { s.el.style.left = `${s.x}px`; s.el.style.top = `${s.y}px`; });
    }
    requestAnimationFrame(tick);
  })();

  build(MIN, curHue);

  // Met à jour le bouton flottant pour refléter l'état
  function syncBtn() {
    const btn = document.getElementById('btn-snake-toggle');
    if (btn) btn.classList.toggle('off', !enabled);
  }
  syncBtn();

  return {
    update(len, rank) {
      pendingLen = len; pendingRank = rank;
      if (!enabled) return;
      const h = hueFor(rank);
      const n = Math.min(MAX, Math.max(MIN, len));
      if (n !== segs.length || h !== curHue) build(n, h);
    },
    toggle() {
      enabled = !enabled;
      localStorage.setItem('snakeEnabled', enabled);
      if (enabled) {
        build(Math.min(MAX, Math.max(MIN, pendingLen)), hueFor(pendingRank));
      } else {
        segs.forEach(s => s.el.remove());
        segs = [];
      }
      syncBtn();
      return enabled;
    },
  };
})();

document.getElementById('btn-snake-toggle').addEventListener('click', () => {
  cursorSnake.toggle();
});

// ── Pluie d'émojis au chargement ──────────────────────────────────────────────
(() => {
  const EMOJIS = ['🔴','🟡','♟','♔','♚','♛','♜','♝','♞','❌','⭕','🧠','❓','💡','🎮','🎯','🏆','🎲'];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9998;';
  document.body.appendChild(wrap);

  for (let i = 0; i < 100; i++) {
    const size     = (0.9 + Math.random() * 0.8).toFixed(2);
    const left     = (Math.random() * 97).toFixed(1);
    const fallDur  = (2.8 + Math.random() * 3).toFixed(2);
    const swayDur  = (1.6 + Math.random() * 1.4).toFixed(2);
    const delay    = (Math.random() * 2.8).toFixed(2);

    // Outer : position fixe + balancement horizontal doux
    const outer = document.createElement('span');
    outer.style.cssText =
      `position:absolute;left:${left}%;top:0;` +
      `animation:emoji-sway ${swayDur}s ease-in-out infinite;`;

    // Inner : chute verticale + opacité
    const inner = document.createElement('span');
    inner.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    inner.style.cssText =
      `display:inline-block;font-size:${size}rem;line-height:1;will-change:transform;` +
      `animation:emoji-fall ${fallDur}s ${delay}s linear forwards;`;

    outer.appendChild(inner);
    wrap.appendChild(outer);
  }

  setTimeout(() => wrap.remove(), 8500);
})();

// ── Commentaires joueurs ──────────────────────────────────────────────────────
(() => {
  const overlay  = $('overlay-comment');
  const form     = $('comment-form');
  const pseudo   = $('comment-pseudo');
  const message  = $('comment-message');
  const charsEl  = $('comment-chars');
  const feedback = $('comment-feedback');
  const sendBtn  = $('btn-comment-send');

  function openModal() {
    overlay.classList.remove('hidden');
    feedback.className = 'comment-feedback hidden';
    feedback.textContent = '';
  }
  function closeModal() { overlay.classList.add('hidden'); }

  $('btn-comment').addEventListener('click', openModal);
  $('btn-comment-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  message.addEventListener('input', () => {
    charsEl.textContent = `${message.value.length} / 1000`;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = message.value.trim();
    if (!msg) return;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Envoi…';
    feedback.className = 'comment-feedback hidden';

    try {
      const res = await fetch(`${window.BACKEND_URL}/api/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.value.trim(), message: msg }),
      });
      const data = await res.json();
      if (res.ok) {
        feedback.textContent = '✅ Message envoyé ! Merci pour ton retour.';
        feedback.className = 'comment-feedback ok';
        form.reset();
        charsEl.textContent = '0 / 1000';
        setTimeout(closeModal, 2200);
      } else {
        feedback.textContent = `❌ ${data.error || 'Erreur inconnue.'}`;
        feedback.className = 'comment-feedback err';
      }
    } catch {
      feedback.textContent = '❌ Impossible de contacter le serveur.';
      feedback.className = 'comment-feedback err';
    }

    sendBtn.disabled = false;
    sendBtn.textContent = 'Envoyer ✉️';
  });
})();

// ── Tutoriel premiers pas ──────────────────────────────────────────────────────
(() => {
  const LS_KEY = 'libero_tuto_v2';

  function getDone() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }
  function markDone(id) {
    const d = getDone(); d[id] = true;
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  }
  function isDone(id) { return !!getDone()[id]; }

  // ── Toutes les fonctions du site, écran par écran ─────────────────────────
  const STEPS = [
    // ── Accueil ──
    {
      id: 'landing_cats',
      screen: 'landing',
      text: '👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! Le site propose deux sections : <strong>Jeux Classiques</strong> (Puissance 4, Morpion, Échecs) et <strong>Culture Générale</strong> (quiz par thèmes). Clique sur une carte pour commencer.',
      target: '.landing-grid',
    },
    {
      id: 'landing_btns',
      screen: 'landing',
      text: '⚙️ Trois boutons sont toujours disponibles en bas à droite :<br>🌐 <strong>Langue</strong> — bascule l\'interface FR / EN<br>🐍 <strong>Serpent</strong> — active ou désactive le curseur animé<br>❓ <strong>Aide</strong> — consulte le guide complet à tout moment',
      target: null,
    },

    // ── Jeux classiques ──
    {
      id: 'home_games',
      screen: 'home',
      text: '🎮 Choisis ton jeu en haut : <strong>Puissance 4</strong>, <strong>Morpion</strong> ou <strong>Échecs</strong>. Le classement est partagé entre les trois jeux.',
      target: '.game-selector',
    },
    {
      id: 'home_bot',
      screen: 'home',
      text: '🤖 <strong>Mode Solo</strong> : joue contre le bot à 3 niveaux de difficulté — Facile, Moyen ou Difficile. Tes victoires et défaites sont comptées dans le classement !',
      target: '.bot-row',
    },
    {
      id: 'home_multi',
      screen: 'home',
      text: '👥 <strong>Mode Multijoueur</strong> : entre ton pseudo (optionnel), puis clique sur <em>Créer une partie</em> pour générer un code, ou entre le code d\'un ami pour le rejoindre.',
      target: '.card',
    },
    {
      id: 'home_lb',
      screen: 'home',
      text: '🏆 <strong>Classement</strong> : victoires, défaites et nuls s\'enregistrent automatiquement après chaque partie (bot Moyen / Difficile ou multijoueur).',
      target: '.lb-card',
    },

    // ── Salle d'attente ──
    {
      id: 'waiting_code',
      screen: 'waiting',
      text: '📋 <strong>Partage ce code</strong> à 4 lettres avec ton adversaire — par message, WhatsApp, Discord… La partie démarre automatiquement dès qu\'il rejoint !',
      target: '#room-code',
      autoDone: true,
    },

    // ── Quiz ──
    {
      id: 'quiz_themes',
      screen: 'trivia-home',
      text: '🧠 <strong>Quiz Culture Générale</strong> : sélectionne un ou plusieurs thèmes (Histoire, Cinéma, Sciences…), puis joue en <strong>Solo</strong> ou crée un <strong>salon multijoueur</strong> à partager avec tes amis.',
      target: '#trivia-themes',
    },
    {
      id: 'quiz_lb',
      screen: 'trivia-home',
      text: '🏆 Le <strong>classement Quiz</strong> est séparé du classement Classique. Les points sont attribués selon ta vitesse de réponse et le nombre de bonnes réponses.',
      target: '.lb-card',
    },
  ];

  const wrap   = document.getElementById('tuto-wrap');
  const bubble = document.getElementById('tuto-bubble');
  const dotsEl = document.getElementById('tuto-dots');
  const textEl = document.getElementById('tuto-text');
  const btnOk  = document.getElementById('tuto-ok');
  const btnSkip= document.getElementById('tuto-skip');

  let current     = null;
  let highlighted = null;
  let autoTimer   = null;

  function clearHighlight() {
    if (highlighted) { highlighted.classList.remove('tuto-highlight'); highlighted = null; }
  }

  function renderDots(activeId) {
    dotsEl.innerHTML = '';
    const done = getDone();
    STEPS.forEach(s => {
      const d = document.createElement('div');
      d.className = 'tuto-dot' + (done[s.id] ? ' done' : s.id === activeId ? ' current' : '');
      dotsEl.appendChild(d);
    });
  }

  function showStep(step) {
    if (isDone(step.id)) return;
    current = step;
    textEl.innerHTML = step.text;
    renderDots(step.id);

    bubble.style.animation = 'none';
    requestAnimationFrame(() => { bubble.style.animation = ''; });

    wrap.classList.remove('hidden');
    wrap.classList.add('visible');

    clearHighlight();
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) { el.classList.add('tuto-highlight'); highlighted = el; }
    }

    clearTimeout(autoTimer);
    if (step.autoDone) {
      autoTimer = setTimeout(() => advance(), 6000);
    }
  }

  function hideBubble() {
    clearHighlight();
    wrap.classList.add('hidden');
    wrap.classList.remove('visible');
    current = null;
  }

  function advance() {
    if (!current) return;
    clearTimeout(autoTimer);
    const screenName = current.screen;
    markDone(current.id);
    clearHighlight();
    current = null;

    // Cherche la prochaine étape non faite sur le même écran
    const next = STEPS.find(s => s.screen === screenName && !isDone(s.id));
    if (next) {
      setTimeout(() => showStep(next), 200);
    } else {
      hideBubble();
    }
  }

  function skipAll() {
    clearTimeout(autoTimer);
    STEPS.forEach(s => markDone(s.id));
    hideBubble();
  }

  btnOk.addEventListener('click', advance);
  btnSkip.addEventListener('click', skipAll);

  // Appelé par showScreen() à chaque changement d'écran
  window._tutoOnScreen = function(screenName) {
    // Cache la bulle si on change d'écran
    if (current && current.screen !== screenName) {
      clearTimeout(autoTimer);
      hideBubble();
    }
    // Montre la première étape non faite pour ce nouvel écran
    const step = STEPS.find(s => s.screen === screenName && !isDone(s.id));
    if (step) setTimeout(() => showStep(step), 450);
  };

  // Quitter l'accueil sans lire → marque les étapes landing comme vues
  document.getElementById('btn-go-classic')?.addEventListener('click', () => {
    STEPS.filter(s => s.screen === 'landing').forEach(s => markDone(s.id));
  });
  document.getElementById('btn-go-trivia')?.addEventListener('click', () => {
    STEPS.filter(s => s.screen === 'landing').forEach(s => markDone(s.id));
  });

  // Quitter l'écran home sans lire → marque les étapes home comme vues
  ['btn-create', 'btn-join'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      STEPS.filter(s => s.screen === 'home').forEach(s => markDone(s.id));
    });
  });
  document.querySelectorAll('.bot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STEPS.filter(s => s.screen === 'home').forEach(s => markDone(s.id));
    });
  });

  // Affiche le step initial
  window._tutoOnScreen('landing');
})();
