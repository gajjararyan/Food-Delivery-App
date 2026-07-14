import { applyCreditsAtCheckout } from '../credits';
import { calculateCartTotals } from '../delivery';
import { calculateThaliPrice } from '../pricing';
import type {
  CartLine,
  FulfillmentMode,
  Order,
  ThaliComponent,
  Uuid,
} from '../types';

export type VerifiedOrderAmounts = {
  subtotal: number;
  grandTotal: number;
  creditsApplied: number;
  amountDue: number;
};

type ParsedSnapshot = {
  basePrice: number;
  components: ThaliComponent[];
  quantities: Record<Uuid, number>;
  swapCreditsApplied: number;
  fulfillmentMode: FulfillmentMode;
  deliveryAddress?: string;
  deliveryDistanceKm?: number;
};

function asNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asFulfillmentMode(value: unknown): FulfillmentMode {
  return value === 'delivery' ? 'delivery' : 'takeaway';
}

/**
 * Parse order snapshot.
 * Supports both old and new snapshot formats.
 */
export function parseThaliSnapshot(
  raw: Record<string, unknown> | null | undefined,
): ParsedSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const basePrice =
    asNumber(raw.basePrice) ??
    asNumber(raw.price) ??
    asNumber(raw.base_price);

  if (basePrice === null) {
    return null;
  }

  const components = Array.isArray(raw.components)
    ? (raw.components as ThaliComponent[])
    : [];

  const quantitiesRaw =
    raw.quantities && typeof raw.quantities === 'object'
      ? (raw.quantities as Record<string, unknown>)
      : {};

  const quantities: Record<Uuid, number> = {};

  for (const [id, qty] of Object.entries(quantitiesRaw)) {
    const value = asNumber(qty);
    if (value !== null) {
      quantities[id as Uuid] = value;
    }
  }

  return {
    basePrice,
    components,
    quantities,
    swapCreditsApplied: Math.max(
      0,
      asNumber(raw.swapCreditsApplied) ?? 0,
    ),
    fulfillmentMode: asFulfillmentMode(raw.fulfillmentMode),
    deliveryAddress:
      typeof raw.deliveryAddress === 'string'
        ? raw.deliveryAddress
        : undefined,
    deliveryDistanceKm:
      asNumber(raw.deliveryDistanceKm) ?? undefined,
  };
}

export function computeVerifiedOrderAmounts(
  order: Order,
): VerifiedOrderAmounts | null {
  console.log('==============================');
  console.log('VERIFYING ORDER');
  console.log(JSON.stringify(order.thali_snapshot, null, 2));

  const parsed = parseThaliSnapshot(order.thali_snapshot);

  if (!parsed) {
    console.error('Invalid thali_snapshot');
    return null;
  }

  const priced = calculateThaliPrice(
    parsed.basePrice,
    parsed.components,
    parsed.quantities,
    parsed.swapCreditsApplied,
  );

  const line: CartLine = {
    makerId: order.maker_id,
    menuItemId: order.menu_item_id,
    menuName:
      typeof order.thali_snapshot.menuName === 'string'
        ? order.thali_snapshot.menuName
        : '',
    kitchenName:
      typeof order.thali_snapshot.kitchenName === 'string'
        ? order.thali_snapshot.kitchenName
        : '',
    basePrice: parsed.basePrice,
    components: parsed.components,
    quantities: parsed.quantities,
    applyJain: Boolean(order.thali_snapshot.applyJain),
    swapCreditsApplied: parsed.swapCreditsApplied,
    mealSlot: order.meal_slot,
    deliveryWindow: order.delivery_window,
    fulfillmentMode: parsed.fulfillmentMode,
    deliveryAddress: parsed.deliveryAddress,
    deliveryDistanceKm: parsed.deliveryDistanceKm,
    mealDate: order.meal_date,
  };

  const cartTotals = calculateCartTotals(
    line,
    priced.finalPrice,
  );

  const creditsApplied = Math.max(
    0,
    Number(order.credits_applied) || 0,
  );

  const { amountDue } = applyCreditsAtCheckout(
    creditsApplied,
    cartTotals.grandTotal,
  );

  console.log('Verified Amount');
  console.log({
    subtotal: priced.finalPrice,
    grandTotal: cartTotals.grandTotal,
    creditsApplied,
    amountDue,
  });

  return {
    subtotal: priced.finalPrice,
    grandTotal: cartTotals.grandTotal,
    creditsApplied,
    amountDue: Math.max(0, amountDue),
  };
}

export function orderTotalMismatch(
  order: Order,
  clientTotal: number,
): boolean {
  const verified = computeVerifiedOrderAmounts(order);

  if (!verified) {
    return true;
  }

  return Math.abs(verified.amountDue - clientTotal) > 0.01;
}