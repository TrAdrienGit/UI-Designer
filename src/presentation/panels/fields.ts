/**
 * Form controls used by the properties panel. Each field reads its value
 * through a getter (so it can be refreshed after undo, drag...) and writes
 * through a setter. A focused field is never overwritten while the user types.
 */
import { h } from '../dom';

export interface Field {
  readonly element: HTMLElement;
  refresh(): void;
  focus?(): void;
}

let fieldCounter = 0;
const nextId = (): string => `fld-${++fieldCounter}`;

export function row(label: string, field: Field | HTMLElement, forId?: string): HTMLElement {
  const control = field instanceof HTMLElement ? field : field.element;
  return h('div', { class: 'prop-row' }, h('label', { class: 'prop-label', for: forId ?? null }, label), control);
}

export function section(title: string, ...rows: (HTMLElement | null | false)[]): HTMLElement {
  return h('details', { class: 'prop-section', open: true }, h('summary', {}, title), h('div', { class: 'prop-body' }, ...rows));
}

export interface NumberOptions {
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function numberField(get: () => number, set: (v: number) => void, opts: NumberOptions = {}): Field {
  const input = h('input', {
    type: 'number',
    id: nextId(),
    step: opts.step ?? 1,
    min: opts.min ?? null,
    max: opts.max ?? null,
    class: 'num',
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    if (input.value !== '' && Number.isFinite(v)) {
      const clamped = Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, v));
      set(clamped);
    }
  });
  input.addEventListener('blur', () => (input.value = String(round(get()))));
  // Up/down with Shift for steps of 10, like most design tools.
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey) {
      e.preventDefault();
      const next = round(get()) + (e.key === 'ArrowUp' ? 10 : -10) * (opts.step ?? 1);
      set(Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, next)));
      input.value = String(round(get()));
    }
  });
  const wrap = h('div', { class: 'num-wrap' }, input, opts.suffix ? h('span', { class: 'suffix' }, opts.suffix) : null);
  return {
    element: wrap,
    refresh() {
      if (document.activeElement !== input) input.value = String(round(get()));
    },
    focus: () => input.focus(),
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

export function textField(
  get: () => string,
  set: (v: string) => void,
  opts: { multiline?: boolean; placeholder?: string; mono?: boolean; list?: readonly string[]; rows?: number } = {},
): Field {
  const id = nextId();
  const input = opts.multiline
    ? h('textarea', { id, rows: opts.rows ?? 3, placeholder: opts.placeholder ?? null, class: opts.mono ? 'mono' : null, spellcheck: 'false' })
    : h('input', { type: 'text', id, placeholder: opts.placeholder ?? null, class: opts.mono ? 'mono' : null, spellcheck: 'false' });
  let datalist: HTMLDataListElement | null = null;
  if (opts.list && input instanceof HTMLInputElement) {
    datalist = h('datalist', { id: `${id}-list` }, ...opts.list.map((v) => h('option', { value: v })));
    input.setAttribute('list', datalist.id);
  }
  input.addEventListener('input', () => set(input.value));
  input.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    if (ev.key === 'Escape') (input as HTMLElement).blur();
  });
  return {
    element: datalist ? h('div', { class: 'grow' }, input, datalist) : input,
    refresh() {
      if (document.activeElement !== input) input.value = get();
    },
    focus() {
      input.focus();
      input.select();
    },
  };
}

export function selectField<T extends string | number>(options: readonly (readonly [T, string])[], get: () => T, set: (v: T) => void): Field {
  const select = h('select', { id: nextId() }, ...options.map(([value, label]) => h('option', { value: String(value) }, label)));
  select.addEventListener('change', () => {
    const match = options.find(([v]) => String(v) === select.value);
    if (match) set(match[0]);
  });
  return {
    element: select,
    refresh() {
      select.value = String(get());
    },
  };
}

export function checkField(label: string, get: () => boolean, set: (v: boolean) => void): Field {
  const input = h('input', { type: 'checkbox' });
  input.addEventListener('change', () => set(input.checked));
  return {
    element: h('label', { class: 'check' }, input, h('span', {}, label)),
    refresh() {
      input.checked = get();
    },
  };
}

/** Converts any CSS color the input understands to #rrggbb for the native picker (fallback black). */
function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map((c) => c + c).join('');
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const v = ctx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
}

/** Color swatch (native picker) + free text (accepts rgba(), transparent, names...). */
export function colorField(get: () => string, set: (v: string) => void, opts: { allowTransparent?: boolean } = {}): Field {
  const picker = h('input', { type: 'color', class: 'swatch' });
  const text = h('input', { type: 'text', class: 'mono color-text', spellcheck: 'false' });
  picker.addEventListener('input', () => {
    text.value = picker.value;
    set(picker.value);
  });
  text.addEventListener('input', () => {
    if (text.value.trim()) set(text.value.trim());
  });
  const clear = opts.allowTransparent
    ? h('button', { class: 'mini', title: 'Transparent', type: 'button', onclick: () => set('transparent') }, '∅')
    : null;
  return {
    element: h('div', { class: 'color-field' }, picker, text, clear),
    refresh() {
      const value = get();
      if (document.activeElement !== text) text.value = value;
      picker.value = toHex(value);
      picker.classList.toggle('is-transparent', value === 'transparent');
    },
  };
}

export function buttonRow(...buttons: HTMLElement[]): HTMLElement {
  return h('div', { class: 'prop-buttons' }, ...buttons);
}
