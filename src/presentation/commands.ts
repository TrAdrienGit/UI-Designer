/**
 * Command registry: one id per user action, shared by the native menu,
 * the toolbar, the context menu and the keyboard shortcuts.
 */
import { isTyping } from './dom';

export interface Command {
  readonly id: string;
  readonly label: string;
  /** Shortcuts like "Ctrl+Shift+S", "Delete", "F5". The first one is displayed. */
  readonly keys?: readonly string[];
  readonly run: () => void | Promise<void>;
  /** Shortcut also active while typing in a field (file commands). */
  readonly global?: boolean;
}

/** Normalized key combo of a keyboard event ("Ctrl+Shift+Z"). */
export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  // Layout independent keys for the zoom / ordering shortcuts.
  if (e.code === 'Equal' || e.code === 'NumpadAdd') key = '=';
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') key = '-';
  if (e.code === 'Digit0' || e.code === 'Numpad0') key = '0';
  if (e.code === 'BracketLeft') key = '[';
  if (e.code === 'BracketRight') key = ']';
  if (e.code === 'Quote' || e.code === 'Backquote') key = "'";
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return parts.join('+');
  parts.push(key);
  return parts.join('+');
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly byKey = new Map<string, Command>();

  constructor(private readonly onError: (id: string, err: unknown) => void) {}

  register(command: Command): void {
    this.commands.set(command.id, command);
    for (const key of command.keys ?? []) this.byKey.set(key.toUpperCase(), command);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  run(id: string): void {
    const command = this.commands.get(id);
    if (!command) return;
    try {
      const result = command.run();
      if (result instanceof Promise) result.catch((err) => this.onError(id, err));
    } catch (err) {
      this.onError(id, err);
    }
  }

  /** Runs the command bound to a key event. Returns true when handled. */
  handleKey(e: KeyboardEvent): boolean {
    const command = this.byKey.get(comboOf(e).toUpperCase());
    if (!command) return false;
    if (isTyping(e.target) && !command.global) return false;
    e.preventDefault();
    this.run(command.id);
    return true;
  }

  shortcutOf(id: string): string | undefined {
    return this.commands.get(id)?.keys?.[0];
  }
}
