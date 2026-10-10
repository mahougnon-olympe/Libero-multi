# GUIDE DU PROJET : Libero's Multi

> **À lire en premier par tout agent IA.** Ce fichier dit où est chaque chose et comment
> faire les changements courants **sans lire tout le code**. Les fichiers sont gros
> (`app.js` ~14 600 lignes) : on cherche avec `grep` le **titre de section** ou le
> **nom de fonction** indiqué ici, puis on lit seulement ce bloc.
> Les numéros de ligne changent : fie-toi aux noms, pas aux lignes.
>
> Mettre ce guide à jour à chaque nouvelle fonctionnalité (section concernée + « Pièges »).

---

## 1. Le projet en 30 secondes

- Site de **jeux multijoueur temps réel + lecture**, bilingue **FR/EN**, public : élèves et ados au Bénin, surtout sur **téléphone**. Propriétaire : HOUNKPEVI Olympe.
- **Front statique** (HTML/CSS/JS vanilla, aucun build) sur **Vercel** : https://libero-multi.vercel.app
- **Back** Node/Express + Socket.IO sur **Render** : https://libero-multi.onrender.com (`backend/server.js`)
- **Base** MongoDB Atlas (base `libero`). Sans `MONGODB_URI`, le serveur tourne en mémoire (tests locaux).
- Monnaie virtuelle : les **Libs** (symbole : éclair dessiné `<i class="bolt">`, jamais l'emoji).
- Design actuel : **« Cahier et ardoise »** : thème clair = **Cahier** (défaut, papier Seyès, encre bleue, marge rouge, surligneur), thème sombre = **Ardoise** (craie, cadre bois). Tout est « fournitures d'école » dessinées.

## 2. Règles absolues (le propriétaire y tient)

1. **Jamais de tiret cadratin (le tiret long, U+2014)** nulle part (texte, HTML, commentaires, commits). Virgule, deux-points, parenthèses ou « - ». La CI le vérifie.
2. **Jamais de trailer `Co-Authored-By`** dans les commits.
3. **Toute UI à état survit à un F5** et revient exactement au même endroit (sessionStorage / localStorage).
4. **Ne jamais commiter `backend/.env`** (secrets LIVE : FedaPay `sk_live_`, `wh_live_`, `ADMIN_KEY`).
5. **Tout texte visible existe en FR et en EN** (objet `DICT`).
6. **Aucun emoji dans l'interface** (sauf contenus faits d'emojis : chat, emotes, pluie perso). Un filet `_sansEmoji` + MutationObserver les retire de toute façon.
7. **Montrer une maquette avant de coder** une refonte visuelle (artifact HTML avec plusieurs propositions), puis coder la proposition choisie.
8. **Pousser (`git push` sur `main`) après chaque étape** : Vercel et Render se redéploient seuls.
9. Responsive obligatoire (tester 390 px et 1280 px), thèmes Cahier ET Ardoise.
10. Le site peut être **fermé aux joueurs** (maintenance bloquante) : ne pas le rouvrir sans ordre du propriétaire.

## 3. Arborescence (chaque fichier, son rôle)

