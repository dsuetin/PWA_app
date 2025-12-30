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

document.getElementById("installBtn")?.addEventListener("click", installPWA);

// ------------------------------------
// ИМПОРТЫ
// ------------------------------------
import { FloorPlanEditor } from "./floorplan.js";
import { LightsDrawer } from "./lights.js";

// ------------------------------------
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ------------------------------------
let floorEditor;
let lightsDrawer;
let currentMode = "lines"; // "lines" | "lights"

// ------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    floorEditor = new FloorPlanEditor("canvas");
    lightsDrawer = new LightsDrawer("canvas");

    // Передаем ссылку на LightsDrawer в FloorPlanEditor
    floorEditor.setLightsDrawer(lightsDrawer);

    // режим по умолчанию — линии
    setMode("lines");

    // Переключение режимов
    document.getElementById("modeLines")?.addEventListener("click", () => setMode("lines"));
    document.getElementById("modeLights")?.addEventListener("click", () => setMode("lights"));

    // Изменение сетки
    document.getElementById("gridSizeInput")?.addEventListener("change", (e) => {
        const size = parseInt(e.target.value);
        if (!isNaN(size) && floorEditor) {
            floorEditor.setGridSize(size);
            redrawAll();
        }
    });

    // Undo
    document.getElementById("undoBtn")?.addEventListener("click", () => {
        if (currentMode === "lines" && floorEditor) {
            floorEditor.undo();
        } else if (currentMode === "lights" && lightsDrawer) {
            lightsDrawer.undo();
        }
        redrawAll();
    });

    // Resize — перерисовка всего
    window.addEventListener("resize", () => {
        floorEditor.resizeCanvas();
        redrawAll();
    });
});

// ------------------------------------
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ
// ------------------------------------
function setMode(mode) {
    currentMode = mode;

    if (mode === "lines") {
        floorEditor.enable();
        lightsDrawer.disable();
        setResultText("Режим: Линии");
    }

    if (mode === "lights") {
        floorEditor.disable();
        lightsDrawer.enable();
        setResultText("Режим: Свет");
    }

    redrawAll(); // всегда рисуем линии + все круги
}

// ------------------------------------
// ПЕРЕРИСОВКА ВСЕГО
// ------------------------------------
function redrawAll() {
    floorEditor.draw();      // линии и сетка
    lightsDrawer.redraw();   // все круги поверх линий
}

function setResultText(text) {
    const el = document.getElementById("result");
    if (el) el.innerHTML = `<b>${text}</b>`;
}

// ------------------------------------
// ПРОВЕРКА КЭША PWA
// ------------------------------------
async function checkModelCache() {
    const cacheName = "hello-pwa-v14.0";
    if (!("caches" in window)) return;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    console.log("Всего файлов в кэше:", keys.length);
}

window.addEventListener("load", checkModelCache);

// ------------------------------------
// SERVICE WORKER
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
