/** "Code" tab: the exact HTML file that would be exported, with light syntax colouring. */
import { escapeHtml } from '../../domain/html';
import { h } from '../dom';

export class CodeView {
  private readonly pre: HTMLElement;
  private readonly info: HTMLElement;
  private code = '';

  constructor(host: HTMLElement, actions: { copy: (code: string) => void; export: () => void }) {
    this.pre = h('pre', { class: 'code-block' });
    this.info = h('span', { class: 'muted' });
    host.append(
      h(
        'div',
        { class: 'view-bar' },
        h('strong', {}, 'Fichier exporté'),
        this.info,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onclick: () => actions.copy(this.code) }, 'Copier'),
        h('button', { class: 'btn primary', type: 'button', onclick: actions.export }, 'Exporter…'),
      ),
      h('div', { class: 'code-scroll' }, this.pre),
    );
  }

  show(code: string): void {
    if (code === this.code) return;
    this.code = code;
    const lines = code.split('\n').length;
    this.info.textContent = `${lines} lignes · ${(new Blob([code]).size / 1024).toFixed(1)} Ko`;
    this.pre.innerHTML = highlight(code);
  }
}

/** Minimal HTML/CSS colouring: comments, tags, attributes, strings. Input is raw code. */
export function highlight(code: string): string {
  const out: string[] = [];
  const re = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w-]*)|("[^"\n]*")|(\/\*[\s\S]*?\*\/)/g;
  let last = 0;
  for (const m of code.matchAll(re)) {
    out.push(escapeHtml(code.slice(last, m.index)));
    const [text] = m;
    const cls = m[1] || m[4] ? 'tok-comment' : m[2] ? 'tok-tag' : 'tok-string';
    out.push(`<span class="${cls}">${escapeHtml(text)}</span>`);
    last = m.index! + text.length;
  }
  out.push(escapeHtml(code.slice(last)));
  return out.join('');
}
