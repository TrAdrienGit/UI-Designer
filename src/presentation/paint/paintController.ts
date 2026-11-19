/**
 * Freehand drawing on the design surface. A stroke paints into a temporary
 * <canvas> laid exactly over the target drawing element (so the stacking order
 * stays right), then the pixels are stored in the document as one PNG data URL
 * and one undo step.
 *
 * Target of a stroke: the selected drawing, else the top-most drawing under the
 * pointer, else the page sketch (a full-page drawing at the bottom of the page,
 * created on first use and enlarged when the page grew).
 */
import type { EditorStore, PaintToolId } from '../../application/editorStore';
import type { Logger } from '../../application/ports';
import type { Point, Rect } from '../../domain/geometry';
import { boundingRect, containsPoint } from '../../domain/geometry';
import { constrainAngle, floodFill, formatColor, linePoints, type Rgba } from '../../domain/raster';
import { absoluteRect, drawingAt, findElement, hitTest } from '../../domain/tree';
import type { UiElement } from '../../domain/model';
import type { CanvasView } from '../canvas/canvasView';
import type { PaintSettings } from './paintSettings';

interface Target {
  /** Existing drawing id, null to create the page sketch. */
  readonly id: string | null;
  /** Rect of the surface in canvas coordinates (may enlarge the existing drawing). */
  readonly rect: Rect;
  /** Current rect of the existing drawing (to redraw its pixels on the surface). */
  readonly previous: Rect | null;
}

interface Stroke {
  readonly tool: PaintToolId;
  readonly target: Target;
  readonly surface: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly hidden: HTMLElement | null;
  readonly color: string;
  readonly altColor: string;
  readonly start: Point;
  last: Point;
  /** Pixels before the stroke (shapes are redrawn from it on every move). */
  readonly base: ImageData | null;
  changed: boolean;
}

/** Last committed surface, reused when the freshly stored PNG is not decoded yet. */
interface LastSurface {
  readonly id: string;
  readonly src: string;
  readonly canvas: HTMLCanvasElement;
}

export class PaintController {
  private stroke: Stroke | null = null;
  private last: LastSurface | null = null;

  constructor(
    private readonly view: CanvasView,
    private readonly store: EditorStore,
    private readonly settings: PaintSettings,
    private readonly log: Logger,
  ) {}

  get busy(): boolean {
    return this.stroke !== null;
  }

  /**
   * Pointer down with a paint tool. Returns true when a stroke started (the
   * caller then forwards moves and the release).
   */
  begin(tool: PaintToolId, p: Point, secondary: boolean): boolean {
    const o = this.settings.options;
    const color = secondary ? o.secondary : o.primary;
    const altColor = secondary ? o.primary : o.secondary;
    if (tool === 'picker') {
      this.pick(p, secondary);
      return false;
    }
    const target = this.resolveTarget(p);
    const surface = document.createElement('canvas');
    surface.width = Math.max(1, Math.round(target.rect.width));
    surface.height = Math.max(1, Math.round(target.rect.height));
    const ctx = surface.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    let hidden: HTMLElement | null = null;
    if (target.id && target.previous) {
      const ok = this.drawExisting(ctx, target.id, target.rect, target.previous);
      if (!ok) return false;
      hidden = this.view.nodeOf(target.id) ?? null;
    }
    this.view.showPaintSurface(surface, target.rect, hidden);
    const local = this.toLocal(p, target.rect);
    const needsBase = tool === 'line' || tool === 'rectangle' || tool === 'ellipse';
    this.stroke = {
      tool,
      target,
      surface,
      ctx,
      hidden,
      color,
      altColor,
      start: local,
      last: local,
      base: needsBase ? ctx.getImageData(0, 0, surface.width, surface.height) : null,
      changed: false,
    };
    if (tool === 'fill') {
      this.fill(local);
      this.end();
      return false;
    }
    this.paintSegment(local, local, false);
    return true;
  }

  move(p: Point, shift: boolean): void {
    const s = this.stroke;
    if (!s) return;
    const local = this.toLocal(p, s.target.rect);
    this.paintSegment(s.last, local, shift);
    s.last = local;
  }

  /** Ends the stroke and stores the pixels. */
  end(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    this.view.hidePaintSurface(s.surface, s.hidden);
    if (!s.changed) return;
    const src = s.surface.toDataURL('image/png');
    const { id, rect, previous } = s.target;
    const resized = !previous || previous.x !== rect.x || previous.y !== rect.y || previous.width !== rect.width || previous.height !== rect.height;
    const stored = this.store.paintDrawing(id, src, resized ? rect : undefined);
    this.last = { id: stored, src, canvas: s.surface };
    this.log.debug(`Stroke stored: ${s.tool}`, { id: stored, bytes: src.length });
  }

  cancel(): boolean {
    const s = this.stroke;
    if (!s) return false;
    this.stroke = null;
    this.view.hidePaintSurface(s.surface, s.hidden);
    return true;
  }

  // ------------------------------------------------------------------ painting

  private paintSegment(from: Point, to: Point, shift: boolean): void {
    const s = this.stroke!;
    const ctx = s.ctx;
    const size = this.settings.options.size;
    switch (s.tool) {
      case 'pencil': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = s.color;
        const half = Math.floor(size / 2);
        for (const pt of linePoints(from, to)) ctx.fillRect(Math.floor(pt.x) - half, Math.floor(pt.y) - half, size, size);
        s.changed = true;
        break;
      }
      case 'brush':
      case 'eraser': {
        ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (from.x === to.x && from.y === to.y) {
          ctx.beginPath();
          ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        s.changed = true;
        break;
      }
      case 'line':
      case 'rectangle':
      case 'ellipse':
        this.drawShape(to, shift);
        break;
      default:
        break;
    }
  }

