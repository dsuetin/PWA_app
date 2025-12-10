// floorplan.js — редактор плана с вводом длины линии
export class FloorPlanEditor {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = 25;        // размер одной клетки сетки (px)
        this.cmPerGrid = 10;       // сколько см в одной клетке
        this.pxPerCm = this.gridSize / this.cmPerGrid;

        this.lines = [];
        this.currentLine = null;

        this.isDrawing = false;

        this.canvas.addEventListener("mousedown", (e) => this.startLine(e));
        this.canvas.addEventListener("mousemove", (e) => this.drawPreview(e));
        this.canvas.addEventListener("mouseup", (e) => this.finishLine(e));

        this.draw();
    }

    // привязка к сетке
    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    startLine(event) {
        const rect = this.canvas.getBoundingClientRect();
        const pos = this.snapToGrid(event.clientX - rect.left, event.clientY - rect.top);

        this.currentLine = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
        this.isDrawing = true;
    }

    drawPreview(event) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        let pos = this.snapToGrid(event.clientX - rect.left, event.clientY - rect.top);

        // разрешены только вертикальные и горизонтальные линии
        const dx = Math.abs(pos.x - this.currentLine.x1);
        const dy = Math.abs(pos.y - this.currentLine.y1);

        if (dx > dy) pos.y = this.currentLine.y1; // горизонтальная
        else pos.x = this.currentLine.x1;         // вертикальная

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;

        this.draw();
    }

    finishLine() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const L = { ...this.currentLine };
        this.currentLine = null;

        // вычисляем текущую длину
        const distPx = Math.hypot(L.x2 - L.x1, L.y2 - L.y1);
        const distCm = distPx / this.pxPerCm;

        // запросить длину у пользователя
        let userLength = prompt(`Введите длину линии в см (предварительная: ${distCm.toFixed(1)} см):`);
        if (!userLength) return;

        userLength = parseFloat(userLength);
        if (isNaN(userLength) || userLength <= 0) {
            alert("Некорректная длина");
            return;
        }

        // масштабируем линию под требуемую длину
        const scale = (userLength * this.pxPerCm) / distPx;

        L.x2 = L.x1 + (L.x2 - L.x1) * scale;
        L.y2 = L.y1 + (L.y2 - L.y1) * scale;

        this.lines.push(L);

        this.draw();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#333";
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawLines();
    }
}
