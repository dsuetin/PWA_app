// floorplan.js
import { LinesManager } from "./lines.js";

export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.linesManager = new LinesManager(10);
        this.gridSize = this.linesManager.gridSize;
        
        this.navigationMode = "pan"; // "pan" | "zoom" — текущий режим для 2 пальцев


        // камера
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;

        this.MIN_SCALE = 0.3;
        this.MAX_SCALE = 4;

        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;

        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.spacePressed = false;

        // pinch
        this.isPinching = false;
        this.activeTouches = [];
        this.lastPinchDist = 0;

        this.lightsDrawer = null;

        this.contourLocked = false;

        this.dragVertexIndex = -1;
        this.dragPreviewVertex = null;

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.canvas.style.touchAction = "none";

        this.canvas.addEventListener("pointerdown", e => this.onPointerDown(e));
        this.canvas.addEventListener("pointermove", e => this.onPointerMove(e));
        this.canvas.addEventListener("pointerup", e => this.onPointerUp(e));
        this.canvas.addEventListener("pointercancel", e => this.onPointerUp(e));

        this.canvas.addEventListener("touchstart", e => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener("touchmove", e => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener("touchend", e => this.onTouchEnd(e));
        this.canvas.addEventListener("dblclick", (e) => this.onDoubleClick(e));

        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();

            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            const worldBefore = {
                x: (centerX - this.offsetX) / this.scale,
                y: (centerY - this.offsetY) / this.scale
            };

            const zoomIntensity = 0.001;
            const delta = -e.deltaY * zoomIntensity;

            this.scale *= (1 + delta);
            this.scale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.scale));

            this.offsetX = centerX - worldBefore.x * this.scale;
            this.offsetY = centerY - worldBefore.y * this.scale;

            this.draw();
        }, { passive: false });

        window.addEventListener("keydown", e => {
            if (e.code === "Space") this.spacePressed = true;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
            }
        });
        window.addEventListener("keyup", e => {
            if (e.code === "Space") this.spacePressed = false;
        });
        
        window.addEventListener("contour-closed", () => {
            alert("Контур замкнут, можно экспортировать геометрию и смету");
            this.contourLocked = true;

            const contourPts = this.linesManager.closedContour;
            const oldLines = this.linesManager.lines.slice(); // исходный порядок
            const newLines = [];

            // сохраняем lastPoint
            const lastPoint = this.linesManager.lastPoint ? { ...this.linesManager.lastPoint } : null;

            for (const L of oldLines) {
                // ищем точки линии внутри замкнутого контура
                const startInside = contourPts.some(p => p.x === L.x1 && p.y === L.y1);
                const endInside   = contourPts.some(p => p.x === L.x2 && p.y === L.y2);

                if (startInside && endInside) {
                    // линия полностью внутри — оставляем как есть
                    newLines.push({ ...L });
                } else {
                    // линия выходит за пределы — обрезаем до точек контура
                    // ищем ближайшую точку контура к start и end
                    const closest = (x, y) => {
                        let minDist = Infinity, pt = null;
                        for (const p of contourPts) {
                            const d = Math.hypot(p.x - x, p.y - y);
                            if (d < minDist) {
                                minDist = d;
                                pt = p;
                            }
                        }
                        return pt;
                    };
                    const newStart = startInside ? { x: L.x1, y: L.y1 } : closest(L.x1, L.y1);
                    const newEnd   = endInside ? { x: L.x2, y: L.y2 } : closest(L.x2, L.y2);
                    newLines.push({ x1: newStart.x, y1: newStart.y, x2: newEnd.x, y2: newEnd.y });
                }
            }

            this.linesManager.lines = newLines;
            this.linesManager.lastPoint = lastPoint; // сохраняем lastPoint
            this.draw();
        });

        this.draw();
    }

    setLightsDrawer(ld) {
        this.lightsDrawer = ld;
    }

    enable() { this.enabled = true; }
    disable() { 
        this.enabled = false;
        this.isDrawing = false;
        this.linesManager.cancelCurrentLine();
        this.draw();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.draw();
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.offsetX) / this.scale,
            y: (clientY - rect.top - this.offsetY) / this.scale
        };
    }

    worldToScreen(x, y) {
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    }

    snapToGrid(x, y) {
        return this.linesManager.snapToGrid(x, y);
    }

    onDoubleClick(e) {
        if (!this.linesManager.closedContour) return;

        const world = this.screenToWorld(e.clientX, e.clientY);
        const idx = this.linesManager.getSegmentAt(world.x, world.y);

        if (idx === -1 || idx === null) return;

        const newLen = prompt("Новая длина сегмента (см)");
        if (!newLen) return;

        this.linesManager.resizeSegmentByContour(idx, parseFloat(newLen));
        // this.linesManager.resizeSegment(idx, parseFloat(newLen));
        this.draw();
    }
    
    onPointerDown(e) {

        if (!this.enabled) return;
        if (this.lightsDrawer?.enabled) return;

        // ---------------- DESKTOP PAN START (RIGHT MOUSE OR SPACE) ----------------
        if (e.pointerType === "mouse") {

            // pan только если:
            // - правая кнопка
            // - или зажат space (у тебя уже есть spacePressed)

            if (e.button === 2 || this.spacePressed) {
                this.isPanning = true;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;

                e.preventDefault();
                return;
            }
        }
        if (e.pointerType !== "touch" || e.isPrimary) {
            this.canvas.setPointerCapture(e.pointerId);
        }

        const world = this.screenToWorld(e.clientX, e.clientY);

        // ---------------- VERTEX DRAG (ПЕРВЫЙ ПРИОРИТЕТ) ----------------
        
        if (this.linesManager.closedContour) {

            const vertexIdx = this.linesManager.getVertexAt(world.x, world.y);
            this.dragPreviewVertex = vertexIdx;

            if (vertexIdx !== -1) {
                this.dragVertexIndex = vertexIdx;
                this.isDraggingVertex = true;

                e.preventDefault();
                return;
            }

            // ---------------- SEGMENT SELECT ----------------
            const idx = this.linesManager.getSegmentAt(world.x, world.y);

            if (idx !== null && idx !== -1) {
                this.linesManager.selectedSegmentIndex = idx;
                this.draw();
                return;
            } else {
                if (this.linesManager.selectedSegmentIndex !== null) {
                    this.linesManager.selectedSegmentIndex = null;
                    this.draw();
                }
            }
        }

        // ---------------- BLOCK DRAWING ----------------
        if (this.lightsDrawer?.enabled) return;
        if (this.contourLocked) return;

        // ---------------- MOUSE DRAW ----------------
        if (e.pointerType === "mouse") {

            const start = this.linesManager.lastPoint
                ? { ...this.linesManager.lastPoint }
                : this.snapToGrid(world.x, world.y);

            this.linesManager.startLine(start);
            this.isDrawing = true;
            return;
        }

        // ---------------- TOUCH DRAW (1 finger only) ----------------
        if (e.pointerType === "touch" && !this.isPinching) {

            const start = this.linesManager.lastPoint
                ? { ...this.linesManager.lastPoint }
                : this.snapToGrid(world.x, world.y);

            this.linesManager.startLine(start);
            this.isDrawing = true;
            return;
        }

        // ---------------- 2 FINGERS (ZOOM / PAN) ----------------
        if (e.pointerType === "touch" && e.touches?.length === 2) {

            this.isPinching = true;
            this.activeTouches = [...e.touches];
            this.lastPinchDist = this.getPinchDistance(e.touches);

            if (this.navigationMode === "pan") {
                this.isPanning = true;

                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
            }

            return;
        }
    }

    onPointerMove(e) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        const idx = this.linesManager.getVertexAt(world.x, world.y);

        this.canvas.style.cursor = idx !== -1 ? "grab" : "default";
        // ---------------- PAN ----------------
        if (this.isPanning) {

            // const x = e.clientX ?? e.touches?.[0]?.clientX;
            // const y = e.clientY ?? e.touches?.[0]?.clientY;

            // if (x == null || y == null) return;

            // const dx = x - this.lastPanX;
            // const dy = y - this.lastPanY;
            const dx = e.clientX - this.lastPanX;
            const dy = e.clientY - this.lastPanY;

            // защита от NaN (ВАЖНО для mobile Safari)
            if (!isFinite(dx) || !isFinite(dy)) return;

            this.offsetX += dx;
            this.offsetY += dy;

            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            console.log("PAN", this.offsetX, this.offsetY); // 👈 добавь
            this.draw();
            return;
        }

        // ---------------- VERTEX DRAG (ПЕРВЫМ!) ----------------
        if (this.dragVertexIndex !== -1) {
            // const world = this.screenToWorld(e.clientX, e.clientY);

            // 1️⃣ snap к сетке
            let { x, y } = this.snapToGrid(world.x, world.y);

            // // 2️⃣ snap к углу
            // const snappedAngle = this.linesManager.smartSnapVertex(
            //     this.dragVertexIndex,
            //     world.x, world.y
            // );

            this.linesManager.moveVertex(
                this.dragVertexIndex,
                x,
                y
            );

            this.draw();
            return;
        }

        // ---------------- DRAW LINE ----------------
        if (this.isDrawing && this.linesManager.currentLine) {
            const p = this.screenToWorld(e.clientX, e.clientY);
            const pos = this.snapToGrid(p.x, p.y);

            this.linesManager.updateLine(pos);
            this.draw();
            return;
        }
        
    }

    onPointerUp() {
        this.activeTouches = [];
        this.isPinching = false;
        this.dragPreviewVertex = null;
        // ---------------- PAN ----------------
        if (this.isPanning) {
            this.isPanning = false;
            return;
        }

        // ---------------- VERTEX DRAG STOP ----------------
        if (this.dragVertexIndex !== -1) {
            this.dragVertexIndex = -1;
            this.isDraggingVertex = false;
            this.draw();
            return;
        }

        // ---------------- SAFETY LOCK ----------------
        if (this.finishLocked) return;

        // ---------------- DRAW MODE ----------------
        if (!this.isDrawing || !this.linesManager.currentLine) return;

        this.finishLocked = true;
        this.isDrawing = false;

        const lenStr = prompt("Введите длину линии в см (Отмена — отменить линию):");

        if (lenStr === null) {
            this.linesManager.cancelCurrentLine();
            if (this.lightsDrawer) this.draw();
            this.finishLocked = false;
            return;
        }

        if (lenStr !== "" && !isNaN(lenStr)) {
            this.linesManager.finishLine(parseInt(lenStr, 10));
        } else {
            this.linesManager.finishLine();
        }

        this.draw();

        setTimeout(() => this.finishLocked = false, 0);
    }

    // ---------- PINCH ZOOM ----------
    onTouchStart(e) {
        if (e.touches.length === 2) {
            this.isPinching = true;
            this.linesManager.cancelCurrentLine();
            this.isDrawing = false;
            this.activeTouches = [...e.touches];
            this.lastPinchDist = this.getPinchDistance(e.touches);
            // запрещаем панинг, если работает zoom
            if (this.navigationMode === "zoom") {
                e.preventDefault();
            }
        }
    }
    onTouchMove(e) {
        if (!this.isPinching || e.touches.length !== 2) return;

        const newDist = this.getPinchDistance(e.touches);
        const factor = newDist / this.lastPinchDist;
        const rect = this.canvas.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const worldBefore = { x: (centerX - this.offsetX) / this.scale, y: (centerY - this.offsetY) / this.scale };

        if (this.navigationMode === "zoom") {
            // только zoom
            this.scale *= factor;
            this.scale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.scale));
            this.offsetX = centerX - worldBefore.x * this.scale;
            this.offsetY = centerY - worldBefore.y * this.scale;
        } else if (this.navigationMode === "pan") {
            // только pan
            const dx = e.touches[0].clientX - this.activeTouches[0].clientX;
            const dy = e.touches[0].clientY - this.activeTouches[0].clientY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.activeTouches = [...e.touches];
        }

        this.lastPinchDist = newDist;
        this.draw();
        e.preventDefault();
    }

    onTouchEnd(e) { if (e.touches.length < 2) { this.isPinching = false; this.activeTouches = []; } }
    getPinchDistance(touches) { return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY); }

    // ---------- DRAW ----------
    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const step = this.gridSize * this.scale;
        if (step < 5) return;
        const startX = -this.offsetX;
        const startY = -this.offsetY;
        const firstX = Math.floor(startX / step) * step;
        const firstY = Math.floor(startY / step) * step;
        for (let x = firstX; x <= startX + w; x += step) {
            ctx.beginPath(); ctx.moveTo(x + this.offsetX, 0); ctx.lineTo(x + this.offsetX, h); ctx.stroke();
        }
        for (let y = firstY; y <= startY + h; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y + this.offsetY); ctx.lineTo(w, y + this.offsetY); ctx.stroke();
        }
    }

    drawArc(x, y, r, a1, a2, color = "black") {
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.arc(x, y, r, a1, a2);
        ctx.stroke();
    }

    drawLines() {
        const ctx = this.ctx;

        // ---------------- ЗАМКНУТЫЙ КОНТУР ----------------
        if (this.linesManager.closedContour) {
            const pts = this.linesManager.closedContour;

            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];

                const a = this.worldToScreen(p1.x, p1.y);
                const b = this.worldToScreen(p2.x, p2.y);

                const isSelected = i === this.linesManager.selectedSegmentIndex;

                ctx.lineWidth = isSelected ? 5 : 3;
                ctx.strokeStyle = isSelected ? "red" : "green";

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                // -------- размеры --------
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.round(Math.hypot(dx, dy));
                if (len === 0) continue;

                const midX = (a.x + b.x) / 2;
                const midY = (a.y + b.y) / 2;

                ctx.save();
                ctx.translate(midX, midY);

                const isVertical = Math.abs(dx) < Math.abs(dy);
                if (isVertical) ctx.rotate(-Math.PI / 2);

                ctx.fillStyle = "green";
                ctx.font = "14px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(len + " см", 0, -10);

                ctx.restore();
            }
            this.drawAngles(pts);

            // =======================
            // 🔥 ВЕРШИНЫ (DRAG POINTS)
            // =======================
            for (let i = 0; i < pts.length - 1; i++) {
                const p = pts[i];
                const s = this.worldToScreen(p.x, p.y);

                const isActive = i === this.dragVertexIndex;

                // =====================
                // 🔵 ВЕРШИНА
                // =====================
                ctx.beginPath();
                ctx.arc(s.x, s.y, isActive ? 7 : 5, 0, Math.PI * 2);
                ctx.fillStyle = isActive ? "#ff3b30" : "#fff";
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.stroke();

                if (!isActive) continue;

                const ptsArr = this.linesManager.closedContour;
                const count = ptsArr.length - 1;

                const prev = ptsArr[(i - 1 + count) % count];
                const next = ptsArr[(i + 1) % count];

                const v1 = { x: prev.x - p.x, y: prev.y - p.y };
                const v2 = { x: next.x - p.x, y: next.y - p.y };

                const len1 = Math.hypot(v1.x, v1.y);
                const len2 = Math.hypot(v2.x, v2.y);

                const n1 = { x: v1.x / len1, y: v1.y / len1 };
                const n2 = { x: v2.x / len2, y: v2.y / len2 };

                // =====================
                // 1) ВНУТРЕННИЙ УГОЛ
                // =====================
                const dot = n1.x * n2.x + n1.y * n2.y;
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

                this.drawArc(s.x, s.y, 20, 0, angle, "#ff3b30");

                ctx.fillStyle = "#ff3b30";
                ctx.font = "12px sans-serif";

                ctx.fillText(
                    `${Math.round(angle * 180 / Math.PI)}°`,
                    s.x + 18,
                    s.y + 18
                );

                // =====================
                // 2) ШТРИХОВЫЕ ОСИ
                // =====================
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 1;

                // X ось
                ctx.beginPath();
                ctx.moveTo(s.x - 40, s.y);
                ctx.lineTo(s.x + 40, s.y);
                ctx.stroke();

                // Y ось
                ctx.beginPath();
                ctx.moveTo(s.x, s.y - 40);
                ctx.lineTo(s.x, s.y + 40);
                ctx.stroke();

                ctx.setLineDash([]);

                // =====================
                // 3) УГЛЫ К ОСЯМ
                // =====================
                const angleX1 = Math.atan2(v1.y, v1.x);
                const angleX2 = Math.atan2(v2.y, v2.x);

                const deg1 = Math.round((angleX1 * 180 / Math.PI + 360) % 360);
                const deg2 = Math.round((angleX2 * 180 / Math.PI + 360) % 360);

                ctx.fillStyle = "#333";
                ctx.font = "12px sans-serif";

                ctx.fillText(`X1: ${deg1}°`, s.x + 45, s.y - 10);
                ctx.fillText(`X2: ${deg2}°`, s.x + 45, s.y + 10);
            }

            return;
        }

        // ---------------- ОБЫЧНЫЕ ЛИНИИ ----------------
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00bfff";

        for (const L of this.linesManager.lines) {
            const a = this.worldToScreen(L.x1, L.y1);
            const b = this.worldToScreen(L.x2, L.y2);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            const dx = L.x2 - L.x1;
            const dy = L.y2 - L.y1;
            const len = Math.round(Math.hypot(dx, dy));
            if (len === 0) continue;

            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;

            ctx.save();
            ctx.translate(midX, midY);

            const isVertical = Math.abs(dx) < Math.abs(dy);
            if (isVertical) ctx.rotate(-Math.PI / 2);

            ctx.fillStyle = "#00bfff";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(len + " см", 0, -10);

            ctx.restore();
        }

        // ---------------- текущая линия ----------------
        if (this.linesManager.currentLine) {
            const L = this.linesManager.currentLine;
            const a = this.worldToScreen(L.x1, L.y1);
            const b = this.worldToScreen(L.x2, L.y2);

            ctx.strokeStyle = "#ff0080";

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            const dx = L.x2 - L.x1;
            const dy = L.y2 - L.y1;
            const len = Math.round(Math.hypot(dx, dy));

            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;

            ctx.save();
            ctx.translate(midX, midY);

            const isVertical = Math.abs(dx) < Math.abs(dy);
            if (isVertical) ctx.rotate(-Math.PI / 2);

            ctx.fillStyle = "#ff0080";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(len + " см", 0, -10);

            ctx.restore();
        }
    }

    drawRadialGrid(cx, cy) {
        const ctx = this.ctx;

        const stepRadius = this.gridSize * this.scale;
        const stepAngle = (5 * Math.PI) / 180;

        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;

        // ---------- круги ----------
        for (let r = stepRadius; r < 2000; r += stepRadius) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ---------- лучи ----------
        const maxR = 2000;
        for (let a = 0; a < Math.PI * 2; a += stepAngle) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
                cx + Math.cos(a) * maxR,
                cy + Math.sin(a) * maxR
            );
            ctx.stroke();
        }

        ctx.restore();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#f8f8f8"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (
            this.dragPreviewVertex !== null &&
            this.dragPreviewVertex !== -1 &&
            this.linesManager.closedContour
        ) {
            const pts = this.linesManager.closedContour;
            const p = pts[this.dragPreviewVertex];

            if (p) {
                const s = this.worldToScreen(p.x, p.y);
                this.drawRadialGrid(s.x, s.y);
            }
        } else {
            this.drawGrid();
        }
        console.log("DRAW", this.offsetX, this.offsetY, this.scale);
        this.drawLines();

        if (this.lightsDrawer) this.lightsDrawer.drawWithOffset(this.offsetX, this.offsetY, this.scale);
    }

    // ---------- API ----------
    undo() {
        // 1️⃣ Undo светильников, если они активны
        if (this.lightsDrawer && this.lightsDrawer.enabled && this.lightsDrawer.lights.length) {
            this.lightsDrawer.undo();
            this.draw();
            return;
        }

        // 2️⃣ Undo линий / контура
        if (this.linesManager) {
            const wasContourLocked = !!this.linesManager.closedContour;

            this.linesManager.undo();

            // Если контур был снят, снимаем блокировку редактора
            if (wasContourLocked) {
                this.contourLocked = false;
            }

            // Обновляем lastPoint на уровне редактора (дополнительно)
            this.draw();
            return;
        }

        // 3️⃣ Если нечего отменять — просто перерисовать
        this.draw();
    }


    setGridSize(size) {
        this.gridSize = size;
        this.linesManager.gridSize = size;
        this.draw();
    }

    deleteSelectedSegment() {
        const lm = this.linesManager;
        const idx = lm.selectedSegmentIndex;

        if (idx === null || idx === undefined) return;
        if (!lm.closedContour || lm.closedContour.length < 4) return;

        // --- snapshot для undo ---
        if (!lm.undoStack) lm.undoStack = [];
        lm.undoStack.push({
            lines: JSON.parse(JSON.stringify(lm.lines)),
            closedContour: JSON.parse(JSON.stringify(lm.closedContour)),
            lastPoint: lm.lastPoint ? { ...lm.lastPoint } : null,
            lastPointVertical: lm.lastPointVertical ?? null
        });

        // --- копия точек контура ---
        let pts = lm.closedContour.slice();
        const first = pts[0];
        const last  = pts[pts.length - 1];
        if (first.x === last.x && first.y === last.y) pts.pop();

        const a = pts[idx];
        const b = pts[(idx + 1) % pts.length];

        // --- удаляем только одну линию, соответствующую сегменту ---
        for (let i = lm.lines.length - 1; i >= 0; i--) {
            const L = lm.lines[i];
            if ((L.x1 === a.x && L.y1 === a.y && L.x2 === b.x && L.y2 === b.y) ||
                (L.x1 === b.x && L.y1 === b.y && L.x2 === a.x && L.y2 === a.y)) {
                lm.lines.splice(i, 1);
                break; // удаляем только одну линию
            }
        }

        // --- размыкаем контур ---
        lm.closedContour = null;
        lm.selectedSegmentIndex = null;
        lm.currentLine = null;

        // --- пересчёт lastPoint для продолжения рисования ---
        if (lm.lines.length) {
            // собираем все концы линий
            const endpoints = [];
            for (const L of lm.lines) {
                endpoints.push({ x: L.x1, y: L.y1 });
                endpoints.push({ x: L.x2, y: L.y2 });
            }

            // считаем количество соединений каждой точки
            const degree = {};
            for (const L of lm.lines) {
                const k1 = `${L.x1},${L.y1}`, k2 = `${L.x2},${L.y2}`;
                degree[k1] = (degree[k1] || 0) + 1;
                degree[k2] = (degree[k2] || 0) + 1;
            }

            // фильтруем свободные концы
            const freePoints = endpoints.filter(p => degree[`${p.x},${p.y}`] === 1);

            if (freePoints.length) {
                // выбираем ближайший к удалённой линии
                const removedMidpoint = { x: (a.x + b.x)/2, y: (a.y + b.y)/2 };
                let closest = freePoints[0];
                let minDist = Math.hypot(freePoints[0].x - removedMidpoint.x, freePoints[0].y - removedMidpoint.y);

                for (const p of freePoints) {
                    const d = Math.hypot(p.x - removedMidpoint.x, p.y - removedMidpoint.y);
                    if (d < minDist) {
                        minDist = d;
                        closest = p;
                    }
                }

                lm.lastPoint = { ...closest };

                // определяем ориентацию линии (вертикальная/горизонтальная)
                const connectedLine = lm.lines.find(L =>
                    (L.x1 === closest.x && L.y1 === closest.y) || (L.x2 === closest.x && L.y2 === closest.y)
                );
                if (connectedLine) {
                    lm.lastPointVertical = connectedLine.x1 === connectedLine.x2;
                } else {
                    lm.lastPointVertical = null;
                }

            } else {
                lm.lastPoint = null;
                lm.lastPointVertical = null;
            }

        } else {
            lm.lastPoint = null;
            lm.lastPointVertical = null;
        }

        this.contourLocked = false;
        this.draw();
    }

    drawAngles(pts) {
        const ctx = this.ctx;
        const screen = (p) => this.worldToScreen(p.x, p.y);

        const vec = (a, b) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: dx / len, y: dy / len };
        };

        const n = pts.length - 1;

        for (let i = 0; i < n; i++) {
            const prev = pts[(i - 1 + n) % n];
            const curr = pts[i];
            const next = pts[(i + 1) % n];

            const p = screen(curr);

            const v1 = vec(curr, prev);
            const v2 = vec(curr, next);

            const a1 = Math.atan2(v1.y, v1.x);
            const a2 = Math.atan2(v2.y, v2.x);

            const radius = 18;

            // 🔥 ключ: определяем "внутреннюю сторону" через cross product
            const cross = v1.x * v2.y - v1.y * v2.x;

            let start = a1;
            let end = a2;
            let ccw = cross < 0; // <--- ВАЖНО

            // нормализуем чтобы дуга была именно внутренняя (а не 270°)
            if (ccw) {
                if (end < start) end += Math.PI * 2;
            } else {
                if (start < end) start += Math.PI * 2;
            }

            // ---------------- DRAW ARC ----------------
            ctx.beginPath();
            ctx.strokeStyle = "orange";
            ctx.lineWidth = 2;

            ctx.arc(p.x, p.y, radius, start, end, ccw);
            ctx.stroke();

            // ---------------- LABEL ----------------
            const bis = {
                x: v1.x + v2.x,
                y: v1.y + v2.y
            };

            const len = Math.hypot(bis.x, bis.y) || 1;
            bis.x /= len;
            bis.y /= len;

            const deg = Math.round(
                Math.acos(
                    Math.max(-1, Math.min(1, v1.x * v2.x + v1.y * v2.y))
                ) * 180 / Math.PI
            );

            ctx.fillStyle = "black";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillText(
                deg + "°",
                p.x + bis.x * 35,
                p.y + bis.y * 35
            );
        }
    }

    exportData() { return this.linesManager.exportData(); }
    importData(lines) { this.linesManager.importData(lines); this.draw(); }
}
