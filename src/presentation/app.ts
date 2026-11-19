/**
 * Renderer application: builds the window layout (toolbar, toolbox, design
 * surface, side panels, status bar), wires commands and keyboard shortcuts.
 */
import type { EditorState, EditorStore, ToolId } from '../application/editorStore';
import type { DocumentExporter, Logger } from '../application/ports';
import type { ProjectService } from '../application/projectService';
import type { Point } from '../domain/geometry';
import { BASE_CSS } from '../domain/html';
import { countElements, findElement, parentIdOf } from '../domain/tree';
import type { HostGateways } from '../infrastructure/browser/desktopGateways';
import { CanvasInteraction } from './canvas/canvasInteraction';
import { CanvasView } from './canvas/canvasView';
import { CommandRegistry, type Command } from './commands';
import { byId, debounce, h, isTyping } from './dom';
import { icon, typeIcon } from './icons';
import { LayersPanel } from './panels/layersPanel';
import { PropertiesPanel } from './panels/propertiesPanel';
import { PaintController } from './paint/paintController';
import { PaintSettings } from './paint/paintSettings';
import { buildColorSwatches, PaintOptionsBar } from './paint/paintWidgets';
import { isPaintTool, keyLabel, TOOLS } from './tools';
import { CodeView } from './views/codeView';
import { PreviewView } from './views/previewView';
import { closeContextMenu, showContextMenu, showModal, toast, type MenuItem } from './widgets';

export interface AppDependencies {
  readonly store: EditorStore;
  readonly project: ProjectService;
  readonly exporter: DocumentExporter;
  readonly host: HostGateways;
  readonly log: Logger;
}

export class App {
  private readonly store: EditorStore;
  private readonly commands: CommandRegistry;
  private readonly canvas: CanvasView;
  private readonly interaction: CanvasInteraction;
  private readonly properties: PropertiesPanel;
  private readonly layers: LayersPanel;
  private readonly preview: PreviewView;
  private readonly code: CodeView;
  private readonly paintSettings = new PaintSettings();
  private readonly paintOptions: PaintOptionsBar;
  private readonly toolButtons = new Map<ToolId, HTMLElement>();
  private readonly toggles = new Map<string, HTMLElement>();
  private pointer: Point | null = null;
  private lastTitle = '';
  private lastDirty: boolean | null = null;
  private rendered = false;

