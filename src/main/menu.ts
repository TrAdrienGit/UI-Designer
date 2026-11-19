/**
 * Native application menu. Items only send a command id to the renderer, which
 * owns the keyboard shortcuts (accelerators are displayed, not registered, so
 * text fields keep their native Ctrl+Z / Ctrl+C behaviour).
 */
import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../infrastructure/electron/ipcContract';

export function buildMenu(getWindow: () => BrowserWindow | null, isDev: boolean): Menu {
  const send = (command: string) => () => getWindow()?.webContents.send(IPC.menuCommand, command);
  const item = (label: string, command: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    click: send(command),
    ...(accelerator ? { accelerator, registerAccelerator: false } : {}),
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&Fichier',
      submenu: [
        item('Nouveau', 'file.new', 'Ctrl+N'),
        item('Ouvrir…', 'file.open', 'Ctrl+O'),
        { type: 'separator' },
        item('Enregistrer', 'file.save', 'Ctrl+S'),
        item('Enregistrer sous…', 'file.saveAs', 'Ctrl+Shift+S'),
        { type: 'separator' },
        item('Exporter en HTML…', 'file.export', 'Ctrl+E'),
        { type: 'separator' },
        { label: 'Quitter', role: 'quit' },
      ],
    },
    {
      label: '&Édition',
      submenu: [
        item('Annuler', 'edit.undo', 'Ctrl+Z'),
        item('Rétablir', 'edit.redo', 'Ctrl+Y'),
        { type: 'separator' },
        item('Couper', 'edit.cut', 'Ctrl+X'),
        item('Copier', 'edit.copy', 'Ctrl+C'),
        item('Coller', 'edit.paste', 'Ctrl+V'),
        item('Dupliquer', 'edit.duplicate', 'Ctrl+D'),
        item('Supprimer', 'edit.delete', 'Delete'),
        { type: 'separator' },
        item('Tout sélectionner', 'edit.selectAll', 'Ctrl+A'),
        { type: 'separator' },
        item('Grouper dans une boîte', 'edit.group', 'Ctrl+G'),
        item('Dégrouper', 'edit.ungroup', 'Ctrl+Shift+G'),
        { type: 'separator' },
        item('Premier plan', 'edit.front', 'Ctrl+Shift+]'),
        item('Avancer', 'edit.forward', 'Ctrl+]'),
        item('Reculer', 'edit.backward', 'Ctrl+['),
        item('Arrière-plan', 'edit.back', 'Ctrl+Shift+['),
      ],
    },
    {
      label: '&Affichage',
      submenu: [
        item('Conception', 'view.design', 'F5'),
        item('Aperçu', 'view.preview', 'F6'),
        item('Code', 'view.code', 'F7'),
        { type: 'separator' },
        item('Zoom avant', 'view.zoomIn', 'Ctrl+='),
        item('Zoom arrière', 'view.zoomOut', 'Ctrl+-'),
        item('Taille réelle', 'view.zoom100', 'Ctrl+0'),
        item('Ajuster à la fenêtre', 'view.zoomFit', 'Ctrl+B'),
        { type: 'separator' },
        item('Afficher la grille', 'view.grid', "Ctrl+'"),
        item('Aimanter à la grille', 'view.snap', 'Ctrl+Shift+\''),
        ...(isDev ? [{ type: 'separator' } as const, { label: 'Outils de développement', role: 'toggleDevTools' } as const] : []),
      ],
    },
    {
      label: '&Aide',
      submenu: [
        item('Raccourcis clavier', 'help.shortcuts', 'F1'),
        item('Ouvrir le dossier des logs', 'help.logs'),
        { type: 'separator' },
        item('À propos', 'help.about'),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
