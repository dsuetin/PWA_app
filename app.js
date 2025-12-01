// -------------------------
//   PWA УСТАНОВКА
// -------------------------

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

// -------------------------
//   ЗАГРУЗКА МОДЕЛИ
// -------------------------

async function loadModel() {
    if (!model) {
        console.log('Загрузка модели...');
        try {
            model = await mobilenet.load({
                version: 1,
                alpha: 0.25,
                modelUrl: '/model/model.json' // абсолютный путь
            });
            console.log('Модель загружена');
        } catch (err) {
            console.error('Ошибка при загрузке модели:', err);
        }
    }
}

// -------------------------
//   ПРЕДПРОСМОТР ИЗОБРАЖЕНИЯ
// -------------------------

const input = document.getElementById('imageInput');
const preview = document.getElementById('preview');

input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
    }
});

// -------------------------
//   РАСПОЗНАВАНИЕ
// -------------------------

document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (!preview.src) return alert('Выберите изображение!');
    await loadModel();
    const predictions = await model.classify(preview);

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = predictions
        .map(p => `${p.className}: ${(p.probability * 100).toFixed(2)}%`)
        .join('<br>');
});

// -------------------------
//   ПРОВЕРКА КЭША МОДЕЛИ
// -------------------------

async function checkModelCache() {
    const cacheName = 'hello-pwa-v7.0'; // актуальная версия кэша SW

    if ('caches' in window) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        console.log('Закэшировано файлов:', keys.length);
        keys.forEach(req => {
            if (req.url.includes('/model/')) {
                console.log('Модель оффлайн:', req.url);
            }
        });
    }
}

window.addEventListener('load', () => {
    console.log('PWA загружено!');
    checkModelCache();
});

// -------------------------
//   АВТО-ОБНОВЛЕНИЕ PWA
// -------------------------

if ('serviceWorker' in navigator) {

    // Регистрация SW
    navigator.serviceWorker.register('/sw.js')
        .then(reg => {
            console.log('SW зарегистрирован:', reg.scope);
        })
        .catch(err => {
            console.error('Ошибка регистрации SW:', err);
        });

    // Ловим сигнал от нового SW
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_VERSION') {
            console.log('Новая версия PWA доступна!');

            // Перезагружаем автоматически
            setTimeout(() => {
                console.log('Обновляем страницу...');
                window.location.reload();
            }, 500);
        }
    });
}
