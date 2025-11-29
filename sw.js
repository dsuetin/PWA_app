const CACHE_NAME = 'hello-pwa-v3';
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(c => c !== CACHE_NAME ? caches.delete(c) : null)
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(resp => {
            return resp || fetch(event.request).then(networkResp => {
                if (networkResp && networkResp.status === 200) {
                    const clone = networkResp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResp;
            });
        })
    );
});
