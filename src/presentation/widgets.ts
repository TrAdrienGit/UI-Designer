/** Small UI widgets: context menu, modal dialog, toast notifications. */
import { h } from './dom';
import { icon } from './icons';

export interface MenuEntry {
  readonly label: string;
  readonly shortcut?: string;
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

export type MenuItem = MenuEntry | 'separator';

let openMenu: HTMLElement | null = null;

export function closeContextMenu(): void {
  openMenu?.remove();
  openMenu = null;
}

export function showContextMenu(x: number, y: number, items: readonly MenuItem[]): void {
  closeContextMenu();
  const menu = h(
    'div',
    { class: 'context-menu', role: 'menu' },
    ...items.map((item) =>
      item === 'separator'
        ? h('div', { class: 'menu-sep' })
        : h(
            'button',
            {
              class: 'menu-item',
              type: 'button',
              disabled: item.disabled ?? false,
              onclick: () => {
                closeContextMenu();
                item.run();
              },
            },
            h('span', { class: 'menu-icon', html: item.icon ? icon(item.icon, 15) : '' }),
            h('span', { class: 'menu-label' }, item.label),
            h('span', { class: 'menu-shortcut' }, item.shortcut ?? ''),
          ),
    ),
  );
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 4)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 4)}px`;
  openMenu = menu;
}

window.addEventListener('pointerdown', (e) => {
  if (openMenu && !openMenu.contains(e.target as Node)) closeContextMenu();
});
window.addEventListener('blur', closeContextMenu);

export function showModal(title: string, body: HTMLElement): void {
  const close = (): void => backdrop.remove();
  const backdrop = h(
    'div',
    { class: 'modal-backdrop' },
    h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', type: 'button', title: 'Fermer', onclick: close }, '✕')),
      h('div', { class: 'modal-body' }, body),
    ),
  );
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  document.body.append(backdrop);
  backdrop.querySelector<HTMLElement>('.modal-head button')?.focus();
}

export function toast(message: string, action?: { label: string; run: () => void }, timeoutMs = 4000): void {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div', { id: 'toasts' });
    document.body.append(host);
  }
  const item = h(
    'div',
    { class: 'toast' },
    h('span', {}, message),
    action ? h('button', { class: 'btn', type: 'button', onclick: () => { action.run(); item.remove(); } }, action.label) : null,
  );
  host.append(item);
  setTimeout(() => item.remove(), timeoutMs);
}