| Fichier / dossier | Rôle |
|---|---|
| `index.html` (~1 800 l.) | Tout le HTML du site : écrans `#screen-*`, fenêtres `#overlay-*`, nav, splash `#boot` (style inline en tête). |
| `app.js` (~14 600 l.) | **Tout le JS client** (monolithe). Voir §5 pour la carte. |
| `style.css` (~5 100 l.) | **Ancien design** (base, layout, beaucoup de règles `html.light`). On ne le modifie presque plus. |
| `cahier.css` (~2 500 l.) | **Design actuel**, chargé APRÈS style.css. Toute retouche visuelle se fait ici, en fin de fichier, par blocs `/* ══ TITRE ══ */`. Voir §6. |
| `portrait.js` | Moteur du **portrait dessiné** (`window.LiberoPortrait`) : options, `svg(p)`, `blank()` (portrait de base), `normalize`, `lockedIds`. Chargé avant app.js (site + stats.html). |
| `icons3d.js` | Icônes en relief lucide-react (esm.sh, chargé tard). Table `MAP` (`data-ic` -> icône). |
| `wordle-words.js` | Listes de mots du jeu Le Mot. |
| `config.js` | `window.BACKEND_URL` (localhost:3001 en local, Render sinon). |
| `sw.js` | Service worker (PWA). **Bumper `const CACHE = 'libero-vNN'` à chaque déploiement front.** Réseau d'abord avec délai 2,5 s. |
| `manifest.json` | PWA. |
| `legal.html` | Mentions légales / CGV / confidentialité / crédits (FR+EN). À mettre à jour si on collecte une nouvelle donnée ou ajoute une ressource tierce. |
| `stats.html` | **Tableau de bord admin** (plateau de Ludo + pages « gazette »). Clé `ADMIN_KEY` dans `localStorage.libero_admin_key`. |
| `stats-classique.html` | Ancien dashboard, gardé en secours (lien en bas de stats.html). |
| `backend/server.js` (~6 700 l.) | **Tout le serveur** (Express + Socket.IO + Mongo). Voir §7. |
| `backend/game*.js` | Moteurs de jeux : `game.js` (Puissance 4), `game-tictactoe.js`, `game-chess.js` (chess.js), `game-checkers.js` (dames), `game-ludo.js` (2 à 4 joueurs), `game-bots.js`, `game-trivia.js` (quiz). |
| `backend/trivia-questions.js` | Banque de questions du quiz (par thème et difficulté). |
| `backend/books/` | Chapitres des **livres exclusifs** (`chapitre-NN.md` + `.en.md`). Jamais servis en statique. |
| `assets/` | `games/` (photos jeux classiques), `landing/` (photos accueil), `quiz/` (illustrations thèmes), `pieces/` (échecs Celtic MIT, dames), `preview/` (aperçus boutique, voir §8.6), logos, icônes. |
| `sounds/` | Sons d'interface + musique (`SoundManager`). |
| `vendor/socket.io.min.js` | Client Socket.IO auto-hébergé, **même version que le serveur** (4.8.3). Recopier si on met à jour socket.io. |
| `scripts/gen-previews.js` + `pack-previews.py` | Génèrent les aperçus réels de la boutique (Chrome headless). |
| `vercel.json` | En-têtes : `no-cache` partout, cache 1 jour `/assets` et `/sounds`, `no-store` `/stats*`. |
| `render.yaml` | Service Render (rootDir `backend`). |
| `.github/workflows/ci.yml` | CI : `node --check`, JSON valides, pas de tiret cadratin. |
| `IDEES.md` | Backlog d'idées du propriétaire. |
| `PLAN-ROTATION-BOUTIQUE.md` | Plan de la rotation automatique de la boutique. |
| `Audio/` (non versionné) | Pack de sons bruts d'où viennent ceux de `sounds/`. |
| `CLAUDE.md` / `AGENTS.md` (non versionnés) | Courts : renvoient vers ce guide. |
| `.claude/`, `.agents/` | Skills locaux (design). Le skill `impeccable` télécharge un binaire : ne pas l'utiliser sans accord. |

## 4. Lancer, tester, déployer

