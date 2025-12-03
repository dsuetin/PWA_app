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
    const cacheName = 'hello-pwa-v22.0';
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

// -------------------------
//  OPENCV: RED LINE DETECTION (IMPROVED)
// -------------------------
async function detectRedLine() {

    if (canvas.width === 0 || canvas.height === 0) {
        alert("Сначала загрузите изображение");
        return;
    }

    if (typeof cv === "undefined") {
        alert("OpenCV ещё не загрузился!");
        return;
    }

    const src = cv.imread(canvas);
    const hsv = new cv.Mat();

    cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);

    // Красный диапазон
    let low1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 120, 50, 0]);
    let high1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 255, 255, 255]);
    let mask1 = new cv.Mat();
    cv.inRange(hsv, low1, high1, mask1);

    let low2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [170, 120, 50, 0]);
    let high2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);
    let mask2 = new cv.Mat();
    cv.inRange(hsv, low2, high2, mask2);

    const mask = new cv.Mat();
    cv.add(mask1, mask2, mask);

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() === 0) {
        resultDiv.innerHTML = "<b>Красная линия не найдена.</b>";
        return;
    }

    let output = "<b>Найдены красные линии:</b><br><br>";

    let dst = src.clone();

    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let rect = cv.minAreaRect(contour);
        let size = rect.size;

        let thickness = Math.min(size.width, size.height);

        let linePoints = new cv.Mat();
        cv.fitLine(contour, linePoints, cv.DIST_L2, 0, 0.01, 0.01);

        let vx = linePoints.floatAt(0, 0);
        let vy = linePoints.floatAt(1, 0);
        let x0 = linePoints.floatAt(2, 0);
        let y0 = linePoints.floatAt(3, 0);

        let x1 = x0 - vx * 1000;
        let y1 = y0 - vy * 1000;
        let x2 = x0 + vx * 1000;
        let y2 = y0 + vy * 1000;

        cv.line(dst, new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Scalar(0, 255, 0, 255), 2);

        let length = cv.arcLength(contour, false);

        output += `Линия ${i + 1}:<br>`;
        output += `Толщина: <b>${thickness.toFixed(1)} px</b><br>`;
        output += `Длина: <b>${length.toFixed(1)} px</b><br><br>`;
    }

    cv.imshow("processedCanvas", dst);
    resultDiv.innerHTML = output;

    src.delete(); hsv.delete();
    low1.delete(); high1.delete();
    low2.delete(); high2.delete();
    mask.delete(); mask1.delete(); mask2.delete();
    kernel.delete();
    contours.delete(); hierarchy.delete();
}

window.detectRedLine = detectRedLine;
