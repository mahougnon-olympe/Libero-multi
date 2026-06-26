// ── Identifiant joueur stable ─────────────────────────────────────────────────
function getPlayerId() {
  let id = localStorage.getItem('libero_player_id');
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('libero_player_id', id);
  }
  return id;
}

// ── État global ─────────────────────────────────────────────────────────────
let libsBalance        = parseInt(localStorage.getItem('libero_libs') || '0', 10);
let pendingHintCharges = 0;
let hintsUsedThisQ     = 0;
let ownedCosmetics     = [];
let equippedCosmetic   = null;
let equippedFont       = null;
let equippedBubble     = null;
let equippedBackground   = localStorage.getItem('libero_equipped_bg') || null;
let equippedNameEffect   = null;
let equippedTitle        = null;
let equippedCursorSnake  = null;
let equippedAvatar       = null;
let equippedP4Token      = null;
let equippedTtt          = null;
let equippedChess        = null;
let equippedSnakeSkin    = null;
let equippedClickFx      = null;
let equippedEmojiPack    = null;
let equippedVictoryBan   = null;
let equippedSoundPack    = null;
let equippedEmotes       = [];
let honorTitle           = null;
let _shopDetailItem         = null;
let _pendingShopFocus       = null;
let _pendingShopFocusIds    = null;
let _shopRetainTileId       = null;
let _focusDebounceTimer     = null;
let shopRotation            = null;
let _shopCountdownTimer     = null;
let refundCards             = 2;
let refundCardsNextRefill   = null;
let _libsAnimTimer     = null;
let _libsDistTimer     = null;
let _nextDistAt        = 0;
let _globalLbData      = [];
let _classicLbData     = [];
let _snakeLbData       = [];
let _luffyLbData       = [];
let _triviaLbData      = [];
let _nameTaken         = false;
let _renameTimer       = null;

// ── Effets sonores ─────────────────────────────────────────────────────────────
let sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
let sfxVolume  = parseFloat(localStorage.getItem('sfxVolume') ?? '0.5');

const SFX = (() => {
  let _ac = null;
  function ac() {
    if (!_ac) _ac = new (window.AudioContext || window['webkitAudioContext'])();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }
  function play(fn) {
    if (!sfxEnabled) return;
    try { fn(ac(), sfxVolume); } catch(_) {}
  }
  // Returns wave type based on equipped sound pack
  function wt(def) {
    const p = equippedSoundPack;
    if (p === 'soundpack-retro')   return 'square';
    if (p === 'soundpack-cyber')   return 'sawtooth';
    if (p === 'soundpack-crystal') return 'triangle';
    if (p === 'soundpack-8bit')    return 'square';
    if (p === 'soundpack-epic')    return 'sine';
    return def;
  }
  // Returns frequency scale factor based on pack
  function fs() {
    const p = equippedSoundPack;
    if (p === 'soundpack-crystal') return 1.5;
    if (p === 'soundpack-8bit')    return 0.5;
    if (p === 'soundpack-epic')    return 0.8;
    return 1;
  }
  function tone(ctx, vol, type, freq, t, dur, attack = 0.005) {
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    placePiece() { play((c,v) => { const t=c.currentTime; tone(c,v*.3,wt('sine'),800*fs(),t,.08); }); },
    win()  { play((c,v) => { const t=c.currentTime; [523,659,784,1047].map(f=>f*fs()).forEach((f,i)=>tone(c,v*.4,wt('sine'),f,t+i*.1,.18)); }); },
    lose() { play((c,v) => { const t=c.currentTime; [392,330,294,220].map(f=>f*fs()).forEach((f,i)=>tone(c,v*.35,wt('sine'),f,t+i*.13,.22)); }); },
    draw() { play((c,v) => { const t=c.currentTime; const f=440*fs(); tone(c,v*.3,wt('sine'),f,t,.12); tone(c,v*.3,wt('sine'),f,t+.18,.12); }); },
    quizOk()  { play((c,v) => { const t=c.currentTime; tone(c,v*.4,wt('sine'),880*fs(),t,.25); tone(c,v*.2,wt('sine'),1320*fs(),t+.05,.2); }); },
    quizBad() { play((c,v) => {
      const t=c.currentTime, g=c.createGain(), o=c.createOscillator();
      o.type=wt('sawtooth'); o.frequency.setValueAtTime(200*fs(),t); o.frequency.exponentialRampToValueAtTime(100*fs(),t+.3);
      g.gain.setValueAtTime(v*.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+.3);
      g.connect(c.destination); o.connect(g); o.start(t); o.stop(t+.35);
    }); },
    chat()     { play((c,v) => { const t=c.currentTime; tone(c,v*.2,wt('sine'),660*fs(),t,.07,.003); }); },
    shopBuy()  { play((c,v) => { const t=c.currentTime; tone(c,v*.35,wt('triangle'),740*fs(),t,.1); tone(c,v*.35,wt('triangle'),988*fs(),t+.1,.15); }); },
    openPanel(){ play((c,v) => {
      const t=c.currentTime, g=c.createGain(), o=c.createOscillator();
      o.type=wt('sine'); o.frequency.setValueAtTime(300*fs(),t); o.frequency.exponentialRampToValueAtTime(600*fs(),t+.12);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.15,t+.03); g.gain.exponentialRampToValueAtTime(0.001,t+.15);
      g.connect(c.destination); o.connect(g); o.start(t); o.stop(t+.2);
    }); },
    snakeEat() { play((c,v) => {
      const t=c.currentTime, g=c.createGain(), o=c.createOscillator();
      o.type=wt('sine'); o.frequency.setValueAtTime(220*fs(),t); o.frequency.exponentialRampToValueAtTime(660*fs(),t+.08);
      g.gain.setValueAtTime(v*.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+.1);
      g.connect(c.destination); o.connect(g); o.start(t); o.stop(t+.12);
    }); },
    snakeOver(){ play((c,v) => { const t=c.currentTime; [440,370,311,233].map(f=>f*fs()).forEach((f,i)=>tone(c,v*.35,wt('sawtooth'),f,t+i*.15,.22)); }); },
    btnClick() { play((c,v) => { const t=c.currentTime; tone(c,v*.1,wt('sine'),520*fs(),t,.04,.002); }); },
  };
})();

// ── Musique de fond ────────────────────────────────────────────────────────────
let bgmEnabled = localStorage.getItem('bgmEnabled') !== 'false'; // activée par défaut
let bgmVolume  = parseFloat(localStorage.getItem('bgmVolume') ?? '0.28');

const BGM = (() => {
  let _ctx = null, _master = null, _running = false;
  let _nextT = 0, _patIdx = 0, _timer = null;
  let _drones = [];

  // A minor pentatonic – 85 BPM (0.706 s/beat)
  const B = 60 / 85;
  const P = [
    [440,1,.38],[392,.5,.28],[329.6,.5,.28],[293.7,1,.32],[261.6,1,.3],
    [220,1.5,.35],[0,.5,0],
    [261.6,.5,.25],[293.7,.5,.25],[329.6,1,.3],[392,.5,.25],[440,1,.35],
    [392,.5,.25],[329.6,.5,.25],[261.6,.5,.28],[220,2,.38],[0,1,0],
    [293.7,.5,.25],[329.6,.5,.28],[392,1,.32],[329.6,.5,.25],[261.6,.5,.25],
    [220,3,.35],[0,1,0],
  ];

  function cx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window['webkitAudioContext'])();
      _master = _ctx.createGain();
      _master.gain.value = bgmVolume;
      _master.connect(_ctx.destination);
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function note(freq, t, beats, vel) {
    if (freq === 0) return;
    const c = cx(), dur = beats * B;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * .55, t + .06);
    g.gain.setValueAtTime(vel * .55, t + dur * .65);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(_master);
    o.start(t); o.stop(t + dur + .05);
  }

  function drone() {
    const c = cx(), t = c.currentTime;
    // Basse A1
    const b = c.createOscillator(), bg = c.createGain();
    b.type = 'sine'; b.frequency.value = 55;
    bg.gain.value = .1;
    b.connect(bg); bg.connect(_master); b.start(t);
    _drones.push(b);
    // Pad A2 / E3 avec LFO tremolo
    [[110, 0], [165, .02]].forEach(([f, det]) => {
      const p = c.createOscillator(), pg = c.createGain();
      const lfo = c.createOscillator(), lg = c.createGain();
      p.type = 'sine'; p.frequency.value = f * (1 + det);
      lfo.type = 'sine'; lfo.frequency.value = .12;
      lg.gain.value = .018;
      pg.gain.value = .055;
      lfo.connect(lg); lg.connect(pg.gain);
      p.connect(pg); pg.connect(_master);
      lfo.start(t); p.start(t);
      _drones.push(p, lfo);
    });
  }

  function stopDrone() {
    _drones.forEach(n => { try { n.stop(); } catch(_) {} });
    _drones = [];
  }

  function sched() {
    if (!_running) return;
    const c = cx();
    while (_nextT < c.currentTime + .12) {
      const [f, b, v] = P[_patIdx % P.length];
      note(f, _nextT, b, v);
      _nextT += b * B;
      _patIdx++;
    }
    _timer = setTimeout(sched, 20);
  }

  return {
    start() {
      if (_running || !bgmEnabled) return;
      _running = true;
      const c = cx();
      _nextT = c.currentTime + .5;
      _patIdx = 0;
      drone();
      sched();
    },
    stop() {
      _running = false;
      clearTimeout(_timer);
      stopDrone();
    },
    pause() { if (_ctx) _ctx.suspend(); },
    resume(){ if (_ctx && bgmEnabled) _ctx.resume(); },
    setVol(v) {
      bgmVolume = v;
      localStorage.setItem('bgmVolume', String(v));
      if (_master && _ctx) _master.gain.setValueAtTime(v, _ctx.currentTime);
    },
  };
})();

// Démarrage BGM au premier clic (politique autoplay navigateur)
document.addEventListener('click', function _bgmInit() {
  document.removeEventListener('click', _bgmInit);
  BGM.start();
}, { once: true });

// Pause / reprise quand l'onglet est masqué
document.addEventListener('visibilitychange', () => {
  if (document.hidden) BGM.pause(); else BGM.resume();
});

let myPlayer        = null;   // 'R' | 'Y'
let gameActive      = false;
let currentRoomCode = null;
let currentGame     = null;   // 'connect4' | 'tictactoe' | 'chess'
let selectedGameType = 'connect4';
let isBotGame = false;
let currentTurnPlayer = null;

