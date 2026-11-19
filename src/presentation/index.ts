/**
 * Renderer entry point and composition root: picks the host adapters
 * (Electron preload API or browser fallback), builds the logger, the store,
 * the services and the UI.
 */
import { EditorStore } from '../application/editorStore';
import { ProjectService } from '../application/projectService';
import { createBrowserGateways, createDesktopGateways } from '../infrastructure/browser/desktopGateways';
import type { DesktopApi } from '../infrastructure/electron/ipcContract';
import { HtmlExporter } from '../infrastructure/export/htmlExporter';
import { SinkLogger } from '../infrastructure/logging/logger';
import { JsonProjectSerializer } from '../infrastructure/serialization/projectSerializer';
import { App } from './app';

declare const __DEV__: boolean;
declare global {
  interface Window {
    uiDesigner?: DesktopApi;
  }
}

function bootstrap(): void {
  const host = window.uiDesigner ? createDesktopGateways(window.uiDesigner) : createBrowserGateways();
  const root = new SinkLogger([host.logSink], __DEV__ ? 'debug' : 'info');
  const log = root.child('ui');

  window.addEventListener('error', (e) => log.error('Uncaught error', { message: e.message, source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => log.error('Unhandled rejection', e.reason instanceof Error ? e.reason : { reason: String(e.reason) }));

  const store = new EditorStore(root.child('store'));
  const exporter = new HtmlExporter({ appVersion: host.version });
  const project = new ProjectService(store, host.files, host.dialogs, new JsonProjectSerializer(), exporter, root.child('project'));

  new App({ store, project, exporter, host, log });
  log.info('Renderer started', { desktop: host.isDesktop, version: host.version });
}

bootstrap();
