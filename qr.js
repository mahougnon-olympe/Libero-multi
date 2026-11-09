// QR des salons de partie : dessine le QR du lien ?join=CODE dans la salle d'attente, l'agrandit en plein ecran, et scanne celui d'un autre joueur.
// Charge a la demande par app.js (_qrLoad). Aucune requete externe : qrcode.min.js et jsQR.js sont dans vendor/.
(function () {
  'use strict';
  const fr = () => !(typeof currentLang !== 'undefined' && currentLang === 'en');
  const TX = {
    fr: { cap: 'Scanne pour rejoindre', tap: 'Touche le QR pour l\'agrandir', big: 'Fais scanner ce QR pour rejoindre', close: 'Fermer', scan: 'Scanner un QR', title: 'Scanner', frame: 'Cadre le QR dans le carré', priv: 'La caméra sert seulement à lire le code. Rien n\'est enregistré.', typeIt: 'Saisir le code à la place', found: 'SALON TROUVÉ', denied: 'Caméra refusée', deniedT: 'Autorise la caméra dans ton navigateur, ou tape le code à 4 caractères.', none: 'Aucune caméra trouvée', noneT: 'Tape le code à 4 caractères.', bad: 'Ce QR n\'est pas un salon Libero', badT: 'Scanne le QR affiché dans la salle d\'attente d\'un salon.' },
    en: { cap: 'Scan to join', tap: 'Tap the QR to enlarge it', big: 'Have them scan this QR to join', close: 'Close', scan: 'Scan a QR', title: 'Scan', frame: 'Frame the QR in the square', priv: 'The camera only reads the code. Nothing is saved.', typeIt: 'Type the code instead', found: 'ROOM FOUND', denied: 'Camera denied', deniedT: 'Allow the camera in your browser, or type the 4-character code.', none: 'No camera found', noneT: 'Type the 4-character code.', bad: 'This QR is not a Libero room', badT: 'Scan the QR shown in a room\'s waiting screen.' },
  };
  const T = () => TX[fr() ? 'fr' : 'en'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON_EXP = '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const ICON_SCAN = '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></svg>';

  function draw(canvas, text, px) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), size = px || 336, m = size / (n + 4);
    canvas.width = canvas.height = size; const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#22252b';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(Math.round((c + 2) * m), Math.round((r + 2) * m), Math.ceil(m), Math.ceil(m));
  }
  const urlFor = code => (typeof buildShareUrl === 'function') ? buildShareUrl(code) : `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;

  // Carte du QR dans la salle d'attente : (re)dessinee a chaque nouveau code.
  function card(host, code) {
    let el = host.nextElementSibling; if (!el || !el.classList.contains('qr-card')) { el = document.createElement('div'); el.className = 'qr-card'; el.setAttribute('role', 'button'); el.tabIndex = 0; host.insertAdjacentElement('afterend', el); el.addEventListener('click', () => big(el.dataset.code)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); big(el.dataset.code); } }); }
    if (!/^[A-Z0-9]{4}$/i.test(code || '')) { el.hidden = true; return; }
    const t = T(); el.dataset.code = code; el.hidden = false; el.setAttribute('aria-label', t.tap);
    el.innerHTML = `<span class="qr-exp">${ICON_EXP}</span><canvas></canvas><span class="qr-cap">${esc(t.cap)}</span><small>${esc(t.tap)}</small>`;
    try { draw(el.querySelector('canvas'), urlFor(code), 336); } catch (_) { el.hidden = true; }
  }
  function big(code) {
    if (!code || document.getElementById('qr-big')) return; const t = T();
    const ov = document.createElement('div'); ov.id = 'qr-big'; ov.className = 'qr-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="qr-frame"><canvas></canvas></div><div class="qr-big">${esc(code)}</div><p>${esc(t.big)}</p><button class="qr-x" type="button">${esc(t.close)}</button>`;
    document.body.appendChild(ov); try { draw(ov.querySelector('canvas'), urlFor(code), 600); } catch (_) {}
    const off = () => { ov.remove(); document.removeEventListener('keydown', key); }; const key = e => { if (e.key === 'Escape') off(); };
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.qr-x')) off(); }); document.addEventListener('keydown', key); ov.querySelector('.qr-x').focus();
  }

  // Scanner
  let stream = null, raf = 0, jsqrP = null;
  function loadJsQR() { if (window.jsQR) return Promise.resolve(); if (jsqrP) return jsqrP; jsqrP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); return jsqrP; }
  function parse(txt) {
    txt = String(txt || '').trim(); if (/^[A-Za-z0-9]{4}$/.test(txt)) return txt.toUpperCase();
    try { const u = new URL(txt); const c = u.searchParams.get('join'); if (c && u.origin === location.origin && /^[A-Za-z0-9]{4}$/.test(c)) return c.toUpperCase(); } catch (_) {}
    return null;
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  function enter(code) {
    const name = (typeof getPlayerName === 'function' && getPlayerName()) || (typeof getTriviaName === 'function' && getTriviaName()) || (localStorage.getItem('playerName') || '').trim();
    if (name && name !== 'Anonyme') socket.emit('join-by-code', { code, name, playerId: getPlayerId() });
    else if (window._askJoinName) window._askJoinName(code);
  }
  async function scan() {
    if (document.getElementById('qr-cam')) return; const t = T();
    const ov = document.createElement('div'); ov.id = 'qr-cam'; ov.className = 'qr-cam'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="qr-bar"><button class="qr-x" type="button" data-k="x">${esc(t.close)}</button><span>${esc(t.title)}</span><span style="width:72px"></span></div><div class="qr-stage"><video playsinline muted></video><div class="qr-view"><i></i><i></i><i></i><i></i><div class="qr-line"></div></div><div class="qr-ok">${esc(t.found)}</div><div class="qr-tx"><b>${esc(t.frame)}</b><span>${esc(t.priv)}</span><button class="qr-x" type="button" data-k="type">${esc(t.typeIt)}</button></div></div>`;
    document.body.appendChild(ov);
    const done = () => { stop(); ov.remove(); document.removeEventListener('keydown', key); }; const key = e => { if (e.key === 'Escape') done(); };
    document.addEventListener('keydown', key);
    ov.addEventListener('click', e => { const k = e.target.closest('[data-k]'); if (!k) return; done(); if (k.dataset.k === 'type') { const i = ['input-code', 'input-trivia-code'].map(id => document.getElementById(id)).find(e => e && e.offsetParent); i && i.focus(); } });
    const fail = (h, p) => { const tx = ov.querySelector('.qr-tx'); tx.classList.add('err'); tx.querySelector('b').textContent = h; tx.querySelector('span').textContent = p; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fail(t.none, t.noneT); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (e) { if (!document.getElementById('qr-cam')) return; fail(e && e.name === 'NotFoundError' ? t.none : t.denied, e && e.name === 'NotFoundError' ? t.noneT : t.deniedT); return; }
    if (!document.getElementById('qr-cam')) { stop(); return; }
    const v = ov.querySelector('video'); v.srcObject = stream; try { await v.play(); } catch (_) {}
    let det = null; if ('BarcodeDetector' in window) { try { det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {} }
    if (!det) { try { await loadJsQR(); } catch (_) { fail(t.none, t.noneT); return; } }
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); let last = 0, lockedBad = 0;
    const hit = code => { stop(); ov.classList.add('found'); ov.querySelector('.qr-tx').style.display = 'none'; try { navigator.vibrate && navigator.vibrate(60); } catch (_) {} setTimeout(() => { done(); enter(code); }, 900); };
    const tick = async ts => {
      if (!document.getElementById('qr-cam') || ov.classList.contains('found')) return; raf = requestAnimationFrame(tick);
      if (ts - last < 130 || v.readyState < 2) return; last = ts;
      let txt = null;
      try {
        if (det) { const r = await det.detect(v); if (r && r[0]) txt = r[0].rawValue; }
        else { const w = 480, h = Math.round(w * v.videoHeight / v.videoWidth) || 360; cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h); const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); if (r) txt = r.data; }
      } catch (_) {}
      if (!txt) return; const code = parse(txt);
      if (code) { hit(code); return; }
      if (Date.now() - lockedBad > 2500) { lockedBad = Date.now(); const tx = ov.querySelector('.qr-tx'); tx.classList.add('err'); tx.querySelector('b').textContent = t.bad; tx.querySelector('span').textContent = t.badT; }
    };
    raf = requestAnimationFrame(tick);
  }
  function scanButton(label) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary qr-scan-btn'; b.innerHTML = `${ICON_SCAN}<span>${esc(label || T().scan)}</span>`; b.addEventListener('click', scan); return b; }
  window.LiberoQR = { card, big, scan, scanButton, T };
})();
