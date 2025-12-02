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
            model = await tf.loadLayersModel('/model/model.json'); // локальная модель
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

document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (canvas.width === 0 || canvas.height === 0) return alert('Выберите изображение!');

    const model = await loadModel();
    if (!model) return alert('Модель не загружена');

    const imgTensor = tf.browser.fromPixels(canvas)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .div(tf.scalar(127.5))
        .sub(tf.scalar(1))
        .expandDims(); // [1, 224, 224, 3]

    const predictions = model.predict(imgTensor);
    const data = predictions.dataSync();

    // Топ-5 предсказаний
    const top5 = Array.from(data)
        .map((prob, idx) => ({ probability: prob, classIndex: idx }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = top5
        .map(p => `${imagenetClasses[p.classIndex]}: ${(p.probability * 100).toFixed(2)}%`)
        .join('<br>');

    // ------------------------------------
    // ОБНАРУЖЕНИЕ ЛИНИЙ С OPENCV
    // ------------------------------------
    if (cv && canvas.width > 0 && canvas.height > 0) {
        const src = cv.imread(canvas);
        const dst = new cv.Mat();
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        cv.Canny(gray, dst, 50, 150, 3);

        const lines = new cv.Mat();
        cv.HoughLinesP(dst, lines, 1, Math.PI / 180, 50, 50, 10);

        let lineInfo = '';
        for (let i = 0; i < lines.rows; ++i) {
            const [x1, y1, x2, y2] = lines.data32S.slice(i*4, i*4+4);
            const length = Math.hypot(x2 - x1, y2 - y1);
            lineInfo += `Line ${i + 1}: (${x1},${y1}) → (${x2},${y2}), length=${length.toFixed(2)}<br>`;
            cv.line(src, new cv.Point(x1, y1), new cv.Point(x2, y2), [255, 0, 0, 255], 2);
        }

        resultDiv.innerHTML += '<hr><b>Detected lines:</b><br>' + lineInfo;
        cv.imshow(canvas, src);

        src.delete(); dst.delete(); gray.delete(); lines.delete();
    }
});

// ------------------------------------
// ПРОВЕРКА КЭША МОДЕЛИ
// ------------------------------------
async function checkModelCache() {
    const cacheName = 'hello-pwa-v15.0';
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
// СООБЩЕНИЯ ОТ SW
// ------------------------------------
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW зарегистрирован:', reg.scope))
        .catch((err) => console.error('Ошибка регистрации SW:', err));

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
