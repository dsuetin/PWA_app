export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.editor = null;
        this.enabled = false;

        this.lights = [];

        this.isPointerDown = false;
        this.startX = 0;
        this.startY = 0;

        this.DRAG_THRESHOLD = 5;

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("pointerup", this.onPointerUp);
    }

    setEditor(editor) {
        this.editor = editor;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        this.isPointerDown = false;
    }

    onPointerDown(e) {
        if (!this.enabled) return;

        this.isPointerDown = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    onPointerUp(e) {
        if (!this.enabled || !this.isPointerDown || !this.editor) return;

        this.isPointerDown = false;

        const dx = Math.abs(e.clientX - this.startX);
        const dy = Math.abs(e.clientY - this.startY);

        // drag — не ставим свет
        if (dx > this.DRAG_THRESHOLD || dy > this.DRAG_THRESHOLD) return;

        const world = this.editor.screenToWorld(e.clientX, e.clientY);
        this.addLight(world.x, world.y);
    }

    addLight(x, y) {
        this.lights.push({ x1: x, y1: y });
        // мгновенная перерисовка
        this.editor?.draw();
    }

    undo() {
        this.lights.pop();
    }

    drawWithOffset(offsetX, offsetY, scale = 1) {
        if (!this.enabled && !this.editor) return;

        const ctx = this.ctx;

        for (const L of this.lights) {
            const sx = L.x1 * scale + offsetX;
            const sy = L.y1 * scale + offsetY;

            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#ffcc00";
            ctx.fill();
            ctx.strokeStyle = "#000";
            ctx.stroke();
        }
    }

    exportData() {
        return this.lights.map(l => ({ x1: l.x1, y1: l.y1 }));
    }

    importData(arr) {
        this.lights = arr.map(l => ({ x1: l.x1, y1: l.y1 }));
    }
}
