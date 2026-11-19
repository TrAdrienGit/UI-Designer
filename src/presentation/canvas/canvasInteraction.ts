/**
 * Pointer handling on the design surface: drawing new elements, selecting,
 * moving (with drop into containers), resizing, rubber band selection,
 * panning and zooming.
 */
import type { EditorStore } from '../../application/editorStore';
import { dropInto, moveElements, movableIds, resizeElement, type ResizeHandle } from '../../application/transform';
import { getDefinition } from '../../domain/catalog';
import { containsRect, rectFromPoints, snap, type Point, type Rect } from '../../domain/geometry';
import { absoluteRect, findElement, hitTest, parentIdOf, walk } from '../../domain/tree';
import type { Logger } from '../../application/ports';
import { isElementTool } from '../tools';
import type { CanvasView } from './canvasView';

type Gesture =
  | { kind: 'draw'; start: Point; current: Point }
  | { kind: 'move'; start: Point; ids: string[]; started: boolean; clickId: string }
  | { kind: 'resize'; id: string; handle: ResizeHandle; start: Point }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean; base: readonly string[] }
  | { kind: 'pan'; startX: number; startY: number; scrollLeft: number; scrollTop: number };

/** Pointer travel (screen px) under which a press counts as a click. */
const CLICK_TOLERANCE = 4;

export interface CanvasInteractionCallbacks {
  /** Double click on an element: focus its main property (text...). */
  onEditElement(id: string): void;
  onContextMenu(clientX: number, clientY: number): void;
  onPointerMove(point: Point | null): void;
}

export class CanvasInteraction {
  private gesture: Gesture | null = null;
  private spaceDown = false;
  private pointerId: number | null = null;
  private lastClient = { x: 0, y: 0 };

