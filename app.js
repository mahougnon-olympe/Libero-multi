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
let _libsAnimTimer     = null;
let _libsDistTimer     = null;
let _nextDistAt        = 0;
let _globalLbData      = [];
let _nameTaken         = false;
let _renameTimer       = null;

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
    boostHintBtn:'💡 Indice',
    helpLibsTitle:'Libs (monnaie)',
    helpLibsDesc:'Les Libs ⚡ sont une monnaie virtuelle. Les joueurs classés <strong>top 3 du classement Global</strong> en gagnent automatiquement toutes les 5 heures (1er : +5 ⚡, 2e : +3 ⚡, 3e : +2 ⚡). Si tu ne joues pas pendant 48 h, ton solde diminue de 10 ⚡ par jour supplémentaire. Clique sur le compteur ⚡ en haut à droite pour ouvrir la boutique. Les joueurs anonymes ne perçoivent pas de Libs.',
    helpBoostTitle:'Boost Indice (quiz)',
    helpBoostDesc:'Dans la boutique, achète un <em>Boost Indice</em> (3 ⚡) : il élimine une mauvaise réponse par question pendant un quiz complet. Le bouton 💡 apparaît dans le quiz dès que le boost est actif et s\'utilise une fois par question.',
    eventsTitle:'Évents', eventsDesc:'Week-end · Snake Challenge',
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
        { icon:'🏠', title:"Sections d'accueil", desc:"L'accueil propose <em>Jeux Classiques</em> (Puissance 4, Morpion, Échecs), <em>Culture Générale</em> (quiz par thèmes), <em>Évents</em> (mini-jeux du week-end) et <em>Pour la communauté</em> (vote pour le prochain jeu à ajouter sur le site). Chaque section a son propre classement." },
        { icon:'🎉', title:'Évents', desc:"Chaque week-end, un mini-jeu spécial est disponible. Ce week-end : <em>Snake Challenge</em>. Nourris ton serpent avec les 🍎, les bords sont traversables (tu ressors de l'autre côté). Un nouveau record affiche <em>🏆 Nouveau record !</em> à la fin. Appuie sur <strong>⏸</strong> (ou Échap / P) pour mettre en pause." },
        { icon:'🎮', title:'Créer une partie classique', desc:"Choisis un jeu, entre ton pseudo (optionnel) puis clique <em>Créer une partie</em>. Partage le code à 4 lettres à ton adversaire. Tu peux aussi jouer <strong>Solo contre le bot</strong> en choisissant une difficulté : Facile, Moyen ou Difficile." },
        { icon:'🤖', title:'Mode Solo (vs Bot)', desc:"Joue seul contre un robot. <em>Facile</em> : le bot joue au hasard. <em>Moyen</em> : le bot bloque et attaque. <em>Difficile</em> : le bot joue de manière optimale. Les parties <strong>Moyen et Difficile</strong> comptent dans le classement classique." },
        { icon:'🔗', title:'Rejoindre', desc:"Entre le code à 4 lettres reçu et clique <em>Rejoindre</em>. La partie démarre automatiquement dès que les deux joueurs sont connectés." },
        { icon:'💬', title:'Chat', desc:"Envoie des messages à ton adversaire pendant une partie classique. Le bouton <em>Vider</em> efface l'historique côté local uniquement." },
        { icon:'🔄', title:'Reconnexion', desc:"Si tu recharges la page, tu retrouves automatiquement ta partie classique en cours. L'adversaire a <strong>30 secondes</strong> pour se reconnecter, sinon la partie est annulée." },
        { icon:'🔁', title:'Rejouer', desc:"En fin de partie classique, clique <em>Rejouer</em>. La partie redémarre uniquement si les deux joueurs acceptent." },
        { icon:'🌍', title:'Classement Global', desc:"Visible dès la page d'accueil, il regroupe <strong>tous les joueurs ayant au moins un point</strong>. Score = victoires classiques (×10) + points Quiz + meilleur score Snake (×10). Mis à jour en temps réel." },
        { icon:'🏆', title:'Classements par section', desc:"Chaque section garde aussi son propre classement : victoires/défaites/nuls pour les Jeux Classiques, total de points pour le Quiz." },
        { icon:'?', title:'Pour la communauté', desc:"Cette section te permet de voter pour le prochain jeu ajouté sur Libero. Propose ton idée via le bouton <strong>✉️</strong> en bas à gauche, les suggestions les plus mentionnées seront soumises au vote, le jeu le plus voté sera développé et intégré au site." },
        { icon:'📰', title:'News', desc:"La carte News est repliée dans le <strong>coin en haut à gauche</strong>. <strong>Clique dessus</strong> pour l'ouvrir : elle affiche les dernières actualités, annonces et commentaires de joueurs. Reclique pour la refermer." },
        { icon:'🐍', title:'Serpent', desc:"Un petit serpent suit ton curseur. Il <strong>grandit et change de couleur</strong> selon ton score global 🌍 : or (1er), bleu (2e), bronze (3e). Joue et grimpe dans le classement pour l'allonger ! Clique sur <strong>🐍</strong> pour l'activer/désactiver." },
        { icon:'☀️', title:'Thème jour / nuit', desc:"Le bouton <strong>☀️</strong> / <strong>🌙</strong> en <em>haut à droite</em> bascule entre le thème clair et sombre. Le site s'adapte aussi automatiquement selon l'heure (clair de 7h à 20h, sombre la nuit). Ton choix manuel est mémorisé entre les sessions." },
        { icon:'🚪', title:'Bouton Quitter', desc:"Pendant une partie, le bouton <em>🚪 Quitter</em> en haut au centre te ramène au menu principal. Si une partie est en cours, tu es averti que tu abandonneras avant de confirmer." },
        { icon:'✉️', title:'Laisser un commentaire', desc:"Clique sur le bouton <strong>✉️</strong> en bas à gauche pour envoyer un message au créateur : avis, idée, bug… Aucune connexion requise. Tu peux laisser un pseudo ou rester anonyme." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🎓', title:'Tutoriel', desc:"À ta première visite, un guide apparaît automatiquement pour te présenter chaque fonctionnalité écran par écran. Une fois une étape vue, elle ne s'affiche plus. Pour tout revoir depuis le début, vide le cache de ton navigateur (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'Culture Générale', desc:"Réponds à des questions à choix multiple. Sélectionne <strong>un ou plusieurs thèmes</strong> parmi 12 catégories : Histoire, Sciences, Cinéma, Musique, etc. Les questions sont mélangées si tu choisis plusieurs thèmes." },
        { icon:'🌐', title:'Langue', desc:"Les questions sont automatiquement <strong>traduites en français</strong> si tu as choisi le mode FR. Les termes techniques restent en anglais quand nécessaire. En mode EN, les questions sont en anglais d'origine." },
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
    boostHintBtn:'💡 Hint',
    helpLibsTitle:'Libs (currency)',
    helpLibsDesc:'Libs ⚡ are a virtual currency. Players ranked <strong>top 3 in the Global leaderboard</strong> automatically earn some every 5 hours (1st: +5 ⚡, 2nd: +3 ⚡, 3rd: +2 ⚡). If you don\'t play for 48 h, your balance drops by 10 ⚡ per additional day of inactivity. Click the ⚡ counter in the top-right corner to open the shop. Anonymous players do not receive Libs.',
    helpBoostTitle:'Quiz Hint Boost',
    helpBoostDesc:'In the shop, buy a <em>Hint Boost</em> (3 ⚡): it eliminates a wrong answer per question for a whole quiz. The 💡 button appears in the quiz as soon as the boost is active and can be used once per question.',
    eventsTitle:'Events', eventsDesc:'Weekend · Snake Challenge',
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
        { icon:'🏠', title:'Home sections', desc:"The home page offers <em>Classic Games</em> (Connect 4, Tic Tac Toe, Chess), <em>General Knowledge</em> (themed quizzes), <em>Events</em> (weekend mini-games) and <em>Community</em> (vote for the next game). Each section has its own leaderboard." },
        { icon:'🎉', title:'Events', desc:"Every weekend, a special mini-game is available. This weekend: <em>Snake Challenge</em>. Feed your snake with 🍎, walls wrap around. A new record shows <em>🏆 New record!</em> at the end. Press <strong>⏸</strong> (or Esc / P) to pause: you can resume, go back to Events or quit." },
        { icon:'🎮', title:'Create a classic game', desc:"Choose a game, enter your username (optional) then click <em>Create a game</em>. Share the 4-letter code with your opponent. You can also play <strong>Solo vs the bot</strong> by choosing a difficulty: Easy, Medium or Hard." },
        { icon:'🤖', title:'Solo mode (vs Bot)', desc:"Play alone against a robot. <em>Easy</em>: plays randomly. <em>Medium</em>: blocks and attacks. <em>Hard</em>: plays optimally. <strong>Medium and Hard</strong> games count in the classic leaderboard." },
        { icon:'🔗', title:'Join', desc:"Enter the 4-letter code you received and click <em>Join</em>. The game starts automatically as soon as both players are connected." },
        { icon:'💬', title:'Chat', desc:"Send messages to your opponent during a classic game. The <em>Clear</em> button erases the history on your side only." },
        { icon:'🔄', title:'Reconnection', desc:"If you reload the page, you automatically rejoin your ongoing classic game. The opponent has <strong>30 seconds</strong> to reconnect, otherwise the game is cancelled." },
        { icon:'🔁', title:'Play again', desc:"At the end of a classic game, click <em>Play again</em>. The game restarts only if both players agree." },
        { icon:'🌍', title:'Global leaderboard', desc:"Visible from the home page, it gathers <strong>all players with at least one point</strong>. Score = classic wins (×10) + Quiz points + best Snake score (×10). Updated in real time." },
        { icon:'🏆', title:'Section leaderboards', desc:"Each section also keeps its own leaderboard: wins/losses/draws for Classic Games, total points for Quiz." },
        { icon:'?', title:'Community', desc:"This section lets you vote for the next game added to Libero. Suggest your idea via the <strong>✉️</strong> button in the bottom left, the most mentioned suggestions will be put to a vote, and the most voted game will be developed and added to the site." },
        { icon:'📰', title:'News', desc:"The News card is folded in the <strong>top-left corner</strong>. <strong>Click on it</strong> to open it: it shows the latest news, announcements and player comments. Click again to close it." },
        { icon:'🐍', title:'Snake', desc:"A little snake follows your cursor. It <strong>grows and changes colour</strong> based on your global score 🌍: gold (1st), blue (2nd), bronze (3rd). Play and climb the leaderboard to make it longer! Click <strong>🐍</strong> to enable/disable it." },
        { icon:'☀️', title:'Day / night theme', desc:"The <strong>☀️</strong> / <strong>🌙</strong> button in the <em>top right</em> toggles between light and dark theme. The site also adapts automatically based on the time (light 7am–8pm, dark at night). Your manual choice is remembered between sessions." },
        { icon:'🚪', title:'Quit button', desc:"During a game, the <em>🚪 Quit</em> button in the top centre takes you back to the main menu. If a game is in progress, you are warned that you will forfeit before confirming." },
        { icon:'✉️', title:'Leave a comment', desc:"Click the <strong>✉️</strong> button in the bottom left to send a message to the creator: feedback, idea, bug… No account required. You can leave a username or stay anonymous." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🎓', title:'Tutorial', desc:"On your first visit, a guide appears automatically to walk you through each feature screen by screen. Once a step has been seen, it won't show again. To restart from the beginning, clear your browser cache (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'General Knowledge', desc:"Answer multiple-choice questions. Select <strong>one or more themes</strong> from 12 categories: History, Science, Movies, Music, etc. Questions are shuffled when multiple themes are chosen." },
        { icon:'🌐', title:'Language', desc:"Questions are automatically <strong>in the language you have chosen</strong> (FR/EN). Technical terms may remain in English when necessary." },
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

function _getEventEndMs() {
  const now = new Date();
  const day = now.getDay();
  const end = new Date(now);
  end.setDate(now.getDate() + (day === 0 ? 0 : 7 - day));
  end.setHours(23, 59, 59, 0);
  if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 7);
  return end.getTime();
}

function _updateEventCountdown() {
  const left = _getEventEndMs() - Date.now();
  const text = left > 0 ? t().eventCountdownFmt(left) : '';
  ['event-card-countdown', 'news-event-countdown'].forEach(id => {
    const el = $(id); if (el) el.textContent = text;
  });
}

function applyLang() {
  const d = t();
  document.documentElement.lang = currentLang;
  document.title = d.siteTitle;
  const bl = $('btn-lang');
  if (bl) bl.textContent = currentLang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN';
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

  // Floating button tooltips
  const bh = $('btn-help');          if (bh)  bh.title = d.btnHelpTitle;
  const bst = $('btn-snake-toggle'); if (bst) bst.title = d.btnSnakeToggle;
  const lc  = $('libs-counter');     if (lc)  lc.title  = d.libsCounterTitle;

  // Help modal
  const hmt = $('help-modal-title'); if (hmt) hmt.textContent = d.help.title;
  document.querySelectorAll('.help-tab').forEach(tab => {
    const lbl = d.help.tabs[tab.dataset.tab];
    if (lbl) tab.textContent = lbl;
  });
  renderHelp();

  // Libs : mettre à jour le bouton boost hint si affiché
  _updateBoostHintBtn();

  // Countdown évent (se retraduit lors du changement de langue)
  _updateEventCountdown();

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
let _newsTimer = null;
let _newsAutoDisabled = false;
function _scheduleNewsCollapse() {
  if (window.innerWidth > 600) return;
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
    if (window.innerWidth > 600) return;
    startX    = e.touches[0].clientX;
    startBase = nc.classList.contains('collapsed') ? minX() : 0;
    moved     = false;
    nc.style.transition = 'none';
    nc.style.transform  = `translateX(${startBase}px)`;
  }, { passive: true });

  nc.addEventListener('touchmove', e => {
    if (window.innerWidth > 600) return;
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    if (!moved) return;
    nc.style.transform = `translateX(${Math.max(minX(), Math.min(0, startBase + dx))}px)`;
  }, { passive: true });

  nc.addEventListener('touchend', e => {
    if (window.innerWidth > 600) return;
    const dx          = e.changedTouches[0].clientX - startX;
    const wasCollapsed = nc.classList.contains('collapsed');
    _newsAutoDisabled  = true;
    clearTimeout(_newsTimer);

    if (!moved) {
      nc.style.transition = '';
      nc.style.transform  = '';
      nc.classList.toggle('collapsed');
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
    <div class="global-lb-row">
      <span class="lb-rank ${classes[i] || ''}">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)}">${entry.name}</span>
      <span class="global-lb-score">${entry.globalScore} ${t().globalLbPts}</span>
    </div>
  `).join('');
  const moreBtn = _glbData.length > 2
    ? `<button class="lb-more-btn" id="btn-lb-more">${_glbExpanded ? t().globalLbLess : t().globalLbMore}</button>`
    : '';
  list.innerHTML = rows + moreBtn;
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
    <div class="lb-row">
      <span class="lb-rank ${classes[i] || ''}">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)}">${entry.name}</span>
      <div class="lb-stats">
        <span class="lb-w">${entry.wins}${t().lbW}</span>
        <span class="lb-l">${entry.losses}${t().lbL}</span>
        <span class="lb-d">${entry.draws}${t().lbD}</span>
      </div>
    </div>
  `).join('');
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
    <div class="lb-row">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(e.cosmetic)} ${_fontClass(e.font)}">${e.name}</span>
      <span class="lb-score-snake">${e.hs} 🍎</span>
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
    <div class="lb-row">
      <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i] || i+1}</span>
      <span class="lb-name ${_cosmeticClass(entry.cosmetic)} ${_fontClass(entry.font)}">${entry.name}</span>
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