  private drawShape(current: Point, shift: boolean): void {
    const s = this.stroke!;
    const ctx = s.ctx;
    const o = this.settings.options;
    ctx.putImageData(s.base!, 0, 0);
    const start = s.start;
    if (start.x === current.x && start.y === current.y) {
      s.changed = false;
      return;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = o.size;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    if (s.tool === 'line') {
      const end = shift ? constrainAngle(start, current) : current;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      s.changed = true;
      return;
    }
    let end = current;
    if (shift) {
      const d = Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
      end = { x: start.x + Math.sign(current.x - start.x || 1) * d, y: start.y + Math.sign(current.y - start.y || 1) * d };
    }
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const hgt = Math.abs(end.y - start.y);
    const fillColor = o.shapeMode === 'both' ? s.altColor : s.color;
    const doFill = o.shapeMode !== 'outline';
    const doStroke = o.shapeMode !== 'fill';
    // The outline stays inside the dragged box.
    const inset = doStroke ? o.size / 2 : 0;
    ctx.beginPath();
    if (s.tool === 'rectangle') {
      ctx.rect(x + inset, y + inset, Math.max(0, w - inset * 2), Math.max(0, hgt - inset * 2));
    } else {
      ctx.ellipse(x + w / 2, y + hgt / 2, Math.max(0.5, w / 2 - inset), Math.max(0.5, hgt / 2 - inset), 0, 0, Math.PI * 2);
    }
    if (doFill) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (doStroke) ctx.stroke();
    s.changed = true;
  }

  private fill(local: Point): void {
    const s = this.stroke!;
    const { width, height } = s.surface;
    const x = Math.floor(local.x);
    const y = Math.floor(local.y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const image = s.ctx.getImageData(0, 0, width, height);
    const color = cssToRgba(s.color);
    const tolerance = Math.round((this.settings.options.tolerance / 100) * 255);
    const painted = floodFill({ width, height, data: image.data }, x, y, color, tolerance);
    if (painted > 0) {
      s.ctx.putImageData(image, 0, 0);
      s.changed = true;
    }
  }

  /** Pipette: color of the drawing under the pointer, else of the element / page background. */
  private pick(p: Point, secondary: boolean): void {
    const doc = this.store.document;
    let color: string | null = null;
    const drawing = drawingAt(doc, p);
    if (drawing) {
      const rect = absoluteRect(doc, drawing.id)!;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const img = this.view.nodeOf(drawing.id)?.querySelector('img');
      if (ctx && img && img.complete && img.naturalWidth > 0) {
        const sx = ((p.x - rect.x) / rect.width) * img.naturalWidth;
        const sy = ((p.y - rect.y) / rect.height) * img.naturalHeight;
        ctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        if (d[3]! > 0) color = formatColor([d[0]!, d[1]!, d[2]!, d[3]!]);
      }
    }
    if (!color) {
      const hit = hitTest(doc, p);
      if (hit && hit.style.background !== 'transparent') color = hit.style.background;
      else color = doc.canvas.background;
    }
    this.settings.update(secondary ? { secondary: color } : { primary: color });
  }

  // ------------------------------------------------------------------ targets

  private resolveTarget(p: Point): Target {
    const doc = this.store.document;
    const usable = (el: UiElement | undefined): el is UiElement => !!el && el.type === 'drawing' && !el.hidden && !el.locked;
    const sel = this.store.getState().selection;
    const selected = sel.length === 1 ? findElement(doc, sel[0]!) : undefined;
    const existing = usable(selected) ? selected : drawingAt(doc, p);
    if (existing) {
      const rect = absoluteRect(doc, existing.id)!;
      return { id: existing.id, rect, previous: rect };
    }
    const page: Rect = { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height };
    // A sketch made before the page grew: enlarge it instead of stacking a second one.
    const sketch = doc.elements.find((el) => usable(el) && el.x === 0 && el.y === 0);
    if (sketch && containsPoint(page, p)) {
      const rect = absoluteRect(doc, sketch.id)!;
      return { id: sketch.id, rect: boundingRect([rect, page])!, previous: rect };
    }
    return { id: null, rect: page, previous: null };
  }

  /** Copies the current pixels of a drawing onto the surface. False when they are not available yet. */
  private drawExisting(ctx: CanvasRenderingContext2D, id: string, rect: Rect, previous: Rect): boolean {
    const el = findElement(this.store.document, id);
    if (!el?.props.src) return true;
    const dx = previous.x - rect.x;
    const dy = previous.y - rect.y;
    ctx.imageSmoothingEnabled = false;
    if (this.last && this.last.id === id && this.last.src === el.props.src) {
      ctx.drawImage(this.last.canvas, dx, dy, previous.width, previous.height);
      return true;
    }
    const img = this.view.nodeOf(id)?.querySelector('img');
    if (!img || !img.complete || img.naturalWidth === 0) {
      this.log.warn('Drawing pixels not decoded yet, stroke ignored', { id });
      return false;
    }
    ctx.drawImage(img, dx, dy, previous.width, previous.height);
    return true;
  }

  private toLocal(p: Point, rect: Rect): Point {
    return { x: p.x - rect.x, y: p.y - rect.y };
  }
}

/** Any CSS color -> RGBA bytes (through a 1x1 canvas, so names and rgba() work). */
function cssToRgba(color: string): Rgba {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!, d[3]!];
}