// ── Langue ───────────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('lang') || (navigator.language?.startsWith('en') ? 'en' : 'fr');

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
    namePh:'Ton pseudo (obligatoire)', codePh:'Code à 4 lettres', errNoName:'Entre un pseudo pour continuer.',
    errNameTaken:'🚫 Ce pseudo est déjà pris. Choisis-en un autre.',
    eventCountdownFmt: ms => { const m=Math.ceil(ms/60000),d=Math.floor(m/1440),h=Math.floor((m%1440)/60),r=m%60; return d>0?`⏳ Fin de l'évent dans ${d}j ${h}h`:h>0?`⏳ Fin de l'évent dans ${h}h ${r}min`:`⏳ Fin de l'évent dans ${r}min`; },
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
    triviaNamePh:'Ton pseudo (obligatoire)',
    triviaThemesLabel:'Thèmes (sélection multiple) :', triviaDiffLabel:'Difficulté :', diffMixed:'🎲 Mixte',
    triviaNbLabel:'Nombre de questions',
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
    triviaFinishedTitle:'Résultats finaux', btnLeaveGame:'Retour au menu', btnQuitTrivia:'🚪 Quitter',
    errNoTheme:'Choisis au moins un thème pour commencer.',
    errLoadQ:'Impossible de charger les questions. Vérifie ta connexion.',
    err4Letters:'Entre un code à 4 lettres.',
    soloLoading:'⏳ Chargement…',
    globalLbTitle:'Classement Global', globalLbEmpty:'Aucune partie jouée.', globalLbPts:'pts',
    globalLbMore:'Voir plus', globalLbLess:'Voir moins',
    themeDay:'☀️ Thème jour', themeNight:'🌙 Thème nuit', themeToggle:'Basculer le thème',
    mixLabel:n => `🎲 Mix (${n} thèmes)`,
    colLabel:n => `Jouer colonne ${n}`,
    restartRequested:"\nL'adversaire veut rejouer !",
    errConnect:'Impossible de joindre le serveur. Réessaie.',
    help:{ title:'Aide', tabs:{ general:'Général', quiz:'Quiz', connect4:'Puissance 4', ttt:'Morpion', chess:'Échecs' } },
    shopTitle:'⚡ Boutique', shopBalanceLabel:'Ton solde :',
    shopBoostHintName:'💡 Indice Quiz',
    shopBoostHintDesc:'Élimine une mauvaise réponse. Utilisable jusqu\'à 2 fois par question.',
    shopBtnBuy10:'10 indices — 3 ⚡', shopBtnBuy20:'20 indices — 5 ⚡',
    shopPending:n => `${n} indice${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`,
    shopInsufficient:'Champion, tu n\'as pas assez de Libs.', shopBuyError:'Erreur lors de l\'achat.',
    shopBuyOk:'Boost acheté !',
    shopPromoTitle:'🎟 Code promo', shopPromoPlaceholder:'Code à 4 caractères', shopPromoBtn:'Valider',
    shopPromoOk:n => `🎉 +${n} ⚡ crédités !`,
    shopPromoAlreadyUsed:'Tu as déjà utilisé ce code.', shopPromoInvalid:'Code invalide.', shopPromoAnon:'Les joueurs anonymes ne peuvent pas utiliser de code.',
    shopCosmeticsTitle:'🎨 Cosmétiques de pseudo',
    shopCosmeticNames:{ rainbow:'Arc en ciel', galaxy:'Galaxie', silver:'Argent', bronze:'Bronze', gold:'Or', diamond:'Diamant' },
    shopCosmeticBuy:p => `Acheter — ${p} ⚡`,
    shopCosmeticEquip:'Équiper', shopCosmeticEquipped:'✓ Équipé', shopCosmeticUnequip:'Retirer',
    shopCosmeticPreview:'Libero',
    shopCosmeticBought:'🎨 Cosmétique acheté !',
    shopCosmeticAlreadyOwned:'Tu possèdes déjà ce cosmétique.',
    shopCosmeticAnon:'Les joueurs anonymes ne peuvent pas acheter de cosmétiques.',
    shopFontsTitle:'✍️ Polices de pseudo',
    shopFontCategories:{ futuriste:'Futuriste', impact:'Impact', hacker:'Hacker', retro:'Rétro', fun:'Fun', elegant:'Élégant', free:'Gratuit' },
    shopFontGetFree:'Obtenir',
    shopBubbleTitle:'💬 Bulles de chat',
    shopBubbleNames:{ 'bubble-ardoise':'Ardoise', 'bubble-ocean':'Océan', 'bubble-menthe':'Menthe', 'bubble-corail':'Corail', 'bubble-ambre':'Ambre', 'bubble-lavande':'Lavande', 'bubble-rubis':'Rubis', 'bubble-emeraude':'Émeraude', 'bubble-indigo':'Indigo', 'bubble-magenta':'Magenta néon', 'bubble-cyan':'Cyan néon', 'bubble-crepuscule':'Crépuscule', 'bubble-aurore':'Aurore', 'bubble-sunset':'Coucher de soleil', 'bubble-tropical':'Tropical', 'bubble-arcade':'Néon arcade', 'bubble-galaxie':'Galaxie', 'bubble-verre':'Verre néon', 'bubble-or':'Or liquide', 'bubble-holographique':'Holographique', 'bubble-cameleon':'Caméléon' },
    shopBgTitle:'🖼 Fonds d\'écran',
    shopBgNames:{'bg-nuit':'Nuit Calme','bg-ardoise':'Ardoise Profonde','bg-brume':'Brume Violette','bg-aurore-deg':'Dégradé Aurore','bg-crepuscule':'Crépuscule Néon','bg-cyber':'Grille Cyber','bg-circuit':'Circuit','bg-hexagones':'Hexagones','bg-etoile':'Ciel Étoilé','bg-particules':'Particules Flottantes','bg-pluie':'Pluie Néon','bg-vagues':'Vagues Lumineuses','bg-synthwave':'Synthwave','bg-nebuleuse':'Nébuleuse','bg-aurores':'Aurores Mouvantes','bg-galaxie':'Galaxie Vivante','bg-tempete':'Tempête Néon','bg-hologramme':'Hologramme'},
    shopNameEffectsTitle:'✨ Effets de pseudo',
    shopNameEffectNames:{'nameeffect-blink':'Clignotement Néon','nameeffect-pulse':'Lueur Pulsée','nameeffect-gradient':'Dégradé Défilant','nameeffect-sparks':'Étincelles','nameeffect-glitch':'Glitch','nameeffect-rainbow':'Vague Arc-en-ciel'},
    shopTitlesTitle:'🏷️ Titres',
    shopTitleNames:{'title-tactician':'Tacticien','title-strategist':'Le Stratège','title-quizmaster':'Quiz Master','title-snakeking':'Roi du Snake','title-unbeaten':'Invaincu','title-champion':'Champion','title-legend':'Légende Vivante'},
    honorTitleNames:{'honor-rank1-global':'N°1 Global','honor-creator':'Créateur'},
    honorModalTitle:'Titre honorifique !',
    honorModalMsg:(titleName) => `Felicitations ! Tu es N°1 au classement global. En recompense, tu recois le titre <strong>${titleName}</strong>. Il s'affichera a cote de ton pseudo tant que tu restes premier.`,
    honorModalBtn:'Accepter',
    shopHonoraryBadge:'🏆 Honorifique',
    shopHonoraryOwned:'Obtenu',
    shopHonoraryNote:'Deviens 1er au classement global pour obtenir ce titre.',
    shopCursorSnakesTitle:'🖱️ Skins de curseur',
    shopCursorSnakeNames:{'cursorsnake-pixel':'Serpent Pixel','cursorsnake-neon':'Serpent Néon','cursorsnake-comet':'Comète','cursorsnake-electric':'Anguille Électrique','cursorsnake-stars':'Traînée Étoilée','cursorsnake-fire':'Dragon de Feu'},
    shopAvatarsTitle:'🎭 Avatars',
    shopAvatarNames:{'avatar-gamepad':'Manette','avatar-cat':'Chat Pixel','avatar-lightning':'Éclair','avatar-rocket':'Fusée','avatar-robot':'Robot','avatar-skull':'Crâne','avatar-crown':'Couronne'},
    shopP4TokensTitle:'🔴 Jetons Puissance 4',
    shopP4TokenNames:{'p4token-goldsilver':'Or & Argent','p4token-neon':'Jetons Néon','p4token-lavalice':'Lave & Glace','p4token-galaxy':'Galaxie'},
    shopTttTitle:'✖️ Symboles Morpion',
    shopTttNames:{'ttt-neon':'X & O Néon','ttt-sunmoon':'Soleil / Lune','ttt-heartstar':'Cœur / Étoile','ttt-catdog':'Chat / Chien','ttt-skulllightning':'Crâne / Éclair'},
    shopChessTitle:'♟️ Thèmes d\'échiquier',
    shopChessNames:{'chess-cyber':'Cyber Grid','chess-frost':'Verre Givré','chess-neon':'Échiquier Néon','chess-marble':'Marbre Royal'},
    shopClickFxTitle:'💥 Particules de clic',
    shopClickFxNames:{'clickfx-bubbles':'Bulles','clickfx-confetti':'Confettis','clickfx-neon':'Étincelles Néon','clickfx-stars':'Étoiles Filantes','clickfx-firework':'Feu d\'Artifice'},
    shopEmojiPacksTitle:'🌈 Packs d\'émojis',
    shopEmojiPackNames:{'emojipack-animals':'Pack Animaux 🐾','emojipack-hearts':'Pack Cœurs 💜','emojipack-party':'Pack Fête 🎉','emojipack-gaming':'Pack Gaming 🎮','emojipack-cosmos':'Pack Cosmos 🌌'},
    shopVictoryBansTitle:'🏆 Bannières de victoire',
    shopVictoryBanNames:{'victoryban-neon':'Triomphe Néon','victoryban-confetti':'Explosion de Confettis','victoryban-flames':'Flammes de Champion','victoryban-lightning':'Éclair de Gloire','victoryban-crown':'Couronnement'},
    shopSoundPacksTitle:'🔊 Packs de sons',
    shopSoundPackNames:{'soundpack-8bit':'8-bit','soundpack-retro':'Rétro Arcade','soundpack-crystal':'Cristal','soundpack-cyber':'Cyber','soundpack-epic':'Épique'},
    shopEmotesTitle:'😎 Emotes',
    shopEmoteNames:{'emote-gg':'GG 👍','emote-wellplayed':'Bien joué 🤝','emote-fire':'En feu 🔥','emote-easy':'Trop facile 😎','emote-omg':'Incroyable 😱'},
    shopFeaturedTitle:'⭐ À la une',
    shopDailyTitle:'📅 Quotidien',
    shopBundlesTitle:'🎁 Bundles',
    shopSectionDescs:{
      featured:"La sélection de la semaine — se renouvelle toutes les 24h.",
      daily:"Des offres à prix réduit, renouvelées chaque jour.",
      bundles:"Packs thématiques à prix réduit. Si tu possèdes déjà certains articles, le prix s'ajuste automatiquement.",
      colors:"Colorie ton pseudo dans les classements et en partie.",
      fonts:"Change la police de ton pseudo partout sur Libero.",
      bubbles:"Personnalise le style visuel de tes bulles de chat.",
      bgs:"Applique un fond animé à ton espace de jeu.",
      nameeffects:"Ajoute un effet visuel animé directement sur ton pseudo.",
      titles:"Affiche un titre à côté de ton pseudo dans le classement.",
      cursorsnakes:"Remplace ton curseur de souris par un serpent animé.",
      avatars:"Un emoji s'affiche à côté de ton pseudo dans le classement.",
      p4tokens:"Personnalise l'apparence de tes jetons en Puissance 4.",
      ttt:"Personnalise tes symboles ✖️ et ⭕ en Morpion.",
      chess:"Change le thème visuel de l'échiquier.",
      clickfx:"Des particules s'animent autour de ton curseur à chaque clic.",
      emojipacks:"Remplace les émojis du chat par un pack thématique.",
      victorybans:"Une bannière animée s'affiche sur l'écran de fin quand tu gagnes.",
      soundpacks:"Remplace les effets sonores du jeu par un pack personnalisé.",
      emotes:"Envoie une réaction express à tes adversaires en cours de partie.",
    },
    shopRotationLabel:'Renouvellement dans',
    shopCountdown: ms => { const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000); return h>0?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m ${String(s).padStart(2,'0')}s`; },
    shopBundleSave: pct => `−${pct}%`,
    shopBundleItems: n => `${n} article${n>1?'s':''}`,
    shopBundleContains:'🎁 Contenu :',
    shopBundleAlreadyOwned:'Tu possèdes déjà tous les articles de ce bundle.',
    shopBundlePartialOwned: n => `Tu possèdes déjà ${n} article${n>1?'s':''} — prix ajusté.`,
    shopBundleBuy: p => `Acheter le bundle — ${p} ⚡`,
    shopBundleBuyOk:'🎁 Bundle acheté !',
    shopBundleAnon:'Les joueurs anonymes ne peuvent pas acheter de bundles.',
    shopBundleInsufficientFunds:'Champion, tu n\'as pas assez de Libs.',
    shopBundleError:'Erreur lors de l\'achat.',
    shopBundleNames:{ 'bundle-debutant':'Pack Débutant','bundle-retro':'Pack Rétro','bundle-neon-arcade':'Pack Néon Arcade','bundle-galaxie':'Pack Galaxie','bundle-prestige-or':'Pack Prestige Or','bundle-hologramme':'Pack Hologramme Ultime' },
    shopNavLabels:{ featured:'À la une', daily:'Quotidien', bundles:'Bundles', boosts:'Boosts', colors:'Couleurs', fonts:'Polices', bubbles:'Bulles', bgs:'Fonds', nameeffects:'Effets', titles:'Titres', cursorsnakes:'Curseur', avatars:'Avatars', p4tokens:'P4', ttt:'Morpion', chess:'Échiquier', clickfx:'Particules', emojipacks:'Émojis', victorybans:'Victoire', soundpacks:'Sons', emotes:'Emotes' },
    shopDailyBadge:'Quotidien',
    settingsTitle:'⚙️ Paramètres',
    settingsLang:'Langue', settingsTheme:'Thème', settingsSnake:'Serpent',
    settingsSnakeOn:'Activé', settingsSnakeOff:'Désactivé',
    settingsSfx:'Sons', settingsSfxOn:'Activé', settingsSfxOff:'Désactivé', settingsSfxVol:'Volume',
    settingsBgm:'Musique', settingsBgmOn:'Activée', settingsBgmOff:'Désactivée', settingsBgmVol:'Vol. musique',
    settingsRefundTitle:'Cartes de remboursement',
    settingsRefundInfo:(cards, next) => {
      const base = `${cards}/2 carte${cards !== 1 ? 's' : ''} disponible${cards !== 1 ? 's' : ''}`;
      if (!next || cards >= 2) return base;
      const ms = next - Date.now(); if (ms <= 0) return base;
      const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
      return `${base} · recharge dans ${d > 0 ? `${d}j ` : ''}${h}h`;
    },
    shopRefundBtn:'🎟 Rembourser',
    shopRefundNoCards:'Plus de cartes disponibles',
    shopRefundOk:n => `+${n} ⚡ remboursé !`,
    shopRefundError:'Erreur lors du remboursement.',
    boostHintBtn:'💡 Indice',
    helpLibsTitle:'Libs (monnaie)',
    helpLibsDesc:'Les Libs ⚡ sont une monnaie virtuelle. Les joueurs classés <strong>top 3 du classement Global</strong> en gagnent automatiquement toutes les 5 heures (1er : +10 ⚡, 2e : +5 ⚡, 3e : +3 ⚡). Si tu ne joues pas pendant 48 h, ton solde diminue de 10 ⚡ par jour supplémentaire. Clique sur le compteur ⚡ en haut à droite pour ouvrir la boutique. Les joueurs anonymes ne perçoivent pas de Libs.',
    helpBoostTitle:'Boost Indice (quiz)',
    helpBoostDesc:'Dans la boutique, achète un <em>Boost Indice</em> (3 ⚡) : il élimine une mauvaise réponse par question pendant un quiz complet. Le bouton 💡 apparaît dans le quiz dès que le boost est actif et s\'utilise une fois par question.',
    eventsTitle:'Évents', eventsDesc:'Ven-Sam · Snake Challenge',
    eventsDescLocked:'Week-end prochain',
    eventsLockedCard: days => `📅 Dans ${days} j`,
    eventsLockedMsg:  days => `🐍 <strong>Snake Challenge pourrait revenir dans ${days} jour${days>1?'s':''}</strong> <u style="cursor:pointer">vote ici</u> !`,
    eventActiveMsg:   '🐍 <strong>Évent ce week-end</strong> : Snake Challenge ! Nourris ton serpent pour le faire grandir sur tout le site.',
    newsCommunityMsg: '💬 <strong>Luffy Runner</strong> : regarde une idée de la communauté reprise par le créateur ! Toi aussi, si tu veux que la tienne soit prise en compte, laisse un commentaire — ta voix compte !',
    snakeVoteTitle:'Snake Challenge',
    snakeVoteSubtitle:'Veux-tu voir le Snake Challenge revenir ?',
    snakeVoteYes:'Oui, ramène-le !',
    snakeVoteNo:'Non, pas maintenant',
    snakeVoteTotalLabel: n => `${n} vote${n>1?'s':''}`,
    snakeVoteAlreadyYes:'✅ Tu as voté pour le retour du Snake.',
    snakeVoteAlreadyNo:'❌ Tu as voté contre le retour du Snake.',
    snakeVoteChange:'(Changer d\'avis)',
    snakeVoteAnon:'Connecte-toi avec un pseudo pour voter.',
    communityCard:'Pour la communauté',
    homeClassicTitle:'Jeux Multijoueur',
    btnQuit:'🚪 Quitter',
    eventsScreenTitle:'🎉 Évents', eventsScreenSub:'Week-end spécial',
    snakeChallengeTitle:'Snake Challenge',
    snakeChallengeDesc:'Nourris ton serpent pour le faire grandir sur tout le site !',
    btnPlay:'Jouer',
    snakeNameTitle:'🐍 Ton pseudo',
    snakeNameSub:'Choisis un pseudo pour figurer dans le classement.',
    snakeNamePh:'Ton pseudo',
    snakeNameErr:'Entre un pseudo pour continuer.',
    btnSnakeConfirm:"C'est parti !", btnSnakeCancel:'Annuler',
    snakeLbTitle:'Classement Snake', snakeLbEmpty:'Aucun score enregistré.',
    snakeScoreLabel:'Score', snakeBestLabel:'Meilleur',
    snakeHsDisplay:n => `🏆 Ton record : ${n} pomme${n > 1 ? 's' : ''}`,
    snakeGameOver:'Game Over', snakeNewRecord:'🏆 Nouveau record !',
    btnSnakeRestart:'Rejouer', btnSnakeQuit:'Quitter',
    snakePause:'⏸ Pause', btnSnakeResume:'▶ Reprendre',
    btnSnakeBack:'← Retour', btnSnakeHome:'🏠 Quitter',
    snakeHint:'↑ ↓ ← → ou glisser sur mobile',
    luffyChallengeDesc:'Aide Luffy à fuir la Marine ! Saute par-dessus les obstacles au sol, accroupis-toi sous ceux qui volent.',
    luffyNameTitle:'🏴‍☠️ Ton pseudo',
    luffyLbTitle:'Classement Luffy Runner',
    luffyHsDisplay:n => `🏆 Ton record : ${n} pts`,
    luffyHint:'↑ / Espace pour sauter · ↓ pour t\'accroupir',
    luffySuggestLink:'💬 Proposer un jeu pour cette section',
    triviaResumeBtn:'▶ Reprendre', triviaBackToQuiz:'← Retour au Quiz', triviaQuitHome:'🏠 Quitter',
    communityTitle:'? Pour la communauté',
    communityIntro:'Cette section est réservée à un <strong>jeu choisi par vous</strong>, les joueurs de Libero.',
    communityStep1:'Propose le jeu que tu voudrais voir sur le site en laissant un commentaire via le bouton <strong>✉️</strong> en bas à gauche.',
    communityStep2:'Les suggestions les plus mentionnées seront sélectionnées et soumises au vote de la communauté.',
    communityStep3:'Le jeu le plus voté sera développé et ajouté sur Libero. <strong>Ton avis compte vraiment.</strong>',
    communityCta:'Tu as une idée ? Fais-le savoir !',
    btnSuggestion:'✉️ Laisser une suggestion',
    commentTitle:'💬 Laisser un commentaire',
    commentSub:'Partage ton avis, une idée ou un bug, le créateur le recevra par mail.',
    commentPseudoPh:'Ton pseudo (optionnel)',
    commentMsgPh:'Ton message…',
    btnSend:'Envoyer ✉️',
    tutoSkip:'Passer le guide', tutoOk:"J'ai compris ✓",
    newsTitle:'📰 News',
    btnHelpTitle:'Aide', btnSnakeToggle:'Activer / Désactiver le serpent', libsCounterTitle:'Ouvrir la boutique',
    snakeOverScore:(score, hs) => `Score : ${score} · Meilleur : ${hs}`,
    helpContent:{
      general:[
        { icon:'🏠', title:"Sections d'accueil", desc:"L'accueil propose <em>Jeux Classiques</em> (Puissance 4, Morpion, Échecs), <em>Culture Générale</em> (quiz par thèmes), <em>Évents</em> (mini-jeux du week-end) et <em>Pour la communauté</em> (le mini-jeu <strong>Luffy Runner</strong>, une idée de joueur reprise par le créateur). Chaque section a son propre classement." },
        { icon:'🎉', title:'Évents', desc:"Des mini-jeux spéciaux sont disponibles certains week-ends. La carte est <strong>verrouillée</strong> hors week-end et indique le nombre de jours avant le prochain évent. Quand c'est actif : <em>Snake Challenge</em> — nourris ton serpent avec les 🍎, les bords sont traversables. Un nouveau record affiche <em>🏆 Nouveau record !</em>. Appuie sur <strong>⏸</strong> (ou Échap / P) pour mettre en pause." },
        { icon:'🎮', title:'Créer une partie classique', desc:"Choisis un jeu, entre ton pseudo (optionnel) puis clique <em>Créer une partie</em>. Partage le code à 4 lettres à ton adversaire. Tu peux aussi jouer <strong>Solo contre le bot</strong> en choisissant une difficulté : Facile, Moyen ou Difficile." },
        { icon:'🤖', title:'Mode Solo (vs Bot)', desc:"Joue seul contre un robot. <em>Facile</em> : le bot joue au hasard. <em>Moyen</em> : le bot bloque et attaque. <em>Difficile</em> : le bot joue de manière optimale. Les parties <strong>Moyen et Difficile</strong> comptent dans le classement classique." },
        { icon:'🔗', title:'Rejoindre', desc:"Entre le code à 4 lettres reçu et clique <em>Rejoindre</em>. La partie démarre automatiquement dès que les deux joueurs sont connectés." },
        { icon:'💬', title:'Chat', desc:"Envoie des messages à ton adversaire pendant une partie classique. Le bouton <em>Vider</em> efface l'historique côté local uniquement." },
        { icon:'🔄', title:'Reconnexion', desc:"Si tu recharges la page, tu retrouves automatiquement ta partie classique en cours. L'adversaire a <strong>30 secondes</strong> pour se reconnecter, sinon la partie est annulée." },
        { icon:'🔁', title:'Rejouer', desc:"En fin de partie classique, clique <em>Rejouer</em>. La partie redémarre uniquement si les deux joueurs acceptent." },
        { icon:'🌍', title:'Classement Global', desc:"Visible dès la page d'accueil, il regroupe <strong>tous les joueurs ayant au moins un point</strong>. Score = victoires classiques (×10) + points Quiz + meilleur score Snake (×10) + meilleur score Luffy Runner (÷10). Mis à jour en temps réel." },
        { icon:'🏆', title:'Classements par section', desc:"Chaque section garde aussi son propre classement : victoires/défaites/nuls pour les Jeux Classiques, total de points pour le Quiz." },
        { icon:'🏴‍☠️', title:'Luffy Runner', desc:"Aide Luffy à fuir la Marine dans ce clone du jeu du dinosaure ! Saute (<strong>↑</strong> / Espace) par-dessus les obstacles au sol (tonneaux, canons, crabes…) et accroupis-toi (<strong>↓</strong>) sous les obstacles volants (mouettes, boulets de canon…). Ton meilleur score <strong>persiste</strong> entre les sessions et alimente un classement dédié. C'est d'ailleurs une <strong>idée de la communauté</strong> reprise par le créateur — si tu veux que la tienne soit prise en compte, laisse un commentaire via le bouton dans l'écran de jeu." },
        { icon:'📰', title:'News', desc:"La carte News est repliée dans le <strong>coin en haut à gauche</strong>. <strong>Clique dessus</strong> pour l'ouvrir : elle affiche l'état de l'évent en cours (ou le compte à rebours jusqu'au prochain) et un rappel pour participer à la section <strong>Luffy Runner</strong>. Reclique pour la refermer." },
        { icon:'⚙️', title:'Paramètres', desc:"Le bouton <strong>⚙️</strong> en <em>haut à droite</em> regroupe tous les réglages : <strong>Langue</strong>, <strong>Thème</strong>, <strong>Serpent</strong>, <strong>Sons</strong> (effets sonores + volume), <strong>Musique</strong> (fond musical + volume) et <strong>Cartes de remboursement</strong>. Tout est mémorisé entre les sessions." },
        { icon:'🔊', title:'Sons & Musique', desc:"<strong>Sons</strong> : des effets sonores accompagnent chaque action (poser une pièce, victoire, quiz, chat, boutique, Snake…). Active/désactive-les via <strong>⚙️ → Sons</strong> et règle le volume.<br><strong>Musique</strong> : une musique ambiante joue en fond. Active/désactive-la via <strong>⚙️ → Musique</strong> avec son propre curseur de volume. Les deux se gèrent indépendamment." },
        { icon:'🐍', title:'Serpent', desc:"Un petit serpent suit ton curseur. Il <strong>grandit et change de couleur</strong> selon ton score global 🌍 : or (1er), bleu (2e), bronze (3e). Joue et grimpe dans le classement pour l'allonger ! Active ou désactive-le via le bouton <strong>⚙️</strong> en haut à droite → <strong>Serpent</strong>." },
        { icon:'☀️', title:'Thème jour / nuit', desc:"Le bouton <strong>⚙️</strong> en <em>haut à droite</em> → <strong>Thème</strong> bascule entre le thème clair et sombre. Le site s'adapte aussi automatiquement selon l'heure (clair de 7h à 20h, sombre la nuit). Ton choix manuel est mémorisé entre les sessions." },
        { icon:'🚪', title:'Bouton Quitter', desc:"Pendant une partie, le bouton <em>🚪 Quitter</em> en haut au centre te ramène au menu principal. Si une partie est en cours, tu es averti que tu abandonneras avant de confirmer." },
        { icon:'✉️', title:'Laisser un commentaire', desc:"Clique sur le bouton <strong>✉️</strong> en bas à gauche pour envoyer un message au créateur : avis, idée, bug… Aucune connexion requise. Tu peux laisser un pseudo ou rester anonyme." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🗂️', title:'Navigation boutique', desc:"À gauche de la boutique, une <strong>barre de catégories</strong> te permet de sauter directement à la section souhaitée : ⭐ À la une, 📅 Quotidien, 🎁 Bundles, 💡 Boosts, 🎨 Couleurs, ✍️ Polices, 💬 Bulles, 🖼️ Fonds. Sur mobile, seuls les icônes sont affichés. Le bouton de la section visible s'allume automatiquement." },
        { icon:'🎁', title:'Bundles', desc:"La section <strong>Bundles</strong> propose des lots thématiques regroupant plusieurs cosmétiques à prix réduit (−24 % à −28 %). Si tu possèdes déjà certains articles d'un bundle, le prix est <strong>ajusté automatiquement</strong> — tu ne paies que pour ce qu'il te manque. La sélection <strong>⭐ À la une</strong> et <strong>📅 Quotidien</strong> se renouvelle toutes les 24 h — un compte à rebours indique l'heure du prochain renouvellement." },
        { icon:'✨', title:'Effets de pseudo', desc:"Anime l'affichage de ton pseudo dans les classements, le chat, les badges et le podium. Les effets sont <strong>cumulables avec ta couleur de pseudo</strong> : la couleur reste la teinte, l'effet ajoute l'animation par-dessus. Exemples : Clignotement Néon, Glitch, Vague Arc-en-ciel. Rareté : Épique à Légendaire." },
        { icon:'🏷️', title:'Titres', desc:"Ajoute un court texte de statut affiché à côté de ton pseudo dans les classements, badges et chips de salle d'attente. Exemples : Tacticien, Quiz Master, Roi du Snake, Légende Vivante. Rareté : Commun à Épique. Les titres achetés se combinent avec les <strong>titres honorifiques</strong> (voir ci-dessous)." },
        { icon:'🥇', title:'Titres honorifiques', desc:"Si tu atteins la <strong>1re place</strong> du classement global, tu reçois automatiquement le titre honorifique <em>N°1 Global</em>. Un message de félicitations apparait lors de ta prochaine visite — clique <em>Accepter</em> pour le valider. Le titre est retiré si tu es détrôné. Il est visible en boutique mais ne peut pas être acheté." },
        { icon:'🖱️', title:'Skins de curseur', desc:"Remplace l'apparence du serpent qui suit ton curseur (couleur, motif, traînée, forme de tête). Le skin prend le pas sur la couleur de rang quand il est équipé. Visible uniquement si le <strong>Serpent</strong> est activé dans les paramètres. Rareté : Rare à Légendaire." },
        { icon:'🎭', title:'Avatars', desc:"Remplace l'icône affichée dans ton badge joueur en partie et dans les classements. Exemples : Manette 🎮, Chat Pixel 🐱, Fusée 🚀, Couronne 👑. Rareté : Commun à Épique." },
        { icon:'🔴', title:'Jetons Puissance 4', desc:"Restyle tes pions dans la grille 7×6 (motif, texture, lueur). La distinction <strong>rouge / jaune</strong> entre les deux camps est conservée — le skin habille la couleur sans la rendre ambiguë. Tes deux adversaires verront tes jetons. Rareté : Rare à Épique." },
        { icon:'✖️', title:'Symboles Morpion', desc:"Remplace les X / O par une paire de symboles personnalisés sur la grille 3×3. Les deux symboles restent nettement distinguables. Ton adversaire voit ta paire. Exemples : Soleil / Lune ☀️🌙, Cœur / Étoile ❤️⭐. Rareté : Commun à Épique." },
        { icon:'♟️', title:'Thèmes d\'échiquier', desc:"Restyle le plateau et les pièces de l'échiquier. Le contraste cases claires / sombres et la lisibilité des pièces sont toujours garantis. Ton adversaire voit ton thème. Exemples : Cyber Grid, Marbre Royal. Rareté : Épique à Légendaire." },
        { icon:'🐍', title:'Skins Snake (Évents)', desc:"Modifie l'apparence du serpent, des pommes et du plateau pendant le Snake Challenge. Mode solo uniquement — aucun souci d'équité. Exemples : Serpent Arc-en-ciel, Serpent de Lave, Plateau Galaxie. Rareté : Rare à Légendaire." },
        { icon:'💥', title:'Particules de clic', desc:"Remplace les particules qui s'affichent lorsque tu cliques sur les boutons et cartes du site. Exemples : Bulles 🫧, Confettis 🎊, Feu d\'Artifice 🎆. Rareté : Commun à Épique." },
        { icon:'🌈', title:'Packs d\'émojis', desc:"Remplace le jeu d'émojis de la pluie animée au premier chargement de la page. Exemples : Pack Fête 🎉, Pack Gaming 🎮, Pack Cosmos 🌌. Rareté : Commun à Rare." },
        { icon:'🏆', title:'Bannières de victoire', desc:"Personnalise le style et l'animation de la bannière de fin de partie (victoire). Visible à l'écran de résultat des jeux classiques et du quiz. Exemples : Triomphe Néon, Flammes de Champion, Couronnement. Rareté : Épique à Légendaire." },
        { icon:'🔊', title:'Packs de sons', desc:"Remplace certains sons du site (achat, victoire, clic, changement du compteur Libs) par un set sonore thématique. Les packs respectent ta préférence de son (⚙️ → Sons). Exemples : Rétro Arcade, Cristal, Épique. Rareté : Rare à Épique." },
        { icon:'😎', title:'Emotes', desc:"Débloque des réactions rapides envoyables dans le chat des parties classiques multi. Les emotes possédées s'affichent dans une barre de réactions en jeu. Exemples : GG 👍, En feu 🔥, Incroyable 😱. Rareté : Commun à Épique." },
        { icon:'🎓', title:'Tutoriel', desc:"À ta première visite, un guide apparaît automatiquement pour te présenter chaque fonctionnalité écran par écran. Une fois une étape vue, elle ne s'affiche plus. Pour tout revoir depuis le début, vide le cache de ton navigateur (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'Culture Générale', desc:"Réponds à des questions à choix multiple. Sélectionne <strong>un ou plusieurs thèmes</strong> parmi 12 catégories : Histoire, Sciences, Cinéma, Musique, etc. Les questions sont mélangées si tu choisis plusieurs thèmes." },
        { icon:'🌐', title:'Langue', desc:"Change la langue via le bouton <strong>⚙️</strong> en haut à droite → <strong>Langue</strong>. En mode <strong>FR</strong>, les questions sont traduites en français (les termes techniques restent en anglais si nécessaire). En mode <strong>EN</strong>, les questions sont en anglais d'origine. Le site détecte automatiquement ta langue au premier lancement." },
        { icon:'▶', title:'Mode Solo', desc:"Sélectionne un ou plusieurs thèmes et clique <em>Solo</em>. Tu joues seul à ton rythme. Ton score est automatiquement ajouté au classement à la fin." },
        { icon:'👥', title:'Mode Multijoueur', desc:"Clique <em>Créer un salon</em> (2 à 6 joueurs). Partage le code à 4 lettres. L'hôte lance la partie quand tout le monde est prêt. Tout le monde voit les mêmes questions en même temps." },
        { icon:'⏱', title:'Chrono', desc:"Tu as <strong>20 secondes</strong> par question. Le chrono passe en rouge sous les 5 secondes. Sans réponse dans le temps imparti, la question est perdue." },
        { icon:'✅', title:'Correction', desc:"Après chaque réponse (ou expiration du temps), la bonne réponse s'affiche en vert et les mauvaises en rouge. En multi, tu vois aussi le score de chaque joueur." },
        { icon:'🏆', title:'Classement Quiz', desc:"1 point par bonne réponse. Les points s'accumulent quiz après quiz, qu'on joue en solo ou en groupe. Le classement affiche le total de points et le nombre de quiz joués." },
      ],
      connect4:[
        { icon:'🎯', title:'Objectif', desc:"Aligner <strong>4 pions</strong> de ta couleur, horizontalement, verticalement ou en diagonale." },
        { icon:'👥', title:'Joueurs', desc:"Rouge 🔴 contre Jaune 🟡. Le joueur Rouge commence toujours." },
        { icon:'▼', title:'Comment jouer', desc:"Clique sur le bouton <strong>▼</strong> au-dessus de la colonne où tu veux faire tomber ton pion. Le pion descend tout en bas de la colonne." },
        { icon:'📐', title:'Grille', desc:"7 colonnes × 6 rangées. Une colonne pleine ne peut plus être jouée." },
        { icon:'✨', title:'Fin de partie', desc:"Les 4 pions gagnants sont surlignés. Si la grille est pleine sans alignement, c'est un match nul." },
      ],
      ttt:[
        { icon:'🎯', title:'Objectif', desc:"Aligner <strong>3 symboles</strong> identiques en ligne, en colonne ou en diagonale." },
        { icon:'👥', title:'Joueurs', desc:"Croix ✕ contre Rond ○. Le joueur Croix commence toujours." },
        { icon:'👆', title:'Comment jouer', desc:"Clique sur une <strong>case vide</strong> pour y poser ton symbole. Impossible de jouer sur une case déjà occupée." },
        { icon:'📐', title:'Grille', desc:"3 × 3 cases, soit 9 cases au total." },
        { icon:'✨', title:'Fin de partie', desc:"La ligne gagnante est surlignée. Si les 9 cases sont remplies sans alignement, c'est un match nul." },
      ],
      chess:[
        { icon:'🎯', title:'Objectif', desc:"Mettre le roi adverse en <strong>échec et mat</strong> (il est attaqué et ne peut plus s'échapper)." },
        { icon:'👥', title:'Joueurs', desc:"Blancs ♔ contre Noirs ♚. Les Blancs commencent toujours. Le plateau est orienté : tes pièces sont toujours en bas." },
        { icon:'👆', title:'Comment jouer', desc:"<strong>1.</strong> Clique sur une de tes pièces → les cases accessibles s'affichent.<br><strong>2.</strong> <em>Point noir</em> = case libre · <em>Anneau</em> = capture possible.<br><strong>3.</strong> Clique sur une case surlignée pour jouer le coup." },
        { icon:'🔴', title:'Échec', desc:"Quand ton roi est en échec, sa case devient <strong>rouge</strong>. Tu dois obligatoirement parer l'échec." },
        { icon:'🟡', title:'Dernier coup', desc:"Les deux cases du dernier coup joué sont surlignées en <strong>jaune</strong>." },
        { icon:'♛', title:'Promotion du pion', desc:"Quand ton pion atteint la dernière rangée, une fenêtre s'ouvre pour choisir la pièce de remplacement : Dame, Tour, Fou ou Cavalier." },
        { icon:'📜', title:'Règles avancées', desc:"Le <strong>roque</strong> (petit et grand), la <strong>prise en passant</strong> et le <strong>pat</strong> (match nul) sont gérés automatiquement." },
      ],
    },
    triviaCats:[
      { id:9,  name:'Culture G.', icon:'🧠' }, { id:23, name:'Histoire',   icon:'📜' },
      { id:22, name:'Géographie', icon:'🌍' }, { id:17, name:'Sciences',   icon:'🔬' },
      { id:21, name:'Sports',     icon:'⚽' }, { id:11, name:'Cinéma',     icon:'🎬' },
      { id:12, name:'Musique',    icon:'🎵' }, { id:14, name:'Télévision', icon:'📺' },
      { id:19, name:'Maths',      icon:'🔢' }, { id:20, name:'Info',       icon:'💻' },
      { id:25, name:'Arts',       icon:'🎨' }, { id:27, name:'Animaux',    icon:'🐾' },
    ],
    tutoSteps:{
      landing_news:'📰 Le cadre <strong>News</strong> est replié dans le coin <strong>en haut à gauche</strong>. <strong>Clique dessus</strong> pour l\'ouvrir : il affiche les dernières actualités, nouvelles fonctionnalités, annonces et commentaires de joueurs. Reclique pour le refermer.',
      landing_cats:'👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! L\'accueil propose quatre sections : <strong>Jeux Classiques</strong>, <strong>Culture Générale</strong>, <strong>Évents</strong> (mini-jeux du week-end) et <strong>Pour la communauté</strong> (le mini-jeu <strong>Luffy Runner</strong>). Clique sur une carte pour commencer.',
      landing_lb:'🌍 Le <strong>Classement Global</strong> regroupe <em>tous</em> les joueurs ayant au moins un point, quelle que soit la section jouée. Score = victoires classiques ×10 + points Quiz + meilleur score Snake ×10 + meilleur score Luffy Runner ÷10. Plus tu montes, plus ton serpent 🐍 grandit !',
      landing_btns:'⚙️ Des boutons permanents sont disponibles :<br>▶ <strong>En haut à droite</strong> : le bouton <strong>⚙️</strong> ouvre les <strong>Paramètres</strong> (thème, langue, serpent, cartes de remboursement).<br>▶ <strong>En bas à droite</strong> : ❓ <strong>Aide</strong> · ✉️ <strong>Commentaire</strong>',
      landing_libs:'⚡ <strong>Libs</strong> : une monnaie virtuelle gagnée par les meilleurs joueurs. Les top 3 du classement Global reçoivent automatiquement des Libs toutes les 5h (1er : +10 ⚡, 2e : +5 ⚡, 3e : +3 ⚡). Dépense-les dans la <strong>boutique</strong> pour obtenir des boosts quiz !',
      events_snake:'🐍 C\'est l\'évent du week-end : <strong>Snake Challenge</strong> ! Clique <em>Jouer</em>, ton serpent entre dans l\'arène. Mange les 🍎 pour grandir (les bords sont traversables, tu ressors de l\'autre côté !). Ton meilleur score <strong>persiste</strong> entre les sessions.',
      luffy_runner:'🏴‍☠️ <strong>Luffy Runner</strong> : aide Luffy à fuir la Marine ! Saute (↑ / Espace) par-dessus les obstacles au sol, accroupis-toi (↓) sous les obstacles volants. Ton meilleur score alimente un classement dédié.',
      home_games:'🎮 Choisis ton jeu en haut : <strong>Puissance 4</strong>, <strong>Morpion</strong> ou <strong>Échecs</strong>. Le classement est partagé entre les trois jeux.',
      home_bot:'🤖 <strong>Mode Solo</strong> : joue contre le bot à 3 niveaux de difficulté : Facile, Moyen ou Difficile. Tes victoires et défaites sont comptées dans le classement !',
      home_multi:'👥 <strong>Mode Multijoueur</strong> : entre ton pseudo (optionnel), puis clique sur <em>Créer une partie</em> pour générer un code, ou entre le code d\'un ami pour le rejoindre.',
      home_lb:'🏆 <strong>Classement</strong> : victoires, défaites et nuls s\'enregistrent automatiquement après chaque partie (bot Moyen / Difficile ou multijoueur).',
      quiz_themes:'🧠 <strong>Quiz Culture Générale</strong> : sélectionne un ou plusieurs thèmes (Histoire, Cinéma, Sciences…), puis joue en <strong>Solo</strong> ou crée un <strong>salon multijoueur</strong> à partager avec tes amis.',
      quiz_lb:'🏆 Le <strong>classement Quiz</strong> est séparé du classement Classique. Les points sont attribués selon ta vitesse de réponse et le nombre de bonnes réponses.',
    },
  },
  en: {
    siteTitle:'Multiplayer Games', siteSubtitle:'Choose your category',
    classicTitle:'Classic Games', classicDesc:'Connect 4 · Tic Tac Toe · Chess',
    triviaTitle:'General Knowledge', triviaDesc:'Themed quizzes · Solo & Multi',
    homeSubtitle:'2 players • Real time',
    botLabel:'🤖 Play solo against the bot:',
    botEasy:'😊 Easy', botMedium:'🎯 Medium', botHard:'💀 Hard',
    btnCreate:'Create a multiplayer game',
    namePh:'Your username (required)', codePh:'4-letter code', errNoName:'Enter a username to continue.',
    errNameTaken:'🚫 This username is already taken. Choose another one.',
    eventCountdownFmt: ms => { const m=Math.ceil(ms/60000),d=Math.floor(m/1440),h=Math.floor((m%1440)/60),r=m%60; return d>0?`⏳ Event ends in ${d}d ${h}h`:h>0?`⏳ Event ends in ${h}h ${r}min`:`⏳ Event ends in ${r}min`; },
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
    triviaNamePh:'Your username (required)',
    triviaThemesLabel:'Themes (multiple selection):', triviaDiffLabel:'Difficulty:', diffMixed:'🎲 Mixed',
    triviaNbLabel:'Number of questions',
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
    triviaFinishedTitle:'Final Results', btnLeaveGame:'Back to menu', btnQuitTrivia:'🚪 Quit',
    errNoTheme:'Choose at least one theme to start.',
    errLoadQ:'Could not load questions. Check your connection.',
    err4Letters:'Enter a 4-letter code.',
    soloLoading:'⏳ Loading…',
    globalLbTitle:'Global Leaderboard', globalLbEmpty:'No games played yet.', globalLbPts:'pts',
    globalLbMore:'See more', globalLbLess:'See less',
    themeDay:'☀️ Day theme', themeNight:'🌙 Night theme', themeToggle:'Toggle theme',
    mixLabel:n => `🎲 Mix (${n} themes)`,
    colLabel:n => `Play column ${n}`,
    restartRequested:'\nOpponent wants to play again!',
    errConnect:'Cannot reach the server. Please try again.',
    help:{ title:'Help', tabs:{ general:'General', quiz:'Quiz', connect4:'Connect 4', ttt:'Tic Tac Toe', chess:'Chess' } },
    shopTitle:'⚡ Shop', shopBalanceLabel:'Your balance:',
    shopBoostHintName:'💡 Quiz Hint',
    shopBoostHintDesc:'Eliminates a wrong answer. Usable up to 2 times per question.',
    shopBtnBuy10:'10 hints — 3 ⚡', shopBtnBuy20:'20 hints — 5 ⚡',
    shopPending:n => `${n} hint${n > 1 ? 's' : ''} remaining`,
    shopInsufficient:'Champion, you don\'t have enough Libs.', shopBuyError:'Purchase failed.',
    shopBuyOk:'Boost purchased!',
    shopPromoTitle:'🎟 Promo code', shopPromoPlaceholder:'4-character code', shopPromoBtn:'Redeem',
    shopPromoOk:n => `🎉 +${n} ⚡ credited!`,
    shopPromoAlreadyUsed:'You have already used this code.', shopPromoInvalid:'Invalid code.', shopPromoAnon:'Anonymous players cannot use codes.',
    shopCosmeticsTitle:'🎨 Pseudo cosmetics',
    shopCosmeticNames:{ rainbow:'Rainbow', galaxy:'Galaxy', silver:'Silver', bronze:'Bronze', gold:'Gold', diamond:'Diamond' },
    shopCosmeticBuy:p => `Buy — ${p} ⚡`,
    shopCosmeticEquip:'Equip', shopCosmeticEquipped:'✓ Equipped', shopCosmeticUnequip:'Remove',
    shopCosmeticPreview:'Libero',
    shopCosmeticBought:'🎨 Cosmetic purchased!',
    shopCosmeticAlreadyOwned:'You already own this cosmetic.',
    shopCosmeticAnon:'Anonymous players cannot buy cosmetics.',
    shopFontsTitle:'✍️ Pseudo fonts',
    shopFontCategories:{ futuriste:'Futuristic', impact:'Impact', hacker:'Hacker', retro:'Retro', fun:'Fun', elegant:'Elegant', free:'Free' },
    shopFontGetFree:'Get',
    shopBubbleTitle:'💬 Chat bubbles',
    shopBubbleNames:{ 'bubble-ardoise':'Slate', 'bubble-ocean':'Ocean', 'bubble-menthe':'Mint', 'bubble-corail':'Coral', 'bubble-ambre':'Amber', 'bubble-lavande':'Lavender', 'bubble-rubis':'Ruby', 'bubble-emeraude':'Emerald', 'bubble-indigo':'Indigo', 'bubble-magenta':'Neon magenta', 'bubble-cyan':'Neon cyan', 'bubble-crepuscule':'Dusk', 'bubble-aurore':'Aurora', 'bubble-sunset':'Sunset', 'bubble-tropical':'Tropical', 'bubble-arcade':'Arcade neon', 'bubble-galaxie':'Galaxy', 'bubble-verre':'Neon glass', 'bubble-or':'Liquid gold', 'bubble-holographique':'Holographic', 'bubble-cameleon':'Chameleon' },
    shopBgTitle:'🖼 Wallpapers',
    shopBgNames:{'bg-nuit':'Calm Night','bg-ardoise':'Deep Slate','bg-brume':'Violet Mist','bg-aurore-deg':'Aurora Gradient','bg-crepuscule':'Neon Dusk','bg-cyber':'Cyber Grid','bg-circuit':'Circuit','bg-hexagones':'Hexagons','bg-etoile':'Starry Sky','bg-particules':'Floating Particles','bg-pluie':'Neon Rain','bg-vagues':'Light Waves','bg-synthwave':'Synthwave','bg-nebuleuse':'Nebula','bg-aurores':'Moving Auroras','bg-galaxie':'Living Galaxy','bg-tempete':'Neon Storm','bg-hologramme':'Hologram'},
    shopNameEffectsTitle:'✨ Name Effects',
    shopNameEffectNames:{'nameeffect-blink':'Neon Blink','nameeffect-pulse':'Pulsing Glow','nameeffect-gradient':'Scrolling Gradient','nameeffect-sparks':'Sparks','nameeffect-glitch':'Glitch','nameeffect-rainbow':'Rainbow Wave'},
    shopTitlesTitle:'🏷️ Titles',
    shopTitleNames:{'title-tactician':'Tactician','title-strategist':'The Strategist','title-quizmaster':'Quiz Master','title-snakeking':'Snake King','title-unbeaten':'Undefeated','title-champion':'Champion','title-legend':'Living Legend'},
    honorTitleNames:{'honor-rank1-global':'#1 Global','honor-creator':'Creator'},
    shopHonoraryBadge:'🏆 Honorary',
    shopHonoraryOwned:'Earned',
    shopHonoraryNote:'Reach #1 on the global leaderboard to earn this title.',
    honorModalTitle:'Honorary Title!',
    honorModalMsg:(titleName) => `Congratulations! You're ranked #1. As a reward, you receive the title <strong>${titleName}</strong>. It will appear next to your username as long as you hold the top spot.`,
    honorModalBtn:'Accept',
    shopCursorSnakesTitle:'🖱️ Cursor Skins',
    shopCursorSnakeNames:{'cursorsnake-pixel':'Pixel Snake','cursorsnake-neon':'Neon Snake','cursorsnake-comet':'Comet','cursorsnake-electric':'Electric Eel','cursorsnake-stars':'Starry Trail','cursorsnake-fire':'Fire Dragon'},
    shopAvatarsTitle:'🎭 Avatars',
    shopAvatarNames:{'avatar-gamepad':'Gamepad','avatar-cat':'Pixel Cat','avatar-lightning':'Lightning','avatar-rocket':'Rocket','avatar-robot':'Robot','avatar-skull':'Skull','avatar-crown':'Crown'},
    shopP4TokensTitle:'🔴 Connect 4 Tokens',
    shopP4TokenNames:{'p4token-goldsilver':'Gold & Silver','p4token-neon':'Neon Tokens','p4token-lavalice':'Lava & Ice','p4token-galaxy':'Galaxy'},
    shopTttTitle:'✖️ Tic-Tac-Toe Symbols',
    shopTttNames:{'ttt-neon':'X & O Neon','ttt-sunmoon':'Sun / Moon','ttt-heartstar':'Heart / Star','ttt-catdog':'Cat / Dog','ttt-skulllightning':'Skull / Lightning'},
    shopChessTitle:'♟️ Chess Themes',
    shopChessNames:{'chess-cyber':'Cyber Grid','chess-frost':'Frosted Glass','chess-neon':'Neon Board','chess-marble':'Royal Marble'},
    shopClickFxTitle:'💥 Click Particles',
    shopClickFxNames:{'clickfx-bubbles':'Bubbles','clickfx-confetti':'Confetti','clickfx-neon':'Neon Sparks','clickfx-stars':'Shooting Stars','clickfx-firework':'Firework'},
    shopEmojiPacksTitle:'🌈 Emoji Packs',
    shopEmojiPackNames:{'emojipack-animals':'Animal Pack 🐾','emojipack-hearts':'Hearts Pack 💜','emojipack-party':'Party Pack 🎉','emojipack-gaming':'Gaming Pack 🎮','emojipack-cosmos':'Cosmos Pack 🌌'},
    shopVictoryBansTitle:'🏆 Victory Banners',
    shopVictoryBanNames:{'victoryban-neon':'Neon Triumph','victoryban-confetti':'Confetti Explosion','victoryban-flames':'Champion Flames','victoryban-lightning':'Lightning Glory','victoryban-crown':'Coronation'},
    shopSoundPacksTitle:'🔊 Sound Packs',
    shopSoundPackNames:{'soundpack-8bit':'8-bit','soundpack-retro':'Retro Arcade','soundpack-crystal':'Crystal','soundpack-cyber':'Cyber','soundpack-epic':'Epic'},
    shopEmotesTitle:'😎 Emotes',
    shopEmoteNames:{'emote-gg':'GG 👍','emote-wellplayed':'Well played 🤝','emote-fire':'On fire 🔥','emote-easy':'Too easy 😎','emote-omg':'Incredible 😱'},
    shopFeaturedTitle:'⭐ Featured',
    shopDailyTitle:'📅 Daily',
    shopBundlesTitle:'🎁 Bundles',
    shopSectionDescs:{
      featured:"This week's picks — refreshes every 24h.",
      daily:"Discounted deals, refreshed every day.",
      bundles:"Themed packs at a reduced price. Already own some items? The price adjusts automatically.",
      colors:"Color your username across leaderboards and matches.",
      fonts:"Change the font of your username everywhere on Libero.",
      bubbles:"Customize the look of your chat bubbles.",
      bgs:"Apply an animated background to your play area.",
      nameeffects:"Add an animated visual effect directly to your username.",
      titles:"Display a title next to your username in the leaderboard.",
      cursorsnakes:"Replace your mouse cursor with an animated snake.",
      avatars:"An emoji displays next to your username in the leaderboard.",
      p4tokens:"Customize the look of your Connect 4 tokens.",
      ttt:"Customize your ✖️ and ⭕ symbols in Tic-Tac-Toe.",
      chess:"Change the visual theme of the chess board.",
      clickfx:"Particles animate around your cursor on every click.",
      emojipacks:"Replace chat emojis with a themed pack.",
      victorybans:"An animated banner appears on the end screen when you win.",
      soundpacks:"Replace game sound effects with a custom pack.",
      emotes:"Send a quick reaction to your opponents during a match.",
    },
    shopRotationLabel:'Refreshes in',
    shopCountdown: ms => { const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000); return h>0?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m ${String(s).padStart(2,'0')}s`; },
    shopBundleSave: pct => `−${pct}%`,
    shopBundleItems: n => `${n} item${n>1?'s':''}`,
    shopBundleContains:'🎁 Contents:',
    shopBundleAlreadyOwned:'You already own all items in this bundle.',
    shopBundlePartialOwned: n => `You already own ${n} item${n>1?'s':''} — price adjusted.`,
    shopBundleBuy: p => `Buy bundle — ${p} ⚡`,
    shopBundleBuyOk:'🎁 Bundle purchased!',
    shopBundleAnon:'Anonymous players cannot buy bundles.',
    shopBundleInsufficientFunds:'Champion, you don\'t have enough Libs.',
    shopBundleError:'Purchase failed.',
    shopBundleNames:{ 'bundle-debutant':'Starter Pack','bundle-retro':'Retro Pack','bundle-neon-arcade':'Neon Arcade Pack','bundle-galaxie':'Galaxy Pack','bundle-prestige-or':'Gold Prestige Pack','bundle-hologramme':'Ultimate Hologram Pack' },
    shopNavLabels:{ featured:'Featured', daily:'Daily', bundles:'Bundles', boosts:'Boosts', colors:'Colors', fonts:'Fonts', bubbles:'Bubbles', bgs:'Backgrounds', nameeffects:'Effects', titles:'Titles', cursorsnakes:'Cursor', avatars:'Avatars', p4tokens:'P4', ttt:'Tic-Tac', chess:'Chess', clickfx:'Particles', emojipacks:'Emojis', victorybans:'Victory', soundpacks:'Sounds', emotes:'Emotes' },
    shopDailyBadge:'Daily',
    settingsTitle:'⚙️ Settings',
    settingsLang:'Language', settingsTheme:'Theme', settingsSnake:'Snake',
    settingsSnakeOn:'Enabled', settingsSnakeOff:'Disabled',
    settingsSfx:'Sound', settingsSfxOn:'Enabled', settingsSfxOff:'Disabled', settingsSfxVol:'Volume',
    settingsBgm:'Music', settingsBgmOn:'Enabled', settingsBgmOff:'Disabled', settingsBgmVol:'Music vol.',
    settingsRefundTitle:'Refund cards',
    settingsRefundInfo:(cards, next) => {
      const base = `${cards}/2 card${cards !== 1 ? 's' : ''} available`;
      if (!next || cards >= 2) return base;
      const ms = next - Date.now(); if (ms <= 0) return base;
      const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
      return `${base} · refill in ${d > 0 ? `${d}d ` : ''}${h}h`;
    },
    shopRefundBtn:'🎟 Refund',
    shopRefundNoCards:'No cards left',
    shopRefundOk:n => `+${n} ⚡ refunded!`,
    shopRefundError:'Refund failed.',
    boostHintBtn:'💡 Hint',
    helpLibsTitle:'Libs (currency)',
    helpLibsDesc:'Libs ⚡ are a virtual currency. Players ranked <strong>top 3 in the Global leaderboard</strong> automatically earn some every 5 hours (1st: +10 ⚡, 2nd: +5 ⚡, 3rd: +3 ⚡). If you don\'t play for 48 h, your balance drops by 10 ⚡ per additional day of inactivity. Click the ⚡ counter in the top-right corner to open the shop. Anonymous players do not receive Libs.',
    helpBoostTitle:'Quiz Hint Boost',
    helpBoostDesc:'In the shop, buy a <em>Hint Boost</em> (3 ⚡): it eliminates a wrong answer per question for a whole quiz. The 💡 button appears in the quiz as soon as the boost is active and can be used once per question.',
    eventsTitle:'Events', eventsDesc:'Fri-Sat · Snake Challenge',
    eventsDescLocked:'Next weekend',
    eventsLockedCard: days => `📅 In ${days}d`,
    eventsLockedMsg:  days => `🐍 <strong>Snake Challenge might be back in ${days} day${days>1?'s':''}</strong> <u style="cursor:pointer">vote here</u>!`,
    eventActiveMsg:   '🐍 <strong>Event this weekend</strong>: Snake Challenge! Feed your snake to make it grow across the site.',
    newsCommunityMsg: '💬 <strong>Luffy Runner</strong>: check out a community idea the creator brought to life! Want yours considered too? Leave a comment — your voice matters!',
    snakeVoteTitle:'Snake Challenge',
    snakeVoteSubtitle:'Do you want the Snake Challenge to come back?',
    snakeVoteYes:'Yes, bring it back!',
    snakeVoteNo:'No, not right now',
    snakeVoteTotalLabel: n => `${n} vote${n>1?'s':''}`,
    snakeVoteAlreadyYes:'✅ You voted for Snake\'s return.',
    snakeVoteAlreadyNo:'❌ You voted against Snake\'s return.',
    snakeVoteChange:'(Change your mind)',
    snakeVoteAnon:'Set a username to vote.',
    communityCard:'Community',
    homeClassicTitle:'Multiplayer Games',
    btnQuit:'🚪 Quit',
    eventsScreenTitle:'🎉 Events', eventsScreenSub:'Special weekend',
    snakeChallengeTitle:'Snake Challenge',
    snakeChallengeDesc:'Feed your snake to make it grow across the whole site!',
    btnPlay:'Play',
    snakeNameTitle:'🐍 Your username',
    snakeNameSub:'Choose a username to appear in the leaderboard.',
    snakeNamePh:'Your username',
    snakeNameErr:'Enter a username to continue.',
    btnSnakeConfirm:"Let's go!", btnSnakeCancel:'Cancel',
    snakeLbTitle:'Snake Leaderboard', snakeLbEmpty:'No scores recorded yet.',
    snakeScoreLabel:'Score', snakeBestLabel:'Best',
    snakeHsDisplay:n => `🏆 Your record: ${n} apple${n > 1 ? 's' : ''}`,
    snakeGameOver:'Game Over', snakeNewRecord:'🏆 New record!',
    btnSnakeRestart:'Play again', btnSnakeQuit:'Quit',
    snakePause:'⏸ Pause', btnSnakeResume:'▶ Resume',
    btnSnakeBack:'← Back', btnSnakeHome:'🏠 Quit',
    snakeHint:'↑ ↓ ← → or swipe on mobile',
    luffyChallengeDesc:'Help Luffy escape the Marines! Jump over ground obstacles, duck under flying ones.',
    luffyNameTitle:'🏴‍☠️ Your username',
    luffyLbTitle:'Luffy Runner Leaderboard',
    luffyHsDisplay:n => `🏆 Your record: ${n} pts`,
    luffyHint:'↑ / Space to jump · ↓ to duck',
    luffySuggestLink:'💬 Suggest a game for this section',
    triviaResumeBtn:'▶ Resume', triviaBackToQuiz:'← Back to Quiz', triviaQuitHome:'🏠 Quit',
    communityTitle:'? Community',
    communityIntro:'This section is dedicated to a <strong>game chosen by you</strong>, the Libero players.',
    communityStep1:'Suggest the game you would like to see on the site by leaving a comment via the <strong>✉️</strong> button in the bottom left.',
    communityStep2:'The most mentioned suggestions will be selected and submitted to a community vote.',
    communityStep3:'The most voted game will be developed and added to Libero. <strong>Your opinion truly matters.</strong>',
    communityCta:'Have an idea? Let us know!',
    btnSuggestion:'✉️ Leave a suggestion',
    commentTitle:'💬 Leave a comment',
    commentSub:'Share your thoughts, an idea or a bug report — the creator will receive it by email.',
    commentPseudoPh:'Your username (optional)',
    commentMsgPh:'Your message…',
    btnSend:'Send ✉️',
    tutoSkip:'Skip guide', tutoOk:'Got it ✓',
    newsTitle:'📰 News',
    btnHelpTitle:'Help', btnSnakeToggle:'Enable / Disable the snake', libsCounterTitle:'Open shop',
    snakeOverScore:(score, hs) => `Score: ${score} · Best: ${hs}`,
    helpContent:{
      general:[
        { icon:'🏠', title:'Home sections', desc:"The home page offers <em>Classic Games</em> (Connect 4, Tic Tac Toe, Chess), <em>General Knowledge</em> (themed quizzes), <em>Events</em> (weekend mini-games) and <em>Community</em> (the <strong>Luffy Runner</strong> mini-game, a player idea brought to life by the creator). Each section has its own leaderboard." },
        { icon:'🎉', title:'Events', desc:"Special mini-games appear on some weekends. The card is <strong>locked</strong> outside the weekend and shows a countdown to the next event. When active: <em>Snake Challenge</em> — feed your snake with 🍎, walls wrap around. A new record shows <em>🏆 New record!</em>. Press <strong>⏸</strong> (or Esc / P) to pause." },
        { icon:'🎮', title:'Create a classic game', desc:"Choose a game, enter your username (optional) then click <em>Create a game</em>. Share the 4-letter code with your opponent. You can also play <strong>Solo vs the bot</strong> by choosing a difficulty: Easy, Medium or Hard." },
        { icon:'🤖', title:'Solo mode (vs Bot)', desc:"Play alone against a robot. <em>Easy</em>: plays randomly. <em>Medium</em>: blocks and attacks. <em>Hard</em>: plays optimally. <strong>Medium and Hard</strong> games count in the classic leaderboard." },
        { icon:'🔗', title:'Join', desc:"Enter the 4-letter code you received and click <em>Join</em>. The game starts automatically as soon as both players are connected." },
        { icon:'💬', title:'Chat', desc:"Send messages to your opponent during a classic game. The <em>Clear</em> button erases the history on your side only." },
        { icon:'🔄', title:'Reconnection', desc:"If you reload the page, you automatically rejoin your ongoing classic game. The opponent has <strong>30 seconds</strong> to reconnect, otherwise the game is cancelled." },
        { icon:'🔁', title:'Play again', desc:"At the end of a classic game, click <em>Play again</em>. The game restarts only if both players agree." },
        { icon:'🌍', title:'Global leaderboard', desc:"Visible from the home page, it gathers <strong>all players with at least one point</strong>. Score = classic wins (×10) + Quiz points + best Snake score (×10) + best Luffy Runner score (÷10). Updated in real time." },
        { icon:'🏆', title:'Section leaderboards', desc:"Each section also keeps its own leaderboard: wins/losses/draws for Classic Games, total points for Quiz." },
        { icon:'🏴‍☠️', title:'Luffy Runner', desc:"Help Luffy escape the Marines in this dinosaur-game clone! Jump (<strong>↑</strong> / Space) over ground obstacles (barrels, cannons, crabs…) and duck (<strong>↓</strong>) under flying ones (seagulls, cannonballs…). Your best score <strong>persists</strong> between sessions and feeds its own leaderboard. It's actually a <strong>community idea</strong> brought to life by the creator — if you want yours considered too, leave a comment via the button on the game screen." },
        { icon:'📰', title:'News', desc:"The News card is folded in the <strong>top-left corner</strong>. <strong>Click on it</strong> to open it: it shows the current event status (or a countdown to the next one) and a nudge to check out the <strong>Luffy Runner</strong> section. Click again to close it." },
        { icon:'⚙️', title:'Settings', desc:"The <strong>⚙️</strong> button in the <em>top right</em> groups all settings: <strong>Language</strong>, <strong>Theme</strong>, <strong>Snake</strong>, <strong>Sound</strong> (SFX + volume), <strong>Music</strong> (background music + volume) and <strong>Refund cards</strong>. Everything is saved between sessions." },
        { icon:'🔊', title:'Sound & Music', desc:"<strong>Sound</strong>: sound effects play on every action (placing a piece, win, quiz, chat, shop, Snake…). Toggle via <strong>⚙️ → Sound</strong> and adjust the volume.<br><strong>Music</strong>: ambient background music plays while you browse. Toggle via <strong>⚙️ → Music</strong> with its own volume slider. Both are controlled independently." },
        { icon:'🐍', title:'Snake', desc:"A little snake follows your cursor. It <strong>grows and changes colour</strong> based on your global score 🌍: gold (1st), blue (2nd), bronze (3rd). Play and climb the leaderboard to make it longer! Enable or disable it via the <strong>⚙️</strong> button (top right) → <strong>Snake</strong>." },
        { icon:'☀️', title:'Day / night theme', desc:"The <strong>⚙️</strong> button in the <em>top right</em> → <strong>Theme</strong> toggles between light and dark theme. The site also adapts automatically based on the time (light 7am–8pm, dark at night). Your manual choice is remembered between sessions." },
        { icon:'🚪', title:'Quit button', desc:"During a game, the <em>🚪 Quit</em> button in the top centre takes you back to the main menu. If a game is in progress, you are warned that you will forfeit before confirming." },
        { icon:'✉️', title:'Leave a comment', desc:"Click the <strong>✉️</strong> button in the bottom left to send a message to the creator: feedback, idea, bug… No account required. You can leave a username or stay anonymous." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🗂️', title:'Shop navigation', desc:"On the left side of the shop, a <strong>category bar</strong> lets you jump directly to any section: ⭐ Featured, 📅 Daily, 🎁 Bundles, 💡 Boosts, 🎨 Colors, ✍️ Fonts, 💬 Bubbles, 🖼️ Backgrounds. On mobile only icons are shown. The button for the currently visible section lights up automatically." },
        { icon:'🎁', title:'Bundles', desc:"The <strong>Bundles</strong> section offers themed packs grouping several cosmetics at a reduced price (−24% to −28%). If you already own some items in a bundle, the price is <strong>automatically adjusted</strong> — you only pay for what you're missing. The <strong>⭐ Featured</strong> and <strong>📅 Daily</strong> picks refresh every 24 hours — a countdown shows the next refresh time." },
        { icon:'✨', title:'Name Effects', desc:"Animate your username display in leaderboards, chat, badges and the podium. Effects <strong>stack with your username color</strong>: the color sets the hue, the effect adds the animation on top. Examples: Neon Blink, Glitch, Rainbow Wave. Rarity: Epic to Legendary." },
        { icon:'🏷️', title:'Titles', desc:"Add a short status text displayed next to your username in leaderboards, player badges and room chips. Examples: Tactician, Quiz Master, Snake King, Living Legend. Rarity: Common to Epic. Shop titles stack with <strong>honorary titles</strong> (see below)." },
        { icon:'🥇', title:'Honorary Titles', desc:"If you reach <strong>1st place</strong> on the global leaderboard, you automatically receive the honorary title <em>#1 Global</em>. A congratulatory message appears on your next visit — click <em>Accept</em> to confirm. The title is removed if you lose the top spot. It is visible in the shop but cannot be purchased." },
        { icon:'🖱️', title:'Cursor Skins', desc:"Replace the appearance of the snake following your cursor (color, pattern, trail, head shape). The skin overrides the rank color when equipped. Only visible if <strong>Snake</strong> is enabled in settings. Rarity: Rare to Legendary." },
        { icon:'🎭', title:'Avatars', desc:"Replace the icon shown in your player badge during games and in leaderboards. Examples: Gamepad 🎮, Pixel Cat 🐱, Rocket 🚀, Crown 👑. Rarity: Common to Epic." },
        { icon:'🔴', title:'Connect 4 Tokens', desc:"Restyle your tokens in the 7×6 grid (pattern, texture, glow). The <strong>red / yellow</strong> distinction between teams is always preserved. Your opponent will see your tokens. Rarity: Rare to Epic." },
        { icon:'✖️', title:'Tic-Tac-Toe Symbols', desc:"Replace X / O with a custom pair of symbols on the 3×3 grid. Both symbols remain clearly distinguishable. Your opponent sees your pair. Examples: Sun / Moon ☀️🌙, Heart / Star ❤️⭐. Rarity: Common to Epic." },
        { icon:'♟️', title:'Chess Themes', desc:"Restyle the chessboard and pieces. Light/dark square contrast and piece legibility are always guaranteed. Your opponent sees your theme. Examples: Cyber Grid, Royal Marble. Rarity: Epic to Legendary." },
        { icon:'🐍', title:'Snake Skins (Events)', desc:"Change the appearance of the snake, apples and board during the Snake Challenge. Solo mode only — no fairness concerns. Examples: Rainbow Snake, Lava Snake, Galaxy Board. Rarity: Rare to Legendary." },
        { icon:'💥', title:'Click Particles', desc:"Replace the particles shown when you click buttons and cards on the site. Examples: Bubbles 🫧, Confetti 🎊, Firework 🎆. Rarity: Common to Epic." },
        { icon:'🌈', title:'Emoji Packs', desc:"Replace the emoji set in the animated emoji rain on the first page load. Examples: Party Pack 🎉, Gaming Pack 🎮, Cosmos Pack 🌌. Rarity: Common to Rare." },
        { icon:'🏆', title:'Victory Banners', desc:"Customize the style and animation of the end-of-game banner (win screen). Shown at the result screen of classic games and quizzes. Examples: Neon Triumph, Champion Flames, Coronation. Rarity: Epic to Legendary." },
        { icon:'🔊', title:'Sound Packs', desc:"Replace some site sounds (purchase, win, click, Libs counter change) with a themed audio set. Packs respect your sound preference (⚙️ → Sound). Examples: Retro Arcade, Crystal, Epic. Rarity: Rare to Epic." },
        { icon:'😎', title:'Emotes', desc:"Unlock quick reactions sendable in the chat during classic multiplayer games. Owned emotes appear in a reaction bar in-game. Examples: GG 👍, On fire 🔥, Incredible 😱. Rarity: Common to Epic." },
        { icon:'🎓', title:'Tutorial', desc:"On your first visit, a guide appears automatically to walk you through each feature screen by screen. Once a step has been seen, it won't show again. To restart from the beginning, clear your browser cache (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'General Knowledge', desc:"Answer multiple-choice questions. Select <strong>one or more themes</strong> from 12 categories: History, Science, Movies, Music, etc. Questions are shuffled when multiple themes are chosen." },
        { icon:'🌐', title:'Language', desc:"Change the language via the <strong>⚙️</strong> button (top right) → <strong>Language</strong>. In <strong>FR</strong> mode, questions are translated into French (technical terms may stay in English). In <strong>EN</strong> mode, questions are in their original English. The site auto-detects your language on first load." },
        { icon:'▶', title:'Solo mode', desc:"Select one or more themes and click <em>Solo</em>. You play at your own pace. Your score is automatically added to the leaderboard at the end." },
        { icon:'👥', title:'Multiplayer mode', desc:"Click <em>Create a room</em> (2 to 6 players). Share the 4-letter code. The host starts the game when everyone is ready. All players see the same questions at the same time." },
        { icon:'⏱', title:'Timer', desc:"You have <strong>20 seconds</strong> per question. The timer turns red under 5 seconds. If you don't answer in time, the question is lost." },
        { icon:'✅', title:'Answer reveal', desc:"After each answer (or when time runs out), the correct answer is shown in green and wrong answers in red. In multiplayer, you also see each player's score." },
        { icon:'🏆', title:'Quiz leaderboard', desc:"1 point per correct answer. Points accumulate quiz after quiz. The leaderboard shows total points and number of quizzes played." },
      ],
      connect4:[
        { icon:'🎯', title:'Objective', desc:"Align <strong>4 pieces</strong> of your colour, horizontally, vertically or diagonally." },
        { icon:'👥', title:'Players', desc:"Red 🔴 vs Yellow 🟡. The Red player always goes first." },
        { icon:'▼', title:'How to play', desc:"Click the <strong>▼</strong> button above the column where you want to drop your piece. The piece falls to the bottom of the column." },
        { icon:'📐', title:'Grid', desc:"7 columns × 6 rows. A full column can no longer be played." },
        { icon:'✨', title:'End of game', desc:"The 4 winning pieces are highlighted. If the grid is full with no alignment, it's a draw." },
      ],
      ttt:[
        { icon:'🎯', title:'Objective', desc:"Align <strong>3 identical symbols</strong> in a row, column or diagonal." },
        { icon:'👥', title:'Players', desc:"Cross ✕ vs Circle ○. The Cross player always goes first." },
        { icon:'👆', title:'How to play', desc:"Click on an <strong>empty cell</strong> to place your symbol. You cannot play on an already occupied cell." },
        { icon:'📐', title:'Grid', desc:"3 × 3 cells, 9 cells in total." },
        { icon:'✨', title:'End of game', desc:"The winning line is highlighted. If all 9 cells are filled with no alignment, it's a draw." },
      ],
      chess:[
        { icon:'🎯', title:'Objective', desc:"Put the opponent's king in <strong>checkmate</strong> (it is attacked and cannot escape)." },
        { icon:'👥', title:'Players', desc:"White ♔ vs Black ♚. White always goes first. The board is oriented so your pieces are always at the bottom." },
        { icon:'👆', title:'How to play', desc:"<strong>1.</strong> Click on one of your pieces → available squares are shown.<br><strong>2.</strong> <em>Black dot</em> = free square · <em>Ring</em> = possible capture.<br><strong>3.</strong> Click a highlighted square to make the move." },
        { icon:'🔴', title:'Check', desc:"When your king is in check, its square turns <strong>red</strong>. You must address the check." },
        { icon:'🟡', title:'Last move', desc:"The two squares of the last move played are highlighted in <strong>yellow</strong>." },
        { icon:'♛', title:'Pawn promotion', desc:"When your pawn reaches the last rank, a window opens to choose the replacement piece: Queen, Rook, Bishop or Knight." },
        { icon:'📜', title:'Advanced rules', desc:"<strong>Castling</strong> (kingside and queenside), <strong>en passant</strong> and <strong>stalemate</strong> (draw) are handled automatically." },
      ],
    },
    triviaCats:[
      { id:9,  name:'General',   icon:'🧠' }, { id:23, name:'History',   icon:'📜' },
      { id:22, name:'Geography', icon:'🌍' }, { id:17, name:'Science',   icon:'🔬' },
      { id:21, name:'Sports',    icon:'⚽' }, { id:11, name:'Movies',    icon:'🎬' },
      { id:12, name:'Music',     icon:'🎵' }, { id:14, name:'TV',        icon:'📺' },
      { id:19, name:'Maths',     icon:'🔢' }, { id:20, name:'Computing', icon:'💻' },
      { id:25, name:'Arts',      icon:'🎨' }, { id:27, name:'Animals',   icon:'🐾' },
    ],
    tutoSteps:{
      landing_news:'📰 The <strong>News</strong> card is folded in the <strong>top-left corner</strong>. <strong>Click on it</strong> to open it: it shows the latest news, updates, announcements and player comments. Click again to close it.',
      landing_cats:'👋 Welcome to <strong>Libero\'s Multi</strong>! The home screen offers four sections: <strong>Classic Games</strong>, <strong>General Knowledge</strong>, <strong>Events</strong> (weekend mini-games) and <strong>Community</strong> (the <strong>Luffy Runner</strong> mini-game). Click a card to get started.',
      landing_lb:'🌍 The <strong>Global Leaderboard</strong> brings together <em>all</em> players with at least one point. Score = classic wins ×10 + Quiz points + best Snake score ×10 + best Luffy Runner score ÷10. The higher you climb, the longer your snake 🐍 grows!',
      landing_btns:'⚙️ Permanent buttons are available:<br>▶ <strong>Top right</strong>: the <strong>⚙️</strong> button opens <strong>Settings</strong> (day/night theme, language, snake, refund cards).<br>▶ <strong>Bottom right</strong>: ❓ <strong>Help</strong> · ✉️ <strong>Comment</strong>',
      landing_libs:'⚡ <strong>Libs</strong>: a virtual currency earned by the best players. The top 3 in the Global Leaderboard automatically receive Libs every 5 hours (1st: +5 ⚡, 2nd: +3 ⚡, 3rd: +2 ⚡). Spend them in the <strong>shop</strong> to get quiz boosts!',
      events_snake:'🐍 This weekend\'s event: <strong>Snake Challenge</strong>! Click <em>Play</em>, your snake enters the arena. Eat the 🍎 to grow (walls wrap around — you reappear on the other side!). Your best score <strong>persists</strong> between sessions.',
      luffy_runner:'🏴‍☠️ <strong>Luffy Runner</strong>: help Luffy escape the Marines! Jump (↑ / Space) over ground obstacles, duck (↓) under flying ones. Your best score feeds a dedicated leaderboard.',
      home_games:'🎮 Choose your game at the top: <strong>Connect 4</strong>, <strong>Tic Tac Toe</strong> or <strong>Chess</strong>. The leaderboard is shared across all three games.',
      home_bot:'🤖 <strong>Solo mode</strong>: play against the bot at 3 difficulty levels: Easy, Medium or Hard. Your wins and losses count in the leaderboard!',
      home_multi:'👥 <strong>Multiplayer mode</strong>: enter your username (optional), then click <em>Create a game</em> to generate a code, or enter a friend\'s code to join them.',
      home_lb:'🏆 <strong>Leaderboard</strong>: wins, losses and draws are recorded automatically after each game (Medium/Hard bot or multiplayer).',
      quiz_themes:'🧠 <strong>General Knowledge Quiz</strong>: select one or more themes (History, Movies, Science…), then play <strong>Solo</strong> or create a <strong>multiplayer room</strong> to share with your friends.',
      quiz_lb:'🏆 The <strong>Quiz leaderboard</strong> is separate from the Classic leaderboard. Points are awarded based on your response speed and number of correct answers.',
    },
  },
};

function t() { return DICT[currentLang]; }

function renderHelp() {
  const d = t();
  const tabs = { general:'help-tab-general', quiz:'help-tab-quiz', connect4:'help-tab-connect4', ttt:'help-tab-ttt', chess:'help-tab-chess' };
  for (const [key, id] of Object.entries(tabs)) {
    const panel = document.getElementById(id);
    if (!panel) continue;
    const items = d.helpContent[key] || [];
    panel.innerHTML = items.map(item => {
      const title = item.titleKey ? d[item.titleKey] : item.title;
      const desc  = item.descKey  ? d[item.descKey]  : item.desc;
      return `<div class="help-item"><span class="help-icon">${item.icon}</span><div><strong>${title}</strong><p>${desc}</p></div></div>`;
    }).join('');
  }
}

function _isEventActive() {
  const d = new Date().getDay();
  return d === 5 || d === 6; // Vendredi 00:00 → Dimanche 00:00
}

function _getEventEndMs() {
  const now = new Date();
  const day = now.getDay(); // 5=Ven, 6=Sam (seuls cas possibles)
  const end = new Date(now);
  end.setDate(now.getDate() + (day === 5 ? 2 : 1)); // prochain dimanche
  end.setHours(0, 0, 0, 0);
  return end.getTime();
}

function _getDaysUntilEvent() {
  const day = new Date().getDay();
  return ((5 - day) + 7) % 7 || 7; // jours jusqu'au prochain vendredi
}

function _updateEventCountdown() {
  const active = _isEventActive();
  const cardBtn  = document.getElementById('btn-go-events');
  const cardDesc = document.getElementById('events-card-desc');
  const cardCount = $('event-card-countdown');
  const newsMsg  = document.getElementById('news-event-msg');
  const d = t();

  if (active) {
    const left = _getEventEndMs() - Date.now();
    if (cardCount) cardCount.textContent = left > 0 ? d.eventCountdownFmt(left) : '';
    if (cardBtn)  { cardBtn.classList.remove('landing-card--locked'); cardBtn.disabled = false; }
    if (cardDesc) cardDesc.textContent = d.eventsDesc;
    if (newsMsg)  { newsMsg.innerHTML = d.eventActiveMsg; newsMsg.classList.remove('vote-clickable'); }
  } else {
    const days = _getDaysUntilEvent();
    if (cardCount) cardCount.textContent = d.eventsLockedCard(days);
    if (cardBtn)  { cardBtn.classList.add('landing-card--locked'); cardBtn.disabled = true; }
    if (cardDesc) cardDesc.textContent = d.eventsDescLocked;
    if (newsMsg)  { newsMsg.innerHTML = d.eventsLockedMsg(days); newsMsg.classList.add('vote-clickable'); }
  }
}

function applyLang() {
  const d = t();
  document.documentElement.lang = currentLang;
  document.title = d.siteTitle;
  const bl = $('btn-lang');
  if (bl) bl.textContent = currentLang === 'fr' ? '🇫🇷 FR ⇄' : '🇬🇧 EN ⇄';
  const btm = $('btn-theme-toggle'); if (btm) btm.title = d.themeToggle;
  const ll = $('landing-logo'); if (ll) ll.src = currentLang === 'en' ? 'logo-full-en.svg' : 'logo-full.svg';

  // Landing
  const ls = $('landing-subtitle'); if (ls) ls.textContent = d.siteSubtitle;
  const glbt = $('global-lb-title'); if (glbt) glbt.textContent = d.globalLbTitle;
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
  const bbev = $('btn-back-events'); if (bbev) bbev.textContent = `← ${d.backLabel}`;

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
  const tdl  = $('trivia-diff-label');    if (tdl)  tdl.textContent  = d.triviaDiffLabel;
  document.querySelectorAll('.diff-btn').forEach(b => {
    if (!b.dataset.diff) { b.textContent = d.diffMixed; return; }
    const icons = { easy:'😊', medium:'🎯', hard:'💀' };
    b.textContent = `${icons[b.dataset.diff]} ${d.diffLabels[b.dataset.diff]}`;
  });
  const tnbl = $('trivia-nb-label');      if (tnbl) tnbl.textContent = d.triviaNbLabel;
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
  const bqt  = $('btn-quit-trivia');       if (bqt)  bqt.textContent  = d.btnQuitTrivia;

  // Landing
  const ect = $('events-card-title');    if (ect) ect.textContent  = d.eventsTitle;
  const ecd = $('events-card-desc');     if (ecd) ecd.textContent  = d.eventsDesc;
  const cct = $('community-card-text');  if (cct) cct.textContent  = d.communityCard;

  // Home classic
  const hct = $('home-classic-title');  if (hct) hct.textContent = d.homeClassicTitle;
  const bqt2 = $('btn-quit');           if (bqt2) bqt2.textContent = d.btnQuit;

  // Events screen
  const est  = $('events-screen-title'); if (est)  est.textContent  = d.eventsScreenTitle;
  const ess  = $('events-screen-sub');   if (ess)  ess.textContent  = d.eventsScreenSub;
  const sct  = $('snake-challenge-title'); if (sct) sct.textContent = d.snakeChallengeTitle;
  const scd  = $('snake-challenge-desc');  if (scd) scd.textContent = d.snakeChallengeDesc;
  const bep  = $('btn-event-play');      if (bep)  bep.textContent  = d.btnPlay;
  const snnt = $('snake-name-title-el'); if (snnt) snnt.textContent = d.snakeNameTitle;
  const snns = $('snake-name-sub-el');   if (snns) snns.textContent = d.snakeNameSub;
  const snpi = $('snake-pseudo-input');  if (snpi) snpi.placeholder = d.snakeNamePh;
  const sner = $('snake-name-error');    if (sner) sner.textContent = d.snakeNameErr;
  const bscn = $('btn-snake-confirm-name'); if (bscn) bscn.textContent = d.btnSnakeConfirm;
  const bsca = $('btn-snake-cancel-name'); if (bsca) bsca.textContent = d.btnSnakeCancel;
  const slts = $('snake-lb-title-span'); if (slts) slts.textContent = d.snakeLbTitle;
  const sst  = $('snake-score-text');    if (sst)  sst.textContent  = d.snakeScoreLabel + ' : ';
  const sbt  = $('snake-best-text');     if (sbt)  sbt.textContent  = d.snakeBestLabel  + ' : ';
  const sgot = $('snake-game-over-text'); if (sgot) sgot.textContent = d.snakeGameOver;
  const snhs = $('snake-new-hs');        if (snhs) snhs.textContent = d.snakeNewRecord;
  const bsr  = $('btn-snake-restart');   if (bsr)  bsr.textContent  = d.btnSnakeRestart;
  const bsq  = $('btn-snake-quit');      if (bsq)  bsq.textContent  = d.btnSnakeQuit;
  const spt  = $('snake-pause-text');    if (spt)  spt.textContent  = d.snakePause;
  const bsrr = $('btn-snake-resume');    if (bsrr) bsrr.textContent = d.btnSnakeResume;
  const bspe = $('btn-snake-pause-quit-events'); if (bspe) bspe.textContent = d.btnSnakeBack;
  const bsph = $('btn-snake-pause-quit-home');   if (bsph) bsph.textContent = d.btnSnakeHome;
  const sht  = $('snake-hint-text');     if (sht)  sht.textContent  = d.snakeHint;

  // Luffy Runner screen
  const lss  = $('luffy-screen-sub');    if (lss)  lss.textContent  = d.communityCard;
  const lcd  = $('luffy-challenge-desc'); if (lcd) lcd.textContent  = d.luffyChallengeDesc;
  const bls  = $('btn-luffy-play');      if (bls)  bls.textContent  = d.btnPlay;
  const blsg = $('btn-luffy-suggest');   if (blsg) blsg.textContent = d.luffySuggestLink;
  const lnt  = $('luffy-name-title-el'); if (lnt)  lnt.textContent  = d.luffyNameTitle;
  const lns  = $('luffy-name-sub-el');   if (lns)  lns.textContent  = d.snakeNameSub;
  const lpi  = $('luffy-pseudo-input');  if (lpi)  lpi.placeholder  = d.snakeNamePh;
  const lne  = $('luffy-name-error');    if (lne)  lne.textContent  = d.snakeNameErr;
  const blcn = $('btn-luffy-confirm-name'); if (blcn) blcn.textContent = d.btnSnakeConfirm;
  const blca = $('btn-luffy-cancel-name');  if (blca) blca.textContent = d.btnSnakeCancel;
  const llts = $('luffy-lb-title-span'); if (llts) llts.textContent = d.luffyLbTitle;
  const lst  = $('luffy-score-text');    if (lst)  lst.textContent  = d.snakeScoreLabel + ' : ';
  const lbt  = $('luffy-best-text');     if (lbt)  lbt.textContent  = d.snakeBestLabel  + ' : ';
  const lgot = $('luffy-game-over-text'); if (lgot) lgot.textContent = d.snakeGameOver;
  const lnhs = $('luffy-new-hs');        if (lnhs) lnhs.textContent = d.snakeNewRecord;
  const blr  = $('btn-luffy-restart');   if (blr)  blr.textContent  = d.btnSnakeRestart;
  const blq  = $('btn-luffy-quit');      if (blq)  blq.textContent  = d.btnSnakeQuit;
  const lpt  = $('luffy-pause-text');    if (lpt)  lpt.textContent  = d.snakePause;
  const blrr = $('btn-luffy-resume');    if (blrr) blrr.textContent = d.btnSnakeResume;
  const blpl = $('btn-luffy-pause-quit-luffy'); if (blpl) blpl.textContent = d.btnSnakeBack;
  const blph = $('btn-luffy-pause-quit-home');  if (blph) blph.textContent = d.btnSnakeHome;
  const lht  = $('luffy-hint-text');     if (lht)  lht.textContent  = d.luffyHint;

  // Trivia pause
  const tpt  = $('trivia-pause-text');   if (tpt)  tpt.textContent  = d.snakePause;
  const btr  = $('btn-trivia-resume');   if (btr)  btr.textContent  = d.triviaResumeBtn;
  const btpb = $('btn-trivia-pause-back'); if (btpb) btpb.textContent = d.triviaBackToQuiz;
  const btph = $('btn-trivia-pause-home'); if (btph) btph.textContent = d.triviaQuitHome;

  // Community modal
  const cmt  = $('community-modal-title'); if (cmt)  cmt.textContent  = d.communityTitle;
  const cmi  = $('community-intro');       if (cmi)  cmi.innerHTML    = d.communityIntro;
  const cms1 = $('community-step-1');      if (cms1) cms1.innerHTML   = d.communityStep1;
  const cms2 = $('community-step-2');      if (cms2) cms2.textContent = d.communityStep2;
  const cms3 = $('community-step-3');      if (cms3) cms3.innerHTML   = d.communityStep3;
  const cmca = $('community-cta');         if (cmca) cmca.textContent = d.communityCta;
  const bcoc = $('btn-community-open-comment'); if (bcoc) bcoc.textContent = d.btnSuggestion;

  // Comment modal
  const comt = $('comment-modal-title'); if (comt) comt.textContent = d.commentTitle;
  const coms = $('comment-modal-sub');   if (coms) coms.textContent = d.commentSub;
  const cpph = $('comment-pseudo');      if (cpph) cpph.placeholder = d.commentPseudoPh;
  const cmph = $('comment-message');     if (cmph) cmph.placeholder = d.commentMsgPh;
  const bcs  = $('btn-comment-send');    if (bcs)  bcs.textContent  = d.btnSend;

  // Tutorial
  const tskip = $('tuto-skip'); if (tskip) tskip.textContent = d.tutoSkip;
  const tok   = $('tuto-ok');   if (tok)   tok.textContent   = d.tutoOk;

  // News
  const nte = $('news-title-el'); if (nte) nte.textContent = d.newsTitle;
  const ncm = $('news-community-msg'); if (ncm) ncm.innerHTML = d.newsCommunityMsg;

  // Floating button tooltips
  const bh = $('btn-help');          if (bh)  bh.title = d.btnHelpTitle;
  const bst = $('btn-snake-toggle'); if (bst) bst.title = d.btnSnakeToggle;
  const lc  = $('libs-counter');     if (lc)  lc.title  = d.libsCounterTitle;
  const bset = $('btn-settings');    if (bset) bset.title = d.settingsTitle;

  // Help modal
  const hmt = $('help-modal-title'); if (hmt) hmt.textContent = d.help.title;
  document.querySelectorAll('.help-tab').forEach(tab => {
    const lbl = d.help.tabs[tab.dataset.tab];
    if (lbl) tab.textContent = lbl;
  });
  renderHelp();

  // Honour modal button
  const bhra = $('btn-honor-reward-accept'); if (bhra) bhra.textContent = d.honorModalBtn;

  // Snake vote modal (if open)
  const svt  = $('snake-vote-title');    if (svt)  svt.textContent  = d.snakeVoteTitle;
  const svsu = $('snake-vote-subtitle'); if (svsu) svsu.textContent = d.snakeVoteSubtitle;
  const vyl  = $('vote-yes-label');      if (vyl)  vyl.textContent  = d.snakeVoteYes;
  const vnl  = $('vote-no-label');       if (vnl)  vnl.textContent  = d.snakeVoteNo;

  // Shop header (if open)
  const smt = $('shop-modal-title');  if (smt) smt.textContent  = d.shopTitle;
  const sbl = $('shop-balance-label'); if (sbl) sbl.textContent = d.shopBalanceLabel;

  // Libs : mettre à jour le bouton boost hint si affiché
  _updateBoostHintBtn();

  // Countdown évent (se retraduit lors du changement de langue)
  _updateEventCountdown();

  // Rebuild trivia themes (garde les sélections actives)
  $('trivia-themes').innerHTML = '';

  // Re-render classements (messages vides traduits meme si liste vide)
  if (_glbData.length) _paintGlobalLb();
  else { const gl = $('global-lb-list'); if (gl) gl.innerHTML = `<p class="lb-empty">${d.globalLbEmpty}</p>`; }
  renderLeaderboard(_classicLbData);
  renderSnakeLeaderboard(_snakeLbData);
  renderTriviaLeaderboard(_triviaLbData);

  // Mettre à jour le panneau Paramètres si ouvert
  _updateSettingsPanel();
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
let _newsTimer = null;
let _newsAutoDisabled = false;
function _scheduleNewsCollapse() {
  if (_newsAutoDisabled) return;
  clearTimeout(_newsTimer);
  _newsTimer = setTimeout(() => {
    const nc = document.getElementById('news-card');
    if (nc) nc.classList.add('collapsed');
  }, 5000);
}

function showScreen(name) {
  const wasRestoring = document.documentElement.classList.contains('restoring');
  const el = document.getElementById('screen-' + name);
  // Marquer avant de retirer restoring : supprime l'animation quand JS active l'écran
  if (wasRestoring && el) el.setAttribute('data-restored', '');
  document.documentElement.classList.remove('restoring');
  document.documentElement.removeAttribute('data-restore');
  sessionStorage.setItem('libero_screen', name);
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    if (s !== el) s.removeAttribute('data-restored');
  });
  if (el) {
    if (!wasRestoring) el.removeAttribute('data-restored');
    el.classList.add('active');
  }
  document.body.classList.toggle('screen-events-active', name === 'events');
  document.body.classList.toggle('screen-luffy-active', name === 'luffy');
  const nc = document.getElementById('news-card');
  if (nc) nc.style.display = name === 'landing' ? '' : 'none';
  if (name === 'landing') { _scheduleNewsCollapse(); }
  else { clearTimeout(_newsTimer); }
  if (window._tutoOnScreen) window._tutoOnScreen(name);
}

(function() {
  const nc = document.getElementById('news-card');
  if (!nc) return;
  let startX = 0, startBase = 0, moved = false;
  function minX() { return -(nc.offsetWidth - 44); }

  nc.addEventListener('touchstart', e => {
    startX    = e.touches[0].clientX;
    startBase = nc.classList.contains('collapsed') ? minX() : 0;
    moved     = false;
    nc.style.transition = 'none';
    nc.style.transform  = `translateX(${startBase}px)`;
  }, { passive: true });

  nc.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    if (!moved) return;
    nc.style.transform = `translateX(${Math.max(minX(), Math.min(0, startBase + dx))}px)`;
  }, { passive: true });

  nc.addEventListener('touchend', e => {
    const dx           = e.changedTouches[0].clientX - startX;
    const wasCollapsed = nc.classList.contains('collapsed');
    _newsAutoDisabled  = true;
    clearTimeout(_newsTimer);

    if (!moved) {
      nc.style.transition = '';
      nc.style.transform  = '';
      return;
    }

    const toCollapsed = wasCollapsed ? dx < 40 : dx < -40;
    nc.style.transition = '';
    nc.style.transform  = toCollapsed ? `translateX(${minX()}px)` : 'translateX(0)';
    nc.addEventListener('transitionend', () => {
      toCollapsed ? nc.classList.add('collapsed') : nc.classList.remove('collapsed');
      nc.style.transform = '';
    }, { once: true });
  }, { passive: true });

  nc.addEventListener('click', () => {
    if (moved) { moved = false; return; }
    _newsAutoDisabled = true;
    clearTimeout(_newsTimer);
    nc.classList.toggle('collapsed');
  });
})();

// ── Trivia : constantes ───────────────────────────────────────────────────────
const TRIVIA_COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2'];

// ── Trivia : état ─────────────────────────────────────────────────────────────
let selectedTriviaCategories = [];
let selectedTriviaDifficulty = '';
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
const ANON_ADJECTIVES = ['Swift','Bold','Cool','Wild','Keen','Brave','Calm','Sharp','Witty','Lucky'];
const ANON_NOUNS      = ['Fox','Wolf','Bear','Hawk','Lion','Lynx','Owl','Puma','Stag','Crow'];
function getOrCreateAnonName() {
  let n = localStorage.getItem('anonName');
  if (!n) {
    const adj  = ANON_ADJECTIVES[Math.floor(Math.random() * ANON_ADJECTIVES.length)];
    const noun = ANON_NOUNS[Math.floor(Math.random() * ANON_NOUNS.length)];
    const num  = Math.floor(Math.random() * 900) + 100;
    n = `${adj}${noun}${num}`;
    localStorage.setItem('anonName', n);
  }
  return n;
}

$('input-name').value = localStorage.getItem('playerName') || '';

let _pseudoCheckTimer = null;
function checkPseudo(name, warningId) {
  clearTimeout(_pseudoCheckTimer);
  const w = $(warningId);
  if (!name || name.length < 2) { if (w) w.classList.add('hidden'); return; }
  _pseudoCheckTimer = setTimeout(() => {
    socket.emit('check-pseudo', { name, playerId: getPlayerId() });
  }, 600);
}

socket.on('pseudo-check-result', ({ taken }) => {
  const w = $('snake-pseudo-warning');
  if (!w) return;
  if (taken) {
    w.textContent = t().errNameTaken;
    w.classList.remove('hidden');
  } else {
    w.classList.add('hidden');
  }
});

function triggerRename(name) {
  clearTimeout(_renameTimer);
  const w = $('pseudo-warning');
  if (!name || name.length < 2 || name === 'Anonyme') {
    _nameTaken = false;
    if (w) w.classList.add('hidden');
    return;
  }
  _renameTimer = setTimeout(() => {
    socket.emit('rename-player', { name, playerId: getPlayerId() });
  }, 700);
}

socket.on('rename-result', ({ ok, error }) => {
  const w = $('pseudo-warning');
  if (!ok && error === 'taken') {
    _nameTaken = true;
    if (w) { w.textContent = t().errNameTaken; w.classList.remove('hidden'); }
  } else if (ok) {
    _nameTaken = false;
    if (w) w.classList.add('hidden');
  }
});

$('input-name').addEventListener('input', e => {
  const v = e.target.value;
  localStorage.setItem('playerName', v.trim());
  const other = $('input-trivia-name');
  if (other) other.value = v;
  triggerRename(v.trim());
  const counter = $('libs-counter');
  if (counter) counter.classList.toggle('hidden', !v.trim() || v.trim() === 'Anonyme');
});
function getPlayerName() { return $('input-name').value.trim(); }

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
    if (!getPlayerName()) { showError(t().errNoName); return; }
    if (_nameTaken) { showError(t().errNameTaken); return; }
    clearError();
    socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), vsBot: true, botDifficulty: btn.dataset.diff, playerId: getPlayerId() });
  });
});

$('btn-create').addEventListener('click', () => {
  if (!getPlayerName()) { showError(t().errNoName); return; }
  if (_nameTaken) { showError(t().errNameTaken); return; }
  clearError();
  socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), playerId: getPlayerId() });
});

$('btn-join').addEventListener('click', joinRoom);
$('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('input-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

function joinRoom() {
  if (!getPlayerName()) { showError(t().errNoName); return; }
  if (_nameTaken) { showError(t().errNameTaken); return; }
  const code = $('input-code').value.trim().toUpperCase();
  if (code.length !== 4) { showError(t().err4Letters); return; }
  clearError();
  currentRoomCode = code;
  socket.emit('join-room', { code, name: getPlayerName(), playerId: getPlayerId() });
}

function showError(msg) { const e = $('error-msg'); e.textContent = msg; e.classList.remove('hidden'); }
function clearError()   { $('error-msg').classList.add('hidden'); }

// ── Session (reload) ──────────────────────────────────────────────────────────
function saveSession(code, player) {
  sessionStorage.setItem('p4session', JSON.stringify({ roomCode: code, player }));
}
function clearSession() { sessionStorage.removeItem('p4session'); }

function saveTriviaSession(data) {
  sessionStorage.setItem('triviaSession', JSON.stringify(data));
}
function clearTriviaSession() { sessionStorage.removeItem('triviaSession'); }

// ── Attente ───────────────────────────────────────────────────────────────────
$('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('room-code').textContent).then(() => {
    $('btn-copy').textContent = t().codeCopied;
    setTimeout(() => { $('btn-copy').textContent = t().btnCopyCode; }, 2000);
  });
});

// ── Header joueurs ────────────────────────────────────────────────────────────
const AVATAR_ICONS = {
  'avatar-gamepad':'🎮','avatar-crown':'👑','avatar-lightning':'⚡','avatar-skull':'💀',
  'avatar-rocket':'🚀','avatar-robot':'🤖','avatar-cat':'🐱',
};

function setPlayerBadges(gameType, yourPlayer) {
  const icons = PLAYER_ICONS[gameType];
  const names = t().playerNames[gameType];
  const myIcon = (equippedAvatar && AVATAR_ICONS[equippedAvatar]) || null;
  $('badge-r-icon').textContent = (yourPlayer === 'R' && myIcon) ? myIcon : icons.R;
  $('badge-y-icon').textContent = (yourPlayer === 'Y' && myIcon) ? myIcon : icons.Y;
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
const VICTORY_BANNER_CLASSES = ['victoryban-neon','victoryban-confetti','victoryban-flames','victoryban-lightning','victoryban-crown'];

function showGameOver(status, winner) {
  gameActive = false;
  if (currentGame === 'connect4') setArrowsEnabled(false);
  if (currentGame === 'tictactoe') setTTTEnabled(false);

  const isWinner = winner === myPlayer;
  const gs = $('game-status');
  gs.classList.remove(...VICTORY_BANNER_CLASSES);

  if (status === 'won') {
    $('status-text').textContent = isWinner ? t().youWon : t().youLost;
    if (isWinner) {
      SFX.win();
      if (equippedVictoryBan) gs.classList.add(equippedVictoryBan);
    } else SFX.lose();
  } else {
    $('status-text').textContent = t().gameDraw;
    SFX.draw();
  }
  gs.classList.remove('hidden');
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
    btn.addEventListener('click', () => { if (gameActive) { SFX.placePiece(); socket.emit('make-move', { col }); } });
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
  const skinClass = equippedP4Token || '';
  const boardEl = document.getElementById('c4-board');
  if (boardEl) {
    boardEl.className = boardEl.className.replace(/\bp4skin-\S+/g, '').trim();
    if (skinClass) boardEl.classList.add(`p4skin-${skinClass}`);
  }
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
      SFX.placePiece();
      socket.emit('make-move', { cell: i });
    });
    boardEl.appendChild(cell);
  }

  container.appendChild(boardEl);
  updateTTT(board, null);
}

const TTT_SYMBOL_PACKS = {
  'ttt-sunmoon':  ['☀️','🌙'], 'ttt-heartstar': ['❤️','⭐'],
  'ttt-skulllightning': ['💀','⚡'], 'ttt-catdog': ['🐱','🐶'], 'ttt-neonxo': ['✕','○'],
};

function _getTttSymbols() {
  const pack = equippedTtt && TTT_SYMBOL_PACKS[equippedTtt];
  if (!pack) return { R: '✕', Y: '○' };
  return myPlayer === 'R' ? { R: pack[0], Y: pack[1] } : { R: pack[1], Y: pack[0] };
}

function updateTTT(board, winLine) {
  const sym = _getTttSymbols();
  document.querySelectorAll('.ttt-cell').forEach((cell, i) => {
    cell.classList.remove('ttt-r', 'ttt-y', 'played', 'win-cell');
    const val = board[i];
    if (val === 'R') { cell.textContent = sym.R; cell.classList.add('ttt-r', 'played'); }
    else if (val === 'Y') { cell.textContent = sym.Y; cell.classList.add('ttt-y', 'played'); }
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

function _applyChessTheme(theme) {
  const board = document.getElementById('chess-board');
  if (!board) return;
  board.className = board.className.replace(/\bchess-theme-\S+/g, '').trim();
  if (theme) board.classList.add(`chess-theme-${theme.replace('chess-','')}`);
}

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
  _applyChessTheme(equippedChess);
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
      SFX.placePiece();
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

const EMOTE_DEFS = {
  'emote-gg':        { emoji:'👍', label:'GG' },
  'emote-wellplayed':{ emoji:'🤝', label:'Bien joué' },
  'emote-fire':      { emoji:'🔥', label:'En feu' },
  'emote-easy':      { emoji:'😎', label:'Trop facile' },
  'emote-omg':       { emoji:'😱', label:'Incroyable' },
};

function _renderEmoteBar() {
  const chatEl = $('chat');
  if (!chatEl) return;
  let bar = document.getElementById('emote-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'emote-bar';
    bar.className = 'emote-bar hidden';
    const form = chatEl.querySelector('#chat-form');
    if (form) chatEl.insertBefore(bar, form);
  }
  const equippedBar = equippedEmotes || [];
  if (equippedBar.length === 0) { bar.classList.add('hidden'); return; }
  bar.innerHTML = equippedBar.map(id => {
    const def = EMOTE_DEFS[id];
    if (!def) return '';
    return `<button class="emote-btn" data-emote="${id}" title="${def.label}">${def.emoji}</button>`;
  }).join('');
  bar.classList.remove('hidden');
  bar.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentRoomCode) return;
      socket.emit('send-emote', { emoteId: btn.dataset.emote });
    });
  });
}

socket.on('emote-received', ({ player, emoteId, timestamp }) => {
  const def = EMOTE_DEFS[emoteId];
  if (!def) return;
  const mine = player === myPlayer;
  const time = new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const msg = document.createElement('div');
  msg.className = `msg ${mine ? 'msg-mine' : 'msg-theirs'}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble msg-emote';
  bubble.textContent = `${def.emoji} ${def.label}`;
  const meta = document.createElement('span');
  meta.className = 'msg-meta';
  meta.textContent = time;
  msg.appendChild(bubble);
  msg.appendChild(meta);
  const el = $('chat-messages');
  el.appendChild(msg);
  el.scrollTop = el.scrollHeight;
  SFX.chat();
});

