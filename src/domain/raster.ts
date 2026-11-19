/**
 * Pixel algorithms for the drawing tools, independent of any canvas API: they
 * work on plain RGBA buffers (same layout as the browser's ImageData).
 */
import type { Point } from './geometry';

export interface RasterImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row by row. */
  readonly data: Uint8ClampedArray;
}

export type Rgba = readonly [number, number, number, number];

/** Integer points of the segment a-b (Bresenham), both ends included. */
export function linePoints(a: Point, b: Point): Point[] {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const points: Point[] = [];
  for (;;) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

/** Point snapped to the closest multiple of 45° around `origin` (Shift while drawing a line). */
export function constrainAngle(origin: Point, p: Point): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return p;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: origin.x + Math.round(Math.cos(angle) * length), y: origin.y + Math.round(Math.sin(angle) * length) };
}

export function pixelAt(img: RasterImage, x: number, y: number): Rgba {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
}

/** Largest channel difference between two colors (0 = identical, 255 = opposite). */
export function colorDistance(a: Rgba, b: Rgba): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3]));
}

/**
 * Paint bucket: fills the 4-connected region around (x, y) whose colors are
 * within `tolerance` (0..255) of the start pixel. Modifies `img.data` in place
 * and returns the number of pixels painted.
 */
export function floodFill(img: RasterImage, x: number, y: number, color: Rgba, tolerance = 0): number {
  const { width, height, data } = img;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  const target = pixelAt(img, x, y);
  if (colorDistance(target, color) === 0) return 0;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [y * width + x];
  let painted = 0;
  const matches = (index: number): boolean => {
    const i = index * 4;
    return colorDistance([data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!], target) <= tolerance;
  };
  while (stack.length > 0) {
    const index = stack.pop()!;
    if (visited[index] || !matches(index)) continue;
    // Scan left and right on the row, then queue the rows above and below.
    const row = Math.floor(index / width);
    let left = index;
    while (left % width > 0 && !visited[left - 1] && matches(left - 1)) left--;
    let right = index;
    while (right % width < width - 1 && !visited[right + 1] && matches(right + 1)) right++;
    for (let i = left; i <= right; i++) {
      visited[i] = 1;
      const o = i * 4;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = color[3];
      painted++;
      if (row > 0 && !visited[i - width]) stack.push(i - width);
      if (row < height - 1 && !visited[i + width]) stack.push(i + width);
    }
  }
  return painted;
}

/** Parses "#rgb", "#rrggbb", "#rrggbbaa", "rgb()/rgba()" and "transparent". Null when unknown. */
export function parseColor(text: string): Rgba | null {
  const value = text.trim().toLowerCase();
  if (value === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3})$/.exec(value);
  if (m) {
    const [r, g, b] = [...m[1]!].map((c) => parseInt(c + c, 16));
    return [r!, g!, b!, 255];
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(value);
  if (m) {
    const hex = m[1]!;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), m[2] ? parseInt(m[2], 16) : 255];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%)?)?\s*\)$/.exec(value);
  if (m) {
    let alpha = m[4] === undefined ? 1 : Number(m[4]);
    if (m[5]) alpha /= 100;
    const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
    return [clamp(Number(m[1])), clamp(Number(m[2])), clamp(Number(m[3])), clamp(alpha * 255)];
  }
  return null;
}

/** "#rrggbb" (opaque) or "rgba(r, g, b, a)" form of a color. */
export function formatColor(c: Rgba): string {
  if (c[3] === 255) return '#' + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.round((c[3] / 255) * 100) / 100})`;
}
