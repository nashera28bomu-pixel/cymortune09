/**
 * service-worker.js
 * Caches the app shell for instant loads + offline use, caches streamed
 * artwork/audio as they're encountered (stale-while-revalidate), and lets
 * network-first API calls fall back to cache when offline.
 *
 * Cache names:
 *  - cymor-tune-shell   : HTML/CSS/JS core app shell (precached on install)
 *  - cymor-tune-runtime : images + API responses seen during use
 *  - cymor-tune-audio   : explicit user downloads (written by app.js)
 */

const SHELL_CACHE = 'cymor-tune-shell-v2';
const RUNTIME_CACHE = 'cymor-tune-runtime';
const AUDIO_CACHE = 'cymor-tune-audio';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/storage.js',
  '/assets/js/api.js',
  '/assets/js/player.js',
  '/assets/js/ui.js',
  '/assets/js/router.js',
  '/assets/js/app.js',
  '/assets/images/placeholder-art.svg',
  '/pages/home.html',
  '/pages/search.html',
  '/pages/song.html',
  '/pages/album.html',
  '/pages/artist.html',
  '/pages/playlist.html',
  '/pages/favorites.html',
  '/pages/history.html',
  '/pages/downloads.html',
  '/pages/settings.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE && n !== AUDIO_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Audio downloads: cache-first, this cache is only ever populated explicitly
  if (caches.match) {
    // handled below in unified strategy
  }

  // Backend API: network-first, fall back to runtime cache when offline
  if (url.hostname === 'cymortuneapi.onrender.com') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin app shell files: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cross-origin (album art, streamed audio, fonts): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw err;
  }
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'No cached data available offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const audioCached = await caches.match(request, { cacheName: AUDIO_CACHE });
  if (audioCached) return audioCached;

  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
