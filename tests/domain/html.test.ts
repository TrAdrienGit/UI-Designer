import { describe, expect, it } from 'vitest';
import { allDefinitions } from '../../src/domain/catalog';
import { backgroundImageCss, buildHtmlIds, cssText, elementSpec, escapeAttr, escapeHtml, slugify } from '../../src/domain/html';
import { el } from '../helpers';

describe('html mapping', () => {
  it('escapes text and attributes', () => {
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;"');
    expect(escapeAttr('"x"')).toBe('&quot;x&quot;');
  });

  it('slugifies names into valid ids', () => {
    expect(slugify('Bouton Jouer !')).toBe('bouton-jouer');
    expect(slugify('Été 2026')).toBe('ete-2026');
    expect(slugify('42 vies')).toBe('el-42-vies');
    expect(slugify('***')).toBe('element');
  });

  it('builds unique ids and reserves the canvas id', () => {
    const ids = buildHtmlIds([
      el('button', 'a', { x: 0, y: 0, width: 10, height: 10 }, [], { name: 'Play' }),
      el('button', 'b', { x: 0, y: 0, width: 10, height: 10 }, [], { name: 'play' }),
      el('container', 'c', { x: 0, y: 0, width: 10, height: 10 }, [], { name: 'uid-canvas' }),
    ]);
    expect([...ids.values()]).toEqual(['play', 'play-2', 'uid-canvas-2']);
  });

  it('produces a spec for every element type', () => {
    for (const def of allDefinitions()) {
      const spec = elementSpec(el(def.type, 'x', { x: 1, y: 2, width: 60, height: 40 }), 'x');
      expect(spec.css.slice(0, 5)).toEqual([
        ['position', 'absolute'],
        ['left', '1px'],
        ['top', '2px'],
        ['width', '60px'],
        ['height', '40px'],
      ]);
      expect(spec.attrs['class']).toContain(`uid-${def.type}`);
      expect(spec.attrs['id']).toBe('x');
    }
  });

  it('escapes user content inside elements', () => {
    const button = el('button', 'b', { x: 0, y: 0, width: 10, height: 10 });
    const spec = elementSpec({ ...button, props: { ...button.props, text: '<script>x</script>\nnext' } }, 'b');
    expect(spec.inner).toBe('&lt;script&gt;x&lt;/script&gt;<br>next');
  });

  it('maps type specific content', () => {
    const list = el('list', 'l', { x: 0, y: 0, width: 10, height: 10 });
    expect(elementSpec({ ...list, props: { ...list.props, ordered: true } }, 'l').tag).toBe('ol');
    const progress = el('progress', 'p', { x: 0, y: 0, width: 10, height: 10 });
    const spec = elementSpec({ ...progress, props: { ...progress.props, value: 25, min: 0, max: 50 } }, 'p');
    expect(spec.inner).toContain('width: 50%');
    expect(spec.attrs['aria-valuenow']).toBe('25');
    const image = el('image', 'i', { x: 0, y: 0, width: 10, height: 10 });
    expect(elementSpec(image, 'i').inner).toBe('Image');
    expect(elementSpec({ ...image, props: { ...image.props, src: 'data:image/png;base64,AA' } }, 'i').tag).toBe('img');
  });

  it('marks hidden elements and appends extra css', () => {
    const box = el('container', 'b', { x: 0, y: 0, width: 10, height: 10 }, [], { hidden: true });
    const spec = elementSpec({ ...box, style: { ...box.style, extraCss: 'cursor: move' } }, 'b');
    expect(spec.attrs['hidden']).toBe(true);
    expect(cssText(spec).endsWith('cursor: move;')).toBe(true);
  });
});

describe('html mapping: links, media, page regions', () => {
  const r = { x: 10, y: 20, width: 100, height: 40 };

  it('turns linked texts, buttons, images and boxes into anchors', () => {
    const text = elementSpec(el('text', 't', r, [], {}), 't');
    expect(text.inner).not.toContain('<a');
    const linkedText = el('text', 't', r);
    const spec = elementSpec({ ...linkedText, props: { ...linkedText.props, href: '#footer', newTab: false } }, 't');
    expect(spec.tag).toBe('p');
    expect(spec.inner).toBe('<a class="uid-link" href="#footer">Texte</a>');

    const button = el('button', 'b', r);
    const b = elementSpec({ ...button, props: { ...button.props, href: 'https://exemple.fr', newTab: true } }, 'b');
    expect(b.tag).toBe('a');
    expect(b.attrs).toMatchObject({ href: 'https://exemple.fr', target: '_blank', rel: 'noopener', role: 'button' });
    expect(b.attrs['type']).toBeUndefined();

    const image = el('image', 'i', r);
    const i = elementSpec({ ...image, props: { ...image.props, src: 'data:image/png;base64,AA', href: 'x.html' } }, 'i');
    expect(i.tag).toBe('a');
    expect(i.inner).toContain('<img class="uid-media" src="data:image/png;base64,AA"');

    const box = el('container', 'c', r);
    expect(elementSpec({ ...box, props: { ...box.props, boxTag: 'header' } }, 'c').tag).toBe('header');
    expect(elementSpec({ ...box, props: { ...box.props, boxTag: 'footer', href: '/' } }, 'c').tag).toBe('a');
  });

  it('ignores links on form controls', () => {
    const input = el('input', 'x', r);
    const spec = elementSpec({ ...input, props: { ...input.props, href: 'https://exemple.fr' } }, 'x');
    expect(spec.tag).toBe('input');
    expect(spec.attrs['href']).toBeUndefined();
  });

  it('renders videos and drawings', () => {
    const video = el('video', 'v', r);
    expect(elementSpec(video, 'v').inner).toBe('Vidéo');
    const v = elementSpec({ ...video, props: { ...video.props, src: 'clip.mp4', autoplay: true, loop: true, muted: true } }, 'v');
    expect(v.tag).toBe('video');
    expect(v.attrs).toMatchObject({ src: 'clip.mp4', autoplay: true, loop: true, muted: true, controls: true, playsinline: true });

    const drawing = el('drawing', 'd', r);
    expect(elementSpec(drawing, 'd').inner).toBe('');
    expect(elementSpec({ ...drawing, props: { ...drawing.props, src: 'data:image/png;base64,AA' } }, 'd').inner).toContain('<img src="data:image/png;base64,AA"');
  });

  it('positions fixed elements against the viewport', () => {
    const spec = elementSpec(el('container', 'f', r), 'f', { fixedAt: { x: 110, y: 220 } });
    expect(spec.css).toContainEqual(['position', 'fixed']);
    expect(spec.css).toContainEqual(['left', '110px']);
    expect(spec.css).toContainEqual(['top', '220px']);
    expect(spec.css).toContainEqual(['z-index', '100']);
  });

  it('adds background images', () => {
    const box = el('container', 'c', r);
    const spec = elementSpec({ ...box, style: { ...box.style, backgroundImage: 'bg.png', backgroundFit: 'tile', backgroundPosition: 'top' } }, 'c');
    expect(spec.css).toContainEqual(['background-image', 'url("bg.png")']);
    expect(spec.css).toContainEqual(['background-repeat', 'repeat']);
    expect(spec.css).toContainEqual(['background-position', 'top']);
    expect(backgroundImageCss('a"b.png', 'stretch')).toContainEqual(['background-image', 'url("a\\"b.png")']);
    expect(backgroundImageCss('', 'cover')).toEqual([]);
  });
});
