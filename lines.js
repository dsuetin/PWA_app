// lines.js
export class LinesManager {
    constructor(gridSize = 10) {
        this.gridSize = gridSize;
        this.lines = [];             // {x1,y1,x2,y2,_id}
        this._nextLineId = 1;
        this.currentLine = null;
        this.lastPoint = null;
        this.closedContour = null;
        this.selectedSegmentIndex = null;
        this.EPS = 1.1;

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

        // определяем ориентацию линии по свободному концу (горизонтальная/вертикальная)
        let vertical = null;

        if (this.lines.length) {
            // ищем все линии, соединённые с этой точкой
            for (const L of this.lines) {
                if ((L.x1 === start.x && L.y1 === start.y) || (L.x2 === start.x && L.y2 === start.y)) {
                    vertical = L.x1 === L.x2;
                    break;
                }
            }
        }

        // если не нашли — по умолчанию вертикальная
        if (vertical === null) vertical = true;

        this.currentLine = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
        this.currentLineVertical = vertical;
    }

    applyLineConstraints(x1, y1, x2, y2) {
        const vertical = x1 === x2;
        let best = null;

        for (const L of this.lines) {
            const Lvert = L.x1 === L.x2;

            // пересечение вертикальной с горизонтальной
            if (vertical && !Lvert) {
                const vx = x1, hy = L.y1;
                if (vx >= Math.min(L.x1, L.x2) - this.EPS && vx <= Math.max(L.x1, L.x2) + this.EPS &&
                    ((y2 > y1 && hy > y1 && hy <= y2) || (y2 < y1 && hy < y1 && hy >= y2))) {
                    if (best === null || Math.abs(hy - y1) < Math.abs(best - y1)) best = hy;
                }
            }
            if (!vertical && Lvert) {
                const vy = y1, hx = L.x1;
                if (vy >= Math.min(L.y1, L.y2) - this.EPS && vy <= Math.max(L.y1, L.y2) + this.EPS &&
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

        // -----------------------------
        // 1️⃣ Определяем направление линии относительно свободного конца
        // -----------------------------
        let vertical;

        // если есть предыдущая точка — берём направление линии в ней
        if (this.lastPoint) {
            const dir = this.getDirectionAtPoint(this.lastPoint.x, this.lastPoint.y);

            if (dir === "horizontal") vertical = true;
            else if (dir === "vertical") vertical = false;
            else {
                // fallback (первая линия или изолированная точка)
                const dx = Math.abs(x - x1);
                const dy = Math.abs(y - y1);
                vertical = dy > dx;
            }
        } else {
            const dx = Math.abs(x - x1);
            const dy = Math.abs(y - y1);
            vertical = dy > dx;
        }

        // -----------------------------
        // 2️⃣ Фиксируем координату перпендикулярно
        // -----------------------------
        if (vertical) {
            x = x1; // вертикальная — X фиксируем
        } else {
            y = y1; // горизонтальная — Y фиксируем
        }

        // -----------------------------
        // 3️⃣ Ограничения и normalize
        // -----------------------------
        const limited = this.applyLineConstraints(x1, y1, x, y);
        const norm = vertical
            ? this.normalizeSegment(x1, y1, x1, limited.y2)
            : this.normalizeSegment(x1, y1, limited.x2, y1);

        // -----------------------------
        // 4️⃣ Проверка пересечения
        // -----------------------------
        const newLine = { x1, y1, x2: norm.x2, y2: norm.y2 };
        const intersects = this.lines.some(existing => this._linesIntersect(existing, newLine));
        if (intersects) return;

        // -----------------------------
        // 5️⃣ Применяем к текущей линии
        // -----------------------------
        this.currentLine.x2 = norm.x2;
        this.currentLine.y2 = norm.y2;
    }

    // вспомогательная функция для проверки пересечения линий (только горизонт/вертик)
    _linesIntersect(a, b) {
        // обе вертикальные
        if (a.x1 === a.x2 && b.x1 === b.x2) {
            if (a.x1 !== b.x1) return false;
            const [ay1, ay2] = [Math.min(a.y1, a.y2), Math.max(a.y1, a.y2)];
            const [by1, by2] = [Math.min(b.y1, b.y2), Math.max(b.y1, b.y2)];
            return ay2 > by1 && by2 > ay1;
        }

        // обе горизонтальные
        if (a.y1 === a.y2 && b.y1 === b.y2) {
            if (a.y1 !== b.y1) return false;
            const [ax1, ax2] = [Math.min(a.x1, a.x2), Math.max(a.x1, a.x2)];
            const [bx1, bx2] = [Math.min(b.x1, b.x2), Math.max(b.x1, b.x2)];
            return ax2 > bx1 && bx2 > ax1;
        }

        // одна вертикальная, одна горизонтальная
        if (a.x1 === a.x2 && b.y1 === b.y2) {
            return (b.x1 < a.x1 && a.x1 < b.x2 || b.x2 < a.x1 && a.x1 < b.x1) &&
                (a.y1 < b.y1 && b.y1 < a.y2 || a.y2 < b.y1 && b.y1 < a.y1);
        }
        if (a.y1 === a.y2 && b.x1 === b.x2) return this._linesIntersect(b, a);

        return false;
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


        const norm = this.normalizeSegment(x1, y1, x2, y2);

        const L = { x1: norm.x1, y1: norm.y1, x2: norm.x2, y2: norm.y2, _id: this._nextLineId++ };
        // const L = { x1, y1, x2, y2, _id: this._nextLineId++ };
        this.lines.push(L);
        this.lastPoint = { x: L.x2, y: L.y2 };
        this.currentLine = null;

        this.closedContour = this.detectClosedContour();
        if (this.closedContour) {
            window.dispatchEvent(new Event("contour-closed"));
        }
        // if (this.closedContour) console.log("Контур замкнут!", this.closedContour);

        return true;
    }

    cancelCurrentLine() {
        this.currentLine = null;
        // this.closedContour = this.detectClosedContour();

        // if (this.closedContour) {
        //     window.dispatchEvent(new Event("Контур замкнут"));
        // }
        // if (this.closedContour) console.log("Контур замкнут!", this.closedContour);
    }

    undo() {
        // если есть snapshot (удаление сегмента), восстанавливаем его
        if (this.undoStack && this.undoStack.length) {
            const snap = this.undoStack.pop();
            this.lines = snap.lines || [];
            this.closedContour = snap.closedContour || null;
            this.lastPoint = snap.lastPoint || (this.lines.length ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 } : null);
            this.currentLine = null;
            this.selectedSegmentIndex = null;
            return;
        }

        // --- существующая логика undo (оставляем как есть) ---
        // 1. Если был замкнутый контур — просто выходим из contour-режима
        if (this.closedContour) {
            this.closedContour = null;
            this.lastPoint = this.lines.length
                ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
                : null;
            return;
        }

        // 2. Если рисовалась текущая линия — отменяем её
        if (this.currentLine) {
            this.currentLine = null;
            return;
        }

        // 3. Удаляем последнюю линию
        if (!this.lines.length) return;

        this.lines.pop();

        // 4. Обновляем lastPoint
        this.lastPoint = this.lines.length
            ? { x: this.lines.at(-1).x2, y: this.lines.at(-1).y2 }
            : null;
    }


        // ---------- GRAPH + CYCLES ----------
    _buildGraphWithIntersections() {
        console.log("=== BUILD GRAPH START ===");

        const pointsOnLine = this.lines.map(() => new Set());
        const addPointToLine = (i, px, py) => {
            pointsOnLine[i].add(this._pointKey(px, py));
            console.log(`Line ${i} add point: (${px}, ${py})`);
        };

        // добавляем концы линий
        this.lines.forEach((L, i) => {
            addPointToLine(i, L.x1, L.y1);
            addPointToLine(i, L.x2, L.y2);
        });

        // ищем пересечения вертикальных и горизонтальных линий
        for (let i = 0; i < this.lines.length; i++) {
            const A = this.lines[i], Avert = A.x1 === A.x2;
            for (let j = i + 1; j < this.lines.length; j++) {
                const B = this.lines[j], Bvert = B.x1 === B.x2;
                if (Avert === Bvert) continue; // параллельные пропускаем

                let vert = Avert ? A : B;
                let hor  = Avert ? B : A;

                const vx = vert.x1, vyMin = Math.min(vert.y1, vert.y2), vyMax = Math.max(vert.y1, vert.y2);
                const hy = hor.y1, hxMin = Math.min(hor.x1, hor.x2), hxMax = Math.max(hor.x1, hor.x2);

                if (hxMin <= vx && vx <= hxMax && vyMin <= hy && hy <= vyMax) {
                    console.log(`Intersection found between line ${i} and line ${j}: (${vx}, ${hy})`);
                    addPointToLine(Avert ? i : j, vx, hy);
                    addPointToLine(Avert ? j : i, vx, hy);
                }
            }
        }

        const graph = new Map();
        const ensureKey = (k) => { if (!graph.has(k)) graph.set(k, []); };

        for (let i = 0; i < this.lines.length; i++) {
            const L = this.lines[i];
            let keys = Array.from(pointsOnLine[i]).map(k => {
                const [px, py] = k.split(",").map(Number);
                return { key: k, x: px, y: py };
            });
            if (L.x1 === L.x2) keys.sort((a,b) => a.y - b.y);
            else keys.sort((a,b) => a.x - b.x);

            // удаляем последовательные дубли
            const filteredKeys = [];
            for (let k = 0; k < keys.length; k++) {
                const last = filteredKeys.at(-1);
                if (!last || last.x !== keys[k].x || last.y !== keys[k].y) filteredKeys.push(keys[k]);
            }

            // создаем вершины и ребра только из filteredKeys
            filteredKeys.forEach(k => ensureKey(k.key));
            for (let k = 0; k < filteredKeys.length - 1; k++) {
                const a = filteredKeys[k].key, b = filteredKeys[k+1].key;
                graph.get(a).push({ to: b, lineId: L._id });
                graph.get(b).push({ to: a, lineId: L._id });
            }
        }

        console.log("=== BUILD GRAPH END ===");
        console.log("Final graph:", graph);
        return graph;
    }

    _findCyclesInGraph(graph) {

        console.log("=== FIND CYCLES START ===");
        console.log("Graph keys (vertices):", Array.from(graph.keys()));

        // for (const [key, edges] of graph.entries()) {
        //     console.log(`Vertex ${key} has edges:`, edges.map(e => `${e.to} (line ${e.lineId})`));
        // }
        const cycles = [];
        const keys = Array.from(graph.keys());

        const dfs = (startKey, currentKey, usedLineIds, pathKeys) => {
            for (const edge of graph.get(currentKey) || []) {
                const nextKey = edge.to;
                const lineId = edge.lineId;

                if (usedLineIds.has(lineId)) continue; // отрезок уже использован

                // предотвращаем добавление одинаковой точки подряд
                if (nextKey === pathKeys.at(-1)) continue;

                if (nextKey === startKey && pathKeys.length >= 3) {
                    const orderedLineIds = [...pathKeys._edgeOrder || [], lineId];
                    const cyclePoints = [...pathKeys, startKey];
                    const segments = [];

                    for (let i = 0; i < cyclePoints.length - 1; i++) {
                        const [x1, y1] = cyclePoints[i].split(',').map(Number);
                        const [x2, y2] = cyclePoints[i + 1].split(',').map(Number);

                        segments.push({
                            x1, y1, x2, y2
                        });
                    }

                    console.log("DFS CYCLE FOUND (CLEAN):");
                    console.log("  points:", cyclePoints.join(" -> "));
                    console.log("  segments:", segments.map(s => `(${s.x1},${s.y1})->(${s.x2},${s.y2})`).join(" | "));

                    cycles.push(segments);
                    continue;
                // 🔥 ЛОГ: что нашёл DFS
                    // console.log("DFS CYCLE FOUND:");
                    // console.log("  pathKeys:", [...pathKeys, startKey].join(" -> "));
                    // console.log("  lineIds:", orderedLineIds.join(","));
                    // if ((new Set(orderedLineIds)).size === orderedLineIds.length && orderedLineIds.length >= 4) {
                    //     const linesSeq = orderedLineIds.map(id => this.lines.find(L => L._id === id));
                    //     // 🔥 ЛОГ: что превращается в линии
                    //     console.log("  linesSeq:", linesSeq.map(L => 
                    //         L ? `(${L.x1},${L.y1})->(${L.x2},${L.y2})` : "NULL"
                    //     ).join(" | "));
                    //                             // фильтруем нулевые сегменты
                    //     const nonZero = linesSeq.filter(L => L.x1!==L.x2 || L.y1!==L.y2);
                    //     // 🔥 ЛОГ: после фильтра
                    //     console.log("  nonZero:", nonZero.map(L => 
                    //         `(${L.x1},${L.y1})->(${L.x2},${L.y2})`
                    //     ).join(" | "));
                    //     if (nonZero.length >= 4) cycles.push(nonZero);
                    // }
                    // continue;
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
        console.log("=== RETURN CYCLES ===");
        cycles.forEach((cycle, i) => {
            console.log(
                `[RETURN ${i}]`,
                cycle.map(L => `(${L.x1},${L.y1})->(${L.x2},${L.y2})`).join(" | ")
            );
        });
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

        // Убираем последовательные дубли (нулевые сегменты)
        const simple = [];
        for (const p of pts) {
            const last = simple.at(-1);
            if (!last || last.x !== p.x || last.y !== p.y) simple.push(p);
        }

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

    getDirectionAtPoint(x, y) {
        for (const L of this.lines) {
            // точка совпадает с началом или концом линии
            if (
                (L.x1 === x && L.y1 === y) ||
                (L.x2 === x && L.y2 === y)
            ) {
                return (L.x1 === L.x2) ? "vertical" : "horizontal";
            }
        }
        return null;
    }

    detectClosedContour() {
        if (!this.lines.length) {
            this.closedContour = null;
            console.log("[detectClosedContour] КОНТУР НЕ ОБРАЗОВАН — нет линий");
            return null;
        }

        console.log("[detectClosedContour] Строим граф с пересечениями...");
        const graph = this._buildGraphWithIntersections();

        console.log("[detectClosedContour] Находим циклы в графе...");
        const rawCycles = this._findCyclesInGraph(graph);

        if (!rawCycles.length) {
            this.closedContour = null;
            console.log("[detectClosedContour] КОНТУР НЕ ОБРАЗОВАН — циклов нет");
            return null;
        }

        console.log(`[detectClosedContour] Найдено циклов: ${rawCycles.length}`);

        // Логируем все циклы
        console.log("[detectClosedContour] Все найденные циклы:");
        rawCycles.forEach((cycle, idx) => {
            const pointsStr = cycle.map(L => {
                // L — объект линии {x1, y1, x2, y2}
                if (L && typeof L === 'object' && 'x1' in L && 'y1' in L) {
                    return `(${L.x1},${L.y1})`;
                } else {
                    return "(unknown)";
                }
            }).join(" -> ");
            console.log(`[Cycle ${idx}] ${pointsStr}`);
        });

        let bestPoints = null;
        let bestArea = 0;

        const normSeg = (ax, ay, bx, by) => {
            if (typeof this.normalizeSegment === "function") {
                return this.normalizeSegment(ax, ay, bx, by);
            } else {
                const dx = Math.abs(bx - ax);
                const dy = Math.abs(by - ay);
                if (dx > dy) return { x1: ax, y1: ay, x2: bx, y2: ay };
                return { x1: ax, y1: ay, x2: ax, y2: by };
            }
        };

        for (const [idx, seq] of rawCycles.entries()) {
            // let pts = [];

            // for (const L of seq) {
            //     const a = { x: L.x1, y: L.y1 };
            //     const b = { x: L.x2, y: L.y2 };

            //     const normalized = normSeg(a.x, a.y, b.x, b.y);
            //     const na = { x: normalized.x1, y: normalized.y1 };
            //     const nb = { x: normalized.x2, y: normalized.y2 };

            //     if (!pts.length || pts.at(-1).x !== na.x || pts.at(-1).y !== na.y) {
            //         pts.push(na);
            //     }
            //     pts.push(nb);
            // }
            let pts = this._linesToPolygonPoints(seq);

            pts = pts.filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y);

            if (pts.length < 4) {
                console.log(`[detectClosedContour][Cycle ${idx}] Пропускаем — точек < 4`);
                continue;
            }

            let ortho = true;
            const EPS = 1e-2;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % pts.length];
                if (a.x===b.x && a.y===b.y) continue; // пропускаем нулевой сегмент
                if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) { ortho = false; break; }
            }
            if (!ortho) {
                console.log(`[detectClosedContour][Cycle ${idx}] Пропускаем — не ортогональный`);
                continue;
            }

            const area = this._computeAreaFromPoints(pts);
            if (area <= 1e-6) {
                console.log(`[detectClosedContour][Cycle ${idx}] Пропускаем — площадь ≈ 0`);
                continue;
            }

            if (area > bestArea) {
                bestArea = area;
                bestPoints = pts;
                console.log(`[detectClosedContour][Cycle ${idx}] Новый лучший контур, площадь = ${bestArea}`);
            }
        }

        if (!bestPoints) {
            this.closedContour = null;
            console.log("[detectClosedContour] КОНТУР НЕ ОБРАЗОВАН — фильтры не пропустили циклы");
            return null;
        }

        const first = bestPoints[0];
        const last = bestPoints[bestPoints.length - 1];
        if (first.x === last.x && first.y === last.y) bestPoints.pop();

        const removeCollinear = (pts) => {
            if (!pts || pts.length < 3) return pts;
            const out = [];
            for (let i = 0; i < pts.length; i++) {
                const prev = pts[(i - 1 + pts.length) % pts.length];
                const cur = pts[i];
                const next = pts[(i + 1) % pts.length];
                const collinear = (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
                if (!collinear) out.push(cur);
            }
            return out;
        };

        let cleaned = removeCollinear(bestPoints);
        console.log("[detectClosedContour] Точки после удаления коллинеарных:", cleaned);

        if (cleaned.length < 4) {
            this.closedContour = null;
            console.log("[detectClosedContour] КОНТУР НЕ ОБРАЗОВАН — после очистки точек стало <4");
            return null;
        }

        cleaned.push({ ...cleaned[0] });

        const newLines = [];
        for (let i = 0; i < cleaned.length - 1; i++) {
            const a = cleaned[i];
            const b = cleaned[i + 1];
            const seg = (typeof this.normalizeSegment === "function")
                ? this.normalizeSegment(a.x, a.y, b.x, b.y)
                : { x1: a.x, y1: a.y, x2: b.x, y2: b.y };

            newLines.push({
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                _id: this._nextLineId++
            });
        }

        this.lines = newLines;
        this.closedContour = cleaned;
        this.currentLine = null;
        this.selectedSegmentIndex = null;
        this.lastPoint = null;

        console.log("[detectClosedContour] Контур найден и линии пересобраны:", this.closedContour);

        if (window.floorEditor?.draw) window.floorEditor.draw();

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

    isPointInside(x, y) {
        const poly = this.closedContour;
        if (!poly) return false;

        let inside = false;

        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;

            const intersect =
                ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    }

    getNearestWalls(x, y) {
        let v = null;
        let h = null;

        for (const L of this.lines) {
            if (L.x1 === L.x2) { // vertical
                if (!v || Math.abs(L.x1 - x) < Math.abs(v - x)) v = L.x1;
            }

            if (L.y1 === L.y2) { // horizontal
                if (!h || Math.abs(L.y1 - y) < Math.abs(h - y)) h = L.y1;
            }
        }

        return { v, h };
    }

    getSegmentAt(worldX, worldY) {
        const pts = this.closedContour;
        if (!pts || pts.length < 2) return -1;

        const HIT_DIST = 15; // чувствительность клика

        let bestIndex = -1;
        let bestDist = Infinity;

        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];

            const dist = this.distancePointToSegment(
                worldX, worldY,
                p1.x, p1.y,
                p2.x, p2.y
            );

            if (dist < HIT_DIST && dist < bestDist) {
                bestDist = dist;
                bestIndex = i;
            }
        }

        return bestIndex;
    }



    distancePointToSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }
    // нормализуем отрезок: snap -> делаем строго горизонтальным или вертикальным
    normalizeSegment(x1, y1, x2, y2) {
        // привязка к сетке
        const s1 = this.snapToGrid(x1, y1);
        const s2 = this.snapToGrid(x2, y2);

        let nx1 = s1.x, ny1 = s1.y, nx2 = s2.x, ny2 = s2.y;

        // если разница по X больше чем по Y -> горизонтальная, иначе вертикальная
        if (Math.abs(nx2 - nx1) > Math.abs(ny2 - ny1)) {
            // horizontal => оставляем y, корректируем x2
            ny2 = ny1;
        } else {
            // vertical => оставляем x, корректируем y2
            nx2 = nx1;
        }

        return { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
    }
    syncLinesFromContour() {
        if (!this.closedContour) return;

        this.lines = [];

        const pts = this.closedContour;
        const count = pts.length - 1;

        for (let i = 0; i < count; i++) {
            const a = pts[i];
            const b = pts[i + 1];

            this.lines.push({
                x1: a.x,
                y1: a.y,
                x2: b.x,
                y2: b.y,
                _id: i
            });
        }
    }
    resizeSegment(index, newLengthCm) {
        if (!this.closedContour) return;

        const pts = this.closedContour.slice();
        if (pts.length < 4) return;

        const first = pts[0];
        const last = pts[pts.length - 1];
        const closed = first.x === last.x && first.y === last.y;

        if (closed) pts.pop();

        const a = pts[index];
        const b = pts[(index + 1) % pts.length];

        const horizontal = a.y === b.y;
        const vertical = a.x === b.x;

        if (!horizontal && !vertical) return;

        const len = newLengthCm;

        if (horizontal) {
            const dir = Math.sign(b.x - a.x) || 1;
            pts[(index + 1) % pts.length] = {
                x: a.x + dir * len,
                y: a.y
            };
        }

        if (vertical) {
            const dir = Math.sign(b.y - a.y) || 1;
            pts[(index + 1) % pts.length] = {
                x: a.x,
                y: a.y + dir * len
            };
        }

        if (closed) pts.push({ ...pts[0] });

        this.closedContour = pts;

        // пересобираем lines
        this.lines = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const seg = this.normalizeSegment(
                pts[i].x,
                pts[i].y,
                pts[i + 1].x,
                pts[i + 1].y
            );

            this.lines.push({
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                _id: this._nextLineId++
            });
        }

        if (window.floorEditor) window.floorEditor.draw();
    }

    // ---------- VERTEX DRAG ----------
    getVertexAt(x, y, radius = 15) {
        if (!this.closedContour) return -1;

        const pts = this.closedContour;

        for (let i = 0; i < pts.length - 1; i++) {
            const p = pts[i];

            const dx = p.x - x;
            const dy = p.y - y;

            if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
                return i;
            }
        }

        return -1;
    }


