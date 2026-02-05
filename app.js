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
// РЕЖИМ РИСОВАНИЯ
// ------------------------------------
import { FloorPlanEditor } from "./floorplan.js";
import { LightsDrawer } from "./lights.js";

let floorEditor = null;
let lightsDrawer = null;
let currentMode = "lines"; // lines | lights

window.addEventListener("load", () => {
    floorEditor = new FloorPlanEditor("canvas");
    lightsDrawer = new LightsDrawer("canvas");

    // связываем редакторы
    floorEditor.setLightsDrawer(lightsDrawer);
    lightsDrawer.setEditor(floorEditor);

    setMode("lines");
});

// ------------------------------------
// СЕТКА
// ------------------------------------
const gridInput = document.getElementById("gridSizeInput");
gridInput?.addEventListener("change", (e) => {
    const size = parseInt(e.target.value);
    if (!isNaN(size) && floorEditor) {
        floorEditor.setGridSize(size);
        redrawAll();
    }
});

// ------------------------------------
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ
// ------------------------------------
document.getElementById("modeLines")?.addEventListener("click", () => setMode("lines"));
document.getElementById("modeLights")?.addEventListener("click", () => setMode("lights"));

function setMode(mode) {
    currentMode = mode;

    if (mode === "lines") {
        floorEditor.enable();
        lightsDrawer.disable();
        setResultText("Режим: Линии");
    } else if (mode === "lights") {
        floorEditor.disable();
        lightsDrawer.enable();
        setResultText("Режим: Свет");
    }

    redrawAll();
}

// ------------------------------------
// UNDO
// ------------------------------------
document.getElementById("undoBtn")?.addEventListener("click", () => {
    if (!floorEditor || !lightsDrawer) return;

    if (currentMode === "lines") floorEditor.undo();
    else if (currentMode === "lights") lightsDrawer.undo();

    if (floorEditor.linesManager.closedContour) {
        floorEditor.contourLocked = false;
    }

    redrawAll();
});

// ------------------------------------
// ЭКСПОРТ / ИМПОРТ CSV
// ------------------------------------
document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
document.getElementById("importBtn")?.addEventListener("click", () => {
    document.getElementById("importInput").click();
});
document.getElementById("importInput")?.addEventListener("change", importCSV);


function exportCSV() {
    const contour = floorEditor.linesManager.closedContour;

    if (!contour) {
        alert("Контур не замкнут");
        return;
    }

    const pts = floorEditor.linesManager._linesToPolygonPoints(contour);

    const rows = [
        "x,y",
        ...pts.map(p => `${p.x},${p.y}`)
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contour.csv";
    a.click();
}


async function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.trim().split("\n").slice(1);

    const lines = [];
    const lights = [];

    for (const r of rows) {
        const [type, x1, y1, x2, y2] = r.split(",");

        if (type === "line") {
            lines.push({ x1: +x1, y1: +y1, x2: +x2, y2: +y2 });
        } else if (type === "light") {
            lights.push({ x1: +x1, y1: +y1 });
        }
    }

    floorEditor.importData(lines);
    lightsDrawer.importData(lights);

    redrawAll();
    e.target.value = "";
}

// ------------------------------------
// RESIZE
// ------------------------------------
window.addEventListener("resize", () => {
    if (!floorEditor) return;
    floorEditor.resizeCanvas();
    redrawAll();
});

// ------------------------------------
// ОБЩАЯ ПЕРЕРИСОВКА
// ------------------------------------
window.redrawAll = function redrawAll() {
    if (!floorEditor || !lightsDrawer) return;
    floorEditor.draw();
    // lightsDrawer.drawWithOffset(floorEditor.offsetX, floorEditor.offsetY);
}

function setResultText(text) {
    const el = document.getElementById("result");
    if (el) el.innerHTML = `<b>${text}</b>`;
}

// ------------------------------------
// ПРОВЕРКА КЭША PWA
// ------------------------------------
async function checkModelCache() {
    const cacheName = "hello-pwa-v185.0";
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
