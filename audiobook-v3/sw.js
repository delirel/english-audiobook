/* ═══════════════════════════════════════════════════════════
   English Audiobook v3 — Service Worker
   Strategy:
   - App shell (HTML, CSS, JS, fonts) → Cache First
   - Claude API calls → Network Only (no cache, needs fresh data)
   - CDN assets (React, Google Fonts) → Cache First w/ fallback
   ═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'audiobook-v3-v1';
const STATIC_CACHE = 'audiobook-static-v1';
const CDN_CACHE = 'audiobook-cdn-v1';

// App shell – files we control
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/data.js',
  '/js/stopwords.js',
  '/js/textProcessor.js',
  '/js/tfidf.js',
  '/js/vocabBuilder.js',
  '/js/exerciseGen.js',
  '/js/claudeClient.js',
  '/js/storage.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// CDN resources to cache
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing v3...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL).catch(err => {
          console.warn('[SW] Some shell files failed to cache:', err);
        });
      }),
      caches.open(CDN_CACHE).then(cache => {
        console.log('[SW] Caching CDN assets');
        return Promise.allSettled(CDN_URLS.map(url => cache.add(url)));
      }),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating v3...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== CDN_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Claude API → Network Only, never cache
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Google Fonts → Cache First (fonts load slowly)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, CDN_CACHE));
    return;
  }

  // 3. CDN JS (React etc.) → Cache First
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(event.request, CDN_CACHE));
    return;
  }

  // 4. App shell & local files → Cache First, fallback to network
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // 5. Everything else → Network with cache fallback
  event.respondWith(networkFirst(event.request));
});

// ── Strategies ────────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// ── Background Sync (future: queue failed API calls) ──────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
