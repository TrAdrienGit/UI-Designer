import { describe, expect, it } from 'vitest';
import { createEmptyDocument, DOCUMENT_FORMAT_VERSION } from '../../src/domain/model';
import { JsonProjectSerializer, ProjectFormatError } from '../../src/infrastructure/serialization/projectSerializer';
import { docWith, el } from '../helpers';

const serializer = new JsonProjectSerializer();

describe('JsonProjectSerializer', () => {
  it('round-trips a document', () => {
    const doc = docWith(
      el('container', 'box', { x: 1, y: 2, width: 300, height: 200 }, [el('button', 'btn', { x: 5, y: 6, width: 80, height: 30 })]),
      el('list', 'list', { x: 0, y: 0, width: 100, height: 100 }),
    );
    expect(serializer.parse(serializer.serialize(doc))).toEqual(doc);
  });

  it('rejects non-project files and newer formats', () => {
    expect(() => serializer.parse('nope')).toThrow(ProjectFormatError);
    expect(() => serializer.parse('{"a":1}')).toThrow(/pas un projet/);
    expect(() => serializer.parse(JSON.stringify({ format: 'ui-designer-project', version: DOCUMENT_FORMAT_VERSION + 1 }))).toThrow(/plus récente/);
  });

  it('fills missing fields with defaults and drops invalid data', () => {
    const doc = serializer.parse(
      JSON.stringify({
        format: 'ui-designer-project',
        version: 1,
        name: 'Partial',
        canvas: { width: 'big', height: 300 },
        elements: [
          { type: 'button', id: 'b', x: 10, style: { background: 'red', fontSize: 'huge' }, props: { items: ['ok', 3] } },
          { type: 'unknown-widget', id: 'x' },
          'garbage',
          { type: 'text', id: 'b' }, // duplicated id gets a new one
          { type: 'button', id: 'kids', children: [{ type: 'text', id: 'lost' }] }, // only containers keep children
        ],
      }),
    );
    expect(doc.name).toBe('Partial');
    expect(doc.canvas).toEqual({ ...createEmptyDocument().canvas, height: 300 });
    expect(doc.elements).toHaveLength(3);
    const button = doc.elements[0]!;
    expect(button).toMatchObject({ id: 'b', x: 10, y: 0, hidden: false });
    expect(button.style.background).toBe('red');
    expect(button.style.fontSize).toBe(14);
    expect(button.props.items).toEqual(['ok']);
    expect(button.props.text).toBe('Bouton');
    expect(doc.elements[1]!.id).not.toBe('b');
    expect(doc.elements[2]!.children).toEqual([]);
  });
});
