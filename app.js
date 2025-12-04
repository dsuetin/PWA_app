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
    const cacheName = 'hello-pwa-v30.0';
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

async function detectColoredLines() {
    const resultDiv = document.getElementById("result");

    if (canvas.width === 0) {
        alert("Сначала загрузите изображение");
        return;
    }
    if (typeof cv === "undefined") {
        alert("OpenCV не загружен");
        return;
    }

    const src = cv.imread(canvas);

    // --- HSV ---
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);

    // Маска насыщенных пикселей (цветных)
    let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 60, 40, 0]);
    let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);
    const mask = new cv.Mat();
    cv.inRange(hsv, low, high, mask);
    low.delete(); high.delete();

    // Морфология — соединяем разрывы
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);

    // Находим контуры
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);

    if (contours.size() === 0) {
        resultDiv.innerHTML = "<b>Цветные линии не найдены</b>";
        src.delete(); hsv.delete(); mask.delete(); kernel.delete();
        contours.delete(); hierarchy.delete();
        return;
    }

    let out = "<b>Найденные линии:</b><br><br>";

    // --- Обрабатываем каждый цветной сегмент ---
    for (let i = 0; i < contours.size(); i++) {

        let cnt = contours.get(i);

        // Подгоняем прямую под контур
        let lineData = new cv.Mat();
        cv.fitLine(cnt, lineData, cv.DIST_L2, 0, 0.01, 0.01);

        let vx = lineData.floatAt(0, 0);
        let vy = lineData.floatAt(1, 0);
        let x0 = lineData.floatAt(2, 0);
        let y0 = lineData.floatAt(3, 0);

        // Собираем все точки контура
        let pts = [];
        for (let j = 0; j < cnt.rows; j++) {
            let p = cnt.intPtr(j);
            pts.push({ x: p[0], y: p[1] });
        }

        // --- Находим минимальную и максимальную проекции (dot product) ---
        let tMin = Infinity;
        let tMax = -Infinity;

        for (let p of pts) {
            let t = (p.x - x0) * vx + (p.y - y0) * vy;
            if (t < tMin) tMin = t;
            if (t > tMax) tMax = t;
        }

        // Получаем реальные координаты ограниченного отрезка
        let x1 = x0 + vx * tMin;
        let y1 = y0 + vy * tMin;
        let x2 = x0 + vx * tMax;
        let y2 = y0 + vy * tMax;

        // Рисуем на исходном canvas
        cv.line(src,
                new cv.Point(x1, y1),
                new cv.Point(x2, y2),
                [0, 255, 0, 255],
                12);

        let length = Math.hypot(x2 - x1, y2 - y1);

        out += `Линия ${i + 1}:<br>
                (${x1.toFixed(0)}, ${y1.toFixed(0)}) →
                (${x2.toFixed(0)}, ${y2.toFixed(0)})<br>
                Длина: ${length.toFixed(1)} px<br><br>`;

        lineData.delete();
    }

    // Показываем результат на исходном canvas
    cv.imshow(canvas, src);

    resultDiv.innerHTML = out;

    // Чистим память
    src.delete(); hsv.delete(); mask.delete(); kernel.delete();
    contours.delete(); hierarchy.delete();
}


window.detectColoredLines = detectColoredLines;


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

    // Черные объекты: инвертируем порог
    const thresh = new cv.Mat();
    cv.threshold(gray, thresh, 50, 255, cv.THRESH_BINARY_INV);

    // Морфология для шумов
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
        circles.map((c, i) => `Круг ${i+1}: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}), радиус=${c.radius.toFixed(1)} px`).join('<br>');

    src.delete(); gray.delete(); thresh.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

    return circles;
}

// Экспортируем для использования в HTML
window.findBlackCircles = findBlackCircles;
