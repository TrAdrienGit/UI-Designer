/**
 * Standalone HTML export: one file with inline CSS and JS, no external
 * resources (images are embedded as data URLs). A comment block at the top
 * describes the layout and the element tree so an AI assistant (or a human)
 * can understand and reuse the design without opening the tool.
 */
import type { DocumentExporter } from '../../application/ports';
import {
  BASE_CSS,
  buildHtmlIds,
  cssText,
  elementSpec,
  escapeAttr,
  escapeHtml,
  ROOT_HTML_ID,
  type HtmlSpec,
} from '../../domain/html';
import type { UiDocument, UiElement } from '../../domain/model';
import { getDefinition } from '../../domain/catalog';
import { countElements } from '../../domain/tree';

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
    const markup = this.renderList(doc.elements, ids, css, scripts, 2);
    const background = doc.canvas.transparent ? 'transparent' : doc.canvas.background;
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
      'html, body { margin: 0; padding: 0; }',
      `body { background: ${background}; }`,
      `#${ROOT_HTML_ID} { width: ${doc.canvas.width}px; height: ${doc.canvas.height}px; background: ${background}; }`,
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
  ): string[] {
    const out: string[] = [];
    for (const el of elements) {
      const htmlId = ids.get(el.id)!;
      const spec = elementSpec(el, htmlId);
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
        out.push(open, ...this.renderList(el.children, ids, css, scripts, depth + 1), `${indent}</${spec.tag}>`);
      } else {
        out.push(`${open}${spec.inner}</${spec.tag}>`);
      }
    }
    return out;
  }

  private overview(doc: UiDocument, ids: Map<string, string>): string {
    const lines = [
      '<!--',
      '  UI DESIGNER EXPORT',
      `  Document : ${sanitizeComment(doc.name)}`,
      `  Canvas   : ${doc.canvas.width} x ${doc.canvas.height} px, background ${doc.canvas.transparent ? 'transparent (overlay / HUD)' : doc.canvas.background}`,
      `  Elements : ${countElements(doc)}`,
      '  Layout   : every element is position:absolute inside #' + ROOT_HTML_ID + '; left/top are px',
      '             relative to the inner box (inside the border) of the parent element.',
      '  Styles   : one CSS rule per element, selected by id (#id), in the <style> block below.',
      '             Classes uid-<type> mark the element type; uid-* helper classes are defined once.',
      '  Hidden   : elements with the `hidden` attribute are part of the design but not displayed.',
      '',
      '  Element tree  (#id  type  x,y  width x height  "content")',
    ];
    const visit = (list: readonly UiElement[], depth: number): void => {
      for (const el of list) {
        const content = describeContent(el);
        const flags = [el.hidden ? 'hidden' : '', el.props.onClick.trim() ? 'onclick' : ''].filter(Boolean).join(',');
        lines.push(
          `  ${'  '.repeat(depth)}#${ids.get(el.id)}  ${el.type}  ${el.x},${el.y}  ${el.width}x${el.height}` +
            (content ? `  ${content}` : '') +
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
    case 'progress':
    case 'slider':
      return `value ${p.value} in [${p.min}..${p.max}]`;
    default:
      return el.type === 'container' && el.children.length === 0 ? getDefinition(el.type).label.toLowerCase() : '';
  }
}
