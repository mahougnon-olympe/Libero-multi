/* Week-end du 28 nov. : Defi du robot difficile + Week-end des duels.
   Panneau en haut de l'ecran Evenements (#wk-box) + bandeau d'accueil (#wk-home). Les donnees viennent du
   serveur (wk-state / wk-event) ; rien n'est calcule ici. Survit au F5 : l'etat est redemande a la connexion
   et le nombre de tampons deja vus est garde dans localStorage (seuls les nouveaux s'animent). */
(function () {
  'use strict';
  if (typeof socket === 'undefined') return;
  const SEEN = 'libero_wk_seen';
  const TX = {
    fr: {
      famChal: 'Défi', famBonus: 'Bonus', eyebrow: 'Ce week-end', left: 'Il reste', d: 'j', h: 'h', m: 'min',
      robT: 'Défi du robot difficile', robP: 'Bats le robot difficile aux échecs, aux dames ou au Puissance 4 : chaque victoire tamponne ta carte de 5 cases.',
      robR: '300 Libs à la carte pleine', prog: n => `${n} sur 5`, play: 'Jouer contre le robot', full: 'Carte pleine, bravo !',
      duT: 'Week-end des duels', duP: 'Les mises entre amis rapportent un bonus au vainqueur, payé par le site.', duR: '+20 % sur chaque mise gagnée',
      duDay: 'Dimanche', duSoon: 'Disponible dimanche à 00 h 00', duLive: 'En cours : défie un ami avec une mise.', duGo: 'Défier un ami',
      duRule: 'Bonus de 20 % de la mise de ton ami, 100 Libs au plus par duel et 500 Libs au plus pour le week-end.',
      duGot: (a, b) => `Bonus gagné : ${a} sur ${b} Libs`,
      games: { chess: 'Échecs', checkers: 'Dames', connect4: 'Puissance 4' },
      say: ['Bien joué.', 'Aïe.', 'Je m\'en souviens.', 'Encore ?', 'Tu m\'as eu.'],
      stamp: 'Case tamponnée', stampSub: (g, n) => `${g} : ${n} sur 5`, fullT: n => `Carte pleine : +${n} Libs`, duelT: n => `Bonus des duels : +${n} Libs`,
      home: n => `Défi du robot difficile : ${n} sur 5. Carte pleine = 300 Libs.`, go: 'Ma carte',
    },
    en: {
      famChal: 'Challenge', famBonus: 'Bonus', eyebrow: 'This weekend', left: 'Time left', d: 'd', h: 'h', m: 'min',
      robT: 'Hard bot challenge', robP: 'Beat the hard bot at chess, checkers or Connect 4: each win stamps your 5-box card.',
      robR: '300 Libs for a full card', prog: n => `${n} of 5`, play: 'Play the bot', full: 'Full card, well done!',
      duT: 'Duel weekend', duP: 'Stakes between friends give the winner a bonus, paid by the site.', duR: '+20% on every stake won',
      duDay: 'Sunday', duSoon: 'Available Sunday at 00:00', duLive: 'On now: challenge a friend with a stake.', duGo: 'Challenge a friend',
      duRule: 'A 20% bonus on your friend\'s stake, 100 Libs at most per duel and 500 Libs at most for the weekend.',
      duGot: (a, b) => `Bonus earned: ${a} of ${b} Libs`,
      games: { chess: 'Chess', checkers: 'Checkers', connect4: 'Connect 4' },
      say: ['Well played.', 'Ouch.', 'I\'ll remember that.', 'Again?', 'You got me.'],
      stamp: 'Box stamped', stampSub: (g, n) => `${g}: ${n} of 5`, fullT: n => `Full card: +${n} Libs`, duelT: n => `Duel bonus: +${n} Libs`,
      home: n => `Hard bot challenge: ${n} of 5. Full card = 300 Libs.`, go: 'My card',
    },
  };
  const L = () => TX[(typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'fr'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let S = null, fresh = -1, sayN = 0, tick = null;
  const getSeen = () => { try { return parseInt(localStorage.getItem(SEEN) || '0', 10) || 0; } catch { return 0; } };
  const setSeen = n => { try { localStorage.setItem(SEEN, String(n)); } catch {} };

  const ROBOT = '<svg viewBox="0 0 120 130" aria-hidden="true"><line class="ln" x1="60" y1="8" x2="60" y2="26"/><circle class="ant" cx="60" cy="8" r="5"/><g class="head"><rect class="fl" x="18" y="26" width="84" height="64" rx="18"/><rect class="fl" x="8" y="46" width="10" height="24" rx="4"/><rect class="fl" x="102" y="46" width="10" height="24" rx="4"/><circle class="eye" cx="44" cy="55" r="7"/><circle class="eye" cx="76" cy="55" r="7"/><path class="ln xeye" d="M37 48l14 14M51 48L37 62M69 48l14 14M83 48L69 62"/><path class="ln mok" d="M44 74h32"/><path class="ln msad" d="M44 78q16-12 32 0"/></g><rect class="fl" x="36" y="96" width="48" height="28" rx="8"/><path class="ln" d="M52 110h16"/></svg>';
  const CHECK = '<svg viewBox="0 0 60 60" aria-hidden="true"><circle class="ring" cx="30" cy="30" r="24" transform="rotate(-90 30 30)"/><path class="chk" d="M19 31l8 8 15-17"/></svg>';

  function leftTxt(ms) {
    const x = L(), m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d > 0 ? `${d} ${x.d} ${h} ${x.h}` : `${h} ${x.h} ${m % 60} ${x.m}`;
  }
  function render() {
    const box = document.getElementById('wk-box'); if (!box) return;
    if (!S || S.phase !== 'live') { box.hidden = true; box.innerHTML = ''; return; }
    const x = L(), n = (S.wins || []).length, full = !!S.full, seen = getSeen(), vis = !!document.getElementById('screen-events')?.classList.contains('active');
    box.hidden = false;
    const slots = Array.from({ length: S.slots || 5 }, (_, i) => {
      const g = S.wins[i], isNew = g && vis && (i === fresh || i >= seen);
      return `<li class="wk-slot${g ? ' done' : ''}${isNew ? ' fresh' : ''}" style="--rot:${((i * 7) % 13) - 6}deg"><span class="n">${i + 1}</span><span class="g">${g ? esc(x.games[g] || g) : ''}</span>${CHECK}</li>`;
    }).join('');
    const duelOn = !!S.duelLive;
    box.innerHTML = `
      <div class="wk-top"><div><div class="wk-eye">${x.eyebrow}</div></div><div class="wk-left" id="wk-left" role="timer"></div></div>
      <div class="wk-grid">
        <article class="wk-card">
          <div class="wk-h"><span class="wk-fam c3">${x.famChal}</span></div>
          <h2>${x.robT}</h2><p>${x.robP}</p>
          <div class="wk-duel">
            <div class="wk-robot${full ? ' beaten' : ''}" id="wk-robot"><span class="wk-say" id="wk-say"></span>${ROBOT}</div>
            <div class="wk-right"><ol class="wk-slots" aria-label="${x.robT}">${slots}</ol>
              <div class="wk-prog"><span>${full ? x.full : x.prog(n)}</span><div class="wk-bar"><i style="width:${n * 20}%"></i></div></div></div>
          </div>
          <div class="wk-reward">${x.robR}</div>
          <button type="button" class="wk-btn" id="wk-play">${x.play}</button>
        </article>
        <article class="wk-card${duelOn ? '' : ' off'}">
          <div class="wk-h"><span class="wk-fam c1">${x.famBonus}</span><span class="wk-day">${x.duDay}</span></div>
          <h2>${x.duT}</h2><p>${x.duP}</p>
          <div class="wk-reward">${x.duR}</div>
          <p class="wk-note">${duelOn ? x.duLive : x.duSoon}</p>
          <p class="wk-note">${x.duRule}</p>
          ${duelOn ? `<p class="wk-got">${x.duGot(S.duel || 0, S.weekendCap || 500)}</p><button type="button" class="wk-btn" id="wk-duel">${x.duGo}</button>` : ''}
        </article>
      </div>`;
    box.querySelector('#wk-play').addEventListener('click', () => showScreen('home'));
    box.querySelector('#wk-duel')?.addEventListener('click', () => showScreen('home'));
    const slotEls = box.querySelectorAll('.wk-slot.fresh'); // les nouveaux tampons sont vus : on ne les rejouera pas au prochain F5
    if (vis && slotEls.length) setSeen(n);
    fresh = -1;
    paintLeft();
  }
  function paintLeft() {
    const el = document.getElementById('wk-left'); if (!el || !S) return;
    const x = L(); el.textContent = `${x.left} : ${leftTxt(S.end - (S.now + Date.now() - S.t0))}`;
  }
  function home() {
    const el = document.getElementById('wk-home'); if (!el) return;
    if (!S || S.phase !== 'live') { el.hidden = true; return; }
    const x = L(); el.hidden = false;
    el.innerHTML = `<span class="hk-home-t">${esc(x.home((S.wins || []).length))}</span><button type="button" class="hk-home-go">${esc(x.go)}</button>`;
    el.querySelector('.hk-home-go').addEventListener('click', () => showScreen('events'));
  }
  function apply() { render(); home(); }

  function robotSay(n) {
    const r = document.getElementById('wk-robot'), s = document.getElementById('wk-say'); if (!r || !s) return;
    s.textContent = L().say[Math.min(4, Math.max(0, n - 1))];
    s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
    r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit');
    r.classList.toggle('beaten', n >= 5);
  }
  function dust() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.getElementById('wk-box'), rb = document.getElementById('wk-robot'); if (!box || !rb) return;
    const bb = box.getBoundingClientRect(), r = rb.getBoundingClientRect();
    const cv = document.createElement('canvas'); cv.className = 'wk-dust'; const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = bb.width * dpr; cv.height = bb.height * dpr; box.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement), cols = ['--accent', '--ink', '--red'].map(v => cs.getPropertyValue(v).trim() || '#999');
    const ox = r.left - bb.left + r.width / 2, oy = r.top - bb.top + r.height / 2;
    const P = Array.from({ length: 80 }, () => { const a = Math.random() * 6.283, sp = 2 + Math.random() * 6; return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, s: 2 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], life: 1, rot: Math.random() * 6 }; });
    (function f() {
      ctx.clearRect(0, 0, bb.width, bb.height); let alive = false;
      for (const p of P) {
        p.x += p.vx; p.y += p.vy; p.vy += .22; p.vx *= .985; p.life -= .014; p.rot += .15; if (p.life <= 0) continue; alive = true;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6); ctx.restore();
      }
      if (alive) requestAnimationFrame(f); else cv.remove();
    })();
  }

  function setState(v) { if (v) { v.t0 = Date.now(); } S = v; apply(); }
  socket.on('wk-state', setState);
  socket.on('wk-changed', () => socket.emit('wk-get', { playerId: getPlayerId() }));
  socket.on('wk-event', ev => {
    if (!ev) return; const x = L();
    if (ev.state) { ev.state.t0 = Date.now(); S = ev.state; }
    if (ev.type === 'stamp') {
      fresh = ev.n - 1; apply();
      const on = document.getElementById('screen-events')?.classList.contains('active');
      if (on) { robotSay(ev.n); if (ev.full) setTimeout(dust, 900); }
      if (typeof _bingoToast === 'function') _bingoToast(ev.full ? x.fullT(ev.libs) : x.stamp, ev.full ? '' : x.stampSub(x.games[ev.game] || ev.game, ev.n));
    } else if (ev.type === 'duel') {
      apply();
      if (typeof _bingoToast === 'function') _bingoToast(x.duelT(ev.bonus), '');
    }
  });
  socket.on('connect', () => { try { socket.emit('wk-get', { playerId: getPlayerId() }); } catch {} });
  if (socket.connected) { try { socket.emit('wk-get', { playerId: getPlayerId() }); } catch {} }
  setInterval(() => { if (S && S.phase === 'live') paintLeft(); }, 30000);
  window._wkApply = apply;
  // Quand on arrive sur l'ecran, les nouveaux tampons s'animent (robot compris).
  document.getElementById('btn-go-events')?.addEventListener('click', () => setTimeout(() => { const n = (S?.wins || []).length; if (n > getSeen()) { apply(); robotSay(n); } }, 350));
})();
