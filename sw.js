// Offline support for the hosted page (GitHub Pages and the like); never used inside claude.ai.
// Network first: online you always get the newest version, offline you get the last one you saw.
// Bump VERSION to drop old caches.
const VERSION = 'wmmbe-v1';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/icons.js', 'js/i18n/en.js', 'js/i18n/th.js', 'js/i18n/zh.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(fetch(req).then(res => {
    // keep a copy of the page, its files, the chart library and the fonts for offline use
    if (res && (res.ok || res.type === 'opaque')){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
