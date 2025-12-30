export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = 25;

        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;

        this.isDrawing = false;
        this.finishLocked = false;
        this.enabled = true;

        this.lightsDrawer = null; // ссылка на LightsDrawer

        // бинды
        this.onMouseDown = (e) => this.startLine(e);
        this.onMouseMove = (e) => this.drawPreview(e);
        this.onMouseUp = () => this.finishLine();

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.canvas.addEventListener("mousedown", this.onMouseDown);
        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseup", this.onMouseUp);

        // Ctrl + Z
        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
            }
        });

        this.draw();
    }

    /* ===================== MODES ===================== */

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        this.isDrawing = false;
        this.currentLine = null;
    }

    setLightsDrawer(lightsDrawer) {
        this.lightsDrawer = lightsDrawer;
    }

    /* ===================== CANVAS ===================== */

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.draw();
    }

    setGridSize(size) {
        if (size > 0) {
            this.gridSize = size;
            this.draw();
        }
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    /* ===================== DRAW LOGIC ===================== */

    getLastLineDirection() {
        if (this.lines.length === 0) return null;
        const l = this.lines[this.lines.length - 1];
        return l.x1 === l.x2 ? "vertical" : "horizontal";
    }

    startLine(e) {
        if (!this.enabled || this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const pos = this.snapToGrid(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        const start = this.lastPoint ? { ...this.lastPoint } : pos;

        this.currentLine = {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y
        };

        this.isDrawing = true;
        this.draw();
    }

    drawPreview(e) {
        if (!this.enabled || !this.isDrawing || !this.currentLine) return;

        const rect = this.canvas.getBoundingClientRect();
        let pos = this.snapToGrid(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        const lastDir = this.getLastLineDirection();

        if (lastDir === "horizontal") pos.x = this.currentLine.x1;
        else if (lastDir === "vertical") pos.y = this.currentLine.y1;
        else {
            const dx = Math.abs(pos.x - this.currentLine.x1);
            const dy = Math.abs(pos.y - this.currentLine.y1);
            if (dx > dy) pos.y = this.currentLine.y1;
            else pos.x = this.currentLine.x1;
        }

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;

        this.draw();
    }

    finishLine() {
        if (
            !this.enabled ||
            !this.isDrawing ||
            !this.currentLine ||
            this.finishLocked
        ) return;

        this.finishLocked = true;
        this.isDrawing = false;

        const lenStr = prompt(
            "Введите длину линии в пикселях (пусто — свободная длина):"
        );

        if (lenStr && !isNaN(lenStr)) {
            const len = parseInt(lenStr);
            const dx = this.currentLine.x2 - this.currentLine.x1;
            const dy = this.currentLine.y2 - this.currentLine.y1;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentLine.x2 =
                    this.currentLine.x1 + Math.sign(dx) * len;
                this.currentLine.y2 = this.currentLine.y1;
            } else {
                this.currentLine.x2 = this.currentLine.x1;
                this.currentLine.y2 =
                    this.currentLine.y1 + Math.sign(dy) * len;
            }
        }

        this.lines.push({ ...this.currentLine });
        this.lastPoint = {
            x: this.currentLine.x2,
            y: this.currentLine.y2
        };

        this.currentLine = null;
        this.draw();

        setTimeout(() => (this.finishLocked = false), 0);
    }

    /* ===================== RENDER ===================== */

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;

        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }

    drawLines() {
        const ctx = this.ctx;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00bfff";

        for (const l of this.lines) {
            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.stroke();
        }

        if (this.currentLine) {
            ctx.strokeStyle = "#ff0080";
            ctx.beginPath();
            ctx.moveTo(this.currentLine.x1, this.currentLine.y1);
            ctx.lineTo(this.currentLine.x2, this.currentLine.y2);
            ctx.stroke();
        }
    }

    draw() {
        this.ctx.fillStyle = "#f8f8f8";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawLines();

        // ⚡ ВСЕГДА рисуем свет поверх
        if (this.lightsDrawer) {
            this.lightsDrawer.redraw();
        }
    }

    /* ===================== UNDO ===================== */

    undo() {
        if (this.lines.length === 0) return;

        this.lines.pop();

        if (this.lines.length) {
            const l = this.lines[this.lines.length - 1];
            this.lastPoint = { x: l.x2, y: l.y2 };
        } else {
            this.lastPoint = null;
        }

        this.draw();
    }

    /* ===================== EXPORT / IMPORT ===================== */

    exportData() {
        return this.lines.map(l => ({
            type: "line",
            x1: l.x1,
            y1: l.y1,
            x2: l.x2,
            y2: l.y2
        }));
    }

    importData(lines) {
        this.lines = lines.map(l => ({
            x1: l.x1,
            y1: l.y1,
            x2: l.x2,
            y2: l.y2
        }));

        this.lastPoint = this.lines.length
            ? { ...this.lines.at(-1), x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
            : null;

        this.currentLine = null;
        this.isDrawing = false;

        this.draw();
    }
}