    resizeSegmentByContour(index, newLength, reverse = false) {
        if (!this.closedContour) return;
        const pts = this.closedContour.slice();
        const count = pts.length - 1;
        if (count < 1) return;

        // нормализуем индекс и получаем точки сегмента (без повторяющейся последней точки)
        index = ((index % count) + count) % count;
        const A = pts[index];
        const B = pts[(index + 1) % count];

        // абсолютная длина (в тех же единицах, что и точки)
        const L = Math.abs(newLength);

        const isVertical = (A.x === B.x);

        // helper: записать новую точку в pts (с учётом того, какая точка была A/B)
        const setPoint = (posIndex, x, y) => {
            pts[posIndex] = { x: x, y: y };
        };

        if (isVertical) {
            // вертикальная: определим top (min y) и bottom (max y)
            const topIdx = (A.y < B.y) ? index : (index + 1) % count;
            const bottomIdx = (A.y < B.y) ? (index + 1) % count : index;

            const top = pts[topIdx];
            const bottom = pts[bottomIdx];

            if (!reverse) {
                // двигаем нижнюю точку так, чтобы расстояние от top стало L (вниз когда L положительное)
                const newBottomY = top.y + L;
                setPoint(bottomIdx, bottom.x, newBottomY);
            } else {
                // двигаем верхнюю точку так, чтобы расстояние от top до bottom стало L,
                // то есть top = bottom.y - L (поднимаем вверх)
                const newTopY = bottom.y - L;
                setPoint(topIdx, top.x, newTopY);
            }
        } else {
            // горизонтальная: определим left (min x) и right (max x)
            const leftIdx = (A.x < B.x) ? index : (index + 1) % count;
            const rightIdx = (A.x < B.x) ? (index + 1) % count : index;

            const left = pts[leftIdx];
            const right = pts[rightIdx];

            if (!reverse) {
                // двигаем правую точку вправо: newRightX = left.x + L
                const newRightX = left.x + L;
                setPoint(rightIdx, newRightX, right.y);
            } else {
                // двигаем левую точку влево: newLeftX = right.x - L
                const newLeftX = right.x - L;
                setPoint(leftIdx, newLeftX, left.y);
            }
        }

        // сохраняем замыкание
        pts[count] = { ...pts[0] };

        // пересобираем линии, как в других местах
        this.lines = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const seg = this.normalizeSegment(
                pts[i].x, pts[i].y,
                pts[i + 1].x, pts[i + 1].y
            );

            this.lines.push({
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                _id: this._nextLineId++
            });
        }

