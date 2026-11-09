/* Evenement ZyX : la boutique piratee. Charge a la demande par app.js (_hkLoad).
   Interface en shadow DOM (#hk-root) : la porte et son cadenas, le carnet des 6 enigmes, la boutique occupee
   et ses farces, le ticket du maitre de la boutique. Le serveur (backend/hacker.js) garde le code et les reponses :
   ici on ne fait que demander, afficher et animer. Les farces sont purement visuelles. */
(function () {
  'use strict';
  const L = () => (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = ms => reduce ? 10 : ms;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* ───────── Textes (FR / EN) ───────── */
  const TX = {
    fr: {
      title: 'Boutique piratée', close: 'Fermer', door: 'La porte', book: 'Carnet', shop: 'Boutique', ticket: 'Ticket',
      tabDoorOpen: 'La porte', owner: n => `La boutique appartient à ${n}`,
      shopName: 'La papeterie de ZyX le grand', shopReal: 'La Papeterie Libero', closedNote: 'Boutique fermée : un cadenas bloque la porte.',
      try: 'Essayer le code', tries: n => `${n} essai${n > 1 ? 's' : ''} cette heure`, noTries: 'Plus d\'essais cette heure', touch: 'Touche le haut ou le bas d\'une molette',
      wait: m => `Prochain essai dans ${m} min`, late: (n, s) => `${n} a ouvert le cadenas ${s} s avant toi. La boutique est ouverte pour tout le monde, aux nouveaux prix.`,
      lateT: 'Trop tard !', seeShop: 'Voir la boutique', anon: 'Choisis un pseudo pour jouer.', closedEv: 'Le cadenas ne se rouvre plus.',
      notebook: 'Le carnet de ZyX', open: 'À RÉSOUDRE', solved: d => `CHIFFRE ${d}`, soon: when => `OUVRE ${when}`,
      level: ['Très facile', 'Facile', 'Moyen', 'Difficile'], diff: 'Difficulté', answerPh: 'Ta réponse', validate: 'Valider', back: 'Retour au carnet',
      hint: 'Indice de Libé', hintIn: m => `Indice dans ${m}`, hintGone: 'Plus d\'indice', triesLeft: n => `${n} tentative${n > 1 ? 's' : ''}`, wrongLeft: n => n > 0 ? `Faux. Il te reste ${n} tentative${n > 1 ? 's' : ''}.` : 'Plus de tentatives.', retry: m => `Réessaie dans ${m} min`,
      goodAns: d => `Bonne réponse. Chiffre ${d} trouvé.`, rightStamp: 'RÉPONSE JUSTE', lieStamp: 'MENSONGE', already: 'Déjà résolue',
      bookNote: 'Touche une énigme pour la résoudre. La réponse est un mot ou une suite : le serveur donne le chiffre.',
      days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      names: ['Le mot mélangé', 'Le message du miroir', 'Les initiales', 'Le chemin des lettres', 'Les trois menteurs', 'Le disque de César'],
      types: ['Mots', 'Observation', 'Observation', 'Mots', 'Logique', 'Chiffrement'], levels: [0, 0, 0, 2, 3, 3],
      st: ['Mes lettres ont pris la fuite. Rattrape-les.', 'Même mon écriture est à l\'envers.', 'J\'ai rangé mes jouets. Ils sont tous là, bien alignés.', 'Ce que je garde fermé depuis le début.', '', 'Mon nom est la clé.'],
      tl: 'Touche les lettres dans le bon ordre.', clear: 'Effacer', mirror: 'Retourner le miroir', ini: ['Cadenas', 'Loupe', 'Étiquette', 'Fermoir'], iniAns: 'CLEF',
      bogHelp: 'Passe de case en case voisine, sans diagonale.', bog: ['POR', 'AET', 'LUS'], anag: 'IACRE', mirrorWord: 'TROUSSE', caesar: 'FDGHQDV',
      liarsOne: 'Un seul message dit vrai. Où est le trésor ?', liarBoxes: ['Règle', 'Compas', 'Équerre'], liarMsgs: ['« Le trésor est dans le Compas. »', '« Le trésor n\'est pas dans le Compas. »', '« Le trésor n\'est pas dans la Règle. »'],
      liarHyp: ['la Règle', 'le Compas', 'l\'Équerre'], liarTest: 'Teste une hypothèse', ifIn: x => `Si c'est dans ${x}`, msg: 'Msg', trues: 'Vrais', vrai: 'vrai', faux: 'faux', turnL: 'Tourner à gauche', turnR: 'Tourner à droite',
      hints: [['Les lettres désordonnées forment un objet de la classe, qu\'on utilise au tableau.', 'Le mot commence par la lettre C.'], ['Lis le mot de droite à gauche, ou retourne le miroir.', 'C\'est ce dans quoi on range ses stylos.'], ['Regarde la première lettre de chaque jouet, de haut en bas.', 'Touche les jouets dans l\'ordre : le mot ouvre une serrure.'], ['Commence par la lettre jaune et va de case en case voisine, sans diagonale.', 'Le mot est ce que ZyX garde fermé depuis le début.'], ['Un seul des trois messages dit vrai. Pour chaque coffre, compte combien de messages seraient vrais.', 'Le bon coffre est celui où un seul message est vrai. C\'est un outil qui sert à tracer droit.'], ['Mon nom est la clé : combien de lettres compte « ZyX » ?', 'Recule chaque lettre de 3 crans dans l\'alphabet. Le mot est ce qui ferme la porte.']],
      libe: 'Libé',
      // ZyX
      zx: {
        intro: ['Oh petit curieux, qu\'est ce qui t\'amène ?', 'Cette boutique m\'appartient désormais...', 'J\'ai gardé les crayons, augmenté les prix, et fermé la porte à clé.', 'Six chiffres. Six énigmes. Six chances de vous planter. Ha !'],
        welcome: 'Bienvenue chez moi. Faites comme chez vous. Enfin non.', pricey: 'Trop cher ? Pleurez, ça fait monter les prix.', plus50: 'Plus 50 pour cent. Pas pour l\'argent. Pour le plaisir.',
        locked: ['Fermé. Cherche le code, petit curieux.', 'Pas touche. Tout est à moi.', 'Tu veux acheter ? Ouvre d\'abord mon cadenas.'],
        fake: 'Psst. Un solde à moins 90 pour cent. Courez.', slow: 'Trop lent ! Hahaha !', almost: 'Presque ! Non.', caught: 'Hahaha ! Tu as cru à ma magie ?', fakeName: 'Skin Mystère', fakeStamp: 'PIÉGÉ !', fakeTxt: 'Cet article n\'existe pas, je t\'ai eu petit con... Ha Ha', fakePill: 'Aucun Libs débité, aucun achat possible',
        labels: 'J\'ai rangé les étiquettes. À ma manière.', labelTip: 'Étiquette truquée. Le vrai prix s\'affiche toujours au moment d\'acheter.',
        thief: 'Merci pour ça. Je l\'emprunte.', giveBack: 'Bon, je te le rends. Pour cette fois.',
        dark: 'Qui a éteint la lumière ? Moi. Tu as peur du noir ?', darkTxt: 'Tu cherches quoi ?', lightIn: n => `Lumière dans ${n} s`,
        good: ['Tu as remis mes lettres en ordre. Ah l\'batard...', 'Tu lis à l\'envers, maintenant ? Impressionnant...', 'Mes initiales ! Comment as-tu osé les lire ?', 'La porte ! Évidemment. Je l\'avais sous le nez. Mince alors', 'Hm. Tu raisonnes mieux que mes autres victimes.', 'Tu as compté mes lettres. Ah l\'batard...'],
        wrong: ['Faux. Retourne à ton cahier.', 'Raté ! Réessaie, petit curieux.', 'Ha ! Pas du tout.', 'Non. Tu chauffes... ou pas.'],
        codeBad: ['Faux ! Hahaha !', 'Même pas près du compte...', 'Encore raté. Je savoure.'],
        lie: 'Hahaha ! Tu as mordu ! Quelle naïveté !', lieNote: 'Énigme 2 : la réponse est', lieHead: 'Indice de ZyX', lieSay: 'Un petit coup de pouce. Je suis très serviable.',
        panic: 'NON ! PAS MON CADENAS ! Qui a osé ?!', bye: 'Je reviendrai, et la prochaine fois, ce ne sera pas aussi facile.',
        ticket: 'Gardez ce ticket. Vous me l\'avez volé.', take1: 'Vol qualifié ! Je note tout.', take2: 'Prends, prends. Ça ne te portera pas chance.', gift: 'Tu offres MES articles ?! Quelle audace.',
        rate: 'Doucement ! Tu me donnes le tournis.',
      },
      unlockedT: 'DÉVERROUILLÉE', youFirst: 'Tu es le premier à avoir ouvert le cadenas !', ownerT: 'Ticket du maître de la boutique', slotsN: n => `${n} article${n > 1 ? 's' : ''} offert${n > 1 ? 's' : ''}`,
      left: n => n > 0 ? `Il te reste ${n} article${n > 1 ? 's' : ''}` : 'Ticket utilisé en entier', rules: ['Choisis 6 articles dans toute la boutique.', 'Ils sont non remboursables.', 'Un cadeau offert à un ami compte comme un article.', 'La boutique est à toi jusqu\'au 6e article. Tout le site le voit.'],
      pick: 'Choisir dans la boutique', myFree: 'Mes articles gratuits', offer: 'Offrir à un ami', chooseFriend: 'Choisis l\'ami', noFriend: 'Ajoute d\'abord un ami pour offrir un article.', giftNote: 'Un cadeau compte comme 1 de tes 6 articles gratuits.', cancel: 'Annuler', send: 'Offrir',
      giftOk: n => `Cadeau offert à ${n}.`, takeErr: { ineligible: 'Cet article ne peut pas être pris avec le ticket.', owned: 'Tu possèdes déjà cet article.', full: 'Ton ticket est utilisé en entier.', noticket: 'Tu n\'as pas de ticket.', rate: 'Doucement, réessaie dans un instant.', notfriend: 'Cet ami est introuvable.', target_owns: 'Ton ami possède déjà cet article.', notfree: 'Cet article n\'est pas un article gratuit.' },
      endedOver: 'Personne n\'a ouvert le cadenas. ZyX s\'en va et laisse les prix plus élevés.', endedDone: 'La boutique est libérée. Les prix restent plus élevés.', closedMsg: 'Fin de l\'événement',
      bannerLocked: 'ZyX a piraté la boutique ! Résous ses énigmes et ouvre le cadenas.', enter: 'Entrer', bannerOwner: (n, u) => `La boutique appartient à ${n}. ${u}/6 articles gratuits utilisés.`, bannerEnd: 'ZyX a quitté la boutique. Les prix restent plus élevés.',
      popUnlocked: n => `${n} a ouvert le cadenas !`, popSub: 'La boutique rouvre, aux nouveaux prix.', popOk: 'OK',
      pranksLabel: 'Farces du hacker (pendant l\'événement)', anonErr: 'Choisis un pseudo pour jouer.', sellRecap: 'Récapitulatif',
    },
    en: {
      title: 'Hacked shop', close: 'Close', door: 'The door', book: 'Notebook', shop: 'Shop', ticket: 'Ticket',
      tabDoorOpen: 'The door', owner: n => `The shop belongs to ${n}`,
      shopName: 'ZyX the Great\'s stationery', shopReal: 'Libero Stationery', closedNote: 'Shop closed: a padlock blocks the door.',
      try: 'Try the code', tries: n => `${n} ${n > 1 ? 'tries' : 'try'} this hour`, noTries: 'No tries left this hour', touch: 'Tap the top or bottom of a wheel',
      wait: m => `Next try in ${m} min`, late: (n, s) => `${n} opened the padlock ${s} s before you. The shop is open to everyone, at the new prices.`,
      lateT: 'Too late!', seeShop: 'See the shop', anon: 'Choose a nickname to play.', closedEv: 'The padlock will not open again.',
      notebook: 'ZyX\'s notebook', open: 'TO SOLVE', solved: d => `DIGIT ${d}`, soon: when => `OPENS ${when}`,
      level: ['Very easy', 'Easy', 'Medium', 'Hard'], diff: 'Difficulty', answerPh: 'Your answer', validate: 'Submit', back: 'Back to the notebook',
      hint: 'Libé\'s hint', hintIn: m => `Hint in ${m}`, hintGone: 'No more hints', triesLeft: n => `${n} ${n > 1 ? 'tries' : 'try'}`, wrongLeft: n => n > 0 ? `Wrong. ${n} ${n > 1 ? 'tries' : 'try'} left.` : 'No tries left.', retry: m => `Try again in ${m} min`,
      goodAns: d => `Correct. Digit ${d} found.`, rightStamp: 'CORRECT', lieStamp: 'LIE', already: 'Already solved',
      bookNote: 'Tap a riddle to solve it. The answer is a word or a sequence: the server gives you the digit.',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      names: ['The scrambled word', 'The mirror message', 'The initials', 'The letter path', 'The three liars', 'Caesar\'s disc'],
      types: ['Words', 'Observation', 'Observation', 'Words', 'Logic', 'Cipher'], levels: [0, 0, 0, 2, 3, 3],
      st: ['My letters ran away. Catch them.', 'Even my handwriting is backwards.', 'I tidied my toys. They are all here, nicely lined up.', 'What I have kept shut since the start.', '', 'My name is the key.'],
      tl: 'Tap the letters in the right order.', clear: 'Clear', mirror: 'Flip the mirror', ini: ['Kite', 'Eraser', 'Yo-yo'], iniAns: 'KEY',
      bogHelp: 'Move from tile to neighbouring tile, no diagonals.', bog: ['DOL', 'AOR', 'TUS'], anag: 'KCHAL', mirrorWord: 'ERASER', caesar: 'SDGORFN',
      liarsOne: 'Only one message tells the truth. Where is the treasure?', liarBoxes: ['Ruler', 'Compass', 'Square'], liarMsgs: ['"The treasure is in the Compass."', '"The treasure is not in the Compass."', '"The treasure is not in the Ruler."'],
      liarHyp: ['the Ruler', 'the Compass', 'the Square'], liarTest: 'Test a guess', ifIn: x => `If it is in ${x}`, msg: 'Msg', trues: 'True', vrai: 'true', faux: 'false', turnL: 'Turn left', turnR: 'Turn right',
      hints: [['The jumbled letters make a classroom object used on the board.', 'The word starts with the letter C.'], ['Read the word from right to left, or flip the mirror.', 'It is what you keep your pens in.'], ['Look at the first letter of each toy, from top to bottom.', 'Tap the toys in order: the word opens a lock.'], ['Start at the yellow letter and move to neighbouring tiles, no diagonals.', 'The word is what ZyX has kept shut from the start.'], ['Only one of the three messages tells the truth. For each box, count how many messages would be true.', 'The right box is the one where only one message is true. It is a tool for drawing straight lines.'], ['My name is the key: how many letters in "ZyX"?', 'Move each letter back 3 places in the alphabet. The word is what keeps the door shut.']],
      libe: 'Libé',
      zx: {
        intro: ['Oh little curious one, what brings you here?', 'This shop belongs to me now...', 'I kept the pencils, raised the prices, and locked the door.', 'Six digits. Six riddles. Six chances to fail. Ha!'],
        welcome: 'Welcome to my place. Make yourself at home. Well, no.', pricey: 'Too expensive? Cry, it raises the prices.', plus50: 'Plus 50 percent. Not for the money. For fun.',
        locked: ['Closed. Find the code, little curious one.', 'Hands off. Everything is mine.', 'Want to buy? Open my padlock first.'],
        fake: 'Psst. A 90 percent sale. Run.', slow: 'Too slow! Hahaha!', almost: 'Almost! No.', caught: 'Hahaha! You believed in my magic?', fakeName: 'Mystery Skin', fakeStamp: 'GOTCHA!', fakeTxt: 'This item does not exist, I got you, you little twerp... Ha Ha', fakePill: 'No Libs charged, nothing can be bought',
        labels: 'I tidied the labels. My way.', labelTip: 'Tampered label. The real price always shows when you buy.',
        thief: 'Thanks for this one. I\'ll borrow it.', giveBack: 'Fine, you can have it back. This time.',
        dark: 'Who turned off the light? Me. Scared of the dark?', darkTxt: 'What are you looking for?', lightIn: n => `Light in ${n} s`,
        good: ['You put my letters back in order. Ah, the rascal...', 'You read backwards now? Impressive...', 'My initials! How dare you read them?', 'The door! Of course. It was right under my nose. Darn it', 'Hm. You reason better than my other victims.', 'You counted my letters. Ah, the rascal...'],
        wrong: ['Wrong. Back to your notebook.', 'Missed! Try again, little curious one.', 'Ha! Not at all.', 'No. You are warm... or not.'],
        codeBad: ['Wrong! Hahaha!', 'Not even close...', 'Missed again. I am savouring this.'],
        lie: 'Hahaha! You bit! How naive!', lieNote: 'Riddle 2: the answer is', lieHead: 'A hint from ZyX', lieSay: 'A little helping hand. I am very helpful.',
        panic: 'NO! NOT MY PADLOCK! Who dared?!', bye: 'I will be back, and next time it will not be this easy.',
        ticket: 'Keep that ticket. You stole it from me.', take1: 'Theft! I am taking notes.', take2: 'Take, take. It will not bring you luck.', gift: 'You give away MY items?! What nerve.',
        rate: 'Easy! You are making me dizzy.',
      },
      unlockedT: 'UNLOCKED', youFirst: 'You are the first to open the padlock!', ownerT: 'Shop master\'s ticket', slotsN: n => `${n} free item${n > 1 ? 's' : ''}`,
      left: n => n > 0 ? `${n} item${n > 1 ? 's' : ''} left` : 'Ticket fully used', rules: ['Pick 6 items anywhere in the shop.', 'They cannot be refunded.', 'A gift to a friend counts as one item.', 'The shop is yours until the 6th item. The whole site sees it.'],
      pick: 'Pick in the shop', myFree: 'My free items', offer: 'Give to a friend', chooseFriend: 'Choose a friend', noFriend: 'Add a friend first to give an item.', giftNote: 'A gift counts as 1 of your 6 free items.', cancel: 'Cancel', send: 'Give',
      giftOk: n => `Gift sent to ${n}.`, takeErr: { ineligible: 'This item cannot be taken with the ticket.', owned: 'You already own this item.', full: 'Your ticket is fully used.', noticket: 'You have no ticket.', rate: 'Easy, try again in a moment.', notfriend: 'Friend not found.', target_owns: 'Your friend already owns this item.', notfree: 'This is not one of your free items.' },
      endedOver: 'Nobody opened the padlock. ZyX leaves and keeps the prices higher.', endedDone: 'The shop is free. Prices stay higher.', closedMsg: 'End of the event',
      bannerLocked: 'ZyX hacked the shop! Solve his riddles and crack the padlock.', enter: 'Enter', bannerOwner: (n, u) => `The shop belongs to ${n}. ${u}/6 free items used.`, bannerEnd: 'ZyX left the shop. Prices stay higher.',
      popUnlocked: n => `${n} opened the padlock!`, popSub: 'The shop reopens, at the new prices.', popOk: 'OK',
      pranksLabel: 'Hacker pranks (during the event)', anonErr: 'Choose a nickname to play.', sellRecap: 'Summary',
    },
  };
  const X = () => TX[L()];

  /* ───────── Etat ───────── */
  let host = null, sh = null, V = null, sock = null, T = [], UI = { tab: 'door', enig: null, code: [0, 0, 0, 0, 0, 0], intro: false, hint: {} }, trapsRun = 0, visit = 0, hintTimer = null;
  const q = s => sh.querySelector(s), qa = s => [].slice.call(sh.querySelectorAll(s));
  const pid = () => getPlayerId();
  const sn = () => (V && V._at) ? performance.timeOrigin + performance.now() + (V.now - V._at) : Date.now();
  const later = (f, ms) => { T.push(setTimeout(f, ms)); };
  const clearT = () => { T.forEach(clearTimeout); T = []; if (hintTimer) { clearInterval(hintTimer); hintTimer = null; } };
  const pranksOn = () => !reduce && localStorage.getItem('libero_hk_pranks') !== '0';
  const save = () => { try { sessionStorage.setItem('libero_hk', JSON.stringify({ tab: UI.tab, enig: UI.enig })); } catch (_) {} };

  /* ───────── Sons (synthese, comme les autres jeux) ───────── */
  let AC = null;
  const sfxOn = () => (typeof sfxEnabled === 'undefined' || !!sfxEnabled);
  const vol = () => (typeof sfxVolume === 'number' && !isNaN(sfxVolume) ? Math.max(0.05, Math.min(1, sfxVolume * 2)) : 1);
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return AC; };
  function tone(f, d, type, v, delay, f2) { if (!sfxOn()) return; const c = ac(); if (!c) return; try { const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime((v || .15) * vol(), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .02); } catch (_) {} }
  function noise(d, v, delay) { if (!sfxOn()) return; const c = ac(); if (!c) return; try { const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = (v || .2) * vol(); s.connect(g); g.connect(c.destination); s.start(c.currentTime + (delay || 0)); } catch (_) {} }
  const SND = {
    stamp() { tone(150, .18, 'sine', .5, 0, 50); noise(.05, .25); }, tick() { tone(700, .04, 'square', .04); }, voice() { tone(180 + Math.random() * 60, .05, 'sawtooth', .05); },
    mtick() { tone(2300, .025, 'square', .05); }, mclick() { tone(1100, .05, 'square', .09); noise(.03, .2); }, clunk() { tone(110, .3, 'sine', .5, 0, 45); noise(.08, .3); },
    chain() { for (let i = 0; i < 7; i++) noise(.05, .18, i * .07); }, whoosh() { noise(.25, .08); }, page() { noise(.3, .1); },
    rattle() { for (let i = 0; i < 9; i++) { noise(.04, .2, i * .055); tone(900 + Math.random() * 700, .03, 'square', .04, i * .055); } },
    spring() { tone(220, .35, 'sawtooth', .07, 0, 820); tone(120, .5, 'sine', .25, .05, 60); noise(.06, .3); },
    creak() { tone(150, 1.1, 'sawtooth', .045, 0, 85); tone(120, 1.4, 'sawtooth', .03, .2, 70); noise(.7, .04); },
    laugh() { [0, 1, 2, 3].forEach(i => tone(240 - i * 20, .12, 'sawtooth', .09, i * .14)); }, hack() { tone(90, .6, 'sawtooth', .1, 0, 60); noise(.4, .08); },
    ding() { tone(1175, .4, 'sine', .2); tone(1568, .5, 'sine', .15, .1); }, note(k) { tone(523 * Math.pow(1.122, k || 0), .18, 'triangle', .18); },
    fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .35, 'triangle', .2, i * .11)); tone(130, .9, 'sawtooth', .08, 0); },
    wrong() { tone(200, .25, 'sawtooth', .14, 0, 120); }, ok() { tone(660, .1, 'triangle', .15); tone(990, .2, 'triangle', .15, .1); }, punch() { tone(300, .05, 'square', .12); noise(.06, .2); }, dark() { tone(300, .9, 'sine', .12, 0, 60); },
  };
  const snd = (n, a) => { try { if (SND[n]) SND[n](a); } catch (_) {} };

  /* ───────── Briques visuelles ───────── */
  const IC = {
    frame: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>', bg: '<path d="M3 18l5-7 4 5 3-4 6 6z"/><circle cx="17" cy="7" r="2"/>', title: '<path d="M5 4h14v12l-7-4-7 4z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.600-7 10-7 10z"/>', font: '<path d="M4 18l5-12 5 12M6 14h6M16 10h4M18 10v8"/>', uno: '<rect x="6" y="4" width="10" height="15" rx="2"/><path d="M10 9l4 7M14 9l-4 7"/>',
    star: '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>', gift: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M12 10v10M4 14h16M12 10c-3 0-4-4-1-4s1 4 1 4zm0 0c3 0 4-4 1-4s-1 4-1 4z"/>',
  };
  const svgI = (k, cls) => `<svg class="${cls || 'i'}" viewBox="0 0 24 24">${IC[k]}</svg>`;
  const DECO = [{ k: 'frame', fr: 'Cadre Toile', en: 'Canvas frame', p: 80 }, { k: 'bg', fr: 'Fond Ardoise étoilée', en: 'Starry slate background', p: 120 }, { k: 'title', fr: 'Titre Briseur de code', en: 'Code breaker title', p: 150 }, { k: 'heart', fr: 'Emote Cœur', en: 'Heart emote', p: 40 }, { k: 'font', fr: 'Police Craie', en: 'Chalk font', p: 100 }, { k: 'uno', fr: 'Skin Uno dorée', en: 'Golden Uno skin', p: 200 }];
  const hkP = p => { p = Math.round(p); const m = (V && V.mult) || 1; return (m <= 1 || p <= 0) ? p : Math.max(5, Math.round(p * m / 5) * 5); };
  function HK(mood) { return '<svg class="hkv" viewBox="0 0 100 120"><path class="scarf" d="M22 96 Q50 108 78 96 L84 116 Q50 124 16 116Z"/><path class="hood" d="M8 120 Q8 82 50 76 Q92 82 92 120Z"/><path class="hood" d="M17 70 Q12 10 50 8 Q88 10 83 70 Q68 84 50 84 Q32 84 17 70Z"/><ellipse class="face" cx="50" cy="52" rx="25" ry="23"/><ellipse class="eye" cx="39" cy="48" rx="8" ry="9"/><ellipse class="eye" cx="61" cy="48" rx="8" ry="9"/><circle class="pup" cx="39" cy="49" r="3.6"/><circle class="pup" cx="61" cy="49" r="3.6"/>' + (mood === 'shock' ? '<ellipse cx="50" cy="70" rx="7" ry="9" fill="#fff"/>' : '<path class="mouth" d="M34 64 Q50 82 66 62"/>') + '</svg>'; }
  const hkEl = (cls, style, mood) => `<div class="hk ${cls || ''}" style="${style || ''}">${HK(mood)}</div>`;
  function look(x, y) { const m = q('.hk-main'); if (!m) return; const h = m.getBoundingClientRect(); qa('.hkv').forEach(s => { const r = s.getBoundingClientRect(), cx = r.left - h.left + r.width / 2, cy = r.top - h.top + r.height * .42, dx = x - cx, dy = y - cy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)), k = Math.min(1, d / 90) * 3.4; [].forEach.call(s.querySelectorAll('.pup'), p => { p.style.transform = `translate(${dx / d * k}px,${dy / d * k}px)`; }); }); }
  const sayHTML = (id, style, cls) => `<div class="say ${cls || ''}" id="${id}" style="${style}"><span></span></div>`;
  function talk(id, txt, start, per, cb) { const b = q('#' + id); if (!b) return; const sp = b.querySelector('span');
    later(() => { b.classList.add('on'); sp.textContent = ''; sp.classList.add('caret'); snd('laugh'); }, start);
    txt.split('').forEach((c, i) => later(() => { sp.textContent = txt.slice(0, i + 1); if (i % 3 === 0) snd('voice'); }, start + 60 + i * (per || 38)));
    later(() => { sp.classList.remove('caret'); if (cb) cb(); }, start + 60 + txt.length * (per || 38) + 30); }
  const chead = () => `<div class="chead"><div class="h">${HK()}</div><div class="say" id="q"><span></span></div></div>`;
  function quip(txt, start, hold) { const b = q('#q'); if (!b) return; const sp = b.querySelector('span'); later(() => { b.style.opacity = 1; b.classList.add('on'); sp.textContent = txt; snd('laugh'); }, start || 0); later(() => { b.classList.remove('on'); b.style.opacity = 0; }, (start || 0) + (hold || 3400)); }
  function rel(el, hostEl) { const a = el.getBoundingClientRect(), b = hostEl.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 + hostEl.scrollTop, w: a.width, h: a.height }; }
  function ripple(hostEl, x, y) { const rp = document.createElement('div'); rp.className = 'rip'; rp.style.cssText = `width:30px;height:30px;left:${x - 15}px;top:${y - 15}px`; hostEl.appendChild(rp); rp.animate([{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(3)' }], { duration: D(600) }).onfinish = () => rp.remove(); }
  function slam(el, ms, rot) { if (!el) return; el.animate([{ opacity: 0, transform: `translate(-50%,-50%) rotate(${rot || -12}deg) scale(3.4)` }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot || -12}deg) scale(.92)`, offset: .6 }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot || -12}deg) scale(1)` }], { duration: D(ms || 560), easing: 'ease-in', fill: 'forwards' }); snd('stamp'); }
  function countTo(el, from, to, ms, fmt) { const t0 = performance.now(); ms = D(ms); fmt = fmt || (v => v); (function f(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); })(t0); }
  function getC(v) { return getComputedStyle(host).getPropertyValue(v).trim() || '#888'; }
  function cannons(pts, count) { if (reduce) return; const m = q('.hk-main'); if (!m) return; const cv = document.createElement('canvas'); cv.className = 'cv'; m.appendChild(cv); const w = cv.width = m.clientWidth, h = cv.height = m.clientHeight, cx = cv.getContext('2d'); const col = [getC('--mark'), getC('--red'), getC('--board'), getC('--ok'), getC('--card2')], ln = getC('--line'), P = [];
    pts.forEach(p => { for (let i = 0; i < count; i++) { const a = (p.a + (Math.random() - .5) * .9), s = 9 + Math.random() * 9; P.push({ x: p.x * w, y: p.y * h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 9 + Math.random() * 7, c: col[i % 5], str: Math.random() < .2 }); } });
    const t0 = performance.now(); (function f(t) { cx.clearRect(0, 0, w, h); let alive = 0; P.forEach(p => { p.vy += .28; p.vx *= .992; p.vy *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y < h + 30) { alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.strokeStyle = ln; cx.lineWidth = 1.2; if (p.str) cx.fillRect(-1.5, -p.h * 1.5, 3, p.h * 3); else { cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); } cx.restore(); } }); if (alive && t - t0 < 6000) requestAnimationFrame(f); else cv.remove(); })(t0); }
  function pushNote(t, b) { const p = q('#push'); if (!p) return; q('#pushT').textContent = t; q('#pushB').textContent = b; p.classList.remove('on'); void p.offsetWidth; p.classList.add('on'); snd('ding'); later(() => p.classList.remove('on'), 3600); }
  const dpips = n => `<span class="dp">${[1, 2, 3].map(i => `<i${i <= n ? ' class="on"' : ''}></i>`).join('')}</span>`;

  /* ───────── Cadenas realiste : laiton, molettes 3D, chaines, portes ───────── */
  const CYR = 46, CYS = 36;
  function plkHTML() { let w = ''; for (let i = 0; i < 6; i++) { let f = ''; for (let k = 0; k < 10; k++) f += `<div class="face" style="transform:rotateX(${k * CYS}deg) translateZ(${CYR}px)">${k}</div>`; w += `<div class="wh3" data-i="${i}"><div class="cyl" style="transform:translateZ(-${CYR}px) rotateX(0deg)">${f}</div><i class="shade"></i></div>`; }
    return `<div class="plk"><svg class="shk3" viewBox="0 0 160 110"><defs><linearGradient id="stl" x1="0" x2="1"><stop offset="0" stop-color="#6c727a"/><stop offset=".35" stop-color="#e9edf1"/><stop offset=".6" stop-color="#9aa1a9"/><stop offset="1" stop-color="#555b63"/></linearGradient></defs><g class="shkg"><path d="M30 110V52a50 50 0 01100 0v58" fill="none" stroke="#2a2e33" stroke-width="22" stroke-linecap="round"/><path d="M30 110V52a50 50 0 01100 0v58" fill="none" stroke="url(#stl)" stroke-width="16" stroke-linecap="round"/><path d="M36 106V52a44 44 0 0188 0" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linecap="round"/></g></svg><div class="pbody3"><i class="scr s1"></i><i class="scr s2"></i><i class="scr s3"></i><i class="scr s4"></i><div class="eng">ZyX · No 22</div><div class="plate"><div class="wheels3">${w}</div></div><div class="ptag">~ZyX_22~</div><i class="gl3"></i></div></div>`; }
  function setWheel(i, d, anim, ms) { const w = qa('.wh3')[i]; if (!w) return; const cyl = w.querySelector('.cyl'), cur = +(w.dataset.v || 0), ang = +(w.dataset.ang || 0);
    if (!anim) { const a = -d * CYS; w.dataset.v = d; w.dataset.ang = a; cyl.style.transform = `translateZ(-${CYR}px) rotateX(${a}deg)`; return; }
    const steps = ((d - cur + 10) % 10) + 10, to = ang - steps * CYS, dur = D(ms || 900);
    const an = cyl.animate([{ transform: `translateZ(-${CYR}px) rotateX(${ang}deg)` }, { transform: `translateZ(-${CYR}px) rotateX(${to - 5}deg)`, offset: .88 }, { transform: `translateZ(-${CYR}px) rotateX(${to}deg)` }], { duration: dur, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
    an.onfinish = () => { cyl.style.transform = `translateZ(-${CYR}px) rotateX(${to}deg)`; an.cancel(); w.dataset.ang = to; w.dataset.v = d; };
    const n = Math.min(steps, 12); for (let k = 0; k < n; k++) later(() => snd('mtick'), k * (dur / n) * .85); later(() => snd('mclick'), dur * .92); }
  const initWheels = vals => { for (let i = 0; i < 6; i++) setWheel(i, vals[i], false); };
  function plkRattle(big) { const pl = q('#pw .plk'); if (!pl) return; const k = big ? 9 : 6; pl.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${-k}deg)` }, { transform: `rotate(${k}deg)` }, { transform: `rotate(${-k * .7}deg)` }, { transform: `rotate(${k * .5}deg)` }, { transform: `rotate(${-k * .25}deg)` }, { transform: 'rotate(0)' }], { duration: D(700), easing: 'ease-out' }); snd('rattle'); }
  function plkOpen() { const root = q('#pw'), g = root.querySelector('.shkg'); g.style.transformOrigin = '30px 110px'; g.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-4px) rotate(0)', offset: .15 }, { transform: 'translateY(-30px) rotate(0)', offset: .5 }, { transform: 'translateY(-28px) rotate(-8deg)', offset: .7 }, { transform: 'translateY(-30px) rotate(-38deg)' }], { duration: D(900), easing: 'cubic-bezier(.25,1.5,.5,1)', fill: 'forwards' }); root.querySelector('.pbody3').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)', offset: .3 }, { transform: 'translateY(0)' }], { duration: D(500), delay: D(120) }); snd('spring'); }
  function chainOn(hostEl, x0, y0, cx, cy, x1, y1, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1, tx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy), ang = Math.atan2(ty, tx) * 180 / Math.PI, l = document.createElement('i'); l.className = 'lk' + (i % 2 ? ' v' : ''); l.dataset.rot = ang; l.style.cssText = `left:${x - (i % 2 ? 6 : 15)}px;top:${y - 8}px;transform:rotate(${ang}deg)`; hostEl.appendChild(l); out.push(l); } return out; }
  const doorHTML = interior => `<div class="doorsc" id="dsc">${interior || ''}<div class="idim" id="idm"></div><div class="doors" id="drs"><div class="dl"><b></b></div><div class="dr"><b></b></div></div><div class="chh" id="chh"></div><div class="plkw" id="pw">${plkHTML()}</div></div>`;
  let links = null;
  function doorSetup(vals) { const ds = q('#dsc'), ch = q('#chh'), W = ds.clientWidth, H = ds.clientHeight, cx = W / 2, sy = H * .24; ch.innerHTML = ''; links = { L: chainOn(ch, -10, H * .20, cx * .5, sy + 60, cx - 52, sy + 14, 7), R: chainOn(ch, W + 10, H * .20, cx * 1.5, sy + 60, cx + 52, sy + 14, 7) }; initWheels(vals || [0, 0, 0, 0, 0, 0]); }
  function dust(hostEl, x, y, n) { if (reduce) return; for (let k = 0; k < n; k++) { const d = document.createElement('i'); d.className = 'dst'; d.style.cssText = `left:${x + (k - n / 2) * 10}px;top:${y}px`; hostEl.appendChild(d); d.animate([{ opacity: .55, transform: 'translate(0,0) scale(.4)' }, { opacity: 0, transform: `translate(${(k - n / 2) * 16}px,-${26 + Math.random() * 26}px) scale(1.7)` }], { duration: D(1100), delay: D(k * 40) }).onfinish = () => d.remove(); } }
  function chainsFall() { const ds = q('#dsc'), H = ds.clientHeight, all = links.L.slice().reverse().concat(links.R.slice().reverse()); snd('chain');
    all.forEach((l, i) => { const rot = +l.dataset.rot, gy = H - 40 - Math.random() * 30, dy = gy - parseFloat(l.style.top), rr = rot + (Math.random() * 160 - 80), dx = (Math.random() * 50 - 25);
      l.animate([{ transform: `translate(0,0) rotate(${rot}deg)` }, { transform: `translate(${dx}px,${dy}px) rotate(${rr}deg)`, offset: .6 }, { transform: `translate(${dx * 1.2}px,${dy - 26}px) rotate(${rr + 20}deg)`, offset: .78 }, { transform: `translate(${dx * 1.3}px,${dy}px) rotate(${rr + 30}deg)` }], { duration: D(1000 + Math.random() * 350), delay: D(i % 8 * 70 + (i < 8 ? 0 : 30)), easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }); if (i % 3 === 0) later(() => snd('mtick'), D(i % 8 * 70 + 800)); });
    later(() => { dust(ds, .3 * ds.clientWidth, H - 34, 6); dust(ds, .7 * ds.clientWidth, H - 34, 6); snd('clunk'); }, D(1250)); }
  function padlockDrop() { const pw = q('#pw'), ds = q('#dsc'), H = ds.clientHeight, gy = H - pw.offsetHeight - pw.offsetTop - 10;
    pw.animate([{ transform: 'translateX(-50%) translateY(0) rotate(0)' }, { transform: `translateX(-50%) translateY(${gy}px) rotate(14deg)`, offset: .52, easing: 'ease-in' }, { transform: `translateX(-50%) translateY(${gy - 70}px) rotate(6deg)`, offset: .7 }, { transform: `translateX(-50%) translateY(${gy}px) rotate(18deg)`, offset: .86, easing: 'ease-in' }, { transform: `translateX(-50%) translateY(${gy - 14}px) rotate(12deg)`, offset: .94 }, { transform: `translateX(-50%) translateY(${gy}px) rotate(20deg)` }], { duration: D(1500), fill: 'forwards' });
    later(() => { snd('clunk'); dust(ds, ds.clientWidth / 2, H - 30, 8); q('.hk-wrap').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(0,4px)' }, { transform: 'translate(0,0)' }], { duration: D(200) }); }, D(780)); later(() => snd('clunk'), D(1300)); }
  function doorsOpen() { const d = q('#drs'), l = d.querySelector('.dl'), r = d.querySelector('.dr'), dim = q('#idm'); snd('creak');
    l.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(-8deg)', offset: .12 }, { transform: 'rotateY(-104deg)' }], { duration: D(2200), fill: 'forwards', easing: 'cubic-bezier(.4,0,.3,1)' });
    r.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(8deg)', offset: .12 }, { transform: 'rotateY(104deg)' }], { duration: D(2200), fill: 'forwards', easing: 'cubic-bezier(.4,0,.3,1)', delay: D(120) });
    dim.style.transition = 'opacity 2.2s ease'; dim.style.opacity = 0; q('#chh').style.opacity = 0; }

  /* ───────── Cadre de l'ecran ───────── */
  function build() {
    if (host) return;
    host = document.createElement('div'); host.id = 'hk-root'; document.body.appendChild(host);
    sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<link rel="stylesheet" href="hacker.css?v=10"><div class="hk-wrap"><div class="bar"><button class="hk-close" data-a="close" type="button"></button><div class="hk-tit"></div><span class="hk-who"></span></div><div class="hk-main" id="main"></div><div class="ptab" id="tabs"></div><div class="push" id="push"><div class="ic">L</div><div><b id="pushT"></b><small id="pushB"></small></div></div></div>`;
    sh.addEventListener('click', onClick);
    sh.addEventListener('pointermove', e => { const m = q('.hk-main'); if (!m) return; const r = m.getBoundingClientRect(); look(e.clientX - r.left, e.clientY - r.top); });
    const syncTheme = () => { host.dataset.theme = document.documentElement.classList.contains('light') ? 'light' : 'dark'; };
    syncTheme(); new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  function isOpen() { return host && host.hasAttribute('data-open'); }
  function open(tab, enig) {
    build(); host.setAttribute('data-open', ''); document.body.style.overflow = 'hidden';
    UI.tab = tab || (V && V.phase === 'locked' ? 'door' : 'door'); UI.enig = enig == null ? null : enig; render();
  }
  function close() { clearT(); if (host) host.removeAttribute('data-open'); document.body.style.overflow = ''; try { sessionStorage.removeItem('libero_hk'); } catch (_) {} }
  function tabsFor() {
    const ph = V && V.phase, mine = V && V.owner && V.owner.mine && V.owner.active;
    if (UI.tab === 'cine') return ['cine'];
    if (ph === 'locked') return ['door', 'book'];
    return mine ? ['ticket', 'door'] : ['door'];
  }
  function setTab(tab, enig) { clearT(); UI.tab = tab; UI.enig = enig == null ? null : enig; render(); }

  function render() {
    if (!host || !V) { if (host) q('#main').innerHTML = '<div class="hk-pre">…</div>'; return; }
    clearT(); const x = X(), tabs = tabsFor(); if (!tabs.includes(UI.tab)) UI.tab = tabs[0];
    q('.hk-close').textContent = x.close; q('.hk-tit').textContent = x.title; q('.hk-who').textContent = '';
    q('#tabs').innerHTML = tabs.map(t => `<button data-a="tab:${t}"${UI.tab === t ? ' class="on"' : ''} type="button">${t === 'book' ? `${x.book} ${V.enigmas.filter(e => e.solved).length}/6` : x[t]}</button>`).join('');
    q('#tabs').style.display = tabs.length > 1 ? '' : 'none';
    const main = q('#main'); main.innerHTML = '';
    if (UI.tab === 'door') tabDoor(); else if (UI.tab === 'book') (UI.enig == null ? tabBook() : tabEnig(UI.enig)); else if (UI.tab === 'cine') tabCine(); else if (UI.tab === 'shop') tabShop(); else if (UI.tab === 'ticket') tabTicket();
    save();
  }
  const foundDigits = () => `<div class="digits" id="dgs">${V.enigmas.map((e, i) => `<div class="dg${e.solved ? ' on' : ''}" id="d${i}">${e.solved ? e.digit : '?'}</div>`).join('')}</div>`;

  /* ───────── Onglet : la porte et son cadenas ───────── */
  function interior(lit) { const x = X(); return `<div class="awn"></div><h3 class="shopname" style="margin-top:6px"><span class="a">${esc(x.shopReal)}</span></h3>${hkEl('', 'left:41%;top:98px;width:78px;height:94px;z-index:4', '')}${sayHTML('b1', 'left:10px;top:200px;--tx:140px;--ox:60%;max-width:250px;z-index:14', '')}`; }
  function shelf(mode) { const lg = L(); return `<div class="shelf" id="sh">${DECO.map((it, k) => `<div class="it" data-k="${k}">${svgI(it.k)}<div class="nm">${esc(it[lg])}</div><div class="pr"><span class="n on" style="opacity:1;transform:none;color:var(--text)">${hkP(it.p)} Libs</span></div></div>${k % 2 === 1 ? '<div class="plank"></div>' : ''}`).join('')}</div>`; }
  function tabDoor() {
    const x = X(), main = q('#main'), ph = V.phase;
    if (ph === 'locked') {
      main.innerHTML = `<div class="pbody">${doorHTML(interior())}<div class="lkd" style="position:absolute;top:8px;left:0;right:0;z-index:9">${foundDigits()}</div><div class="lkui"><button class="btn sm" data-a="try" type="button">${esc(x.try)}</button><div class="tries"><span id="trt"></span></div><div class="sub" style="color:#e9d9b4;font-size:.76rem">${esc(x.touch)}</div></div>${chead()}<div class="sheetm" id="sm"></div><div class="dim" id="dm"></div></div>`;
      doorSetup(UI.code); tries(); return;
    }
    // Cadenas ouvert : on montre la porte ouverte et ce qui s'est passe.
    const own = V.owner, msg = ph === 'ended' && !own ? x.endedOver : own && own.active ? x.owner(own.name) : x.endedDone;
    main.innerHTML = `<div class="pbody"><div class="doorsc" id="dsc" style="min-height:420px">${interior(true).replace('class="awn"', 'class="awn"')}<div class="doors" id="drs" style="pointer-events:none"><div class="dl" style="transform:rotateY(-104deg)"><b></b></div><div class="dr" style="transform:rotateY(104deg)"><b></b></div></div></div><div class="card" style="margin:0 14px;display:grid;gap:6px"><b class="title" style="font-size:1.05rem">${esc(msg)}</b>${own ? `<span class="sub">${esc(x.bannerOwner(own.name, own.used))}</span>` : ''}<button class="btn" data-a="shop" type="button">${esc(x.seeShop)}</button></div></div>`;
  }
  function tries() { const t = q('#trt'); if (!t) return; const x = X(); if (V.codeLeft > 0) t.textContent = x.tries(V.codeLeft); else { const m = Math.max(1, Math.ceil((V.codeRetryAt - sn()) / 60000)); t.textContent = x.wait(m); } }
  function tryCode() {
    if (V.codeLeft <= 0) { quip(X().zx.codeBad[0], 0, 2600); return; }
    sock.emit('hk-code', { playerId: pid(), code: UI.code.join('') });
  }
  function onCodeResult(r) {
    if (!isOpen() || UI.tab !== 'door') { if (r && r.ok) refresh(); return; }
    const x = X();
    if (r.ok) { runUnlock(); return; }
    if (r.error === 'late') { const s = Math.max(1, Math.round((r.ago || 0) / 1000)); modal(`<b class="title" style="font-size:1.1rem">${esc(x.lateT)}</b><p class="sub" style="margin:0">${esc(x.late(r.owner || '?', s))}</p><button class="btn" data-a="shop" type="button">${esc(x.seeShop)}</button>`); refresh(); return; }
    if (r.error === 'anonymous') { quip(x.anon, 0, 3000); return; }
    if (r.error === 'wait') { plkRattle(true); V.codeLeft = 0; V.codeRetryAt = r.retryAt; tries(); return; }
    if (r.error === 'wrong') { plkRattle(true); snd('wrong'); V.codeLeft = r.left; V.codeRetryAt = r.retryAt || 0; tries(); quip(x.zx.codeBad[Math.floor(Math.random() * x.zx.codeBad.length)], 0, 2800); return; }
    if (r.error === 'rate') { quip(x.zx.rate, 0, 2800); return; }
    if (r.error === 'closed') { quip(x.closedEv, 0, 2800); refresh(); }
  }
  function modal(html) { const m = q('#sm'), d = q('#dm'); if (!m) return; m.innerHTML = html; d.classList.add('on'); m.classList.add('on'); snd('page'); }
  function runUnlock() {
    const x = X(), h = q('.hk'), ph = q('.hk-wrap'); q('.lkui').style.display = 'none'; clearT(); UI.unlocking = true;
    later(() => { plkRattle(false); snd('mclick'); }, 100);
    later(() => plkOpen(), 900);
    later(() => { padlockDrop(); chainsFall(); }, 2000);
    later(() => doorsOpen(), 3600);
    later(() => { if (h) h.querySelector('svg').outerHTML = HK('shock'); ph.classList.add('shake'); talk('b1', x.zx.panic, 0, 28); snd('wrong'); }, 5200);
    later(() => { ph.classList.remove('shake'); const b = q('#b1'); if (b) b.classList.remove('on'); }, 6400);
    later(() => { const hk = q('.hk'); if (hk) hk.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-18px,-24px) rotate(-18deg)', offset: .25 }, { transform: 'translate(300px,-70px) rotate(40deg)', opacity: 0 }], { duration: D(1300), fill: 'forwards', easing: 'ease-in' }); snd('whoosh');
      const s = document.createElement('div'); s.className = 'sticky'; s.style.cssText = 'left:60px;top:440px;opacity:0;font-size:1.1rem;z-index:15;max-width:260px'; s.textContent = x.zx.bye; q('#dsc').appendChild(s); s.animate([{ opacity: 0, transform: 'rotate(-3deg) translateY(-90px)' }, { opacity: 1, transform: 'rotate(-3deg)' }], { duration: D(700), fill: 'forwards', easing: 'cubic-bezier(.34,1.4,.64,1)' }); }, D(6600));
    later(() => { const pw = q('#pw'); if (pw) pw.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(900), fill: 'forwards' }); }, 6800);
    later(() => { snd('fanfare'); cannons([{ x: 0, y: .95, a: -1.0 }, { x: 1, y: .95, a: -2.14 }], 30); const st = document.createElement('div'); st.className = 'stampbig'; st.style.cssText = 'font-size:1.45rem;z-index:20'; st.textContent = x.unlockedT; q('#dsc').appendChild(st); slam(st, 600); }, 7600);
    later(() => { pushNote(x.unlockedT, x.youFirst); }, 9000);
    later(() => { refresh(() => { UI.unlocking = false; setTab('ticket'); }); }, 11500);
  }

  /* ───────── Onglet : le carnet des enigmes ───────── */
  function whenTxt(ts) { const d = new Date(ts), x = X(); return `${x.days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')} h`; }
  function tabBook() {
    const x = X(), main = q('#main');
    const rows = V.enigmas.map((e, i) => `<div class="enr${e.solved ? ' done' : ''}${!e.open ? ' lock' : ''}" data-a="enig:${i}" style="cursor:pointer"><div class="n">${i + 1}</div><span><b style="font-family:var(--fd);font-weight:400">${esc(x.names[i])}</b><br><span class="sub">${esc(x.types[i])} · ${dpips(Math.max(1, x.levels[i] || 1))}</span></span><span class="st">${e.solved ? x.solved(e.digit) : e.open ? x.open : x.soon(whenTxt(e.release))}</span></div>`).join('');
    main.innerHTML = `<div class="pbody">${chead()}<div class="pad" style="padding-top:12px"><p class="cap">${esc(x.notebook)}</p>${foundDigits()}${rows}<div id="lie"></div><div class="sub" style="text-align:center">${esc(x.bookNote)}</div></div></div>`;
    if (!UI.lie && V.enigmas.some(e => e.open && !e.solved)) { UI.lie = true; later(() => { const l = q('#lie'); if (!l) return; l.innerHTML = `<div class="sticky" style="position:relative;transform:rotate(-1.5deg);font-size:1.1rem;opacity:1;margin:6px 10px">${esc(x.zx.lieHead)}<br>${esc(x.zx.lieNote)} <b style="color:var(--red)">${L() === 'en' ? 'PENCILCASE' : 'CARTABLE'}</b></div>`; l.animate([{ opacity: 0, transform: 'translateY(-30px)' }, { opacity: 1, transform: 'none' }], { duration: D(500) }); snd('stamp'); quip(x.zx.lieSay, 200, 3200); }, 2500); }
  }
  function enigBody(i) {
    const x = X(), en = L() === 'en';
    if (i === 0) return `<div class="sticky" style="position:relative;transform:rotate(-1.5deg);font-size:1.05rem;align-self:flex-start;opacity:1">${esc(x.st[0])}</div><div class="wd" id="tl">${x.anag.split('').map((c, k) => `<i data-a="tl:${k}">${c}</i>`).join('')}</div><div class="wd" id="ot">${x.anag.split('').map(() => '<i>?</i>').join('')}</div><div class="row2"><button class="btn ghost sm" data-a="tlclr" type="button">${esc(x.clear)}</button></div><div class="sub" style="text-align:center">${esc(x.tl)}</div>`;
    if (i === 1) return `<div class="sticky" style="position:relative;transform:rotate(1.2deg);font-size:1.05rem;align-self:flex-end;opacity:1">${esc(x.st[1])}</div><div class="mirror" id="mr"><b id="mt">${esc(x.mirrorWord)}</b><i class="shine"></i></div><button class="btn sm" data-a="mir" style="align-self:center" type="button">${esc(x.mirror)}</button>`;
    if (i === 2) return `<div class="sticky" style="position:relative;transform:rotate(1.2deg);font-size:1.05rem;align-self:flex-end;opacity:1">${esc(x.st[2])}</div><div class="shelf4" id="sf">${x.ini.map((n, k) => `<div class="it fake2" data-a="ini:${k}" style="cursor:pointer"><div class="nm"><b class="ini">${esc(n[0])}</b>${esc(n.slice(1))}</div></div>`).join('')}</div><div class="wd" id="ot">${x.ini.map(() => '<i>?</i>').join('')}</div><div class="row2"><button class="btn ghost sm" data-a="iniclr" type="button">${esc(x.clear)}</button></div>`;
    if (i === 3) { const G = x.bog; let h = `<div class="sticky" style="position:relative;transform:rotate(1deg);font-size:1.05rem;align-self:flex-start;opacity:1">${esc(x.st[3])}</div><div class="bog b3" id="bg">`; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) h += `<div class="bc${r === 0 && c === 0 ? ' hit' : ''}" data-a="bc:${r}:${c}" data-r="${r}" data-c="${c}">${G[r][c]}</div>`; const n = en ? 4 : 5; return h + `<svg class="bgl" viewBox="0 0 3 3" preserveAspectRatio="none"><polyline id="pl" fill="none" stroke="var(--red)" stroke-width=".12" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></svg></div><div class="wd" id="ot">${Array(n).fill('<i>?</i>').join('')}</div><div class="row2"><button class="btn ghost sm" data-a="bclr" type="button">${esc(x.clear)}</button></div><div class="sub" style="text-align:center">${esc(x.bogHelp)}</div>`; }
    if (i === 4) return `<div class="chests">${x.liarBoxes.map((b, k) => `<div class="ch"><b>${esc(b)}</b><span>${esc(x.liarMsgs[k])}</span></div>`).join('')}</div><div class="sub" style="text-align:center;font-weight:700">${esc(x.liarsOne)}</div><table class="lg" id="lg"><tr><th>${esc(x.liarTest)}</th><th>${x.msg} 1</th><th>${x.msg} 2</th><th>${x.msg} 3</th><th>${x.trues}</th></tr>${[[0, 1, 0], [1, 0, 1], [0, 1, 1]].map((r, k) => `<tr id="lr${k}"><td><button class="btn ghost sm" data-a="hyp:${k}" type="button">${esc(x.ifIn(x.liarHyp[k]))}</button></td>${r.map(v => `<td class="cl" data-v="${v}"></td>`).join('')}<td class="ct"></td></tr>`).join('')}</table>`;
    return `<div class="sticky" style="position:relative;transform:rotate(-1.5deg);font-size:1.05rem;align-self:flex-start;opacity:1">${esc(x.st[5])}</div><div class="wd" id="ct">${x.caesar.split('').map(c => `<i style="width:30px">${c}</i>`).join('')}</div><div class="disc"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="104" fill="var(--card2)" stroke="var(--line)" stroke-width="3"/><circle cx="110" cy="110" r="76" fill="var(--card)" stroke="var(--line)" stroke-width="2"/><g id="outer"></g><g id="inner"></g><circle cx="110" cy="110" r="20" fill="var(--board)" stroke="var(--line)" stroke-width="3"/><path d="M110 4 l-7 -10 h14z" fill="var(--red)"/></svg></div><div class="row2"><button class="btn ghost sm" data-a="d:-1" type="button">${esc(x.turnL)}</button><button class="btn ghost sm" data-a="d:1" type="button">${esc(x.turnR)}</button></div><div class="wd" id="ot">${x.caesar.split('').map(() => '<i style="width:30px">?</i>').join('')}</div>`;
  }
  function tabEnig(i) {
    const x = X(), e = V.enigmas[i], main = q('#main');
    if (!e.open) { UI.enig = null; return tabBook(); }
    main.innerHTML = `<div class="pbody">${chead()}<div class="pad" style="padding-top:12px;gap:10px"><div class="eh"><span class="en">${L() === 'en' ? 'Riddle' : 'Énigme'} ${i + 1}</span><b class="title">${esc(x.names[i])}</b></div><div class="meta"><span class="pill2">${esc(x.types[i])}</span><span class="lvl">${esc(x.diff)} ${dpips(Math.max(1, x.levels[i] || 1))}</span></div>${enigBody(i)}<div class="inp"><input id="ai" class="f" maxlength="14" autocomplete="off" spellcheck="false" placeholder="${esc(x.answerPh)}"><button class="btn sm" data-a="ans" type="button">${esc(x.validate)}</button></div><div class="tries"><span id="tt"></span></div><div class="row2"><button class="btn ghost sm" data-a="hint" id="hb" type="button"></button></div><div id="hn"></div>${foundDigits()}<button class="btn ghost sm" data-a="tab:book" type="button">${esc(x.back)}</button></div><div class="bigstamp" id="bs" style="top:40%">${esc(x.rightStamp)}</div></div>`;
    UI.tl = []; UI.ini = []; UI.path = [[0, 0]]; UI.sh = 0; sock.emit('hk-open', { playerId: pid(), i });
    if (i === 3) { q('#pl').setAttribute('points', '0.5,0.5'); const o = qa('#ot i')[0]; o.textContent = x.bog[0][0]; o.classList.add('hit'); setAi(x.bog[0][0]); }
    if (i === 5) { const out = q('#outer'), inn = q('#inner'); const ring = (g, r, fill, sz) => { for (let k = 0; k < 26; k++) g.insertAdjacentHTML('beforeend', `<text x="110" y="${110 - r}" transform="rotate(${k * 360 / 26} 110 110)" text-anchor="middle" font-family="Archivo Black,sans-serif" font-size="${sz}" fill="${fill}">${ALPHA[k]}</text>`); }; ring(out, 92, 'var(--text)', 11); ring(inn, 64, 'var(--ink)', 11); }
    const ai = q('#ai'); ai.addEventListener('keydown', ev => { if (ev.key === 'Enter') answer(); });
    if (e.solved) { ai.value = L() === 'en' ? ['CHALK', 'ERASER', 'KEY', 'DOOR', 'RULER', 'PADLOCK'][i] : ['CRAIE', 'TROUSSE', 'CLEF', 'PORTE', 'REGLE', 'CADENAS'][i]; ai.disabled = true; q('#tt').textContent = x.already + ' : ' + x.solved(e.digit); } else ansLeft(e);
    hintUpdate(); hintTimer = setInterval(hintUpdate, 1000);
  }
  function ansLeft(e) { const t = q('#tt'); if (!t) return; const x = X(); if (e.left > 0) t.textContent = x.triesLeft(e.left); else t.textContent = x.retry(Math.max(1, Math.ceil((e.retryAt - sn()) / 60000))); }
  function setAi(v) { const a = q('#ai'); if (a && !a.disabled) a.value = v; }
  function hintUpdate() { const hb = q('#hb'); if (!hb || UI.enig == null) return; const x = X(), e = V.enigmas[UI.enig], t = sn(); const lvl = e.hintAt ? (t >= e.hintAt[1] ? 2 : t >= e.hintAt[0] ? 1 : 0) : 0; const shown = UI.hint[UI.enig] || 0;
    if (lvl === 0) { const ms = e.hintAt ? e.hintAt[0] - t : 15 * 60000; const s = Math.max(0, Math.ceil(ms / 1000)); hb.disabled = true; hb.textContent = x.hintIn(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }
    else if (shown >= lvl && lvl >= 2) { hb.disabled = true; hb.textContent = x.hintGone; }
    else if (shown >= lvl) { const ms = e.hintAt[1] - t, s = Math.max(0, Math.ceil(ms / 1000)); hb.disabled = true; hb.textContent = x.hintIn(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }
    else { hb.disabled = false; hb.textContent = x.hint; } }
  function showHint() { const e = V.enigmas[UI.enig], t = sn(), lvl = e.hintAt ? (t >= e.hintAt[1] ? 2 : t >= e.hintAt[0] ? 1 : 0) : 0; if (!lvl) return; UI.hint[UI.enig] = lvl; q('#hn').innerHTML = `<div class="sticky">${esc(X().libe)} : ${X().hints[UI.enig].slice(0, lvl).map(esc).join('<br>')}</div>`; snd('ding'); hintUpdate(); }
  function answer() { const ai = q('#ai'); if (!ai || ai.disabled) return; const v = ai.value.trim(); if (!v) return; sock.emit('hk-answer', { playerId: pid(), i: UI.enig, text: v }); }
  function onAnswerResult(r) {
    if (!isOpen() || UI.tab !== 'book' || UI.enig == null) return; const x = X(), i = r.i != null ? r.i : UI.enig, e = V.enigmas[i], ai = q('#ai'); if (!e || i !== UI.enig) return;
    if (r.ok) { e.solved = true; e.digit = r.digit; if (ai) ai.disabled = true; slam(q('#bs'), 520, -9); const d = q('#d' + i); if (d) { d.classList.add('on'); d.textContent = r.digit; d.animate([{ transform: 'translateY(-44px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: D(500), easing: 'cubic-bezier(.34,1.6,.64,1)' }); } snd('note', i * 2);
      later(() => { const b = q('#bs'); if (b) b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(400), fill: 'forwards' }); quip(x.zx.good[i], 0, 3600); const t = q('#tt'); if (t) t.textContent = x.goodAns(r.digit); }, D(1100)); return; }
    if (r.error === 'wrong' || r.error === 'wait') { snd('wrong'); if (ai) { ai.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: D(350) }); ai.style.borderColor = 'var(--red)'; setTimeout(() => { if (ai) ai.style.borderColor = ''; }, 700); }
      e.left = r.left != null ? r.left : 0; e.retryAt = r.retryAt || 0; const t = q('#tt'); if (t) t.textContent = r.error === 'wait' ? x.retry(Math.max(1, Math.ceil((r.retryAt - sn()) / 60000))) : x.wrongLeft(e.left);
      const typed = ai ? ai.value.toUpperCase() : ''; if (i === 1 && (typed === 'CARTABLE' || typed === 'PENCILCASE')) { quip(x.zx.lie, 0, 3200); const s = document.createElement('div'); s.className = 'bigstamp red'; s.textContent = x.lieStamp; s.style.top = '36%'; q('.hk-main').appendChild(s); slam(s, 520, -14); setTimeout(() => s.remove(), 2200); } else quip(x.zx.wrong[Math.floor(Math.random() * x.zx.wrong.length)], 0, 2800); return; }
    if (r.error === 'locked' || r.error === 'closed') { refresh(); return; }
    if (r.error === 'anonymous') { quip(x.anon, 0, 3000); return; }
    if (r.error === 'rate') quip(x.zx.rate, 0, 2800);
  }

  /* ───────── Onglet : la boutique occupee (farces) ───────── */
  function tabShop() {
    const x = X(), main = q('#main'), first = !UI.intro && !localStorage.getItem('libero_hk_seen');
    main.innerHTML = `<div class="pbody"><div class="awn hacked"></div><div class="tape"></div><h3 class="shopname hacked"><span class="a">${esc(x.shopReal)}</span><span class="b">${esc(x.shopName)}</span></h3><div class="desk"><div class="lamp"></div><div class="cup"><i></i><i></i></div><div class="top"></div>${hkEl('bob', 'left:44%;bottom:12px;width:62px;height:74px')}</div>${sayHTML('b1', 'left:10px;top:150px;--tx:150px;--ox:60%', '')}${shelf('new')}<div class="sub" style="text-align:center;margin-top:auto">${esc(x.closedNote)}</div></div>`;
    qa('#sh .it').forEach(it => it.classList.add('bob'));
    visit++;
    if (first) { UI.intro = true; try { localStorage.setItem('libero_hk_seen', '1'); } catch (_) {} const seq = x.zx.intro; let t = 400; seq.forEach((line, k) => { talk('b1', line, t, 34); t += line.length * 34 + 1900; later(() => { const b = q('#b1'); if (b) b.classList.remove('on'); }, t - 400); }); later(startTraps, t + 600); return; }
    if (visit === 1) talk('b1', x.zx.welcome, 500, 34);
    later(startTraps, visit === 1 ? 5200 : 2500);
  }
  function startTraps() {
    if (!pranksOn() || UI.tab !== 'shop') return; const order = ['fake', 'labels', 'thief', 'dark'], st = (visit - 1) % 4, qn = [0, 1, 2].map(i => order[(st + i) % 4]);
    const nxt = i => { if (i >= qn.length || UI.tab !== 'shop') return; TRAP[qn[i]](() => later(() => nxt(i + 1), 3500)); }; nxt(0);
  }
  const pb = () => q('.hk-main .pbody');
  const itemsEl = () => qa('#sh .it').filter(e => !e.classList.contains('fake'));
  const TRAP = {
    fake(done) { const x = X(), b = pb(), f = document.createElement('div'), pos = [[30, 320], [210, 200], [24, 420], [200, 340]]; let h = 0, fin = false;
      f.className = 'it fake'; f.style.cssText = `position:absolute;width:150px;z-index:9;left:${pos[0][0]}px;top:${pos[0][1]}px;cursor:pointer;transition:left .45s cubic-bezier(.3,1.4,.5,1),top .45s cubic-bezier(.3,1.4,.5,1)`;
      f.innerHTML = `<div class="pc">−90 %</div>${svgI('star')}<div class="nm">${esc(x.zx.fakeName)}</div><div class="pr"><span class="n on" style="opacity:1;transform:none;color:var(--text)">${hkP(20)} Libs</span></div>`; b.appendChild(f);
      f.animate([{ transform: 'scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: D(500), easing: 'cubic-bezier(.34,1.6,.64,1)' }); snd('ding'); talk('b1', x.zx.fake, 200, 34);
      f.onclick = e => { e.stopPropagation(); if (fin) return; h++; if (h < 3) { const p = pos[h]; f.style.left = p[0] + 'px'; f.style.top = p[1] + 'px'; snd('whoosh'); talk('b1', h === 1 ? x.zx.slow : x.zx.almost, 0, 34); } else { fin = true; snd('stamp'); f.style.opacity = 0; const st = document.createElement('div'); st.className = 'sticky'; st.style.cssText = `left:${f.style.left};top:${f.style.top};font-size:1.3rem;max-width:230px`; st.innerHTML = `${esc(x.zx.fakeStamp)}<br><span style="font-size:.95rem">${esc(x.zx.fakeTxt)}</span>`; b.appendChild(st); st.animate([{ opacity: 0, transform: 'rotate(-3deg) scale(2.4)' }, { opacity: 1, transform: 'rotate(-3deg) scale(1)' }], { duration: D(450), easing: 'cubic-bezier(.34,1.6,.64,1)' }); talk('b1', x.zx.caught, 0, 34); const pl = document.createElement('div'); pl.style.textAlign = 'center'; pl.innerHTML = `<span class="pill">${esc(x.zx.fakePill)}</span>`; b.appendChild(pl); later(() => { st.remove(); f.remove(); pl.remove(); done(); }, 4200); } };
      later(() => { if (!fin) { fin = true; f.style.opacity = 0; later(() => { f.remove(); done(); }, 500); } }, 14000); },
    labels(done) { const x = X(), its = itemsEl(), names = DECO.map(i => i[L()]), shuf = [3, 5, 1, 4, 0, 2]; talk('b1', x.zx.labels, 0, 36); snd('whoosh');
      its.forEach((it, k) => { const nm = it.querySelector('.nm'); nm.style.opacity = 0; later(() => { nm.textContent = names[shuf[k]]; nm.style.opacity = 1; nm.style.transform = `rotate(${(k % 2) * 4 - 2}deg)`; nm.style.background = 'linear-gradient(transparent 55%,var(--mark) 55%)'; snd('tick'); }, D(300)); });
      let tt = null; q('#sh').onclick = e => { const it = e.target.closest('.it'); if (!it) return; if (tt) tt.remove(); tt = document.createElement('div'); tt.className = 'sticky'; tt.style.cssText = 'left:20px;top:380px;max-width:260px;font-size:1rem'; tt.textContent = x.zx.labelTip; pb().appendChild(tt); snd('tick'); };
      later(() => { if (tt) tt.remove(); its.forEach((it, k) => { const nm = it.querySelector('.nm'); nm.style.opacity = 0; later(() => { nm.textContent = names[k]; nm.style.opacity = 1; nm.style.transform = 'none'; nm.style.background = 'none'; }, D(300)); }); const sh2 = q('#sh'); if (sh2) sh2.onclick = null; done(); }, 9500); },
    thief(done) { const x = X(), its = itemsEl(), it = its[Math.floor(Math.random() * its.length)], b = pb(), hd = document.createElement('div'); hd.className = 'hand-s'; hd.innerHTML = '<svg viewBox="0 0 44 90"><rect x="14" y="0" width="16" height="54" fill="var(--hood)" stroke="var(--line)" stroke-width="2.5"/><path d="M6 54 Q6 44 14 44 L30 44 Q38 44 38 54 L38 76 Q38 90 22 90 Q6 90 6 76Z" fill="var(--hood)" stroke="var(--line)" stroke-width="2.5"/></svg>'; b.appendChild(hd); const p = rel(it, b); hd.style.left = (p.x - 22) + 'px'; hd.style.top = '-100px'; hd.style.opacity = 1;
      hd.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${p.y - 40}px)` }], { duration: D(700), fill: 'forwards', easing: 'ease-in' }); snd('whoosh');
      later(() => { it.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-380px)', opacity: 1 }], { duration: D(800), fill: 'forwards', easing: 'ease-in' }); hd.animate([{ transform: `translateY(${p.y - 40}px)` }, { transform: 'translateY(-140px)' }], { duration: D(800), fill: 'forwards', easing: 'ease-in' }); snd('laugh'); talk('b1', x.zx.thief, 300, 36); }, D(800));
      later(() => { hd.remove(); it.getAnimations().forEach(a => a.cancel()); it.animate([{ transform: 'translateY(-380px) rotate(-12deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1, offset: .65 }, { transform: 'translateY(-14px)', offset: .8 }, { transform: 'translateY(0)' }], { duration: D(900), easing: 'ease-in' }); snd('clunk'); talk('b1', x.zx.giveBack, 300, 36); }, 5600); later(done, 8400); },
    dark(done) { const x = X(), m = q('.hk-main'), dk = document.createElement('div'); dk.className = 'dark'; m.appendChild(dk); const cn = document.createElement('div'); cn.className = 'cnt'; cn.style.opacity = 1; cn.textContent = x.zx.lightIn(8); m.appendChild(cn); const w = document.createElement('div'); w.className = 'window'; w.style.cssText = 'position:absolute;left:16px;right:16px;top:150px;z-index:11;background:transparent;border:0'; w.innerHTML = `<div class="gr" style="font-size:2rem">${esc(x.zx.darkTxt)}</div>`; m.appendChild(w);
      const mv = e => { const r = m.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; dk.style.setProperty('--x', (p.clientX - r.left) + 'px'); dk.style.setProperty('--y', (p.clientY - r.top) + 'px'); look(p.clientX - r.left, p.clientY - r.top); };
      m.addEventListener('pointermove', mv); m.addEventListener('touchmove', mv); requestAnimationFrame(() => dk.classList.add('on')); snd('dark'); talk('b1', x.zx.dark, 0, 34);
      for (let k = 1; k <= 8; k++) later(() => { cn.textContent = x.zx.lightIn(8 - k); }, k * 1000);
      later(() => { dk.classList.remove('on'); m.removeEventListener('pointermove', mv); m.removeEventListener('touchmove', mv); later(() => { dk.remove(); cn.remove(); w.remove(); done(); }, 1500); }, 8200); },
  };
  function lockedTap(e) { const it = e.target.closest('#sh .it'); if (!it || it.classList.contains('fake') || (q('#sh') && q('#sh').onclick)) return; const l = X().zx.locked; talk('b1', l[Math.floor(Math.random() * l.length)], 0, 36); }

  /* ───────── Onglet : le ticket du maitre de la boutique ───────── */
  function itemName(id) { const it = window._allShopItemsById && window._allShopItemsById[id]; return (it && it.name) || id; }
  function ticketHTML(used, slots) { let s = ''; for (let i = 0; i < slots; i++) { const it = V.ticket && V.ticket.items[i]; s += `<div class="slot${it ? ' used' : ''}${it && it.k === 'gift' ? ' gift' : ''}" data-s="${i}"><div class="hole"></div><svg viewBox="0 0 24 24">${it ? IC[it.k === 'gift' ? 'gift' : 'star'] : ''}</svg></div>`; }
    const x = X(), r = slots - used; return `<div class="ticket"><div class="th">${esc(x.ownerT.toUpperCase())}</div><div class="big">${esc(x.slotsN(slots))}</div><div class="slots">${s}</div><div class="stub"><span>${esc(x.left(r))}</span><span>${used} / ${slots}</span></div></div>`; }
  function tabTicket() {
    const x = X(), main = q('#main'), o = V.owner, tk = V.ticket || { items: [], free: [] };
    if (!o || !o.mine) { setTab('door'); return; }
    const free = tk.free.map(id => `<div class="enr" style="grid-template-columns:1fr auto"><span><b style="font-family:var(--fd);font-weight:400">${esc(itemName(id))}</b></span><button class="btn ghost sm" data-a="giftopen:${esc(id)}" type="button"${o.used >= o.slots ? ' disabled' : ''}>${esc(x.offer)}</button></div>`).join('');
    main.innerHTML = `<div class="pbody">${chead()}<div class="pad" style="padding-top:60px;gap:12px">${ticketHTML(o.used, o.slots)}<div class="rules" id="ru">${x.rules.map((t, i) => `<div class="on"><i>${i + 1}</i><span>${esc(t)}</span></div>`).join('')}</div>${tk.free.length ? `<p class="cap">${esc(x.myFree)}</p>${free}` : ''}<button class="btn" data-a="pick" type="button">${esc(x.pick)}</button></div><div class="dim" id="dm"></div><div class="sheetm" id="sm"></div></div>`;
    const tki = q('.ticket'); if (tki && !UI.tkAnim) { UI.tkAnim = true; tki.animate([{ transform: 'translateY(-500px) rotate(-20deg) rotateY(180deg)', opacity: 0 }, { transform: 'translateY(0) rotate(4deg) rotateY(0)', opacity: 1, offset: .6 }, { transform: 'translateY(-26px) rotate(-2deg)', offset: .78 }, { transform: 'translateY(0) rotate(0)' }], { duration: D(1300), easing: 'ease-in' }); later(() => snd('clunk'), D(780)); quip(x.zx.ticket, 2000, 3600); }
  }
  function giftOpen(id) {
    const x = X(), fr = window._myFriends || [];
    if (!fr.length) { modal(`<b class="title" style="font-size:1.05rem">${esc(x.offer)}</b><p class="sub" style="margin:0">${esc(x.noFriend)}</p><button class="btn" data-a="mclose" type="button">OK</button>`); return; }
    UI.giftItem = id; UI.giftFriend = null;
    modal(`<b class="title" style="font-size:1.05rem">${esc(x.offer)} : ${esc(itemName(id))}</b><p class="sub" style="margin:0">${esc(x.chooseFriend)}</p><div class="frd" style="flex-wrap:wrap">${fr.map(f => `<div class="fr" data-a="fr:${esc(f.ref)}"><span class="av">${esc(String(f.name || '?')[0].toUpperCase())}</span>${esc(f.name)}</div>`).join('')}</div><p class="sub" style="margin:0">${esc(x.giftNote)}</p><div class="row2"><button class="btn ghost" data-a="mclose" type="button">${esc(x.cancel)}</button><button class="btn" data-a="gsend" type="button">${esc(x.send)}</button></div>`);
  }
  function onTakeResult(r) { if (!isOpen()) return; const x = X(); if (r.ok && r.gift) { pushNote(x.giftOk(r.to), ''); quip(x.zx.gift, 600, 3200); } if (!r.ok) { quip(x.takeErr[r.error] || x.takeErr.rate, 0, 3000); } }

  /* ───────── Evenements de clic ───────── */
  function onClick(e) {
    const el = e.target.closest('[data-a]'), id = e.target;
    const wh = e.target.closest('.wh3');
    if (wh && UI.tab === 'door' && V.phase === 'locked' && q('.lkui') && q('.lkui').style.display !== 'none') { const i = +wh.dataset.i, rc = wh.getBoundingClientRect(), dl = (e.clientY < rc.top + rc.height / 2) ? 1 : -1; UI.code[i] = (UI.code[i] + dl + 10) % 10; setWheel(i, UI.code[i], true, 350); return; }
    if (UI.tab === 'shop') lockedTap(e);
    if (!el) return; const a = el.dataset.a.split(':'), act = a[0], x = X();
    if (act === 'close') return close();
    if (act === 'tab') return setTab(a[1]);
    if (act === 'cine') { endCine(); return; }
    if (act === 'shop') { close(); if (typeof showScreen === 'function') showScreen('shop'); return; }
    if (act === 'pick') { close(); if (typeof showScreen === 'function') showScreen('shop'); return; }
    if (act === 'try') return tryCode();
    if (act === 'mclose') { q('#dm').classList.remove('on'); q('#sm').classList.remove('on'); return; }
    if (act === 'enig') { const i = +a[1], e2 = V.enigmas[i]; if (!e2.open) { snd('wrong'); return; } return setTab('book', i); }
    if (act === 'ans') return answer();
    if (act === 'hint') return showHint();
    if (act === 'giftopen') return giftOpen(a.slice(1).join(':'));
    if (act === 'fr') { UI.giftFriend = a[1]; qa('.fr').forEach(f => f.classList.remove('sel')); el.classList.add('sel'); return; }
    if (act === 'gsend') { if (!UI.giftFriend) { snd('wrong'); return; } sock.emit('hk-gift', { playerId: pid(), cosmeticId: UI.giftItem, ref: UI.giftFriend }); q('#dm').classList.remove('on'); q('#sm').classList.remove('on'); return; }
    // interactions des enigmes
    if (act === 'tl') { const k = +a[1]; if (UI.tl.indexOf(k) >= 0) return; UI.tl.push(k); el.classList.add('used'); snd('note', UI.tl.length * 2); const w = x.anag, tx = UI.tl.map(v => w[v]).join(''); qa('#ot i').forEach((e2, j) => { e2.textContent = tx[j] || '?'; e2.classList.toggle('hit', !!tx[j]); }); setAi(tx); return; }
    if (act === 'tlclr') { UI.tl = []; qa('#tl i').forEach(v => v.classList.remove('used')); qa('#ot i').forEach(e2 => { e2.textContent = '?'; e2.classList.remove('hit'); }); setAi(''); return; }
    if (act === 'mir') { const mt = q('#mt'); mt.style.transition = 'transform .9s'; mt.style.transform = 'scaleX(1)'; snd('whoosh'); const s = q('.mirror .shine'); s.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(260%)' }], { duration: D(900) }); q('#mr').style.borderColor = 'var(--ok)'; return; }
    if (act === 'ini') { const k = +a[1], W = x.iniAns.split(''); if (UI.ini.indexOf(k) < 0) { UI.ini.push(k); el.querySelector('.ini').classList.add('hit'); snd('note', UI.ini.length * 2); } qa('#ot i').forEach((e2, j) => { e2.textContent = UI.ini[j] !== undefined ? W[UI.ini[j]] : '?'; e2.classList.toggle('hit', UI.ini[j] !== undefined); }); setAi(UI.ini.map(v => W[v]).join('')); return; }
    if (act === 'iniclr') { UI.ini = []; qa('.ini').forEach(v => v.classList.remove('hit')); qa('#ot i').forEach(e2 => { e2.textContent = '?'; e2.classList.remove('hit'); }); setAi(''); return; }
    if (act === 'bc') { const br = +a[1], bc = +a[2], last = UI.path[UI.path.length - 1]; if (UI.path.some(p => p[0] === br && p[1] === bc)) return; if (Math.abs(last[0] - br) + Math.abs(last[1] - bc) !== 1) { snd('wrong'); return; } UI.path.push([br, bc]); el.classList.add('hit'); snd('note', UI.path.length * 2); q('#pl').setAttribute('points', UI.path.map(p => `${p[1] + .5},${p[0] + .5}`).join(' ')); const tx = UI.path.map(p => x.bog[p[0]][p[1]]).join(''); qa('#ot i').forEach((e2, j) => { e2.textContent = tx[j] || '?'; e2.classList.toggle('hit', !!tx[j]); }); setAi(tx); return; }
    if (act === 'bclr') { UI.path = [[0, 0]]; q('#pl').setAttribute('points', '0.5,0.5'); qa('.bc').forEach((v, k) => v.classList.toggle('hit', k === 0)); qa('#ot i').forEach((e2, j) => { e2.textContent = j === 0 ? x.bog[0][0] : '?'; e2.classList.toggle('hit', j === 0); }); setAi(x.bog[0][0]); return; }
    if (act === 'hyp') { const r = q('#lr' + a[1]), cells = r.querySelectorAll('.cl'); let n = 0; cells.forEach(c => { const v = +c.dataset.v; n += v; c.textContent = v ? x.vrai : x.faux; c.className = 'cl ' + (v ? 't' : 'f'); c.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1)' }], { duration: D(260) }); }); r.querySelector('.ct').textContent = n; r.className = n === 1 ? 'good' : 'bad'; snd(n === 1 ? 'ok' : 'wrong'); return; }
    if (act === 'd') { UI.sh = (UI.sh + +a[1] + 26) % 26; const inn = q('#inner'); inn.style.transition = 'transform .4s'; inn.style.transform = `rotate(${UI.sh * 360 / 26}deg)`; inn.style.transformOrigin = '110px 110px'; snd('mclick'); const cip = x.caesar.split(''); qa('#ot i').forEach((e2, k) => { e2.textContent = UI.sh ? ALPHA[(ALPHA.indexOf(cip[k]) - UI.sh + 26) % 26] : '?'; }); return; }
  }

  /* ───────── Etat serveur ───────── */
  function refresh(cb) { if (!sock) return; sock.emit('hk-get', { playerId: pid() }); if (cb) UI._after = cb; }
  function setState(v) {
    V = v; V._at = performance.timeOrigin + performance.now();
    if (!host || !isOpen()) { if (UI._after) { const f = UI._after; UI._after = null; f(); } return; }
    if (UI._after) { const f = UI._after; UI._after = null; f(); return; }
    if (v.phase !== 'locked' && UI.tab === 'door' && !UI.unlocking) { render(); return; }
    // Etat reactualise pendant que l'ecran est ouvert : on ne casse pas une animation ni une saisie.
    if (UI.tab === 'door' && v.phase === 'locked') { tries(); const dg = q('#dgs'); if (dg) dg.outerHTML = foundDigits(); return; }
    if (UI.tab === 'book' && UI.enig == null) { render(); return; }
    if (v.phase !== 'locked' && ['book', 'shop'].indexOf(UI.tab) >= 0) { render(); return; }
    const t = tabsFor(); if (!t.includes(UI.tab)) render();
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'unlocked') { if (isOpen() && UI.tab === 'door' && V && V.phase === 'locked' && !(V.unlocked && V.unlocked.mine)) { refresh(); } }
  }
  function init(socket) {
    if (sock) return; sock = socket;
    sock.on('hk-answer-result', onAnswerResult); sock.on('hk-code-result', onCodeResult); sock.on('hk-take-result', onTakeResult);
  }
  function restore() { try { const s = JSON.parse(sessionStorage.getItem('libero_hk') || 'null'); if (s && V) open(s.tab, s.enig); } catch (_) {} }

  /* ───────── Cinematique : ZyX accueille le joueur quand il ouvre la boutique piratee ───────── */
  let cineDone = null;
  function tabCine() {
    const x = X(), main = q('#main'), first = !localStorage.getItem('libero_hk_seen');
    q('.hk-close').style.display = 'none'; q('.hk-tit').textContent = '';
    main.innerHTML = `<div class="pbody cine"><div class="cine-fl"></div><div class="cine-sc"><div class="awn hacked"></div><div class="tape"></div><h3 class="shopname hacked"><span class="a">${esc(x.shopReal)}</span><span class="b">${esc(x.shopName)}</span></h3></div>${hkEl('cine-hk', 'left:50%;bottom:90px;width:170px;height:210px;margin-left:-85px', '')}${sayHTML('cb', 'left:50%;top:38%;margin-left:-130px;--tx:0px;--ox:50%;max-width:260px;z-index:14;font-size:1.25rem', '')}<button class="btn cine-skip" data-a="cine" type="button">${esc(x.skip || (L() === 'en' ? 'Skip' : 'Passer'))}</button></div>`;
    const ls = first ? x.zx.intro : [x.zx.welcome]; let t = 900; snd('whoosh');
    ls.forEach(line => { talk('cb', line, t, 34); t += line.length * 34 + 2000; later(() => { const b = q('#cb'); if (b) b.classList.remove('on'); }, t - 500); });
    later(endCine, t + 300);
  }
  function endCine() { if (UI.tab !== 'cine') return; try { localStorage.setItem('libero_hk_seen', '1'); sessionStorage.setItem('libero_hk_cine', '1'); } catch (_) {} const cb = cineDone; cineDone = null; q('.hk-close').style.display = ''; close(); if (cb) cb(); }
  function cinematic(cb) { if (!V || V.phase !== 'locked') { if (cb) cb(); return; } cineDone = cb || null; open('cine'); }
  let blkOn = false;
  function blocked() {
    if (!V || blkOn) return; const x = X(), lines = x.zx.locked, ln = lines[Math.floor(Math.random() * lines.length)], en = L() === 'en';
    blkOn = true; snd('laugh');
    const txt = ln + '\n\n' + (en ? 'The shop is blocked until someone opens the padlock. Solve the riddles to get the code.' : 'La boutique est bloquée tant que personne n\'a ouvert le cadenas. Résous les énigmes pour avoir le code.');
    const p = typeof _slateConfirm === 'function' ? _slateConfirm({ title: '~ZyX_22~', text: txt, ok: x.enter, cancel: 'OK' }) : Promise.resolve(false);
    p.then(go => { blkOn = false; if (go) open('door'); });
  }
  function realCss() {
    if (document.getElementById('hk-blk-css')) return; const s = document.createElement('style'); s.id = 'hk-blk-css';
    s.textContent = '.hk-blk{position:fixed;inset:0;z-index:3600;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px}.hk-blk-c{background:#1a1410;color:#f6ecd2;border:3px solid #d19a3d;border-radius:14px;padding:18px 20px;max-width:380px;width:100%;display:grid;gap:10px;text-align:center;box-shadow:0 10px 0 rgba(0,0,0,.4)}.hk-blk-c b{font:400 .9rem var(--font-display,Archivo Black,sans-serif);color:#ff8e8e}.hk-blk-c p{margin:0;font:700 1.35rem/1.15 var(--font-hand,Caveat,cursive)}.hk-blk-c small{opacity:.8}.hk-blk-c div{display:flex;gap:8px;justify-content:center}.hk-blk-c button{font:400 .9rem var(--font-display,Archivo Black,sans-serif);border:2px solid #d19a3d;border-radius:8px;padding:8px 14px;background:#d19a3d;color:#1a1410;cursor:pointer}.hk-blk-c button.sec{background:transparent;color:#f6ecd2}';
    document.head.appendChild(s);
  }

  /* ───────── La vraie boutique pendant le piratage : ZyX l'occupe, farces visuelles seulement ───────── */
  let rsRun = 0;
  function realShop() {
    if (!V || V.phase !== 'locked' || !pranksOn() || isOpen()) return;
    const scr = document.getElementById('screen-shop'); if (!scr || !scr.classList.contains('active') || rsRun) return;
    rsRun = 1; const x = X(), undo = [], tm = [];
    const alive = () => scr.classList.contains('active') && V && V.phase === 'locked';
    const w = (fn, ms) => { tm.push(setTimeout(() => { if (alive()) fn(); }, ms)); };
    let st = document.getElementById('hk-rs-css');
    if (!st) { st = document.createElement('style'); st.id = 'hk-rs-css'; st.textContent = '.hk-say{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:3500;max-width:min(92vw,420px);background:#fff;color:#22252b;border:3px solid #22252b;border-radius:16px;padding:8px 14px;font:700 1.05rem/1.2 var(--font-hand,Caveat,cursive);box-shadow:0 4px 0 rgba(0,0,0,.25);pointer-events:none}.hk-say b{display:block;font:400 .7rem var(--font-display,Archivo Black,sans-serif);color:#d23a4f;margin-bottom:2px}.hk-fake{position:relative;cursor:pointer;transition:transform .35s cubic-bezier(.3,1.4,.5,1)}.hk-fake .hk-pc{position:absolute;right:6px;top:6px;background:#d23a4f;color:#fff;font:400 .7rem var(--font-display,sans-serif);border-radius:6px;padding:2px 6px;z-index:2}.hk-dark{position:fixed;inset:0;z-index:3400;pointer-events:none;background:radial-gradient(circle 110px at var(--x,50%) var(--y,50%),transparent 0,rgba(0,0,0,.93) 100%);transition:opacity .4s}'; document.head.appendChild(st); }
    const say = (t, ms) => { document.querySelectorAll('.hk-say').forEach(e => e.remove()); const s = document.createElement('div'); s.className = 'hk-say'; s.innerHTML = '<b>~ZyX_22~</b>' + esc(t); document.body.appendChild(s); snd('tick'); tm.push(setTimeout(() => s.remove(), ms || 3600)); undo.push(() => s.remove()); };
    const tiles = () => Array.from(scr.querySelectorAll('.shop-tile')).filter(t => !t.classList.contains('hk-fake') && t.offsetParent);
    const T = {
      fake(done) { const b = tiles()[0]; if (!b) return done(); const f = b.cloneNode(true); f.classList.add('hk-fake'); f.removeAttribute('data-id'); f.dataset.hk = '1';
        const nm = f.querySelector('.shop-tile-name'), pr = f.querySelector('.shop-tile-price'); if (nm) nm.textContent = x.zx.fakeName; if (pr) pr.textContent = hkP(20) + ' Libs'; f.insertAdjacentHTML('afterbegin', '<div class="hk-pc">-90 %</div>');
        b.parentNode.insertBefore(f, b); undo.push(() => f.remove()); say(x.zx.fake); let h = 0;
        f.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); h++; if (h < 3) { f.style.transform = `translate(${h % 2 ? 40 : -40}px,-14px) rotate(${h % 2 ? 6 : -6}deg)`; say(h === 1 ? x.zx.slow : x.zx.almost, 1800); } else { say(x.zx.fakeStamp + ' ' + x.zx.fakeTxt, 4200); f.remove(); w(done, 4500); } }, true);
        w(() => { f.remove(); done(); }, 15000); },
      labels(done) { const ts = tiles().slice(0, 6), names = ts.map(t => t.querySelector('.shop-tile-name')).filter(Boolean), orig = names.map(n => n.textContent);
        say(x.zx.labels); names.forEach((n, i) => { n.textContent = orig[(i + 2) % orig.length]; }); const back = () => names.forEach((n, i) => { n.textContent = orig[i]; }); undo.push(back); w(() => { back(); done(); }, 7000); },
      thief(done) { const ts = tiles(), t = ts[Math.floor(Math.random() * ts.length)]; if (!t) return done(); say(x.zx.thief); t.style.visibility = 'hidden'; undo.push(() => { t.style.visibility = ''; }); w(() => { t.style.visibility = ''; say(x.zx.giveBack, 2600); w(done, 2800); }, 5000); },
      dark(done) { const d = document.createElement('div'); d.className = 'hk-dark'; document.body.appendChild(d); say(x.zx.dark, 4000); const mv = e => { const p = e.touches ? e.touches[0] : e; d.style.setProperty('--x', p.clientX + 'px'); d.style.setProperty('--y', p.clientY + 'px'); };
        addEventListener('pointermove', mv); addEventListener('touchmove', mv, { passive: true }); const end = () => { d.remove(); removeEventListener('pointermove', mv); removeEventListener('touchmove', mv); }; undo.push(end); w(() => { end(); done(); }, 4500); }
    };
    const order = ['fake', 'labels', 'thief', 'dark'], s0 = (visit++) % 4, qn = [0, 1, 2].map(i => order[(s0 + i) % 4]);
    const stop = () => { rsRun = 0; tm.forEach(clearTimeout); undo.forEach(f => { try { f(); } catch (_) {} }); };
    const nxt = i => { if (i >= qn.length || !alive()) return; T[qn[i]](() => w(() => nxt(i + 1), 3500)); };
    const first = !localStorage.getItem('libero_hk_seen');
    if (first) { try { localStorage.setItem('libero_hk_seen', '1'); } catch (_) {} const ls = x.zx.intro; ls.forEach((l, k) => w(() => say(l, 3200), 600 + k * 3600)); w(() => nxt(0), 600 + ls.length * 3600 + 800); }
    else w(() => { say(x.zx.welcome, 3000); w(() => nxt(0), 3600); }, 1200);
    const wd = setInterval(() => { if (!alive()) { clearInterval(wd); stop(); } }, 700);
  }

  window.LiberoHk = { cinematic, blocked, realShop, init, setState, onEvent, open, close, restore, isOpen, TX };
})();
