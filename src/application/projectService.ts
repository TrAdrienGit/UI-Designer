/**
 * File use cases: new, open, save, save as, export. Coordinates the store with
 * the host gateways and the serializer / exporter.
 */
import { createEmptyDocument } from '../domain/model';
import { slugify } from '../domain/html';
import type { EditorStore } from './editorStore';
import type { DocumentExporter, DocumentSerializer, FileGateway, Logger } from './ports';

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export interface DialogGateway {
  /** Asked before losing unsaved changes. */
  confirmUnsaved(documentName: string): Promise<UnsavedChoice>;
  showError(title: string, message: string): Promise<void>;
}

export class ProjectService {
  constructor(
    private readonly store: EditorStore,
    private readonly files: FileGateway,
    private readonly dialogs: DialogGateway,
    private readonly serializer: DocumentSerializer,
    private readonly exporter: DocumentExporter,
    private readonly log: Logger,
  ) {}

  /** Returns false when the user cancelled (unsaved changes kept). */
  async ensureSaved(): Promise<boolean> {
    if (!this.store.getState().dirty) return true;
    const choice = await this.dialogs.confirmUnsaved(this.store.document.name);
    if (choice === 'cancel') return false;
    if (choice === 'save') return this.save();
    return true;
  }

  async newDocument(): Promise<void> {
    if (!(await this.ensureSaved())) return;
    this.store.loadDocument(createEmptyDocument(), null);
  }

  async open(): Promise<void> {
    if (!(await this.ensureSaved())) return;
    try {
      const file = await this.files.openProject();
      if (file) this.loadFile(file.path, file.content);
    } catch (err) {
      await this.fail('Impossible d’ouvrir le projet', err);
    }
  }

  async openPath(path: string): Promise<void> {
    if (!(await this.ensureSaved())) return;
    try {
      const file = await this.files.readProject(path);
      this.loadFile(file.path, file.content);
    } catch (err) {
      await this.fail('Impossible d’ouvrir le projet', err);
    }
  }

  private loadFile(path: string, content: string): void {
    const doc = this.serializer.parse(content);
    this.store.loadDocument(doc, path);
    this.log.info('Project opened', { path });
  }

  async save(): Promise<boolean> {
    return this.saveTo(this.store.getState().filePath);
  }

  async saveAs(): Promise<boolean> {
    return this.saveTo(null);
  }

  private async saveTo(path: string | null): Promise<boolean> {
    try {
      const doc = this.store.document;
      const saved = await this.files.saveProject(path, this.serializer.serialize(doc), `${slugify(doc.name)}.uidesign`);
      if (!saved) return false;
      this.store.markSaved(saved);
      this.log.info('Project saved', { path: saved });
      return true;
    } catch (err) {
      await this.fail('Impossible d’enregistrer le projet', err);
      return false;
    }
  }

  async exportHtml(): Promise<string | null> {
    try {
      const doc = this.store.document;
      const path = await this.files.exportHtml(this.exporter.exportHtml(doc), `${slugify(doc.name)}.html`);
      if (path) this.log.info('HTML exported', { path });
      return path;
    } catch (err) {
      await this.fail('Impossible d’exporter le HTML', err);
      return null;
    }
  }

  private async fail(title: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    this.log.error(title, { error: message });
    await this.dialogs.showError(title, message);
  }
}
