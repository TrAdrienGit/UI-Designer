/**
 * Standalone HTML export: one file with inline CSS and JS, no external
 * resources (images are embedded as data URLs). A comment block at the top
 * describes the layout and the element tree so an AI assistant (or a human)
 * can understand and reuse the design without opening the tool.
 */
import type { DocumentExporter } from '../../application/ports';
import type { Point } from '../../domain/geometry';
import {
  backgroundImageCss,
  BASE_CSS,
  buildHtmlIds,
  cssText,
  elementSpec,
  escapeAttr,
  escapeHtml,
  LINKABLE_TYPES,
  ROOT_HTML_ID,
  type HtmlSpec,
} from '../../domain/html';
import type { UiDocument, UiElement } from '../../domain/model';
import { getDefinition } from '../../domain/catalog';
import { countElements, walk } from '../../domain/tree';

export interface ExportOptions {
  /** Version written in the generator meta tag. */
  appVersion?: string;
  /** Include the descriptive comment block (default true). */
  includeOverview?: boolean;
}

export class HtmlExporter implements DocumentExporter {
  constructor(private readonly options: ExportOptions = {}) {}

  exportHtml(doc: UiDocument): string {
    const ids = buildHtmlIds(doc.elements);
    const css: string[] = [];
    const scripts: string[] = [];
    const markup = this.renderList(doc.elements, ids, css, scripts, 2, { x: 0, y: 0 }, false);
    const background = doc.canvas.transparent ? 'transparent' : doc.canvas.background;
    const canvasImage = backgroundImageCss(doc.canvas.backgroundImage, doc.canvas.backgroundFit)
      .map(([k, v]) => ` ${k}: ${v};`)
      .join('');
    const version = this.options.appVersion ?? 'dev';

    const lines = [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<meta name="generator" content="UI Designer ${escapeAttr(version)}">`,
      `<title>${escapeHtml(doc.name)}</title>`,
    ];
    if (this.options.includeOverview ?? true) lines.push(this.overview(doc, ids));
    lines.push(
      '<style>',
      '/* ---- Page ---- */',
      'html { scroll-behavior: smooth; }',
      'html, body { margin: 0; padding: 0; }',
      `body { background: ${background}; }`,
      `#${ROOT_HTML_ID} { width: ${doc.canvas.width}px; height: ${doc.canvas.height}px; background: ${background};${canvasImage} }`,
      '/* ---- Shared component styles ---- */',
      BASE_CSS.trimEnd(),
      '/* ---- Elements (position: absolute, px relative to the parent inner box) ---- */',
      ...css,
      '</style>',
      '</head>',
      '<body>',
      `<div id="${ROOT_HTML_ID}" class="uid-root">`,
      ...markup,
      '</div>',
    );
    if (scripts.length) {
      lines.push('<script>', '/* ---- Interactions ---- */', ...scripts, '</script>');
    }
    lines.push('</body>', '</html>', '');
    return lines.join('\n');
  }

  private renderList(
    elements: readonly UiElement[],
    ids: Map<string, string>,
    css: string[],
    scripts: string[],
    depth: number,
    origin: Point,
    insideFixed: boolean,
  ): string[] {
    const out: string[] = [];
    for (const el of elements) {
      // Guide drawings only help while designing.
      if (el.type === 'drawing' && el.props.guide) continue;
      const htmlId = ids.get(el.id)!;
      const abs = { x: origin.x + el.x, y: origin.y + el.y };
      const fixedRoot = el.fixed && !insideFixed;
      const spec = elementSpec(el, htmlId, fixedRoot ? { fixedAt: abs } : {});
      css.push(`#${htmlId} { ${cssText(spec)} }`);
      if (el.props.onClick.trim()) {
        scripts.push(
          `document.getElementById(${JSON.stringify(htmlId)}).addEventListener('click', function (event) {`,
          ...el.props.onClick.trim().split('\n').map((l) => '  ' + l),
          '});',
        );
      }
      const indent = '  '.repeat(depth - 1);
      const open = `${indent}<${spec.tag}${renderAttrs(spec)}>`;
      if (spec.selfClosing) {
        out.push(open);
      } else if (el.children.length > 0) {
        const inner = { x: abs.x + el.style.borderWidth, y: abs.y + el.style.borderWidth };
        out.push(
          open,
          ...this.renderList(el.children, ids, css, scripts, depth + 1, inner, insideFixed || el.fixed),
          `${indent}</${spec.tag}>`,
        );
      } else {
        out.push(`${open}${spec.inner}</${spec.tag}>`);
      }
    }
    return out;
  }

