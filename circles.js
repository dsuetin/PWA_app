export async function findBlackCircles() {

	const canvas = document.getElementById('canvas');
	const resultDiv = document.getElementById('result');


	if (canvas.width === 0) {
		alert("Сначала загрузите изображение");
		return [];
	}

	if (typeof cv === "undefined") {
		alert("OpenCV не загружен");
		return [];
	}

	const src = cv.imread(canvas);
	const gray = new cv.Mat();
	cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

	const thresh = new cv.Mat();
	cv.threshold(gray, thresh, 50, 255, cv.THRESH_BINARY_INV);

	const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
	cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);

	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

	const circles = [];

	for (let i = 0; i < contours.size(); i++) {
		const cnt = contours.get(i);
		const circle = cv.minEnclosingCircle(cnt);
		if (circle.radius > 2) {
			circles.push({ x: circle.center.x, y: circle.center.y, radius: circle.radius });
			cv.circle(src, new cv.Point(circle.center.x, circle.center.y), circle.radius, [0, 0, 255, 255], 2);
		}
		cnt.delete();
	}

	cv.imshow(canvas, src);

	resultDiv.innerHTML += `<hr><b>Черные круги:</b><br>` +
		circles.map((c, i) =>
			`Круг ${i + 1}: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}), радиус=${c.radius.toFixed(1)} px`
		).join('<br>');

	src.delete(); gray.delete(); thresh.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

	return circles;
}
