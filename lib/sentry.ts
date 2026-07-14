/**
 * Sentry bootstrap — Step 10.
 * Keeps @sentry/* optional: wires logger hooks when DSN + native module exist.
 */
import { wireSentryHooks, logger } from './logger';

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    logger.debug('Sentry DSN unset — skipping init');
    return;
  }

  // Soft import path: native Sentry package is optional until EAS build configures it.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional peer
    const Sentry = require('sentry-expo') as {
      init: (opts: { dsn: string; enableInExpoDevelopment?: boolean }) => void;
      Native?: {
        captureException?: (error: unknown) => void;
        addBreadcrumb?: (data: {
          category: string;
          message: string;
          level?: string;
          data?: Record<string, unknown>;
        }) => void;
      };
      captureException?: (error: unknown) => void;
      addBreadcrumb?: (data: {
        category: string;
        message: string;
        level?: string;
        data?: Record<string, unknown>;
      }) => void;
    };

    Sentry.init({ dsn, enableInExpoDevelopment: true });
    wireSentryHooks({
      captureException: (error) => {
        Sentry.Native?.captureException?.(error) ?? Sentry.captureException?.(error);
      },
      addBreadcrumb: (data) => {
        Sentry.Native?.addBreadcrumb?.(data) ?? Sentry.addBreadcrumb?.(data);
      },
    });
    logger.info('Sentry initialized');
  } catch (cause) {
    logger.warn('Sentry package not installed — logger breadcrumbs only', cause);
    wireSentryHooks({
      captureException: (error) => logger.error('sentry.capture', error),
      addBreadcrumb: (data) => logger.debug('sentry.breadcrumb', data),
    });
  }
}
