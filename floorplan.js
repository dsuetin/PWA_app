export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        /* -------- CONFIG -------- */
        this.gridSize = 10;

        /* -------- DATA -------- */
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;

        /* -------- STATE -------- */
        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;

        /* -------- LIGHTS -------- */
        this.lightsDrawer = null;

        /* -------- INIT -------- */
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        /* -------- POINTER EVENTS -------- */
        this.canvas.style.touchAction = "none";

        this.canvas.addEventListener("pointerdown", (e) => this.startLine(e));
        this.canvas.addEventListener("pointermove", (e) => this.drawPreview(e));
        this.canvas.addEventListener("pointerup", () => this.finishLine());
        this.canvas.addEventListener("pointercancel", () => this.finishLine());

        /* -------- UNDO -------- */
        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
            }
        });

        this.draw();
    }

    /* ================= ENABLE / DISABLE ================= */

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        this.isDrawing = false;
        this.currentLine = null;
        this.draw();
    }

    setLightsDrawer(ld) {
        this.lightsDrawer = ld;
    }

    /* ================= CANVAS ================= */

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

    /* ================= UTILS ================= */

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    getLastLineDirection() {
        if (this.lines.length === 0) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
    }

    /* ================= LINE LOGIC ================= */

    startLine(e) {
        if (!this.enabled || this.isDrawing) return;

        this.canvas.setPointerCapture(e.pointerId);

        const p = this.snapToGrid(...Object.values(this.getEventPos(e)));
        const start = this.lastPoint ? { ...this.lastPoint } : p;

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

        let pos = this.snapToGrid(...Object.values(this.getEventPos(e)));
        const lastDir = this.getLastLineDirection();

        if (lastDir === "horizontal") {
            pos.x = this.currentLine.x1;
        } else if (lastDir === "vertical") {
            pos.y = this.currentLine.y1;
        } else {
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
        if (!this.enabled || !this.isDrawing || !this.currentLine || this.finishLocked) return;

        this.finishLocked = true;
        this.isDrawing = false;

        const lenStr = prompt("Введите длину линии в пикселях (оставьте пустым для свободной длины):");

        if (lenStr && !isNaN(lenStr)) {
            const length = parseInt(lenStr, 10);
            const dx = this.currentLine.x2 - this.currentLine.x1;
            const dy = this.currentLine.y2 - this.currentLine.y1;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentLine.x2 = this.currentLine.x1 + Math.sign(dx) * length;
                this.currentLine.y2 = this.currentLine.y1;
            } else {
                this.currentLine.x2 = this.currentLine.x1;
                this.currentLine.y2 = this.currentLine.y1 + Math.sign(dy) * length;
            }
        }

        this.lines.push({ ...this.currentLine });
        this.lastPoint = { x: this.currentLine.x2, y: this.currentLine.y2 };

        this.currentLine = null;
        this.draw();

        setTimeout(() => (this.finishLocked = false), 0);
    }

    /* ================= DRAW ================= */

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

        for (const L of this.lines) {
            ctx.strokeStyle = "#00bfff";
            ctx.beginPath();
            ctx.moveTo(L.x1, L.y1);
            ctx.lineTo(L.x2, L.y2);
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

        if (this.lightsDrawer?.redraw) {
            this.lightsDrawer.redraw();
        }
    }

    /* ================= UNDO ================= */

    undo() {
        if (this.lines.length === 0) return;

        this.lines.pop();

        if (this.lines.length > 0) {
            const L = this.lines[this.lines.length - 1];
            this.lastPoint = { x: L.x2, y: L.y2 };
        } else {
            this.lastPoint = null;
        }

        this.draw();
    }
}
