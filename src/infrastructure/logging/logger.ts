/**
 * Logger implementation shared by the main process and the renderer. Messages
 * go to one or more sinks (console, file, IPC to the main process).
 */
import type { LogLevel, Logger } from '../../application/ports';

export interface LogRecord {
  readonly time: Date;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function isLogLevel(v: unknown): v is LogLevel {
  return typeof v === 'string' && (LOG_LEVELS as readonly string[]).includes(v);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Local time "2026-11-19 14:03:22.123". */
export function formatTime(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

function stringifyData(data: unknown): string {
  if (data === undefined) return '';
  if (data instanceof Error) return ` ${data.name}: ${data.message}${data.stack ? '\n' + data.stack : ''}`;
  try {
    const json = JSON.stringify(data);
    // Keep log lines readable: huge payloads (data URLs...) are cut.
    return ' ' + (json.length > 2000 ? json.slice(0, 2000) + '…(truncated)' : json);
  } catch {
    return ' [unserializable data]';
  }
}

/** One log line: "2026-11-19 14:03:22.123 INFO  [scope] message {data}". */
export function formatRecord(record: LogRecord): string {
  const scope = record.scope ? `[${record.scope}] ` : '';
  return `${formatTime(record.time)} ${record.level.toUpperCase().padEnd(5)} ${scope}${record.message}${stringifyData(record.data)}`;
}

export class ConsoleSink implements LogSink {
  write(record: LogRecord): void {
    const line = formatRecord(record);
    if (record.level === 'error') console.error(line);
    else if (record.level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export class SinkLogger implements Logger {
  constructor(
    private readonly sinks: readonly LogSink[],
    private readonly minLevel: LogLevel = 'info',
    private readonly scope = '',
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private emit(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.minLevel)) return;
    const record: LogRecord = { time: this.clock(), level, scope: this.scope, message, data };
    for (const sink of this.sinks) {
      try {
        sink.write(record);
      } catch {
        // A failing sink must never break the application.
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.emit('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.emit('error', message, data);
  }

  child(scope: string): Logger {
    return new SinkLogger(this.sinks, this.minLevel, this.scope ? `${this.scope}/${scope}` : scope, this.clock);
  }
}