  constructor(
    private readonly view: CanvasView,
    private readonly store: EditorStore,
    private readonly callbacks: CanvasInteractionCallbacks,
    private readonly log: Logger,
  ) {
    const vp = view.viewport;
    vp.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    vp.addEventListener('pointermove', (e) => this.onPointerMove(e));
    vp.addEventListener('pointerup', (e) => this.onPointerUp(e));
    vp.addEventListener('pointercancel', () => this.cancel());
    vp.addEventListener('pointerleave', () => {
      if (!this.gesture) {
        this.view.overlayState.hoverId = null;
        this.view.renderOverlay();
        this.callbacks.onPointerMove(null);
      }
    });
    vp.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    vp.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    vp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const p = this.view.toCanvasPoint(e.clientX, e.clientY);
      const hit = hitTest(this.store.document, p);
      if (hit && !this.store.getState().selection.includes(hit.id)) this.store.select([hit.id]);
      this.callbacks.onContextMenu(e.clientX, e.clientY);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement === vp) {
        this.spaceDown = true;
        vp.classList.add('space-pan');
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        vp.classList.remove('space-pan');
      }
    });
  }

  get busy(): boolean {
    return this.gesture !== null;
  }

  private get grid(): number {
    const g = this.store.document.grid;
    return g.snap ? g.size : 0;
  }

  // ------------------------------------------------------------------ pointer down

  private onPointerDown(e: PointerEvent): void {
    if (this.gesture) return;
    this.view.viewport.focus({ preventScroll: true });
    const state = this.store.getState();
    const p = this.view.toCanvasPoint(e.clientX, e.clientY);
    this.lastClient = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || (e.button === 0 && (this.spaceDown || state.tool === 'pan'))) {
      this.startPan(e);
      return;
    }
    if (e.button !== 0) return;

    if (state.tool === 'zoom') {
      const before = p;
      this.store.zoomStep(e.altKey ? -1 : 1);
      this.view.keepPointUnder(before, e.clientX, e.clientY);
      return;
    }

    if (isElementTool(state.tool)) {
      const start = this.snapPoint(p);
      this.gesture = { kind: 'draw', start, current: start };
      this.capture(e);
      this.view.overlayState.drawRect = { ...start, width: 0, height: 0 };
      this.view.renderOverlay();
      return;
    }

    // Pointer tool.
    const handle = (e.target as HTMLElement).dataset?.['handle'] as ResizeHandle | undefined;
    if (handle && state.selection.length === 1) {
      this.store.beginGesture();
      this.gesture = { kind: 'resize', id: state.selection[0]!, handle, start: p };
      this.capture(e);
      return;
    }

    const hit = hitTest(this.store.document, p);
    if (!hit) {
      const base = e.shiftKey || e.ctrlKey ? state.selection : [];
      if (!e.shiftKey && !e.ctrlKey) this.store.clearSelection();
      this.gesture = { kind: 'marquee', start: p, current: p, additive: e.shiftKey || e.ctrlKey, base };
      this.capture(e);
      return;
    }

    if (e.shiftKey || e.ctrlKey) {
      this.store.toggleSelect(hit.id);
      return;
    }
    // Clicking inside an already selected element keeps the (multi) selection so it can be dragged.
    const selected = state.selection.includes(hit.id)
      ? state.selection
      : state.selection.find((id) => isAncestorSelected(this.store, hit.id, id))
        ? state.selection
        : [hit.id];
    if (selected !== state.selection) this.store.select(selected);
    this.gesture = { kind: 'move', start: p, ids: [...this.store.getState().selection], started: false, clickId: hit.id };
    this.capture(e);
  }

  private startPan(e: PointerEvent): void {
    const vp = this.view.viewport;
    this.gesture = { kind: 'pan', startX: e.clientX, startY: e.clientY, scrollLeft: vp.scrollLeft, scrollTop: vp.scrollTop };
    vp.classList.add('panning');
    this.capture(e);
    e.preventDefault();
  }

  private capture(e: PointerEvent): void {
    this.pointerId = e.pointerId;
    this.view.viewport.setPointerCapture(e.pointerId);
  }

  // ------------------------------------------------------------------ pointer move

  private onPointerMove(e: PointerEvent): void {
    const p = this.view.toCanvasPoint(e.clientX, e.clientY);
    this.callbacks.onPointerMove(p);
    const g = this.gesture;
    if (!g) {
      const hover = this.store.getState().tool === 'pointer' ? hitTest(this.store.document, p)?.id ?? null : null;
      if (hover !== this.view.overlayState.hoverId) {
        this.view.overlayState.hoverId = hover;
        this.view.renderOverlay();
      }
      return;
    }
    switch (g.kind) {
      case 'pan':
        this.view.viewport.scrollLeft = g.scrollLeft - (e.clientX - g.startX);
        this.view.viewport.scrollTop = g.scrollTop - (e.clientY - g.startY);
        break;
      case 'draw': {
        let current = this.snapPoint(p);
        if (e.shiftKey) current = squareFrom(g.start, current);
        g.current = current;
        this.view.overlayState.drawRect = rectFromPoints(g.start, current);
        this.view.renderOverlay();
        break;
      }
      case 'move': {
        if (!g.started) {
          if (Math.hypot(e.clientX - this.lastClient.x, e.clientY - this.lastClient.y) < CLICK_TOLERANCE) return;
          if (movableIds(this.store.document, g.ids).length === 0) return;
          g.started = true;
          this.store.beginGesture();
        }
        let delta = { x: p.x - g.start.x, y: p.y - g.start.y };
        if (e.shiftKey) delta = Math.abs(delta.x) > Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
        const grid = this.grid;
        this.store.updateGesture((base) => moveElements(base, g.ids, delta, grid));
        this.view.overlayState.hoverId = null;
        this.view.overlayState.dropTargetId = e.altKey ? null : (this.dropTargetAt(p, g.ids) ?? null);
        this.view.renderOverlay();
        break;
      }
      case 'resize': {
        const delta = { x: p.x - g.start.x, y: p.y - g.start.y };
        const grid = this.grid;
        this.store.updateGesture((base) => resizeElement(base, g.id, g.handle, delta, { gridStep: grid, keepRatio: e.shiftKey }));
        break;
      }
      case 'marquee': {
        g.current = p;
        const band = rectFromPoints(g.start, p);
        this.view.overlayState.marquee = band;
        const inside = elementsInside(this.store, band);
        this.store.select(g.additive ? [...new Set([...g.base, ...inside])] : inside);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ pointer up

  private onPointerUp(e: PointerEvent): void {
    const g = this.gesture;
    if (!g) return;
    this.release();
    switch (g.kind) {
      case 'pan':
        this.view.viewport.classList.remove('panning');
        break;
      case 'draw':
        this.finishDraw(g.start, g.current, e);
        break;
      case 'move': {
        if (!g.started) {
          // Plain click: select exactly the clicked element (a child of a selected box, one of a multi-selection...).
          this.store.select([g.clickId]);
          break;
        }
        const target = e.altKey ? undefined : this.dropTargetAt(this.view.toCanvasPoint(e.clientX, e.clientY), g.ids);
        if (target !== undefined) {
          this.store.updateGesture((base) => {
            const moved = moveElements(base, g.ids, deltaOf(this.store, base, g.ids), 0);
            return dropInto(moved, g.ids, target);
          });
        }
        this.store.endGesture('Déplacer');
        break;
      }
      case 'resize':
        this.store.endGesture('Redimensionner');
        break;
      case 'marquee':
        break;
    }
    this.view.overlayState.dropTargetId = null;
    this.view.overlayState.marquee = null;
    this.view.overlayState.drawRect = null;
    this.view.renderOverlay();
  }

  private finishDraw(start: Point, current: Point, e: PointerEvent): void {
    const state = this.store.getState();
    if (!isElementTool(state.tool)) return;
    const type = state.tool;
    const def = getDefinition(type);
    const z = state.zoom;
    let rect: Rect = rectFromPoints(start, current);
    if (rect.width * z < CLICK_TOLERANCE && rect.height * z < CLICK_TOLERANCE) {
      // Simple click: default size, top-left corner at the click.
      rect = { x: start.x, y: start.y, width: def.defaultWidth, height: def.defaultHeight };
    } else {
      rect = { ...rect, width: Math.max(rect.width, def.minWidth), height: Math.max(rect.height, def.minHeight) };
    }
    const id = this.store.addElement(type, rect, undefined, this.grid);
    this.log.info(`Element created: ${type}`, { id, rect });
    // Ctrl keeps the tool active to draw several elements in a row.
    if (!e.ctrlKey) this.store.setTool('pointer');
  }

  private release(): void {
    if (this.pointerId !== null && this.view.viewport.hasPointerCapture(this.pointerId)) {
      this.view.viewport.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.gesture = null;
  }

  /** Aborts the current gesture (Escape). Returns true if something was cancelled. */
  cancel(): boolean {
    const g = this.gesture;
    if (!g) return false;
    this.release();
    if (g.kind === 'move' || g.kind === 'resize') this.store.cancelGesture();
    if (g.kind === 'pan') this.view.viewport.classList.remove('panning');
    this.view.overlayState.dropTargetId = null;
    this.view.overlayState.marquee = null;
    this.view.overlayState.drawRect = null;
    this.view.renderOverlay();
    return true;
  }

  // ------------------------------------------------------------------ other events

  private onDoubleClick(e: MouseEvent): void {
    if (this.store.getState().tool !== 'pointer') return;
    const hit = hitTest(this.store.document, this.view.toCanvasPoint(e.clientX, e.clientY));
    if (hit) {
      this.store.select([hit.id]);
      this.callbacks.onEditElement(hit.id);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const p = this.view.toCanvasPoint(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.store.setZoom(this.store.getState().zoom * factor);
    this.view.keepPointUnder(p, e.clientX, e.clientY);
  }

  // ------------------------------------------------------------------ helpers

  private snapPoint(p: Point): Point {
    const grid = this.grid;
    return grid > 1 ? { x: snap(p.x, grid), y: snap(p.y, grid) } : { x: Math.round(p.x), y: Math.round(p.y) };
  }

  /**
   * Container that would receive the moved elements, null for the canvas, or
   * undefined when nothing would change (same parent for every element).
   */
  private dropTargetAt(p: Point, ids: readonly string[]): string | null | undefined {
    const doc = this.store.document;
    const exclude = new Set<string>();
    for (const id of ids) {
      const el = findElement(doc, id);
      if (el) walk([el], (e) => exclude.add(e.id));
    }
    const target = hitTest(doc, p, { containersOnly: true, exclude })?.id ?? null;
    const movable = movableIds(doc, ids);
    return movable.every((id) => parentIdOf(doc, id) === target) ? undefined : target;
  }
}

function isAncestorSelected(store: EditorStore, id: string, selectedId: string): boolean {
  // True when the clicked element lives inside a selected container.
  let current = parentIdOf(store.document, id);
  while (current) {
    if (current === selectedId) return true;
    current = parentIdOf(store.document, current);
  }
  return false;
}

/** Delta already applied by the move gesture (current position vs. gesture base), so the drop keeps it. */
function deltaOf(store: EditorStore, base: import('../../domain/model').UiDocument, ids: readonly string[]): Point {
  const id = movableIds(base, ids)[0];
  if (!id) return { x: 0, y: 0 };
  const before = absoluteRect(base, id)!;
  const after = absoluteRect(store.document, id)!;
  return { x: after.x - before.x, y: after.y - before.y };
}

function squareFrom(start: Point, current: Point): Point {
  const size = Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
  return { x: start.x + Math.sign(current.x - start.x || 1) * size, y: start.y + Math.sign(current.y - start.y || 1) * size };
}

/** Visible elements fully inside the band, excluding children of elements already taken. */
function elementsInside(store: EditorStore, band: Rect): string[] {
  const doc = store.document;
  const result: string[] = [];
  const visit = (list: readonly import('../../domain/model').UiElement[]): void => {
    for (const el of list) {
      if (el.hidden) continue;
      const r = absoluteRect(doc, el.id)!;
      if (containsRect(band, r)) result.push(el.id);
      else visit(el.children);
    }
  };
  visit(doc.elements);
  return result;
}
