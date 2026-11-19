/**
 * Renders the document on the design surface (real DOM built from the same
 * HTML mapping as the export) and draws the editing overlay: grid, selection,
 * handles, hover, drop target, rubber bands.
 */
import type { EditorState } from '../../application/editorStore';
import type { ResizeHandle } from '../../application/transform';
import type { Point, Rect } from '../../domain/geometry';
import { cssText, elementSpec } from '../../domain/html';
import type { UiElement } from '../../domain/model';
import { absoluteRect, findElement } from '../../domain/tree';
import { h } from '../dom';

/** Free space around the canvas inside the scroll area (screen px). */
export const CANVAS_MARGIN = 400;

const HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface OverlayState {
  hoverId: string | null;
  dropTargetId: string | null;
  /** Rubber band (selection marquee) in canvas coordinates. */
  marquee: Rect | null;
  /** Element being drawn, in canvas coordinates. */
  drawRect: Rect | null;
}

interface CachedNode {
  readonly el: UiElement;
  readonly node: HTMLElement;
}

export class CanvasView {
  readonly viewport: HTMLElement;
  private readonly content: HTMLElement;
  readonly canvasEl: HTMLElement;
  private readonly gridEl: HTMLElement;
  private readonly overlay: HTMLElement;
  private cache = new Map<string, CachedNode>();
  private state: EditorState | null = null;
  readonly overlayState: OverlayState = { hoverId: null, dropTargetId: null, marquee: null, drawRect: null };

  constructor(host: HTMLElement) {
    this.canvasEl = h('div', { id: 'uid-canvas', class: 'uid-root design-canvas' });
    this.gridEl = h('div', { class: 'design-grid' });
    this.overlay = h('div', { class: 'design-overlay' });
    this.content = h('div', { class: 'design-content' }, this.canvasEl, this.gridEl, this.overlay);
    this.viewport = h('div', { class: 'design-viewport', tabindex: '-1' }, this.content);
    host.append(this.viewport);
  }

  render(state: EditorState, documentChanged: boolean): void {
    const first = this.state === null;
    const zoomChanged = this.state?.zoom !== state.zoom;
    this.state = state;
    const { canvas, grid } = state.document;
    const z = state.zoom;

    if (documentChanged || first) this.renderElements(state);

    const w = canvas.width * z;
    const hgt = canvas.height * z;
    this.content.style.width = `${w + CANVAS_MARGIN * 2}px`;
    this.content.style.height = `${hgt + CANVAS_MARGIN * 2}px`;
    Object.assign(this.canvasEl.style, {
      left: `${CANVAS_MARGIN}px`,
      top: `${CANVAS_MARGIN}px`,
      width: `${canvas.width}px`,
      height: `${canvas.height}px`,
      transform: `scale(${z})`,
      background: canvas.transparent ? '' : canvas.background,
    });
    this.canvasEl.classList.toggle('transparent', canvas.transparent);

    const step = grid.size * z;
    const showGrid = grid.visible && step >= 4;
    Object.assign(this.gridEl.style, {
      display: showGrid ? 'block' : 'none',
      left: `${CANVAS_MARGIN}px`,
      top: `${CANVAS_MARGIN}px`,
      width: `${w}px`,
      height: `${hgt}px`,
      backgroundSize: `${step}px ${step}px`,
    });
    if (first || zoomChanged) this.content.classList.toggle('zoomed-out', z < 1);
    this.renderOverlay();
  }

  private renderElements(state: EditorState): void {
    const next = new Map<string, CachedNode>();
    const build = (el: UiElement): HTMLElement => {
      const cached = this.cache.get(el.id);
      if (cached && cached.el === el) {
        // Unchanged subtree: reuse the nodes (and register the whole subtree as alive).
        const keep = (e: UiElement): void => {
          const c = this.cache.get(e.id);
          if (c) next.set(e.id, c);
          e.children.forEach(keep);
        };
        keep(el);
        return cached.node;
      }
      const spec = elementSpec(el, '');
      const node = document.createElement(spec.tag);
      for (const [key, value] of Object.entries(spec.attrs)) {
        if (key === 'id') continue; // element ids must not clash with the editor's own DOM
        node.setAttribute(key, value === true ? '' : value);
      }
      node.style.cssText = cssText(spec);
      node.dataset['uid'] = el.id;
      if (!spec.selfClosing) {
        if (el.children.length > 0) node.append(...el.children.map(build));
        else node.innerHTML = spec.inner;
      }
      next.set(el.id, { el, node });
      return node;
    };
    const nodes = state.document.elements.map(build);
    this.canvasEl.replaceChildren(...nodes);
    this.cache = next;
  }

