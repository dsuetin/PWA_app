// -------------------------
// SERVICE WORKER (PWA)
// -------------------------
const CACHE_NAME = 'hello-pwa-v198.0';  // обнови версию при деплое
const SW_VERSION = '2026-02-09_v198';
console.log('[SW] BUILD VERSION:', SW_VERSION);

const APP_SHELL = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// -------------------------
// INSTALL
// -------------------------
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .catch(err => {
                console.error('[SW] Ошибка кэширования:', err);
                self.clients.matchAll().then(clients =>
                    clients.forEach(client =>
                        client.postMessage({ type: 'CACHE_ERROR', error: err.message })
                    )
                );
            })
    );
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
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // Навигация / index.html — network-first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(resp => {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return resp;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Остальные файлы — cache-first
    event.respondWith(
        caches.match(event.request)
            .then(resp => resp || fetch(event.request).then(resp2 => {
                if (resp2 && resp2.status === 200) {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp2.clone()));
                }
                return resp2;
            }).catch(() => new Response('Offline', { status: 408, headers: {'Content-Type':'text/plain'} })))
    );
});
