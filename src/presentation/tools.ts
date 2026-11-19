import { PAINT_TOOLS, type PaintToolId, type ToolId } from '../application/editorStore';
import { BOX_PRESETS, getBoxPreset, getDefinition, isElementType, type BoxPreset } from '../domain/catalog';
import type { ElementType } from '../domain/model';

export interface ToolDescriptor {
  readonly id: ToolId;
  readonly label: string;
  /** Keyboard shortcut: a single key ("r") or Shift + key ("shift+l"). */
  readonly key?: string;
  readonly group: 'navigation' | 'layout' | 'text' | 'form' | 'media' | 'paint';
}

const element = (type: ElementType, group: ToolDescriptor['group'], key?: string): ToolDescriptor => ({
  id: type,
  label: getDefinition(type).label,
  group,
  ...(key ? { key } : {}),
});

const preset = (p: BoxPreset): ToolDescriptor => ({ id: p.id, label: p.label, group: 'layout' });

export const TOOLS: readonly ToolDescriptor[] = [
  { id: 'pointer', label: 'Sélection / déplacement', key: 'v', group: 'navigation' },
  { id: 'pan', label: 'Main (défiler)', key: 'h', group: 'navigation' },
  { id: 'zoom', label: 'Zoom (Alt : dézoomer)', key: 'z', group: 'navigation' },
  element('container', 'layout', 'r'),
  ...BOX_PRESETS.map(preset),
  element('divider', 'layout'),
  element('text', 'text', 't'),
  element('list', 'text', 'l'),
  element('button', 'form', 'b'),
  element('input', 'form', 'i'),
  element('textarea', 'form', 'e'),
  element('checkbox', 'form', 'c'),
  element('radio', 'form', 'o'),
  element('toggle', 'form', 'k'),
  element('select', 'form', 'd'),
  element('slider', 'form', 's'),
  element('progress', 'form', 'p'),
  element('image', 'media', 'g'),
  element('video', 'media', 'm'),
  element('drawing', 'paint', 'y'),
  { id: 'pencil', label: 'Crayon (pixel)', key: 'n', group: 'paint' },
  { id: 'brush', label: 'Pinceau', key: 'u', group: 'paint' },
  { id: 'eraser', label: 'Gomme', key: 'w', group: 'paint' },
  { id: 'fill', label: 'Pot de peinture', key: 'f', group: 'paint' },
  { id: 'line', label: 'Ligne (Maj : 45°)', key: 'shift+l', group: 'paint' },
  { id: 'rectangle', label: 'Rectangle (Maj : carré)', key: 'shift+r', group: 'paint' },
  { id: 'ellipse', label: 'Ellipse (Maj : cercle)', key: 'shift+e', group: 'paint' },
  { id: 'picker', label: 'Pipette', key: 'shift+i', group: 'paint' },
];

/** Tools that create an element by drawing a rectangle (element types and box presets). */
export function isElementTool(tool: ToolId): boolean {
  return isElementType(tool) || isBoxPresetTool(tool);
}

export function isBoxPresetTool(tool: ToolId): boolean {
  return getBoxPreset(tool) !== undefined;
}

export function isPaintTool(tool: ToolId): tool is PaintToolId {
  return (PAINT_TOOLS as readonly string[]).includes(tool);
}

/** Human readable shortcut ("shift+l" -> "Maj+L"). */
export function keyLabel(key: string): string {
  return key
    .split('+')
    .map((part) => (part === 'shift' ? 'Maj' : part.toUpperCase()))
    .join('+');
}
