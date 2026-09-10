/* ══════════════════════════════════════════════════════════════════════════
   Icones 3D (lucide-react)

   Le site garde son jeu d'icones a trait (UI_ICONS dans app.js) : il est
   peint immediatement, sans reseau, et reste le repli si ce module echoue.
   Ce module-ci charge le VRAI paquet lucide-react (avec React) depuis le
   CDN, en module ES natif : aucun bundler, aucune etape de build.
   Il repeint ensuite chaque [data-ic] en relief.

   Il est volontairement non bloquant : il arrive apres le premier pixel et
   n'entre jamais dans le chemin critique du demarrage.
   ══════════════════════════════════════════════════════════════════════════ */

const REACT_V  = '18.3.1';
const LUCIDE_V = '0.544.0';

/* data-ic  ->  [composant lucide, teinte claire, teinte sombre] */
const MAP = {
  /* ── Site ── */
  home:['House','#c7d2fe','#3730a3'],          bulb:['Lightbulb','#fde68a','#b45309'],
  book:['BookOpen','#bae6fd','#1d4ed8'],       cart:['ShoppingCart','#ddd6fe','#5b21b6'],
  target:['Target','#fbcfe8','#9d174d'],       grid:['LayoutGrid','#c7d2fe','#3730a3'],
  cap:['GraduationCap','#a5f3fc','#0e7490'],   calendar:['PartyPopper','#fbcfe8','#9d174d'],
  zap:['Zap','#fde68a','#b45309'],             letter:['Type','#c7d2fe','#3730a3'],
  robot:['Bot','#a5f3fc','#0e7490'],           bell:['Bell','#fed7aa','#c2410c'],
  star:['Star','#fef08a','#a16207'],           crown:['Crown','#fde68a','#a16207'],
  rocket:['Rocket','#fecaca','#b91c1c'],       circle:['Circle','#cbd5e1','#334155'],
  medal:['Medal','#fde68a','#a16207'],         wheel:['Disc3','#ddd6fe','#5b21b6'],
  pulse:['Brain','#fbcfe8','#9d174d'],         userplus:['UserPlus','#bbf7d0','#15803d'],
  archive:['Backpack','#fed7aa','#c2410c'],    smile:['Smile','#fde68a','#b45309'],
  sparkle:['Sparkles','#e9d5ff','#7e22ce'],    clock:['Clock','#bae6fd','#1d4ed8'],
  users:['Users','#bbf7d0','#15803d'],         key:['KeyRound','#fde68a','#a16207'],
  save:['ShieldCheck','#a5f3fc','#0e7490'],    gear:['Settings','#cbd5e1','#334155'],
  bug:['Bug','#bbf7d0','#15803d'],             trash:['Trash2','#fecaca','#b91c1c'],
  eye:['Eye','#cbd5e1','#334155'],             eyeoff:['EyeOff','#cbd5e1','#334155'],
  check:['CircleCheck','#bbf7d0','#15803d'],
  /* ── Ajouts profil ── */
  message:['MessageSquareHeart','#fbcfe8','#9d174d'],
  help:['CircleQuestionMark','#a5f3fc','#0e7490'],
  /* ── Espace admin ── */
  chart:['ChartColumn','#c7d2fe','#3730a3'],   jar:['Database','#bae6fd','#1d4ed8'],
  trend:['TrendingUp','#bbf7d0','#15803d'],    megaphone:['Megaphone','#fed7aa','#c2410c'],
  tools:['Wrench','#cbd5e1','#334155'],        ban:['Ban','#fecaca','#b91c1c'],
  disk:['HardDrive','#bae6fd','#1d4ed8'],      refresh:['RefreshCw','#a5f3fc','#0e7490'],
  video:['Clapperboard','#e9d5ff','#7e22ce'],  shop:['Store','#ddd6fe','#5b21b6'],
  sleep:['Moon','#c7d2fe','#3730a3'],          siren:['Siren','#fecaca','#b91c1c'],
  list:['ClipboardList','#cbd5e1','#334155'],  chat:['MessageSquare','#bae6fd','#1d4ed8'],
  card:['CreditCard','#bbf7d0','#15803d'],     warn:['TriangleAlert','#fde68a','#b45309'],
  gift:['Gift','#fbcfe8','#9d174d'],           down:['Download','#c7d2fe','#3730a3'],
  edit:['Pencil','#fde68a','#a16207'],         close:['X','#fecaca','#b91c1c'],
  /* ── Chrome du site : retour, fermeture, partage, titres d'ecran ── */
  back:['ArrowLeft','#c7d2fe','#3730a3'],      fwd:['ArrowRight','#c7d2fe','#3730a3'],
  up:['ChevronUp','#c7d2fe','#3730a3'],        down2:['ChevronDown','#c7d2fe','#3730a3'],
  share:['Share2','#a5f3fc','#0e7490'],        quit:['LogOut','#fecaca','#b91c1c'],
  send:['SendHorizontal','#c7d2fe','#3730a3'], trophy:['Trophy','#fde68a','#a16207'],
  run:['Footprints','#bbf7d0','#15803d'],      flame:['Flame','#fed7aa','#c2410c'],
  user:['User','#cbd5e1','#334155'],           sun:['Sun','#fde68a','#b45309'],
  swords:['Swords','#fecaca','#b91c1c'],       clap:['Clapperboard','#e9d5ff','#7e22ce'],
};

