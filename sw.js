const CACHE_NAME = 'app-ponto-pessoal-v8';
const BASE = '/app-ponto-pessoal/';
const FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'script.js',
  BASE + 'features.js',
  BASE + 'holerite-refinado.js',
  BASE + 'manifest.json',
  BASE + 'icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHtml = url.pathname === BASE || url.pathname === BASE + 'index.html';
  const isScriptOrStyle = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  if (isHtml) {
    event.respondWith(
      fetch(event.request).then(response => response.text()).then(html => {
        let body = html;
        if (!body.includes('holerite-refinado.js')) {
          body = body.replace('</body>', '<script src="holerite-refinado.js?v=8"></script></body>');
        }
        return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }).catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  if (isScriptOrStyle) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cacheResponse => {
      return cacheResponse || fetch(event.request).then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return networkResponse;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});
