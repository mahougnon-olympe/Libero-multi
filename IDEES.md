# Idees / backlog

Notes d'idees pour Libero's Multi (fichier de travail, non publie : les `*.md` sont
exclus du deploiement Vercel). Coche au fur et a mesure.

## Jeux de lettres / mots a ajouter
- [ ] **Le Mot (facon Wordle)** : deviner un mot de 5 lettres en 6 essais, un mot par
  jour, solo + classement. Le plus fort en retention (habitude quotidienne).
  *(En cours de construction.)*
- [ ] **Le Petit Bac (Baccalaureat)** : une lettre tiree, des categories (prenom,
  ville, pays, animal, objet...), trouver un mot par categorie avant la fin du temps.
  Tres social, ideal en multi. Validation possible par vote des joueurs.
- [ ] **Le Pendu** : deviner un mot lettre par lettre. Solo ou 1 contre 1 (l'un choisit
  le mot, l'autre devine).
- [ ] **Le Mot le plus long** (facon Des chiffres et des lettres) : former le plus long
  mot avec des lettres tirees, en temps limite. Competitif et rapide.
- [ ] **Boggle / Mots meles** : trouver un maximum de mots dans une grille de lettres.

Note technique : ces jeux ont besoin d'un **dictionnaire de validation** (liste de mots
FR + EN). Le Pendu et Le Mot en ont besoin ; le Petit Bac peut se valider par vote.

## Calembours / jeux de mots a afficher (ecrans de chargement, chatbot, toasts)
- Chez Libero, on ne perd jamais... sauf aux echecs.
- Ici, meme les Libs sont bien gardees.
- Tourne la roue, la chance te fait de l'oeil.
- (a completer, versions FR + EN)

