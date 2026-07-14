// ── Échappement HTML (anti-XSS) ───────────────────────────────────────────────
// Tout contenu venant d'un autre utilisateur (pseudo, message…) DOIT passer par
// ici avant d'être injecté en innerHTML.
function _escHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Identifiant joueur stable ─────────────────────────────────────────────────
// Identifiant secret servant de clé d'identité : il ne doit jamais être devinable
// ni divulgué. Généré via l'API cryptographique du navigateur (128 bits).
// Vrai UNIQUEMENT si aucun identifiant n'existait au chargement : sert à ne
// montrer l'animation de bienvenue qu'aux joueurs qui découvrent le site.
window.__liberoNewVisitor = !localStorage.getItem('libero_player_id');
function getPlayerId() {
  let id = localStorage.getItem('libero_player_id');
  if (!id) {
    if (window.crypto?.randomUUID) {
      id = window.crypto.randomUUID().replace(/-/g, '');
    } else if (window.crypto?.getRandomValues) {
      const b = new Uint8Array(16);
      window.crypto.getRandomValues(b);
      id = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    } else {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    localStorage.setItem('libero_player_id', id);
  }
  return id;
}

// ── Identifiant de visiteur (comptage de visites, non secret) ─────────────────
function getVisitorId() {
  let id = localStorage.getItem('libero_visitor_id');
  if (!id) {
    id = (window.crypto?.randomUUID ? window.crypto.randomUUID().replace(/-/g, '')
                                    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    localStorage.setItem('libero_visitor_id', id);
  }
  return id;
}
// Ping de visite : une fois par session d'onglet (best-effort, sans bloquer).
function pingVisit() {
  if (sessionStorage.getItem('libero_visit_pinged')) return;
  sessionStorage.setItem('libero_visit_pinged', '1');
  try {
    fetch(`${window.BACKEND_URL}/api/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId() }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

// ── Lien de partage : code de partie à rejoindre à l'ouverture (?join=CODE) ────
const pendingJoinCode = (() => {
  try {
    const c = new URLSearchParams(location.search).get('join');
    if (c) { // nettoie l'URL pour qu'un refresh ne relance pas la jointure
      const clean = location.pathname + location.hash;
      history.replaceState(null, '', clean);
      return c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    }
  } catch (e) {}
  return null;
})();

// Lien de parrainage ?ami=CODE : retenu uniquement pour un NOUVEAU visiteur,
// déclaré au serveur après connexion (récompense à sa première partie).
(() => {
  try {
    const c = new URLSearchParams(location.search).get('ami');
    if (c) {
      const clean = location.pathname + location.hash;
      history.replaceState(null, '', clean);
      if (!localStorage.getItem('libero_player_id')) {
        localStorage.setItem('libero_referrer_code', c.toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 8));
      }
    }
  } catch (e) {}
})();

// Lien cadeau ?gift=CODE : le destinataire ouvre le lien et le cosmétique (ou
// le pack) est échangé automatiquement, sans avoir à taper le code.
const pendingGiftCode = (() => {
  try {
    const c = new URLSearchParams(location.search).get('gift');
    if (c) { // nettoie l'URL pour qu'un refresh ne retente pas l'échange
      const clean = location.pathname + location.hash;
      history.replaceState(null, '', clean);
      return c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }
  } catch (e) {}
  return null;
})();

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
let _shopActiveSection      = 'featured'; // onglet boutique affiché (vue par onglets, pas de saut de scroll)
let _pendingShopFocus       = null;
let _pendingShopFocusIds    = null;
let _shopRetainTileId       = null;
let _focusDebounceTimer     = null;
let shopRotation            = null;
let _shopCountdownTimer     = null;
let refundCards             = 2;
let refundCardsNextRefill   = null;
let _libsAnimTimer     = null;
let libsPacksCache     = null; // [{ id, libs, label, priceFCFA, available }] · chargé depuis le serveur
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

// Note : la musique synthetisee (BGM ci-dessus) est desormais dormante. L'audio
// du site passe par SoundManager (fichiers dans sounds/). BGM n'est plus demarre.

// ── SoundManager : musique de fond + sons d'interface (fichiers) ─────────────
// L'audio est un bonus : toute defaillance doit rester invisible (jamais
// d'exception non capturee, jamais de fonctionnalite bloquee). Si le module
// echoue a l'init, window._sound reste un stub aux methodes vides.
let musicEnabled = (() => { try { return localStorage.getItem('libero_music') === '1'; } catch { return false; } })();
let SoundManager;
try {
  SoundManager = (() => {
    const SFX_FILES = {
      click: 'sounds/click.ogg', 'click-ok': 'sounds/click-ok.ogg', 'click-back': 'sounds/click-back.ogg',
      pop: 'sounds/pop.ogg', success: 'sounds/success.ogg', error: 'sounds/error.ogg',
      coin: 'sounds/coin.ogg', notify: 'sounds/notify.ogg',
      tick: 'sounds/tick.ogg', 'tick-final': 'sounds/tick-final.ogg',
    };
    const MUSIC_FILE = 'sounds/bg-music.mp3';
    const DEF_SFX_VOL = 0.5, DEF_MUSIC_VOL = 0.25;

    const LS = {
      get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    };
    const sfxOn    = () => LS.get('sfxEnabled', 'true') !== 'false';
    const musicOn  = () => LS.get('libero_music', '0') === '1';
    const sfxVol   = () => { const v = parseFloat(LS.get('sfxVolume', String(DEF_SFX_VOL))); return isNaN(v) ? DEF_SFX_VOL : v; };
    const musicVol = () => { const v = parseFloat(LS.get('bgmVolume', String(DEF_MUSIC_VOL))); return isNaN(v) ? DEF_MUSIC_VOL : v; };

    let started = false;               // 1re interaction utilisateur faite ?
    let sfxSupported = true, musicSupported = true;
    const buffers = {};                // name -> AudioBuffer decode (Web Audio)
    const unavailable = new Set();     // sons 404 / illisibles -> no-op
    let warned = false;
    const warn = (msg) => { if (!warned) { warned = true; try { console.warn('[sound] ' + msg); } catch {} } };

    // Sons d'interface via Web Audio API : on decode chaque fichier UNE fois en
    // AudioBuffer, puis chaque lecture cree un BufferSource instantane. C'est ce
    // qui elimine la latence des <audio>.cloneNode().play() (clics « en retard »).
    let actx = null;
    function ac() {
      if (actx) return actx;
      try { actx = new (window.AudioContext || window['webkitAudioContext'])(); }
      catch { actx = null; sfxSupported = false; }
      return actx;
    }

    // La musique reste en <audio> (streaming en boucle), donc test mp3 utile.
    try {
      const a = new Audio();
      musicSupported = !!(a.canPlayType && a.canPlayType('audio/mpeg'));
    } catch { musicSupported = false; }

    function preload() {
      const ctx = ac();
      if (!ctx || !sfxSupported) return;
      for (const [name, src] of Object.entries(SFX_FILES)) {
        (async () => {
          try {
            const res = await fetch(src);
            if (!res.ok) { unavailable.add(name); warn('fichier manquant: ' + src.split('/').pop()); return; }
            const arr = await res.arrayBuffer();
            // decodeAudioData : callback ET promesse selon les navigateurs.
            const buf = await new Promise((resolve, reject) => {
              let done = false;
              const p = ctx.decodeAudioData(arr, b => { if (!done) { done = true; resolve(b); } }, e => { if (!done) { done = true; reject(e); } });
              if (p && p.then) p.then(b => { if (!done) { done = true; resolve(b); } }, e => { if (!done) { done = true; reject(e); } });
            });
            buffers[name] = buf;
          } catch { unavailable.add(name); warn('son illisible: ' + src.split('/').pop()); }
        })();
      }
    }

    function play(name) {
      try {
        if (!started || !sfxOn() || !sfxSupported) return;
        if (unavailable.has(name)) return;
        const buf = buffers[name];
        const ctx = actx;
        if (!buf || !ctx) return;               // pas encore decode : on ignore (jamais d'attente)
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch {} }
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = sfxVol();
        src.buffer = buf;
        src.connect(g); g.connect(ctx.destination);
        src.start(0);
      } catch {}
    }

    // ── Musique de fond ──
    let music = null, musicWanted = false, fadeTimer = null, retryArmed = false;
    function ensureMusic() {
      if (music || !musicSupported) return;
      try {
        music = new Audio();
        music.loop = true; music.preload = 'auto'; music.volume = 0;
        music.addEventListener('error', () => { musicSupported = false; warn('musique illisible: bg-music.mp3'); });
        music.src = MUSIC_FILE;
      } catch { musicSupported = false; }
    }
    function fadeTo(target, ms) {
      if (!music) return;
      try { clearInterval(fadeTimer); } catch {}
      const from = music.volume || 0, steps = 24, dt = Math.max(16, ms / steps);
      let i = 0;
      fadeTimer = setInterval(() => {
        i++; const v = from + (target - from) * (i / steps);
        try { music.volume = Math.max(0, Math.min(1, v)); } catch {}
        if (i >= steps) { try { clearInterval(fadeTimer); } catch {} }
      }, dt);
    }
    function armRetry() {
      if (retryArmed) return; retryArmed = true;
      const h = () => { retryArmed = false; if (musicWanted) musicStart(); };
      document.addEventListener('click', h, { once: true });
      document.addEventListener('touchstart', h, { once: true });
    }
    function musicStart() {
      musicWanted = true;
      if (!musicSupported) return;
      ensureMusic();
      if (!music || !started) return; // avant la 1re interaction : on attend
      try { music.volume = 0; } catch {}
      const p = music.play();
      if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') armRetry(); });
      fadeTo(musicVol(), 1600);
    }
    function musicStop() {
      musicWanted = false;
      if (!music) return;
      try { clearInterval(fadeTimer); music.pause(); } catch {}
    }

    function onFirstInteraction() {
      if (started) return; started = true;
      preload();
      if (musicOn()) musicStart();
    }

    // Onglet en arriere-plan : coupe la musique, reprend au retour si active.
    document.addEventListener('visibilitychange', () => {
      if (!music || !musicWanted) return;
      if (document.hidden) { try { music.pause(); } catch {} }
      else { const p = music.play(); if (p && p.catch) p.catch(() => armRetry()); fadeTo(musicVol(), 500); }
    });
    document.addEventListener('click', onFirstInteraction, { once: true });
    document.addEventListener('touchstart', onFirstInteraction, { once: true });

    return {
      play,
      music: { start: musicStart, stop: musicStop, setVolume(v) { if (music && !music.paused) fadeTo(v, 200); } },
      _state() { return { started, sfxSupported, musicSupported, unavailable: [...unavailable] }; },
    };
  })();
} catch (e) { SoundManager = null; }
// Stub de secours : les appels _sound.* disperses dans app.js ne plantent jamais.
window._sound = SoundManager || { play() {}, music: { start() {}, stop() {}, setVolume() {} }, _state() { return { stub: true }; } };

let myPlayer        = null;   // 'R' | 'Y'
let gameActive      = false;
let currentRoomCode = null;
let currentGame     = null;   // 'connect4' | 'tictactoe' | 'chess'
let selectedGameType = null; // le joueur choisit son jeu (aucun présélectionné)
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
    navHome:'Accueil', navFeed:'Vidéos', navIdeas:'Idées',
    ideasTitle:'Idées & suggestions', ideasSub:'Propose une amélioration du site et vote pour celles des autres.',
    ideasSortTop:'🔥 Top', ideasSortNew:'🆕 Récentes', ideasNewBtn:'💡 Proposer',
    ideasLoading:'Chargement des idées…', ideasEmpty:'Aucune idée pour le moment.\nSois le premier à en proposer une !', ideasError:'Impossible de charger les idées.\nVérifie ta connexion et réessaie.',
    ideaNewTitle:'Proposer une idée', ideaNewIntro:'Décris une fonctionnalité ou une amélioration que tu aimerais voir sur le site.',
    ideaNewTitrePh:'Titre de ta proposition', ideaNewDescPh:'Détaille ton idée (optionnel)', ideaNewSend:'Publier',
    ideaNeedName:'Choisis d\'abord un pseudo (dans Jouer) pour proposer une idée.', ideaTitleShort:'Titre trop court (4 caractères min).',
    ideaPosted:'Merci ! Ton idée est publiée.', ideaByAuthor:(n)=>`par ${n}`, ideaDeleteConfirm:'Supprimer ta suggestion ?', ideaDelete:'Supprimer',
    ideaStatusOpen:'Ouverte', ideaStatusPlanned:'📌 Prévue', ideaStatusDone:'✅ Faite', ideaStatusRejected:'✖ Refusée',
    feedLoading:'Chargement des vidéos…', feedEmpty:'Aucune vidéo pour le moment.\nSois le premier à en proposer une !', feedError:'Impossible de charger les vidéos.\nVérifie ta connexion et réessaie.',
    feedSubmitBtn:'🎬 Proposer une vidéo', feedShareText:'Regarde cette vidéo sur Libero\'s Multi !', feedShareCopied:'Lien copié !',
    feedNoComments:'Aucun commentaire. Lance la discussion !', feedSubmitBadUrl:'Lien invalide (http/https requis).', feedSubmitOk:'Merci ! Ta vidéo sera vérifiée avant publication.',
    feedCommentsTitle:'Commentaires', feedCommentPlaceholder:'Ajoute un commentaire…', feedCommentSend:'Envoyer',
    feedSubmitTitle:'Proposer une vidéo', feedSubmitIntro:'Colle le lien direct d\'une vidéo (mp4). Elle sera vérifiée par l\'admin avant d\'apparaître dans le feed.',
    feedSubmitUrl:'Lien de la vidéo (https://…)', feedSubmitTitrePh:'Titre (optionnel)', feedSubmitDescPh:'Description (optionnel)', feedSubmitSend:'Envoyer',
    navRead:'Lecture',
    navProfile:'Profil',
    lockerTitle:'🎒 Mon casier',
    lockerEmpty:"Tu n'as encore rien acheté dans la boutique. Passe faire un tour !",
    lockerEquipped:'équipé',
    lockerEquip:'Équiper', lockerUnequip:'Déséquiper',
    lockerCats:{ colors:'Couleurs de pseudo', nameeffects:'Effets de pseudo', titles:'Titres', bgs:"Fonds d'écran", bubbles:'Bulles de chat', fonts:'Polices', cursorsnakes:'Curseur', snakeskins:'Skins Snake', avatars:'Avatars', p4tokens:'Jetons Puissance 4', ttt:'Symboles Morpion', chess:"Thèmes d'échiquier", clickfx:'Particules de clic', emojipacks:"Packs d'émojis", victorybans:'Bannières de victoire', soundpacks:'Packs de sons', emotes:'Emotes', honorary:'Titre honorifique' },
    lockerCardSub:'Tes cosmétiques et leurs aperçus',
    historyCardSub:'Ton historique de jeu',
    recovery:{
      cardTitle:'Sauvegarder ma progression', cardSub:'Ne perds jamais ton compte',
      title:'🔐 Sauvegarder ma progression',
      intro:"Ce code est la clé de ton compte. Note-le et garde-le en lieu sûr : si tu changes ou perds ton appareil, il te permet de récupérer toute ta progression.",
      codeLabel:'Ton code de récupération', copy:'Copier',
      warn:'Ne le partage avec personne : quiconque a ce code peut accéder à ton compte.',
      restoreLabel:'Restaurer une progression', restore:'Restaurer',
      restoreHint:'Attention : restaurer remplace la progression actuelle de cet appareil.',
      invalid:'Ce code est invalide.',
      confirm:'Restaurer cette progression ? La progression actuelle de cet appareil sera remplacée.',
    },
    tournamentTitle:'🏆 Tournoi du samedi',
    tournamentDesc:"Chaque samedi : victoires classiques +10 pts, bonnes réponses de quiz +2 pts, ⚡ mangés au Snake +1 pt. Le meilleur gagne 2000 ⚡ et le titre « Champion de la semaine » !",
    tournamentLive:(h,m)=>`🔴 Tournoi en cours ! Fin dans ${h} h ${m} min`,
    tournamentNext:days=>`Prochain tournoi samedi (dans ${days} jour${days>1?'s':''})`,
    tournamentEmpty:'Aucun point marqué pour le moment. Sois le premier !',
    tournamentChampion:(name,pts)=>`👑 Champion de la semaine : ${name} (${pts} pts)`,
    stakeLabel:'💰 Mise (le vainqueur rafle tout) :',
    stakeNone:'Sans',
    stakeStart:(stake,pot)=>`💰 Mise ${stake} ⚡ chacun : le vainqueur remporte ${pot} ⚡ !`,
    stakeWon:pot=>`💰 Victoire ! Tu remportes le pot : +${pot} ⚡`,
    stakeLost:stake=>`💸 Mise perdue (${stake} ⚡). Revanche ?`,
    stakeRefund:stake=>`💰 Mise remboursée (+${stake} ⚡).`,
    stakeCancelled:'💰 Mise annulée pour cette revanche (solde insuffisant).',
    stakeInsufficient:'Solde insuffisant pour cette mise (et il faut un pseudo).',
    stakeInsufficientJoin:stake=>`Cette partie a une mise de ${stake} ⚡ : il te faut un pseudo et un solde suffisant.`,
    welcomeBackToast:'🎯 Content de te revoir ! Tes défis du jour t\'attendent dans le Profil.',
    referralCardTitle:'Inviter un ami', referralCardSub:'+100 ⚡ pour toi et pour lui',
    referralTitle:'🤝 Invite un ami',
    referralIntro:"Envoie ton lien d'invitation : quand ton ami jouera sa première partie, vous recevrez chacun 100 ⚡ !",
    referralLinkLabel:"Ton lien d'invitation",
    referralShareBtn:'Partager le lien',
    referralShareTitle:"Rejoins-moi sur Libero's Multi !",
    referralShareText:url=>`🎮 Viens jouer avec moi sur Libero's Multi ! Utilise mon lien et on gagne chacun 100 ⚡ : ${url}`,
    referralCount:n=>`🏅 Tu as déjà parrainé ${n} joueur${n>1?'s':''}.`,
    referralRewardSponsor:(amount,name)=>`🤝 Ton filleul ${name} a joué sa première partie : +${amount} ⚡ !`,
    referralRewardChild:amount=>`🤝 Bienvenue ! Ton parrainage te rapporte +${amount} ⚡ !`,
    // Niveaux et XP
    levelMain:lv=>`Niveau ${lv}`,
    levelSub:(xp,next)=>`${xp} XP · prochain niveau à ${next} XP`,
    levelUpToast:(lv,reward)=>`🎉 Niveau ${lv} atteint ! +${reward} ⚡`,
    // Roue de la fortune
    wheelCardTitle:'Roue de la fortune', wheelCardSub:"1 tour gratuit par jour, jusqu'à 250 ⚡",
    wheelTitle:'🎡 Roue de la fortune',
    wheelIntro:'Un tour gratuit par jour. Tente ta chance !',
    wheelSpinBtn:'🎡 Tourner la roue',
    wheelWin:p=>`🎉 Tu gagnes ${p} ⚡ ! Reviens demain pour un nouveau tour.`,
    wheelDone:'⏳ Tu as déjà tourné la roue aujourd\'hui. Reviens demain !',
    wheelNoName:'Choisis d\'abord un pseudo pour tourner la roue.',
    // Amis
    friendsCardTitle:'Mes amis', friendsCardSub:'Vois qui est en ligne et défie-les',
    friendsTitle:'👥 Mes amis',
    friendsIntro:"Ajoute un ami avec son code d'invitation (dans « Inviter un ami » de son profil), vois s'il est en ligne et défie-le en un clic.",
    friendsAddBtn:'Ajouter', friendsAddPlaceholder:'Code ami (8 caractères)',
    friendsEmpty:'Aucun ami pour le moment. Demande leur code à tes camarades !',
    friendsOnline:'en ligne', friendsOffline:'hors ligne',
    friendsChallengeBtn:'⚔️ Défier', friendsRemoveBtn:'✕',
    friendsErrInvalid:'Code invalide.', friendsErrNotFound:'Aucun joueur avec ce code.', friendsErrFull:'Liste pleine (30 amis max).',
    friendsErrAlready:'Vous êtes déjà amis.', friendsErrNoName:'Choisis d\'abord un pseudo.',
    friendRequestSent:name=>`✅ Demande d'ami envoyée à ${name} !`,
    friendRequestAccepted:name=>`🤝 ${name} et toi êtes maintenant amis !`,
    friendRequestFrom:name=>`👥 ${name} te demande en ami`,
    friendReqAccept:'Accepter', friendReqDecline:'Refuser',
    friendsPendingLabel:'📥 Demandes en attente', friendsListLabel:'👥 Mes amis',
    friendsGiftTitle:name=>`🎁 Offrir des Libs à ${name}`,
    friendsGiftSent:(n,name)=>`🎁 ${n} ⚡ envoyés à ${name} !`,
    friendsGiftErrDaily:left=>`Limite de 500 ⚡ offerts par jour atteinte (il te reste ${left} ⚡ offrables).`,
    friendsGiftErrInsufficient:'Solde insuffisant.',
    friendsGiftLibsLabel:'Montant en Libs', friendsGiftVipLabel:'Ou offre-lui un Pass VIP',
    friendsGiftVipBtn:price=>`👑 Pass VIP 30 j (${price} ⚡)`, friendsGiftVipShort:price=>`un Pass VIP (${price} ⚡)`,
    friendsGiftConfirm:(what,name)=>`✅ Confirmer : offrir ${what} à ${name}`,
    friendsGiftVipSent:name=>`👑 Pass VIP offert à ${name} !`,
    friendsGiftVipTargetMax:name=>`${name} a déjà le maximum de VIP en réserve (3 mois).`,
    giftRecvTitle:'🎁 Tu as reçu un cadeau !',
    giftRecvLibs:(from,n)=>`${from || 'Quelqu\'un'} t'a offert ${n} ⚡ !`,
    giftRecvCosm:from=>`${from || 'Quelqu\'un'} t'a offert un cosmétique ! Retrouve-le dans ton casier.`,
    giftRecvVip:from=>`👑 ${from || 'Quelqu\'un'} t'a offert un Pass VIP de 30 jours ! Profite de tes +20% de Libs.`,
    giftRecvBoth:(from,n)=>`${from || 'Quelqu\'un'} t'a offert ${n} ⚡ et un cosmétique !`,
    challengeFriendBtn:'⚔️ Défier un ami',
    friendPickTitle:'⚔️ Qui veux-tu défier ?',
    friendPickNone:'Aucun ami en ligne pour le moment. Ajoute des amis dans ton Profil !',
    friendPickNeedGame:'Choisis d\'abord un jeu.',
    friendPickNeedTheme:'Choisis d\'abord au moins un thème de quiz.',
    playerCardLevel:lv=>`⭐ Niveau ${lv}`,
    playerCardAddFriend:'👥 Demander en ami', playerCardFriends:'✅ Vous êtes amis',
    playerCardRequested:'⏳ Demande déjà envoyée', playerCardYou:'C\'est toi !',
    playerCardOnline:'🟢 En ligne', playerCardOffline:'⚪ Hors ligne', playerCardVip:'👑 VIP',
    friendsChallengeSent:name=>`⚔️ Défi envoyé à ${name} ! En attente...`,
    friendChallengeToast:(name)=>`⚔️ ${name} te défie !`,
    friendChallengeAccept:'Accepter', friendChallengeDecline:'Ignorer',
    friendsMyCode:code=>`Ton code ami : ${code}`,
    // QI
    iqCardTitle:'Mon QI',
    iqCardLocked:n=>`Termine encore ${n} quiz pour débloquer le test`,
    iqCardUnlocked:'Test débloqué : mesure ton QI approximatif !',
    iqCardValue:v=>`QI estimé : ${v}`,
    iqTitle:'🧠 Test de QI',
    iqIntroLocked:n=>`Le test de QI se débloque en jouant au quiz. Termine encore ${n} quiz (solo ou en groupe) pour y accéder !`,
    iqIntroReady:'15 questions de logique, 30 secondes chacune. Réponds vite et bien : le résultat est une estimation ludique de ton QI (ce n\'est pas un test médical). Prêt ?',
    iqCooldown:d=>`Tu pourras repasser le test dans ${d}.`,
    iqStartBtn:'🧠 Commencer le test',
    iqProgress:(i,n)=>`Question ${i}/${n}`,
    iqResultValue:v=>`Ton QI estimé : ${v}`,
    iqResultNote:'Estimation ludique basée sur ta précision et ta vitesse. Rejoue au quiz et reviens le repasser dans 3 jours !',
    iqShareBtn:'📣 Partager',
    iqShareText:v=>`🧠 Mon QI estimé sur Libero's Multi : ${v} ! Viens tester le tien : https://libero-multi.vercel.app`,
    // VIP
    vipCardTitle:'Pass VIP', vipCardSub:'+20% de Libs sur tes gains pendant 30 jours',
    vipTitle:'👑 Pass VIP',
    vipIntro:price=>`Deviens VIP pendant 30 jours pour ${price} ⚡ :`,
    vipPerks:['👑 Badge VIP sur ton profil','⚡ +20% de Libs sur la série, les défis, la roue et le tournoi','🎡 Les gains de la roue de la fortune boostés aussi'],
    vipBuyBtn:price=>`👑 Devenir VIP (${price} ⚡)`,
    vipActive:d=>`👑 Tu es VIP jusqu'au ${d}. Rachète pour prolonger de 30 jours !`,
    vipDone:'👑 Te voilà VIP pour 30 jours ! Profite de tes +20%.',
    vipInsufficient:price=>`Il te faut ${price} ⚡ pour devenir VIP. Passe par la boutique pour recharger !`,
    vipMax:'Tu as déjà le maximum de VIP en réserve (3 mois). Reviens plus tard !',
    joinName:{
      title:"🎮 On t'attend !",
      intro:"Un ami t'a invité à une partie. Choisis d'abord ton pseudo pour le rejoindre.",
      placeholder:'Ton pseudo', go:'Rejoindre',
      invalid:'Choisis un pseudo d\'au moins 2 caractères.',
    },
    emotesCardTitle:'Émotes', emotesCardSub:'20 réactions à envoyer en partie (5 équipées max)',
    emoteUnavailable:'Cette émote n\'est plus disponible.',
    settingsCardTitle:'Réglages', settingsCardSub:'Langue, thème, sons, musique, serpent',
    emojirain:{
      cardTitle:"Pluie d'émojis", cardSub:'Choisis le thème ou tes propres émojis',
      title:"🌈 Pluie d'émojis",
      intro:"La pluie d'émojis s'affiche à ton arrivée sur le site. Choisis son thème, ou compose ta propre pluie !",
      standard:'Standard (jeux du site)', custom:'Personnalisé',
      customLabel:'Tes émojis (15 max)',
      customEmpty:'Tape au moins un émoji.',
      saved:n=>`Enregistré ! ${n} émoji${n>1?'s':''} dans ta pluie.`,
      unlock:price=>`Débloquer (${price} ⚡)`,
      test:'▶ Tester la pluie',
    },
    resetCardTitle:'Réinitialiser le compte', resetCardSub:'Repartir de zéro sur le site',
    resetTitle:'🗑️ Réinitialiser le compte',
    resetIntro:"Réinitialiser supprime définitivement toute ta progression (Libs, cosmétiques, série, historique) et tu disparais de tous les classements. Le site redémarre ensuite comme à ta toute première visite.",
    resetSaveHint:"Tu hésites ? Sauvegarde d'abord ton code de récupération ci-dessous si tu veux réfléchir. Attention : après la réinitialisation, ce code ne fonctionnera plus, la suppression est définitive. Sauvegarder n'est pas obligatoire.",
    resetCodeLabel:'Ton code de récupération (valable seulement avant la réinitialisation)',
    resetConfirmLabel:'Je comprends que ma progression sera définitivement supprimée et que je disparaîtrai des classements.',
    resetConfirmBtn:'Réinitialiser définitivement',
    onboarding:{
      welcomeType:"Bienvenue sur Libero's Multi",
      start:'Commencer',
      themeLabel:'Choisis ton thème', themeDay:'☀️ Jour', themeNight:'🌙 Nuit',
      title:'👋 Bienvenue !',
      intro:'Tu as déjà un compte sur un autre appareil ? Colle ton code de récupération pour retrouver ta progression. Sinon, commence une nouvelle aventure.',
      label:"J'ai déjà un code de récupération",
      restore:'Récupérer',
      newBtn:'Non, je suis nouveau, commencer',
      invalid:'Ce code est invalide.',
    },
    lockerBackCats:'Toutes les catégories',
    shopGiftBtn:price=>`🎁 Offrir (${price} ⚡)`,
    giftChoiceTitle:name=>`🎁 Offrir ${name}`,
    giftChoiceIntro:price=>`Cet article coûte ${price} ⚡. Choisis comment l'offrir :`,
    giftChoiceFriendsLabel:'Choisis un ami à qui l\'envoyer directement :',
    giftChoiceNoFriends:'Aucun ami pour le moment. Ajoute des amis dans ton Profil, ou offre par lien/code.',
    giftChoiceSendBtn:'Choisir',
    giftChoiceConfirmLink:(name,price)=>`Tu vas payer ${price} ⚡ et recevoir un lien + un code cadeau pour ${name}, à partager à la personne de ton choix.`,
    giftChoiceConfirmFriend:(name,friend,price)=>`Tu vas payer ${price} ⚡ pour offrir ${name} directement à ${friend}. Il le recevra tout de suite avec un message.`,
    giftChoiceConfirmBtn:price=>`✅ Confirmer (${price} ⚡)`,
    giftChoiceSentFriend:name=>`🎁 Cadeau envoyé à ${name} !`,
    giftChoiceTargetOwns:'Ton ami possède déjà cet article.',
    shopGiftReceiveTitle:'🎁 Recevoir un cadeau',
    shopGiftReceiveDesc:"Un ami t'a offert un cosmétique ? Entre le code cadeau qu'il t'a envoyé pour le débloquer.",
    shopGiftReceiveBtn:'Recevoir',
    shopGiftPlaceholder:'Code cadeau',
    giftTitle:'🎁 Cadeau prêt !',
    giftIntro:"Envoie le lien cadeau à la personne de ton choix : en l'ouvrant, elle reçoit le cadeau automatiquement. Si elle ne peut pas ouvrir le lien, elle peut aussi entrer le code dans la boutique (section « Recevoir un cadeau »).",
    giftLinkLabel:"Lien cadeau (à ouvrir, c'est tout)",
    giftCodeLabel:'Code cadeau (si le lien ne passe pas)',
    giftShareBtn:'Partager le cadeau', giftWarn:"Le cadeau n'est utilisable qu'une seule fois (lien ou code).",
    giftShareTitle:"Un cadeau sur Libero's Multi",
    giftShareText:(code,url)=>`🎁 Je t'offre un cadeau sur Libero's Multi ! Ouvre ce lien pour le recevoir : ${url}\nOu entre ce code dans la boutique (Recevoir un cadeau) : ${code}`,
    giftReceived:name=>name ? `🎁 Cadeau de ${name} débloqué !` : '🎁 Cadeau débloqué !',
    giftReceivedBundle:name=>name ? `🎁 Pack cadeau de ${name} débloqué ! Regarde ton casier.` : '🎁 Pack cadeau débloqué ! Regarde ton casier.',
    giftUsed:'Ce cadeau a déjà été utilisé.',
    giftInvalid:'Code cadeau invalide.',
    readLoading:'Chargement des livres…',
    readEmpty:'Cette section est en cours de développement.\nReviens bientôt pour découvrir des livres !',
    readError:'Cette section est en cours de développement.\nReviens bientôt pour découvrir des livres !',
    readSearch:'Rechercher un titre ou un auteur...',
    readAll:'Tous', readBtn:'📖 Lire', readBack:'Retour',
    readNoResult:'Aucun livre ne correspond à ta recherche.',
    bookExclusive:'⭐ Exclusif', bookChaptersTitle:'Chapitres', bookFree:'Gratuit',
    bookComingSoon:'À venir', bookUnlockFor: price => `🔓 Débloquer pour ${price} ⚡`,
    bookLockedRange: (from,to) => `Chapitres ${from} à ${to}`,
    bookInsufficient:'Pas assez de Libs ! Joue pour en gagner.',
    bookNeedName:'Choisis d\'abord un pseudo (dans une section de jeu) pour acheter.',
    bookNeedPrevious:'Débloque d\'abord les chapitres précédents.',
    bookSequelLocked: titre => `🔒 Suite réservée : débloque « ${titre} » en entier pour lire ce tome.`,
    bookSequelUnlocked:'✅ Offert avec le tome précédent : bonne lecture !',
    bookSequelGoto: titre => `📕 Voir « ${titre} »`,
    bookUnlocked:'✅ Chapitres débloqués ! Bonne lecture.',
    bookPrev:'← Précédent', bookNext:'Suivant →', bookReaderClose:'✕',
    bookChapterLocked:'🔒 Ce chapitre est verrouillé.',
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
    btnShare:'🔗 Partager le lien', btnTriviaShare:'🔗 Partager le lien', linkCopied:'Lien copié !',
    shareTitle:"Rejoins ma partie sur Libero's Multi",
    shareText: code => `Rejoins ma partie sur Libero's Multi (code ${code}) :`,
    joinLinkFailed:'Partie introuvable. Le lien est peut-être expiré.',
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
    games:{ connect4:'Puissance 4', tictactoe:'Tic Tac Toe', chess:'Échecs', checkers:'Dames', ludo:'Ludo' },
    ludoRoll:'🎲 Lancer le dé', ludoDice:d=>`🎲 Dé : ${d}`, ludoNoMove:'Aucun coup possible, le tour passe.',
    playerNames:{
      connect4:{ R:'Rouge', Y:'Jaune' },
      tictactoe:{ R:'Croix', Y:'Rond' },
      chess:{ R:'Blancs', Y:'Noirs' },
      checkers:{ R:'Rouge', Y:'Jaune' },
      ludo:{ R:'Rouge', Y:'Jaune' },
    },
    errNoGame:'Choisis d\'abord un jeu.',
    restartRequestedPrompt:'Ton adversaire veut rejouer.',
    restartDeclined:'L\'adversaire a refusé la revanche.',
    btnCancel:'Annuler', btnAccept:'Accepter', btnRefuse:'Refuser',
    diffLabels:{ easy:'Facile', medium:'Moyen', hard:'Difficile', extreme:'Extrême' },
    diffHints:{ '':'🎲 Mixte : questions de tous les niveaux mélangées.', easy:'😊 Facile : les grands classiques, parfait pour débuter.', medium:'🎯 Moyen : culture générale de bon niveau.', hard:'💀 Difficile : questions pointues pour connaisseurs.', extreme:'🔥 Extrême : questions pointues ET 15 secondes chrono par question !' },
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
    triviaCorrect:'✅ Bonne réponse !', triviaFastBonus:'⚡ Réponse éclair : point doublé !', triviaWrong:'❌ La réponse était : ',
    triviaFinishedTitle:'Résultats finaux', btnLeaveGame:'Retour au menu', btnQuitTrivia:'🚪 Quitter',
    triviaPodiumWin:'🏆 Champion du quiz !', triviaPodiumTop3:'🎉 Sur le podium !', triviaPodiumOut: r => `Tu finis ${r}e, le podium t'attend la prochaine fois !`,
    triviaShareBtn:'📣 Partager mon résultat',
    triviaShareRank: (rank, score) => rank === 1
      ? `🏆 J'ai fini 1er au quiz de groupe sur Libero's Multi avec ${score} pts ! Tu crois pouvoir me battre ? Viens me défier : https://libero-multi.vercel.app`
      : `🎯 J'ai fini ${rank}e au quiz de groupe sur Libero's Multi avec ${score} pts ! Viens jouer avec nous : https://libero-multi.vercel.app`,
    triviaShareSolo: score => `🧠 J'ai marqué ${score} pts au quiz sur Libero's Multi ! Essaie de faire mieux : https://libero-multi.vercel.app`,
    triviaShareCopied:'📋 Message copié ! Colle-le à tes amis.',
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
    chatbot:{
      fabTitle:'Assistant Libero',
      title:'🤖 Assistant Libero',
      subtitle:'Pose ta question sur le site',
      placeholder:'Écris ta question…',
      reset:'Effacer la conversation',
      greeting:"Salut ! Je suis l'assistant de Libero's Multi. Pose-moi une question sur le site (Libs, boutique, livres, jeux, défis…) ou choisis un sujet ci-dessous.",
      thanks:'Avec plaisir ! Autre chose ?',
      answerIntro:"Voici ce que j'ai trouvé :",
      fallback:"Je n'ai pas de réponse précise à ça. Reformule ta question, ouvre l'aide complète avec le bouton ❓ en bas à droite, ou écris au créateur via le bouton ✉️ en bas à gauche.",
      suggestions:[
        { q:'Comment gagner des Libs ?' },
        { q:'Comment acheter des Libs ?' },
        { q:"C'est quoi Libero Run ?" },
        { q:'Comment lire un livre ?' },
        { q:'Comment équiper un cosmétique ?' },
        { q:'Comment offrir un cosmétique ?' },
        { q:'Comment sauvegarder ma progression ?' },
        { q:'Comment jouer au quiz ?' },
      ],
    },
    shopTitle:'⚡ Boutique', shopBalanceLabel:'Ton solde :',
    shopBoostHintName:'💡 Indice Quiz',
    shopBoostHintDesc:'Élimine une mauvaise réponse. Utilisable jusqu\'à 2 fois par question.',
    shopBtnBuy10:'10 indices · 3 ⚡', shopBtnBuy20:'20 indices · 5 ⚡',
    shopPending:n => `${n} indice${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`,
    shopInsufficient:'Champion, tu n\'as pas assez de Libs.', shopBuyError:'Erreur lors de l\'achat.',
    shopBuyOk:'Boost acheté !',
    shopPromoTitle:'🎟 Code promo', shopPromoPlaceholder:'Code à 4 caractères', shopPromoBtn:'Valider',
    shopPromoOk:n => `🎉 +${n} ⚡ crédités !`,
    shopPromoAlreadyUsed:'Tu as déjà utilisé ce code.', shopPromoInvalid:'Code invalide.', shopPromoAnon:'Les joueurs anonymes ne peuvent pas utiliser de code.',
    shopCosmeticsTitle:'🎨 Cosmétiques de pseudo',
    shopCosmeticNames:{ rainbow:'Arc en ciel', galaxy:'Galaxie', silver:'Argent', bronze:'Bronze', gold:'Or', diamond:'Diamant' },
    shopCosmeticBuy:p => `Acheter · ${p} ⚡`,
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
    honorTitleNames:{'honor-rank1-global':'N°1 Global','honor-weekly-champ':'Champion de la semaine','honor-creator':'Créateur'},
    honorModalTitle:'Titre honorifique !',
    honorModalMsg:(titleName) => `Felicitations ! Tu es N°1 au classement global. En recompense, tu recois le titre <strong>${titleName}</strong>. Il s'affichera a cote de ton pseudo tant que tu restes premier.`,
    honorModalBtn:'Accepter',
    shopHonoraryBadge:'🏆 Honorifique',
    shopHonoraryOwned:'Obtenu',
    shopHonoraryNote:'Deviens 1er au classement global pour obtenir ce titre.',
    shopCursorSnakesTitle:'🖱️ Skins de curseur',
    shopSnakeSkinsTitle:'🐍 Skins Snake (Évents)',
    shopSnakeSkinNames:{'snakeskin-gems':'Serpent de Gemmes','snakeskin-cyber':'Serpent Cyber','snakeskin-lava':'Serpent de Lave','snakeskin-galaxy':'Serpent Galaxie','snakeskin-rainbow':'Serpent Arc-en-ciel'},
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
    shopEmoteNames:{'emote-hello':'Salut 👋', 'emote-gg':'GG 👍', 'emote-sad':'Sniff 😢', 'emote-wellplayed':'Bien joué 🤝', 'emote-laugh':'MDR 😂', 'emote-think':'Hmm 🤔', 'emote-cool':'Cool 🆒', 'emote-clap':'Bravo 👏', 'emote-fire':'En feu 🔥', 'emote-heart':'Cœur ❤️', 'emote-cry':'Larmes 😭', 'emote-angry':'Grr 😤', 'emote-shock':'Explosé 🤯', 'emote-easy':'Trop facile 😎', 'emote-eyes':'Vu 👀', 'emote-skull':'Mort de rire 💀', 'emote-party':'La fête 🥳', 'emote-rocket':'Fusée 🚀', 'emote-omg':'Incroyable 😱', 'emote-crown':'Roi 👑'},
    shopFeaturedTitle:'⭐ À la une',
    shopDailyTitle:'📅 Quotidien',
    shopBundlesTitle:'🎁 Bundles',
    shopSectionDescs:{
      featured:"La sélection de la semaine · se renouvelle toutes les 24h.",
      daily:"Des offres à prix réduit, renouvelées chaque jour.",
      bundles:"Packs thématiques à prix réduit. Si tu possèdes déjà certains articles, le prix s'ajuste automatiquement.",
      colors:"Colorie ton pseudo dans les classements et en partie.",
      fonts:"Change la police de ton pseudo partout sur Libero.",
      bubbles:"Personnalise le style visuel de tes bulles de chat.",
      bgs:"Applique un fond animé à ton espace de jeu.",
      nameeffects:"Ajoute un effet visuel animé directement sur ton pseudo.",
      titles:"Affiche un titre à côté de ton pseudo dans le classement.",
      cursorsnakes:"Remplace ton curseur de souris par un serpent animé.",
      snakeskins:"Change l'apparence de ton serpent pendant le Snake Challenge du week-end.",
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
    shopBundlePartialOwned: n => `Tu possèdes déjà ${n} article${n>1?'s':''} · prix ajusté.`,
    shopBundleBuy: p => `Acheter le bundle · ${p} ⚡`,
    shopBundleBuyOk:'🎁 Bundle acheté !',
    shopBundleAnon:'Les joueurs anonymes ne peuvent pas acheter de bundles.',
    shopBundleInsufficientFunds:'Champion, tu n\'as pas assez de Libs.',
    shopBundleError:'Erreur lors de l\'achat.',
    shopBundleNames:{ 'bundle-debutant':'Pack Débutant','bundle-retro':'Pack Rétro','bundle-neon-arcade':'Pack Néon Arcade','bundle-galaxie':'Pack Galaxie','bundle-prestige-or':'Pack Prestige Or','bundle-hologramme':'Pack Hologramme Ultime' },
    shopNavLabels:{ featured:'À la une', daily:'Quotidien', bundles:'Bundles', boosts:'Boosts', colors:'Couleurs', fonts:'Polices', bubbles:'Bulles', bgs:'Fonds', nameeffects:'Effets', titles:'Titres', codes:'Codes', cursorsnakes:'Curseur', snakeskins:'Snake', avatars:'Avatars', p4tokens:'P4', ttt:'Morpion', chess:'Échiquier', clickfx:'Particules', emojipacks:'Émojis', victorybans:'Victoire', soundpacks:'Sons', emotes:'Emotes' },
    shopLibsPacksTitle:'💳 Recharger tes Libs',
    shopLibsPacksDesc:'Achète des Libs ⚡ avec de l\'argent réel (mobile money / carte, paiement sécurisé FedaPay). Le crédit est vérifié par nos serveurs, jamais instantané côté navigateur.',
    shopLibsPacksLoading:'Chargement des packs…',
    shopLibsPacksUnavailable:'Recharge indisponible pour le moment.',
    shopLibsPacksBuy:'Acheter', shopLibsPacksSoon:'Bientôt',
    shopLibsPackNames:{ decouverte:'Découverte', populaire:'Populaire', pro:'Pro', mega:'Méga', ultime:'Ultime' },
    shopLibsPacksFeatured:'⭐ Populaire',
    shopLibsPacksBonus:n => `+${n} offerts`,
    shopLibsBuyTitle:'💳 Recharger tes Libs',
    shopLibsBuySummary:(libs, price) => `⚡ ${libs} Libs · ${price.toLocaleString('fr-FR')} FCFA. Tu seras redirigé vers la page de paiement sécurisée.`,
    shopLibsBuySubmit:'Payer',
    shopLibsBuyMissing:'Remplis email, prénom et nom pour continuer.',
    shopLibsBuyBadEmail:'Adresse email invalide.',
    shopLibsBuyAnon:'Choisis d\'abord un pseudo pour acheter des Libs.',
    shopLibsBuyRateLimited:'Trop de tentatives. Réessaie dans un moment.',
    shopLibsBuyError:'Impossible de lancer le paiement. Réessaie plus tard.',
    shopLibsBuyProcessing:'Redirection vers le paiement…',
    shopLibsBuyCredited:n => `⚡ +${n} Libs ajoutés ! Merci pour ton achat.`,
    shopLibsBuyFailed:'Le paiement n\'a pas abouti. Aucune Libs n\'a été débitée.',
    shopLibsBuyEmailPh:'Email', shopLibsBuyFirstPh:'Prénom', shopLibsBuyLastPh:'Nom', shopLibsBuyPhonePh:'Téléphone (optionnel)',
    shopDailyBadge:'Quotidien',
    settingsTitle:'⚙️ Paramètres',
    settingsLang:'Langue', settingsTheme:'Thème', settingsSnake:'Serpent',
    settingsSnakeOn:'Activé', settingsSnakeOff:'Désactivé', settingsSnakeInGame:'🐍 En Game',
    snakeBusyInGame:'🐍 Le serpent est en Game !',
    settingsSfx:'Sons', settingsSfxOn:'Activé', settingsSfxOff:'Désactivé', settingsSfxVol:'Volume',
    settingsBgm:'Musique', settingsBgmOn:'Activée', settingsBgmOff:'Désactivée', settingsBgmVol:'Vol. musique',
    settingsRefundTitle:'Cartes de remboursement',
    settingsPush:'Notifications', settingsPushOn:'🔔 Activées', settingsPushOff:'🔕 Désactivées',
    pushEnabledToast:'🔔 Notifications activées ! Tu seras prévenu des tournois, défis et annonces.',
    pushDeniedToast:'🔕 Notifications bloquées par le navigateur. Autorise-les dans les réglages du site.',
    pushUnsupported:'Ce navigateur ne gère pas les notifications.',
    flashOfferTitle:'⚡ OFFRE FLASH', flashOfferEnds:t=>`Se termine dans ${t}`,
    legalLinkSettings:'📄 Mentions légales · CGV · Confidentialité',
    legalLinkFooter:'Mentions légales · CGV · Confidentialité',
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
    helpLibsBuyTitle:'💳 Recharger avec de l\'argent réel',
    helpLibsBuyDesc:'Dans la boutique, l\'onglet <strong>💳 Recharger</strong> permet d\'acheter des packs de Libs avec de l\'argent réel (mobile money / carte, paiement sécurisé via FedaPay). Après le paiement, tu es redirigé vers le site : tes Libs sont crédités dès que le paiement est confirmé par nos serveurs (généralement quelques secondes). Un email valide est requis pour la confirmation de commande.',
    helpBoostTitle:'Boost Indice (quiz)',
    helpBoostDesc:'Dans la boutique, achète un <em>Boost Indice</em> (3 ⚡) : il élimine une mauvaise réponse par question pendant un quiz complet. Le bouton 💡 apparaît dans le quiz dès que le boost est actif et s\'utilise une fois par question.',
    eventsTitle:'Évents', eventsDesc:'Ven-Dim · Snake Challenge',
    eventsDescLocked:'Week-end prochain',
    eventsLockedCard: days => `📅 Dans ${days} j`,
    eventsLockedMsg:  days => `🐍 <strong>Snake Challenge pourrait revenir dans ${days} jour${days>1?'s':''}</strong> <u style="cursor:pointer">vote ici</u> !`,
    eventActiveMsg:   '🐍 <strong>Évent ce week-end</strong> : Snake Challenge ! Ton serpent mange des ⚡ et chaque Lib mangé est ajouté à ton solde.',
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
    snakeHsDisplay:n => `🏆 Ton record : ${n} ⚡`,
    snakeLibsEarned:n => `+${n} ⚡ ajoutés à ton solde !`,
    profileCardTitle:'Mon profil', profileCardDesc:'Défis · Série · Historique',
    profileTitle:'Mon profil',
    challengesTitle:'🎯 Défis du jour', historyTitle:'🕑 Mes dernières parties',
    profileAnon:'Choisis un pseudo (dans un jeu) pour suivre tes défis, ta série et ton historique !',
    challengesNames:{
      wins3:'Gagne 3 parties', play5:'Joue 5 parties (peu importe le jeu)',
      trivia5:'Réponds bien à 5 questions de quiz', trivia12:'Réponds bien à 12 questions de quiz', quiz2:'Termine 2 quiz',
      snake30:'Mange 30 ⚡ au Snake', snake60:'Mange 60 ⚡ au Snake',
      luffy12000:'Cumule 12000 pts au Libero Run', luffyGames3:'Fais 3 parties de Libero Run',
      perm_wins50:'Gagne 50 parties classiques', perm_wins250:'Gagne 250 parties classiques',
      perm_play500:'Joue 500 parties classiques', perm_trivia1000:'Réponds bien à 1000 questions de quiz',
      perm_snake2000:'Mange 2000 ⚡ au Snake', perm_luffy500k:'Cumule 500 000 pts au Libero Run',
      perm_streak30:'Tiens une série de connexion de 30 jours',
      perm_wheel30:'Tourne la roue de la fortune 30 fois', perm_ludo25:'Gagne 25 parties de Ludo',
      perm_gift5:'Envoie 5 cadeaux à d\'autres joueurs',
    },
    permTitle:'🏔️ Défis permanents',
    permSub:'Des exploits de longue haleine : la progression ne se remet jamais à zéro. Récompenses énormes, jusqu\'à 5000 ⚡ !',
    challengePerfectDay: bonus => `🎉 Journée parfaite ! Les 3 défis réclamés : +${bonus} ⚡ bonus`,
    triviaSkip:'⏭ Passer',
    challengeClaim:'Réclamer', challengeClaimed:'✓ Réclamé', challengeLocked:'À finir',
    challengeReward:n => `+${n} ⚡`,
    challengeClaimToast:n => `Défi réussi ! +${n} ⚡`,
    streakMain:n => `Série de ${n} jour${n > 1 ? 's' : ''} 🔥`,
    streakNone:'Commence ta série aujourd\'hui !',
    streakSub:(l, b) => `Record : ${l} jour${l > 1 ? 's' : ''}${b > 0 ? ` · +${b} ⚡ aujourd'hui` : ''}`,
    streakBonusToast:(n, b) => `Jour ${n} de connexion · +${b} ⚡ !`,
    historyEmpty:'Aucune partie pour l\'instant. Lance une partie !',
    historyGameNames:{ connect4:'Puissance 4', tictactoe:'Morpion', chess:'Échecs', trivia:'Quiz', snake:'Snake', luffy:'Libero Run' },
    historyResults:{ win:'Victoire', loss:'Défaite', draw:'Match nul' },
    historyScore:n => `${n} pts`,
    bookReaders:n => `${n} lecteur${n > 1 ? 's' : ''}`,
    bookOriginalOnly:'📖 Traduction anglaise bientôt disponible. Voici la version originale (français).',
    snakeGameOver:'Game Over', snakeNewRecord:'🏆 Nouveau record !',
    btnSnakeRestart:'Rejouer', btnSnakeQuit:'Quitter',
    snakePause:'⏸ Pause', btnSnakeResume:'▶ Reprendre',
    btnSnakeBack:'← Retour', btnSnakeHome:'🏠 Quitter',
    snakeHint:'↑ ↓ ← → ou glisser sur mobile',
    luffyChallengeDesc:'Aide Libero à courir le plus loin possible ! Saute par-dessus les obstacles au sol, accroupis-toi sous ceux qui volent.',
    luffyNameTitle:'🏃 Ton pseudo',
    luffyLbTitle:'Classement Libero Run',
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
    commentWaitBtn:'Patiente…',
    commentLessMin:"moins d'une minute",
    commentCooldown:str=>`⏳ Limite atteinte (3/h). Réessaie dans ${str}.`,
    commentUnknownErr:'Erreur inconnue.',
    tutoSkip:'Passer le guide', tutoOk:"J'ai compris ✓",
    newsTitle:'📰 News',
    btnHelpTitle:'Aide', btnSnakeToggle:'Activer / Désactiver le serpent', libsCounterTitle:'Ouvrir la boutique',
    snakeOverScore:(score, hs) => `Score : ${score} · Meilleur : ${hs}`,
    helpContent:{
      general:[
        { icon:'🏠', title:"Sections d'accueil", desc:"L'accueil propose <em>Jeux Classiques</em> (Puissance 4, Morpion, Échecs), <em>Culture Générale</em> (quiz par thèmes), <em>Évents</em> (mini-jeux du week-end) et <em>Pour la communauté</em> (le mini-jeu <strong>Libero Run</strong>, une idée de joueur reprise par le créateur). Chaque section a son propre classement." },
        { icon:'🎯', title:'Mon profil', desc:"L'onglet <strong>Profil</strong> (dans la barre en bas, à côté d'Accueil) regroupe quatre choses : ton <strong>casier</strong> (voir ci-dessous), tes <strong>défis du jour</strong> (3 objectifs qui <strong>changent chaque jour</strong> : jamais le même défi deux jours de suite, avec le Snake le week-end et Libero Run en semaine ; réclame les 3 pour un <strong>bonus « journée parfaite » +30 ⚡</strong>), ta <strong>série de connexion</strong> (un bonus de ⚡ croissant chaque jour consécutif où tu reviens, jusqu'à +35) et l'<strong>historique</strong> de tes 20 dernières parties. On y trouve aussi les cartes <strong>Sauvegarder ma progression</strong> (ton code de récupération) et <strong>Réinitialiser le compte</strong>. Il faut un pseudo pour en profiter." },
        { icon:'🎒', title:'Mon casier', desc:"Dans l'onglet <strong>Profil</strong>, le <strong>casier</strong> range tout ce que tu possèdes, <strong>classé par catégorie</strong>. Chaque catégorie est une <strong>carte</strong> : clique dessus pour voir les articles de ce type avec leur <strong>aperçu visuel</strong>, puis <strong>équipe</strong> ou <strong>déséquipe</strong> directement, sans passer par la boutique. Bonus : <strong>3 fonds d'écran gratuits</strong> (Nuit Calme, Ardoise Profonde, Brume Violette) sont offerts à tous les joueurs et t'attendent déjà dedans. Les articles retirés de la vente que tu avais achetés restent disponibles ici." },
        { icon:'🔐', title:'Code de récupération', desc:"Dans l'onglet <strong>Profil</strong>, la carte <strong>Sauvegarder ma progression</strong> affiche ton <strong>code de récupération</strong> : c'est la clé de ton compte. Note-le en lieu sûr ! Si tu changes ou perds ton appareil, colle ce code sur le nouvel appareil (même carte → <em>Restaurer</em>) pour retrouver <strong>toute ta progression</strong> : Libs, cosmétiques, série, historique et pseudo. À la toute première visite, le site te propose aussi de récupérer une progression existante. Ne partage ce code avec personne." },
        { icon:'🗑️', title:'Réinitialiser le compte', desc:"Dans l'onglet <strong>Profil</strong>, la carte <strong>Réinitialiser le compte</strong> supprime <strong>définitivement</strong> toute ta progression : Libs, cosmétiques, série, historique, et tu <strong>disparais de tous les classements</strong>. Le site redémarre ensuite comme à ta toute première visite (animation de bienvenue comprise). Il faut cocher la case de confirmation pour valider. Attention : après la réinitialisation, ton ancien code de récupération ne fonctionne plus." },
        { icon:'🎁', title:'Offrir un cosmétique ou un pack', desc:"Tu peux <strong>offrir</strong> n'importe quel cosmétique payant <strong>ou pack (bundle)</strong> de la boutique ! Ouvre sa fiche et clique <strong>🎁 Offrir</strong>, puis choisis comment l'offrir : <strong>👥 directement à un ami</strong> (il le reçoit tout de suite avec un message), <strong>🔗 par un lien</strong> à partager (WhatsApp, etc.) ou <strong>🔢 par un code</strong>. Un <strong>bouton de confirmation</strong> t'indique le prix avant de débiter tes ⚡, rien n'est envoyé tant que tu ne confirmes pas. Lien et code ne sont utilisables qu'<strong>une seule fois</strong>." },
        { icon:'🎉', title:'Évents', desc:"Des mini-jeux spéciaux sont disponibles certains week-ends. La carte est <strong>verrouillée</strong> hors week-end et indique le nombre de jours avant le prochain évent. Quand c'est actif : <em>Snake Challenge</em> · ton serpent mange des <strong>⚡ Libs</strong> pour grandir, et chaque ⚡ mangé est <strong>ajouté à ton solde</strong> (score 10 = 10 Libs gagnés). Les bords sont traversables. Un nouveau record affiche <em>🏆 Nouveau record !</em>. Appuie sur <strong>⏸</strong> (ou Échap / P) pour mettre en pause." },
        { icon:'🏆', title:'Tournoi du samedi', desc:"Chaque <strong>samedi</strong>, un tournoi automatique se joue sur tout le site (suivi en direct dans la carte <strong>News</strong>) : victoires classiques <strong>+10 pts</strong>, bonnes réponses de quiz <strong>+2 pts</strong>, ⚡ mangés au Snake <strong>+1 pt</strong>. À minuit, le meilleur remporte <strong>2000 ⚡</strong> et le titre honorifique <strong>« Champion de la semaine »</strong>, gardé jusqu'au tournoi suivant. Le top 10 s'affiche en direct." },
        { icon:'🤝', title:'Inviter un ami (parrainage)', desc:"Dans l'onglet <strong>Profil</strong>, la carte <strong>Inviter un ami</strong> te donne ton <strong>lien d'invitation</strong>. Quand un nouveau joueur arrive par ton lien et joue sa <strong>première partie</strong>, vous recevez chacun <strong>+100 ⚡</strong>. Le nombre de joueurs que tu as parrainés s'affiche dans la fenêtre." },
        { icon:'💰', title:'Duels avec mise', desc:"En créant une partie multijoueur classique, tu peux choisir une <strong>mise</strong> (25, 50 ou 100 ⚡). Les deux joueurs paient la mise au départ et <strong>le vainqueur rafle tout</strong> (le double). Match nul ou partie annulée : chacun est <strong>remboursé</strong>. Il faut un pseudo et un solde suffisant des deux côtés ; la revanche remet la même mise si les deux peuvent payer." },
        { icon:'⭐', title:'Niveaux et XP', desc:"Chaque partie te rapporte de l'<strong>XP</strong> (+25 par partie, bonus en cas de <strong>victoire</strong> et selon ton score au <strong>quiz</strong>). Ton <strong>niveau</strong> s'affiche en haut de ton Profil avec une barre de progression. À chaque niveau gagné tu reçois des <strong>⚡ Libs</strong> (de plus en plus), et les paliers <strong>10, 25 et 50</strong> offrent un gros bonus (jusqu'à <strong>+5000 ⚡</strong>)." },
        { icon:'🧠', title:'Test de QI', desc:"Dans ton <strong>Profil</strong>, la carte <strong>Mon QI</strong> se débloque après <strong>10 quiz terminés</strong> (solo ou en groupe). Le test : <strong>15 questions de logique</strong>, 30 secondes chacune. Ta précision et ta vitesse donnent un <strong>QI estimé</strong> (c'est une estimation ludique, pas un test médical !). Tu peux le repasser tous les <strong>3 jours</strong> et <strong>partager</strong> ton score à tes amis." },
        { icon:'🎡', title:'Roue de la fortune', desc:"Dans ton <strong>Profil</strong>, la carte <strong>Roue de la fortune</strong> t'offre <strong>un tour gratuit par jour</strong> : de <strong>5 à 250 ⚡</strong> à gagner à chaque tour. Il faut un pseudo pour jouer. Reviens chaque jour pour ton tour gratuit !" },
        { icon:'👥', title:'Mes amis', desc:"Dans ton <strong>Profil</strong>, la carte <strong>Mes amis</strong> : envoie une <strong>demande d'ami</strong> avec le <strong>code ami</strong> de l'autre (le même code que dans « Inviter un ami »), ou en cliquant un <strong>pseudo dans les classements</strong>. L'autre <strong>accepte ou refuse</strong> (les <strong>demandes en attente</strong> s'affichent dans la fenêtre Mes amis) ; une fois amis, vous êtes chacun dans la liste de l'autre. <strong>Retirer un ami</strong> ne le retire que de <strong>ta</strong> liste. Tu vois qui est <strong>en ligne</strong> (point vert), tu peux lui <strong>offrir des Libs ou un Pass VIP</strong> 🎁 (avec une confirmation avant l'envoi), et le <strong>défier</strong> depuis les zones <strong>Jeux classiques</strong> et <strong>Quiz</strong> (bouton ⚔️ Défier un ami : tu choisis le jeu, les thèmes et la mise). Bonus : parrain et filleul deviennent amis automatiquement. Jusqu'à 30 amis." },
        { icon:'👑', title:'Pass VIP', desc:"Dans ton <strong>Profil</strong>, la carte <strong>Pass VIP</strong> : pour <strong>2000 ⚡</strong>, deviens VIP pendant <strong>30 jours</strong>. Avantages : badge <strong>👑 VIP</strong> sur ton profil et <strong>+20% de Libs</strong> sur tes gains (série de connexion, défis, roue de la fortune, tournoi du samedi). Rachète pour prolonger (maximum <strong>3 mois</strong> de VIP en réserve). Tu peux aussi <strong>offrir un Pass VIP à un ami</strong> depuis la fenêtre 🎁 de ta liste d'amis." },
        { icon:'🎲', title:'Ludo', desc:"Le <strong>Ludo</strong> classique en 1 contre 1 : 4 pions chacun, lance le <strong>dé</strong>, il faut un <strong>6</strong> pour sortir un pion. Atterrir sur un pion adverse le <strong>capture</strong> (retour à la base), sauf sur les cases <strong>étoilées ★</strong>. Un 6 ou une capture fait <strong>rejouer</strong>. Fais faire le tour complet à tes 4 pions et remonte la colonne d'arrivée pour gagner. Jouable contre un ami (avec <strong>mise</strong> possible) ou contre le bot." },
        { icon:'🌱', title:'Quiz révisions', desc:"Trois thèmes de quiz <strong>spécial école</strong> sont disponibles : <strong>🌱 SVT</strong>, <strong>🇬🇧 Anglais</strong> et <strong>🇧🇯 Bénin</strong> (histoire et géographie du pays). Révise en t'amusant, seul ou en salon avec ta classe ! Trois niveaux de difficulté comme pour les autres thèmes." },
        { icon:'📱', title:"Installer l'appli et notifications", desc:"Le site s'<strong>installe comme une appli</strong> : dans ton navigateur, menu → <strong>« Ajouter à l'écran d'accueil »</strong> (ou « Installer l'application »). Tu peux aussi activer les <strong>🔔 notifications</strong> dans <strong>Profil → Réglages → Notifications</strong> pour être prévenu des tournois, annonces et offres flash, même quand le site est fermé." },
        { icon:'⚡', title:'Offres flash', desc:"De temps en temps, un cosmétique passe en <strong>OFFRE FLASH</strong> : une bannière dorée apparaît en haut de la <strong>boutique</strong> avec une réduction (jusqu'à -90%) et un compte à rebours. Quand c'est fini, c'est fini : garde l'œil ouvert (et active les notifications pour ne rien rater) !" },
        { icon:'📚', title:'Lecture', desc:"L'onglet <strong>Lecture</strong> ouvre un catalogue de livres : recherche par titre ou auteur, filtres par catégorie, et fiche détaillée au clic. Tu y trouveras les <strong>romans exclusifs</strong> lisibles directement sur le site (en français ou en anglais selon la langue choisie) : <strong>⭐ L'Affaire endormie · Tome 1</strong> (chapitre 1 gratuit, 1000 ⚡ pour les chapitres 2-5, 2000 ⚡ pour les 6-10), <strong>Life of Georgia</strong> (livre entier pour 2000 ⚡) et sa suite <strong>Life of Georgia · Tome 2</strong>, <strong>offerte</strong> à tous ceux qui ont débloqué le Tome 1." },
        { icon:'🎮', title:'Créer une partie classique', desc:"Choisis d'abord un jeu parmi <strong>Puissance 4</strong>, <strong>Morpion</strong>, <strong>Échecs</strong>, <strong>Dames</strong> ou <strong>Ludo</strong> (aucun n'est présélectionné), entre ton pseudo (optionnel) puis clique <em>Créer une partie</em>. Partage le code à 4 lettres à ton adversaire, ou le <strong>lien</strong>. Tu peux annuler l'attente si personne ne rejoint. Tu peux aussi jouer <strong>Solo contre le bot</strong> (Facile, Moyen ou Difficile)." },
        { icon:'⛂', title:'Dames', desc:"Le jeu de <strong>Dames</strong> (draughts 8x8, 12 pions chacun). Les pions avancent en diagonale d'une case vers l'avant. <strong>La prise est obligatoire</strong> : si tu peux sauter par-dessus un pion adverse (case libre derrière), tu dois le faire, et tu enchaînes les prises multiples avec la même pièce. Un pion qui atteint la dernière rangée devient une <strong>dame ♛</strong> qui se déplace et prend dans les deux sens. Tu gagnes quand l'adversaire n'a plus de pièces ou ne peut plus jouer. En fin de partie, <em>Rejouer</em> propose une revanche que l'adversaire accepte ou refuse." },
        { icon:'🤖', title:'Mode Solo (vs Bot)', desc:"Joue seul contre un robot. <em>Facile</em> : le bot joue au hasard. <em>Moyen</em> : le bot bloque et attaque. <em>Difficile</em> : le bot joue de manière optimale. Les parties <strong>Moyen et Difficile</strong> comptent dans le classement classique." },
        { icon:'🔗', title:'Rejoindre', desc:"Entre le code à 4 lettres reçu et clique <em>Rejoindre</em>. La partie démarre automatiquement dès que les deux joueurs sont connectés." },
        { icon:'💬', title:'Chat', desc:"Envoie des messages à ton adversaire pendant une partie classique. Le bouton <em>Vider</em> efface l'historique côté local uniquement." },
        { icon:'🔄', title:'Reconnexion', desc:"Si tu recharges la page, tu retrouves automatiquement ta partie classique en cours. L'adversaire a <strong>30 secondes</strong> pour se reconnecter, sinon la partie est annulée." },
        { icon:'🔁', title:'Rejouer', desc:"En fin de partie classique, clique <em>Rejouer</em>. La partie redémarre uniquement si les deux joueurs acceptent." },
        { icon:'🌍', title:'Classement Global', desc:"Visible dès la page d'accueil, il regroupe <strong>tous les joueurs ayant au moins un point</strong>. Score = victoires classiques (×10) + points Quiz + meilleur score Snake (×10) + meilleur score Libero Run (÷10). Mis à jour en temps réel." },
        { icon:'🏆', title:'Classements par section', desc:"Chaque section garde aussi son propre classement : victoires/défaites/nuls pour les Jeux Classiques, total de points pour le Quiz." },
        { icon:'🏃', title:'Libero Run', desc:"Aide Libero, la mascotte du site, à courir le plus loin possible dans ce runner sans fin ! Saute (<strong>↑</strong> / Espace) par-dessus les obstacles au sol (tonneaux, canons, crabes…) et accroupis-toi (<strong>↓</strong>) sous les obstacles volants (mouettes, boulets de canon…). Attrape l'<strong>⭐ étoile brillante</strong> pour devenir invincible quelques secondes : un compte à rebours affiche le temps restant. Ton meilleur score <strong>persiste</strong> entre les sessions et alimente un classement dédié. C'est d'ailleurs une <strong>idée de la communauté</strong> reprise par le créateur · si tu veux que la tienne soit prise en compte, laisse un commentaire via le bouton dans l'écran de jeu." },
        { icon:'📰', title:'News', desc:"La carte News est repliée dans le <strong>coin en haut à gauche</strong>. <strong>Clique dessus</strong> pour l'ouvrir : elle affiche les dernières <strong>annonces</strong> (nouveaux livres, nouveautés du site) et les <strong>commentaires</strong> des joueurs. Reclique pour la refermer." },
        { icon:'⚙️', title:'Paramètres', desc:"Dans l'onglet <strong>Profil</strong>, la carte <strong>⚙️ Réglages</strong> regroupe tous les réglages : <strong>Langue</strong>, <strong>Thème</strong>, <strong>Serpent</strong>, <strong>Sons</strong> (effets sonores + volume), <strong>Musique</strong> (fond musical + volume) et <strong>Cartes de remboursement</strong>. Tout est mémorisé entre les sessions." },
        { icon:'🔊', title:'Sons & Musique', desc:"<strong>Sons</strong> : des effets sonores accompagnent chaque action (poser une pièce, victoire, quiz, chat, boutique, Snake…). Active/désactive-les via <strong>⚙️ → Sons</strong> et règle le volume.<br><strong>Musique</strong> : une musique ambiante joue en fond. Active/désactive-la via <strong>⚙️ → Musique</strong> avec son propre curseur de volume. Les deux se gèrent indépendamment." },
        { icon:'🐍', title:'Serpent', desc:"Un petit serpent suit ton curseur. Il <strong>grandit et change de couleur</strong> selon ton score global 🌍 : or (1er), bleu (2e), bronze (3e). Joue et grimpe dans le classement pour l'allonger ! Active ou désactive-le via le bouton <strong>⚙️</strong> en haut à droite → <strong>Serpent</strong>." },
        { icon:'☀️', title:'Thème jour / nuit', desc:"Le bouton <strong>⚙️</strong> en <em>haut à droite</em> → <strong>Thème</strong> bascule entre le thème clair et sombre. Le site s'adapte aussi automatiquement selon l'heure (clair de 7h à 20h, sombre la nuit). Ton choix manuel est mémorisé entre les sessions." },
        { icon:'🚪', title:'Bouton Quitter', desc:"Pendant une partie, le bouton <em>🚪 Quitter</em> en haut au centre te ramène au menu principal. Si une partie est en cours, tu es averti que tu abandonneras avant de confirmer." },
        { icon:'✉️', title:'Laisser un commentaire', desc:"Clique sur le bouton <strong>✉️</strong> en bas à gauche pour envoyer un message au créateur : avis, idée, bug… Aucune connexion requise. Tu peux laisser un pseudo ou rester anonyme." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💳', titleKey:'helpLibsBuyTitle', descKey:'helpLibsBuyDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🗂️', title:'Navigation boutique', desc:"À gauche de la boutique, une <strong>barre de catégories</strong> fonctionne comme des <strong>onglets</strong> : clique sur un rayon (⭐ À la une, 📅 Quotidien, 🎁 Bundles, 💡 Boosts, 🎨 Couleurs, ✨ Effets, 🏷️ Titres, 🖼️ Fonds, 🎟️ Codes) et <strong>seul ce rayon s'affiche</strong>, bien rangé. L'onglet <strong>🎟️ Codes</strong> regroupe <em>Recevoir un cadeau</em> (codes cadeaux d'amis) et les <em>codes promo</em>. Sur mobile, seuls les icônes sont affichés." },
        { icon:'🎁', title:'Bundles', desc:"La section <strong>Bundles</strong> propose des lots thématiques regroupant plusieurs cosmétiques à prix réduit (−24 % à −28 %). Si tu possèdes déjà certains articles d'un bundle, le prix est <strong>ajusté automatiquement</strong> · tu ne paies que pour ce qu'il te manque. La sélection <strong>⭐ À la une</strong> et <strong>📅 Quotidien</strong> se renouvelle toutes les 24 h · un compte à rebours indique l'heure du prochain renouvellement." },
        { icon:'✨', title:'Effets de pseudo', desc:"Anime l'affichage de ton pseudo dans les classements, le chat, les badges et le podium. Les effets sont <strong>cumulables avec ta couleur de pseudo</strong> : la couleur reste la teinte, l'effet ajoute l'animation par-dessus. Exemples : Clignotement Néon, Glitch, Vague Arc-en-ciel. Rareté : Épique à Légendaire." },
        { icon:'🏷️', title:'Titres', desc:"Ajoute un court texte de statut affiché à côté de ton pseudo dans les classements, badges et chips de salle d'attente. Exemples : Tacticien, Quiz Master, Roi du Snake, Légende Vivante. Rareté : Commun à Épique. Les titres achetés se combinent avec les <strong>titres honorifiques</strong> (voir ci-dessous)." },
        { icon:'🥇', title:'Titres honorifiques', desc:"Si tu atteins la <strong>1re place</strong> du classement global, tu reçois automatiquement le titre honorifique <em>N°1 Global</em>. Un message de félicitations apparait lors de ta prochaine visite · clique <em>Accepter</em> pour le valider. Le titre est retiré si tu es détrôné. Il est visible en boutique mais ne peut pas être acheté." },
        { icon:'🖱️', title:'Skins de curseur', desc:"Remplace l'apparence du serpent qui suit ton curseur (couleur, motif, traînée, forme de tête). Le skin prend le pas sur la couleur de rang quand il est équipé. Visible uniquement si le <strong>Serpent</strong> est activé dans les paramètres. Rareté : Rare à Légendaire." },
        { icon:'🎭', title:'Avatars', desc:"Remplace l'icône affichée dans ton badge joueur en partie et dans les classements. Exemples : Manette 🎮, Chat Pixel 🐱, Fusée 🚀, Couronne 👑. Rareté : Commun à Épique." },
        { icon:'🔴', title:'Jetons Puissance 4', desc:"Restyle tes pions dans la grille 7×6 (motif, texture, lueur). La distinction <strong>rouge / jaune</strong> entre les deux camps est conservée · le skin habille la couleur sans la rendre ambiguë. Tes deux adversaires verront tes jetons. Rareté : Rare à Épique." },
        { icon:'✖️', title:'Symboles Morpion', desc:"Remplace les X / O par une paire de symboles personnalisés sur la grille 3×3. Les deux symboles restent nettement distinguables. Ton adversaire voit ta paire. Exemples : Soleil / Lune ☀️🌙, Cœur / Étoile ❤️⭐. Rareté : Commun à Épique." },
        { icon:'♟️', title:'Thèmes d\'échiquier', desc:"Restyle le plateau et les pièces de l'échiquier. Le contraste cases claires / sombres et la lisibilité des pièces sont toujours garantis. Ton adversaire voit ton thème. Exemples : Cyber Grid, Marbre Royal. Rareté : Épique à Légendaire." },
        { icon:'🐍', title:'Skins Snake (Évents)', desc:"Modifie l'apparence du serpent, des ⚡ et du plateau pendant le Snake Challenge. Mode solo uniquement · aucun souci d'équité. Exemples : Serpent Arc-en-ciel, Serpent de Lave, Plateau Galaxie. Rareté : Rare à Légendaire." },
        { icon:'💥', title:'Particules de clic', desc:"Remplace les particules qui s'affichent lorsque tu cliques sur les boutons et cartes du site. Exemples : Bulles 🫧, Confettis 🎊, Feu d\'Artifice 🎆. Rareté : Commun à Épique." },
        { icon:'🌈', title:'Packs d\'émojis', desc:"Remplace le jeu d'émojis de la pluie animée au premier chargement de la page. Exemples : Pack Fête 🎉, Pack Gaming 🎮, Pack Cosmos 🌌. Rareté : Commun à Rare." },
        { icon:'🏆', title:'Bannières de victoire', desc:"Personnalise le style et l'animation de la bannière de fin de partie (victoire). Visible à l'écran de résultat des jeux classiques et du quiz. Exemples : Triomphe Néon, Flammes de Champion, Couronnement. Rareté : Épique à Légendaire." },
        { icon:'🔊', title:'Packs de sons', desc:"Remplace certains sons du site (achat, victoire, clic, changement du compteur Libs) par un set sonore thématique. Les packs respectent ta préférence de son (⚙️ → Sons). Exemples : Rétro Arcade, Cristal, Épique. Rareté : Rare à Épique." },
        { icon:'😎', title:'Émotes', desc:"<strong>20 réactions rapides</strong> à envoyer dans le chat des parties classiques multi, dont <strong>3 gratuites</strong> pour tous (👋 Salut, 👍 GG, 😢 Sniff). Gère-les depuis l'onglet <strong>Profil → carte Émotes</strong> : tu peux en <strong>équiper jusqu'à 5</strong>, qui apparaissent dans la barre de réactions en jeu. Les autres <strong>s'achètent directement dans cette carte Émotes</strong> (de 10 à 100 ⚡) : les émotes ne sont pas vendues dans la boutique d'objets." },
        { icon:'🎓', title:'Tutoriel', desc:"À ta première visite, un guide apparaît automatiquement pour te présenter chaque fonctionnalité écran par écran. Une fois une étape vue, elle ne s'affiche plus. Pour tout revoir depuis le début, vide le cache de ton navigateur (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'Culture Générale', desc:"Réponds à des questions à choix multiple. Sélectionne <strong>un ou plusieurs thèmes</strong> parmi 15 catégories (Histoire, Sciences, Cinéma, Musique, mais aussi <strong>SVT, Anglais, Bénin</strong> pour réviser). Les questions sont mélangées si tu choisis plusieurs thèmes. Choisis ta <strong>difficulté</strong> : Facile, Moyen, Difficile ou <strong>🔥 Extrême</strong> (questions pointues ET 15 secondes chrono par question au lieu de 30)." },
        { icon:'🌐', title:'Langue', desc:"Change la langue via le bouton <strong>⚙️</strong> en haut à droite → <strong>Langue</strong>. En mode <strong>FR</strong>, les questions sont traduites en français (les termes techniques restent en anglais si nécessaire). En mode <strong>EN</strong>, les questions sont en anglais d'origine. Le site détecte automatiquement ta langue au premier lancement." },
        { icon:'▶', title:'Mode Solo', desc:"Sélectionne un ou plusieurs thèmes et clique <em>Solo</em>. Tu joues seul à ton rythme. Ton score est automatiquement ajouté au classement à la fin." },
        { icon:'👥', title:'Mode Multijoueur', desc:"Clique <em>Créer un salon</em> (2 à 6 joueurs). Partage le code à 4 lettres. L'hôte lance la partie quand tout le monde est prêt. Tout le monde voit les mêmes questions en même temps." },
        { icon:'⏱', title:'Chrono', desc:"Tu as <strong>30 secondes</strong> par question. Le chrono passe en rouge sous les 5 secondes. Sans réponse dans le temps imparti, la question est perdue. Tu peux aussi <strong>⏭ passer</strong> une question qui te bloque : aucun point, mais tu ne perds pas de temps." },
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
      { id:30, name:'SVT',        icon:'🌱' }, { id:31, name:'Anglais',    icon:'🇬🇧' },
      { id:32, name:'Bénin',      icon:'🇧🇯' },
    ],
    tutoSteps:{
      landing_news:'📰 Le cadre <strong>News</strong> est replié dans le coin <strong>en haut à gauche</strong>. <strong>Clique dessus</strong> pour l\'ouvrir : il affiche les dernières actualités, nouvelles fonctionnalités, annonces et commentaires de joueurs. Reclique pour le refermer.',
      landing_cats:'👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! L\'accueil propose quatre sections : <strong>Jeux Classiques</strong>, <strong>Culture Générale</strong>, <strong>Évents</strong> (mini-jeux du week-end) et <strong>Pour la communauté</strong> (le mini-jeu <strong>Libero Run</strong>). La barre en bas mène aussi aux <strong>Vidéos</strong>, à la <strong>Lecture</strong> et à ton <strong>Profil</strong>.',
      landing_lb:'🌍 Le <strong>Classement Global</strong> regroupe <em>tous</em> les joueurs ayant au moins un point, quelle que soit la section jouée. Score = victoires classiques ×10 + points Quiz + meilleur score Snake ×10 + meilleur score Libero Run ÷10. Plus tu montes, plus ton serpent 🐍 grandit !',
      landing_btns:'⚙️ Des boutons permanents sont disponibles :<br>▶ Les <strong>Réglages</strong> (thème, langue, serpent, sons, musique, cartes de remboursement) sont dans l\'onglet <strong>Profil</strong>, carte <strong>⚙️ Réglages</strong>.<br>▶ <strong>En bas à droite</strong> : ❓ <strong>Aide</strong> · ✉️ <strong>Commentaire</strong> · 🤖 <strong>Assistant</strong>',
      landing_libs:'⚡ <strong>Libs</strong> : la monnaie virtuelle du site. Tous les joueurs classés en reçoivent toutes les 5h (1er : +10 ⚡, 2e : +5 ⚡, 3e : +3 ⚡, du 4e au 10e : +2 ⚡, ensuite +1 ⚡). Tu en gagnes aussi avec les <strong>défis du jour</strong> et ta <strong>série de connexion</strong>. Dépense-les dans la <strong>boutique</strong> : cosmétiques, boosts quiz, livres exclusifs !',
      events_snake:'🏆 Le samedi, le <strong>Tournoi</strong> se joue automatiquement (suivi en direct dans la carte <strong>News</strong> : top 10, 2000 ⚡ et le titre « Champion de la semaine » pour le meilleur).<br>🐍 C\'est l\'évent du week-end : <strong>Snake Challenge</strong> ! Clique <em>Jouer</em>, ton serpent entre dans l\'arène. Mange les <strong>⚡ Libs</strong> pour grandir : chaque ⚡ mangé est ajouté à ton solde (score 10 = 10 Libs gagnés). Les bords sont traversables, tu ressors de l\'autre côté ! Ton meilleur score <strong>persiste</strong> entre les sessions.',
      luffy_runner:'🏃 <strong>Libero Run</strong> : aide Libero à courir le plus loin possible ! Saute (↑ / Espace) par-dessus les obstacles au sol, accroupis-toi (↓) sous les obstacles volants. Attrape l\'⭐ étoile pour être invincible quelques secondes. Ton meilleur score alimente un classement dédié.',
      home_games:'🎮 Choisis ton jeu en haut : <strong>Puissance 4</strong>, <strong>Morpion</strong>, <strong>Échecs</strong>, <strong>Dames</strong> ou <strong>Ludo</strong> 🎲 (aucun n\'est présélectionné). Le classement est partagé entre les cinq jeux.',
      home_bot:'🤖 <strong>Mode Solo</strong> : joue contre le bot à 3 niveaux de difficulté : Facile, Moyen ou Difficile. Tes victoires et défaites sont comptées dans le classement !',
      home_multi:'👥 <strong>Mode Multijoueur</strong> : entre ton pseudo (optionnel), puis clique sur <em>Créer une partie</em> pour générer un code, ou entre le code d\'un ami pour le rejoindre. En fin de partie, <em>Rejouer</em> propose une revanche que l\'autre joueur accepte ou refuse.',
      home_lb:'🏆 <strong>Classement</strong> : victoires, défaites et nuls s\'enregistrent automatiquement après chaque partie (bot Moyen / Difficile ou multijoueur).',
      waiting_code:'📋 <strong>Partage ce code</strong> à 4 lettres avec ton adversaire, ou clique <strong>🔗 Partager le lien</strong> : il rejoindra en un clic. La partie démarre dès qu\'il arrive, et tu peux <strong>Annuler</strong> si personne ne vient.',
      quiz_themes:'🧠 <strong>Quiz Culture Générale</strong> : sélectionne un ou plusieurs thèmes (Histoire, Cinéma, Sciences…), puis joue en <strong>Solo</strong> ou crée un <strong>salon multijoueur</strong> à partager avec tes amis.',
      quiz_lb:'🏆 Le <strong>classement Quiz</strong> est séparé du classement Classique. Les points sont attribués selon ta vitesse de réponse et le nombre de bonnes réponses. <strong>Réponse éclair</strong> (dans les premières secondes) = <strong>point doublé ⚡</strong>.',
      read_catalogue:'📚 Bienvenue dans la section <strong>Lecture</strong> ! Cherche un livre par titre ou auteur, filtre par catégorie, et clique sur une couverture pour ouvrir sa fiche. Les <strong>romans exclusifs</strong> se lisent directement ici : <strong>⭐ L\'Affaire endormie · Tome 1</strong> (chapitre 1 gratuit, puis 1000 ⚡ et 2000 ⚡), <strong>Life of Georgia</strong> (2000 ⚡ le livre entier) et <strong>Life of Georgia · Tome 2</strong>, offert à ceux qui possèdent le Tome 1.',
      profile_hub:'🎯 Ton <strong>Profil</strong> regroupe ton <strong>niveau</strong> ⭐ (chaque partie donne de l\'XP, chaque niveau des ⚡), ta <strong>série de connexion</strong> 🔥, tes <strong>défis du jour</strong>, ton <strong>casier</strong>, ton <strong>historique</strong>, tes <strong>amis</strong> 👥 (demandes d\'amis, cadeaux de Libs, défis depuis les zones de jeu), la <strong>roue de la fortune</strong> 🎡 (1 tour gratuit par jour), le <strong>test de QI</strong> 🧠 (après 10 quiz), le <strong>Pass VIP</strong> 👑 (+20% de Libs), la carte <strong>Inviter un ami</strong> 🤝 (+100 ⚡ chacun), tes <strong>émotes</strong> 😎, la <strong>pluie d\'émojis</strong> 🌈, les <strong>Réglages</strong> ⚙️ (avec les 🔔 notifications), ton <strong>code de récupération</strong> 🔐 et la <strong>réinitialisation</strong> du compte.',
      ideas_board:'💡 La section <strong>Idées</strong> : propose une amélioration du site et vote pour (▲) ou contre (▼) celles des autres joueurs. Les meilleures idées remontent en haut.',
    },
  },
  en: {
    siteTitle:'Multiplayer Games', siteSubtitle:'Choose your category',
    navHome:'Home', navFeed:'Videos', navIdeas:'Ideas',
    ideasTitle:'Ideas & suggestions', ideasSub:'Suggest a site improvement and vote on others\' ideas.',
    ideasSortTop:'🔥 Top', ideasSortNew:'🆕 Newest', ideasNewBtn:'💡 Suggest',
    ideasLoading:'Loading ideas…', ideasEmpty:'No ideas yet.\nBe the first to suggest one!', ideasError:'Could not load ideas.\nCheck your connection and try again.',
    ideaNewTitle:'Suggest an idea', ideaNewIntro:'Describe a feature or improvement you would like to see on the site.',
    ideaNewTitrePh:'Title of your suggestion', ideaNewDescPh:'Detail your idea (optional)', ideaNewSend:'Publish',
    ideaNeedName:'Pick a nickname first (in Play) to suggest an idea.', ideaTitleShort:'Title too short (4 characters min).',
    ideaPosted:'Thanks! Your idea is published.', ideaByAuthor:(n)=>`by ${n}`, ideaDeleteConfirm:'Delete your suggestion?', ideaDelete:'Delete',
    ideaStatusOpen:'Open', ideaStatusPlanned:'📌 Planned', ideaStatusDone:'✅ Done', ideaStatusRejected:'✖ Declined',
    feedLoading:'Loading videos…', feedEmpty:'No videos yet.\nBe the first to submit one!', feedError:'Could not load videos.\nCheck your connection and try again.',
    feedSubmitBtn:'🎬 Submit a video', feedShareText:'Check out this video on Libero\'s Multi!', feedShareCopied:'Link copied!',
    feedNoComments:'No comments yet. Start the conversation!', feedSubmitBadUrl:'Invalid link (http/https required).', feedSubmitOk:'Thanks! Your video will be reviewed before publishing.',
    feedCommentsTitle:'Comments', feedCommentPlaceholder:'Add a comment…', feedCommentSend:'Send',
    feedSubmitTitle:'Submit a video', feedSubmitIntro:'Paste the direct link to a video (mp4). It will be reviewed by the admin before appearing in the feed.',
    feedSubmitUrl:'Video link (https://…)', feedSubmitTitrePh:'Title (optional)', feedSubmitDescPh:'Description (optional)', feedSubmitSend:'Send',
    navRead:'Reading',
    navProfile:'Profile',
    lockerTitle:'🎒 My locker',
    lockerEmpty:"You haven't bought anything in the shop yet. Go take a look!",
    lockerEquipped:'equipped',
    lockerEquip:'Equip', lockerUnequip:'Unequip',
    lockerCats:{ colors:'Name colors', nameeffects:'Name effects', titles:'Titles', bgs:'Backgrounds', bubbles:'Chat bubbles', fonts:'Fonts', cursorsnakes:'Cursor', snakeskins:'Snake skins', avatars:'Avatars', p4tokens:'Connect 4 tokens', ttt:'Tic-Tac-Toe symbols', chess:'Chessboard themes', clickfx:'Click particles', emojipacks:'Emoji packs', victorybans:'Victory banners', soundpacks:'Sound packs', emotes:'Emotes', honorary:'Honorary title' },
    lockerCardSub:'Your cosmetics and their previews',
    historyCardSub:'Your game history',
    recovery:{
      cardTitle:'Save my progress', cardSub:'Never lose your account',
      title:'🔐 Save my progress',
      intro:"This code is the key to your account. Write it down and keep it safe: if you change or lose your device, it lets you recover all your progress.",
      codeLabel:'Your recovery code', copy:'Copy',
      warn:'Do not share it: anyone with this code can access your account.',
      restoreLabel:'Restore progress', restore:'Restore',
      restoreHint:'Warning: restoring replaces the current progress on this device.',
      invalid:'This code is invalid.',
      confirm:'Restore this progress? The current progress on this device will be replaced.',
    },
    tournamentTitle:'🏆 Saturday tournament',
    tournamentDesc:'Every Saturday: classic wins +10 pts, correct quiz answers +2 pts, ⚡ eaten in Snake +1 pt. The best player wins 2000 ⚡ and the "Weekly Champion" title!',
    tournamentLive:(h,m)=>`🔴 Tournament live! Ends in ${h}h ${m}min`,
    tournamentNext:days=>`Next tournament on Saturday (in ${days} day${days>1?'s':''})`,
    tournamentEmpty:'No points scored yet. Be the first!',
    tournamentChampion:(name,pts)=>`👑 Weekly champion: ${name} (${pts} pts)`,
    stakeLabel:'💰 Stake (winner takes all):',
    stakeNone:'None',
    stakeStart:(stake,pot)=>`💰 ${stake} ⚡ stake each: the winner takes ${pot} ⚡!`,
    stakeWon:pot=>`💰 Victory! You take the pot: +${pot} ⚡`,
    stakeLost:stake=>`💸 Stake lost (${stake} ⚡). Rematch?`,
    stakeRefund:stake=>`💰 Stake refunded (+${stake} ⚡).`,
    stakeCancelled:'💰 Stake cancelled for this rematch (insufficient balance).',
    stakeInsufficient:'Insufficient balance for this stake (and a nickname is required).',
    stakeInsufficientJoin:stake=>`This game has a ${stake} ⚡ stake: you need a nickname and enough balance.`,
    welcomeBackToast:'🎯 Welcome back! Your daily challenges are waiting in your Profile.',
    referralCardTitle:'Invite a friend', referralCardSub:'+100 ⚡ for you and for them',
    referralTitle:'🤝 Invite a friend',
    referralIntro:'Send your invite link: when your friend plays their first game, you both receive 100 ⚡!',
    referralLinkLabel:'Your invite link',
    referralShareBtn:'Share the link',
    referralShareTitle:"Join me on Libero's Multi!",
    referralShareText:url=>`🎮 Come play with me on Libero's Multi! Use my link and we each earn 100 ⚡: ${url}`,
    referralCount:n=>`🏅 You already referred ${n} player${n>1?'s':''}.`,
    referralRewardSponsor:(amount,name)=>`🤝 Your friend ${name} played their first game: +${amount} ⚡!`,
    referralRewardChild:amount=>`🤝 Welcome! Your referral earns you +${amount} ⚡!`,
    // Levels and XP
    levelMain:lv=>`Level ${lv}`,
    levelSub:(xp,next)=>`${xp} XP · next level at ${next} XP`,
    levelUpToast:(lv,reward)=>`🎉 Level ${lv} reached! +${reward} ⚡`,
    // Wheel of fortune
    wheelCardTitle:'Wheel of fortune', wheelCardSub:'1 free spin a day, up to 250 ⚡',
    wheelTitle:'🎡 Wheel of fortune',
    wheelIntro:'One free spin a day. Try your luck!',
    wheelSpinBtn:'🎡 Spin the wheel',
    wheelWin:p=>`🎉 You win ${p} ⚡! Come back tomorrow for another spin.`,
    wheelDone:'⏳ You already spun the wheel today. Come back tomorrow!',
    wheelNoName:'Pick a nickname first to spin the wheel.',
    // Friends
    friendsCardTitle:'My friends', friendsCardSub:'See who is online and challenge them',
    friendsTitle:'👥 My friends',
    friendsIntro:'Add a friend with their invite code (in "Invite a friend" on their profile), see if they are online and challenge them in one click.',
    friendsAddBtn:'Add', friendsAddPlaceholder:'Friend code (8 characters)',
    friendsEmpty:'No friends yet. Ask your classmates for their code!',
    friendsOnline:'online', friendsOffline:'offline',
    friendsChallengeBtn:'⚔️ Challenge', friendsRemoveBtn:'✕',
    friendsErrInvalid:'Invalid code.', friendsErrNotFound:'No player with this code.', friendsErrFull:'List full (30 friends max).',
    friendsErrAlready:'You are already friends.', friendsErrNoName:'Pick a nickname first.',
    friendRequestSent:name=>`✅ Friend request sent to ${name}!`,
    friendRequestAccepted:name=>`🤝 You and ${name} are now friends!`,
    friendRequestFrom:name=>`👥 ${name} wants to be your friend`,
    friendReqAccept:'Accept', friendReqDecline:'Decline',
    friendsPendingLabel:'📥 Pending requests', friendsListLabel:'👥 My friends',
    friendsGiftTitle:name=>`🎁 Gift Libs to ${name}`,
    friendsGiftSent:(n,name)=>`🎁 ${n} ⚡ sent to ${name}!`,
    friendsGiftErrDaily:left=>`Daily limit of 500 ⚡ gifted reached (${left} ⚡ left to gift today).`,
    friendsGiftErrInsufficient:'Insufficient balance.',
    friendsGiftLibsLabel:'Amount in Libs', friendsGiftVipLabel:'Or gift them a VIP Pass',
    friendsGiftVipBtn:price=>`👑 VIP Pass 30d (${price} ⚡)`, friendsGiftVipShort:price=>`a VIP Pass (${price} ⚡)`,
    friendsGiftConfirm:(what,name)=>`✅ Confirm: gift ${what} to ${name}`,
    friendsGiftVipSent:name=>`👑 VIP Pass gifted to ${name}!`,
    friendsGiftVipTargetMax:name=>`${name} already has the maximum VIP stored (3 months).`,
    giftRecvTitle:'🎁 You received a gift!',
    giftRecvLibs:(from,n)=>`${from || 'Someone'} gifted you ${n} ⚡!`,
    giftRecvCosm:from=>`${from || 'Someone'} gifted you a cosmetic! Find it in your locker.`,
    giftRecvVip:from=>`👑 ${from || 'Someone'} gifted you a 30-day VIP Pass! Enjoy your +20% Libs.`,
    giftRecvBoth:(from,n)=>`${from || 'Someone'} gifted you ${n} ⚡ and a cosmetic!`,
    challengeFriendBtn:'⚔️ Challenge a friend',
    friendPickTitle:'⚔️ Who do you want to challenge?',
    friendPickNone:'No friend online right now. Add friends in your Profile!',
    friendPickNeedGame:'Choose a game first.',
    friendPickNeedTheme:'Choose at least one quiz theme first.',
    playerCardLevel:lv=>`⭐ Level ${lv}`,
    playerCardAddFriend:'👥 Send friend request', playerCardFriends:'✅ You are friends',
    playerCardRequested:'⏳ Request already sent', playerCardYou:'That\'s you!',
    playerCardOnline:'🟢 Online', playerCardOffline:'⚪ Offline', playerCardVip:'👑 VIP',
    friendsChallengeSent:name=>`⚔️ Challenge sent to ${name}! Waiting...`,
    friendChallengeToast:(name)=>`⚔️ ${name} challenges you!`,
    friendChallengeAccept:'Accept', friendChallengeDecline:'Ignore',
    friendsMyCode:code=>`Your friend code: ${code}`,
    // IQ
    iqCardTitle:'My IQ',
    iqCardLocked:n=>`Finish ${n} more quizzes to unlock the test`,
    iqCardUnlocked:'Test unlocked: measure your approximate IQ!',
    iqCardValue:v=>`Estimated IQ: ${v}`,
    iqTitle:'🧠 IQ test',
    iqIntroLocked:n=>`The IQ test unlocks by playing quizzes. Finish ${n} more quizzes (solo or group) to access it!`,
    iqIntroReady:'15 logic questions, 30 seconds each. Answer fast and well: the result is a playful estimate of your IQ (this is not a medical test). Ready?',
    iqCooldown:d=>`You can retake the test in ${d}.`,
    iqStartBtn:'🧠 Start the test',
    iqProgress:(i,n)=>`Question ${i}/${n}`,
    iqResultValue:v=>`Your estimated IQ: ${v}`,
    iqResultNote:'Playful estimate based on your accuracy and speed. Keep playing quizzes and retake it in 3 days!',
    iqShareBtn:'📣 Share',
    iqShareText:v=>`🧠 My estimated IQ on Libero's Multi: ${v}! Come test yours: https://libero-multi.vercel.app`,
    // VIP
    vipCardTitle:'VIP Pass', vipCardSub:'+20% Libs on your earnings for 30 days',
    vipTitle:'👑 VIP Pass',
    vipIntro:price=>`Become VIP for 30 days for ${price} ⚡:`,
    vipPerks:['👑 VIP badge on your profile','⚡ +20% Libs on streak, challenges, wheel and tournament','🎡 Wheel of fortune prizes boosted too'],
    vipBuyBtn:price=>`👑 Become VIP (${price} ⚡)`,
    vipActive:d=>`👑 You are VIP until ${d}. Buy again to extend by 30 days!`,
    vipDone:'👑 You are now VIP for 30 days! Enjoy your +20%.',
    vipInsufficient:price=>`You need ${price} ⚡ to become VIP. Top up in the shop!`,
    vipMax:'You already have the maximum VIP stored (3 months). Come back later!',
    joinName:{
      title:'🎮 They are waiting for you!',
      intro:'A friend invited you to a game. Pick your nickname first to join them.',
      placeholder:'Your nickname', go:'Join',
      invalid:'Pick a nickname of at least 2 characters.',
    },
    emotesCardTitle:'Emotes', emotesCardSub:'20 reactions to send in game (5 equipped max)',
    emoteUnavailable:'This emote is no longer available.',
    settingsCardTitle:'Settings', settingsCardSub:'Language, theme, sounds, music, snake',
    emojirain:{
      cardTitle:'Emoji rain', cardSub:'Pick a theme or your own emojis',
      title:'🌈 Emoji rain',
      intro:'The emoji rain plays when you arrive on the site. Pick its theme, or build your own rain!',
      standard:'Standard (site games)', custom:'Custom',
      customLabel:'Your emojis (15 max)',
      customEmpty:'Type at least one emoji.',
      saved:n=>`Saved! ${n} emoji${n>1?'s':''} in your rain.`,
      unlock:price=>`Unlock (${price} ⚡)`,
      test:'▶ Test the rain',
    },
    resetCardTitle:'Reset account', resetCardSub:'Start over from scratch',
    resetTitle:'🗑️ Reset account',
    resetIntro:'Resetting permanently deletes all your progress (Libs, cosmetics, streak, history) and removes you from every leaderboard. The site then restarts as if it were your very first visit.',
    resetSaveHint:'Not sure yet? Save your recovery code below first if you want to think about it. Warning: after the reset this code will no longer work, the deletion is final. Saving it is optional.',
    resetCodeLabel:'Your recovery code (only valid before the reset)',
    resetConfirmLabel:'I understand my progress will be permanently deleted and I will disappear from the leaderboards.',
    resetConfirmBtn:'Reset permanently',
    onboarding:{
      welcomeType:"Welcome to Libero's Multi",
      start:'Start',
      themeLabel:'Pick your theme', themeDay:'☀️ Day', themeNight:'🌙 Night',
      title:'👋 Welcome!',
      intro:'Already have an account on another device? Paste your recovery code to get your progress back. Otherwise, start a new adventure.',
      label:'I already have a recovery code',
      restore:'Recover',
      newBtn:"No, I'm new, let's start",
      invalid:'This code is invalid.',
    },
    lockerBackCats:'All categories',
    shopGiftBtn:price=>`🎁 Gift (${price} ⚡)`,
    giftChoiceTitle:name=>`🎁 Gift ${name}`,
    giftChoiceIntro:price=>`This item costs ${price} ⚡. Choose how to gift it:`,
    giftChoiceFriendsLabel:'Choose a friend to send it to directly:',
    giftChoiceNoFriends:'No friends yet. Add friends in your Profile, or gift by link/code.',
    giftChoiceSendBtn:'Choose',
    giftChoiceConfirmLink:(name,price)=>`You will pay ${price} ⚡ and get a gift link + code for ${name}, to share with anyone.`,
    giftChoiceConfirmFriend:(name,friend,price)=>`You will pay ${price} ⚡ to gift ${name} directly to ${friend}. They receive it right away with a message.`,
    giftChoiceConfirmBtn:price=>`✅ Confirm (${price} ⚡)`,
    giftChoiceSentFriend:name=>`🎁 Gift sent to ${name}!`,
    giftChoiceTargetOwns:'Your friend already owns this item.',
    shopGiftReceiveTitle:'🎁 Receive a gift',
    shopGiftReceiveDesc:'A friend gifted you a cosmetic? Enter the gift code they sent you to unlock it.',
    shopGiftReceiveBtn:'Receive',
    shopGiftPlaceholder:'Gift code',
    giftTitle:'🎁 Gift ready!',
    giftIntro:'Send the gift link to anyone you like: opening it delivers the gift automatically. If they cannot open the link, they can also enter the code in the shop (Receive a gift section).',
    giftLinkLabel:'Gift link (just open it)',
    giftCodeLabel:'Gift code (if the link does not work)',
    giftShareBtn:'Share the gift', giftWarn:'The gift can only be used once (link or code).',
    giftShareTitle:"A gift on Libero's Multi",
    giftShareText:(code,url)=>`🎁 I'm sending you a gift on Libero's Multi! Open this link to receive it: ${url}\nOr enter this code in the shop (Receive a gift): ${code}`,
    giftReceived:name=>name ? `🎁 Gift from ${name} unlocked!` : '🎁 Gift unlocked!',
    giftReceivedBundle:name=>name ? `🎁 Gift pack from ${name} unlocked! Check your locker.` : '🎁 Gift pack unlocked! Check your locker.',
    giftUsed:'This gift has already been used.',
    giftInvalid:'Invalid gift code.',
    readLoading:'Loading books…',
    readEmpty:'This section is under development.\nCheck back soon for books!',
    readError:'This section is under development.\nCheck back soon for books!',
    readSearch:'Search a title or author...',
    readAll:'All', readBtn:'📖 Read', readBack:'Back',
    readNoResult:'No book matches your search.',
    bookExclusive:'⭐ Exclusive', bookChaptersTitle:'Chapters', bookFree:'Free',
    bookComingSoon:'Coming soon', bookUnlockFor: price => `🔓 Unlock for ${price} ⚡`,
    bookLockedRange: (from,to) => `Chapters ${from} to ${to}`,
    bookInsufficient:'Not enough Libs! Play to earn more.',
    bookNeedName:'Pick a nickname first (in any game section) to buy.',
    bookNeedPrevious:'Unlock the previous chapters first.',
    bookSequelLocked: titre => `🔒 Sequel reserved: unlock all of "${titre}" to read this volume.`,
    bookSequelUnlocked:'✅ Included with the previous volume: enjoy!',
    bookSequelGoto: titre => `📕 View "${titre}"`,
    bookUnlocked:'✅ Chapters unlocked! Enjoy.',
    bookPrev:'← Previous', bookNext:'Next →', bookReaderClose:'✕',
    bookChapterLocked:'🔒 This chapter is locked.',
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
    btnShare:'🔗 Share link', btnTriviaShare:'🔗 Share link', linkCopied:'Link copied!',
    shareTitle:"Join my game on Libero's Multi",
    shareText: code => `Join my game on Libero's Multi (code ${code}):`,
    joinLinkFailed:'Game not found. The link may have expired.',
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
    games:{ connect4:'Connect 4', tictactoe:'Tic Tac Toe', chess:'Chess', checkers:'Checkers', ludo:'Ludo' },
    ludoRoll:'🎲 Roll the dice', ludoDice:d=>`🎲 Dice: ${d}`, ludoNoMove:'No possible move, turn passes.',
    playerNames:{
      connect4:{ R:'Red', Y:'Yellow' },
      tictactoe:{ R:'Cross', Y:'Circle' },
      chess:{ R:'White', Y:'Black' },
      checkers:{ R:'Red', Y:'Yellow' },
      ludo:{ R:'Red', Y:'Yellow' },
    },
    errNoGame:'Choose a game first.',
    restartRequestedPrompt:'Your opponent wants a rematch.',
    restartDeclined:'Your opponent declined the rematch.',
    btnCancel:'Cancel', btnAccept:'Accept', btnRefuse:'Decline',
    diffLabels:{ easy:'Easy', medium:'Medium', hard:'Hard', extreme:'Extreme' },
    diffHints:{ '':'🎲 Mixed: questions from all levels shuffled.', easy:'😊 Easy: the great classics, perfect to start.', medium:'🎯 Medium: solid general knowledge.', hard:'💀 Hard: sharp questions for connoisseurs.', extreme:'🔥 Extreme: sharp questions AND a 15-second timer per question!' },
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
    triviaCorrect:'✅ Correct!', triviaFastBonus:'⚡ Lightning answer: double points!', triviaWrong:'❌ The answer was: ',
    triviaFinishedTitle:'Final Results', btnLeaveGame:'Back to menu', btnQuitTrivia:'🚪 Quit',
    triviaPodiumWin:'🏆 Quiz champion!', triviaPodiumTop3:'🎉 On the podium!', triviaPodiumOut: r => `You finished ${r}th, the podium awaits you next time!`,
    triviaShareBtn:'📣 Share my result',
    triviaShareRank: (rank, score) => rank === 1
      ? `🏆 I finished 1st in a group quiz on Libero's Multi with ${score} pts! Think you can beat me? Come challenge me: https://libero-multi.vercel.app`
      : `🎯 I finished #${rank} in a group quiz on Libero's Multi with ${score} pts! Come play with us: https://libero-multi.vercel.app`,
    triviaShareSolo: score => `🧠 I scored ${score} pts in a quiz on Libero's Multi! Try to beat that: https://libero-multi.vercel.app`,
    triviaShareCopied:'📋 Message copied! Paste it to your friends.',
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
    chatbot:{
      fabTitle:'Libero Assistant',
      title:'🤖 Libero Assistant',
      subtitle:'Ask a question about the site',
      placeholder:'Type your question…',
      reset:'Clear the conversation',
      greeting:"Hi! I'm the Libero's Multi assistant. Ask me anything about the site (Libs, shop, books, games, challenges…) or pick a topic below.",
      thanks:'You are welcome! Anything else?',
      answerIntro:'Here is what I found:',
      fallback:"I don't have a precise answer for that. Try rephrasing, open the full help with the ❓ button (bottom right), or message the creator via the ✉️ button in the bottom left.",
      suggestions:[
        { q:'How do I earn Libs?' },
        { q:'How do I buy Libs?' },
        { q:'What is Libero Run?' },
        { q:'How do I read a book?' },
        { q:'How do I equip a cosmetic?' },
        { q:'How do I gift a cosmetic?' },
        { q:'How do I save my progress?' },
        { q:'How do I play the quiz?' },
      ],
    },
    shopTitle:'⚡ Shop', shopBalanceLabel:'Your balance:',
    shopBoostHintName:'💡 Quiz Hint',
    shopBoostHintDesc:'Eliminates a wrong answer. Usable up to 2 times per question.',
    shopBtnBuy10:'10 hints · 3 ⚡', shopBtnBuy20:'20 hints · 5 ⚡',
    shopPending:n => `${n} hint${n > 1 ? 's' : ''} remaining`,
    shopInsufficient:'Champion, you don\'t have enough Libs.', shopBuyError:'Purchase failed.',
    shopBuyOk:'Boost purchased!',
    shopPromoTitle:'🎟 Promo code', shopPromoPlaceholder:'4-character code', shopPromoBtn:'Redeem',
    shopPromoOk:n => `🎉 +${n} ⚡ credited!`,
    shopPromoAlreadyUsed:'You have already used this code.', shopPromoInvalid:'Invalid code.', shopPromoAnon:'Anonymous players cannot use codes.',
    shopCosmeticsTitle:'🎨 Pseudo cosmetics',
    shopCosmeticNames:{ rainbow:'Rainbow', galaxy:'Galaxy', silver:'Silver', bronze:'Bronze', gold:'Gold', diamond:'Diamond' },
    shopCosmeticBuy:p => `Buy · ${p} ⚡`,
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
    shopSnakeSkinsTitle:'🐍 Snake skins (Events)',
    shopSnakeSkinNames:{'snakeskin-gems':'Gem Snake','snakeskin-cyber':'Cyber Snake','snakeskin-lava':'Lava Snake','snakeskin-galaxy':'Galaxy Snake','snakeskin-rainbow':'Rainbow Snake'},
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
    shopEmoteNames:{'emote-hello':'Hello 👋', 'emote-gg':'GG 👍', 'emote-sad':'Sniff 😢', 'emote-wellplayed':'Well played 🤝', 'emote-laugh':'LOL 😂', 'emote-think':'Hmm 🤔', 'emote-cool':'Cool 🆒', 'emote-clap':'Bravo 👏', 'emote-fire':'On fire 🔥', 'emote-heart':'Heart ❤️', 'emote-cry':'Tears 😭', 'emote-angry':'Grr 😤', 'emote-shock':'Mind blown 🤯', 'emote-easy':'Too easy 😎', 'emote-eyes':'Seen 👀', 'emote-skull':'Dead 💀', 'emote-party':'Party 🥳', 'emote-rocket':'Rocket 🚀', 'emote-omg':'OMG 😱', 'emote-crown':'King 👑'},
    shopFeaturedTitle:'⭐ Featured',
    shopDailyTitle:'📅 Daily',
    shopBundlesTitle:'🎁 Bundles',
    shopSectionDescs:{
      featured:"This week's picks · refreshes every 24h.",
      daily:"Discounted deals, refreshed every day.",
      bundles:"Themed packs at a reduced price. Already own some items? The price adjusts automatically.",
      colors:"Color your username across leaderboards and matches.",
      fonts:"Change the font of your username everywhere on Libero.",
      bubbles:"Customize the look of your chat bubbles.",
      bgs:"Apply an animated background to your play area.",
      nameeffects:"Add an animated visual effect directly to your username.",
      titles:"Display a title next to your username in the leaderboard.",
      cursorsnakes:"Replace your mouse cursor with an animated snake.",
      snakeskins:"Change how your snake looks during the weekend Snake Challenge.",
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
    shopBundlePartialOwned: n => `You already own ${n} item${n>1?'s':''} · price adjusted.`,
    shopBundleBuy: p => `Buy bundle · ${p} ⚡`,
    shopBundleBuyOk:'🎁 Bundle purchased!',
    shopBundleAnon:'Anonymous players cannot buy bundles.',
    shopBundleInsufficientFunds:'Champion, you don\'t have enough Libs.',
    shopBundleError:'Purchase failed.',
    shopBundleNames:{ 'bundle-debutant':'Starter Pack','bundle-retro':'Retro Pack','bundle-neon-arcade':'Neon Arcade Pack','bundle-galaxie':'Galaxy Pack','bundle-prestige-or':'Gold Prestige Pack','bundle-hologramme':'Ultimate Hologram Pack' },
    shopNavLabels:{ featured:'Featured', daily:'Daily', bundles:'Bundles', boosts:'Boosts', colors:'Colors', fonts:'Fonts', bubbles:'Bubbles', bgs:'Backgrounds', nameeffects:'Effects', titles:'Titles', codes:'Codes', cursorsnakes:'Cursor', snakeskins:'Snake', avatars:'Avatars', p4tokens:'P4', ttt:'Tic-Tac', chess:'Chess', clickfx:'Particles', emojipacks:'Emojis', victorybans:'Victory', soundpacks:'Sounds', emotes:'Emotes' },
    shopLibsPacksTitle:'💳 Top up your Libs',
    shopLibsPacksDesc:'Buy Libs ⚡ with real money (mobile money / card, secure FedaPay checkout). Credit is verified by our servers, never instant on the browser side.',
    shopLibsPacksLoading:'Loading packs…',
    shopLibsPacksUnavailable:'Top-up unavailable right now.',
    shopLibsPacksBuy:'Buy', shopLibsPacksSoon:'Coming soon',
    shopLibsPackNames:{ decouverte:'Discovery', populaire:'Popular', pro:'Pro', mega:'Mega', ultime:'Ultimate' },
    shopLibsPacksFeatured:'⭐ Popular',
    shopLibsPacksBonus:n => `+${n} free`,
    shopLibsBuyTitle:'💳 Top up your Libs',
    shopLibsBuySummary:(libs, price) => `⚡ ${libs} Libs · ${price.toLocaleString('en-US')} FCFA. You'll be redirected to the secure payment page.`,
    shopLibsBuySubmit:'Pay',
    shopLibsBuyMissing:'Fill in email, first and last name to continue.',
    shopLibsBuyBadEmail:'Invalid email address.',
    shopLibsBuyAnon:'Pick a nickname first to buy Libs.',
    shopLibsBuyRateLimited:'Too many attempts. Try again in a moment.',
    shopLibsBuyError:'Could not start the payment. Try again later.',
    shopLibsBuyProcessing:'Redirecting to payment…',
    shopLibsBuyCredited:n => `⚡ +${n} Libs added! Thanks for your purchase.`,
    shopLibsBuyFailed:'The payment did not go through. No Libs were charged.',
    shopLibsBuyEmailPh:'Email', shopLibsBuyFirstPh:'First name', shopLibsBuyLastPh:'Last name', shopLibsBuyPhonePh:'Phone (optional)',
    shopDailyBadge:'Daily',
    settingsTitle:'⚙️ Settings',
    settingsLang:'Language', settingsTheme:'Theme', settingsSnake:'Snake',
    settingsSnakeOn:'Enabled', settingsSnakeOff:'Disabled', settingsSnakeInGame:'🐍 In Game',
    snakeBusyInGame:'🐍 The snake is in Game!',
    settingsSfx:'Sound', settingsSfxOn:'Enabled', settingsSfxOff:'Disabled', settingsSfxVol:'Volume',
    settingsBgm:'Music', settingsBgmOn:'Enabled', settingsBgmOff:'Disabled', settingsBgmVol:'Music vol.',
    settingsRefundTitle:'Refund cards',
    settingsPush:'Notifications', settingsPushOn:'🔔 Enabled', settingsPushOff:'🔕 Disabled',
    pushEnabledToast:'🔔 Notifications enabled! You will be alerted about tournaments, challenges and news.',
    pushDeniedToast:'🔕 Notifications blocked by the browser. Allow them in the site settings.',
    pushUnsupported:'This browser does not support notifications.',
    flashOfferTitle:'⚡ FLASH OFFER', flashOfferEnds:t=>`Ends in ${t}`,
    legalLinkSettings:'📄 Legal notice · Terms · Privacy',
    legalLinkFooter:'Legal notice · Terms of Sale · Privacy',
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
    helpLibsBuyTitle:'💳 Top up with real money',
    helpLibsBuyDesc:'In the shop, the <strong>💳 Top up</strong> tab lets you buy Libs packs with real money (mobile money / card, secure checkout via FedaPay). After paying, you\'re redirected back to the site: your Libs are credited as soon as the payment is confirmed by our servers (usually within seconds). A valid email is required for order confirmation.',
    helpBoostTitle:'Quiz Hint Boost',
    helpBoostDesc:'In the shop, buy a <em>Hint Boost</em> (3 ⚡): it eliminates a wrong answer per question for a whole quiz. The 💡 button appears in the quiz as soon as the boost is active and can be used once per question.',
    eventsTitle:'Events', eventsDesc:'Fri-Sun · Snake Challenge',
    eventsDescLocked:'Next weekend',
    eventsLockedCard: days => `📅 In ${days}d`,
    eventsLockedMsg:  days => `🐍 <strong>Snake Challenge might be back in ${days} day${days>1?'s':''}</strong> <u style="cursor:pointer">vote here</u>!`,
    eventActiveMsg:   '🐍 <strong>Event this weekend</strong>: Snake Challenge! Your snake eats ⚡ and every Lib eaten is added to your balance.',
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
    snakeHsDisplay:n => `🏆 Your record: ${n} ⚡`,
    snakeLibsEarned:n => `+${n} ⚡ added to your balance!`,
    profileCardTitle:'My profile', profileCardDesc:'Challenges · Streak · History',
    profileTitle:'My profile',
    challengesTitle:'🎯 Daily challenges', historyTitle:'🕑 My recent games',
    profileAnon:'Pick a nickname (in a game) to track your challenges, streak and history!',
    challengesNames:{
      wins3:'Win 3 games', play5:'Play 5 games (any game)',
      trivia5:'Answer 5 quiz questions right', trivia12:'Answer 12 quiz questions right', quiz2:'Finish 2 quizzes',
      snake30:'Eat 30 ⚡ in Snake', snake60:'Eat 60 ⚡ in Snake',
      luffy12000:'Rack up 12000 pts in Libero Run', luffyGames3:'Play 3 Libero Run games',
      perm_wins50:'Win 50 classic games', perm_wins250:'Win 250 classic games',
      perm_play500:'Play 500 classic games', perm_trivia1000:'Answer 1000 quiz questions right',
      perm_snake2000:'Eat 2000 ⚡ in Snake', perm_luffy500k:'Rack up 500,000 pts in Libero Run',
      perm_streak30:'Hold a 30-day login streak',
      perm_wheel30:'Spin the wheel of fortune 30 times', perm_ludo25:'Win 25 Ludo games',
      perm_gift5:'Send 5 gifts to other players',
    },
    permTitle:'🏔️ Permanent challenges',
    permSub:'Long-haul feats: progress never resets. Huge rewards, up to 5000 ⚡!',
    challengePerfectDay: bonus => `🎉 Perfect day! All 3 challenges claimed: +${bonus} ⚡ bonus`,
    triviaSkip:'⏭ Skip',
    challengeClaim:'Claim', challengeClaimed:'✓ Claimed', challengeLocked:'In progress',
    challengeReward:n => `+${n} ⚡`,
    challengeClaimToast:n => `Challenge complete! +${n} ⚡`,
    streakMain:n => `${n}-day streak 🔥`,
    streakNone:'Start your streak today!',
    streakSub:(l, b) => `Best: ${l} day${l > 1 ? 's' : ''}${b > 0 ? ` · +${b} ⚡ today` : ''}`,
    streakBonusToast:(n, b) => `Day ${n} streak · +${b} ⚡!`,
    historyEmpty:'No games yet. Start one!',
    historyGameNames:{ connect4:'Connect 4', tictactoe:'Tic Tac Toe', chess:'Chess', trivia:'Quiz', snake:'Snake', luffy:'Libero Run' },
    historyResults:{ win:'Win', loss:'Loss', draw:'Draw' },
    historyScore:n => `${n} pts`,
    bookReaders:n => `${n} reader${n > 1 ? 's' : ''}`,
    bookOriginalOnly:'📖 English translation coming soon. Here is the original version (French).',
    snakeGameOver:'Game Over', snakeNewRecord:'🏆 New record!',
    btnSnakeRestart:'Play again', btnSnakeQuit:'Quit',
    snakePause:'⏸ Pause', btnSnakeResume:'▶ Resume',
    btnSnakeBack:'← Back', btnSnakeHome:'🏠 Quit',
    snakeHint:'↑ ↓ ← → or swipe on mobile',
    luffyChallengeDesc:'Help Libero run as far as possible! Jump over ground obstacles, duck under flying ones.',
    luffyNameTitle:'🏃 Your username',
    luffyLbTitle:'Libero Run Leaderboard',
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
    commentSub:'Share your thoughts, an idea or a bug report · the creator will receive it by email.',
    commentPseudoPh:'Your username (optional)',
    commentMsgPh:'Your message…',
    btnSend:'Send ✉️',
    commentWaitBtn:'Please wait…',
    commentLessMin:'under a minute',
    commentCooldown:str=>`⏳ Limit reached (3/h). Try again in ${str}.`,
    commentUnknownErr:'Unknown error.',
    tutoSkip:'Skip guide', tutoOk:'Got it ✓',
    newsTitle:'📰 News',
    btnHelpTitle:'Help', btnSnakeToggle:'Enable / Disable the snake', libsCounterTitle:'Open shop',
    snakeOverScore:(score, hs) => `Score: ${score} · Best: ${hs}`,
    helpContent:{
      general:[
        { icon:'🏠', title:'Home sections', desc:"The home page offers <em>Classic Games</em> (Connect 4, Tic Tac Toe, Chess), <em>General Knowledge</em> (themed quizzes), <em>Events</em> (weekend mini-games) and <em>Community</em> (the <strong>Libero Run</strong> mini-game, a player idea brought to life by the creator). Each section has its own leaderboard." },
        { icon:'🎯', title:'My profile', desc:"The <strong>Profile</strong> tab (in the bottom bar, next to Home) gathers four things: your <strong>locker</strong> (see below), your <strong>daily challenges</strong> (3 goals that <strong>change every day</strong>: never the same challenge two days in a row, with Snake on weekends and Libero Run on weekdays; claim all 3 for a <strong>'perfect day' +30 ⚡ bonus</strong>), your <strong>login streak</strong> (a growing ⚡ bonus for each consecutive day you come back, up to +35) and the <strong>history</strong> of your last 20 games. You'll also find the <strong>Save my progress</strong> card (your recovery code) and the <strong>Reset account</strong> card. A nickname is required." },
        { icon:'🎒', title:'My locker', desc:"In the <strong>Profile</strong> tab, the <strong>locker</strong> holds everything you own, <strong>sorted by category</strong>. Each category is a <strong>card</strong>: tap it to see the items of that type with their <strong>visual preview</strong>, then <strong>equip</strong> or <strong>unequip</strong> directly, without opening the shop. Bonus: <strong>3 free backgrounds</strong> (Calm Night, Deep Slate, Violet Mist) are gifted to every player and are already waiting inside. Items you had bought that were later removed from sale are still available here." },
        { icon:'🔐', title:'Recovery code', desc:"In the <strong>Profile</strong> tab, the <strong>Save my progress</strong> card shows your <strong>recovery code</strong>: it is the key to your account. Write it down somewhere safe! If you change or lose your device, paste this code on the new device (same card → <em>Restore</em>) to get <strong>all your progress</strong> back: Libs, cosmetics, streak, history and nickname. On your very first visit, the site also offers to recover an existing progress. Never share this code with anyone." },
        { icon:'🗑️', title:'Reset account', desc:"In the <strong>Profile</strong> tab, the <strong>Reset account</strong> card <strong>permanently</strong> deletes all your progress: Libs, cosmetics, streak, history, and you <strong>disappear from every leaderboard</strong>. The site then restarts as if it were your very first visit (welcome animation included). You must tick the confirmation box to proceed. Warning: after the reset, your old recovery code no longer works." },
        { icon:'🎁', title:'Gift a cosmetic or a pack', desc:"You can <strong>gift</strong> any paid cosmetic <strong>or pack (bundle)</strong> from the shop! Open its detail sheet and click <strong>🎁 Gift</strong>, then choose how: <strong>👥 straight to a friend</strong> (they get it right away with a message), <strong>🔗 via a link</strong> to share, or <strong>🔢 via a code</strong>. A <strong>confirmation button</strong> shows the price before charging your ⚡, nothing is sent until you confirm. Link and code can only be used <strong>once</strong>." },
        { icon:'🎉', title:'Events', desc:"Special mini-games appear on some weekends. The card is <strong>locked</strong> outside the weekend and shows a countdown to the next event. When active: <em>Snake Challenge</em> · your snake eats <strong>⚡ Libs</strong> to grow, and every ⚡ eaten is <strong>added to your balance</strong> (score 10 = 10 Libs earned). Walls wrap around. A new record shows <em>🏆 New record!</em>. Press <strong>⏸</strong> (or Esc / P) to pause." },
        { icon:'🏆', title:'Saturday tournament', desc:"Every <strong>Saturday</strong>, an automatic tournament runs across the whole site (followed live in the <strong>News</strong> card): classic wins <strong>+10 pts</strong>, correct quiz answers <strong>+2 pts</strong>, ⚡ eaten in Snake <strong>+1 pt</strong>. At midnight the best player wins <strong>2000 ⚡</strong> and the honorary <strong>\"Weekly Champion\"</strong> title, kept until the next tournament. The top 10 shows live." },
        { icon:'🤝', title:'Invite a friend (referral)', desc:"In the <strong>Profile</strong> tab, the <strong>Invite a friend</strong> card gives you your <strong>invite link</strong>. When a new player arrives through your link and plays their <strong>first game</strong>, you each receive <strong>+100 ⚡</strong>. The number of players you referred shows in the window." },
        { icon:'💰', title:'Stake duels', desc:"When creating a classic multiplayer game, you can pick a <strong>stake</strong> (25, 50 or 100 ⚡). Both players pay the stake at the start and <strong>the winner takes all</strong> (double). Draw or cancelled game: both are <strong>refunded</strong>. A nickname and enough balance are required on both sides; a rematch re-collects the same stake if both can pay." },
        { icon:'⭐', title:'Levels and XP', desc:"Every game earns you <strong>XP</strong> (+25 per game, bonus for a <strong>win</strong> and for your <strong>quiz</strong> score). Your <strong>level</strong> shows at the top of your Profile with a progress bar. Each new level rewards you with <strong>⚡ Libs</strong> (more and more), and milestones <strong>10, 25 and 50</strong> grant a big bonus (up to <strong>+5000 ⚡</strong>)." },
        { icon:'🧠', title:'IQ test', desc:"In your <strong>Profile</strong>, the <strong>My IQ</strong> card unlocks after <strong>10 finished quizzes</strong> (solo or group). The test: <strong>15 logic questions</strong>, 30 seconds each. Your accuracy and speed give an <strong>estimated IQ</strong> (a playful estimate, not a medical test!). You can retake it every <strong>3 days</strong> and <strong>share</strong> your score with friends." },
        { icon:'🎡', title:'Wheel of fortune', desc:"In your <strong>Profile</strong>, the <strong>Wheel of fortune</strong> card gives you <strong>one free spin a day</strong>: win <strong>5 to 250 ⚡</strong> every spin. A nickname is required. Come back every day for your free spin!" },
        { icon:'👥', title:'My friends', desc:"In your <strong>Profile</strong>, the <strong>My friends</strong> card: send a <strong>friend request</strong> with the other player's <strong>friend code</strong> (the same code as in \"Invite a friend\"), or by clicking a <strong>name in the leaderboards</strong>. They <strong>accept or decline</strong> (pending <strong>requests</strong> show in the My friends window); once friends, you are in each other's list. <strong>Removing a friend</strong> only removes them from <strong>your</strong> list. See who is <strong>online</strong> (green dot), <strong>gift them Libs</strong> 🎁 (10 to 500 ⚡, max 500 gifted per day) and <strong>challenge them</strong> from the <strong>Classic Games</strong> and <strong>Quiz</strong> areas (⚔️ Challenge a friend button: you pick the game, themes and stake). Bonus: sponsor and referred player become friends automatically. Up to 30 friends." },
        { icon:'👑', title:'VIP Pass', desc:"In your <strong>Profile</strong>, the <strong>VIP Pass</strong> card: for <strong>2000 ⚡</strong>, become VIP for <strong>30 days</strong>. Perks: a <strong>👑 VIP</strong> badge on your profile and <strong>+20% Libs</strong> on your earnings (login streak, challenges, wheel of fortune, Saturday tournament). Buy again to extend (maximum <strong>3 months</strong> of VIP stored). You can also <strong>gift a VIP Pass to a friend</strong> from the 🎁 window in your friends list." },
        { icon:'🎲', title:'Ludo', desc:"Classic <strong>Ludo</strong> in 1 vs 1: 4 pawns each, roll the <strong>dice</strong>, you need a <strong>6</strong> to leave the base. Landing on an opponent's pawn <strong>captures</strong> it (back to base), except on <strong>starred ★</strong> squares. A 6 or a capture lets you <strong>play again</strong>. Take all 4 pawns around the board and up the home column to win. Play against a friend (with an optional <strong>stake</strong>) or against the bot." },
        { icon:'🌱', title:'Revision quizzes', desc:"Three <strong>school-focused</strong> quiz themes are available: <strong>🌱 Biology</strong>, <strong>🇬🇧 English</strong> and <strong>🇧🇯 Benin</strong> (the country's history and geography). Revise while having fun, solo or in a room with your class! Three difficulty levels like the other themes." },
        { icon:'📱', title:'Install the app and notifications', desc:"The site <strong>installs like an app</strong>: in your browser, menu → <strong>\"Add to Home screen\"</strong> (or \"Install app\"). You can also enable <strong>🔔 notifications</strong> in <strong>Profile → Settings → Notifications</strong> to be alerted about tournaments, news and flash offers, even when the site is closed." },
        { icon:'⚡', title:'Flash offers', desc:"From time to time, a cosmetic goes on <strong>FLASH OFFER</strong>: a golden banner appears at the top of the <strong>shop</strong> with a discount (up to -90%) and a countdown. When it is over, it is over: keep an eye out (and enable notifications so you never miss one)!" },
        { icon:'📚', title:'Reading', desc:"The <strong>Reading</strong> tab opens a book catalogue: search by title or author, filter by category, and click a book for its detail sheet. You'll find the <strong>exclusive novels</strong> readable right on the site (in French or English, following the site language): <strong>⭐ L'Affaire endormie · Tome 1</strong> (chapter 1 free, 1000 ⚡ for chapters 2-5, 2000 ⚡ for 6-10), <strong>Life of Georgia</strong> (whole book for 2000 ⚡) and its sequel <strong>Life of Georgia · Volume 2</strong>, <strong>free</strong> for everyone who unlocked Volume 1." },
        { icon:'🎮', title:'Create a classic game', desc:"First choose a game among <strong>Connect 4</strong>, <strong>Tic Tac Toe</strong>, <strong>Chess</strong>, <strong>Checkers</strong> or <strong>Ludo</strong> (none is pre-selected), enter your username (optional) then click <em>Create a game</em>. Share the 4-letter code with your opponent, or the <strong>link</strong>. You can cancel while waiting if nobody joins. You can also play <strong>Solo vs the bot</strong> (Easy, Medium or Hard)." },
        { icon:'⛂', title:'Checkers', desc:"The game of <strong>Checkers</strong> (draughts 8x8, 12 pieces each). Men move diagonally one square forward. <strong>Capturing is mandatory</strong>: if you can jump over an opponent piece (empty square behind), you must, and you chain multiple captures with the same piece. A man reaching the last row becomes a <strong>king ♛</strong> that moves and captures both ways. You win when the opponent has no pieces left or cannot move. At the end, <em>Rematch</em> asks the opponent to accept or decline." },
        { icon:'🤖', title:'Solo mode (vs Bot)', desc:"Play alone against a robot. <em>Easy</em>: plays randomly. <em>Medium</em>: blocks and attacks. <em>Hard</em>: plays optimally. <strong>Medium and Hard</strong> games count in the classic leaderboard." },
        { icon:'🔗', title:'Join', desc:"Enter the 4-letter code you received and click <em>Join</em>. The game starts automatically as soon as both players are connected." },
        { icon:'💬', title:'Chat', desc:"Send messages to your opponent during a classic game. The <em>Clear</em> button erases the history on your side only." },
        { icon:'🔄', title:'Reconnection', desc:"If you reload the page, you automatically rejoin your ongoing classic game. The opponent has <strong>30 seconds</strong> to reconnect, otherwise the game is cancelled." },
        { icon:'🔁', title:'Play again', desc:"At the end of a classic game, click <em>Play again</em>. The game restarts only if both players agree." },
        { icon:'🌍', title:'Global leaderboard', desc:"Visible from the home page, it gathers <strong>all players with at least one point</strong>. Score = classic wins (×10) + Quiz points + best Snake score (×10) + best Libero Run score (÷10). Updated in real time." },
        { icon:'🏆', title:'Section leaderboards', desc:"Each section also keeps its own leaderboard: wins/losses/draws for Classic Games, total points for Quiz." },
        { icon:'🏃', title:'Libero Run', desc:"Help Libero, the site's mascot, run as far as possible in this endless runner! Jump (<strong>↑</strong> / Space) over ground obstacles (barrels, cannons, crabs…) and duck (<strong>↓</strong>) under flying ones (seagulls, cannonballs…). Grab the <strong>⭐ shining star</strong> to become invincible for a few seconds: a countdown shows the time left. Your best score <strong>persists</strong> between sessions and feeds its own leaderboard. It's actually a <strong>community idea</strong> brought to life by the creator · if you want yours considered too, leave a comment via the button on the game screen." },
        { icon:'📰', title:'News', desc:"The News card is folded in the <strong>top-left corner</strong>. <strong>Click on it</strong> to open it: it shows the latest <strong>announcements</strong> (new books, site updates) and player <strong>comments</strong>. Click again to close it." },
        { icon:'⚙️', title:'Settings', desc:"In the <strong>Profile</strong> tab, the <strong>⚙️ Settings</strong> card groups all settings: <strong>Language</strong>, <strong>Theme</strong>, <strong>Snake</strong>, <strong>Sound</strong> (SFX + volume), <strong>Music</strong> (background music + volume) and <strong>Refund cards</strong>. Everything is saved between sessions." },
        { icon:'🔊', title:'Sound & Music', desc:"<strong>Sound</strong>: sound effects play on every action (placing a piece, win, quiz, chat, shop, Snake…). Toggle via <strong>⚙️ → Sound</strong> and adjust the volume.<br><strong>Music</strong>: ambient background music plays while you browse. Toggle via <strong>⚙️ → Music</strong> with its own volume slider. Both are controlled independently." },
        { icon:'🐍', title:'Snake', desc:"A little snake follows your cursor. It <strong>grows and changes colour</strong> based on your global score 🌍: gold (1st), blue (2nd), bronze (3rd). Play and climb the leaderboard to make it longer! Enable or disable it via the <strong>⚙️</strong> button (top right) → <strong>Snake</strong>." },
        { icon:'☀️', title:'Day / night theme', desc:"The <strong>⚙️</strong> button in the <em>top right</em> → <strong>Theme</strong> toggles between light and dark theme. The site also adapts automatically based on the time (light 7am–8pm, dark at night). Your manual choice is remembered between sessions." },
        { icon:'🚪', title:'Quit button', desc:"During a game, the <em>🚪 Quit</em> button in the top centre takes you back to the main menu. If a game is in progress, you are warned that you will forfeit before confirming." },
        { icon:'✉️', title:'Leave a comment', desc:"Click the <strong>✉️</strong> button in the bottom left to send a message to the creator: feedback, idea, bug… No account required. You can leave a username or stay anonymous." },
        { icon:'⚡', titleKey:'helpLibsTitle', descKey:'helpLibsDesc' },
        { icon:'💳', titleKey:'helpLibsBuyTitle', descKey:'helpLibsBuyDesc' },
        { icon:'💡', titleKey:'helpBoostTitle', descKey:'helpBoostDesc' },
        { icon:'🗂️', title:'Shop navigation', desc:"On the left side of the shop, a <strong>category bar</strong> works like <strong>tabs</strong>: click an aisle (⭐ Featured, 📅 Daily, 🎁 Bundles, 💡 Boosts, 🎨 Colors, ✨ Effects, 🏷️ Titles, 🖼️ Backgrounds, 🎟️ Codes) and <strong>only that aisle is shown</strong>, neatly laid out. The <strong>🎟️ Codes</strong> tab gathers <em>Receive a gift</em> (gift codes from friends) and <em>promo codes</em>. On mobile only icons are shown." },
        { icon:'🎁', title:'Bundles', desc:"The <strong>Bundles</strong> section offers themed packs grouping several cosmetics at a reduced price (−24% to −28%). If you already own some items in a bundle, the price is <strong>automatically adjusted</strong> · you only pay for what you're missing. The <strong>⭐ Featured</strong> and <strong>📅 Daily</strong> picks refresh every 24 hours · a countdown shows the next refresh time." },
        { icon:'✨', title:'Name Effects', desc:"Animate your username display in leaderboards, chat, badges and the podium. Effects <strong>stack with your username color</strong>: the color sets the hue, the effect adds the animation on top. Examples: Neon Blink, Glitch, Rainbow Wave. Rarity: Epic to Legendary." },
        { icon:'🏷️', title:'Titles', desc:"Add a short status text displayed next to your username in leaderboards, player badges and room chips. Examples: Tactician, Quiz Master, Snake King, Living Legend. Rarity: Common to Epic. Shop titles stack with <strong>honorary titles</strong> (see below)." },
        { icon:'🥇', title:'Honorary Titles', desc:"If you reach <strong>1st place</strong> on the global leaderboard, you automatically receive the honorary title <em>#1 Global</em>. A congratulatory message appears on your next visit · click <em>Accept</em> to confirm. The title is removed if you lose the top spot. It is visible in the shop but cannot be purchased." },
        { icon:'🖱️', title:'Cursor Skins', desc:"Replace the appearance of the snake following your cursor (color, pattern, trail, head shape). The skin overrides the rank color when equipped. Only visible if <strong>Snake</strong> is enabled in settings. Rarity: Rare to Legendary." },
        { icon:'🎭', title:'Avatars', desc:"Replace the icon shown in your player badge during games and in leaderboards. Examples: Gamepad 🎮, Pixel Cat 🐱, Rocket 🚀, Crown 👑. Rarity: Common to Epic." },
        { icon:'🔴', title:'Connect 4 Tokens', desc:"Restyle your tokens in the 7×6 grid (pattern, texture, glow). The <strong>red / yellow</strong> distinction between teams is always preserved. Your opponent will see your tokens. Rarity: Rare to Epic." },
        { icon:'✖️', title:'Tic-Tac-Toe Symbols', desc:"Replace X / O with a custom pair of symbols on the 3×3 grid. Both symbols remain clearly distinguishable. Your opponent sees your pair. Examples: Sun / Moon ☀️🌙, Heart / Star ❤️⭐. Rarity: Common to Epic." },
        { icon:'♟️', title:'Chess Themes', desc:"Restyle the chessboard and pieces. Light/dark square contrast and piece legibility are always guaranteed. Your opponent sees your theme. Examples: Cyber Grid, Royal Marble. Rarity: Epic to Legendary." },
        { icon:'🐍', title:'Snake Skins (Events)', desc:"Change the appearance of the snake, the ⚡ and the board during the Snake Challenge. Solo mode only · no fairness concerns. Examples: Rainbow Snake, Lava Snake, Galaxy Board. Rarity: Rare to Legendary." },
        { icon:'💥', title:'Click Particles', desc:"Replace the particles shown when you click buttons and cards on the site. Examples: Bubbles 🫧, Confetti 🎊, Firework 🎆. Rarity: Common to Epic." },
        { icon:'🌈', title:'Emoji Packs', desc:"Replace the emoji set in the animated emoji rain on the first page load. Examples: Party Pack 🎉, Gaming Pack 🎮, Cosmos Pack 🌌. Rarity: Common to Rare." },
        { icon:'🏆', title:'Victory Banners', desc:"Customize the style and animation of the end-of-game banner (win screen). Shown at the result screen of classic games and quizzes. Examples: Neon Triumph, Champion Flames, Coronation. Rarity: Epic to Legendary." },
        { icon:'🔊', title:'Sound Packs', desc:"Replace some site sounds (purchase, win, click, Libs counter change) with a themed audio set. Packs respect your sound preference (⚙️ → Sound). Examples: Retro Arcade, Crystal, Epic. Rarity: Rare to Epic." },
        { icon:'😎', title:'Emotes', desc:"<strong>20 quick reactions</strong> to send in the chat of classic multiplayer games, including <strong>3 free for everyone</strong> (👋 Hello, 👍 GG, 😢 Sniff). Manage them from the <strong>Profile tab → Emotes card</strong>: you can <strong>equip up to 5</strong>, shown in the in-game reaction bar. The rest are <strong>bought directly in this Emotes card</strong> (10 to 100 ⚡): emotes are not sold in the object shop." },
        { icon:'🎓', title:'Tutorial', desc:"On your first visit, a guide appears automatically to walk you through each feature screen by screen. Once a step has been seen, it won't show again. To restart from the beginning, clear your browser cache (localStorage)." },
      ],
      quiz:[
        { icon:'🧠', title:'General Knowledge', desc:"Answer multiple-choice questions. Select <strong>one or more themes</strong> from 15 categories (History, Science, Movies, Music, plus <strong>Biology, English, Benin</strong> to revise). Questions are shuffled when multiple themes are chosen. Pick your <strong>difficulty</strong>: Easy, Medium, Hard or <strong>🔥 Extreme</strong> (sharp questions AND a 15-second timer per question instead of 30)." },
        { icon:'🌐', title:'Language', desc:"Change the language via the <strong>⚙️</strong> button (top right) → <strong>Language</strong>. In <strong>FR</strong> mode, questions are translated into French (technical terms may stay in English). In <strong>EN</strong> mode, questions are in their original English. The site auto-detects your language on first load." },
        { icon:'▶', title:'Solo mode', desc:"Select one or more themes and click <em>Solo</em>. You play at your own pace. Your score is automatically added to the leaderboard at the end." },
        { icon:'👥', title:'Multiplayer mode', desc:"Click <em>Create a room</em> (2 to 6 players). Share the 4-letter code. The host starts the game when everyone is ready. All players see the same questions at the same time." },
        { icon:'⏱', title:'Timer', desc:"You have <strong>30 seconds</strong> per question. The timer turns red under 5 seconds. If you don't answer in time, the question is lost. You can also <strong>⏭ skip</strong> a question that blocks you: no point, but no wasted time." },
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
      { id:30, name:'Biology',   icon:'🌱' }, { id:31, name:'English',   icon:'🇬🇧' },
      { id:32, name:'Benin',     icon:'🇧🇯' },
    ],
    tutoSteps:{
      landing_news:'📰 The <strong>News</strong> card is folded in the <strong>top-left corner</strong>. <strong>Click on it</strong> to open it: it shows the latest news, updates, announcements and player comments. Click again to close it.',
      landing_cats:'👋 Welcome to <strong>Libero\'s Multi</strong>! The home screen offers four sections: <strong>Classic Games</strong>, <strong>General Knowledge</strong>, <strong>Events</strong> (weekend mini-games) and <strong>Community</strong> (the <strong>Libero Run</strong> mini-game). The bottom bar also leads to <strong>Videos</strong>, <strong>Reading</strong> and your <strong>Profile</strong>.',
      landing_lb:'🌍 The <strong>Global Leaderboard</strong> brings together <em>all</em> players with at least one point. Score = classic wins ×10 + Quiz points + best Snake score ×10 + best Libero Run score ÷10. The higher you climb, the longer your snake 🐍 grows!',
      landing_btns:'⚙️ Permanent buttons are available:<br>▶ <strong>Settings</strong> (theme, language, snake, sounds, music, refund cards) live in the <strong>Profile</strong> tab, <strong>⚙️ Settings</strong> card.<br>▶ <strong>Bottom right</strong>: ❓ <strong>Help</strong> · ✉️ <strong>Comment</strong> · 🤖 <strong>Assistant</strong>',
      landing_libs:'⚡ <strong>Libs</strong>: the site\'s virtual currency. Every ranked player receives some every 5 hours (1st: +10 ⚡, 2nd: +5 ⚡, 3rd: +3 ⚡, 4th to 10th: +2 ⚡, then +1 ⚡). You also earn them through the <strong>daily challenges</strong> and your <strong>login streak</strong>. Spend them in the <strong>shop</strong>: cosmetics, quiz boosts, exclusive books!',
      events_snake:'🏆 On Saturdays the <strong>Tournament</strong> runs automatically (followed live in the <strong>News</strong> card: top 10, 2000 ⚡ and the "Weekly Champion" title for the best).<br>🐍 This weekend\'s event: <strong>Snake Challenge</strong>! Click <em>Play</em>, your snake enters the arena. Eat the <strong>⚡ Libs</strong> to grow: every ⚡ eaten is added to your balance (score 10 = 10 Libs earned). Walls wrap around · you reappear on the other side! Your best score <strong>persists</strong> between sessions.',
      luffy_runner:'🏃 <strong>Libero Run</strong>: help Libero run as far as possible! Jump (↑ / Space) over ground obstacles, duck (↓) under flying ones. Grab the ⭐ star to become invincible for a few seconds. Your best score feeds a dedicated leaderboard.',
      home_games:'🎮 Choose your game at the top: <strong>Connect 4</strong>, <strong>Tic Tac Toe</strong>, <strong>Chess</strong>, <strong>Checkers</strong> or <strong>Ludo</strong> 🎲 (none is pre-selected). The leaderboard is shared across all five games.',
      home_bot:'🤖 <strong>Solo mode</strong>: play against the bot at 3 difficulty levels: Easy, Medium or Hard. Your wins and losses count in the leaderboard!',
      home_multi:'👥 <strong>Multiplayer mode</strong>: enter your username (optional), then click <em>Create a game</em> to generate a code, or enter a friend\'s code to join them. At the end of a game, <em>Rematch</em> offers a rematch the other player accepts or declines.',
      home_lb:'🏆 <strong>Leaderboard</strong>: wins, losses and draws are recorded automatically after each game (Medium/Hard bot or multiplayer).',
      waiting_code:'📋 <strong>Share this 4-letter code</strong> with your opponent, or click <strong>🔗 Share link</strong>: they will join in one click. The game starts as soon as they arrive, and you can <strong>Cancel</strong> if nobody comes.',
      quiz_themes:'🧠 <strong>General Knowledge Quiz</strong>: select one or more themes (History, Movies, Science…), then play <strong>Solo</strong> or create a <strong>multiplayer room</strong> to share with your friends.',
      quiz_lb:'🏆 The <strong>Quiz leaderboard</strong> is separate from the Classic leaderboard. Points are awarded based on your response speed and number of correct answers. A <strong>lightning answer</strong> (within the first seconds) = <strong>double points ⚡</strong>.',
      read_catalogue:'📚 Welcome to the <strong>Reading</strong> section! Search a book by title or author, filter by category, and click a cover to open its sheet. The <strong>exclusive novels</strong> can be read right here: <strong>⭐ L\'Affaire endormie · Tome 1</strong> (chapter 1 free, then 1000 ⚡ and 2000 ⚡), <strong>Life of Georgia</strong> (2000 ⚡ for the whole book) and <strong>Life of Georgia · Volume 2</strong>, free for owners of Volume 1.',
      profile_hub:'🎯 Your <strong>Profile</strong> gathers your <strong>level</strong> ⭐ (every game gives XP, every level gives ⚡), your <strong>login streak</strong> 🔥, your <strong>daily challenges</strong>, your <strong>locker</strong>, your game <strong>history</strong>, your <strong>friends</strong> 👥 (friend requests, Libs gifts, challenges from the game areas), the <strong>wheel of fortune</strong> 🎡 (1 free spin a day), the <strong>IQ test</strong> 🧠 (after 10 quizzes), the <strong>VIP Pass</strong> 👑 (+20% Libs), the <strong>Invite a friend</strong> card 🤝 (+100 ⚡ each), your <strong>emotes</strong> 😎, the <strong>emoji rain</strong> 🌈, the <strong>Settings</strong> ⚙️ (with 🔔 notifications), your <strong>recovery code</strong> 🔐 and the account <strong>reset</strong>.',
      ideas_board:'💡 The <strong>Ideas</strong> section: suggest a site improvement and vote up (▲) or down (▼) on other players\' ideas. The best ideas rise to the top.',
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
  return d === 5 || d === 6 || d === 0; // Vendredi 00:00 → Lundi 00:00
}

function _getEventEndMs() {
  const now = new Date();
  const day = now.getDay(); // 5=Ven, 6=Sam, 0=Dim (seuls cas possibles)
  const end = new Date(now);
  end.setDate(now.getDate() + (((1 - day) + 7) % 7)); // prochain lundi 00:00
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
  const pmt = $('profile-modal-title'); if (pmt) pmt.textContent = d.profileTitle;
  const cht = $('challenges-title');   if (cht) cht.textContent = d.challengesTitle;
  const pmtt = $('perm-title');        if (pmtt) pmtt.textContent = d.permTitle;
  const pms = $('perm-sub');           if (pms) pms.textContent = d.permSub;
  // Cartes du profil (sans l'emoji, déjà présent en icône à gauche) + pages
  const _plain = s => (s || '').replace(/^[^\s]+\s+/, '');
  const hit = $('history-title');      if (hit) hit.textContent = _plain(d.historyTitle);
  const lkt = $('locker-title');       if (lkt) lkt.textContent = _plain(d.lockerTitle);
  const lkpt = $('locker-page-title'); if (lkpt) lkpt.textContent = d.lockerTitle;
  const hpt = $('history-page-title'); if (hpt) hpt.textContent = d.historyTitle;
  const lcs = $('locker-card-sub');    if (lcs) lcs.textContent = d.lockerCardSub;
  const hcs = $('history-card-sub');   if (hcs) hcs.textContent = d.historyCardSub;
  const bbl = $('btn-back-locker');    if (bbl) bbl.textContent = `← ${d.backLabel}`;
  const bbh = $('btn-back-history');   if (bbh) bbh.textContent = `← ${d.backLabel}`;
  // Récupération de progression
  const rct = $('recovery-card-title'); if (rct) rct.textContent = d.recovery.cardTitle;
  const rcs = $('recovery-card-sub');   if (rcs) rcs.textContent = d.recovery.cardSub;
  const rvt = $('recovery-title');      if (rvt) rvt.textContent = d.recovery.title;
  const rvi = $('recovery-intro');      if (rvi) rvi.textContent = d.recovery.intro;
  const rcl = $('recovery-code-label'); if (rcl) rcl.textContent = d.recovery.codeLabel;
  const rcp = $('btn-recovery-copy');   if (rcp) rcp.textContent = d.recovery.copy;
  const rvw = $('recovery-warn');       if (rvw) rvw.textContent = d.recovery.warn;
  const rrl = $('recovery-restore-label'); if (rrl) rrl.textContent = d.recovery.restoreLabel;
  const rrb = $('btn-recovery-restore');   if (rrb) rrb.textContent = d.recovery.restore;
  const rrh = $('recovery-restore-hint');  if (rrh && !rrh.classList.contains('recovery-err')) rrh.textContent = d.recovery.restoreHint;
  // Tournoi + mise + parrainage
  const tnt = $('tournament-title'); if (tnt) tnt.textContent = d.tournamentTitle;
  const tnd = $('tournament-desc');  if (tnd) tnd.textContent = d.tournamentDesc;
  if (typeof renderTournament === 'function') renderTournament();
  const stl = $('stake-label'); if (stl) stl.textContent = d.stakeLabel;
  const st0 = document.querySelector('.stake-btn[data-stake="0"]'); if (st0) st0.textContent = d.stakeNone;
  const rfct = $('referral-card-title'); if (rfct) rfct.textContent = d.referralCardTitle;
  const rfcs = $('referral-card-sub');   if (rfcs) rfcs.textContent = d.referralCardSub;
  const rft = $('referral-title');       if (rft) rft.textContent = d.referralTitle;
  const rfi = $('referral-intro');       if (rfi) rfi.textContent = d.referralIntro;
  const rfl = $('referral-link-label');  if (rfl) rfl.textContent = d.referralLinkLabel;
  const rfc = $('btn-referral-copy');    if (rfc) rfc.textContent = d.recovery.copy;
  const rfs = $('btn-referral-share');   if (rfs) rfs.textContent = d.referralShareBtn;
  if (window._lastAnnouncements) _renderAnnouncements(window._lastAnnouncements);
  // Pseudo pour lien d'invitation
  const jnt = $('joinname-title'); if (jnt) jnt.textContent = d.joinName.title;
  const jni = $('joinname-intro'); if (jni) jni.textContent = d.joinName.intro;
  const jnp = $('joinname-input'); if (jnp) jnp.placeholder = d.joinName.placeholder;
  const jng = $('btn-joinname-go'); if (jng) jng.textContent = d.joinName.go;
  // Émotes (carte du profil)
  const emct = $('emotes-card-title'); if (emct) emct.textContent = d.emotesCardTitle;
  const emcs = $('emotes-card-sub');   if (emcs) emcs.textContent = d.emotesCardSub;
  // Réglages (carte du profil)
  const stgt = $('settings-card-title'); if (stgt) stgt.textContent = d.settingsCardTitle;
  const stgs = $('settings-card-sub');   if (stgs) stgs.textContent = d.settingsCardSub;
  // Pluie d'émojis
  const ert = $('emojirain-card-title'); if (ert) ert.textContent = d.emojirain.cardTitle;
  const ers = $('emojirain-card-sub');   if (ers) ers.textContent = d.emojirain.cardSub;
  const erm = $('emojirain-title');      if (erm) erm.textContent = d.emojirain.title;
  const eri = $('emojirain-intro');      if (eri) eri.textContent = d.emojirain.intro;
  const erl = $('emojirain-custom-label'); if (erl) erl.textContent = d.emojirain.customLabel;
  const erb = $('btn-emojirain-test');   if (erb) erb.textContent = d.emojirain.test;
  if (window._emojiRainRetexte) window._emojiRainRetexte();
  // Réinitialiser le compte
  const rsct = $('reset-card-title'); if (rsct) rsct.textContent = d.resetCardTitle;
  const rscs = $('reset-card-sub');   if (rscs) rscs.textContent = d.resetCardSub;
  const rst = $('reset-title');       if (rst) rst.textContent = d.resetTitle;
  const rsi = $('reset-intro');       if (rsi) rsi.textContent = d.resetIntro;
  const rsh = $('reset-save-hint');   if (rsh) rsh.textContent = d.resetSaveHint;
  const rscl = $('reset-code-label'); if (rscl) rscl.textContent = d.resetCodeLabel;
  const rsco = $('btn-reset-copy');   if (rsco) rsco.textContent = d.recovery.copy;
  const rscf = $('reset-confirm-label'); if (rscf) rscf.textContent = d.resetConfirmLabel;
  const rscb = $('btn-reset-confirm');   if (rscb) rscb.textContent = d.resetConfirmBtn;
  // Onboarding
  const obt = $('onboard-title');  if (obt) obt.textContent = d.onboarding.title;
  const obtl = $('onboard-theme-label'); if (obtl) obtl.textContent = d.onboarding.themeLabel;
  const obtd = $('onboard-theme-day');   if (obtd) obtd.textContent = d.onboarding.themeDay;
  const obtn = $('onboard-theme-night'); if (obtn) obtn.textContent = d.onboarding.themeNight;
  const obi = $('onboard-intro');  if (obi) obi.textContent = d.onboarding.intro;
  const obl = $('onboard-label');  if (obl) obl.textContent = d.onboarding.label;
  const obr = $('btn-onboard-restore'); if (obr) obr.textContent = d.onboarding.restore;
  const obn = $('btn-onboard-new');     if (obn) obn.textContent = d.onboarding.newBtn;
  // Cadeau
  const gt = $('gift-title');       if (gt) gt.textContent = d.giftTitle;
  const gi = $('gift-intro');       if (gi) gi.textContent = d.giftIntro;
  const gll = $('gift-link-label'); if (gll) gll.textContent = d.giftLinkLabel;
  const glc = $('btn-gift-link-copy'); if (glc) glc.textContent = d.recovery.copy;
  const gcl = $('gift-code-label'); if (gcl) gcl.textContent = d.giftCodeLabel;
  const gco = $('btn-gift-copy');   if (gco) gco.textContent = d.recovery.copy;
  const gsb = $('btn-gift-share');  if (gsb) gsb.textContent = d.giftShareBtn;
  const gw = $('gift-warn');        if (gw) gw.textContent = d.giftWarn;
  // Niveau, roue, amis, QI, VIP
  const wct = $('wheel-card-title'); if (wct) wct.textContent = d.wheelCardTitle;
  const wcs = $('wheel-card-sub');   if (wcs) wcs.textContent = d.wheelCardSub;
  const wtt = $('wheel-title');      if (wtt) wtt.textContent = d.wheelTitle;
  const wit = $('wheel-intro');      if (wit) wit.textContent = d.wheelIntro;
  const wsb = $('btn-wheel-spin');   if (wsb) wsb.textContent = d.wheelSpinBtn;
  const fct = $('friends-card-title'); if (fct) fct.textContent = d.friendsCardTitle;
  const fcs = $('friends-card-sub');   if (fcs) fcs.textContent = d.friendsCardSub;
  const ftt = $('friends-title');      if (ftt) ftt.textContent = d.friendsTitle;
  const fit = $('friends-intro');      if (fit) fit.textContent = d.friendsIntro;
  const fab = $('btn-friend-add');     if (fab) fab.textContent = d.friendsAddBtn;
  const fci = $('friend-code-input');  if (fci) fci.placeholder = d.friendsAddPlaceholder;
  const qct = $('iq-card-title');      if (qct) qct.textContent = d.iqCardTitle;
  const qtt = $('iq-title');           if (qtt) qtt.textContent = d.iqTitle;
  const qsb = $('btn-iq-start');       if (qsb) qsb.textContent = d.iqStartBtn;
  const qshb = $('btn-iq-share');      if (qshb) qshb.textContent = d.iqShareBtn;
  const vct = $('vip-card-title');     if (vct) vct.textContent = d.vipCardTitle;
  const vcs = $('vip-card-sub');       if (vcs) vcs.textContent = d.vipCardSub;
  const vtt = $('vip-title');          if (vtt) vtt.textContent = d.vipTitle;
  const cfb = $('btn-challenge-friend');      if (cfb) cfb.textContent = d.challengeFriendBtn;
  const cfq = $('btn-challenge-friend-quiz'); if (cfq) cfq.textContent = d.challengeFriendBtn;
  const grt = $('giftrecv-title');            if (grt) grt.textContent = d.giftRecvTitle;
  const fpt = $('friendpick-title');          if (fpt) fpt.textContent = d.friendPickTitle;
  if (window._refreshPushBtn) window._refreshPushBtn();
  if (window._renderLevel)  window._renderLevel();
  if (window._renderIqCard) window._renderIqCard();
  if (window._renderVip)    window._renderVip();
  if (window._profileHub) window._profileHub.retexte();
  if (window._chatbot) window._chatbot.retexte();
  const bl = $('btn-lang');
  if (bl) bl.textContent = currentLang === 'fr' ? '🇫🇷 FR ⇄' : '🇬🇧 EN ⇄';
  const btm = $('btn-theme-toggle'); if (btm) btm.title = d.themeToggle;
  const ll = $('landing-logo'); if (ll) ll.src = currentLang === 'en' ? 'assets/logo-full-en.svg' : 'assets/logo-full.svg';

  // Barre de navigation principale
  const nth = $('nav-tab-home-label'); if (nth) nth.textContent = d.navHome;
  const ntf = $('nav-tab-ideas-label'); if (ntf) ntf.textContent = d.navIdeas;
  const ntr = $('nav-tab-read-label'); if (ntr) ntr.textContent = d.navRead;
  const ntp = $('nav-tab-profile-label'); if (ntp) ntp.textContent = d.navProfile;

  // Vidéos : modales commentaires + proposition
  const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const setPh  = (id, v) => { const el = $(id); if (el) el.placeholder = v; };
  setTxt('videocomments-title', d.feedCommentsTitle);
  setPh('videocomments-input', d.feedCommentPlaceholder);
  setTxt('videocomments-send', d.feedCommentSend);
  setTxt('videosubmit-title', d.feedSubmitTitle);
  setTxt('videosubmit-intro', d.feedSubmitIntro);
  setPh('videosubmit-url', d.feedSubmitUrl);
  setPh('videosubmit-titre', d.feedSubmitTitrePh);
  setPh('videosubmit-desc', d.feedSubmitDescPh);
  setTxt('videosubmit-send', d.feedSubmitSend);

  // Idées & suggestions
  setTxt('ideas-title', d.ideasTitle);
  setTxt('ideas-sub', d.ideasSub);
  setTxt('ideas-sort-top', d.ideasSortTop);
  setTxt('ideas-sort-new', d.ideasSortNew);
  setTxt('ideas-new-btn', d.ideasNewBtn);
  setTxt('ideanew-title', d.ideaNewTitle);
  setTxt('ideanew-intro', d.ideaNewIntro);
  setPh('ideanew-titre', d.ideaNewTitrePh);
  setPh('ideanew-desc', d.ideaNewDescPh);
  setTxt('ideanew-send', d.ideaNewSend);
  if (window._ideasBoard) window._ideasBoard.retexte();

  // Lecture
  const rt = $('read-title');        if (rt) rt.textContent  = d.navRead;
  const rs = $('read-search-input'); if (rs) rs.placeholder  = d.readSearch;
  if (window._readFeed) window._readFeed.retexte();
  if (window._videoFeed) window._videoFeed.retexte();

  // Section Recharger + formulaire d'achat de Libs (boutique)
  const ltb = $('libs-topup-back');    if (ltb) ltb.textContent = `← ${d.backLabel}`;
  const ltt = $('btn-libs-topup');     if (ltt) ltt.textContent = currentLang === 'fr' ? '💳 Recharger' : '💳 Top up';
  const lbb = $('libs-buy-back');      if (lbb) lbb.textContent = `← ${d.backLabel}`;
  const lbe = $('libs-buy-email');     if (lbe) lbe.placeholder = d.shopLibsBuyEmailPh;
  const lbf = $('libs-buy-firstname'); if (lbf) lbf.placeholder = d.shopLibsBuyFirstPh;
  const lbl = $('libs-buy-lastname');  if (lbl) lbl.placeholder = d.shopLibsBuyLastPh;
  const lbp = $('libs-buy-phone');     if (lbp) lbp.placeholder = d.shopLibsBuyPhonePh;

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
  const gnck = $('gn-checkers');  if (gnck) gnck.textContent = d.games.checkers;
  const gnld = $('gn-ludo');      if (gnld) gnld.textContent = d.games.ludo;
  const bcw = $('btn-cancel-wait');   if (bcw) bcw.textContent = d.btnCancel;
  const bra = $('btn-restart-accept'); if (bra) bra.textContent = d.btnAccept;
  const brf = $('btn-restart-refuse'); if (brf) brf.textContent = d.btnRefuse;
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
  const bsh = $('btn-share');     if (bsh) bsh.textContent = d.btnShare;
  const bba = $('btn-back-classic'); if (bba) bba.textContent = `← ${d.backLabel}`;
  const bbev = $('btn-back-events'); if (bbev) bbev.textContent = `← ${d.backLabel}`;
  const bblf = $('btn-back-luffy');  if (bblf) bblf.textContent = `← ${d.backLabel}`;

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
    const icons = { easy:'😊', medium:'🎯', hard:'💀', extreme:'🔥' };
    b.textContent = `${icons[b.dataset.diff]} ${d.diffLabels[b.dataset.diff]}`;
  });
  const tdh = $('trivia-diff-hint'); if (tdh) tdh.textContent = d.diffHints[selectedTriviaDifficulty] || d.diffHints[''];
  const tnbl = $('trivia-nb-label');      if (tnbl) tnbl.textContent = d.triviaNbLabel;
  const bso  = $('btn-solo-trivia');      if (bso)  bso.textContent  = d.btnSolo;
  const bct2 = $('btn-create-trivia');    if (bct2) bct2.textContent = d.btnCreateTrivia;
  const itc  = $('input-trivia-code');    if (itc)  itc.placeholder  = d.triviaCodePh;
  const bjt2 = $('btn-join-trivia');      if (bjt2) bjt2.textContent = d.btnJoinTrivia;
  const lbtt = $('lb-title-trivia');      if (lbtt) lbtt.textContent = d.triviaLbTitle;
  const btc  = $('btn-trivia-copy');      if (btc)  btc.textContent  = d.btnTriviaCopy;
  const bts  = $('btn-trivia-share');     if (bts)  bts.textContent  = d.btnTriviaShare;
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

  // Libero Run screen
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

// État échecs / dames (selectedSquare + availableMoves partagés)
let selectedSquare  = null;
let availableMoves  = [];
let ckState         = null; // dernier état des dames reçu
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
  const TOP = { landing: 0, ideas: 1, read: 2, profile: 3 };
  // Capture l'onglet de premier niveau actuellement actif AVANT de le retirer,
  // pour connaitre la direction du glissement (robuste des le 1er clic).
  let prevTop = null;
  document.querySelectorAll('.screen.active').forEach(s => {
    const n = s.id.replace('screen-', '');
    if (n in TOP) prevTop = n;
  });
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    if (s !== el) s.removeAttribute('data-restored');
  });
  if (el) {
    if (!wasRestoring) el.removeAttribute('data-restored');
    el.classList.add('active');
    // Transition directionnelle entre onglets de premier niveau (facon app native) :
    // avancer dans l'ordre = entree par la droite, reculer = par la gauche.
    if (!wasRestoring && name in TOP) {
      el.classList.remove('nav-slide-left', 'nav-slide-right');
      if (prevTop != null && prevTop !== name) {
        const dir = TOP[name] > TOP[prevTop] ? 'nav-slide-right' : 'nav-slide-left';
        void el.offsetWidth;        // redemarre l'animation
        el.classList.add(dir);
      }
    }
  }
  document.body.classList.toggle('screen-events-active', name === 'events');
  document.body.classList.toggle('screen-luffy-active', name === 'luffy');
  document.body.classList.toggle('screen-feed-active', name === 'feed');
  document.body.classList.toggle('screen-ideas-active', name === 'ideas');
  document.body.classList.toggle('screen-read-active', name === 'read');
  document.body.classList.toggle('screen-profile-active', name === 'profile');
  document.body.classList.toggle('screen-locker-active', name === 'locker');
  document.body.classList.toggle('screen-history-active', name === 'history');

  // Barre de navigation principale : visible sur les écrans de premier niveau,
  // onglet actif synchronisé avec l'écran courant.
  const nav = document.getElementById('main-nav');
  if (nav) {
    const onTopLevel = (name === 'landing' || name === 'ideas' || name === 'read' || name === 'profile');
    nav.classList.toggle('hidden', !onTopLevel);
    // Sur mobile la barre de nav est en bas : on marque ces écrans pour remonter
    // les boutons flottants (aide / commentaire) au-dessus d'elle.
    document.body.classList.toggle('nav-bottom-visible', onTopLevel);
    const homeTab = document.getElementById('nav-tab-home');
    const feedTab = document.getElementById('nav-tab-ideas');
    const readTab = document.getElementById('nav-tab-read');
    const profTab = document.getElementById('nav-tab-profile');
    if (homeTab) { homeTab.classList.toggle('active', name === 'landing'); homeTab.setAttribute('aria-selected', String(name === 'landing')); }
    if (feedTab) { feedTab.classList.toggle('active', name === 'ideas');   feedTab.setAttribute('aria-selected', String(name === 'ideas')); }
    if (readTab) { readTab.classList.toggle('active', name === 'read');    readTab.setAttribute('aria-selected', String(name === 'read')); }
    if (profTab) { profTab.classList.toggle('active', name === 'profile'); profTab.setAttribute('aria-selected', String(name === 'profile')); }
  }
  if (window._profileHub) {
    if (name === 'profile')      window._profileHub.enter();
    else if (name === 'locker')  window._profileHub.enterLocker();
    else if (name === 'history') window._profileHub.enterHistory();
  }
  if (name === 'events') { socket.emit('get-tournament'); if (typeof renderTournament === 'function') renderTournament(); }
  // Lecture / pause du feed vidéo selon qu'on entre ou quitte l'onglet Vidéos.
  if (window._videoFeed) {
    if (name === 'feed') window._videoFeed.load();
    else                 window._videoFeed.pauseAll();
  }
  if (window._ideasBoard && name === 'ideas') window._ideasBoard.load();
  if (window._readFeed && name === 'read') window._readFeed.load();

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
  checkers:  { R: '🔴', Y: '🟡' },
  ludo:      { R: '🔴', Y: '🟡' },
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
    if (!selectedGameType) { showError(t().errNoGame); return; }
    if (!getPlayerName()) { showError(t().errNoName); return; }
    if (_nameTaken) { showError(t().errNameTaken); return; }
    clearError();
    socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), vsBot: true, botDifficulty: btn.dataset.diff, playerId: getPlayerId() });
  });
});

$('btn-create').addEventListener('click', () => {
  if (!selectedGameType) { showError(t().errNoGame); return; }
  if (!getPlayerName()) { showError(t().errNoName); return; }
  if (_nameTaken) { showError(t().errNameTaken); return; }
  clearError();
  socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), playerId: getPlayerId(), stake: window._selectedStake || 0 });
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

// ── Lien de partage d'une partie ──────────────────────────────────────────────
// Le lien encode le code de la partie ; à l'ouverture, le site rejoint tout seul
// (peu importe la section, le serveur résout le bon type de salle).
function buildShareUrl(code) {
  return `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;
}
async function shareRoomLink(code, btn, restoreLabel) {
  if (!code) return;
  const url = buildShareUrl(code);
  if (navigator.share) {
    try { await navigator.share({ title: t().shareTitle, text: t().shareText(code), url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; } // annulé par l'utilisateur
  }
  try {
    await navigator.clipboard.writeText(url);
    if (btn) { btn.textContent = t().linkCopied; setTimeout(() => { btn.textContent = restoreLabel || t().btnShare; }, 2000); }
    else showCursorSnakeToast(t().linkCopied);
  } catch (e) {
    showCursorSnakeToast(url);
  }
}
$('btn-share').addEventListener('click', () => shareRoomLink(currentRoomCode, $('btn-share'), t().btnShare));

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

// Burst de confettis reutilisable : DOM leger, auto-nettoye, plafonne, et
// desactive si le joueur a demande « reduire les animations ».
function celebrate(opts = {}) {
  try { window._sound?.play('success'); } catch {} // son de reussite (victoire, champion, level up)
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch {}
  const count = Math.min(opts.count || 90, 120);
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);
  const colors = ['#6366f1', '#a855f7', '#22d3ee', '#fbbf24', '#f87171', '#34d399', '#f472b6'];
  const originX = opts.x != null ? opts.x : window.innerWidth / 2;
  const originY = opts.y != null ? opts.y : window.innerHeight * 0.22;
  let maxDur = 0;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('i');
    b.className = 'confetti-bit';
    const dx  = (Math.random() * 2 - 1) * window.innerWidth * 0.55;
    const dy  = window.innerHeight * (0.55 + Math.random() * 0.45);
    const dur = 1.1 + Math.random() * 0.9;
    const size = 7 + Math.random() * 7;
    maxDur = Math.max(maxDur, dur);
    b.style.left = originX + 'px';
    b.style.top = originY + 'px';
    b.style.width = size + 'px';
    b.style.height = (size * 1.4) + 'px';
    b.style.background = colors[i % colors.length];
    if (Math.random() < 0.35) b.style.borderRadius = '50%';
    b.style.setProperty('--dx', dx + 'px');
    b.style.setProperty('--dy', dy + 'px');
    b.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    b.style.setProperty('--dur', dur + 's');
    layer.appendChild(b);
  }
  setTimeout(() => layer.remove(), maxDur * 1000 + 250);
}
window._celebrate = celebrate;

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
      celebrate(); // joue le son 'success' (fichier)
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
  $('restart-vote-prompt').classList.add('hidden');
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
  $('restart-vote-prompt').classList.add('hidden');
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
    case 'checkers':  buildCheckers(area, state, yourPlayer); break;
    case 'ludo':      buildLudo(area, state); break;
  }
}

function updateGameBoard(gameType, state) {
  switch (gameType) {
    case 'connect4':  updateConnect4(state.board);                          break;
    case 'tictactoe': updateTTT(state.board, state.winLine);                break;
    case 'chess':     updateChess(state.fen, state.isCheck, state.currentPlayer); break;
    case 'checkers':  updateCheckers(state);                                break;
    case 'ludo':      updateLudo(state);                                    break;
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

// ══════════════════════════════════════════════════════════════════════════════
// DAMES (checkers 8x8)
// ══════════════════════════════════════════════════════════════════════════════
function buildCheckers(container, state, yourPlayer) {
  const flipped = yourPlayer === 'Y';
  const boardEl = document.createElement('div');
  boardEl.id = 'ck-board';
  boardEl.className = 'ck-board';
  for (let gr = 0; gr < 8; gr++) {
    for (let gc = 0; gc < 8; gc++) {
      const br = flipped ? 7 - gr : gr;
      const bc = flipped ? 7 - gc : gc;
      const i  = br * 8 + bc;
      const dark = (gr + gc) % 2 === 1;
      const sq = document.createElement('div');
      sq.className = `ck-sq ${dark ? 'dark' : 'light'}`;
      sq.dataset.idx = i;
      if (dark) sq.addEventListener('click', () => onCheckersClick(i));
      boardEl.appendChild(sq);
    }
  }
  container.appendChild(boardEl);
  updateCheckers(state);
}

function updateCheckers(state) {
  ckState = state;
  document.querySelectorAll('.ck-sq').forEach(sq => {
    const i = parseInt(sq.dataset.idx, 10);
    sq.classList.remove('selected', 'can-move', 'last-move', 'must');
    sq.innerHTML = '';
    const p = state.board[i];
    if (p) {
      const piece = document.createElement('span');
      const red  = (p === 'r' || p === 'R');
      const king = (p === 'R' || p === 'Y');
      piece.className = `ck-piece ${red ? 'ck-red' : 'ck-yellow'}${king ? ' ck-king' : ''}`;
      if (king) piece.textContent = '♛';
      sq.appendChild(piece);
    }
    if (state.lastMove && (i === state.lastMove.from || i === state.lastMove.to)) sq.classList.add('last-move');
  });
  if (state.mustFrom !== null && state.mustFrom !== undefined) {
    document.querySelector(`.ck-sq[data-idx="${state.mustFrom}"]`)?.classList.add('must');
  }
  if (selectedSquare !== null && currentGame === 'checkers') {
    document.querySelector(`.ck-sq[data-idx="${selectedSquare}"]`)?.classList.add('selected');
    availableMoves.forEach(mv => document.querySelector(`.ck-sq[data-idx="${mv}"]`)?.classList.add('can-move'));
  }
}

function clearCheckersSelection() {
  selectedSquare = null;
  availableMoves = [];
  document.querySelectorAll('.ck-sq.selected, .ck-sq.can-move').forEach(el => el.classList.remove('selected', 'can-move'));
}

function onCheckersClick(i) {
  if (!gameActive || currentTurnPlayer !== myPlayer || !ckState) return;

  // Clic sur une destination proposée → jouer le coup
  if (selectedSquare !== null && availableMoves.includes(i)) {
    const from = selectedSquare;
    clearCheckersSelection();
    SFX.placePiece();
    socket.emit('make-move', { from, to: i });
    return;
  }

  // Sélection d'une de mes pièces
  clearCheckersSelection();
  const p = ckState.board[i];
  if (!p) return;
  const mine = myPlayer === 'R' ? (p === 'r' || p === 'R') : (p === 'y' || p === 'Y');
  if (!mine) return;
  // Pendant une rafle, seule la pièce obligée peut jouer
  if (ckState.mustFrom !== null && ckState.mustFrom !== undefined && ckState.mustFrom !== i) return;
  selectedSquare = i;
  document.querySelector(`.ck-sq[data-idx="${i}"]`)?.classList.add('selected');
  socket.emit('get-moves', { square: i });
}

// ══════════════════════════════════════════════════════════════════════════════
// LUDO (1 contre 1 : rouge en bas a gauche, jaune en haut a droite)
// ══════════════════════════════════════════════════════════════════════════════
// Piste absolue de 52 cases : memes conventions que le serveur (R entre en 0,
// Y en 26, cases etoilees sans capture). Coordonnees (ligne, colonne) sur 15x15.
const LUDO_TRACK = (() => {
  const t = [];
  for (let r = 13; r >= 9; r--) t.push([r, 6]);   // 0-4
  for (let c = 5; c >= 0; c--)  t.push([8, c]);   // 5-10
  t.push([7, 0]);                                  // 11
  for (let c = 0; c <= 5; c++)  t.push([6, c]);   // 12-17
  for (let r = 5; r >= 0; r--)  t.push([r, 6]);   // 18-23
  t.push([0, 7]);                                  // 24
  for (let r = 0; r <= 5; r++)  t.push([r, 8]);   // 25-30
  for (let c = 9; c <= 14; c++) t.push([6, c]);   // 31-36
  t.push([7, 14]);                                 // 37
  for (let c = 14; c >= 9; c--) t.push([8, c]);   // 38-43
  for (let r = 9; r <= 14; r++) t.push([r, 8]);   // 44-49
  t.push([14, 7]);                                 // 50
  t.push([14, 6]);                                 // 51
  return t;
})();
const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LUDO_START = { R: 0, Y: 26 };
// Colonnes d'arrivee (rel 52-56) : R monte la colonne 7, Y la descend.
const LUDO_HOME = {
  R: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  Y: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
};
// Emplacements des 4 pions en base.
const LUDO_BASE = {
  R: [[10, 1], [10, 3], [12, 1], [12, 3]],
  Y: [[2, 11], [2, 13], [4, 11], [4, 13]],
};
let ludoState = null;

function ludoAbs(player, rel) {
  return (rel >= 0 && rel < 52) ? (LUDO_START[player] + rel) % 52 : null;
}
function ludoPlayable(state, player) {
  if (!state.dice) return [];
  const out = [];
  state.pawns[player].forEach((pos, i) => {
    if (pos === 57) return;
    if (pos === -1) { if (state.dice === 6) out.push(i); return; }
    if (pos + state.dice <= 57) out.push(i);
  });
  return out;
}
function ludoCellCoord(player, pos, pawnIdx) {
  if (pos === -1) return LUDO_BASE[player][pawnIdx];
  if (pos >= 57) return [7, 7];
  if (pos >= 52) return LUDO_HOME[player][pos - 52];
  return LUDO_TRACK[ludoAbs(player, pos)];
}

function buildLudo(container, state) {
  const wrap = document.createElement('div');
  wrap.className = 'ludo-wrap';
  const boardEl = document.createElement('div');
  boardEl.id = 'ludo-board';
  boardEl.className = 'ludo-board';
  // Zones de base et centre
  const zones = [
    { cls: 'ludo-basezone ludo-r', r: 10, c: 1, rs: 5, cs: 5 },
    { cls: 'ludo-basezone ludo-y', r: 1, c: 10, rs: 5, cs: 5 },
    { cls: 'ludo-center', r: 7, c: 7, rs: 3, cs: 3 },
  ];
  zones.forEach(z => {
    const el = document.createElement('div');
    el.className = z.cls;
    el.style.gridArea = `${z.r} / ${z.c} / span ${z.rs} / span ${z.cs}`;
    if (z.cls === 'ludo-center') { el.id = 'ludo-center'; el.textContent = '🏁'; }
    boardEl.appendChild(el);
  });
  // Piste
  LUDO_TRACK.forEach(([r, c], abs) => {
    const cell = document.createElement('div');
    cell.className = 'ludo-cell';
    if (LUDO_SAFE.has(abs)) cell.classList.add('safe');
    if (abs === LUDO_START.R) cell.classList.add('start-r');
    if (abs === LUDO_START.Y) cell.classList.add('start-y');
    cell.dataset.abs = abs;
    cell.style.gridArea = `${r + 1} / ${c + 1}`;
    if (LUDO_SAFE.has(abs)) cell.textContent = '★';
    boardEl.appendChild(cell);
  });
  // Colonnes d'arrivee
  for (const pl of ['R', 'Y']) {
    LUDO_HOME[pl].forEach(([r, c], i) => {
      const cell = document.createElement('div');
      cell.className = `ludo-cell home ${pl === 'R' ? 'home-r' : 'home-y'}`;
      cell.dataset.home = `${pl}${i}`;
      cell.style.gridArea = `${r + 1} / ${c + 1}`;
      boardEl.appendChild(cell);
    });
  }
  // Emplacements de base
  for (const pl of ['R', 'Y']) {
    LUDO_BASE[pl].forEach(([r, c], i) => {
      const slot = document.createElement('div');
      slot.className = 'ludo-baseslot';
      slot.dataset.base = `${pl}${i}`;
      slot.style.gridArea = `${r + 1} / ${c + 1}`;
      boardEl.appendChild(slot);
    });
  }
  // Couche des pions (au-dessus des cases)
  const pawnLayer = document.createElement('div');
  pawnLayer.id = 'ludo-pawns';
  pawnLayer.className = 'ludo-pawns';
  boardEl.appendChild(pawnLayer);
  wrap.appendChild(boardEl);
  // Barre de de
  const bar = document.createElement('div');
  bar.className = 'ludo-bar';
  bar.innerHTML = `<button id="ludo-roll" class="btn btn-primary">${t().ludoRoll}</button><span id="ludo-dice" class="ludo-dice"></span>`;
  wrap.appendChild(bar);
  container.appendChild(wrap);
  document.getElementById('ludo-roll').addEventListener('click', () => {
    if (!gameActive || !ludoState || ludoState.currentPlayer !== myPlayer || ludoState.dice) return;
    SFX.placePiece();
    socket.emit('make-move', { roll: true });
  });
  updateLudo(state);
}

const LUDO_DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function updateLudo(state) {
  ludoState = state;
  const layer = document.getElementById('ludo-pawns');
  if (!layer) return;
  layer.innerHTML = '';
  // Note : updateLudo est appele AVANT updateTurnUI sur game-update, donc on
  // lit le tour dans l'etat (currentTurnPlayer serait en retard d'un coup).
  const myTurn = state.currentPlayer === myPlayer;
  const playable = (myTurn && state.dice) ? ludoPlayable(state, myPlayer) : [];
  for (const pl of ['R', 'Y']) {
    state.pawns[pl].forEach((pos, i) => {
      const [r, c] = ludoCellCoord(pl, pos, i);
      const pawn = document.createElement('button');
      pawn.className = `ludo-pawn ${pl === 'R' ? 'p-r' : 'p-y'}`;
      if (pl === myPlayer && playable.includes(i)) pawn.classList.add('can-play');
      if (state.lastMove && state.lastMove.player === pl && state.lastMove.pawn === i) pawn.classList.add('just-moved');
      pawn.style.setProperty('--lr', r);
      pawn.style.setProperty('--lc', c);
      // Decalage leger quand plusieurs pions partagent une case
      const stackIdx = state.pawns[pl].slice(0, i).filter(p => p === pos && pos !== -1).length;
      pawn.style.setProperty('--stack', stackIdx);
      if (pl === myPlayer) pawn.addEventListener('click', () => onLudoPawnClick(i));
      layer.appendChild(pawn);
    });
  }
  const rollBtn = document.getElementById('ludo-roll');
  const diceEl  = document.getElementById('ludo-dice');
  if (rollBtn) {
    rollBtn.textContent = t().ludoRoll;
    rollBtn.disabled = !(myTurn && !state.dice);
    rollBtn.classList.toggle('pulse', myTurn && !state.dice);
  }
  if (diceEl) diceEl.textContent = state.lastDice ? `${LUDO_DICE_FACES[state.lastDice]} ${state.lastDice}` : '';
}

function onLudoPawnClick(i) {
  if (!gameActive || !ludoState || ludoState.currentPlayer !== myPlayer || !ludoState.dice) return;
  if (!ludoPlayable(ludoState, myPlayer).includes(i)) return;
  SFX.placePiece();
  socket.emit('make-move', { pawn: i });
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
// Accepter la revanche proposée par l'adversaire (mon vote déclenche la partie).
$('btn-restart-accept').addEventListener('click', () => {
  socket.emit('request-restart');
  $('restart-vote-prompt').classList.add('hidden');
  $('restart-pending').classList.remove('hidden');
});
// Refuser la revanche.
$('btn-restart-refuse').addEventListener('click', () => {
  socket.emit('decline-restart');
  $('restart-vote-prompt').classList.add('hidden');
  $('btn-restart').classList.remove('hidden');
  $('btn-restart').disabled = false;
  $('btn-menu').classList.remove('hidden');
});
// Annuler une partie multi en attente : on prévient le serveur et on rentre.
$('btn-cancel-wait').addEventListener('click', () => {
  socket.emit('cancel-room');
  currentRoomCode = null;
  clearSession();
  showScreen('home');
});

// ── Chat ──────────────────────────────────────────────────────────────────────
$('btn-clear-chat').addEventListener('click', () => { $('chat-messages').innerHTML = ''; });

const EMOTE_DEFS = {
  'emote-hello':      { emoji:'👋', label:'Salut' },
  'emote-gg':         { emoji:'👍', label:'GG' },
  'emote-sad':        { emoji:'😢', label:'Sniff' },
  'emote-wellplayed': { emoji:'🤝', label:'Bien joué' },
  'emote-laugh':      { emoji:'😂', label:'MDR' },
  'emote-think':      { emoji:'🤔', label:'Hmm' },
  'emote-cool':       { emoji:'🆒', label:'Cool' },
  'emote-clap':       { emoji:'👏', label:'Bravo' },
  'emote-fire':       { emoji:'🔥', label:'En feu' },
  'emote-heart':      { emoji:'❤️', label:'Cœur' },
  'emote-cry':        { emoji:'😭', label:'Larmes' },
  'emote-angry':      { emoji:'😤', label:'Grr' },
  'emote-shock':      { emoji:'🤯', label:'Explosé' },
  'emote-easy':       { emoji:'😎', label:'Trop facile' },
  'emote-eyes':       { emoji:'👀', label:'Vu' },
  'emote-skull':      { emoji:'💀', label:'Mort de rire' },
  'emote-party':      { emoji:'🥳', label:'La fête' },
  'emote-rocket':     { emoji:'🚀', label:'Fusée' },
  'emote-omg':        { emoji:'😱', label:'Incroyable' },
  'emote-crown':      { emoji:'👑', label:'Roi' },
};
// Prix des emotes (3 gratuites, les autres payantes). Elles ne se vendent que
// dans la section Emotes du profil, jamais dans la boutique d'objets.
const EMOTE_PRICES = {
  'emote-hello':0,'emote-gg':0,'emote-sad':0,'emote-wellplayed':10,'emote-laugh':15,'emote-think':15,'emote-cool':20,'emote-clap':25,'emote-fire':30,'emote-heart':30,'emote-cry':35,'emote-angry':40,'emote-shock':45,'emote-easy':50,'emote-eyes':55,'emote-skull':60,'emote-party':65,'emote-rocket':70,'emote-omg':80,'emote-crown':100,
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
    <div class="global-lb-row lb-row-clickable" data-pname="${_escHtml(entry.name)}" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
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
      // Fiche joueur : niveau + demande d'ami (remplace l'ancien renvoi boutique).
      window._openPlayerCard?.(row.dataset.pname);
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
    <div class="lb-row lb-row-clickable" data-pname="${_escHtml(entry.name)}" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
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
      // Fiche joueur : niveau + demande d'ami (remplace l'ancien renvoi boutique).
      window._openPlayerCard?.(row.dataset.pname);
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
    <div class="lb-row lb-row-clickable" data-pname="${_escHtml(e.name)}" data-cosmetic="${e.cosmetic||''}" data-avatar="${e.avatar||''}" data-cursor="${e.cursorSnake||''}" data-font="${e.font||''}" data-nameeffect="${e.nameEffect||''}">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(e.cosmetic)} ${_fontClass(e.font)} ${_nameEffectClass(e.nameEffect)}">${e.name}${_titleHtml(e.title, e.honorTitle)}</span>
      <span class="lb-score-snake">${e.hs} ⚡</span>
    </div>
  `).join('');
  el.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      // Fiche joueur : niveau + demande d'ami (remplace l'ancien renvoi boutique).
      window._openPlayerCard?.(row.dataset.pname);
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
    <div class="lb-row lb-row-clickable" data-pname="${_escHtml(e.name)}" data-cosmetic="${e.cosmetic||''}" data-avatar="${e.avatar||''}" data-cursor="${e.cursorSnake||''}" data-font="${e.font||''}" data-nameeffect="${e.nameEffect||''}">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name ${_cosmeticClass(e.cosmetic)} ${_fontClass(e.font)} ${_nameEffectClass(e.nameEffect)}">${e.name}${_titleHtml(e.title, e.honorTitle)}</span>
      <span class="lb-score-snake">${e.hs} 🏃</span>
    </div>
  `).join('');
  el.querySelectorAll('.lb-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      // Fiche joueur : niveau + demande d'ami (remplace l'ancien renvoi boutique).
      window._openPlayerCard?.(row.dataset.pname);
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
    const hint = document.getElementById('trivia-diff-hint');
    if (hint) hint.textContent = t().diffHints[selectedTriviaDifficulty] || t().diffHints[''];
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
  socket.emit('fetch-trivia-solo', { categories: selectedTriviaCategories, amount: getTriviaQCount(), lang: currentLang, difficulty: selectedTriviaDifficulty, playerId: getPlayerId() });
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
$('btn-trivia-share').addEventListener('click', () => shareRoomLink(triviaRoomCode, $('btn-trivia-share'), t().btnTriviaShare));
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
    // Compte a rebours sonore de la derniere ligne droite : « top top top top top » (rem 5->1)
    // puis un « tip » different a l'expiration. Muet si le joueur a deja repondu.
    if (!triviaAnsweredThis) {
      if (rem > 0 && rem <= 5) { try { window._sound?.play('tick'); } catch {} }
      else if (rem <= 0)      { try { window._sound?.play('tick-final'); } catch {} }
    }
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
  window._triviaQStartAt = Date.now();
  window._triviaQLimitMs = (timeLimit || 30) * 1000;
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
  const skip = $('tg-skip');
  if (skip) { skip.textContent = t().triviaSkip; skip.classList.remove('hidden'); skip.disabled = false; }
  startTriviaTimer(timeLimit, () => onTriviaTimeUp());
}

// Passer la question : aucun point, on file à la suite (solo) ou on signale
// au serveur qu'on a « répondu » pour ne pas retenir les autres (multi).
function onTriviaSkip() {
  if (triviaAnsweredThis) return;
  triviaAnsweredThis = true;
  _updateBoostHintBtn();
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = true);
  const skip = $('tg-skip');
  if (skip) skip.disabled = true;
  if (triviaIsSolo) {
    stopTriviaTimer();
    soloReveal(null);
  } else {
    socket.emit('trivia-answer', { choice: '__skip__' });
  }
}

function onTriviaChoice(choice, btn) {
  if (triviaAnsweredThis) return;
  triviaAnsweredThis = true; triviaChoiceSelected = choice;
  _updateBoostHintBtn();
  const _sk = $('tg-skip'); if (_sk) _sk.disabled = true;
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
  _updateBoostHintBtn();
  const _sk = $('tg-skip'); if (_sk) _sk.disabled = true;
  $('tg-choices').querySelectorAll('.tg-choice').forEach(b => b.disabled = true);
  if (triviaIsSolo) soloReveal(null);
}

function showTriviaReveal({ correct, correctSocketIds, gains, scores, myChoice, soloGain }) {
  stopTriviaTimer();
  const _skip = $('tg-skip'); if (_skip) _skip.classList.add('hidden');
  $('tg-choices').querySelectorAll('.tg-choice').forEach(btn => {
    const c = btn.dataset.choice;
    btn.classList.remove('wrong');
    if (c === correct) btn.classList.add('correct');
    else if (c === myChoice) { btn.classList.add('wrong'); btn.classList.add('tg-shake'); }
    else btn.classList.add('dimmed');
  });
  if (scores) renderTriviaScores(scores, gains);
  const gotIt = triviaIsSolo ? myChoice === correct
    : (correctSocketIds || []).includes(triviaMySocketId);
  const myGain = triviaIsSolo ? soloGain : (gains ? gains[triviaMySocketId] : null);
  let msg = gotIt ? t().triviaCorrect : `${t().triviaWrong}${correct}`;
  if (gotIt && myGain?.fast) msg += ` ${t().triviaFastBonus}`;
  const rev = $('tg-reveal');
  rev.textContent = msg;
  rev.className   = `tg-reveal ${gotIt ? 'ok' : 'ko'}`;
  rev.style.animation = 'none'; void rev.offsetWidth; rev.style.animation = '';
  if (gotIt) {
    SFX.quizOk();
    _triviaPointsPop(myGain?.pts || 1, myGain?.fast);
    _triviaBurst(myGain?.fast ? '⚡' : '🎉');
  } else {
    SFX.quizBad();
  }
}

// « +1 ⚡ » / « +2 ⚡ » qui s'envole au-dessus de la question.
function _triviaPointsPop(pts, fast) {
  const host = $('tg-question')?.parentElement || document.body;
  const el = document.createElement('div');
  el.className = 'tg-points-pop' + (fast ? ' fast' : '');
  el.textContent = `+${pts} ⚡`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// Petite explosion d'émojis autour de la bonne réponse.
function _triviaBurst(emoji) {
  const target = $('tg-choices')?.querySelector('.tg-choice.correct') || $('tg-reveal');
  if (!target) return;
  const r = target.getBoundingClientRect();
  for (let i = 0; i < 10; i++) {
    const sp = document.createElement('span');
    sp.className = 'tg-burst';
    sp.textContent = emoji;
    sp.style.left = (r.left + r.width / 2) + 'px';
    sp.style.top  = (r.top + r.height / 2) + 'px';
    sp.style.setProperty('--bx', ((Math.random() - .5) * 220).toFixed(0) + 'px');
    sp.style.setProperty('--by', (-40 - Math.random() * 160).toFixed(0) + 'px');
    sp.style.animationDelay = (Math.random() * .12).toFixed(2) + 's';
    document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 1200);
  }
}

function renderTriviaScores(scores, gains) {
  $('tg-scores').innerHTML = scores.map(s => {
    const g = gains && s.socketId ? gains[s.socketId] : null;
    return `
    <div class="tg-score-chip${g ? ' tg-chip-bump' : ''}" style="background:${TRIVIA_COLORS[s.colorIndex] || '#64748b'}">
      <span>${s.name}</span>
      <span class="tg-score-check">${s.score}pt${g ? ` <b class="tg-chip-gain">+${g.pts}</b>` : ''}</span>
    </div>`;
  }).join('');
}

function showTriviaFinished(scores) {
  stopTriviaTimer();
  const _skip = $('tg-skip'); if (_skip) _skip.classList.add('hidden');
  $('btn-boost-hint')?.classList.add('hidden'); // plus d'indice utilisable une fois le quiz fini
  $('tg-choices').innerHTML = '';
  $('tg-reveal').classList.add('hidden');
  const medals = ['🥇','🥈','🥉'];
  const myIdx = triviaIsSolo ? 0 : scores.findIndex(s => s.socketId === triviaMySocketId);
  let html = '';
  if (!triviaIsSolo && scores.length >= 2) {
    // Podium anime pour le top 3 (2e a gauche, 1er au centre, 3e a droite).
    const order = [1, 0, 2].filter(i => i < scores.length);
    html += `<div class="tg-podium">${order.map(i => {
      const s = scores[i];
      const col = TRIVIA_COLORS[s.colorIndex] || '#64748b';
      return `<div class="tg-podium-col tg-podium-p${i + 1}${i === myIdx ? ' me' : ''}">
        ${i === 0 ? '<span class="tg-podium-crown">👑</span>' : ''}
        <span class="tg-podium-medal">${medals[i]}</span>
        <span class="tg-podium-name">${_escHtml(s.name)}</span>
        <span class="tg-podium-pts">${s.score} pts</span>
        <div class="tg-podium-block" style="background:${col}">${i + 1}</div>
      </div>`;
    }).join('')}</div>`;
    if (scores.length > 3) {
      html += scores.slice(3).map((s, j) => `
        <div class="tg-final-row" style="background:${TRIVIA_COLORS[s.colorIndex] || '#64748b'}">
          <span class="tg-final-rank">${j + 4}.</span>
          <span class="tg-final-name">${_escHtml(s.name)}</span>
          <span class="tg-final-score">${s.score} pts</span>
        </div>`).join('');
    }
    if (myIdx >= 0) {
      const msg = myIdx === 0 ? t().triviaPodiumWin : myIdx <= 2 ? t().triviaPodiumTop3 : t().triviaPodiumOut(myIdx + 1);
      html += `<p class="tg-podium-msg${myIdx <= 2 ? ' win' : ''}">${msg}</p>`;
    }
  } else {
    html = scores.map((s, i) => `
      <div class="tg-final-row" style="background:${TRIVIA_COLORS[s.colorIndex] || '#64748b'}">
        <span class="tg-final-rank">${medals[i] || (i+1)+'.'}</span>
        <span class="tg-final-name">${_escHtml(s.name)}</span>
        <span class="tg-final-score">${s.score} pts</span>
      </div>
    `).join('');
  }
  if (myIdx >= 0) {
    html += `<button id="tg-share-rank" class="btn btn-primary tg-share-btn">${t().triviaShareBtn}</button>`;
  }
  $('tg-final-scores').innerHTML = html;
  document.getElementById('tg-share-rank')?.addEventListener('click', async () => {
    const me = scores[myIdx];
    const text = triviaIsSolo ? t().triviaShareSolo(me.score) : t().triviaShareRank(myIdx + 1, me.score);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); showCursorSnakeToast(t().triviaShareCopied); } catch {}
  });
  $('tg-finished').classList.remove('hidden');
  if (!triviaIsSolo && myIdx === 0) celebrate(); // champion du quiz multi
}

$('btn-leave-trivia-game').addEventListener('click', goToTriviaHome);
$('btn-quit-trivia').addEventListener('click', goToTriviaHome);
$('tg-skip')?.addEventListener('click', onTriviaSkip);

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
  showTriviaQuestion({ questionNum: triviaCurrentQ + 1, totalQuestions: triviaQuestions.length, question: q.question, choices: q.choices, timeLimit: selectedTriviaDifficulty === 'extreme' ? 15 : 30, scores: null });
}

function soloReveal(myChoice) {
  const q = triviaQuestions[triviaCurrentQ];
  let soloGain = null;
  if (myChoice === q.correct) {
    // Même règle qu'en multi : répondre vite double le point.
    const fast = (Date.now() - (window._triviaQStartAt || 0)) <= (window._triviaQLimitMs || 30000) * 0.4;
    const pts  = fast ? 2 : 1;
    triviaScore += pts;
    soloGain = { pts, fast };
  }
  showTriviaReveal({ correct: q.correct, correctSocketIds: [], scores: null, myChoice, soloGain });
  triviaCurrentQ++;
  saveTriviaSession({ isSolo: true, questions: triviaQuestions, currentQ: triviaCurrentQ, score: triviaScore, difficulty: selectedTriviaDifficulty });
  setTimeout(soloNextQuestion, 3000);
}

// ── Trivia : classement ───────────────────────────────────────────────────────
function renderTriviaLeaderboard(data) {
  const list = $('trivia-lb-list');
  if (!data || data.length === 0) { list.innerHTML = `<p class="lb-empty">${t().triviaLbEmpty}</p>`; return; }
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = data.map((entry, i) => `
    <div class="lb-row lb-row-clickable" data-pname="${_escHtml(entry.name)}" data-cosmetic="${entry.cosmetic||''}" data-avatar="${entry.avatar||''}" data-cursor="${entry.cursorSnake||''}" data-font="${entry.font||''}" data-nameeffect="${entry.nameEffect||''}">
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
      // Fiche joueur : niveau + demande d'ami (remplace l'ancien renvoi boutique).
      window._openPlayerCard?.(row.dataset.pname);
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

// ── Assistant / Chatbot d'aide (100% local, aucune API, aucun coût) ───────────
// Recherche par mots-clés dans la base d'aide existante (helpContent), bilingue.
(function initChatbot(){
  const panel  = $('chatbot-panel');
  const fab     = $('btn-chatbot');
  const logEl  = $('chatbot-log');
  const chipsEl = $('chatbot-chips');
  const form   = $('chatbot-form');
  const input  = $('chatbot-input');
  if (!panel || !fab || !logEl || !chipsEl || !form || !input) return;

  const LS_OPEN = 'libero_chat_open';
  const LS_LOG  = 'libero_chat_log';
  const LOG_MAX = 40;

  const norm = s => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const esc = s => (s || '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));

  const STOP = new Set(('le la les un une des de du au aux et ou a c ce cette mon ma mes ton ta tes comment quoi qui que quel quelle quels quelles pour dans sur je tu on nous vous il elle se sa son ses avec plus fait faire est the an of to how what is are do does i my me you your can where why with in it this that for and or').split(' '));

  // Chaque terme utilisateur est enrichi de synonymes qui pointent vers des mots
  // reellement presents dans les fiches d'aide (FR et EN).
  const SYN = {
    argent:['libs','monnaie'], money:['libs','monnaie'], sous:['libs'], cash:['libs'],
    gagner:['gagne','classement','libs'], gagne:['classement','libs'], earn:['libs','classement'], win:['classement','victoire'], gratuit:['gratuit'], free:['gratuit'],
    acheter:['acheter','recharger','fedapay'], buy:['acheter','recharger','fedapay'], payer:['recharger','fedapay'], pay:['recharger','fedapay'], recharger:['recharger','fedapay'], topup:['recharger','fedapay'], top:['recharger'], paiement:['recharger','fedapay'], payment:['recharger','fedapay'], fedapay:['recharger','fedapay'],
    livre:['lecture','livres','roman','reading'], livres:['lecture','roman','reading'], book:['lecture','livres','roman','reading','books'], books:['lecture','roman','reading'], roman:['lecture','livres','reading'], lire:['lecture','livres','reading'], read:['lecture','livres','reading','books'], reading:['lecture','livres','books'], lecture:['lecture','livres','reading'], georgia:['lecture','livres','reading'], georgie:['lecture','livres','reading'], affaire:['lecture','livres','reading'],
    defi:['defis','profil'], defis:['defis','profil'], daily:['defis','profil'], quotidien:['defis','profil'], challenge:['defis','profil'], challenges:['defis','profil'], objectif:['defis'], objectifs:['defis'],
    run:['libero','runner','run'], runner:['libero','runner'], courir:['libero','runner'], course:['libero','runner'], mascotte:['libero','runner'], libero:['libero','runner'],
    quiz:['quiz','culture','themes'], culture:['quiz','culture'], trivia:['quiz','culture'], question:['quiz','themes'], questions:['quiz','themes'], theme:['themes','quiz'], themes:['themes','quiz'],
    echec:['echecs'], echecs:['echecs'], chess:['echecs','chess'],
    morpion:['morpion'], tictactoe:['morpion','ttt'],
    puissance:['puissance'], connect:['puissance','connect'],
    serpent:['serpent','snake'], snake:['serpent','snake'],
    langue:['langue'], language:['langue'], anglais:['langue'], francais:['langue'], english:['langue'], french:['langue'],
    sombre:['theme'], clair:['theme'], dark:['theme'], light:['theme'], nuit:['theme'], night:['theme'],
    son:['sons','musique'], sons:['sons','musique'], sound:['sons','musique'], musique:['musique','sons'], music:['musique','sons'], volume:['sons','musique'],
    boutique:['boutique'], shop:['boutique'], cosmetique:['boutique'], cosmetic:['boutique'], skin:['boutique'], skins:['boutique'], bundle:['boutique'], bundles:['boutique'],
    commentaire:['commentaire'], avis:['commentaire'], bug:['commentaire'], suggestion:['commentaire'], feedback:['commentaire'], contact:['commentaire'], contacter:['commentaire'], createur:['commentaire'], creator:['commentaire'], joindre:['commentaire'], ecrire:['commentaire'], write:['commentaire'], message:['commentaire'], probleme:['commentaire'], problem:['commentaire'],
    classement:['classement'], leaderboard:['classement'], rang:['classement'], rank:['classement'], score:['classement'],
    solo:['solo','bot'], bot:['bot','solo'], multijoueur:['multijoueur'], multiplayer:['multijoueur'], ami:['rejoindre','code'], amis:['rejoindre','code'], friend:['rejoindre','code'], code:['rejoindre','code'], rejoindre:['rejoindre','code'], join:['rejoindre','code'],
    profil:['profil','defis','casier'], profile:['profil','defis','casier'], serie:['serie','connexion'], streak:['serie','connexion'],
    casier:['casier','profil'], locker:['casier','profil'], equiper:['casier','equiper'], equip:['casier','equiper'], desequiper:['casier','equiper'], unequip:['casier','equiper'], cosmetique2:['casier'],
    cadeau:['cadeau','offrir'], cadeaux:['cadeau','offrir'], gift:['cadeau','offrir','gift'], offrir:['cadeau','offrir'], offert:['cadeau','offrir'],
    recuperation:['recuperation','sauvegarder'], recuperer:['recuperation','sauvegarder'], recovery:['recuperation','recovery'], recover:['recuperation','recovery'], sauvegarder:['recuperation','sauvegarder','progression'], sauvegarde:['recuperation','sauvegarder'], save:['recuperation','recovery'], progression:['recuperation','progression'], progress:['recuperation','recovery'], appareil:['recuperation'], device:['recuperation','recovery'], telephone:['recuperation'], phone:['recuperation','recovery'], perdu:['recuperation'], lost:['recuperation','recovery'],
    tournoi:['tournoi','samedi','champion'], tournament:['tournoi','samedi','champion'], samedi:['tournoi','samedi'], champion:['tournoi','champion'],
    parrain:['parrainage','inviter','ami'], parrainage:['parrainage','inviter','ami'], inviter:['parrainage','inviter','ami'], invitation:['parrainage','inviter'], referral:['parrainage','inviter'], filleul:['parrainage'],
    mise:['mise','duel','vainqueur'], miser:['mise','duel'], parier:['mise','duel'], pari:['mise','duel'], duel:['mise','duel'], stake:['mise','duel'], bet:['mise','duel'],
    emote:['emotes','reactions','profil'], emotes:['emotes','reactions','profil'], reaction:['emotes'], reactions:['emotes'],
    reglage:['reglages','parametres','profil'], reglages:['reglages','parametres','profil'], parametre:['reglages','parametres'], parametres:['reglages','parametres'], settings:['parametres','profil'],
    eclair:['quiz','vitesse'], vitesse:['quiz','vitesse'], rapide:['quiz','vitesse'], lightning:['quiz','speed'], vite:['quiz','vitesse'],
    pluie:['emojis','pluie'], emoji:['emojis','pluie'], emojis:['emojis','pluie'],
    reinitialiser:['reinitialiser','reset'], reset:['reinitialiser','reset'], effacer:['reinitialiser'], supprimer:['reinitialiser','compte'], delete:['reinitialiser','reset'], compte:['compte','recuperation'], account:['compte','recovery','reset'], zero:['reinitialiser'],
    niveau:['niveaux','xp'], niveaux:['niveaux','xp'], level:['niveaux','xp','levels'], levels:['niveaux','xp'], xp:['niveaux','xp'], experience:['niveaux','xp'], palier:['niveaux','xp'],
    qi:['qi','test'], iq:['qi','test'], intelligence:['qi','test'], intellectuel:['qi','test'], logique:['qi','quiz'],
    roue:['roue','fortune'], fortune:['roue','fortune'], wheel:['roue','fortune'], spin:['roue','fortune'], tourner:['roue'],
    vip:['vip','pass'], pass:['vip','pass'],
    ludo:['ludo','pion'], pion:['ludo','dames'], pions:['ludo','dames'], dice:['ludo'],
    svt:['revisions','quiz'], revision:['revisions','quiz'], revisions:['revisions','quiz'], reviser:['revisions','quiz'], ecole:['revisions','quiz'], school:['revisions','quiz'], benin:['revisions','quiz'], biologie:['revisions','quiz'], biology:['revisions','quiz'],
    notification:['notifications','installer'], notifications:['notifications','installer'], notif:['notifications'], notifs:['notifications'], push:['notifications'], installer:['installer','appli','notifications'], install:['installer','appli'], appli:['installer','appli'], application:['installer','appli'], app:['installer','appli'],
    flash:['flash','offres','boutique'], offre:['flash','offres','boutique'], offres:['flash','offres','boutique'], promo:['flash','offres','boutique'], promotion:['flash','offres'], reduction:['flash','offres'], discount:['flash','offres'],
  };

  const GREET  = new Set('bonjour salut coucou hello hi hey yo bonsoir wesh'.split(' '));
  const THANKS = new Set('merci thanks thx thank cool super genial nice'.split(' '));

  let KB = [];
  function buildKB(){
    const d = t();
    KB = [];
    const hc = d.helpContent || {};
    for (const key of Object.keys(hc)) {
      (hc[key] || []).forEach(item => {
        const title = item.titleKey ? d[item.titleKey] : item.title;
        const desc  = item.descKey  ? d[item.descKey]  : item.desc;
        if (!title || !desc) return;
        KB.push({ icon:item.icon || '💡', title, desc, tn:norm(title), dn:norm(desc) });
      });
    }
  }

  function expand(tokens){
    const out = new Set();
    tokens.forEach(tk => {
      if (tk.length < 2 || STOP.has(tk)) return;
      out.add(tk);
      (SYN[tk] || []).forEach(s => out.add(s));
    });
    return [...out];
  }

  function search(query){
    const toks = expand(norm(query).split(' ').filter(Boolean));
    if (!toks.length) return [];
    return KB.map(doc => {
      let sc = 0;
      const tset = new Set(doc.tn.split(' '));
      toks.forEach(tk => {
        if (tset.has(tk)) sc += 4;
        else if (doc.tn.indexOf(tk) >= 0) sc += 3;
        if (doc.dn.indexOf(tk) >= 0) sc += 1;
      });
      return { doc, sc };
    }).filter(x => x.sc > 0).sort((a,b) => b.sc - a.sc);
  }

  function pushLog(role, html, save){
    const wrap = document.createElement('div');
    wrap.className = 'chatbot-msg chatbot-msg-' + role;
    wrap.innerHTML = html;
    logEl.appendChild(wrap);
    logEl.scrollTop = logEl.scrollHeight;
    if (save !== false) persist();
  }

  function botCards(list){
    return list.map(({doc}) =>
      `<div class="chatbot-card"><span class="chatbot-card-ic">${doc.icon}</span><div><strong>${doc.title}</strong><p>${doc.desc}</p></div></div>`
    ).join('');
  }

  function answer(query){
    const d = t();
    const q = norm(query);
    const words = q.split(' ').filter(Boolean);
    if (words.length && GREET.has(words[0]) && words.length <= 2) { pushLog('bot', esc(d.chatbot.greeting)); return; }
    if (words.length && words.every(w => THANKS.has(w))) { pushLog('bot', esc(d.chatbot.thanks)); return; }
    const res = search(query);
    if (!res.length || res[0].sc < 3) { pushLog('bot', esc(d.chatbot.fallback)); return; }
    const top = res.slice(0, res[0].sc >= 6 ? 2 : 3).filter(x => x.sc >= 3);
    pushLog('bot', `<p class="chatbot-intro">${esc(d.chatbot.answerIntro)}</p>` + botCards(top));
  }

  function submit(text){
    const clean = (text || '').trim();
    if (!clean) return;
    pushLog('user', esc(clean));
    logBotQuestion(clean);
    setTimeout(() => answer(clean), 140);
  }

  // Journalise la question côté serveur (anonyme) pour le tableau de bord admin.
  function logBotQuestion(q){
    try {
      fetch(`${window.BACKEND_URL}/api/bot-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q.slice(0, 200), lang: currentLang }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {}
  }

  function renderChips(){
    const d = t();
    chipsEl.innerHTML = (d.chatbot.suggestions || []).map((s,i) =>
      `<button type="button" class="chatbot-chip" data-i="${i}">${esc(s.q)}</button>`
    ).join('');
  }

  function persist(){
    try {
      const msgs = [...logEl.querySelectorAll('.chatbot-msg')].slice(-LOG_MAX).map(el => ({
        r: el.classList.contains('chatbot-msg-user') ? 'user' : 'bot',
        h: el.innerHTML,
      }));
      localStorage.setItem(LS_LOG, JSON.stringify(msgs));
    } catch(e){}
  }

  function restoreLog(){
    logEl.innerHTML = '';
    let msgs = null;
    try { msgs = JSON.parse(localStorage.getItem(LS_LOG) || 'null'); } catch(e){}
    if (msgs && msgs.length) msgs.forEach(m => pushLog(m.r, m.h, false));
    else pushLog('bot', esc(t().chatbot.greeting), false);
  }

  function openPanel(){
    panel.classList.remove('hidden');
    fab.classList.add('chatbot-fab-open');
    localStorage.setItem(LS_OPEN, '1');
    setTimeout(() => { logEl.scrollTop = logEl.scrollHeight; input.focus(); }, 30);
  }
  function closePanel(){
    panel.classList.add('hidden');
    fab.classList.remove('chatbot-fab-open');
    localStorage.setItem(LS_OPEN, '0');
  }
  function toggle(){ panel.classList.contains('hidden') ? openPanel() : closePanel(); }

  function retexte(){
    const d = t();
    fab.title = d.chatbot.fabTitle;
    const ti = $('chatbot-title');    if (ti) ti.textContent = d.chatbot.title;
    const su = $('chatbot-subtitle'); if (su) su.textContent = d.chatbot.subtitle;
    const rb = $('chatbot-reset');    if (rb) rb.title = d.chatbot.reset;
    input.placeholder = d.chatbot.placeholder;
    buildKB();
    renderChips();
  }
  window._chatbot = { retexte };

  fab.addEventListener('click', toggle);
  $('chatbot-close').addEventListener('click', closePanel);
  $('chatbot-reset').addEventListener('click', () => {
    try { localStorage.removeItem(LS_LOG); } catch(e){}
    restoreLog(); persist();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    submit(input.value);
    input.value = '';
  });
  chipsEl.addEventListener('click', e => {
    const btn = e.target.closest('.chatbot-chip');
    if (!btn) return;
    const s = (t().chatbot.suggestions || [])[+btn.dataset.i];
    if (s) submit(s.q);
  });

  buildKB();
  renderChips();
  restoreLog();
  retexte();
  if (localStorage.getItem(LS_OPEN) === '1') openPanel();
})();

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
  saveTriviaSession({ isSolo: true, questions: triviaQuestions, currentQ: 0, score: 0, difficulty: selectedTriviaDifficulty });
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
  pingVisit();
  socket.emit('get-leaderboard');
  socket.emit('get-trivia-leaderboard');
  socket.emit('get-global-leaderboard');
  socket.emit('get-libs', { playerId: getPlayerId() });

  // Jointure par lien de partage (une seule fois, sauf si une partie est déjà
  // en cours de reconnexion). Le serveur résout le bon type de salle.
  if (pendingJoinCode && pendingJoinCode.length === 4
      && !sessionStorage.getItem('p4session') && !sessionStorage.getItem('triviaSession')) {
    const name = getPlayerName() || getTriviaName() || (localStorage.getItem('playerName') || '').trim();
    if (name && name !== 'Anonyme') {
      socket.emit('join-by-code', { code: pendingJoinCode, name, playerId: getPlayerId() });
    } else {
      // Pas de pseudo : on l'exige avant de rejoindre la partie du lien.
      window._askJoinName?.(pendingJoinCode);
    }
  }
  // Parrainage : le nouveau venu déclare son parrain (une seule fois).
  const _refCode = localStorage.getItem('libero_referrer_code');
  if (_refCode) {
    socket.emit('set-referrer', { playerId: getPlayerId(), ref: _refCode });
    localStorage.removeItem('libero_referrer_code');
  }
  socket.emit('get-tournament');
  socket.emit('get-shop-overrides'); // pour le rayon Emotes du profil (disponibilités/comptes à rebours)
  // Lien cadeau : échange automatique du code (une seule fois par chargement).
  if (pendingGiftCode && pendingGiftCode.length === 8 && !window._giftLinkTried) {
    window._giftLinkTried = true;
    socket.emit('redeem-gift', { code: pendingGiftCode, playerId: getPlayerId(), name: localStorage.getItem('playerName') || '' });
  }
  if (sessionStorage.getItem('libero_screen') === 'events') socket.emit('get-snake-leaderboard');
  if (sessionStorage.getItem('libero_screen') === 'events') socket.emit('get-tournament');
  if (sessionStorage.getItem('libero_screen') === 'luffy')  socket.emit('get-luffy-leaderboard');
  if (window._profileHub) {
    const _scr = sessionStorage.getItem('libero_screen');
    if      (_scr === 'profile') window._profileHub.enter();
    else if (_scr === 'locker')  window._profileHub.enterLocker();
    else if (_scr === 'history') window._profileHub.enterHistory();
  }

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
      if (data.difficulty) selectedTriviaDifficulty = data.difficulty;
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

// Sélecteur de mise (duel) : montants fixes, « Sans » par défaut.
window._selectedStake = 0;
document.querySelectorAll('.stake-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.stake-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window._selectedStake = parseInt(btn.dataset.stake, 10) || 0;
  });
});

socket.on('room-created', ({ code, gameType, stake }) => {
  currentRoomCode = code;
  currentGame     = gameType;
  $('room-code').textContent     = code;
  $('waiting-game-name').textContent = t().games[gameType] + (stake ? ` · 💰 ${stake} ⚡` : '');
  showScreen('waiting');
});

// Résultats de mise : pot au vainqueur, remboursement, mise annulée.
socket.on('stake-result', ({ outcome, winnerRole, pot } = {}) => {
  const d = t();
  if (outcome === 'won') {
    const iWon = winnerRole === myPlayer;
    showCursorSnakeToast(iWon ? d.stakeWon(pot) : d.stakeLost(pot / 2));
  } else if (outcome === 'refund') {
    showCursorSnakeToast(d.stakeRefund(pot));
  } else if (outcome === 'cancelled') {
    showCursorSnakeToast(d.stakeCancelled);
  }
});

socket.on('game-start', ({ gameType, state, yourPlayer, vsBot, botDifficulty, code, stake }) => {
  isBotGame = !!vsBot;
  if (code) currentRoomCode = code; // couvre la jointure inter-sections / par lien
  if (stake > 0) setTimeout(() => showCursorSnakeToast(t().stakeStart(stake, stake * 2)), 600);
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
  if (String(square) !== String(selectedSquare)) return;
  availableMoves = moves;
  if (currentGame === 'checkers') {
    moves.forEach(mv => document.querySelector(`.ck-sq[data-idx="${mv}"]`)?.classList.add('can-move'));
    return;
  }
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

// L'adversaire propose une revanche : on affiche Accepter / Refuser.
socket.on('restart-requested', () => {
  if ($('game-status').classList.contains('hidden')) return;
  $('btn-restart').classList.add('hidden');
  $('restart-pending').classList.add('hidden');
  $('restart-vote-text').textContent = t().restartRequestedPrompt;
  $('restart-vote-prompt').classList.remove('hidden');
});
// L'adversaire a refusé la revanche.
socket.on('restart-declined', () => {
  $('restart-pending').classList.add('hidden');
  $('restart-vote-prompt').classList.add('hidden');
  $('btn-restart').classList.remove('hidden');
  $('btn-restart').disabled = false;
  $('btn-menu').classList.remove('hidden');
  showCursorSnakeToast(t().restartDeclined);
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
socket.on('libs-update', ({ name: serverName, refCode, referrals, xp, level, iq, iqUnlocked, iqQuizDone, vipUntil, balance, pendingBoostHint, delta, nextAt, ownedCosmetics: newOwned, equippedCosmetic: newEquipped, equippedFont: newFont, equippedBubble: newBubble, equippedBackground: newBg, equippedNameEffect: newNameEffect, equippedTitle: newTitle, equippedCursorSnake: newCursorSnake, equippedAvatar: newAvatar, equippedP4Token: newP4Token, equippedTtt: newTtt, equippedChess: newChess, equippedSnakeSkin: newSnakeSkin, equippedClickFx: newClickFx, equippedEmojiPack: newEmojiPack, equippedVictoryBan: newVictoryBan, equippedSoundPack: newSoundPack, equippedEmotes: newEmotes, refundCards: newRefundCards, refundCardsNextRefill: newRefillAt, honorTitle: newHonorTitle, pendingHonorModal: newHonorModal } = {}) => {
  if (refCode !== undefined)   window._myRefCode = refCode;
  if (referrals !== undefined) window._myReferrals = referrals;
  if (xp !== undefined)         { window._myXp = xp; window._myLevel = level; window._renderLevel?.(); }
  if (iq !== undefined)         window._myIq = iq;
  if (iqUnlocked !== undefined) window._myIqUnlocked = iqUnlocked;
  if (iqQuizDone !== undefined) window._myIqQuizDone = iqQuizDone;
  if (iq !== undefined || iqUnlocked !== undefined) window._renderIqCard?.();
  if (vipUntil !== undefined)   { window._myVipUntil = vipUntil; window._renderVip?.(); }
  const prev = libsBalance;
  // Certaines mises a jour partielles (ex. titre honorifique seul) n'ont pas de
  // champ balance : ne jamais ecraser le solde avec 0 dans ce cas.
  if (balance !== undefined) libsBalance = balance;
  localStorage.setItem('libero_libs', String(libsBalance));
  // Récupération de progression : sur un appareil neuf (pseudo local vide), on
  // restaure le pseudo mémorisé côté serveur pour ce code.
  if (serverName && !(localStorage.getItem('playerName') || '').trim() && serverName !== 'Anonyme') {
    localStorage.setItem('playerName', serverName);
    const ni = $('input-name'); if (ni) ni.value = serverName;
    const tni = $('input-trivia-name'); if (tni) tni.value = serverName;
    applyLang();
  }
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
  if (window._profileHub && document.body.classList.contains('screen-locker-active')) window._profileHub.renderLocker();
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
    window._sound?.play("coin");
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
    window._sound?.play("coin");
    _showShopFeedback(t().shopCosmeticBought, '#22c55e');
    if (cosmeticId?.startsWith('emote-')) _renderEmoteBar();
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
    // Achat depuis le rayon Emotes du profil (casier) : rafraîchir la vue.
    if (window._profileHub && document.body.classList.contains('screen-locker-active')) window._profileHub.renderLocker();
  } else {
    const msg = error === 'already_owned'  ? t().shopCosmeticAlreadyOwned
              : error === 'anonymous'      ? t().shopCosmeticAnon
              : error === 'insufficient'   ? t().shopInsufficient
              : error === 'unavailable'    ? t().emoteUnavailable
              : t().shopBuyError;
    if (document.body.classList.contains('screen-locker-active')) { showCursorSnakeToast(msg); if (window._profileHub) window._profileHub.renderLocker(); }
    else _showShopFeedback(msg, '#ef4444');
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
  // Rafraîchit le casier tout de suite : permet de rééquiper juste après avoir
  // déséquipé, sans avoir à recharger la page.
  if (window._profileHub && document.body.classList.contains('screen-locker-active')) window._profileHub.renderLocker();
});

socket.on('refund-cosmetic-result', ({ ok, refundCards: newCards, delta, error } = {}) => {
  if (ok) {
    if (newCards !== undefined) refundCards = newCards;
    window._sound?.play("coin");
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
    window._sound?.play("coin");
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

socket.on('error', ({ message, stake } = {}) => {
  if (message === 'stake_insufficient')      { showError(t().stakeInsufficient); return; }
  if (message === 'stake_insufficient_join') { showError(t().stakeInsufficientJoin(stake || 0)); return; }
  showError(message);
});
socket.on('connect_error', () => { showError(t().errConnect); });
// Echec d'une jointure par lien de partage (code introuvable) : toast neutre.
socket.on('join-code-failed', ({ message }) => { showCursorSnakeToast(message || t().joinLinkFailed); });

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
  socket.emit('get-flash-offer');
  socket.emit('get-shop-overrides');
  _renderShopItems();
  _loadLibsPacks();
  socket.emit('get-libs', { playerId: getPlayerId() });
  $('overlay-shop').classList.remove('hidden');
  document.body.classList.add('shop-open'); // masque la barre de navigation pendant la boutique
}

// Charge une fois la liste des packs de Libs (prix, dispo) puis rafraîchit
// le panneau Recharger s'il est ouvert · même filet que shopRotation.
async function _loadLibsPacks() {
  if (libsPacksCache) return;
  try {
    const res = await fetch(`${window.BACKEND_URL}/api/libs/packs`);
    if (!res.ok) throw new Error();
    libsPacksCache = await res.json();
  } catch { libsPacksCache = []; }
  if (!$('libs-topup-panel').classList.contains('hidden')) _renderLibsTopupPanel();
}

// Fusionne un patch dans l'état persistant de la boutique (sessionStorage) · 
// permet de rouvrir exactement le même panneau (liste des packs / formulaire
// d'un pack précis, avec les champs déjà saisis) après un refresh accidentel.
function _saveShopPanelState(patch) {
  const prev = (() => { try { return JSON.parse(sessionStorage.getItem('shopState')) || {}; } catch { return {}; } })();
  sessionStorage.setItem('shopState', JSON.stringify({ ...prev, ...patch }));
}

// ── Section dédiée « Recharger » (bouton à côté du solde, pas mêlée aux articles) ──
function _renderLibsTopupPanel() {
  const d  = t();
  const fr = currentLang === 'fr';
  $('libs-topup-title').textContent = d.shopLibsPacksTitle;
  $('libs-topup-desc').textContent  = d.shopLibsPacksDesc;
  const grid = $('libs-topup-grid');
  if (!grid) return;
  grid.innerHTML = !libsPacksCache
    ? `<p class="shop-fn-section-desc">${d.shopLibsPacksLoading}</p>`
    : libsPacksCache.length === 0
      ? `<p class="shop-fn-section-desc">${d.shopLibsPacksUnavailable}</p>`
      : libsPacksCache.map(p => `
        <div class="shop-libspack-card${p.available ? '' : ' unavailable'}${p.featured ? ' featured' : ''}">
          ${p.featured ? `<span class="shop-libspack-badge">${d.shopLibsPacksFeatured}</span>` : ''}
          <div class="shop-libspack-name">${d.shopLibsPackNames[p.id] || p.id}</div>
          <div class="shop-libspack-amount">⚡ ${p.libs}</div>
          ${p.bonus ? `<div class="shop-libspack-bonus">${d.shopLibsPacksBonus(p.bonus)}</div>` : ''}
          <div class="shop-libspack-price">${p.priceFCFA.toLocaleString(fr ? 'fr-FR' : 'en-US')} FCFA</div>
          <button class="btn btn-primary shop-libspack-buy" data-pack="${p.id}" data-libs="${p.libs}" data-price="${p.priceFCFA}" ${p.available ? '' : 'disabled'}>
            ${p.available ? d.shopLibsPacksBuy : d.shopLibsPacksSoon}
          </button>
        </div>`).join('');
  grid.querySelectorAll('.shop-libspack-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      _openLibsBuyForm(btn.dataset.pack, parseInt(btn.dataset.libs, 10), parseInt(btn.dataset.price, 10));
    });
  });
}

function _openLibsTopupPanel() {
  _loadLibsPacks();
  _renderLibsTopupPanel();
  $('libs-topup-panel').classList.remove('hidden');
  _saveShopPanelState({ view: 'topup' });
}

$('btn-libs-topup')?.addEventListener('click', _openLibsTopupPanel);
$('libs-topup-back')?.addEventListener('click', () => {
  $('libs-topup-panel').classList.add('hidden');
  _saveShopPanelState({ view: 'browse' });
});

// ── Achat de Libs avec de l'argent réel (FedaPay) ───────────────────────────
let _pendingLibsPack = null;

function _openLibsBuyForm(packId, libsAmount, priceFCFA, restoreForm) {
  const d = t();
  _pendingLibsPack = { packId, libsAmount, priceFCFA };
  $('libs-buy-title').textContent   = d.shopLibsBuyTitle;
  $('libs-buy-summary').textContent = d.shopLibsBuySummary(libsAmount, priceFCFA);
  const nameParts = (localStorage.getItem('playerName') || '').trim().split(/\s+/).filter(Boolean);
  $('libs-buy-email').value     = restoreForm?.email     ?? (localStorage.getItem('libero_buy_email') || '');
  $('libs-buy-firstname').value = restoreForm?.firstName ?? (nameParts[0] || '');
  $('libs-buy-lastname').value  = restoreForm?.lastName  ?? nameParts.slice(1).join(' ');
  $('libs-buy-phone').value     = restoreForm?.phone     ?? '';
  const fb = $('libs-buy-feedback'); fb.textContent = ''; fb.style.color = '';
  $('libs-buy-submit').disabled = false;
  $('libs-buy-submit').textContent = d.shopLibsBuySubmit;
  $('libs-buy-panel').classList.remove('hidden');
  _saveShopPanelState({ view: 'buy', pack: { packId, libsAmount, priceFCFA } });
}

// Persiste la saisie du formulaire en direct : un refresh accidentel en
// pleine frappe restaure exactement ce qui était tapé, pas seulement l'écran.
['libs-buy-email', 'libs-buy-firstname', 'libs-buy-lastname', 'libs-buy-phone'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    _saveShopPanelState({ form: {
      email: $('libs-buy-email').value, firstName: $('libs-buy-firstname').value,
      lastName: $('libs-buy-lastname').value, phone: $('libs-buy-phone').value,
    } });
  });
});

$('libs-buy-back')?.addEventListener('click', () => {
  $('libs-buy-panel').classList.add('hidden');
  _pendingLibsPack = null;
  _saveShopPanelState({ view: 'topup', form: null });
});

$('libs-buy-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!_pendingLibsPack) return;
  const d = t();
  const email     = $('libs-buy-email').value.trim();
  const firstName = $('libs-buy-firstname').value.trim();
  const lastName  = $('libs-buy-lastname').value.trim();
  const phone     = $('libs-buy-phone').value.trim();
  const fb  = $('libs-buy-feedback');
  const btn = $('libs-buy-submit');
  if (!email || !firstName || !lastName) {
    fb.textContent = d.shopLibsBuyMissing; fb.style.color = '#ef4444'; return;
  }
  localStorage.setItem('libero_buy_email', email);
  btn.disabled = true;
  fb.style.color = ''; fb.textContent = d.shopLibsBuyProcessing;
  try {
    const res = await fetch(`${window.BACKEND_URL}/api/libs/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: getPlayerId(), packId: _pendingLibsPack.packId,
        email, firstName, lastName, phone: phone || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { const err = new Error(); err.code = data.error; throw err; }
    // Le crédit ne se fera qu'après vérification serveur au retour du paiement.
    localStorage.setItem('libero_pending_cart', data.cartId);
    window.location.href = data.redirectUrl;
  } catch (err) {
    btn.disabled = false;
    const map = {
      anonymous:        d.shopLibsBuyAnon,
      invalid_email:    d.shopLibsBuyBadEmail,
      invalid_name:     d.shopLibsBuyMissing,
      rate_limited:     d.shopLibsBuyRateLimited,
      invalid_pack:     d.shopLibsBuyError,
      pack_unavailable: d.shopLibsBuyError,
      checkout_failed:  d.shopLibsBuyError,
    };
    fb.textContent = map[err?.code] || d.shopLibsBuyError;
    fb.style.color = '#ef4444';
  }
});

// Retour du paiement : c'est le SERVEUR qui confirme via /api/libs/verify,
// jamais le simple fait de revenir sur le site (falsifiable).
async function _checkPendingLibsCart() {
  const cartId = localStorage.getItem('libero_pending_cart');
  if (!cartId) return;
  const d = t();
  let attempts = 0;
  const maxAttempts = 4;
  async function attempt() {
    attempts++;
    try {
      const res = await fetch(`${window.BACKEND_URL}/api/libs/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId(), cartId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === 'completed') {
        localStorage.removeItem('libero_pending_cart');
        showCursorSnakeToast(d.shopLibsBuyCredited(data.libsAdded));
        return;
      }
      if (data.status === 'waiting_payment' && attempts < maxAttempts) {
        setTimeout(attempt, 5000);
        return;
      }
      if (data.status === 'abandoned' || data.status === 'payment_failed') {
        localStorage.removeItem('libero_pending_cart');
        showCursorSnakeToast(d.shopLibsBuyFailed);
        return;
      }
      // Toujours en attente après plusieurs essais : on laisse la relance
      // serveur (toutes les 10 min) faire le travail, sans harceler le joueur.
    } catch {
      if (attempts < maxAttempts) setTimeout(attempt, 5000);
    }
  }
  attempt();
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

// Sélection « À la une » : un mélange varié (fonds, couleurs, effet, titre) mis
// en avant. Sert de repli si le serveur ne fournit pas de rotation featured.
const _FEATURED_IDS = ['bg-hologramme', 'bg-galaxie', 'bg-synthwave', 'rainbow', 'gold', 'nameeffect-rainbow', 'title-champion', 'diamond'];

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
  const ALL_SNAKESKINS = [
    {id:'snakeskin-gems',price:50},{id:'snakeskin-cyber',price:80},{id:'snakeskin-lava',price:120},
    {id:'snakeskin-galaxy',price:140},{id:'snakeskin-rainbow',price:180},
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
    {id:'emote-hello',price:0},{id:'emote-gg',price:0},{id:'emote-sad',price:0},{id:'emote-wellplayed',price:10},{id:'emote-laugh',price:15},{id:'emote-think',price:15},{id:'emote-cool',price:20},{id:'emote-clap',price:25},{id:'emote-fire',price:30},{id:'emote-heart',price:30},{id:'emote-cry',price:35},{id:'emote-angry',price:40},{id:'emote-shock',price:45},{id:'emote-easy',price:50},{id:'emote-eyes',price:55},{id:'emote-skull',price:60},{id:'emote-party',price:65},{id:'emote-rocket',price:70},{id:'emote-omg',price:80},{id:'emote-crown',price:100},
  ];

  const colorItems       = ALL_COLORS.map(c  => ({ ...c, type:'color',       name: d.shopCosmeticNames[c.id] }));
  const fontItems        = ALL_FONTS.map(f   => ({ ...f, type:'font',        name: _FONT_DISPLAY_NAMES[f.id] }));
  const bubbleItems      = ALL_BUBBLES.map(b => ({ ...b, type:'bubble',      name: d.shopBubbleNames[b.id] }));
  const bgItems          = ALL_BGS.map(b     => ({ ...b, type:'background',  name: d.shopBgNames[b.id] }));
  const nameEffectItems  = ALL_NAMEEFFECTS.map(x  => ({ ...x, type:'nameeffect',  name: d.shopNameEffectNames[x.id] }));
  const titleItems       = ALL_TITLES.map(x       => ({ ...x, type:'title',       name: x.honorary ? (d.honorTitleNames?.[x.id] || x.id) : d.shopTitleNames[x.id] }));
  const cursorSnakeItems = ALL_CURSORSNAKES.map(x  => ({ ...x, type:'cursorsnake', name: d.shopCursorSnakeNames[x.id] }));
  const snakeSkinItems   = ALL_SNAKESKINS.map(x    => ({ ...x, type:'snakeskin',   name: d.shopSnakeSkinNames[x.id] }));
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
   ...nameEffectItems, ...titleItems, ...cursorSnakeItems, ...snakeSkinItems, ...avatarItems,
   ...p4TokenItems, ...tttItems, ...chessItems,
   ...clickFxItems, ...emojiPackItems, ...victoryBanItems, ...soundPackItems, ...emoteItems,
  ].forEach(it => { allItemsById[it.id] = it; });
  allItemsById['boost_hint_10'] = { id:'boost_hint_10', type:'boost', price:3, name:d.shopBoostHintName };
  allItemsById['boost_hint_20'] = { id:'boost_hint_20', type:'boost', price:5, name:d.shopBoostHintName };
  window._allShopItemsById = allItemsById;
  if (window._renderFlashBanner) window._renderFlashBanner();

  // Seules ces familles restent en vente (le reste des cosmétiques est retiré
  // de la boutique mais conservé dans le casier des joueurs qui les possèdent).
  const KEPT_SHOP_TYPES = new Set(['color', 'font', 'nameeffect', 'title', 'background', 'boost', 'cursorsnake', 'snakeskin']);
  const rotDaily = shopRotation?.daily || [];
  const _pickKept = ids => ids.map(id => allItemsById[id]).filter(it => it && KEPT_SHOP_TYPES.has(it.type));
  // « À la une » : on garde les vedettes du serveur (uniquement des familles
  // encore vendues) puis on complète avec la sélection curatée pour que le rayon
  // ne soit jamais vide (le serveur peut tirer des cosmétiques d'un type retiré).
  let featuredItems = _pickKept(shopRotation?.featured || []);
  _pickKept(_FEATURED_IDS).forEach(it => { if (!featuredItems.some(f => f.id === it.id)) featuredItems.push(it); });
  featuredItems = featuredItems.slice(0, 8);
  // Idem pour le quotidien : on complète avec des vedettes si le tirage est court.
  let dailyItems = _pickKept(rotDaily);
  if (dailyItems.length < 4) _pickKept(_FEATURED_IDS).forEach(it => { if (!dailyItems.some(f => f.id === it.id)) dailyItems.push(it); });
  dailyItems = dailyItems.slice(0, 8);

  // Catalogue pilote par l'admin : retire les articles forces HORS boutique,
  // et fait apparaitre « À la une » ceux forces DANS la boutique (meme si leur
  // famille n'est normalement plus vendue). `until` = compte a rebours de retrait.
  const _ov = window._shopOverrides || {};
  const _ovState = it => { const o = _ov[it.id]; if (!o) return null; return o.inShop && (!o.until || o.until > Date.now()); };
  const _applyOv = arr => { for (let i = arr.length - 1; i >= 0; i--) { if (_ovState(arr[i]) === false) arr.splice(i, 1); } };
  [featuredItems, dailyItems, colorItems, fontItems, bgItems, nameEffectItems, titleItems, cursorSnakeItems, snakeSkinItems].forEach(_applyOv);
  Object.keys(_ov).forEach(oid => {
    const it = allItemsById[oid];
    // Les emotes ne remontent JAMAIS dans la boutique d'objets (rayon dedie dans le profil).
    if (it && it.type !== 'emote' && _ovState(it) === true && !KEPT_SHOP_TYPES.has(it.type) && !featuredItems.some(f => f.id === oid)) featuredItems.push(it);
  });

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
    const _EM = {'emote-hello':'👋','emote-gg':'👍','emote-sad':'😢','emote-wellplayed':'🤝','emote-laugh':'😂','emote-think':'🤔','emote-cool':'🆒','emote-clap':'👏','emote-fire':'🔥','emote-heart':'❤️','emote-cry':'😭','emote-angry':'😤','emote-shock':'🤯','emote-easy':'😎','emote-eyes':'👀','emote-skull':'💀','emote-party':'🥳','emote-rocket':'🚀','emote-omg':'😱','emote-crown':'👑'};
    let previewHtml = '';
    if (type === 'background')     previewHtml = `<div class="shop-bg-preview ${id}"></div>`;
    else if (type === 'bubble')    previewHtml = `<div class="shop-bubble-preview ${id}">Salut ! 👋</div>`;
    else if (type === 'font')      previewHtml = `<span class="shop-fn-font-preview ${_cosmeticClass(equippedCosmetic)} ${id}">${playerPreview}</span>`;
    else if (type === 'color')     previewHtml = `<span class="shop-cosmetic-preview name-${id} ${_fontClass(equippedFont)}">${playerPreview}</span>`;
    else if (type === 'nameeffect') previewHtml = `<span class="shop-nameeffect-preview ${id}">${playerPreview}</span>`;
    else if (type === 'title' && honorary) previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="player-honor-tag">${name || ''}</span></span>`;
    else if (type === 'title')      previewHtml = `<span class="shop-title-preview">${playerPreview} <span class="shop-title-tag">${name || ''}</span></span>`;
    else if (type === 'cursorsnake') previewHtml = `<div class="shop-emoji-preview">🐍</div>`;
    else if (type === 'snakeskin')  previewHtml = `<div class="shop-emoji-preview">${({'snakeskin-gems':'💎','snakeskin-cyber':'⬡','snakeskin-lava':'🔥','snakeskin-galaxy':'⭐','snakeskin-rainbow':'🌈'})[id]||'🐍'}</div>`;
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
      ${(() => { const o = (window._shopOverrides || {})[id]; return (o && o.inShop && o.until && o.until > Date.now()) ? `<div class="shop-tile-timer">⏳ ${d.shopCountdown(o.until - Date.now())}</div>` : ''; })()}
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
      <button class="shop-fn-nav-btn" data-section="nameeffects"><span class="shop-nav-icon">✨</span><span class="shop-nav-label"> ${nav.nameeffects}</span></button>
      <button class="shop-fn-nav-btn" data-section="titles"><span class="shop-nav-icon">🏷️</span><span class="shop-nav-label"> ${nav.titles}</span></button>
      <button class="shop-fn-nav-btn" data-section="bgs"><span class="shop-nav-icon">🖼️</span><span class="shop-nav-label"> ${nav.bgs}</span></button>
      <button class="shop-fn-nav-btn" data-section="cursorsnakes"><span class="shop-nav-icon">🖱️</span><span class="shop-nav-label"> ${nav.cursorsnakes}</span></button>
      <button class="shop-fn-nav-btn" data-section="snakeskins"><span class="shop-nav-icon">🐍</span><span class="shop-nav-label"> ${nav.snakeskins}</span></button>
      <button class="shop-fn-nav-btn" data-section="codes"><span class="shop-nav-icon">🎟️</span><span class="shop-nav-label"> ${nav.codes}</span></button>
    </nav>
    <div class="shop-fn-content">

    <section class="shop-fn-section active" id="shop-sec-featured" data-section-id="featured">
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

    <section class="shop-fn-section" id="shop-sec-fonts" data-section-id="fonts">
      <h3 class="shop-fn-section-title">${d.shopFontsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.fonts}</p>
      <div class="shop-fn-grid">${fontItems.map(it => tileHtml(it)).join('')}</div>
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

    <section class="shop-fn-section" id="shop-sec-snakeskins" data-section-id="snakeskins">
      <h3 class="shop-fn-section-title">${d.shopSnakeSkinsTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopSectionDescs.snakeskins}</p>
      <div class="shop-fn-grid">${snakeSkinItems.map(it => tileHtml(it)).join('')}</div>
    </section>

    <section class="shop-fn-section" id="shop-sec-codes" data-section-id="codes">
      <h3 class="shop-fn-section-title">${d.shopGiftReceiveTitle}</h3>
      <p class="shop-fn-section-desc">${d.shopGiftReceiveDesc}</p>
      <div class="shop-fn-promo">
        <div class="shop-fn-promo-row">
          <input id="shop-gift-input" type="text" maxlength="8" class="shop-fn-promo-input"
            placeholder="${d.shopGiftPlaceholder}" autocomplete="off" autocorrect="off"
            autocapitalize="characters" spellcheck="false">
          <button id="btn-redeem-gift" class="btn btn-secondary">${d.shopGiftReceiveBtn}</button>
        </div>
        <span id="shop-gift-feedback" class="shop-fn-promo-feedback"></span>
      </div>

      <hr class="recovery-sep" />
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
  $('btn-redeem-gift')?.addEventListener('click', () => {
    const code = ($('shop-gift-input').value || '').trim();
    if (!code) return;
    socket.emit('redeem-gift', { code, playerId: getPlayerId(), name: localStorage.getItem('playerName') || '' });
  });
  $('shop-gift-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-redeem-gift').click();
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

  const contentEl = container.querySelector('.shop-fn-content');

  // Vue par onglets : un seul rayon visible à la fois. Cliquer sur une catégorie
  // remplace le contenu (aucun saut de scroll dans une longue liste empilée).
  function _showShopSection(sid) {
    if (!container.querySelector(`[data-section-id="${sid}"]`)) sid = 'featured';
    _shopActiveSection = sid;
    container.querySelectorAll('.shop-fn-section[data-section-id]').forEach(sec => {
      sec.classList.toggle('active', sec.dataset.sectionId === sid);
    });
    container.querySelectorAll('.shop-fn-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === sid);
    });
    if (contentEl) contentEl.scrollTop = 0;
  }
  container.querySelectorAll('.shop-fn-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => _showShopSection(btn.dataset.section));
  });
  // Restaure l'onglet actif après un re-rendu (achat, équipement, etc.).
  _showShopSection(_shopActiveSection);

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
      { const _s = tile.closest('[data-section-id]'); if (_s) _showShopSection(_s.dataset.sectionId); }
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
      { const _s = tiles[0].closest('[data-section-id]'); if (_s) _showShopSection(_s.dataset.sectionId); }
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
      { const _s = tile.closest('[data-section-id]'); if (_s) _showShopSection(_s.dataset.sectionId); }
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

  // Offrir un pack : toujours au prix complet du pack (le destinataire recevra
  // tout son contenu), meme si l'offreur possede deja certains articles.
  const actionHtml = (allOwned
    ? `<button class="btn btn-secondary" disabled>${d.shopBundleAlreadyOwned}</button>`
    : `<button class="btn btn-primary shop-detail-action-btn" data-bundle-id="${bundle.id}" data-action="buy-bundle">${d.shopBundleBuy(adjPrice)}</button>`)
    + `<button class="btn btn-secondary shop-detail-action-btn shop-gift-offer-btn" data-bundle-id="${bundle.id}" data-price="${bundle.bundlePrice}" data-name="${_escHtml(d.shopBundleNames[bundle.id] || bundle.id)}" data-action="gift-bundle">${d.shopGiftBtn(bundle.bundlePrice)}</button>`;

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
  panel.querySelectorAll('[data-action="gift-bundle"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window._openGiftChoice?.({ bundleId: btn.dataset.bundleId }, Number(btn.dataset.price) || 0, btn.dataset.name || '');
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
      'cursorsnake':'🐍','snakeskin':'🐍','chess':'♟️♜','victoryban':'🏆','soundpack':'🎵🔊',
      'p4token':'🔴🟡',
    };
    const _ITEM_EMOJI = {
      'avatar-gamepad':'🎮','avatar-cat':'🐱','avatar-lightning':'⚡','avatar-rocket':'🚀','avatar-robot':'🤖','avatar-skull':'💀','avatar-crown':'👑',
      'ttt-neon':'✖️⭕','ttt-sunmoon':'☀️🌙','ttt-heartstar':'❤️⭐','ttt-catdog':'🐱🐶','ttt-skulllightning':'💀⚡',
      'clickfx-bubbles':'🫧','clickfx-confetti':'🎊','clickfx-neon':'⚡','clickfx-stars':'🌟','clickfx-firework':'🎆',
      'emojipack-animals':'🐾🐶🐱','emojipack-hearts':'💜💙💚','emojipack-party':'🎉🎊🎈','emojipack-gaming':'🎮🕹️👾','emojipack-cosmos':'🌌🪐✨',
      'emote-hello':'👋','emote-gg':'👍','emote-sad':'😢','emote-wellplayed':'🤝','emote-laugh':'😂','emote-think':'🤔','emote-cool':'🆒','emote-clap':'👏','emote-fire':'🔥','emote-heart':'❤️','emote-cry':'😭','emote-angry':'😤','emote-shock':'🤯','emote-easy':'😎','emote-eyes':'👀','emote-skull':'💀','emote-party':'🥳','emote-rocket':'🚀','emote-omg':'😱','emote-crown':'👑',
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
        actionHtml = `<p class="shop-fn-emote-slots">${slotStr}${full ? (fr ? ' · barre pleine' : ' · bar full') : ''}</p>
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

  // Offrir : disponible pour tout cosmétique payant non honorifique (même si on
  // ne le possède pas). L'acheteur paie et reçoit un code cadeau à partager.
  const giftBtn = (!honorary && price > 0)
    ? `<button class="btn btn-secondary shop-detail-action-btn shop-gift-offer-btn" data-id="${id}" data-price="${price}" data-giftname="${_escHtml(name || id)}" data-action="gift">${d.shopGiftBtn(price)}</button>`
    : '';

  panel.innerHTML = `
    <button class="shop-fn-detail-back" id="shop-detail-back">← ${fr ? 'Retour' : 'Back'}</button>
    <div class="shop-fn-detail-preview">${previewHtml}</div>
    <div class="shop-fn-detail-info">
      ${honorary
        ? `<span class="shop-fn-rarity-badge shop-fn-rarity-badge-honorary">${d.shopHonoraryBadge || '🏆'}</span>`
        : `<span class="shop-fn-rarity-badge ${rarity}">${rarityLabel[rarity]}</span>`}
      <h3 class="shop-fn-detail-name">${name || id}</h3>
      ${honorary ? '' : `<div class="shop-fn-detail-price">${priceStr}</div>`}
      <div class="shop-fn-detail-action">${actionHtml}${giftBtn}</div>
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
      else if (action === 'gift')    window._openGiftChoice?.({ cosmeticId: bId }, Number(btn.dataset.price) || 0, btn.dataset.giftname || bId);
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
  if (color === '#ef4444') window._sound?.play('error');
  fb.textContent = msg;
  fb.style.color = color || '#fff';
  fb.classList.remove('hidden');
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.classList.add('hidden'); fb.textContent = ''; }, 3500);
}

function _showPromoFeedback(msg, color) {
  const fb = $('shop-promo-feedback');
  if (!fb) return;
  if (color === '#ef4444') window._sound?.play('error');
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
    if (cursorSnake.isInGame()) {
      // Le serpent joue dans le Snake Challenge : on l'indique au lieu de l'état on/off.
      snakeBtn.textContent = d.settingsSnakeInGame;
      snakeBtn.classList.remove('sp-off');
      snakeBtn.classList.add('sp-ingame');
    } else {
      const snakeOff = document.getElementById('btn-snake-toggle')?.classList.contains('off');
      snakeBtn.textContent = snakeOff ? d.settingsSnakeOff : d.settingsSnakeOn;
      snakeBtn.classList.toggle('sp-off', !!snakeOff);
      snakeBtn.classList.remove('sp-ingame');
    }
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
    bgmBtn.textContent = musicEnabled ? d.settingsBgmOn : d.settingsBgmOff;
    bgmBtn.classList.toggle('sp-off', !musicEnabled);
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
  window._sound?.play('pop');
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
  // Les réglages s'ouvrent depuis la carte du Profil (le bouton ⚙️ flottant
  // en haut à droite a été retiré de l'interface).
  document.getElementById('go-settings')?.addEventListener('click', e => {
    e.stopPropagation();
    _openSettingsPanel();
  });

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
    window._sound?.play('click'); // aperçu du volume
  });
  document.getElementById('sp-bgm-btn')?.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    try { localStorage.setItem('libero_music', musicEnabled ? '1' : '0'); } catch {}
    if (musicEnabled) window._sound?.music.start(); else window._sound?.music.stop();
    _updateSettingsPanel();
  });
  document.getElementById('sp-bgm-vol')?.addEventListener('input', e => {
    bgmVolume = parseInt(e.target.value, 10) / 100;
    try { localStorage.setItem('bgmVolume', String(bgmVolume)); } catch {}
    window._sound?.music.setVolume(bgmVolume);
  });
});

// ── Sons d'interface (fichiers) : delegation unique sur tout le document ──────
// On classe le clic (retour/refus -> click-back ; valider/accepter/equiper ->
// click-ok ; le reste des boutons/onglets/cartes -> click) pour ne pas empiler
// un listener par element. La lecture est un no-op si l'audio est indispo.
const _SND_BACK_RE = /(close|cancel|annul|refus|decline|back|retour|quit|fermer|leave|×|✕)/i;
const _SND_OK_RE   = /(equip|équip|accept|confirm|valid|buy|acheter|redeem|échang|echang|ok\b|✓|start|démarr|demarr|create|creer|créer|send|envoy|publier|offrir|reclam|réclam)/i;
function _classifyClick(el) {
  const id = (el.id || '') + ' ' + (el.className || '') + ' ' + (el.dataset ? JSON.stringify(el.dataset) : '');
  const txt = (el.textContent || '').slice(0, 40);
  const hay = id + ' ' + txt;
  if (_SND_BACK_RE.test(hay) || el.classList.contains('help-close-btn') || el.classList.contains('modal-x')) return 'click-back';
  if (_SND_OK_RE.test(hay) || el.classList.contains('btn-primary')) return 'click-ok';
  return 'click';
}
document.addEventListener('click', e => {
  try {
    if (!e.isTrusted) return; // ignore les .click() programmatiques
    const el = e.target.closest('button, .nav-tab, .landing-card, .profile-nav-card, .stake-btn, .idea-vote, .shop-tile');
    if (!el) return;
    window._sound?.play(_classifyClick(el));
  } catch {}
}, true);

$('libs-counter').addEventListener('click', openShop);
$('btn-shop-close').addEventListener('click', () => {
  $('overlay-shop').classList.add('hidden');
  document.body.classList.remove('shop-open');
  sessionStorage.removeItem('shopState');
  const dp = $('shop-detail-panel');
  if (dp) dp.classList.add('hidden');
  const tp = $('libs-topup-panel');
  if (tp) tp.classList.add('hidden');
  const bp = $('libs-buy-panel');
  if (bp) bp.classList.add('hidden');
  _pendingLibsPack     = null;
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

// Aperçu visuel d'un cosmétique (réutilise les classes de la boutique), pour le
// casier. `type` = famille du cosmétique, `id` = son identifiant.
const _LOCKER_EMOJI = {
  avatar:{'avatar-gamepad':'🎮','avatar-cat':'🐱','avatar-lightning':'⚡','avatar-rocket':'🚀','avatar-robot':'🤖','avatar-skull':'💀','avatar-crown':'👑'},
  ttt:{'ttt-neon':'✖️⭕','ttt-sunmoon':'☀️🌙','ttt-heartstar':'❤️⭐','ttt-catdog':'🐱🐶','ttt-skulllightning':'💀⚡'},
  clickfx:{'clickfx-bubbles':'🫧','clickfx-confetti':'🎊','clickfx-neon':'⚡','clickfx-stars':'🌟','clickfx-firework':'🎆'},
  emojipack:{'emojipack-animals':'🐾','emojipack-hearts':'💜','emojipack-party':'🎉','emojipack-gaming':'🎮','emojipack-cosmos':'🌌'},
  emote:{'emote-hello':'👋','emote-gg':'👍','emote-sad':'😢','emote-wellplayed':'🤝','emote-laugh':'😂','emote-think':'🤔','emote-cool':'🆒','emote-clap':'👏','emote-fire':'🔥','emote-heart':'❤️','emote-cry':'😭','emote-angry':'😤','emote-shock':'🤯','emote-easy':'😎','emote-eyes':'👀','emote-skull':'💀','emote-party':'🥳','emote-rocket':'🚀','emote-omg':'😱','emote-crown':'👑'},
};
function _cosmeticPreviewHtml(type, id, itemName) {
  const nm = _escHtml(localStorage.getItem('playerName') || 'Aa');
  switch (type) {
    case 'background':  return `<div class="shop-bg-preview ${id}"></div>`;
    case 'bubble':      return `<div class="shop-bubble-preview ${id}">👋</div>`;
    case 'font':        return `<span class="shop-fn-font-preview ${_cosmeticClass(equippedCosmetic)} ${id}">${nm}</span>`;
    case 'color':       return `<span class="shop-cosmetic-preview name-${id} ${_fontClass(equippedFont)}">${nm}</span>`;
    case 'nameeffect':  return `<span class="shop-nameeffect-preview ${id}">${nm}</span>`;
    case 'title':       return `<span class="shop-title-tag">${_escHtml(itemName || '')}</span>`;
    case 'cursorsnake': return `<div class="shop-emoji-preview">🐍</div>`;
    case 'snakeskin':   return `<div class="shop-emoji-preview">${({'snakeskin-gems':'💎','snakeskin-cyber':'⬡','snakeskin-lava':'🔥','snakeskin-galaxy':'⭐','snakeskin-rainbow':'🌈'})[id] || '🐍'}</div>`;
    case 'avatar':      return `<div class="shop-emoji-preview">${_LOCKER_EMOJI.avatar[id] || '🎭'}</div>`;
    case 'p4token':     return `<div class="shop-emoji-preview">🔴🟡</div>`;
    case 'ttt':         return `<div class="shop-emoji-preview">${_LOCKER_EMOJI.ttt[id] || '✖️⭕'}</div>`;
    case 'chess':       return `<div class="shop-emoji-preview">♟️♜</div>`;
    case 'clickfx':     return `<div class="shop-emoji-preview">${_LOCKER_EMOJI.clickfx[id] || '✨'}</div>`;
    case 'emojipack':   return `<div class="shop-emoji-preview">${_LOCKER_EMOJI.emojipack[id] || '🎉'}</div>`;
    case 'victoryban':  return `<div class="shop-emoji-preview">🏆</div>`;
    case 'soundpack':   return `<div class="shop-emoji-preview">🎵</div>`;
    case 'emote':       return `<div class="shop-emoji-preview">${_LOCKER_EMOJI.emote[id] || '😊'}</div>`;
    default: return '';
  }
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
// Le bouton d'indice n'a de sens que pendant qu'on répond à une question :
// écran quiz actif, quiz non terminé, et question pas encore répondue.
function _triviaQuestionActive() {
  const scr = document.getElementById('screen-trivia-game');
  if (!scr || !scr.classList.contains('active')) return false;
  const fin = document.getElementById('tg-finished');
  if (fin && !fin.classList.contains('hidden')) return false; // quiz terminé
  if (triviaAnsweredThis) return false;                        // déjà répondu
  return true;
}

function _updateBoostHintBtn() {
  const btn = $('btn-boost-hint');
  if (!btn) return;
  btn.textContent = `${t().boostHintBtn} (${pendingHintCharges})`;
  // Caché s'il n'y a plus d'indices OU si aucune question n'est en cours
  // (notamment sur l'écran de fin de quiz : plus d'indice défalquable).
  if (pendingHintCharges > 0 && _triviaQuestionActive()) {
    btn.classList.remove('hidden');
    btn.disabled = hintsUsedThisQ >= 2;
  } else {
    btn.classList.add('hidden');
  }
}

$('btn-boost-hint').addEventListener('click', () => {
  if (pendingHintCharges <= 0 || hintsUsedThisQ >= 2 || !_triviaQuestionActive()) return;
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
  let _gameActive = false; // true quand le serpent "joue" dans le Snake Challenge
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
    // Style d'un segment pour le rendu canvas du jeu Snake : reprend le skin de
    // curseur équipé (le même serpent que celui qui suit la souris), sinon la
    // couleur de rang. p = 0 (tête) → 1 (queue).
    gameStyle(p) {
      const skin = CURSOR_SNAKE_SKINS[equippedCursorSnake];
      if (skin) {
        const s = skin(p);
        const glow = (s.shadow && (s.shadow.match(/#[0-9a-fA-F]{3,8}|hsl\([^)]*\)/) || [])[0]) || s.bg;
        return { fill: s.bg, glow };
      }
      const l = Math.round(58 - p * 22), sat = Math.round(80 - p * 20), a = (1 - p * 0.6).toFixed(2);
      return { fill: `hsla(${curHue},${sat}%,${l}%,${a})`, glow: `hsl(${curHue},80%,65%)` };
    },
    // Le serpent est « en Game » : il joue dans le Snake Challenge.
    enterGame() { _gameActive = true; },
    leaveGame() { _gameActive = false; },
    isInGame()  { return _gameActive; },
  };
})();

document.getElementById('btn-snake-toggle').addEventListener('click', () => {
  // Le serpent est en pleine partie de Snake : on ne peut pas le « rappeler »
  // pour suivre le curseur, il est occupé à jouer.
  if (cursorSnake.isInGame()) {
    showCursorSnakeToast(t().snakeBusyInGame);
    return;
  }
  cursorSnake.toggle();
});

// Petit toast flottant pour signaler que le serpent est « en Game ».
let _cursorToastTimer = null;
function showCursorSnakeToast(msg) {
  let el = document.getElementById('cursor-snake-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cursor-snake-toast';
    el.className = 'cursor-snake-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_cursorToastTimer);
  _cursorToastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

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
    // Évent : déclare la partie au serveur, qui créditera chaque ⚡ mangé en Libs.
    socket.emit('snake-game-start', { playerId: getPlayerId() });
    cursorSnake.enterGame(); // le serpent est désormais « en Game »
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
      // Chaque ⚡ mangé est crédité en direct (le serveur vérifie la plausibilité).
      socket.emit('snake-eat', { playerId: getPlayerId() });
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
    const foodEmoji = skin ? skin.food : '⚡'; // évent : le serpent mange des Libs
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
        // Pas de skin Snake dédié : on rend le serpent avec le skin de curseur
        // équipé (le même serpent que celui qui suit la souris), sinon la couleur de rang.
        const gs = cursorSnake.gameStyle(p);
        ctx.fillStyle = gs.fill;
        if (i === 0) { ctx.shadowColor = gs.glow; ctx.shadowBlur = 7; }
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
    socket.emit('solo-game-over', { playerId: getPlayerId(), game: 'snake', score });
    const newHsEl = document.getElementById('snake-new-hs');
    if (newHsEl) newHsEl.classList.toggle('hidden', !isNewHs);
    document.getElementById('snake-over-score').textContent = t().snakeOverScore(score, getHs()) +
      (score > 0 ? ` · ${t().snakeLibsEarned(score)}` : '');
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
    cursorSnake.leaveGame();
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
      // L'animation du curseur-serpent qui vole vers le canvas est purement
      // décorative : elle ne doit plus bloquer le lancement de la partie.
      cursorSnake.flyTo(cx, cy, () => cursorSnake.hide());
      startGame();
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
    cursorSnake.leaveGame();
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
    cursorSnake.leaveGame();
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
    cursorSnake.leaveGame();
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
      // Redéclare la partie au serveur (le crédit des ⚡ repart de zéro, les
      // Libs déjà mangés avant le refresh ont déjà été crédités en direct).
      socket.emit('snake-game-start', { playerId: getPlayerId() });
      document.getElementById('snake-score-val').textContent = score;
      document.getElementById('snake-hs-val').textContent    = getHs();
      document.getElementById('event-intro').classList.add('hidden');
      document.getElementById('snake-lb-card').classList.add('hidden');
      document.getElementById('snake-over-overlay').classList.add('hidden');
      document.getElementById('snake-game-wrap').classList.remove('hidden');
      document.getElementById('snake-pause-overlay').classList.remove('hidden');
      document.getElementById('btn-snake-pause').textContent = '▶';
      cursorSnake.enterGame();
      cursorSnake.hide();
      draw();
    } catch {
      clearSnakeSession();
    }
  })();
})();

// ── Libero Run (jeu communautaire) ────────────────────────────────────────
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

  // ── Sprites d'obstacles (pixel art génériques : tonneaux, rochers, animaux…) ─
  // Le héros, lui, est dessiné au canvas (mascotte originale « Libero »).
  const SPRITE_DIR = 'runner-sprites/';
  function loadSprite(name) { const img = new Image(); img.src = SPRITE_DIR + name; return img; }
  const SPR = {
    canon:        loadSprite('canon.png'),
    boulet:       loadSprite('boulet-canon.png'),
    rocher:       loadSprite('rocher.png'),
    recif:        loadSprite('recif.png'),
    crabe:        loadSprite('crabe.png'),
    meduse:       loadSprite('meduse.png'),
    dendenmushi:  loadSprite('dendenmushi.png'),
    tonneau:      loadSprite('tonneau.png'),
    dirigeable:   loadSprite('dirigeable.png'),
    mouette:      loadSprite('mouette.png'),
    oiseau:       loadSprite('oiseau.png'),
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
  ];
  const FLY_OBS = [
    { id: 'mouette',      w: 34, h: 16, draw: (c, x, y, w, h) => drawSprite(c, SPR.mouette, x, y, w, h, true) },
    { id: 'oiseau',       w: 26, h: 20, draw: (c, x, y, w, h) => drawSprite(c, SPR.oiseau, x, y, w, h, true) },
    { id: 'boulet',       w: 22, h: 21, draw: (c, x, y, w, h) => drawSprite(c, SPR.boulet, x, y, w, h, false) },
  ];
  // Bonus d'invincibilité : une étoile brillante dessinée au canvas (pas de
  // sprite), bien plus visible que l'ancien tonneau, avec halo pulsé et rayons.
  function drawStarShape(c, cx, cy, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      c[i === 0 ? 'moveTo' : 'lineTo'](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    c.closePath();
  }
  const POWERUP_DEF = { id: 'tonneauP', w: 28, h: 30, draw: (c, x, y, w, h) => {
    const now = performance.now();
    const cx = x + w / 2, cy = y + h / 2;
    const pulse = 0.85 + 0.15 * Math.sin(now / 120); // scintillement
    c.save();
    // Rayons tournants derrière l'étoile
    c.translate(cx, cy);
    c.rotate(now / 900);
    c.strokeStyle = 'rgba(255,225,90,.55)';
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 4);
      c.beginPath(); c.moveTo(0, -h * 0.75 * pulse); c.lineTo(0, -h * 0.45); c.stroke();
    }
    c.restore();
    // Étoile dorée avec halo lumineux
    c.save();
    c.shadowColor = '#ffe14d';
    c.shadowBlur = 16 * pulse;
    drawStarShape(c, cx, cy, (w / 2) * pulse);
    const g = c.createRadialGradient(cx, cy - 3, 1, cx, cy, w / 2);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.55, '#ffd93b'); g.addColorStop(1, '#f5a623');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#b8860b'; c.lineWidth = 1; c.stroke();
    c.restore();
  } };
  const ALL_DEFS = {};
  [...GROUND_OBS, ...FLY_OBS, POWERUP_DEF].forEach(d => { ALL_DEFS[d.id] = d; });
  const FLY_TOP = GROUND_Y - 60, FLY_H = 22; // bande basse : oblige à s'accroupir
  const INVINCIBILITY_MS = 6000;

  // ── Thèmes de map (jour / nuit / saisons) ───────────────────────────────────
  // La map change de thème tous les THEME_SCORE_STEP points, en boucle.
  const THEME_SCORE_STEP = 1000;
  const THEMES = [
    { id: 'day',    skyTop: '#7ec8e3', skyBot: '#bfe8f0', ground: '#1a2a1a', groundLine: 'rgba(255,255,255,.18)', particle: 'cloud' },
    { id: 'night',  skyTop: '#0c1330', skyBot: '#1e2a55', ground: '#0d1410', groundLine: 'rgba(255,255,255,.10)', particle: 'star',
      overlay: 'rgba(20,30,70,.35)' },
    { id: 'autumn', skyTop: '#d9874a', skyBot: '#f3c98b', ground: '#3a2415', groundLine: 'rgba(255,255,255,.14)', particle: 'leaf',
      overlay: 'rgba(220,140,60,.12)' },
    { id: 'winter', skyTop: '#9fb8c8', skyBot: '#eef3f6', ground: '#cfd8de', groundLine: 'rgba(70,80,95,.25)', particle: 'snow',
      overlay: 'rgba(210,225,235,.18)' },
  ];
  function currentTheme() { return THEMES[Math.floor(score / THEME_SCORE_STEP) % THEMES.length]; }

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
    // Sur mobile, on grignote moins de marge pour une map aussi grande que possible.
    const margin  = window.innerWidth < 600 ? 8 : 32;
    const maxW = Math.min(REF_W, window.innerWidth - margin);
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
      if (luffyY <= 0) {
        luffyY = 0; luffyVy = 0; jumping = false;
        // Touche encore tenue à l'atterrissage : on l'applique, la pression
        // la plus récente d'abord (maintenir Saut = rebonds enchaînés).
        if (duckHeld && (lastHeld === 'duck' || !jumpHeld)) ducking = true;
        else if (jumpHeld) { jumping = true; luffyVy = JUMP_VEL; }
      }
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

  function drawGround(c, theme) {
    c.fillStyle = theme.ground;
    c.fillRect(0, GROUND_Y, REF_W, REF_H - GROUND_Y);
    c.strokeStyle = theme.groundLine;
    c.lineWidth = 2;
    const tickOffset = -(distance % 24);
    for (let x = tickOffset; x < REF_W; x += 24) {
      c.beginPath(); c.moveTo(x, GROUND_Y + 1); c.lineTo(x + 12, GROUND_Y + 1); c.stroke();
    }
  }

  function drawAmbience(c, theme, now) {
    if (theme.particle === 'cloud') {
      c.fillStyle = 'rgba(255,255,255,.55)';
      const cloudOffset = -(distance * 0.25 % 260);
      for (let i = 0; i < 3; i++) {
        const cx = cloudOffset + i * 220 + 40;
        const cy = 36 + (i % 2) * 18;
        [0, 16, 32].forEach((dx, j) => {
          c.beginPath(); c.arc(cx + dx, cy - (j === 1 ? 6 : 0), 13, 0, Math.PI * 2); c.fill();
        });
      }
    } else if (theme.particle === 'star') {
      c.fillStyle = '#f4f1de';
      c.beginPath(); c.arc(REF_W - 60, 38, 15, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 16; i++) {
        const sx = (i * 53 + 17) % REF_W;
        const sy = (i * 31 + 5) % (GROUND_Y - 30) + 6;
        const tw = 0.35 + 0.55 * Math.abs(Math.sin(now / 500 + i));
        c.fillStyle = `rgba(255,255,255,${tw.toFixed(2)})`;
        c.fillRect(sx, sy, 2, 2);
      }
    } else if (theme.particle === 'leaf' || theme.particle === 'snow') {
      const isLeaf = theme.particle === 'leaf';
      const count = isLeaf ? 16 : 26;
      const fallSpeed = isLeaf ? 30 : 50;
      for (let i = 0; i < count; i++) {
        const seed = i * 137.5;
        const px = ((seed * 5 + distance * 0.3 + now * 0.012) % (REF_W + 30)) - 15 + Math.sin(now / 650 + i) * (isLeaf ? 12 : 6);
        const py = ((seed * 2.3 + now * fallSpeed / 1000) % (GROUND_Y + 10)) - 5;
        if (isLeaf) {
          c.save();
          c.translate(px, py);
          c.rotate(now / 800 + i);
          c.fillStyle = i % 2 === 0 ? '#c9692f' : '#d9a13b';
          c.fillRect(-3, -2, 6, 4);
          c.restore();
        } else {
          c.fillStyle = 'rgba(255,255,255,.9)';
          c.beginPath(); c.arc(px, py, 1.8, 0, Math.PI * 2); c.fill();
        }
      }
    }
  }

  function applyThemeOverlay(c, theme) {
    if (!theme.overlay) return;
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = theme.overlay;
    c.fillRect(0, 0, REF_W, REF_H);
    c.restore();
  }

  // ── Mascotte « Libero » : personnage 100 % original dessiné au canvas ────────
  // Aucun sprite importé : c'est une création propre au site (violet + or), ce
  // qui évite toute image sous droits d'auteur.
  const HERO = {
    cloak:   '#7c5cff', // violet, accent du site
    cloakLo: '#5a3fd6', // jambe arrière (ombre)
    scarf:   '#ffd23f', // écharpe / bandeau dorés
    skin:    '#f1c9a0',
    boots:   '#241b40',
    eye:     '#241b40',
  };
  function _limb(c, x1, y1, x2, y2, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  function drawLuffy(c, now) {
    const lb = luffyBox();
    const cx = lb.x + lb.w / 2;
    c.save();
    c.lineJoin = 'round';
    if (now < invincibleUntil) { // aura dorée pendant l'invincibilité
      c.globalAlpha = 0.6 + 0.4 * Math.sin(now / 60);
      c.shadowColor = '#ffd23f';
      c.shadowBlur = 14;
    }
    if (ducking) drawHeroDuck(c, cx, lb, now);
    else drawHeroStand(c, cx, lb, now);
    c.restore();
  }

  // Écharpe dorée qui flotte derrière le héros (donne le sens de la course).
  function _scarf(c, ax, ay, now, len) {
    const flap = Math.sin(now / 90) * 4;
    c.fillStyle = HERO.scarf;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo(ax - len * 0.6, ay - 3 + flap, ax - len, ay + 6 - flap);
    c.quadraticCurveTo(ax - len * 0.6, ay + 8, ax, ay + 7);
    c.closePath(); c.fill();
  }

  function drawHeroStand(c, cx, lb, now) {
    const footY = lb.bottom;
    const H     = lb.bottom - lb.top;      // 62 debout
    const hipY  = lb.top + H * 0.60;
    const shY   = lb.top + H * 0.32;       // épaules
    const headR = H * 0.15;
    const headX = cx + 2, headY = lb.top + headR + 1;
    const phase = distance / 13;
    const sw    = jumping ? 0.5 : Math.sin(phase);

    _scarf(c, cx - 5, shY + 2, now, 26);

    // Jambes (l'arrière plus sombre), repliées au saut, alternées à la course.
    if (jumping) {
      _limb(c, cx, hipY, cx - 7, footY - 8, 7, HERO.cloakLo);
      _limb(c, cx, hipY, cx + 9, footY - 12, 7, HERO.boots);
    } else {
      _limb(c, cx, hipY, cx + sw * 12,  footY, 7, HERO.cloakLo);
      _limb(c, cx, hipY, cx - sw * 12,  footY, 7, HERO.boots);
    }

    // Tronc (tunique violette)
    c.fillStyle = HERO.cloak;
    c.beginPath();
    c.moveTo(cx - 9, shY);
    c.lineTo(cx + 9, shY);
    c.lineTo(cx + 7, hipY + 2);
    c.lineTo(cx - 7, hipY + 2);
    c.closePath(); c.fill();

    // Petit emblème étoile doré sur la poitrine (clin d'œil au bonus étoile)
    c.fillStyle = HERO.scarf;
    c.beginPath(); c.arc(cx, shY + (hipY - shY) * 0.45, 2.4, 0, Math.PI * 2); c.fill();

    // Bras avant qui balance (opposé aux jambes)
    const aSw = jumping ? -0.9 : Math.sin(phase + Math.PI);
    _limb(c, cx + 3, shY + 3, cx + 3 + aSw * 10, shY + 15, 5, HERO.cloak);

    // Tête
    c.fillStyle = HERO.skin;
    c.beginPath(); c.arc(headX, headY, headR, 0, Math.PI * 2); c.fill();
    // Capuche / cheveux violets balayés en arrière
    c.fillStyle = HERO.cloak;
    c.beginPath();
    c.arc(headX, headY, headR, Math.PI * 0.85, Math.PI * 2.15);
    c.lineTo(headX - headR - 4, headY - 3);
    c.closePath(); c.fill();
    // Bandeau doré
    _limb(c, headX - headR, headY - 1, headX + headR, headY - 2, 2.4, HERO.scarf);
    // Œil
    c.fillStyle = HERO.eye;
    c.beginPath(); c.arc(headX + headR * 0.55, headY + 1, 1.5, 0, Math.PI * 2); c.fill();
  }

  function drawHeroDuck(c, cx, lb, now) {
    const H     = lb.bottom - lb.top;      // 32 accroupi
    const footY = lb.bottom;
    const bodyY = lb.top + H * 0.45;
    const phase = distance / 13;
    const sw    = Math.sin(phase) * 8;

    _scarf(c, cx - 12, bodyY - 2, now, 22);
    // Jambes repliées sous le corps (glissade)
    _limb(c, cx, bodyY + 5, cx - 12 + sw, footY, 7, HERO.cloakLo);
    _limb(c, cx, bodyY + 5, cx + 12 - sw, footY, 7, HERO.boots);
    // Corps ramassé
    c.fillStyle = HERO.cloak;
    c.beginPath(); c.ellipse(cx, bodyY + 2, 16, 9, 0, 0, Math.PI * 2); c.fill();
    // Tête projetée vers l'avant (sens de la course)
    const headX = cx + 15, headR = H * 0.28;
    c.fillStyle = HERO.skin;
    c.beginPath(); c.arc(headX, bodyY, headR, 0, Math.PI * 2); c.fill();
    c.fillStyle = HERO.cloak; // capuche
    c.beginPath(); c.arc(headX, bodyY, headR, Math.PI * 1.1, Math.PI * 2.2); c.closePath(); c.fill();
    _limb(c, headX - headR, bodyY - 1, headX + headR, bodyY - 1, 2.2, HERO.scarf);
    c.fillStyle = HERO.eye;
    c.beginPath(); c.arc(headX + headR * 0.5, bodyY + 1, 1.4, 0, Math.PI * 2); c.fill();
  }

  function draw(now) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const theme = currentTheme();

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, theme.skyTop); sky.addColorStop(1, theme.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, REF_W, GROUND_Y);

    drawAmbience(ctx, theme, now);
    drawSprite(ctx, SPR.dirigeable, airshipX, airshipY, 70, 65, true); // décor de fond
    drawGround(ctx, theme);
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

    applyThemeOverlay(ctx, theme);

    if (now < invincibleUntil) {
      // Compte à rebours d'invincibilité : secondes restantes + barre qui se
      // vide, et clignotement sur la dernière seconde et demie pour prévenir.
      const leftMs  = invincibleUntil - now;
      const leftSec = (leftMs / 1000).toFixed(1);
      const frac    = Math.max(0, Math.min(1, leftMs / INVINCIBILITY_MS));
      const blink   = leftMs < 1500 && Math.floor(now / 150) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = blink ? 0.35 : 1;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(`⭐ INVINCIBLE · ${leftSec}s`, REF_W / 2, 18);
      const barW = 110, barH = 5, bx = REF_W / 2 - barW / 2, by = 24;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = leftMs < 1500 ? '#ff8c42' : '#ffd23f';
      ctx.fillRect(bx, by, barW * frac, barH);
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
    socket.emit('solo-game-over', { playerId: getPlayerId(), game: 'luffy', score });
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
  // Sur mobile on peut maintenir les deux boutons à la fois : on mémorise donc
  // l'état « tenu » de chaque touche et on le réapplique à l'atterrissage, la
  // pression la plus récente ayant priorité. (Avant : le saut était bloqué
  // pendant l'accroupissement et inversement, donc maintenir les deux rendait
  // personnage inerte face aux obstacles → défaite immédiate.)
  let jumpHeld = false, duckHeld = false, lastHeld = null; // 'jump' | 'duck'

  function doJump() {
    if (!running || paused || jumping) return;
    ducking = false; // une pression fraîche sur Saut annule l'accroupissement
    jumping = true; luffyVy = JUMP_VEL;
  }
  function setDuck(v) {
    if (!running || paused || jumping) return; // en l'air : réappliqué à l'atterrissage via duckHeld
    ducking = v;
  }
  function pressJump()   { jumpHeld = true;  lastHeld = 'jump'; doJump(); }
  function releaseJump() { jumpHeld = false; if (duckHeld) lastHeld = 'duck'; }
  function pressDuck()   { duckHeld = true;  lastHeld = 'duck'; setDuck(true); }
  function releaseDuck() { duckHeld = false; setDuck(false); if (jumpHeld) lastHeld = 'jump'; }

  document.addEventListener('keydown', e => {
    if (!running || paused) return;
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (!e.repeat) pressJump(); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); if (!e.repeat) pressDuck(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') releaseJump();
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') releaseDuck();
  });

  const _jumpBtn = document.getElementById('luffy-btn-jump');
  const _duckBtn = document.getElementById('luffy-btn-duck');
  _jumpBtn?.addEventListener('touchstart',  e => { e.preventDefault(); pressJump(); }, { passive: false });
  _jumpBtn?.addEventListener('touchend',    e => { e.preventDefault(); releaseJump(); }, { passive: false });
  _jumpBtn?.addEventListener('touchcancel', () => releaseJump());
  _jumpBtn?.addEventListener('mousedown',   pressJump);
  _jumpBtn?.addEventListener('mouseup',     releaseJump);
  _jumpBtn?.addEventListener('mouseleave',  releaseJump);
  _duckBtn?.addEventListener('touchstart',  e => { e.preventDefault(); pressDuck(); }, { passive: false });
  _duckBtn?.addEventListener('touchend',    e => { e.preventDefault(); releaseDuck(); }, { passive: false });
  _duckBtn?.addEventListener('touchcancel', () => releaseDuck());
  _duckBtn?.addEventListener('mousedown',   pressDuck);
  _duckBtn?.addEventListener('mouseup',     releaseDuck);
  _duckBtn?.addEventListener('mouseleave',  releaseDuck);

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

// ── Pluie d'émojis ────────────────────────────────────────────────────────────
// Jeu d'émojis choisi par le joueur (Profil → Pluie d'émojis) : standard,
// pack équipé, ou liste personnalisée tapée par le joueur (stockée en local).
const EMOJI_PACK_SETS = {
  'emojipack-animals': ['🐶','🐱','🐻','🦊','🐼','🐨','🐯','🦁','🐮','🐸','🐧','🦋','🦄','🐙','🦀'],
  'emojipack-hearts':  ['💜','💙','💚','💛','🧡','❤️','🩷','🤍','🩵','💗','💖','💝','💘','💞','💓'],
  'emojipack-party':   ['🎉','🎊','🎈','🎆','🎇','🥳','🎂','🎁','🪅','🎀','🥂','✨','🎠','🎪','🎭'],
  'emojipack-gaming':  ['🎮','🕹️','👾','🎯','🏆','🎲','🃏','🎰','👑','⚔️','🛡️','🗡️','🧩','🕳️','💣'],
  'emojipack-cosmos':  ['🌌','🪐','✨','⭐','🌟','💫','☄️','🌙','🌠','🔭','🛸','🚀','🌍','🌌','💥'],
};
const EMOJI_STANDARD = ['🔴','🟡','♟','♔','♚','♛','♜','♝','♞','❌','⭕','🧠','❓','💡','🎮','🎯','🏆','🎲'];

// Découpe une chaîne d'émojis collés en liste (gère les émojis composés).
function _parseCustomEmojis(str) {
  const raw = String(str || '').replace(/[\s,;]+/g, '');
  let parts;
  try { parts = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(raw)].map(x => x.segment); }
  catch { parts = [...raw]; }
  return parts.filter(Boolean).slice(0, 15);
}

function _currentEmojiSet() {
  const mode = localStorage.getItem('libero_emojirain_mode') || '';
  if (mode === 'custom') {
    const custom = _parseCustomEmojis(localStorage.getItem('libero_custom_emojis'));
    if (custom.length) return custom;
  }
  const pack = localStorage.getItem('libero_equipped_emojipack') || '';
  return EMOJI_PACK_SETS[pack] || EMOJI_STANDARD;
}

// Joue la pluie (au chargement de l'accueil, et via « Tester » dans le menu).
window._playEmojiRain = function () {
  const EMOJIS = _currentEmojiSet();
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
};

// Au chargement : uniquement sur l'accueil.
(() => {
  const _sc = sessionStorage.getItem('libero_screen');
  if (_sc && _sc !== 'landing') return;
  window._playEmojiRain();
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
        sendBtn.textContent = t().btnSend;
        feedback.className = 'comment-feedback hidden';
        localStorage.removeItem(LS_BLOCK);
        return;
      }
      const mins = Math.ceil(left / 60_000);
      const str  = mins <= 1 ? t().commentLessMin : `${mins} min`;
      feedback.textContent = t().commentCooldown(str);
      feedback.className = 'comment-feedback err';
      sendBtn.disabled = true;
      sendBtn.textContent = t().commentWaitBtn;
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
      sendBtn.textContent = t().btnSend;
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
        feedback.textContent = currentLang === 'en'
          ? '✅ Message sent! It will appear after review. Thanks!'
          : '✅ Message envoyé ! Il apparaîtra après validation. Merci !';
        feedback.className = 'comment-feedback ok';
        form.reset();
        charsEl.textContent = '0 / 1000';
        setTimeout(closeModal, 2200);
      } else if (res.status === 429 && data.waitMs) {
        startCooldown(data.waitMs);
      } else {
        feedback.textContent = `❌ ${data.error || t().commentUnknownErr}`;
        feedback.className = 'comment-feedback err';
      }
    } catch {
      feedback.textContent = '❌ Impossible de contacter le serveur.';
      feedback.className = 'comment-feedback err';
    }

    if (!sendBtn.disabled) {
      sendBtn.disabled = false;
      sendBtn.textContent = t().btnSend;
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
      <div class="news-comment-meta"><strong>${_escHtml(c.pseudo)}</strong><span>${_timeAgo(c.date)}</span></div>
      <p class="news-comment-msg">${_escHtml(c.message.slice(0, 140))}</p>
      <button class="news-like-btn${isLiked ? ' liked' : ''}" data-id="${_escHtml(c.id)}">❤️ ${_escHtml(c.likes)}</button>
    </div>`;
  }).join('');
  // Bouton bascule : un clic like, un second clic retire le like.
  container.querySelectorAll('.news-like-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      btn.disabled = true; // le temps de la requête seulement
      // Bascule optimiste : la diffusion socket peut re-rendre la liste avant
      // la réponse du fetch, elle doit déjà refléter le nouvel état local.
      const before  = JSON.parse(localStorage.getItem('libero_liked_comments') || '[]');
      const wasLiked = before.includes(id);
      const optimist = wasLiked ? before.filter(x => x !== id) : [...before, id];
      localStorage.setItem('libero_liked_comments', JSON.stringify(optimist));
      try {
        const r      = await fetch(`${window.BACKEND_URL}/api/comment-like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, playerId: getPlayerId() }),
        });
        const result = await r.json();
        if (result.ok) {
          // Aligne l'état local sur la décision du serveur.
          const arr = JSON.parse(localStorage.getItem('libero_liked_comments') || '[]').filter(x => x !== id);
          if (result.liked) arr.push(id);
          localStorage.setItem('libero_liked_comments', JSON.stringify(arr));
          btn.textContent = `❤️ ${result.likes}`;
          btn.classList.toggle('liked', !!result.liked);
        } else {
          localStorage.setItem('libero_liked_comments', JSON.stringify(before));
        }
      } catch {
        localStorage.setItem('libero_liked_comments', JSON.stringify(before));
      }
      btn.disabled = false;
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
  el.innerHTML = `<span class="news-star-badge">🏆 Commentaire du jour</span><strong>${_escHtml(pseudo)}</strong> : "${_escHtml(message.slice(0, 100))}"<span class="news-star-likes"> · ❤️ ${_escHtml(likes)}</span>`;
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
      text: '👋 Bienvenue sur <strong>Libero\'s Multi</strong> ! L\'accueil propose quatre sections : <strong>Jeux Classiques</strong>, <strong>Culture Générale</strong>, <strong>Évents</strong> (mini-jeux du week-end) et <strong>Pour la communauté</strong> (le mini-jeu <strong>Libero Run</strong>). La barre en bas mène aussi aux <strong>Vidéos</strong>, à la <strong>Lecture</strong> et à ton <strong>Profil</strong>.',
      target: '.landing-grid',
    },
    {
      id: 'landing_lb',
      screen: 'landing',
      text: '🌍 Le <strong>Classement Global</strong> regroupe <em>tous</em> les joueurs ayant au moins un point, quelle que soit la section jouée. Score = victoires classiques ×10 + points Quiz + meilleur score Snake ×10 + meilleur score Libero Run ÷10. Plus tu montes, plus ton serpent 🐍 grandit !',
      target: '.global-lb-card',
    },
    {
      id: 'landing_btns',
      screen: 'landing',
      text: '⚙️ Des boutons permanents sont disponibles :<br>▶ Les <strong>Réglages</strong> (thème, langue, serpent, sons, musique, cartes de remboursement) sont dans l\'onglet <strong>Profil</strong>, carte <strong>⚙️ Réglages</strong>.<br>▶ <strong>En bas à droite</strong> : ❓ <strong>Aide</strong> · ✉️ <strong>Commentaire</strong> · 🤖 <strong>Assistant</strong>',
      target: null,
    },
    {
      id: 'landing_libs',
      screen: 'landing',
      text: '⚡ <strong>Libs</strong> : la monnaie virtuelle du site. Tous les joueurs classés en reçoivent toutes les 5h (1er : +10 ⚡, 2e : +5 ⚡, 3e : +3 ⚡, du 4e au 10e : +2 ⚡, ensuite +1 ⚡). Tu en gagnes aussi avec les <strong>défis du jour</strong> et ta <strong>série de connexion</strong>. Dépense-les dans la <strong>boutique</strong> : cosmétiques, boosts quiz, livres exclusifs !',
      target: '#libs-counter',
    },

    // ── Évents ──
    {
      id: 'events_snake',
      screen: 'events',
      text: '🐍 C\'est l\'évent du week-end : <strong>Snake Challenge</strong> ! Clique <em>Jouer</em>, ton serpent entre dans l\'arène. Mange les ⚡ pour grandir : chaque Lib mangé est ajouté à ton solde ! Les bords sont traversables, tu ressors de l\'autre côté. Ton meilleur score <strong>persiste</strong> entre les sessions.',
      target: '.event-intro',
    },

    // ── Pour la communauté ──
    {
      id: 'luffy_runner',
      screen: 'luffy',
      text: '🏃 <strong>Libero Run</strong> : aide Libero à courir le plus loin possible ! Saute (↑ / Espace) par-dessus les obstacles au sol, accroupis-toi (↓) sous les obstacles volants. Ton meilleur score alimente un classement dédié.',
      target: '#luffy-intro',
    },

    // ── Jeux classiques ──
    {
      id: 'home_games',
      screen: 'home',
      text: '🎮 Choisis ton jeu en haut : <strong>Puissance 4</strong>, <strong>Morpion</strong>, <strong>Échecs</strong>, <strong>Dames</strong> ou <strong>Ludo</strong> 🎲 (aucun n\'est présélectionné). Le classement est partagé entre les cinq jeux.',
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
      text: '📋 <strong>Partage ce code</strong> à 4 lettres avec ton adversaire, ou clique <strong>🔗 Partager le lien</strong> : il rejoindra en un clic. La partie démarre dès qu\'il arrive, et tu peux <strong>Annuler</strong> si personne ne vient.',
      target: '#room-code',
      autoDone: true,
    },

    // ── Lecture ──
    {
      id: 'read_catalogue',
      screen: 'read',
      text: '📚 Bienvenue dans la section <strong>Lecture</strong> ! Cherche un livre par titre ou auteur, filtre par catégorie, et clique sur une couverture pour ouvrir sa fiche. Les <strong>romans exclusifs</strong> se lisent directement ici : <strong>⭐ L\'Affaire endormie · Tome 1</strong> (chapitre 1 gratuit, puis 1000 ⚡ et 2000 ⚡), <strong>Life of Georgia</strong> (2000 ⚡ le livre entier) et <strong>Life of Georgia · Tome 2</strong>, offert à ceux qui possèdent le Tome 1.',
      target: '.read-wrap',
    },

    // ── Profil ──
    {
      id: 'profile_hub',
      screen: 'profile',
      text: '🎯 Ton <strong>Profil</strong> regroupe ta <strong>série de connexion</strong> 🔥, tes <strong>défis du jour</strong> (des ⚡ à réclamer chaque jour), ton <strong>casier</strong> (tes cosmétiques, avec aperçus et équipement), ton <strong>historique</strong> de parties, la carte <strong>Inviter un ami</strong> 🤝 (+100 ⚡ chacun), tes <strong>émotes</strong> 😎, la <strong>pluie d\'émojis</strong> 🌈, les <strong>Réglages</strong> ⚙️, ton <strong>code de récupération</strong> 🔐 (note-le pour ne jamais perdre ton compte !) et la <strong>réinitialisation</strong> du compte.',
      target: '.profile-body',
    },

    // ── Idées ──
    {
      id: 'ideas_board',
      screen: 'ideas',
      text: '💡 La section <strong>Idées</strong> : propose une amélioration du site et vote pour (▲) ou contre (▼) celles des autres joueurs. Les meilleures idées remontent en haut.',
      target: null,
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
      text: '🏆 Le <strong>classement Quiz</strong> est séparé du classement Classique. Les points sont attribués selon ta vitesse de réponse et le nombre de bonnes réponses. <strong>Réponse éclair</strong> (dans les premières secondes) = <strong>point doublé ⚡</strong>.',
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

  // Le didacticiel attend la fin de l'accueil des nouveaux venus : tant que
  // l'animation de bienvenue / l'onboarding n'est pas terminé, aucune bulle.
  const _tutoBlocked = () => window.__liberoNewVisitor && !localStorage.getItem('libero_onboarded');

  // Appelé par showScreen() à chaque changement d'écran
  window._tutoOnScreen = function(screenName) {
    if (_tutoBlocked()) return;
    // Cache la bulle si on change d'écran
    if (current && current.screen !== screenName) {
      clearTimeout(autoTimer);
      hideBubble();
    }
    // Montre la première étape non faite pour ce nouvel écran
    const step = STEPS.find(s => s.screen === screenName && !isDone(s.id));
    if (step) setTimeout(() => showStep(step), 450);
  };

  // Appelé par l'onboarding : « je suis nouveau » -> le guide démarre sur
  // l'écran courant ; restauration d'un compte -> le guide ne se lance jamais.
  window._tutoBegin   = function(screenName) { window._tutoOnScreen(screenName || 'landing'); };
  window._tutoSkipAll = skipAll;

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

// ── Feed Vidéos (façon TikTok) ───────────────────────────────────────────────
const VideoFeed = (() => {
  const container = document.getElementById('feed-container');
  let loaded   = false;
  let observer = null;
  let videos   = [];
  let muted    = true; // l'autoplay n'est autorisé que muet ; tap pour activer le son
  const viewed = new Set(); // vidéos déjà comptées comme vues (une fois par chargement)
  const byId   = new Map(); // id -> objet vidéo (état social à jour)
  let   lastTap = 0;        // horodatage du dernier tap (détection du double-tap)

  // Applique l'état muet à toutes les vidéos + affiche brièvement l'indicateur son.
  function applyMute() {
    container.querySelectorAll('video').forEach(vd => { vd.muted = muted; });
    container.querySelectorAll('.feed-mute-ind').forEach(m => {
      m.textContent = muted ? '🔇' : '🔊';
      m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
    });
  }

  // Cœur qui éclate à l'endroit du double-tap (retiré après l'animation).
  function heartBurst(slide, ev) {
    const h = document.createElement('div');
    h.className = 'feed-heart';
    h.textContent = '❤️';
    const r = slide.getBoundingClientRect();
    h.style.left = ((ev && ev.clientX ? ev.clientX - r.left : r.width / 2)) + 'px';
    h.style.top  = ((ev && ev.clientY ? ev.clientY - r.top  : r.height / 2)) + 'px';
    slide.appendChild(h);
    setTimeout(() => h.remove(), 800);
  }

  const fmt = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(n || 0));
  const api = (path, opts) => fetch(`${window.BACKEND_URL}${path}`, opts);

  function playerName() {
    return (typeof getPlayerName === 'function' && getPlayerName()) || localStorage.getItem('playerName') || 'Anonyme';
  }

  function setStatus(msg, icon = '🚧') {
    if (!container) return;
    container.classList.add('feed-status-mode'); // fond transparent : laisse voir le décor du site
    const lines = String(msg).split('\n').map(l => `<span>${l}</span>`).join('');
    container.innerHTML =
      `<div class="feed-status">
         <span class="feed-status-icon">${icon}</span>
         <p class="feed-status-text">${lines}</p>
         <button id="feed-submit-empty" class="btn btn-primary feed-submit-empty">${t().feedSubmitBtn}</button>
       </div>`;
    const sb = document.getElementById('feed-submit-empty');
    if (sb) sb.onclick = openSubmit;
  }

  async function load(force = false) {
    if (!container) return;
    if (loaded && !force) { playVisible(); return; }
    setStatus(t().feedLoading, '⏳');
    try {
      const res = await api(`/api/feed-videos?playerId=${encodeURIComponent(getPlayerId())}`);
      if (!res.ok) throw new Error('http ' + res.status);
      videos = await res.json();
    } catch {
      setStatus(t().feedError);
      return;
    }
    loaded = true;
    byId.clear();
    (videos || []).forEach(v => byId.set(v.id, v));
    if (!Array.isArray(videos) || videos.length === 0) { setStatus(t().feedEmpty); return; }
    render();
  }

  function render() {
    container.classList.remove('feed-status-mode'); // restaure le fond noir pour les vidéos
    container.innerHTML = '';
    if (observer) observer.disconnect();

    videos.forEach((v, i) => {
      const slide = document.createElement('div');
      slide.className = 'feed-slide';
      slide.dataset.id = v.id;

      const video = document.createElement('video');
      video.className = 'feed-video';
      video.loop = true;
      video.muted = muted;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = i === 0 ? 'auto' : 'none'; // chargement progressif
      video.dataset.src = v.url;
      if (i === 0) video.src = v.url;            // seule la 1re vidéo est préchargée

      // Barre de progression de lecture.
      const prog = document.createElement('div');
      prog.className = 'feed-progress';
      const bar = document.createElement('i');
      prog.appendChild(bar);
      video.addEventListener('timeupdate', () => {
        if (video.duration) bar.style.width = (video.currentTime / video.duration * 100) + '%';
      });

      // Rail d'actions latéral (like / commentaires / partage).
      const rail = document.createElement('div');
      rail.className = 'feed-rail';
      rail.innerHTML =
        `<button class="feed-act feed-like${v.liked ? ' on' : ''}" data-act="like" aria-label="J'aime">
           <span class="feed-act-ico">${v.liked ? '❤️' : '🤍'}</span><span class="feed-act-n">${fmt(v.likeCount)}</span>
         </button>
         <button class="feed-act" data-act="comment" aria-label="Commentaires">
           <span class="feed-act-ico">💬</span><span class="feed-act-n">${fmt(v.commentCount)}</span>
         </button>
         <button class="feed-act" data-act="share" aria-label="Partager">
           <span class="feed-act-ico">🔗</span><span class="feed-act-n">${fmt(v.shares)}</span>
         </button>
         <span class="feed-views">👁 ${fmt(v.views)}</span>`;

      const overlay = document.createElement('div');
      overlay.className = 'feed-overlay';
      if (v.auteur) {
        const au = document.createElement('p');
        au.className = 'feed-overlay-author';
        au.textContent = '@' + v.auteur;
        overlay.appendChild(au);
      }
      if (v.titre) {
        const tl = document.createElement('p');
        tl.className = 'feed-overlay-title';
        tl.textContent = v.titre;
        overlay.appendChild(tl);
      }
      if (v.description) {
        const de = document.createElement('p');
        de.className = 'feed-overlay-desc';
        de.textContent = v.description;
        overlay.appendChild(de);
      }

      // Indicateur son coupé/activé (badge frosté, apparaît au changement).
      const mute = document.createElement('div');
      mute.className = 'feed-mute-ind';
      mute.textContent = muted ? '🔇' : '🔊';

      slide.appendChild(video);
      slide.appendChild(prog);
      slide.appendChild(rail);
      slide.appendChild(overlay);
      slide.appendChild(mute);
      container.appendChild(slide);

      // Actions du rail (ne pas propager au tap son du fond).
      rail.addEventListener('click', ev => {
        const btn = ev.target.closest('.feed-act');
        if (!btn) return;
        ev.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'like')    toggleLike(v, btn);
        if (act === 'comment') openComments(v);
        if (act === 'share')   shareVideo(v);
      });

      // Tap = bascule le son ; double-tap = like + cœur (façon TikTok).
      const onTap = ev => {
        if (ev.target.closest('.feed-rail')) return;
        const now = Date.now();
        if (now - lastTap < 300) {                 // double-tap detecté
          lastTap = 0;
          muted = !muted; applyMute();             // annule la bascule son du 1er tap
          heartBurst(slide, ev);
          const likeBtn = rail.querySelector('.feed-like');
          if (!v.liked && likeBtn) toggleLike(v, likeBtn);
          return;
        }
        lastTap = now;
        muted = !muted; applyMute();
      };
      video.addEventListener('click', onTap);
      overlay.addEventListener('click', onTap);
    });

    observer = new IntersectionObserver(onIntersect, { root: container, threshold: [0, 0.6, 1] });
    container.querySelectorAll('.feed-slide').forEach(s => observer.observe(s));
    container.onclick = null; // les taps sont gérés par slide désormais
  }

  async function toggleLike(v, btn) {
    // Optimiste : bascule tout de suite, on corrige avec la réponse serveur.
    const wasLiked = btn.classList.contains('on');
    btn.classList.toggle('on', !wasLiked);
    btn.querySelector('.feed-act-ico').textContent = !wasLiked ? '❤️' : '🤍';
    btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 300);
    try {
      const res = await api(`/api/feed-video/${v.id}/like`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId() }),
      });
      const d = await res.json();
      if (d.ok) {
        v.likeCount = d.likeCount; v.liked = d.liked;
        btn.classList.toggle('on', d.liked);
        btn.querySelector('.feed-act-ico').textContent = d.liked ? '❤️' : '🤍';
        btn.querySelector('.feed-act-n').textContent = fmt(d.likeCount);
      }
    } catch { /* silencieux : l'affichage optimiste reste */ }
  }

  function shareVideo(v) {
    const url = `${location.origin}${location.pathname}#feed`;
    const shareData = { title: 'Libero\'s Multi', text: v.titre ? `${v.titre} 🎬` : t().feedShareText, url };
    const done = () => {
      api(`/api/feed-video/${v.id}/share`, { method: 'POST' }).then(r => r.json()).then(d => {
        if (d.ok) { v.shares = d.shares; const n = container.querySelector(`.feed-slide[data-id="${v.id}"] [data-act="share"] .feed-act-n`); if (n) n.textContent = fmt(d.shares); }
      }).catch(() => {});
    };
    if (navigator.share) navigator.share(shareData).then(done).catch(() => {});
    else { navigator.clipboard?.writeText(url).catch(() => {}); if (typeof showToast === 'function') showToast(t().feedShareCopied); done(); }
  }

  // ── Commentaires (feuille du bas) ──
  let commentVideo = null;
  async function openComments(v) {
    commentVideo = v;
    const ov = document.getElementById('overlay-videocomments');
    const list = document.getElementById('videocomments-list');
    const cnt = document.getElementById('videocomments-count');
    if (!ov) return;
    ov.classList.remove('hidden');
    list.innerHTML = `<p class="videocomments-empty">${t().feedLoading}</p>`;
    try {
      const res = await api(`/api/feed-video/${v.id}/comments`);
      const arr = await res.json();
      cnt.textContent = arr.length;
      renderComments(arr);
    } catch { list.innerHTML = `<p class="videocomments-empty">${t().feedError}</p>`; }
  }
  function renderComments(arr) {
    const list = document.getElementById('videocomments-list');
    if (!arr.length) { list.innerHTML = `<p class="videocomments-empty">${t().feedNoComments}</p>`; return; }
    list.innerHTML = '';
    arr.forEach(c => {
      const row = document.createElement('div');
      row.className = 'videocomment';
      const nm = document.createElement('span'); nm.className = 'videocomment-name'; nm.textContent = c.name || 'Anonyme';
      const tx = document.createElement('p');   tx.className = 'videocomment-text'; tx.textContent = c.text;
      row.appendChild(nm); row.appendChild(tx);
      list.appendChild(row);
    });
  }
  async function sendComment() {
    if (!commentVideo) return;
    const inp = document.getElementById('videocomments-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    try {
      const res = await api(`/api/feed-video/${commentVideo.id}/comment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId(), name: playerName(), text }),
      });
      const d = await res.json();
      if (d.ok) {
        document.getElementById('videocomments-count').textContent = d.commentCount;
        commentVideo.commentCount = d.commentCount;
        const n = container.querySelector(`.feed-slide[data-id="${commentVideo.id}"] [data-act="comment"] .feed-act-n`);
        if (n) n.textContent = fmt(d.commentCount);
        // recharge la liste
        const arr = await (await api(`/api/feed-video/${commentVideo.id}/comments`)).json();
        renderComments(arr);
      } else if (typeof showToast === 'function') showToast(d.error || t().feedError);
    } catch { if (typeof showToast === 'function') showToast(t().feedError); }
  }

  // ── Proposer une vidéo ──
  function openSubmit() {
    const ov = document.getElementById('overlay-videosubmit');
    if (!ov) return;
    ov.classList.remove('hidden');
    document.getElementById('videosubmit-status').textContent = '';
    document.getElementById('videosubmit-url').value = '';
    document.getElementById('videosubmit-titre').value = '';
    document.getElementById('videosubmit-desc').value = '';
  }
  async function sendSubmit() {
    const url = document.getElementById('videosubmit-url').value.trim();
    const titre = document.getElementById('videosubmit-titre').value.trim();
    const description = document.getElementById('videosubmit-desc').value.trim();
    const st = document.getElementById('videosubmit-status');
    if (!/^https?:\/\//i.test(url)) { st.textContent = t().feedSubmitBadUrl; st.className = 'videosubmit-status err'; return; }
    st.textContent = '…'; st.className = 'videosubmit-status';
    try {
      const res = await api('/api/feed-video/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId(), name: playerName(), url, titre, description }),
      });
      const d = await res.json();
      if (d.ok) { st.textContent = t().feedSubmitOk; st.className = 'videosubmit-status ok'; setTimeout(() => document.getElementById('overlay-videosubmit')?.classList.add('hidden'), 1600); }
      else { st.textContent = d.error || t().feedError; st.className = 'videosubmit-status err'; }
    } catch { st.textContent = t().feedError; st.className = 'videosubmit-status err'; }
  }

  function onIntersect(entries) {
    entries.forEach(e => {
      const video = e.target.querySelector('video');
      if (!video) return;
      const active = e.isIntersecting && e.intersectionRatio >= 0.6;
      e.target.classList.toggle('in-view', active); // déclenche l'apparition du rail + overlay
      if (active) {
        if (!video.src && video.dataset.src) video.src = video.dataset.src;
        // précharge la slide suivante pour un défilement fluide
        const next = e.target.nextElementSibling?.querySelector('video');
        if (next && !next.src && next.dataset.src) { next.preload = 'auto'; next.src = next.dataset.src; }
        video.muted = muted;
        video.play().catch(() => {});
        countView(e.target.dataset.id);
      } else {
        video.pause();
      }
    });
  }

  function countView(id) {
    if (!id || viewed.has(id)) return;
    viewed.add(id);
    api(`/api/feed-video/${id}/view`, { method: 'POST' }).then(r => r.json()).then(d => {
      if (d.ok) { const n = container.querySelector(`.feed-slide[data-id="${id}"] .feed-views`); if (n) n.textContent = '👁 ' + fmt(d.views); }
    }).catch(() => {});
  }

  function playVisible() {
    if (!container) return;
    const slides = container.querySelectorAll('.feed-slide');
    slides.forEach(s => {
      const video = s.querySelector('video');
      if (!video) return;
      const r = s.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      const mid = cr.top + cr.height / 2;
      const visible = r.top <= mid && r.bottom >= mid;
      if (visible) { if (!video.src && video.dataset.src) video.src = video.dataset.src; video.muted = muted; video.play().catch(() => {}); }
      else video.pause();
    });
  }

  function pauseAll() {
    container?.querySelectorAll('video').forEach(v => v.pause());
  }

  function retexte() {
    // Recharge les libellés si la feuille de statut est affichée.
    if (container?.classList.contains('feed-status-mode')) {
      if (!loaded) setStatus(t().feedLoading, '⏳');
      else if (!videos.length) setStatus(t().feedEmpty);
    }
  }

  // Boutons des modales (une seule fois).
  document.getElementById('videocomments-send')?.addEventListener('click', sendComment);
  document.getElementById('videocomments-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendComment(); });
  document.getElementById('videocomments-close')?.addEventListener('click', () => document.getElementById('overlay-videocomments')?.classList.add('hidden'));
  document.getElementById('videosubmit-send')?.addEventListener('click', sendSubmit);
  document.getElementById('videosubmit-close')?.addEventListener('click', () => document.getElementById('overlay-videosubmit')?.classList.add('hidden'));
  document.getElementById('feed-submit-fab')?.addEventListener('click', openSubmit);

  return { load, pauseAll, playVisible, retexte, openSubmit };
})();
window._videoFeed = VideoFeed;

// ── Idées & suggestions (tableau communautaire, votes ▲▼ facon Steam) ────────
const IdeasBoard = (() => {
  const listEl = () => document.getElementById('ideas-list');
  const api = (path, opts) => fetch(`${window.BACKEND_URL}${path}`, opts);
  let loaded = false, items = [], sort = 'top';

  function playerName() {
    return (typeof getPlayerName === 'function' && getPlayerName()) || localStorage.getItem('playerName') || '';
  }
  const esc = s => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  const fmt = n => (n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'k' : String(n || 0));

  function setStatus(msg, icon = '💡') {
    const g = listEl(); if (!g) return;
    const lines = String(msg).split('\n').map(l => `<span>${esc(l)}</span>`).join('');
    g.innerHTML = `<div class="ideas-status"><span class="feed-status-icon">${icon}</span><p class="feed-status-text">${lines}</p></div>`;
  }

  async function load(force = false) {
    if (!listEl()) return;
    if (loaded && !force) { render(); return; }
    setStatus(t().ideasLoading, '⏳');
    try {
      const res = await api(`/api/suggestions?playerId=${encodeURIComponent(getPlayerId())}`);
      if (!res.ok) throw new Error('http ' + res.status);
      items = await res.json();
    } catch { setStatus(t().ideasError); return; }
    loaded = true;
    render();
  }

  function sorted() {
    const arr = items.slice();
    if (sort === 'new') arr.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    else arr.sort((a, b) => (b.pinned - a.pinned) || (b.score - a.score) || (b.createdAt - a.createdAt));
    return arr;
  }

  function statusBadge(st) {
    if (!st || st === 'open') return '';
    const map = { planned: ['idea-badge-planned', t().ideaStatusPlanned], done: ['idea-badge-done', t().ideaStatusDone], rejected: ['idea-badge-rejected', t().ideaStatusRejected] };
    const m = map[st]; if (!m) return '';
    return `<span class="idea-badge ${m[0]}">${esc(m[1])}</span>`;
  }

  function render() {
    const g = listEl(); if (!g) return;
    if (!items.length) { setStatus(t().ideasEmpty); return; }
    g.innerHTML = sorted().map(s => `
      <div class="idea-card${s.pinned ? ' idea-pinned' : ''}" data-id="${esc(s.id)}">
        <div class="idea-votes">
          <button class="idea-vote up${s.myVote === 1 ? ' on' : ''}" data-dir="1" aria-label="Pour">▲</button>
          <span class="idea-score">${s.score > 0 ? '+' : ''}${fmt(s.score)}</span>
          <button class="idea-vote down${s.myVote === -1 ? ' on' : ''}" data-dir="-1" aria-label="Contre">▼</button>
        </div>
        <div class="idea-body">
          <p class="idea-title">${esc(s.title)} ${statusBadge(s.status)}</p>
          ${s.description ? `<p class="idea-desc">${esc(s.description)}</p>` : ''}
          <p class="idea-meta">${esc(t().ideaByAuthor(s.authorName))}${s.mine ? ` · <button class="idea-del" data-id="${esc(s.id)}">${esc(t().ideaDelete)}</button>` : ''}</p>
        </div>
      </div>`).join('');
  }

  async function vote(id, dir) {
    const s = items.find(x => x.id === id); if (!s) return;
    // Bascule : re-cliquer le meme sens retire le vote.
    const newDir = s.myVote === dir ? 0 : dir;
    try {
      const res = await api(`/api/suggestion/${id}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId(), dir: newDir }),
      });
      const d = await res.json();
      if (d.ok) { Object.assign(s, { up: d.up, down: d.down, score: d.score, myVote: d.myVote }); render(); }
    } catch { /* silencieux */ }
  }

  async function del(id) {
    if (!confirm(t().ideaDeleteConfirm)) return;
    try {
      const res = await api(`/api/suggestion/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId() }),
      });
      const d = await res.json();
      if (d.ok) { items = items.filter(x => x.id !== id); render(); }
    } catch { /* silencieux */ }
  }

  function openNew() {
    if (!playerName()) { if (typeof showCursorSnakeToast === 'function') showCursorSnakeToast(t().ideaNeedName); return; }
    const ov = document.getElementById('overlay-ideanew'); if (!ov) return;
    ov.classList.remove('hidden');
    document.getElementById('ideanew-titre').value = '';
    document.getElementById('ideanew-desc').value = '';
    document.getElementById('ideanew-status').textContent = '';
  }
  async function sendNew() {
    const title = document.getElementById('ideanew-titre').value.trim();
    const description = document.getElementById('ideanew-desc').value.trim();
    const st = document.getElementById('ideanew-status');
    if (title.length < 4) { st.textContent = t().ideaTitleShort; st.className = 'videosubmit-status err'; return; }
    st.textContent = '…'; st.className = 'videosubmit-status';
    try {
      const res = await api('/api/suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getPlayerId(), name: playerName(), title, description }),
      });
      const d = await res.json();
      if (d.ok) {
        st.textContent = t().ideaPosted; st.className = 'videosubmit-status ok';
        items.unshift(d.suggestion); loaded = true; render();
        setTimeout(() => document.getElementById('overlay-ideanew')?.classList.add('hidden'), 1200);
      } else { st.textContent = d.error || t().ideasError; st.className = 'videosubmit-status err'; }
    } catch { st.textContent = t().ideasError; st.className = 'videosubmit-status err'; }
  }

  function setSort(s) {
    sort = s;
    document.getElementById('ideas-sort-top')?.classList.toggle('active', s === 'top');
    document.getElementById('ideas-sort-new')?.classList.toggle('active', s === 'new');
    render();
  }

  function retexte() {
    if (loaded) render();
    else if (listEl()?.querySelector('.ideas-status')) setStatus(t().ideasLoading, '⏳');
  }

  // Delegation des clics de la liste (votes + suppression).
  document.getElementById('ideas-list')?.addEventListener('click', e => {
    const del1 = e.target.closest('.idea-del'); if (del1) { del(del1.dataset.id); return; }
    const vb = e.target.closest('.idea-vote'); if (!vb) return;
    const card = vb.closest('.idea-card'); if (card) vote(card.dataset.id, +vb.dataset.dir);
  });
  document.getElementById('ideas-new-btn')?.addEventListener('click', openNew);
  document.getElementById('ideas-sort-top')?.addEventListener('click', () => setSort('top'));
  document.getElementById('ideas-sort-new')?.addEventListener('click', () => setSort('new'));
  document.getElementById('ideanew-send')?.addEventListener('click', sendNew);
  document.getElementById('ideanew-close')?.addEventListener('click', () => document.getElementById('overlay-ideanew')?.classList.add('hidden'));

  return { load, retexte };
})();
window._ideasBoard = IdeasBoard;

// ── Lecture (catalogue de livres) ────────────────────────────────────────────
const ReadFeed = (() => {
  const wrap    = () => document.getElementById('read-grid');
  const catsEl  = () => document.getElementById('read-cats');
  const overlay = () => document.getElementById('read-overlay');
  const sheet   = () => document.getElementById('read-sheet');
  const input   = () => document.getElementById('read-search-input');

  let loaded = false, books = [], activeCat = null, query = '';
  let exclusiveBooks = [];    // livres écrits par le créateur, servis par l'API avec chapitres payants
  let sheetBook = null;       // livre exclusif affiché dans la fiche
  let readerBook = null;      // livre ouvert dans la visionneuse
  let readerNum = 0;          // chapitre affiché dans la visionneuse
  // Un refresh en pleine lecture doit ramener au même livre, même chapitre, même endroit.
  const READER_SESS = 'libero_book_reader';
  function saveReaderSession() {
    if (!readerNum || !readerBook || !reader()?.classList.contains('open')) return;
    const content = document.getElementById('book-reader-content');
    sessionStorage.setItem(READER_SESS, JSON.stringify({ bookId: readerBook.id, num: readerNum, scrollTop: content ? Math.round(content.scrollTop) : 0 }));
  }
  function clearReaderSession() { sessionStorage.removeItem(READER_SESS); }

  // Couvertures de secours quand un livre n'a pas d'image.
  const GRADS = [
    'linear-gradient(135deg,#7c5cff,#22d3ee)', 'linear-gradient(135deg,#ff4d9d,#ff8a3d)',
    'linear-gradient(135deg,#22d3ee,#34d399)', 'linear-gradient(135deg,#a78bff,#ff4d9d)',
    'linear-gradient(135deg,#5b8cff,#7c5cff)', 'linear-gradient(135deg,#ffce3a,#ff5a6e)',
  ];
  const grad = i => GRADS[i % GRADS.length];
  const esc  = s => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]));
  // Version localisée d'un champ de livre (le serveur fournit FR + EN).
  const loc   = (fr, en) => (currentLang === 'en' && en) ? en : fr;
  const catOf = b => loc(b.categorie, b.categorieEn);
  // Seules les URLs http(s) sont injectées dans le HTML (href / background).
  const safeUrl = s => (/^https?:\/\//i.test(String(s || '').trim()) ? String(s).trim() : '');

  function setStatus(msg) {
    const g = wrap(); if (!g) return;
    g.classList.remove('is-skel');
    catsEl().innerHTML = '';
    const lines = String(msg).split('\n').map(l => `<span>${esc(l)}</span>`).join('');
    g.innerHTML = `<div class="read-status"><span class="feed-status-icon">📚</span><p class="feed-status-text">${lines}</p></div>`;
  }

  // Squelettes shimmer pendant le chargement : perception d'attente reduite.
  function showSkeleton() {
    const g = wrap(); if (!g) return;
    catsEl().innerHTML = '';
    g.classList.add('is-skel');
    g.innerHTML = Array.from({ length: 8 }).map(() =>
      `<div class="skel-card"><div class="skel skel-cover"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div>`
    ).join('');
  }

  async function load(force = false) {
    if (!wrap()) return;
    if (loaded && !force) { render(); return; }
    showSkeleton();
    const pid = encodeURIComponent(getPlayerId() || '');
    const [booksRes, exclRes] = await Promise.allSettled([
      fetch(`${window.BACKEND_URL}/api/feed-books`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${window.BACKEND_URL}/api/books?playerId=${pid}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]);
    books          = booksRes.status === 'fulfilled' && Array.isArray(booksRes.value) ? booksRes.value : null;
    exclusiveBooks = exclRes.status  === 'fulfilled' && Array.isArray(exclRes.value)  ? exclRes.value  : [];
    exclusiveBooks.forEach(_setExclCover);
    if (books === null && !exclusiveBooks.length) { setStatus(t().readError); return; }
    books = books || [];
    loaded = true;
    if (books.length === 0 && !exclusiveBooks.length) { setStatus(t().readEmpty); return; }
    activeCat = activeCat || t().readAll;
    buildCats(); render();

    // Reprise de lecture : un refresh en plein chapitre rouvre la visionneuse
    // au même livre, même chapitre et même position de défilement.
    const savedReader = (() => { try { return JSON.parse(sessionStorage.getItem(READER_SESS)); } catch { return null; } })();
    if (savedReader && !reader().classList.contains('open')) {
      // Les anciennes sessions (avant multi-livres) n'avaient pas de bookId.
      const bk = exclusiveBooks.find(b => b.id === (savedReader.bookId || 'affaire-endormie'));
      const ch = bk?.chapters.find(c => c.num === savedReader.num);
      if (bk && ch && ch.unlocked && ch.disponible) openReader(bk, savedReader.num, savedReader.scrollTop || 0);
      else clearReaderSession();
    }
  }

  // La couverture ne s'affiche que si le serveur en héberge une : sinon le
  // dégradé de secours (avec titre) prend le relais.
  function _setExclCover(bk) {
    bk.couverture = bk.hasCover ? `${window.BACKEND_URL}/api/book/${bk.id}/couverture` : '';
  }

  // Recharge silencieuse de l'état d'un livre (après un achat).
  async function reloadExclusive(bookId) {
    try {
      const pid = encodeURIComponent(getPlayerId() || '');
      const r = await fetch(`${window.BACKEND_URL}/api/book/${encodeURIComponent(bookId)}?playerId=${pid}`);
      if (r.ok) {
        const fresh = await r.json();
        _setExclCover(fresh);
        const idx = exclusiveBooks.findIndex(b => b.id === bookId);
        if (idx !== -1) exclusiveBooks[idx] = fresh; else exclusiveBooks.push(fresh);
        if (sheetBook?.id === bookId)  sheetBook  = fresh;
        if (readerBook?.id === bookId) readerBook = fresh;
      }
    } catch { /* on garde l'état précédent */ }
  }

  function buildCats() {
    const withExcl = [...exclusiveBooks.map(catOf), ...books.map(b => b.categorie)];
    const cats = [t().readAll, ...[...new Set(withExcl.filter(Boolean))]];
    catsEl().innerHTML = '';
    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'read-cat' + (c === activeCat ? ' active' : '');
      btn.textContent = c;
      btn.onclick = () => { activeCat = c; buildCats(); render(); };
      catsEl().appendChild(btn);
    });
  }

  function readersHTML(b) {
    const n = b && b.readers || 0;
    if (n <= 0) return '';
    return `<span class="read-readers" title="${esc(t().bookReaders(n))}">👁 ${n}</span>`;
  }

  function coverHTML(b, i) {
    const cover = safeUrl(b.couverture);
    return `<div class="read-cover" style="background:${cover ? `center/cover url('${esc(cover)}')` : grad(i)}">
      ${cover ? '' : `<span class="read-cover-emoji">📖</span><span class="read-cover-t">${esc(b.titre)}</span>`}
      ${readersHTML(b)}</div>`;
  }

  function matches(b) {
    const all = t().readAll;
    return (activeCat === all || catOf(b) === activeCat) &&
      ((b.titre || '').toLowerCase().includes(query) || (b.auteur || '').toLowerCase().includes(query));
  }

  function render() {
    const g = wrap(); if (!g) return;
    g.classList.remove('is-skel');
    const list = books.filter(matches);
    const exclList = exclusiveBooks.filter(matches);
    if (!list.length && !exclList.length) { g.innerHTML = `<p class="read-empty">${esc(t().readNoResult)}</p>`; return; }
    g.innerHTML = '';
    exclList.forEach((bk, i) => {
      const card = document.createElement('div');
      card.className = 'read-book read-book--exclusive';
      card.innerHTML = coverHTML(bk, i) +
        `<span class="read-book-cat read-book-cat--excl">${esc(t().bookExclusive)}</span>
         <p class="read-book-title">${esc(bk.titre)}</p>
         <p class="read-book-author">${esc(bk.auteur)}</p>`;
      card.onclick = () => openBookSheet(bk);
      g.appendChild(card);
    });
    list.forEach((b, i) => {
      const card = document.createElement('div');
      card.className = 'read-book';
      card.innerHTML = coverHTML(b, i) +
        `${b.categorie ? `<span class="read-book-cat">${esc(b.categorie)}</span>` : ''}
         <p class="read-book-title">${esc(b.titre)}</p>
         ${b.auteur ? `<p class="read-book-author">${esc(b.auteur)}</p>` : ''}`;
      card.onclick = () => openSheet(b, i);
      g.appendChild(card);
    });
  }

  function openSheet(b, i) {
    sheetBook = null; // fiche classique : ne pas la faire écraser par retexte()
    const link = safeUrl(b.url);
    sheet().innerHTML = coverHTML(b, i) +
      `<div class="read-sheet-info">
         ${b.categorie ? `<span class="read-book-cat">${esc(b.categorie)}</span>` : ''}
         <h2>${esc(b.titre)}</h2>
         ${b.auteur ? `<p class="read-sheet-author">${esc(b.auteur)}</p>` : ''}
         ${b.description ? `<p class="read-sheet-desc">${esc(b.description)}</p>` : ''}
         <div class="read-sheet-actions">
           ${link ? `<a class="btn btn-primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${t().readBtn}</a>` : ''}
           <button class="btn btn-secondary" id="read-sheet-close">${esc(t().readBack)}</button>
         </div>
       </div>`;
    overlay().classList.add('open');
    document.getElementById('read-sheet-close').onclick = closeSheet;
    // Un clic sur « Lire » (lien externe) compte comme une lecture de ce livre.
    if (link) {
      const readLink = sheet().querySelector('.read-sheet-actions a');
      if (readLink) readLink.addEventListener('click', () => _markRead(b.id), { once: true });
    }
  }
  function closeSheet() { overlay().classList.remove('open'); }

  // Signale au serveur que ce joueur a ouvert ce livre (comptage des lecteurs).
  function _markRead(bookId) {
    if (bookId) socket.emit('book-read', { playerId: getPlayerId(), bookId });
  }
  // Applique un nouveau total de lecteurs et rafraîchit l'affichage.
  function setReaders(bookId, count) {
    let hit = false;
    for (const arr of [exclusiveBooks, books]) {
      const b = arr.find(x => x.id === bookId);
      if (b) { b.readers = count; hit = true; }
    }
    if (hit && loaded) render();
    // Met aussi à jour la fiche exclusive ouverte, le cas échéant.
    if (sheetBook && sheetBook.id === bookId) sheetBook.readers = count;
  }

  // ── Livre exclusif : fiche avec chapitres + déblocage en Libs ──────────────
  function openBookSheet(bk = sheetBook) {
    if (!bk) return;
    sheetBook = bk;
    const d = t();
    const rows = bk.chapters.map(ch => {
      const readable = ch.unlocked && ch.disponible;
      const state = readable
        ? (ch.gratuit ? `<span class="book-ch-tag book-ch-tag--free">${esc(d.bookFree)}</span>` : '📖')
        : (ch.disponible ? '🔒' : `<span class="book-ch-tag">${esc(d.bookComingSoon)}</span>`);
      return `<button class="book-ch${readable ? '' : ' locked'}" data-num="${ch.num}" ${readable ? '' : 'disabled'}>
        <span class="book-ch-num">${ch.num}</span>
        <span class="book-ch-titre">${esc(ch.disponible ? loc(ch.titre, ch.titreEn) : loc(`Chapitre ${ch.num}`, `Chapter ${ch.num}`))}</span>
        <span class="book-ch-state">${state}</span>
      </button>`;
    }).join('');
    // Boutons d'achat : un par pack non possédé (désactivé si aucun chapitre publié)
    let packBtns = bk.packs.filter(p => !p.owned).map(p => {
      const anyAvail = bk.chapters.some(ch => ch.pack === p.id && ch.disponible);
      const needPrev = p.requires && !bk.packs.find(x => x.id === p.requires)?.owned;
      // Chapitres non publiés → « À venir » ; publiés mais pack précédent requis → prix affiché, bouton grisé.
      const label = anyAvail ? d.bookUnlockFor(p.price) : d.bookComingSoon;
      return `<button class="btn btn-primary book-buy-btn" data-pack="${p.id}" ${anyAvail && !needPrev ? '' : 'disabled'}>
        ${esc(d.bookLockedRange(p.from, p.to))} · ${esc(label)}</button>`;
    }).join('');
    // Suite réservée (ex. tome 2) : pas de pack à acheter, l'accès vient d'un
    // autre livre. On explique la condition et on renvoie vers le tome requis.
    if (bk.accessVia) {
      packBtns = bk.accessVia.owned
        ? `<p class="book-sequel-note book-sequel-note--ok">${esc(d.bookSequelUnlocked)}</p>`
        : `<p class="book-sequel-note">${esc(d.bookSequelLocked(bk.accessVia.titre))}</p>
           <button class="btn btn-primary" id="book-sequel-goto">${esc(d.bookSequelGoto(bk.accessVia.titre))}</button>`;
    }
    sheet().innerHTML = coverHTML(bk, 0) +
      `<div class="read-sheet-info">
         <span class="read-book-cat read-book-cat--excl">${esc(d.bookExclusive)}</span>
         <h2>${esc(bk.titre)}</h2>
         <p class="read-sheet-author">${esc(bk.auteur)}</p>
         <p class="read-sheet-desc">${esc(loc(bk.description, bk.descriptionEn))}</p>
         ${bk.copyright ? `<p class="book-copyright">${esc(loc(bk.copyright, bk.copyrightEn))}</p>` : ''}
         <p class="book-ch-head">${esc(d.bookChaptersTitle)}</p>
         <div class="book-ch-list">${rows}</div>
         <div class="read-sheet-actions">
           ${packBtns}
           <button class="btn btn-secondary" id="read-sheet-close">${esc(d.readBack)}</button>
         </div>
       </div>`;
    overlay().classList.add('open');
    document.getElementById('read-sheet-close').onclick = closeSheet;
    sheet().querySelectorAll('.book-ch:not(.locked)').forEach(b => {
      b.onclick = () => openReader(bk, parseInt(b.dataset.num, 10));
    });
    sheet().querySelectorAll('.book-buy-btn').forEach(b => {
      b.onclick = () => buyPack(bk.id, b.dataset.pack);
    });
    // « Voir le tome requis » : ouvre la fiche du livre qui débloque celui-ci.
    const gotoBtn = document.getElementById('book-sequel-goto');
    if (gotoBtn && bk.accessVia) {
      gotoBtn.onclick = () => {
        const req = exclusiveBooks.find(b => b.id === bk.accessVia.bookId);
        if (req) openBookSheet(req);
      };
    }
  }

  function buyPack(bookId, packId) {
    const name = (localStorage.getItem('playerName') || '').trim();
    if (!name) { showCursorSnakeToast(t().bookNeedName); return; }
    socket.emit('buy-book-pack', { playerId: getPlayerId(), bookId, packId });
  }

  socket.on('buy-book-pack-result', async ({ ok, error } = {}) => {
    const d = t();
    if (ok) {
      if (sheetBook) {
        await reloadExclusive(sheetBook.id);
        // Un achat peut débloquer une suite (ex. tome 1 acheté → tome 2 offert) :
        // on rafraîchit aussi les livres dont l'accès dépend de celui-ci.
        const dependents = exclusiveBooks.filter(b => b.accessVia?.bookId === sheetBook.id);
        await Promise.all(dependents.map(b => reloadExclusive(b.id)));
      }
      openBookSheet(); // ré-affiche la fiche avec les chapitres débloqués
      showCursorSnakeToast(d.bookUnlocked);
      return;
    }
    if (error === 'insufficient')       showCursorSnakeToast(d.bookInsufficient);
    else if (error === 'anonymous')     showCursorSnakeToast(d.bookNeedName);
    else if (error === 'requires_previous') showCursorSnakeToast(d.bookNeedPrevious);
    else                                showCursorSnakeToast(d.bookComingSoon);
  });

  // ── Visionneuse de chapitre ─────────────────────────────────────────────────
  // Rendu markdown minimal : le texte est échappé AVANT toute mise en forme.
  function mdToHtml(md) {
    return String(md).split(/\n{2,}/).map(block => {
      const b = block.trim();
      if (!b) return '';
      if (/^---+$/.test(b)) return '<hr>';
      const escd = esc(b)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      if (b.startsWith('### ')) return `<h4>${escd.slice(4)}</h4>`;
      if (b.startsWith('## '))  return `<h3>${escd.slice(3)}</h3>`;
      if (b.startsWith('# '))   return `<h2>${escd.slice(2)}</h2>`;
      return `<p>${escd.replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  const reader = () => document.getElementById('book-reader');

  async function openReader(bk, num, restoreScroll = 0) {
    if (!bk) return;
    const ch = bk.chapters.find(c => c.num === num);
    if (!ch || !ch.unlocked || !ch.disponible) { showCursorSnakeToast(t().bookChapterLocked); return; }
    let data;
    try {
      const pid = encodeURIComponent(getPlayerId() || '');
      const r = await fetch(`${window.BACKEND_URL}/api/book/${encodeURIComponent(bk.id)}/chapitre/${num}?playerId=${pid}&lang=${currentLang}`);
      if (!r.ok) throw new Error();
      data = await r.json();
    } catch { showCursorSnakeToast(t().bookChapterLocked); return; }
    _markRead(bk.id); // ouvrir un chapitre = lire ce livre (comptage des lecteurs)
    readerBook = bk;
    readerNum  = num;
    closeSheet();
    document.getElementById('book-reader-title').textContent = loc(data.titre, data.titreEn);
    // Note affichée si l'anglais est demandé mais que la traduction n'existe pas encore.
    const noteHtml = data.fallback ? `<p class="book-orig-note">${esc(t().bookOriginalOnly)}</p>` : '';
    document.getElementById('book-reader-content').innerHTML = noteHtml + mdToHtml(data.content) +
      (data.copyright ? `<p class="book-copyright book-copyright--reader">${esc(loc(data.copyright, data.copyrightEn))}</p>` : '');
    const prevB = document.getElementById('book-reader-prev');
    const nextB = document.getElementById('book-reader-next');
    const readable = n => { const c = bk.chapters.find(x => x.num === n); return c && c.unlocked && c.disponible; };
    prevB.textContent = t().bookPrev; nextB.textContent = t().bookNext;
    prevB.disabled = !readable(num - 1);
    nextB.disabled = !readable(num + 1);
    reader().classList.add('open');
    reader().querySelector('.book-reader-content').scrollTop = restoreScroll;
    saveReaderSession();
  }

  document.getElementById('book-reader-close')?.addEventListener('click', () => {
    reader().classList.remove('open');
    const bk = readerBook;
    readerBook = null;
    readerNum  = 0;
    clearReaderSession();
    openBookSheet(bk); // retour à la fiche du livre
  });
  document.getElementById('book-reader-prev')?.addEventListener('click', () => openReader(readerBook, readerNum - 1));
  document.getElementById('book-reader-next')?.addEventListener('click', () => openReader(readerBook, readerNum + 1));

  // Protection du texte : dissuade la copie du roman depuis la visionneuse
  // (copie, clic droit, sélection et impression bloqués · dissuasif, pas absolu).
  const readerContent = () => document.getElementById('book-reader-content');
  document.addEventListener('copy', e => {
    if (reader()?.classList.contains('open') && readerContent()?.contains(document.getSelection()?.anchorNode)) {
      e.preventDefault();
    }
  });
  document.addEventListener('contextmenu', e => {
    if (reader()?.classList.contains('open') && e.target.closest('#book-reader-content')) e.preventDefault();
  });
  window.addEventListener('beforeprint', () => {
    if (reader()?.classList.contains('open')) reader().classList.add('no-print');
  });

  // Mémorise la position de lecture juste avant un refresh / une fermeture.
  window.addEventListener('beforeunload', saveReaderSession);

  function retexte() { // rafraîchit les libellés au changement de langue
    if (!loaded) return;
    const cats = [...exclusiveBooks.map(catOf), ...books.map(b => b.categorie)];
    if (activeCat) activeCat = cats.includes(activeCat) ? activeCat : t().readAll;
    buildCats(); render();
    // La fiche d'un livre exclusif ouverte se re-rend dans la nouvelle langue.
    if (sheetBook && overlay().classList.contains('open')) openBookSheet(sheetBook);
    // Un chapitre en cours de lecture se recharge dans la nouvelle langue
    // (sert la traduction si elle existe), en gardant la position de lecture.
    if (readerBook && reader()?.classList.contains('open')) {
      const scroll = reader().querySelector('.book-reader-content')?.scrollTop || 0;
      openReader(readerBook, readerNum, scroll);
    }
  }

  // Recherche + fermeture de la fiche en cliquant hors de celle-ci
  document.addEventListener('input', e => { if (e.target === input()) { query = e.target.value.toLowerCase(); render(); } });
  document.addEventListener('click', e => { if (e.target === overlay()) closeSheet(); });

  return { load, retexte, setReaders };
})();
window._readFeed = ReadFeed;

// Mise à jour en direct du nombre de lecteurs d'un livre.
socket.on('book-readers-update', ({ bookId, count } = {}) => {
  if (bookId != null && typeof count === 'number') ReadFeed.setReaders(bookId, count);
});

document.getElementById('nav-tab-home')?.addEventListener('click', () => {
  if (sessionStorage.getItem('libero_screen') === 'landing') return;
  showScreen('landing');
});
document.getElementById('nav-tab-ideas')?.addEventListener('click', () => {
  if (sessionStorage.getItem('libero_screen') === 'ideas') return;
  showScreen('ideas');
});
document.getElementById('nav-tab-read')?.addEventListener('click', () => {
  if (sessionStorage.getItem('libero_screen') === 'read') return;
  showScreen('read');
});
document.getElementById('nav-tab-profile')?.addEventListener('click', () => {
  if (sessionStorage.getItem('libero_screen') === 'profile') return;
  showScreen('profile');
});

// Écran par défaut au chargement = landing (barre de nav visible en bas sur mobile).
// showScreen() corrigera cette classe si un autre écran est restauré ci-dessous.
document.body.classList.add('nav-bottom-visible');

// ── Restauration d'écran après refresh ───────────────────────────────────────
(function() {
  const saved = sessionStorage.getItem('libero_screen');
  if (!saved || saved === 'landing') return;
  // Écrans gérés par la reconnexion socket · ils se restaurent via p4session/triviaSession
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

// ── Icônes SVG (remplacent les emojis d'interface : nav, cartes) ─────────────
// Jeu d'icones « trait » coherent (24x24, currentColor) style Lucide. Chaque
// element portant data-ic recoit l'icone correspondante ; l'emoji reste en
// repli si le script ne s'execute pas. Couleurs : suivent le theme du site.
const UI_ICONS = (() => {
  const S = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  return {
    home:    S('<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>'),
    bulb:    S('<path d="M12 3a6 6 0 0 0-3.5 10.9c.3.2.5.6.5 1V16h6v-1.1c0-.4.2-.8.5-1A6 6 0 0 0 12 3Z"/><path d="M9.5 19h5M10.5 21.5h3"/>'),
    book:    S('<path d="M6 4h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 4v16"/>'),
    target:  S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
    grid:    S('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
    cap:     S('<path d="M2 9l10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5"/><path d="M22 9v5"/>'),
    calendar:S('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4"/>'),
    zap:     S('<path d="M13 3l-8 10h6l-2 8 8-10h-6l2-8Z"/>'),
    archive: S('<rect x="4" y="5" width="16" height="4" rx="1"/><path d="M5 9v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'),
    clock:   S('<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>'),
    save:    S('<path d="M12 4v9"/><path d="M8.5 10.5 12 14l3.5-3.5"/><path d="M5 18h14"/>'),
    userplus:S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><path d="M18 8v6M15 11h6"/>'),
    users:   S('<circle cx="8.5" cy="8" r="3"/><path d="M2.5 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.8M17.5 20c0-2-.6-3.8-1.7-5.2"/>'),
    wheel:   S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>'),
    pulse:   S('<path d="M3 12h4l2.5-7 4 15 2.5-8H21"/>'),
    crown:   S('<path d="M4 8l3.6 3.2L12 5l4.4 6.2L20 8l-1.4 10.5H5.4L4 8Z"/>'),
    smile:   S('<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
    gear:    S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    sparkle: S('<path d="M12 3l1.7 5L19 9.5l-5.3 1.5L12 16l-1.7-5L5 9.5l5.3-1.5L12 3Z"/><path d="M18.5 15l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"/>'),
    trash:   S('<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 7l1 12a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-12"/><path d="M10 11v6M14 11v6"/>'),
  };
})();
function paintUiIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(el => {
    const svg = UI_ICONS[el.getAttribute('data-ic')];
    if (svg && !el.querySelector('svg')) el.innerHTML = svg;
  });
}
window.paintUiIcons = paintUiIcons;
paintUiIcons();

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

// Reopen shop after accidental page refresh · y compris le panneau Recharger
// ou le formulaire d'un pack précis (avec la saisie déjà en cours), exactement
// comme le joueur l'avait laissé.
if (sessionStorage.getItem('shopState')) {
  // Capturé AVANT openShop() : openShop() réécrit shopState en ne gardant que
  // { open, scrollTop }, donc view/pack/form doivent être lus maintenant.
  const _savedShopPanel = (() => { try { return JSON.parse(sessionStorage.getItem('shopState')); } catch { return null; } })();
  setTimeout(() => {
    openShop();
    if (_savedShopPanel?.view === 'topup') {
      _openLibsTopupPanel();
    } else if (_savedShopPanel?.view === 'buy' && _savedShopPanel.pack) {
      _openLibsTopupPanel();
      _openLibsBuyForm(_savedShopPanel.pack.packId, _savedShopPanel.pack.libsAmount, _savedShopPanel.pack.priceFCFA, _savedShopPanel.form);
    }
  }, 150);
}

// Retour d'un paiement FedaPay (achat de Libs) : nettoie l'URL puis vérifie
// la transaction côté serveur · jamais de crédit basé sur ce seul retour navigateur.
if (window.location.search.includes('libs_return=1') || localStorage.getItem('libero_pending_cart')) {
  const url = new URL(window.location.href);
  if (url.searchParams.has('libs_return')) {
    url.searchParams.delete('libs_return');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }
  setTimeout(_checkPendingLibsCart, 300);
}

// ── Profil : défis quotidiens, série de connexion, historique ────────────────
const ProfileHub = (() => {
  let challenges = [];
  let permanent  = [];   // défis permanents (progression à vie)
  let streak = null;      // { count, longest, bonus }
  let history = [];
  let loadedHistory = false;
  let _lockerCat = null; // catégorie ouverte dans le casier (null = grille de cartes)
  let _lockerPendingCat = null; // catégorie à ouvrir directement à la prochaine entrée

  const _named = () => { const n = (localStorage.getItem('playerName') || '').trim(); return n && n !== 'Anonyme'; };

  function open() { showScreen('profile'); }
  function enter() {
    socket.emit('get-challenges', { playerId: getPlayerId() });
    socket.emit('get-history', { playerId: getPlayerId() });
    renderStreak(); renderChallenges(); updateBadge();
  }
  function enterLocker() {
    // On entre sur la grille de cartes, sauf si une catégorie a été demandée
    // (ex. carte Émotes du profil qui ouvre directement le bon rayon).
    _lockerCat = _lockerPendingCat;
    _lockerPendingCat = null;
    renderLocker();
  }
  function enterHistory() { socket.emit('get-history', { playerId: getPlayerId() }); renderHistory(); }

  function renderStreak() {
    const d = t();
    const main = document.getElementById('streak-main');
    const sub  = document.getElementById('streak-sub');
    if (!main) return;
    if (streak && streak.count > 0) {
      main.textContent = d.streakMain(streak.count);
      sub.textContent  = d.streakSub(streak.longest || streak.count, streak.bonus || 0);
    } else {
      main.textContent = d.streakNone;
      sub.textContent  = '';
    }
  }

  function _challengeRowsHtml(d, items) {
    return items.map(ch => {
      const name = d.challengesNames[ch.id] || ((currentLang === 'en' && ch.labelEn) ? ch.labelEn : ch.label) || ch.id;
      const pct  = Math.round(100 * Math.min(ch.progress, ch.goal) / ch.goal);
      let btn;
      if (ch.claimed)   btn = `<span class="challenge-claimed">${_escHtml(d.challengeClaimed)}</span>`;
      else if (ch.done) btn = `<button class="challenge-claim-btn" data-cid="${_escHtml(ch.id)}">${_escHtml(d.challengeClaim)} ${_escHtml(d.challengeReward(ch.reward))}</button>`;
      else              btn = `<span class="challenge-reward-tag">${_escHtml(d.challengeReward(ch.reward))}</span>`;
      return `<div class="challenge-row${ch.claimed ? ' done' : ''}">
        <div class="challenge-info">
          <p class="challenge-name">${_escHtml(name)}</p>
          <div class="challenge-bar"><span style="width:${pct}%"></span></div>
          <p class="challenge-count">${ch.progress}/${ch.goal}</p>
        </div>
        ${btn}
      </div>`;
    }).join('');
  }

  function _wireClaims(root) {
    root.querySelectorAll('.challenge-claim-btn').forEach(b => {
      b.addEventListener('click', () => {
        b.disabled = true;
        socket.emit('claim-challenge', { playerId: getPlayerId(), challengeId: b.dataset.cid });
      });
    });
  }

  function renderChallenges() {
    const d = t();
    const list = document.getElementById('challenges-list');
    const permList = document.getElementById('perm-list');
    if (!list) return;
    if (!_named()) {
      list.innerHTML = `<p class="profile-anon">${_escHtml(d.profileAnon)}</p>`;
      if (permList) permList.innerHTML = '';
      return;
    }
    list.innerHTML = challenges.length ? _challengeRowsHtml(d, challenges) : '';
    _wireClaims(list);
    if (permList) {
      permList.innerHTML = permanent.length ? _challengeRowsHtml(d, permanent) : '';
      _wireClaims(permList);
    }
  }

  function renderHistory() {
    const d = t();
    const list = document.getElementById('history-list');
    if (!list) return;
    if (!_named()) { list.innerHTML = ''; return; }
    if (!history.length) { list.innerHTML = `<p class="history-empty">${_escHtml(d.historyEmpty)}</p>`; return; }
    const icons = { connect4:'🔴', tictactoe:'✕', chess:'♟', trivia:'🧠', snake:'🐍', luffy:'🏃' };
    list.innerHTML = history.map(h => {
      const gName = d.historyGameNames[h.game] || h.game;
      let detail;
      if (h.result) {
        const cls = h.result === 'win' ? 'win' : h.result === 'loss' ? 'loss' : 'draw';
        detail = `<span class="history-result ${cls}">${_escHtml(d.historyResults[h.result] || h.result)}</span>`;
      } else {
        detail = `<span class="history-score">${_escHtml(d.historyScore(h.score ?? 0))}</span>`;
      }
      return `<div class="history-row">
        <span class="history-icon">${icons[h.game] || '🎮'}</span>
        <span class="history-game">${_escHtml(gName)}</span>
        ${detail}
        <span class="history-time">${_escHtml(_timeAgo(h.at))}</span>
      </div>`;
    }).join('');
  }

  // ── Casier : cosmétiques possédés, repliés par catégorie (accordéon) ───────
  // Chaque catégorie est un bouton : on la déplie pour voir ses items possédés
  // et équiper / déséquiper directement. Couvre aussi les familles retirées de
  // la boutique, pour qu'un joueur qui les a achetées avant les retrouve ici.
  function _lockerCategories(d) {
    return [
      { type:'color',       icon:'🎨', label:d.lockerCats.colors,       names:d.shopCosmeticNames,    equipped:[equippedCosmetic] },
      { type:'nameeffect',  icon:'✨', label:d.lockerCats.nameeffects,  names:d.shopNameEffectNames,  equipped:[equippedNameEffect] },
      { type:'title',       icon:'🏷️', label:d.lockerCats.titles,       names:d.shopTitleNames,       equipped:[equippedTitle] },
      { type:'background',  icon:'🖼️', label:d.lockerCats.bgs,          names:d.shopBgNames,          equipped:[equippedBackground] },
      { type:'bubble',      icon:'💬', label:d.lockerCats.bubbles,      names:d.shopBubbleNames,      equipped:[equippedBubble] },
      { type:'font',        icon:'✍️', label:d.lockerCats.fonts,        names:_FONT_DISPLAY_NAMES,    equipped:[equippedFont] },
      { type:'cursorsnake', icon:'🖱️', label:d.lockerCats.cursorsnakes, names:d.shopCursorSnakeNames, equipped:[equippedCursorSnake] },
      { type:'snakeskin',   icon:'🐍', label:d.lockerCats.snakeskins,   names:d.shopSnakeSkinNames,   equipped:[equippedSnakeSkin] },
      { type:'avatar',      icon:'🎭', label:d.lockerCats.avatars,      names:d.shopAvatarNames,      equipped:[equippedAvatar] },
      { type:'p4token',     icon:'🔴', label:d.lockerCats.p4tokens,     names:d.shopP4TokenNames,     equipped:[equippedP4Token] },
      { type:'ttt',         icon:'✖️', label:d.lockerCats.ttt,          names:d.shopTttNames,         equipped:[equippedTtt] },
      { type:'chess',       icon:'♟️', label:d.lockerCats.chess,        names:d.shopChessNames,       equipped:[equippedChess] },
      { type:'clickfx',     icon:'💥', label:d.lockerCats.clickfx,      names:d.shopClickFxNames,     equipped:[equippedClickFx] },
      { type:'emojipack',   icon:'🌈', label:d.lockerCats.emojipacks,   names:d.shopEmojiPackNames,   equipped:[equippedEmojiPack] },
      { type:'victoryban',  icon:'🏆', label:d.lockerCats.victorybans,  names:d.shopVictoryBanNames,  equipped:[equippedVictoryBan] },
      { type:'soundpack',   icon:'🔊', label:d.lockerCats.soundpacks,   names:d.shopSoundPackNames,   equipped:[equippedSoundPack] },
      { type:'emote',       icon:'😎', label:d.lockerCats.emotes,       names:d.shopEmoteNames,       equipped:Array.isArray(equippedEmotes) ? equippedEmotes : [] },
    ];
  }

  function _emoteAvailable(id) {
    if (EMOTE_PRICES[id] === 0) return true;
    const o = (window._shopOverrides || {})[id];
    if (o) return o.inShop && (!o.until || o.until > Date.now());
    return true; // disponible par défaut ; l'admin peut retirer
  }
  function _renderEmoteStore(d) {
    const owned = Array.isArray(ownedCosmetics) ? ownedCosmetics : [];
    const equipped = Array.isArray(equippedEmotes) ? equippedEmotes : [];
    const n = equipped.length;
    const slotStr = currentLang === 'fr' ? `${n}/5 équipées` : `${n}/5 equipped`;
    const ids = Object.keys(EMOTE_PRICES).filter(id => owned.includes(id) || _emoteAvailable(id));
    const rows = ids.map(id => {
      const def = EMOTE_DEFS[id] || {};
      const name = d.shopEmoteNames[id] || id;
      const isOwned = owned.includes(id);
      const eq = equipped.includes(id);
      const price = EMOTE_PRICES[id] || 0;
      const o = (window._shopOverrides || {})[id];
      const timer = (o && o.inShop && o.until && o.until > Date.now()) ? `<span class="locker-emote-timer">⏳ ${d.shopCountdown(o.until - Date.now())}</span>` : '';
      let btn;
      if (!isOwned) {
        btn = `<button class="locker-emote-buy" data-buyemote="${_escHtml(id)}">${price} ⚡</button>`;
      } else if (eq) {
        btn = `<button class="locker-eq-btn on" data-equip="${_escHtml(id)}" data-type="emote" data-on="1">${_escHtml(d.lockerUnequip)}</button>`;
      } else {
        const full = n >= 5;
        btn = `<button class="locker-eq-btn" data-equip="${_escHtml(id)}" data-type="emote" data-on="0" ${full ? 'disabled' : ''}>${_escHtml(d.lockerEquip)}</button>`;
      }
      return `<div class="locker-item${eq ? ' equipped' : ''}${isOwned ? '' : ' locker-emote-locked'}">
        <div class="locker-item-preview"><div class="shop-emoji-preview">${def.emoji || '😊'}</div></div>
        <span class="locker-item-name">${_escHtml(name)}${timer}</span>
        ${btn}
      </div>`;
    }).join('');
    return `
      <button class="locker-back-cats" data-back="1">← ${_escHtml(d.lockerBackCats)}</button>
      <h3 class="locker-detail-title">😎 ${_escHtml(d.lockerCats.emotes)} <small class="locker-emote-slots">${slotStr}</small></h3>
      <div class="locker-items-grid">${rows}</div>`;
  }

  function renderLocker() {
    const d  = t();
    const el = document.getElementById('locker-list');
    if (!el) return;
    if (!_named()) { el.innerHTML = `<p class="profile-anon">${_escHtml(d.profileAnon)}</p>`; return; }
    const owned = Array.isArray(ownedCosmetics) ? ownedCosmetics : [];
    const cats  = _lockerCategories(d);

    // Vue détail EMOTES : rayon dédié (achat + équipement), la seule boutique
    // où les émotes se vendent. Montre toutes les émotes disponibles.
    if (_lockerCat === 'emote') {
      el.innerHTML = _renderEmoteStore(d);
      return;
    }

    // Vue détail : les items d'une catégorie choisie (avec un retour aux cartes).
    if (_lockerCat) {
      const cat = cats.find(c => c.type === _lockerCat);
      const items = cat && cat.names ? owned.filter(id => cat.names[id]) : [];
      const rows = items.map(id => {
        const eq = cat.equipped.includes(id);
        const btnLabel = eq ? d.lockerUnequip : d.lockerEquip;
        return `<div class="locker-item${eq ? ' equipped' : ''}">
          <div class="locker-item-preview">${_cosmeticPreviewHtml(cat.type, id, cat.names[id])}</div>
          <span class="locker-item-name">${_escHtml(cat.names[id])}${eq ? ` <span class="locker-eq">${_escHtml(d.lockerEquipped)}</span>` : ''}</span>
          <button class="locker-eq-btn${eq ? ' on' : ''}" data-equip="${_escHtml(id)}" data-type="${cat.type}" data-on="${eq ? '1' : '0'}">${_escHtml(btnLabel)}</button>
        </div>`;
      }).join('');
      el.innerHTML = `
        <button class="locker-back-cats" data-back="1">← ${_escHtml(d.lockerBackCats)}</button>
        <h3 class="locker-detail-title">${cat ? cat.icon + ' ' + _escHtml(cat.label) : ''}</h3>
        <div class="locker-items-grid">${rows || `<p class="history-empty">${_escHtml(d.lockerEmpty)}</p>`}</div>`;
      return;
    }

    // Vue cartes : une carte par catégorie possédée.
    let html = '', total = 0;
    cats.forEach(cat => {
      if (!cat.names) return;
      const items = owned.filter(id => cat.names[id]);
      if (!items.length) return;
      total += items.length;
      const equippedCount = items.filter(id => cat.equipped.includes(id)).length;
      html += `<button class="locker-cat-card" data-cat="${cat.type}">
        <span class="locker-cat-ic">${cat.icon}</span>
        <span class="locker-cat-label">${_escHtml(cat.label)}</span>
        <span class="locker-cat-meta"><span class="locker-count">${items.length}</span>${equippedCount ? `<span class="locker-cat-eq">${_escHtml(d.lockerEquipped)}</span>` : ''}</span>
      </button>`;
    });
    if (honorTitle) {
      const hn = d.honorTitleNames?.[honorTitle] || honorTitle;
      html += `<div class="locker-cat-card locker-cat-card-static">
        <span class="locker-cat-ic">🥇</span>
        <span class="locker-cat-label">${_escHtml(d.lockerCats.honorary)}</span>
        <span class="locker-honor-name">${_escHtml(hn)} <span class="locker-eq">${_escHtml(d.lockerEquipped)}</span></span>
      </div>`;
      total++;
    }
    el.innerHTML = total ? `<div class="locker-cards">${html}</div>` : `<p class="history-empty">${_escHtml(d.lockerEmpty)}</p>`;
  }

  // Clics sur le casier : ouvrir une catégorie (carte), revenir, ou équiper.
  document.getElementById('locker-list')?.addEventListener('click', e => {
    if (e.target.closest('.locker-back-cats')) { _lockerCat = null; renderLocker(); return; }
    const card = e.target.closest('.locker-cat-card');
    if (card && !card.classList.contains('locker-cat-card-static')) {
      _lockerCat = card.dataset.cat;
      renderLocker();
      return;
    }
    const buyEmote = e.target.closest('.locker-emote-buy');
    if (buyEmote) {
      buyEmote.disabled = true;
      socket.emit('buy-cosmetic', { cosmeticId: buyEmote.dataset.buyemote, playerId: getPlayerId() });
      return;
    }
    const eqBtn = e.target.closest('.locker-eq-btn');
    if (eqBtn) {
      const id = eqBtn.dataset.equip, type = eqBtn.dataset.type, on = eqBtn.dataset.on === '1';
      if (type === 'emote') socket.emit('equip-cosmetic', { cosmeticId: id, type: 'emote', playerId: getPlayerId(), remove: on });
      else if (on)          socket.emit('equip-cosmetic', { cosmeticId: null, type, playerId: getPlayerId() });
      else                  socket.emit('equip-cosmetic', { cosmeticId: id, type, playerId: getPlayerId() });
      eqBtn.disabled = true; // le résultat serveur relance renderLocker()
    }
  });

  // Cartes du profil qui mènent à leur page dédiée + modal de récupération.
  document.getElementById('go-locker')?.addEventListener('click', () => showScreen('locker'));
  document.getElementById('go-emotes')?.addEventListener('click', () => { _lockerPendingCat = 'emote'; showScreen('locker'); });
  document.getElementById('go-history')?.addEventListener('click', () => showScreen('history'));
  document.getElementById('btn-back-locker')?.addEventListener('click', () => showScreen('profile'));
  document.getElementById('btn-back-history')?.addEventListener('click', () => showScreen('profile'));

  // Pastille sur l'onglet Profil quand au moins un défi est réclamable.
  function updateBadge() {
    const badge = document.getElementById('profile-card-badge');
    if (!badge) return;
    const claimable = challenges.filter(c => c.done && !c.claimed).length
                    + permanent.filter(c => c.done && !c.claimed).length;
    if (claimable > 0 && _named()) { badge.textContent = claimable; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  }

  function setChallenges(list, perm) { challenges = Array.isArray(list) ? list : []; if (perm !== undefined) permanent = Array.isArray(perm) ? perm : []; renderChallenges(); updateBadge(); }
  function setStreak(s)        { streak = s; renderStreak(); }
  function setHistory(list)    { history = Array.isArray(list) ? list : []; loadedHistory = true; renderHistory(); }
  function retexte() {
    const s = sessionStorage.getItem('libero_screen');
    if (s === 'profile') { renderStreak(); renderChallenges(); }
    else if (s === 'locker')  renderLocker();
    else if (s === 'history') renderHistory();
    updateBadge();
  }

  return { open, enter, enterLocker, enterHistory, setChallenges, setStreak, setHistory, retexte, updateBadge, renderLocker };
})();
window._profileHub = ProfileHub;

// ── Sauvegarde / restauration de progression (code de récupération) ──────────
// Le code EST l'identifiant du joueur (libero_player_id). Le sauvegarder permet
// de retrouver toute sa progression sur un autre appareil.
(function initRecovery() {
  const overlay = document.getElementById('overlay-recovery');
  if (!overlay) return;
  const codeInput    = document.getElementById('recovery-code');
  const openBtn      = document.getElementById('go-recovery');
  const closeBtn     = document.getElementById('btn-recovery-close');
  const copyBtn      = document.getElementById('btn-recovery-copy');
  const restoreBtn   = document.getElementById('btn-recovery-restore');
  const restoreInput = document.getElementById('recovery-input-field');

  function openModal() {
    if (codeInput) codeInput.value = getPlayerId();
    if (restoreInput) restoreInput.value = '';
    const hint = document.getElementById('recovery-restore-hint');
    if (hint) { hint.textContent = t().recovery.restoreHint; hint.classList.remove('recovery-err'); }
    overlay.classList.remove('hidden');
  }
  function closeModal() { overlay.classList.add('hidden'); }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  copyBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(codeInput.value).then(() => {
      copyBtn.textContent = t().codeCopied;
      setTimeout(() => { copyBtn.textContent = t().recovery.copy; }, 2000);
    }).catch(() => {});
  });

  restoreBtn?.addEventListener('click', () => {
    const raw  = (restoreInput.value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const hint = document.getElementById('recovery-restore-hint');
    if (raw.length < 8) {
      if (hint) { hint.textContent = t().recovery.invalid; hint.classList.add('recovery-err'); }
      return;
    }
    if (raw === getPlayerId()) { closeModal(); return; } // c'est déjà ce compte
    if (!confirm(t().recovery.confirm)) return;
    window._tutoSkipAll?.(); // un joueur qui restaure connaît déjà le site
    localStorage.setItem('libero_player_id', raw);
    localStorage.removeItem('playerName'); // sera restauré depuis le serveur
    location.reload();
  });
})();

// ── Réinitialiser le compte ──────────────────────────────────────────────────
// Repart avec un identifiant tout neuf (état vierge). La progression précédente
// reste récupérable via le code de récupération : on invite donc à le copier
// d'abord, sans l'imposer.
(function initReset() {
  const overlay = document.getElementById('overlay-reset');
  if (!overlay) return;
  const openBtn    = document.getElementById('go-reset');
  const closeBtn   = document.getElementById('btn-reset-close');
  const codeInput  = document.getElementById('reset-code');
  const copyBtn    = document.getElementById('btn-reset-copy');
  const check      = document.getElementById('reset-confirm-check');
  const confirmBtn = document.getElementById('btn-reset-confirm');

  function open()  { codeInput.value = getPlayerId(); check.checked = false; confirmBtn.disabled = true; overlay.classList.remove('hidden'); }
  function close() { overlay.classList.add('hidden'); }
  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  check?.addEventListener('change', () => { confirmBtn.disabled = !check.checked; });
  copyBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(codeInput.value).then(() => {
      copyBtn.textContent = t().codeCopied;
      setTimeout(() => { copyBtn.textContent = t().recovery.copy; }, 2000);
    }).catch(() => {});
  });
  confirmBtn?.addEventListener('click', () => {
    if (!check.checked) return;
    confirmBtn.disabled = true;
    // Remise a neuf totale : le serveur efface la progression et retire le
    // joueur de tous les classements, puis on vide TOUT le stockage local.
    // Au rechargement, le site se comporte comme pour un tout nouveau venu
    // (animation de bienvenue et onboarding compris).
    const wipe = () => {
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      location.reload();
    };
    let done = false;
    socket.once('reset-account-result', () => { if (!done) { done = true; wipe(); } });
    socket.emit('reset-account', { playerId: getPlayerId() });
    // Filet de securite si le serveur ne repond pas (hors-ligne) : on efface
    // quand meme localement.
    setTimeout(() => { if (!done) { done = true; wipe(); } }, 4000);
  });
})();

// ── Coucou de retour : absent 2 jours ou plus -> rappel des défis du jour ────
(() => {
  try {
    const KEY = 'libero_last_seen';
    const last = parseInt(localStorage.getItem(KEY) || '0', 10);
    const named = (localStorage.getItem('playerName') || '').trim();
    if (last && named && Date.now() - last >= 2 * 86_400_000) {
      setTimeout(() => showCursorSnakeToast(t().welcomeBackToast), 2500);
    }
    localStorage.setItem(KEY, String(Date.now()));
  } catch (e) {}
})();

// ── Parrainage : carte du profil + modal du lien d'invitation ─────────────────
(function initReferral() {
  const overlay = document.getElementById('overlay-referral');
  if (!overlay) return;
  const linkIn  = document.getElementById('referral-link');
  const countEl = document.getElementById('referral-count');
  function open() {
    const code = window._myRefCode || '';
    linkIn.value = code ? `${location.origin}${location.pathname}?ami=${code}` : '…';
    const n = window._myReferrals || 0;
    countEl.textContent = n > 0 ? t().referralCount(n) : '';
    overlay.classList.remove('hidden');
  }
  function close() { overlay.classList.add('hidden'); }
  document.getElementById('go-referral')?.addEventListener('click', open);
  document.getElementById('btn-referral-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-referral-copy')?.addEventListener('click', function () {
    navigator.clipboard.writeText(linkIn.value).then(() => {
      this.textContent = t().codeCopied;
      setTimeout(() => { this.textContent = t().recovery.copy; }, 2000);
    }).catch(() => {});
  });
  document.getElementById('btn-referral-share')?.addEventListener('click', function () {
    const txt = t().referralShareText(linkIn.value);
    if (navigator.share) navigator.share({ title: t().referralShareTitle, text: txt }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => {
      this.textContent = t().linkCopied;
      setTimeout(() => { this.textContent = t().referralShareBtn; }, 2000);
    }).catch(() => {});
  });
})();

// ── Niveaux et XP ─────────────────────────────────────────────────────────────
// Courbe identique au serveur : niveau lv atteint a 100 x (lv-1)^2 XP.
window._renderLevel = function () {
  const lv = window._myLevel || 1;
  const xp = window._myXp || 0;
  const badge = document.getElementById('level-badge');
  const main  = document.getElementById('level-main');
  const sub   = document.getElementById('level-sub');
  const fill  = document.getElementById('level-bar-fill');
  if (!badge) return;
  const cur  = 100 * (lv - 1) * (lv - 1);
  const next = 100 * lv * lv;
  badge.textContent = `⭐ ${lv}`;
  if (main) main.textContent = t().levelMain(lv);
  if (sub)  sub.textContent  = t().levelSub(xp, next);
  if (fill) fill.style.width = `${Math.min(100, Math.round(((xp - cur) / (next - cur)) * 100))}%`;
  // Palette de la bande selon le palier de niveau (de plus en plus prestigieuse).
  const banner = document.getElementById('level-banner');
  if (banner) {
    const tier = lv >= 50 ? 5 : lv >= 30 ? 4 : lv >= 15 ? 3 : lv >= 5 ? 2 : 1;
    banner.className = 'level-banner level-tier-' + tier;
  }
};
socket.on('xp-update', ({ xp, level, levelUp, reward } = {}) => {
  window._myXp = xp; window._myLevel = level;
  window._renderLevel();
  if (levelUp) { showCursorSnakeToast(t().levelUpToast(levelUp, reward || 0)); if (typeof celebrate === 'function') celebrate(); }
});

// ── Roue de la fortune (1 tour par jour) ─────────────────────────────────────
(function initWheel() {
  const overlay = document.getElementById('overlay-wheel');
  if (!overlay) return;
  const PRIZES = [5, 10, 20, 50, 100, 250]; // meme ordre que le serveur
  const COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#0ea5e9', '#a855f7'];
  const disc = document.getElementById('wheel-disc');
  const spinBtn = document.getElementById('btn-wheel-spin');
  const statusEl = document.getElementById('wheel-status');
  let spinning = false, rotation = 0;
  // Disque : 6 parts en conic-gradient + libelles positionnes par rotation.
  disc.style.background = `conic-gradient(${PRIZES.map((_, i) => `${COLORS[i]} ${i * 60}deg ${(i + 1) * 60}deg`).join(',')})`;
  disc.innerHTML = PRIZES.map((p, i) =>
    `<span class="wheel-label" style="transform:rotate(${i * 60 + 30}deg) translateY(-58px) rotate(90deg)">${p}⚡</span>`).join('');
  function open() {
    statusEl.textContent = '';
    spinBtn.disabled = false;
    overlay.classList.remove('hidden');
  }
  function close() { overlay.classList.add('hidden'); }
  document.getElementById('go-wheel')?.addEventListener('click', open);
  document.getElementById('btn-wheel-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay && !spinning) close(); });
  spinBtn.addEventListener('click', () => {
    if (spinning) return;
    spinning = true; spinBtn.disabled = true; statusEl.textContent = '';
    socket.emit('spin-wheel', { playerId: getPlayerId() });
  });
  socket.on('wheel-result', ({ error, index, prize, balance } = {}) => {
    if (error) {
      spinning = false;
      statusEl.textContent = error === 'done' ? t().wheelDone : t().wheelNoName;
      return;
    }
    // 5 tours complets + arret au centre du segment gagnant sous le pointeur.
    rotation += 360 * 5 + ((360 - (index * 60 + 30)) - (rotation % 360) + 360) % 360;
    disc.style.transition = 'transform 3.4s cubic-bezier(.15,.6,.15,1)';
    disc.style.transform = `rotate(${rotation}deg)`;
    setTimeout(() => {
      spinning = false;
      statusEl.textContent = t().wheelWin(prize);
      if (balance !== undefined) { const prev = libsBalance; libsBalance = balance; _refreshLibsUI(prev, balance, prize); }
    }, 3500);
  });
})();

// ── Liste d'amis ──────────────────────────────────────────────────────────────
(function initFriends() {
  const overlay = document.getElementById('overlay-friends');
  if (!overlay) return;
  const listEl = document.getElementById('friends-list');
  const statusEl = document.getElementById('friends-status');
  const input = document.getElementById('friend-code-input');
  window._myFriends = [];
  function open() {
    statusEl.textContent = window._myRefCode ? t().friendsMyCode(window._myRefCode) : '';
    listEl.innerHTML = '<p class="recovery-warn">…</p>';
    socket.emit('get-friends', { playerId: getPlayerId() });
    overlay.classList.remove('hidden');
  }
  function close() { overlay.classList.add('hidden'); }
  document.getElementById('go-friends')?.addEventListener('click', open);
  document.getElementById('btn-friends-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-friend-add')?.addEventListener('click', () => {
    const code = (input.value || '').trim().toLowerCase();
    if (code.length !== 8) { statusEl.textContent = t().friendsErrInvalid; return; }
    socket.emit('add-friend', { playerId: getPlayerId(), ref: code });
    input.value = '';
  });
  socket.on('friends-list', ({ friends, requests } = {}) => {
    window._myFriends = friends || [];
    window._myFriendRequests = requests || [];
    const list = window._myFriends;
    const reqs = window._myFriendRequests;
    // En-tete « Demandes en attente » (Accepter / Refuser), puis la liste d'amis.
    const reqHtml = reqs.length ? `
      <p class="friends-section-label">${t().friendsPendingLabel}</p>
      ${reqs.map(r => `
        <div class="friend-row friend-req-row">
          <span class="friend-dot"></span>
          <span class="friend-name">${_escHtml(r.name)} <small class="friend-level">⭐ ${r.level}</small></span>
          <button class="btn btn-primary friend-req-accept" data-ref="${r.ref}" data-name="${_escHtml(r.name)}">${t().friendReqAccept}</button>
          <button class="btn btn-secondary friend-req-decline" data-ref="${r.ref}">${t().friendReqDecline}</button>
        </div>`).join('')}
      <p class="friends-section-label">${t().friendsListLabel}</p>` : '';
    const listHtml = list.length ? list.map(f => `
      <div class="friend-row">
        <span class="friend-dot ${f.online ? 'on' : ''}" title="${f.online ? t().friendsOnline : t().friendsOffline}"></span>
        <span class="friend-name">${_escHtml(f.name)} <small class="friend-level">⭐ ${f.level}</small></span>
        <button class="btn btn-secondary friend-gift" data-ref="${f.ref}" data-name="${_escHtml(f.name)}" title="🎁">🎁</button>
        <button class="friend-remove" data-rm="${f.ref}" title="${t().friendsRemoveBtn}">✕</button>
      </div>`).join('') : `<p class="recovery-warn">${t().friendsEmpty}</p>`;
    listEl.innerHTML = reqHtml + listHtml;
  });
  socket.on('friends-error', ({ reason } = {}) => {
    statusEl.textContent = reason === 'notfound' ? t().friendsErrNotFound
      : reason === 'full' ? t().friendsErrFull
      : reason === 'already' ? t().friendsErrAlready
      : reason === 'noname' ? t().friendsErrNoName
      : t().friendsErrInvalid;
  });
  // Demande d'ami envoyee (ou acceptation automatique si l'autre m'avait demande).
  socket.on('friend-request-sent', ({ name, accepted } = {}) => {
    const msg = accepted ? t().friendRequestAccepted(name) : t().friendRequestSent(name);
    if (!overlay.classList.contains('hidden')) statusEl.textContent = msg;
    showCursorSnakeToast(msg);
  });
  socket.on('friend-accepted', ({ name } = {}) => showCursorSnakeToast(t().friendRequestAccepted(name)));
  listEl.addEventListener('click', e => {
    const acc = e.target.closest('.friend-req-accept');
    if (acc) {
      socket.emit('respond-friend', { playerId: getPlayerId(), ref: acc.dataset.ref, accept: true });
      statusEl.textContent = t().friendRequestAccepted(acc.dataset.name);
      socket.emit('get-friends', { playerId: getPlayerId() });
      return;
    }
    const dec = e.target.closest('.friend-req-decline');
    if (dec) {
      socket.emit('respond-friend', { playerId: getPlayerId(), ref: dec.dataset.ref, accept: false });
      socket.emit('get-friends', { playerId: getPlayerId() });
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) { socket.emit('remove-friend', { playerId: getPlayerId(), ref: rm.dataset.rm }); return; }
    const g = e.target.closest('.friend-gift');
    if (g) window._openFriendGift?.(g.dataset.ref, g.dataset.name);
  });
  // Salon cree pour un defi d'ami : on transmet le code puis on attend.
  socket.on('room-created', ({ code, gameType } = {}) => {
    const p = window._pendingFriendChallenge;
    if (!p || !code) return;
    window._pendingFriendChallenge = null;
    socket.emit('challenge-friend', { playerId: getPlayerId(), ref: p.ref, code, game: gameType });
    showCursorSnakeToast(t().friendsChallengeSent(p.name));
  });
  socket.on('trivia-room-created', ({ code } = {}) => {
    const p = window._pendingFriendChallenge;
    if (!p || !code) return;
    window._pendingFriendChallenge = null;
    socket.emit('challenge-friend', { playerId: getPlayerId(), ref: p.ref, code, game: 'quiz' });
    showCursorSnakeToast(t().friendsChallengeSent(p.name));
  });
  // Defi recu : banniere avec Accepter / Ignorer.
  socket.on('friend-challenge', ({ fromName, code, game } = {}) => {
    if (!code) return;
    window._sound?.play('notify'); // defi d'ami recu
    document.getElementById('friend-challenge-banner')?.remove();
    const gameLabel = game === 'quiz' ? (currentLang === 'fr' ? 'Quiz' : 'Quiz') : (t().games[game] || game);
    const div = document.createElement('div');
    div.id = 'friend-challenge-banner';
    div.className = 'friend-challenge-banner';
    div.innerHTML = `<span>${t().friendChallengeToast(_escHtml(fromName))} <small>(${_escHtml(gameLabel)})</small></span>
      <button class="btn btn-primary" id="fc-accept">${t().friendChallengeAccept}</button>
      <button class="btn btn-secondary" id="fc-decline">${t().friendChallengeDecline}</button>`;
    document.body.appendChild(div);
    const gone = () => div.remove();
    div.querySelector('#fc-accept').addEventListener('click', () => {
      gone();
      socket.emit('join-by-code', { code, name: getPlayerName() || (localStorage.getItem('playerName') || '').trim(), playerId: getPlayerId() });
    });
    div.querySelector('#fc-decline').addEventListener('click', gone);
    setTimeout(gone, 25000);
  });
  // Demande d'ami recue : banniere bloquante Accepter / Refuser (file d'attente).
  const reqQueue = [];
  let reqShowing = false;
  function showNextRequest() {
    if (reqShowing || !reqQueue.length) return;
    const r = reqQueue.shift();
    reqShowing = true;
    document.getElementById('friend-request-banner')?.remove();
    const div = document.createElement('div');
    div.id = 'friend-request-banner';
    div.className = 'friend-challenge-banner';
    div.innerHTML = `<span>${t().friendRequestFrom(_escHtml(r.name))} <small>⭐ ${r.level || 1}</small></span>
      <button class="btn btn-primary" id="fr-accept">${t().friendReqAccept}</button>
      <button class="btn btn-secondary" id="fr-decline">${t().friendReqDecline}</button>`;
    document.body.appendChild(div);
    const done = accept => {
      div.remove();
      reqShowing = false;
      socket.emit('respond-friend', { playerId: getPlayerId(), ref: r.ref, accept });
      showNextRequest();
    };
    div.querySelector('#fr-accept').addEventListener('click', () => done(true));
    div.querySelector('#fr-decline').addEventListener('click', () => done(false));
  }
  socket.on('friend-request', r => { if (r && r.ref) { window._sound?.play('notify'); reqQueue.push(r); showNextRequest(); } });
  socket.on('friend-requests', ({ requests } = {}) => {
    (requests || []).forEach(r => { if (!reqQueue.some(x => x.ref === r.ref)) reqQueue.push(r); });
    showNextRequest();
  });
})();

// ── Cadeau recu : message bloquant avec bouton OK ────────────────────────────
(function initGiftReceived() {
  const overlay = document.getElementById('overlay-giftrecv');
  if (!overlay) return;
  const queue = [];
  const seen = new Set();
  let showing = null;
  function showNext() {
    if (showing || !queue.length) return;
    showing = queue.shift();
    const d = t();
    document.getElementById('giftrecv-title').textContent = d.giftRecvTitle;
    const g = showing;
    document.getElementById('giftrecv-msg').textContent =
      g.vip ? d.giftRecvVip(g.fromName)
      : (g.libs > 0 && g.cosmeticId) ? d.giftRecvBoth(g.fromName, g.libs)
      : g.libs > 0 ? d.giftRecvLibs(g.fromName, g.libs)
      : d.giftRecvCosm(g.fromName);
    overlay.classList.remove('hidden');
  }
  document.getElementById('btn-giftrecv-ok')?.addEventListener('click', () => {
    window._sound?.play('success'); // ouverture du cadeau
    if (showing) socket.emit('gift-ack', { playerId: getPlayerId(), giftId: showing.id });
    showing = null;
    overlay.classList.add('hidden');
    // Le solde a pu changer : on resynchronise.
    socket.emit('get-libs', { playerId: getPlayerId() });
    showNext();
  });
  socket.on('gift-received', g => {
    if (!g || !g.id || seen.has(g.id)) return;
    seen.add(g.id);
    window._sound?.play('notify'); // arrivee du cadeau
    queue.push(g);
    showNext();
  });
})();

// ── Sons declenches par evenements : coin sur gain de Libs, pop a l'ouverture ─
// d'un overlay/modal (via MutationObserver, sans editer chaque point d'ouverture).
try {
  socket.on('libs-update', ({ delta } = {}) => { if (delta > 0) { try { window._sound?.play('coin'); } catch {} } });
} catch {}
(function initOverlayPop() {
  try {
    const shown = new WeakSet();
    const check = el => {
      const vis = !el.classList.contains('hidden');
      if (vis && !shown.has(el)) { shown.add(el); window._sound?.play('pop'); }
      else if (!vis) shown.delete(el);
    };
    const obs = new MutationObserver(ms => { for (const m of ms) if (m.attributeName === 'class') check(m.target); });
    document.querySelectorAll('.overlay, #overlay-shop').forEach(el => {
      if (!el.classList.contains('hidden')) shown.add(el);
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  } catch {}
})();

// ── Offrir des Libs a un ami ─────────────────────────────────────────────────
(function initFriendGift() {
  const overlay = document.getElementById('overlay-friendgift');
  if (!overlay) return;
  const confirmBtn = document.getElementById('btn-friendgift-confirm');
  const vipBtn = document.getElementById('friendgift-vip');
  const statusEl = document.getElementById('friendgift-status');
  let ref = null, friendName = '', pending = null; // pending = { kind:'libs'|'vip', amount }
  function clearSel() {
    document.querySelectorAll('#friendgift-amounts .stake-btn, #friendgift-vip').forEach(b => b.classList.remove('active'));
    pending = null;
    confirmBtn.classList.add('hidden');
  }
  window._openFriendGift = (r, name) => {
    ref = r; friendName = name || '';
    document.getElementById('friendgift-title').textContent = t().friendsGiftTitle(friendName);
    document.getElementById('friendgift-libs-label').textContent = t().friendsGiftLibsLabel;
    document.getElementById('friendgift-vip-label').textContent = t().friendsGiftVipLabel;
    vipBtn.textContent = t().friendsGiftVipBtn(VIP_PRICE);
    statusEl.textContent = '';
    clearSel();
    overlay.classList.remove('hidden');
  };
  const close = () => overlay.classList.add('hidden');
  document.getElementById('btn-friendgift-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  // 1er clic = sélection (met en surbrillance) + affiche le bouton de confirmation.
  document.getElementById('friendgift-amounts')?.addEventListener('click', e => {
    const b = e.target.closest('[data-amt]');
    if (!b || !ref) return;
    clearSel();
    b.classList.add('active');
    pending = { kind: 'libs', amount: Number(b.dataset.amt) };
    confirmBtn.textContent = t().friendsGiftConfirm(pending.amount + ' ⚡', friendName);
    confirmBtn.classList.remove('hidden');
    statusEl.textContent = '';
  });
  vipBtn?.addEventListener('click', () => {
    if (!ref) return;
    clearSel();
    vipBtn.classList.add('active');
    pending = { kind: 'vip' };
    confirmBtn.textContent = t().friendsGiftConfirm(t().friendsGiftVipShort(VIP_PRICE), friendName);
    confirmBtn.classList.remove('hidden');
    statusEl.textContent = '';
  });
  // 2e clic (confirmation) = envoi réel.
  confirmBtn?.addEventListener('click', () => {
    if (!pending || !ref) return;
    confirmBtn.disabled = true;
    if (pending.kind === 'vip') socket.emit('gift-vip', { playerId: getPlayerId(), ref });
    else socket.emit('gift-friend', { playerId: getPlayerId(), ref, amount: pending.amount });
  });
  socket.on('gift-friend-result', ({ ok, error, amount, name, left } = {}) => {
    confirmBtn.disabled = false;
    if (ok) { close(); showCursorSnakeToast(t().friendsGiftSent(amount, name)); return; }
    statusEl.textContent = error === 'daily' ? t().friendsGiftErrDaily(left ?? 0)
      : error === 'insufficient' ? t().friendsGiftErrInsufficient
      : t().friendsErrInvalid;
    clearSel();
  });
  socket.on('gift-vip-result', ({ ok, error, name } = {}) => {
    confirmBtn.disabled = false;
    if (ok) { close(); showCursorSnakeToast(t().friendsGiftVipSent(name)); return; }
    statusEl.textContent = error === 'insufficient' ? t().vipInsufficient(VIP_PRICE)
      : error === 'targetmax' ? t().friendsGiftVipTargetMax(name)
      : error === 'notfriend' ? t().friendsErrInvalid
      : t().friendsErrInvalid;
    clearSel();
  });
})();

// ── Defier un ami depuis les zones Jeux classiques et Quiz ───────────────────
(function initFriendPick() {
  const overlay = document.getElementById('overlay-friendpick');
  if (!overlay) return;
  const listEl = document.getElementById('friendpick-list');
  let mode = 'classic'; // 'classic' | 'quiz'
  function open(m) {
    mode = m;
    document.getElementById('friendpick-title').textContent = t().friendPickTitle;
    listEl.innerHTML = '<p class="recovery-warn">…</p>';
    socket.emit('get-friends', { playerId: getPlayerId() });
    // friends-list global (initFriends) remplit window._myFriends ; on re-rend juste apres.
    setTimeout(render, 400);
    overlay.classList.remove('hidden');
  }
  function render() {
    const online = (window._myFriends || []).filter(f => f.online);
    listEl.innerHTML = online.length ? online.map(f => `
      <div class="friend-row">
        <span class="friend-dot on"></span>
        <span class="friend-name">${_escHtml(f.name)} <small class="friend-level">⭐ ${f.level}</small></span>
        <button class="btn btn-primary friend-pick-go" data-ref="${f.ref}" data-name="${_escHtml(f.name)}">${t().friendsChallengeBtn}</button>
      </div>`).join('') : `<p class="recovery-warn">${t().friendPickNone}</p>`;
  }
  const close = () => overlay.classList.add('hidden');
  document.getElementById('btn-friendpick-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  listEl.addEventListener('click', e => {
    const b = e.target.closest('.friend-pick-go');
    if (!b) return;
    window._pendingFriendChallenge = { ref: b.dataset.ref, name: b.dataset.name };
    close();
    if (mode === 'classic') {
      socket.emit('create-room', { gameType: selectedGameType, name: getPlayerName(), playerId: getPlayerId(), stake: window._selectedStake || 0 });
    } else {
      socket.emit('create-trivia-room', { categories: selectedTriviaCategories, name: getTriviaName(), lang: currentLang, difficulty: selectedTriviaDifficulty, amount: getTriviaQCount(), playerId: getPlayerId() });
    }
  });
  document.getElementById('btn-challenge-friend')?.addEventListener('click', () => {
    if (!selectedGameType) { showCursorSnakeToast(t().friendPickNeedGame); return; }
    open('classic');
  });
  document.getElementById('btn-challenge-friend-quiz')?.addEventListener('click', () => {
    if (!selectedTriviaCategories.length) { showCursorSnakeToast(t().friendPickNeedTheme); return; }
    open('quiz');
  });
})();

// ── Fiche joueur (clic sur un pseudo dans les classements) ───────────────────
(function initPlayerCard() {
  const overlay = document.getElementById('overlay-playercard');
  if (!overlay) return;
  let current = null;
  window._openPlayerCard = (name) => {
    if (!name) return;
    current = name;
    document.getElementById('playercard-name').textContent = name;
    document.getElementById('playercard-level').textContent = '…';
    document.getElementById('playercard-status').textContent = '';
    document.getElementById('btn-playercard-add').classList.add('hidden');
    overlay.classList.remove('hidden');
    socket.emit('get-player-card', { playerId: getPlayerId(), name });
  };
  const close = () => overlay.classList.add('hidden');
  document.getElementById('btn-playercard-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  socket.on('player-card', (c = {}) => {
    if (!current || c.name !== current) return;
    const d = t();
    const lvl = document.getElementById('playercard-level');
    const st = document.getElementById('playercard-status');
    const btn = document.getElementById('btn-playercard-add');
    if (c.notFound) { lvl.textContent = ''; st.textContent = d.friendsErrNotFound; return; }
    lvl.textContent = d.playerCardLevel(c.level || 1) + (c.vip ? ' · ' + d.playerCardVip : '');
    st.textContent = (c.online ? d.playerCardOnline : d.playerCardOffline)
      + (c.isMe ? ' · ' + d.playerCardYou : c.isFriend ? ' · ' + d.playerCardFriends : c.requested ? ' · ' + d.playerCardRequested : '');
    if (!c.isMe && !c.isFriend && !c.requested) {
      btn.textContent = d.playerCardAddFriend;
      btn.classList.remove('hidden');
    }
  });
  document.getElementById('btn-playercard-add')?.addEventListener('click', function () {
    if (!current) return;
    socket.emit('add-friend', { playerId: getPlayerId(), name: current });
    this.classList.add('hidden');
    document.getElementById('playercard-status').textContent = t().playerCardRequested;
  });
})();

// ── Test de QI (approximatif et ludique) ─────────────────────────────────────
const IQ_UNLOCK_QUIZZES = 10;
const IQ_QUESTIONS = [
  { q:{fr:'Quel nombre complète la suite : 2, 4, 8, 16, … ?',en:'Which number completes the sequence: 2, 4, 8, 16, …?'}, c:['24','32','30','20'], a:1 },
  { q:{fr:'Quel nombre complète la suite : 1, 4, 9, 16, 25, … ?',en:'Which number completes the sequence: 1, 4, 9, 16, 25, …?'}, c:['30','35','36','49'], a:2 },
  { q:{fr:'Main est à gant ce que pied est à…',en:'Hand is to glove as foot is to…'}, c:[{fr:'jambe',en:'leg'},{fr:'chaussure',en:'shoe'},{fr:'orteil',en:'toe'},{fr:'sol',en:'ground'}], a:1 },
  { q:{fr:'Trouve l\'intrus : pomme, banane, carotte, mangue',en:'Find the odd one out: apple, banana, carrot, mango'}, c:[{fr:'pomme',en:'apple'},{fr:'banane',en:'banana'},{fr:'carotte',en:'carrot'},{fr:'mangue',en:'mango'}], a:2 },
  { q:{fr:'Si tous les Zips sont des Zaps et que certains Zaps sont bleus, alors…',en:'If all Zips are Zaps and some Zaps are blue, then…'}, c:[{fr:'tous les Zips sont bleus',en:'all Zips are blue'},{fr:'certains Zips peuvent être bleus',en:'some Zips may be blue'},{fr:'aucun Zip n\'est bleu',en:'no Zip is blue'},{fr:'les Zaps sont des Zips',en:'Zaps are Zips'}], a:1 },
  { q:{fr:'Quel nombre complète la suite : 3, 6, 12, 24, … ?',en:'Which number completes the sequence: 3, 6, 12, 24, …?'}, c:['36','40','48','30'], a:2 },
  { q:{fr:'Un fermier a 17 moutons. Tous meurent sauf 9. Combien en reste-t-il ?',en:'A farmer has 17 sheep. All die except 9. How many are left?'}, c:['8','17','9','0'], a:2 },
  { q:{fr:'Quel mot n\'a pas sa place : courir, marcher, nager, dormir',en:'Which word does not belong: run, walk, swim, sleep'}, c:[{fr:'courir',en:'run'},{fr:'marcher',en:'walk'},{fr:'nager',en:'swim'},{fr:'dormir',en:'sleep'}], a:3 },
  { q:{fr:'Quel nombre complète la suite : 100, 90, 81, 73, … ?',en:'Which number completes the sequence: 100, 90, 81, 73, …?'}, c:['66','65','64','63'], a:0 },
  { q:{fr:'Marie est plus grande que Jean. Jean est plus grand que Paul. Qui est le plus petit ?',en:'Mary is taller than John. John is taller than Paul. Who is the shortest?'}, c:[{fr:'Marie',en:'Mary'},{fr:'Jean',en:'John'},{fr:'Paul',en:'Paul'},{fr:'impossible à dire',en:'cannot tell'}], a:2 },
  { q:{fr:'Quel nombre complète la suite : 1, 1, 2, 3, 5, 8, … ?',en:'Which number completes the sequence: 1, 1, 2, 3, 5, 8, …?'}, c:['11','12','13','14'], a:2 },
  { q:{fr:'Livre est à lire ce que fourchette est à…',en:'Book is to read as fork is to…'}, c:[{fr:'cuisine',en:'kitchen'},{fr:'manger',en:'eat'},{fr:'couteau',en:'knife'},{fr:'table',en:'table'}], a:1 },
  { q:{fr:'Combien de mois ont 28 jours ?',en:'How many months have 28 days?'}, c:['1','2','6','12'], a:3 },
  { q:{fr:'Quel nombre complète la suite : 2, 5, 11, 23, … ?',en:'Which number completes the sequence: 2, 5, 11, 23, …?'}, c:['46','47','45','44'], a:1 },
  { q:{fr:'Trouve l\'intrus : cercle, carré, triangle, cube',en:'Find the odd one out: circle, square, triangle, cube'}, c:[{fr:'cercle',en:'circle'},{fr:'carré',en:'square'},{fr:'triangle',en:'triangle'},{fr:'cube',en:'cube'}], a:3 },
  { q:{fr:'Si avant-hier était mercredi, quel jour serons-nous demain ?',en:'If the day before yesterday was Wednesday, what day is tomorrow?'}, c:[{fr:'vendredi',en:'Friday'},{fr:'samedi',en:'Saturday'},{fr:'dimanche',en:'Sunday'},{fr:'jeudi',en:'Thursday'}], a:1 },
  { q:{fr:'Quel nombre est le tiers de la moitié de 90 ?',en:'Which number is one third of half of 90?'}, c:['15','30','10','45'], a:0 },
  { q:{fr:'Océan est à eau ce que désert est à…',en:'Ocean is to water as desert is to…'}, c:[{fr:'chaleur',en:'heat'},{fr:'sable',en:'sand'},{fr:'soleil',en:'sun'},{fr:'chameau',en:'camel'}], a:1 },
  { q:{fr:'Quel nombre complète la suite : 64, 32, 16, 8, … ?',en:'Which number completes the sequence: 64, 32, 16, 8, …?'}, c:['6','2','4','3'], a:2 },
  { q:{fr:'Deux pères et deux fils ont 3 poissons, chacun en a un. Comment ?',en:'Two fathers and two sons have 3 fish, one each. How?'}, c:[{fr:'ils partagent',en:'they share'},{fr:'grand-père, père, fils',en:'grandfather, father, son'},{fr:'c\'est impossible',en:'it is impossible'},{fr:'un poisson est perdu',en:'one fish is lost'}], a:1 },
  { q:{fr:'Quel nombre complète la suite : 7, 10, 16, 28, … ?',en:'Which number completes the sequence: 7, 10, 16, 28, …?'}, c:['52','50','48','40'], a:0 },
  { q:{fr:'Trouve l\'intrus : violon, guitare, piano, flûte',en:'Find the odd one out: violin, guitar, piano, flute'}, c:[{fr:'violon',en:'violin'},{fr:'guitare',en:'guitar'},{fr:'piano',en:'piano'},{fr:'flûte',en:'flute'}], a:3 },
  { q:{fr:'Un train électrique roule vers le nord. Où va sa fumée ?',en:'An electric train heads north. Where does its smoke go?'}, c:[{fr:'vers le sud',en:'south'},{fr:'vers le nord',en:'north'},{fr:'il n\'y a pas de fumée',en:'there is no smoke'},{fr:'vers le haut',en:'up'}], a:2 },
  { q:{fr:'Quel nombre complète la suite : 1, 3, 7, 15, 31, … ?',en:'Which number completes the sequence: 1, 3, 7, 15, 31, …?'}, c:['62','63','64','61'], a:1 },
];
window._renderIqCard = function () {
  const sub = document.getElementById('iq-card-sub');
  if (!sub) return;
  if (window._myIq) sub.textContent = t().iqCardValue(window._myIq);
  else if (window._myIqUnlocked) sub.textContent = t().iqCardUnlocked;
  else sub.textContent = t().iqCardLocked(Math.max(1, IQ_UNLOCK_QUIZZES - (window._myIqQuizDone || 0)));
};
socket.on('iq-progress', ({ done, unlocked } = {}) => {
  window._myIqQuizDone = done || 0;
  if (unlocked) window._myIqUnlocked = true;
  window._renderIqCard();
});
(function initIqTest() {
  const overlay = document.getElementById('overlay-iq');
  if (!overlay) return;
  const introView = document.getElementById('iq-intro-view');
  const testView = document.getElementById('iq-test-view');
  const resultView = document.getElementById('iq-result-view');
  const introEl = document.getElementById('iq-intro');
  const startBtn = document.getElementById('btn-iq-start');
  let qs = [], qi = 0, correct = 0, times = [], qStart = 0, timer = null;
  const QN = 15, QSEC = 30;
  function open() {
    introView.classList.remove('hidden');
    testView.classList.add('hidden');
    resultView.classList.add('hidden');
    if (window._myIqUnlocked) {
      introEl.textContent = t().iqIntroReady;
      startBtn.classList.remove('hidden');
    } else {
      introEl.textContent = t().iqIntroLocked(Math.max(1, IQ_UNLOCK_QUIZZES - (window._myIqQuizDone || 0)));
      startBtn.classList.add('hidden');
    }
    overlay.classList.remove('hidden');
  }
  function close() { clearInterval(timer); overlay.classList.add('hidden'); }
  document.getElementById('go-iq')?.addEventListener('click', open);
  document.getElementById('btn-iq-close')?.addEventListener('click', close);
  function showQ() {
    if (qi >= qs.length) { finish(); return; }
    const item = qs[qi];
    const fr = currentLang === 'fr';
    document.getElementById('iq-progress').textContent = t().iqProgress(qi + 1, qs.length);
    document.getElementById('iq-question').textContent = fr ? item.q.fr : item.q.en;
    document.getElementById('iq-choices').innerHTML = item.c.map((c, i) =>
      `<button class="iq-choice" data-i="${i}">${_escHtml(typeof c === 'string' ? c : (fr ? c.fr : c.en))}</button>`).join('');
    qStart = Date.now();
    let left = QSEC;
    const timEl = document.getElementById('iq-timer');
    timEl.textContent = `${left}s`;
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      timEl.textContent = `${left}s`;
      if (left <= 0) { times.push(QSEC * 1000); qi++; showQ(); }
    }, 1000);
  }
  function finish() {
    clearInterval(timer);
    const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length));
    socket.emit('iq-submit', { playerId: getPlayerId(), correct, total: qs.length, avgMs });
    testView.classList.add('hidden');
    resultView.classList.remove('hidden');
    document.getElementById('iq-result-value').textContent = '…';
  }
  startBtn.addEventListener('click', () => {
    qs = shuffle([...IQ_QUESTIONS]).slice(0, QN);
    qi = 0; correct = 0; times = [];
    introView.classList.add('hidden');
    testView.classList.remove('hidden');
    showQ();
  });
  document.getElementById('iq-choices').addEventListener('click', e => {
    const btn = e.target.closest('.iq-choice');
    if (!btn) return;
    times.push(Date.now() - qStart);
    if (Number(btn.dataset.i) === qs[qi].a) correct++;
    qi++;
    showQ();
  });
  socket.on('iq-update', ({ iq, error, nextAt } = {}) => {
    if (error === 'cooldown') {
      const days = Math.max(1, Math.ceil((nextAt - Date.now()) / 86400000));
      introEl.textContent = t().iqCooldown(days + (currentLang === 'fr' ? ' jour(s)' : ' day(s)'));
      startBtn.classList.add('hidden');
      introView.classList.remove('hidden');
      testView.classList.add('hidden');
      resultView.classList.add('hidden');
      return;
    }
    if (error) return;
    window._myIq = iq;
    window._renderIqCard();
    document.getElementById('iq-result-value').textContent = t().iqResultValue(iq);
    document.getElementById('iq-result-note').textContent = t().iqResultNote;
  });
  document.getElementById('btn-iq-share')?.addEventListener('click', async function () {
    const text = t().iqShareText(window._myIq || '?');
    if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
    try { await navigator.clipboard.writeText(text); showCursorSnakeToast(t().triviaShareCopied); } catch {}
  });
})();

// ── Pass VIP ──────────────────────────────────────────────────────────────────
const VIP_PRICE = 2000;
window._renderVip = function () {
  const active = (window._myVipUntil || 0) > Date.now();
  document.getElementById('vip-badge')?.classList.toggle('hidden', !active);
  const status = document.getElementById('vip-status');
  if (status) status.textContent = active ? t().vipActive(new Date(window._myVipUntil).toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-GB')) : '';
};
(function initVip() {
  const overlay = document.getElementById('overlay-vip');
  if (!overlay) return;
  function open() {
    document.getElementById('vip-intro').textContent = t().vipIntro(VIP_PRICE);
    document.getElementById('vip-perks').innerHTML = t().vipPerks.map(p => `<li>${p}</li>`).join('');
    document.getElementById('btn-vip-buy').textContent = t().vipBuyBtn(VIP_PRICE);
    window._renderVip();
    overlay.classList.remove('hidden');
  }
  function close() { overlay.classList.add('hidden'); }
  document.getElementById('go-vip')?.addEventListener('click', open);
  document.getElementById('btn-vip-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-vip-buy')?.addEventListener('click', () => {
    socket.emit('buy-vip', { playerId: getPlayerId() });
  });
  socket.on('vip-result', ({ vipUntil, error, price } = {}) => {
    const status = document.getElementById('vip-status');
    if (error) {
      if (status) status.textContent = error === 'insufficient' ? t().vipInsufficient(price || VIP_PRICE)
        : error === 'max' ? t().vipMax : t().wheelNoName;
      return;
    }
    window._myVipUntil = vipUntil;
    window._renderVip();
    showCursorSnakeToast(t().vipDone);
  });
})();

// ── Pseudo obligatoire pour rejoindre via un lien d'invitation ────────────────
(function initJoinName() {
  const overlay = document.getElementById('overlay-joinname');
  if (!overlay) return;
  const input = document.getElementById('joinname-input');
  const btn   = document.getElementById('btn-joinname-go');
  const hint  = document.getElementById('joinname-hint');
  let code = null;
  window._askJoinName = c => {
    code = c;
    hint.textContent = '';
    hint.classList.remove('recovery-err');
    overlay.classList.remove('hidden');
    setTimeout(() => input?.focus(), 150);
  };
  function go() {
    const name = (input.value || '').trim().slice(0, 16);
    if (name.length < 2 || name.toLowerCase() === 'anonyme') {
      hint.textContent = t().joinName.invalid;
      hint.classList.add('recovery-err');
      return;
    }
    localStorage.setItem('playerName', name);
    const inp = document.getElementById('input-name');       if (inp) inp.value = name;
    const tin = document.getElementById('input-trivia-name'); if (tin) tin.value = name;
    overlay.classList.add('hidden');
    socket.emit('join-by-code', { code, name, playerId: getPlayerId() });
  }
  btn?.addEventListener('click', go);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
})();

// ── Pluie d'émojis : choix du thème + émojis personnalisés ──────────────────
(function initEmojiRainMenu() {
  const overlay = document.getElementById('overlay-emojirain');
  if (!overlay) return;
  const optionsEl  = document.getElementById('emojirain-options');
  const customWrap = document.getElementById('emojirain-custom-wrap');
  const customIn   = document.getElementById('emojirain-custom-input');
  const customHint = document.getElementById('emojirain-custom-hint');
  const PACK_PRICES = { 'emojipack-animals':10, 'emojipack-hearts':15, 'emojipack-party':25, 'emojipack-gaming':40, 'emojipack-cosmos':70 };

  function mode() { return localStorage.getItem('libero_emojirain_mode') || ''; }

  function render() {
    const d = t();
    const owned = Array.isArray(ownedCosmetics) ? ownedCosmetics : [];
    const curPack = localStorage.getItem('libero_equipped_emojipack') || '';
    const rows = [];
    const row = (id, icon, label, preview, selected, lockedPrice) => `
      <button type="button" class="emojirain-opt${selected ? ' selected' : ''}${lockedPrice ? ' locked' : ''}" data-opt="${id}">
        <span class="emojirain-opt-ic">${icon}</span>
        <span class="emojirain-opt-text"><span>${_escHtml(label)}</span><small>${preview}</small></span>
        ${lockedPrice ? `<span class="emojirain-unlock">${_escHtml(d.emojirain.unlock(lockedPrice))}</span>` : selected ? '<span class="emojirain-check">✓</span>' : ''}
      </button>`;
    rows.push(row('standard', '🎲', d.emojirain.standard, EMOJI_STANDARD.slice(0, 6).join(''), mode() !== 'custom' && !curPack, 0));
    Object.keys(EMOJI_PACK_SETS).forEach(pid => {
      const name = d.shopEmojiPackNames[pid] || pid;
      const has  = owned.includes(pid);
      rows.push(row(pid, '🌈', name, EMOJI_PACK_SETS[pid].slice(0, 6).join(''), has && mode() !== 'custom' && curPack === pid, has ? 0 : PACK_PRICES[pid]));
    });
    const customSel = mode() === 'custom';
    rows.push(row('custom', '✏️', d.emojirain.custom, _parseCustomEmojis(localStorage.getItem('libero_custom_emojis')).join('') || '…', customSel, 0));
    optionsEl.innerHTML = rows.join('');
    customWrap.classList.toggle('hidden', !customSel);
    if (customSel) customIn.value = localStorage.getItem('libero_custom_emojis') || '';
  }

  function open()  { customHint.textContent = ''; customHint.classList.remove('recovery-err'); render(); overlay.classList.remove('hidden'); }
  function close() { overlay.classList.add('hidden'); }
  document.getElementById('go-emojirain')?.addEventListener('click', open);
  document.getElementById('btn-emojirain-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  optionsEl?.addEventListener('click', e => {
    const btn = e.target.closest('.emojirain-opt');
    if (!btn) return;
    const id = btn.dataset.opt;
    if (id === 'standard') {
      localStorage.setItem('libero_emojirain_mode', 'standard');
      localStorage.setItem('libero_equipped_emojipack', '');
      socket.emit('equip-cosmetic', { cosmeticId: null, type: 'emojipack', playerId: getPlayerId() });
      render();
    } else if (id === 'custom') {
      localStorage.setItem('libero_emojirain_mode', 'custom');
      render();
      customIn?.focus();
    } else if (btn.classList.contains('locked')) {
      // Pack non possédé : achat direct depuis ce menu (même flux que la boutique).
      socket.emit('buy-cosmetic', { cosmeticId: id, playerId: getPlayerId() });
    } else {
      localStorage.setItem('libero_emojirain_mode', 'pack');
      localStorage.setItem('libero_equipped_emojipack', id);
      socket.emit('equip-cosmetic', { cosmeticId: id, type: 'emojipack', playerId: getPlayerId() });
      render();
    }
  });

  document.getElementById('btn-emojirain-save')?.addEventListener('click', () => {
    const list = _parseCustomEmojis(customIn.value);
    if (!list.length) {
      customHint.textContent = t().emojirain.customEmpty;
      customHint.classList.add('recovery-err');
      return;
    }
    localStorage.setItem('libero_custom_emojis', list.join(''));
    localStorage.setItem('libero_emojirain_mode', 'custom');
    customHint.classList.remove('recovery-err');
    customHint.textContent = t().emojirain.saved(list.length);
    render();
  });

  document.getElementById('btn-emojirain-test')?.addEventListener('click', () => window._playEmojiRain?.());

  // Un achat / équipement (fait ici ou en boutique) rafraîchit la liste.
  socket.on('buy-cosmetic-result',   () => { if (!overlay.classList.contains('hidden')) setTimeout(render, 200); });
  socket.on('equip-cosmetic-result', () => { if (!overlay.classList.contains('hidden')) setTimeout(render, 200); });
  window._emojiRainRetexte = () => { if (!overlay.classList.contains('hidden')) render(); };
})();

// ── Offrir depuis la boutique : choix de la méthode + confirmation ──────────
(function initGiftChoice() {
  const overlay = document.getElementById('overlay-giftchoice');
  if (!overlay) return;
  const methodsView = document.getElementById('giftchoice-methods');
  const friendsView = document.getElementById('giftchoice-friends');
  const confirmView = document.getElementById('giftchoice-confirm');
  const statusEl = document.getElementById('giftchoice-status');
  const confirmBtn = document.getElementById('btn-giftchoice-confirm');
  let payload = null, price = 0, itemName = '', deliverVia = null; // 'link'|'code'|friendRef
  function showView(v) {
    methodsView.classList.toggle('hidden', v !== 'methods');
    friendsView.classList.toggle('hidden', v !== 'friends');
    confirmView.classList.toggle('hidden', v !== 'confirm');
  }
  window._openGiftChoice = (pl, pr, name) => {
    payload = pl; price = pr || 0; itemName = name || ''; deliverVia = null;
    statusEl.textContent = '';
    document.getElementById('giftchoice-title').textContent = t().giftChoiceTitle(itemName);
    document.getElementById('giftchoice-intro').textContent = t().giftChoiceIntro(price);
    document.getElementById('giftchoice-friends-label').textContent = t().giftChoiceFriendsLabel;
    confirmBtn.disabled = false;
    showView('methods');
    overlay.classList.remove('hidden');
  };
  const close = () => overlay.classList.add('hidden');
  document.getElementById('btn-giftchoice-close')?.addEventListener('click', close);
  document.getElementById('btn-giftchoice-back')?.addEventListener('click', () => showView('methods'));
  document.getElementById('btn-giftchoice-back2')?.addEventListener('click', () => showView('methods'));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  methodsView.addEventListener('click', e => {
    const b = e.target.closest('.giftchoice-method');
    if (!b) return;
    const m = b.dataset.method;
    if (m === 'friend') {
      const online = window._myFriends || [];
      document.getElementById('giftchoice-friend-list').innerHTML = online.length
        ? online.map(f => `<div class="friend-row"><span class="friend-dot ${f.online ? 'on' : ''}"></span>
            <span class="friend-name">${_escHtml(f.name)} <small class="friend-level">⭐ ${f.level}</small></span>
            <button class="btn btn-primary giftchoice-pick" data-ref="${f.ref}" data-name="${_escHtml(f.name)}">${t().giftChoiceSendBtn}</button></div>`).join('')
        : `<p class="recovery-warn">${t().giftChoiceNoFriends}</p>`;
      showView('friends');
    } else {
      deliverVia = m; // 'link' | 'code'
      document.getElementById('giftchoice-confirm-text').textContent = t().giftChoiceConfirmLink(itemName, price);
      confirmBtn.textContent = t().giftChoiceConfirmBtn(price);
      showView('confirm');
    }
  });
  // Choisir un ami = confirmation directe (envoi immédiat).
  document.getElementById('giftchoice-friend-list').addEventListener('click', e => {
    const b = e.target.closest('.giftchoice-pick');
    if (!b || !payload) return;
    deliverVia = b.dataset.ref;
    document.getElementById('giftchoice-confirm-text').textContent = t().giftChoiceConfirmFriend(itemName, b.dataset.name, price);
    confirmBtn.textContent = t().giftChoiceConfirmBtn(price);
    showView('confirm');
  });
  confirmBtn?.addEventListener('click', () => {
    if (!payload || !deliverVia) return;
    confirmBtn.disabled = true;
    window._giftDeliverVia = deliverVia; // 'link'|'code'|<ref> : lu dans gift-cosmetic-result
    if (deliverVia === 'link' || deliverVia === 'code') {
      socket.emit('gift-cosmetic', { ...payload, playerId: getPlayerId() });
    } else {
      socket.emit('gift-cosmetic-friend', { ...payload, ref: deliverVia, playerId: getPlayerId() });
    }
  });
  window._closeGiftChoice = close;
})();

// ── Offrir un cosmétique ou un pack (modal du lien + code cadeau) ────────────
function buildGiftUrl(code) {
  return `${location.origin}${location.pathname}?gift=${code}`;
}
(function initGift() {
  const overlay = document.getElementById('overlay-gift');
  if (!overlay) return;
  const codeInput   = document.getElementById('gift-code');
  const linkInput   = document.getElementById('gift-link');
  const closeBtn    = document.getElementById('btn-gift-close');
  const copyBtn     = document.getElementById('btn-gift-copy');
  const copyLinkBtn = document.getElementById('btn-gift-link-copy');
  const shareBtn    = document.getElementById('btn-gift-share');
  function close() { overlay.classList.add('hidden'); }
  window._openGiftModal = (code, via) => {
    codeInput.value = code;
    if (linkInput) linkInput.value = buildGiftUrl(code);
    overlay.classList.remove('hidden');
    // Met en avant l'élément correspondant à la méthode choisie (lien ou code).
    setTimeout(() => {
      const target = via === 'code' ? codeInput : linkInput;
      if (target) { target.focus(); target.select?.(); }
    }, 120);
  };
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const wireCopy = (btn, input) => btn?.addEventListener('click', () => {
    navigator.clipboard.writeText(input.value).then(() => {
      btn.textContent = t().codeCopied;
      setTimeout(() => { btn.textContent = t().recovery.copy; }, 2000);
    }).catch(() => {});
  });
  wireCopy(copyBtn, codeInput);
  wireCopy(copyLinkBtn, linkInput);
  shareBtn?.addEventListener('click', () => {
    const txt = t().giftShareText(codeInput.value, buildGiftUrl(codeInput.value));
    if (navigator.share) navigator.share({ title: t().giftShareTitle, text: txt }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => {
      shareBtn.textContent = t().linkCopied;
      setTimeout(() => { shareBtn.textContent = t().giftShareBtn; }, 2000);
    }).catch(() => {});
  });
})();

function _showGiftFeedback(msg, color) {
  const fb = $('shop-gift-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = color;
  clearTimeout(fb._t);
  fb._t = setTimeout(() => { fb.textContent = ''; }, 3500);
}

socket.on('gift-cosmetic-result', ({ ok, code, error, toFriend } = {}) => {
  if (ok) {
    window._sound?.play("coin");
    window._closeGiftChoice?.();
    if (toFriend) {
      // Envoi direct à un ami : pas de code, juste un toast de confirmation.
      showCursorSnakeToast(t().giftChoiceSentFriend(toFriend));
    } else {
      // Lien ou code : ouvre la modal, en mettant en avant la méthode choisie.
      window._openGiftModal?.(code, window._giftDeliverVia);
    }
    if (!$('overlay-shop').classList.contains('hidden')) _renderShopItems();
  } else {
    const msg = error === 'insufficient' ? t().shopInsufficient
              : error === 'anonymous'    ? t().shopCosmeticAnon
              : error === 'target_owns'  ? t().giftChoiceTargetOwns
              : error === 'notfriend'    ? t().friendsErrInvalid
              : t().shopBuyError;
    const gc = document.getElementById('giftchoice-status');
    if (gc && !document.getElementById('overlay-giftchoice').classList.contains('hidden')) {
      gc.textContent = msg;
      const cb = document.getElementById('btn-giftchoice-confirm'); if (cb) cb.disabled = false;
    } else _showShopFeedback(msg, '#ef4444');
  }
});

socket.on('redeem-gift-result', ({ ok, cosmeticId, bundleId, granted, fromName, error } = {}) => {
  const shopOpen = !$('overlay-shop').classList.contains('hidden');
  if (ok) {
    (Array.isArray(granted) && granted.length ? granted : (cosmeticId ? [cosmeticId] : []))
      .forEach(id => { if (!ownedCosmetics.includes(id)) ownedCosmetics.push(id); });
    window._sound?.play("coin");
    const msg = bundleId ? t().giftReceivedBundle(fromName || '') : t().giftReceived(fromName || '');
    if (shopOpen) { _showGiftFeedback(msg, '#22c55e'); _renderShopItems(); }
    else showCursorSnakeToast(msg); // arrivée par lien cadeau : la boutique est fermée
  } else {
    const msg = error === 'used'          ? t().giftUsed
              : error === 'already_owned' ? t().shopCosmeticAlreadyOwned
              : t().giftInvalid;
    if (shopOpen) _showGiftFeedback(msg, '#ef4444');
    else showCursorSnakeToast(msg);
  }
});

// ── Bienvenue (première visite) + proposition de récupération ─────────────────
(function initOnboarding() {
  if (localStorage.getItem('libero_onboarded')) return;
  const finish = () => { try { localStorage.setItem('libero_onboarded', '1'); } catch {} };
  // Anciens joueurs (compte déjà présent avant cette fonctionnalité) : pas d'animation.
  if (!window.__liberoNewVisitor) { finish(); return; }

  const welcome  = document.getElementById('overlay-welcome');
  const typeText = document.getElementById('welcome-type-text');
  const iconsEl  = document.getElementById('welcome-icons');
  const startBtn = document.getElementById('welcome-start');
  const onboard  = document.getElementById('overlay-onboard');
  const obInput  = document.getElementById('onboard-input');
  const obHint   = document.getElementById('onboard-hint');
  const obRestore= document.getElementById('btn-onboard-restore');
  const obNew    = document.getElementById('btn-onboard-new');
  if (!welcome || !onboard || !typeText) { finish(); return; }

  const d = t().onboarding;
  const ICONS = ['🎮', '♟️', '⛂', '⭕', '⚡'];

  function showOnboard() { welcome.classList.add('hidden'); obHint.textContent = ''; obHint.classList.remove('recovery-err'); onboard.classList.remove('hidden'); _syncThemeBtns(); }

  // Choix du thème jour / nuit dès l'arrivée : appliqué immédiatement et
  // mémorisé (le bouton ⚙️ permet d'en changer plus tard).
  const thDay   = document.getElementById('onboard-theme-day');
  const thNight = document.getElementById('onboard-theme-night');
  function _syncThemeBtns() {
    const light = document.documentElement.classList.contains('light');
    thDay?.classList.toggle('onboard-theme-active', light);
    thNight?.classList.toggle('onboard-theme-active', !light);
  }
  function _pickTheme(light) {
    localStorage.setItem('themeMode', light ? 'light' : 'dark');
    document.documentElement.classList.toggle('light', light);
    const tbtn = document.getElementById('btn-theme-toggle');
    if (tbtn) tbtn.textContent = light ? '☀️' : '🌙';
    _syncThemeBtns();
  }
  thDay?.addEventListener('click', () => _pickTheme(true));
  thNight?.addEventListener('click', () => _pickTheme(false));

  function finishNew() {
    onboard.classList.add('hidden');
    finish();
    // C'est maintenant que le joueur arrive vraiment à l'accueil :
    // le didacticiel peut démarrer.
    const scr = sessionStorage.getItem('libero_screen') || 'landing';
    window._tutoBegin?.(scr);
  }

  obRestore?.addEventListener('click', () => {
    const raw = (obInput.value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (raw.length < 8) { obHint.textContent = d.invalid; obHint.classList.add('recovery-err'); return; }
    finish();
    // Progression restaurée : ce joueur connaît déjà le site, on ne lui
    // montrera jamais le didacticiel.
    window._tutoSkipAll?.();
    localStorage.setItem('libero_player_id', raw);
    localStorage.removeItem('playerName');
    location.reload();
  });
  obNew?.addEventListener('click', finishNew);
  startBtn?.addEventListener('click', showOnboard);

  // Animation machine à écrire, puis cascade d'icônes et bouton Commencer.
  welcome.classList.remove('hidden');
  const msg = d.welcomeType;
  let i = 0;
  (function step() {
    if (i <= msg.length) { typeText.textContent = msg.slice(0, i); i++; setTimeout(step, 55); }
    else {
      iconsEl.innerHTML = ICONS.map((ic, k) => `<span class="welcome-icon" style="animation-delay:${k * 140}ms">${ic}</span>`).join('');
      startBtn.textContent = d.start;
      startBtn.classList.remove('hidden');
    }
  })();
})();

// ── Tournoi du samedi ────────────────────────────────────────────────────────
var _tournamentData = null;
function renderTournament() {
  const d = t();
  const card = document.getElementById('tournament-card');
  if (!card || !_tournamentData) return;
  const td = _tournamentData;
  const st = document.getElementById('tournament-status');
  const top = document.getElementById('tournament-top');
  const ch = document.getElementById('tournament-champion');
  if (td.active) {
    const left = Math.max(0, (td.endsAt || 0) - Date.now());
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
    st.textContent = d.tournamentLive(h, m);
    st.className = 'tournament-status live';
    top.innerHTML = (td.top || []).length
      ? td.top.map((x, i) => `<div class="tournament-row"><span>${['🥇','🥈','🥉'][i] || (i + 1) + '.'} ${_escHtml(x.name)}</span><b>${x.pts} pts</b></div>`).join('')
      : `<p class="tournament-empty">${_escHtml(d.tournamentEmpty)}</p>`;
  } else {
    const left = Math.max(0, (td.nextAt || 0) - Date.now());
    const days = Math.ceil(left / 86400000);
    st.textContent = d.tournamentNext(days);
    st.className = 'tournament-status';
    top.innerHTML = '';
  }
  ch.textContent = td.champion ? d.tournamentChampion(td.champion.name, td.champion.pts) : '';
}
socket.on('tournament-update', data => { _tournamentData = data; renderTournament(); });

// ── Parrainage : toasts de récompense ────────────────────────────────────────
socket.on('referral-reward', ({ role, amount, name } = {}) => {
  const d = t();
  showCursorSnakeToast(role === 'parrain' ? d.referralRewardSponsor(amount, name) : d.referralRewardChild(amount));
});

// ── Annonces (bandeau News) ──────────────────────────────────────────────────
function _renderAnnouncements(list) {
  const el = document.getElementById('news-announcements');
  if (!el) return;
  const fr = currentLang === 'fr';
  window._lastAnnouncements = list || [];
  el.innerHTML = (list || []).map(a => {
    const txt = (!fr && a.textEn) ? a.textEn : a.text;
    return `<p class="news-msg news-announce">📣 ${_escHtml(txt)}</p>`;
  }).join('');
}
socket.on('announcements-update', ({ announcements } = {}) => _renderAnnouncements(announcements));
(async () => {
  try {
    const r = await fetch(`${window.BACKEND_URL}/api/announcements`);
    const d = await r.json();
    _renderAnnouncements(d.announcements);
  } catch {}
})();

socket.on('challenges-update', ({ challenges, permanent } = {}) => ProfileHub.setChallenges(challenges, permanent));
socket.on('history-update',    ({ history } = {})    => ProfileHub.setHistory(history));
socket.on('streak-update',     ({ count, longest, bonus } = {}) => {
  ProfileHub.setStreak({ count, longest, bonus });
  if (bonus > 0) showCursorSnakeToast(t().streakBonusToast(count, bonus));
});
socket.on('claim-challenge-result', ({ ok, reward, allDoneBonus } = {}) => {
  if (!ok) return;
  showCursorSnakeToast(t().challengeClaimToast(reward));
  // Journée parfaite : les 3 défis réclamés → petit bonus + toast dédié.
  if (allDoneBonus > 0) setTimeout(() => showCursorSnakeToast(t().challengePerfectDay(allDoneBonus)), 1800);
});

// ── PWA : service worker + notifications push ────────────────────────────────
(function initPwaAndPush() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const btn = document.getElementById('sp-push-btn');
  if (!btn) return;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function isOn() { return supported && Notification.permission === 'granted' && localStorage.getItem('libero_push') === '1'; }
  function refresh() { btn.textContent = isOn() ? t().settingsPushOn : t().settingsPushOff; }
  window._refreshPushBtn = refresh;
  refresh();
  function b64ToU8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
  btn.addEventListener('click', async () => {
    if (!supported) { showCursorSnakeToast(t().pushUnsupported); return; }
    if (isOn()) {
      localStorage.setItem('libero_push', '0');
      socket.emit('push-unsubscribe', { playerId: getPlayerId() });
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {}
      refresh();
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { showCursorSnakeToast(t().pushDeniedToast); return; }
      const r = await fetch(`${window.BACKEND_URL}/api/push-key`);
      const { key } = await r.json();
      if (!key) { showCursorSnakeToast(t().pushUnsupported); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
      socket.emit('push-subscribe', { playerId: getPlayerId(), sub: sub.toJSON() });
      localStorage.setItem('libero_push', '1');
      refresh();
      showCursorSnakeToast(t().pushEnabledToast);
    } catch (e) {
      showCursorSnakeToast(t().pushDeniedToast);
    }
  });
})();

// ── Boutique : offre flash ────────────────────────────────────────────────────
(function initFlashOffer() {
  let countdownTimer = null;
  function fmt(ms) {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  }
  window._renderFlashBanner = function () {
    const el = document.getElementById('shop-flash');
    if (!el) return;
    clearInterval(countdownTimer);
    const offer = window._flashOffer;
    if (!offer || offer.endsAt <= Date.now()) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const item = (window._allShopItemsById || {})[offer.cosmeticId];
    const name = item?.name || offer.cosmeticId;
    const owned = Array.isArray(ownedCosmetics) && ownedCosmetics.includes(offer.cosmeticId);
    el.innerHTML = `
      <span class="shop-flash-tag">${t().flashOfferTitle} · -${offer.discount}%</span>
      <span class="shop-flash-name">${_escHtml(name)}</span>
      <span class="shop-flash-prices"><s>⚡ ${offer.price}</s> <strong>⚡ ${offer.flashPrice}</strong></span>
      <span class="shop-flash-timer" id="shop-flash-timer"></span>
      ${owned ? '' : `<button class="btn btn-primary shop-flash-buy" id="shop-flash-buy">⚡</button>`}`;
    el.classList.remove('hidden');
    const tick = () => {
      const left = offer.endsAt - Date.now();
      if (left <= 0) { window._flashOffer = null; window._renderFlashBanner(); return; }
      const tEl = document.getElementById('shop-flash-timer');
      if (tEl) tEl.textContent = t().flashOfferEnds(fmt(left));
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
    document.getElementById('shop-flash-buy')?.addEventListener('click', () => {
      socket.emit('buy-cosmetic', { cosmeticId: offer.cosmeticId, playerId: getPlayerId() });
    });
  };
  socket.on('flash-offer', ({ offer } = {}) => {
    window._flashOffer = offer || null;
    window._renderFlashBanner();
  });
  // Catalogue boutique pilote par l'admin (articles forces + comptes a rebours).
  socket.on('shop-overrides', ({ overrides } = {}) => {
    window._shopOverrides = overrides || {};
    if (!document.getElementById('overlay-shop')?.classList.contains('hidden')) _renderShopItems();
    // Rayon Emotes du profil : refléter les retraits/comptes à rebours de l'admin.
    if (window._profileHub && document.body.classList.contains('screen-locker-active')) window._profileHub.renderLocker();
  });
})();
