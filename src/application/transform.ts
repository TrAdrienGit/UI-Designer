/**
 * Geometry operations applied to a set of elements: move, resize, drop into a
 * container, align, distribute, group. All functions are pure.
 */
import { getDefinition } from '../domain/catalog';
import { boundingRect, snap, type Point, type Rect } from '../domain/geometry';
import type { UiDocument, UiElement } from '../domain/model';
import {
  absoluteRect,
  canHaveChildren,
  contentOrigin,
  findElement,
  isDescendantOf,
  parentIdOf,
  reparent,
  siblingsOf,
  updateElement,
} from '../domain/tree';

/** Removes ids whose ancestor is also in the list (moving a parent already moves its children). */
export function topLevelIds(doc: UiDocument, ids: readonly string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => findElement(doc, id) && !ids.some((other) => other !== id && set.has(other) && isDescendantOf(doc, id, other)));
}

export function movableIds(doc: UiDocument, ids: readonly string[]): string[] {
  return topLevelIds(doc, ids).filter((id) => !findElement(doc, id)!.locked);
}

/**
 * Moves elements by a delta. When `gridStep` > 1, the top-left corner of the
 * selection bounding box is snapped to the canvas grid.
 */
export function moveElements(doc: UiDocument, ids: readonly string[], delta: Point, gridStep = 0): UiDocument {
  const targets = movableIds(doc, ids);
  if (targets.length === 0) return doc;
  let { x: dx, y: dy } = delta;
  if (gridStep > 1) {
    // Snap relative to the parent's inner box so coordinates stay round inside bordered boxes.
    const bounds = boundingRect(targets.map((id) => absoluteRect(doc, id)!))!;
    const origin = contentOrigin(doc, parentIdOf(doc, targets[0]!) ?? null);
    dx = snap(bounds.x - origin.x + dx, gridStep) + origin.x - bounds.x;
    dy = snap(bounds.y - origin.y + dy, gridStep) + origin.y - bounds.y;
  }
  if (dx === 0 && dy === 0) return doc;
  let result = doc;
  for (const id of targets) {
    result = updateElement(result, id, (el) => ({ ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) }));
  }
  return result;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface ResizeOptions {
  gridStep?: number;
  /** Point the grid is aligned on (the parent's inner box), default (0,0). */
  gridOrigin?: Point;
  /** Keeps the width/height ratio of the starting rect (corner handles only). */
  keepRatio?: boolean;
}

/** Computes the new absolute rect of a resize gesture from the starting rect and pointer delta. */
export function resizeRect(start: Rect, handle: ResizeHandle, delta: Point, min: { width: number; height: number }, options: ResizeOptions = {}): Rect {
  const step = options.gridStep ?? 0;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  const o = options.gridOrigin ?? { x: 0, y: 0 };
  const snapX = (v: number): number => (step > 1 ? snap(v - o.x, step) + o.x : Math.round(v));
  const snapY = (v: number): number => (step > 1 ? snap(v - o.y, step) + o.y : Math.round(v));
  if (handle.includes('w')) left = Math.min(snapX(left + delta.x), right - min.width);
  if (handle.includes('e')) right = Math.max(snapX(right + delta.x), left + min.width);
  if (handle.includes('n')) top = Math.min(snapY(top + delta.y), bottom - min.height);
  if (handle.includes('s')) bottom = Math.max(snapY(bottom + delta.y), top + min.height);
  let rect = { x: left, y: top, width: right - left, height: bottom - top };
  if (options.keepRatio && handle.length === 2 && start.height > 0) {
    const ratio = start.width / start.height;
    const width = Math.max(rect.width, rect.height * ratio);
    const height = width / ratio;
    rect = {
      x: handle.includes('w') ? right - width : left,
      y: handle.includes('n') ? bottom - height : top,
      width: Math.round(width),
      height: Math.round(height),
    };
  }
  return rect;
}

