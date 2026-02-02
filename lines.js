// lines.js
export class LinesManager {
    constructor(gridSize = 10) {
        this.gridSize = gridSize;
        this.lines = [];
        this.currentLine = null;
        this.lastPoint = null;
    }

    // ---------- GRID ----------

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    // ---------- HELPERS ----------

    isPointOnSegment(px, py, L) {
        const minX = Math.min(L.x1, L.x2);
        const maxX = Math.max(L.x1, L.x2);
        const minY = Math.min(L.y1, L.y2);
        const maxY = Math.max(L.y1, L.y2);

        return (
            (L.x1 === L.x2 && px === L.x1 && py > minY && py < maxY) ||
            (L.y1 === L.y2 && py === L.y1 && px > minX && px < maxX)
        );
    }

    isStartAllowed(x, y) {
        for (const L of this.lines) {
            if (this.isPointOnSegment(x, y, L)) return false;
        }
        return true;
    }

    getLastLineDirection() {
        if (!this.lines.length) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
    }

    // ---------- START ----------

    startLine(start) {
        if (!this.isStartAllowed(start.x, start.y)) return;

        this.currentLine = {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y
        };
    }

    // ---------- LIMITS ----------

    findLimit(x1, y1, x2, y2) {
        const vertical = x1 === x2;
        let limit = null;

        for (const L of this.lines) {
            const Lvert = L.x1 === L.x2;

            // parallel
            if (vertical && Lvert && L.x1 === x1) {
                const ly = y2 > y1 ? Math.min(L.y1, L.y2) : Math.max(L.y1, L.y2);
                if ((y2 > y1 && ly > y1) || (y2 < y1 && ly < y1)) {
                    limit = limit === null
                        ? ly
                        : y2 > y1
                            ? Math.min(limit, ly)
                            : Math.max(limit, ly);
                }
            }

            if (!vertical && !Lvert && L.y1 === y1) {
                const lx = x2 > x1 ? Math.min(L.x1, L.x2) : Math.max(L.x1, L.x2);
                if ((x2 > x1 && lx > x1) || (x2 < x1 && lx < x1)) {
                    limit = limit === null
                        ? lx
                        : x2 > x1
                            ? Math.min(limit, lx)
                            : Math.max(limit, lx);
                }
            }

            // perpendicular
            if (vertical && !Lvert) {
                if (
                    (L.x1 <= x1 && x1 <= L.x2) ||
                    (L.x2 <= x1 && x1 <= L.x1)
                ) {
                    const yHit = L.y1;
                    if ((y2 > y1 && yHit > y1) || (y2 < y1 && yHit < y1)) {
                        limit = limit === null
                            ? yHit
                            : y2 > y1
                                ? Math.min(limit, yHit)
                                : Math.max(limit, yHit);
                    }
                }
            }

            if (!vertical && Lvert) {
                if (
                    (L.y1 <= y1 && y1 <= L.y2) ||
                    (L.y2 <= y1 && y1 <= L.y1)
                ) {
                    const xHit = L.x1;
                    if ((x2 > x1 && xHit > x1) || (x2 < x1 && xHit < x1)) {
                        limit = limit === null
                            ? xHit
                            : x2 > x1
                                ? Math.min(limit, xHit)
                                : Math.max(limit, xHit);
                    }
                }
            }
        }

        return limit;
    }

    // ---------- UPDATE ----------

    updateLine(pos) {
        if (!this.currentLine) return;

        let { x1, y1 } = this.currentLine;
        let { x, y } = pos;

        const lastDir = this.getLastLineDirection();

        if (lastDir === "horizontal") x = x1;
        else if (lastDir === "vertical") y = y1;
        else {
            if (Math.abs(x - x1) > Math.abs(y - y1)) y = y1;
            else x = x1;
        }

        const limit = this.findLimit(x1, y1, x, y);
        if (limit !== null) {
            if (x1 === x) y = Math.abs(y - y1) < Math.abs(limit - y1) ? y : limit;
            else x = Math.abs(x - x1) < Math.abs(limit - x1) ? x : limit;
        }

        this.currentLine.x2 = x;
        this.currentLine.y2 = y;
    }

    // ---------- FINISH ----------

    finishLine(length) {
        if (!this.currentLine) return;

        let { x1, y1, x2, y2 } = this.currentLine;

        if (length && !isNaN(length)) {
            if (x1 === x2) y2 = y1 + Math.sign(y2 - y1) * length;
            else x2 = x1 + Math.sign(x2 - x1) * length;
        }

        const limit = this.findLimit(x1, y1, x2, y2);
        if (limit !== null) {
            if (x1 === x2 && Math.abs(y2 - y1) > Math.abs(limit - y1)) y2 = limit;
            if (y1 === y2 && Math.abs(x2 - x1) > Math.abs(limit - x1)) x2 = limit;
        }

        this.lines.push({ x1, y1, x2, y2 });
        this.lastPoint = { x: x2, y: y2 };
        this.currentLine = null;
    }

    // ---------- MISC ----------

    cancelCurrentLine() {
        this.currentLine = null;
    }

    undo() {
        if (!this.lines.length) return;
        this.lines.pop();
        this.lastPoint = this.lines.length
            ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
            : null;
    }

    exportData() {
        return this.lines.map(l => ({ ...l }));
    }

    importData(lines) {
        this.lines = lines.map(l => ({ ...l }));
        this.lastPoint = this.lines.length
            ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
            : null;
        this.currentLine = null;
    }
}
