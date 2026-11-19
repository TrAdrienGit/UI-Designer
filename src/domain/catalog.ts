import {
  DEFAULT_PROPS,
  DEFAULT_STYLE,
  type BoxTag,
  type ElementProps,
  type ElementStyle,
  type ElementType,
} from './model';

/** Static description of an element type: defaults used when the user draws it. */
export interface ElementDefinition {
  readonly type: ElementType;
  /** Display label (French UI). */
  readonly label: string;
  /** Prefix used to name new elements ("button" -> "button-1"). */
  readonly namePrefix: string;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  /** Only containers accept nested elements. */
  readonly canHaveChildren: boolean;
  readonly style: Partial<ElementStyle>;
  readonly props: Partial<ElementProps>;
}

const definitions: readonly ElementDefinition[] = [
  {
    type: 'container',
    label: 'Boîte',
    namePrefix: 'box',
    defaultWidth: 240,
    defaultHeight: 160,
    minWidth: 4,
    minHeight: 4,
    canHaveChildren: true,
    style: { background: '#f5f7fa', borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 6 },
    props: {},
  },
  {
    type: 'text',
    label: 'Texte',
    namePrefix: 'text',
    defaultWidth: 160,
    defaultHeight: 28,
    minWidth: 8,
    minHeight: 8,
    canHaveChildren: false,
    style: { verticalAlign: 'start' },
    props: { text: 'Texte', tag: 'p' },
  },
  {
    type: 'button',
    label: 'Bouton',
    namePrefix: 'button',
    defaultWidth: 120,
    defaultHeight: 36,
    minWidth: 16,
    minHeight: 12,
    canHaveChildren: false,
    style: {
      background: '#3b82f6',
      color: '#ffffff',
      borderRadius: 6,
      fontWeight: 600,
      textAlign: 'center',
      extraCss: 'cursor: pointer;',
    },
    props: { text: 'Bouton' },
  },
  {
    type: 'input',
    label: 'Champ texte',
    namePrefix: 'input',
    defaultWidth: 200,
    defaultHeight: 32,
    minWidth: 16,
    minHeight: 12,
    canHaveChildren: false,
    style: { background: '#ffffff', borderWidth: 1, borderColor: '#9aa5b1', borderRadius: 4, padding: 6 },
    props: { placeholder: 'Saisir…' },
  },
  {
    type: 'textarea',
    label: 'Zone de texte',
    namePrefix: 'textarea',
    defaultWidth: 240,
    defaultHeight: 96,
    minWidth: 16,
    minHeight: 16,
    canHaveChildren: false,
    style: { background: '#ffffff', borderWidth: 1, borderColor: '#9aa5b1', borderRadius: 4, padding: 6 },
    props: { placeholder: 'Saisir…' },
  },
  {
    type: 'checkbox',
    label: 'Case à cocher',
    namePrefix: 'checkbox',
    defaultWidth: 160,
    defaultHeight: 24,
    minWidth: 16,
    minHeight: 12,
    canHaveChildren: false,
    style: {},
    props: { text: 'Option', checked: false },
  },
  {
    type: 'radio',
    label: 'Bouton radio',
    namePrefix: 'radio',
    defaultWidth: 160,
    defaultHeight: 24,
    minWidth: 16,
    minHeight: 12,
    canHaveChildren: false,
    style: {},
    props: { text: 'Choix', checked: false, group: 'choice' },
  },
  {
    type: 'toggle',
    label: 'Interrupteur',
    namePrefix: 'toggle',
    defaultWidth: 160,
    defaultHeight: 24,
    minWidth: 32,
    minHeight: 12,
    canHaveChildren: false,
    style: {},
    props: { text: 'Activer', checked: true },
  },
  {
    type: 'select',
    label: 'Liste déroulante',
    namePrefix: 'select',
    defaultWidth: 180,
    defaultHeight: 32,
    minWidth: 24,
    minHeight: 12,
    canHaveChildren: false,
    style: { background: '#ffffff', borderWidth: 1, borderColor: '#9aa5b1', borderRadius: 4, padding: 4 },
    props: { items: ['Option 1', 'Option 2', 'Option 3'] },
  },
  {
    type: 'list',
    label: 'Liste',
    namePrefix: 'list',
    defaultWidth: 200,
    defaultHeight: 96,
    minWidth: 16,
    minHeight: 16,
    canHaveChildren: false,
    style: { verticalAlign: 'start' },
    props: { items: ['Élément 1', 'Élément 2', 'Élément 3'], ordered: false },
  },
  {
    type: 'image',
    label: 'Image',
    namePrefix: 'image',
    defaultWidth: 128,
    defaultHeight: 128,
    minWidth: 4,
    minHeight: 4,
    canHaveChildren: false,
    style: {},
    props: { fit: 'contain', alt: '' },
  },
  {
    type: 'video',
    label: 'Vidéo',
    namePrefix: 'video',
    defaultWidth: 320,
    defaultHeight: 180,
    minWidth: 16,
    minHeight: 16,
    canHaveChildren: false,
    style: { background: '#000000' },
    props: { fit: 'contain', controls: true, muted: true },
  },
  {
    type: 'drawing',
    label: 'Calque de dessin',
    namePrefix: 'drawing',
    defaultWidth: 320,
    defaultHeight: 240,
    minWidth: 4,
    minHeight: 4,
    canHaveChildren: false,
    style: {},
    props: {},
  },
  {
    type: 'progress',
    label: 'Barre de progression',
    namePrefix: 'progress',
    defaultWidth: 200,
    defaultHeight: 16,
    minWidth: 8,
    minHeight: 2,
    canHaveChildren: false,
    style: { background: '#e4e7eb', borderRadius: 8 },
    props: { value: 60, min: 0, max: 100, accent: '#22c55e' },
  },
  {
    type: 'slider',
    label: 'Curseur',
    namePrefix: 'slider',
    defaultWidth: 200,
    defaultHeight: 24,
    minWidth: 24,
    minHeight: 8,
    canHaveChildren: false,
    style: {},
    props: { value: 50, min: 0, max: 100, accent: '#3b82f6' },
  },
  {
    type: 'divider',
    label: 'Séparateur',
    namePrefix: 'divider',
    defaultWidth: 200,
    defaultHeight: 2,
    minWidth: 2,
    minHeight: 1,
    canHaveChildren: false,
    style: { background: '#cbd2d9' },
    props: {},
  },
];

