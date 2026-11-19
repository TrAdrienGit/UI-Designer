/**
 * Renderer-side adapters: implement the application ports on top of the
 * preload API (Electron), with a browser fallback used when the renderer is
 * opened in a plain browser during development.
 */
import type { FileGateway, LogLevel, OpenedFile, PreviewGateway } from '../../application/ports';
import type { DialogGateway, UnsavedChoice } from '../../application/projectService';
import type { DesktopApi } from '../electron/ipcContract';
import type { LogRecord, LogSink } from '../logging/logger';

export interface HostGateways {
  readonly files: FileGateway;
  readonly dialogs: DialogGateway;
  readonly preview: PreviewGateway;
  readonly logSink: LogSink;
  readonly version: string;
  readonly isDesktop: boolean;
  readonly desktop: DesktopApi | null;
}

function serializableData(data: unknown): unknown {
  if (data instanceof Error) return { name: data.name, message: data.message, stack: data.stack };
  try {
    return data === undefined ? undefined : JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

export function createDesktopGateways(api: DesktopApi): HostGateways {
  return {
    version: api.info.version,
    isDesktop: true,
    desktop: api,
    files: {
      openProject: () => api.openProject(),
      readProject: (path) => api.readProject(path),
      saveProject: (path, content, name) => api.saveProject(path, content, name),
      exportHtml: (content, name) => api.exportHtml(content, name),
      pickImage: () => api.pickImage(),
    },
    dialogs: {
      confirmUnsaved: (name) => api.confirmUnsaved(name),
      showError: (title, message) => api.showError(title, message),
    },
    preview: { publish: (html) => api.publishPreview(html) },
    logSink: {
      write(record: LogRecord): void {
        api.log({ level: record.level, scope: record.scope, message: record.message, data: serializableData(record.data) });
      },
    },
  };
}

/** Plain-browser implementation (development only): downloads instead of native dialogs. */
export function createBrowserGateways(): HostGateways {
  const pickFile = (accept: string): Promise<File | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  const download = (content: string, name: string, type: string): string => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name;
  };
  let lastPreview: string | null = null;
  return {
    version: 'browser-dev',
    isDesktop: false,
    desktop: null,
    files: {
      async openProject(): Promise<OpenedFile | null> {
        const file = await pickFile('.uidesign,application/json');
        return file ? { path: file.name, content: await file.text() } : null;
      },
      async readProject(path: string): Promise<OpenedFile> {
        throw new Error(`Lecture directe indisponible dans le navigateur : ${path}`);
      },
      async saveProject(_path, content, name) {
        return download(content, name, 'application/json');
      },
      async exportHtml(content, name) {
        return download(content, name, 'text/html');
      },
      async pickImage() {
        const file = await pickFile('image/*');
        if (!file) return null;
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      },
    },
    dialogs: {
      async confirmUnsaved(name): Promise<UnsavedChoice> {
        return window.confirm(`Abandonner les modifications de « ${name} » ?`) ? 'discard' : 'cancel';
      },
      async showError(title, message) {
        window.alert(`${title}\n\n${message}`);
      },
    },
    preview: {
      async publish(html) {
        if (lastPreview) URL.revokeObjectURL(lastPreview);
        lastPreview = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        return lastPreview;
      },
    },
    logSink: {
      write(record: LogRecord): void {
        const level: LogLevel = record.level;
        console[level === 'debug' ? 'log' : level](`[${record.scope}] ${record.message}`, record.data ?? '');
      },
    },
  };
}
