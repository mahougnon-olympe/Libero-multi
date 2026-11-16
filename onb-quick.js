// Inscription sur telephone : choix rapides du portrait (teint, coiffure, couleur des cheveux) directement dans le carnet.
// Partage par l'app (app.js) et la page d'apercu (apercu-inscription.html). Visible seulement sous 600 px (cahier.css).
(function () {
  'use strict';
  let cfg = null, draft = null;
  const en = () => typeof currentLang !== 'undefined' && currentLang === 'en';
  const TX = { fr: { skin: 'Teint', hair: 'Coiffure', hairCol: 'Couleur des cheveux' }, en: { skin: 'Skin tone', hair: 'Hairstyle', hairCol: 'Hair colour' } };
  const P = () => window.LiberoPortrait;
  const opt = k => P().OPTS.find(o => o.k === k);
  const free = o => { const n = (o.v || o.sw).length, lock = o.lock || [], a = []; for (let i = 0; i < n; i++) if (!lock.includes(i)) a.push(i); return a; };
  const cur = () => P().normalize(draft || (cfg && cfg.get && cfg.get()) || P().DEF);
  function render(d0) {
    if (!cfg || !cfg.root || !P()) return;
    if (d0) draft = d0;
    const d = cur(), t = TX[en() ? 'en' : 'fr'];
    const sw = (k, title) => { const o = opt(k); return `<div class="oq-r"><div class="oq-l">${title}</div><div class="oq-s">${free(o).map(i => `<button type="button" class="oq-sw${d[k] === i ? ' sel' : ''}" data-k="${k}" data-i="${i}" style="background:${o.sw[i]}" aria-label="${title} ${i + 1}"></button>`).join('')}</div></div>`; };
    const hair = (() => { const o = opt('hair'); return `<div class="oq-r"><div class="oq-l">${t.hair}</div><div class="oq-s">${free(o).map(i => `<button type="button" class="oq-th${d.hair === i ? ' sel' : ''}" data-k="hair" data-i="${i}" aria-label="${(o.v[i] || [])[en() ? 1 : 0] || t.hair}">${P().svg(Object.assign({}, d, { hair: i }))}</button>`).join('')}</div></div>`; })();
    cfg.root.innerHTML = sw('skin', t.skin) + hair + sw('hairCol', t.hairCol);
  }
  function mount(c) {
    cfg = c; if (!c || !c.root) return;
    c.root.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b || !P()) return;
      const d = cur(); d[b.dataset.k] = +b.dataset.i; draft = d; render(); if (cfg.change) cfg.change(d);
    });
    render();
  }
  // Apres un enregistrement ou un changement de page : repart du portrait reellement enregistre.
  function sync() { draft = null; render(); }
  window.LiberoOnbQuick = { mount, render, sync };
})();