$('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  socket.emit('send-message', { text });
  input.value = '';
});

function appendMessage({ player, text, timestamp, bubbleColor }) {
  const time = new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const mine = player === myPlayer;
  const msg  = document.createElement('div');
  msg.className = `msg ${mine ? 'msg-mine' : 'msg-theirs'}`;

  const bubble = document.createElement('div');
  const bc = _bubbleClass(bubbleColor);
  bubble.className = `msg-bubble${bc ? ' ' + bc : ''}`;
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

// ── Classement Global (landing) ───────────────────────────────────────────────
let _glbExpanded = false;
let _glbData     = [];

function renderGlobalLeaderboard(data) {
  const list = $('global-lb-list');
  if (!list) return;
  _glbData = data || [];
  if (_glbData.length === 0) {
    list.innerHTML = `<p class="lb-empty">${t().globalLbEmpty}</p>`;
    return;
  }
  _paintGlobalLb();
}

function _paintGlobalLb() {
  const list = $('global-lb-list');
  if (!list) return;
  const medals  = ['🥇', '🥈', '🥉'];
  const classes = ['gold', 'silver', 'bronze'];
  const visible = _glbExpanded ? _glbData : _glbData.slice(0, 2);
  const rows = visible.map((entry, i) => `
    <div class="global-lb-row lb-row-clickable" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
      <span class="lb-rank ${classes[i] || ''}">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)} ${_nameEffectClass(entry.nameEffect)}">${entry.name}${_titleHtml(entry.title, entry.honorTitle)}</span>
      <span class="global-lb-score">${entry.globalScore} ${t().globalLbPts}</span>
    </div>
  `).join('');
  const moreBtn = _glbData.length > 2
    ? `<button class="lb-more-btn" id="btn-lb-more">${_glbExpanded ? t().globalLbLess : t().globalLbMore}</button>`
    : '';
  list.innerHTML = rows + moreBtn;
  list.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const _av = row.dataset.avatar;
      if (_av && AVATAR_ICONS[_av]) { _shopFocusItem(_av); return; }
      const ids = [row.dataset.font, row.dataset.nameeffect, row.dataset.cosmetic].filter(Boolean);
      if (ids.length) _shopFocusItems(ids); else openShop();
    });
  });
  const btn = $('btn-lb-more');
  if (btn) btn.addEventListener('click', () => { _glbExpanded = !_glbExpanded; _paintGlobalLb(); });
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
    <div class="lb-row lb-row-clickable" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
      <span class="lb-rank ${classes[i] || ''}">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)} ${_nameEffectClass(entry.nameEffect)}">${entry.name}${_titleHtml(entry.title, entry.honorTitle)}</span>
      <div class="lb-stats">
        <span class="lb-w">${entry.wins}${t().lbW}</span>
        <span class="lb-l">${entry.losses}${t().lbL}</span>
        <span class="lb-d">${entry.draws}${t().lbD}</span>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const _av = row.dataset.avatar;
      if (_av && AVATAR_ICONS[_av]) { _shopFocusItem(_av); return; }
      const ids = [row.dataset.font, row.dataset.nameeffect, row.dataset.cosmetic].filter(Boolean);
      if (ids.length) _shopFocusItems(ids); else openShop();
    });
  });
}

