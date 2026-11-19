import { describe, expect, it } from 'vitest';
import { History } from '../../src/application/history';

describe('History', () => {
  it('undoes and redoes', () => {
    const h = new History<number>();
    h.push('a', 0);
    h.push('b', 1);
    expect(h.undo(2)).toEqual({ label: 'b', state: 1 });
    expect(h.undo(1)).toEqual({ label: 'a', state: 0 });
    expect(h.undo(0)).toBeNull();
    expect(h.redo(0)).toEqual({ label: 'a', state: 1 });
    expect(h.canRedo).toBe(true);
  });

  it('clears the redo stack on a new change', () => {
    const h = new History<number>();
    h.push('a', 0);
    h.undo(1);
    h.push('b', 0);
    expect(h.canRedo).toBe(false);
  });

  it('merges pushes with the same key inside the window', () => {
    let now = 0;
    const h = new History<number>(10, 1000, () => now);
    h.push('type', 0, 'text');
    now = 500;
    h.push('type', 1, 'text');
    now = 2000;
    h.push('type', 2, 'text');
    expect(h.undo(3)?.state).toBe(2);
    expect(h.undo(2)?.state).toBe(0);
    expect(h.canUndo).toBe(false);
  });

  it('seal() prevents merging', () => {
    const h = new History<number>(10, 1000, () => 0);
    h.push('t', 0, 'k');
    h.seal();
    h.push('t', 1, 'k');
    expect(h.undo(2)?.state).toBe(1);
  });

  it('respects the limit', () => {
    const h = new History<number>(2);
    h.push('a', 0);
    h.push('b', 1);
    h.push('c', 2);
    expect(h.undo(3)?.state).toBe(2);
    expect(h.undo(2)?.state).toBe(1);
    expect(h.undo(1)).toBeNull();
  });
});
