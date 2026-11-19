import { describe, expect, it, vi } from 'vitest';
import { EditorStore } from '../../src/application/editorStore';
import { findElement, parentIdOf } from '../../src/domain/tree';
import { sequentialIds, silentLogger } from '../helpers';

function store() {
  return new EditorStore(silentLogger, sequentialIds());
}

describe('EditorStore', () => {
  it('creates elements inside the container under the drawn rect', () => {
    const s = store();
    const box = s.addElement('container', { x: 100, y: 100, width: 300, height: 200 });
    const btn = s.addElement('button', { x: 150, y: 150, width: 100, height: 30 });
    expect(parentIdOf(s.document, btn)).toBe(box);
    // 150 - (100 + 1px border)
    expect(findElement(s.document, btn)).toMatchObject({ x: 49, y: 49, name: 'button-1' });
    expect(s.getState().selection).toEqual([btn]);
    expect(s.getState().dirty).toBe(true);
  });

  it('snaps new elements relative to their parent', () => {
    const s = store();
    s.addElement('container', { x: 100, y: 100, width: 300, height: 200 }, undefined, 10);
    const btn = s.addElement('button', { x: 150, y: 150, width: 100, height: 30 }, undefined, 10);
    expect(findElement(s.document, btn)).toMatchObject({ x: 50, y: 50 });
  });

  it('notifies listeners with change flags', () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.setTool('button');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ tool: 'button' }), expect.objectContaining({ document: false }));
    s.addElement('button', { x: 0, y: 0, width: 10, height: 10 });
    expect(listener).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ document: true, selection: true }));
  });

  it('undoes and redoes, restoring the selection', () => {
    const s = store();
    const id = s.addElement('text', { x: 0, y: 0, width: 50, height: 20 });
    s.nudgeSelection(5, 0);
    expect(findElement(s.document, id)!.x).toBe(5);
    s.undo();
    expect(findElement(s.document, id)!.x).toBe(0);
    s.undo();
    expect(findElement(s.document, id)).toBeUndefined();
    expect(s.getState().dirty).toBe(false);
    s.redo();
    expect(findElement(s.document, id)).toBeDefined();
    expect(s.getState().selection).toEqual([id]);
  });

  it('records a gesture as a single undo step', () => {
    const s = store();
    const id = s.addElement('text', { x: 0, y: 0, width: 50, height: 20 });
    s.beginGesture();
    s.updateGesture((base) => ({ ...base, name: 'step1' }));
    s.updateGesture((base) => ({ ...base, name: 'step2' }));
    s.endGesture('Déplacer');
    expect(s.document.name).toBe('step2');
    s.undo();
    expect(s.document.name).toBe('Sans titre');
    expect(findElement(s.document, id)).toBeDefined();
  });

  it('cancels a gesture', () => {
    const s = store();
    s.beginGesture();
    s.updateGesture((base) => ({ ...base, name: 'temp' }));
    s.cancelGesture();
    expect(s.document.name).toBe('Sans titre');
    expect(s.getState().canUndo).toBe(false);
  });

  it('merges consecutive text edits into one undo step', () => {
    const s = store();
    const id = s.addElement('text', { x: 0, y: 0, width: 50, height: 20 });
    s.updateProps([id], { text: 'a' });
    s.updateProps([id], { text: 'ab' });
    s.updateProps([id], { text: 'abc' });
    s.undo();
    expect(findElement(s.document, id)!.props.text).toBe('Texte');
  });

  it('copies, pastes with offset and fresh names, duplicates', () => {
    const s = store();
    const id = s.addElement('button', { x: 10, y: 10, width: 50, height: 20 });
    s.copySelection();
    s.clearSelection();
    s.paste();
    const pasted = s.getState().selection[0]!;
    expect(pasted).not.toBe(id);
    expect(findElement(s.document, pasted)).toMatchObject({ x: 20, y: 20, name: 'button-2' });
    s.duplicateSelection();
    const dup = s.getState().selection[0]!;
    expect(findElement(s.document, dup)).toMatchObject({ x: 30, y: 30, name: 'button-3' });
  });

  it('pastes into a selected container', () => {
    const s = store();
    const btn = s.addElement('button', { x: 500, y: 500, width: 50, height: 20 });
    s.copySelection();
    const box = s.addElement('container', { x: 0, y: 0, width: 200, height: 200 });
    s.select([box]);
    s.paste();
    const pasted = s.getState().selection[0]!;
    expect(parentIdOf(s.document, pasted)).toBe(box);
    expect(findElement(s.document, pasted)).toMatchObject({ x: 0, y: 0 });
    expect(findElement(s.document, btn)).toBeDefined();
  });

  it('deletes the selection and groups / ungroups', () => {
    const s = store();
    const a = s.addElement('button', { x: 0, y: 0, width: 50, height: 20 });
    const b = s.addElement('button', { x: 100, y: 0, width: 50, height: 20 });
    s.select([a, b]);
    s.groupSelection();
    const group = s.getState().selection[0]!;
    expect(findElement(s.document, group)?.children).toHaveLength(2);
    s.ungroupSelection();
    expect(s.getState().selection).toEqual([a, b]);
    s.deleteSelection();
    expect(s.document.elements).toHaveLength(0);
  });

  it('clamps canvas, grid and zoom values', () => {
    const s = store();
    s.updateCanvas({ width: 2 });
    s.updateGrid({ size: 0 });
    s.setZoom(50);
    expect(s.document.canvas.width).toBe(16);
    expect(s.document.grid.size).toBe(1);
    expect(s.getState().zoom).toBe(8);
    s.setZoom(1);
    s.zoomStep(1);
    expect(s.getState().zoom).toBe(1.25);
    s.zoomStep(-1);
    s.zoomStep(-1);
    expect(s.getState().zoom).toBe(0.75);
  });

  it('tracks the saved state', () => {
    const s = store();
    s.addElement('button', { x: 0, y: 0, width: 50, height: 20 });
    s.markSaved('C:/p.uidesign');
    expect(s.getState()).toMatchObject({ dirty: false, filePath: 'C:/p.uidesign' });
    s.renameDocument('HUD');
    expect(s.getState().dirty).toBe(true);
    s.undo();
    expect(s.getState().dirty).toBe(false);
  });

  it('loads a document and clears the history', () => {
    const s = store();
    s.addElement('button', { x: 0, y: 0, width: 50, height: 20 });
    s.loadDocument({ ...s.document, name: 'Loaded', elements: [] }, 'x.uidesign');
    expect(s.getState()).toMatchObject({ canUndo: false, dirty: false, filePath: 'x.uidesign', selection: [] });
  });
});