function renderSnakeLeaderboard(data) {
  const el = document.getElementById('snake-lb-list');
  if (!el) return;
  if (!data || data.length === 0) {
    el.innerHTML = `<p class="lb-empty">${t().snakeLbEmpty}</p>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = data.map((e, i) => `
    <div class="lb-row lb-row-clickable" data-cosmetic="${e.cosmetic||''}" data-avatar="${e.avatar||''}" data-cursor="${e.cursorSnake||''}" data-font="${e.font||''}" data-nameeffect="${e.nameEffect||''}">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(e.cosmetic)} ${_fontClass(e.font)} ${_nameEffectClass(e.nameEffect)}">${e.name}${_titleHtml(e.title, e.honorTitle)}</span>
      <span class="lb-score-snake">${e.hs} 🍎</span>
    </div>
  `).join('');
  el.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const _av = row.dataset.avatar;
      if (_av && AVATAR_ICONS[_av]) { _shopFocusItem(_av); return; }
      const ids = [row.dataset.font, row.dataset.nameeffect, row.dataset.cosmetic].filter(Boolean);
      if (ids.length) _shopFocusItems(ids); else openShop();
    });
  });
}

function renderLuffyLeaderboard(data) {
  const el = document.getElementById('luffy-lb-list');
  if (!el) return;
  if (!data || data.length === 0) {
    el.innerHTML = `<p class="lb-empty">${t().snakeLbEmpty}</p>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = data.map((e, i) => `
    <div class="lb-row lb-row-clickable" data-cosmetic="${e.cosmetic||''}" data-avatar="${e.avatar||''}" data-cursor="${e.cursorSnake||''}" data-font="${e.font||''}" data-nameeffect="${e.nameEffect||''}">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(e.cosmetic)} ${_fontClass(e.font)} ${_nameEffectClass(e.nameEffect)}">${e.name}${_titleHtml(e.title, e.honorTitle)}</span>
      <span class="lb-score-snake">${e.hs} 🏃</span>
    </div>
  `).join('');
  el.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const _av = row.dataset.avatar;
      if (_av && AVATAR_ICONS[_av]) { _shopFocusItem(_av); return; }
      const ids = [row.dataset.font, row.dataset.nameeffect, row.dataset.cosmetic].filter(Boolean);
      if (ids.length) _shopFocusItems(ids); else openShop();
    });
  });
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

function getTriviaName() { return $('input-trivia-name').value.trim(); }

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
  clearTriviaSession();
  triviaRoomCode = null; triviaIsHost = false; triviaIsSolo = false;
  triviaAnsweredThis = false; triviaChoiceSelected = null;
  pendingHintCharges = 0; hintsUsedThisQ = 0;
  _updateBoostHintBtn();
  triviaPaused = false; triviaPauseRemaining = 0;
  $('btn-trivia-pause').classList.add('hidden');
  $('trivia-pause-overlay').classList.add('hidden');
  triviaQuestions = []; triviaCurrentQ = 0; triviaScore = 0;
  selectedTriviaCategories = [];
  selectedTriviaDifficulty = '';
  document.querySelectorAll('#trivia-diff-row .diff-btn').forEach(b => b.classList.remove('active'));
  const mixBtn = document.querySelector('#trivia-diff-row .diff-btn[data-diff=""]');
  if (mixBtn) mixBtn.classList.add('active');
  $('tg-choices').innerHTML = '';
  $('tg-reveal').classList.add('hidden');
  $('tg-finished').classList.add('hidden');
  clearTriviaError();
  buildTriviaThemes();
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

// Boutons de difficulté trivia
document.querySelectorAll('#trivia-diff-row .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#trivia-diff-row .diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTriviaDifficulty = btn.dataset.diff;
    clearTriviaError();
  });
});

// Pseudo trivia sync avec classique
$('input-trivia-name').value = localStorage.getItem('playerName') || '';
$('input-trivia-name').addEventListener('input', e => {
  const v = e.target.value;
  localStorage.setItem('playerName', v.trim());
  const other = $('input-name');
  if (other) other.value = v;
  triggerRename(v.trim());
  const counter = $('libs-counter');
  if (counter) counter.classList.toggle('hidden', !v.trim() || v.trim() === 'Anonyme');
});

// Boutons trivia home
$('btn-back-trivia-home').addEventListener('click', () => { clearTriviaError(); showScreen('landing'); });

function getTriviaQCount() { return parseInt($('input-trivia-nb')?.value || 10); }

$('input-trivia-nb').addEventListener('input', () => {
  $('trivia-nb-val').textContent = $('input-trivia-nb').value;
});

$('btn-solo-trivia').addEventListener('click', () => {
  if (!getTriviaName())                  { showTriviaError(t().errNoName);    return; }
  if (_nameTaken)                        { showTriviaError(t().errNameTaken); return; }
  if (!selectedTriviaCategories.length)  { showTriviaError(t().errNoTheme);  return; }
  clearTriviaError();
  $('btn-solo-trivia').disabled = true;
  $('btn-solo-trivia').textContent = t().soloLoading;
  socket.emit('fetch-trivia-solo', { categories: selectedTriviaCategories, amount: getTriviaQCount(), lang: currentLang, difficulty: selectedTriviaDifficulty });
});

$('btn-create-trivia').addEventListener('click', () => {
  if (!getTriviaName())                  { showTriviaError(t().errNoName);    return; }
  if (_nameTaken)                        { showTriviaError(t().errNameTaken); return; }
  if (!selectedTriviaCategories.length)  { showTriviaError(t().errNoTheme);  return; }
  clearTriviaError();
  socket.emit('create-trivia-room', { categories: selectedTriviaCategories, name: getTriviaName(), lang: currentLang, difficulty: selectedTriviaDifficulty, amount: getTriviaQCount(), playerId: getPlayerId() });
});

$('btn-join-trivia').addEventListener('click',  joinTriviaRoom);
$('input-trivia-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinTriviaRoom(); });
$('input-trivia-code').addEventListener('input',   e => { e.target.value = e.target.value.toUpperCase(); });

function joinTriviaRoom() {
  if (!getTriviaName()) { showTriviaError(t().errNoName); return; }
  if (_nameTaken)       { showTriviaError(t().errNameTaken); return; }
  const code = $('input-trivia-code').value.trim().toUpperCase();
  if (code.length !== 4) { showTriviaError(t().err4Letters); return; }
  clearTriviaError();
  socket.emit('join-trivia-room', { code, name: getTriviaName(), playerId: getPlayerId() });
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
  hintsUsedThisQ = 0;
  _updateBoostHintBtn();
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
  if (gotIt) SFX.quizOk(); else SFX.quizBad();
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
$('btn-quit-trivia').addEventListener('click', goToTriviaHome);

// ── Trivia : pause (solo uniquement) ─────────────────────────────────────────
let triviaPaused = false;
let triviaPauseRemaining = 0;

function pauseTrivia() {
  if (!triviaIsSolo || triviaPaused || triviaAnsweredThis) return;
  triviaPaused = true;
  triviaPauseRemaining = parseInt($('tg-timer').textContent) || 0;
  stopTriviaTimer();
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = true);
  $('trivia-pause-overlay').classList.remove('hidden');
  $('btn-trivia-pause').textContent = '▶';
}

function resumeTrivia() {
  if (!triviaPaused) return;
  triviaPaused = false;
  $('trivia-pause-overlay').classList.add('hidden');
  $('btn-trivia-pause').textContent = '⏸';
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = false);
  startTriviaTimer(triviaPauseRemaining, () => onTriviaTimeUp());
}

function toggleTriviaPause() {
  if (!triviaIsSolo) return;
  if (triviaPaused) resumeTrivia(); else pauseTrivia();
}

$('btn-trivia-pause').addEventListener('click', toggleTriviaPause);
$('btn-trivia-resume').addEventListener('click', resumeTrivia);
$('btn-trivia-pause-back').addEventListener('click', () => { triviaPaused = false; goToTriviaHome(); });
$('btn-trivia-pause-home').addEventListener('click', () => { triviaPaused = false; goToTriviaHome(); showScreen('landing'); });

document.addEventListener('keydown', e => {
  if (!['Escape', 'p', 'P'].includes(e.key)) return;
  if (document.getElementById('screen-trivia-game')?.classList.contains('active')) {
    toggleTriviaPause();
  }
});