  private overview(doc: UiDocument, ids: Map<string, string>): string {
    const { canvas } = doc;
    const scrolls = canvas.height > canvas.viewportHeight;
    let hasFixed = false;
    let hasDrawing = false;
    walk(doc.elements, (el) => {
      hasFixed ||= el.fixed;
      hasDrawing ||= el.type === 'drawing' && !!el.props.src;
    });
    const lines = [
      '<!--',
      '  UI DESIGNER EXPORT',
      `  Document : ${sanitizeComment(doc.name)}`,
      `  Canvas   : ${canvas.width} x ${canvas.height} px, background ${canvas.transparent ? 'transparent (overlay / HUD)' : canvas.background}` +
        (canvas.backgroundImage ? ' + background image' : ''),
      `  Screen   : ${canvas.width} x ${canvas.viewportHeight} px` +
        (scrolls ? ` (the page is taller than the screen: it scrolls vertically)` : ''),
      `  Elements : ${countElements(doc)}`,
      '  Layout   : every element is position:absolute inside #' + ROOT_HTML_ID + '; left/top are px',
      '             relative to the inner box (inside the border) of the parent element.',
    ];
    if (hasFixed) {
      lines.push(
        '  Fixed    : elements flagged [fixed] use position:fixed (left/top in page px, z-index 100):',
        '             they stay on screen while the page scrolls; their children move with them.',
      );
    }
    lines.push(
      '  Styles   : one CSS rule per element, selected by id (#id), in the <style> block below.',
      '             Classes uid-<type> mark the element type; uid-* helper classes are defined once.',
      '  Tags     : boxes use semantic tags when set (header, nav, main, section, article, aside, footer).',
      '  Links    : "-> url" marks a link; "#id" links scroll to that element.',
      '  Hidden   : elements with the `hidden` attribute are part of the design but not displayed.',
    );
    if (hasDrawing) {
      lines.push(
        '  Drawings : "drawing" elements are hand-drawn PNG layers (sketches / mockups). Treat them as',
        '             a picture of the intended design; [guide] drawings are left out of this file.',
      );
    }
    lines.push('', '  Element tree  (#id  type  x,y  width x height  "content")');
    const visit = (list: readonly UiElement[], depth: number): void => {
      for (const el of list) {
        const content = describeContent(el);
        const href = LINKABLE_TYPES.has(el.type) ? el.props.href.trim() : '';
        const flags = [
          el.hidden ? 'hidden' : '',
          el.fixed ? 'fixed' : '',
          el.props.onClick.trim() ? 'onclick' : '',
          el.type === 'drawing' && el.props.guide ? 'guide, not exported' : '',
        ]
          .filter(Boolean)
          .join(',');
        const tag = el.type === 'container' && el.props.boxTag !== 'div' ? `<${el.props.boxTag}>` : '';
        lines.push(
          `  ${'  '.repeat(depth)}#${ids.get(el.id)}  ${el.type}${tag ? ' ' + tag : ''}  ${el.x},${el.y}  ${el.width}x${el.height}` +
            (content ? `  ${content}` : '') +
            (href ? `  -> ${truncate(href, 60)}${el.props.newTab ? ' (new tab)' : ''}` : '') +
            (flags ? `  [${flags}]` : ''),
        );
        visit(el.children, depth + 1);
      }
    };
    visit(doc.elements, 0);
    if (doc.elements.length === 0) lines.push('  (empty)');
    lines.push('-->');
    return lines.join('\n');
  }
}

function renderAttrs(spec: HtmlSpec): string {
  return Object.entries(spec.attrs)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
    .join('');
}

function sanitizeComment(text: string): string {
  return text.replace(/--/g, '- -').replace(/\s+/g, ' ');
}

function truncate(text: string, max = 40): string {
  const clean = sanitizeComment(text);
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function describeContent(el: UiElement): string {
  const p = el.props;
  switch (el.type) {
    case 'text':
    case 'button':
    case 'checkbox':
    case 'radio':
    case 'toggle':
      return `"${truncate(p.text)}"` + (['checkbox', 'radio', 'toggle'].includes(el.type) && p.checked ? ' (checked)' : '');
    case 'input':
    case 'textarea':
      return p.placeholder ? `placeholder "${truncate(p.placeholder)}"` : '';
    case 'select':
    case 'list':
      return `items: ${truncate(p.items.join(' | '), 60)}`;
    case 'image':
      return p.src ? (p.alt ? `alt "${truncate(p.alt)}"` : 'image') : 'image placeholder';
    case 'video': {
      if (!p.src) return 'video placeholder';
      const opts = [p.autoplay && 'autoplay', p.loop && 'loop', p.muted && 'muted', p.controls && 'controls'].filter(Boolean).join(' ');
      const source = p.src.startsWith('data:') ? 'embedded video' : `video ${truncate(p.src, 50)}`;
      return opts ? `${source} (${opts})` : source;
    }
    case 'drawing':
      return p.src ? 'hand-drawn sketch (PNG)' : 'empty drawing';
    case 'progress':
    case 'slider':
      return `value ${p.value} in [${p.min}..${p.max}]`;
    default:
      return el.type === 'container' && el.children.length === 0 ? getDefinition(el.type).label.toLowerCase() : '';
  }
}
