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
