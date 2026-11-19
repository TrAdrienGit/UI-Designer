/**
 * Editor state and every user action that changes it. The presentation layer
 * only reads the state and calls these methods; it never mutates the document.
 */
import { getDefinition } from '../domain/catalog';
import { boundingRect, snap, type Point, type Rect } from '../domain/geometry';
import {
  createEmptyDocument,
  type CanvasSettings,
  type ElementProps,
  type ElementStyle,
  type ElementType,
  type GridSettings,
  type UiDocument,
  type UiElement,
} from '../domain/model';
import {
  absoluteRect,
  allNames,
  canHaveChildren,
  cloneElement,
  contentOrigin,
  createElement,
  findElement,
  hitTest,
  insertElement,
  parentIdOf,
  randomId,
  removeElements,
  reorder,
  reparent,
  uniqueName,
  updateElement,
  updateElements,
  type IdGenerator,
  type ZOrderMove,
} from '../domain/tree';
import { History } from './history';
import type { Logger } from './ports';
import {
  alignElements,
  distributeElements,
  groupElements,
  moveElements,
  topLevelIds,
  ungroupElement,
  type AlignMode,
} from './transform';

export type ToolId = 'pointer' | 'pan' | 'zoom' | ElementType;
export type ViewMode = 'design' | 'preview' | 'code';

export interface EditorState {
  readonly document: UiDocument;
  readonly selection: readonly string[];
  readonly tool: ToolId;
  readonly zoom: number;
  readonly view: ViewMode;
  readonly filePath: string | null;
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
}

/** What changed in the last update, so views can skip work. */
export interface ChangeSet {
  readonly document: boolean;
  readonly selection: boolean;
  readonly ui: boolean;
}

export type Listener = (state: EditorState, changes: ChangeSet) => void;

interface Snapshot {
  readonly document: UiDocument;
  readonly selection: readonly string[];
}

interface ClipboardEntry {
  readonly element: UiElement;
  readonly parentId: string | null;
}

export const ZOOM_LEVELS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8] as const;

export class EditorStore {
  private state: EditorState;
  private readonly history = new History<Snapshot>();
  private readonly listeners = new Set<Listener>();
  private gestureBase: Snapshot | null = null;
  private clipboard: ClipboardEntry[] = [];
  private pasteCount = 0;
  private savedDocument: UiDocument;

  constructor(
    private readonly log: Logger,
    private readonly newId: IdGenerator = randomId,
    initial: UiDocument = createEmptyDocument(),
  ) {
    this.savedDocument = initial;
    this.state = {
      document: initial,
      selection: [],
      tool: 'pointer',
      zoom: 1,
      view: 'design',
      filePath: null,
      dirty: false,
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    };
  }

  // ---------------------------------------------------------------- state

  getState(): EditorState {
    return this.state;
  }

  get document(): UiDocument {
    return this.state.document;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<EditorState>): void {
    const prev = this.state;
    const next: EditorState = { ...prev, ...patch };
    const document = next.document !== prev.document;
    const dirty = next.document !== this.savedDocument;
    this.state = {
      ...next,
      dirty,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
    };
    const changes: ChangeSet = {
      document,
      selection: next.selection !== prev.selection,
      ui: true,
    };
    for (const listener of this.listeners) listener(this.state, changes);
  }

  /** Records an undoable document change. */
  private commit(label: string, document: UiDocument, selection?: readonly string[], mergeKey?: string): void {
    if (document === this.state.document && selection === undefined) return;
    if (document !== this.state.document) {
      this.history.push(label, { document: this.state.document, selection: this.state.selection }, mergeKey);
      this.log.debug(`${label}`, mergeKey ? { mergeKey } : undefined);
    }
    this.set({ document, ...(selection ? { selection: this.cleanSelection(document, selection) } : {}) });
  }

  private cleanSelection(doc: UiDocument, ids: readonly string[]): string[] {
    return [...new Set(ids)].filter((id) => findElement(doc, id));
  }

  // ---------------------------------------------------------------- ui state

