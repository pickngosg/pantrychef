// Bump this on every release so old caches are cleared.
const CACHE = 'pantrychef-sg-v4';

const PRECACHE = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png', './icon-180.png'
];

// Hosts that must always hit the network (never cached)
const NEVER_CACHE = ['supabase.co', 'supabase.in'];
// Recipe-scraping proxies: network-first (responses must be fresh)
const NETWORK_FIRST_HOSTS = ['allorigins.win', 'codetabs.com', 'corsproxy.io', 'r.jina.ai'];
// Third-party libs/fonts that are safe to cache for offline use
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const hostIn = (host, list) => list.some((h) => host === h || host.endsWith('.' + h));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // add one by one so a single missing file can't break the whole install
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch((err) => console.warn('[SW] precache skipped', u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, cacheName) {
  return fetch(req)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy));
      }
      return res;
    })
    .catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // Cloud sync / auth: leave entirely to the browser
  if (hostIn(url.hostname, NEVER_CACHE)) return;

  // Recipe-scraping proxies: network only, fall back to cache if offline
  if (hostIn(url.hostname, NETWORK_FIRST_HOSTS)) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // App shell (HTML, manifest, sw): network-first so updates show up immediately
  if (sameOrigin && (req.mode === 'navigate' || /\.(html|json)$/.test(url.pathname) || url.pathname.endsWith('/'))) {
    e.respondWith(networkFirst(req, CACHE));
    return;
  }

  // Photos (Unsplash, recipe sites, uploads) are NOT touched: the browser loads them natively

  // Same-origin static files (icons) and known CDNs: stale-while-revalidate
  if (sameOrigin || hostIn(url.hostname, CDN_HOSTS)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached || Response.error());
        return cached || fetched;
      })
    );
    return;
  }
  // Anything else: default browser behaviour (not cached)
});
