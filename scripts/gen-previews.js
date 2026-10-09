/* Genere les apercus de la boutique : de VRAIES captures du site, pas des dessins.
 *
 *   Usage (depuis la racine, serveur statique sur 8123, backend sur 3001) :
 *     NODE_PATH=<dossier qui contient puppeteer-core> node scripts/gen-previews.js [bg|snake|skin|p4|ttt|chess|fx|ban|all]
 *
 * Il ouvre le site dans Chrome, applique chaque cosmetique avec le code reel du
 * jeu (BGManager, cursorSnake, buildConnect4, spawnParticles...), photographie le
 * resultat et l'ecrit dans assets/preview/<id>.png ; un script Python le convertit
 * ensuite en WebP (fixe) ou WebP anime. Les fichiers sont versionnes : la boutique
 * ne depend d'aucun calcul au chargement.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', 'assets', 'preview');
const RAW = path.join(OUT, '_raw');          // images brutes (non versionnees)
fs.mkdirSync(RAW, { recursive: true });
const URL = 'http://localhost:8123/index.html';
const WHAT = process.argv[2] || 'all';
const want = k => WHAT === 'all' || WHAT === k;

const BGS = ['bg-nuit','bg-ardoise','bg-brume','bg-crepuscule','bg-nebuleuse','bg-aurore-deg','bg-particules','bg-vagues','bg-aurores',
  'bg-cyber','bg-circuit','bg-hexagones','bg-pluie','bg-tempete','bg-hologramme','bg-etoile','bg-galaxie','bg-orage','bg-synthwave',
  'bg-terrain','bg-matrice','bg-wax','bg-marche-nuit','bg-harmattan','bg-lagune'];

async function ouvrir(browser, w, h, theme = 'light') {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate((theme) => {
    localStorage.setItem('libero_player_id', 'preview-gen-0001'); localStorage.setItem('libero_onboarded', '1');
    localStorage.setItem('libero_tuto_v2', JSON.stringify({ done: true })); localStorage.setItem('playerName', 'Apercu');
    localStorage.setItem('lang', 'fr'); localStorage.setItem('themeMode', theme); localStorage.setItem('libero_admin_key', 'testkey123'); localStorage.setItem('snakeEnabled', 'true');
  }, theme);
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5500);
  await p.evaluate(() => document.querySelectorAll('.overlay,#tuto-wrap,#boot').forEach(o => o.remove()));
  return p;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });

  if (want('bg')) {
    // Deux jeux d'apercus : l'ardoise (theme sombre) et le cahier (theme clair).
    for (const theme of ['dark', 'light']) {
      const p = await ouvrir(browser, 800, 500, theme);
      const suf = theme === 'light' ? '-light' : '';
      // Rien d'autre que le fond : on masque toute l'interface (la matiere de base est sur <html>).
      await p.addStyleTag({ content: 'body > *:not(#bg-layer):not(#bg-canvas):not(script):not(style){display:none!important} body::before{display:none!important}' });
      for (const id of BGS) {
        await p.evaluate(i => { BGManager.stop(); BGManager.start(i); }, id);
        await sleep(/etoile|galaxie|pluie|tempete|particules|vagues|aurores|nebuleuse|matrice|orage|hologramme|circuit|synthwave/.test(id) ? 3200 : 1200);
        await p.screenshot({ path: path.join(RAW, id + suf + '.png') });
        // 14 images espacees de 140 ms : pack-previews.py n'anime que les fonds qui bougent vraiment.
        for (let k = 0; k < 14; k++) { await p.screenshot({ path: path.join(RAW, id + suf + '_' + String(k).padStart(2, '0') + '.png') }); await sleep(140); }
        console.log('fond', theme, id);
      }
      await p.close();
    }
  }

  // ---- decor commun des scenes : tout est masque sauf la scene ----
  const CSS_SCENE = 'body > *:not(#pv-stage):not([style*="will-change"]):not(script):not(style){display:none!important} html,body{background:#fdfdf9!important;overflow:hidden!important}';
  async function scene(p, bg) {
    await p.addStyleTag({ content: CSS_SCENE });
    await p.evaluate(b => {
      let st = document.getElementById('pv-stage'); if (st) st.remove();
      st = document.createElement('div'); st.id = 'pv-stage';
      st.style.cssText = 'position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:' + (b || '#0e1226');
      document.body.appendChild(st);
    }, bg);
  }
  async function clipShot(p, file, clip) { await p.screenshot({ path: path.join(RAW, file), clip }); }

  // ---- Serpents de curseur : le vrai serpent qui suit une souris (animation) ----
  if (want('snake')) {
    const p = await ouvrir(browser, 420, 260);
    await scene(p, '#fdfdf9');
    for (const id of ['cursorsnake-pixel','cursorsnake-neon','cursorsnake-comet','cursorsnake-electric','cursorsnake-stars','cursorsnake-fire']) {
      await p.evaluate(i => { equippedCursorSnake = i; cursorSnake.update(16, 1); cursorSnake.refreshSkin(); }, id);
      await p.mouse.move(40, 130); await sleep(300);
      const N = 16;
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1), x = 40 + t * 340, y = 130 + Math.sin(t * Math.PI * 2.2) * 62;
        await p.mouse.move(x, y, { steps: 3 }); await sleep(55);
        await clipShot(p, id + '_' + String(k).padStart(2, '0') + '.png', { x: 0, y: 0, width: 420, height: 260 });
      }
      console.log('serpent de curseur', id);
    }
    await p.close();
  }

  // ---- Skins de Snake : memes formules que le jeu, sur une grille de jeu ----
  if (want('skin')) {
    const p = await ouvrir(browser, 420, 280);
    await scene(p, '#fdfdf9');
    const SK = {
      'snakeskin-rainbow': { bg:(t,q)=>`hsla(${(t*120+q*180)%360},90%,${60-q*20}%,${1-q*0.6})`, food:'💎', boardBg:'#0a0a20', glow:(t)=>`hsl(${t*120%360},80%,60%)` },
      'snakeskin-lava':    { bg:(_t,q)=>`hsla(${20-q*15},100%,${55-q*20}%,${1-q*0.55})`, food:'🔥', boardBg:'#1a0a00', glow:()=>'#ff4400' },
      'snakeskin-cyber':   { bg:(_t,q)=>`hsla(180,100%,${55-q*25}%,${1-q*0.6})`, food:'⬡', boardBg:'#001a1a', glow:()=>'#00ffff', square:true },
      'snakeskin-galaxy':  { bg:(_t,q)=>`hsla(${260+q*40},80%,${55-q*20}%,${1-q*0.55})`, food:'⭐', boardBg:'#05001a', glow:()=>'#9966ff' },
      'snakeskin-gems':    { bg:(_t,q)=>`hsla(${140+q*80},70%,${58-q*18}%,${1-q*0.5})`, food:'💎', boardBg:'#001a0a', glow:()=>'#00ff88' },
      'snakeskin-8bit':    { bg:(_t,q)=>(Math.round(q*10)%2===0?'#8bd600':'#5aa800'), food:'🍎', boardBg:'#0f2000', glow:()=>'#8bd600', square:true },
      'snakeskin-gold':    { bg:(_t,q)=>`hsla(${45-q*8},90%,${62-q*22}%,${1-q*0.5})`, food:'🪙', boardBg:'#1a1400', glow:()=>'#ffd700' },
    };
    await p.evaluate(() => {
      const c = document.createElement('canvas'); c.id = 'pv-cv'; c.width = 364; c.height = 234; c.style.cssText = 'border-radius:14px';
      document.getElementById('pv-stage').appendChild(c);
    });
    for (const id of Object.keys(SK)) {
      const frames = id === 'snakeskin-rainbow' ? 12 : 1;
      for (let f = 0; f < frames; f++) {
        await p.evaluate((spec, tick) => {
          const sk = {}; for (const k of ['bg','glow']) sk[k] = new Function('return ' + spec[k])();
          Object.assign(sk, { food: spec.food, boardBg: spec.boardBg, square: spec.square });
          const cv = document.getElementById('pv-cv'), ctx = cv.getContext('2d'), CELL = 26, COLS = 14, ROWS = 9;
          ctx.fillStyle = sk.boardBg; ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = .5;
          for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke(); }
          for (let j = 0; j <= ROWS; j++) { ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(COLS * CELL, j * CELL); ctx.stroke(); }
          ctx.font = CELL + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(sk.food, 11.5 * CELL, 2.5 * CELL + CELL * .5);
          const body = [[8,6],[7,6],[6,6],[5,6],[4,6],[3,6],[3,5],[3,4],[4,4],[5,4],[5,3],[5,2],[4,2],[3,2]].reverse().reverse();
          const snake = [[9,6],[8,6],[7,6],[6,6],[5,6],[4,6],[3,6],[3,5],[3,4],[4,4],[5,4],[6,4],[7,4]];
          snake.forEach((sg, i) => {
            const q = snake.length > 1 ? i / (snake.length - 1) : 0;
            const r = CELL * (i === 0 ? 0.42 : (sk.square ? 0.1 : 0.35));
            ctx.fillStyle = sk.bg(tick, q);
            if (i === 0) { ctx.shadowColor = sk.glow(tick); ctx.shadowBlur = 10; }
            ctx.beginPath(); ctx.roundRect(sg[0] * CELL + CELL * .1, sg[1] * CELL + CELL * .1, CELL * .8, CELL * .8, r); ctx.fill();
            if (i === 0) ctx.shadowBlur = 0;
          });
        }, { bg: SK[id].bg.toString(), glow: SK[id].glow.toString(), food: SK[id].food, boardBg: SK[id].boardBg, square: !!SK[id].square }, f / frames * 3);
        const box = await (await p.$('#pv-cv')).boundingBox();
        await clipShot(p, id + '_' + String(f).padStart(2, '0') + '.png', box);
      }
      console.log('skin de snake', id);
    }
    await p.close();
  }

  // ---- Jetons de Puissance 4 / symboles de Morpion / echiquiers : le VRAI plateau du jeu ----
  if (want('p4') || want('ttt') || want('chess')) {
    const p = await ouvrir(browser, 460, 520);
    await scene(p, '#fdfdf9');
    await p.evaluate(() => { const a = document.createElement('div'); a.id = 'pv-area'; a.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:14px'; document.getElementById('pv-stage').appendChild(a); });
    if (want('p4')) for (const id of ['p4token-goldsilver','p4token-neon','p4token-lavalice','p4token-galaxy']) {
      await p.evaluate(i => { equippedP4Token = i; const a = document.getElementById('pv-area'); a.innerHTML = '';
        const B = [['','','','','','',''],['','','','','','',''],['','','','Y','','',''],['','','R','R','','',''],['','Y','Y','R','','Y',''],['R','R','Y','Y','R','R','Y']];
        buildConnect4(a, B); document.querySelectorAll('.c4-arrow, .c4-arrows').forEach(x => x.remove()); }, id);
      await sleep(500);
      const el = await p.$('#c4-board'); if (!el) { console.log('p4 : plateau introuvable', id); continue; }
      await el.screenshot({ path: path.join(RAW, id + '.png') }); console.log('jetons', id);
    }
    if (want('ttt')) for (const id of ['ttt-neon','ttt-sunmoon','ttt-heartstar','ttt-catdog','ttt-skulllightning']) {
      await p.evaluate(i => { equippedTtt = i; myPlayer = 'R'; const a = document.getElementById('pv-area'); a.innerHTML = '';
        buildTTT(a, ['R','Y','R','','Y','R','Y','','']); }, id);
      await sleep(400);
      const el = await p.$('.ttt-board'); await el.screenshot({ path: path.join(RAW, id + '.png') }); console.log('morpion', id);
    }
    if (want('chess')) for (const id of ['chess-cyber','chess-frost','chess-neon','chess-marble']) {
      await p.evaluate(i => { equippedChess = i; const a = document.getElementById('pv-area'); a.innerHTML = '';
        buildChess(a, { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', currentPlayer: 'R' }, 'R'); _applyChessTheme(i); }, id);
      await sleep(500);
      const el = await p.$('#chess-board'); if (!el) { console.log('echecs : plateau introuvable', id); continue; }
      await el.screenshot({ path: path.join(RAW, id + '.png') }); console.log('echiquier', id);
    }
    await p.close();
  }

  // ---- Effets de clic : le vrai code des particules, enregistre (animation) ----
  if (want('fx')) {
    const p = await ouvrir(browser, 300, 240);
    await scene(p, '#fdfdf9');
    // Les particules s'ajoutent a <body>, que la scene masque : on les redirige vers la scene.
    await p.evaluate(() => { const st = document.getElementById('pv-stage'); document.body.appendChild = el => st.appendChild(el); });
    for (const id of ['clickfx-bubbles','clickfx-confetti','clickfx-neon','clickfx-stars','clickfx-firework']) {
      await p.evaluate(i => { equippedClickFx = i; }, id);
      await sleep(250);
      // Les animations des particules sont figees puis rejouees image par image : la capture est plus lente que l'effet.
      await p.evaluate(() => { spawnParticles(150, 120); document.getAnimations().forEach(a => a.pause()); });
      for (let k = 0; k < 16; k++) {
        await p.evaluate(ms => document.getAnimations().forEach(a => { a.currentTime = ms; }), 10 + k * 55);
        await clipShot(p, id + '_' + String(k).padStart(2, '0') + '.png', { x: 0, y: 0, width: 300, height: 240 });
      }
      await p.evaluate(() => document.getElementById('pv-stage').querySelectorAll('div').forEach(d => d.remove()));
      console.log('effet de clic', id);
    }
    await p.close();
  }

  // ---- Bannieres de victoire : le vrai style de la banniere de fin de partie ----
  if (want('ban')) {
    const p = await ouvrir(browser, 460, 400);
    await scene(p, '#fdfdf9');
    await p.evaluate(() => { const g = document.getElementById('game-status'); if (g) g.remove(); });
    for (const id of ['victoryban-neon','victoryban-confetti','victoryban-flames','victoryban-lightning','victoryban-crown']) {
      await p.evaluate(i => { const st = document.getElementById('pv-stage'); st.innerHTML = '';
        const g = document.createElement('div'); g.id = 'game-status'; g.className = 'game-status ' + i; g.style.maxWidth = '380px';
        g.innerHTML = _victoryBannerHtml(i, t().vbSub('Koffi')) + '<p id="status-text" class="status-text">Tu as gagné !</p>'; st.appendChild(g); }, id);
      await sleep(150);
      const el = await p.$('#game-status'); const box = await el.boundingBox();
      const clip = { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: Math.min(460, box.width + 48), height: Math.min(400, box.height + 48) };
      const N = 14;
      // On parcourt un cycle COMPLET de l'animation (de 0,6 s a 2 s selon la banniere), image par image.
      await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
      for (let k = 0; k < N; k++) {
        // Les nouvelles bannieres jouent une fois (environ 2,6 s) : on parcourt ce temps-la.
        await p.evaluate(ms => document.getAnimations().forEach(a => { a.currentTime = ms; }), 150 + k * 190);
        await clipShot(p, id + '_' + String(k).padStart(2, '0') + '.png', clip);
      }
      console.log('banniere', id);
    }
    await p.close();
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