  setTool(tool: ToolId): void {
    if (tool !== this.state.tool) this.set({ tool });
  }

  setView(view: ViewMode): void {
    if (view !== this.state.view) this.set({ view });
  }

  setZoom(zoom: number): void {
    const clamped = Math.min(8, Math.max(0.1, Math.round(zoom * 100) / 100));
    if (clamped !== this.state.zoom) this.set({ zoom: clamped });
  }

  zoomStep(direction: 1 | -1): void {
    const z = this.state.zoom;
    const next =
      direction > 0 ? ZOOM_LEVELS.find((l) => l > z + 0.001) : [...ZOOM_LEVELS].reverse().find((l) => l < z - 0.001);
    if (next !== undefined) this.setZoom(next);
  }

  // ---------------------------------------------------------------- selection

  select(ids: readonly string[]): void {
    this.set({ selection: this.cleanSelection(this.state.document, ids) });
  }

  toggleSelect(id: string): void {
    const sel = this.state.selection;
    this.select(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]);
  }

  clearSelection(): void {
    if (this.state.selection.length > 0) this.set({ selection: [] });
  }

  /** Selects every sibling of the current selection (or every top-level element). */
  selectAll(): void {
    const first = this.state.selection[0];
    const parentId = first ? parentIdOf(this.state.document, first) ?? null : null;
    const list = parentId === null ? this.state.document.elements : findElement(this.state.document, parentId)?.children ?? [];
    this.select(list.filter((el) => !el.hidden).map((el) => el.id));
  }

  selectedElements(): UiElement[] {
    return this.state.selection.map((id) => findElement(this.state.document, id)).filter((el): el is UiElement => !!el);
  }

  // ---------------------------------------------------------------- creation

  /**
   * Creates an element from a rect in canvas coordinates. The parent is the
   * deepest container under the rect's top-left corner unless given.
   */
  addElement(type: ElementType, absRect: Rect, parentId?: string | null, gridStep = 0): string {
    const doc = this.state.document;
    const parent =
      parentId !== undefined ? parentId : hitTest(doc, { x: absRect.x + 1, y: absRect.y + 1 }, { containersOnly: true })?.id ?? null;
    const origin = contentOrigin(doc, parent);
    const def = getDefinition(type);
    const id = this.newId();
    const rel = (v: number): number => (gridStep > 1 ? snap(v, gridStep) : Math.round(v));
    const element = createElement(
      type,
      { x: rel(absRect.x - origin.x), y: rel(absRect.y - origin.y), width: absRect.width, height: absRect.height },
      id,
      uniqueName(doc, def.namePrefix),
    );
    this.commit(`Ajouter ${def.label.toLowerCase()}`, insertElement(doc, parent, element), [id]);
    return id;
  }

  // ---------------------------------------------------------------- gestures

  /** Starts a continuous change (drag, resize): intermediate states are not recorded. */
  beginGesture(): void {
    this.gestureBase = { document: this.state.document, selection: this.state.selection };
  }

  /** Replaces the document during a gesture, computed from the gesture's starting document. */
  updateGesture(compute: (base: UiDocument) => UiDocument): void {
    if (!this.gestureBase) return;
    this.set({ document: compute(this.gestureBase.document) });
  }

  /** Ends a gesture with a single undo entry (none if nothing changed). */
  endGesture(label: string): void {
    const base = this.gestureBase;
    this.gestureBase = null;
    if (!base || base.document === this.state.document) return;
    this.history.push(label, base);
    this.log.debug(label);
    this.set({ selection: this.cleanSelection(this.state.document, this.state.selection) });
  }

  cancelGesture(): void {
    const base = this.gestureBase;
    this.gestureBase = null;
    if (base) this.set({ document: base.document, selection: base.selection });
  }

  get inGesture(): boolean {
    return this.gestureBase !== null;
  }

  // ---------------------------------------------------------------- edition

  nudgeSelection(dx: number, dy: number): void {
    const doc = moveElements(this.state.document, this.state.selection, { x: dx, y: dy });
    this.commit('Déplacer', doc, undefined, 'nudge');
  }

  /** Updates geometry / name / flags of one element (values relative to its parent). */
  updateElement(id: string, patch: Partial<Pick<UiElement, 'name' | 'x' | 'y' | 'width' | 'height' | 'hidden' | 'locked' | 'cssClass'>>): void {
    const el = findElement(this.state.document, id);
    if (!el) return;
    const def = getDefinition(el.type);
    const clean = { ...patch };
    if (clean.width !== undefined) clean.width = Math.max(def.minWidth, Math.round(clean.width));
    if (clean.height !== undefined) clean.height = Math.max(def.minHeight, Math.round(clean.height));
    if (clean.name !== undefined && !clean.name.trim()) delete clean.name;
    const key = Object.keys(clean).sort().join(',');
    this.commit('Modifier', updateElement(this.state.document, id, (e) => ({ ...e, ...clean })), undefined, `el:${id}:${key}`);
  }

  updateStyle(ids: readonly string[], patch: Partial<ElementStyle>): void {
    const key = Object.keys(patch).sort().join(',');
    const doc = updateElements(this.state.document, ids, (el) => ({ ...el, style: { ...el.style, ...patch } }));
    this.commit('Modifier le style', doc, undefined, `style:${ids.join(',')}:${key}`);
  }

  updateProps(ids: readonly string[], patch: Partial<ElementProps>): void {
    const key = Object.keys(patch).sort().join(',');
    const doc = updateElements(this.state.document, ids, (el) => ({ ...el, props: { ...el.props, ...patch } }));
    this.commit('Modifier le contenu', doc, undefined, `props:${ids.join(',')}:${key}`);
  }

  updateCanvas(patch: Partial<CanvasSettings>): void {
    const doc = this.state.document;
    const canvas = { ...doc.canvas, ...patch };
    canvas.width = Math.max(16, Math.round(canvas.width));
    canvas.height = Math.max(16, Math.round(canvas.height));
    this.commit('Modifier le canevas', { ...doc, canvas }, undefined, `canvas:${Object.keys(patch).join(',')}`);
  }

  updateGrid(patch: Partial<GridSettings>): void {
    const doc = this.state.document;
    const grid = { ...doc.grid, ...patch };
    grid.size = Math.max(1, Math.min(200, Math.round(grid.size)));
    this.commit('Modifier la grille', { ...doc, grid }, undefined, 'grid');
  }

  renameDocument(name: string): void {
    if (name.trim() && name !== this.state.document.name) {
      this.commit('Renommer le document', { ...this.state.document, name: name.trim() }, undefined, 'docname');
    }
  }

  deleteSelection(): void {
    const ids = topLevelIds(this.state.document, this.state.selection);
    if (ids.length === 0) return;
    this.commit('Supprimer', removeElements(this.state.document, ids), []);
  }

  reorderSelection(move: ZOrderMove): void {
    let doc = this.state.document;
    const ids = topLevelIds(doc, this.state.selection);
    // Moving several elements forward must start with the top-most one, and the reverse for backward.
    const ordered = move === 'forward' || move === 'front' ? [...ids].reverse() : ids;
    for (const id of ordered) doc = reorder(doc, id, move);
    this.commit('Changer l’ordre', doc);
  }

  /** Moves an element in the layer tree (drag & drop in the layers panel). */
  moveToParent(id: string, parentId: string | null, index?: number): void {
    this.commit('Déplacer dans l’arbre', reparent(this.state.document, id, parentId, index), [id]);
  }

  align(mode: AlignMode): void {
    this.commit('Aligner', alignElements(this.state.document, this.state.selection, mode));
  }

  distribute(axis: 'horizontal' | 'vertical'): void {
    this.commit('Répartir', distributeElements(this.state.document, this.state.selection, axis));
  }

  groupSelection(): void {
    const doc = this.state.document;
    const group = createElement('container', { x: 0, y: 0, width: 1, height: 1 }, this.newId(), uniqueName(doc, 'group'));
    const result = groupElements(doc, this.state.selection, group);
    if (!result) {
      this.log.info('Group refused: the selected elements must share the same parent');
      return;
    }
    this.commit('Grouper', result.doc, [result.groupId]);
  }

  ungroupSelection(): void {
    let doc = this.state.document;
    const selection: string[] = [];
    for (const id of this.state.selection) {
      const result = ungroupElement(doc, id);
      if (result) {
        doc = result.doc;
        selection.push(...result.childIds);
      }
    }
    if (selection.length) this.commit('Dégrouper', doc, selection);
  }

  // ---------------------------------------------------------------- clipboard

  copySelection(): number {
    const doc = this.state.document;
    this.clipboard = topLevelIds(doc, this.state.selection).map((id) => ({
      element: findElement(doc, id)!,
      parentId: parentIdOf(doc, id) ?? null,
    }));
    this.pasteCount = 0;
    return this.clipboard.length;
  }

  cutSelection(): void {
    if (this.copySelection() > 0) this.deleteSelection();
  }

  get hasClipboard(): boolean {
    return this.clipboard.length > 0;
  }

  /** Pastes into the selected container, else next to the originals (offset so copies stay visible). */
  paste(intoSelectedContainer = true): void {
    if (this.clipboard.length === 0) return;
    let doc = this.state.document;
    this.pasteCount++;
    const selected =
      intoSelectedContainer && this.state.selection.length === 1 ? findElement(doc, this.state.selection[0]!) : undefined;
    const targetParent = selected && canHaveChildren(selected) ? selected.id : undefined;
    const taken = allNames(doc);
    const ids: string[] = [];
    for (const entry of this.clipboard) {
      let parentId = targetParent ?? entry.parentId;
      if (parentId !== null && !findElement(doc, parentId)) parentId = null;
      const offset = targetParent ? 0 : this.pasteCount * 10;
      const clone = cloneElement(entry.element, this.newId, (el) => uniqueName(doc, getDefinition(el.type).namePrefix, taken));
      const placed = { ...clone, x: (targetParent ? 0 : clone.x) + offset, y: (targetParent ? 0 : clone.y) + offset };
      doc = insertElement(doc, parentId, placed);
      ids.push(placed.id);
    }
    this.commit('Coller', doc, ids);
  }

  duplicateSelection(): void {
    const saved = this.clipboard;
    const savedCount = this.pasteCount;
    if (this.copySelection() > 0) this.paste(false);
    this.clipboard = saved;
    this.pasteCount = savedCount;
  }

  /** Absolute bounds of the selection (for the status bar / properties). */
  selectionBounds(): Rect | null {
    return boundingRect(
      this.state.selection.map((id) => absoluteRect(this.state.document, id)).filter((r): r is Rect => !!r),
    );
  }

  elementAt(point: Point): UiElement | null {
    return hitTest(this.state.document, point);
  }

  // ---------------------------------------------------------------- history

  undo(): void {
    const entry = this.history.undo({ document: this.state.document, selection: this.state.selection });
    if (!entry) return;
    this.log.debug(`Undo: ${entry.label}`);
    this.set({ document: entry.state.document, selection: entry.state.selection });
  }

  redo(): void {
    const entry = this.history.redo({ document: this.state.document, selection: this.state.selection });
    if (!entry) return;
    this.log.debug(`Redo: ${entry.label}`);
    this.set({ document: entry.state.document, selection: entry.state.selection });
  }

  // ---------------------------------------------------------------- files

  /** Replaces the whole document (new / open). Clears the history. */
  loadDocument(doc: UiDocument, filePath: string | null): void {
    this.history.clear();
    this.gestureBase = null;
    this.savedDocument = doc;
    this.set({ document: doc, selection: [], filePath, zoom: this.state.zoom });
    this.log.info(`Document loaded: ${doc.name}`, { filePath });
  }

  markSaved(filePath: string): void {
    this.savedDocument = this.state.document;
    this.history.seal();
    this.set({ filePath });
  }
}