const byType = new Map(definitions.map((d) => [d.type, d]));

export function getDefinition(type: ElementType): ElementDefinition {
  const def = byType.get(type);
  if (!def) throw new Error(`Unknown element type: ${type}`);
  return def;
}

export function allDefinitions(): readonly ElementDefinition[] {
  return definitions;
}

export function isElementType(value: unknown): value is ElementType {
  return typeof value === 'string' && byType.has(value as ElementType);
}

export function defaultStyleFor(type: ElementType): ElementStyle {
  return { ...DEFAULT_STYLE, ...getDefinition(type).style };
}

export function defaultPropsFor(type: ElementType): ElementProps {
  const props = { ...DEFAULT_PROPS, ...getDefinition(type).props };
  return { ...props, items: [...props.items] };
}

/** Ready-made page regions: boxes with a semantic tag and a typical placement. */
export type BoxPresetId = 'header' | 'main' | 'section' | 'footer';

export interface BoxPreset {
  readonly id: BoxPresetId;
  readonly label: string;
  readonly namePrefix: string;
  readonly tag: BoxTag;
  /** Where a simple click places it: full width at the top, at the bottom, or at the click. */
  readonly placement: 'top' | 'bottom' | 'click';
  readonly defaultHeight: number;
  readonly style: Partial<ElementStyle>;
}

export const BOX_PRESETS: readonly BoxPreset[] = [
  {
    id: 'header',
    label: 'En-tête (header)',
    namePrefix: 'header',
    tag: 'header',
    placement: 'top',
    defaultHeight: 80,
    style: { background: '#1f2933', color: '#ffffff', borderWidth: 0, borderRadius: 0 },
  },
  {
    id: 'main',
    label: 'Contenu principal (main)',
    namePrefix: 'main',
    tag: 'main',
    placement: 'click',
    defaultHeight: 480,
    style: { background: 'transparent', borderWidth: 0, borderRadius: 0 },
  },
  {
    id: 'section',
    label: 'Section',
    namePrefix: 'section',
    tag: 'section',
    placement: 'click',
    defaultHeight: 320,
    style: { background: '#f5f7fa', borderWidth: 0, borderRadius: 0 },
  },
  {
    id: 'footer',
    label: 'Pied de page (footer)',
    namePrefix: 'footer',
    tag: 'footer',
    placement: 'bottom',
    defaultHeight: 120,
    style: { background: '#323f4b', color: '#e4e7eb', borderWidth: 0, borderRadius: 0 },
  },
];

export function getBoxPreset(id: string): BoxPreset | undefined {
  return BOX_PRESETS.find((p) => p.id === id);
}
