// floorplan.js
import { LinesManager } from "./lines.js";

export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.linesManager = new LinesManager(10);
        this.gridSize = this.linesManager.gridSize;

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
            alert("Контур замкнут");
            this.contourLocked = true;
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

    onPointerDown(e) {
        if (this.contourLocked) return;
        this.canvas.setPointerCapture(e.pointerId);
        if (this.spacePressed || (e.pointerType === "touch" && !e.isPrimary)) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.linesManager.cancelCurrentLine();
            this.isDrawing = false;
            return;
        }
        if (!this.enabled || this.isDrawing || this.isPinching) return;

        const start = this.linesManager.lastPoint
            ? { ...this.linesManager.lastPoint }
            : this.snapToGrid(...Object.values(this.screenToWorld(e.clientX, e.clientY)));

        this.linesManager.startLine(start);
        this.isDrawing = true;
    }

    onPointerMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastPanX;
            const dy = e.clientY - this.lastPanY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.draw();
            return;
        }

        if (!this.isDrawing || !this.linesManager.currentLine) return;
        const p = this.screenToWorld(e.clientX, e.clientY);
        const pos = this.snapToGrid(p.x, p.y);
        this.linesManager.updateLine(pos);
        this.draw();
    }

    onPointerUp() {
        if (this.isPanning) { this.isPanning = false; return; }
        if (!this.isDrawing || !this.linesManager.currentLine || this.finishLocked) return;

        this.finishLocked = true;
        this.isDrawing = false;

        const lenStr = prompt("Введите длину линии в пикселях (Отмена — отменить линию):");
        if (lenStr === null) {
            this.linesManager.cancelCurrentLine();
            // пересчёт света по текущему offset/scale
            // if (this.lightsDrawer) this.lightsDrawer.redraw();
            if (this.lightsDrawer) this.draw();
            this.finishLocked = false;
            return;
        }

        if (lenStr !== "" && !isNaN(lenStr)) this.linesManager.finishLine(parseInt(lenStr, 10));
        else this.linesManager.finishLine();

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
            e.preventDefault();
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
        this.scale *= factor;
        this.scale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.scale));
        this.offsetX = centerX - worldBefore.x * this.scale;
        this.offsetY = centerY - worldBefore.y * this.scale;
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


    drawLines() {
        const ctx = this.ctx;

        if (this.linesManager.closedContour) {
            // рисуем только контур зелёным
            ctx.lineWidth = 3;
            ctx.strokeStyle = "green";

            const pts = this.linesManager.closedContour;
            for (let i = 0; i < pts.length; i++) {
                const a = this.worldToScreen(pts[i].x, pts[i].y);
                const b = this.worldToScreen(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }

            return; // не рисуем обычные линии
        }

        // --- обычные линии, если контур не замкнут ---
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00bfff";

        for (const L of this.linesManager.lines) {
            const a = this.worldToScreen(L.x1, L.y1);
            const b = this.worldToScreen(L.x2, L.y2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // рисуем текущую линию, если есть
        if (this.linesManager.currentLine) {
            const L = this.linesManager.currentLine;
            const a = this.worldToScreen(L.x1, L.y1);
            const b = this.worldToScreen(L.x2, L.y2);
            ctx.strokeStyle = "#ff0080";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }



    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#f8f8f8"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawLines();
        if (this.lightsDrawer) this.lightsDrawer.drawWithOffset(this.offsetX, this.offsetY, this.scale);
    }

    // ---------- API ----------
    undo() {
        if (this.lightsDrawer && this.lightsDrawer.enabled) {
            this.lightsDrawer.undo();
        } else {
            this.linesManager.undo();
        }
        this.draw();
    }

    setGridSize(size) {
        this.gridSize = size;
        this.linesManager.gridSize = size;
        this.draw();
    }

    exportData() { return this.linesManager.exportData(); }
    importData(lines) { this.linesManager.importData(lines); this.draw(); }
}