        // обновляем закрытый контур и триггерим перерисовку
        this.closedContour = pts;
        this.currentLine = null;
        this.selectedSegmentIndex = null;

        if (window.floorEditor?.draw) window.floorEditor.draw();
    }

    addVertexOnSegment(index, offsetCm) {
        if (!this.closedContour) return;

        const pts = this.closedContour.slice();
        const n = pts.length - 1;

        if (n < 2) return;

        index = ((index % n) + n) % n;

        const A = pts[index];
        const B = pts[(index + 1) % n];

        const isVertical = Math.abs(A.x - B.x) < Math.abs(A.y - B.y);

        let newPoint;

        if (isVertical) {
            // 🔥 от верхней точки
            const top = A.y < B.y ? A : B;

            newPoint = {
                x: top.x,
                y: top.y + offsetCm
            };
        } else {
            // 🔥 от левой точки
            const left = A.x < B.x ? A : B;

            newPoint = {
                x: left.x + offsetCm,
                y: left.y
            };
        }

        // 🔥 вставляем новую точку между index и index+1
        pts.splice(index + 1, 0, newPoint);

        // замыкаем контур
        pts[pts.length - 1] = { ...pts[0] };

        // 🔥 пересобираем линии
        this.lines = [];

        for (let i = 0; i < pts.length - 1; i++) {
            const seg = this.normalizeSegment(
                pts[i].x, pts[i].y,
                pts[i + 1].x, pts[i + 1].y
            );

            this.lines.push({
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                _id: this._nextLineId++
            });
        }

        this.closedContour = pts;
        this.selectedSegmentIndex = null;
    }

    areAllAnglesRight(toleranceDeg = 0.1) {
        if (!this.closedContour) return false;

        const pts = this.closedContour;
        const n = pts.length - 1; // последний = первый

        if (n < 3) return false;

        const toDeg = (rad) => rad * 180 / Math.PI;

        for (let i = 0; i < n; i++) {
            const prev = pts[(i - 1 + n) % n];
            const curr = pts[i];
            const next = pts[(i + 1) % n];

            const v1 = {
                x: prev.x - curr.x,
                y: prev.y - curr.y
            };

            const v2 = {
                x: next.x - curr.x,
                y: next.y - curr.y
            };

            const dot = v1.x * v2.x + v1.y * v2.y;
            const len1 = Math.hypot(v1.x, v1.y);
            const len2 = Math.hypot(v2.x, v2.y);

            if (len1 === 0 || len2 === 0) return false;

            const angle = Math.acos(
                Math.max(-1, Math.min(1, dot / (len1 * len2)))
            );

            const deg = toDeg(angle);

            // 🔥 проверка на ~90°
            if (Math.abs(deg - 90) > toleranceDeg) {
                return false;
            }
        }

        return true;
    }

