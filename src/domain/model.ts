/**
 * Core document model. A document is a tree of UI elements; every element is
 * positioned absolutely (x/y in px) relative to the inner box of its parent
 * (or of the canvas for top-level elements).
 *
 * The model is immutable: every change produces a new document object.
 */

export const DOCUMENT_FORMAT_VERSION = 2;

export type ElementType =
  | 'container'
  | 'text'
  | 'button'
  | 'input'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'toggle'
  | 'select'
  | 'list'
  | 'image'
  | 'video'
  | 'drawing'
  | 'progress'
  | 'slider'
  | 'divider';

export type TextTag = 'p' | 'span' | 'label' | 'h1' | 'h2' | 'h3' | 'h4';
export type TextAlign = 'left' | 'center' | 'right';
export type FlexAlign = 'start' | 'center' | 'end';
export type ImageFit = 'fill' | 'contain' | 'cover' | 'none';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
/** HTML tag of a box: a plain div or a semantic page region. */
export type BoxTag = 'div' | 'header' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'footer';
export const BOX_TAGS: readonly BoxTag[] = ['div', 'header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
/** How a background image fills its element. */
export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'tile' | 'none';
export const BACKGROUND_FITS: readonly BackgroundFit[] = ['cover', 'contain', 'stretch', 'tile', 'none'];

/** Visual properties shared by every element. Colors are CSS color strings. */
export interface ElementStyle {
  background: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: BorderStyle;
  borderRadius: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  textAlign: TextAlign;
  verticalAlign: FlexAlign;
  padding: number;
  opacity: number;
  shadow: string;
  /** Background image: data URL (embedded) or URL; empty for none. */
  backgroundImage: string;
  backgroundFit: BackgroundFit;
  /** CSS background-position keywords ("center", "top left"...). */
  backgroundPosition: string;
  /** Free CSS declarations appended as-is (e.g. "cursor: pointer; letter-spacing: 2px"). */
  extraCss: string;
}

/** Type-specific content. Only the fields relevant to an element's type are used. */
export interface ElementProps {
  text: string;
  tag: TextTag;
  placeholder: string;
  inputType: 'text' | 'password' | 'email' | 'number' | 'search';
  checked: boolean;
  /** Options of a select, entries of a list, label of a radio group... */
  items: string[];
  ordered: boolean;
  src: string;
  alt: string;
  fit: ImageFit;
  value: number;
  min: number;
  max: number;
  /** Fill color of progress bars and toggles. */
  accent: string;
  /** Radio group name. */
  group: string;
  /** Optional JavaScript run on click (exported as an event listener). */
  onClick: string;
  /** Link target (texts, buttons, images, boxes): URL, "#element-id", "mailto:"... Empty for none. */
  href: string;
  /** Open the link in a new tab. */
  newTab: boolean;
  /** HTML tag of a box (header, footer...). */
  boxTag: BoxTag;
  /** Video playback options. */
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
  /** Drawing used only as a tracing guide: shown in the editor, left out of the export. */
  guide: boolean;
}

export interface UiElement {
  readonly id: string;
  readonly type: ElementType;
  /** Human readable name; becomes the HTML id / CSS selector on export. */
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly hidden: boolean;
  readonly locked: boolean;
  /**
   * Fixed on screen: stays in place while the page scrolls (CSS position: fixed).
   * Ignored when an ancestor is already fixed (the element then moves with it).
   */
  readonly fixed: boolean;
  /** Extra CSS classes added on export (space separated). */
  readonly cssClass: string;
  readonly style: Readonly<ElementStyle>;
  readonly props: Readonly<ElementProps>;
  readonly children: readonly UiElement[];
}

export interface CanvasSettings {
  /** Page width. */
  readonly width: number;
  /** Page height: may exceed the screen height, the page then scrolls. */
  readonly height: number;
  /** Visible screen height (viewport) used by the preview and the fold line. */
  readonly viewportHeight: number;
  readonly background: string;
  readonly backgroundImage: string;
  readonly backgroundFit: BackgroundFit;
  /** Transparent canvases export without a body background (useful for HUD overlays). */
  readonly transparent: boolean;
}

export interface GridSettings {
  readonly size: number;
  readonly visible: boolean;
  readonly snap: boolean;
}

export interface UiDocument {
  readonly version: number;
  readonly name: string;
  readonly canvas: CanvasSettings;
  readonly grid: GridSettings;
  readonly elements: readonly UiElement[];
}

export const DEFAULT_STYLE: ElementStyle = {
  background: 'transparent',
  color: '#1f2933',
  borderColor: '#9aa5b1',
  borderWidth: 0,
  borderStyle: 'solid',
  borderRadius: 0,
  fontFamily: 'Segoe UI, Roboto, sans-serif',
  fontSize: 14,
  fontWeight: 400,
  italic: false,
  textAlign: 'left',
  verticalAlign: 'center',
  padding: 0,
  opacity: 1,
  shadow: '',
  backgroundImage: '',
  backgroundFit: 'cover',
  backgroundPosition: 'center',
  extraCss: '',
};

export const DEFAULT_PROPS: ElementProps = {
  text: '',
  tag: 'p',
  placeholder: '',
  inputType: 'text',
  checked: false,
  items: [],
  ordered: false,
  src: '',
  alt: '',
  fit: 'contain',
  value: 50,
  min: 0,
  max: 100,
  accent: '#3b82f6',
  group: 'group',
  onClick: '',
  href: '',
  newTab: false,
  boxTag: 'div',
  autoplay: false,
  loop: false,
  muted: false,
  controls: true,
  guide: false,
};

export function createEmptyDocument(name = 'Sans titre'): UiDocument {
  return {
    version: DOCUMENT_FORMAT_VERSION,
    name,
    canvas: {
      width: 1280,
      height: 720,
      viewportHeight: 720,
      background: '#ffffff',
      backgroundImage: '',
      backgroundFit: 'cover',
      transparent: false,
    },
    grid: { size: 10, visible: true, snap: true },
    elements: [],
  };
}
