import { describe, expect, it } from 'vitest';
import {
  absoluteRect,
  ancestorsOf,
  cloneElement,
  contentOrigin,
  countElements,
  drawingAt,
  isFixedRoot,
  createElement,
  findElement,
  hitTest,
  insertElement,
  isDescendantOf,
  parentIdOf,
  removeElements,
  reorder,
  reparent,
  uniqueName,
  updateElement,
} from '../../src/domain/tree';
import { docWith, el, sequentialIds } from '../helpers';

// panel (container, border 2) at 100,100 containing: btn at 10,10 and inner (container) at 50,50 containing label.
function sample() {
  const label = el('text', 'label', { x: 5, y: 5, width: 40, height: 20 });
  const inner = el('container', 'inner', { x: 50, y: 50, width: 100, height: 80 }, [label]);
  const btn = el('button', 'btn', { x: 10, y: 10, width: 80, height: 30 });
  const panel = el('container', 'panel', { x: 100, y: 100, width: 300, height: 200 }, [btn, inner]);
  const panelWithBorder = { ...panel, style: { ...panel.style, borderWidth: 2 } };
  const innerNoBorder = { ...inner, style: { ...inner.style, borderWidth: 0 } };
  return docWith({ ...panelWithBorder, children: [btn, innerNoBorder] }, el('image', 'img', { x: 600, y: 0, width: 64, height: 64 }));
}

describe('tree queries', () => {
  it('finds elements, parents and ancestors', () => {
    const doc = sample();
    expect(findElement(doc, 'label')?.type).toBe('text');
    expect(findElement(doc, 'missing')).toBeUndefined();
    expect(parentIdOf(doc, 'label')).toBe('inner');
    expect(parentIdOf(doc, 'panel')).toBeNull();
    expect(parentIdOf(doc, 'missing')).toBeUndefined();
    expect(ancestorsOf(doc, 'label')?.map((a) => a.id)).toEqual(['panel', 'inner']);
    expect(isDescendantOf(doc, 'label', 'panel')).toBe(true);
    expect(isDescendantOf(doc, 'panel', 'label')).toBe(false);
    expect(countElements(doc)).toBe(5);
  });

  it('computes absolute rects including parent borders', () => {
    const doc = sample();
    expect(absoluteRect(doc, 'btn')).toEqual({ x: 112, y: 112, width: 80, height: 30 });
    expect(absoluteRect(doc, 'label')).toEqual({ x: 157, y: 157, width: 40, height: 20 });
    expect(contentOrigin(doc, 'panel')).toEqual({ x: 102, y: 102 });
    expect(contentOrigin(doc, null)).toEqual({ x: 0, y: 0 });
  });

  it('hit-tests the deepest top-most visible element', () => {
    const doc = sample();
    expect(hitTest(doc, { x: 160, y: 160 })?.id).toBe('label');
    expect(hitTest(doc, { x: 250, y: 250 })?.id).toBe('panel');
    expect(hitTest(doc, { x: 120, y: 120 })?.id).toBe('btn');
    expect(hitTest(doc, { x: 120, y: 120 }, { containersOnly: true })?.id).toBe('panel');
    expect(hitTest(doc, { x: 160, y: 160 }, { exclude: new Set(['inner']) })?.id).toBe('panel');
    expect(hitTest(doc, { x: 5, y: 5 })).toBeNull();
    const hidden = updateElement(doc, 'btn', (e) => ({ ...e, hidden: true }));
    expect(hitTest(hidden, { x: 120, y: 120 })?.id).toBe('panel');
  });
});

