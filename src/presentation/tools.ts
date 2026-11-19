import type { ToolId } from '../application/editorStore';
import { getDefinition } from '../domain/catalog';
import type { ElementType } from '../domain/model';

export interface ToolDescriptor {
  readonly id: ToolId;
  readonly label: string;
  /** Single key shortcut (no modifier). */
  readonly key?: string;
  readonly group: 'navigation' | 'layout' | 'text' | 'form' | 'media';
}

const element = (type: ElementType, group: ToolDescriptor['group'], key?: string): ToolDescriptor => ({
  id: type,
  label: getDefinition(type).label,
  group,
  ...(key ? { key } : {}),
});

export const TOOLS: readonly ToolDescriptor[] = [
  { id: 'pointer', label: 'Sélection / déplacement', key: 'v', group: 'navigation' },
  { id: 'pan', label: 'Main (défiler)', key: 'h', group: 'navigation' },
  { id: 'zoom', label: 'Zoom (Alt : dézoomer)', key: 'z', group: 'navigation' },
  element('container', 'layout', 'r'),
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
  element('progress', 'media', 'p'),
  element('image', 'media', 'g'),
];

export function isElementTool(tool: ToolId): tool is ElementType {
  return tool !== 'pointer' && tool !== 'pan' && tool !== 'zoom';
}
