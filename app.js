// import * as tf from '@tensorflow/tfjs';
import IMAGENET_CLASSES from './imagenet_classes.js';

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

// Привязываем установку к кнопке с id="installBtn"
const installBtn = document.getElementById('installBtn');
if (installBtn) {
    installBtn.addEventListener('click', installPWA);
}

// ------------------------------------
// ЗАГРУЗКА МОДЕЛИ (MobileNet)
// ------------------------------------
async function loadModel() {
    if (!model) {
        console.log('Загрузка модели...');
        try {
            model = await tf.loadLayersModel('/model/model.json'); // локальная модель
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

input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
    }
});

// ------------------------------------
// РАСПОЗНАВАНИЕ С ИМЕНАМИ КЛАССОВ
// ------------------------------------
document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (!preview.src) return alert('Выберите изображение!');

    const model = await loadModel();
    if (!model) return alert('Модель не загружена');

    // Создаем тензор из изображения
    const img = tf.browser.fromPixels(preview)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .div(tf.scalar(127.5))
        .sub(tf.scalar(1))
        .expandDims(); // [1, 224, 224, 3]

    // Предсказание
    const predictions = model.predict(img);
    const data = predictions.dataSync();

    // Топ-5 предсказаний
    const top5 = Array.from(data)
        .map((prob, idx) => ({ probability: prob, classIndex: idx }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);

    // Вывод с использованием имен из IMAGENET_CLASSES
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = top5
        .map(p => {
            const className = IMAGENET_CLASSES[p.classIndex] || `Class ${p.classIndex}`;
            return `${className}(${p.classIndex}): ${(p.probability * 100).toFixed(2)}%`;
        })
        .join('<br>');
});

// ------------------------------------
// ПРОВЕРКА КЭША МОДЕЛИ
// ------------------------------------
async function checkModelCache() {
    const cacheName = 'hello-pwa-v13.0';

    if (!('caches' in window)) return;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    console.log('Всего файлов в кэше:', keys.length);
    keys.forEach((req) => {
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
        .then((reg) => {
            console.log('SW зарегистрирован:', reg.scope);
        })
        .catch((err) => console.error('Ошибка регистрации SW:', err));

    // сообщения от SW
    navigator.serviceWorker.addEventListener('message', (event) => {
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