/** Applies an absolute rect to an element (converted back to parent-relative coordinates). */
export function setAbsoluteRect(doc: UiDocument, id: string, rect: Rect): UiDocument {
  const parentId = parentIdOf(doc, id);
  if (parentId === undefined) return doc;
  const origin = contentOrigin(doc, parentId);
  return updateElement(doc, id, (el) => ({
    ...el,
    x: Math.round(rect.x - origin.x),
    y: Math.round(rect.y - origin.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }));
}

export function resizeElement(doc: UiDocument, id: string, handle: ResizeHandle, delta: Point, options: ResizeOptions = {}): UiDocument {
  const el = findElement(doc, id);
  const start = absoluteRect(doc, id);
  if (!el || !start || el.locked) return doc;
  const def = getDefinition(el.type);
  const gridOrigin = options.gridOrigin ?? contentOrigin(doc, parentIdOf(doc, id) ?? null);
  const rect = resizeRect(start, handle, delta, { width: def.minWidth, height: def.minHeight }, { ...options, gridOrigin });
  return setAbsoluteRect(doc, id, rect);
}

/**
 * Moves elements into `targetParentId` (null = canvas) keeping their position on screen.
 * Elements already in that parent, or that would end up inside themselves, are left alone.
 */
export function dropInto(doc: UiDocument, ids: readonly string[], targetParentId: string | null): UiDocument {
  if (targetParentId !== null) {
    const target = findElement(doc, targetParentId);
    if (!target || !canHaveChildren(target)) return doc;
  }
  let result = doc;
  for (const id of movableIds(doc, ids)) {
    if (parentIdOf(result, id) === targetParentId) continue;
    if (targetParentId === id || (targetParentId !== null && isDescendantOf(result, targetParentId, id))) continue;
    result = reparent(result, id, targetParentId);
  }
  return result;
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Reference rect for alignment: the selection bounds, or the parent's inner box for a single element. */
function alignReference(doc: UiDocument, ids: readonly string[]): Rect | null {
  if (ids.length === 1) {
    const parentId = parentIdOf(doc, ids[0]!);
    if (parentId === undefined) return null;
    const origin = contentOrigin(doc, parentId);
    if (parentId === null) return { ...origin, width: doc.canvas.width, height: doc.canvas.height };
    const parent = findElement(doc, parentId)!;
    const border = parent.style.borderWidth * 2;
    return { ...origin, width: parent.width - border, height: parent.height - border };
  }
  return boundingRect(ids.map((id) => absoluteRect(doc, id)!));
}

export function alignElements(doc: UiDocument, ids: readonly string[], mode: AlignMode): UiDocument {
  const targets = movableIds(doc, ids);
  const ref = alignReference(doc, targets);
  if (!ref) return doc;
  let result = doc;
  for (const id of targets) {
    const r = absoluteRect(result, id)!;
    let { x, y } = r;
    if (mode === 'left') x = ref.x;
    if (mode === 'hcenter') x = ref.x + (ref.width - r.width) / 2;
    if (mode === 'right') x = ref.x + ref.width - r.width;
    if (mode === 'top') y = ref.y;
    if (mode === 'vcenter') y = ref.y + (ref.height - r.height) / 2;
    if (mode === 'bottom') y = ref.y + ref.height - r.height;
    result = setAbsoluteRect(result, id, { ...r, x, y });
  }
  return result;
}

/** Spreads 3+ elements so the gaps between them are equal. */
export function distributeElements(doc: UiDocument, ids: readonly string[], axis: 'horizontal' | 'vertical'): UiDocument {
  const targets = movableIds(doc, ids);
  if (targets.length < 3) return doc;
  const rects = targets.map((id) => ({ id, rect: absoluteRect(doc, id)! }));
  const pos = axis === 'horizontal' ? 'x' : 'y';
  const size = axis === 'horizontal' ? 'width' : 'height';
  rects.sort((a, b) => a.rect[pos] - b.rect[pos]);
  const first = rects[0]!.rect;
  const last = rects[rects.length - 1]!.rect;
  const total = rects.reduce((sum, r) => sum + r.rect[size], 0);
  const gap = (last[pos] + last[size] - first[pos] - total) / (rects.length - 1);
  let cursor = first[pos];
  let result = doc;
  for (const { id, rect } of rects) {
    result = setAbsoluteRect(result, id, { ...rect, [pos]: Math.round(cursor) });
    cursor += rect[size] + gap;
  }
  return result;
}

/** Whether every id shares the same parent (needed for grouping). */
export function shareParent(doc: UiDocument, ids: readonly string[]): boolean {
  const parents = new Set(ids.map((id) => parentIdOf(doc, id)));
  return parents.size === 1 && !parents.has(undefined);
}

/** Wraps sibling elements into a new container sized to their bounds. Returns the new doc and group id. */
export function groupElements(doc: UiDocument, ids: readonly string[], group: UiElement): { doc: UiDocument; groupId: string } | null {
  const targets = topLevelIds(doc, ids);
  if (targets.length === 0 || !shareParent(doc, targets)) return null;
  const parentId = parentIdOf(doc, targets[0]!)!;
  const bounds = boundingRect(targets.map((id) => absoluteRect(doc, id)!))!;
  const origin = contentOrigin(doc, parentId);
  const siblings = siblingsOf(doc, parentId);
  const insertIndex = Math.max(...targets.map((id) => siblings.findIndex((s) => s.id === id)));
  const box: UiElement = {
    ...group,
    x: bounds.x - origin.x,
    y: bounds.y - origin.y,
    width: bounds.width,
    height: bounds.height,
    style: { ...group.style, borderWidth: 0, background: 'transparent' },
    children: [],
  };
  // Insert the group above the top-most grouped element, then move members inside in stacking order.
  let result = doc;
  const siblingList = [...siblings];
  siblingList.splice(insertIndex + 1, 0, box);
  result = parentId === null ? { ...result, elements: siblingList } : updateElement(result, parentId, (p) => ({ ...p, children: siblingList }));
  const ordered = [...targets].sort((a, b) => siblings.findIndex((s) => s.id === a) - siblings.findIndex((s) => s.id === b));
  for (const id of ordered) result = reparent(result, id, box.id);
  return { doc: result, groupId: box.id };
}

/** Moves the children of a container to its parent (keeping their position) and removes the container. */
export function ungroupElement(doc: UiDocument, id: string): { doc: UiDocument; childIds: string[] } | null {
  const el = findElement(doc, id);
  const parentId = parentIdOf(doc, id);
  if (!el || parentId === undefined || el.children.length === 0) return null;
  const index = siblingsOf(doc, parentId).findIndex((s) => s.id === id);
  const childIds = el.children.map((c) => c.id);
  let result = doc;
  childIds.forEach((childId, i) => {
    result = reparent(result, childId, parentId, index + 1 + i);
  });
  const remaining = siblingsOf(result, parentId).filter((s) => s.id !== id);
  result = parentId === null ? { ...result, elements: remaining } : updateElement(result, parentId, (p) => ({ ...p, children: remaining }));
  return { doc: result, childIds };
}
