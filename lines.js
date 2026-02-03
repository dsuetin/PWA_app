// lines.js
export class LinesManager {
    constructor(gridSize = 10) {
        this.gridSize = gridSize;
        this.lines = [];             // {x1,y1,x2,y2,_id}
        this._nextLineId = 1;
        this.currentLine = null;
        this.lastPoint = null;
        this.closedContour = null;
    }

    // ---------- utilities ----------
    _pointKey(x, y) { return `${x},${y}`; }

    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    // ---------- geometry helpers ----------
    isPointStrictlyOnSegment(px, py, L) {
        const minX = Math.min(L.x1, L.x2), maxX = Math.max(L.x1, L.x2);
        const minY = Math.min(L.y1, L.y2), maxY = Math.max(L.y1, L.y2);
        return (
            (L.x1 === L.x2 && px === L.x1 && py > minY && py < maxY) ||
            (L.y1 === L.y2 && py === L.y1 && px > minX && px < maxX)
        );
    }

    isPointOnSegment(px, py, L) {
        const minX = Math.min(L.x1, L.x2), maxX = Math.max(L.x1, L.x2);
        const minY = Math.min(L.y1, L.y2), maxY = Math.max(L.y1, L.y2);
        return (
            (L.x1 === L.x2 && px === L.x1 && py >= minY && py <= maxY) ||
            (L.y1 === L.y2 && py === L.y1 && px >= minX && px <= maxX)
        );
    }

    isStartAllowed(x, y) {
        if (this.lastPoint && x === this.lastPoint.x && y === this.lastPoint.y) return true;
        for (const L of this.lines) if (this.isPointStrictlyOnSegment(x, y, L)) return false;
        return true;
    }

    getLastLineDirection() {
        if (!this.lines.length) return null;
        const L = this.lines[this.lines.length - 1];
        return L.x1 === L.x2 ? "vertical" : "horizontal";
    }

    // ---------- drawing ----------
    startLine(start) {
        if (!this.isStartAllowed(start.x, start.y)) return;
        this.currentLine = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
    }

    applyLineConstraints(x1, y1, x2, y2) {
        const vertical = x1 === x2;
        let best = null;

        for (const L of this.lines) {
            const Lvert = L.x1 === L.x2;

            // пересечение вертикальной с горизонтальной
            if (vertical && !Lvert) {
                const vx = x1, hy = L.y1;
                if (vx >= Math.min(L.x1, L.x2) && vx <= Math.max(L.x1, L.x2) &&
                    ((y2 > y1 && hy > y1 && hy <= y2) || (y2 < y1 && hy < y1 && hy >= y2))) {
                    if (best === null || Math.abs(hy - y1) < Math.abs(best - y1)) best = hy;
                }
            }
            if (!vertical && Lvert) {
                const vy = y1, hx = L.x1;
                if (vy >= Math.min(L.y1, L.y2) && vy <= Math.max(L.y1, L.y2) &&
                    ((x2 > x1 && hx > x1 && hx <= x2) || (x2 < x1 && hx < x1 && hx >= x2))) {
                    if (best === null || Math.abs(hx - x1) < Math.abs(best - x1)) best = hx;
                }
            }

            // параллельные линии (упор)
            if (vertical && Lvert && L.x1 === x1) {
                const y = y2 > y1 ? Math.min(L.y1, L.y2) : Math.max(L.y1, L.y2);
                if ((y2 > y1 && y > y1) || (y2 < y1 && y < y1)) if (best === null || Math.abs(y - y1) < Math.abs(best - y1)) best = y;
            }
            if (!vertical && !Lvert && L.y1 === y1) {
                const x = x2 > x1 ? Math.min(L.x1, L.x2) : Math.max(L.x1, L.x2);
                if ((x2 > x1 && x > x1) || (x2 < x1 && x < x1)) if (best === null || Math.abs(x - x1) < Math.abs(best - x1)) best = x;
            }
        }

        if (best === null) return { x2, y2 };
        return vertical ? { x2, y2: best } : { x2: best, y2 };
    }

