// sw.js — the "service worker": stores every app file on the device the first
// time the app is opened, so it opens with no signal afterwards.
// When you change any app file, bump VERSION so devices pick up the new files.
// (Film data is NOT stored here; it lives in the per-film database.)

const VERSION = 'soundcheck-v91';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/preact-htm.js', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs',
  'vendor/fonts/inter-400.woff2', 'vendor/fonts/inter-600.woff2', 'vendor/fonts/inter-800.woff2',
  'vendor/fonts/courier-prime-400.woff2', 'vendor/fonts/courier-prime-700.woff2',
  'src/main.js', 'src/state.js', 'src/model.js', 'src/colour.js',
  'src/editing.js', 'src/kit-editing.js', 'src/sync.js', 'src/preset-rules.js',
  'src/proposals.js', 'src/proposal-rules.js', 'src/email-robot.js', 'src/sound-rules.js', 'src/sound-editing.js', 'src/parts/sound-bar.js', 'src/parts/scene-pill.js', 'src/parts/conflicts.js', 'src/parts/day-strip.js', 'src/read-aloud.js', 'src/parts/scene-script.js', 'src/hours-rules.js', 'src/hours-editing.js', 'src/parts/wrap-clock.js', 'src/screens/hours.js', 'src/export/hours-image.js', 'src/parts/wrap-alerts.js', 'src/screens/help.js', 'src/parts/tomorrow.js', 'src/gear-rules.js', 'src/gear-editing.js', 'src/parts/gear-form.js', 'src/screens/gear.js', 'src/export/gear-image.js', 'src/export/gear-text.js', 'src/export/xlsx.js', 'src/parts/auto-scroll.js', 'src/theme.js', 'src/parts/theme-switch.js', 'src/parts/email-robot.js', 'src/cues-rules.js', 'src/cues-phrases.js', 'src/cues-map-rules.js', 'src/screens/cues-map.js', 'src/cues-timeline-rules.js', 'src/screens/cues-timeline.js', 'src/cues-editing.js', 'src/parts/cue-line-editor.js',
  'src/ifb-editing.js', 'src/ifb-rules.js',
  'src/store/local.js', 'src/store/github.js', 'src/store/repo-files.js',
  'src/parts/pills.js', 'src/parts/scene-table.js', 'src/parts/scene-editor.js', 'src/parts/picker.js', 'src/parts/banners.js', 'src/parts/item-form.js', 'src/parts/ifb-picker.js', 'src/parts/icons.js',
  'src/screens/schedule.js', 'src/screens/scenes.js', 'src/screens/kit.js', 'src/screens/projects.js', 'src/screens/proposal.js', 'src/screens/document.js', 'src/screens/cues.js', 'src/screens/cues-picker.js',
  'src/screens/ifb-list.js', 'src/screens/ifb-crew.js', 'src/screens/ifb-kit.js',
  'src/export/draw.js', 'src/export/image.js', 'src/export/schedule-images.js', 'src/export/share.js',
];

// cache: 'reload' = always fetch fresh files from the site. Without it the browser may
// hand back copies it kept for up to 10 minutes, and a new version would store old files.
self.addEventListener('install', event => {
  const fresh = FILES.map(file => new Request(file, { cache: 'reload' }));
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: answer from the device first (instant, works offline).
// Anything else (GitHub): always go to the network.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request))
  );
});

// Wrap alerts (parts/wrap-alerts.js): a push from the "Wrap alerts" robot shows a notification,
// even with the app closed; tapping it opens the app, where the wrap question is waiting.
self.addEventListener('push', event => {
  let message = { title: 'soundcheck', body: '' };
  try { message = { ...message, ...event.data.json() }; } catch { /* no text: the plain title */ }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body, tag: message.tag || 'wrap', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: message.url || './' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './'; // e.g. './#hours' (the "Tomorrow" alarms)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(open =>
    (open[0] ? open[0].navigate(url).then(c => c?.focus()) : self.clients.openWindow(url))));
});
