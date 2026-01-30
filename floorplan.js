// floorplan.js
import { LinesManager } from "./lines.js";

export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.linesManager = new LinesManager(10);
        this.gridSize = this.linesManager.gridSize;

        this.offsetX = 0;
        this.offsetY = 0;

        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;

        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.spacePressed = false;

        this.isPinching = false;
        this.activeTouches = [];

        this.lightsDrawer = null;

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
        window.addEventListener("keyup", e => { if (e.code === "Space") this.spacePressed = false; });

        this.draw();
    }

    setLightsDrawer(ld) { this.lightsDrawer = ld; }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; this.isDrawing = false; this.linesManager.cancelCurrentLine(); this.draw(); }

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
        return { x: clientX - rect.left - this.offsetX, y: clientY - rect.top - this.offsetY };
    }

    snapToGrid(x, y) { return this.linesManager.snapToGrid(x, y); }

    get currentLine() { return this.linesManager.currentLine; }

    onPointerDown(e) {
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
        if (lenStr === null) { this.linesManager.cancelCurrentLine(); this.draw(); this.finishLocked = false; return; }

        if (lenStr !== "" && !isNaN(lenStr)) this.linesManager.finishLine(parseInt(lenStr, 10));
        else this.linesManager.finishLine();

        this.draw();
        setTimeout(() => (this.finishLocked = false), 0);
    }

    onTouchStart(e) {
        if (e.touches.length === 2) { this.isPinching = true; this.linesManager.cancelCurrentLine(); this.isDrawing = false; this.activeTouches = [...e.touches]; e.preventDefault(); }
    }

    onTouchMove(e) {
        if (this.isPinching && e.touches.length === 2) {
            const prevX = (this.activeTouches[0].clientX + this.activeTouches[1].clientX) / 2;
            const prevY = (this.activeTouches[0].clientY + this.activeTouches[1].clientY) / 2;
            const newX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const newY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            this.offsetX += newX - prevX;
            this.offsetY += newY - prevY;

            this.activeTouches = [...e.touches];
            this.draw();
            e.preventDefault();
        }
    }

    onTouchEnd(e) { if (e.touches.length < 2) { this.isPinching = false; this.activeTouches = []; } }

    drawGrid() {
        const ctx = this.ctx; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
        const w = this.canvas.width, h = this.canvas.height;
        const startX = -this.offsetX, startY = -this.offsetY;
        const firstX = Math.floor(startX / this.gridSize) * this.gridSize;
        const firstY = Math.floor(startY / this.gridSize) * this.gridSize;
        const endX = startX + w, endY = startY + h;

        for (let x = firstX; x <= endX; x += this.gridSize) { ctx.beginPath(); ctx.moveTo(x + this.offsetX, 0); ctx.lineTo(x + this.offsetX, h); ctx.stroke(); }
        for (let y = firstY; y <= endY; y += this.gridSize) { ctx.beginPath(); ctx.moveTo(0, y + this.offsetY); ctx.lineTo(w, y + this.offsetY); ctx.stroke(); }
    }

    drawLines() {
        const ctx = this.ctx; ctx.lineWidth = 3;
        ctx.strokeStyle = "#00bfff";
        for (const L of this.linesManager.lines) { ctx.beginPath(); ctx.moveTo(L.x1 + this.offsetX, L.y1 + this.offsetY); ctx.lineTo(L.x2 + this.offsetX, L.y2 + this.offsetY); ctx.stroke(); }

        if (this.linesManager.currentLine) {
            const L = this.linesManager.currentLine;
            ctx.strokeStyle = "#ff0080";
            ctx.beginPath(); ctx.moveTo(L.x1 + this.offsetX, L.y1 + this.offsetY); ctx.lineTo(L.x2 + this.offsetX, L.y2 + this.offsetY); ctx.stroke();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#f8f8f8"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawLines();
        if (this.lightsDrawer) this.lightsDrawer.drawWithOffset(this.offsetX, this.offsetY);
    }

    undo() { this.linesManager.undo(); this.draw(); }

    setGridSize(size) { this.gridSize = size; this.linesManager.gridSize = size; this.draw(); }

    exportData() { return this.linesManager.exportData(); }

    importData(lines) { this.linesManager.importData(lines); this.draw(); }
}
