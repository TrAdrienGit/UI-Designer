/**
 * Drawing tool widgets: the primary / secondary color swatches of the toolbox
 * and the options bar shown above the design surface while a paint tool is active.
 */
import type { PaintToolId } from '../../application/editorStore';
import { h } from '../dom';
import { icon } from '../icons';
import type { PaintSettings, ShapeMode } from './paintSettings';

/** Two overlapping swatches (click to edit) and a swap button, like image editors. */
export function buildColorSwatches(settings: PaintSettings): HTMLElement {
  const picker = (which: 'primary' | 'secondary'): HTMLInputElement => {
    const input = h('input', { type: 'color', class: 'swatch-input', tabindex: '-1' });
    input.addEventListener('input', () => settings.update({ [which]: input.value }));
    return input;
  };
  const primaryInput = picker('primary');
  const secondaryInput = picker('secondary');
  const primary = h('button', { class: 'paint-swatch primary', type: 'button', title: 'Couleur principale (clic gauche)' });
  const secondary = h('button', { class: 'paint-swatch secondary', type: 'button', title: 'Couleur secondaire (clic droit)' });
  primary.addEventListener('click', () => primaryInput.click());
  secondary.addEventListener('click', () => secondaryInput.click());
  const swap = h('button', {
    class: 'paint-swap',
    type: 'button',
    title: 'Inverser les couleurs (X)',
    html: icon('swap', 12),
    onclick: () => settings.swapColors(),
  });
  const refresh = (): void => {
    const o = settings.options;
    primary.style.background = o.primary;
    secondary.style.background = o.secondary;
    primaryInput.value = toHex(o.primary);
    secondaryInput.value = toHex(o.secondary);
  };
  settings.subscribe(refresh);
  refresh();
  return h('div', { class: 'paint-colors' }, secondary, primary, swap, primaryInput, secondaryInput);
}

const HINTS: Record<PaintToolId, string> = {
  pencil: 'Trait net au pixel près.',
  brush: 'Trait lissé.',
  eraser: 'Efface le dessin (pas les éléments).',
  fill: 'Remplit la zone de même couleur du dessin.',
  line: 'Maj : angles de 45°.',
  rectangle: 'Maj : carré.',
  ellipse: 'Maj : cercle.',
  picker: 'Clic gauche : couleur principale, clic droit : secondaire.',
};

/** Options bar of the active paint tool (hidden for the other tools). */
export class PaintOptionsBar {
  readonly element: HTMLElement;
  private tool: PaintToolId | null = null;

  constructor(private readonly settings: PaintSettings) {
    this.element = h('div', { class: 'tool-options', hidden: true });
    settings.subscribe(() => this.sync());
  }

  show(tool: PaintToolId | null): void {
    if (tool === this.tool) return;
    this.tool = tool;
    this.element.hidden = tool === null;
    if (tool) this.build(tool);
  }

  private build(tool: PaintToolId): void {
    const s = this.settings;
    const parts: HTMLElement[] = [h('strong', {}, labelOf(tool))];
    if (tool !== 'fill' && tool !== 'picker') {
      const size = h('input', { type: 'number', class: 'num opt-size', min: 1, max: 200, step: 1 });
      size.addEventListener('input', () => {
        const v = Number(size.value);
        if (size.value !== '' && Number.isFinite(v)) s.update({ size: v });
      });
      parts.push(h('label', { class: 'opt' }, 'Taille', size, h('span', { class: 'muted' }, 'px')));
    }
    if (tool === 'rectangle' || tool === 'ellipse') {
      const mode = h(
        'select',
        { class: 'opt-mode' },
        h('option', { value: 'outline' }, 'Contour'),
        h('option', { value: 'fill' }, 'Plein'),
        h('option', { value: 'both' }, 'Contour + fond (2e couleur)'),
      );
      mode.addEventListener('change', () => s.update({ shapeMode: mode.value as ShapeMode }));
      parts.push(h('label', { class: 'opt' }, 'Forme', mode));
    }
    if (tool === 'fill') {
      const tol = h('input', { type: 'number', class: 'num opt-tolerance', min: 0, max: 100, step: 1 });
      tol.addEventListener('input', () => {
        const v = Number(tol.value);
        if (tol.value !== '' && Number.isFinite(v)) s.update({ tolerance: v });
      });
      parts.push(h('label', { class: 'opt' }, 'Tolérance', tol, h('span', { class: 'muted' }, '%')));
    }
    parts.push(h('span', { class: 'muted opt-hint' }, HINTS[tool]));
    parts.push(
      h(
        'span',
        { class: 'muted opt-hint', title: 'Sélectionnez un calque de dessin pour peindre dedans ; sinon le dessin va dans le croquis de la page, sous les éléments.' },
        '· Cible : calque sélectionné ou croquis de la page',
      ),
    );
    this.element.replaceChildren(...parts);
    this.sync();
  }

  private sync(): void {
    const o = this.settings.options;
    const set = (selector: string, value: string): void => {
      const input = this.element.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
      if (input && document.activeElement !== input) input.value = value;
    };
    set('.opt-size', String(o.size));
    set('.opt-mode', o.shapeMode);
    set('.opt-tolerance', String(o.tolerance));
  }
}

function labelOf(tool: PaintToolId): string {
  return {
    pencil: 'Crayon',
    brush: 'Pinceau',
    eraser: 'Gomme',
    fill: 'Pot de peinture',
    line: 'Ligne',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    picker: 'Pipette',
  }[tool];
}

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const v = ctx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
}
