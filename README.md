# Libero's Multi

Site de jeux et de lecture multijoueur en temps reel, developpe par HOUNKPEVI Olympe.
Bilingue FR/EN, pense d'abord pour le mobile (public : eleves et ados, surtout au Benin).
Design « Cahier et ardoise » : papier ligne (theme clair par defaut) ou tableau noir.

Site : https://libero-multi.vercel.app

## Fonctionnalites

- **Jeux multijoueur en temps reel** : Puissance 4, Tic Tac Toe, Echecs, Dames
  (regles internationales 10x10 par defaut, ou anglaises 8x8), Ludo (salon de 2 a 4).
  Contre un ami (code a 4 lettres, lien, « Defier un ami ») ou contre le robot
  (facile, moyen, difficile). Mises de 25, 50 ou 100 Libs.
- **Culture generale** : quiz de 15 themes (dont Benin), solo ou salon jusqu'a 6 joueurs.
- **Le Mot** : un mot mystere de 5 lettres en 6 essais, chaque jour.
- **Evenements** : Snake Challenge le week-end, Libero Run, tournoi du samedi.
- **Lecture** : romans exclusifs lus chapitre par chapitre (FR/EN).
- **Profil** : carnet de correspondance (niveaux 1 a 60), portrait dessine, hauts faits
  (tampons), historique, amis, compte optionnel (pseudo + mot de passe).
- **Libs** (monnaie virtuelle) : roue de la fortune, defis du jour, serie, boutique
  (cosmetiques, packs, modeles de portrait des joueurs), cadeaux entre amis, Pass VIP.
- **Mes mots** : chat prive entre amis (30 jours, signaler / bloquer, push regroupees).
- **Libe** : assistant (crayon). Aide du site par fiches ; **Libe IA** (Gemini ou
  Claude) a cocher dans les reglages, avec quotas (jauge « encrier »).
- **Idees** : tableau ou les joueurs proposent et votent.
- **Admin** : tableau de bord prive `stats.html` (cle admin).

## Structure du depot

```
.
├── index.html          Page unique (SPA statique)
├── app.js              Toute la logique front (monolithe)
├── chat.js             Fenetre « Mes mots », chargee a la premiere ouverture
├── portrait.js         Moteur des portraits dessines
├── wordle-words.js     Mots du jeu « Le Mot »
├── icons3d.js          Icones en relief
├── style.css           Styles d'origine
├── cahier.css          Design actuel « Cahier et ardoise » (prioritaire, :root:root)
├── config.js           Bascule l'URL backend (local vs production)
├── stats.html          Tableau de bord admin prive (acces par cle)
├── stats-classique.html Ancienne vue du tableau de bord
├── legal.html          Mentions legales, CGV, confidentialite, regles (FR/EN)
├── manifest.json       PWA (installable)
├── sw.js               Service worker (bumper CACHE a chaque deploiement front)
├── vercel.json         Config de deploiement Vercel
├── assets/             Images : logos, icones PWA, image de partage, pions, photos
├── sounds/             Audio : musique de fond + sons d'interface
└── backend/            Serveur Node/Express + Socket.IO (deploye a part, sur Render)
    ├── server.js       API + temps reel (jeux, quiz, classements, boutique, chat, Libe IA)
    ├── game-*.js       Logique des jeux (echecs, dames, ludo, quiz, robots...)
    └── books/          Chapitres des livres exclusifs (jamais servis en statique)
```

## Deploiement

- `git push` sur `main` declenche le deploiement : **Vercel** (frontend, sert la racine)
  et **Render** (backend) se redeploient automatiquement.
- Le backend, `.env` et les fichiers `*.md` ne sont jamais publies sur le site statique
  (voir `.vercelignore`).
- Ne jamais commiter `backend/.env`.

## Variables d'environnement (Render)

| Variable | Role |
|---|---|
| `MONGODB_URI` | Base MongoDB Atlas (sans elle : rien n'est sauvegarde) |
| `ADMIN_KEY` | Cle du tableau de bord admin |
| `ALLOWED_ORIGINS`, `FRONTEND_URL` | Origines autorisees (CORS) et URL du site |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifications push |
| `GEMINI_API_KEY` ou `ANTHROPIC_API_KEY` | Libe IA (Gemini prioritaire si les deux) |
| `LIBE_PROVIDER`, `LIBE_MODEL` | Forcer le fournisseur ou le modele de Libe IA |
| `LIBE_PER_DAY`, `LIBE_DAILY_CAP`, `LIBE_MONTHLY_CAP` | Quotas de Libe IA |
| `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_API_BASE`, `LIBS_TOPUP_ENABLED` | Recharge de Libs (fermee pour l'instant) |
| `PROMO_CODES`, `PROMO_FILL_CODE` | Codes promo |
| `RENDER_EXTERNAL_URL` / `SELF_URL` | Keep-alive du serveur |
| `SNAKE_EVENT_FORCE` | Forcer l'evenement Snake hors week-end (tests) |

## Lancer en local

```bash
# Backend (sans Mongo, avec une cle admin de test) :
cd backend && env PORT=3001 MONGODB_URI= ALLOWED_ORIGINS=http://localhost:8123 ADMIN_KEY=testkey123 node server.js

# Frontend statique, depuis la racine du projet :
python3 -m http.server 8123
# puis ouvrir http://localhost:8123/index.html
```

`config.js` bascule automatiquement l'URL du backend (localhost en dev, Render en prod).

## Stack

- Frontend statique sur **Vercel**
- Backend Node (Express + Socket.IO) sur **Render**
- Base de donnees **MongoDB Atlas**
- Paiements **FedaPay** (mobile money / carte) ; monnaie interne = les Libs
- IA de Libe : **Google Gemini** ou **Anthropic Claude** (optionnel)

## Regles du projet

- Aucun tiret cadratin, aucun emoji dans l'interface, tout texte visible en FR et EN.
- Toute interface a etat doit survivre a un F5.
- Maquette avant toute refonte visuelle.
