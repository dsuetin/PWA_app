import { LineModel } from "./LineModel.js";
import { PanController } from "./PanController.js";

export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        // ===== CONFIG =====
        this.gridSize = 10;

        // ===== DATA =====
        this.lineModel = new LineModel();
        this.panController = new PanController();

        // ===== STATE =====
        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;
        this.spacePressed = false;

        // ===== LIGHTS =====
        this.lightsDrawer = null;

        // ===== INIT =====
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.canvas.style.touchAction = "none";

        this.canvas.addEventListener("pointerdown", e => this.onPointerDown(e));
        this.canvas.addEventListener("pointermove", e => this.onPointerMove(e));
        this.canvas.addEventListener("pointerup", e => this.onPointerUp(e));
        this.canvas.addEventListener("pointercancel", e => this.onPointerUp(e));

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

        this.draw();
    }

    // ------------------------------------------------
    setLightsDrawer(ld) {
        this.lightsDrawer = ld;
    }

    enable() { this.enabled = true; }

    disable() {
        this.enabled = false;
        this.isDrawing = false;
        this.lineModel.currentLine = null;
        this.draw();
    }

    // ------------------------------------------------
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
            x: clientX - rect.left - this.panController.offsetX,
            y: clientY - rect.top - this.panController.offsetY
        };
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    onPointerDown(e) {
        this.canvas.setPointerCapture(e.pointerId);

        if (this.spacePressed || (e.pointerType === "touch" && !e.isPrimary)) {
            this.panController.start(e.clientX, e.clientY);
            return;
        }

        if (!this.enabled || this.isDrawing) return;

        const p = this.screenToWorld(e.clientX, e.clientY);
        const pos = this.snapToGrid(p.x, p.y);
        const start = this.lineModel.lastPoint ? { ...this.lineModel.lastPoint } : pos;

        this.lineModel.startLine(start);
        this.isDrawing = true;
    }

    onPointerMove(e) {
        if (this.panController.isPanning) {
            this.panController.move(e.clientX, e.clientY);
            this.draw();
            return;
        }

        if (!this.isDrawing || !this.lineModel.currentLine) return;

        const p = this.screenToWorld(e.clientX, e.clientY);
        let pos = this.snapToGrid(p.x, p.y);

        const lastDir = this.lineModel.getLastLineDirection();
        if (lastDir === "horizontal") pos.x = this.lineModel.currentLine.x1;
        else if (lastDir === "vertical") pos.y = this.lineModel.currentLine.y1;
        else {
            const dx = Math.abs(pos.x - this.lineModel.currentLine.x1);
            const dy = Math.abs(pos.y - this.lineModel.currentLine.y1);
            if (dx > dy) pos.y = this.lineModel.currentLine.y1;
            else pos.x = this.lineModel.currentLine.x1;
        }

        this.lineModel.updateLine(pos);
        this.draw();
    }

    onPointerUp() {
        if (this.panController.isPanning) {
            this.panController.end();
            this.isDrawing = false;
            this.lineModel.currentLine = null;
            return;
        }

        if (!this.isDrawing || !this.lineModel.currentLine || this.finishLocked) return;

        this.finishLocked = true;
        this.isDrawing = false;

        const finished = this.lineModel.finishLine(line => {
            const lenStr = prompt(
                "Введите длину линии в пикселях (оставьте пустым для свободной длины):"
            );
            if (lenStr && !isNaN(lenStr)) {
                const length = parseInt(lenStr, 10);
                const dx = line.x2 - line.x1;
                const dy = line.y2 - line.y1;

                if (Math.abs(dx) > Math.abs(dy)) {
                    line.x2 = line.x1 + Math.sign(dx) * length;
                    line.y2 = line.y1;
                } else {
                    line.x2 = line.x1;
                    line.y2 = line.y1 + Math.sign(dy) * length;
                }
            }
        });

        if (!finished) return;
        this.draw();

        setTimeout(() => (this.finishLocked = false), 0);
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;

        const w = this.canvas.width;
        const h = this.canvas.height;

        for (let x = -this.panController.offsetX % this.gridSize; x < w; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        for (let y = -this.panController.offsetY % this.gridSize; y < h; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    drawLines() {
        const ctx = this.ctx;
        ctx.lineWidth = 3;

        ctx.strokeStyle = "#00bfff";
        for (const L of this.lineModel.lines) {
            ctx.beginPath();
            ctx.moveTo(L.x1 + this.panController.offsetX, L.y1 + this.panController.offsetY);
            ctx.lineTo(L.x2 + this.panController.offsetX, L.y2 + this.panController.offsetY);
            ctx.stroke();
        }

        if (this.lineModel.currentLine) {
            const L = this.lineModel.currentLine;
            ctx.strokeStyle = "#ff0080";
            ctx.beginPath();
            ctx.moveTo(L.x1 + this.panController.offsetX, L.y1 + this.panController.offsetY);
            ctx.lineTo(L.x2 + this.panController.offsetX, L.y2 + this.panController.offsetY);
            ctx.stroke();
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawLines();

        if (this.lightsDrawer) {
            this.lightsDrawer.drawWithOffset(this.panController.offsetX, this.panController.offsetY);
        }
    }

    undo() {
        this.lineModel.undo();
        this.draw();
    }

    setGridSize(size) {
        this.gridSize = size;
        this.draw();
    }

    exportData() {
        return this.lineModel.exportData();
    }

    importData(lines) {
        this.lineModel.importData(lines);
        this.draw();
    }
}
