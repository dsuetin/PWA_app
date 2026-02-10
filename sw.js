// -------------------------
// SERVICE WORKER (PWA)
// -------------------------
const CACHE_NAME = 'hello-pwa-v211.0';  // обнови версию при деплое
const SW_VERSION = '2026-02-09_v211';
console.log('[SW] BUILD VERSION:', SW_VERSION);

// const APP_SHELL = [
//     '/',
//     '/index.html',
//     '/app.js',

//     '/style.css',
//     '/manifest.json',

//     '/floorplan.js',
//     '/lines.js',
//     '/lights.js',
// ];

// -------------------------
// INSTALL
// -------------------------
self.addEventListener('install', event => {
    console.log('[SW] installed');
    self.skipWaiting();
});

// -------------------------
// ACTIVATE
// -------------------------
self.addEventListener('activate', event => {
    // удаляем старые кеши
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );

    self.clients.claim();

    // уведомляем страницу о версии
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
            client.postMessage({ type: 'NEW_VERSION' });
        });
    });
});

// -------------------------
// MESSAGE (skipWaiting)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// -------------------------
// FETCH
// -------------------------


self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(resp => {
                if (!resp || resp.status !== 200) return resp;
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                return resp;
            });
        })
    );
});
