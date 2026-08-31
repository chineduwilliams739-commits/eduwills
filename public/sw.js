const CACHE = 'eduwills-shell-v1';
const BASE = '/eduwills/';
const OFFLINE_URL = `${BASE}offline/`;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([BASE, OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(`${BASE}dashboard/`)) || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  if (request.url.includes('/_next/static/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    })));
  }
});