describe('tree edits', () => {
  it('updates immutably and shares untouched subtrees', () => {
    const doc = sample();
    const next = updateElement(doc, 'label', (e) => ({ ...e, x: 99 }));
    expect(findElement(next, 'label')?.x).toBe(99);
    expect(findElement(doc, 'label')?.x).toBe(5);
    expect(next.elements[1]).toBe(doc.elements[1]); // the image is shared
    expect(findElement(next, 'btn')).toBe(findElement(doc, 'btn'));
  });

  it('removes elements with their subtree', () => {
    const doc = removeElements(sample(), ['inner']);
    expect(findElement(doc, 'inner')).toBeUndefined();
    expect(findElement(doc, 'label')).toBeUndefined();
    expect(countElements(doc)).toBe(3);
  });

  it('inserts at an index and refuses non containers', () => {
    const doc = sample();
    const added = insertElement(doc, 'panel', el('text', 'new', { x: 0, y: 0, width: 10, height: 10 }), 0);
    expect(findElement(added, 'panel')?.children.map((c) => c.id)).toEqual(['new', 'btn', 'inner']);
    expect(() => insertElement(doc, 'btn', el('text', 'x', { x: 0, y: 0, width: 1, height: 1 }))).toThrow();
    expect(() => insertElement(doc, 'nope', el('text', 'x', { x: 0, y: 0, width: 1, height: 1 }))).toThrow();
  });

  it('reparents while keeping the absolute position', () => {
    const doc = sample();
    const before = absoluteRect(doc, 'btn');
    const moved = reparent(doc, 'btn', 'inner');
    expect(parentIdOf(moved, 'btn')).toBe('inner');
    expect(absoluteRect(moved, 'btn')).toEqual(before);
    const toRoot = reparent(moved, 'btn', null);
    expect(parentIdOf(toRoot, 'btn')).toBeNull();
    expect(absoluteRect(toRoot, 'btn')).toEqual(before);
  });

  it('refuses to reparent into itself, a descendant or a non container', () => {
    const doc = sample();
    expect(reparent(doc, 'panel', 'inner')).toBe(doc);
    expect(reparent(doc, 'panel', 'panel')).toBe(doc);
    expect(reparent(doc, 'label', 'btn')).toBe(doc);
  });

  it('reorders siblings', () => {
    const doc = sample();
    expect(findElement(reorder(doc, 'btn', 'front'), 'panel')?.children.map((c) => c.id)).toEqual(['inner', 'btn']);
    expect(reorder(doc, 'btn', 'backward')).toBe(doc);
    expect(reorder(doc, 'img', 'back').elements.map((e) => e.id)).toEqual(['img', 'panel']);
  });

  it('clones with fresh ids and names', () => {
    const doc = sample();
    const ids = sequentialIds('c');
    const clone = cloneElement(findElement(doc, 'panel')!, ids, (e) => `${e.name}-copy`);
    expect(clone.id).toBe('c-1');
    expect(clone.children.map((c) => c.id)).toEqual(['c-2', 'c-3']);
    expect(clone.children[1]!.children[0]!.name).toBe('label-copy');
  });

  it('generates unique names', () => {
    const doc = docWith(el('button', 'button-1', { x: 0, y: 0, width: 1, height: 1 }));
    const taken = new Set(['button-1']);
    expect(uniqueName(doc, 'button', taken)).toBe('button-2');
    expect(uniqueName(doc, 'button', taken)).toBe('button-3');
  });

  it('applies the catalog minimum size on creation', () => {
    const e = createElement('button', { x: 1.4, y: 2.6, width: 2, height: 2 }, 'b', 'b');
    expect(e).toMatchObject({ x: 1, y: 3, width: 16, height: 12 });
    expect(e.props.text).toBe('Bouton');
  });
});

describe('drawings and fixed elements', () => {
  it('finds the top-most drawing under a point, ignoring boxes above it', () => {
    const sketch = el('drawing', 'sketch', { x: 0, y: 0, width: 500, height: 500 });
    const box = el('container', 'box', { x: 0, y: 0, width: 200, height: 200 }, [
      el('drawing', 'inner', { x: 10, y: 10, width: 50, height: 50 }),
    ]);
    const doc = docWith(sketch, box);
    expect(drawingAt(doc, { x: 100, y: 100 })?.id).toBe('sketch');
    expect(drawingAt(doc, { x: 20, y: 20 })?.id).toBe('inner');
    expect(drawingAt(doc, { x: 600, y: 600 })).toBeNull();
    const locked = docWith({ ...sketch, locked: true });
    expect(drawingAt(locked, { x: 100, y: 100 })).toBeNull();
  });

  it('knows which fixed element is positioned against the screen', () => {
    const child = el('button', 'child', { x: 0, y: 0, width: 50, height: 20 }, [], { fixed: true });
    const header = el('container', 'header', { x: 0, y: 0, width: 500, height: 80 }, [child], { fixed: true });
    const loose = el('text', 'loose', { x: 0, y: 100, width: 50, height: 20 }, [], { fixed: true });
    const doc = docWith(header, loose);
    expect(isFixedRoot(doc, 'header')).toBe(true);
    expect(isFixedRoot(doc, 'child')).toBe(false);
    expect(isFixedRoot(doc, 'loose')).toBe(true);
    expect(isFixedRoot(docWith(el('text', 'n', { x: 0, y: 0, width: 5, height: 5 })), 'n')).toBe(false);
  });
});

describe('hit test through drawings', () => {
  it('prefers other elements to a drawing laid over them', () => {
    const box = el('container', 'box', { x: 0, y: 0, width: 100, height: 100 });
    const sketch = el('drawing', 'sketch', { x: 0, y: 0, width: 500, height: 500 });
    const doc = docWith(box, sketch);
    expect(hitTest(doc, { x: 50, y: 50 })?.id).toBe('box');
    expect(hitTest(doc, { x: 300, y: 300 })?.id).toBe('sketch');
    expect(hitTest(doc, { x: 300, y: 300 }, { containersOnly: true })).toBeNull();
  });
});
