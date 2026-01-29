export class PanController {
    constructor() {
        this.isPanning = false;
        this.panMoved = false;
        this.lastX = 0;
        this.lastY = 0;

        this.offsetX = 0;
        this.offsetY = 0;
    }

    start(x, y) {
        this.isPanning = true;
        this.panMoved = false;
        this.lastX = x;
        this.lastY = y;
    }

    move(x, y) {
        if (!this.isPanning) return;

        const dx = x - this.lastX;
        const dy = y - this.lastY;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.panMoved = true;

        this.offsetX += dx;
        this.offsetY += dy;

        this.lastX = x;
        this.lastY = y;
    }

    end() {
        this.isPanning = false;
        this.panMoved = false;
    }
}
