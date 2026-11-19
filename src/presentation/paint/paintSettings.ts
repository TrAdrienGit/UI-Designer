/**
 * Options of the drawing tools (colors, brush size...). Editor preferences, not
 * part of the document: kept in localStorage when available.
 */
export type ShapeMode = 'outline' | 'fill' | 'both';

export interface PaintOptions {
  /** Left click color. */
  primary: string;
  /** Right click color (also the fill color of "outline + fill" shapes). */
  secondary: string;
  /** Pencil, brush, eraser and shape outline width (px). */
  size: number;
  shapeMode: ShapeMode;
  /** Paint bucket tolerance, 0..100 %. */
  tolerance: number;
}

const STORAGE_KEY = 'ui-designer.paint';
const DEFAULTS: PaintOptions = { primary: '#1f2933', secondary: '#ffffff', size: 4, shapeMode: 'outline', tolerance: 10 };

export class PaintSettings {
  private value: PaintOptions;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.value = { ...DEFAULTS, ...load() };
  }

  get options(): Readonly<PaintOptions> {
    return this.value;
  }

  update(patch: Partial<PaintOptions>): void {
    const next = { ...this.value, ...patch };
    next.size = Math.max(1, Math.min(200, Math.round(next.size)));
    next.tolerance = Math.max(0, Math.min(100, Math.round(next.tolerance)));
    this.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Preferences are a convenience only.
    }
    for (const listener of this.listeners) listener();
  }

  swapColors(): void {
    this.update({ primary: this.value.secondary, secondary: this.value.primary });
  }

  subscribe(listener: () => void): void {
    this.listeners.add(listener);
  }
}

function load(): Partial<PaintOptions> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const out: Partial<PaintOptions> = {};
    if (typeof raw['primary'] === 'string') out.primary = raw['primary'];
    if (typeof raw['secondary'] === 'string') out.secondary = raw['secondary'];
    if (typeof raw['size'] === 'number') out.size = raw['size'];
    if (raw['shapeMode'] === 'outline' || raw['shapeMode'] === 'fill' || raw['shapeMode'] === 'both') out.shapeMode = raw['shapeMode'];
    if (typeof raw['tolerance'] === 'number') out.tolerance = raw['tolerance'];
    return out;
  } catch {
    return {};
  }
}
