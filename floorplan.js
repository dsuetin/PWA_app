export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        /* ===== CONFIG ===== */
        this.gridSize = 10;
        this.scale = 1;
        this.minScale = 0.3;
        this.maxScale = 3;

        /* ===== DATA ===== */
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;

        /* ===== STATE ===== */
        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;

        /* ===== POINTER TRACKING ===== */
        this.pointers = new Map();
        this.lastPinchDistance = null;

        /* ===== LIGHTS ===== */
        this.lightsDrawer = null;

        /* ===== INIT ===== */
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.canvas.style.touchAction = "none";

        this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
        this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
        this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
        this.canvas.addEventListener("pointercancel", (e) => this.onPointerUp(e));

        this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
            }
        });

        this.draw();
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

    /* ================= POINTER ================= */

    onPointerDown(e) {
        this.canvas.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, e);

        if (!this.enabled) return;
        if (this.pointers.size === 1) this.startLine(e);
    }

    onPointerMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.set(e.pointerId, e);

        // pinch zoom
        if (this.pointers.size === 2) {
            const [p1, p2] = [...this.pointers.values()];
            const dist = Math.hypot(
                p1.clientX - p2.clientX,
                p1.clientY - p2.clientY
            );

            if (this.lastPinchDistance) {
                const delta = dist / this.lastPinchDistance;
                this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * delta));
                this.draw();
            }

            this.lastPinchDistance = dist;
            return;
        }

        this.drawPreview(e);
    }

    onPointerUp(e) {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.lastPinchDistance = null;
        this.finishLine();
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));
        this.draw();
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

    /* ================= LINE ================= */

    startLine(e) {
        if (this.isDrawing) return;

        const p = this.snapToGrid(...Object.values(this.getEventPos(e)));
        const start = this.lastPoint ? { ...this.lastPoint } : p;

        this.currentLine = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
        this.isDrawing = true;
    }

    drawPreview(e) {
        if (!this.enabled || !this.isDrawing || !this.currentLine) return;

        let pos = this.snapToGrid(...Object.values(this.getEventPos(e)));
        const lastDir = this.getLastLineDirection();

        if (lastDir === "horizontal") pos.x = this.currentLine.x1;
        else if (lastDir === "vertical") pos.y = this.currentLine.y1;
        else {
            const dx = Math.abs(pos.x - this.currentLine.x1);
            const dy = Math.abs(pos.y - this.currentLine.y1);
            dx > dy ? (pos.y = this.currentLine.y1) : (pos.x = this.currentLine.x1);
        }

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;
        this.draw();
    }

    finishLine() {
        if (!this.enabled || !this.isDrawing || !this.currentLine || this.finishLocked) return;

        this.finishLocked = true;
        this.isDrawing = false;

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

        const w = this.canvas.width / this.scale;
        const h = this.canvas.height / this.scale;

        for (let x = 0; x < w; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        for (let y = 0; y < h; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
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
        this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        this.ctx.fillStyle = "#f8f8f8";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawLines();
        this.lightsDrawer?.redraw();
    }

    undo() {
        if (!this.lines.length) return;
        this.lines.pop();
        this.lastPoint = this.lines.length
            ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
            : null;
        this.draw();
    }
}