// ── Trivia solo : logique locale ──────────────────────────────────────────────
function soloNextQuestion() {
  if (triviaCurrentQ >= triviaQuestions.length) {
    clearTriviaSession();
    const name = getTriviaName();
    const scores = [{ name, score: triviaScore, colorIndex: 0 }];
    $('tg-q-num').textContent = '';
    $('tg-timer').textContent = '–';
    showTriviaFinished(scores);
    socket.emit('solo-trivia-finished', { name, score: triviaScore, total: triviaQuestions.length, playerId: getPlayerId() });
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
  saveTriviaSession({ isSolo: true, questions: triviaQuestions, currentQ: triviaCurrentQ, score: triviaScore });
  setTimeout(soloNextQuestion, 3000);
}

// ── Trivia : classement ───────────────────────────────────────────────────────
function renderTriviaLeaderboard(data) {
  const list = $('trivia-lb-list');
  if (!data || data.length === 0) { list.innerHTML = `<p class="lb-empty">${t().triviaLbEmpty}</p>`; return; }
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = data.map((entry, i) => `
    <div class="lb-row lb-row-clickable" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
      <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i] || i+1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)} ${_nameEffectClass(entry.nameEffect)}">${entry.name}${_titleHtml(entry.title, entry.honorTitle)}</span>
      <div class="lb-stats">
        <span class="lb-w">${entry.points} ${t().triviaLbPts}</span>
        <span class="lb-d">${entry.games} ${t().triviaLbGames}</span>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const _av = row.dataset.avatar;
      if (_av && AVATAR_ICONS[_av]) { _shopFocusItem(_av); return; }
      const ids = [row.dataset.font, row.dataset.nameeffect, row.dataset.cosmetic].filter(Boolean);
      if (ids.length) _shopFocusItems(ids); else openShop();
    });
  });
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

$('btn-honor-reward-accept').addEventListener('click', () => {
  $('overlay-honor-reward').classList.add('hidden');
  socket.emit('honor-modal-seen', { playerId: getPlayerId() });
});

$('btn-announcement-ok').addEventListener('click', () => {
  const overlay = $('overlay-announcement');
  if (!overlay) return;
  const id = overlay.dataset.announcementId;
  overlay.classList.add('hidden');
  if (id) {
    const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    if (!dismissed.includes(id)) { dismissed.push(id); localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissed)); }
    socket.emit('announcement-dismissed', { id });
  }
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
  saveTriviaSession({ isSolo: false, code, mySocketId: socket.id });
  $('trivia-room-code').textContent = code;
  $('trivia-wait-theme').textContent = categoryName;
  renderTriviaWaitPlayers(roomState.players, roomState.hostId);
  showScreen('trivia-waiting');
});

socket.on('trivia-room-joined', ({ code, categoryName }) => {
  triviaRoomCode = code; triviaIsHost = false;
  saveTriviaSession({ isSolo: false, code, mySocketId: socket.id });
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
  $('btn-trivia-pause').classList.add('hidden');
  $('trivia-pause-overlay').classList.add('hidden');
  hintsUsedThisQ = 0;
  socket.emit('activate-quiz-boost', { playerId: getPlayerId() });
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
  triviaQuestions = shuffle(questions);
  if (!triviaQuestions.length) { showTriviaError(t().errLoadQ); return; }
  triviaIsSolo = true; triviaCurrentQ = 0; triviaScore = 0; triviaRoomCode = null;
  hintsUsedThisQ = 0;
  socket.emit('activate-quiz-boost', { playerId: getPlayerId() });
  triviaPaused = false;
  saveTriviaSession({ isSolo: true, questions: triviaQuestions, currentQ: 0, score: 0 });
  $('tg-theme-label').textContent = getCategoryLabel(selectedTriviaCategories);
  $('tg-scores').innerHTML = '';
  $('tg-finished').classList.add('hidden');
  $('btn-trivia-pause').classList.remove('hidden');
  $('btn-trivia-pause').textContent = '⏸';
  $('trivia-pause-overlay').classList.add('hidden');
  showScreen('trivia-game');
  soloNextQuestion();
});

socket.on('trivia-solo-error', () => {
  showTriviaError(t().errLoadQ);
  $('btn-solo-trivia').disabled = false;
  $('btn-solo-trivia').textContent = t().btnSolo;
});

socket.on('trivia-leaderboard-update', (data) => { _triviaLbData = data || []; renderTriviaLeaderboard(data); });
socket.on('trivia-error', ({ message }) => { showTriviaError(message); buildTriviaThemes(); showScreen('trivia-home'); });

// ── Reconnexion automatique après reload + chargement du classement ───────────
socket.on('connect', () => {
  triviaMySocketId = socket.id;
  socket.emit('get-leaderboard');
  socket.emit('get-trivia-leaderboard');
  socket.emit('get-global-leaderboard');
  socket.emit('get-libs', { playerId: getPlayerId() });
  if (sessionStorage.getItem('libero_screen') === 'events') socket.emit('get-snake-leaderboard');
  if (sessionStorage.getItem('libero_screen') === 'luffy')  socket.emit('get-luffy-leaderboard');

  // Jeu classique
  const saved = sessionStorage.getItem('p4session');
  if (saved) {
    try {
      const { roomCode, player } = JSON.parse(saved);
      socket.emit('reconnect-room', { code: roomCode, player });
    } catch { clearSession(); }
  }

  // Trivia solo ou multi
  const savedTrivia = sessionStorage.getItem('triviaSession');
  if (!savedTrivia) return;
  try {
    const data = JSON.parse(savedTrivia);
    if (data.isSolo && Array.isArray(data.questions) && data.questions.length) {
      triviaQuestions  = data.questions;
      triviaCurrentQ   = data.currentQ ?? 0;
      triviaScore      = data.score ?? 0;
      triviaIsSolo     = true;
      triviaRoomCode   = null;
      triviaPaused     = false;
      $('tg-theme-label').textContent = '';
      $('tg-scores').innerHTML = '';
      $('tg-finished').classList.add('hidden');
      $('btn-trivia-pause').classList.remove('hidden');
      $('btn-trivia-pause').textContent = '⏸';
      $('trivia-pause-overlay').classList.add('hidden');
      showScreen('trivia-game');
      soloNextQuestion();
    } else if (!data.isSolo && data.code && data.mySocketId) {
      socket.emit('reconnect-trivia-room', { code: data.code, mySocketId: data.mySocketId });
    } else {
      clearTriviaSession();
    }
  } catch { clearTriviaSession(); }
});

socket.on('trivia-reconnect-success', ({ code, status, scores, question, hostId }) => {
  triviaRoomCode = code;
  triviaIsSolo   = false;
  triviaIsHost   = (socket.id === hostId);
  saveTriviaSession({ isSolo: false, code, mySocketId: socket.id });
  if (scores) renderTriviaScores(scores);
  $('tg-finished').classList.add('hidden');
  $('btn-trivia-pause').classList.add('hidden');
  $('trivia-pause-overlay').classList.add('hidden');
  showScreen('trivia-game');
  if (status === 'question' && question) {
    showTriviaQuestion(question);
  } else {
    $('tg-choices').innerHTML = '';
    $('tg-reveal').textContent = '⏳';
    $('tg-reveal').className   = 'tg-reveal ok';
  }
});

socket.on('trivia-reconnect-failed', () => { clearTriviaSession(); showScreen('landing'); });

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

socket.on('reconnect-success', ({ gameType, state, yourPlayer, status, winner, roomCode, vsBot, botDifficulty }) => {
  currentRoomCode = roomCode;
  isBotGame = !!vsBot;
  saveSession(roomCode, yourPlayer);
  hideOverlay();
  applyGameState({ gameType, state, yourPlayer, status, winner });
  $('chat').classList.toggle('hidden', isBotGame);
  if (isBotGame) {
    const diffLabel = t().diffLabels[botDifficulty] || '';
    $('label-y').textContent = diffLabel ? `🤖 Robot (${diffLabel})` : '🤖 Robot';
  }
  showScreen('game');
});

socket.on('reconnect-failed', () => { clearSession(); showScreen('landing'); });

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

socket.on('new-message',       (msg)  => { appendMessage(msg); SFX.chat(); });
socket.on('leaderboard-update', (data) => {
  _classicLbData = data || [];
  renderLeaderboard(data);
});

socket.on('global-leaderboard-update', (data) => {
  _globalLbData = data;
  renderGlobalLeaderboard(data);
  const name = localStorage.getItem('playerName') || '';
  const idx  = name ? data.findIndex(e => e.name === name) : -1;
  if (idx !== -1) {
    const rank     = idx + 1;
    const entry    = data[idx];
    const rawSum   = (entry.wins || 0) + (entry.triviaPoints || 0) + (entry.snakeHs || 0) + Math.round((entry.luffyHs || 0) / 10);
    const len      = 4 + Math.min(14, Math.floor(rawSum / 5));
    cursorSnake.update(len, rank);
  }
  _updateLibsCountdown();
});

socket.on('snake-leaderboard-update', (data) => { _snakeLbData = data || []; renderSnakeLeaderboard(data); });
socket.on('luffy-leaderboard-update', (data) => { _luffyLbData = data || []; renderLuffyLeaderboard(data); });

socket.on('server-announcement', ({ id, msgFr, msgEn } = {}) => {
  if (!id) return;
  const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
  if (dismissed.includes(id)) return;
  const overlay = $('overlay-announcement');
  if (!overlay) return;
  const msgEl = $('announcement-msg');
  if (msgEl) msgEl.innerHTML = currentLang === 'fr' ? msgFr : msgEn;
  overlay.dataset.announcementId = id;
  overlay.classList.remove('hidden');
});

// ── Libs : handlers socket ────────────────────────────────────────────────────
socket.on('libs-update', ({ balance, pendingBoostHint, delta, nextAt, ownedCosmetics: newOwned, equippedCosmetic: newEquipped, equippedFont: newFont, equippedBubble: newBubble, equippedBackground: newBg, equippedNameEffect: newNameEffect, equippedTitle: newTitle, equippedCursorSnake: newCursorSnake, equippedAvatar: newAvatar, equippedP4Token: newP4Token, equippedTtt: newTtt, equippedChess: newChess, equippedSnakeSkin: newSnakeSkin, equippedClickFx: newClickFx, equippedEmojiPack: newEmojiPack, equippedVictoryBan: newVictoryBan, equippedSoundPack: newSoundPack, equippedEmotes: newEmotes, refundCards: newRefundCards, refundCardsNextRefill: newRefillAt, honorTitle: newHonorTitle, pendingHonorModal: newHonorModal } = {}) => {
  const prev = libsBalance;
  libsBalance = balance ?? 0;
  localStorage.setItem('libero_libs', String(libsBalance));
  _refreshLibsUI(prev, libsBalance, delta ?? null);
  const shopBal = $('shop-balance-display');
  if (shopBal) shopBal.textContent = `⚡ ${libsBalance} Libs`;
  if (pendingBoostHint !== undefined) { pendingHintCharges = pendingBoostHint; _updateBoostHintBtn(); }
  _updateShopPending(pendingHintCharges);
  if (nextAt) { _nextDistAt = nextAt; _updateLibsCountdown(); }
  if (newOwned !== undefined) {
    ownedCosmetics   = newOwned;
    equippedCosmetic = newEquipped !== undefined ? newEquipped : equippedCosmetic;
    equippedFont     = newFont     !== undefined ? newFont     : equippedFont;
    equippedBubble   = newBubble   !== undefined ? newBubble   : equippedBubble;
    if (newBg !== undefined) { equippedBackground = newBg; localStorage.setItem('libero_equipped_bg', newBg || ''); BGManager.start(newBg); }
    if (newNameEffect  !== undefined) equippedNameEffect  = newNameEffect;
    if (newTitle       !== undefined) equippedTitle       = newTitle;
    if (newCursorSnake !== undefined) { equippedCursorSnake = newCursorSnake; cursorSnake.refreshSkin(); }
    if (newAvatar      !== undefined) equippedAvatar      = newAvatar;
    if (newP4Token     !== undefined) equippedP4Token     = newP4Token;
    if (newTtt         !== undefined) equippedTtt         = newTtt;
    if (newChess       !== undefined) { equippedChess = newChess; _applyChessTheme(newChess); }
    if (newSnakeSkin   !== undefined) equippedSnakeSkin   = newSnakeSkin;
    if (newClickFx     !== undefined) equippedClickFx     = newClickFx;
    if (newEmojiPack   !== undefined) { equippedEmojiPack = newEmojiPack; localStorage.setItem('libero_equipped_emojipack', newEmojiPack || ''); }
    if (newVictoryBan  !== undefined) equippedVictoryBan  = newVictoryBan;
    if (newSoundPack   !== undefined) equippedSoundPack   = newSoundPack;
    if (newEmotes !== undefined) equippedEmotes = newEmotes || [];
    _renderEmoteBar();
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  }
  if (newRefundCards !== undefined) { refundCards = newRefundCards; }
  if (newRefillAt    !== undefined) { refundCardsNextRefill = newRefillAt; }
  if (newHonorTitle  !== undefined) honorTitle = newHonorTitle;
  if (newHonorModal) _showHonorModal(newHonorModal);
  _updateSettingsPanel();
});

socket.on('buy-boost-result', ({ ok, balance, pendingBoostHint, error } = {}) => {
  if (ok) {
    const prev = libsBalance;
    libsBalance = balance;
    localStorage.setItem('libero_libs', String(libsBalance));
    _refreshLibsUI(prev, libsBalance, null);
    const shopBal = $('shop-balance-display');
    if (shopBal) shopBal.textContent = `⚡ ${libsBalance} Libs`;
    _updateShopPending(pendingBoostHint);
    SFX.shopBuy();
    _showShopFeedback(t().shopBuyOk, '#22c55e');
  } else {
    _showShopFeedback(error === 'insufficient' ? t().shopInsufficient : t().shopBuyError, '#ef4444');
  }
});

socket.on('redeem-result', ({ ok, delta, error } = {}) => {
  if (ok) {
    const inp = $('shop-promo-input');
    if (inp) inp.value = '';
    _showPromoFeedback(t().shopPromoOk(delta), '#22c55e');
  } else {
    const msg = error === 'already_used' ? t().shopPromoAlreadyUsed
              : error === 'anonymous'    ? t().shopPromoAnon
              : t().shopPromoInvalid;
    _showPromoFeedback(msg, '#ef4444');
  }
});

socket.on('buy-cosmetic-result', ({ ok, cosmeticId, error } = {}) => {
  if (ok) {
    if (!ownedCosmetics.includes(cosmeticId)) ownedCosmetics.push(cosmeticId);
    SFX.shopBuy();
    _showShopFeedback(t().shopCosmeticBought, '#22c55e');
    if (cosmeticId?.startsWith('emote-')) _renderEmoteBar();
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  } else {
    const msg = error === 'already_owned'  ? t().shopCosmeticAlreadyOwned
              : error === 'anonymous'      ? t().shopCosmeticAnon
              : error === 'insufficient'   ? t().shopInsufficient
              : t().shopBuyError;
    _showShopFeedback(msg, '#ef4444');
  }
});

socket.on('equip-cosmetic-result', ({ ok, equippedCosmetic: newCosmetic, equippedFont: newFont, equippedBubble: newBubble, equippedBackground: newBg, equippedNameEffect: newNameEffect, equippedTitle: newTitle, equippedCursorSnake: newCursorSnake, equippedAvatar: newAvatar, equippedP4Token: newP4Token, equippedTtt: newTtt, equippedChess: newChess, equippedSnakeSkin: newSnakeSkin, equippedClickFx: newClickFx, equippedEmojiPack: newEmojiPack, equippedVictoryBan: newVictoryBan, equippedSoundPack: newSoundPack, equippedEmotes: newEmotes } = {}) => {
  if (ok) {
    if (newCosmetic !== undefined) equippedCosmetic = newCosmetic;
    if (newFont     !== undefined) equippedFont     = newFont;
    if (newBubble   !== undefined) equippedBubble   = newBubble;
    if (newBg !== undefined) { equippedBackground = newBg; localStorage.setItem('libero_equipped_bg', newBg || ''); BGManager.start(newBg); }
    if (newNameEffect  !== undefined) equippedNameEffect  = newNameEffect;
    if (newTitle       !== undefined) equippedTitle       = newTitle;
    if (newCursorSnake !== undefined) { equippedCursorSnake = newCursorSnake; cursorSnake.refreshSkin(); }
    if (newAvatar      !== undefined) equippedAvatar      = newAvatar;
    if (newP4Token     !== undefined) equippedP4Token     = newP4Token;
    if (newTtt         !== undefined) equippedTtt         = newTtt;
    if (newChess       !== undefined) { equippedChess = newChess; _applyChessTheme(newChess); }
    if (newSnakeSkin   !== undefined) equippedSnakeSkin   = newSnakeSkin;
    if (newClickFx     !== undefined) equippedClickFx     = newClickFx;
    if (newEmojiPack   !== undefined) { equippedEmojiPack = newEmojiPack; localStorage.setItem('libero_equipped_emojipack', newEmojiPack || ''); }
    if (newVictoryBan  !== undefined) equippedVictoryBan  = newVictoryBan;
    if (newSoundPack   !== undefined) equippedSoundPack   = newSoundPack;
    if (newEmotes !== undefined) { equippedEmotes = newEmotes || []; _renderEmoteBar(); }
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  }
});

socket.on('refund-cosmetic-result', ({ ok, refundCards: newCards, delta, error } = {}) => {
  if (ok) {
    if (newCards !== undefined) refundCards = newCards;
    SFX.shopBuy();
    _showShopFeedback(t().shopRefundOk(delta), '#22c55e');
    _shopDetailItem = null;
    const panel = $('shop-detail-panel');
    if (panel) panel.classList.add('hidden');
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
    _updateSettingsPanel();
  } else {
    const msg = error === 'no_cards'  ? t().shopRefundNoCards
              : error === 'not_owned' ? t().shopRefundError
              : t().shopRefundError;
    _showShopFeedback(msg, '#ef4444');
  }
});

socket.on('shop-rotation', data => {
  shopRotation = data;
  if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  _startShopCountdown(data.resetAt);
});

socket.on('buy-bundle-result', ({ ok, error } = {}) => {
  const d = t();
  if (ok) {
    SFX.shopBuy();
    _showShopFeedback(d.shopBundleBuyOk, '#22c55e');
  } else {
    const msg = error === 'insufficient' ? d.shopBundleInsufficientFunds
              : error === 'all_owned'    ? d.shopBundleAlreadyOwned
              : error === 'anonymous'    ? d.shopBundleAnon
              : d.shopBundleError;
    _showShopFeedback(msg, '#ef4444');
  }
});

// ── Vote Snake Challenge ──────────────────────────────────────────────────────
let _snakeVoteData = null; // { yes: number, no: number, myVote: 'yes'|'no'|null }

function _openSnakeVote() {
  const overlay = $('overlay-snake-vote');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  socket.emit('get-snake-vote', { playerId: getPlayerId() });
  _updateSnakeVoteUI();
}

function _closeSnakeVote() {
  const overlay = $('overlay-snake-vote');
  if (overlay) overlay.classList.add('hidden');
}

function _updateSnakeVoteUI() {
  const d = t();
  const el = id => document.getElementById(id);
  el('snake-vote-title').textContent    = d.snakeVoteTitle;
  el('snake-vote-subtitle').textContent = d.snakeVoteSubtitle;
  el('vote-yes-label').textContent      = d.snakeVoteYes;
  el('vote-no-label').textContent       = d.snakeVoteNo;

  const data      = _snakeVoteData;
  const total     = data ? data.yes + data.no : 0;
  const yesPct    = total > 0 ? Math.round(data.yes / total * 100) : 0;
  const noPct     = total > 0 ? 100 - yesPct : 0;

  el('snake-vote-pct-yes').textContent   = `${yesPct}%`;
  el('snake-vote-pct-no').textContent    = `${noPct}%`;
  el('snake-vote-bar-yes').style.width   = `${yesPct}%`;
  el('snake-vote-total-label').textContent = d.snakeVoteTotalLabel(total);

  const statusEl   = el('snake-vote-status');
  const myVote     = data?.myVote;
  const yesBtn     = el('btn-vote-yes');
  const noBtn      = el('btn-vote-no');

  yesBtn.classList.toggle('voted-active', myVote === 'yes');
  noBtn.classList.toggle('voted-active',  myVote === 'no');

  if (myVote) {
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = (myVote === 'yes' ? d.snakeVoteAlreadyYes : d.snakeVoteAlreadyNo)
      + ` <span style="opacity:.6;font-size:.8em;cursor:pointer" id="snake-vote-change-link">${d.snakeVoteChange}</span>`;
    document.getElementById('snake-vote-change-link')?.addEventListener('click', () => {
      _snakeVoteData = { ..._snakeVoteData, myVote: null };
      yesBtn.disabled = false; noBtn.disabled = false;
      _updateSnakeVoteUI();
    });
    yesBtn.disabled = myVote !== 'yes';
    noBtn.disabled  = myVote !== 'no';
  } else {
    statusEl.classList.add('hidden');
    yesBtn.disabled = false; noBtn.disabled = false;
  }
}

(function _initSnakeVote() {
  const overlay = $('overlay-snake-vote');
  if (!overlay) return;

  $('btn-snake-vote-close').addEventListener('click', _closeSnakeVote);
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeSnakeVote(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) _closeSnakeVote();
  });

  $('btn-vote-yes').addEventListener('click', () => {
    socket.emit('submit-snake-vote', { playerId: getPlayerId(), vote: 'yes' });
  });
  $('btn-vote-no').addEventListener('click', () => {
    socket.emit('submit-snake-vote', { playerId: getPlayerId(), vote: 'no' });
  });

  const newsMsg = document.getElementById('news-event-msg');
  if (newsMsg) {
    newsMsg.addEventListener('click', () => {
      if (!_isEventActive()) _openSnakeVote();
    });
  }
})();

socket.on('snake-vote-update', data => {
  _snakeVoteData = data;
  if (!$('overlay-snake-vote').classList.contains('hidden')) _updateSnakeVoteUI();
});

socket.on('quiz-boost-status', ({ balance, pendingBoostHint } = {}) => {
  if (pendingBoostHint !== undefined) pendingHintCharges = pendingBoostHint;
  if (balance !== undefined) {
    libsBalance = balance;
    localStorage.setItem('libero_libs', String(libsBalance));
    const balEl = $('libs-balance');
    if (balEl) balEl.textContent = libsBalance;
  }
  _updateShopPending(pendingHintCharges);
  _updateBoostHintBtn();
});

socket.on('boost-hint-result', ({ eliminateChoice } = {}) => {
  if (!eliminateChoice) return;
  document.querySelectorAll('.tg-choice').forEach(btn => {
    if (btn.dataset.choice === eliminateChoice) {
      btn.classList.add('dimmed'); btn.disabled = true;
    }
  });
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
_updateEventCountdown();
setInterval(_updateEventCountdown, 60_000);

// ── Libs : fonctions UI ───────────────────────────────────────────────────────
function _isPlayerInTop3() {
  const name = localStorage.getItem('playerName') || '';
  if (!name || name === 'Anonyme' || !_globalLbData.length) return false;
  return _globalLbData.slice(0, 3).some(e => e.name === name);
}

function _updateLibsCountdown() {
  clearInterval(_libsDistTimer);
  const span = $('libs-dist-countdown');
  if (!span) return;
  if (!_nextDistAt || !_isPlayerInTop3()) { span.textContent = ''; return; }
  function tick() {
    const left = _nextDistAt - Date.now();
    if (left <= 0) { clearInterval(_libsDistTimer); span.textContent = ''; return; }
    const mins = Math.ceil(left / 60_000);
    span.textContent = `· ⏱${mins}min`;
  }
  tick();
  _libsDistTimer = setInterval(tick, 60_000);
}

function _refreshLibsUI(prev, next, delta) {
  // Afficher/masquer le compteur selon si le joueur a un pseudo
  const name = localStorage.getItem('playerName') || '';
  const counter = $('libs-counter');
  if (counter) counter.classList.toggle('hidden', !name || name === 'Anonyme');

  const balEl = $('libs-balance');
  if (!balEl) return;
  const diff = next - prev;
  if (diff === 0) { balEl.textContent = next; return; }
  const steps = Math.min(20, Math.abs(diff));
  let step = 0;
  clearInterval(_libsAnimTimer);
  _libsAnimTimer = setInterval(() => {
    step++;
    balEl.textContent = Math.round(prev + diff * (step / steps));
    if (step >= steps) { clearInterval(_libsAnimTimer); balEl.textContent = next; }
  }, 30);
  if (delta !== null && delta !== 0) {
    _spawnLibsPill(delta > 0 ? `+${delta} ⚡` : `${delta} ⚡`, delta > 0);
    _playLibsSound();
  }
}

function _spawnLibsPill(text, isPositive) {
  const counter = $('libs-counter');
  if (!counter || counter.classList.contains('hidden')) return;
  const rect = counter.getBoundingClientRect();
  const pill = document.createElement('div');
  pill.className = 'libs-pill';
  pill.textContent = text;
  pill.style.color = isPositive ? '#fbbf24' : '#ef4444';
  pill.style.left  = `${rect.left + rect.width / 2}px`;
  pill.style.top   = `${rect.top - 2}px`;
  document.body.appendChild(pill);
  pill.addEventListener('animationend', () => pill.remove(), { once: true });
}

function _playLibsSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
    setTimeout(() => ctx.close(), 600);
  } catch (_) {}
}

// ── Libs : boutique ───────────────────────────────────────────────────────────
function openShop() {
  const d = t();
  const title = $('shop-modal-title');
  if (title) title.textContent = d.shopTitle;
  const lbl = $('shop-balance-label');
  if (lbl) lbl.textContent = currentLang === 'fr' ? 'Ton solde' : 'Your balance';
  const shopBal = $('shop-balance-display');
  if (shopBal) shopBal.textContent = `⚡ ${libsBalance} Libs`;
  _shopDetailItem = null;
  const _prevShopState = (() => { try { return JSON.parse(sessionStorage.getItem('shopState')) || {}; } catch { return {}; } })();
  sessionStorage.setItem('shopState', JSON.stringify({ open: true, scrollTop: _prevShopState.scrollTop || 0 }));
  socket.emit('get-shop-rotation', {});
  _renderShopItems();
  socket.emit('get-libs', { playerId: getPlayerId() });
  $('overlay-shop').classList.remove('hidden');
}

function _shopFocusItem(itemId) {
  _pendingShopFocusIds = null;
  _pendingShopFocus    = itemId;
  openShop();
}

function _shopFocusItems(ids) {
  const filtered = ids.filter(Boolean);
  if (!filtered.length) return;
  _pendingShopFocus    = null;
  _pendingShopFocusIds = filtered;
  openShop();
}

function _getRarity(price) {
  if (price === 0)   return 'commun';
  if (price <= 20)  return 'commun';
  if (price <= 80)  return 'rare';
  if (price <= 150) return 'epique';
  return 'legendaire';
}

const _FONT_DISPLAY_NAMES = {
  'font-orbitron':'Orbitron','font-rajdhani':'Rajdhani','font-chakra':'Chakra Petch',
  'font-audiowide':'Audiowide','font-exo2':'Exo 2','font-bungee':'Bungee',
  'font-blackops':'Black Ops One','font-russo':'Russo One','font-pressstart':'Press Start 2P',
  'font-vt323':'VT323','font-sharetech':'Share Tech Mono','font-majormono':'Major Mono',
  'font-cinzel':'Cinzel','font-tektur':'Tektur','font-pacifico':'Pacifico',
  'font-lobster':'Lobster','font-fredoka':'Fredoka','font-monoton':'Monoton',
};

const _FEATURED_IDS = ['bg-hologramme', 'bubble-cameleon'];

const ALL_BUNDLES = [
  { id:'bundle-debutant',    items:['silver','bubble-ardoise','bg-nuit','boost_hint_10'], totalPrice:38,  bundlePrice:25  },
  { id:'bundle-retro',       items:['font-vt323','font-pressstart','bg-cyber','bubble-ocean'], totalPrice:100, bundlePrice:75 },
  { id:'bundle-neon-arcade', items:['bubble-arcade','bg-pluie','font-audiowide'],           totalPrice:360, bundlePrice:270 },
  { id:'bundle-galaxie',     items:['bubble-galaxie','bg-galaxie','galaxy'],                totalPrice:480, bundlePrice:360 },
  { id:'bundle-prestige-or', items:['bubble-or','gold','font-cinzel'],                      totalPrice:450, bundlePrice:340 },
  { id:'bundle-hologramme',  items:['bubble-holographique','bg-hologramme','font-tektur'],  totalPrice:690, bundlePrice:500 },
];

function _bundleRarity(bundle, allItemsById) {
  const order = ['commun','rare','epique','legendaire'];
  let max = 0;
  bundle.items.forEach(id => {
    const item = allItemsById[id];
    if (!item) return;
    const r = order.indexOf(_getRarity(item.price));
    if (r > max) max = r;
  });
  return order[max];
}

function _startShopCountdown(resetAt) {
  if (_shopCountdownTimer) clearInterval(_shopCountdownTimer);
  function tick() {
    const el = document.getElementById('shop-countdown-val');
    if (!el) { clearInterval(_shopCountdownTimer); _shopCountdownTimer = null; return; }
    const ms = resetAt - Date.now();
    if (ms <= 0) { el.textContent = ''; return; }
    el.textContent = t().shopCountdown(ms);
  }
  tick();
  _shopCountdownTimer = setInterval(tick, 1000);
}

function _renderShopItems() {
  const d = t();
  const fr = currentLang === 'fr';
  const playerPreview = localStorage.getItem('playerName') || d.shopCosmeticPreview;
  const container = $('shop-items-list');
  if (!container) return;

  const rarityLabel = {
    commun:     fr ? 'Commun'     : 'Common',
    rare:       'Rare',
    epique:     fr ? 'Épique'     : 'Epic',
    legendaire: fr ? 'Légendaire' : 'Legendary',
  };
  const lblOwned    = fr ? 'Possédé' : 'Owned';
  const lblEquipped = fr ? 'Équipé'  : 'Equipped';
  const lblFree     = fr ? 'Gratuit'  : 'Free';

  const ALL_COLORS  = [
    {id:'rainbow',price:100},{id:'galaxy',price:100},{id:'silver',price:20},
    {id:'bronze',price:20},{id:'gold',price:70},{id:'diamond',price:70},
  ];
  const ALL_FONTS = [
    {id:'font-orbitron',price:100},{id:'font-rajdhani',price:100},{id:'font-chakra',price:100},
    {id:'font-audiowide',price:100},{id:'font-exo2',price:100},{id:'font-bungee',price:90},
    {id:'font-blackops',price:90},{id:'font-russo',price:90},{id:'font-pressstart',price:10},
    {id:'font-vt323',price:10},{id:'font-sharetech',price:50},{id:'font-majormono',price:50},
    {id:'font-cinzel',price:200},{id:'font-tektur',price:200},{id:'font-pacifico',price:5},
    {id:'font-lobster',price:5},{id:'font-fredoka',price:5},{id:'font-monoton',price:0},
  ];
  const ALL_BUBBLES = [
    {id:'bubble-ardoise',price:5},{id:'bubble-ocean',price:10},{id:'bubble-menthe',price:10},
    {id:'bubble-corail',price:12},{id:'bubble-ambre',price:15},{id:'bubble-lavande',price:20},
    {id:'bubble-rubis',price:25},{id:'bubble-emeraude',price:30},{id:'bubble-indigo',price:40},
    {id:'bubble-magenta',price:50},{id:'bubble-cyan',price:50},{id:'bubble-crepuscule',price:70},
    {id:'bubble-aurore',price:80},{id:'bubble-sunset',price:90},{id:'bubble-tropical',price:100},
    {id:'bubble-arcade',price:120},{id:'bubble-galaxie',price:140},{id:'bubble-verre',price:170},
    {id:'bubble-or',price:180},{id:'bubble-holographique',price:190},{id:'bubble-cameleon',price:200},
  ];
  const ALL_BGS = [
    {id:'bg-nuit',price:10},{id:'bg-ardoise',price:15},{id:'bg-brume',price:25},
    {id:'bg-aurore-deg',price:40},{id:'bg-crepuscule',price:50},{id:'bg-cyber',price:70},
    {id:'bg-circuit',price:80},{id:'bg-hexagones',price:90},{id:'bg-etoile',price:100},
    {id:'bg-particules',price:120},{id:'bg-pluie',price:140},{id:'bg-vagues',price:150},
    {id:'bg-synthwave',price:170},{id:'bg-nebuleuse',price:190},{id:'bg-aurores',price:210},
    {id:'bg-galaxie',price:240},{id:'bg-tempete',price:270},{id:'bg-hologramme',price:300},
  ];

  const ALL_NAMEEFFECTS = [
    {id:'nameeffect-blink',price:90},{id:'nameeffect-pulse',price:100},{id:'nameeffect-gradient',price:120},
    {id:'nameeffect-sparks',price:130},{id:'nameeffect-glitch',price:160},{id:'nameeffect-rainbow',price:180},
  ];
  const ALL_TITLES = [
    {id:'title-tactician',price:15},{id:'title-strategist',price:40},{id:'title-quizmaster',price:60},
    {id:'title-snakeking',price:60},{id:'title-unbeaten',price:90},{id:'title-champion',price:100},{id:'title-legend',price:130},
    {id:'honor-rank1-global',price:0,honorary:true},
  ];
  const ALL_CURSORSNAKES = [
    {id:'cursorsnake-pixel',price:50},{id:'cursorsnake-neon',price:80},{id:'cursorsnake-comet',price:110},
    {id:'cursorsnake-electric',price:130},{id:'cursorsnake-stars',price:160},{id:'cursorsnake-fire',price:200},
  ];
  const ALL_AVATARS = [
    {id:'avatar-gamepad',price:15},{id:'avatar-cat',price:15},{id:'avatar-lightning',price:25},
    {id:'avatar-rocket',price:40},{id:'avatar-robot',price:70},{id:'avatar-skull',price:90},{id:'avatar-crown',price:120},
  ];
  const ALL_P4TOKENS = [
    {id:'p4token-goldsilver',price:50},{id:'p4token-neon',price:80},{id:'p4token-lavalice',price:110},{id:'p4token-galaxy',price:140},
  ];
  const ALL_TTT = [
    {id:'ttt-neon',price:20},{id:'ttt-sunmoon',price:40},{id:'ttt-heartstar',price:50},
    {id:'ttt-catdog',price:80},{id:'ttt-skulllightning',price:100},
  ];
  const ALL_CHESS = [
    {id:'chess-cyber',price:100},{id:'chess-frost',price:130},{id:'chess-neon',price:170},{id:'chess-marble',price:200},
  ];
  const ALL_CLICKFX = [
    {id:'clickfx-bubbles',price:15},{id:'clickfx-confetti',price:30},{id:'clickfx-neon',price:60},
    {id:'clickfx-stars',price:90},{id:'clickfx-firework',price:130},
  ];
  const ALL_EMOJIPACKS = [
    {id:'emojipack-animals',price:10},{id:'emojipack-hearts',price:15},{id:'emojipack-party',price:25},
    {id:'emojipack-gaming',price:40},{id:'emojipack-cosmos',price:70},
  ];
  const ALL_VICTORYBANS = [
    {id:'victoryban-neon',price:90},{id:'victoryban-confetti',price:110},{id:'victoryban-flames',price:150},
    {id:'victoryban-lightning',price:170},{id:'victoryban-crown',price:200},
  ];
  const ALL_SOUNDPACKS = [
    {id:'soundpack-8bit',price:40},{id:'soundpack-retro',price:60},{id:'soundpack-crystal',price:80},
    {id:'soundpack-cyber',price:100},{id:'soundpack-epic',price:130},
  ];
  const ALL_EMOTES = [
    {id:'emote-gg',price:5},{id:'emote-wellplayed',price:10},{id:'emote-fire',price:30},
    {id:'emote-easy',price:50},{id:'emote-omg',price:80},
  ];

  const colorItems       = ALL_COLORS.map(c  => ({ ...c, type:'color',       name: d.shopCosmeticNames[c.id] }));
  const fontItems        = ALL_FONTS.map(f   => ({ ...f, type:'font',        name: _FONT_DISPLAY_NAMES[f.id] }));
  const bubbleItems      = ALL_BUBBLES.map(b => ({ ...b, type:'bubble',      name: d.shopBubbleNames[b.id] }));
  const bgItems          = ALL_BGS.map(b     => ({ ...b, type:'background',  name: d.shopBgNames[b.id] }));
  const nameEffectItems  = ALL_NAMEEFFECTS.map(x  => ({ ...x, type:'nameeffect',  name: d.shopNameEffectNames[x.id] }));
  const titleItems       = ALL_TITLES.map(x       => ({ ...x, type:'title',       name: x.honorary ? (d.honorTitleNames?.[x.id] || x.id) : d.shopTitleNames[x.id] }));
  const cursorSnakeItems = ALL_CURSORSNAKES.map(x  => ({ ...x, type:'cursorsnake', name: d.shopCursorSnakeNames[x.id] }));
  const avatarItems      = ALL_AVATARS.map(x      => ({ ...x, type:'avatar',      name: d.shopAvatarNames[x.id] }));
  const p4TokenItems     = ALL_P4TOKENS.map(x     => ({ ...x, type:'p4token',     name: d.shopP4TokenNames[x.id] }));
  const tttItems         = ALL_TTT.map(x          => ({ ...x, type:'ttt',         name: d.shopTttNames[x.id] }));
  const chessItems       = ALL_CHESS.map(x        => ({ ...x, type:'chess',       name: d.shopChessNames[x.id] }));
  const clickFxItems     = ALL_CLICKFX.map(x      => ({ ...x, type:'clickfx',     name: d.shopClickFxNames[x.id] }));
  const emojiPackItems   = ALL_EMOJIPACKS.map(x   => ({ ...x, type:'emojipack',   name: d.shopEmojiPackNames[x.id] }));
  const victoryBanItems  = ALL_VICTORYBANS.map(x  => ({ ...x, type:'victoryban',  name: d.shopVictoryBanNames[x.id] }));
  const soundPackItems   = ALL_SOUNDPACKS.map(x   => ({ ...x, type:'soundpack',   name: d.shopSoundPackNames[x.id] }));
  const emoteItems       = ALL_EMOTES.map(x       => ({ ...x, type:'emote',       name: d.shopEmoteNames[x.id] }));

  const allItemsById = {};
  [...colorItems, ...fontItems, ...bubbleItems, ...bgItems,
   ...nameEffectItems, ...titleItems, ...cursorSnakeItems, ...avatarItems,
   ...p4TokenItems, ...tttItems, ...chessItems,
   ...clickFxItems, ...emojiPackItems, ...victoryBanItems, ...soundPackItems, ...emoteItems,
  ].forEach(it => { allItemsById[it.id] = it; });
  allItemsById['boost_hint_10'] = { id:'boost_hint_10', type:'boost', price:3, name:d.shopBoostHintName };
  allItemsById['boost_hint_20'] = { id:'boost_hint_20', type:'boost', price:5, name:d.shopBoostHintName };

  const rotFeatured = shopRotation?.featured?.length ? shopRotation.featured : _FEATURED_IDS;
  const rotDaily    = shopRotation?.daily || [];
  const featuredItems = rotFeatured.map(id => allItemsById[id]).filter(Boolean);
  const dailyItems    = rotDaily.map(id => allItemsById[id]).filter(Boolean);

  function tileHtml(item, large = false, extraBadge = '') {
    const { id, type, price, name } = item;
    const honorary = item.honorary || false;
    const rarity  = _getRarity(price);
    const owned   = honorary ? (honorTitle === id) : ownedCosmetics.includes(id);
    const isEquipped = !honorary && [equippedCosmetic, equippedFont, equippedBubble, equippedBackground,
      equippedNameEffect, equippedTitle, equippedCursorSnake, equippedAvatar,
      equippedP4Token, equippedTtt, equippedChess, equippedSnakeSkin,
      equippedClickFx, equippedEmojiPack, equippedVictoryBan, equippedSoundPack, ...equippedEmotes,
    ].includes(id);
    const safeName = (name || id).replace(/"/g, '&quot;');
    const _AV = {'avatar-gamepad':'🎮','avatar-cat':'🐱','avatar-lightning':'⚡','avatar-rocket':'🚀','avatar-robot':'🤖','avatar-skull':'💀','avatar-crown':'👑'};
    const _TTT_E = {'ttt-neon':'✖️⭕','ttt-sunmoon':'☀️🌙','ttt-heartstar':'❤️⭐','ttt-catdog':'🐱🐶','ttt-skulllightning':'💀⚡'};
    const _CFX = {'clickfx-bubbles':'🫧','clickfx-confetti':'🎊','clickfx-neon':'⚡','clickfx-stars':'🌟','clickfx-firework':'🎆'};
    const _EP = {'emojipack-animals':'🐾','emojipack-hearts':'💜','emojipack-party':'🎉','emojipack-gaming':'🎮','emojipack-cosmos':'🌌'};
    const _EM = {'emote-gg':'👍','emote-wellplayed':'🤝','emote-fire':'🔥','emote-easy':'😎','emote-omg':'😱'};
    let previewHtml = '';
    if (type === 'background')     previewHtml = `<div class="shop-bg-preview ${id}"></div>`;
    else if (type === 'bubble')    previewHtml = `<div class="shop-bubble-preview ${id}">Salut ! 👋</div>`;
    else if (type === 'font')      previewHtml = `<span class="shop-fn-font-preview ${_cosmeticClass(equippedCosmetic)} ${id}">${playerPreview}</span>`;
    else if (type === 'color')     previewHtml = `<span class="shop-cosmetic-preview name-${id} ${_fontClass(equippedFont)}">${playerPreview}</span>`;
    else if (type === 'nameeffect') previewHtml = `<span class="shop-nameeffect-preview ${id}">${playerPreview}</span>`;
    else if (type === 'title' && honorary) previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="player-honor-tag">${name || ''}</span></span>`;
    else if (type === 'title')      previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="shop-title-tag">${name || ''}</span></span>`;
    else if (type === 'cursorsnake') previewHtml = `<div class="shop-emoji-preview">🐍</div>`;
    else if (type === 'avatar')     previewHtml = `<div class="shop-emoji-preview">${_AV[id]||'🎭'}</div>`;
    else if (type === 'p4token')    previewHtml = `<div class="shop-emoji-preview">🔴🟡</div>`;
    else if (type === 'ttt')        previewHtml = `<div class="shop-emoji-preview">${_TTT_E[id]||'✖️⭕'}</div>`;
    else if (type === 'chess')      previewHtml = `<div class="shop-emoji-preview">♟️♜</div>`;
    else if (type === 'clickfx')    previewHtml = `<div class="shop-emoji-preview">${_CFX[id]||'✨'}</div>`;
    else if (type === 'emojipack')  previewHtml = `<div class="shop-emoji-preview">${_EP[id]||'🎉'}</div>`;
    else if (type === 'victoryban') previewHtml = `<div class="shop-emoji-preview">🏆</div>`;
    else if (type === 'soundpack')  previewHtml = `<div class="shop-emoji-preview">🎵</div>`;
    else if (type === 'emote')      previewHtml = `<div class="shop-emoji-preview">${_EM[id]||'😊'}</div>`;
    const badgeHtml = honorary
      ? `<div class="shop-tile-badge shop-tile-badge-honorary">${d.shopHonoraryBadge || '🏆'}</div>`
      : `<div class="shop-tile-badge rarity-${rarity}">${rarityLabel[rarity]}</div>`;
    const priceDisplay = honorary ? '' : (price === 0 ? lblFree : price + ' ⚡');
    const ownedLabel = honorary ? (d.shopHonoraryOwned || 'Obtenu') : (isEquipped ? lblEquipped : lblOwned);
    return `<div class="shop-tile${large ? ' shop-tile-large' : ''}${honorary ? ' shop-tile-honorary' : ''} rarity-${honorary ? 'honorary' : rarity}"
      data-id="${id}" data-type="${type}" data-price="${price}" data-name="${safeName}"${honorary ? ' data-honorary="1"' : ''}>
      <div class="shop-tile-img">${previewHtml}</div>
      <div class="shop-tile-footer">
        <span class="shop-tile-name">${name || id}</span>
        ${priceDisplay ? `<span class="shop-tile-price">${priceDisplay}</span>` : ''}
      </div>
      ${badgeHtml}
      ${extraBadge ? `<div class="shop-tile-daily-badge">${extraBadge}</div>` : ''}
      ${owned ? `<div class="shop-tile-owned">${ownedLabel}</div>` : ''}
    </div>`;
  }

  function bundleTileHtml(bundle) {
    const name    = d.shopBundleNames[bundle.id] || bundle.id;
    const rarity  = _bundleRarity(bundle, allItemsById);
    const savings = Math.round((1 - bundle.bundlePrice / bundle.totalPrice) * 100);
    const cosmeticIds = bundle.items.filter(id => allItemsById[id]?.type !== 'boost');
    const allOwned = cosmeticIds.every(id => ownedCosmetics.includes(id));
    const previewId = bundle.items.find(id => allItemsById[id]?.type === 'background')
                   || bundle.items.find(id => allItemsById[id]?.type === 'bubble')
                   || bundle.items[0];
    const previewItem = allItemsById[previewId];
    let previewHtml = '';
    if (previewItem?.type === 'background')
      previewHtml = `<div class="shop-bg-preview ${previewId}"></div>`;
    else if (previewItem?.type === 'bubble')
      previewHtml = `<div class="shop-bubble-preview ${previewId}" style="font-size:.9rem;padding:6px 12px">Salut ! 👋</div>`;
    return `<div class="shop-tile shop-tile-large rarity-${rarity}"
      data-id="${bundle.id}" data-type="bundle">
      <div class="shop-tile-img">${previewHtml}</div>
      <div class="shop-tile-footer">
        <span class="shop-tile-name">${name}</span>
        <div class="shop-bundle-prices">
          <span class="shop-price-crossed">${bundle.totalPrice} ⚡</span>
          <span class="shop-tile-price">${bundle.bundlePrice} ⚡</span>
        </div>
      </div>
      <div class="shop-tile-badge rarity-${rarity}">${rarityLabel[rarity]}</div>
      <div class="shop-tile-saving">${d.shopBundleSave(savings)}</div>
      ${allOwned ? `<div class="shop-tile-owned">${lblOwned}</div>` : ''}
    </div>`;
  }

  const nav = d.shopNavLabels;
  const countdownVal = shopRotation ? d.shopCountdown(Math.max(0, shopRotation.resetAt - Date.now())) : '';

  container.innerHTML = `
    <nav class="shop-fn-nav" id="shop-fn-nav">
      <button class="shop-fn-nav-btn active" data-section="featured"><span class="shop-nav-icon">⭐</span><span class="shop-nav-label"> ${nav.featured}</span></button>
      <button class="shop-fn-nav-btn" data-section="daily"><span class="shop-nav-icon">📅</span><span class="shop-nav-label"> ${nav.daily}</span></button>
      <button class="shop-fn-nav-btn" data-section="bundles"><span class="shop-nav-icon">🎁</span><span class="shop-nav-label"> ${nav.bundles}</span></button>
      <button class="shop-fn-nav-btn" data-section="boosts"><span class="shop-nav-icon">💡</span><span class="shop-nav-label"> ${nav.boosts}</span></button>
      <button class="shop-fn-nav-btn" data-section="colors"><span class="shop-nav-icon">🎨</span><span class="shop-nav-label"> ${nav.colors}</span></button>
      <button class="shop-fn-nav-btn" data-section="fonts"><span class="shop-nav-icon">✍️</span><span class="shop-nav-label"> ${nav.fonts}</span></button>
      <button class="shop-fn-nav-btn" data-section="bubbles"><span class="shop-nav-icon">💬</span><span class="shop-nav-label"> ${nav.bubbles}</span></button>
      <button class="shop-fn-nav-btn" data-section="bgs"><span class="shop-nav-icon">🖼️</span><span class="shop-nav-label"> ${nav.bgs}</span></button>
      <button class="shop-fn-nav-btn" data-section="nameeffects"><span class="shop-nav-icon">✨</span><span class="shop-nav-label"> ${nav.nameeffects}</span></button>
      <button class="shop-fn-nav-btn" data-section="titles"><span class="shop-nav-icon">🏷️</span><span class="shop-nav-label"> ${nav.titles}</span></button>
      <button class="shop-fn-nav-btn" data-section="cursorsnakes"><span class="shop-nav-icon">🖱️</span><span class="shop-nav-label"> ${nav.cursorsnakes}</span></button>
      <button class="shop-fn-nav-btn" data-section="avatars"><span class="shop-nav-icon">🎭</span><span class="shop-nav-label"> ${nav.avatars}</span></button>
      <button class="shop-fn-nav-btn" data-section="p4tokens"><span class="shop-nav-icon">🔴</span><span class="shop-nav-label"> ${nav.p4tokens}</span></button>
      <button class="shop-fn-nav-btn" data-section="ttt"><span class="shop-nav-icon">✖️</span><span class="shop-nav-label"> ${nav.ttt}</span></button>
      <button class="shop-fn-nav-btn" data-section="chess"><span class="shop-nav-icon">♟️</span><span class="shop-nav-label"> ${nav.chess}</span></button>
      <button class="shop-fn-nav-btn" data-section="clickfx"><span class="shop-nav-icon">💥</span><span class="shop-nav-label"> ${nav.clickfx}</span></button>
      <button class="shop-fn-nav-btn" data-section="emojipacks"><span class="shop-nav-icon">🌈</span><span class="shop-nav-label"> ${nav.emojipacks}</span></button>
      <button class="shop-fn-nav-btn" data-section="victorybans"><span class="shop-nav-icon">🏆</span><span class="shop-nav-label"> ${nav.victorybans}</span></button>
      <button class="shop-fn-nav-btn" data-section="soundpacks"><span class="shop-nav-icon">🔊</span><span class="shop-nav-label"> ${nav.soundpacks}</span></button>
      <button class="shop-fn-nav-btn" data-section="emotes"><span class="shop-nav-icon">😎</span><span class="shop-nav-label"> ${nav.emotes}</span></button>
    </nav>
    <div class="shop-fn-content">

    <section class="shop-fn-section" id="shop-sec-featured" data-section-id="featured">
      <h3 class="shop-fn-section-title">${d.shopFeaturedTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.featured}</p>
      <div class="shop-fn-featured">
        ${featuredItems.map(it => tileHtml(it, true)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-daily" data-section-id="daily">
      <h3 class="shop-fn-section-title">
        ${d.shopDailyTitle}
        ${shopRotation ? `<span class="shop-fn-countdown">${d.shopRotationLabel} <span id="shop-countdown-val">${countdownVal}</span></span>` : ''}
      </h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.daily}</p>
      <div class="shop-fn-grid">
        ${dailyItems.map(it => tileHtml(it, false, d.shopDailyBadge)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-bundles" data-section-id="bundles">
      <h3 class="shop-fn-section-title">${d.shopBundlesTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.bundles}</p>
      <div class="shop-fn-featured shop-fn-bundles-grid">
        ${ALL_BUNDLES.map(b => bundleTileHtml(b)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-bgs" data-section-id="bgs">
      <h3 class="shop-fn-section-title">${d.shopBgTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.bgs}</p>
      <div class="shop-fn-grid">
        ${bgItems.map(it => tileHtml(it)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-bubbles" data-section-id="bubbles">
      <h3 class="shop-fn-section-title">${d.shopBubbleTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.bubbles}</p>
      <div class="shop-fn-grid">
        ${bubbleItems.map(it => tileHtml(it)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-fonts" data-section-id="fonts">
      <h3 class="shop-fn-section-title">${d.shopFontsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.fonts}</p>
      <div class="shop-fn-grid">
        ${fontItems.map(it => tileHtml(it)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-colors" data-section-id="colors">
      <h3 class="shop-fn-section-title">${d.shopCosmeticsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.colors}</p>
      <div class="shop-fn-grid">
        ${colorItems.map(it => tileHtml(it)).join('')}
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-boosts" data-section-id="boosts">
      <h3 class="shop-fn-section-title">Boosts</h3>
      <div class="shop-fn-boost">
        <div class="shop-fn-boost-header">
          <span class="shop-fn-boost-name">${d.shopBoostHintName}</span>
          <span class="shop-fn-boost-pending" id="shop-pending-boost-hint"></span>
        </div>
        <p class="shop-fn-boost-desc">${d.shopBoostHintDesc}</p>
        <div class="shop-fn-boost-btns">
          <button id="btn-buy-boost-hint-10" class="btn btn-primary">${d.shopBtnBuy10}</button>
          <button id="btn-buy-boost-hint-20" class="btn btn-primary">${d.shopBtnBuy20}</button>
        </div>
      </div>
    </section>

    <section class="shop-fn-section" id="shop-sec-nameeffects" data-section-id="nameeffects">
      <h3 class="shop-fn-section-title">${d.shopNameEffectsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.nameeffects}</p>
      <div class="shop-fn-grid">${nameEffectItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-titles" data-section-id="titles">
      <h3 class="shop-fn-section-title">${d.shopTitlesTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.titles}</p>
      <div class="shop-fn-grid">${titleItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-cursorsnakes" data-section-id="cursorsnakes">
      <h3 class="shop-fn-section-title">${d.shopCursorSnakesTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.cursorsnakes}</p>
      <div class="shop-fn-grid">${cursorSnakeItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-avatars" data-section-id="avatars">
      <h3 class="shop-fn-section-title">${d.shopAvatarsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.avatars}</p>
      <div class="shop-fn-grid">${avatarItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-p4tokens" data-section-id="p4tokens">
      <h3 class="shop-fn-section-title">${d.shopP4TokensTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.p4tokens}</p>
      <div class="shop-fn-grid">${p4TokenItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-ttt" data-section-id="ttt">
      <h3 class="shop-fn-section-title">${d.shopTttTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.ttt}</p>
      <div class="shop-fn-grid">${tttItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-chess" data-section-id="chess">
      <h3 class="shop-fn-section-title">${d.shopChessTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.chess}</p>
      <div class="shop-fn-grid">${chessItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-clickfx" data-section-id="clickfx">
      <h3 class="shop-fn-section-title">${d.shopClickFxTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.clickfx}</p>
      <div class="shop-fn-grid">${clickFxItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-emojipacks" data-section-id="emojipacks">
      <h3 class="shop-fn-section-title">${d.shopEmojiPacksTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.emojipacks}</p>
      <div class="shop-fn-grid">${emojiPackItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-victorybans" data-section-id="victorybans">
      <h3 class="shop-fn-section-title">${d.shopVictoryBansTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.victorybans}</p>
      <div class="shop-fn-grid">${victoryBanItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-soundpacks" data-section-id="soundpacks">
      <h3 class="shop-fn-section-title">${d.shopSoundPacksTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.soundpacks}</p>
      <div class="shop-fn-grid">${soundPackItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-emotes" data-section-id="emotes">
      <h3 class="shop-fn-section-title">${d.shopEmotesTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.emotes}</p>
      <div class="shop-fn-grid">${emoteItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-promo">
      <h3 class="shop-fn-section-title">${d.shopPromoTitle}</h3>
      <div class="shop-fn-promo">
        <div class="shop-fn-promo-row">
          <input id="shop-promo-input" type="text" maxlength="4" class="shop-fn-promo-input"
            placeholder="${d.shopPromoPlaceholder}" autocomplete="off" autocorrect="off"
            autocapitalize="characters" spellcheck="false">
          <button id="btn-redeem-code" class="btn btn-secondary">${d.shopPromoBtn}</button>
        </div>
        <span id="shop-promo-feedback" class="shop-fn-promo-feedback"></span>
      </div>
    </section>
    </div>
  `;

  $('btn-buy-boost-hint-10').addEventListener('click', () => {
    socket.emit('buy-boost', { itemId: 'boost_hint_10', playerId: getPlayerId() });
  });
  $('btn-buy-boost-hint-20').addEventListener('click', () => {
    socket.emit('buy-boost', { itemId: 'boost_hint_20', playerId: getPlayerId() });
  });
  $('btn-redeem-code').addEventListener('click', () => {
    const code = ($('shop-promo-input').value || '').trim();
    if (!code) return;
    socket.emit('redeem-code', { code, playerId: getPlayerId(), name: localStorage.getItem('playerName') || '' });
  });
  $('shop-promo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-redeem-code').click();
  });
  _updateShopPending(pendingHintCharges);

  container.querySelectorAll('.shop-tile:not([data-type="bundle"])').forEach(tile => {
    tile.addEventListener('click', () => {
      const item = allItemsById[tile.dataset.id];
      if (item) _openShopDetail(item);
    });
  });

  container.querySelectorAll('.shop-tile[data-type="bundle"]').forEach(tile => {
    tile.addEventListener('click', () => {
      const bundle = ALL_BUNDLES.find(b => b.id === tile.dataset.id);
      if (bundle) _openBundleDetail(bundle, allItemsById);
    });
  });

  container.querySelectorAll('.shop-fn-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = container.querySelector(`#shop-sec-${btn.dataset.section}`);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const contentEl = container.querySelector('.shop-fn-content');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sid = entry.target.dataset.sectionId;
        container.querySelectorAll('.shop-fn-nav-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.section === sid);
        });
      }
    });
  }, { root: contentEl || container, threshold: 0.15 });
  container.querySelectorAll('[data-section-id]').forEach(sec => observer.observe(sec));

  if (shopRotation) _startShopCountdown(shopRotation.resetAt);
  if (_shopDetailItem) _openShopDetail(_shopDetailItem);

  // ── Scroll / focus apres (re)rendu ──────────────────────────────────────
  let _tileJustFocused = false;

  // Cas 1 : badge unique (avatar) -> glow anime
  if (_pendingShopFocus && contentEl) {
    const tile = container.querySelector(`.shop-tile[data-id="${_pendingShopFocus}"]`);
    if (tile) {
      const capturedId  = _pendingShopFocus;
      _shopRetainTileId = capturedId;
      _tileJustFocused  = true;
      requestAnimationFrame(() => {
        const cRect = contentEl.getBoundingClientRect();
        const tRect = tile.getBoundingClientRect();
        contentEl.scrollTop += tRect.top - cRect.top - (cRect.height - tRect.height) / 2;
      });
      clearTimeout(_focusDebounceTimer);
      _focusDebounceTimer = setTimeout(() => {
        _pendingShopFocus = null;
        if ($('overlay-shop').classList.contains('hidden')) return;
        const finalTile = container.querySelector(`.shop-tile[data-id="${capturedId}"]`);
        if (!finalTile) return;
        finalTile.scrollIntoView({ behavior: 'smooth', block: 'center' });
        finalTile.classList.remove('shop-tile-highlight');
        void finalTile.offsetWidth;
        finalTile.classList.add('shop-tile-highlight');
        setTimeout(() => finalTile.classList.remove('shop-tile-highlight'), 2600);
      }, 300);
    }
  }

  // Cas 2 : pas de badge -> surligner font + nameEffect + cosmetic
  if (!_tileJustFocused && _pendingShopFocusIds?.length && contentEl) {
    const tiles = _pendingShopFocusIds
      .map(id => container.querySelector(`.shop-tile[data-id="${id}"]`))
      .filter(Boolean);
    if (tiles.length) {
      const capturedIds = [..._pendingShopFocusIds];
      _shopRetainTileId = capturedIds[0];
      _tileJustFocused  = true;
      requestAnimationFrame(() => {
        const cRect = contentEl.getBoundingClientRect();
        const tRect = tiles[0].getBoundingClientRect();
        contentEl.scrollTop += tRect.top - cRect.top - (cRect.height - tRect.height) / 2;
      });
      clearTimeout(_focusDebounceTimer);
      _focusDebounceTimer = setTimeout(() => {
        _pendingShopFocusIds = null;
        if ($('overlay-shop').classList.contains('hidden')) return;
        const finalTiles = capturedIds
          .map(id => container.querySelector(`.shop-tile[data-id="${id}"]`))
          .filter(Boolean);
        if (!finalTiles.length) return;
        finalTiles[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        finalTiles.forEach(t => {
          t.classList.remove('shop-tile-highlight');
          void t.offsetWidth; // force reflow pour relancer l'animation
          t.classList.add('shop-tile-highlight');
        });
        setTimeout(() => finalTiles.forEach(t => t.classList.remove('shop-tile-highlight')), 2600);
      }, 300);
    }
  }

  if (!_tileJustFocused && _shopRetainTileId && contentEl) {
    const tile = container.querySelector(`.shop-tile[data-id="${_shopRetainTileId}"]`);
    if (tile) {
      requestAnimationFrame(() => {
        const cRect = contentEl.getBoundingClientRect();
        const tRect = tile.getBoundingClientRect();
        contentEl.scrollTop += tRect.top - cRect.top - (cRect.height - tRect.height) / 2;
      });
    }
  } else if (!_tileJustFocused && !_shopRetainTileId && contentEl) {
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem('shopState')); } catch { return null; } })();
    if (saved?.scrollTop) {
      requestAnimationFrame(() => { contentEl.scrollTop = saved.scrollTop; });
    }
  }

  if (contentEl) {
    let _scrollSaveTimer;
    contentEl.addEventListener('scroll', () => {
      clearTimeout(_scrollSaveTimer);
      _scrollSaveTimer = setTimeout(() => {
        const prev = (() => { try { return JSON.parse(sessionStorage.getItem('shopState')) || {}; } catch { return {}; } })();
        sessionStorage.setItem('shopState', JSON.stringify({ ...prev, scrollTop: contentEl.scrollTop }));
      }, 300);
    }, { passive: true });
  }
}

function _openBundleDetail(bundle, allItemsById) {
  _shopDetailItem = null;
  const d  = t();
  const fr = currentLang === 'fr';
  const panel = $('shop-detail-panel');
  if (!panel) return;

  const rarityLabel = {
    commun: fr ? 'Commun' : 'Common', rare: 'Rare',
    epique: fr ? 'Épique' : 'Epic', legendaire: fr ? 'Légendaire' : 'Legendary',
  };
  const lblFree  = fr ? 'Gratuit' : 'Free';
  const lblOwned = fr ? 'Possédé' : 'Owned';
  const name     = d.shopBundleNames[bundle.id] || bundle.id;
  const rarity   = _bundleRarity(bundle, allItemsById);
  const savings  = Math.round((1 - bundle.bundlePrice / bundle.totalPrice) * 100);

  const cosmeticIds      = bundle.items.filter(id => allItemsById[id]?.type !== 'boost');
  const boostIds         = bundle.items.filter(id => allItemsById[id]?.type === 'boost');
  const unownedCosmetics = cosmeticIds.filter(id => !ownedCosmetics.includes(id));
  const allOwned         = unownedCosmetics.length === 0 && boostIds.length === 0;
  const ownedCount       = cosmeticIds.filter(id => ownedCosmetics.includes(id)).length;

  const getPrice  = id => allItemsById[id]?.price || 0;
  const uVal      = unownedCosmetics.reduce((s, id) => s + getPrice(id), 0)
                  + boostIds.reduce((s, id) => s + getPrice(id), 0);
  const adjPrice  = Math.max(1, Math.round(bundle.bundlePrice * uVal / bundle.totalPrice));

  const itemsHtml = bundle.items.map(id => {
    const item  = allItemsById[id];
    if (!item) return '';
    const isOwned = item.type !== 'boost' && ownedCosmetics.includes(id);
    let prev = '';
    if      (item.type === 'background') prev = `<div class="shop-bg-preview ${id}" style="width:38px;height:26px;border-radius:4px;flex-shrink:0"></div>`;
    else if (item.type === 'bubble')     prev = `<div class="shop-bubble-preview ${id}" style="font-size:.6rem;padding:2px 7px;flex-shrink:0">💬</div>`;
    else if (item.type === 'font')       prev = `<span class="shop-fn-font-preview ${id}" style="font-size:.95rem;flex-shrink:0">Aa</span>`;
    else if (item.type === 'color')      prev = `<span class="shop-cosmetic-preview name-${id}" style="font-size:.8rem;font-weight:800;flex-shrink:0">Lib</span>`;
    else if (item.type === 'boost')      prev = `<span style="font-size:1.1rem;flex-shrink:0">💡</span>`;
    return `<div class="shop-bundle-content-item${isOwned ? ' is-owned' : ''}">
      ${prev}
      <span class="bundle-item-name">${item.name || id}</span>
      ${isOwned ? `<span class="bundle-item-tag">${lblOwned}</span>`
               : item.type !== 'boost' ? `<span class="bundle-item-price">${item.price > 0 ? item.price + ' ⚡' : lblFree}</span>` : ''}
    </div>`;
  }).join('');

  const priceHtml = allOwned
    ? ''
    : `<div class="shop-fn-detail-price">
        ${adjPrice} ⚡
        <span class="shop-price-crossed">${ownedCount > 0 ? bundle.bundlePrice : bundle.totalPrice} ⚡</span>
        <span class="shop-bundle-saving-inline">${d.shopBundleSave(savings)}</span>
      </div>`;

  const actionHtml = allOwned
    ? `<button class="btn btn-secondary" disabled>${d.shopBundleAlreadyOwned}</button>`
    : `<button class="btn btn-primary shop-detail-action-btn" data-bundle-id="${bundle.id}" data-action="buy-bundle">${d.shopBundleBuy(adjPrice)}</button>`;

  panel.innerHTML = `
    <button class="shop-fn-detail-back" id="shop-detail-back">← ${fr ? 'Retour' : 'Back'}</button>
    <div class="shop-fn-detail-info shop-bundle-detail-info">
      <span class="shop-fn-rarity-badge ${rarity}">${rarityLabel[rarity]}</span>
      <h3 class="shop-fn-detail-name">${name}</h3>
      ${ownedCount > 0 && !allOwned ? `<p class="shop-bundle-status-partial">${d.shopBundlePartialOwned(ownedCount)}</p>` : ''}
      <p class="shop-fn-bundle-contains">${d.shopBundleContains}</p>
      <div class="shop-bundle-contents">${itemsHtml}</div>
      ${priceHtml}
      <div class="shop-fn-detail-action">${actionHtml}</div>
    </div>
  `;
  panel.classList.remove('hidden');

  $('shop-detail-back').addEventListener('click', () => {
    panel.classList.add('hidden');
  });
  panel.querySelectorAll('[data-action="buy-bundle"]').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('buy-bundle', { bundleId: btn.dataset.bundleId, playerId: getPlayerId() });
    });
  });
}

function _openShopDetail(item) {
  _shopDetailItem = item;
  const { id, type, price, name } = item;
  const honorary = item.honorary || false;
  const d   = t();
  const fr  = currentLang === 'fr';
  const rarity = _getRarity(price);
  const playerPreview = localStorage.getItem('playerName') || d.shopCosmeticPreview;
  const panel = $('shop-detail-panel');
  if (!panel) return;

  const rarityLabel = {
    commun:     fr ? 'Commun'     : 'Common',
    rare:       'Rare',
    epique:     fr ? 'Épique'     : 'Epic',
    legendaire: fr ? 'Légendaire' : 'Legendary',
  };

  let previewHtml = '';
  if (type === 'background') {
    previewHtml = `<div class="shop-bg-preview ${id}"></div>`;
  } else if (type === 'bubble') {
    previewHtml = `<div class="shop-bubble-preview ${id}">Salut ! 👋</div>`;
  } else if (type === 'font') {
    previewHtml = `<span class="shop-fn-font-preview ${_cosmeticClass(equippedCosmetic)} ${id}">${playerPreview}</span>`;
  } else if (type === 'color') {
    previewHtml = `<span class="shop-cosmetic-preview name-${id} ${_fontClass(equippedFont)}">${playerPreview}</span>`;
  } else if (type === 'nameeffect') {
    previewHtml = `<span class="shop-nameeffect-preview ${id}">${playerPreview}</span>`;
  } else if (type === 'title' && honorary) {
    previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="player-honor-tag">${name || ''}</span></span>`;
  } else if (type === 'title') {
    previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="shop-title-tag">${name || ''}</span></span>`;
  } else {
    const _DETAIL_EMOJI = {
      'cursorsnake':'🐍','chess':'♟️♜','victoryban':'🏆','soundpack':'🎵🔊',
      'p4token':'🔴🟡',
    };
    const _ITEM_EMOJI = {
      'avatar-gamepad':'🎮','avatar-cat':'🐱','avatar-lightning':'⚡','avatar-rocket':'🚀','avatar-robot':'🤖','avatar-skull':'💀','avatar-crown':'👑',
      'ttt-neon':'✖️⭕','ttt-sunmoon':'☀️🌙','ttt-heartstar':'❤️⭐','ttt-catdog':'🐱🐶','ttt-skulllightning':'💀⚡',
      'clickfx-bubbles':'🫧','clickfx-confetti':'🎊','clickfx-neon':'⚡','clickfx-stars':'🌟','clickfx-firework':'🎆',
      'emojipack-animals':'🐾🐶🐱','emojipack-hearts':'💜💙💚','emojipack-party':'🎉🎊🎈','emojipack-gaming':'🎮🕹️👾','emojipack-cosmos':'🌌🪐✨',
      'emote-gg':'👍','emote-wellplayed':'🤝','emote-fire':'🔥','emote-easy':'😎','emote-omg':'😱',
    };
    const emoji = _ITEM_EMOJI[id] || _DETAIL_EMOJI[type] || '✨';
    previewHtml = `<div class="shop-emoji-preview large">${emoji}</div>`;
  }

  const owned      = honorary ? (honorTitle === id) : ownedCosmetics.includes(id);
  const isEquipped = !honorary && [equippedCosmetic, equippedFont, equippedBubble, equippedBackground,
    equippedNameEffect, equippedTitle, equippedCursorSnake, equippedAvatar,
    equippedP4Token, equippedTtt, equippedChess, equippedSnakeSkin,
    equippedClickFx, equippedEmojiPack, equippedVictoryBan, equippedSoundPack, ...equippedEmotes,
  ].includes(id);
  const lblFree    = fr ? 'Gratuit' : 'Free';
  const priceStr   = price === 0 ? lblFree : `${price} ⚡`;

  let actionHtml = '';
  if (honorary) {
    actionHtml = owned
      ? `<div class="shop-fn-equipped-label">${d.shopHonoraryOwned || 'Obtenu'}</div>`
      : `<p class="shop-honorary-detail-note">${d.shopHonoraryNote || ''}</p>`;
  } else if (owned) {
    const canRefund   = price > 0;
    const hasCards    = refundCards > 0;
    const refundLabel = canRefund
      ? `${d.shopRefundBtn} (${hasCards ? `${refundCards}/2 🎟` : d.shopRefundNoCards})`
      : '';
    const refundBtn   = canRefund
      ? `<button class="btn shop-detail-action-btn shop-refund-btn" data-id="${id}" data-action="refund" ${hasCards ? '' : 'disabled'}>${refundLabel}</button>`
      : '';
    if (type === 'emote') {
      const n = equippedEmotes.length;
      const slotStr = fr ? `${n}/5 dans la barre` : `${n}/5 in bar`;
      if (isEquipped) {
        actionHtml = `<div class="shop-fn-equipped-label">${d.shopCosmeticEquipped}</div>
          <p class="shop-fn-emote-slots">${slotStr}</p>
          <button class="btn btn-secondary shop-detail-action-btn" data-id="${id}" data-action="unequip" data-type="${type}">${d.shopCosmeticUnequip}</button>
          ${refundBtn}`;
      } else {
        const full = n >= 5;
        actionHtml = `<p class="shop-fn-emote-slots">${slotStr}${full ? (fr ? ' — barre pleine' : ' — bar full') : ''}</p>
          <button class="btn btn-primary shop-detail-action-btn" data-id="${id}" data-action="equip" data-type="${type}" ${full ? 'disabled' : ''}>${d.shopCosmeticEquip}</button>
          ${refundBtn}`;
      }
    } else if (isEquipped) {
      actionHtml = `<div class="shop-fn-equipped-label">${d.shopCosmeticEquipped}</div>
        <button class="btn btn-secondary shop-detail-action-btn" data-id="${id}" data-action="unequip" data-type="${type}">${d.shopCosmeticUnequip}</button>
        ${refundBtn}`;
    } else {
      actionHtml = `<button class="btn btn-primary shop-detail-action-btn" data-id="${id}" data-action="equip" data-type="${type}">${d.shopCosmeticEquip}</button>
        ${refundBtn}`;
    }
  } else {
    actionHtml = `<button class="btn btn-primary shop-detail-action-btn" data-id="${id}" data-action="buy" data-type="${type}">${price === 0 ? lblFree : d.shopCosmeticBuy(price)}</button>`;
  }

  panel.innerHTML = `
    <button class="shop-fn-detail-back" id="shop-detail-back">← ${fr ? 'Retour' : 'Back'}</button>
    <div class="shop-fn-detail-preview">${previewHtml}</div>
    <div class="shop-fn-detail-info">
      ${honorary
        ? `<span class="shop-fn-rarity-badge shop-fn-rarity-badge-honorary">${d.shopHonoraryBadge || '🏆'}</span>`
        : `<span class="shop-fn-rarity-badge ${rarity}">${rarityLabel[rarity]}</span>`}
      <h3 class="shop-fn-detail-name">${name || id}</h3>
      ${honorary ? '' : `<div class="shop-fn-detail-price">${priceStr}</div>`}
      <div class="shop-fn-detail-action">${actionHtml}</div>
    </div>
  `;
  panel.classList.remove('hidden');

  $('shop-detail-back').addEventListener('click', () => {
    panel.classList.add('hidden');
    _shopDetailItem = null;
  });

  panel.querySelectorAll('.shop-detail-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const bId   = btn.dataset.id;
      const bType = btn.dataset.type;
      if (action === 'buy')          socket.emit('buy-cosmetic',    { cosmeticId: bId,  playerId: getPlayerId() });
      else if (action === 'equip')   socket.emit('equip-cosmetic',  { cosmeticId: bId,  type: bType, playerId: getPlayerId() });
      else if (action === 'unequip') socket.emit('equip-cosmetic',  { cosmeticId: bType === 'emote' ? bId : null, type: bType, playerId: getPlayerId(), remove: bType === 'emote' });
      else if (action === 'refund')  socket.emit('refund-cosmetic', { cosmeticId: bId,  playerId: getPlayerId() });
    });
  });
}

function _updateShopPending(pendingBoostHint) {
  const el = $('shop-pending-boost-hint');
  if (!el || pendingBoostHint === undefined) return;
  const d = t();
  el.textContent = pendingBoostHint > 0 ? d.shopPending(pendingBoostHint) : '';
}

function _bubbleClass(bubble) {
  const valid = ['bubble-ardoise','bubble-ocean','bubble-menthe','bubble-corail','bubble-ambre',
    'bubble-lavande','bubble-rubis','bubble-emeraude','bubble-indigo','bubble-magenta','bubble-cyan',
    'bubble-crepuscule','bubble-aurore','bubble-sunset','bubble-tropical','bubble-arcade',
    'bubble-galaxie','bubble-verre','bubble-or','bubble-holographique','bubble-cameleon'];
  return bubble && valid.includes(bubble) ? bubble : '';
}

function _showShopFeedback(msg, color) {
  const fb = $('shop-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = color || '#fff';
  fb.classList.remove('hidden');
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.classList.add('hidden'); fb.textContent = ''; }, 3500);
}

function _showPromoFeedback(msg, color) {
  const fb = $('shop-promo-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = color;
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.textContent = ''; }, 3000);
}

// ── Panneau Paramètres ────────────────────────────────────────────────────────
function _updateSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  const d = t();
  const fr = currentLang === 'fr';

  const langBtn = document.getElementById('sp-lang-btn');
  if (langBtn) langBtn.textContent = fr ? '🇫🇷 FR ⇄' : '🇬🇧 EN ⇄';

  const themeBtn = document.getElementById('sp-theme-btn');
  if (themeBtn) {
    const isLight = document.documentElement.classList.contains('light');
    themeBtn.textContent = isLight ? (fr ? '☀️ Jour ⇄' : '☀️ Day ⇄') : (fr ? '🌙 Nuit ⇄' : '🌙 Night ⇄');
  }

  const snakeBtn = document.getElementById('sp-snake-btn');
  if (snakeBtn) {
    const snakeOff = document.getElementById('btn-snake-toggle')?.classList.contains('off');
    snakeBtn.textContent = snakeOff ? d.settingsSnakeOff : d.settingsSnakeOn;
    snakeBtn.classList.toggle('sp-off', !!snakeOff);
  }

  const sfxBtn = document.getElementById('sp-sfx-btn');
  if (sfxBtn) {
    sfxBtn.textContent = sfxEnabled ? d.settingsSfxOn : d.settingsSfxOff;
    sfxBtn.classList.toggle('sp-off', !sfxEnabled);
  }
  const volSlider = document.getElementById('sp-vol-slider');
  if (volSlider) volSlider.value = String(Math.round(sfxVolume * 100));

  const bgmBtn = document.getElementById('sp-bgm-btn');
  if (bgmBtn) {
    bgmBtn.textContent = bgmEnabled ? d.settingsBgmOn : d.settingsBgmOff;
    bgmBtn.classList.toggle('sp-off', !bgmEnabled);
  }
  const bgmSlider = document.getElementById('sp-bgm-vol');
  if (bgmSlider) bgmSlider.value = String(Math.round(bgmVolume * 100));

  const refundEl = document.getElementById('sp-refund-info');
  if (refundEl) refundEl.textContent = d.settingsRefundInfo(refundCards, refundCardsNextRefill);

  document.querySelectorAll('[data-sp-label]').forEach(el => {
    const key = el.dataset.spLabel;
    if (d[key]) el.textContent = d[key];
  });
}

function _openSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.classList.remove('hidden');
  SFX.openPanel();
  _updateSettingsPanel();
  setTimeout(() => {
    document.addEventListener('click', _settingsOutsideClick);
  }, 0);
}

function _closeSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.classList.add('hidden');
  document.removeEventListener('click', _settingsOutsideClick);
}

function _settingsOutsideClick(e) {
  if (!e.isTrusted) return; // ignore programmatic .click() calls from sp-buttons
  const panel = document.getElementById('settings-panel');
  const btn   = document.getElementById('btn-settings');
  if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    _closeSettingsPanel();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _loadNewsComments();

  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const panel = document.getElementById('settings-panel');
      if (panel && !panel.classList.contains('hidden')) _closeSettingsPanel();
      else _openSettingsPanel();
    });
  }

  document.getElementById('sp-lang-btn')?.addEventListener('click', () => {
    document.getElementById('btn-lang')?.click();
    _updateSettingsPanel();
  });
  document.getElementById('sp-theme-btn')?.addEventListener('click', () => {
    document.getElementById('btn-theme-toggle')?.click();
    setTimeout(_updateSettingsPanel, 50);
  });
  document.getElementById('sp-snake-btn')?.addEventListener('click', () => {
    document.getElementById('btn-snake-toggle')?.click();
    _updateSettingsPanel();
  });
  document.getElementById('sp-sfx-btn')?.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('sfxEnabled', String(sfxEnabled));
    _updateSettingsPanel();
  });
  document.getElementById('sp-vol-slider')?.addEventListener('input', e => {
    sfxVolume = parseInt(e.target.value, 10) / 100;
    localStorage.setItem('sfxVolume', String(sfxVolume));
    SFX.placePiece(); // aperçu du volume
  });
  document.getElementById('sp-bgm-btn')?.addEventListener('click', () => {
    bgmEnabled = !bgmEnabled;
    localStorage.setItem('bgmEnabled', String(bgmEnabled));
    if (bgmEnabled) BGM.start(); else BGM.stop();
    _updateSettingsPanel();
  });
  document.getElementById('sp-bgm-vol')?.addEventListener('input', e => {
    BGM.setVol(parseInt(e.target.value, 10) / 100);
  });
});

