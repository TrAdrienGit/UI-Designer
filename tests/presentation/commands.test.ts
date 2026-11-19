import { describe, expect, it } from 'vitest';
import { comboOf } from '../../src/presentation/commands';
import { highlight } from '../../src/presentation/views/codeView';

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: '', code: '', ...init } as KeyboardEvent;
}

describe('keyboard combos', () => {
  it('normalizes modifiers and keys', () => {
    expect(comboOf(key({ ctrlKey: true, key: 's', code: 'KeyS' }))).toBe('Ctrl+S');
    expect(comboOf(key({ ctrlKey: true, shiftKey: true, key: 'Z', code: 'KeyZ' }))).toBe('Ctrl+Shift+Z');
    expect(comboOf(key({ key: 'Delete', code: 'Delete' }))).toBe('Delete');
  });

  it('is independent of the keyboard layout for symbol keys', () => {
    // On an AZERTY keyboard Ctrl + the "=" key reports key "=" or "+"; the code is what matters.
    expect(comboOf(key({ ctrlKey: true, key: '+', code: 'Equal' }))).toBe('Ctrl+=');
    expect(comboOf(key({ ctrlKey: true, key: ')', code: 'Minus' }))).toBe('Ctrl+-');
    expect(comboOf(key({ ctrlKey: true, key: 'à', code: 'Digit0' }))).toBe('Ctrl+0');
  });
});

describe('code highlighting', () => {
  it('escapes code and wraps tokens', () => {
    const out = highlight('<p class="a">x &amp; y</p><!-- c -->');
    expect(out).toContain('<span class="tok-tag">&lt;p</span>');
    expect(out).toContain('<span class="tok-string">"a"</span>');
    expect(out).toContain('x &amp;amp; y');
    expect(out).toContain('<span class="tok-comment">&lt;!-- c --&gt;</span>');
  });
});
