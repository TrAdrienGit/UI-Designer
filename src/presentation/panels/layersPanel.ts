/**
 * Layers panel: the element tree, top-most element first (like image editors).
 * Click to select, Ctrl/Shift+click to add, double-click to rename, eye / lock
 * toggles, drag & drop to reorder or move into another box.
 */
import type { EditorState, EditorStore } from '../../application/editorStore';
import { getDefinition } from '../../domain/catalog';
import type { UiElement } from '../../domain/model';
import { canHaveChildren, findElement, isDescendantOf, parentIdOf, siblingsOf } from '../../domain/tree';
import { h } from '../dom';
import { icon, typeIcon } from '../icons';

type DropPosition = 'above' | 'below' | 'inside';

export class LayersPanel {
  private renaming: string | null = null;
  private dragId: string | null = null;
  private collapsed = new Set<string>();
  private lastDoc: unknown = null;
  private lastSelection: unknown = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly store: EditorStore,
  ) {}

  render(state: EditorState): void {
    if (this.renaming) return;
    if (state.document === this.lastDoc && state.selection === this.lastSelection) return;
    this.lastDoc = state.document;
    this.lastSelection = state.selection;
    const rows: HTMLElement[] = [];
    const visit = (list: readonly UiElement[], depth: number): void => {
      for (let i = list.length - 1; i >= 0; i--) {
        const el = list[i]!;
        rows.push(this.row(el, depth, state));
        if (el.children.length && !this.collapsed.has(el.id)) visit(el.children, depth + 1);
      }
    };
    visit(state.document.elements, 0);
    if (rows.length === 0) {
      rows.push(h('div', { class: 'panel-hint' }, 'Aucun élément. Choisissez un outil à gauche puis dessinez sur le canevas.'));
    }
    this.host.replaceChildren(...rows);
    this.host.querySelector('.layer.selected')?.scrollIntoView({ block: 'nearest' });
  }

  private row(el: UiElement, depth: number, state: EditorState): HTMLElement {
    const selected = state.selection.includes(el.id);
    const hasChildren = el.children.length > 0;
    const twisty = h(
      'button',
      {
        class: `twisty${hasChildren ? '' : ' empty'}${this.collapsed.has(el.id) ? '' : ' open'}`,
        type: 'button',
        tabindex: '-1',
        html: hasChildren ? icon('chevron', 12) : '',
      },
    );
    twisty.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.collapsed.has(el.id)) this.collapsed.delete(el.id);
      else this.collapsed.add(el.id);
      this.lastDoc = null;
      this.render(this.store.getState());
    });
    const name = h('span', { class: 'layer-name', title: getDefinition(el.type).label }, el.name);
    const eye = this.toggle(el.hidden ? 'eyeOff' : 'eye', el.hidden ? 'Afficher' : 'Masquer', () =>
      this.store.updateElement(el.id, { hidden: !el.hidden }),
    );
    const lock = this.toggle(el.locked ? 'lock' : 'unlock', el.locked ? 'Déverrouiller' : 'Verrouiller', () =>
      this.store.updateElement(el.id, { locked: !el.locked }),
    );
    const row = h(
      'div',
      {
        class: `layer${selected ? ' selected' : ''}${el.hidden ? ' is-hidden' : ''}${el.locked ? ' is-locked' : ''}`,
        draggable: 'true',
        style: `padding-left:${6 + depth * 14}px`,
        'data-id': el.id,
      },
      twisty,
      h('span', { class: 'layer-icon', html: icon(typeIcon(el.type), 15) }),
      name,
      eye,
      lock,
    );
    row.addEventListener('click', (e) => {
      if (e.ctrlKey || e.shiftKey) this.store.toggleSelect(el.id);
      else this.store.select([el.id]);
    });
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startRename(el, name);
    });
    row.addEventListener('dragstart', (e) => {
      this.dragId = el.id;
      e.dataTransfer?.setData('text/plain', el.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      this.dragId = null;
      this.clearDropMarks();
    });
    row.addEventListener('dragover', (e) => {
      const pos = this.dropPosition(e, row, el);
      if (!pos) return;
      e.preventDefault();
      this.clearDropMarks();
      row.classList.add(`drop-${pos}`);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below', 'drop-inside'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const pos = this.dropPosition(e, row, el);
      this.clearDropMarks();
      if (pos && this.dragId) this.applyDrop(this.dragId, el, pos);
    });
    return row;
  }

  private toggle(iconName: string, title: string, run: () => void): HTMLElement {
    const btn = h('button', { class: 'layer-toggle', type: 'button', title, tabindex: '-1', html: icon(iconName, 14) });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      run();
    });
    return btn;
  }

  private startRename(el: UiElement, label: HTMLElement): void {
    this.renaming = el.id;
    const input = h('input', { type: 'text', class: 'layer-rename mono', value: el.name, spellcheck: 'false' });
    const finish = (commit: boolean): void => {
      if (this.renaming !== el.id) return;
      this.renaming = null;
      if (commit && input.value.trim()) this.store.updateElement(el.id, { name: input.value.trim() });
      this.lastDoc = null;
      this.render(this.store.getState());
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    label.replaceWith(input);
    input.focus();
    input.select();
  }

  private dropPosition(e: DragEvent, row: HTMLElement, target: UiElement): DropPosition | null {
    const dragId = this.dragId;
    if (!dragId || dragId === target.id) return null;
    const doc = this.store.document;
    if (isDescendantOf(doc, target.id, dragId)) return null;
    const rect = row.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (canHaveChildren(target) && ratio > 0.25 && ratio < 0.75) return 'inside';
    return ratio < 0.5 ? 'above' : 'below';
  }

  /** Rows are displayed top-most first, so "above" in the list means a higher index in the model. */
  private applyDrop(dragId: string, target: UiElement, pos: DropPosition): void {
    const doc = this.store.document;
    if (!findElement(doc, dragId)) return;
    if (pos === 'inside') {
      this.store.moveToParent(dragId, target.id);
      return;
    }
    const parentId = parentIdOf(doc, target.id) ?? null;
    const siblings = siblingsOf(doc, parentId).filter((s) => s.id !== dragId);
    const targetIndex = siblings.findIndex((s) => s.id === target.id);
    const index = pos === 'above' ? targetIndex + 1 : targetIndex;
    this.store.moveToParent(dragId, parentId, index);
  }

  private clearDropMarks(): void {
    this.host.querySelectorAll('.drop-above, .drop-below, .drop-inside').forEach((n) => n.classList.remove('drop-above', 'drop-below', 'drop-inside'));
  }
}