// Son sur tous les boutons (capture = avant les handlers spécifiques)
document.addEventListener('click', e => {
  if (e.target.closest('button')) SFX.btnClick();
}, true);

$('libs-counter').addEventListener('click', openShop);
$('btn-shop-close').addEventListener('click', () => {
  $('overlay-shop').classList.add('hidden');
  sessionStorage.removeItem('shopState');
  const dp = $('shop-detail-panel');
  if (dp) dp.classList.add('hidden');
  _shopDetailItem      = null;
  _shopRetainTileId    = null;
  _pendingShopFocus    = null;
  _pendingShopFocusIds = null;
  clearTimeout(_focusDebounceTimer);
  _focusDebounceTimer  = null;
});

// Affichage initial du compteur
(function() {
  const name = localStorage.getItem('playerName') || '';
  const counter = $('libs-counter');
  if (counter) counter.classList.toggle('hidden', !name || name === 'Anonyme');
  const balEl = $('libs-balance');
  if (balEl) balEl.textContent = libsBalance;
})();

// ── Cosmétiques : helpers CSS ─────────────────────────────────────────────────
function _cosmeticClass(cosmetic) {
  const valid = ['rainbow','galaxy','silver','bronze','gold','diamond'];
  return cosmetic && valid.includes(cosmetic) ? `name-${cosmetic}` : '';
}

function _fontClass(font) {
  const valid = ['font-orbitron','font-rajdhani','font-chakra','font-audiowide','font-exo2',
    'font-bungee','font-blackops','font-russo','font-pressstart','font-vt323',
    'font-sharetech','font-majormono','font-cinzel','font-tektur',
    'font-pacifico','font-lobster','font-fredoka','font-monoton'];
  return font && valid.includes(font) ? font : '';
}

function _nameEffectClass(nameEffect) {
  const valid = ['nameeffect-blink','nameeffect-pulse','nameeffect-gradient',
    'nameeffect-sparks','nameeffect-glitch','nameeffect-rainbow'];
  return nameEffect && valid.includes(nameEffect) ? nameEffect : '';
}

const TITLE_TEXTS = {
  'title-strategist':'Le Stratège','title-quizmaster':'Quiz Master','title-snakeking':'Roi du Snake',
  'title-champion':'Champion','title-legend':'Légende Vivante','title-tactician':'Tacticien','title-undefeated':'Invaincu',
};
function _titleHtml(title, ht) {
  let html = '';
  if (title) { const tn = t().shopTitleNames?.[title]; if (tn) html += `<span class="player-title-tag">${tn}</span>`; }
  if (ht) {
    const htNames = t().honorTitleNames;
    const name = (htNames && htNames[ht]) ? htNames[ht] : ht;
    html += `<span class="player-honor-tag">${name}</span>`;
  }
  return html;
}

function _showHonorModal(honorId) {
  const overlay = $('overlay-honor-reward');
  if (!overlay) return;
  const d = t();
  const titleName = (d.honorTitleNames && d.honorTitleNames[honorId]) ? d.honorTitleNames[honorId] : honorId;
  const titleEl = $('honor-reward-title');
  const msgEl   = $('honor-reward-msg');
  const btnEl   = $('btn-honor-reward-accept');
  if (titleEl) titleEl.textContent = d.honorModalTitle || '';
  if (msgEl)   msgEl.innerHTML = d.honorModalMsg ? d.honorModalMsg(titleName) : '';
  if (btnEl)   btnEl.textContent = d.honorModalBtn || 'OK';
  overlay.classList.remove('hidden');
}

// ── Libs : boost indice quiz ──────────────────────────────────────────────────
function _updateBoostHintBtn() {
  const btn = $('btn-boost-hint');
  if (!btn) return;
  btn.textContent = `${t().boostHintBtn} (${pendingHintCharges})`;
  if (pendingHintCharges > 0) {
    btn.classList.remove('hidden');
    btn.disabled = hintsUsedThisQ >= 2;
  } else {
    btn.classList.add('hidden');
  }
}

$('btn-boost-hint').addEventListener('click', () => {
  if (pendingHintCharges <= 0 || hintsUsedThisQ >= 2) return;
  hintsUsedThisQ++;
  _updateBoostHintBtn();
  if (triviaIsSolo) {
    socket.emit('use-boost-hint', { playerId: getPlayerId(), solo: true });
    const q = triviaQuestions[triviaCurrentQ];
    if (!q) return;
    const choices = $('tg-choices').querySelectorAll('.tg-choice:not([disabled])');
    const wrongs  = [...choices].filter(b => b.dataset.choice !== q.correct && !b.classList.contains('dimmed'));
    if (wrongs.length) {
      const target = wrongs[Math.floor(Math.random() * wrongs.length)];
      target.classList.add('dimmed'); target.disabled = true;
    }
  } else {
    socket.emit('use-boost-hint', { playerId: getPlayerId() });
  }
});

// ── Particules ─────────────────────────────────────────────────────────────────
const CLICK_FX_CONFIGS = {
  'clickfx-bubbles': {
    count:14, shapes: () => {
      const p = document.createElement('div');
      const sz = 6 + Math.random() * 8;
      const col = `hsl(${180+Math.random()*60|0},80%,${60+Math.random()*20|0}%)`;
      p.style.cssText = `border-radius:50%;width:${sz}px;height:${sz}px;border:2px solid ${col};background:transparent;`;
      return { el:p, dist:24+Math.random()*50, dur:500+Math.random()*400 };
    },
  },
  'clickfx-confetti': {
    count:20, shapes: () => {
      const p = document.createElement('div');
      const sz = 4+Math.random()*5; const h = 2+Math.random()*4;
      const col = `hsl(${Math.random()*360|0},90%,60%)`;
      p.style.cssText = `width:${sz}px;height:${h}px;background:${col};border-radius:1px;transform-origin:center;`;
      return { el:p, dist:30+Math.random()*70, dur:400+Math.random()*500 };
    },
  },
  'clickfx-neon': {
    count:18, shapes: () => {
      const p = document.createElement('div');
      const sz = 2+Math.random()*4;
      const col = ['#00ffff','#ff00ff','#ffff00','#00ff88'][Math.floor(Math.random()*4)];
      p.style.cssText = `border-radius:50%;width:${sz}px;height:${sz}px;background:${col};box-shadow:0 0 6px 2px ${col};`;
      return { el:p, dist:40+Math.random()*80, dur:350+Math.random()*350 };
    },
  },
  'clickfx-stars': {
    count:12, shapes: () => {
      const p = document.createElement('span');
      p.textContent = ['⭐','✨','🌟'][Math.floor(Math.random()*3)];
      p.style.cssText = `font-size:${10+Math.random()*10}px;line-height:1;`;
      return { el:p, dist:40+Math.random()*70, dur:500+Math.random()*400 };
    },
  },
  'clickfx-firework': {
    count:24, shapes: () => {
      const p = document.createElement('div');
      const sz = 3+Math.random()*4;
      const col = `hsl(${Math.random()*360|0},100%,${55+Math.random()*20|0}%)`;
      p.style.cssText = `border-radius:50%;width:${sz}px;height:${sz}px;background:${col};box-shadow:0 0 4px 1px ${col};`;
      return { el:p, dist:50+Math.random()*100, dur:450+Math.random()*550 };
    },
  },
};

function spawnParticles(x, y) {
  const cfg = CLICK_FX_CONFIGS[equippedClickFx];
  if (cfg) {
    for (let i = 0; i < cfg.count; i++) {
      const { el, dist, dur } = cfg.shapes();
      el.style.cssText += `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:9999;`;
      document.body.appendChild(el);
      const angle = (i / cfg.count) * Math.PI * 2 + Math.random() * 0.5;
      const tx = Math.cos(angle) * dist, ty = Math.sin(angle) * dist;
      el.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(0,.9,.57,1)', fill: 'forwards' }).onfinish = () => el.remove();
    }
    return;
  }
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

// ── Thème : adaptatif selon l'heure + bascule manuelle ───────────────────────
(function () {
  let lastLight = null;
  let clockTimer = null;

  function getIsLight() {
    const manual = localStorage.getItem('themeMode');
    if (manual === 'light') return true;
    if (manual === 'dark')  return false;
    const h = new Date().getHours();
    return h >= 7 && h < 20;
  }

  function applyTheme(showNotif = false, force = false) {
    const isLight = getIsLight();
    const changed = force || (lastLight !== null && isLight !== lastLight);
    document.documentElement.classList.toggle('light', isLight);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = isLight ? '☀️' : '🌙';
    if (showNotif && changed) {
      showThemeClock(isLight ? t().themeDay : t().themeNight);
    }
    if (changed && typeof equippedBackground !== 'undefined' && equippedBackground) {
      BGManager.start(equippedBackground);
    }
    lastLight = isLight;
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

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const isNowLight = !document.documentElement.classList.contains('light');
    localStorage.setItem('themeMode', isNowLight ? 'light' : 'dark');
    applyTheme(true, true); // force: toast + repaint immédiat du fond équipé
  });

  applyTheme(false);
  // Auto-update toutes les minutes uniquement si pas de préférence manuelle
  setInterval(() => { if (!localStorage.getItem('themeMode')) applyTheme(true); }, 60_000);
})();