describe('EditorStore: page regions, drawings, page size', () => {
  it('applies preset overrides when creating an element', () => {
    const s = store();
    const id = s.addElement('container', { x: 0, y: 0, width: 1280, height: 80 }, null, 0, {
      namePrefix: 'header',
      style: { background: '#000000' },
      props: { boxTag: 'header' },
    });
    expect(findElement(s.document, id)).toMatchObject({ name: 'header-1', style: { background: '#000000' }, props: { boxTag: 'header' } });
  });

  it('creates the page sketch on top of the page in one undo step', () => {
    const s = store();
    s.addElement('container', { x: 10, y: 10, width: 100, height: 100 });
    const id = s.paintDrawing(null, 'data:image/png;base64,AA');
    expect(s.document.elements[1]!.id).toBe(id);
    expect(findElement(s.document, id)).toMatchObject({ type: 'drawing', name: 'sketch-1', x: 0, y: 0, width: 1280, height: 720 });
    s.undo();
    expect(findElement(s.document, id)).toBeUndefined();
    expect(s.document.elements).toHaveLength(1);
  });

  it('stores strokes as separate undo steps and can grow the drawing', () => {
    const s = store();
    const id = s.paintDrawing(null, 'data:1');
    s.paintDrawing(id, 'data:2');
    s.paintDrawing(id, 'data:3', { x: 0, y: 0, width: 1280, height: 1500 });
    expect(findElement(s.document, id)).toMatchObject({ height: 1500, props: { src: 'data:3' } });
    s.undo();
    expect(findElement(s.document, id)).toMatchObject({ height: 720, props: { src: 'data:2' } });
    s.undo();
    expect(findElement(s.document, id)!.props.src).toBe('data:1');
  });

  it('updates the fixed flag and the screen height', () => {
    const s = store();
    const id = s.addElement('container', { x: 0, y: 0, width: 100, height: 50 });
    s.updateElement(id, { fixed: true });
    expect(findElement(s.document, id)!.fixed).toBe(true);
    s.updateCanvas({ height: 2000, viewportHeight: 3 });
    expect(s.document.canvas).toMatchObject({ height: 2000, viewportHeight: 16 });
  });
});
