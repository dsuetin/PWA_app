export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = 25;
        this.lines = [];
        this.currentLine = null;
        this.isDrawing = false;
        this.lastPoint = null; // конец предыдущей линии

        // события мыши
        this.canvas.addEventListener("mousedown", (e) => this.startLine(e));
        this.canvas.addEventListener("mousemove", (e) => this.drawPreview(e));
        this.canvas.addEventListener("mouseup", (e) => this.finishLine(e));

        // Ctrl+Z для Undo
        window.addEventListener("keydown", (e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z";
            if (isUndo) {
                e.preventDefault();
                this.undo();
            }
        });

        this.draw();
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    startLine(event) {
        const rect = this.canvas.getBoundingClientRect();
        let pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        pos = this.snapToGrid(pos.x, pos.y);

        // начало линии с конца предыдущей, если есть
        const start = this.lastPoint ? { ...this.lastPoint } : pos;

        this.currentLine = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
        this.isDrawing = true;
    }

    drawPreview(event) {
        if (!this.isDrawing || !this.currentLine) return;

        const rect = this.canvas.getBoundingClientRect();
        let pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        pos = this.snapToGrid(pos.x, pos.y);

        const dx = Math.abs(pos.x - this.currentLine.x1);
        const dy = Math.abs(pos.y - this.currentLine.y1);

        if (dx > dy) {
            pos.y = this.currentLine.y1;
        } else {
            pos.x = this.currentLine.x1;
        }

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;

        this.draw();
    }

    finishLine() {
        if (!this.isDrawing || !this.currentLine) return;
        this.isDrawing = false;

        const lenStr = prompt("Введите длину линии в пикселях (оставьте пустым для свободной длины):");
        if (lenStr && !isNaN(lenStr)) {
            const length = parseInt(lenStr);
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
    }

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
        this.ctx.fillStyle = "#f8f8f8";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawLines();
    }

    // -------------------------
    // Undo только последней линии
    // -------------------------
    undo() {
        if (this.lines.length === 0) {
            this.lastPoint = null;
            this.draw();
            return;
        }

        this.lines.pop();

        if (this.lines.length > 0) {
            const lastLine = this.lines[this.lines.length - 1];
            this.lastPoint = { x: lastLine.x2, y: lastLine.y2 };
        } else {
            this.lastPoint = null;
        }

        this.draw();
    }
}
