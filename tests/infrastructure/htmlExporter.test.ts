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
    const doc = { ...docWith(), canvas: { ...docWith().canvas, width: 480, height: 270, background: '#000', transparent: true } };
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

describe('HtmlExporter: scrolling pages, links, media', () => {
  it('exports fixed elements with page coordinates and keeps their children relative', () => {
    const child = el('button', 'menu', { x: 5, y: 5, width: 50, height: 20 }, [], { fixed: true });
    const header = el('container', 'header', { x: 10, y: 20, width: 500, height: 80 }, [child], { fixed: true });
    const panel = el('container', 'panel', { x: 100, y: 300, width: 300, height: 300 }, [
      el('text', 'note', { x: 7, y: 8, width: 50, height: 20 }, [], { fixed: true }),
    ]);
    const doc = { ...docWith(header, panel), canvas: { ...docWith().canvas, height: 2000 } };
    const out = new HtmlExporter().exportHtml(doc);
    expect(out).toMatch(/#header \{ position: fixed; left: 10px; top: 20px; .*z-index: 100;/);
    expect(out).toMatch(/#menu \{ position: absolute; left: 5px; top: 5px;/);
    // panel has a 1px border: 100 + 1 + 7, 300 + 1 + 8
    expect(out).toMatch(/#note \{ position: fixed; left: 108px; top: 309px;/);
    expect(out).toContain('html { scroll-behavior: smooth; }');
    expect(out).toContain('Screen   : 1280 x 720 px (the page is taller than the screen: it scrolls vertically)');
    expect(out).toContain('[fixed]');
  });

  it('describes links and semantic tags and leaves guide drawings out', () => {
    const header = el('container', 'top', { x: 0, y: 0, width: 100, height: 50 });
    const link = el('button', 'go', { x: 0, y: 0, width: 50, height: 20 });
    const guide = el('drawing', 'trace', { x: 0, y: 0, width: 100, height: 100 });
    const sketch = el('drawing', 'sketch', { x: 0, y: 0, width: 100, height: 100 });
    const doc = docWith(
      { ...header, props: { ...header.props, boxTag: 'header' } },
      { ...link, props: { ...link.props, href: '#top', newTab: true } },
      { ...guide, props: { ...guide.props, src: 'data:image/png;base64,AA', guide: true } },
      { ...sketch, props: { ...sketch.props, src: 'data:image/png;base64,BB' } },
    );
    const out = new HtmlExporter().exportHtml(doc);
    expect(out).toContain('<header id="top" class="uid-container">');
    expect(out).toContain('#go  button  0,0  50x20  "Bouton"  -> #top (new tab)');
    expect(out).toContain('#trace  drawing  0,0  100x100  hand-drawn sketch (PNG)  [guide, not exported]');
    expect(out).not.toContain('id="trace"');
    expect(out).toContain('<div id="sketch" class="uid-drawing"><img src="data:image/png;base64,BB"');
    expect(out).toContain('Drawings : "drawing" elements are hand-drawn PNG layers');
  });

  it('exports videos and canvas background images', () => {
    const video = el('video', 'clip', { x: 0, y: 0, width: 320, height: 180 });
    const doc = {
      ...docWith({ ...video, props: { ...video.props, src: 'intro.webm', autoplay: true, muted: true } }),
      canvas: { ...docWith().canvas, backgroundImage: 'data:image/png;base64,CC', backgroundFit: 'cover' as const },
    };
    const out = new HtmlExporter().exportHtml(doc);
    expect(out).toContain('<video id="clip" src="intro.webm" controls autoplay muted playsinline class="uid-video"></video>');
    expect(out).toContain('video intro.webm (autoplay muted controls)');
    expect(out).toContain('background-image: url("data:image/png;base64,CC");');
  });
});
