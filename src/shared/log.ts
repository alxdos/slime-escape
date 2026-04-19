export type LogMeta = Record<string, unknown>;

export type Log = Readonly<{
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
}>;

type LogSource = 'main' | 'sim' | 'unknown';

function detectSource(): LogSource {
  if (typeof globalThis === 'undefined') {
    return 'unknown';
  }
  const scope = globalThis as Record<string, unknown>;
  if ('document' in scope) {
    return 'main';
  }
  if ('importScripts' in scope) {
    return 'sim';
  }
  return 'unknown';
}

const PREFIX = `[${detectSource()}]`;

type ConsoleMethod = (...args: unknown[]) => void;

function emit(method: ConsoleMethod, msg: string, meta: LogMeta | undefined): void {
  try {
    if (meta === undefined) {
      method(PREFIX, msg);
    } else {
      method(PREFIX, msg, meta);
    }
  } catch {
    // log API must never throw (design/logging.md)
  }
}

export const log: Log = {
  info(msg, meta) {
    emit(console.info.bind(console), msg, meta);
  },
  warn(msg, meta) {
    emit(console.warn.bind(console), msg, meta);
  },
  error(msg, meta) {
    emit(console.error.bind(console), msg, meta);
  }
};
