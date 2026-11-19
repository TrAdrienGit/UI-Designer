import { describe, expect, it } from 'vitest';
import {
  alignElements,
  distributeElements,
  dropInto,
  groupElements,
  moveElements,
  resizeElement,
  resizeRect,
  topLevelIds,
  ungroupElement,
} from '../../src/application/transform';
import { absoluteRect, findElement, parentIdOf } from '../../src/domain/tree';
import { docWith, el } from '../helpers';

function noBorder<T extends { style: { borderWidth: number } }>(e: T): T {
  return { ...e, style: { ...e.style, borderWidth: 0 } };
}

function sample() {
  const a = el('button', 'a', { x: 10, y: 10, width: 50, height: 20 });
  const b = el('button', 'b', { x: 100, y: 40, width: 30, height: 30 });
  const c = el('button', 'c', { x: 300, y: 80, width: 40, height: 10 });
  const box = noBorder(el('container', 'box', { x: 400, y: 300, width: 200, height: 200 }, [el('text', 't', { x: 10, y: 10, width: 50, height: 20 })]));
  return docWith(a, b, c, box);
}

describe('move', () => {
  it('moves by a delta, ignoring locked elements and children of moved parents', () => {
    let doc = sample();
    doc = { ...doc, elements: doc.elements.map((e) => (e.id === 'c' ? { ...e, locked: true } : e)) };
    expect(topLevelIds(doc, ['box', 't', 'a'])).toEqual(['box', 'a']);
    const moved = moveElements(doc, ['a', 'c', 'box', 't'], { x: 5, y: -3 });
    expect(findElement(moved, 'a')).toMatchObject({ x: 15, y: 7 });
    expect(findElement(moved, 'c')).toMatchObject({ x: 300, y: 80 });
    expect(findElement(moved, 'box')).toMatchObject({ x: 405, y: 297 });
    expect(findElement(moved, 't')).toMatchObject({ x: 10, y: 10 });
  });

  it('snaps the selection corner to the grid', () => {
    const moved = moveElements(sample(), ['a', 'b'], { x: 7, y: 3 }, 10);
    expect(findElement(moved, 'a')).toMatchObject({ x: 20, y: 10 });
    expect(findElement(moved, 'b')).toMatchObject({ x: 110, y: 40 });
  });

  it('snaps relative to a bordered parent', () => {
    const box = el('container', 'box', { x: 0, y: 0, width: 200, height: 200 }, [el('button', 'k', { x: 10, y: 10, width: 20, height: 20 })]);
    const doc = docWith(box); // default container border: 1px
    const moved = moveElements(doc, ['k'], { x: 12, y: 0 }, 10);
    expect(findElement(moved, 'k')).toMatchObject({ x: 20, y: 10 });
  });
});

describe('resize', () => {
  const min = { width: 10, height: 10 };
  const start = { x: 100, y: 100, width: 100, height: 50 };

  it('moves the dragged edges only', () => {
    expect(resizeRect(start, 'se', { x: 20, y: 10 }, min)).toEqual({ x: 100, y: 100, width: 120, height: 60 });
    expect(resizeRect(start, 'nw', { x: 20, y: 10 }, min)).toEqual({ x: 120, y: 110, width: 80, height: 40 });
    expect(resizeRect(start, 'e', { x: 5, y: 99 }, min)).toEqual({ x: 100, y: 100, width: 105, height: 50 });
  });

  it('keeps the minimum size and the opposite edge', () => {
    expect(resizeRect(start, 'w', { x: 500, y: 0 }, min)).toEqual({ x: 190, y: 100, width: 10, height: 50 });
  });

  it('snaps the moving edges and keeps the ratio when asked', () => {
    expect(resizeRect(start, 'se', { x: 13, y: 4 }, min, { gridStep: 10 })).toEqual({ x: 100, y: 100, width: 110, height: 50 });
    const r = resizeRect(start, 'se', { x: 100, y: 0 }, min, { keepRatio: true });
    expect(r.width / r.height).toBeCloseTo(2);
  });

  it('applies to an element inside a parent', () => {
    const doc = sample();
    const resized = resizeElement(doc, 't', 'se', { x: 10, y: 5 });
    expect(findElement(resized, 't')).toMatchObject({ x: 10, y: 10, width: 60, height: 25 });
  });
});

describe('drop into containers', () => {
  it('reparents keeping positions and ignores same-parent elements', () => {
    const doc = sample();
    const before = absoluteRect(doc, 'a');
    const dropped = dropInto(doc, ['a', 't'], 'box');
    expect(parentIdOf(dropped, 'a')).toBe('box');
    expect(absoluteRect(dropped, 'a')).toEqual(before);
    expect(parentIdOf(dropped, 't')).toBe('box');
    expect(dropInto(doc, ['box'], 'box')).toBe(doc);
    expect(dropInto(doc, ['a'], 'b')).toBe(doc); // a button is not a container
  });
});

describe('align and distribute', () => {
  it('aligns several elements on the selection bounds', () => {
    const doc = alignElements(sample(), ['a', 'b', 'c'], 'left');
    expect(['a', 'b', 'c'].map((id) => findElement(doc, id)!.x)).toEqual([10, 10, 10]);
    const bottom = alignElements(sample(), ['a', 'b'], 'bottom');
    expect(absoluteRect(bottom, 'a')!.y + 20).toBe(70);
  });

  it('aligns a single element in its parent', () => {
    const doc = alignElements(sample(), ['t'], 'hcenter');
    expect(findElement(doc, 't')!.x).toBe(75);
    const right = alignElements(sample(), ['a'], 'right');
    expect(findElement(right, 'a')!.x).toBe(1280 - 50);
  });

  it('distributes with equal gaps', () => {
    const doc = distributeElements(sample(), ['a', 'b', 'c'], 'horizontal');
    // span 10..340, widths 50+30+40=120 -> gap (330-120)/2 = 105
    expect(findElement(doc, 'b')!.x).toBe(165);
    expect(distributeElements(sample(), ['a', 'b'], 'horizontal')).toEqual(sample());
  });
});

describe('group / ungroup', () => {
  it('wraps siblings in a box sized to their bounds, then unwraps them', () => {
    const doc = sample();
    const group = el('container', 'g', { x: 0, y: 0, width: 1, height: 1 });
    const result = groupElements(doc, ['a', 'b'], group)!;
    const g = findElement(result.doc, 'g')!;
    expect(g).toMatchObject({ x: 10, y: 10, width: 120, height: 60 });
    expect(g.children.map((c) => c.id)).toEqual(['a', 'b']);
    expect(absoluteRect(result.doc, 'b')).toEqual(absoluteRect(doc, 'b'));
    expect(result.doc.elements.map((e) => e.id)).toEqual(['g', 'c', 'box']);

    const un = ungroupElement(result.doc, 'g')!;
    expect(findElement(un.doc, 'g')).toBeUndefined();
    expect(un.doc.elements.map((e) => e.id)).toEqual(['a', 'b', 'c', 'box']);
    expect(absoluteRect(un.doc, 'b')).toEqual(absoluteRect(doc, 'b'));
  });

  it('refuses to group elements with different parents', () => {
    expect(groupElements(sample(), ['a', 't'], el('container', 'g', { x: 0, y: 0, width: 1, height: 1 }))).toBeNull();
  });
});