// ── Serpent curseur ───────────────────────────────────────────────────────────
const cursorSnake = (() => {
  const MAX = 18, MIN = 4, GAP = 13, HEAD_SZ = 12, TAIL_SZ = 5;
  const _cpRaw = (() => { try { return JSON.parse(sessionStorage.getItem('libero_cursor_pos') || 'null'); } catch { return null; } })();
  let pendingRank = parseInt(localStorage.getItem('libero_cursor_rank') || '0', 10);
  let segs = [], mx = _cpRaw?.x ?? -999, my = _cpRaw?.y ?? -999, curHue = 140;
  let enabled = localStorage.getItem('snakeEnabled') !== 'false';
  let pendingLen = MIN;
  let _overrideMx = null, _overrideMy = null;
  let _flySpeed   = 0.18;
  let _hidden     = false;
  let _eventBonus = Math.min(8, Math.floor(parseInt(localStorage.getItem('libero_snake_event_hs') || '0', 10) / 2));

  function hueFor(rank) {
    return rank === 1 ? 48 : rank === 2 ? 205 : rank === 3 ? 22 : 140;
  }
  curHue = hueFor(pendingRank);

  const CURSOR_SNAKE_SKINS = {
    'cursorsnake-neon':     (p) => ({ bg:`hsl(180,100%,${(60-p*20).toFixed(0)}%)`,    shadow:'0 0 10px 4px #00ffff' }),
    'cursorsnake-fire':     (p) => ({ bg:`hsl(${(30-p*20).toFixed(0)},100%,${(55-p*15).toFixed(0)}%)`, shadow:'0 0 10px 4px #ff4400' }),
    'cursorsnake-comet':    (p) => ({ bg:`hsl(240,${(90-p*30).toFixed(0)}%,${(75-p*25).toFixed(0)}%)`, shadow: p===0?'0 0 12px 5px #8080ff':'' }),
    'cursorsnake-electric': (p) => ({ bg:`hsl(${(60+p*60).toFixed(0)},100%,${(65-p*20).toFixed(0)}%)`, shadow:'0 0 8px 3px #ffff00' }),
    'cursorsnake-stars':    (p) => ({ bg:`hsl(${(200+p*120).toFixed(0)},80%,${(80-p*30).toFixed(0)}%)`, shadow: p===0?'0 0 12px 5px #ffffffaa':'' }),
    'cursorsnake-pixel':    (p) => ({ bg:`hsl(${(120+p*80).toFixed(0)},70%,${(50-p*15).toFixed(0)}%)`, shadow:'', radius:'2px' }),
  };

  function build(len, h) {
    segs.forEach(s => s.el.remove());
    segs = [];
    curHue = h;
    if (!enabled) return;
    const skin = CURSOR_SNAKE_SKINS[equippedCursorSnake];
    for (let i = 0; i < len; i++) {
      const p  = len > 1 ? i / (len - 1) : 0;
      const sz = HEAD_SZ - p * (HEAD_SZ - TAIL_SZ);
      const el = document.createElement('div');
      let bg, shadow, radius;
      if (skin) {
        const s = skin(p);
        bg = s.bg; shadow = s.shadow || ''; radius = s.radius || '50%';
      } else {
        bg = `hsl(${h},${(80 - p * 20).toFixed(0)}%,${(58 - p * 22).toFixed(0)}%)`;
        shadow = i === 0 ? `0 0 8px 3px hsl(${h},80%,65%)` : '';
        radius = '50%';
      }
      el.style.cssText =
        `position:fixed;border-radius:${radius};pointer-events:none;user-select:none;` +
        `z-index:${999 - i};transform:translate(-50%,-50%);` +
        `width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;` +
        `background:${bg};` +
        `opacity:${(1 - p * 0.82).toFixed(2)};` +
        (shadow ? `box-shadow:${shadow};` : '');
      document.body.appendChild(el);
      segs.push({ el, x: mx, y: my });
    }
  }

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0]; mx = t.clientX; my = t.clientY;
  }, { passive: true });

  (function tick() {
    if (segs.length) {
      const _tx = _overrideMx !== null ? _overrideMx : mx;
      const _ty = _overrideMy !== null ? _overrideMy : my;
      segs[0].x += (_tx - segs[0].x) * _flySpeed;
      segs[0].y += (_ty - segs[0].y) * _flySpeed;
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

  build(Math.min(MAX, Math.max(MIN, MIN + _eventBonus)), curHue);

  // Met à jour le bouton flottant pour refléter l'état
  function syncBtn() {
    const btn = document.getElementById('btn-snake-toggle');
    if (btn) btn.classList.toggle('off', !enabled);
  }
  syncBtn();

  window.addEventListener('beforeunload', () => {
    if (mx > -900 && my > -900) sessionStorage.setItem('libero_cursor_pos', JSON.stringify({ x: mx, y: my }));
  });

  return {
    update(len, rank) {
      pendingLen = len; pendingRank = rank;
      localStorage.setItem('libero_cursor_rank', String(rank));
      if (!enabled || _hidden) return;
      const h = hueFor(rank);
      const n = Math.min(MAX, Math.max(MIN, len + _eventBonus));
      if (n !== segs.length || h !== curHue) build(n, h);
    },
    toggle() {
      enabled = !enabled;
      localStorage.setItem('snakeEnabled', enabled);
      if (enabled) {
        build(Math.min(MAX, Math.max(MIN, pendingLen + _eventBonus)), hueFor(pendingRank));
      } else {
        segs.forEach(s => s.el.remove());
        segs = [];
      }
      syncBtn();
      return enabled;
    },
    flyTo(x, y, cb) {
      _overrideMx = x; _overrideMy = y;
      _flySpeed   = 0.28;
      let tries = 0;
      const check = setInterval(() => {
        tries++;
        const close = segs.length > 0 && Math.hypot(segs[0].x - x, segs[0].y - y) < 28;
        if (tries > 60 || close) {
          clearInterval(check);
          _overrideMx = null; _overrideMy = null;
          _flySpeed   = 0.18;
          if (cb) cb();
        }
      }, 50);
    },
    hide() {
      _hidden = true;
      segs.forEach(s => { s.el.style.transition = 'opacity .3s'; s.el.style.opacity = '0'; });
    },
    show() {
      _hidden = false;
      if (!enabled) return;
      const n = Math.min(MAX, Math.max(MIN, pendingLen + _eventBonus));
      build(n, hueFor(pendingRank));
    },
    setBonus(eventHs) {
      _eventBonus = Math.min(8, Math.floor(eventHs / 2));
      if (!_hidden && enabled) {
        const n = Math.min(MAX, Math.max(MIN, pendingLen + _eventBonus));
        const h = hueFor(pendingRank);
        if (n !== segs.length || h !== curHue) build(n, h);
      }
    },
    getHue() { return curHue; },
    refreshSkin() {
      if (!enabled || _hidden) return;
      const n = Math.min(MAX, Math.max(MIN, pendingLen + _eventBonus));
      build(n, hueFor(pendingRank));
    },
  };
})();

document.getElementById('btn-snake-toggle').addEventListener('click', () => {
  cursorSnake.toggle();
});

// ── Évents : Snake Challenge ──────────────────────────────────────────────────
(function () {
  const HS_KEY         = 'libero_snake_event_hs';
  const SNAKE_SESS_KEY = 'libero_snake_session';
  const COLS = 20, ROWS = 20;
  let CELL = 15;

  let canvas, ctx, gameLoop;
  let snake, dir, nextDir, food, score, running, paused;

  function saveSnakeSession() {
    if (!running) return;
    sessionStorage.setItem(SNAKE_SESS_KEY, JSON.stringify({ snake, dir, nextDir, food, score }));
  }
  function clearSnakeSession() { sessionStorage.removeItem(SNAKE_SESS_KEY); }

  function updateSpeed() {
    clearInterval(gameLoop);
    const interval = Math.max(75, 180 - Math.floor(score / 5) * 15);
    gameLoop = setInterval(tick, interval);
  }

  function getHs()   { return parseInt(localStorage.getItem(HS_KEY) || '0', 10); }
  function saveHs(n) {
    if (n > getHs()) {
      localStorage.setItem(HS_KEY, String(n));
      cursorSnake.setBonus(n);
      const name = localStorage.getItem('playerName');
      if (name) socket.emit('submit-snake-score', { name, hs: n, playerId: getPlayerId() });
    }
  }

  function updateHsDisplay() {
    const el = document.getElementById('event-hs-display');
    if (!el) return;
    const h = getHs();
    el.textContent = h > 0 ? t().snakeHsDisplay(h) : '';
  }

  function rndFood() {
    let p;
    do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
    while (snake.some(s => s.x === p.x && s.y === p.y));
    return p;
  }

  function startGame() {
    clearSnakeSession();
    canvas = document.getElementById('snake-canvas');
    ctx    = canvas.getContext('2d');
    CELL   = window.innerWidth > 600 ? 21 : 15;
    canvas.width  = COLS * CELL;
    canvas.height = ROWS * CELL;
    const hud = document.querySelector('.snake-hud');
    if (hud) hud.style.width = `${COLS * CELL}px`;
    snake  = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir    = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    food   = rndFood();
    score  = 0;
    running = true;
    paused  = false;
    document.getElementById('snake-score-val').textContent = 0;
    document.getElementById('snake-hs-val').textContent    = getHs();
    document.getElementById('snake-over-overlay').classList.add('hidden');
    document.getElementById('snake-pause-overlay').classList.add('hidden');
    updateSpeed();
    draw();
  }

  function tick() {
    if (!running) return;
    dir = { ...nextDir };
    const head = {
      x: ((snake[0].x + dir.x) % COLS + COLS) % COLS,
      y: ((snake[0].y + dir.y) % ROWS + ROWS) % ROWS,
    };
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame(); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      SFX.snakeEat();
      saveHs(score);
      document.getElementById('snake-score-val').textContent = score;
      document.getElementById('snake-hs-val').textContent = Math.max(score, getHs());
      food = rndFood();
      updateSpeed();
    } else {
      snake.pop();
    }
    draw();
  }

  const SNAKE_SKINS = {
    'snakeskin-rainbow': { bg:(t,p)=>`hsla(${(t*120+p*180)%360},90%,${60-p*20}%,${1-p*0.6})`, food:'💎', boardBg:'#0a0a20', glow:(t)=>`hsl(${t*120%360},80%,60%)` },
    'snakeskin-lava':    { bg:(_t,p)=>`hsla(${20-p*15},100%,${55-p*20}%,${1-p*0.55})`,          food:'🔥', boardBg:'#1a0a00', glow:()=>'#ff4400' },
    'snakeskin-cyber':   { bg:(_t,p)=>`hsla(180,100%,${55-p*25}%,${1-p*0.6})`,                  food:'⬡',  boardBg:'#001a1a', glow:()=>'#00ffff', square:true },
    'snakeskin-galaxy':  { bg:(_t,p)=>`hsla(${260+p*40},80%,${55-p*20}%,${1-p*0.55})`,          food:'⭐', boardBg:'#05001a', glow:()=>'#9966ff' },
    'snakeskin-gems':    { bg:(_t,p)=>`hsla(${140+p*80},70%,${58-p*18}%,${1-p*0.5})`,           food:'💎', boardBg:'#001a0a', glow:()=>'#00ff88' },
  };
  let _skinTick = 0;

  function draw() {
    if (!ctx) return;
    const hue = cursorSnake.getHue();
    const skin = SNAKE_SKINS[equippedSnakeSkin];
    _skinTick = (_skinTick + 1) % 360;

    ctx.fillStyle = skin ? skin.boardBg : '#0f0f1a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grille subtile
    ctx.strokeStyle = skin ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(COLS * CELL, j * CELL); ctx.stroke();
    }

    // Pomme / food
    const foodEmoji = skin ? skin.food : '🍎';
    ctx.font = `${CELL}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(foodEmoji, (food.x + 0.5) * CELL, (food.y + 0.5) * CELL);

    // Serpent
    snake.forEach((seg, i) => {
      const p  = snake.length > 1 ? i / (snake.length - 1) : 0;
      const r = CELL * (i === 0 ? 0.42 : (skin?.square ? 0.1 : 0.35));
      const x = seg.x * CELL + CELL * 0.1;
      const y = seg.y * CELL + CELL * 0.1;
      const w = CELL * 0.8, h = CELL * 0.8;
      if (skin) {
        ctx.fillStyle = skin.bg(_skinTick, p);
        if (i === 0) { ctx.shadowColor = skin.glow(_skinTick); ctx.shadowBlur = 10; }
      } else {
        const l = Math.round(58 - p * 22), s = Math.round(80 - p * 20), a = (1 - p * 0.6).toFixed(2);
        ctx.fillStyle = `hsla(${hue},${s}%,${l}%,${a})`;
        if (i === 0) { ctx.shadowColor = `hsl(${hue},80%,65%)`; ctx.shadowBlur = 7; }
      }
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      if (i === 0) ctx.shadowBlur = 0;
    });
  }

  function endGame() {
    running = false;
    clearInterval(gameLoop);
    SFX.snakeOver();
    clearSnakeSession();
    const isNewHs = score > getHs();
    saveHs(score);
    // Enregistre la participation même si score=0 (premier jeu sans pomme)
    const _snakeName = localStorage.getItem('playerName');
    if (_snakeName && getHs() === 0) socket.emit('submit-snake-score', { name: _snakeName, hs: 0, playerId: getPlayerId() });
    const newHsEl = document.getElementById('snake-new-hs');
    if (newHsEl) newHsEl.classList.toggle('hidden', !isNewHs);
    document.getElementById('snake-over-score').textContent = t().snakeOverScore(score, getHs());
    document.getElementById('snake-over-overlay').classList.remove('hidden');
  }

  // Contrôles D-pad mobile
  const _dpadMap = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  };
  ['up', 'down', 'left', 'right'].forEach(d => {
    document.getElementById(`dpad-${d}`)?.addEventListener('touchstart', e => {
      e.preventDefault();
      if (!running || paused) return;
      const nd = _dpadMap[d];
      if (nd.x !== -dir.x || nd.y !== -dir.y) nextDir = nd;
    }, { passive: false });
  });

  // Contrôles clavier
  document.addEventListener('keydown', e => {
    if (!running || paused) return;
    const map = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    };
    const nd = map[e.key];
    if (nd && (nd.x !== -dir.x || nd.y !== -dir.y)) {
      nextDir = nd;
      if (e.key.startsWith('Arrow')) e.preventDefault();
    }
  });

  // Contrôles tactiles (swipe)
  let _ts = null;
  document.addEventListener('touchstart', e => {
    if (!running) return;
    _ts = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!running || !_ts) return;
    const dx = e.changedTouches[0].clientX - _ts.x;
    const dy = e.changedTouches[0].clientY - _ts.y;
    _ts = null;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    let nd;
    if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else                              nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    if (nd.x !== -dir.x || nd.y !== -dir.y) nextDir = nd;
  }, { passive: true });

  // Navigation
  document.getElementById('btn-go-events')?.addEventListener('click', () => {
    showScreen('events');
    updateHsDisplay();
    socket.emit('get-snake-leaderboard');
  });

  function showEventIntro() {
    document.getElementById('snake-game-wrap').classList.add('hidden');
    document.getElementById('snake-name-form').classList.add('hidden');
    document.getElementById('event-intro').classList.remove('hidden');
    document.getElementById('snake-lb-card').classList.remove('hidden');
  }

  document.getElementById('btn-back-events')?.addEventListener('click', () => {
    clearInterval(gameLoop);
    running = false;
    clearSnakeSession();
    showEventIntro();
    cursorSnake.show();
    showScreen('landing');
  });

  function launchSnakeGame() {
    const _hs = getHs(), _name = localStorage.getItem('playerName');
    if (_hs > 0 && _name) socket.emit('submit-snake-score', { name: _name, hs: _hs, playerId: getPlayerId() });

    document.getElementById('event-intro').classList.add('hidden');
    document.getElementById('snake-lb-card').classList.add('hidden');
    const gameWrap = document.getElementById('snake-game-wrap');
    gameWrap.classList.remove('hidden');
    requestAnimationFrame(() => {
      const c  = document.getElementById('snake-canvas');
      const r  = c.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      cursorSnake.flyTo(cx, cy, () => {
        cursorSnake.hide();
        setTimeout(startGame, 120);
      });
    });
  }

  document.getElementById('btn-event-play')?.addEventListener('click', () => {
    const name = (localStorage.getItem('playerName') || '').trim();
    if (!name) {
      document.getElementById('event-intro').classList.add('hidden');
      document.getElementById('snake-lb-card').classList.add('hidden');
      const input = document.getElementById('snake-pseudo-input');
      document.getElementById('snake-name-form').classList.remove('hidden');
      document.getElementById('snake-name-error').classList.add('hidden');
      input.value = '';
      input.focus();
      return;
    }
    launchSnakeGame();
  });

  document.getElementById('btn-snake-confirm-name')?.addEventListener('click', () => {
    const input = document.getElementById('snake-pseudo-input');
    const val   = input.value.trim();
    if (!val) {
      document.getElementById('snake-name-error').classList.remove('hidden');
      input.focus();
      return;
    }
    localStorage.setItem('playerName', val);
    const n = $('input-name');        if (n)  n.value  = val;
    const tn = $('input-trivia-name'); if (tn) tn.value = val;
    const counter = $('libs-counter');
    if (counter) counter.classList.toggle('hidden', !val || val === 'Anonyme');
    socket.emit('get-libs', { playerId: getPlayerId() });
    document.getElementById('snake-name-form').classList.add('hidden');
    launchSnakeGame();
  });

  document.getElementById('snake-pseudo-input')?.addEventListener('input', (e) => {
    checkPseudo(e.target.value.trim(), 'snake-pseudo-warning');
  });
  document.getElementById('snake-pseudo-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-snake-confirm-name')?.click();
  });

  document.getElementById('btn-snake-cancel-name')?.addEventListener('click', () => {
    showEventIntro();
  });

  document.getElementById('btn-snake-restart')?.addEventListener('click', startGame);

  document.getElementById('btn-snake-quit')?.addEventListener('click', () => {
    clearInterval(gameLoop);
    running = false;
    clearSnakeSession();
    showEventIntro();
    cursorSnake.show();
    updateHsDisplay();
    socket.emit('get-snake-leaderboard');
  });

  // ── Pause ─────────────────────────────────────────────────────────────────
  function togglePause() {
    if (!running) return;
    paused = !paused;
    const overlay = document.getElementById('snake-pause-overlay');
    const btn     = document.getElementById('btn-snake-pause');
    if (paused) {
      clearInterval(gameLoop);
      overlay.classList.remove('hidden');
      btn.textContent = '▶';
    } else {
      overlay.classList.add('hidden');
      btn.textContent = '⏸';
      updateSpeed();
    }
  }

  document.getElementById('btn-snake-pause')?.addEventListener('click', togglePause);
  document.getElementById('btn-snake-resume')?.addEventListener('click', togglePause);

  document.getElementById('btn-snake-pause-quit-events')?.addEventListener('click', () => {
    clearInterval(gameLoop);
    running = false;
    paused  = false;
    clearSnakeSession();
    document.getElementById('snake-pause-overlay').classList.add('hidden');
    showEventIntro();
    cursorSnake.show();
    updateHsDisplay();
    socket.emit('get-snake-leaderboard');
  });

  document.getElementById('btn-snake-pause-quit-home')?.addEventListener('click', () => {
    clearInterval(gameLoop);
    running = false;
    paused  = false;
    clearSnakeSession();
    document.getElementById('snake-pause-overlay').classList.add('hidden');
    showEventIntro();
    cursorSnake.show();
    showScreen('landing');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  });

  // Sauvegarde l'état avant refresh
  window.addEventListener('beforeunload', () => { if (running) saveSnakeSession(); });

  // Restauration après refresh (si une partie était en cours)
  (function() {
    const saved = sessionStorage.getItem(SNAKE_SESS_KEY);
    if (!saved || sessionStorage.getItem('libero_screen') !== 'events') {
      if (saved) clearSnakeSession();
      return;
    }
    try {
      const data = JSON.parse(saved);
      if (!Array.isArray(data.snake) || !data.food || data.score === undefined) throw new Error();
      canvas = document.getElementById('snake-canvas');
      ctx    = canvas.getContext('2d');
      CELL   = window.innerWidth > 600 ? 21 : 15;
      canvas.width  = COLS * CELL;
      canvas.height = ROWS * CELL;
      const hud = document.querySelector('.snake-hud');
      if (hud) hud.style.width = `${COLS * CELL}px`;
      snake   = data.snake;
      dir     = data.dir;
      nextDir = data.nextDir;
      food    = data.food;
      score   = data.score;
      running = true;
      paused  = true;
      document.getElementById('snake-score-val').textContent = score;
      document.getElementById('snake-hs-val').textContent    = getHs();
      document.getElementById('event-intro').classList.add('hidden');
      document.getElementById('snake-lb-card').classList.add('hidden');
      document.getElementById('snake-over-overlay').classList.add('hidden');
      document.getElementById('snake-game-wrap').classList.remove('hidden');
      document.getElementById('snake-pause-overlay').classList.remove('hidden');
      document.getElementById('btn-snake-pause').textContent = '▶';
      cursorSnake.hide();
      draw();
    } catch {
      clearSnakeSession();
    }
  })();
})();

// ── Luffy Runner (jeu communautaire) ────────────────────────────────────────
(() => {
  const HS_KEY   = 'libero_luffy_hs';
  const SESS_KEY = 'libero_luffy_session';

  // Tout le jeu se simule dans un repère logique fixe 600×220, mis à l'échelle
  // au dessin selon la taille réelle du canvas (cf. resizeCanvas / draw).
  const REF_W = 600, REF_H = 220;
  const GROUND_Y   = 190;
  const GRAVITY    = 2400;
  const JUMP_VEL   = 760;
  const LUFFY_X    = 60;
  const STAND_W = 40, STAND_H = 62;
  const DUCK_W  = 54, DUCK_H  = 32;
  const BASE_SPEED = 260, MAX_SPEED = 560, SPEED_PER_POINT = 0.21; // px/s logiques par point de score
  const FLY_MIN_SCORE = 200;

  let canvas, ctx, raf, lastT, scale = 1;
  let running = false, paused = false;
  let distance, speed, score, hsShown;
  let luffyY, luffyVy, jumping, ducking;
  let obstacles, nextSpawnDist, lastSpawnType;
  let invincibleUntil, nextPowerupDist, airshipX, airshipY;

  // ── Sprites (pixel art) ──────────────────────────────────────────────────
  const SPRITE_DIR = 'luffy-sprites/';
  function loadSprite(name) { const img = new Image(); img.src = SPRITE_DIR + name; return img; }
  const RUN_FRAMES = [1, 2, 3, 4].map(n => loadSprite(`luffy-run-${n}.png`));
  const SPR = {
    canon:        loadSprite('canon.png'),
    boulet:       loadSprite('boulet-canon.png'),
    tonneauP:     loadSprite('tonneau-powerup.png'),
    rocher:       loadSprite('rocher.png'),
    recif:        loadSprite('recif.png'),
    crabe:        loadSprite('crabe.png'),
    meduse:       loadSprite('meduse.png'),
    dendenmushi:  loadSprite('dendenmushi.png'),
    tonneau:      loadSprite('tonneau.png'),
    dirigeable:   loadSprite('dirigeable.png'),
    marine1:      loadSprite('marine-1.png'),
    marine2:      loadSprite('marine-2.png'),
    mouette:      loadSprite('mouette.png'),
    oiseau:       loadSprite('oiseau.png'),
    marineAigle:  loadSprite('marine-aigle.png'),
  };

  function getHs()   { return parseInt(localStorage.getItem(HS_KEY) || '0', 10); }
  function saveHs(n) {
    if (n > getHs()) {
      localStorage.setItem(HS_KEY, String(n));
      const name = localStorage.getItem('playerName');
      if (name) socket.emit('submit-luffy-score', { name, hs: n, playerId: getPlayerId() });
    }
  }
  function updateHsDisplay() {
    const el = document.getElementById('luffy-hs-display');
    if (!el) return;
    const h = getHs();
    el.textContent = h > 0 ? t().luffyHsDisplay(h) : '';
  }

  // ── Obstacles ────────────────────────────────────────────────────────────
  function drawSprite(c, img, x, y, w, h, flip, filter) {
    if (!img.complete || !img.naturalWidth) return;
    c.save();
    if (filter) c.filter = filter;
    if (flip) {
      c.translate(x + w, y);
      c.scale(-1, 1);
      c.drawImage(img, 0, 0, w, h);
    } else {
      c.drawImage(img, x, y, w, h);
    }
    c.restore();
  }

  // w/h calculés à partir du ratio naturel de chaque sprite pour éviter toute déformation.
  const GROUND_OBS = [
    { id: 'tonneau',     w: 25, h: 30, draw: (c, x, y, w, h) => drawSprite(c, SPR.tonneau, x, y, w, h, false) },
    { id: 'baril',       w: 25, h: 30, draw: (c, x, y, w, h) => drawSprite(c, SPR.tonneau, x, y, w, h, false, 'hue-rotate(160deg) brightness(.7)') },
    { id: 'canon',       w: 63, h: 30, draw: (c, x, y, w, h) => drawSprite(c, SPR.canon, x, y, w, h, true) },
    { id: 'rocher',      w: 36, h: 28, draw: (c, x, y, w, h) => drawSprite(c, SPR.rocher, x, y, w, h, false) },
    { id: 'recif',       w: 35, h: 28, draw: (c, x, y, w, h) => drawSprite(c, SPR.recif, x, y, w, h, false) },
    { id: 'crabe',       w: 32, h: 20, draw: (c, x, y, w, h) => drawSprite(c, SPR.crabe, x, y, w, h, false) },
    { id: 'meduse',      w: 32, h: 24, draw: (c, x, y, w, h) => drawSprite(c, SPR.meduse, x, y, w, h, false) },
    { id: 'dendenmushi', w: 23, h: 20, draw: (c, x, y, w, h) => drawSprite(c, SPR.dendenmushi, x, y, w, h, false) },
    { id: 'marine1',     w: 32, h: 40, draw: (c, x, y, w, h) => drawSprite(c, SPR.marine1, x, y, w, h, true) },
    { id: 'marine2',     w: 38, h: 40, draw: (c, x, y, w, h) => drawSprite(c, SPR.marine2, x, y, w, h, true) },
  ];
  const FLY_OBS = [
    { id: 'mouette',      w: 34, h: 16, draw: (c, x, y, w, h) => drawSprite(c, SPR.mouette, x, y, w, h, true) },
    { id: 'oiseau',       w: 26, h: 20, draw: (c, x, y, w, h) => drawSprite(c, SPR.oiseau, x, y, w, h, true) },
    { id: 'boulet',       w: 22, h: 21, draw: (c, x, y, w, h) => drawSprite(c, SPR.boulet, x, y, w, h, false) },
    { id: 'marineoiseau', w: 42, h: 35, draw: (c, x, y, w, h) => drawSprite(c, SPR.marineAigle, x, y, w, h, true) },
  ];
  const POWERUP_DEF = { id: 'tonneauP', w: 25, h: 30, draw: (c, x, y, w, h) => drawSprite(c, SPR.tonneauP, x, y, w, h, false) };
  const ALL_DEFS = {};
  [...GROUND_OBS, ...FLY_OBS, POWERUP_DEF].forEach(d => { ALL_DEFS[d.id] = d; });
  const FLY_TOP = GROUND_Y - 60, FLY_H = 22; // bande basse : oblige à s'accroupir
  const INVINCIBILITY_MS = 6000;

  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnObstacle() {
    const kind = score >= FLY_MIN_SCORE && Math.random() < 0.4 ? 'fly' : 'ground';
    const def = kind === 'fly' ? rnd(FLY_OBS) : rnd(GROUND_OBS);
    const sameType = lastSpawnType === kind;
    const gapSeconds = (lastSpawnType === null)
      ? 1.4
      : (sameType ? 1.1 + Math.random() * 0.7 : 1.8 + Math.random() * 0.8);
    nextSpawnDist = distance + speed * gapSeconds;
    obstacles.push({
      def, kind,
      arriveDist: distance + (REF_W - LUFFY_X), // distance à laquelle l'obstacle atteint Luffy
    });
    lastSpawnType = kind;
  }

  function spawnPowerup() {
    nextPowerupDist = distance + speed * (18 + Math.random() * 14);
    obstacles.push({ def: POWERUP_DEF, kind: 'powerup', arriveDist: distance + (REF_W - LUFFY_X) });
  }

  function obstacleX(o) {
    return LUFFY_X + (o.arriveDist - distance);
  }

  function resetAirship() {
    airshipX = REF_W + Math.random() * 150;
    airshipY = 20 + Math.random() * 28;
  }

  // ── Boucle de jeu ──────────────────────────────────────────────────────
  function resizeCanvas() {
    const maxW = Math.min(REF_W, window.innerWidth - 32);
    canvas.width  = Math.round(maxW);
    canvas.height = Math.round(maxW * REF_H / REF_W);
    scale = canvas.width / REF_W;
  }

  function luffyBox() {
    if (jumping) {
      return { x: LUFFY_X, w: STAND_W, top: GROUND_Y - luffyY - STAND_H, bottom: GROUND_Y - luffyY };
    }
    if (ducking) {
      return { x: LUFFY_X, w: DUCK_W, top: GROUND_Y - DUCK_H, bottom: GROUND_Y };
    }
    return { x: LUFFY_X, w: STAND_W, top: GROUND_Y - STAND_H, bottom: GROUND_Y };
  }

  function checkPowerupPickup() {
    const lb = luffyBox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.kind !== 'powerup') continue;
      const x = obstacleX(o), w = o.def.w, h = o.def.h;
      const oTop = GROUND_Y - h, oBottom = GROUND_Y;
      const overlapX = x < lb.x + lb.w && x + w > lb.x;
      const overlapY = oTop < lb.bottom && oBottom > lb.top;
      if (overlapX && overlapY) {
        obstacles.splice(i, 1);
        invincibleUntil = performance.now() + INVINCIBILITY_MS;
        SFX.quizOk();
      }
    }
  }

  function checkHazardCollision() {
    const lb = luffyBox();
    for (const o of obstacles) {
      if (o.kind === 'powerup') continue;
      const x = obstacleX(o);
      const w = o.def.w;
      const oTop = o.kind === 'fly' ? FLY_TOP : GROUND_Y - o.def.h;
      const oBottom = o.kind === 'fly' ? FLY_TOP + FLY_H : GROUND_Y;
      const overlapX = x < lb.x + lb.w && x + w > lb.x;
      const overlapY = oTop < lb.bottom && oBottom > lb.top;
      if (overlapX && overlapY) return true;
    }
    return false;
  }

  function update(dt, now) {
    distance += speed * dt;
    score = Math.floor(distance / 8);
    speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_PER_POINT);

    if (jumping) {
      luffyY += luffyVy * dt;
      luffyVy -= GRAVITY * dt;
      if (luffyY <= 0) { luffyY = 0; luffyVy = 0; jumping = false; }
    }

    airshipX -= 18 * dt; // décor de fond, vitesse de parallaxe indépendante du jeu
    if (airshipX < -100) resetAirship();

    if (distance >= nextSpawnDist) spawnObstacle();
    if (distance >= nextPowerupDist) spawnPowerup();
    obstacles = obstacles.filter(o => obstacleX(o) > -90);

    checkPowerupPickup();

    const invincible = now < invincibleUntil;
    if (!invincible && checkHazardCollision()) { endGame(); return; }

    const sv = document.getElementById('luffy-score-val');
    if (sv) sv.textContent = score;
    if (score > hsShown) {
      hsShown = score;
      const hv = document.getElementById('luffy-hs-val'); if (hv) hv.textContent = hsShown;
    }
  }

  function drawGround(c) {
    c.fillStyle = '#1a2a1a';
    c.fillRect(0, GROUND_Y, REF_W, REF_H - GROUND_Y);
    c.strokeStyle = 'rgba(255,255,255,.18)';
    c.lineWidth = 2;
    const tickOffset = -(distance % 24);
    for (let x = tickOffset; x < REF_W; x += 24) {
      c.beginPath(); c.moveTo(x, GROUND_Y + 1); c.lineTo(x + 12, GROUND_Y + 1); c.stroke();
    }
  }

  function drawClouds(c) {
    c.fillStyle = 'rgba(255,255,255,.55)';
    const cloudOffset = -(distance * 0.25 % 260);
    for (let i = 0; i < 3; i++) {
      const cx = cloudOffset + i * 220 + 40;
      const cy = 36 + (i % 2) * 18;
      [0, 16, 32].forEach((dx, j) => {
        c.beginPath(); c.arc(cx + dx, cy - (j === 1 ? 6 : 0), 13, 0, Math.PI * 2); c.fill();
      });
    }
  }

  const RUN_FRAME_DIST = 18; // distance logique entre deux frames de course
  function currentRunFrame() {
    return RUN_FRAMES[Math.floor(distance / RUN_FRAME_DIST) % RUN_FRAMES.length];
  }

  function drawLuffy(c, now) {
    const lb = luffyBox();
    const img = jumping ? RUN_FRAMES[1] : ducking ? RUN_FRAMES[2] : currentRunFrame();
    c.save();
    if (now < invincibleUntil) {
      c.globalAlpha = 0.55 + 0.45 * Math.sin(now / 60);
      c.shadowColor = '#ffd23f';
      c.shadowBlur = 14;
    }
    if (img.complete && img.naturalWidth) {
      const h = lb.bottom - lb.top;
      const w = h * img.naturalWidth / img.naturalHeight;
      const cx = lb.x + lb.w / 2;
      c.drawImage(img, cx - w / 2, lb.top, w, h);
    } else {
      c.fillStyle = '#c0392b';
      c.fillRect(lb.x, lb.top, lb.w, lb.bottom - lb.top);
    }
    c.restore();
  }

  function draw(now) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#7ec8e3'); sky.addColorStop(1, '#bfe8f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, REF_W, GROUND_Y);

    drawClouds(ctx);
    drawSprite(ctx, SPR.dirigeable, airshipX, airshipY, 70, 65, true); // décor de fond
    drawGround(ctx);
    drawLuffy(ctx, now);

    obstacles.forEach(o => {
      const x = obstacleX(o);
      if (o.kind === 'fly') {
        const h = o.def.h, w = o.def.w;
        const y = FLY_TOP + FLY_H / 2 - h / 2;
        o.def.draw(ctx, x, y, w, h);
      } else {
        o.def.draw(ctx, x, GROUND_Y - o.def.h, o.def.w, o.def.h);
      }
    });

    if (now < invincibleUntil) {
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('⭐ INVINCIBLE', REF_W / 2, 18);
      ctx.restore();
    }

    ctx.restore();
  }

  function frame(now) {
    if (!running || paused) return;
    const dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); // jamais négatif (sécurité timing)
    lastT = now;
    update(dt, now);
    if (!running) return; // endGame a pu être déclenché dans update()
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function saveLuffySession() {
    if (!running) return;
    sessionStorage.setItem(SESS_KEY, JSON.stringify({
      distance, speed, score,
      luffyY, luffyVy, jumping, ducking,
      obstacles: obstacles.map(o => ({ id: o.def.id, kind: o.kind, arriveDist: o.arriveDist })),
      nextSpawnDist, lastSpawnType,
    }));
  }
  function clearLuffySession() { sessionStorage.removeItem(SESS_KEY); }

  function startGame() {
    clearLuffySession();
    cancelAnimationFrame(raf); // évite toute boucle de jeu fantôme si startGame est rappelé trop vite (double-clic)
    canvas = document.getElementById('luffy-canvas');
    ctx    = canvas.getContext('2d');
    resizeCanvas();
    distance = 0; speed = BASE_SPEED; score = 0; hsShown = getHs();
    luffyY = 0; luffyVy = 0; jumping = false; ducking = false;
    obstacles = []; nextSpawnDist = 0; lastSpawnType = null;
    invincibleUntil = 0; nextPowerupDist = distance + speed * (14 + Math.random() * 10);
    resetAirship();
    running = true; paused = false;
    document.getElementById('luffy-score-val').textContent = 0;
    document.getElementById('luffy-hs-val').textContent    = getHs();
    document.getElementById('luffy-over-overlay').classList.add('hidden');
    document.getElementById('luffy-pause-overlay').classList.add('hidden');
    spawnObstacle();
    lastT = performance.now();
    draw(lastT);
    raf = requestAnimationFrame(frame);
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    SFX.snakeOver();
    const isNewHs = score > getHs();
    saveHs(score);
    const _name = localStorage.getItem('playerName');
    if (_name && getHs() === 0) socket.emit('submit-luffy-score', { name: _name, hs: 0, playerId: getPlayerId() });
    // Garde l'écran de fin de partie en mémoire : un refresh involontaire ici
    // doit retomber sur ce même écran plutôt que sur l'intro.
    sessionStorage.setItem(SESS_KEY, JSON.stringify({ gameOver: true, score, isNewHs }));
    const newHsEl = document.getElementById('luffy-new-hs');
    if (newHsEl) newHsEl.classList.toggle('hidden', !isNewHs);
    document.getElementById('luffy-over-score').textContent = t().snakeOverScore(score, getHs());
    document.getElementById('luffy-over-overlay').classList.remove('hidden');
    draw(performance.now());
  }

  // ── Contrôles ────────────────────────────────────────────────────────────
  function doJump() {
    if (!running || paused || jumping || ducking) return;
    jumping = true; luffyVy = JUMP_VEL;
  }
  function setDuck(v) {
    if (!running || paused || jumping) return;
    ducking = v;
  }

  document.addEventListener('keydown', e => {
    if (!running || paused) return;
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') { e.preventDefault(); doJump(); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); setDuck(true); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setDuck(false);
  });

  document.getElementById('luffy-btn-jump')?.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  document.getElementById('luffy-btn-jump')?.addEventListener('click', doJump);
  document.getElementById('luffy-btn-duck')?.addEventListener('touchstart', e => { e.preventDefault(); setDuck(true); }, { passive: false });
  document.getElementById('luffy-btn-duck')?.addEventListener('touchend',   e => { e.preventDefault(); setDuck(false); }, { passive: false });
  document.getElementById('luffy-btn-duck')?.addEventListener('mousedown', () => setDuck(true));
  document.getElementById('luffy-btn-duck')?.addEventListener('mouseup',   () => setDuck(false));

  // ── Navigation ───────────────────────────────────────────────────────────
  document.getElementById('btn-go-community')?.addEventListener('click', () => {
    showScreen('luffy');
    updateHsDisplay();
    socket.emit('get-luffy-leaderboard');
  });

  document.getElementById('btn-luffy-suggest')?.addEventListener('click', () => {
    document.getElementById('overlay-community')?.classList.remove('hidden');
  });

  function showLuffyIntro() {
    document.getElementById('luffy-game-wrap').classList.add('hidden');
    document.getElementById('luffy-name-form').classList.add('hidden');
    document.getElementById('luffy-intro').classList.remove('hidden');
    document.getElementById('luffy-lb-card').classList.remove('hidden');
  }

  document.getElementById('btn-back-luffy')?.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    running = false;
    clearLuffySession();
    showLuffyIntro();
    showScreen('landing');
  });

  function launchLuffyGame() {
    const _hs = getHs(), _name = localStorage.getItem('playerName');
    if (_hs > 0 && _name) socket.emit('submit-luffy-score', { name: _name, hs: _hs, playerId: getPlayerId() });
    document.getElementById('luffy-intro').classList.add('hidden');
    document.getElementById('luffy-lb-card').classList.add('hidden');
    document.getElementById('luffy-game-wrap').classList.remove('hidden');
    requestAnimationFrame(startGame);
  }

  document.getElementById('btn-luffy-play')?.addEventListener('click', () => {
    const name = (localStorage.getItem('playerName') || '').trim();
    if (!name) {
      document.getElementById('luffy-intro').classList.add('hidden');
      document.getElementById('luffy-lb-card').classList.add('hidden');
      const input = document.getElementById('luffy-pseudo-input');
      document.getElementById('luffy-name-form').classList.remove('hidden');
      document.getElementById('luffy-name-error').classList.add('hidden');
      input.value = '';
      input.focus();
      return;
    }
    launchLuffyGame();
  });

  document.getElementById('btn-luffy-confirm-name')?.addEventListener('click', () => {
    const input = document.getElementById('luffy-pseudo-input');
    const val   = input.value.trim();
    if (!val) {
      document.getElementById('luffy-name-error').classList.remove('hidden');
      input.focus();
      return;
    }
    localStorage.setItem('playerName', val);
    const n = $('input-name');        if (n)  n.value  = val;
    const tn = $('input-trivia-name'); if (tn) tn.value = val;
    const counter = $('libs-counter');
    if (counter) counter.classList.toggle('hidden', !val || val === 'Anonyme');
    socket.emit('get-libs', { playerId: getPlayerId() });
    document.getElementById('luffy-name-form').classList.add('hidden');
    launchLuffyGame();
  });

  document.getElementById('luffy-pseudo-input')?.addEventListener('input', (e) => {
    checkPseudo(e.target.value.trim(), 'luffy-pseudo-warning');
  });
  document.getElementById('luffy-pseudo-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-luffy-confirm-name')?.click();
  });

  document.getElementById('btn-luffy-cancel-name')?.addEventListener('click', () => {
    showLuffyIntro();
  });

  document.getElementById('btn-luffy-restart')?.addEventListener('click', startGame);

  document.getElementById('btn-luffy-quit')?.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    running = false;
    clearLuffySession();
    showLuffyIntro();
    updateHsDisplay();
    socket.emit('get-luffy-leaderboard');
  });

  // ── Pause ─────────────────────────────────────────────────────────────────
  function togglePause() {
    if (!running) return;
    paused = !paused;
    const overlay = document.getElementById('luffy-pause-overlay');
    const btn     = document.getElementById('btn-luffy-pause');
    if (paused) {
      cancelAnimationFrame(raf);
      overlay.classList.remove('hidden');
      btn.textContent = '▶';
    } else {
      overlay.classList.add('hidden');
      btn.textContent = '⏸';
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  document.getElementById('btn-luffy-pause')?.addEventListener('click', togglePause);
  document.getElementById('btn-luffy-resume')?.addEventListener('click', togglePause);

  document.getElementById('btn-luffy-pause-quit-luffy')?.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    running = false; paused = false;
    clearLuffySession();
    document.getElementById('luffy-pause-overlay').classList.add('hidden');
    showLuffyIntro();
    updateHsDisplay();
    socket.emit('get-luffy-leaderboard');
  });

  document.getElementById('btn-luffy-pause-quit-home')?.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    running = false; paused = false;
    clearLuffySession();
    document.getElementById('luffy-pause-overlay').classList.add('hidden');
    showLuffyIntro();
    showScreen('landing');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  });

  // Sauvegarde l'état avant un refresh/fermeture pendant une partie en cours
  window.addEventListener('beforeunload', () => { if (running) saveLuffySession(); });

  // Restauration après refresh (si une partie était en cours, en pause)
  (function() {
    const saved = sessionStorage.getItem(SESS_KEY);
    if (!saved || sessionStorage.getItem('libero_screen') !== 'luffy') {
      if (saved) clearLuffySession();
      return;
    }
    try {
      const data = JSON.parse(saved);
      canvas = document.getElementById('luffy-canvas');
      ctx    = canvas.getContext('2d');
      resizeCanvas();

      if (data.gameOver) {
        if (data.score === undefined) throw new Error();
        score = data.score; hsShown = getHs();
        distance = score * 8; speed = BASE_SPEED;
        luffyY = 0; luffyVy = 0; jumping = false; ducking = false;
        obstacles = []; nextSpawnDist = 0; lastSpawnType = null; invincibleUntil = 0;
        resetAirship();
        running = false; paused = false;
        document.getElementById('luffy-score-val').textContent = score;
        document.getElementById('luffy-hs-val').textContent    = getHs();
        document.getElementById('luffy-intro').classList.add('hidden');
        document.getElementById('luffy-lb-card').classList.add('hidden');
        document.getElementById('luffy-game-wrap').classList.remove('hidden');
        document.getElementById('luffy-pause-overlay').classList.add('hidden');
        const newHsEl = document.getElementById('luffy-new-hs');
        if (newHsEl) newHsEl.classList.toggle('hidden', !data.isNewHs);
        document.getElementById('luffy-over-score').textContent = t().snakeOverScore(score, getHs());
        document.getElementById('luffy-over-overlay').classList.remove('hidden');
        draw(performance.now());
        return;
      }

      if (!Array.isArray(data.obstacles) || data.score === undefined || data.distance === undefined) throw new Error();
      distance = data.distance; speed = data.speed; score = data.score; hsShown = getHs();
      luffyY = data.luffyY; luffyVy = data.luffyVy; jumping = data.jumping; ducking = data.ducking;
      obstacles = data.obstacles
        .map(o => ({ def: ALL_DEFS[o.id], kind: o.kind, arriveDist: o.arriveDist }))
        .filter(o => o.def);
      nextSpawnDist = data.nextSpawnDist; lastSpawnType = data.lastSpawnType;
      invincibleUntil = 0;
      resetAirship();
      running = true; paused = true;
      document.getElementById('luffy-score-val').textContent = score;
      document.getElementById('luffy-hs-val').textContent    = getHs();
      document.getElementById('luffy-intro').classList.add('hidden');
      document.getElementById('luffy-lb-card').classList.add('hidden');
      document.getElementById('luffy-over-overlay').classList.add('hidden');
      document.getElementById('luffy-game-wrap').classList.remove('hidden');
      document.getElementById('luffy-pause-overlay').classList.remove('hidden');
      document.getElementById('btn-luffy-pause').textContent = '▶';
      draw(performance.now());
    } catch {
      clearLuffySession();
    }
  })();
})();

// ── Pluie d'émojis au chargement ──────────────────────────────────────────────
(() => {
  const _sc = sessionStorage.getItem('libero_screen');
  if (_sc && _sc !== 'landing') return;
  const EMOJI_PACK_SETS = {
    'emojipack-animals': ['🐶','🐱','🐻','🦊','🐼','🐨','🐯','🦁','🐮','🐸','🐧','🦋','🦄','🐙','🦀'],
    'emojipack-hearts':  ['💜','💙','💚','💛','🧡','❤️','🩷','🤍','🩵','💗','💖','💝','💘','💞','💓'],
    'emojipack-party':   ['🎉','🎊','🎈','🎆','🎇','🥳','🎂','🎁','🪅','🎀','🥂','✨','🎠','🎪','🎭'],
    'emojipack-gaming':  ['🎮','🕹️','👾','🎯','🏆','🎲','🃏','🎰','👑','⚔️','🛡️','🗡️','🧩','🕳️','💣'],
    'emojipack-cosmos':  ['🌌','🪐','✨','⭐','🌟','💫','☄️','🌙','🌠','🔭','🛸','🚀','🌍','🌌','💥'],
  };
  const _equippedPack = localStorage.getItem('libero_equipped_emojipack') || '';
  const EMOJIS = EMOJI_PACK_SETS[_equippedPack] || ['🔴','🟡','♟','♔','♚','♛','♜','♝','♞','❌','⭕','🧠','❓','💡','🎮','🎯','🏆','🎲'];
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

  const LS_BLOCK = 'libero_comment_block'; // { until: timestamp }
  let countdownTimer = null;

  function getRemainingMs() {
    try {
      const b = JSON.parse(localStorage.getItem(LS_BLOCK) || 'null');
      if (b && b.until > Date.now()) return b.until - Date.now();
    } catch {}
    return 0;
  }

  function startCooldown(waitMs) {
    const until = Date.now() + waitMs;
    localStorage.setItem(LS_BLOCK, JSON.stringify({ until }));
    runCountdown(until);
  }

  function runCountdown(until) {
    clearInterval(countdownTimer);
    function tick() {
      const left = until - Date.now();
      if (left <= 0) {
        clearInterval(countdownTimer);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Envoyer ✉️';
        feedback.className = 'comment-feedback hidden';
        localStorage.removeItem(LS_BLOCK);
        return;
      }
      const mins = Math.ceil(left / 60_000);
      const str  = mins <= 1 ? 'moins d\'une minute' : `${mins} min`;
      feedback.textContent = `⏳ Limite atteinte (3/h). Réessaie dans ${str}.`;
      feedback.className = 'comment-feedback err';
      sendBtn.disabled = true;
      sendBtn.textContent = 'Patiente…';
    }
    tick();
    countdownTimer = setInterval(tick, 30_000);
  }

  function openModal() {
    overlay.classList.remove('hidden');
    pseudo.value = localStorage.getItem('playerName') || '';
    const left = getRemainingMs();
    if (left > 0) {
      runCountdown(Date.now() + left);
    } else {
      feedback.className = 'comment-feedback hidden';
      feedback.textContent = '';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Envoyer ✉️';
    }
  }
  function closeModal() {
    overlay.classList.add('hidden');
    clearInterval(countdownTimer);
  }

  $('btn-comment').addEventListener('click', openModal);
  $('btn-comment-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // ── Modal Communauté ──
  const communityOverlay = $('overlay-community');
  function closeCommunity() { communityOverlay.classList.add('hidden'); }
  $('btn-community-close').addEventListener('click', closeCommunity);
  communityOverlay.addEventListener('click', e => { if (e.target === communityOverlay) closeCommunity(); });
  $('btn-community-open-comment').addEventListener('click', () => {
    closeCommunity();
    openModal();
  });

  pseudo.addEventListener('input', e => {
    const v = e.target.value;
    localStorage.setItem('playerName', v.trim());
    const n = $('input-name');       if (n) n.value = v;
    const tn = $('input-trivia-name'); if (tn) tn.value = v;
    const counter = $('libs-counter');
    if (counter) counter.classList.toggle('hidden', !v.trim() || v.trim() === 'Anonyme');
  });

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
      } else if (res.status === 429 && data.waitMs) {
        startCooldown(data.waitMs);
      } else {
        feedback.textContent = `❌ ${data.error || 'Erreur inconnue.'}`;
        feedback.className = 'comment-feedback err';
      }
    } catch {
      feedback.textContent = '❌ Impossible de contacter le serveur.';
      feedback.className = 'comment-feedback err';
    }

    if (!sendBtn.disabled) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Envoyer ✉️';
    }
  });
})();

// ── Commentaires dans la news card ───────────────────────────────────────────
function _timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `il y a ${d}j`;
  if (h > 0) return `il y a ${h}h`;
  if (m > 0) return `il y a ${m}min`;
  return 'à l\'instant';
}

function _renderNewsComments(data) {
  const container = document.getElementById('news-comments');
  if (!container) return;
  if (!Array.isArray(data) || !data.length) { container.innerHTML = ''; return; }
  const liked = JSON.parse(localStorage.getItem('libero_liked_comments') || '[]');
  container.innerHTML = data.map(c => {
    const isLiked = liked.includes(c.id);
    return `<div class="news-comment">
      <div class="news-comment-meta"><strong>${c.pseudo}</strong><span>${_timeAgo(c.date)}</span></div>
      <p class="news-comment-msg">${c.message.slice(0, 140)}</p>
      <button class="news-like-btn${isLiked ? ' liked' : ''}" data-id="${c.id}" ${isLiked ? 'disabled' : ''}>❤️ ${c.likes}</button>
    </div>`;
  }).join('');
  container.querySelectorAll('.news-like-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        const r      = await fetch(`${window.BACKEND_URL}/api/comment-like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await r.json();
        if (result.ok) {
          const arr = JSON.parse(localStorage.getItem('libero_liked_comments') || '[]');
          arr.push(id);
          localStorage.setItem('libero_liked_comments', JSON.stringify(arr));
          btn.textContent = `❤️ ${result.likes}`;
          btn.classList.add('liked');
        } else {
          btn.disabled = false;
        }
      } catch { btn.disabled = false; }
    });
  });
}

