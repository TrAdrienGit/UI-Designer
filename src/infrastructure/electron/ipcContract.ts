/**
 * Contract between the Electron main process and the renderer. The preload
 * script exposes `DesktopApi` as `window.uiDesigner`; channel names live here so
 * both sides stay in sync.
 */
import type { LogLevel, OpenedFile } from '../../application/ports';
import type { UnsavedChoice } from '../../application/projectService';

export const IPC = {
  appInfo: 'app:info',
  openProject: 'file:open-project',
  readProject: 'file:read-project',
  saveProject: 'file:save-project',
  exportHtml: 'file:export-html',
  pickImage: 'file:pick-image',
  pickVideo: 'file:pick-video',
  revealFile: 'file:reveal',
  publishPreview: 'preview:publish',
  confirmUnsaved: 'dialog:confirm-unsaved',
  showError: 'dialog:error',
  log: 'log:write',
  setTitleState: 'window:title-state',
  confirmClose: 'window:confirm-close',
  openLogsFolder: 'app:open-logs',
  rendererReady: 'app:renderer-ready',
  menuCommand: 'menu:command',
  openFile: 'app:open-file',
} as const;

export const PREVIEW_SCHEME = 'uidpreview';

export interface AppInfo {
  readonly version: string;
  readonly platform: string;
  readonly logsDirectory: string;
}

export interface LogMessage {
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface DesktopApi {
  readonly info: AppInfo;
  openProject(): Promise<OpenedFile | null>;
  readProject(path: string): Promise<OpenedFile>;
  saveProject(path: string | null, content: string, suggestedName: string): Promise<string | null>;
  exportHtml(content: string, suggestedName: string): Promise<string | null>;
  pickImage(): Promise<string | null>;
  pickVideo(): Promise<string | null>;
  revealFile(path: string): void;
  publishPreview(html: string): Promise<string>;
  confirmUnsaved(documentName: string): Promise<UnsavedChoice>;
  showError(title: string, message: string): Promise<void>;
  log(message: LogMessage): void;
  /** Keeps the window title and the "unsaved changes" flag of the main process up to date. */
  setTitleState(title: string, dirty: boolean): void;
  /** Called after the renderer handled a close request (changes saved or discarded). */
  confirmClose(): void;
  openLogsFolder(): void;
  /** Signals that the renderer can receive commands (pending file opens are sent then). */
  rendererReady(): void;
  onMenuCommand(listener: (command: string) => void): void;
  onOpenFile(listener: (path: string) => void): void;
}