```bash
# Backend (sans Mongo, clé admin de test)
cd backend && env PORT=3001 MONGODB_URI= ALLOWED_ORIGINS=http://localhost:8123 ADMIN_KEY=testkey123 node server.js
# Front, DEPUIS LA RACINE
python3 -m http.server 8123   # http://localhost:8123/index.html
```
- La maintenance bloquante peut être active en local : poser `localStorage.libero_admin_key='testkey123'` (mode propriétaire) pour voir le site.
- **Tests UI** : puppeteer-core + `/usr/bin/google-chrome` headless (puppeteer installé dans le dossier de travail de l'agent, pas dans le repo). Astuces : `window._tutoSkipAll()` coupe le didacticiel ; fermer les `.overlay` (annonces, cadeau du jour) avant de cliquer ; `showScreen('shop')` pour aller à un écran ; pour une capture d'un élément utiliser `clip` + `captureBeyondViewport:false`.
- Tuer un serveur : `pkill -x node` (pas `kill $!`, qui vise le sous-shell -> `EADDRINUSE`).
- **Déployer** = `git push` sur `main`. Avant : `node --check app.js`, bumper `CACHE` dans `sw.js`. Le serveur Render gratuit peut mettre 10 s à se réveiller.
- Variables d'environnement serveur : `MONGODB_URI`, `ADMIN_KEY`, `ALLOWED_ORIGINS`, `PORT`, `FRONTEND_URL`, `SELF_URL`/`RENDER_EXTERNAL_URL`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_API_BASE`, `LIBS_TOPUP_ENABLED` (recharge en argent réel, **coupée** si absente), `PROMO_CODES`, `PROMO_FILL_CODE`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (push), `SNAKE_EVENT_FORCE`.
- Commandes admin depuis un terminal : `curl -H "X-Admin-Key: $(grep ^ADMIN_KEY backend/.env|cut -d= -f2-)" https://libero-multi.onrender.com/admin/stats`.

## 5. Front : `app.js`

### 5.1 Conventions à connaître
- **Textes** : `DICT = { fr:{...}, en:{...} }`, accès `t().cle`. Langue dans `currentLang` (`localStorage.lang`). `applyLang()` repose tous les libellés (helpers `$()` et `setTxt(id, txt)`), les modules ont un `retexte()`. **Ajouter un texte = la clé dans `fr` ET `en` + son `setTxt` dans `applyLang`** (sinon il n'est pas traduit au changement de langue).
- **Écrans** : `showScreen(name)` active `#screen-<name>`, mémorise `sessionStorage.libero_screen` (F5). Écrans de 1er niveau (barre de nav) : `landing`, `ideas`, `read`, `shop`, `profile` (ordre `TOP` pour l'animation de glissement).
- **Fenêtres** : `.overlay` + `.hidden` (on ajoute/retire `hidden`). Toutes prennent automatiquement le style « ardoise de poche » si la boîte intérieure a une des classes `recovery-modal`, `overlay-box`, `help-modal`, `comment-modal`, `community-modal`, `snake-vote-modal` (cahier.css, bloc FENETRES).
- **Socket** : `socket.emit('evenement', {playerId: getPlayerId(), ...})` / `socket.on(...)`. Le `playerId` (localStorage `libero_player_id`) **est** le compte.
- **Exposition** : les modules exposent leurs fonctions utiles en `window._xxx` (liste §5.4).
- **Échappement** : toujours `_escHtml()` sur un texte joueur injecté en HTML.
- **Icônes** : `<span data-ic="nom">` (repeint par `paintUiIcons` puis `icons3d.js`).

### 5.2 Carte des sections (chercher le titre `// ── Titre`)
Dans l'ordre du fichier :
- Haut : échappement HTML, identifiant joueur (`getPlayerId`), visiteur, lien de partage, état global, **SFX** (sons de jeu synthétisés), BGM (dormant), **SoundManager** (`window._sound.play('click'|'coin'|...)`).
- `// ── Langue` : **`DICT` fr puis en** (~1 500 lignes), `_nettoyerDict` (retire les emojis), puis `applyLang`.
- Navigation (`showScreen`), Landing, Pseudo (`_renderProfilePseudo`, `triggerRename`), Sélecteur de jeu, Session (reload d'une partie `p4session`), Attente, Header joueurs, Fin de partie, **Bannières de victoire** (`_victoryBannerHtml`), état de jeu, **Construction du plateau** (`buildConnect4/TTT/Chess/Checkers/Ludo`, `updateXxx`), promotion, rejouer, chat, **emotes** (`EMOTE_SVG`), classements (`_lbPt`, `_titleHtml`, `_cosmeticClass`, `_fontClass`, `_nameEffectClass`).
- Trivia (quiz multi et solo), déconnexion, Aide (`helpContent`), **Assistant** `initChatbot` (Libé, 100 % local, `LIBE_SVG`).
- `// ── Événements Socket.IO` : gros `socket.on('libs-update', ...)` (solde, cosmétiques équipés, niveau, badges, portrait...).
- Libs, Vote Snake, recharge FedaPay (coupée), **Panneau Paramètres** (`_updateSettingsPanel`, `_spCk` = lignes à cocher), sons d'interface, **Cosmétiques** (`CURSOR_SNAKE_SKINS`, `CLICK_FX_CONFIGS`, `TTT_DRAW`, `DOODLE_SETS`...), Particules, **Thème** (`getIsLight`, `themeMode`), Serpent curseur, Trace du curseur, Évents (Snake), **Libero Run** (canvas, `drawLuffy`, `JUMP_VEL`), Pluie d'émojis (`_playEmojiRain` = avalanche de stickers), Commentaires, **Didacticiel** (`STEPS`, Libé guide, §8.8).
- Modules : `VideoFeed` (dormant), **`IdeasBoard`** (idées : post-it), **`Wordle`** (Le Mot : grille mots croisés, clavier `KB_FR`/`KB_EN`), **`ReadFeed`** (Lecture : étagère du CDI, `spineHTML`, `openBookSheet`), restauration d'écran F5, icônes SVG (`UI_ICONS`), **`BGManager`** (fonds d'écran), **`ProfileHub`** (profil, casier `renderLocker`, `_cosmeticPreviewHtml`, `_realPrev`), `ProfileSections`, **`initPupitre`** (pupitre `BIG`, fiches `FICHE_ART`, `_pupName`), récupération, reset, parrainage, bug, **Niveaux et XP** (`_carnetClasses`, `_carnetDeco`, `_renderLevel`, `_renderBulletin`), passage de niveau (`_showLevelUp`), **Roue** (`initWheel`), amis, notifications (`NotificationCenter`), cadeaux, **Compte** (`initAccount`, `/api/account/*`), défis d'amis, fiche joueur, test de QI, VIP, joinname, pluie (menu), cadeau boutique, **Bienvenue / premier passage** (`initOnboarding` = carnet à intercalaires), tournoi, annonces, PWA/push, offre flash, filet anti-emoji, **éditeur de portrait** (`initPortraitEditor`), atelier de modèles (`initPortraitTemplates`).
- Défis du profil : `_boardHtml` (tableau noir). Hauts faits : `BADGE_ALL`, `BADGE_IC`, `_renderBadges` (cahier de tampons). Mur de maintenance : `_maintWallHtml`.

### 5.3 Écrans et fenêtres (ids dans index.html)
- Écrans `#screen-` : `landing home waiting game trivia-home trivia-waiting trivia-game events luffy feed ideas read wordle shop profile locker history`.
- Fenêtres `#overlay-` : `disconnect promotion videocomments videosubmit ideanew community announcement honor-reward snake-vote comment help recovery portrait referral bug wheel friends giftrecv dailygift friendpick friendgift playercard iq vip joinname emojirain reset gift giftchoice welcome onboard account`.
- Autres : `#settings-panel` (réglages), `#tuto-wrap`, `#news-card`, `#libs-counter`, `#notif-bell`, `#maintenance-wall`, `#boot`.

### 5.4 `window._*` utiles
`_sound`, `_celebrate`, `_playEmojiRain`, `_showLevelUp`, `_renderLevel`, `_renderBulletin`, `_renderBadges`, `_renderProfilePseudo`, `_renderVip`, `_renderOnboard`, `_pupitre.paint`, `_openPortraitEditor`, `_openAccount`, `_openPlayerCard`, `_openGiftModal`, `_openCommentBox`, `_tutoBegin`, `_tutoSkipAll`, `_tutoOnScreen`, `_wordle`, `_readFeed`, `_ideasBoard`, `_profileHub`, `_notify.add`, `_maintWallHtml`, `_sansEmoji`, `_shopOverrides`, `_allShopItemsById`, `_myLevel`, `_myXp`, `_myBadges`, `_wheelDone`, `_hasAccount`.

### 5.5 Stockage navigateur
- **localStorage** : `libero_player_id` (le compte), `playerName`, `lang`, `themeMode`, `libero_onboarded`, `libero_has_account`, `libero_admin_key`, `libero_portrait`, `libero_badges_seen`, `libero_tuto_v2`, `libero_pupitre`, `libero_profile_sections_v2`, `libero_wordle_*`, `sfxEnabled`/`sfxVolume`/`libero_music`/`bgmVolume`, `snakeEnabled`, `libero_push`, `libero_chatbot_lang`, `libero_notifs`, `libero_site_closed`, `dismissedAnnouncements`, `libero_referrer_code`, `libero_equipped_bg`...
- **sessionStorage** (F5) : `libero_screen`, `p4session` (partie classique), `triviaSession`, `shopState`, `libero_tpl_sort`, `libero_portrait_editor`, `libero_onboard_page` + `libero_onboard_pseudo` (premier passage).

## 6. CSS

- `style.css` = ancien design. `cahier.css` = design actuel, **gagne** car chargé après et préfixé **`:root:root`** (spécificité 0,3,0) pour battre les anciennes règles `html.light .x`. Pour battre une règle `:root:root` en thème clair : `:root:root.light`. Pour un ID : `:root:root #id`.
- Jetons (`:root` / `html.light` dans cahier.css) : `--bg --card --card2 --text --muted --accent --board --line --border --mark (surligneur) --margin (rouge) --hard (ombre pleine) --font-display (Archivo Black) --font-body (Archivo) --font-hand (Caveat)`. Ombres pleines, jamais floues ; pas de `backdrop-filter`.
- Blocs de cahier.css (chercher `/* ══ TITRE`), du plus ancien au plus récent : séquences 2 à 10 (accueil, choix du jeu, plateaux, fonds, boutique, profil, quiz/lecture/idées, fenêtres) ; CLASSEMENTS ; PORTRAIT DESSINÉ ; COSMÉTIQUES REDESSINÉS ; ASSISTANT ; PASSAGE DE NIVEAU ; PUPITRE ; DÉFIS AU TABLEAU NOIR ; MUR DE MAINTENANCE ; FICHES SCOTCHÉES ; CORRECTIFS DU THÈME CLAIR ; **Profil = CARNET DE CORRESPONDANCE** ; Didacticiel « Libé te guide » ; **FENÊTRES = ARDOISE DE POCHE** ; Réglages = LISTE À COCHER ; Pseudos lisibles (contour d'encre / feuille métallique) ; Roue à la craie ; Carnet qui s'embellit (niveaux) ; **BOUTIQUE = PAPETERIE** ; Hauts faits = CAHIER DE TAMPONS ; IDÉES = TABLEAU DE LA CLASSE ; LECTURE = ÉTAGÈRE DU CDI ; BOUTON RETOUR = FLÈCHE AU CRAYON ; LE MOT = MOTS CROISÉS ; PREMIÈRE VISITE = CARNET À INTERCALAIRES.
- **Polices cosmétiques** : à déclarer dans les DEUX blocs de style.css (déclaration d'origine + bloc à classe doublée `.font-x.font-x` en fin de fichier), sinon la charte les écrase.

## 7. Back : `backend/server.js`

### 7.1 Carte (chercher `// ── Titre`)
Livres exclusifs (`LIBERO_BOOKS`), codes promo, tournoi du samedi, stats quotidiennes, alertes fraude, annonces, lecteurs par livre, FedaPay, évent Snake, **Persistance MongoDB** (chargement au boot + `dbUpsertLibs`), défis quotidiens (`CHALLENGE_POOL`) et permanents (`PERMANENT_CHALLENGES`), **badges** (`BADGE_DEFS`, `computeBadges`), niveaux/XP (`levelFromXp`, `awardXp`, `XP_MILESTONE_BONUS`), roue (`WHEEL_PRIZES/WEIGHTS`), cadeau du jour, offre flash, catalogue boutique admin (`shopOverrides`), **rotation boutique** (`ROTATION_PLAN`), audit, erreurs serveur, état admin, tâches programmées, push, onboarding gamifié, **Libs : constantes** (`SHOP_ITEMS`, **`COSMETICS`** = catalogue de tous les cosmétiques avec prix, `PORTRAIT_SPEC`, `BUNDLES`, `FREE_COSMETICS`, `TRIVIA_CATEGORIES`), helpers, classements, salles de quiz, bot, **`io.on('connection')`** (tous les `socket.on`), puis routes HTTP : visites, chatbot, bugs, commentaires, FedaPay, **admin** (`isAdmin(req)`), mots interdits, prix des livres, maintenance, sauvegarde, feed vidéos, idées, **comptes**, lecture, livres.

### 7.2 Données
- **`libs` (Map playerId -> entry)** = le profil complet d'un joueur (solde, cosmétiques possédés/équipés, portrait, xp, streak, défis, lifetime, amis, VIP, wheelDay, badges...). Schéma dans le `libsDocs.forEach` de chargement ET dans `dbUpsertLibs` : **un nouveau champ doit être ajouté aux deux + à l'entrée par défaut de `getLibsEntry`**.
- Collections Mongo : `accounts admin_audit admin_challenges announcements book_readers bot_logs bug_reports comments daily_stats feed_books feed_videos gift_codes leaderboard libs libs_purchases luffy_leaderboard player_aliases portrait_templates push_subs reset_archive scheduled_tasks server_config server_errors snake_leaderboard snake_votes suggestions trivia_leaderboard trivia_seen visitors visit_stats`.
- `server_config` (`_id`) : `maintenance` (`{on, block, message, messageEn, page}`), `shop_overrides`, `shop_rotation`, `flash_offer`, `tournament`, `game_counters`, `banned_words`, `book_prices`, `admin_alert_subs`, `news_seeded`...
- Ce que reçoit le client à la connexion : événement `libs-update` (voir la ligne `socket.emit('libs-update', { name: entry.name ...` dans `get-libs`). Ajouter un champ ici + le lire dans le `socket.on('libs-update')` client.

### 7.3 Événements Socket.IO (client -> serveur)
Parties : `create-room join-room join-by-code reconnect-room leave-room cancel-room make-move get-moves request-restart decline-restart start-ludo send-message send-emote`. Quiz : `create-trivia-room join-trivia-room reconnect-trivia-room leave-trivia-room start-trivia trivia-answer fetch-trivia-solo solo-trivia-finished use-boost-hint activate-quiz-boost`. Solo : `solo-game-over snake-game-start snake-eat submit-snake-score submit-luffy-score submit-snake-vote get-snake-vote`. Profil/économie : `get-libs rename-player check-pseudo buy-cosmetic equip-cosmetic refund-cosmetic buy-bundle buy-boost buy-vip buy-book-pack redeem-code redeem-gift gift-cosmetic gift-cosmetic-friend gift-friend gift-vip gift-ack spin-wheel claim-challenge get-challenges iq-submit set-portrait set-referrer reset-account honor-modal-seen announcement-dismissed book-read`. Amis : `add-friend respond-friend remove-friend get-friends challenge-friend get-player-card`. Boutique : `get-shop get-shop-overrides get-shop-rotation get-flash-offer publish-portrait-template get-portrait-templates buy-portrait-template delete-portrait-template`. Classements : `get-leaderboard get-global-leaderboard get-trivia-leaderboard get-snake-leaderboard get-luffy-leaderboard get-tournament get-history`. Push : `push-subscribe push-unsubscribe`.

### 7.4 Routes HTTP
- Public : `GET /health`, `/api/status` (maintenance, `libsTopup`), `POST /api/visit`, `/api/bot-log`, `/api/bug-report`, commentaires `/api/comments|comment|comment-like`, `/api/libs/packs|checkout|verify|webhook`, `/api/announcements`, `/api/push-key`, idées `/api/suggestions`, `/api/suggestion/:id/vote`, comptes **`/api/account/register|login|change-password`**, lecture `/api/feed-books`, `/api/books`, `/api/book/:id`, `/api/book/:id/couverture`, `/api/book/:id/chapitre/:num`, vidéos `/api/feed-video*`.
- Admin (en-tête `X-Admin-Key`) : `/admin/stats`, `/admin/player/:ref`, gift, restore-player, reset-restore/archive, comments (approve/schedule/delete), challenges, cosmetics + cosmetic-shop, shop-rotation, flash, push + push-audience, schedule, banned-words, book-prices, alert-recipient, **maintenance** + **maintenance-page**, export (backup/players/purchases), announce, botlog-flag, bug-resolve, server-errors, libs-purchases, feed-videos, suggestions, portrait-templates, accounts + account-reset, feed-book.

## 8. Recettes (comment faire...)

### 8.1 Ajouter un texte / traduire
Clé dans `DICT.fr` et `DICT.en` (les deux objets commencent par `siteTitle:` : chercher `siteTitle:'Jeux Multijoueur'` et `siteTitle:'Multiplayer Games'`), puis `setTxt('mon-id', d.maCle)` dans `applyLang`.

### 8.2 Ajouter un écran
`<div id="screen-x" class="screen">` dans index.html ; si 1er niveau, onglet dans `#main-nav` + entrée dans `TOP` de `showScreen` + règle `[data-restore="x"]` ; contenu stylé dans cahier.css. Hook d'entrée dans `showScreen` si besoin de charger des données.

### 8.3 Ajouter une fenêtre
`<div id="overlay-x" class="overlay hidden"><div class="recovery-modal">...` (prend seule le style ardoise). Titre `.profile-modal-title`, croix `.help-close-btn`. Si elle a un état (onglet, étape) : le mémoriser en sessionStorage pour le F5.

### 8.4 Ajouter un cosmétique
1. Serveur : entrée dans `COSMETICS` (`{id, type, price}`), éventuellement `FREE_COSMETICS`, `DEFAULT_SHOP_TYPES` si nouvelle famille.
2. Client : nom FR/EN (tables de noms de la boutique dans `DICT`), rendu (classe CSS, ou table JS : `CURSOR_SNAKE_SKINS`, `CLICK_FX_CONFIGS`, `TTT_DRAW`, `EMOTE_SVG`, `DOODLE_SETS`, `_victoryBannerHtml`...), `KEPT_SHOP_TYPES` si nouvelle famille + onglet + icône `icons3d.js`.
3. Aperçu réel (§8.6). **Vérifier que l'id serveur existe bien dans le CSS** (bugs déjà vus : `lavalice`/`lavaice`).
4. Polices : voir §6.

### 8.5 Ajouter un champ joueur côté serveur
Les 3 endroits de §7.2 (chargement, `dbUpsertLibs`, défaut) + l'envoyer dans `libs-update` si le client en a besoin.

### 8.6 Aperçus de la boutique
`node scripts/gen-previews.js [famille]` puis `python3 -I scripts/pack-previews.py` -> `assets/preview/<id>.webp` (fonds : aussi `-light`). Comme `/assets` est en cache 1 jour, **incrémenter `PREVIEW_VER`** dans app.js.

### 8.7 Défis, hauts faits, niveaux
- Défi quotidien/permanent : `CHALLENGE_POOL` / `PERMANENT_CHALLENGES` (serveur) + nom dans `DICT.challengesNames`. Métrique : `bumpChallenge(id, 'metrique')`.
- Haut fait : `BADGE_DEFS` (serveur) **et** `BADGE_ALL` + dessin `BADGE_IC` (client).
- Paliers visuels du carnet : `_carnetClasses` / `_carnetDeco` (22 étapes de 1 à 60).

### 8.8 Didacticiel
`STEPS` (id, écran, `target` CSS, texte FR de secours) + `DICT.tutoSteps.<id>` FR et EN. **Une phrase courte par étape** (le propriétaire : « les gens n'aiment pas lire »). Progression `libero_tuto_v2`.

### 8.9 Livre exclusif
Entrée dans `LIBERO_BOOKS` (serveur) + chapitres `backend/books/<dir>/chapitre-NN.md` (+ `.en.md`) ; couleur du dos dans `SPINE_COLORS` (client, ReadFeed).

### 8.10 Page de maintenance / fermer ou rouvrir le site
Dashboard (stats.html), section Maintenance : case « Bloquer le site », éditeur de page (`POST /admin/maintenance-page`). En direct : `POST /admin/maintenance {on, block, message, messageEn}`.

## 9. Ce que fait chaque partie de l'interface (design actuel)

- **Accueil** : message du jour (`_messageDuJour`), 2 grandes cartes (classiques, quiz) avec photos, 3 tuiles (évents, Libero Run, Le Mot), classement global, carte News repliée.
- **Profil** : carnet de correspondance (`#level-banner`, s'embellit avec le niveau, étiquette de pseudo en feuille métallique si couleur achetée), défis au tableau noir, **pupitre** (6 objets, chaque objet ouvre un tiroir = section `<details>` avec fiches scotchées), hauts faits en cahier de tampons.
- **Boutique** : papeterie (auvent, pastilles de rayons, tableau de liège pour « À la une » et « Du jour », étagères pour le reste, fiche = comptoir).
- **Lecture** : étagère du CDI. **Idées** : tableau de la classe (post-it). **Le Mot** : grille de mots croisés. **Roue** : roue à la craie. **Réglages** : liste à cocher. **Fenêtres** : ardoise de poche. **Retour** : flèche au crayon. **Didacticiel** : Libé te guide. **Premier passage** : carnet à intercalaires (Nouveau en 3 pages / J'ai déjà un carnet).
- **Portrait** (photo de profil) : `portrait.js`, éditeur `#overlay-portrait`, éléments payants `pt-<clé>-<index>` (40 Libs), modèles vendus par les joueurs (70 % à l'auteur). Portrait de base = silhouette à dessiner (`LiberoPortrait.blank()`).
- **Assistant** : Libé le crayon, local, cherche dans `helpContent`, journalise via `/api/bot-log`.

## 10. Pièges connus (déjà rencontrés)

- `_renderLevel()` réécrit `banner.className` : y garder `profile-id` et les classes de `_carnetClasses`.
- Les `libs-update` partiels n'ont pas toujours `balance` : ne jamais écraser le solde sans `balance !== undefined`.
- `applyLang()` peut reposer un vieux libellé sur un id réutilisé : poser les nouveaux textes **après** (exemple : bloc `d.onb`).
- `ProfileSections.restore()` écrase l'attribut `open` des `<details>` : changer la clé `libero_profile_sections_vN` si on ajoute une carte à une section existante.
- Un `<details>` ne peut pas être une grille : envelopper ses enfants (`.fiches`).
- `button.x{all:unset}` a une spécificité qui écrase les classes : utiliser `:where(button.x){all:unset}`.
- Une animation CSS sur `transform` écrase un `transform` posé en attribut SVG : envelopper dans un `<g>`.
- Masques CSS (`mask`) : ils rognent tout ce qui dépasse de la boîte (contours, polices à boucles) : donner du padding + marge négative.
- Contour d'encre des pseudos : il est sur `.lb-nm` (nom + titre), jamais sur le portrait `.lb-pt`.
- Boutique : `KEPT_SHOP_TYPES` (client) et `DEFAULT_SHOP_TYPES` (serveur) à garder synchronisés ; la rotation automatique peut retirer des articles (overrides Mongo).
- Serveur : `maintenance.block` doit être rechargé au boot (sinon chaque déploiement rouvre le site).
- `PORTRAIT_SPEC` (serveur) et `portrait.js` (client) : mêmes tailles et mêmes `lock`.
- Le premier passage : `window.__liberoNewVisitor` reste vrai tant que `libero_onboard_page` existe (sinon un F5 saute l'étape et lance le didacticiel).
- `reconnect-room` envoie le `playerId` pour reprendre un siège ; un coup refusé renvoie `game-update {resync:true}`.
- `Network.emulateNetworkConditions` ne ralentit pas les websockets (tests de réseau lent trompeurs).
- Feuilles CSS chargées en `media="print" onload` (ne pas les remettre bloquantes : le splash ne s'afficherait plus).
- Recharge de Libs en argent réel : coupée par `LIBS_TOPUP_ENABLED` ; `/api/libs/verify` et le webhook restent actifs exprès.