  /** Redraws selection boxes, handles and rubber bands. Cheap: call on every pointer move. */
  renderOverlay(): void {
    const state = this.state;
    if (!state) return;
    const doc = state.document;
    const parts: HTMLElement[] = [];
    const box = (rect: Rect, cls: string): HTMLElement => {
      const r = this.toOverlay(rect);
      return h('div', {
        class: cls,
        style: `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`,
      });
    };

    const { hoverId, dropTargetId, marquee, drawRect } = this.overlayState;
    if (hoverId && !state.selection.includes(hoverId)) {
      const r = absoluteRect(doc, hoverId);
      if (r) parts.push(box(r, 'ov-hover'));
    }
    if (dropTargetId) {
      const r = absoluteRect(doc, dropTargetId);
      if (r) parts.push(box(r, 'ov-drop'));
    }
    for (const id of state.selection) {
      const r = absoluteRect(doc, id);
      const el = findElement(doc, id);
      if (!r || !el) continue;
      const sel = box(r, el.locked ? 'ov-selection locked' : 'ov-selection');
      if (state.selection.length === 1 && !el.locked && state.tool === 'pointer') {
        for (const handle of HANDLES) sel.append(h('div', { class: `ov-handle h-${handle}`, 'data-handle': handle }));
      }
      if (state.selection.length === 1) {
        sel.append(h('div', { class: 'ov-size' }, `${el.width} × ${el.height}`));
      }
      parts.push(sel);
    }
    if (marquee) parts.push(box(marquee, 'ov-marquee'));
    if (drawRect) {
      const draw = box(drawRect, 'ov-draw');
      draw.append(h('div', { class: 'ov-size' }, `${Math.round(drawRect.width)} × ${Math.round(drawRect.height)}`));
      parts.push(draw);
    }
    this.overlay.replaceChildren(...parts);
  }

  /** Canvas coordinates -> overlay (scroll content) coordinates. */
  private toOverlay(rect: Rect): Rect {
    const z = this.state?.zoom ?? 1;
    return { x: CANVAS_MARGIN + rect.x * z, y: CANVAS_MARGIN + rect.y * z, width: rect.width * z, height: rect.height * z };
  }

  /** Screen (client) point -> canvas coordinates. */
  toCanvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvasEl.getBoundingClientRect();
    const z = this.state?.zoom ?? 1;
    return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z };
  }

  /** Scrolls so that canvas point `p` sits under the client position (used when zooming at the cursor). */
  keepPointUnder(p: Point, clientX: number, clientY: number): void {
    const z = this.state?.zoom ?? 1;
    const vp = this.viewport.getBoundingClientRect();
    this.viewport.scrollLeft = CANVAS_MARGIN + p.x * z - (clientX - vp.left);
    this.viewport.scrollTop = CANVAS_MARGIN + p.y * z - (clientY - vp.top);
  }

  centerCanvas(): void {
    const state = this.state;
    if (!state) return;
    const z = state.zoom;
    const { width, height } = state.document.canvas;
    this.viewport.scrollLeft = CANVAS_MARGIN + (width * z) / 2 - this.viewport.clientWidth / 2;
    this.viewport.scrollTop = CANVAS_MARGIN + (height * z) / 2 - this.viewport.clientHeight / 2;
  }

  /** Zoom level that fits the whole canvas in the viewport. */
  fitZoom(): number {
    const state = this.state;
    if (!state) return 1;
    const { width, height } = state.document.canvas;
    const zx = (this.viewport.clientWidth - 64) / width;
    const zy = (this.viewport.clientHeight - 64) / height;
    return Math.max(0.1, Math.min(4, Math.min(zx, zy)));
  }
}
