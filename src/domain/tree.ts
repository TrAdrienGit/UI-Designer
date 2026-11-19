import { defaultPropsFor, defaultStyleFor, getDefinition } from './catalog';
import { containsPoint, type Point, type Rect } from './geometry';
import type { ElementType, UiDocument, UiElement } from './model';

export type IdGenerator = () => string;

/** Random short ids ("el_k3j9x2a1"); collisions are practically impossible for a single document. */
export const randomId: IdGenerator = () => {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return 'el_' + Array.from(bytes, (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-3);
};

export function createElement(type: ElementType, rect: Rect, id: string, name: string): UiElement {
  const def = getDefinition(type);
  return {
    id,
    type,
    name,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(def.minWidth, Math.round(rect.width)),
    height: Math.max(def.minHeight, Math.round(rect.height)),
    hidden: false,
    locked: false,
    cssClass: '',
    style: defaultStyleFor(type),
    props: defaultPropsFor(type),
    children: [],
  };
}

export function canHaveChildren(el: UiElement): boolean {
  return getDefinition(el.type).canHaveChildren;
}

/** Depth-first walk. The callback receives the parent (null for top-level elements). */
export function walk(
  elements: readonly UiElement[],
  fn: (el: UiElement, parent: UiElement | null, depth: number) => void,
  parent: UiElement | null = null,
  depth = 0,
): void {
  for (const el of elements) {
    fn(el, parent, depth);
    walk(el.children, fn, el, depth + 1);
  }
}

export function findElement(doc: UiDocument, id: string): UiElement | undefined {
  let found: UiElement | undefined;
  walk(doc.elements, (el) => {
    if (!found && el.id === id) found = el;
  });
  return found;
}

/** Ancestors of an element, from the top-level element down to its direct parent. Undefined if not found. */
export function ancestorsOf(doc: UiDocument, id: string): UiElement[] | undefined {
  const search = (elements: readonly UiElement[], chain: UiElement[]): UiElement[] | undefined => {
    for (const el of elements) {
      if (el.id === id) return chain;
      const result = search(el.children, [...chain, el]);
      if (result) return result;
    }
    return undefined;
  };
  return search(doc.elements, []);
}

/** Id of the parent element, null for a top-level element, undefined when the element does not exist. */
export function parentIdOf(doc: UiDocument, id: string): string | null | undefined {
  const chain = ancestorsOf(doc, id);
  if (!chain) return undefined;
  return chain.length === 0 ? null : chain[chain.length - 1]!.id;
}

export function siblingsOf(doc: UiDocument, parentId: string | null): readonly UiElement[] {
  if (parentId === null) return doc.elements;
  return findElement(doc, parentId)?.children ?? [];
}

export function isDescendantOf(doc: UiDocument, id: string, ancestorId: string): boolean {
  return ancestorsOf(doc, id)?.some((a) => a.id === ancestorId) ?? false;
}

function mapTree(elements: readonly UiElement[], fn: (el: UiElement) => UiElement): UiElement[] {
  return elements.map((el) => {
    const mapped = fn(el);
    const children = mapTree(mapped.children, fn);
    return children.every((c, i) => c === mapped.children[i]) ? mapped : { ...mapped, children };
  });
}

export function updateElement(doc: UiDocument, id: string, updater: (el: UiElement) => UiElement): UiDocument {
  return { ...doc, elements: mapTree(doc.elements, (el) => (el.id === id ? updater(el) : el)) };
}

export function updateElements(
  doc: UiDocument,
  ids: readonly string[],
  updater: (el: UiElement) => UiElement,
): UiDocument {
  const set = new Set(ids);
  return { ...doc, elements: mapTree(doc.elements, (el) => (set.has(el.id) ? updater(el) : el)) };
}

function filterTree(elements: readonly UiElement[], keep: (el: UiElement) => boolean): UiElement[] {
  return elements.filter(keep).map((el) => {
    const children = filterTree(el.children, keep);
    return children.length === el.children.length && children.every((c, i) => c === el.children[i])
      ? el
      : { ...el, children };
  });
}

export function removeElements(doc: UiDocument, ids: readonly string[]): UiDocument {
  const set = new Set(ids);
  return { ...doc, elements: filterTree(doc.elements, (el) => !set.has(el.id)) };
}

/** Inserts an element under `parentId` (null = canvas) at `index` (default: on top). */
export function insertElement(
  doc: UiDocument,
  parentId: string | null,
  element: UiElement,
  index?: number,
): UiDocument {
  const insertInto = (list: readonly UiElement[]): UiElement[] => {
    const copy = [...list];
    const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length));
    copy.splice(at, 0, element);
    return copy;
  };
  if (parentId === null) return { ...doc, elements: insertInto(doc.elements) };
  const parent = findElement(doc, parentId);
  if (!parent) throw new Error(`Parent not found: ${parentId}`);
  if (!canHaveChildren(parent)) throw new Error(`Element ${parentId} cannot contain children`);
  return updateElement(doc, parentId, (p) => ({ ...p, children: insertInto(p.children) }));
}

