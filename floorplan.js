export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = 25;
        this.lines = [];
        this.currentLine = null;
        this.isDrawing = false;
        this.lineLength = null; // фиксированная длина линии

        // Последняя точка для цепочки линий
        this.lastPoint = null;

        this.canvas.addEventListener("mousedown", (e) => this.startLine(e));
        this.canvas.addEventListener("mousemove", (e) => this.drawPreview(e));
        this.canvas.addEventListener("mouseup", (e) => this.finishLine(e));

        this.draw();
    }

    setLineLength(len) {
        this.lineLength = len;
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

        // если есть lastPoint, начинаем с него
        if (this.lastPoint) pos = { x: this.lastPoint.x, y: this.lastPoint.y };
        else pos = this.snapToGrid(pos.x, pos.y);

        this.currentLine = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
        this.isDrawing = true;
    }

    drawPreview(event) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        let pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };

        // Сетка или от конца предыдущей линии
        pos = this.snapToGrid(pos.x, pos.y);

        // Горизонтальная или вертикальная
        const dx = Math.abs(pos.x - this.currentLine.x1);
        const dy = Math.abs(pos.y - this.currentLine.y1);
        if (dx > dy) pos.y = this.currentLine.y1;
        else pos.x = this.currentLine.x1;

        // Ограничение длины линии
        if (this.lineLength) {
            if (dx > dy) pos.x = this.currentLine.x1 + Math.sign(pos.x - this.currentLine.x1) * this.lineLength;
            else pos.y = this.currentLine.y1 + Math.sign(pos.y - this.currentLine.y1) * this.lineLength;
        }

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;

        this.draw();
    }

    finishLine(event) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

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
        this.ctx.fillStyle = "#f8f8f8"; // фон
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawLines();
    }
}
