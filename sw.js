const CACHE_NAME = 'hello-pwa-v253.0';

// const BASE = "/PWA_app";
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");

const APP_SHELL = [
    `${BASE}/`,
    `${BASE}/index.html`,
    `${BASE}/app.js`,
    `${BASE}/style.css`,
    `${BASE}/manifest.json`,
    `${BASE}/floorplan.js`,
    `${BASE}/lights.js`,
    `${BASE}/icon-192.png`,
    `${BASE}/icon-512.png`
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
            }).catch(() => caches.match(`${BASE}/index.html`));
        })
    );
});
