// -------------------------
//  SERVICE WORKER
//  Автообновление + оффлайн
// -------------------------

const CACHE_NAME = 'hello-pwa-v7.0'; // меняй при каждом обновлении
console.log("SW BUILD: 2025-12-01_v7");

// -------------------------
// Основные файлы приложения
// -------------------------
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
// Все файлы модели
// -------------------------
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

// -------------------------
// Итоговый список кэшируемых файлов
// -------------------------
const urlsToCache = [...APP_SHELL, ...MODEL_FILES];

// -------------------------
// Установка SW
// -------------------------
self.addEventListener('install', event => {
    console.log('[SW] Установка...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error('[SW] Ошибка при кэшировании:', err))
    );

    self.skipWaiting(); // активируем сразу
});

// -------------------------
// Активация SW
// -------------------------
self.addEventListener('activate', event => {
    console.log('[SW] Активация...');

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Удаляем старый кэш:', key);
                        return caches.delete(key);
                    }
                })
            )
        )
    );

    self.clients.claim();

    // Сообщаем вкладкам о новой версии
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'NEW_VERSION' });
        });
    });
});

// -------------------------
// Перехват fetch запросов
// -------------------------
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cacheResponse => {
            if (cacheResponse) return cacheResponse;

            return fetch(event.request)
                .then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200) return networkResponse;

                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));

                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', {
                        status: 408,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
        })
    );
});
