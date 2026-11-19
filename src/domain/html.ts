/**
 * Mapping from model elements to HTML. Shared by the editor canvas (which builds
 * live DOM nodes) and the exporter (which writes a standalone file), so what the
 * user sees while designing is exactly what gets exported.
 */
import type { ElementStyle, UiElement } from './model';

export interface HtmlSpec {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string | true>>;
  /** CSS declarations as [property, value] pairs (no selector). */
  readonly css: readonly (readonly [string, string])[];
  /** Raw CSS appended after the declarations (the element's "extra CSS"). */
  readonly extraCss: string;
  /** Inner HTML for leaf elements (already escaped). Containers get their children appended instead. */
  readonly inner: string;
  readonly selfClosing: boolean;
}

/** Stylesheet shared by every export and by the editor canvas. Scoped under `.uid-root`. */
export const BASE_CSS = `.uid-root { position: relative; overflow: hidden; }
.uid-root *, .uid-root *::before, .uid-root *::after { box-sizing: border-box; }
.uid-root [hidden] { display: none !important; }
.uid-root p, .uid-root h1, .uid-root h2, .uid-root h3, .uid-root h4, .uid-root ul, .uid-root ol { margin: 0; }
.uid-root .uid-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.uid-root .uid-check input { margin: 0; }
.uid-root .uid-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.uid-root .uid-toggle-track { position: relative; flex: none; width: 36px; height: 20px; border-radius: 10px; background: #9aa5b1; transition: background .15s; }
.uid-root .uid-toggle-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.uid-root .uid-toggle input:checked + .uid-toggle-track { background: var(--uid-accent, #3b82f6); }
.uid-root .uid-toggle input:checked + .uid-toggle-track::after { transform: translateX(16px); }
.uid-root .uid-progress-fill { height: 100%; border-radius: inherit; }
.uid-root .uid-placeholder { display: flex; align-items: center; justify-content: center; border: 1px dashed #9aa5b1; color: #7b8794; font-size: 12px; }
`;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

const FLEX_ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;
const TEXT_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

function visualCss(style: ElementStyle, options: { font: boolean; box: boolean }): [string, string][] {
  const css: [string, string][] = [];
  if (options.box && style.background && style.background !== 'transparent') css.push(['background', style.background]);
  if (options.box && style.borderWidth > 0 && style.borderStyle !== 'none') {
    css.push(['border', `${style.borderWidth}px ${style.borderStyle} ${style.borderColor}`]);
  } else if (options.box) {
    css.push(['border', 'none']);
  }
  if (options.box && style.borderRadius > 0) css.push(['border-radius', `${style.borderRadius}px`]);
  if (options.font) {
    css.push(['color', style.color]);
    css.push(['font-family', style.fontFamily]);
    css.push(['font-size', `${style.fontSize}px`]);
    if (style.fontWeight !== 400) css.push(['font-weight', String(style.fontWeight)]);
    if (style.italic) css.push(['font-style', 'italic']);
  }
  if (options.box && style.padding > 0) css.push(['padding', `${style.padding}px`]);
  if (style.opacity < 1) css.push(['opacity', String(style.opacity)]);
  if (options.box && style.shadow.trim()) css.push(['box-shadow', style.shadow.trim()]);
  return css;
}

function textContent(el: UiElement): string {
  return escapeHtml(el.props.text).replace(/\n/g, '<br>');
}

/**
 * Builds the HTML description of one element.
 * @param htmlId the exported id attribute (a unique slug of the element name)
 */
