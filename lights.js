export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.enabled = false;
        this.radius = 7; // уменьшенный радиус
        this.lights = []; // массив всех кругов

        this.handleClick = this.handleClick.bind(this);
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.canvas.addEventListener("click", this.handleClick);
        this.redraw();
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.canvas.removeEventListener("click", this.handleClick);
    }

    handleClick(event) {
        if (!this.enabled) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.lights.push({ x, y });
        this.redraw();
    }

    undo() {
        if (this.lights.length === 0) return;
        this.lights.pop();
        this.redraw();
    }

    redraw() {
        // Сначала рисуем floorEditor, если есть
        // (на самом деле, canvas уже чистится floorEditor при draw)
        // Поэтому мы просто перерисовываем все круги поверх холста
        for (const l of this.lights) {
            this.drawCircle(l.x, l.y);
        }
    }

    drawCircle(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = "yellow";
        this.ctx.fill();
    }
}