socket.on('trivia-leaderboard-update', (data) => { renderTriviaLeaderboard(data); });
socket.on('trivia-error', ({ message }) => { showTriviaError(message); buildTriviaThemes(); showScreen('trivia-home'); });

// ── Reconnexion automatique après reload + chargement du classement ───────────
socket.on('connect', () => {
  triviaMySocketId = socket.id;
  socket.emit('get-leaderboard');
  socket.emit('get-trivia-leaderboard');
  socket.emit('get-global-leaderboard');
  socket.emit('get-libs', { playerId: getPlayerId() });
  if (sessionStorage.getItem('libero_screen') === 'events') socket.emit('get-snake-leaderboard');

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

socket.on('reconnect-success', ({ gameType, state, yourPlayer, status, winner, roomCode }) => {
  currentRoomCode = roomCode;
  saveSession(roomCode, yourPlayer);
  hideOverlay();
  applyGameState({ gameType, state, yourPlayer, status, winner });
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

socket.on('new-message',       (msg)  => { appendMessage(msg); });
socket.on('leaderboard-update', (data) => {
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
    const rawSum   = (entry.wins || 0) + (entry.triviaPoints || 0) + (entry.snakeHs || 0);
    const len      = 4 + Math.min(14, Math.floor(rawSum / 5));
    cursorSnake.update(len, rank);
  }
  _updateLibsCountdown();
});

socket.on('snake-leaderboard-update', (data) => { renderSnakeLeaderboard(data); });

// ── Libs : handlers socket ────────────────────────────────────────────────────
socket.on('libs-update', ({ balance, pendingBoostHint, delta, nextAt, ownedCosmetics: newOwned, equippedCosmetic: newEquipped, equippedFont: newFont } = {}) => {
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
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  }
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
    _showShopFeedback(t().shopCosmeticBought, '#22c55e');
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  } else {
    const msg = error === 'already_owned'  ? t().shopCosmeticAlreadyOwned
              : error === 'anonymous'      ? t().shopCosmeticAnon
              : error === 'insufficient'   ? t().shopInsufficient
              : t().shopBuyError;
    _showShopFeedback(msg, '#ef4444');
  }
});

socket.on('equip-cosmetic-result', ({ ok, equippedCosmetic: newCosmetic, equippedFont: newFont } = {}) => {
  if (ok) {
    if (newCosmetic !== undefined) equippedCosmetic = newCosmetic;
    if (newFont     !== undefined) equippedFont     = newFont;
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  }
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
  if (lbl) lbl.textContent = d.shopBalanceLabel;
  const shopBal = $('shop-balance-display');
  if (shopBal) shopBal.textContent = `⚡ ${libsBalance} Libs`;
  _renderShopItems();
  socket.emit('get-libs', { playerId: getPlayerId() });
  $('overlay-shop').classList.remove('hidden');
}

function _renderShopItems() {
  const d = t();
  const playerPreview = localStorage.getItem('playerName') || d.shopCosmeticPreview;
  const container = $('shop-items-list');
  if (!container) return;
  container.innerHTML = `
    <div class="shop-item">
      <div class="shop-item-header">
        <span class="shop-item-name">${d.shopBoostHintName}</span>
        <span class="shop-pending" id="shop-pending-boost-hint"></span>
      </div>
      <p class="shop-item-desc">${d.shopBoostHintDesc}</p>
      <div class="shop-item-footer">
        <button id="btn-buy-boost-hint-10" class="btn btn-primary" style="font-size:.8rem;padding:6px 14px;">${d.shopBtnBuy10}</button>
        <button id="btn-buy-boost-hint-20" class="btn btn-primary" style="font-size:.8rem;padding:6px 14px;">${d.shopBtnBuy20}</button>
      </div>
    </div>
    <div class="shop-promo-section">
      <span class="shop-promo-title">${d.shopPromoTitle}</span>
      <div class="shop-promo-row">
        <input id="shop-promo-input" type="text" maxlength="4" class="shop-promo-input"
          placeholder="${d.shopPromoPlaceholder}" autocomplete="off" autocorrect="off"
          autocapitalize="characters" spellcheck="false">
        <button id="btn-redeem-code" class="btn btn-secondary" style="font-size:.8rem;padding:6px 14px;">${d.shopPromoBtn}</button>
      </div>
      <span id="shop-promo-feedback" style="font-size:.8rem;min-height:1.1em;display:block;margin-top:4px;"></span>
    </div>
    <div class="shop-cosmetics-section">
      <span class="shop-promo-title">${d.shopCosmeticsTitle}</span>
      <div class="shop-cosmetics-grid">
        ${[{id:'rainbow',price:100},{id:'galaxy',price:100},{id:'silver',price:20},{id:'bronze',price:20},{id:'gold',price:70},{id:'diamond',price:70}].map(c => {
          const owned    = ownedCosmetics.includes(c.id);
          const equipped = equippedCosmetic === c.id;
          const btnHtml  = owned
            ? equipped
              ? `<button class="btn btn-cosmetic-equipped shop-cosmetic-btn" data-id="${c.id}" data-action="unequip" data-type="color">${d.shopCosmeticEquipped}</button>`
              : `<button class="btn btn-secondary shop-cosmetic-btn" data-id="${c.id}" data-action="equip" data-type="color">${d.shopCosmeticEquip}</button>`
            : `<button class="btn btn-primary shop-cosmetic-btn" data-id="${c.id}" data-action="buy" data-type="color">${d.shopCosmeticBuy(c.price)}</button>`;
          return `<div class="shop-cosmetic-card">
            <span class="shop-cosmetic-preview name-${c.id} ${_fontClass(equippedFont)}">${playerPreview}</span>
            <span class="shop-cosmetic-name">${d.shopCosmeticNames[c.id]}</span>
            ${btnHtml}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="shop-cosmetics-section">
      <span class="shop-promo-title">${d.shopFontsTitle}</span>
      ${[
        { key:'futuriste', price:100, fonts:[{id:'font-orbitron',name:'Orbitron'},{id:'font-rajdhani',name:'Rajdhani'},{id:'font-chakra',name:'Chakra Petch'},{id:'font-audiowide',name:'Audiowide'},{id:'font-exo2',name:'Exo 2'}] },
        { key:'impact',    price:90,  fonts:[{id:'font-bungee',name:'Bungee'},{id:'font-blackops',name:'Black Ops One'},{id:'font-russo',name:'Russo One'}] },
        { key:'hacker',    price:50,  fonts:[{id:'font-sharetech',name:'Share Tech Mono'},{id:'font-majormono',name:'Major Mono'}] },
        { key:'retro',     price:10,  fonts:[{id:'font-pressstart',name:'Press Start 2P'},{id:'font-vt323',name:'VT323'}] },
        { key:'fun',       price:5,   fonts:[{id:'font-pacifico',name:'Pacifico'},{id:'font-lobster',name:'Lobster'},{id:'font-fredoka',name:'Fredoka'}] },
        { key:'elegant',   price:200, fonts:[{id:'font-cinzel',name:'Cinzel'},{id:'font-tektur',name:'Tektur'}] },
        { key:'free',      price:0,   fonts:[{id:'font-monoton',name:'Monoton'}] },
      ].map(group => `
        <div class="shop-font-group">
          <span class="shop-font-group-label">${d.shopFontCategories[group.key]}${group.price > 0 ? ` — ${group.price} ⚡` : ''}</span>
          <div class="shop-cosmetics-grid">
            ${group.fonts.map(f => {
              const owned    = ownedCosmetics.includes(f.id);
              const equipped = equippedFont === f.id;
              const btnHtml  = owned
                ? equipped
                  ? `<button class="btn btn-cosmetic-equipped shop-cosmetic-btn" data-id="${f.id}" data-action="unequip" data-type="font">${d.shopCosmeticEquipped}</button>`
                  : `<button class="btn btn-secondary shop-cosmetic-btn" data-id="${f.id}" data-action="equip" data-type="font">${d.shopCosmeticEquip}</button>`
                : `<button class="btn btn-primary shop-cosmetic-btn" data-id="${f.id}" data-action="buy" data-type="font">${group.price === 0 ? d.shopFontGetFree : d.shopCosmeticBuy(group.price)}</button>`;
              return `<div class="shop-cosmetic-card">
                <span class="shop-cosmetic-preview ${_cosmeticClass(equippedCosmetic)} ${f.id}">${playerPreview}</span>
                <span class="shop-cosmetic-name">${f.name}</span>
                ${btnHtml}
              </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
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
    socket.emit('redeem-code', { code, playerId: getPlayerId() });
  });
  $('shop-promo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-redeem-code').click();
  });
  container.querySelectorAll('.shop-cosmetic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      const type   = btn.dataset.type || 'color';
      if (action === 'buy')          socket.emit('buy-cosmetic',   { cosmeticId: id,   playerId: getPlayerId() });
      else if (action === 'equip')   socket.emit('equip-cosmetic', { cosmeticId: id,   type, playerId: getPlayerId() });
      else if (action === 'unequip') socket.emit('equip-cosmetic', { cosmeticId: null, type, playerId: getPlayerId() });
    });
  });
}

