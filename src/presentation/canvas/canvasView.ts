/**
 * Renders the document on the design surface (real DOM built from the same
 * HTML mapping as the export) and draws the editing overlay: grid, selection,
 * handles, hover, drop target, rubber bands.
 */
import type { EditorState } from '../../application/editorStore';
import type { ResizeHandle } from '../../application/transform';
import type { Point, Rect } from '../../domain/geometry';
import { backgroundImageCss, cssText, elementSpec, LINKABLE_TYPES } from '../../domain/html';
import type { UiElement } from '../../domain/model';
import { absoluteRect, findElement, walk } from '../../domain/tree';
import { h } from '../dom';
import { icon } from '../icons';

/** Free space around the canvas inside the scroll area (screen px). */
export const CANVAS_MARGIN = 400;

const HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Handles that resize the page itself (bottom edge, right edge, corner). */
export type PageHandle = 's' | 'e' | 'se';

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
  /** Fixed state of each cached node (a node is rebuilt when it changes). */
  private fixedState = new Map<string, boolean>();
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
    const bg = backgroundImageCss(canvas.backgroundImage, canvas.backgroundFit);
    for (const prop of ['background-image', 'background-size', 'background-position', 'background-repeat']) {
      this.canvasEl.style.setProperty(prop, bg.find(([k]) => k === prop)?.[1] ?? '');
    }
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
    const nextFixed = new Map<string, boolean>();
    // Fixed elements render with position: fixed at their page coordinates; inside the
    // scaled canvas (a CSS transform) that behaves like absolute positioning on the page.
    const build = (el: UiElement, origin: Point, insideFixed: boolean): HTMLElement => {
      const fixedRoot = el.fixed && !insideFixed;
      const cached = this.cache.get(el.id);
      if (cached && cached.el === el && this.fixedState.get(el.id) === fixedRoot && !fixedRoot) {
        // Unchanged subtree: reuse the nodes (and register the whole subtree as alive).
        const keep = (e: UiElement): void => {
          const c = this.cache.get(e.id);
          if (c) next.set(e.id, c);
          nextFixed.set(e.id, this.fixedState.get(e.id) ?? false);
          e.children.forEach(keep);
        };
        keep(el);
        return cached.node;
      }
      const abs = { x: origin.x + el.x, y: origin.y + el.y };
      const spec = elementSpec(el, '', fixedRoot ? { fixedAt: abs } : {});
      const node = document.createElement(spec.tag);
      for (const [key, value] of Object.entries(spec.attrs)) {
        if (key === 'id' || key === 'autoplay') continue; // no id clash with the editor's DOM, no playback while designing
        node.setAttribute(key, value === true ? '' : value);
      }
      node.style.cssText = cssText(spec);
      node.dataset['uid'] = el.id;
      if (!spec.selfClosing) {
        const inner = { x: abs.x + el.style.borderWidth, y: abs.y + el.style.borderWidth };
        if (el.children.length > 0) node.append(...el.children.map((c) => build(c, inner, insideFixed || el.fixed)));
        else node.innerHTML = spec.inner;
      }
      next.set(el.id, { el, node });
      nextFixed.set(el.id, fixedRoot);
      return node;
    };
    const nodes = state.document.elements.map((el) => build(el, { x: 0, y: 0 }, false));
    this.canvasEl.replaceChildren(...nodes);
    this.cache = next;
    this.fixedState = nextFixed;
  }

  /** Live DOM node of an element on the design surface. */
  nodeOf(id: string): HTMLElement | undefined {
    return this.cache.get(id)?.node;
  }

  /**
   * Shows a paint surface over `rect` (canvas coordinates). When `replaces` is
   * given the surface takes that node's place in the stacking order.
   */
  showPaintSurface(surface: HTMLCanvasElement, rect: Rect, replaces: HTMLElement | null): void {
    surface.className = 'paint-surface';
    if (replaces && replaces.parentElement) {
      // Same place in the stacking order and same positioning as the drawing node;
      // the size is the stroke rect (larger than the node when the page sketch grows).
      const st = replaces.style;
      Object.assign(surface.style, {
        position: st.position || 'absolute',
        left: st.left,
        top: st.top,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: st.zIndex,
      });
      replaces.after(surface);
      replaces.style.visibility = 'hidden';
    } else {
      Object.assign(surface.style, {
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      this.canvasEl.prepend(surface);
    }
  }

  hidePaintSurface(surface: HTMLCanvasElement, restore: HTMLElement | null): void {
    surface.remove();
    if (restore) restore.style.visibility = '';
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

    const { canvas } = doc;
    // Fold line: bottom of the first screen when the page is taller than the screen.
    if (canvas.viewportHeight < canvas.height) {
      const z = state.zoom;
      for (let n = 1; n * canvas.viewportHeight < canvas.height; n++) {
        const y = CANVAS_MARGIN + n * canvas.viewportHeight * z;
        parts.push(
          h(
            'div',
            { class: n === 1 ? 'ov-fold' : 'ov-fold secondary', style: `left:${CANVAS_MARGIN}px;top:${y}px;width:${canvas.width * z}px` },
            h('span', {}, n === 1 ? `Bas de l’écran (${canvas.viewportHeight} px) — la suite défile` : `Écran ${n + 1}`),
          ),
        );
      }
    }
    // Badges: fixed elements (pin) and links.
    walk(doc.elements, (el) => {
      if (el.hidden) return;
      const isLink = LINKABLE_TYPES.has(el.type) && el.props.href.trim() !== '';
      if (!el.fixed && !isLink) return;
      const r = absoluteRect(doc, el.id);
      if (!r) return;
      const o = this.toOverlay(r);
      const badges = h('div', { class: 'ov-badges', style: `left:${o.x + o.width}px;top:${o.y}px` });
      if (el.fixed) badges.append(h('span', { class: 'ov-badge fixed', title: 'Fixe à l’écran', html: icon('pin', 11) }));
      if (isLink) badges.append(h('span', { class: 'ov-badge link', title: el.props.href, html: icon('link', 11) }));
      parts.push(badges);
    });
    // Page resize handles.
    if (state.tool === 'pointer') {
      const pr = this.toOverlay({ x: 0, y: 0, width: canvas.width, height: canvas.height });
      const handle = (kind: PageHandle, left: number, top: number, title: string): HTMLElement =>
        h('div', { class: `ov-page-handle p-${kind}`, 'data-page-handle': kind, title, style: `left:${left}px;top:${top}px` });
      parts.push(
        handle('s', pr.x + pr.width / 2, pr.y + pr.height, 'Glisser pour allonger la page'),
        handle('e', pr.x + pr.width, pr.y + pr.height / 2, 'Glisser pour élargir la page'),
        handle('se', pr.x + pr.width, pr.y + pr.height, 'Glisser pour redimensionner la page'),
      );
    }

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
