import { describe, expect, it } from 'vitest';
import { boundingRect, clamp, containsPoint, containsRect, intersects, rectFromPoints, snap } from '../../src/domain/geometry';

describe('geometry', () => {
  it('builds a rect from points in any order', () => {
    expect(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0, width: 40, height: 40 });
  });

  it('tests point and rect containment', () => {
    const r = { x: 0, y: 0, width: 100, height: 50 };
    expect(containsPoint(r, { x: 100, y: 50 })).toBe(true);
    expect(containsPoint(r, { x: 101, y: 10 })).toBe(false);
    expect(containsRect(r, { x: 10, y: 10, width: 90, height: 40 })).toBe(true);
    expect(containsRect(r, { x: 10, y: 10, width: 91, height: 40 })).toBe(false);
  });

  it('detects intersections (touching edges do not intersect)', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(intersects(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(intersects(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('computes bounding rects', () => {
    expect(boundingRect([])).toBeNull();
    expect(
      boundingRect([
        { x: 10, y: 10, width: 10, height: 10 },
        { x: 50, y: 0, width: 5, height: 40 },
      ]),
    ).toEqual({ x: 10, y: 0, width: 45, height: 40 });
  });

  it('snaps to a grid step', () => {
    expect(snap(14, 10)).toBe(10);
    expect(snap(15, 10)).toBe(20);
    expect(snap(-6, 10)).toBe(-10);
    expect(snap(13.6, 1)).toBe(14);
    expect(snap(13.6, 0)).toBe(14);
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
