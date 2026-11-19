import { describe, expect, it } from 'vitest';
import { allDefinitions } from '../../src/domain/catalog';
import { buildHtmlIds, cssText, elementSpec, escapeAttr, escapeHtml, slugify } from '../../src/domain/html';
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