  constructor(private readonly deps: AppDependencies) {
    this.store = deps.store;
    const log = deps.log;
    this.commands = new CommandRegistry((id, err) => {
      log.error(`Command failed: ${id}`, err);
      toast(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    });

    document.head.append(h('style', {}, BASE_CSS));

    this.canvas = new CanvasView(byId('design-view'));
    this.paintOptions = new PaintOptionsBar(this.paintSettings);
    byId('design-view').append(this.paintOptions.element);
    this.properties = new PropertiesPanel(byId('properties'), this.store, deps.host.files, log.child('properties'));
    this.layers = new LayersPanel(byId('layers'), this.store);
    this.preview = new PreviewView(byId('preview-view'), deps.host.preview, log.child('preview'));
    this.code = new CodeView(byId('code-view'), {
      copy: (code) => void this.copyText(code),
      export: () => this.commands.run('file.export'),
    });
    this.interaction = new CanvasInteraction(
      this.canvas,
      this.store,
      {
        onEditElement: () => this.properties.focusPrimary(),
        onContextMenu: (x, y) => this.showCanvasMenu(x, y),
        onPointerMove: (p) => {
          this.pointer = p;
          this.renderStatus(this.store.getState());
        },
      },
      log.child('canvas'),
      new PaintController(this.canvas, this.store, this.paintSettings, log.child('paint')),
    );

    this.registerCommands();
    this.buildToolbox();
    this.buildToolbar();
    this.bindKeyboard();

    const refreshLiveViews = debounce((state: EditorState) => this.renderLiveViews(state), 120);
    this.store.subscribe((state, changes) => {
      this.render(state, changes.document);
      if (state.view !== 'design') refreshLiveViews(state);
    });
    this.render(this.store.getState(), true);
    requestAnimationFrame(() => this.zoomToFit());

    deps.host.desktop?.onMenuCommand((command) => this.commands.run(command));
    deps.host.desktop?.onOpenFile((path) => void deps.project.openPath(path));
    deps.host.desktop?.rendererReady();
  }

  // ------------------------------------------------------------------ rendering

  private render(state: EditorState, documentChanged: boolean): void {
    // A freshly loaded / new document has an empty history: fit it in the window.
    const docSwitched = this.rendered && documentChanged && !state.canUndo && !state.canRedo;
    this.canvas.render(state, documentChanged);
    this.properties.render(state);
    this.layers.render(state);
    this.renderToolbar(state);
    this.renderStatus(state);
    this.renderView(state);
    this.updateTitle(state);
    if (docSwitched) requestAnimationFrame(() => this.zoomToFit());
    this.rendered = true;
  }

  private renderView(state: EditorState): void {
    for (const view of ['design', 'preview', 'code'] as const) {
      byId(`${view}-view`).hidden = state.view !== view;
      this.toggles.get(`view.${view}`)?.classList.toggle('active', state.view === view);
    }
    byId('workspace').dataset['view'] = state.view;
  }

  private renderLiveViews(state: EditorState): void {
    const html = this.deps.exporter.exportHtml(state.document);
    if (state.view === 'preview') {
      const { canvas } = state.document;
      void this.preview.show(html, canvas.width, Math.min(canvas.viewportHeight, canvas.height), canvas.transparent, canvas.height);
    } else if (state.view === 'code') {
      this.code.show(html);
    }
  }

  private renderToolbar(state: EditorState): void {
    for (const [tool, btn] of this.toolButtons) btn.classList.toggle('active', state.tool === tool);
    this.paintOptions.show(isPaintTool(state.tool) ? state.tool : null);
    this.canvas.viewport.dataset['tool'] = isPaintTool(state.tool) ? 'paint' : state.tool;
    const setDisabled = (id: string, disabled: boolean): void => {
      const btn = this.toggles.get(id);
      if (btn) (btn as HTMLButtonElement).disabled = disabled;
    };
    setDisabled('edit.undo', !state.canUndo);
    setDisabled('edit.redo', !state.canRedo);
    this.toggles.get('edit.undo')?.setAttribute('title', state.undoLabel ? `Annuler : ${state.undoLabel} (Ctrl+Z)` : 'Annuler (Ctrl+Z)');
    this.toggles.get('edit.redo')?.setAttribute('title', state.redoLabel ? `Rétablir : ${state.redoLabel} (Ctrl+Y)` : 'Rétablir (Ctrl+Y)');
    const none = state.selection.length === 0;
    for (const id of ['align.left', 'align.hcenter', 'align.right', 'align.top', 'align.vcenter', 'align.bottom', 'edit.front', 'edit.back', 'edit.delete']) {
      setDisabled(id, none);
    }
    setDisabled('align.distributeH', state.selection.length < 3);
    setDisabled('align.distributeV', state.selection.length < 3);
    setDisabled('edit.group', none);
    this.toggles.get('view.grid')?.classList.toggle('active', state.document.grid.visible);
    this.toggles.get('view.snap')?.classList.toggle('active', state.document.grid.snap);
    const zoomLabel = this.toggles.get('zoom.label');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.zoom * 100)} %`;
  }

  private renderStatus(state: EditorState): void {
    const tool = TOOLS.find((t) => t.id === state.tool);
    byId('status-tool').textContent = tool ? tool.label : '';
    byId('status-pointer').textContent = this.pointer ? `${Math.round(this.pointer.x)}, ${Math.round(this.pointer.y)} px` : '';
    let sel = '';
    if (state.selection.length === 1) {
      const el = findElement(state.document, state.selection[0]!);
      if (el) sel = `${el.name} — ${el.x}, ${el.y} — ${el.width} × ${el.height}`;
    } else if (state.selection.length > 1) {
      const b = this.store.selectionBounds();
      sel = `${state.selection.length} éléments` + (b ? ` — ${Math.round(b.width)} × ${Math.round(b.height)}` : '');
    }
    byId('status-selection').textContent = sel;
    const { canvas } = state.document;
    const page = canvas.height > canvas.viewportHeight ? ` (écran ${canvas.viewportHeight})` : '';
    byId('status-doc').textContent = `${countElements(state.document)} éléments · ${canvas.width} × ${canvas.height}${page} · ${Math.round(state.zoom * 100)} %`;
    byId('status-file').textContent = (state.filePath ?? 'Non enregistré') + (state.dirty ? ' •' : '');
  }

  private updateTitle(state: EditorState): void {
    const title = `${state.document.name}${state.dirty ? ' •' : ''} — UI Designer`;
    if (title === this.lastTitle && state.dirty === this.lastDirty) return;
    this.lastTitle = title;
    this.lastDirty = state.dirty;
    document.title = title;
    this.deps.host.desktop?.setTitleState(title, state.dirty);
  }

  // ------------------------------------------------------------------ commands

  private registerCommands(): void {
    const s = this.store;
    const p = this.deps.project;
    const c = (command: Command): void => this.commands.register(command);
    const zoomCenter = (direction: 1 | -1): void => {
      const vp = this.canvas.viewport.getBoundingClientRect();
      const cx = vp.left + vp.width / 2;
      const cy = vp.top + vp.height / 2;
      const point = this.canvas.toCanvasPoint(cx, cy);
      s.zoomStep(direction);
      this.canvas.keepPointUnder(point, cx, cy);
    };

    c({ id: 'file.new', label: 'Nouveau', keys: ['Ctrl+N'], global: true, run: () => p.newDocument() });
    c({ id: 'file.open', label: 'Ouvrir…', keys: ['Ctrl+O'], global: true, run: () => p.open() });
    c({ id: 'file.save', label: 'Enregistrer', keys: ['Ctrl+S'], global: true, run: () => this.saved(p.save()) });
    c({ id: 'file.saveAs', label: 'Enregistrer sous…', keys: ['Ctrl+Shift+S'], global: true, run: () => this.saved(p.saveAs()) });
    c({
      id: 'file.export',
      label: 'Exporter en HTML…',
      keys: ['Ctrl+E'],
      global: true,
      run: async () => {
        const path = await p.exportHtml();
        if (path) {
          const desktop = this.deps.host.desktop;
          toast(`Exporté : ${path}`, desktop ? { label: 'Afficher', run: () => desktop.revealFile(path) } : undefined, 6000);
        }
      },
    });
    c({ id: 'edit.undo', label: 'Annuler', keys: ['Ctrl+Z'], run: () => s.undo() });
    c({ id: 'edit.redo', label: 'Rétablir', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], run: () => s.redo() });
    c({ id: 'edit.cut', label: 'Couper', keys: ['Ctrl+X'], run: () => s.cutSelection() });
    c({ id: 'edit.copy', label: 'Copier', keys: ['Ctrl+C'], run: () => void s.copySelection() });
    c({ id: 'edit.paste', label: 'Coller', keys: ['Ctrl+V'], run: () => s.paste() });
    c({ id: 'edit.duplicate', label: 'Dupliquer', keys: ['Ctrl+D'], run: () => s.duplicateSelection() });
    c({ id: 'edit.delete', label: 'Supprimer', keys: ['Delete', 'Backspace'], run: () => s.deleteSelection() });
    c({ id: 'edit.selectAll', label: 'Tout sélectionner', keys: ['Ctrl+A'], run: () => s.selectAll() });
    c({ id: 'edit.group', label: 'Grouper dans une boîte', keys: ['Ctrl+G'], run: () => s.groupSelection() });
    c({ id: 'edit.ungroup', label: 'Dégrouper', keys: ['Ctrl+Shift+G'], run: () => s.ungroupSelection() });
    c({ id: 'edit.front', label: 'Premier plan', keys: ['Ctrl+Shift+]'], run: () => s.reorderSelection('front') });
    c({ id: 'edit.forward', label: 'Avancer', keys: ['Ctrl+]'], run: () => s.reorderSelection('forward') });
    c({ id: 'edit.backward', label: 'Reculer', keys: ['Ctrl+['], run: () => s.reorderSelection('backward') });
    c({ id: 'edit.back', label: 'Arrière-plan', keys: ['Ctrl+Shift+['], run: () => s.reorderSelection('back') });
    c({
      id: 'edit.toggleLock',
      label: 'Verrouiller / déverrouiller',
      keys: ['Ctrl+L'],
      run: () => s.selectedElements().forEach((el) => s.updateElement(el.id, { locked: !el.locked })),
    });
    c({
      id: 'edit.toggleHide',
      label: 'Masquer / afficher',
      keys: ['Ctrl+H'],
      run: () => s.selectedElements().forEach((el) => s.updateElement(el.id, { hidden: !el.hidden })),
    });
    c({ id: 'align.left', label: 'Aligner à gauche', run: () => s.align('left') });
    c({ id: 'align.hcenter', label: 'Centrer horizontalement', run: () => s.align('hcenter') });
    c({ id: 'align.right', label: 'Aligner à droite', run: () => s.align('right') });
    c({ id: 'align.top', label: 'Aligner en haut', run: () => s.align('top') });
    c({ id: 'align.vcenter', label: 'Centrer verticalement', run: () => s.align('vcenter') });
    c({ id: 'align.bottom', label: 'Aligner en bas', run: () => s.align('bottom') });
    c({ id: 'align.distributeH', label: 'Répartir horizontalement', run: () => s.distribute('horizontal') });
    c({ id: 'align.distributeV', label: 'Répartir verticalement', run: () => s.distribute('vertical') });
    c({ id: 'view.design', label: 'Conception', keys: ['F5'], global: true, run: () => s.setView('design') });
    c({ id: 'view.preview', label: 'Aperçu', keys: ['F6'], global: true, run: () => s.setView('preview') });
    c({ id: 'view.code', label: 'Code', keys: ['F7'], global: true, run: () => s.setView('code') });
    c({ id: 'view.zoomIn', label: 'Zoom avant', keys: ['Ctrl+='], run: () => zoomCenter(1) });
    c({ id: 'view.zoomOut', label: 'Zoom arrière', keys: ['Ctrl+-'], run: () => zoomCenter(-1) });
    c({ id: 'view.zoom100', label: 'Taille réelle', keys: ['Ctrl+0'], run: () => this.setZoomCentered(1) });
    c({ id: 'view.zoomFit', label: 'Ajuster à la fenêtre', keys: ['Ctrl+B'], run: () => this.zoomToFit() });
    c({ id: 'view.grid', label: 'Afficher la grille', keys: ["Ctrl+'"], run: () => s.updateGrid({ visible: !s.document.grid.visible }) });
    c({ id: 'view.snap', label: 'Aimanter à la grille', keys: ["Ctrl+Shift+'"], run: () => s.updateGrid({ snap: !s.document.grid.snap }) });
    c({ id: 'help.shortcuts', label: 'Raccourcis clavier', keys: ['F1'], global: true, run: () => this.showShortcuts() });
    c({ id: 'help.logs', label: 'Dossier des logs', run: () => this.deps.host.desktop?.openLogsFolder() });
    c({ id: 'help.about', label: 'À propos', run: () => this.showAbout() });
    c({
      id: 'app.closeRequest',
      label: 'Fermer',
      run: async () => {
        if (await p.ensureSaved()) this.deps.host.desktop?.confirmClose();
      },
    });
  }

  private async saved(result: Promise<boolean>): Promise<void> {
    if (await result) toast('Projet enregistré');
  }

  private setZoomCentered(zoom: number): void {
    this.store.setZoom(zoom);
    this.canvas.centerCanvas();
  }

  private zoomToFit(): void {
    this.store.setZoom(Math.min(1, this.canvas.fitZoom()));
    this.canvas.centerCanvas();
  }

  private async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast('Code copié dans le presse-papiers');
    } catch (err) {
      this.deps.log.warn('Clipboard write failed', err);
      toast('Copie impossible');
    }
  }

  // ------------------------------------------------------------------ toolbox / toolbar

  private buildToolbox(): void {
    const host = byId('toolbox');
    let group = '';
    for (const tool of TOOLS) {
      if (tool.group !== group) {
        if (group) host.append(h('div', { class: 'toolbox-sep' }));
        group = tool.group;
      }
      const title = tool.key ? `${tool.label} (${keyLabel(tool.key)})` : tool.label;
      const btn = h('button', {
        class: 'tool-btn',
        type: 'button',
        title,
        'aria-label': tool.label,
        html: icon(typeIcon(tool.id), 20),
        onclick: () => this.store.setTool(tool.id),
      });
      this.toolButtons.set(tool.id, btn);
      host.append(btn);
    }
    host.append(h('div', { class: 'toolbox-sep' }), buildColorSwatches(this.paintSettings));
  }

  private buildToolbar(): void {
    const bar = byId('toolbar');
    const btn = (commandId: string, iconName: string, extraClass = ''): HTMLElement => {
      const command = this.commands.get(commandId)!;
      const shortcut = command.keys?.[0];
      const el = h('button', {
        class: `icon-btn ${extraClass}`.trim(),
        type: 'button',
        title: shortcut ? `${command.label} (${shortcut})` : command.label,
        'aria-label': command.label,
        html: icon(iconName),
        onclick: () => this.commands.run(commandId),
      });
      this.toggles.set(commandId, el);
      return el;
    };
    const tab = (commandId: string, iconName: string, label: string): HTMLElement => {
      const el = h('button', { class: 'tab-btn', type: 'button', onclick: () => this.commands.run(commandId), title: `${label} (${this.commands.shortcutOf(commandId)})` });
      el.innerHTML = icon(iconName, 16);
      el.append(h('span', {}, label));
      this.toggles.set(commandId, el);
      return el;
    };
    const sep = (): HTMLElement => h('div', { class: 'toolbar-sep' });
    const zoomLabel = h('button', { class: 'zoom-label', type: 'button', title: 'Taille réelle (Ctrl+0)', onclick: () => this.commands.run('view.zoom100') }, '100 %');
    this.toggles.set('zoom.label', zoomLabel);

    bar.append(
      btn('file.new', 'new'),
      btn('file.open', 'open'),
      btn('file.save', 'save'),
      btn('file.export', 'export', 'accent'),
      sep(),
      btn('edit.undo', 'undo'),
      btn('edit.redo', 'redo'),
      sep(),
      h('div', { class: 'tabs' }, tab('view.design', 'design', 'Conception'), tab('view.preview', 'preview', 'Aperçu'), tab('view.code', 'code', 'Code')),
      sep(),
      btn('align.left', 'alignLeft'),
      btn('align.hcenter', 'alignHCenter'),
      btn('align.right', 'alignRight'),
      btn('align.top', 'alignTop'),
      btn('align.vcenter', 'alignVCenter'),
      btn('align.bottom', 'alignBottom'),
      btn('align.distributeH', 'distributeH'),
      btn('align.distributeV', 'distributeV'),
      sep(),
      btn('edit.group', 'group'),
      btn('edit.ungroup', 'ungroup'),
      btn('edit.front', 'front'),
      btn('edit.back', 'back'),
      btn('edit.delete', 'trash'),
      h('div', { class: 'spacer' }),
      btn('view.grid', 'grid', 'toggle'),
      btn('view.snap', 'magnet', 'toggle'),
      sep(),
      btn('view.zoomOut', 'zoomOut'),
      zoomLabel,
      btn('view.zoomIn', 'zoomIn'),
      btn('view.zoomFit', 'fit'),
    );
  }

  // ------------------------------------------------------------------ keyboard

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        this.onEscape(e);
        return;
      }
      if (this.commands.handleKey(e)) return;
      if (isTyping(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      const state = this.store.getState();
      if (state.view !== 'design') return;

      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const arrow = arrows[e.key];
      if (arrow && state.selection.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? Math.max(10, state.document.grid.size) : 1;
        this.store.nudgeSelection(arrow[0] * step, arrow[1] * step);
        return;
      }
      if (e.key.length === 1 && !this.interaction.busy) {
        const key = (e.shiftKey ? 'shift+' : '') + e.key.toLowerCase();
        const tool = TOOLS.find((t) => t.key === key);
        if (tool) {
          e.preventDefault();
          this.store.setTool(tool.id);
          return;
        }
        if (!e.shiftKey && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          this.paintSettings.swapColors();
          return;
        }
        // [ and ] change the brush size (layout independent).
        if (!e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight') && isPaintTool(state.tool)) {
          e.preventDefault();
          const size = this.paintSettings.options.size;
          const step = size >= 20 ? 5 : 1;
          this.paintSettings.update({ size: size + (e.code === 'BracketRight' ? step : -step) });
        }
      }
    });
  }

  private onEscape(e: KeyboardEvent): void {
    if (document.querySelector('.modal-backdrop')) return;
    if (isTyping(e.target)) return;
    closeContextMenu();
    if (this.interaction.cancel()) return;
    const state = this.store.getState();
    if (state.tool !== 'pointer') {
      this.store.setTool('pointer');
      return;
    }
    if (state.selection.length === 1) {
      const parent = parentIdOf(state.document, state.selection[0]!);
      if (parent) {
        this.store.select([parent]);
        return;
      }
    }
    this.store.clearSelection();
  }

  // ------------------------------------------------------------------ menus & dialogs

  private showCanvasMenu(x: number, y: number): void {
    const s = this.store;
    const has = s.getState().selection.length > 0;
    const entry = (id: string, iconName?: string, disabled = false): MenuItem => {
      const command = this.commands.get(id)!;
      return {
        label: command.label,
        ...(command.keys?.[0] ? { shortcut: command.keys[0] } : {}),
        ...(iconName ? { icon: iconName } : {}),
        disabled,
        run: () => this.commands.run(id),
      };
    };
    showContextMenu(x, y, [
      entry('edit.cut', undefined, !has),
      entry('edit.copy', 'copy', !has),
      entry('edit.paste', undefined, !s.hasClipboard),
      entry('edit.duplicate', undefined, !has),
      entry('edit.delete', 'trash', !has),
      'separator',
      entry('edit.group', 'group', !has),
      entry('edit.ungroup', 'ungroup', !has),
      'separator',
      entry('edit.front', 'front', !has),
      entry('edit.forward', undefined, !has),
      entry('edit.backward', undefined, !has),
      entry('edit.back', 'back', !has),
      'separator',
      entry('edit.toggleLock', 'lock', !has),
      entry('edit.toggleHide', 'eyeOff', !has),
    ]);
  }

  private showShortcuts(): void {
    const rows: [string, string][] = [
      ...TOOLS.filter((t) => t.key).map((t): [string, string] => [keyLabel(t.key!), `Outil : ${t.label}`]),
      ['X', 'Inverser les couleurs de dessin'],
      ['[ / ]', 'Taille du crayon / pinceau / gomme'],
      ['Clic droit (dessin)', 'Peindre avec la couleur secondaire'],
      ['Ctrl + clic-glisser', 'Dessiner en gardant l’outil actif'],
      ['Clic (en-tête, pied, section)', 'Région sur toute la largeur'],
      ['Maj (en dessinant)', 'Carré / garder les proportions'],
      ['Maj (en déplaçant)', 'Contraindre à l’horizontale / verticale'],
      ['Alt (en déplaçant)', 'Ne pas changer de boîte parente'],
      ['Flèches / Maj + flèches', 'Déplacer de 1 px / d’un pas de grille'],
      ['Espace + glisser, clic molette', 'Défiler'],
      ['Ctrl + molette', 'Zoomer sur le curseur'],
      ['Double-clic', 'Modifier le texte de l’élément'],
      ['Échap', 'Annuler le geste / sélectionner le parent / désélectionner'],
      ...this.commands
        .all()
        .filter((c) => c.keys?.length)
        .map((c): [string, string] => [c.keys!.join(', '), c.label]),
    ];
    showModal(
      'Raccourcis clavier',
      h('table', { class: 'shortcuts' }, ...rows.map(([k, label]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, label)))),
    );
  }

  private showAbout(): void {
    const host = this.deps.host;
    showModal(
      'À propos',
      h(
        'div',
        { class: 'about' },
        h('p', {}, h('strong', {}, 'UI Designer'), ` ${host.version}`),
        h('p', {}, 'Dessinez des interfaces web et des HUD, exportez un fichier HTML unique et lisible par les IA.'),
        h('p', { class: 'muted' }, 'Fonctionne entièrement hors ligne.'),
        host.desktop ? h('p', { class: 'muted mono' }, `Logs : ${host.desktop.info.logsDirectory}`) : null,
      ),
    );
  }
}
