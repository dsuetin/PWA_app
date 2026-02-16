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



document.getElementById("modeZoom")?.addEventListener("click", () => {
    floorEditor.navigationMode = "zoom";
    setResultText("Режим: Zoom (2 пальца)");
});

document.getElementById("modePan")?.addEventListener("click", () => {
    floorEditor.navigationMode = "pan";
    setResultText("Режим: Pan (2 пальца)");
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
document.getElementById("estimateBtn")?.addEventListener("click", exportEstimate);

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
    const fileNameDefault = `geometry_${dateStr}_${timeStr}.csv`;

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

async function exportEstimate() {
    const contour = floorEditor.linesManager.closedContour;
    if (!contour) {
        alert("Контур не замкнут");
        return;
    }
    const corners = countContourCorners(contour);

    if (!contour || contour.length < 3) {
        alert("Контур не замкнут — смета недоступна");
        return;
    }

    // -----------------------
    // ПЕРИМЕТР
    // -----------------------
    let perimeter = 0;

    for (let i = 0; i < contour.length - 1; i++) {
        const a = contour[i];
        const b = contour[i + 1];
        perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }

    perimeter = Math.round(perimeter) / 100; // в метрах (если 1 единица = 1 см)

    // -----------------------
    // ПОЛОТНО (bounding box)
    // -----------------------
    const xs = contour.map(p => p.x);
    const ys = contour.map(p => p.y);

    const width = (Math.max(...xs) - Math.min(...xs)) / 100; // в метрах (если 1 единица = 1 см)
    const height = (Math.max(...ys) - Math.min(...ys)) / 100; // в метрах (если 1 единица = 1 см)

    const canvasArea = Math.round(width * height);

    // -----------------------
    // CSV структура
    // -----------------------
    const sep = ",";
    const headers = ["Материал", "Пластик", "Алюминий"];
    let dubel_plastic = 7 * perimeter + 2 + 5; // 7 дюбелей на погонный метр + 2 на край + 5 запасных
    let dubel_aluminum = 6 * perimeter + 2 + 5; // 6 дюбелей на погонный метр + 2 на край + 5 запасных
    let lenta_maskirovochnaya = perimeter; // 1 метр ленты на погонный метр
    let corners_total = corners.outer + corners.inner; // внешние + внутренние углы
    let krepezh_corners = 4 * corners_total + 3; // 4 дюбеля на угол + 3 запасных
    let krepezh_for_lights = 2 * lightsDrawer.lights.length + 3; // 2 дюбеля на светильник + 3 запасных
    let zakladnye = lightsDrawer.lights.length; // 1 закладная на светильник
    let podvesy = lightsDrawer.lights.length; // 1 подвес на светильник
    // let provod = 2 * perimeter; // 2 метра провода на погонный метр
    let dubel_homut = lightsDrawer.lights.length + 2; // 1 дюбель-хомут на светильник + 2 запасных
    // let klemnik_vago = lightsDrawer.lights.length;
    let klemnik_sizo = 2 * lightsDrawer.lights.length; // 2 клемника Сизо на светильник (фаза и ноль)
    const rows = [
        ["Профиль", perimeter, perimeter],
        ["Крепёж для профиля(дюбеля)", dubel_plastic, dubel_aluminum],
        ["Лента маскировочная", lenta_maskirovochnaya, ""],
        ["Полотно", canvasArea, canvasArea],
        ["Угол наружный", "", corners.outer],
        ["Угол внутренний", "", corners.inner],
        ["Крепёж для углов (дюбеля)", "", krepezh_corners],
        ["Светильники", lightsDrawer.lights.length, lightsDrawer.lights.length],
        ["Крепёж для светильников (дюбеля)", krepezh_for_lights, krepezh_for_lights],
        ["Закладные", zakladnye, zakladnye],
        ["Подвесы", podvesy, podvesy],
        ["Провод", "", ""],
        ["Дюбель хомут для провода", dubel_homut, dubel_homut],
        ["Клемник Ваго", "", ""],
        ["Клемник Сизо", dubel_homut, dubel_homut]
    ];

    const csv = [
        headers.join(sep),
        ...rows.map(r => r.join(sep))
    ].join("\n");
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
    // const blob = new Blob([csv], { type: "text/csv" });

    // -----------------------
    // Имя файла с датой
    // -----------------------

    const now = new Date();
    const date =
        now.toISOString().slice(0,10).replace(/-/g,"") +
        "_" +
        now.toTimeString().slice(0,8).replace(/:/g,"");

    const suggested = `estimate_${date}.csv`;

    // File picker если доступен
    if ("showSaveFilePicker" in window) {
        try {
            const handle = await showSaveFilePicker({
                suggestedName: suggested,
                types: [{ description:"CSV", accept:{ "text/csv":[".csv"] }}]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch(e){}
    }

    // fallback
    const name = prompt("Имя файла:", suggested);
    if (!name) return;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name.endsWith(".csv") ? name : name + ".csv";
    a.click();
}

function countContourCorners(points) {
    let outer = 0;
    let inner = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const prev = points[(i - 1 + points.length - 1) % (points.length - 1)];
        const curr = points[i];
        const next = points[(i + 1) % (points.length - 1)];

        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;

        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;

        const cross = v1x * v2y - v1y * v2x;

        if (cross < 0) outer++;
        else if (cross > 0) inner++;
    }

    return { outer, inner };
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
    navigator.serviceWorker.register("./sw.js")
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

