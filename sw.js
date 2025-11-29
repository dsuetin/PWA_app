const CACHE_NAME = 'hello-pwa-ml-v1';
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'model/model.json',
    'model/group1-shard1of1.bin',
    'model/group2-shard1of1.bin',
    'model/group3-shard1of1.bin',
    'model/group4-shard1of1.bin',
    'model/group5-shard1of1.bin',
    'model/group6-shard1of1.bin',
    'model/group7-shard1of1.bin',
    'model/group8-shard1of1.bin',
    'model/group9-shard1of1.bin',
    'model/group10-shard1of1.bin',
    'model/group11-shard1of1.bin',
    'model/group12-shard1of1.bin',
    'model/group13-shard1of1.bin',
    'model/group14-shard1of1.bin',
    'model/group15-shard1of1.bin',
    'model/group16-shard1of1.bin',
    'model/group17-shard1of1.bin',
    'model/group18-shard1of1.bin',
    'model/group19-shard1of1.bin',
    'model/group20-shard1of1.bin',
    'model/group21-shard1of1.bin',
    'model/group22-shard1of1.bin',
    'model/group23-shard1of1.bin',
    'model/group24-shard1of1.bin',
    'model/group25-shard1of1.bin',
    'model/group26-shard1of1.bin',
    'model/group27-shard1of1.bin',
    'model/group28-shard1of1.bin',
    'model/group29-shard1of1.bin',
    'model/group30-shard1of1.bin',
    'model/group31-shard1of1.bin',
    'model/group32-shard1of1.bin',
    'model/group33-shard1of1.bin',
    'model/group34-shard1of1.bin',
    'model/group35-shard1of1.bin',
    'model/group36-shard1of1.bin',
    'model/group37-shard1of1.bin',
    'model/group38 -shard1of1.bin',
    'model/group39-shard1of1.bin',
    'model/group40-shard1of1.bin',
    'model/group41-shard1of1.bin',
    'model/group42-shard1of1.bin',
    'model/group43-shard1of1.bin',
    'model/group44-shard1of1.bin',
    'model/group45-shard1of1.bin',
    'model/group46-shard1of1.bin',
    'model/group47-shard1of1.bin',
    'model/group48-shard1of1.bin',
    'model/group49-shard1of1.bin',
    'model/group50-shard1of1.bin',
    'model/group51-shard1of1.bin',
    'model/group52-shard1of1.bin',
    'model/group53-shard1of1.bin',
    'model/group54-shard1of1.bin',
    'model/group55ß-shard1of1.bin'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
        )
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(resp => resp || fetch(event.request).then(networkResp => {
            if (networkResp && networkResp.status === 200) {
                const clone = networkResp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResp;
        }).catch(() => new Response('Оффлайн')))
    );
});
