export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.editor = null;
        this.enabled = false;
        this.lights = [];

        this.touchTimer = null;
        this.TOUCH_DELAY = 80; // чуть больше — стабильнее на iOS

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);

        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    }

    setEditor(editor) { this.editor = editor; }
    enable() { this.enabled = true; }
    disable() {
        this.enabled = false;
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    // -----------------------
    // POINTER (мышь + первый палец)
    // -----------------------

    onPointerDown(e) {
        if (!this.enabled || !this.editor) return;

        // ❌ если уже pinch / pan — вообще игнор
        if (this.editor.isPinching || this.editor.isPanning) return;

        // ❌ второй палец (Pointer API)
        if (e.pointerType === "touch" && !e.isPrimary) return;

        // ❌ не canvas
        if (e.target !== this.canvas) return;

        e.stopPropagation();

        // мышь — сразу
        if (e.pointerType === "mouse") {
            this.tryAddLight(e.clientX, e.clientY);
            return;
        }

        // touch — через задержку
        if (e.pointerType === "touch") {
            if (this.touchTimer) clearTimeout(this.touchTimer);

            this.touchTimer = setTimeout(() => {

                // ❌ появился второй палец
                if (this.editor.activeTouches?.length >= 2) return;

                // ❌ начали пан/зум
                if (this.editor.isPinching || this.editor.isPanning) return;

                this.tryAddLight(e.clientX, e.clientY);

            }, this.TOUCH_DELAY);
        }
    }

    // -----------------------
    // TOUCH START (ловим второй палец)
    // -----------------------

    onTouchStart(e) {
        if (!this.editor) return;

        this.editor.activeTouches = [...e.touches];

        // если два пальца — это навигация
        if (e.touches.length >= 2) {
            this.editor.isPinching = true;

            // ❌ отменяем свет
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
            }

            return;
        }
    }

    // -----------------------
    // ADD LIGHT
    // -----------------------

    tryAddLight(clientX, clientY) {
        if (!this.enabled || !this.editor) return;
        if (this.editor.isPinching || this.editor.isPanning) return;

        const world = this.editor.screenToWorld(clientX, clientY);
        const lm = this.editor.linesManager;
        const contour = lm.closedContour;

        if (!contour) {
            alert("Сначала замкните контур помещения");
            return;
        }

        if (!lm.isPointInside(world.x, world.y)) {
            alert("Светильник можно ставить только внутри контура");
            return;
        }

        if (!lm.areAllAnglesRight()) {
            alert("Нельзя расставлять свет: контур должен быть прямоугольным");
            return;
        }

        const input = prompt(
            "Введите расстояние до вертикальной и горизонтальной стены\nПример: 60,40"
        );
        if (input === null) return;

        let [dxStr = "", dyStr = ""] = input.split(",").map(s => s.trim());

        const dx = dxStr ? parseFloat(dxStr) : null;
        const dy = dyStr ? parseFloat(dyStr) : null;

        let posX = world.x;
        let posY = world.y;

        // собираем сегменты контура
        const segs = [];
        for (let i = 0; i < contour.length - 1; i++) {
            const a = contour[i];
            const b = contour[i + 1];
            segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }

        let bestVertical = null;
        let bestVerticalDist = Infinity;

        let bestHorizontal = null;
        let bestHorizontalDist = Infinity;

        for (const s of segs) {
            // вертикальная стена
            if (s.x1 === s.x2) {
                const wallX = s.x1;

                const minY = Math.min(s.y1, s.y2);
                const maxY = Math.max(s.y1, s.y2);

                // перпендикуляр должен попадать в сегмент
                if (world.y >= minY && world.y <= maxY) {
                    const dist = Math.abs(world.x - wallX);

                    if (dist < bestVerticalDist) {
                        bestVerticalDist = dist;
                        bestVertical = s;
                    }
                }
            }

            // горизонтальная стена
            if (s.y1 === s.y2) {
                const wallY = s.y1;

                const minX = Math.min(s.x1, s.x2);
                const maxX = Math.max(s.x1, s.x2);

                if (world.x >= minX && world.x <= maxX) {
                    const dist = Math.abs(world.y - wallY);

                    if (dist < bestHorizontalDist) {
                        bestHorizontalDist = dist;
                        bestHorizontal = s;
                    }
                }
            }
        }

        // вычисляем позицию
        if (dx !== null && bestVertical) {
            const wallX = bestVertical.x1;
            posX = wallX + Math.sign(world.x - wallX) * dx;
        }

        if (dy !== null && bestHorizontal) {
            const wallY = bestHorizontal.y1;
            posY = wallY + Math.sign(world.y - wallY) * dy;
        }

        // snap к сетке всегда
        const snap = this.editor.snapToGrid(posX, posY);
        posX = snap.x;
        posY = snap.y;

        this.lights.push({ x1: posX, y1: posY });
        this.editor.draw();
    }

    undo() {
        if (this.lights.length) {
            this.lights.pop();
            this.editor?.draw();
        }
    }

    drawWithOffset(offsetX, offsetY, scale = 1) {
        if (!this.editor) return;

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

    exportData() { return this.lights.map(l => ({ x1: l.x1, y1: l.y1 })); }
    importData(arr) { this.lights = arr.map(l => ({ x1: l.x1, y1: l.y1 })); }
}
