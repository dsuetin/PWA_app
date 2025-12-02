const CACHE_NAME = 'hello-pwa-v15.0';
const SW_VERSION = '2025-12-02_v15';
console.log('SW BUILD (SW context):', SW_VERSION);

// Основные файлы приложения
const APP_SHELL = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Файлы модели
const MODEL_FILES = [
    '/model/model.json',
    '/model/group1-shard1of1',
    '/model/group2-shard1of1',
    '/model/group3-shard1of1',
    '/model/group4-shard1of1',
    '/model/group5-shard1of1',
    '/model/group6-shard1of1',
    '/model/group7-shard1of1',
    '/model/group8-shard1of1',
    '/model/group9-shard1of1',
    '/model/group10-shard1of1',
    '/model/group11-shard1of1',
    '/model/group12-shard1of1',
    '/model/group13-shard1of1',
    '/model/group14-shard1of1',
    '/model/group15-shard1of1',
    '/model/group16-shard1of1',
    '/model/group17-shard1of1',
    '/model/group18-shard1of1',
    '/model/group19-shard1of1',
    '/model/group20-shard1of1',
    '/model/group21-shard1of1',
    '/model/group22-shard1of1',
    '/model/group23-shard1of1',
    '/model/group24-shard1of1',
    '/model/group25-shard1of1',
    '/model/group26-shard1of1',
    '/model/group27-shard1of1',
    '/model/group28-shard1of1',
    '/model/group29-shard1of1',
    '/model/group30-shard1of1',
    '/model/group31-shard1of1',
    '/model/group32-shard1of1',
    '/model/group33-shard1of1',
    '/model/group34-shard1of1',
    '/model/group35-shard1of1',
    '/model/group36-shard1of1',
    '/model/group37-shard1of1',
    '/model/group38-shard1of1',
    '/model/group39-shard1of1',
    '/model/group40-shard1of1',
    '/model/group41-shard1of1',
    '/model/group42-shard1of1',
    '/model/group43-shard1of1',
    '/model/group44-shard1of1',
    '/model/group45-shard1of1',
    '/model/group46-shard1of1',
    '/model/group47-shard1of1',
    '/model/group48-shard1of1',
    '/model/group49-shard1of1',
    '/model/group50-shard1of1',
    '/model/group51-shard1of1',
    '/model/group52-shard1of1',
    '/model/group53-shard1of1',
    '/model/group54-shard1of1',
    '/model/group55-shard1of1'
];

const urlsToCache = [...APP_SHELL, ...MODEL_FILES];

// -------------------------
// INSTALL
// -------------------------
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => {
                console.error('[SW] Ошибка кэширования:', err);
                // отправляем ошибку на страницу
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'CACHE_ERROR', error: err.message });
                    });
                });
            })
    );
});

// -------------------------
// ACTIVATE
// -------------------------
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
            )
        )
    );

    self.clients.claim();

    // Отправляем версию SW и уведомление о новой версии на страницу
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
            client.postMessage({ type: 'NEW_VERSION' });
        });
    });
});

// -------------------------
// FETCH
// -------------------------
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request)
            .then(cacheResponse => cacheResponse || fetch(event.request).then(resp => {
                if (!resp || resp.status !== 200) return resp;
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return resp;
            }).catch(() => event.request.destination === 'document' ? caches.match('/index.html') : new Response('Offline', { status: 408, headers: {'Content-Type':'text/plain'} })))
    );
});
