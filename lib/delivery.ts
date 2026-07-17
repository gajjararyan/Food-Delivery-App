import { DELIVERY_LOCATIONS, DELIVERY_PRICING } from '../constants/delivery';
import type { CartLine, DeliveryWindow, FulfillmentMode, MealSlot } from './types';

export type DeliveryFeeLine = {
  key: 'platform' | 'delivery' | 'long_distance' | 'gst';
  label: string;
  amount: number;
};

export type DeliveryFeeBreakdown = {
  platformFee: number;
  baseDeliveryFee: number;
  longDistanceFee: number;
  /** Pre-GST sum of platform + delivery + long-distance. */
  feesSubtotal: number;
  gstRatePercent: number;
  gstAmount: number;
  /** feesSubtotal + gstAmount */
  totalCharges: number;
  lines: DeliveryFeeLine[];
  distanceKm: number;
  deliveryAvailable: boolean;
  unavailableReason: string | null;
};

export type CartTotals = {
  itemTotal: number;
  fees: DeliveryFeeBreakdown | null;
  /** All delivery-related charges including GST. */
  deliveryFee: number;
  gstAmount: number;
  distanceKm: number | null;
  deliveryAvailable: boolean;
  grandTotal: number;
  customerAddressLabel: string;
};

export function deliveryWindowForMealSlot(slot: MealSlot): DeliveryWindow {
  return slot === 'dinner' ? '19:00-19:15' : '13:00-13:15';
}

export function mealSlotLabel(slot: MealSlot): string {
  return slot === 'dinner' ? 'Dinner' : 'Lunch';
}

