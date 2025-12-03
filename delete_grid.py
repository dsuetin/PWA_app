import cv2
import numpy as np

# Загружаем изображение
img = cv2.imread("test_draw_floor_plan.jpg")

# В серый
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Бинаризация — линии станут чёрные
_, bw = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

# --- Шаг 1: Находим ТОНКИЕ линии ---
kernel_thin = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 20))
thin_lines = cv2.morphologyEx(bw, cv2.MORPH_OPEN, kernel_thin)

# --- Шаг 2: Удаляем тонкие линии ---
bw_without_grid = cv2.subtract(bw, thin_lines)

# --- Шаг 3: Немного чистим ---
bw_without_grid = cv2.medianBlur(bw_without_grid, 3)

# Инвертируем обратно
result = cv2.bitwise_not(bw_without_grid)

cv2.imwrite("test_draw_floor_plan_no_grid.png", result)
print("Готово!")
