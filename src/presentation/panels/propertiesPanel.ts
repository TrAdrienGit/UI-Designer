/**
 * Properties panel: document settings when nothing is selected, element
 * properties for a single selection, shared style for a multi-selection.
 */
import type { EditorState, EditorStore } from '../../application/editorStore';
import type { FileGateway, Logger } from '../../application/ports';
import { getDefinition } from '../../domain/catalog';
import { buildHtmlIds, LINKABLE_TYPES } from '../../domain/html';
import type { BackgroundFit, BoxTag, ElementProps, ElementStyle, UiElement } from '../../domain/model';
import { contentOrigin, findElement, parentIdOf } from '../../domain/tree';
import { h } from '../dom';
import { icon } from '../icons';
import { CANVAS_PRESETS, FONT_SUGGESTIONS } from '../presets';
import { toast } from '../widgets';
import {
  buttonRow,
  checkField,
  colorField,
  numberField,
  row,
  section,
  selectField,
  textField,
  type Field,
} from './fields';

export class PropertiesPanel {
  private fields: Field[] = [];
  private key = '';
  private primaryField: Field | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly store: EditorStore,
    private readonly files: FileGateway,
    private readonly log: Logger,
  ) {}

  render(state: EditorState): void {
    const selected = state.selection.map((id) => findElement(state.document, id)).filter((e): e is UiElement => !!e);
    const key = selected.length === 0 ? 'doc' : selected.map((e) => `${e.id}:${e.type}`).join('|');
    if (key !== this.key) {
      this.key = key;
      this.build(selected);
    }
    for (const f of this.fields) f.refresh();
  }

  /** Focuses the main content field (text...) of the selected element. */
  focusPrimary(): void {
    this.primaryField?.focus?.();
  }

  private build(selected: UiElement[]): void {
    this.fields = [];
    this.primaryField = null;
    let content: HTMLElement[];
    if (selected.length === 0) content = this.buildDocument();
    else if (selected.length === 1) content = this.buildSingle(selected[0]!);
    else content = this.buildMulti(selected);
    this.host.replaceChildren(...content);
  }

  private add<F extends Field>(field: F): F {
    this.fields.push(field);
    return field;
  }

  // ------------------------------------------------------------------ document

  private buildDocument(): HTMLElement[] {
    const s = this.store;
    const doc = () => s.document;
    const presetSelect = h(
      'select',
      {},
      h('option', { value: '' }, 'Choisir un format…'),
      ...CANVAS_PRESETS.map((p, i) => h('option', { value: String(i) }, p.label)),
    );
    presetSelect.addEventListener('change', () => {
      const preset = CANVAS_PRESETS[Number(presetSelect.value)];
      if (preset) {
        s.updateCanvas({ width: preset.width, height: preset.height, viewportHeight: preset.height, transparent: preset.transparent ?? false });
        this.log.info('Canvas preset applied', { preset: preset.label });
      }
      presetSelect.value = '';
    });
    return [
      h('div', { class: 'panel-hint' }, 'Aucun élément sélectionné : réglages du document.'),
      section(
        'Document',
        row('Nom', this.add(textField(() => doc().name, (v) => s.renameDocument(v)))),
      ),
      section(
        'Page',
        row('Format', presetSelect),
        row('Largeur', this.add(numberField(() => doc().canvas.width, (v) => s.updateCanvas({ width: v }), { min: 16, max: 10000, suffix: 'px' }))),
        row('Hauteur', this.add(numberField(() => doc().canvas.height, (v) => s.updateCanvas({ height: v }), { min: 16, max: 50000, suffix: 'px' }))),
        row('Écran', this.add(numberField(() => doc().canvas.viewportHeight, (v) => s.updateCanvas({ viewportHeight: v }), { min: 16, max: 10000, suffix: 'px' }))),
        buttonRow(
          h('button', {
            class: 'btn',
            type: 'button',
            title: 'Allonge la page de la hauteur d’un écran',
            onclick: () => s.updateCanvas({ height: doc().canvas.height + doc().canvas.viewportHeight }),
          }, '+ 1 écran'),
          h('button', {
            class: 'btn',
            type: 'button',
            title: 'Ramène la page à la hauteur de l’écran',
            onclick: () => s.updateCanvas({ height: doc().canvas.viewportHeight }),
          }, '1 seul écran'),
        ),
        h(
          'div',
          { class: 'panel-hint' },
          'Hauteur = toute la page ; Écran = partie visible. Une page plus haute que l’écran défile dans l’Aperçu. ',
          'Vous pouvez aussi tirer la poignée sous la page.',
        ),
        row('Fond', this.add(colorField(() => doc().canvas.background, (v) => s.updateCanvas({ background: v })))),
        ...this.backgroundImageRows(
          () => doc().canvas.backgroundImage,
          (v) => s.updateCanvas({ backgroundImage: v }),
          () => doc().canvas.backgroundFit,
          (v) => s.updateCanvas({ backgroundFit: v }),
        ),
        row('', this.add(checkField('Fond transparent (HUD / overlay)', () => doc().canvas.transparent, (v) => s.updateCanvas({ transparent: v })))),
      ),
      section(
        'Grille',
        row('Pas', this.add(numberField(() => doc().grid.size, (v) => s.updateGrid({ size: v }), { min: 1, max: 200, suffix: 'px' }))),
        row('', this.add(checkField('Afficher la grille', () => doc().grid.visible, (v) => s.updateGrid({ visible: v })))),
        row('', this.add(checkField('Aimanter à la grille', () => doc().grid.snap, (v) => s.updateGrid({ snap: v })))),
      ),
    ];
  }

  // ------------------------------------------------------------------ single element

  private buildSingle(el: UiElement): HTMLElement[] {
    const s = this.store;
    const id = el.id;
    const cur = (): UiElement => findElement(s.document, id) ?? el;
    const def = getDefinition(el.type);

    const parentId = parentIdOf(s.document, id) ?? null;
    const parentName = parentId ? findElement(s.document, parentId)?.name : null;
    const origin = () => contentOrigin(s.document, parentIdOf(s.document, id) ?? null);

    const header = h(
      'div',
      { class: 'panel-title' },
      h('span', { class: 'type-badge' }, def.label),
      parentName ? h('span', { class: 'muted' }, ` dans ${parentName}`) : null,
    );

    const sections: HTMLElement[] = [
      header,
      section(
        'Élément',
        row('Nom', this.add(textField(() => cur().name, (v) => s.updateElement(id, { name: v }), { mono: true }))),
        row('Classes CSS', this.add(textField(() => cur().cssClass, (v) => s.updateElement(id, { cssClass: v }), { mono: true, placeholder: 'classe-a classe-b' }))),
        row('', this.add(checkField('Masqué', () => cur().hidden, (v) => s.updateElement(id, { hidden: v })))),
        row('', this.add(checkField('Verrouillé', () => cur().locked, (v) => s.updateElement(id, { locked: v })))),
        row('', this.add(checkField('Fixe à l’écran (ne défile pas)', () => cur().fixed, (v) => s.updateElement(id, { fixed: v })))),
      ),
      section(
        'Position et taille',
        h(
          'div',
          { class: 'prop-grid' },
          row('X', this.add(numberField(() => cur().x, (v) => s.updateElement(id, { x: v })))),
          row('Y', this.add(numberField(() => cur().y, (v) => s.updateElement(id, { y: v })))),
          row('L', this.add(numberField(() => cur().width, (v) => s.updateElement(id, { width: v }), { min: def.minWidth }))),
          row('H', this.add(numberField(() => cur().height, (v) => s.updateElement(id, { height: v }), { min: def.minHeight }))),
        ),
        h('div', { class: 'panel-hint' }, 'X / Y relatifs au parent. Absolu : ', this.absoluteLabel(cur, origin)),
      ),
    ];
    const contentSection = this.buildContent(el.type, id, cur);
    if (contentSection) sections.push(contentSection);
    if (LINKABLE_TYPES.has(el.type)) sections.push(this.buildLink(id, cur));
    const noText = ['image', 'video', 'drawing', 'divider', 'progress', 'slider'];
    sections.push(...this.buildStyleSections([id], () => cur().style, !noText.includes(el.type)));
    sections.push(
      section(
        'Interaction',
        row(
          'Au clic (JS)',
          this.add(
            textField(() => cur().props.onClick, (v) => s.updateProps([id], { onClick: v }), {
              multiline: true,
              mono: true,
              rows: 3,
              placeholder: "alert('Clic !');",
            }),
          ),
        ),
        h('div', { class: 'panel-hint' }, 'Exporté comme écouteur « click » ; jamais exécuté dans l’éditeur.'),
      ),
    );
    return sections;
  }

  private absoluteLabel(cur: () => UiElement, origin: () => { x: number; y: number }): HTMLElement {
    const span = h('span', { class: 'mono' });
    this.add({
      element: span,
      refresh() {
        const o = origin();
        span.textContent = `${o.x + cur().x}, ${o.y + cur().y}`;
      },
    });
    return span;
  }

  private buildContent(type: UiElement['type'], id: string, cur: () => UiElement): HTMLElement | null {
    const s = this.store;
    const p = <K extends keyof ElementProps>(key: K) => () => cur().props[key];
    const setP = <K extends keyof ElementProps>(key: K) => (v: ElementProps[K]) => s.updateProps([id], { [key]: v } as Partial<ElementProps>);
    const text = (label: string, multiline = false): HTMLElement => {
      const f = this.add(textField(p('text'), setP('text'), { multiline, rows: 3 }));
      this.primaryField ??= f;
      return row(label, f);
    };
    const items = (label: string): HTMLElement => {
      const f = this.add(
        textField(
          () => cur().props.items.join('\n'),
          (v) => s.updateProps([id], { items: v.split('\n') }),
          { multiline: true, rows: 5 },
        ),
      );
      this.primaryField ??= f;
      return row(label, f);
    };
    const accent = (): HTMLElement => row('Accent', this.add(colorField(p('accent'), setP('accent'))));
    const range = (): HTMLElement[] => [
      row('Valeur', this.add(numberField(p('value'), setP('value')))),
      row('Min', this.add(numberField(p('min'), setP('min')))),
      row('Max', this.add(numberField(p('max'), setP('max')))),
    ];

    switch (type) {
      case 'container':
        return section(
          'Contenu',
          row(
            'Balise',
            this.add(
              selectField<BoxTag>(
                [
                  ['div', 'Boîte simple (div)'],
                  ['header', 'En-tête (header)'],
                  ['nav', 'Navigation (nav)'],
                  ['main', 'Contenu principal (main)'],
                  ['section', 'Section'],
                  ['article', 'Article'],
                  ['aside', 'Encadré (aside)'],
                  ['footer', 'Pied de page (footer)'],
                ],
                p('boxTag'),
                setP('boxTag'),
              ),
            ),
          ),
          h('div', { class: 'panel-hint' }, 'La balise donne le rôle de la boîte dans la page (utile pour le référencement et les IA).'),
        );
      case 'text':
        return section(
          'Contenu',
          text('Texte', true),
          row(
            'Balise',
            this.add(
              selectField(
                [
                  ['p', 'Paragraphe (p)'],
                  ['span', 'En ligne (span)'],
                  ['label', 'Libellé (label)'],
                  ['h1', 'Titre 1 (h1)'],
                  ['h2', 'Titre 2 (h2)'],
                  ['h3', 'Titre 3 (h3)'],
                  ['h4', 'Titre 4 (h4)'],
                ] as const,
                p('tag'),
                setP('tag'),
              ),
            ),
          ),
        );
      case 'button':
        return section('Contenu', text('Texte'));
      case 'input':
        return section(
          'Contenu',
          text('Valeur'),
          row('Indication', this.add(textField(p('placeholder'), setP('placeholder')))),
          row(
            'Type',
            this.add(
              selectField(
                [
                  ['text', 'Texte'],
                  ['password', 'Mot de passe'],
                  ['email', 'E-mail'],
                  ['number', 'Nombre'],
                  ['search', 'Recherche'],
                ] as const,
                p('inputType'),
                setP('inputType'),
              ),
            ),
          ),
          accent(),
        );
      case 'textarea':
        return section('Contenu', text('Texte', true), row('Indication', this.add(textField(p('placeholder'), setP('placeholder')))), accent());
      case 'checkbox':
      case 'toggle':
        return section('Contenu', text('Libellé'), row('', this.add(checkField('Coché', p('checked'), setP('checked')))), accent());
      case 'radio':
        return section(
          'Contenu',
          text('Libellé'),
          row('Groupe', this.add(textField(p('group'), setP('group'), { mono: true }))),
          row('', this.add(checkField('Coché', p('checked'), setP('checked')))),
          accent(),
        );
      case 'select':
        return section('Contenu', items('Options (1/ligne)'));
      case 'list':
        return section('Contenu', items('Éléments (1/ligne)'), row('', this.add(checkField('Liste numérotée', p('ordered'), setP('ordered')))));
      case 'image': {
        const pick = this.mediaButton('Choisir une image…', 'image', (src) => s.updateProps([id], { src }));
        const remove = h('button', { class: 'btn', type: 'button', onclick: () => s.updateProps([id], { src: '' }) }, 'Retirer');
        return section(
          'Contenu',
          buttonRow(pick, remove),
          this.sourceRow(() => cur().props.src, (v) => s.updateProps([id], { src: v })),
          row('Texte alt.', this.add(textField(p('alt'), setP('alt')))),
          row(
            'Ajustement',
            this.add(
              selectField(
                [
                  ['contain', 'Contenir'],
                  ['cover', 'Couvrir'],
                  ['fill', 'Étirer'],
                  ['none', 'Taille réelle'],
                ] as const,
                p('fit'),
                setP('fit'),
              ),
            ),
          ),
          h('div', { class: 'panel-hint' }, 'Importée, l’image est intégrée au fichier (data URL) : l’export reste un fichier unique. Une URL reste externe.'),
        );
      }
      case 'video':
        return section(
          'Contenu',
          buttonRow(
            this.mediaButton('Importer une vidéo…', 'video', (src) => s.updateProps([id], { src })),
            h('button', { class: 'btn', type: 'button', onclick: () => s.updateProps([id], { src: '' }) }, 'Retirer'),
          ),
          this.sourceRow(() => cur().props.src, (v) => s.updateProps([id], { src: v })),
          row('', this.add(checkField('Contrôles (lecture, volume…)', p('controls'), setP('controls')))),
          row('', this.add(checkField('Lecture automatique', p('autoplay'), setP('autoplay')))),
          row('', this.add(checkField('En boucle', p('loop'), setP('loop')))),
          row('', this.add(checkField('Muet', p('muted'), setP('muted')))),
          row(
            'Ajustement',
            this.add(
              selectField(
                [
                  ['contain', 'Contenir'],
                  ['cover', 'Couvrir'],
                  ['fill', 'Étirer'],
                ] as const,
                p('fit'),
                setP('fit'),
              ),
            ),
          ),
          h(
            'div',
            { class: 'panel-hint' },
            'Importée, la vidéo est intégrée au fichier (64 Mo max., le fichier exporté grossit d’autant) ; ',
            'sinon indiquez une URL. Les navigateurs ne lancent la lecture automatique que si la vidéo est muette. ',
            'Elle ne joue pas dans la vue Conception : voir l’Aperçu.',
          ),
        );
      case 'drawing':
        return section(
          'Dessin',
          row('', this.add(checkField('Guide seulement (non exporté)', p('guide'), setP('guide')))),
          buttonRow(
            this.mediaButton('Importer une image…', 'image', (src) => s.updateProps([id], { src })),
            h('button', { class: 'btn', type: 'button', onclick: () => s.updateProps([id], { src: '' }) }, 'Effacer'),
          ),
          h(
            'div',
            { class: 'panel-hint' },
            'Peignez dans ce calque avec le crayon, le pinceau, la gomme, le pot ou les formes (groupe Dessin de la boîte à outils). ',
            'Un calque « guide » sert de modèle à décalquer : il reste visible ici mais n’est pas exporté. ',
            'Importer une image (capture, croquis scanné) la place dans le calque pour la retoucher ou la décalquer.',
          ),
        );
      case 'progress':
      case 'slider':
        return section('Contenu', ...range(), accent());
      default:
        return null;
    }
  }

  // ------------------------------------------------------------------ links & media helpers

  private buildLink(id: string, cur: () => UiElement): HTMLElement {
    const s = this.store;
    const anchors = [...buildHtmlIds(s.document.elements).values()].map((v) => `#${v}`);
    return section(
      'Lien',
      row(
        'Adresse',
        this.add(
          textField(() => cur().props.href, (v) => s.updateProps([id], { href: v }), {
            mono: true,
            placeholder: 'https://… ou #id',
            list: anchors,
          }),
        ),
      ),
      row('', this.add(checkField('Ouvrir dans un nouvel onglet', () => cur().props.newTab, (v) => s.updateProps([id], { newTab: v })))),
      h(
        'div',
        { class: 'panel-hint' },
        'Exemples : https://exemple.fr, page.html, #section-1 (fait défiler jusqu’à cet élément), mailto:moi@exemple.fr. ',
        'Testable dans l’Aperçu : les liens web s’ouvrent dans le navigateur.',
      ),
    );
  }

  /** Button that imports an image / video file and hands its data URL to `apply`. */
  private mediaButton(label: string, kind: 'image' | 'video', apply: (src: string) => void): HTMLElement {
    const btn = h('button', { class: 'btn', type: 'button' }, label);
    btn.addEventListener('click', async () => {
      try {
        const src = kind === 'image' ? await this.files.pickImage() : await this.files.pickVideo();
        if (src) apply(src);
      } catch (err) {
        this.log.error(`${kind} import failed`, err);
        toast(`Import impossible : ${cleanError(err)}`);
      }
    });
    return btn;
  }

  /** URL of a media (empty when the file is embedded) + size of the embedded data. */
  private sourceRow(get: () => string, set: (v: string) => void): HTMLElement {
    const field = this.add(
      textField(() => (get().startsWith('data:') ? '' : get()), (v) => set(v.trim()), { mono: true, placeholder: 'URL (https://…, video.mp4…)' }),
    );
    const status = h('div', { class: 'panel-hint media-status' });
    this.add({
      element: status,
      refresh() {
        const src = get();
        status.textContent = src.startsWith('data:') ? `Fichier intégré (${formatBytes(dataUrlBytes(src))})` : src ? 'Fichier externe (URL)' : 'Aucun fichier';
      },
    });
    return h('div', {}, row('URL', field), status);
  }

  private backgroundImageRows(
    getImage: () => string,
    setImage: (v: string) => void,
    getFit: () => BackgroundFit,
    setFit: (v: BackgroundFit) => void,
    getPosition?: () => string,
    setPosition?: (v: string) => void,
  ): HTMLElement[] {
    const remove = h('button', { class: 'btn', type: 'button', onclick: () => setImage('') }, 'Retirer');
    const status = h('span', { class: 'muted' });
    this.add({
      element: status,
      refresh() {
        const v = getImage();
        status.textContent = v ? (v.startsWith('data:') ? formatBytes(dataUrlBytes(v)) : 'URL') : 'aucune';
        remove.hidden = !v;
      },
    });
    const rows = [
      row('Image fond', buttonRow(this.mediaButton('Choisir…', 'image', setImage), remove, status)),
      row(
        'Ajustement',
        this.add(
          selectField<BackgroundFit>(
            [
              ['cover', 'Couvrir'],
              ['contain', 'Contenir'],
              ['stretch', 'Étirer'],
              ['tile', 'Mosaïque'],
              ['none', 'Taille réelle'],
            ],
            getFit,
            setFit,
          ),
        ),
      ),
    ];
    if (getPosition && setPosition) {
      rows.push(
        row(
          'Position',
          this.add(
            selectField(
              [
                ['center', 'Centre'],
                ['top', 'Haut'],
                ['bottom', 'Bas'],
                ['left', 'Gauche'],
                ['right', 'Droite'],
                ['top left', 'Haut gauche'],
                ['top right', 'Haut droite'],
                ['bottom left', 'Bas gauche'],
                ['bottom right', 'Bas droite'],
              ] as const,
              getPosition as () => 'center',
              setPosition,
            ),
          ),
        ),
      );
    }
    return rows;
  }

  // ------------------------------------------------------------------ style (single or multi)

  private buildStyleSections(ids: readonly string[], style: () => ElementStyle, withText: boolean): HTMLElement[] {
    const s = this.store;
    const g = <K extends keyof ElementStyle>(key: K) => () => style()[key];
    const set = <K extends keyof ElementStyle>(key: K) => (v: ElementStyle[K]) => s.updateStyle(ids, { [key]: v } as Partial<ElementStyle>);
    const sections = [
      section(
        'Apparence',
        row('Fond', this.add(colorField(g('background'), set('background'), { allowTransparent: true }))),
        ...this.backgroundImageRows(g('backgroundImage'), set('backgroundImage'), g('backgroundFit'), set('backgroundFit'), g('backgroundPosition'), set('backgroundPosition')),
        row('Bordure', this.add(numberField(g('borderWidth'), set('borderWidth'), { min: 0, max: 100, suffix: 'px' }))),
        row(
          'Style',
          this.add(
            selectField(
              [
                ['solid', 'Pleine'],
                ['dashed', 'Tirets'],
                ['dotted', 'Pointillés'],
                ['double', 'Double'],
                ['none', 'Aucune'],
              ] as const,
              g('borderStyle'),
              set('borderStyle'),
            ),
          ),
        ),
        row('Couleur', this.add(colorField(g('borderColor'), set('borderColor')))),
        row('Arrondi', this.add(numberField(g('borderRadius'), set('borderRadius'), { min: 0, max: 1000, suffix: 'px' }))),
        row('Marge int.', this.add(numberField(g('padding'), set('padding'), { min: 0, max: 500, suffix: 'px' }))),
        row('Opacité', this.add(numberField(g('opacity'), set('opacity'), { min: 0, max: 1, step: 0.05 }))),
        row('Ombre', this.add(textField(g('shadow'), set('shadow'), { mono: true, placeholder: '0 2px 8px rgba(0,0,0,.3)' }))),
      ),
    ];
    if (withText) {
      sections.push(
        section(
          'Texte',
          row('Police', this.add(textField(g('fontFamily'), set('fontFamily'), { list: FONT_SUGGESTIONS }))),
          row('Taille', this.add(numberField(g('fontSize'), set('fontSize'), { min: 1, max: 500, suffix: 'px' }))),
          row(
            'Graisse',
            this.add(
              selectField(
                [
                  [300, 'Légère'],
                  [400, 'Normale'],
                  [500, 'Moyenne'],
                  [600, 'Semi-grasse'],
                  [700, 'Grasse'],
                  [900, 'Noire'],
                ] as const,
                g('fontWeight'),
                set('fontWeight'),
              ),
            ),
          ),
          row('Couleur', this.add(colorField(g('color'), set('color')))),
          row('', this.add(checkField('Italique', g('italic'), set('italic')))),
          row(
            'Align. H',
            this.add(
              selectField(
                [
                  ['left', 'Gauche'],
                  ['center', 'Centre'],
                  ['right', 'Droite'],
                ] as const,
                g('textAlign'),
                set('textAlign'),
              ),
            ),
          ),
          row(
            'Align. V',
            this.add(
              selectField(
                [
                  ['start', 'Haut'],
                  ['center', 'Milieu'],
                  ['end', 'Bas'],
                ] as const,
                g('verticalAlign'),
                set('verticalAlign'),
              ),
            ),
          ),
        ),
      );
    }
    sections.push(
      section(
        'CSS supplémentaire',
        this.add(textField(g('extraCss'), set('extraCss'), { multiline: true, mono: true, rows: 3, placeholder: 'letter-spacing: 2px;' })).element,
      ),
    );
    return sections;
  }

  // ------------------------------------------------------------------ multi selection

  private buildMulti(selected: UiElement[]): HTMLElement[] {
    const s = this.store;
    const ids = selected.map((e) => e.id);
    const first = ids[0]!;
    const cur = (): UiElement => findElement(s.document, first) ?? selected[0]!;
    const tool = (name: string, title: string, run: () => void): HTMLElement =>
      h('button', { class: 'icon-btn', type: 'button', title, html: icon(name), onclick: run });
    return [
      h('div', { class: 'panel-title' }, h('span', { class: 'type-badge' }, `${selected.length} éléments`)),
      section(
        'Disposition',
        h(
          'div',
          { class: 'prop-buttons' },
          tool('alignLeft', 'Aligner à gauche', () => s.align('left')),
          tool('alignHCenter', 'Centrer horizontalement', () => s.align('hcenter')),
          tool('alignRight', 'Aligner à droite', () => s.align('right')),
          tool('alignTop', 'Aligner en haut', () => s.align('top')),
          tool('alignVCenter', 'Centrer verticalement', () => s.align('vcenter')),
          tool('alignBottom', 'Aligner en bas', () => s.align('bottom')),
          tool('distributeH', 'Répartir horizontalement (3+)', () => s.distribute('horizontal')),
          tool('distributeV', 'Répartir verticalement (3+)', () => s.distribute('vertical')),
          tool('group', 'Grouper dans une boîte (Ctrl+G)', () => s.groupSelection()),
        ),
        h('div', { class: 'panel-hint' }, 'Les modifications de style ci-dessous s’appliquent à tous les éléments sélectionnés.'),
      ),
      ...this.buildStyleSections(ids, () => cur().style, true),
    ];
  }
}

function dataUrlBytes(src: string): number {
  const comma = src.indexOf(',');
  return Math.floor(((src.length - comma - 1) * 3) / 4);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** IPC errors arrive as "Error invoking remote method '…': Error: message". */
function cleanError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