    findLimit(x1, y1, x2, y2) {
        const vertical = x1 === x2;
        let limit = null;

        for (const L of this.lines) {
            const Lvert = L.x1 === L.x2;
            if (vertical && Lvert && L.x1 === x1) {
                const ly = y2 > y1 ? Math.min(L.y1, L.y2) : Math.max(L.y1, L.y2);
                if ((y2 > y1 && ly > y1) || (y2 < y1 && ly < y1)) {
                    limit = limit === null ? ly : (y2 > y1 ? Math.min(limit, ly) : Math.max(limit, ly));
                }
            }
            if (!vertical && !Lvert && L.y1 === y1) {
                const lx = x2 > x1 ? Math.min(L.x1, L.x2) : Math.max(L.x1, L.x2);
                if ((x2 > x1 && lx > x1) || (x2 < x1 && lx < x1)) {
                    limit = limit === null ? lx : (x2 > x1 ? Math.min(limit, lx) : Math.max(limit, lx));
                }
            }
            if (vertical && !Lvert) {
                if ((L.x1 <= x1 && x1 <= L.x2) || (L.x2 <= x1 && x1 <= L.x1)) {
                    const yHit = L.y1;
                    if ((y2 > y1 && yHit > y1) || (y2 < y1 && yHit < y1)) {
                        limit = limit === null ? yHit : (y2 > y1 ? Math.min(limit, yHit) : Math.max(limit, yHit));
                    }
                }
            }
            if (!vertical && Lvert) {
                if ((L.y1 <= y1 && y1 <= L.y2) || (L.y2 <= y1 && y1 <= L.y1)) {
                    const xHit = L.x1;
                    if ((x2 > x1 && xHit > x1) || (x2 < x1 && xHit < x1)) {
                        limit = limit === null ? xHit : (x2 > x1 ? Math.min(limit, xHit) : Math.max(limit, xHit));
                    }
                }
            }
        }

        return limit;
    }

    updateLine(pos) {
        if (!this.currentLine) return;
        let { x1, y1 } = this.currentLine;
        let { x, y } = pos;

        const lastDir = this.getLastLineDirection();
        if (lastDir === "horizontal") x = x1;
        else if (lastDir === "vertical") y = y1;
        else if (Math.abs(x - x1) > Math.abs(y - y1)) y = y1;
        else x = x1;

        const limited = this.applyLineConstraints(x1, y1, x, y);
        this.currentLine.x2 = limited.x2;
        this.currentLine.y2 = limited.y2;
    }

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

        const L = { x1, y1, x2, y2, _id: this._nextLineId++ };
        this.lines.push(L);
        this.lastPoint = { x: L.x2, y: L.y2 };
        this.currentLine = null;

        this.closedContour = this.detectClosedContour();
        if (this.closedContour) console.log("Контур замкнут!", this.closedContour);

