// ------------------------------------
// PWA УСТАНОВКА
// ------------------------------------
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("PWA можно установить!");
});

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log("User choice:", choice.outcome);
        deferredPrompt = null;
    }
}

const installBtn = document.getElementById("installBtn");
if (installBtn) {
    installBtn.addEventListener("click", installPWA);
}

// ------------------------------------
// РЕЖИМ РИСОВАНИЯ ПЛАНА ПОМЕЩЕНИЙ
// ------------------------------------
import { FloorPlanEditor } from "./floorplan.js";

let floorEditor = null;

window.addEventListener("load", () => {
    floorEditor = new FloorPlanEditor("canvas");
});

// Включение режима рисования
document.getElementById("floorBtn")?.addEventListener("click", () => {
    floorEditor = new FloorPlanEditor("canvas");
    document.getElementById("result").innerHTML = "<b>Режим: Рисование плана помещений</b>";
});

// Добавим возможность задавать длину линии
document.getElementById("lineLength")?.addEventListener("change", (e) => {
    const len = parseInt(e.target.value);
    if (floorEditor) floorEditor.setLineLength(len);
});
// ------------------------------------
// ПРОВЕРКА КЭША PWA
// ------------------------------------
async function checkModelCache() {
    const cacheName = "hello-pwa-v56.0";
    if (!("caches" in window)) return;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    console.log("Всего файлов в кэше:", keys.length);
}

window.addEventListener("load", () => {
    checkModelCache();
});

// ------------------------------------
// СООБЩЕНИЯ ОТ SERVICE WORKER
// ------------------------------------
if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW зарегистрирован:", reg.scope))
        .catch((err) => console.error("Ошибка регистрации SW:", err));

    navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event.data;
        if (!data) return;

        switch (data.type) {
            case "SW_VERSION":
                console.log("=== SERVICE WORKER VERSION ===");
                console.log(data.version);
                break;
            case "NEW_VERSION":
                console.log("Новая версия PWA доступна! Обновляем...");
                setTimeout(() => window.location.reload(), 500);
                break;
            case "CACHE_ERROR":
                console.error("Ошибка кэширования в SW:", data.error);
                break;
            default:
                console.warn("Неизвестное сообщение от SW:", data);
        }
    });
}
