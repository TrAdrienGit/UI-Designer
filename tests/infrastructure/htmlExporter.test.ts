import { describe, expect, it } from 'vitest';
import { HtmlExporter } from '../../src/infrastructure/export/htmlExporter';
import { docWith, el } from '../helpers';

function sampleDoc() {
  const btn = el('button', 'b1', { x: 10, y: 20, width: 100, height: 30 }, [], { name: 'Bouton Jouer' });
  const play = { ...btn, props: { ...btn.props, text: 'Jouer', onClick: "console.log('go');" } };
  const hidden = el('text', 't1', { x: 0, y: 0, width: 50, height: 20 }, [], { name: 'secret', hidden: true });
  const panel = el('container', 'p1', { x: 100, y: 100, width: 400, height: 300 }, [play, hidden], { name: 'Panneau' });
  return { ...docWith(panel), name: 'Menu <principal>' };
}

describe('HtmlExporter', () => {
  const html = new HtmlExporter({ appVersion: '1.2.3' }).exportHtml(sampleDoc());

  it('writes a complete standalone document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta name="generator" content="UI Designer 1.2.3">');
    expect(html).toContain('<title>Menu &lt;principal&gt;</title>');
    expect(html).not.toMatch(/<link|src="http/);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('describes the element tree for AI assistants', () => {
    expect(html).toContain('UI DESIGNER EXPORT');
    expect(html).toContain('#panneau  container  100,100  400x300');
    expect(html).toContain('  #bouton-jouer  button  10,20  100x30  "Jouer"  [onclick]');
    expect(html).toContain('#secret  text  0,0  50x20  "Texte"  [hidden]');
  });

  it('nests markup and styles by id', () => {
    expect(html).toMatch(/<div id="panneau" class="uid-container">\n {4}<button id="bouton-jouer" type="button" class="uid-button">Jouer<\/button>/);
    expect(html).toContain('#bouton-jouer { position: absolute; left: 10px; top: 20px; width: 100px; height: 30px;');
    expect(html).toContain('<p id="secret" hidden class="uid-text">');
  });

  it('exports click scripts only when needed', () => {
    expect(html).toContain(`document.getElementById("bouton-jouer").addEventListener('click', function (event) {\n  console.log('go');\n});`);
    const plain = new HtmlExporter().exportHtml(docWith(el('button', 'b', { x: 0, y: 0, width: 10, height: 10 })));
    expect(plain).not.toContain('<script>');
  });

  it('supports transparent canvases (HUD) and can omit the overview', () => {
    const doc = { ...docWith(), canvas: { width: 480, height: 270, background: '#000', transparent: true } };
    const out = new HtmlExporter({ includeOverview: false }).exportHtml(doc);
    expect(out).toContain('body { background: transparent; }');
    expect(out).toContain('#uid-canvas { width: 480px; height: 270px; background: transparent; }');
    expect(out).not.toContain('UI DESIGNER EXPORT');
  });

  it('cannot be broken out of the overview comment', () => {
    const doc = { ...docWith(), name: 'evil --> <script>' };
    const out = new HtmlExporter().exportHtml(doc);
    const comment = out.slice(out.indexOf('<!--'), out.indexOf('-->') + 3);
    expect(comment).toContain('evil - -> <script>');
  });
});
