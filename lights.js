// lights.js
export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.radius = 7;
        this.lights = [];
        this.enabled = false;
        this.editor = null;

        this.isPointerDown = false;
        this.startX = 0;
        this.startY = 0;

        this.DRAG_THRESHOLD = 5; // px

        this.onPointerDown = (e) => {
            if (!this.enabled) return;
            this.isPointerDown = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
        };

        this.onPointerUp = (e) => {
            if (!this.enabled || !this.isPointerDown || !this.editor) return;
            this.isPointerDown = false;

            const dx = Math.abs(e.clientX - this.startX);
            const dy = Math.abs(e.clientY - this.startY);

            // ❌ если это drag — НЕ ставим свет
            if (dx > this.DRAG_THRESHOLD || dy > this.DRAG_THRESHOLD) return;

            // ✅ это клик
            const world = this.editor.screenToWorld(e.clientX, e.clientY);
            this.addLight(world.x, world.y);
        };
    }

    setEditor(editor) {
        this.editor = editor;
    }

    enable() {
        this.enabled = true;
        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("pointerup", this.onPointerUp);
    }

    disable() {
        this.enabled = false;
        this.canvas.removeEventListener("pointerdown", this.onPointerDown);
        this.canvas.removeEventListener("pointerup", this.onPointerUp);
    }

    addLight(x, y) {
        const pos = this.editor.snapToGrid(x, y);
        this.lights.push({ x: pos.x, y: pos.y });
        this.redraw();
    }

    undo() {
        if (this.lights.length === 0) return;
        this.lights.pop();
        this.redraw();
    }

    drawWithOffset(offsetX = 0, offsetY = 0, scale = 1) {
        for (const l of this.lights) {
            const screenX = l.x * scale + offsetX;
            const screenY = l.y * scale + offsetY;
            this.ctx.beginPath();
            this.ctx.fillStyle = "yellow";
            this.ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = "#b59f00";
            this.ctx.stroke();
        }
    }

    redraw() {
        if (!this.editor) return;
        this.editor.draw();
        this.drawWithOffset(
            this.editor.offsetX,
            this.editor.offsetY,
            this.editor.scale
        );
    }

    exportData() {
        return this.lights.map(l => ({ x1: l.x, y1: l.y }));
    }

    importData(list) {
        this.lights = list.map(l => ({ x: l.x1, y: l.y1 }));
        this.redraw();
    }
}