/** Absolute position (canvas coordinates) of the inner box of a parent; (0,0) for the canvas. */
export function contentOrigin(doc: UiDocument, parentId: string | null): Point {
  if (parentId === null) return { x: 0, y: 0 };
  const parent = findElement(doc, parentId);
  if (!parent) return { x: 0, y: 0 };
  const rect = absoluteRect(doc, parentId)!;
  return { x: rect.x + parent.style.borderWidth, y: rect.y + parent.style.borderWidth };
}

/** Rect of an element in canvas coordinates. */
export function absoluteRect(doc: UiDocument, id: string): Rect | undefined {
  const chain = ancestorsOf(doc, id);
  const el = findElement(doc, id);
  if (!chain || !el) return undefined;
  let x = el.x;
  let y = el.y;
  for (const a of chain) {
    x += a.x + a.style.borderWidth;
    y += a.y + a.style.borderWidth;
  }
  return { x, y, width: el.width, height: el.height };
}

export interface HitTestOptions {
  /** Only return elements that accept children (used to find drop targets). */
  containersOnly?: boolean;
  /** Elements (and their subtrees) ignored by the test. */
  exclude?: ReadonlySet<string>;
}

/** Deepest, top-most visible element under a canvas point; null when only the canvas is hit. */
export function hitTest(doc: UiDocument, point: Point, options: HitTestOptions = {}): UiElement | null {
  const visit = (elements: readonly UiElement[], origin: Point): UiElement | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]!;
      if (el.hidden || options.exclude?.has(el.id)) continue;
      const rect = { x: origin.x + el.x, y: origin.y + el.y, width: el.width, height: el.height };
      if (!containsPoint(rect, point)) continue;
      const inner = { x: rect.x + el.style.borderWidth, y: rect.y + el.style.borderWidth };
      const deeper = visit(el.children, inner);
      if (deeper) return deeper;
      if (!options.containersOnly || canHaveChildren(el)) return el;
    }
    return null;
  };
  return visit(doc.elements, { x: 0, y: 0 });
}

/**
 * Moves an element under a new parent (null = canvas), keeping its absolute position.
 * Refuses to move an element into itself or one of its descendants.
 */
export function reparent(doc: UiDocument, id: string, newParentId: string | null, index?: number): UiDocument {
  const el = findElement(doc, id);
  if (!el) return doc;
  if (newParentId === id || (newParentId !== null && isDescendantOf(doc, newParentId, id))) return doc;
  if (newParentId !== null) {
    const parent = findElement(doc, newParentId);
    if (!parent || !canHaveChildren(parent)) return doc;
  }
  const abs = absoluteRect(doc, id)!;
  const without = removeElements(doc, [id]);
  const origin = contentOrigin(without, newParentId);
  const moved: UiElement = { ...el, x: abs.x - origin.x, y: abs.y - origin.y };
  return insertElement(without, newParentId, moved, index);
}

export type ZOrderMove = 'forward' | 'backward' | 'front' | 'back';

/** Changes the stacking order of an element among its siblings. */
export function reorder(doc: UiDocument, id: string, move: ZOrderMove): UiDocument {
  const parentId = parentIdOf(doc, id);
  if (parentId === undefined) return doc;
  const siblings = [...siblingsOf(doc, parentId)];
  const index = siblings.findIndex((s) => s.id === id);
  const target =
    move === 'front' ? siblings.length - 1 : move === 'back' ? 0 : move === 'forward' ? index + 1 : index - 1;
  if (target < 0 || target >= siblings.length || target === index) return doc;
  const [el] = siblings.splice(index, 1);
  siblings.splice(target, 0, el!);
  if (parentId === null) return { ...doc, elements: siblings };
  return updateElement(doc, parentId, (p) => ({ ...p, children: siblings }));
}

/** Deep copy of an element with fresh ids (and fresh names when `rename` is given). */
export function cloneElement(el: UiElement, newId: IdGenerator, rename?: (el: UiElement) => string): UiElement {
  return {
    ...el,
    id: newId(),
    name: rename ? rename(el) : el.name,
    style: { ...el.style },
    props: { ...el.props, items: [...el.props.items] },
    children: el.children.map((c) => cloneElement(c, newId, rename)),
  };
}

export function allNames(doc: UiDocument): Set<string> {
  const names = new Set<string>();
  walk(doc.elements, (el) => names.add(el.name));
  return names;
}

/** First free "prefix-N" name in the document. `taken` lets callers reserve names not yet inserted. */
export function uniqueName(doc: UiDocument, prefix: string, taken: Set<string> = allNames(doc)): string {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n++;
  const name = `${prefix}-${n}`;
  taken.add(name);
  return name;
}

export function countElements(doc: UiDocument): number {
  let n = 0;
  walk(doc.elements, () => n++);
  return n;
}
