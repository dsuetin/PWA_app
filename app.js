// ------------------------------------
// PWA УСТАНОВКА
// ------------------------------------
let deferredPrompt = null;
let model = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA можно установить!');
});

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log('User choice:', choice.outcome);
        deferredPrompt = null;
    }
}

// ------------------------------------
// ЗАГРУЗКА МОДЕЛИ (MobileNet)
// ------------------------------------
async function loadModel() {
    if (!model) {
        console.log('Загрузка модели...');
        try {
            model = await mobilenet.load({
                version: 1,
                alpha: 0.25,
                modelUrl: '/model/model.json'  // путь от корня
            });
            console.log('Модель загружена!');
        } catch (err) {
            console.error('Ошибка загрузки модели:', err);
        }
    }
    return model;
}

// ------------------------------------
// ПРЕДПРОСМОТР ИЗОБРАЖЕНИЯ
// ------------------------------------
const input = document.getElementById('imageInput');
const preview = document.getElementById('preview');

input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
    }
});

// ------------------------------------
// РАСПОЗНАВАНИЕ
// ------------------------------------
document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (!preview.src) {
        return alert('Выберите изображение!');
    }

    const model = await loadModel();
    const predictions = await model.classify(preview);

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = predictions
        .map(p => `${p.className}: ${(p.probability * 100).toFixed(2)}%`)
        .join('<br>');
});

// ------------------------------------
// ПРОВЕРКА КЭША МОДЕЛИ
// ------------------------------------
async function checkModelCache() {
    const cacheName = 'hello-pwa-v8.0';

    if (!('caches' in window)) return;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    console.log('Всего файлов в кэше:', keys.length);
    keys.forEach(req => {
        if (req.url.includes('/model/')) {
            console.log('Модель оффлайн:', req.url);
        }
    });
}

window.addEventListener('load', () => {
    console.log('PWA загружено!');
    checkModelCache();
});

// ------------------------------------
// ПОЛУЧЕНИЕ СООБЩЕНИЙ ИЗ SW
// ------------------------------------
if ('serviceWorker' in navigator) {

    // регистрация SW
    navigator.serviceWorker.register('/sw.js')
        .then(reg => {
            console.log('SW зарегистрирован:', reg.scope);
        })
        .catch(err => console.error('Ошибка регистрации SW:', err));

    // сообщения от SW
    navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data;
        if (!data) return;

        switch (data.type) {
            case 'SW_VERSION':
                console.log('=== SERVICE WORKER VERSION ===');
                console.log(data.version);
                console.log('===============================');
                break;

            case 'NEW_VERSION':
                console.log('Новая версия PWA доступна! Обновляем...');
                setTimeout(() => window.location.reload(), 500);
                break;

            case 'CACHE_ERROR':
                console.error('Ошибка кэширования в SW:', data.error);
                break;

            default:
                console.warn('Неизвестное сообщение от SW:', data);
        }
    });
}
