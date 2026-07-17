import type { MakerProfile } from '../types';

/** True when the kitchen has a usable map pin for fees / tracking. */
export function hasKitchenPin(
  maker: Pick<MakerProfile, 'lat' | 'lng'> | null | undefined,
): boolean {
  return (
    maker != null &&
    typeof maker.lat === 'number' &&
    Number.isFinite(maker.lat) &&
    typeof maker.lng === 'number' &&
    Number.isFinite(maker.lng)
  );
}

/** Chef-controlled accepting-orders flag (defaults to open when unset). */
export function isKitchenOpen(maker: Pick<MakerProfile, 'is_open'>): boolean {
  return maker.is_open !== false;
}

/**
 * Shown on Discover — approved kitchens stay listed even when closed
 * visible but greyed out until the chef reopens).
 */
export function isKitchenDiscoverable(maker: Pick<MakerProfile, 'is_active'>): boolean {
  return maker.is_active;
}

/** Can take new orders right now. */
export function isKitchenAcceptingOrders(
  maker: Pick<MakerProfile, 'is_active' | 'is_open'>,
): boolean {
  return maker.is_active && isKitchenOpen(maker);
}

/** Open kitchens first, then closed — both still listed when active. */
export function sortMakersForDiscover(makers: MakerProfile[]): MakerProfile[] {
  return [...makers].sort((a, b) => {
    const openDiff = Number(isKitchenOpen(b)) - Number(isKitchenOpen(a));
    if (openDiff !== 0) return openDiff;
    return b.rating_avg - a.rating_avg;
  });
}