export function formatDeliveryWindow(window: DeliveryWindow): string {
  return window === '13:00-13:15' ? '13:00–13:15' : '19:00–19:15';
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseDeliveryDistanceKm(raw: number | string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

/** Distance used for fees — entered by customer on cart. */
export function deliveryDistanceKmForCart(line: CartLine): number | null {
  return parseDeliveryDistanceKm(line.deliveryDistanceKm);
}

export function isWithinDeliveryRadius(distanceKm: number): boolean {
  return distanceKm <= DELIVERY_PRICING.maxServiceDistanceKm;
}

export function calculateDeliveryFeeBreakdown(params: {
  distanceKm: number;
  itemTotal: number;
}): DeliveryFeeBreakdown {
  const { distanceKm, itemTotal } = params;
  const p = DELIVERY_PRICING;

  if (!isWithinDeliveryRadius(distanceKm)) {
    return {
      platformFee: 0,
      baseDeliveryFee: 0,
      longDistanceFee: 0,
      feesSubtotal: 0,
      gstRatePercent: p.gstRatePercent,
      gstAmount: 0,
      totalCharges: 0,
      lines: [],
      distanceKm,
      deliveryAvailable: false,
      unavailableReason: `Delivery unavailable beyond ${p.maxServiceDistanceKm} km`,
    };
  }

  const platformFee = p.platformFee;

  // Stepped delivery fee by distance band (home-kitchen freshness).
  let baseDeliveryFee: number;
  if (distanceKm <= 2) {
    baseDeliveryFee = 15;
  } else if (distanceKm <= 4) {
    baseDeliveryFee = 20;
  } else if (distanceKm <= 6) {
    baseDeliveryFee = itemTotal >= p.discountedDeliveryMinOrder ? 15 : 25;
  } else {
    // 6–7 km outer band (hard cap is maxServiceDistanceKm).
    baseDeliveryFee = 35;
  }

  const longDistanceFee = longDistanceSurcharge(distanceKm);

  const feesSubtotal = roundMoney(platformFee + baseDeliveryFee + longDistanceFee);
  const gstAmount = roundMoney((feesSubtotal * p.gstRatePercent) / 100);
  const totalCharges = roundMoney(feesSubtotal + gstAmount);

  const lines: DeliveryFeeLine[] = [
    { key: 'platform', label: 'Platform fee', amount: platformFee },
    { key: 'delivery', label: 'Delivery fee', amount: baseDeliveryFee },
  ];
  if (longDistanceFee > 0) {
    lines.push({
      key: 'long_distance',
      label: longDistanceLabel(distanceKm),
      amount: longDistanceFee,
    });
  }
  lines.push({
    key: 'gst',
    label: `GST (${p.gstRatePercent}%)`,
    amount: gstAmount,
  });

  return {
    platformFee,
    baseDeliveryFee,
    longDistanceFee,
    feesSubtotal,
    gstRatePercent: p.gstRatePercent,
    gstAmount,
    totalCharges,
    lines,
    distanceKm,
    deliveryAvailable: true,
    unavailableReason: null,
  };
}

/** Long-distance surcharge: ₹15 after 4 km, ₹30 after 6 km (up to 7 km max). */
export function longDistanceSurcharge(distanceKm: number): number {
  const p = DELIVERY_PRICING;
  if (distanceKm <= p.longDistanceThresholdKm) return 0;
  if (distanceKm <= p.longDistanceFarThresholdKm) return p.longDistanceFee;
  return p.longDistanceFarFee;
}

function longDistanceLabel(distanceKm: number): string {
  const p = DELIVERY_PRICING;
  if (distanceKm > p.longDistanceFarThresholdKm) {
    return `Long distance (>${p.longDistanceFarThresholdKm} km)`;
  }
  return `Long distance (>${p.longDistanceThresholdKm} km)`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateCartTotals(line: CartLine, itemTotal: number): CartTotals {
  const addressLabel = line.deliveryAddress?.trim() || 'Add your address';

  if (line.fulfillmentMode !== 'delivery') {
    return {
      itemTotal,
      fees: null,
      deliveryFee: 0,
      gstAmount: 0,
      distanceKm: null,
      deliveryAvailable: true,
      grandTotal: itemTotal,
      customerAddressLabel: addressLabel,
    };
  }

  const distanceKm = deliveryDistanceKmForCart(line);
  if (distanceKm === null) {
    return {
      itemTotal,
      fees: null,
      deliveryFee: 0,
      gstAmount: 0,
      distanceKm: null,
      deliveryAvailable: false,
      grandTotal: itemTotal,
      customerAddressLabel: addressLabel,
    };
  }

  const fees = calculateDeliveryFeeBreakdown({
    distanceKm,
    itemTotal,
  });

  const deliveryFee = fees.deliveryAvailable ? fees.totalCharges : 0;
  const gstAmount = fees.deliveryAvailable ? fees.gstAmount : 0;

  return {
    itemTotal,
    fees,
    deliveryFee,
    gstAmount,
    distanceKm,
    deliveryAvailable: fees.deliveryAvailable,
    grandTotal: itemTotal + deliveryFee,
    customerAddressLabel: addressLabel,
  };
}

export function normalizeCartLine(raw: CartLine): CartLine {
  const mealSlot =
    raw.mealSlot ?? (raw.deliveryWindow.startsWith('13:') ? 'lunch' : 'dinner');
  const deliveryWindow = deliveryWindowForMealSlot(mealSlot);
  const fulfillmentMode = raw.fulfillmentMode ?? 'takeaway';
  const deliveryDistanceKm = parseDeliveryDistanceKm(
    raw.deliveryDistanceKm ??
      // legacy preset ids → ignore; user must re-enter distance
      undefined,
  );
  return {
    ...raw,
    mealSlot,
    deliveryWindow,
    fulfillmentMode,
    deliveryAddress: raw.deliveryAddress ?? '',
    deliveryDistanceKm: deliveryDistanceKm ?? undefined,
    cookingInstructions: raw.cookingInstructions?.trim() || undefined,
  };
}

export function fulfillmentModeLabel(mode: FulfillmentMode): string {
  return mode === 'takeaway' ? 'Takeaway (pick up)' : 'Delivery to you';
}

/** @deprecated Use deliveryDistanceKmForCart */
export function estimateDeliveryDistanceKm(): number {
  const { kitchen, customer } = DELIVERY_LOCATIONS;
  return haversineKm(kitchen.lat, kitchen.lng, customer.lat, customer.lng);
}
