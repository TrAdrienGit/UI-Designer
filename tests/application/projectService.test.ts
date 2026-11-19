import { describe, expect, it, vi } from 'vitest';
import { EditorStore } from '../../src/application/editorStore';
import type { FileGateway } from '../../src/application/ports';
import { ProjectService, type DialogGateway } from '../../src/application/projectService';
import { HtmlExporter } from '../../src/infrastructure/export/htmlExporter';
import { JsonProjectSerializer } from '../../src/infrastructure/serialization/projectSerializer';
import { sequentialIds, silentLogger } from '../helpers';

function setup(choice: 'save' | 'discard' | 'cancel' = 'discard') {
  const store = new EditorStore(silentLogger, sequentialIds());
  const written: Record<string, string> = {};
  const files: FileGateway = {
    openProject: vi.fn(async () => ({ path: 'in.uidesign', content: new JsonProjectSerializer().serialize({ ...store.document, name: 'Opened' }) })),
    readProject: vi.fn(async (path: string) => ({ path, content: '{bad json' })),
    saveProject: vi.fn(async (path: string | null, content: string, suggested: string) => {
      const target = path ?? `chosen/${suggested}`;
      written[target] = content;
      return target;
    }),
    exportHtml: vi.fn(async (content: string, suggested: string) => {
      written[suggested] = content;
      return suggested;
    }),
    pickImage: vi.fn(async () => null),
    pickVideo: vi.fn(async () => null),
  };
  const dialogs: DialogGateway = {
    confirmUnsaved: vi.fn(async () => choice),
    showError: vi.fn(async () => {}),
  };
  const service = new ProjectService(store, files, dialogs, new JsonProjectSerializer(), new HtmlExporter(), silentLogger);
  return { store, files, dialogs, service, written };
}

describe('ProjectService', () => {
  it('saves as, then saves to the same path', async () => {
    const { store, service, written } = setup();
    store.renameDocument('Mon HUD');
    expect(await service.save()).toBe(true);
    expect(Object.keys(written)).toEqual(['chosen/mon-hud.uidesign']);
    expect(store.getState()).toMatchObject({ dirty: false, filePath: 'chosen/mon-hud.uidesign' });
    store.addElement('button', { x: 0, y: 0, width: 10, height: 10 });
    await service.save();
    expect(JSON.parse(written['chosen/mon-hud.uidesign']!).elements).toHaveLength(1);
  });

  it('asks before discarding unsaved changes and respects cancel', async () => {
    const { store, service, dialogs, files } = setup('cancel');
    store.addElement('button', { x: 0, y: 0, width: 10, height: 10 });
    await service.open();
    expect(dialogs.confirmUnsaved).toHaveBeenCalled();
    expect(files.openProject).not.toHaveBeenCalled();
    expect(store.document.elements).toHaveLength(1);
  });

  it('opens a project after discarding', async () => {
    const { store, service } = setup('discard');
    store.addElement('button', { x: 0, y: 0, width: 10, height: 10 });
    await service.open();
    expect(store.document.name).toBe('Opened');
    expect(store.getState().filePath).toBe('in.uidesign');
  });

  it('reports invalid files without touching the document', async () => {
    const { store, service, dialogs } = setup();
    await service.openPath('broken.uidesign');
    expect(dialogs.showError).toHaveBeenCalled();
    expect(store.getState().filePath).toBeNull();
  });

  it('exports HTML with a slug file name', async () => {
    const { store, service, written } = setup();
    store.renameDocument('Écran Titre');
    expect(await service.exportHtml()).toBe('ecran-titre.html');
    expect(written['ecran-titre.html']).toContain('<title>Écran Titre</title>');
  });
});
