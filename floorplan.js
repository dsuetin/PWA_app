export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) throw new Error("Canvas not found: " + canvasId);
        this.ctx = this.canvas.getContext("2d");

        // --- ПАРАМЕТРЫ (по умолчанию сетка 10)
        this.gridSize = 10;

        // --- ДАННЫЕ
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;

        // --- СОСТОЯНИЯ
        this.isDrawing = false;
        this.finishLocked = false; // жёсткий lock
        this.enabled = true; // активен по умолчанию

        // ссылка на lights (подключается извне)
        this.lightsDrawer = null;

        // бинды (чтобы можно было removeEventListener при необходимости)
        this._mouseDown = (e) => this.startLine(e);
        this._mouseMove = (e) => this.drawPreview(e);
        this._mouseUp = (e) => this.finishLine(e);

        // touch handlers сделаем умными (не мешают click для lights)
        this._touchStart = (e) => {
            // если редактор включен — мы собираемся рисовать -> блокируем дефолт (чтобы не скроллить)
            if (this.enabled) {
                e.preventDefault();
                this.startLine(e);
            } else {
                // если редактор выключен, не мешаем — позволим click/рост взаимодействий (lights будет получать click)
            }
        };
        this._touchMove = (e) => {
            // preventDefault только если мы реально рисуем (isDrawing)
            if (this.enabled && this.isDrawing) {
                e.preventDefault();
                this.drawPreview(e);
            }
        };
        this._touchEnd = (e) => {
            if (this.enabled && this.isDrawing) {
                e.preventDefault();
                this.finishLine(e);
            }
        };

        // инициализация canvas/resize
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        // mouse events
        this.canvas.addEventListener("mousedown", this._mouseDown);
        this.canvas.addEventListener("mousemove", this._mouseMove);
        this.canvas.addEventListener("mouseup", this._mouseUp);

        // touch events — passive: false, но preventDefault вызывается только при нужде
        this.canvas.addEventListener("touchstart", this._touchStart, { passive: false });
        this.canvas.addEventListener("touchmove", this._touchMove, { passive: false });
        this.canvas.addEventListener("touchend", this._touchEnd, { passive: false });

        // Ctrl+Z undo
        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
            }
        });

        // начальная отрисовка
        this.draw();
    }

    // -------------------------
    // API: enable/disable, связь с lights
    // -------------------------
    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        // если в процессе рисования — отменим preview
        this.isDrawing = false;
        this.currentLine = null;
    }

    setLightsDrawer(ld) {
        this.lightsDrawer = ld;
    }

    // -------------------------
    // Canvas / grid
    // -------------------------
    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
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

    // get pos for mouse/touch
    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();

        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }

        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // -------------------------
    // Вспомогательные
    // -------------------------
    getLastLineDirection() {
        if (this.lines.length === 0) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
    }

    // -------------------------
    // Start line: стартуем всегда из lastPoint если он есть, иначе из позиции клика
    // -------------------------
    startLine(event) {
        if (!this.enabled) return;
        if (this.isDrawing) return;

        const p = this.getEventPos(event);
        const pos = this.snapToGrid(p.x, p.y);

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

    // -------------------------
    // Preview: axis-aligned logic, как в старой версии
    // -------------------------
    drawPreview(event) {
        if (!this.enabled) return;
        if (!this.isDrawing || !this.currentLine) return;

        const p = this.getEventPos(event);
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

    // -------------------------
    // Finish: prompt length, push to lines, update lastPoint
    // -------------------------
    finishLine() {
        if (!this.enabled) return;
        if (!this.isDrawing || !this.currentLine || this.finishLocked) return;

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

        this.lastPoint = {
            x: this.currentLine.x2,
            y: this.currentLine.y2
        };

        this.currentLine = null;
        this.draw();

        setTimeout(() => { this.finishLocked = false; }, 0);
    }

    // -------------------------
    // Drawing: background, grid, lines, preview, then lights
    // -------------------------
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

        for (const L of this.lines) {
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
        // fill
        this.ctx.fillStyle = "#f8f8f8";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawLines();

        if (this.lightsDrawer && typeof this.lightsDrawer.redraw === "function") {
            this.lightsDrawer.redraw();
        }
    }

    // -------------------------
    // Undo (как раньше)
    // -------------------------
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

    // -------------------------
    // Export / Import
    // -------------------------
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

        if (this.lines.length > 0) {
            const L = this.lines[this.lines.length - 1];
            this.lastPoint = { x: L.x2, y: L.y2 };
        } else {
            this.lastPoint = null;
        }

        this.currentLine = null;
        this.isDrawing = false;

        this.draw();
    }
}
