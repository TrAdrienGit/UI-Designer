import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatRecord, SinkLogger, type LogRecord, type LogSink } from '../../src/infrastructure/logging/logger';
import { FileLogSink, pruneLogs } from '../../src/infrastructure/node/fileLogSink';

class MemorySink implements LogSink {
  records: LogRecord[] = [];
  write(record: LogRecord): void {
    this.records.push(record);
  }
}

const fixedClock = () => new Date(2026, 10, 19, 14, 3, 22, 7);

describe('SinkLogger', () => {
  it('filters by level and scopes children', () => {
    const sink = new MemorySink();
    const log = new SinkLogger([sink], 'info', '', fixedClock);
    log.debug('hidden');
    log.child('store').child('history').warn('kept', { n: 1 });
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ level: 'warn', scope: 'store/history', message: 'kept', data: { n: 1 } });
  });

  it('never throws when a sink fails', () => {
    const log = new SinkLogger([{ write: () => { throw new Error('disk full'); } }], 'debug');
    expect(() => log.error('x')).not.toThrow();
  });

  it('formats records on one line and truncates big payloads', () => {
    const line = formatRecord({ time: fixedClock(), level: 'info', scope: 'ui', message: 'Hello', data: { a: 'x'.repeat(3000) } });
    expect(line.startsWith('2026-11-19 14:03:22.007 INFO  [ui] Hello {"a":"xxx')).toBe(true);
    expect(line).toContain('…(truncated)');
    const err = formatRecord({ time: fixedClock(), level: 'error', scope: '', message: 'Boom', data: new Error('bad') });
    expect(err).toContain('ERROR Boom Error: bad');
  });
});

describe('FileLogSink', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('writes one file per session', () => {
    dir = mkdtempSync(join(tmpdir(), 'uid-logs-'));
    const sink = new FileLogSink({ directory: dir, maxFiles: 5, maxTotalBytes: 1e6, maxFileBytes: 1e6 }, fixedClock());
    new SinkLogger([sink], 'debug', 'main', fixedClock).info('started');
    expect(sink.filePath.endsWith('ui-designer-2026-11-19_14-03-22.log')).toBe(true);
    expect(readFileSync(sink.filePath, 'utf8')).toBe('2026-11-19 14:03:22.007 INFO  [main] started\n');
    const second = new FileLogSink({ directory: dir, maxFiles: 5, maxTotalBytes: 1e6, maxFileBytes: 1e6 }, fixedClock());
    second.write({ time: fixedClock(), level: 'info', scope: '', message: 'x' });
    expect(second.filePath).not.toBe(sink.filePath);
  });

  it('stops writing past the size limit', () => {
    dir = mkdtempSync(join(tmpdir(), 'uid-logs-'));
    const sink = new FileLogSink({ directory: dir, maxFiles: 5, maxTotalBytes: 1e6, maxFileBytes: 200 }, fixedClock());
    for (let i = 0; i < 20; i++) sink.write({ time: fixedClock(), level: 'info', scope: '', message: `message number ${i}` });
    const content = readFileSync(sink.filePath, 'utf8');
    expect(content).toContain('Log file size limit reached');
    expect(content.split('\n').filter(Boolean).length).toBeLessThan(8);
  });

  it('prunes the oldest files by count and total size', () => {
    dir = mkdtempSync(join(tmpdir(), 'uid-logs-'));
    for (let i = 1; i <= 5; i++) {
      const file = join(dir, `ui-designer-2026-01-0${i}_00-00-00.log`);
      writeFileSync(file, 'x'.repeat(100));
      utimesSync(file, i * 1000, i * 1000);
    }
    writeFileSync(join(dir, 'other.txt'), 'keep me');
    expect(pruneLogs(dir, 3, 1e6).sort()).toEqual(['ui-designer-2026-01-01_00-00-00.log', 'ui-designer-2026-01-02_00-00-00.log']);
    expect(pruneLogs(dir, 10, 250)).toEqual(['ui-designer-2026-01-03_00-00-00.log']);
    expect(readdirSync(dir).sort()).toEqual(['other.txt', 'ui-designer-2026-01-04_00-00-00.log', 'ui-designer-2026-01-05_00-00-00.log']);
  });
});
