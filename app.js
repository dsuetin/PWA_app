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
installBtn?.addEventListener("click", installPWA);

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
document.getElementById("undoBtn")?.addEventListener("click", () => floorEditor.undo());

// ------------------------------------
// ЭКСПОРТ / ИМПОРТ CSV
// ------------------------------------
document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
document.getElementById("importBtn")?.addEventListener("click", () => {
    document.getElementById("importInput").click();
});
document.getElementById("importInput")?.addEventListener("change", importCSV);

// ---------- ЭКСПОРТ CSV с датой и фильтром света ----------
// ---------- ЭКСПОРТ CSV с датой и фильтром света и prompt ----------
async function exportCSV() {
    const contour = floorEditor.linesManager.closedContour;
    if (!contour || contour.length < 2) {
        alert("Контур не замкнут — экспорт невозможен");
        return;
    }

    const lights = lightsDrawer.lights;

    // Фильтруем светильники — только внутри контура
    const isPointInPolygon = (x, y, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > y) !== (yj > y)) &&
                              (x < (xj - xi) * (y - yi) / (yj - yi + 1e-10) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const filteredLights = lights.filter(l => isPointInPolygon(l.x1, l.y1, contour));

    // CSV строки
    const rows = ["type,x1,y1,x2,y2"];

    for (let i = 0; i < contour.length; i++) {
        const a = contour[i];
        const b = contour[(i + 1) % contour.length]; // последняя точка соединяется с первой
        if (!a || !b) continue; // безопасная проверка
        rows.push(`contour,${a.x},${a.y},${b.x},${b.y}`);
    }
    for (const l of filteredLights) {
        rows.push(`light,${l.x1},${l.y1},,`);
    }

    const csvBlob = new Blob([rows.join("\n")], { type: "text/csv" });

    // Генерация дефолтного имени с датой
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
    const timeStr = now.toTimeString().slice(0,8).replace(/:/g,''); // HHMMSS
    const fileNameDefault = `floorplan_${dateStr}_${timeStr}.csv`;

    // --- File System API (Chrome/Edge/Android) ---
    if ('showSaveFilePicker' in window) {
        try {
            const opts = {
                suggestedName: fileNameDefault,
                types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }]
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(csvBlob);
            await writable.close();
            return;
        } catch (e) {
            console.warn("File System API отменено или не поддерживается:", e);
        }
    }

    // --- fallback: prompt + обычный download ---
    const fileName = prompt("Введите имя файла для экспорта:", fileNameDefault);
    if (!fileName) return; // пользователь отменил
    const finalName = fileName.endsWith(".csv") ? fileName : fileName + ".csv";

    const a = document.createElement("a");
    a.href = URL.createObjectURL(csvBlob);
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(a.href);
}


// ---------- ИМПОРТ CSV ----------
async function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.trim().split("\n").slice(1);

    const lines = [];
    const lights = [];

    for (const r of rows) {
        const [type, x1, y1, x2, y2] = r.split(",");
        if (type === "contour") {
            lines.push({ x1: +x1, y1: +y1, x2: +x2, y2: +y2 });
        } else if (type === "light") {
            lights.push({ x1: +x1, y1: +y1 });
        }
    }

    floorEditor.linesManager.importData(lines);
    lightsDrawer.importData(lights);

    redrawAll();
    e.target.value = ""; // сброс input для повторного импорта
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
}

function setResultText(text) {
    const el = document.getElementById("result");
    if (el) el.innerHTML = `<b>${text}</b>`;
}

// ------------------------------------
// SERVICE WORKER + ОБНОВЛЕНИЯ
// ------------------------------------
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then(reg => console.log("SW зарегистрирован:", reg.scope))
        .catch(err => console.error("Ошибка регистрации SW:", err));

    navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event.data;
        if (!data) return;

        switch (data.type) {
            case "SW_VERSION":
                console.log("=== SERVICE WORKER VERSION ===", data.version);
                break;
            case "CACHE_ERROR":
                console.error("Ошибка кэширования в SW:", data.error);
                break;
            default:
                console.warn("Неизвестное сообщение от SW:", data);
        }
    });
}

