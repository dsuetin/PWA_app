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
            model = await tf.loadLayersModel('/model/model.json');
            console.log('Модель загружена!');
        } catch (err) {
            console.error('Ошибка загрузки модели:', err);
        }
    }
    return model;
}

// ------------------------------------
// ЗАГРУЗКА ИЗОБРАЖЕНИЯ НА CANVAS
// ------------------------------------
const input = document.getElementById('imageInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');

input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = URL.createObjectURL(file);
});

// ------------------------------------
// РАСПОЗНАВАНИЕ ОБЪЕКТОВ
// ------------------------------------
import imagenetClasses from './imagenet_classes.js';
import { detectColoredLines } from './lines.js';

document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (canvas.width === 0 || canvas.height === 0) {
        alert('Выберите изображение!');
        return;
    }

    const model = await loadModel();
    if (!model) {
        alert('Модель не загружена');
        return;
    }

    const imgTensor = tf.browser.fromPixels(canvas)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .div(tf.scalar(127.5))
        .sub(tf.scalar(1))
        .expandDims();

    const predictions = model.predict(imgTensor);
    const data = predictions.dataSync();

    const top5 = Array.from(data)
        .map((prob, idx) => ({ probability: prob, classIndex: idx }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);

    resultDiv.innerHTML = top5
        .map(p => `${imagenetClasses[p.classIndex]}: ${(p.probability * 100).toFixed(2)}%`)
        .join('<br>');
});

// ------------------------------------
// ОБРАБОТКА КНОПОК: ЛИНИИ И КРУГИ
// ------------------------------------
document.getElementById('detectLinesBtn').addEventListener('click', async () => {
    const colorRange = { hMin: 0, hMax: 180, sMin: 60, sMax: 255, vMin: 40, vMax: 255 };
    const lines = await detectColoredLines(colorRange);
    console.log("Найденные линии:", lines);
});

document.getElementById('findCirclesBtn').addEventListener('click', async () => {
    const circles = await findBlackCircles();
    console.log("Найденные черные круги:", circles);
});

// ------------------------------------
// ПРОВЕРКА КЭША МОДЕЛИ
// ------------------------------------
async function checkModelCache() {
    const cacheName = 'hello-pwa-v43.0';
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
// СООБЩЕНИЯ ОТ SW
// ------------------------------------
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW зарегистрирован:', reg.scope))
        .catch(err => console.error('Ошибка регистрации SW:', err));

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (!data) return;

        switch (data.type) {
            case 'SW_VERSION':
                console.log('=== SERVICE WORKER VERSION ===');
                console.log(data.version);
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

// ------------------------------------
// ФУНКЦИЯ: НАЙТИ ЧЕРНЫЕ КРУГИ
// ------------------------------------
async function findBlackCircles() {
    if (canvas.width === 0) {
        alert("Сначала загрузите изображение");
        return [];
    }

    if (typeof cv === "undefined") {
        alert("OpenCV не загружен");
        return [];
    }

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const thresh = new cv.Mat();
    cv.threshold(gray, thresh, 50, 255, cv.THRESH_BINARY_INV);

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const circles = [];

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const circle = cv.minEnclosingCircle(cnt);
        if (circle.radius > 2) {
            circles.push({ x: circle.center.x, y: circle.center.y, radius: circle.radius });
            cv.circle(src, new cv.Point(circle.center.x, circle.center.y), circle.radius, [0, 0, 255, 255], 2);
        }
        cnt.delete();
    }

    cv.imshow(canvas, src);

    resultDiv.innerHTML += `<hr><b>Черные круги:</b><br>` +
        circles.map((c, i) =>
            `Круг ${i + 1}: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}), радиус=${c.radius.toFixed(1)} px`
        ).join('<br>');

    src.delete(); gray.delete(); thresh.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

    return circles;
}

window.findBlackCircles = findBlackCircles;