moveVertex(index, newX, newY) {
    if (!this.closedContour) return;

    const pts = this.closedContour.slice();
    const count = pts.length - 1;

    const prev = (index - 1 + count) % count;
    const next = (index + 1) % count;

    const prevPt = pts[prev];
    const nextPt = pts[next];

    let x = newX;
    let y = newY;

    // -----------------------------
    // 🎯 1. SNAP ПО 5 ГРАДУСАМ (RADIAL)
    // -----------------------------
    const SNAP_STEP = (5 * Math.PI) / 180;
    const SNAP_EPS = (2.5 * Math.PI) / 180;

    const v1 = { x: prevPt.x - x, y: prevPt.y - y };
    const v2 = { x: nextPt.x - x, y: nextPt.y - y };

    const a1 = Math.atan2(v1.y, v1.x);
    const a2 = Math.atan2(v2.y, v2.x);

    const snap = (a) => Math.round(a / SNAP_STEP) * SNAP_STEP;

    const s1 = snap(a1);
    const s2 = snap(a2);

    const d1 = Math.abs(a1 - s1);
    const d2 = Math.abs(a2 - s2);

    // если ОБЕ стены близки к лучам сетки → стабилизируем вершину
    if (d1 < SNAP_EPS && d2 < SNAP_EPS) {
        const len1 = Math.hypot(v1.x, v1.y);
        const len2 = Math.hypot(v2.x, v2.y);

        const dir1 = { x: Math.cos(s1), y: Math.sin(s1) };
        const dir2 = { x: Math.cos(s2), y: Math.sin(s2) };

        const p1 = {
            x: prevPt.x - dir1.x * len1,
            y: prevPt.y - dir1.y * len1
        };

        const p2 = {
            x: nextPt.x - dir2.x * len2,
            y: nextPt.y - dir2.y * len2
        };

        // мягкое усреднение (чтобы не дёргалось)
        x = (p1.x + p2.x) / 2;
        y = (p1.y + p2.y) / 2;
    }

    // -----------------------------
    // 🎯 2. ОБНОВЛЯЕМ ТОЛЬКО ВЕРШИНУ
    // -----------------------------
    pts[index] = { x, y };

    // замыкание
    pts[count] = { ...pts[0] };

    this.closedContour = pts;

    // -----------------------------
    // 🎯 3. ПЕРЕСБОРКА ЛИНИЙ (ТОЛЬКО СВЯЗЬ)
    // -----------------------------
    this.lines = [];

    for (let i = 0; i < pts.length - 1; i++) {
        const seg = this.normalizeSegment(
            pts[i].x, pts[i].y,
            pts[i + 1].x, pts[i + 1].y
        );

        this.lines.push({
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            _id: this._nextLineId++
        });
    }

    if (window.floorEditor?.draw) {
        window.floorEditor.draw();
    }
}

    snapVertexAngle(index, x, y) {
        if (!this.closedContour) return { x, y };

        const pts = this.closedContour;
        const count = pts.length - 1;

        const prev = pts[(index - 1 + count) % count];
        const curr = pts[index];
        const next = pts[(index + 1) % count];

        // вектор от prev → curr (фиксируем)
        const v1 = {
            x: curr.x - prev.x,
            y: curr.y - prev.y
        };

        const len1 = Math.hypot(v1.x, v1.y) || 1;
        v1.x /= len1;
        v1.y /= len1;

        // новый вектор curr → newPoint
        let v2 = {
            x: x - curr.x,
            y: y - curr.y
        };

        const len2 = Math.hypot(v2.x, v2.y) || 1;

        // угол между ними
        let angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);

        // нормализация
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        // 🔥 SNAP К 10°
        const snapStep = 10 * Math.PI / 180;
        const snappedAngle = Math.round(angle / snapStep) * snapStep;

        // новый угол
        const baseAngle = Math.atan2(v1.y, v1.x);
        const finalAngle = baseAngle + snappedAngle;

        return {
            x: curr.x + Math.cos(finalAngle) * len2,
            y: curr.y + Math.sin(finalAngle) * len2
        };
    }

    evaluateAngles(index, x, y) {
        const pts = this.closedContour;
        const n = pts.length - 1;

        const get = (i) => pts[(i + n) % n];

        const A = get(index - 1);
        const B = { x, y };
        const C = get(index + 1);
        const P = get(index - 2);
        const N = get(index + 2);

        const angle = (p1, p2, p3) => {
            const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
            const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

            const dot = v1.x * v2.x + v1.y * v2.y;
            const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;

            return Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180 / Math.PI;
        };

        const snapError = (deg) => {
            const step = 5; // 🔥 теперь 5°
            const snapped = Math.round(deg / step) * step;

            const diff = Math.abs(deg - snapped);

            // 🔥 магнитное поле
            if (diff < 2) return 0;        // почти идеально → фиксируем
            if (diff < 8) return diff * 0.3; // притягивание
            return diff * 2;               // вне зоны — штраф
        };

        let error = 0;

        // угол в B
        error += snapError(angle(A, B, C));

        // угол в A
        error += snapError(angle(P, A, B));

        // угол в C
        error += snapError(angle(B, C, N));

        return error;
    }

    smartSnapVertex(index, x, y) {
        let best = { x, y };
        let bestScore = Infinity;

        const radius = 30;
        const steps = 24;

        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;

            const cx = x + Math.cos(angle) * radius;
            const cy = y + Math.sin(angle) * radius;

            const score = this.evaluateAngles(index, cx, cy);

            if (score < bestScore) {
                bestScore = score;
                best = { x: cx, y: cy };
            }
        }

        // 🔥 почти идеально → жёсткий snap
        if (bestScore < 1.5) {
            return best;
        }

        // 🔥 плавное притягивание
        return {
            x: x + (best.x - x) * 0.25,
            y: y + (best.y - y) * 0.25
        };
    }

}
