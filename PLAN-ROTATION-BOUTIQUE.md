# Rotation automatique de la boutique (moteur + plan sur 2 semaines)

La boutique tourne **toute seule** une fois lancee : chaque jour un **nouvel arrivage**
est publie et un lot d'anciens objets est annonce comme partant, avec une **notification
a chaque etape** (arrivee, « part dans 1 jour », « part dans 1 heure », « a quitte la
boutique »). Plus aucune action manuelle quotidienne.

Fichier de travail, non publie (les `*.md` sont exclus du deploiement Vercel).

---

## 1. Comment ca marche (moteur)

- **Backend** : `ROTATION_PLAN` (tableau, 1 entree par jour) + moteur `_runShopRotation`
  (interval 60 s) dans `backend/server.js`. Etat persiste dans `server_config`
  (`_id:'shop_rotation'`), donc **survit aux redemarrages Render**. Idempotent : chaque
  sous-evenement (arrivage, 1 jour, 1 heure, retrait) ne part qu'une fois.
- **Timing** (pas de 24 h par defaut, reglable) : un objet annonce partant le **jour i**
  disparait au drop du **jour i+1**.
  - Au drop du jour i : **arrivage** publie + notif ; les departures du jour i passent en
    **« part dans 1 jour »** (avec compte a rebours `.shop-tile-timer` dans la boutique).
  - 1 h avant le retrait : **« part dans 1 heure »**.
  - Au drop suivant : **retrait effectif** (`inShop:false`) + notif « a quitte la boutique ».
- **Notifications** : une **notice in-app par cosmetique** (toast + cloche 🔔, nom
  localise FR/EN via `shop-rotation-notice`) ; **un seul push groupe par etape** (pour ne
  pas envoyer 20 push identiques un jour de gros retrait).
- **Arrivages non encore codes** : les ids d'arrivage qui n'existent pas encore dans
  `COSMETICS` sont **ignores en silence** (pas de notif). On peut donc lancer le moteur et
  **coder les nouveaux cosmetiques au fur et a mesure** ; l'arrivage s'activera tout seul
  le jour venu si l'objet existe. Les **departures** (catalogue actuel) marchent, elles,
  immediatement.

## 2. Pilotage (dashboard, section « 🔄 Rotation automatique de la boutique »)

- **Demarrer maintenant** : lance la rotation (startAt = maintenant), intervalle reglable
  (defaut 24 h). Applique tout de suite le jour 0 s'il est du.
- **Arreter** : met en pause (ne retire rien de plus).
- **Reinitialiser** : arrete ET **reintegre** les objets deja retires (retour au defaut).
- Le tableau montre, jour par jour : l'arrivage, les departs, l'etat (publie / retire) et
  **les ids d'arrivage encore a coder** (en rouge).
- Endpoints : `GET/POST /admin/shop-rotation` (`action: start|stop|reset`, `startAt?`,
  `stepHours?`). Audite (`rotation-start/stop/reset/arrival/remove`).

## 3. Pre-requis

- [x] **Coder les nouveaux cosmetiques** : les 14 ids d'arrivage du plan existent
  desormais (7 fonds, 2 couleurs, 2 effets de nom, 1 skin snake, 2 titres), avec rendu
  CSS et noms FR/EN. `GET /admin/shop-rotation` renvoie `knownArrivals: 14/14`. Les autres
  cosmetiques des collections (avatars, jetons, sons, bannieres, emotes) restent a coder
  si tu veux etoffer chaque collection au dela de son item phare.
- [ ] **Noyau permanent** (jamais retire, pour qu'un nouveau joueur ait toujours de quoi
  se personnaliser a petit prix) : `font-monoton` (gratuit), `bg-ardoise` (15),
  `silver` (20), `bronze` (20), `title-tactician` (15).

---

## 4. Plan des 14 jours (tel que code dans `ROTATION_PLAN`)

