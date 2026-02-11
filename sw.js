const CACHE_NAME = 'hello-pwa-v224.0';
const SW_VERSION = '2026-02-09_v224';

const APP_SHELL = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './floorplan.js',
    './lights.js',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );

    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(resp => {
            return resp || fetch(event.request).then(net => {
                const clone = net.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                return net;
            }).catch(() => caches.match('./index.html'));
        })
    );
});
