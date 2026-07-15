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
- [ ] **Recompense de connexion quotidienne** (visible joueur, faible risque).
- [ ] **Analytics d'entonnoir** dans le dashboard (visite -> 1re partie -> retour J+1).
- [ ] **Decoupe du monolithe `app.js`** pour accelerer le premier chargement (delicat,
  a faire en etapes prudentes).

## Pistes secondaires (experience joueur / admin)
Joueur :
- [ ] Recherche / filtre dans la section Idees (par score, recentes, « les miennes »).
- [ ] Fiche joueur publique enrichie (avatar, badges, meilleurs scores).
- [ ] Partage de resultats ameliore (image generee du score de quiz pour WhatsApp).

Admin :
- [ ] Recherche + tri dans la liste des joueurs (par Libs, activite, date).
- [ ] Repondre publiquement a une idee depuis le dashboard.
- [ ] Monitoring d'erreurs backend (Sentry) pour etre alerte avant les joueurs.
- [ ] Notifications push ciblees (par segment : inactifs, VIP, gros joueurs).
