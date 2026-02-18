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

        // ❌ если навигация
        if (this.editor.isPinching || this.editor.isPanning) return;

        const world = this.editor.screenToWorld(clientX, clientY);

        if (!this.editor.linesManager.closedContour) {
            alert("Сначала замкните контур помещения");
            return;
        }

        if (!this.editor.linesManager.isPointInside(world.x, world.y)) {
            alert("Светильник можно ставить только внутри контура");
            return;
        }

        const input = prompt(
            "Введите через запятую расстояние до ближайшей вертикальной и горизонтальной стены (см)\n" +
            "Пример: 10,15\n" +
            "Пусто — привязка к сетке"
        );

        if (input === null) return;

        let [dxStr, dyStr] = input.split(",").map(s => s.trim());
        const dx = dxStr || "";
        const dy = dyStr || "";

        let posX = world.x;
        let posY = world.y;

        if (dx === "" && dy === "") {
            const snap = this.editor.snapToGrid(world.x, world.y);
            posX = snap.x;
            posY = snap.y;
        } else {
            const walls = this.editor.linesManager.getNearestWalls(world.x, world.y);

            if (dx !== "" && walls.v !== null) {
                posX = walls.v + Math.sign(world.x - walls.v) * parseFloat(dx);
            }

            if (dy !== "" && walls.h !== null) {
                posY = walls.h + Math.sign(world.y - walls.h) * parseFloat(dy);
            }
        }

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
