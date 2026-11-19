/**
 * Preload script: the only bridge between the sandboxed renderer and the main
 * process. Exposes a small, typed API; no Node access leaks to the page.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type AppInfo, type DesktopApi } from '../infrastructure/electron/ipcContract';

const info = ipcRenderer.sendSync(IPC.appInfo) as AppInfo;

const api: DesktopApi = {
  info,
  openProject: () => ipcRenderer.invoke(IPC.openProject),
  readProject: (path) => ipcRenderer.invoke(IPC.readProject, path),
  saveProject: (path, content, suggestedName) => ipcRenderer.invoke(IPC.saveProject, path, content, suggestedName),
  exportHtml: (content, suggestedName) => ipcRenderer.invoke(IPC.exportHtml, content, suggestedName),
  pickImage: () => ipcRenderer.invoke(IPC.pickImage),
  pickVideo: () => ipcRenderer.invoke(IPC.pickVideo),
  revealFile: (path) => ipcRenderer.send(IPC.revealFile, path),
  publishPreview: (html) => ipcRenderer.invoke(IPC.publishPreview, html),
  confirmUnsaved: (name) => ipcRenderer.invoke(IPC.confirmUnsaved, name),
  showError: (title, message) => ipcRenderer.invoke(IPC.showError, title, message),
  log: (message) => ipcRenderer.send(IPC.log, message),
  setTitleState: (title, dirty) => ipcRenderer.send(IPC.setTitleState, title, dirty),
  confirmClose: () => ipcRenderer.send(IPC.confirmClose),
  openLogsFolder: () => ipcRenderer.send(IPC.openLogsFolder),
  rendererReady: () => ipcRenderer.send(IPC.rendererReady),
  onMenuCommand: (listener) => {
    ipcRenderer.on(IPC.menuCommand, (_event, command: string) => listener(command));
  },
  onOpenFile: (listener) => {
    ipcRenderer.on(IPC.openFile, (_event, path: string) => listener(path));
  },
};

contextBridge.exposeInMainWorld('uiDesigner', api);
