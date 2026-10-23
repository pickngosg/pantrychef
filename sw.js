/* PantryChef SG Pro - service worker (v6)
   - Opens instantly and works offline (app + styles + libraries are kept on the phone)
   - Always tries the internet first for the app page, so new versions arrive automatically
   - Never stores logins, sync data, payments or AI imports */
const VERSION = 'pcsg-v6-2026-10-23';
const CORE = ['./', './index.html', './manifest.json', './privacy.html', './icon-192.png', './icon-512.png', './icon-180.png'];
const CDN = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'placehold.co'];
const NEVER = ['supabase.co', 'stripe.com', 'googleapis.com/v1beta', 'apify.com', 'r.jina.ai'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.some((h) => url.href.includes(h))) return;

  // The app page itself (also used when a recipe is shared to the app): internet first, saved copy if offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }
  // Our own files and trusted libraries/fonts: show the saved copy at once, refresh it quietly
  if (url.origin === location.origin || CDN.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});

// Tapping a reminder opens the app (or brings it to the front)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
