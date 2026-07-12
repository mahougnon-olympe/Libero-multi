/* Service worker de Libero's Multi.
   - Reseau d'abord, cache en secours : le site reste toujours frais en ligne,
     et l'accueil peut s'ouvrir hors connexion (jeux solo).
   - Recoit les notifications push (tournoi, defis, annonces). */

const CACHE = 'libero-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './manifest.json', './icon-192.png', './logo-full.svg', './logo-icon.svg'];

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
  // Jamais de cache pour l'API/socket (autre origine) ni les requetes non GET.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
  );
});

// ── Notifications push ────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || "Libero's Multi";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
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
