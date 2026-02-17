export class LightsDrawer {
    constructor(canvasId = "canvas") {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.editor = null;
        this.enabled = false;
        this.lights = [];

        this.touchTimer = null; // для задержки одного пальца
        this.TOUCH_DELAY = 70; // мс

        this.canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
        this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this), { passive: false });
    }

    setEditor(editor) { this.editor = editor; }
    enable() { this.enabled = true; }
    disable() { this.enabled = false; }

    onPointerDown(e) {
        if (!this.enabled || !this.editor) return;

        // клики вне канваса
        const rect = this.canvas.getBoundingClientRect();
        if (
            e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom
        ) return;

        // мышь — сразу рисуем свет
        if (e.pointerType === "mouse") {
            this.tryAddLight(e.clientX, e.clientY);
            return;
        }

        // touch — ставим таймер
        if (e.pointerType === "touch") {
            if (this.touchTimer) clearTimeout(this.touchTimer);

            this.touchTimer = setTimeout(() => {
                // Если появился второй палец, отменяем
                if (this.editor.activeTouches && this.editor.activeTouches.length >= 2) return;

                this.tryAddLight(e.clientX, e.clientY);
            }, this.TOUCH_DELAY);
        }
    }

    onTouchStart(e) {
        if (!this.editor) return;
        // сохраняем активные тачи для проверки
        this.editor.activeTouches = [...e.touches];

        if (e.touches.length === 2) {
            this.editor.isPinching = true;
            this.editor.lastPinchDist = this.editor.getPinchDistance(e.touches);
            // отменяем таймер света
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
            }
        }
    }

    tryAddLight(clientX, clientY) {
        if (!this.enabled || !this.editor) return;

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
            "Введите через запятую расстояние до ближайшей вертикальной и горизонтальной стены в см\n" +
            "Пример: 10,15\nОставьте пустым для привязки к сетке"
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
            if (dx !== "" && walls.v !== null) posX = walls.v + Math.sign(world.x - walls.v) * parseFloat(dx);
            if (dy !== "" && walls.h !== null) posY = walls.h + Math.sign(world.y - walls.h) * parseFloat(dy);
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
