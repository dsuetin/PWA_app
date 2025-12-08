export async function detectColoredLines(colorRange) {
	if (!colorRange) {
		throw new Error("Необходимо передать диапазон цвета в HSV: { hMin, hMax, sMin, sMax, vMin, vMax }");
	}
	const resultDiv = document.getElementById("result");
	const canvas = document.getElementById("canvas");

	if (canvas.width === 0 || canvas.height === 0) {
		alert("Сначала загрузите изображение");
		return [];
	}

	if (typeof cv === "undefined") {
		alert("OpenCV не загружен");
		return [];
	}

	const src = cv.imread(canvas);

	// --- HSV ---
	const hsv = new cv.Mat();
	cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);

	const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [colorRange.hMin, colorRange.sMin, colorRange.vMin, 0]);
	const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [colorRange.hMax, colorRange.sMax, colorRange.vMax, 255]);
	const mask = new cv.Mat();
	cv.inRange(hsv, low, high, mask);
	low.delete(); high.delete();

	// Морфология для соединения разрывов
	const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
	cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
	cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);

	// Находим контуры
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);

	if (contours.size() === 0) {
		resultDiv.innerHTML = "<b>Цветные линии не найдены</b>";
		src.delete(); hsv.delete(); mask.delete(); kernel.delete();
		contours.delete(); hierarchy.delete();
		return [];
	}

	const linesData = [];
	let out = "<b>Найденные линии:</b><br><br>";

	for (let i = 0; i < contours.size(); i++) {
		const cnt = contours.get(i);

		const lineData = new cv.Mat();
		cv.fitLine(cnt, lineData, cv.DIST_L2, 0, 0.01, 0.01);

		const vx = lineData.floatAt(0, 0);
		const vy = lineData.floatAt(1, 0);
		const x0 = lineData.floatAt(2, 0);
		const y0 = lineData.floatAt(3, 0);

		const pts = [];
		for (let j = 0; j < cnt.rows; j++) {
			const p = cnt.intPtr(j);
			pts.push({ x: p[0], y: p[1] });
		}

		let tMin = Infinity;
		let tMax = -Infinity;

		for (let p of pts) {
			const t = (p.x - x0) * vx + (p.y - y0) * vy;
			if (t < tMin) tMin = t;
			if (t > tMax) tMax = t;
		}

		const x1 = x0 + vx * tMin;
		const y1 = y0 + vy * tMin;
		const x2 = x0 + vx * tMax;
		const y2 = y0 + vy * tMax;
		const length = Math.hypot(x2 - x1, y2 - y1);

		// Рисуем линию на canvas
		cv.line(src,
			new cv.Point(x1, y1),
			new cv.Point(x2, y2),
			[0, 255, 0, 255],
			12
		);

		linesData.push({ x1, y1, x2, y2, length });

		out += `Линия ${i + 1}:<br>
				(${x1.toFixed(0)}, ${y1.toFixed(0)}) →
				(${x2.toFixed(0)}, ${y2.toFixed(0)})<br>
				Длина: ${length.toFixed(1)} px<br><br>`;

		lineData.delete();
		cnt.delete();
	}

	cv.imshow(canvas, src);

	resultDiv.innerHTML = out;

	// Чистим память
	src.delete(); hsv.delete(); mask.delete(); kernel.delete();
	contours.delete(); hierarchy.delete();

	return linesData;
}
