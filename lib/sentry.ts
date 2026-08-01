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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');

    Sentry.init({ 
      dsn, 
      enabled: !__DEV__, // Usually Sentry is disabled in local dev to avoid noise
      tracesSampleRate: 1.0,
    });
    wireSentryHooks({
      captureException: (error) => {
        Sentry.captureException(error);
      },
      addBreadcrumb: (data) => {
        Sentry.addBreadcrumb(data);
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
