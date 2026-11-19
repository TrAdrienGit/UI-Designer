/**
 * Snapshot based undo/redo. The document is immutable, so storing whole
 * snapshots is cheap (unchanged subtrees are shared between snapshots).
 */
export interface HistoryEntry<T> {
  readonly label: string;
  readonly state: T;
}

export class History<T> {
  private past: HistoryEntry<T>[] = [];
  private future: HistoryEntry<T>[] = [];
  private lastMergeKey: string | null = null;
  private lastPushAt = 0;

  constructor(
    private readonly limit = 200,
    private readonly mergeWindowMs = 1000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Records the state *before* a change. When `mergeKey` equals the key of the
   * previous push made within the merge window, the change is merged into the
   * previous entry (typing in a field produces a single undo step).
   */
  push(label: string, before: T, mergeKey?: string): void {
    const time = this.now();
    this.future = [];
    if (mergeKey && mergeKey === this.lastMergeKey && time - this.lastPushAt <= this.mergeWindowMs) {
      this.lastPushAt = time;
      return;
    }
    this.past.push({ label, state: before });
    if (this.past.length > this.limit) this.past.shift();
    this.lastMergeKey = mergeKey ?? null;
    this.lastPushAt = time;
  }

  /** Returns the state to restore, or null when there is nothing to undo. */
  undo(current: T): HistoryEntry<T> | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push({ label: entry.label, state: current });
    this.lastMergeKey = null;
    return entry;
  }

  redo(current: T): HistoryEntry<T> | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push({ label: entry.label, state: current });
    this.lastMergeKey = null;
    return entry;
  }

  /** Breaks merging so the next push creates a new entry. */
  seal(): void {
    this.lastMergeKey = null;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastMergeKey = null;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string | null {
    return this.past.at(-1)?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.future.at(-1)?.label ?? null;
  }
}
