type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

/** Soft Sentry hook — wired in Step 10; safe no-op until then. */
let captureException: ((error: unknown) => void) | null = null;
let addBreadcrumb:
  | ((data: { category: string; message: string; level?: string; data?: Record<string, unknown> }) => void)
  | null = null;

export function wireSentryHooks(hooks: {
  captureException: (error: unknown) => void;
  addBreadcrumb: (data: {
    category: string;
    message: string;
    level?: string;
    data?: Record<string, unknown>;
  }) => void;
}): void {
  captureException = hooks.captureException;
  addBreadcrumb = hooks.addBreadcrumb;
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  if (isDev) {
    // Dev-only; production routes through Sentry hooks (Step 10).
    // eslint-disable-next-line no-console -- intentional logger sink in development
    const fn = console[level] ?? console.warn;
    if (meta !== undefined) {
      fn(`[${level}] ${message}`, meta);
    } else {
      fn(`[${level}] ${message}`);
    }
    return;
  }

  if (level === 'error' || level === 'warn') {
    addBreadcrumb?.({
      category: 'app',
      message,
      level: level === 'error' ? 'error' : 'warning',
      data: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : { meta },
    });
  }

  if (level === 'error') {
    captureException?.(meta instanceof Error ? meta : new Error(message));
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