function _updateShopPending(pendingBoostHint) {
  const el = $('shop-pending-boost-hint');
  if (!el || pendingBoostHint === undefined) return;
  const d = t();
  el.textContent = pendingBoostHint > 0 ? d.shopPending(pendingBoostHint) : '';
}

function _showShopFeedback(msg, color) {
  const fb = $('shop-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = color;
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.textContent = ''; }, 3000);
}

function _showPromoFeedback(msg, color) {
  const fb = $('shop-promo-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = color;
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.textContent = ''; }, 3000);
}

$('libs-counter').addEventListener('click', openShop);
$('btn-shop-close').addEventListener('click', () => $('overlay-shop').classList.add('hidden'));
$('overlay-shop').addEventListener('click', e => { if (e.target === $('overlay-shop')) $('overlay-shop').classList.add('hidden'); });

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

  function applyTheme(showNotif = false) {
    const isLight = getIsLight();
    document.documentElement.classList.toggle('light', isLight);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = isLight ? '☀️' : '🌙';
    if (showNotif && isLight !== lastLight) {
      showThemeClock(isLight ? t().themeDay : t().themeNight);
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
    lastLight = null; // force l'affichage du toast
    applyTheme(true);
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

  function draw() {
    if (!ctx) return;
    const hue = cursorSnake.getHue();
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grille subtile
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(COLS * CELL, j * CELL); ctx.stroke();
    }

    // Pomme
    ctx.font = `${CELL}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍎', (food.x + 0.5) * CELL, (food.y + 0.5) * CELL);

    // Serpent
    snake.forEach((seg, i) => {
      const p  = snake.length > 1 ? i / (snake.length - 1) : 0;
      const l  = Math.round(58 - p * 22);
      const s  = Math.round(80 - p * 20);
      const a  = (1 - p * 0.6).toFixed(2);
      ctx.fillStyle = `hsla(${hue},${s}%,${l}%,${a})`;
      const r = CELL * (i === 0 ? 0.42 : 0.35);
      const x = seg.x * CELL + CELL * 0.1;
      const y = seg.y * CELL + CELL * 0.1;
      const w = CELL * 0.8, h = CELL * 0.8;
      if (i === 0) { ctx.shadowColor = `hsl(${hue},80%,65%)`; ctx.shadowBlur = 7; }
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      if (i === 0) ctx.shadowBlur = 0;
    });
  }

  function endGame() {
    running = false;
    clearInterval(gameLoop);
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

// ── Pluie d'émojis au chargement ──────────────────────────────────────────────
(() => {
  const _sc = sessionStorage.getItem('libero_screen');
  if (_sc && _sc !== 'landing') return;
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
  function openCommunity() { communityOverlay.classList.remove('hidden'); }
  function closeCommunity() { communityOverlay.classList.add('hidden'); }
  $('btn-go-community').addEventListener('click', openCommunity);
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
      text: '👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! L\'accueil propose quatre sections : <strong>Jeux Classiques</strong>, <strong>Culture Générale</strong>, <strong>Évents</strong> (mini-jeux du week-end) et <strong>Pour la communauté</strong> (vote pour le prochain jeu). Clique sur une carte pour commencer.',
      target: '.landing-grid',
    },
    {
      id: 'landing_lb',
      screen: 'landing',
      text: '🌍 Le <strong>Classement Global</strong> regroupe <em>tous</em> les joueurs ayant au moins un point, quelle que soit la section jouée. Score = victoires classiques ×10 + points Quiz + meilleur score Snake ×10. Plus tu montes, plus ton serpent 🐍 grandit !',
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
      text: '⚡ <strong>Libs</strong> : une monnaie virtuelle gagnée par les meilleurs joueurs. Les top 3 du classement Global reçoivent automatiquement des Libs toutes les 5h (1er : +5 ⚡, 2e : +3 ⚡, 3e : +2 ⚡). Dépense-les dans la <strong>boutique</strong> pour obtenir des boosts quiz !',
      target: '#libs-counter',
    },

    // ── Évents ──
    {
      id: 'events_snake',
      screen: 'events',
      text: '🐍 C\'est l\'évent du week-end : <strong>Snake Challenge</strong> ! Clique <em>Jouer</em>, ton serpent entre dans l\'arène. Mange les 🍎 pour grandir (les bords sont traversables, tu ressors de l\'autre côté !). Ton meilleur score <strong>persiste</strong> entre les sessions.',
      target: '.event-intro',
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