Un **arrivage par jour** ; les **departs** vont du moins cher/moins prestigieux vers le
premium (grand solde final au jour 14).

| Jour | Arrivage (id a creer) | Collection | Departs (retires au drop suivant) |
|------|-----------------------|------------|-----------------------------------|
| J1 | `bg-wax` | Benin | `font-pacifico`, `font-lobster`, `font-fredoka` |
| J2 | `bg-marche-nuit` | Benin | `bg-nuit`, `bg-brume` |
| J3 | `color-benin` | Benin | `font-pressstart`, `font-vt323` |
| J4 | `bg-terrain` | Foot | `font-sharetech`, `font-majormono`, `bg-aurore-deg` |
| J5 | `bg-matrice` | Retro | `bg-crepuscule`, `bg-cyber` |
| J6 | `snakeskin-8bit` | Retro | `bg-circuit`, `nameeffect-blink`, `cursorsnake-pixel` |
| J7 | `bg-harmattan` | Nuit | `bg-hexagones`, `bg-etoile` |
| J8 | `bg-orage` | Nuit | `nameeffect-pulse`, `title-strategist`, `cursorsnake-neon` |
| J9 | `nameeffect-flammes` | Perso nom | `bg-particules`, `bg-pluie`, `bg-vagues` |
| J10 | `nameeffect-glace` | Perso nom | `cursorsnake-comet`, `cursorsnake-electric`, `snakeskin-gems`, `snakeskin-cyber` |
| J11 | `color-pagne` | Perso nom | `nameeffect-gradient`, `nameeffect-sparks`, `nameeffect-glitch`, `font-orbitron`, `font-rajdhani` |
| J12 | `title-sage` | Titres | `font-chakra`, `font-audiowide`, `font-exo2`, `font-bungee`, `font-blackops`, `font-russo` |
| J13 | `title-wordking` | Titres | `title-quizmaster`, `title-snakeking`, `title-unbeaten` |
| J14 | `bg-lagune` | Final | **Grand solde** : `bg-synthwave`, `bg-nebuleuse`, `bg-aurores`, `bg-galaxie`, `bg-tempete`, `bg-hologramme`, `nameeffect-rainbow`, `cursorsnake-stars`, `cursorsnake-fire`, `snakeskin-lava`, `snakeskin-galaxy`, `snakeskin-rainbow`, `font-cinzel`, `font-tektur`, `gold`, `diamond`, `rainbow`, `galaxy`, `title-champion`, `title-legend` |

Le lot du J14 est retire un jour apres le dernier drop. Pour **modifier le plan** (ajouter
des jours, changer arrivages/departs), editer `ROTATION_PLAN` dans `backend/server.js`
puis redeployer.

Note : le plan ci-dessus ne fait arriver qu'**un id par jour** (l'item phare de la
collection). Les autres cosmetiques d'une collection peuvent etre codes puis ajoutes dans
la boutique via le **catalogue admin** (`inShop:true`) sans passer par la rotation, ou en
etoffant `ROTATION_PLAN`.

---

## 5. A ne pas oublier

- **`_FEATURED_IDS`** (app.js) contient encore d'anciens premium (`bg-hologramme`,
  `bg-galaxie`, `bg-synthwave`, `rainbow`, `gold`, `nameeffect-rainbow`,
  `title-champion`, `diamond`) retires au J14 : apres la rotation, **remplacer cette
  liste** par de nouveaux ids vedettes, sinon « A la une » met en avant des objets qui ne
  sont plus vendus.
- **Reversibilite** : « Reinitialiser » reintegre tout. Les objets retires restent dans
  les casiers de ceux qui les ont (ils ne sont juste plus vendus).
- **Prix des nouveaux** : caler sur la grille actuelle (fonds 10 a 300, effets 90 a 180,
  titres 15 a 130, skins 50 a 200).
- **Emotes** : gerees dans la carte Emotes du profil (pas la boutique d'objets) ; une
  nouvelle emote apparait toute seule des qu'elle existe.