export function elementSpec(el: UiElement, htmlId: string): HtmlSpec {
  const s = el.style;
  const p = el.props;
  const css: [string, string][] = [
    ['position', 'absolute'],
    ['left', `${el.x}px`],
    ['top', `${el.y}px`],
    ['width', `${el.width}px`],
    ['height', `${el.height}px`],
  ];
  const attrs: Record<string, string | true> = { id: htmlId };
  const classes = ['uid-' + el.type, ...el.cssClass.split(/\s+/).filter(Boolean)];
  if (el.hidden) attrs['hidden'] = true;
  let tag = 'div';
  let inner = '';
  let selfClosing = false;
  const flexText = (): void => {
    css.push(['display', 'flex']);
    css.push(['align-items', FLEX_ALIGN[s.verticalAlign]]);
    css.push(['justify-content', TEXT_JUSTIFY[s.textAlign]]);
    css.push(['text-align', s.textAlign]);
  };

  switch (el.type) {
    case 'container':
      css.push(...visualCss(s, { font: true, box: true }));
      break;
    case 'text':
      tag = p.tag;
      flexText();
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['white-space', 'pre-wrap']);
      inner = textContent(el);
      break;
    case 'button':
      tag = 'button';
      attrs['type'] = 'button';
      flexText();
      css.push(...visualCss(s, { font: true, box: true }));
      inner = textContent(el);
      break;
    case 'input':
      tag = 'input';
      selfClosing = true;
      attrs['type'] = p.inputType;
      if (p.placeholder) attrs['placeholder'] = p.placeholder;
      if (p.text) attrs['value'] = p.text;
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['text-align', s.textAlign]);
      css.push(['outline-color', p.accent]);
      break;
    case 'textarea':
      tag = 'textarea';
      if (p.placeholder) attrs['placeholder'] = p.placeholder;
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['resize', 'none']);
      css.push(['outline-color', p.accent]);
      inner = escapeHtml(p.text);
      break;
    case 'checkbox':
    case 'radio': {
      tag = 'label';
      classes.push('uid-check');
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['accent-color', p.accent]);
      css.push(['justify-content', TEXT_JUSTIFY[s.textAlign]]);
      const nameAttr = el.type === 'radio' ? ` name="${escapeAttr(p.group)}"` : '';
      inner = `<input type="${el.type}"${nameAttr}${p.checked ? ' checked' : ''}><span>${textContent(el)}</span>`;
      break;
    }
    case 'toggle':
      tag = 'label';
      classes.push('uid-check', 'uid-toggle');
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['--uid-accent', p.accent]);
      css.push(['justify-content', TEXT_JUSTIFY[s.textAlign]]);
      inner = `<input type="checkbox"${p.checked ? ' checked' : ''}><span class="uid-toggle-track"></span><span>${textContent(el)}</span>`;
      break;
    case 'select':
      tag = 'select';
      css.push(...visualCss(s, { font: true, box: true }));
      inner = p.items.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
      break;
    case 'list':
      tag = p.ordered ? 'ol' : 'ul';
      css.push(...visualCss(s, { font: true, box: true }));
      css.push(['padding-left', `${s.padding + 20}px`]);
      css.push(['overflow', 'auto']);
      inner = p.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      break;
    case 'image':
      if (p.src) {
        tag = 'img';
        selfClosing = true;
        attrs['src'] = p.src;
        attrs['alt'] = p.alt;
        css.push(['object-fit', p.fit]);
        css.push(...visualCss(s, { font: false, box: true }));
      } else {
        classes.push('uid-placeholder');
        attrs['role'] = 'img';
        attrs['aria-label'] = p.alt || 'image';
        css.push(...visualCss(s, { font: false, box: true }).filter(([k]) => k !== 'border'));
        inner = 'Image';
      }
      break;
    case 'progress': {
      const range = p.max - p.min || 1;
      const percent = Math.max(0, Math.min(100, ((p.value - p.min) / range) * 100));
      attrs['role'] = 'progressbar';
      attrs['aria-valuemin'] = String(p.min);
      attrs['aria-valuemax'] = String(p.max);
      attrs['aria-valuenow'] = String(p.value);
      css.push(...visualCss(s, { font: false, box: true }));
      css.push(['overflow', 'hidden']);
      inner = `<div class="uid-progress-fill" style="width: ${round(percent)}%; background: ${escapeAttr(p.accent)};"></div>`;
      break;
    }
    case 'slider':
      tag = 'input';
      selfClosing = true;
      attrs['type'] = 'range';
      attrs['min'] = String(p.min);
      attrs['max'] = String(p.max);
      attrs['value'] = String(p.value);
      css.push(['margin', '0']);
      css.push(['accent-color', p.accent]);
      css.push(...visualCss(s, { font: false, box: true }));
      break;
    case 'divider':
      attrs['role'] = 'separator';
      css.push(...visualCss(s, { font: false, box: true }));
      break;
  }
  attrs['class'] = classes.join(' ');
  return { tag, attrs, css, extraCss: s.extraCss.trim(), inner, selfClosing };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "a: b; c: d;" form of a spec's declarations, extra CSS included. */
export function cssText(spec: HtmlSpec): string {
  const base = spec.css.map(([k, v]) => `${k}: ${v};`).join(' ');
  if (!spec.extraCss) return base;
  return `${base} ${spec.extraCss.endsWith(';') ? spec.extraCss : spec.extraCss + ';'}`;
}

/** Turns an element name into a valid, readable HTML id ("Bouton Jouer!" -> "bouton-jouer"). */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) return 'element';
  return /^[a-z_]/.test(slug) ? slug : 'el-' + slug;
}

/** Id of the canvas wrapper in exports and in the editor. */
export const ROOT_HTML_ID = 'uid-canvas';

/** Maps every element id to a unique HTML id derived from its name, in tree order. */
export function buildHtmlIds(elements: readonly UiElement[], reserved: Iterable<string> = [ROOT_HTML_ID]): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>(reserved);
  const visit = (list: readonly UiElement[]): void => {
    for (const el of list) {
      const base = slugify(el.name);
      let candidate = base;
      let n = 2;
      while (used.has(candidate)) candidate = `${base}-${n++}`;
      used.add(candidate);
      ids.set(el.id, candidate);
      visit(el.children);
    }
  };
  visit(elements);
  return ids;
}
