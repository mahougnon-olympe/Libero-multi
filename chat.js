/* Chat entre amis (« Mes mots ») : la fenetre, chargee a la premiere ouverture.
   La partie toujours chargee (bouton, pastille, avion d'arrivee, silence en partie)
   est dans app.js (initDmCore). Style « encre » : on s'ecrit dans la marge du
   cahier, la reponse de l'ami s'ecrit a la plume, les miens sont surlignes. */
(function () {
  const $ = id => document.getElementById(id);
  const ov = $('overlay-dm');
  if (!ov || window._dmUI) return;
  const listEl = $('dm-list'), wrap = $('dm-conv-wrap'), conv = $('dm-conv'), input = $('dm-input');
  const back = $('dm-back'), title = $('dm-title'), who = $('dm-who'), menuBtn = $('dm-menu-btn'), menu = $('dm-menu'), err = $('dm-err');
  const KEY = 'libero_dm_open';
  let friends = [], current = null, msgs = [], typingTimer = null, lastTypingSent = 0;

  // Police manuscrite des messages : chargee seulement ici (pas au demarrage du site).
  if (!document.getElementById('dm-font')) {
    const l = document.createElement('link');
    l.id = 'dm-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap';
    document.head.appendChild(l);
  }

  const d = () => t().dm;
  const esc = s => _escHtml(String(s == null ? '' : s));
  const reduce = () => !window._dmPrefs().anim || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const save = v => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} };
  function hhmm(at) { const x = new Date(at); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }
  function dayLabel(at) {
    const a = new Date(at); a.setHours(0, 0, 0, 0);
    const n = new Date(); n.setHours(0, 0, 0, 0);
    const diff = Math.round((n - a) / 86_400_000);
    if (diff === 0) return d().today;
    if (diff === 1) return d().yesterday;
    return a.toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' });
  }
  function avatar(f, size) {
    const svg = f && f.portrait && window.LiberoPortrait ? window.LiberoPortrait.svg(f.portrait) : '';
    return `<span class="dm-av" style="width:${size}px;height:${size}px">${svg || esc((f?.name || '?').charAt(0).toUpperCase())}${f ? `<i class="dm-dot ${f.online ? 'on' : ''}"></i>` : ''}</span>`;
  }

  // ── Liste des conversations ──
  function renderList() {
    if (!friends.length) {
      listEl.innerHTML = `<p class="dm-empty">${esc(d().empty)}</p><button type="button" class="dm-add" id="dm-add">${esc(d().addFriend)}</button>`;
      $('dm-add').onclick = () => { close(); document.getElementById('go-friends')?.click(); };
      return;
    }
    listEl.innerHTML = friends.map(f => {
      const last = f.last ? (f.last.mine ? d().you + ' : ' : '') + f.last.text : d().first;
      return `<button type="button" class="dm-row" data-ref="${esc(f.ref)}">${avatar(f, 40)}
        <span class="dm-row-n"><b>${esc(f.name)}</b><small class="${f.unread ? 'unread' : ''}${f.last ? '' : ' first'}">${esc(last)}</small></span>
        <span class="dm-row-r">${f.last ? `<small>${esc(hhmm(f.last.at))}</small>` : ''}${f.unread ? `<i class="dm-cnt">${f.unread}</i>` : ''}</span></button>`;
    }).join('') + `<button type="button" class="dm-add" id="dm-add">${esc(d().addFriend)}</button>`;
    $('dm-add').onclick = () => { close(); document.getElementById('go-friends')?.click(); };
  }
  listEl.addEventListener('click', e => { const r = e.target.closest('.dm-row'); if (r) openConv(r.dataset.ref); });

  // ── Conversation ──
  function msgHTML(m, anim) {
    const f = friends.find(x => x.ref === current);
    const cls = m.mine ? 'me' : 'them';
    const name = m.mine ? d().me : (f?.name || '').toUpperCase();
    const seen = m.mine && m.read ? ` · ${esc(d().seen)}` : '';
    const body = `<span class="dm-txt">${esc(m.text)}</span>`;
    return `<div class="dm-m ${cls}${anim || ''}" data-id="${esc(m.id || '')}"><span class="dm-name">${esc(name)} <time>${esc(hhmm(m.at))}${seen}</time></span>${body}</div>`;
  }
  function renderConv() {
    let html = '', lastDay = '';
    msgs.forEach(m => { const dl = dayLabel(m.at); if (dl !== lastDay) { html += `<div class="dm-day">${esc(dl)}</div>`; lastDay = dl; } html += msgHTML(m); });
    conv.innerHTML = html + `<div id="dm-typing" class="dm-typing hidden"></div>`;
    conv.scrollTop = conv.scrollHeight;
  }
  // La reponse de l'ami s'ecrit a la plume, lettre par lettre, stylo qui avance.
  function appendMsg(m) {
    msgs.push(m);
    const typing = $('dm-typing'); typing?.classList.add('hidden');
    const tmp = document.createElement('div');
    const anim = reduce() ? '' : (m.mine ? ' dm-in-me' : ' dm-in-them');
    tmp.innerHTML = msgHTML(m, anim);
    const el = tmp.firstElementChild;
    if (!m.mine && anim) {
      const n = Math.max(6, Math.min(40, m.text.length));
      el.style.setProperty('--steps', n);
      el.style.setProperty('--dur', Math.min(1800, 250 + n * 45) + 'ms');
      el.querySelector('.dm-txt').insertAdjacentHTML('afterend', '<svg class="dm-pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l3-8L17 2l5 5-11 11z" fill="#1b3a8c" stroke="#1d2433" stroke-width="1.2"/></svg>');
    }
    conv.insertBefore(el, typing || null);
    conv.scrollTop = conv.scrollHeight;
  }
  function header() {
    const f = friends.find(x => x.ref === current);
    const inConv = !!current;
    back.classList.toggle('hidden', !inConv);
    menuBtn.classList.toggle('hidden', !inConv);
    who.innerHTML = inConv && f ? avatar(f, 32) : '';
    title.innerHTML = inConv && f ? `${esc(f.name)}<small class="${f.online ? 'on' : ''}">${esc(f.online ? d().online : d().offline)}</small>` : esc(d().title);
    listEl.classList.toggle('hidden', inConv);
    wrap.classList.toggle('hidden', !inConv);
    menu.classList.add('hidden');
  }
  function openConv(ref) {
    current = ref; msgs = []; err.textContent = '';
    conv.innerHTML = '<p class="dm-empty">…</p>';
    header(); save(ref);
    socket.emit('dm-history', { playerId: getPlayerId(), ref });
    if (matchMedia('(min-width: 900px)').matches) setTimeout(() => input.focus(), 50);
  }
  function showList() {
    current = null; header(); save('list');
    socket.emit('dm-list', { playerId: getPlayerId() });
  }
  function open(ref) {
    ov.classList.remove('hidden');
    document.body.classList.add('dm-open');
    retext();
    if (ref) { openConv(ref); socket.emit('dm-list', { playerId: getPlayerId() }); }
    else { listEl.innerHTML = '<p class="dm-empty">…</p>'; showList(); }
  }
  function close() {
    ov.classList.add('hidden'); document.body.classList.remove('dm-open');
    current = null; save(null);
  }
  function retext() {
    $('dm-send').setAttribute('aria-label', d().send);
    back.setAttribute('aria-label', d().back);
    menuBtn.setAttribute('aria-label', d().options);
    input.placeholder = d().ph;
    $('dm-challenge').textContent = d().challenge;
    $('dm-report').textContent = d().report;
    $('dm-block').textContent = d().block;
    $('dm-quick').innerHTML = d().quick.map(q => `<button type="button" class="dm-chip">${esc(q)}</button>`).join('');
    if (!ov.classList.contains('hidden')) { header(); if (!current) renderList(); else renderConv(); }
  }

  // ── Envoi ──
  function send(text) {
    text = String(text || '').trim();
    if (!text || !current) return;
    err.textContent = '';
    socket.emit('dm-send', { playerId: getPlayerId(), ref: current, text, tmp: Date.now() });
    input.value = '';
  }
  $('dm-form').addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  $('dm-quick').addEventListener('click', e => { const c = e.target.closest('.dm-chip'); if (c) send(c.textContent); });
  input.addEventListener('input', () => {
    if (!current || Date.now() - lastTypingSent < 2500) return;
    lastTypingSent = Date.now();
    socket.emit('dm-typing', { playerId: getPlayerId(), ref: current });
  });
  $('dm-challenge').addEventListener('click', () => {
    close();
    try { sessionStorage.setItem('libero_who_home-who', 'friend'); } catch {}
    showScreen('home');
    document.querySelector('#home-who .who-btn[data-who="friend"]')?.click();
    if (typeof showCursorSnakeToast === 'function') showCursorSnakeToast(d().challengeHint);
  });
  back.addEventListener('click', showList);
  $('dm-close').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.classList.contains('hidden')) close(); });
  menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));
  $('dm-report').addEventListener('click', () => {
    const f = friends.find(x => x.ref === current); menu.classList.add('hidden');
    if (f && confirm(d().reportAsk(f.name))) socket.emit('dm-report', { playerId: getPlayerId(), ref: current });
  });
  $('dm-block').addEventListener('click', () => {
    const f = friends.find(x => x.ref === current); menu.classList.add('hidden');
    if (f && confirm(d().blockAsk(f.name))) socket.emit('dm-block', { playerId: getPlayerId(), ref: current });
  });

  // ── Evenements serveur (relayes par app.js) ──
  function on(ev, p) {
    p = p || {};
    if (ev === 'dm-list') { friends = p.list || []; window._dmSetTotal?.(p.total); if (!current) renderList(); else header(); }
    else if (ev === 'dm-history' && p.ref === current) {
      msgs = p.messages || []; renderConv();
      const f = friends.find(x => x.ref === current); if (f) f.unread = 0;
      input.disabled = p.canWrite === false; err.textContent = p.canWrite === false ? d().noWrite : '';
    }
    else if (ev === 'dm-sent' && p.ref === current && p.msg) appendMsg(p.msg);
    else if (ev === 'dm-read' && p.ref === current) {
      msgs.forEach(m => { if (m.mine) m.read = true; });
      const lastMine = [...conv.querySelectorAll('.dm-m.me time')].pop();
      if (lastMine && !lastMine.textContent.includes(d().seen)) lastMine.insertAdjacentHTML('beforeend', `<span class="dm-seen"> · ${esc(d().seen)}</span>`);
    }
    else if (ev === 'dm-typing' && p.ref === current) {
      const ty = $('dm-typing'); const f = friends.find(x => x.ref === current);
      if (!ty || !f) return;
      ty.textContent = d().typing(f.name); ty.classList.remove('hidden');
      conv.scrollTop = conv.scrollHeight;
      clearTimeout(typingTimer); typingTimer = setTimeout(() => ty.classList.add('hidden'), 3500);
    }
    else if (ev === 'dm-error') err.textContent = (d().err || {})[p.error] || '';
    else if (ev === 'dm-reported') err.textContent = d().reported;
    else if (ev === 'dm-blocked') { err.textContent = ''; showList(); }
  }
  function onNew(p) {
    const f = friends.find(x => x.ref === p.ref);
    if (f) { f.last = { text: p.msg.text, at: p.msg.at, mine: false }; if (p.ref !== current) f.unread = (f.unread || 0) + 1; }
    if (!ov.classList.contains('hidden') && p.ref === current) {
      appendMsg(p.msg);
      socket.emit('dm-mark-read', { playerId: getPlayerId(), ref: current });
    } else if (!ov.classList.contains('hidden') && !current) {
      friends.sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0)); renderList();
    }
  }

  window._dmUI = {
    open, on, onNew, retext,
    isOpen: () => !ov.classList.contains('hidden'),
    isOpenWith: ref => !ov.classList.contains('hidden') && current === ref,
  };
})();
