import { describe, expect, it } from 'vitest';
import { colorDistance, constrainAngle, floodFill, formatColor, linePoints, parseColor, pixelAt, type RasterImage } from '../../src/domain/raster';

function image(width: number, height: number, rows?: string[]): RasterImage {
  // rows: '.' = transparent, '#' = opaque black
  const data = new Uint8ClampedArray(width * height * 4);
  rows?.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') data.set([0, 0, 0, 255], (y * width + x) * 4);
    }),
  );
  return { width, height, data };
}

describe('raster', () => {
  it('draws pixel-perfect lines including both ends', () => {
    expect(linePoints({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(linePoints({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(linePoints({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }]);
    // Steep line: one point per row, no gaps.
    const steep = linePoints({ x: 0, y: 0 }, { x: 1, y: 5 });
    expect(steep).toHaveLength(6);
    expect(steep.map((p) => p.y)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('constrains lines to 45° steps', () => {
    expect(constrainAngle({ x: 0, y: 0 }, { x: 10, y: 1 })).toEqual({ x: 10, y: 0 });
    expect(constrainAngle({ x: 0, y: 0 }, { x: 1, y: -10 })).toEqual({ x: 0, y: -10 });
    const diag = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 9 });
    expect(diag.x).toBe(diag.y);
  });

  it('fills a closed region without crossing the outline', () => {
    const img = image(5, 5, ['#####', '#...#', '#...#', '#...#', '#####']);
    const red = [255, 0, 0, 255] as const;
    expect(floodFill(img, 2, 2, red)).toBe(9);
    expect(pixelAt(img, 1, 1)).toEqual([...red]);
    expect(pixelAt(img, 0, 0)).toEqual([0, 0, 0, 255]);
    // Filling with the same color again changes nothing.
    expect(floodFill(img, 2, 2, red)).toBe(0);
  });

  it('respects the tolerance', () => {
    const img = image(3, 1);
    img.data.set([100, 100, 100, 255, 110, 100, 100, 255, 200, 100, 100, 255]);
    const blue = [0, 0, 255, 255] as const;
    expect(floodFill({ ...img, data: img.data.slice() }, 0, 0, blue, 0)).toBe(1);
    expect(floodFill({ ...img, data: img.data.slice() }, 0, 0, blue, 20)).toBe(2);
    expect(floodFill({ ...img, data: img.data.slice() }, 0, 0, blue, 255)).toBe(3);
    expect(floodFill(img, 9, 9, blue)).toBe(0);
  });

  it('parses and formats colors', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 255]);
    expect(parseColor('#11223380')).toEqual([17, 34, 51, 128]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 128]);
    expect(parseColor('rgb(1 2 3 / 50%)')).toEqual([1, 2, 3, 128]);
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
    expect(parseColor('banana')).toBeNull();
    expect(formatColor([255, 0, 16, 255])).toBe('#ff0010');
    expect(formatColor([0, 0, 0, 128])).toBe('rgba(0, 0, 0, 0.5)');
    expect(colorDistance([0, 0, 0, 0], [10, 3, 0, 0])).toBe(10);
  });
});
