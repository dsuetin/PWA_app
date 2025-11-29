let deferredPrompt = null;

function showMessage() {
    alert('Привет! Это работает! 🚀');
}

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
    } else {
        alert("Приложение уже установлено или ещё не готово для установки.");
    }
}

async function checkCache() {
    if ('caches' in window) {
        const cache = await caches.open('hello-pwa-v3');
        const keys = await cache.keys();
        console.log('Закэшировано файлов:', keys.length);
    }
}

window.addEventListener('load', () => {
    checkCache();
});
