/**
 * Node-only log sink: one file per application session, old files removed so
 * the folder stays under a file count and a total size.
 */
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { formatRecord, type LogRecord, type LogSink } from '../logging/logger';

export interface FileLogOptions {
  readonly directory: string;
  /** Session files kept (the current one included). */
  readonly maxFiles: number;
  /** Total size budget of the folder, in bytes. */
  readonly maxTotalBytes: number;
  /** A single session stops writing beyond this size. */
  readonly maxFileBytes: number;
}

export const DEFAULT_FILE_LOG_OPTIONS = {
  maxFiles: 30,
  maxTotalBytes: 100 * 1024 * 1024,
  maxFileBytes: 20 * 1024 * 1024,
} as const;

const PREFIX = 'ui-designer-';
const SUFFIX = '.log';

function stamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/** Deletes the oldest session logs until both limits are respected. Returns the deleted file names. */
export function pruneLogs(directory: string, maxFiles: number, maxTotalBytes: number): string[] {
  const files = readdirSync(directory)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX))
    .map((name) => {
      const st = statSync(join(directory, name));
      return { name, size: st.size, time: st.mtimeMs };
    })
    .sort((a, b) => b.time - a.time || b.name.localeCompare(a.name)); // newest first
  const deleted: string[] = [];
  let total = 0;
  files.forEach((file, index) => {
    total += file.size;
    if (index >= maxFiles || total > maxTotalBytes) {
      try {
        unlinkSync(join(directory, file.name));
        deleted.push(file.name);
      } catch {
        // File in use or already gone: ignore.
      }
    }
  });
  return deleted;
}

export class FileLogSink implements LogSink {
  readonly filePath: string;
  private written = 0;
  private capped = false;

  constructor(private readonly options: FileLogOptions, now = new Date()) {
    mkdirSync(options.directory, { recursive: true });
    // Keep room for the new session file.
    pruneLogs(options.directory, Math.max(1, options.maxFiles - 1), options.maxTotalBytes);
    let path = join(options.directory, `${PREFIX}${stamp(now)}${SUFFIX}`);
    for (let n = 2; safeExists(path); n++) path = join(options.directory, `${PREFIX}${stamp(now)}-${n}${SUFFIX}`);
    this.filePath = path;
  }

  write(record: LogRecord): void {
    if (this.capped) return;
    let line = formatRecord(record) + '\n';
    if (this.written + line.length > this.options.maxFileBytes) {
      this.capped = true;
      line = `${formatRecord({ ...record, level: 'warn', message: 'Log file size limit reached, further messages are dropped', data: undefined })}\n`;
    }
    appendFileSync(this.filePath, line, 'utf8');
    this.written += line.length;
  }
}

function safeExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
