# Libero's Multi

Site de jeux et de lecture multijoueur en temps reel, developpe par HOUNKPEVI Olympe.
Bilingue FR/EN, pense d'abord pour le mobile (public : eleves et ados au Benin).

Site : https://libero-multi.vercel.app

## Structure du depot

```
.
├── index.html          Page unique (SPA statique)
├── app.js              Toute la logique front (monolithe)
├── style.css           Styles
├── config.js           Bascule l'URL backend (local vs production)
├── stats.html          Tableau de bord admin prive (acces par cle)
├── legal.html          Mentions legales / CGV / confidentialite
├── manifest.json       PWA (installable)
├── sw.js               Service worker (cache reseau d'abord)
├── vercel.json         Config de deploiement Vercel (sert la racine en statique)
├── assets/             Images : logos, icones PWA, image de partage
├── sounds/             Audio : musique de fond + sons d'interface
├── runner-sprites/     Sprites du mini-jeu Libero Run
└── backend/            Serveur Node/Express + Socket.IO (deploye a part, sur Render)
    ├── server.js       API + temps reel (jeux, quiz, classements, boutique...)
    ├── game-*.js       Logique des jeux (dames, ludo, quiz...)
    └── books/          Chapitres des livres exclusifs (jamais servis en statique)
```

## Deploiement

- `git push` sur `main` declenche le deploiement : **Vercel** (frontend, sert la racine)
  et **Render** (backend) se redeploient automatiquement.
- Le backend et les fichiers `*.md` ne sont jamais publies sur le site statique
  (voir `.vercelignore`).

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
