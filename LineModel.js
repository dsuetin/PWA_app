export class LineModel {
    constructor() {
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;
    }

    startLine(start) {
        this.currentLine = {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y
        };
    }

    updateLine(pos) {
        if (!this.currentLine) return;
        this.currentLine.x2 = pos.x;
        this.currentLine.y2 = pos.y;
    }

    finishLine(adjustLengthCallback = null) {
        if (!this.currentLine) return null;

        if (adjustLengthCallback) {
            adjustLengthCallback(this.currentLine);
        }

        this.lines.push({ ...this.currentLine });
        this.lastPoint = {
            x: this.currentLine.x2,
            y: this.currentLine.y2
        };

        const finished = this.currentLine;
        this.currentLine = null;
        return finished;
    }

    undo() {
        if (this.lines.length === 0) return;

        this.lines.pop();

        if (this.lines.length > 0) {
            const L = this.lines[this.lines.length - 1];
            this.lastPoint = { x: L.x2, y: L.y2 };
        } else {
            this.lastPoint = null;
        }
    }

    getLastLineDirection() {
        if (this.lines.length === 0) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
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
