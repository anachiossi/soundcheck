// sw.js — the "service worker": stores every app file on the device the first
// time the app is opened, so it opens with no signal afterwards.
// When you change any app file, bump VERSION so devices pick up the new files.
// (Film data is NOT stored here; it lives in the per-film database.)

const VERSION = 'soundcheck-v1';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/preact-htm.js',
  'vendor/fonts/inter-400.woff2', 'vendor/fonts/inter-600.woff2', 'vendor/fonts/inter-800.woff2',
  'src/main.js', 'src/state.js', 'src/model.js', 'src/csv.js', 'src/colour.js',
  'src/store/local.js', 'src/store/sheets.js',
  'src/parts/pills.js', 'src/parts/scene-table.js', 'src/parts/banners.js',
  'src/screens/schedule.js', 'src/screens/scenes.js', 'src/screens/kit.js', 'src/screens/projects.js',
  'src/export/draw.js', 'src/export/image.js', 'src/export/share.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: answer from the device first (instant, works offline).
// Anything else (the Sheets): always go to the network.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request))
  );
});
