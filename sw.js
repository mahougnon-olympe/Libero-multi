/* Service worker de Libero's Multi.
   - Reseau d'abord, MAIS avec un delai : si le reseau ne repond pas en 2,5 s on
     sert la copie gardee et le telechargement continue en arriere-plan (il
     rafraichit le cache pour la prochaine fois). Avant, le service worker
     attendait le reseau sans limite : sur une connexion qui traine sans echouer,
     le cache ne servait jamais et la page « ne revenait pas ».
   - Recoit les notifications push (tournoi, defis, annonces). */

const CACHE = 'libero-v22';
const SHELL = ['./', './index.html', './style.css', './cahier.css', './app.js', './portrait.js', './config.js', './wordle-words.js', './icons3d.js',
  './vendor/socket.io.min.js', './manifest.json', './assets/icon-192.png', './assets/logo-full.svg', './assets/logo-icon.svg'];
const DELAI_RESEAU_MS = 2500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Jamais de cache pour l'API/socket (autre origine), l'admin ni les requetes non GET.
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/stats')) return;

  const reseau = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return res;
  });
  reseau.catch(() => {}); // evite un « unhandled rejection » si on a servi le cache entre-temps
  const secours = () => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  e.respondWith(
    caches.match(e.request).then(enCache => {
      // Rien en cache (premiere visite) : on attend le reseau, il n'y a pas d'alternative.
      if (!enCache && e.request.mode !== 'navigate') return reseau.catch(() => secours()).then(r => r || Response.error());
      const delai = new Promise(res => setTimeout(() => res('delai'), DELAI_RESEAU_MS));
      return Promise.race([reseau, delai]).then(r => (r === 'delai' ? (enCache || reseau) : r))
        .catch(() => secours().then(r => r || Response.error()));
    })
  );
  // La requete reseau continue meme si on a servi le cache : le cache sera frais la prochaine fois.
  e.waitUntil(reseau.catch(() => {}));
});

// ── Notifications push ────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || "Libero's Multi";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    data: { url: data.url || './index.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