/* Reglages du relief. */
const TILT = 15;   // inclinaison avant/arriere, en degres
const TURN = -13;  // rotation dans le plan, en degres
const SW   = 2;    // epaisseur du trait

/* L'epaisseur du volume suit la taille : a 22px dans la barre de nav, six
   couches empilees deviennent une bouillie. */
function couches(taille) {
  if (taille <= 20) return 2;
  if (taille <= 26) return 3;
  if (taille <= 34) return 4;
  return 6;
}

/* Le degre partage par toutes les faces, pose une seule fois. */
function poseDegrade() {
  if (document.getElementById('ic3d-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'ic3d-defs';
  s.setAttribute('width', '0'); s.setAttribute('height', '0');
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = `<defs>
    <linearGradient id="ic3d-lux" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0"   stop-color="#ffffff"/>
      <stop offset=".38" stop-color="currentColor"/>
      <stop offset="1"   stop-color="currentColor" stop-opacity=".55"/>
    </linearGradient></defs>`;
  document.body.appendChild(s);
}

let React, createRoot, L, pret = false;

async function charger() {
  /* esm.sh et son parametre ?deps : sans lui, react-dom et lucide-react
     embarquent chacun LEUR copie de React. Les elements fabriques par l'une
     sont alors etrangers a l'autre et React refuse de les rendre (erreur 31).
     Le ?deps force les trois a partager la meme instance. */
  const D = `?deps=react@${REACT_V}`;
  const [r, rd, l] = await Promise.all([
    import(`https://esm.sh/react@${REACT_V}`),
    import(`https://esm.sh/react-dom@${REACT_V}/client${D}`),
    import(`https://esm.sh/lucide-react@${LUCIDE_V}${D}`)
  ]);
  React = r.default || r;
  createRoot = rd.createRoot;
  L = l;
  poseDegrade();
  pret = true;
}

/* Un composant : la face en degre, posee sur des copies sombres decalees. */
function Icone({ nom, taille }) {
  const h = React.createElement;
  const def = MAP[nom];
  const C = (def && L[def[0]]) || L.Circle;
  const n = couches(taille);
  const enfants = [];
  for (let i = n; i >= 1; i--) {
    enfants.push(h(C, {
      key: 'd' + i, size: taille, strokeWidth: SW, className: 'ic3d-depth',
      style: { transform: `translate(${i * .7}px, ${i * .7}px)`, opacity: .35 + i * .055 }
    }));
  }
  enfants.push(h(C, { key: 'f', size: taille, strokeWidth: SW, className: 'ic3d-face' }));
  return h('span', {
    className: 'ic3d',
    style: {
      width: taille, height: taille,
      '--ic-lite': def ? def[1] : 'currentColor',
      '--ic-dark': def ? def[2] : '#334155',
      '--ic-tilt': TILT + 'deg', '--ic-turn': TURN + 'deg'
    }
  }, enfants);
}

/* La taille reelle du logement, pour ne pas deborder d'une barre de nav. */
function tailleDe(el) {
  const r = el.getBoundingClientRect();
  const t = Math.round(Math.max(r.width, r.height));
  if (t >= 14 && t <= 96) return t;
  const fs = parseFloat(getComputedStyle(el).fontSize) || 20;
  return Math.max(16, Math.min(72, Math.round(fs * 1.25)));
}

const racines = new WeakMap();

export function peindre3d(root = document) {
  if (!pret) return;
  root.querySelectorAll('[data-ic]').forEach(el => {
    const nom = el.getAttribute('data-ic');
    if (!MAP[nom]) return;                       // inconnu : on garde le trait
    if (racines.get(el) === nom) return;          // deja peint avec la meme icone
    const taille = tailleDe(el);
    el.textContent = '';
    const racine = createRoot(el);
    racine.render(React.createElement(Icone, { nom, taille }));
    racines.set(el, nom);
    el.classList.add('has-ic3d');
  });
}

charger().then(() => {
  peindre3d();
  window._peindre3d = peindre3d;
  /* app.js repeint des icones a chaque rendu dynamique (casier, boutique,
     classements) : on se branche derriere son peintre a trait. */
  const orig = window.paintUiIcons;
  if (typeof orig === 'function') {
    window.paintUiIcons = (root = document) => { orig(root); peindre3d(root); };
  }
  /* Le site et le tableau de bord fabriquent des icones a la volee (casier,
     boutique, classements, lignes de l'admin). Un observateur repeint tout
     nouveau logement sans que chaque appelant ait a y penser. */
  let enAttente = false;
  new MutationObserver(muts => {
    if (enAttente) return;
    const neuf = muts.some(m => Array.from(m.addedNodes).some(
      n => n.nodeType === 1 && (n.hasAttribute?.('data-ic') || n.querySelector?.('[data-ic]'))));
    if (!neuf) return;
    enAttente = true;
    requestAnimationFrame(() => { enAttente = false; peindre3d(); });
  }).observe(document.body, { childList: true, subtree: true });

  document.dispatchEvent(new CustomEvent('ic3d-pret'));
}).catch(err => {
  console.warn('[icones 3D] indisponibles, le jeu a trait est conserve :', err && err.message);
});
