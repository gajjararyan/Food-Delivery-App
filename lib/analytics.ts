/**
 * Firebase Analytics facade — soft-wired in Step 10.
 * No Firebase SDK required for MVP compile; logs in dev, no-ops in prod until configured.
 */
import { logger } from './logger';

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

let trackImpl: ((name: string, params?: AnalyticsParams) => void) | null = null;

export function wireAnalytics(track: (name: string, params?: AnalyticsParams) => void): void {
  trackImpl = track;
}

export function trackEvent(name: string, params?: AnalyticsParams): void {
  if (trackImpl) {
    trackImpl(name, params);
    return;
  }
  logger.debug(`analytics:${name}`, params);
}

export const AnalyticsEvents = {
  viewDiscover: 'view_discover',
  addToCart: 'add_to_cart',
  beginCheckout: 'begin_checkout',
  purchase: 'purchase',
  paymentFailed: 'payment_failed',
  skipMeal: 'skip_meal',
  submitReview: 'submit_review',
  chefApply: 'chef_apply',
} as const;
