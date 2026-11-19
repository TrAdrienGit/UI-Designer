/**
 * Electron main process: composition root of the desktop shell. Creates the
 * window, the logger, the preview protocol and the IPC handlers.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, shell } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { LogLevel } from '../application/ports';
import { IPC, PREVIEW_SCHEME, type AppInfo, type LogMessage } from '../infrastructure/electron/ipcContract';
import { ConsoleSink, isLogLevel, SinkLogger, type LogSink } from '../infrastructure/logging/logger';
import { DEFAULT_FILE_LOG_OPTIONS, FileLogSink } from '../infrastructure/node/fileLogSink';
import { buildMenu } from './menu';

declare const __DEV__: boolean;

const PROJECT_EXT = 'uidesign';
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
};
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// ------------------------------------------------------------------ logging

const logsDirectory = app.isPackaged ? join(app.getPath('userData'), 'logs') : join(app.getAppPath(), 'logs');
const envLevel = process.env['UI_DESIGNER_LOG_LEVEL'];
const minLevel: LogLevel = isLogLevel(envLevel) ? envLevel : __DEV__ ? 'debug' : 'info';
const sinks: LogSink[] = [new ConsoleSink()];
try {
  sinks.push(new FileLogSink({ directory: logsDirectory, ...DEFAULT_FILE_LOG_OPTIONS }));
} catch (err) {
  console.error('File logging unavailable', err);
}
const rootLog = new SinkLogger(sinks, minLevel);
const log = rootLog.child('main');
const rendererLog = rootLog.child('renderer');

process.on('uncaughtException', (err) => log.error('Uncaught exception', err));
process.on('unhandledRejection', (reason) => log.error('Unhandled rejection', reason instanceof Error ? reason : { reason: String(reason) }));

log.info(`UI Designer ${app.getVersion()} starting`, {
  electron: process.versions.electron,
  platform: process.platform,
  packaged: app.isPackaged,
  logLevel: minLevel,
});

// ------------------------------------------------------------------ single instance & file opening

if (!app.requestSingleInstanceLock()) {
  // Another window is already running: it receives our arguments through 'second-instance'.
  app.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let pendingOpen: string | null = findProjectArg(process.argv);
let dirty = false;
let forceClose = false;
let previewHtml = '<!DOCTYPE html><html><body></body></html>';

function findProjectArg(argv: readonly string[]): string | null {
  return argv.slice(1).find((a) => a.toLowerCase().endsWith(`.${PROJECT_EXT}`)) ?? null;
}

function requestOpen(path: string): void {
  if (mainWindow && rendererReady) mainWindow.webContents.send(IPC.openFile, path);
  else pendingOpen = path;
}

app.on('second-instance', (_event, argv) => {
  const file = findProjectArg(argv);
  if (file) requestOpen(file);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ------------------------------------------------------------------ preview protocol

protocol.registerSchemesAsPrivileged([{ scheme: PREVIEW_SCHEME, privileges: { standard: true, secure: true } }]);

// ------------------------------------------------------------------ window

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1f24',
    title: 'UI Designer',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(buildMenu(() => mainWindow, __DEV__ || !app.isPackaged));
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });
  mainWindow.on('close', (event) => {
    if (dirty && !forceClose) {
      event.preventDefault();
      mainWindow?.webContents.send(IPC.menuCommand, 'app.closeRequest');
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => log.error('Renderer process gone', details));
  // Links never open inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

// ------------------------------------------------------------------ IPC

function registerIpc(): void {
  ipcMain.on(IPC.appInfo, (event) => {
    const info: AppInfo = { version: app.getVersion(), platform: process.platform, logsDirectory };
    event.returnValue = info;
  });

  ipcMain.on(IPC.log, (_event, msg: LogMessage) => {
    if (!msg || !isLogLevel(msg.level) || typeof msg.message !== 'string') return;
    const target = typeof msg.scope === 'string' && msg.scope ? rendererLog.child(msg.scope) : rendererLog;
    target[msg.level](msg.message, msg.data);
  });

  ipcMain.on(IPC.rendererReady, () => {
    rendererReady = true;
    log.debug('Renderer ready');
    if (pendingOpen) {
      mainWindow?.webContents.send(IPC.openFile, pendingOpen);
      pendingOpen = null;
    }
  });

  ipcMain.on(IPC.setTitleState, (_event, title: unknown, isDirty: unknown) => {
    dirty = isDirty === true;
    if (typeof title === 'string') mainWindow?.setTitle(title);
    mainWindow?.setDocumentEdited(dirty);
  });

  ipcMain.on(IPC.confirmClose, () => {
    forceClose = true;
    mainWindow?.close();
  });

  ipcMain.on(IPC.openLogsFolder, () => void shell.openPath(logsDirectory));

  ipcMain.on(IPC.revealFile, (_event, path: unknown) => {
    if (typeof path === 'string') shell.showItemInFolder(path);
  });

  ipcMain.handle(IPC.openProject, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Ouvrir un projet',
      filters: [{ name: 'Projet UI Designer', extensions: [PROJECT_EXT] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const path = result.filePaths[0];
    return { path, content: await readFile(path, 'utf8') };
  });

  ipcMain.handle(IPC.readProject, async (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('Invalid path');
    return { path, content: await readFile(path, 'utf8') };
  });

  ipcMain.handle(IPC.saveProject, async (_event, path: unknown, content: unknown, suggestedName: unknown) => {
    if (typeof content !== 'string') throw new Error('Invalid content');
    let target = typeof path === 'string' && path ? path : null;
    if (!target) {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Enregistrer le projet',
        defaultPath: typeof suggestedName === 'string' ? suggestedName : `projet.${PROJECT_EXT}`,
        filters: [{ name: 'Projet UI Designer', extensions: [PROJECT_EXT] }],
      });
      if (result.canceled || !result.filePath) return null;
      target = result.filePath;
    }
    await writeFile(target, content, 'utf8');
    return target;
  });

  ipcMain.handle(IPC.exportHtml, async (_event, content: unknown, suggestedName: unknown) => {
    if (typeof content !== 'string') throw new Error('Invalid content');
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Exporter en HTML',
      defaultPath: typeof suggestedName === 'string' ? suggestedName : 'page.html',
      filters: [{ name: 'Page HTML', extensions: ['html'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });

  ipcMain.handle(IPC.pickImage, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choisir une image',
      filters: [{ name: 'Images', extensions: Object.keys(IMAGE_MIME).map((e) => e.slice(1)) }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const path = result.filePaths[0];
    const mime = IMAGE_MIME[extname(path).toLowerCase()];
    if (!mime) throw new Error('Format d’image non supporté');
    const info = await stat(path);
    if (info.size > MAX_IMAGE_BYTES) throw new Error('Image trop lourde (15 Mo maximum)');
    const data = await readFile(path);
    log.info('Image embedded', { path, bytes: info.size });
    return `data:${mime};base64,${data.toString('base64')}`;
  });

  let previewRevision = 0;
  ipcMain.handle(IPC.publishPreview, (_event, html: unknown) => {
    if (typeof html === 'string') previewHtml = html;
    previewRevision++;
    return `${PREVIEW_SCHEME}://preview/index.html?rev=${previewRevision}`;
  });

  ipcMain.handle(IPC.confirmUnsaved, async (_event, name: unknown) => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Modifications non enregistrées',
      message: `Enregistrer les modifications de « ${typeof name === 'string' ? name : 'Sans titre'} » ?`,
      detail: 'Vos modifications seront perdues si vous ne les enregistrez pas.',
      buttons: ['Enregistrer', 'Ne pas enregistrer', 'Annuler'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    return (['save', 'discard', 'cancel'] as const)[result.response];
  });

  ipcMain.handle(IPC.showError, async (_event, title: unknown, message: unknown) => {
    await dialog.showMessageBox(mainWindow!, {
      type: 'error',
      title: String(title),
      message: String(title),
      detail: String(message),
    });
  });
}

// ------------------------------------------------------------------ lifecycle

void app.whenReady().then(() => {
  protocol.handle(PREVIEW_SCHEME, () => new Response(previewHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
  registerIpc();
  createWindow();
  log.info('Window created');
});

app.on('window-all-closed', () => {
  log.info('All windows closed, quitting');
  app.quit();
});

app.on('open-file', (event, path) => {
  event.preventDefault();
  requestOpen(path);
});
