// Bump this on every release so old caches are cleared.
const CACHE = 'pantrychef-sg-v5'; 
const PRECACHE = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './icon-180.png'
];

// Recipe-scraping proxies: network-first (responses must be fresh)
const NETWORK_FIRST_HOSTS = ['allorigins.win', 'codetabs.com', 'corsproxy.io', 'r.jina.ai'];

// Third-party libs/fonts that are safe to cache for offline use
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const hostIn = (host, list) => list.some((h) => host === h || host.endsWith('.' + h));

// Helper to identify Supabase API calls (Auth, REST, Realtime) vs Supabase Storage (Images)
const isSupabaseApi = (url) => {
  if (!url.hostname.endsWith('supabase.co') && !url.hostname.endsWith('supabase.in')) return false;
  // We WANT to cache storage (images), but NEVER cache auth, rest, or realtime
  return !url.pathname.startsWith('/storage/');
};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
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

  // 1. Supabase Auth / REST / Realtime: leave entirely to the browser (never cached)
  if (isSupabaseApi(url)) {
    return; 
  }

  // 2. Recipe-scraping proxies: network only, but SAVE to cache if successful, fall back to cache if offline
  if (hostIn(url.hostname, NETWORK_FIRST_HOSTS)) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // 3. App shell (HTML, manifest, sw): network-first so updates show up immediately
  // FIX: Escaped the dot in the regex /\.(html|json)$/
  if (sameOrigin && (req.mode === 'navigate' || /\.(html|json)$/.test(url.pathname) || url.pathname.endsWith('/'))) {
    e.respondWith(networkFirst(req, CACHE));
    return;
  }

  // 4. Photos (Supabase Storage, Unsplash, recipe sites) & Static files / CDNs: stale-while-revalidate
  if (sameOrigin || hostIn(url.hostname, CDN_HOSTS) || url.hostname.includes('storage.supabase.co')) {
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

  // 5. Anything else: default browser behaviour (not cached)
});