        return true;
    }

    cancelCurrentLine() {
        this.currentLine = null;
        this.closedContour = this.detectClosedContour();
        if (this.closedContour) console.log("Контур замкнут!", this.closedContour);
    }

    undo() {
        if (this.currentLine) { this.currentLine = null; return; }
        this.lines.pop();
        this.lastPoint = this.lines.length ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 } : null;
        this.currentLine = null;
        this.closedContour = this.detectClosedContour();
        if (this.closedContour) console.log("Контур замкнут!", this.closedContour);
    }

    // ---------- GRAPH + CYCLES ----------
    _buildGraphWithIntersections() {
        const pointsOnLine = this.lines.map(() => new Set());
        const addPointToLine = (i, px, py) => pointsOnLine[i].add(this._pointKey(px, py));

        this.lines.forEach((L, i) => {
            addPointToLine(i, L.x1, L.y1);
            addPointToLine(i, L.x2, L.y2);
        });

        for (let i = 0; i < this.lines.length; i++) {
            const A = this.lines[i], Avert = A.x1 === A.x2;
            for (let j = i + 1; j < this.lines.length; j++) {
                const B = this.lines[j], Bvert = B.x1 === B.x2;
                if (Avert === Bvert) continue;
                let vert = Avert ? A : B, hor = Avert ? B : A;
                const vx = vert.x1, vyMin = Math.min(vert.y1, vert.y2), vyMax = Math.max(vert.y1, vert.y2);
                const hy = hor.y1, hxMin = Math.min(hor.x1, hor.x2), hxMax = Math.max(hor.x1, hor.x2);
                if (hxMin <= vx && vx <= hxMax && vyMin <= hy && hy <= vyMax) {
                    addPointToLine(Avert ? i : j, vx, hy);
                    addPointToLine(Avert ? j : i, vx, hy);
                }
            }
        }

        const graph = new Map();
        const ensureKey = (k) => { if (!graph.has(k)) graph.set(k, []); };

        for (let i = 0; i < this.lines.length; i++) {
            const L = this.lines[i];
            const keys = Array.from(pointsOnLine[i]).map(k => {
                const [px, py] = k.split(",").map(Number);
                return { key: k, x: px, y: py };
            });
            if (L.x1 === L.x2) keys.sort((a, b) => a.y - b.y);
            else keys.sort((a, b) => a.x - b.x);

            for (let p = 0; p < keys.length; p++) ensureKey(keys[p].key);
            for (let p = 0; p < keys.length - 1; p++) {
                const a = keys[p].key, b = keys[p + 1].key;
                graph.get(a).push({ to: b, lineId: L._id });
                graph.get(b).push({ to: a, lineId: L._id });
            }
        }

        return graph;
    }

    _findCyclesInGraph(graph) {
        const cycles = [];
        const keys = Array.from(graph.keys());
        const dfs = (startKey, currentKey, usedLineIds, pathKeys) => {
            for (const edge of graph.get(currentKey) || []) {
                const nextKey = edge.to, lineId = edge.lineId;
                if (usedLineIds.has(lineId)) continue;
                if (nextKey === startKey && pathKeys.length >= 2) {
                    const orderedLineIds = [...pathKeys._edgeOrder || [], lineId];
                    if ((new Set(orderedLineIds)).size === orderedLineIds.length && orderedLineIds.length >= 4) {
                        const linesSeq = orderedLineIds.map(id => this.lines.find(L => L._id === id));
                        cycles.push(linesSeq);
                    }
                    continue;
                }
                usedLineIds.add(lineId);
                if (!pathKeys._edgeOrder) pathKeys._edgeOrder = [];
                pathKeys._edgeOrder.push(lineId);
                pathKeys.push(nextKey);
                dfs(startKey, nextKey, usedLineIds, pathKeys);
                pathKeys.pop();
                pathKeys._edgeOrder.pop();
                if (pathKeys._edgeOrder.length === 0) delete pathKeys._edgeOrder;
                usedLineIds.delete(lineId);
            }
        };

        for (const k of keys) dfs(k, k, new Set(), [k]);
        return cycles;
    }

    _linesToPolygonPoints(linesSeq) {
        if (!linesSeq || !linesSeq.length) return [];
        const pts = [];
        let cur = linesSeq[0];
        pts.push({ x: cur.x1, y: cur.y1 });
        let cx = cur.x2, cy = cur.y2;
        pts.push({ x: cx, y: cy });

        for (let i = 1; i < linesSeq.length; i++) {
            const L = linesSeq[i];
            if (L.x1 === cx && L.y1 === cy) { cx = L.x2; cy = L.y2; }
            else if (L.x2 === cx && L.y2 === cy) { cx = L.x1; cy = L.y1; }
            else { pts.push({ x: L.x1, y: L.y1 }); cx = L.x2; cy = L.y2; }
            pts.push({ x: cx, y: cy });
        }

        const simple = [];
        for (const p of pts) { const last = simple.at(-1); if (!last || last.x !== p.x || last.y !== p.y) simple.push(p); }
        return simple;
    }

    _computeAreaFromPoints(points) {
        if (!points || points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            area += a.x * b.y - b.x * a.y;
        }
        return Math.abs(area / 2);
    }

    detectClosedContour() {
        if (!this.lines.length) { this.closedContour = null; return null; }
        const graph = this._buildGraphWithIntersections();
        const rawCycles = this._findCyclesInGraph(graph);
        if (!rawCycles.length) { this.closedContour = null; return null; }

        let best = null, bestArea = 0;
        for (const seq of rawCycles) {
            const ids = seq.map(L => L && L._id).filter(Boolean);
            if (ids.length !== seq.length) continue;
            if ((new Set(ids)).size !== ids.length) continue;
            const pts = this._linesToPolygonPoints(seq);
            const uniqPoints = new Set(pts.map(p => this._pointKey(p.x, p.y)));
            if (uniqPoints.size < 4) continue;
            const area = this._computeAreaFromPoints(pts);
            if (area <= 1e-6) continue;
            if (area > bestArea) { bestArea = area; best = seq; }
        }

        this.closedContour = best || null;
        return this.closedContour;
    }

    // ---------- IO ----------
    exportData() { return this.lines.map(l => ({ x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,_id:l._id })); }
    importData(lines) {
        this.lines = lines.map(l => ({ x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,_id:l._id ?? this._nextLineId++ }));
        const maxId = this.lines.reduce((m,L)=>Math.max(m,L._id||0),0);
        this._nextLineId = Math.max(this._nextLineId,maxId+1);
        this.lastPoint = this.lines.length ? { x:this.lines.at(-1).x2, y:this.lines.at(-1).y2 } : null;
        this.currentLine = null;
        this.closedContour = this.detectClosedContour();
    }
}
