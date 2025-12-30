export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.enabled = false;

        this.radius = 7; // уменьшенный радиус
        this.lights = [];

        // бинды
        this.onClick = (e) => this.addLight(e);

        this.canvas.addEventListener("click", this.onClick);
    }

    /* ===================== MODES ===================== */

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    /* ===================== DRAW ===================== */

    addLight(e) {
        if (!this.enabled) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.lights.push({ x, y });
        this.redraw();
    }

    redraw() {
        const ctx = this.ctx;

        ctx.save();
        ctx.fillStyle = "yellow";
        ctx.strokeStyle = "#b59f00";
        ctx.lineWidth = 2;

        for (const l of this.lights) {
            ctx.beginPath();
            ctx.arc(l.x, l.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    /* ===================== UNDO ===================== */

    undo() {
        if (this.lights.length === 0) return;
        this.lights.pop();
    }

    /* ===================== EXPORT / IMPORT ===================== */

    exportData() {
        return this.lights.map(l => ({
            type: "light",
            x1: l.x,
            y1: l.y
        }));
    }

    importData(lights) {
        this.lights = lights.map(l => ({
            x: l.x1,
            y: l.y1
        }));
    }
}
