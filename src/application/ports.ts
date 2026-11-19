/**
 * Ports: interfaces the application layer depends on. Infrastructure provides
 * the implementations (Electron bridge, browser fallback, Node file system...).
 */
import type { UiDocument } from '../domain/model';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  /** Logger whose messages are prefixed by a scope ("[store] ..."). */
  child(scope: string): Logger;
}

/** Converts documents to and from the project file format (.uidesign). */
export interface DocumentSerializer {
  serialize(doc: UiDocument): string;
  /** Throws a `ProjectFormatError` when the text is not a valid project. */
  parse(text: string): UiDocument;
}

/** Produces the standalone HTML export of a document. */
export interface DocumentExporter {
  exportHtml(doc: UiDocument): string;
}

export interface OpenedFile {
  readonly path: string;
  readonly content: string;
}

/** Host-specific file access (native dialogs in Electron, downloads in a browser). */
export interface FileGateway {
  /** Lets the user pick a project to open. Null when cancelled. */
  openProject(): Promise<OpenedFile | null>;
  /** Reads a project from a known path (recent files, command line). */
  readProject(path: string): Promise<OpenedFile>;
  /** Writes a project. Asks for a destination when `path` is null. Returns the saved path or null if cancelled. */
  saveProject(path: string | null, content: string, suggestedName: string): Promise<string | null>;
  /** Asks for a destination and writes the HTML export. Returns the path or null if cancelled. */
  exportHtml(content: string, suggestedName: string): Promise<string | null>;
  /** Lets the user pick an image and returns it as a data URL (so exports stay single-file). */
  pickImage(): Promise<string | null>;
}

/** Shows exported HTML in the live preview. Returns the URL the preview frame should load. */
export interface PreviewGateway {
  publish(html: string): Promise<string>;
}