async function _loadNewsComments() {
  try {
    const res  = await fetch(`${window.BACKEND_URL}/api/comments`);
    const data = await res.json();
    _renderNewsComments(data);
  } catch(e) { console.error('news comments:', e); }
}

socket.on('news-comments-update', data => _renderNewsComments(data));

socket.on('comment-star', ({ pseudo, message, likes }) => {
  const el = document.getElementById('news-star');
  if (!el) return;
  el.innerHTML = `<span class="news-star-badge">🏆 Commentaire du jour</span><strong>${pseudo}</strong> : "${message.slice(0, 100)}"<span class="news-star-likes"> — ❤️ ${likes}</span>`;
  el.classList.remove('hidden');
  const nc = document.getElementById('news-card');
  if (nc) nc.classList.remove('collapsed');
});

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
      id: 'landing_news',
      screen: 'landing',
      text: '📰 Le cadre <strong>News</strong> est replié dans le coin <strong>en haut à gauche</strong>. <strong>Clique dessus</strong> pour l\'ouvrir : il affiche les dernières actualités, nouvelles fonctionnalités, annonces et commentaires de joueurs. Reclique pour le refermer.',
      target: '#news-card',
    },
    {
      id: 'landing_cats',
      screen: 'landing',
      text: '👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! L\'accueil propose quatre sections : <strong>Jeux Classiques</strong>, <strong>Culture Générale</strong>, <strong>Évents</strong> (mini-jeux du week-end) et <strong>Pour la communauté</strong> (le mini-jeu <strong>Luffy Runner</strong>). Clique sur une carte pour commencer.',
      target: '.landing-grid',
    },
    {
      id: 'landing_lb',
      screen: 'landing',
      text: '🌍 Le <strong>Classement Global</strong> regroupe <em>tous</em> les joueurs ayant au moins un point, quelle que soit la section jouée. Score = victoires classiques ×10 + points Quiz + meilleur score Snake ×10 + meilleur score Luffy Runner ×10. Plus tu montes, plus ton serpent 🐍 grandit !',
      target: '.global-lb-card',
    },
    {
      id: 'landing_btns',
      screen: 'landing',
      text: '⚙️ Des boutons permanents sont disponibles :<br>▶ <strong>En haut à droite</strong> : ☀️/🌙 <strong>Thème</strong> : bascule entre le mode jour et nuit<br>▶ <strong>En bas à droite</strong> : 🌐 <strong>Langue</strong> (FR/EN) · 🐍 <strong>Serpent</strong> (évolue avec ton score global) · ❓ <strong>Aide</strong>',
      target: null,
    },
    {
      id: 'landing_libs',
      screen: 'landing',
      text: '⚡ <strong>Libs</strong> : une monnaie virtuelle gagnée par les meilleurs joueurs. Les top 3 du classement Global reçoivent automatiquement des Libs toutes les 5h (1er : +10 ⚡, 2e : +5 ⚡, 3e : +3 ⚡). Dépense-les dans la <strong>boutique</strong> pour obtenir des boosts quiz !',
      target: '#libs-counter',
    },

    // ── Évents ──
    {
      id: 'events_snake',
      screen: 'events',
      text: '🐍 C\'est l\'évent du week-end : <strong>Snake Challenge</strong> ! Clique <em>Jouer</em>, ton serpent entre dans l\'arène. Mange les 🍎 pour grandir (les bords sont traversables, tu ressors de l\'autre côté !). Ton meilleur score <strong>persiste</strong> entre les sessions.',
      target: '.event-intro',
    },

    // ── Pour la communauté ──
    {
      id: 'luffy_runner',
      screen: 'luffy',
      text: '🏴‍☠️ <strong>Luffy Runner</strong> : aide Luffy à fuir la Marine ! Saute (↑ / Espace) par-dessus les obstacles au sol, accroupis-toi (↓) sous les obstacles volants. Ton meilleur score alimente un classement dédié.',
      target: '#luffy-intro',
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
      text: '🤖 <strong>Mode Solo</strong> : joue contre le bot à 3 niveaux de difficulté : Facile, Moyen ou Difficile. Tes victoires et défaites sont comptées dans le classement !',
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
      text: '📋 <strong>Partage ce code</strong> à 4 lettres avec ton adversaire, par message, WhatsApp, Discord… La partie démarre automatiquement dès qu\'il rejoint !',
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
    textEl.innerHTML = (t().tutoSteps && t().tutoSteps[step.id]) || step.text;
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

    // Si l'étape cible la News, forcer la carte visible pendant toute la durée
    if (step.target === '#news-card') {
      clearTimeout(_newsTimer);
      const nc = document.getElementById('news-card');
      if (nc) nc.classList.remove('collapsed');
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
    const stepId    = current.id;
    const screenName = current.screen;
    markDone(current.id);
    clearHighlight();
    current = null;

    // Reprendre le repli auto de la News une fois l'étape passée
    if (stepId === 'landing_news') _scheduleNewsCollapse();

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
  document.getElementById('btn-go-events')?.addEventListener('click', () => {
    STEPS.filter(s => s.screen === 'landing').forEach(s => markDone(s.id));
  });
  document.getElementById('btn-go-community')?.addEventListener('click', () => {
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

// ── Restauration d'écran après refresh ───────────────────────────────────────
(function() {
  const saved = sessionStorage.getItem('libero_screen');
  if (!saved || saved === 'landing') return;
  // Écrans gérés par la reconnexion socket — ils se restaurent via p4session/triviaSession
  if (saved === 'game' || saved === 'waiting') {
    if (!sessionStorage.getItem('p4session')) {
      document.documentElement.classList.remove('restoring');
      document.documentElement.removeAttribute('data-restore');
      sessionStorage.removeItem('libero_screen');
    }
    return;
  }
  if (saved === 'trivia-game' || saved === 'trivia-waiting') {
    if (!sessionStorage.getItem('triviaSession')) {
      document.documentElement.classList.remove('restoring');
      document.documentElement.removeAttribute('data-restore');
      sessionStorage.removeItem('libero_screen');
    }
    return;
  }
  // Restauration directe (home, trivia-home, events)
  if (saved === 'trivia-home') buildTriviaThemes();
  showScreen(saved);
})();

// Lance le timer de repli News dès le chargement (landing active par défaut)
_scheduleNewsCollapse();

// ── Background Manager ────────────────────────────────────────────────────────
const BGManager = (() => {
  const layer  = document.getElementById('bg-layer');
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas ? canvas.getContext('2d') : null;
  let animId   = null;
  let resizeFn = null;
  const CANVAS_BGS = new Set(['bg-circuit','bg-etoile','bg-particules','bg-pluie',
    'bg-vagues','bg-synthwave','bg-nebuleuse','bg-aurores','bg-galaxie','bg-tempete','bg-hologramme']);
  const THEMES = {
    'bg-nuit':'void','bg-ardoise':'void',
    'bg-brume':'violet','bg-crepuscule':'violet','bg-nebuleuse':'violet',
    'bg-aurore-deg':'aurora','bg-particules':'aurora','bg-vagues':'aurora','bg-aurores':'aurora',
    'bg-cyber':'cyber','bg-circuit':'cyber','bg-hexagones':'cyber','bg-pluie':'cyber','bg-tempete':'cyber','bg-hologramme':'cyber',
    'bg-etoile':'space','bg-galaxie':'space',
    'bg-synthwave':'synthwave',
  };

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (resizeFn) { window.removeEventListener('resize', resizeFn); resizeFn = null; }
    if (ctx && canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    if (canvas) canvas.style.display = 'none';
    if (layer) layer.className = '';
    document.body.classList.remove('has-bg',
      'bg-theme-void','bg-theme-violet','bg-theme-aurora','bg-theme-cyber','bg-theme-space','bg-theme-synthwave');
  }

  function start(id) {
    stop();
    if (!id) return;
    document.body.classList.add('has-bg');
    const theme = THEMES[id] || 'void';
    document.body.classList.add('bg-theme-' + theme);
    if (layer) layer.classList.add(id);
    if (!CANVAS_BGS.has(id) || !ctx) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    resizeFn = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resizeFn);
    const light = isLight();
    switch(id) {
      case 'bg-circuit':    animCircuit(light);    break;
      case 'bg-etoile':     animEtoile(light);     break;
      case 'bg-particules': animParticules(light);  break;
      case 'bg-pluie':      animPluie(light);      break;
      case 'bg-vagues':     animVagues(light);     break;
      case 'bg-synthwave':  animSynthwave(light);  break;
      case 'bg-nebuleuse':  animNebuleuse(light);  break;
      case 'bg-aurores':    animAurores(light);    break;
      case 'bg-galaxie':    animGalaxie(light);    break;
      case 'bg-tempete':    animTempete(light);    break;
      case 'bg-hologramme': animHologramme(light); break;
    }
  }

  function isLight() { return document.documentElement.classList.contains('light'); }

  function animCircuit(light) {
    const lineCol = light ? '4,120,87' : '0,255,136';
    const dotCol  = light ? '#047857'  : '#00ff88';
    const grid = 40;
    const nodes = [], lines = [];
    function init() {
      nodes.length = 0; lines.length = 0;
      const W = canvas.width, H = canvas.height;
      for (let x = 0; x <= W; x += grid)
        for (let y = 0; y <= H; y += grid)
          if (Math.random() > 0.45) nodes.push({ x, y, phase: Math.random() * Math.PI * 2 });
      for (const n of nodes) {
        if (Math.random() > 0.5) lines.push({ x1:n.x,y1:n.y,x2:n.x+grid,y2:n.y, p:Math.random(), sp:Math.random()*.004+.001 });
        if (Math.random() > 0.5) lines.push({ x1:n.x,y1:n.y,x2:n.x,y2:n.y+grid, p:Math.random(), sp:Math.random()*.004+.001 });
      }
    }
    init();
    let t = 0;
    function frame() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      t += 0.016;
      for (const l of lines) {
        l.p = (l.p + l.sp) % 1;
        if (l.x2 > W || l.y2 > H) continue;
        ctx.strokeStyle = `rgba(${lineCol},.13)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2); ctx.stroke();
        const px = l.x1 + (l.x2-l.x1)*l.p, py = l.y1 + (l.y2-l.y1)*l.p;
        ctx.beginPath(); ctx.arc(px,py,2.5,0,Math.PI*2);
        ctx.fillStyle=dotCol; ctx.fill();
      }
      for (const n of nodes) {
        if (n.x > W || n.y > H) continue;
        const a = .3+.7*(.5+.5*Math.sin(t*1.5+n.phase));
        ctx.beginPath(); ctx.arc(n.x,n.y,2,0,Math.PI*2);
        ctx.fillStyle=`rgba(${lineCol},${a})`; ctx.fill();
      }
      animId = requestAnimationFrame(frame);
    }
    frame();
  }

  function animEtoile(light) {
    const starCol = light ? '30,41,59' : '255,255,255';
    const stars = Array.from({length:250},()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      r:Math.random()*1.4+.3, phase:Math.random()*Math.PI*2, sp:Math.random()*.04+.01
    }));
    let t=0;
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.016;
      for(const s of stars){
        const a=.35+.65*(.5+.5*Math.sin(t*s.sp*60+s.phase));
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${starCol},${a})`; ctx.fill();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animParticules(light) {
    const cols = light
      ? ['#0277bd','#512da8','#00838f','#2e7d32','#c62828','#f9a825']
      : ['#4fc3f7','#7c4dff','#00e5ff','#69f0ae','#ff6b6b','#ffd740'];
    const pts = Array.from({length:80},()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      r:Math.random()*3+.8, vx:(Math.random()-.5)*.5, vy:-(Math.random()*.6+.2),
      c:cols[Math.floor(Math.random()*cols.length)], a:Math.random()*.8+.1
    }));
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      for(const p of pts){
        p.x+=p.vx; p.y+=p.vy; p.a-=.0025;
        if(p.y<0||p.a<=0){p.x=Math.random()*W;p.y=H+10;p.a=.8;p.vx=(Math.random()-.5)*.5;p.vy=-(Math.random()*.6+.2);}
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.c+(Math.round(p.a*255).toString(16).padStart(2,'0'));
        ctx.shadowColor=p.c; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0;
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animPluie(light) {
    const W=canvas.width, H=canvas.height;
    const fontSize=14, cols2=Math.floor(W/fontSize);
    const drops=Array.from({length:cols2},()=>Math.random()*(H/fontSize));
    const neonCols = light
      ? ['#0d9488','#0891b2','#be185d','#c2410c','#ca8a04']
      : ['#00ff88','#00ffff','#ff00ff','#ff0088','#ffff00'];
    const trailFill = light ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    function frame() {
      ctx.fillStyle=trailFill; ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<drops.length;i++){
        ctx.fillStyle=neonCols[i%neonCols.length]; ctx.font=`${fontSize}px monospace`;
        ctx.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*fontSize,drops[i]*fontSize);
        if(drops[i]*fontSize>canvas.height&&Math.random()>.975) drops[i]=0;
        drops[i]++;
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animVagues(light) {
    const waves = light ? [
      {c:'#0277bd',a:35,f:.018,sp:.025,y:.5},
      {c:'#512da8',a:45,f:.013,sp:.018,y:.62},
      {c:'#00838f',a:28,f:.022,sp:.032,y:.56},
    ] : [
      {c:'#4fc3f7',a:35,f:.018,sp:.025,y:.5},
      {c:'#7c4dff',a:45,f:.013,sp:.018,y:.62},
      {c:'#00e5ff',a:28,f:.022,sp:.032,y:.56},
    ];
    let t=0;
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.016;
      for(const w of waves){
        const yBase=H*w.y;
        ctx.beginPath(); ctx.moveTo(0,H);
        for(let x=0;x<=W;x+=3){
          const y=yBase+Math.sin(x*w.f+t*w.sp*60)*w.a+Math.sin(x*w.f*2.1+t*w.sp*40)*w.a*.4;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.lineTo(W,H); ctx.closePath();
        ctx.fillStyle=w.c+'28'; ctx.fill();
        ctx.strokeStyle=w.c+'77'; ctx.lineWidth=2; ctx.stroke();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animSynthwave(light) {
    let t=0;
    const skyStops   = light ? ['#bbdefb','#f8bbd0'] : ['#0a0018','#3d0050'];
    const sunStops   = light ? ['#fff176','#ff8a65','transparent'] : ['#ff8800','#ff2d78','transparent'];
    const sunBandCol = light ? '#f8bbd0' : '#3d0050';
    const floorStops = light ? ['#ffe0b2','#fff3e0'] : ['#220030','#080010'];
    const gridLine   = light ? '219,39,119' : '255,20,200';
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.005;
      const hz=H*.52;
      // Sky
      const sky=ctx.createLinearGradient(0,0,0,hz);
      sky.addColorStop(0,skyStops[0]); sky.addColorStop(1,skyStops[1]);
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,hz);
      // Sun
      const sr=Math.min(W,H)*.13;
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,hz); ctx.clip();
      const sg=ctx.createRadialGradient(W/2,hz,0,W/2,hz,sr*1.3);
      sg.addColorStop(0,sunStops[0]); sg.addColorStop(.45,sunStops[1]); sg.addColorStop(1,sunStops[2]);
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(W/2,hz,sr*1.3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=sunBandCol;
      for(let i=0;i<7;i++){const sy=hz-sr*.1-i*sr*.14; if(sy<hz-sr*1.2) break; ctx.fillRect(W/2-sr*1.3,sy,sr*2.6,sr*.07);}
      ctx.restore();
      // Floor
      const fl=ctx.createLinearGradient(0,hz,0,H);
      fl.addColorStop(0,floorStops[0]); fl.addColorStop(1,floorStops[1]);
      ctx.fillStyle=fl; ctx.fillRect(0,hz,W,H-hz);
      // Vertical lines
      const vn=14;
      for(let i=0;i<=vn;i++){
        const x=(i/vn)*W, a=.55*(1-Math.abs(i/vn-.5)*1.6);
        ctx.strokeStyle=`rgba(${gridLine},${Math.max(.04,a)})`; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(W/2,hz); ctx.lineTo(x,H); ctx.stroke();
      }
      // Scrolling horizontal lines
      const hn=14, scroll=(t*3)%1;
      for(let i=0;i<hn;i++){
        const prog=((i+scroll)/hn), y=hz+(H-hz)*Math.pow(prog,1.8);
        const a=Math.min(.75,prog*2.5);
        ctx.strokeStyle=`rgba(${gridLine},${a})`; ctx.lineWidth=Math.max(.5,2*prog);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animNebuleuse(light) {
    const blobs = light ? [
      {xf:.3,yf:.4,r:.32,c:'#b39ddb',ph:0},
      {xf:.7,yf:.6,r:.26,c:'#f48fb1',ph:2.1},
      {xf:.5,yf:.5,r:.22,c:'#90a4ae',ph:4.2},
    ] : [
      {xf:.3,yf:.4,r:.32,c:'#7c4dff',ph:0},
      {xf:.7,yf:.6,r:.26,c:'#e91e63',ph:2.1},
      {xf:.5,yf:.5,r:.22,c:'#3d5afe',ph:4.2},
    ];
    let t=0;
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.005;
      for(const b of blobs){
        const x=W*b.xf+Math.sin(t+b.ph)*50, y=H*b.yf+Math.cos(t*.7+b.ph)*30;
        const r=Math.min(W,H)*b.r;
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,b.c+'44'); g.addColorStop(1,'transparent');
        ctx.fillStyle=g;
        ctx.beginPath();
        ctx.ellipse(x,y,r*(.8+.2*Math.sin(t*1.3+b.ph)),r*.7,t*.1+b.ph,0,Math.PI*2);
        ctx.fill();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animAurores(light) {
    const bands = light ? [
      {c:'#00897b',w:.14,yf:.22,ph:0},
      {c:'#0277bd',w:.11,yf:.36,ph:1.5},
      {c:'#5e35b1',w:.09,yf:.29,ph:3.0},
    ] : [
      {c:'#00e676',w:.14,yf:.22,ph:0},
      {c:'#40c4ff',w:.11,yf:.36,ph:1.5},
      {c:'#7c4dff',w:.09,yf:.29,ph:3.0},
    ];
    let t=0;
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.01;
      for(const b of bands){
        const yBase=H*b.yf, bw=H*b.w;
        ctx.beginPath();
        const steps=80;
        for(let i=0;i<=steps;i++){
          const x=(i/steps)*W;
          const y=yBase+Math.sin(x*.005+t+b.ph)*H*.1+Math.sin(x*.01+t*1.5)*H*.04;
          i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        for(let i=steps;i>=0;i--){
          const x=(i/steps)*W;
          const y=yBase+bw+Math.sin(x*.005+t+b.ph+.5)*H*.07;
          ctx.lineTo(x,y);
        }
        ctx.closePath();
        const g=ctx.createLinearGradient(0,yBase-bw,0,yBase+bw*2);
        g.addColorStop(0,'transparent'); g.addColorStop(.35,b.c+'55');
        g.addColorStop(.7,b.c+'33'); g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.fill();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animGalaxie(light) {
    const stars=Array.from({length:350},()=>{
      const dist=Math.random()*Math.min(canvas.width,canvas.height)*.46;
      const arm=Math.floor(Math.random()*2)*Math.PI;
      const sp=arm+dist*.009+Math.random()*.5;
      return {
        x:Math.cos(sp)*dist, y:Math.sin(sp)*dist,
        r:Math.random()*1.6+.3,
        c: light
          ? `hsl(${200+Math.random()*150},65%,${28+Math.random()*22}%)`
          : `hsl(${200+Math.random()*150},70%,${60+Math.random()*30}%)`
      };
    });
    let rot=0;
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      rot+=.0003;
      ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(rot);
      for(const s of stars){
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=s.c; ctx.fill();
      }
      ctx.restore();
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animTempete(light) {
    const bolts=[];
    const nCols = light ? ['#c2185b','#0097a7','#e64a19'] : ['#ff00ff','#00ffff','#ff4400'];
    const pts2=Array.from({length:100},()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*4, vy:(Math.random()-.5)*4,
      r:Math.random()*2+.5, c:nCols[Math.floor(Math.random()*3)]
    }));
    let tick=0;
    function makeBolt() {
      const W=canvas.width,H=canvas.height;
      const sx=Math.random()*W;
      const segs=[]; let cx=sx,cy=0;
      while(cy<H){const nx=cx+(Math.random()-.5)*90,ny=cy+Math.random()*55+15;segs.push({x1:cx,y1:cy,x2:nx,y2:Math.min(ny,H)});cx=nx;cy=ny;}
      bolts.push({segs,a:1,c:nCols[Math.floor(Math.random()*3)]});
    }
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      tick++;
      if(tick%18===0) makeBolt();
      ctx.globalAlpha=1;
      for(let i=bolts.length-1;i>=0;i--){
        const b=bolts[i]; b.a-=.06;
        if(b.a<=0){bolts.splice(i,1);continue;}
        ctx.strokeStyle=b.c; ctx.lineWidth=2; ctx.globalAlpha=b.a;
        ctx.shadowColor=b.c; ctx.shadowBlur=12;
        ctx.beginPath();
        for(const s of b.segs){ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);}
        ctx.stroke(); ctx.shadowBlur=0;
      }
      ctx.globalAlpha=1;
      for(const p of pts2){
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>W)p.vx*=-1; if(p.y<0||p.y>H)p.vy*=-1;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.c; ctx.fill();
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  function animHologramme(light) {
    let t=0, glitch=0;
    const gridCol = light ? '0,131,143'  : '0,200,255';
    const scanCol = light ? '0,151,167'  : '0,255,255';
    function frame() {
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t++;
      // Grid
      ctx.strokeStyle=`rgba(${gridCol},0.15)`; ctx.lineWidth=.5;
      for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      // Scanlines
      for(let y=0;y<H;y+=4){
        ctx.fillStyle=`rgba(${gridCol},${.025+.015*Math.sin(y*.08+t*.04)})`;
        ctx.fillRect(0,y,W,2);
      }
      // Moving scan line
      const sy=(t*2.5)%H;
      const sg=ctx.createLinearGradient(0,sy-25,0,sy+25);
      sg.addColorStop(0,'transparent'); sg.addColorStop(.5,`rgba(${scanCol},0.18)`); sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg; ctx.fillRect(0,sy-25,W,50);
      // Glitch
      glitch--;
      if(glitch<=0&&Math.random()<.004){glitch=12;
        for(let i=0;i<4;i++){const gy=Math.random()*H,gh=Math.random()*18+2;
          ctx.fillStyle=`rgba(${scanCol},${Math.random()*.3})`;ctx.fillRect(0,gy,W,gh);}
      }
      animId=requestAnimationFrame(frame);
    }
    frame();
  }

  return { start, stop };
})();

// Restore background cosmetic on load
if (equippedBackground) BGManager.start(equippedBackground);

// Reopen shop after accidental page refresh
if (sessionStorage.getItem('shopState')) {
  setTimeout(() => openShop(), 150);
}