## Gros chantiers valides (a faire un par un)
- [x] **Compte optionnel** (pseudo + mot de passe, restauration sur un autre appareil).
- [x] **Cadeau du jour** a la 1re connexion (theme ete : fond, emote, petit lot de Libs, pluie d'emojis) -> remplace le bonus de Libs de la serie de connexion.
- [ ] **Analytics d'entonnoir** dans le dashboard (visite -> 1re partie -> retour J+1).
- [ ] **Decoupe du monolithe `app.js`** pour accelerer le premier chargement (delicat,
  a faire en etapes prudentes).

## Pistes secondaires (experience joueur / admin)
Joueur :
- [x] Recherche / filtre dans la section Idees (recherche + « les miennes »).
- [x] Fiche joueur enrichie : badges / hauts faits calcules (niveau, victoires, quiz, serie, VIP, amis...) visibles sur la fiche joueur et le profil.
- [x] Partage de resultats ameliore (image generee du score de quiz pour WhatsApp).
- [x] Centre de notifications in-app (cloche 🔔) regroupant cadeaux, demandes d'amis et defis, avec badge non-lus.
- [x] Onboarding gamifie : 3 mini-etapes recompensees (jouer +50, gagner +100, personnaliser +50 Libs).
- [x] Quiz : anti-repetition des questions persistee en base (survit aux redemarrages Render).

Admin :
- [x] Recherche + tri dans la liste des joueurs (activite, Libs, recents, A-Z).
- [x] Repondre publiquement a une idee depuis le dashboard.
- [x] Monitoring d'erreurs backend : journal d'erreurs serveur dans le dashboard (routes, exceptions, promesses rejetees), sans dependance externe -> remplace le besoin de Sentry pour etre alerte avant les joueurs.
- [x] Notifications push ciblees par segment (tous, inactifs 7 j+, actifs, VIP, gros joueurs) avec estimation de l'audience joignable.
- [x] Annonces / push programmes (a une date/heure).
- [x] Comparaison de periodes (7 j vs 7 j) dans le dashboard.
- [x] Auto-moderation par mots interdits (pseudos, commentaires, suggestions, commentaires video).
- [x] Gestion des prix de livres depuis le dashboard.
- [x] Alertes admin par push (achat, fraude, erreur serveur) avec destinataires configurables depuis la fiche joueur.
- [x] Mode maintenance (banniere sur le site + bascule au dashboard).
- [x] Sauvegarde JSON en un clic.

## Bonus faits en passant
- [x] Compte : afficher/masquer le mot de passe + confirmation a la creation.
- [x] Le Mot : indice du jour (enigme retorse a double sens, un clic pour le reveler, un seul par jour, sans jamais contenir la reponse, FR + EN).
- [x] Quiz : image de partage refaite facon carte de trophee (titre serif, pastille categorie, chiffre dore + halo, lauriers, pastille Solo/rang).
- [x] Quiz : la musique de fond s'ecarte pendant la boucle du quiz (pas de chevauchement) et reprend apres.
- [x] Onglet Boutique : etat actif (bleu) pose a l'ouverture, rendu a l'ecran de fond a la fermeture.
- [x] Profil : solde de Libs en affichage seul (non cliquable).
- [x] Profil : carte « Signaler un bug » (modal -> /api/bug-report, section dediee + traiter/supprimer dans le dashboard).
- [x] Reglages : le curseur de volume musique applique le changement immediatement (meme en pause), plus seulement quand la musique joue deja.
- [x] Boutique : depuis l'overlay boutique, cliquer un onglet la ferme et affiche l'ecran meme si c'est l'ecran de fond (le garde-fou meme-ecran bloquait).
- [x] Admin : notifications push ciblees par segment + estimation d'audience.
- [x] Admin : journal d'erreurs serveur dans le dashboard (alerte avant les joueurs, sans Sentry).

## Nouvelles idees d'amelioration de l'experience (a discuter / prioriser)
Retention et habitude :
- [ ] **Recompense de connexion quotidienne** avec calendrier de serie (J1 -> J7, gros lot le 7e jour), en plus du streak actuel.
- [ ] **Objectif hebdomadaire** simple (« joue 5 parties cette semaine ») avec une jauge visible sur l'accueil.
- [ ] **Notifications de retour** plus fines (rappel du mot du jour non joue, roue gratuite non tournee, defi presque fini).

Social :
- [ ] **Chat rapide / emotes** dans le salon d'attente d'un duel (avant que la partie commence).
- [ ] **Mini-profils cliquables partout** (deja sur les classements) etendus a l'historique et aux salons.
- [ ] **Classement entre amis** (un onglet « Mes amis » dans les classements, moins ecrasant que le general).
- [ ] **Partage du niveau / des badges** en image (comme le score de quiz).

Confort et clarte :
- [ ] **Recherche dans le catalogue de lecture** et filtres (gratuit / debloque / par tome).
- [ ] **Barre de recherche globale** (jeux, livres, reglages) depuis l'accueil.
- [ ] **Mode faible connexion** : precharger moins, afficher des squelettes, reessayer en douceur (public au Benin, data limitee).
- [ ] **Tutoriel rejouable** depuis les Reglages (relancer le guide quand on veut).
- [ ] **Accessibilite** : taille de texte ajustable, contraste renforce en option.

Jeux et contenu :
- [ ] **Le Petit Bac** et **Le Pendu** (deja listes plus haut) pour completer les jeux de mots.
- [ ] **Quiz quotidien commun** (meme 10 questions pour tous dans la journee, classement du jour).
- [ ] **Evenements a theme** (week-end double Libs, quiz special fete nationale du Benin le 1er aout).

Monetisation douce (sans agressivite) :
- [ ] **Pack de bienvenue** unique a prix reduit pour les nouveaux (premiere semaine).
- [ ] **Cadeau surprise** offert par l'admin lors d'un palier de niveau (fidelisation).

Technique / pilotage :
- [ ] **Analytics d'entonnoir** (visite -> 1re partie -> retour J+1) dans le dashboard.
- [ ] **Monitoring d'erreurs backend** (Sentry) : alerte avant les joueurs. *(necessite un DSN a fournir)*
- [ ] **Notifications push ciblees** (segments : inactifs, VIP, gros joueurs).
- [ ] **Decoupe du monolithe `app.js`** pour accelerer le premier chargement (par etapes prudentes).

## Cosmetiques & themes a ajouter en boutique (idees)
Toutes les idees sont bilingues (nom FR / EN) et reutilisent les types deja en place
(voir COSMETICS dans server.js + `_cosmeticPreviewHtml` cote client). Un nouveau
cosmetique = une ligne dans COSMETICS (id, type, price) + son rendu (CSS pour les
fonds/effets, emoji pour les previews) + son nom dans `shop*Names` FR et EN.

Fonds d'ecran (`background`) : nouveaux decors animes / degrades.
- [ ] **Coucher sur la lagune / Lagoon Sunset** : degrade orange-violet (ambiance Cotonou au bord de l'eau).
- [ ] **Marche de nuit / Night Market** : lumieres chaudes qui scintillent doucement.
- [ ] **Wax & Motifs / Wax Patterns** : motifs pagne africain geometriques (identite locale forte).
- [ ] **Matrice verte / Green Rain** : pluie de caracteres facon Matrix (tres populaire chez les ados).
- [ ] **Terrain de foot / Pitch Lines** : lignes de stade sous les projecteurs.
- [ ] **Sable & vagues / Sand & Waves** : plage animee (complete la collection ete deja presente).
- [ ] **Ciel d'orage / Thunder Sky** : eclairs occasionnels sur fond sombre.
- [ ] **Neons Harmattan / Dusty Neon** : brume ocre + neons (saison seche au Benin).

Effets de nom (`nameeffect`) et couleurs (`color`) :
- [ ] **Effet flammes / Flames** : le pseudo semble bruler par le bas.
- [ ] **Effet glace / Frost** : reflets bleus givres.
- [ ] **Effet dore royal / Royal Gold** : brillance metallique qui balaie le texte.
- [ ] **Effet machine a ecrire / Typewriter** : le pseudo se retape en boucle.
- [ ] **Couleur pagne / Wax Palette** : degrade inspire des couleurs du pagne.
- [ ] **Couleur drapeau Benin / Benin Flag** (vert/jaune/rouge) : a sortir pour le 1er aout.

Titres (`title`) : a debloquer par exploit ou a acheter.
- [ ] **Le Sage / The Wise** (test de QI eleve), **L'Increvable / Unstoppable** (grosse serie),
  **Le Genereux / The Generous** (beaucoup de cadeaux offerts), **Cerveau / Big Brain** (quiz),
  **Roi du Mot / Word King** (series au Mot), **Vagabond / Globetrotter** (a joue a tous les jeux).

Avatars (`avatar`) : emoji marquants pour les ados.
- [ ] Ballon de foot ⚽, manette retro 🕹️, tete de mort stylee 💀, licorne 🦄, dragon 🐉,
  couronne 👑 (si pas deja), lion 🦁, fantome 👻.

Skins de jeux (par jeu, forte valeur percue) :
- [ ] **Snake** (`snakeskin`) : serpent doré, serpent pixel/8-bit, serpent arc-en-ciel anime, serpent flamme.
- [ ] **Puissance 4** (`p4token`) : jetons emoji (etoiles/lunes, coeurs/piques, ballons foot).
- [ ] **Morpion** (`ttt`) : nouvelles paires (soleil/eclair, roi/reine, chat/souris).
- [ ] **Echecs / Dames** (`chess`) : jeu de pieces « or & obsidienne », theme bois clair/fonce.
- [ ] **Curseur de Snake** (`cursorsnake`) : nouvelles tetes de curseur.

Effets de clic (`clickfx`) et packs de son (`soundpack`) :
- [ ] Clic : petales, pieces qui sautent, mini-eclairs, bulles de savon, notes de musique.
- [ ] Son : pack « arcade retro », pack « doux/feutre », pack « percussions africaines » (djembe).

Bannieres de victoire (`victoryban`) et bulles de chat (`bubble`) :
- [ ] Bannieres : « feu d'artifice », « pluie de confettis dorée », « KO » facon jeu de combat.
- [ ] Bulles : forme nuage, forme pixel, bord neon, style pagne.

Emotes (`emote`) : la carte Emotes du profil.
- [ ] Nouvelles reactions : 🤝 respect, 🧠 bien joue, 🐐 GOAT, 🫡 salut militaire,
  😴 tu dors ?, 🔥 en feu (si pas deja), 🎯 dans le mille, 🤡 (chambrage bon enfant).

Nouveaux TYPES de cosmetiques (plus ambitieux, a evaluer) :
- [ ] **Cadre de profil / Profile Frame** : bordure decorative autour de l'avatar (bois, or, neon, pagne).
- [ ] **Theme complet / Full Theme** : un pack qui pose d'un coup fond + couleur + bulle + son assortis
  (vendu en bundle « collection »), plus simple pour le joueur que d'assembler piece par piece.
- [ ] **Baniere de profil / Profile Banner** : grande image en haut de la fiche joueur.
- [ ] **Animation d'entree en salon / Join Animation** : petit effet quand le joueur rejoint un duel.
- [ ] **Skin de la roue / Wheel Skin** : habillage de la roue de la fortune.

Collections / bundles thematiques (regrouper plusieurs items ci-dessus) :
- [ ] **Collection Benin / Benin Pack** (drapeau, pagne, djembe, marche de nuit) : sortie 1er aout.
- [ ] **Collection Foot / Football Pack** (terrain, jetons ballon, emote GOAT) : pendant une CAN / Mondial.
- [ ] **Collection Retro / Arcade Pack** (fond pixel, sons arcade, snake 8-bit).
- [ ] **Collection Nuit / Night Pack** (marche de nuit, neons, ciel d'orage).
- [ ] **Collections saisonnieres tournantes** : ete (deja la), Harmattan (saison seche), rentree, fetes.

Note : la boutique et l'admin savent deja **forcer un cosmetique dans/hors boutique avec compte a
rebours** (shopOverrides) et faire des **offres flash**. Les collections saisonnieres peuvent donc etre
pilotees sans code, une fois les cosmetiques crees.
