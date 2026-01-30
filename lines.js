// lines.js
export class LinesManager {
    constructor(gridSize = 10) {
        this.gridSize = gridSize;
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;
    }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    getLastLineDirection() {
        if (this.lines.length === 0) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
    }

    startLine(start) {
        this.currentLine = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
    }

    updateLine(pos) {
        if (!this.currentLine) return;

        const lastDir = this.getLastLineDirection();

        if (lastDir === "horizontal") pos.x = this.currentLine.x1;
        else if (lastDir === "vertical") pos.y = this.currentLine.y1;
        else {
            const dx = Math.abs(pos.x - this.currentLine.x1);
            const dy = Math.abs(pos.y - this.currentLine.y1);
            if (dx > dy) pos.y = this.currentLine.y1;
            else pos.x = this.currentLine.x1;
        }

        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;
    }

    finishLine(length) {
        if (!this.currentLine) return;

        if (length && !isNaN(length)) {
            const dx = this.currentLine.x2 - this.currentLine.x1;
            const dy = this.currentLine.y2 - this.currentLine.y1;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentLine.x2 = this.currentLine.x1 + Math.sign(dx) * length;
                this.currentLine.y2 = this.currentLine.y1;
            } else {
                this.currentLine.x2 = this.currentLine.x1;
                this.currentLine.y2 = this.currentLine.y1 + Math.sign(dy) * length;
            }
        }

        this.lines.push({ ...this.currentLine });
        this.lastPoint = { x: this.currentLine.x2, y: this.currentLine.y2 };
        this.currentLine = null;
    }

    cancelCurrentLine() {
        this.currentLine = null;
    }

    undo() {
        if (this.lines.length === 0) return;
        this.lines.pop();
        if (this.lines.length > 0) {
            const last = this.lines[this.lines.length - 1];
            this.lastPoint = { x: last.x2, y: last.y2 };
        } else {
            this.lastPoint = null;
        }
    }

    exportData() {
        return this.lines.map(l => ({ ...l }));
    }

    importData(lines) {
        this.lines = lines.map(l => ({ ...l }));
        if (this.lines.length > 0) {
            const last = this.lines[this.lines.length - 1];
            this.lastPoint = { x: last.x2, y: last.y2 };
        } else {
            this.lastPoint = null;
        }
        this.currentLine = null;
    }
}
