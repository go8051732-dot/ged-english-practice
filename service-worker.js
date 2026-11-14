const CACHE_NAME = 'ged-english-app-v15';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vocabulary-study.css',
  './vocabulary-study.js',
  './wrong-notebook.js',
  './pwa-register.js',
  './icons/app-192.png',
  './icons/app-512.png',
  './icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES.map(path => new URL(path, self.registration.scope).toString()))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ged-english-app-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isShell = request.mode === 'navigate' || ['script', 'style', 'manifest'].includes(request.destination);
  if (isShell) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match(new URL('./index.html', self.registration.scope).toString()))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
