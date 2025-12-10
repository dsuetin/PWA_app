export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = 25;
        this.lines = [];
        this.currentLine = null;
        this.isDrawing = false;
        this.lastPoint = { x: 0, y: 0 }; // начало первой линии в (0,0)

        this.canvas.addEventListener("mousedown", (e) => this.startLine(e));
        this.canvas.addEventListener("mousemove", (e) => this.drawPreview(e));
        this.canvas.addEventListener("mouseup", (e) => this.finishLine(e));

        this.draw();
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    startLine(event) {
        // Начало линии всегда с конца предыдущей
        this.currentLine = { x1: this.lastPoint.x, y1: this.lastPoint.y, x2: null, y2: null };
        this.isDrawing = true;
    }

    drawPreview(event) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        let pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        pos = this.snapToGrid(pos.x, pos.y);

        // Горизонтальная или вертикальная линия
        const dx = Math.abs(pos.x - this.currentLine.x1);
        const dy = Math.abs(pos.y - this.currentLine.y1);
        if (dx > dy) pos.y = this.currentLine.y1;
        else pos.x = this.currentLine.x1;

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;

        this.draw();
    }

    finishLine(event) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Спрашиваем длину линии в момент фиксации второй точки
        const len = prompt("Введите длину линии в пикселях (оставьте пустым для свободной длины):");
        if (len && !isNaN(len)) {
            const length = parseInt(len);

            const dx = this.currentLine.x2 - this.currentLine.x1;
            const dy = this.currentLine.y2 - this.currentLine.y1;
            const angle = Math.atan2(dy, dx);

            // Корректируем координаты x2, y2 по длине
            this.currentLine.x2 = this.currentLine.x1 + Math.round(length * Math.cos(angle));
            this.currentLine.y2 = this.currentLine.y1 + Math.round(length * Math.sin(angle));
        }

        // Сохраняем линию
        this.lines.push({ ...this.currentLine });
        // Обновляем конец последней линии
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

        if (this.currentLine && this.currentLine.x2 !== null) {
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
}
