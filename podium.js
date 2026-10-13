/* Podium de fin de quiz a plusieurs : la grande scene (camera, tremblement de terre,
   atterrissage du 1er, anneau dore). Charge seulement quand un quiz a plusieurs se termine.
   Suit le theme du site (cahier clair ou ardoise sombre) grace aux variables de cahier.css.
   Tout bouge en transform / opacity pour rester fluide. Les styles sont dans cahier.css (.pd-*). */
(function () {
  if (window.LiberoPodium) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const portrait = p => (window.LiberoPortrait ? (p ? LiberoPortrait.svg(p) : LiberoPortrait.blank()) : '');
  const leaf = 'M0 0 C6 -6 14 -6 18 0 C14 6 6 6 0 0z';
  const laurel = `<svg class="pd-laurel" viewBox="0 0 160 160" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => {
    const a1 = (205 + i * 16) * Math.PI / 180, a2 = (-25 - i * 16) * Math.PI / 180;
    return `<path transform="translate(${80 + Math.cos(a1) * 62} ${80 + Math.sin(a1) * 62}) rotate(${205 + i * 16 + 80})" d="${leaf}"/><path transform="translate(${80 + Math.cos(a2) * 62} ${80 + Math.sin(a2) * 62}) rotate(${-25 - i * 16 - 80})" d="${leaf}"/>`;
  }).join('')}</svg>`;
  const crown = `<svg class="pd-crown" viewBox="0 0 62 44" aria-hidden="true"><defs><linearGradient id="pdcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4b8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#c88a00"/></linearGradient></defs><path d="M5 38 2 8l15 12L31 2l14 18L60 8l-3 30z" fill="url(#pdcg)" stroke="#1d2433" stroke-width="2.4" stroke-linejoin="round"/><circle cx="31" cy="27" r="4.5" fill="#e0435a" stroke="#1d2433" stroke-width="1.6"/><circle cx="15" cy="30" r="3" fill="#3d64b8" stroke="#1d2433" stroke-width="1.4"/><circle cx="47" cy="30" r="3" fill="#2f8a55" stroke="#1d2433" stroke-width="1.4"/><rect x="5" y="36" width="52" height="5" rx="2" fill="#c88a00" stroke="#1d2433" stroke-width="2"/></svg>`;
  const E = 'cubic-bezier(.22,1,.36,1)', S = 'cubic-bezier(.34,1.32,.64,1)';

  function play(scores, myIdx, tx) {
    return new Promise(resolve => {
      document.getElementById('pd-show')?.remove();
      const top = scores.slice(0, 3), rest = scores.slice(3);
      const n = top.length; // 2 ou 3 joueurs sur le podium
      const me = i => i === myIdx;
      const nm = i => esc(top[i].name) + (me(i) ? `<span class="pd-you">${esc(tx.you)}</span>` : '');
      const msg = myIdx === 0 ? tx.msgWin : myIdx > 0 && myIdx < 3 ? tx.msgClose(Math.max(1, top[0].score - top[myIdx].score)) : myIdx >= 3 ? tx.msgOut(myIdx + 1) : '';
      const pc = innerWidth >= 900;
      const ov = document.createElement('div');
      ov.id = 'pd-show'; ov.className = 'pd-show' + (pc ? ' pd-pc' : '');
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', tx.title);
      const pl = (i, cls) => `<div class="pd-pl pd-p${i + 1}"><div class="pd-fr pd-f${i + 1}">${cls || ''}<div class="pd-pt">${portrait(top[i].portrait)}</div>${i === 1 ? '<span class="pd-gl"></span>' : ''}</div><span class="pd-nm">${nm(i)}</span><span class="pd-pts" data-to="${top[i].score}">0</span></div>`;
      const f1extra = `<span class="pd-halo"></span><span class="pd-gold">${laurel}</span><span class="pd-plain"></span><span class="pd-ring"></span>`;
      ov.innerHTML = `<div class="pd-scene"><div class="pd-cam"><div class="pd-shake"><div class="pd-page"></div><div class="pd-rays"><i></i></div>
        <div class="pd-step pd-st2"><span class="pd-sh"></span>2</div>${n > 2 ? '<div class="pd-step pd-st3"><span class="pd-sh"></span>3</div>' : ''}<div class="pd-step pd-st1"><span class="pd-sh"></span>1</div>
        <div class="pd-soil"></div><div class="pd-ground"></div>
        <svg class="pd-crack" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true"><path d="M150 0 l-10 14 l8 10 l-18 18 l4 12"/><path d="M150 0 l12 12 l-6 12 l20 16 l-4 14"/><path d="M118 0 l-14 10 l-24 4 l-16 14 l-30 6"/><path d="M182 0 l16 12 l24 2 l14 16 l34 8"/><path d="M150 0 l2 20 l-6 18"/></svg>
        <div class="pd-dust">${'<i></i>'.repeat(14)}</div><div class="pd-shock"></div>
        ${n > 2 ? pl(2) : ''}${pl(1)}
        <div class="pd-pl pd-p1"><div class="pd-streaks"><i></i><i></i><i></i><i></i></div><div class="pd-fr pd-f1">${f1extra}<div class="pd-pt">${portrait(top[0].portrait)}</div><span class="pd-gold"><i class="pd-gem a"></i><i class="pd-gem b"></i><i class="pd-gem c"></i><i class="pd-gem d"></i></span>${crown}<div class="pd-orbit pd-gold">${Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3; return `<i style="left:${50 + Math.cos(a) * 50}%;top:${50 + Math.sin(a) * 50}%"></i>`; }).join('')}</div></div><span class="pd-nm">${nm(0)}</span><span class="pd-pts" data-to="${top[0].score}">0</span></div>
        </div></div>
        <div class="pd-title">${esc(tx.title)}<small>${esc(tx.sub || '')}</small></div>
        <div class="pd-rest">${rest.map((r, k) => `<div class="${me(k + 3) ? 'me' : ''}"><span>${k + 4}</span>${esc(r.name)}<em>${r.score} pts</em></div>`).join('')}</div>
        <div class="pd-banner">${esc(tx.banner)}</div><div class="pd-flash"></div><div class="pd-msg">${esc(msg)}</div>
        <button type="button" class="pd-skip">${esc(tx.skip)}</button><button type="button" class="pd-done">${esc(tx.done)}</button></div>`;
      document.body.appendChild(ov);
      document.body.classList.add('pd-open');
      const sc = ov.firstElementChild, q = s => sc.querySelector(s), timers = [];
      const later = (ms, f) => timers.push(setTimeout(f, ms));
      const A = (el, k, o) => { el = typeof el === 'string' ? q(el) : el; return el ? el.animate(k, Object.assign({ fill: 'both', easing: E }, o)) : null; };
      const count = (el, dur) => { if (!el) return; const to = +el.dataset.to, t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + ' pts'; if (k < 1 && el.isConnected) requestAnimationFrame(f); }; requestAnimationFrame(f); };
      const snd = n => { try { window._sound?.play(n); } catch {} };
      let closed = false;
      const close = () => {
        if (closed) return; closed = true; timers.forEach(clearTimeout);
        ov.classList.add('pd-out'); document.body.classList.remove('pd-open');
        setTimeout(() => { ov.remove(); resolve(); }, 350);
      };
      // Fin (ou « Passer ») : tout s'affiche dans l'etat final.
      const finish = () => {
        sc.getAnimations({ subtree: true }).forEach(a => { if (a.effect && a.effect.getTiming().iterations !== Infinity) { try { a.finish(); } catch {} } });
        sc.querySelectorAll('.pd-pts').forEach(e => { e.textContent = e.dataset.to + ' pts'; });
        sc.classList.add('pd-live', 'pd-end');
      };
      q('.pd-skip').addEventListener('click', () => { timers.forEach(clearTimeout); finish(); });
      q('.pd-done').addEventListener('click', close);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { sc.classList.add('pd-static'); finish(); return; }

      const H = sc.clientHeight, W = sc.clientWidth, cs = getComputedStyle(sc), px = v => parseFloat(cs.getPropertyValue(v));
      const base = px('--base') / 100 * H, h1 = px('--h1') / 100 * H, h2 = px('--h2') / 100 * H, h3 = px('--h3') / 100 * H;
      const step = px('--step'), gap = px('--gap'), f1 = px('--f1');
      const gy = H - base, x1 = W / 2, x2 = W / 2 - step - gap, x3 = W / 2 + step + gap;
      const cam = q('.pd-cam'); cam.style.transformOrigin = '0 0';
      const look = (x, y, s) => `translate(${W / 2 - s * x}px,${H * .55 - s * y}px) scale(${s})`;
      const WIDE = 'translate(0px,0px) scale(1)';
      const shot = (from, to, dur, delay, ease = 'cubic-bezier(.65,0,.35,1)') => A(cam, [{ transform: from }, { transform: to }], { duration: dur, delay, easing: ease, fill: 'forwards' });
      const C3 = look(x3, gy - h3, 1.9), C2 = look(x2, gy - h2, 1.9), C1 = look(x1, gy - 10, 2.4);
      A('.pd-title', [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 200 });
      // Avec 2 joueurs seulement, la camera commence par le 2e.
      let t = 900, prev = WIDE;
      if (n > 2) {
        shot(prev, C3, 1500, t); prev = C3;
        A('.pd-st3', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1100, delay: t + 1400, easing: S });
        A('.pd-p3', [{ opacity: 0, transform: 'translateY(-50px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: t + 2100, easing: S });
        later(t + 2300, () => { count(q('.pd-p3 .pd-pts'), 1000); snd('pop'); });
        t += 3800;
      }
      shot(prev, C2, 1700, t);
      A('.pd-st2', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1200, delay: t + 1600, easing: S });
      A('.pd-p2', [{ opacity: 0, transform: 'translateY(-54px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: t + 2400, easing: S });
      later(t + 2600, () => { count(q('.pd-p2 .pd-pts'), 1000); snd('pop'); });
      t += 4200;
      // La camera au ras du sol au centre, puis le tremblement de terre
      shot(C2, C1, 1900, t);
      const tq = t + 2100;
      const quake = []; for (let i = 0; i <= 40; i++) { const k = i < 8 ? i / 8 : 1 - (i - 8) / 32 * .5; quake.push({ transform: `translate(${(Math.random() * 2 - 1) * 4.5 * k}px,${(Math.random() * 2 - 1) * 3.2 * k}px)` }); } quake.push({ transform: 'none' });
      A('.pd-shake', quake, { duration: 4200, delay: tq, easing: 'linear', fill: 'none' });
      sc.querySelectorAll('.pd-crack path').forEach((p, i) => A(p, [{ strokeDashoffset: 160 }, { strokeDashoffset: 0 }], { duration: 900, delay: tq + 300 + i * 260, easing: 'ease-out' }));
      sc.querySelectorAll('.pd-dust i').forEach((d, i) => { const dx = (Math.random() * 2 - 1) * step * 1.1, dy = -(20 + Math.random() * 70); A(d, [{ opacity: 0, transform: 'translate(0,0) scale(.4)' }, { opacity: .85, transform: `translate(${dx * .5}px,${dy * .5}px) scale(1)`, offset: .3 }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.7)` }], { duration: 2200, delay: tq + 1400 + i * 110, easing: 'ease-out', fill: 'none' }); });
      A('.pd-st1', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(.08)', offset: .12 }, { transform: 'scaleY(1)' }], { duration: 3800, delay: tq + 1300, easing: 'cubic-bezier(.45,.05,.3,1)' });
      shot(C1, WIDE, 3800, tq + 1300, 'cubic-bezier(.45,.05,.3,1)');
      A('.pd-crack', [{ opacity: 1 }, { opacity: 0 }], { duration: 1400, delay: tq + 5300, fill: 'forwards' });
      // Le 1er arrive du ciel et atterrit sur sa marche
      const tl = tq + 6200, p1 = q('.pd-p1'), sx = -W * .55, sy = -H * .75, hx = -f1 * .25, hy = -f1 * .9;
      A(p1, [
        { opacity: 0, transform: `translate(${sx}px,${sy}px) scale(.55) rotate(-16deg)`, offset: 0 },
        { opacity: 1, transform: `translate(${sx * .85}px,${sy * .85}px) scale(.6) rotate(-14deg)`, offset: .06 },
        { opacity: 1, transform: `translate(${hx}px,${hy}px) scale(1.05) rotate(-4deg)`, offset: .62, easing: 'ease-in-out' },
        { opacity: 1, transform: `translate(0px,${hy * 1.1}px) scale(1.06) rotate(0)`, offset: .82, easing: 'cubic-bezier(.6,0,.9,.5)' },
        { opacity: 1, transform: 'translate(0,6px) scale(1.12,.88)', offset: .93 },
        { opacity: 1, transform: 'none', offset: 1 }], { duration: 3300, delay: tl, easing: 'cubic-bezier(.25,.8,.35,1)' });
      A('.pd-streaks', [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .55 }, { opacity: 0, offset: .75 }, { opacity: 0 }], { duration: 3300, delay: tl, easing: 'linear' });
      const ti = tl + 3080;
      A('.pd-shock', [{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 900, delay: ti, easing: 'ease-out', fill: 'forwards' });
      const thud = []; for (let i = 0; i <= 10; i++) thud.push({ transform: `translate(${(Math.random() * 2 - 1) * 3 * (1 - i / 10)}px,${(Math.random() * 2 - 1) * 4 * (1 - i / 10)}px)` });
      A('.pd-shake', thud, { duration: 500, delay: ti, easing: 'linear', fill: 'none' });
      later(ti, () => { snd('stamp'); count(q('.pd-p1 .pd-pts'), 1200); });
      // L'anneau devient dore, puis le sacre
      const tg = ti + 1300;
      A('.pd-f1 .pd-ring', [{ opacity: 0 }, { opacity: 1 }], { duration: 1400, delay: tg, easing: 'ease-in-out' });
      A('.pd-f1 .pd-halo', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: .75, transform: 'scale(1)' }], { duration: 1400, delay: tg + 200 });
      sc.querySelectorAll('.pd-gold').forEach((g, i) => A(g, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: tg + 800 + i * 200, easing: S }));
      const ts = tg + 1700;
      A('.pd-flash', [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 1100, delay: ts, easing: 'ease-out', fill: 'forwards' });
      A('.pd-rays', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1600, delay: ts });
      q('.pd-rays i').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 26000, iterations: Infinity });
      A('.pd-crown', [{ opacity: 0, transform: 'translateY(-140%) rotate(-18deg)' }, { opacity: 1, transform: 'translateY(0) rotate(0)' }], { duration: 1200, delay: ts + 500, easing: 'cubic-bezier(.34,1.45,.64,1)' });
      later(ts + 500, () => snd('win'));
      later(ts + 700, () => {
        const C = ['#ffd23f', '#ff6b82', '#7fb2ff', '#8be28b', '#c9a8ff', '#fff'];
        for (let i = 0; i < 46; i++) {
          const c = document.createElement('i'); c.className = 'pd-conf'; c.style.background = C[i % 6]; sc.appendChild(c);
          const left = i % 2 === 0, x0 = left ? -10 : W + 2, y0 = H * (.55 + Math.random() * .15), vx = (left ? 1 : -1) * (W * (.25 + Math.random() * .35)), peak = -H * (.35 + Math.random() * .25), r = Math.random() * 720;
          const a = c.animate([{ transform: `translate(${x0}px,${y0}px) rotate(0)`, opacity: 1 }, { transform: `translate(${x0 + vx * .55}px,${y0 + peak}px) rotate(${r * .5}deg)`, opacity: 1, offset: .4 }, { transform: `translate(${x0 + vx}px,${y0 + H * .35}px) rotate(${r}deg)`, opacity: 0 }], { duration: 2600 + Math.random() * 800, delay: i * 12, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' });
          a.onfinish = () => c.remove();
        }
      });
      A('.pd-banner', [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 900, delay: ts + 1300, easing: 'cubic-bezier(.34,1.4,.64,1)' });
      A('.pd-rest', [{ opacity: 0, transform: 'translateX(20px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: ts + 1900 });
      A('.pd-msg', [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: ts + 2400 });
      later(ts + 2200, () => sc.classList.add('pd-live'));
      later(ts + 3000, () => sc.classList.add('pd-end'));
    });
  }
  window.LiberoPodium = { play };
})();
