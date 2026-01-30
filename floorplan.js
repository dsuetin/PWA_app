export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        // ===== CONFIG =====
        this.gridSize = 10;

        // ===== VIEW =====
        this.offsetX = 0;
        this.offsetY = 0;

        // ===== DATA =====
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;

        // ===== STATE =====
        this.enabled = true;
        this.isDrawing = false;
        this.finishLocked = false;

        // ===== PAN / PINCH =====
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.spacePressed = false;

        this.isPinching = false;
        this.activeTouches = [];

        // ===== LIGHTS =====
        this.lightsDrawer = null;

        // ===== INIT =====
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.canvas.style.touchAction = "none";

        // ===== POINTER EVENTS =====
        this.canvas.addEventListener("pointerdown", e => this.onPointerDown(e));
        this.canvas.addEventListener("pointermove", e => this.onPointerMove(e));
        this.canvas.addEventListener("pointerup", e => this.onPointerUp(e));
        this.canvas.addEventListener("pointercancel", e => this.onPointerUp(e));

        // ===== TOUCH (PINCH) =====
        this.canvas.addEventListener("touchstart", e => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener("touchmove", e => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener("touchend", e => this.onTouchEnd(e));

        // ===== KEYBOARD =====
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
        this.currentLine = null;
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

    // ------------------------------------------------
    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left - this.offsetX,
            y: clientY - rect.top - this.offsetY
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

    // ------------------------------------------------
    onPointerDown(e) {
        this.canvas.setPointerCapture(e.pointerId);

        // 🖐 PAN
        if (
            this.spacePressed ||
            (e.pointerType === "touch" && !e.isPrimary)
        ) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;

            // отменяем текущую линию
            this.currentLine = null;
            this.isDrawing = false;
            return;
        }

        if (!this.enabled || this.isDrawing || this.isPinching) return;

        const start = this.lastPoint
            ? { ...this.lastPoint }
            : this.snapToGrid(
                ...Object.values(this.screenToWorld(e.clientX, e.clientY))
            );

        this.currentLine = {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y
        };

        this.isDrawing = true;
    }

    // ------------------------------------------------
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

        if (!this.isDrawing || !this.currentLine) return;

        const p = this.screenToWorld(e.clientX, e.clientY);
        let pos = this.snapToGrid(p.x, p.y);

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

    // ------------------------------------------------
    onPointerUp() {
        if (this.isPanning) {
            this.isPanning = false;
            return;
        }

        if (!this.isDrawing || !this.currentLine || this.finishLocked) return;

        this.finishLocked = true;
        this.isDrawing = false;

        // ===== ОДНО ДИАЛОГОВОЕ ОКНО =====
        const lenStr = prompt(
            "Введите длину линии в пикселях (Отмена — отменить линию):"
        );

        // ❌ Cancel
        if (lenStr === null) {
            this.currentLine = null;
            this.draw();
            this.finishLocked = false;
            return;
        }

        // ✅ OK + длина
        if (lenStr !== "" && !isNaN(lenStr)) {
            const length = parseInt(lenStr, 10);
            const dx = this.currentLine.x2 - this.currentLine.x1;
            const dy = this.currentLine.y2 - this.currentLine.y1;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentLine.x2 =
                    this.currentLine.x1 + Math.sign(dx) * length;
                this.currentLine.y2 = this.currentLine.y1;
            } else {
                this.currentLine.x2 = this.currentLine.x1;
                this.currentLine.y2 =
                    this.currentLine.y1 + Math.sign(dy) * length;
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

    // ------------------------------------------------
    onTouchStart(e) {
        if (e.touches.length === 2) {
            this.isPinching = true;

            // отменяем текущую линию
            this.currentLine = null;
            this.isDrawing = false;

            this.activeTouches = [...e.touches];
            e.preventDefault();
        }
    }

    onTouchMove(e) {
        if (this.isPinching && e.touches.length === 2) {
            const prevCenterX =
                (this.activeTouches[0].clientX + this.activeTouches[1].clientX) / 2;
            const prevCenterY =
                (this.activeTouches[0].clientY + this.activeTouches[1].clientY) / 2;

            const newCenterX =
                (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const newCenterY =
                (e.touches[0].clientY + e.touches[1].clientY) / 2;

            this.offsetX += newCenterX - prevCenterX;
            this.offsetY += newCenterY - prevCenterY;

            this.activeTouches = [...e.touches];
            this.draw();
            e.preventDefault();
        }
    }

    onTouchEnd(e) {
        if (e.touches.length < 2) {
            this.isPinching = false;
            this.activeTouches = [];
        }
    }

    // ------------------------------------------------
    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;

        const w = this.canvas.width;
        const h = this.canvas.height;

        const startX = -this.offsetX;
        const startY = -this.offsetY;
        const endX = startX + w;
        const endY = startY + h;

        const firstX = Math.floor(startX / this.gridSize) * this.gridSize;
        const firstY = Math.floor(startY / this.gridSize) * this.gridSize;

        for (let x = firstX; x <= endX; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x + this.offsetX, 0);
            ctx.lineTo(x + this.offsetX, h);
            ctx.stroke();
        }

        for (let y = firstY; y <= endY; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y + this.offsetY);
            ctx.lineTo(w, y + this.offsetY);
            ctx.stroke();
        }
    }

    drawLines() {
        const ctx = this.ctx;
        ctx.lineWidth = 3;

        ctx.strokeStyle = "#00bfff";
        for (const L of this.lines) {
            ctx.beginPath();
            ctx.moveTo(L.x1 + this.offsetX, L.y1 + this.offsetY);
            ctx.lineTo(L.x2 + this.offsetX, L.y2 + this.offsetY);
            ctx.stroke();
        }

        if (this.currentLine) {
            ctx.strokeStyle = "#ff0080";
            ctx.beginPath();
            ctx.moveTo(
                this.currentLine.x1 + this.offsetX,
                this.currentLine.y1 + this.offsetY
            );
            ctx.lineTo(
                this.currentLine.x2 + this.offsetX,
                this.currentLine.y2 + this.offsetY
            );
            ctx.stroke();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#f8f8f8";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawLines();

        if (this.lightsDrawer) {
            this.lightsDrawer.drawWithOffset(this.offsetX, this.offsetY);
        }
    }

    // ------------------------------------------------
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

    setGridSize(size) {
        this.gridSize = size;
        this.draw();
    }

    exportData() {
        return this.lines.map(l => ({ ...l }));
    }

    importData(lines) {
        this.lines = lines.map(l => ({ ...l }));

        if (this.lines.length > 0) {
            const last = this.lines[this.lines.length - 1];
            this.lastPoint = { x: last.x2, y: last.y2 };
        } else {
            this.lastPoint = null;
        }

        this.currentLine = null;
        this.draw();
    }
}
