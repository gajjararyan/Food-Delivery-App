import type { FulfillmentMode, Order, OrderStatus } from './types';
import { formatDeliveryWindow } from './delivery';

/** Happy-path kitchen flow after payment (same DB statuses for delivery + takeaway). */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'placed',
  'accepted',
  'cooking',
  'out_for_delivery',
  'delivered',
];

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUS_FLOW.indexOf(status);
  if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1]!;
}

export function orderFulfillmentMode(
  order: Pick<Order, 'thali_snapshot'> | { thali_snapshot?: Record<string, unknown> },
): FulfillmentMode {
  return order.thali_snapshot?.fulfillmentMode === 'delivery' ? 'delivery' : 'takeaway';
}

export function isTakeawayOrder(
  order: Pick<Order, 'thali_snapshot'> | { thali_snapshot?: Record<string, unknown> },
): boolean {
  return orderFulfillmentMode(order) === 'takeaway';
}

/**
 * Pickup PIN is only revealed after the cook accepts.
 * Hidden while waiting (`placed`) so a declined order never exposed the code.
 */
export function shouldRevealPickupPin(status: OrderStatus): boolean {
  return (
    status === 'accepted' ||
    status === 'cooking' ||
    status === 'out_for_delivery' ||
    status === 'delivered'
  );
}

export function orderStatusLabel(
  status: OrderStatus,
  fulfillment: FulfillmentMode = 'delivery',
): string {
  const takeaway = fulfillment === 'takeaway';
  switch (status) {
    case 'payment_pending':
      return 'Payment pending';
    case 'placed':
      return 'Waiting for cook';
    case 'accepted':
      return 'Accepted by cook';
    case 'cooking':
      return 'Preparing';
    case 'out_for_delivery':
      return takeaway ? 'Ready for pickup' : 'Out for delivery';
    case 'delivered':
      return takeaway ? 'Picked up' : 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'payment_failed':
      return 'Payment failed';
    default:
      return status;
  }
}

/** Chef primary action label for the next step. */
export function chefNextActionLabel(
  status: OrderStatus,
  fulfillment: FulfillmentMode = 'delivery',
): string | null {
  const takeaway = fulfillment === 'takeaway';
  switch (status) {
    case 'placed':
      return 'Accept order';
    case 'accepted':
      return 'Start preparing';
    case 'cooking':
      return takeaway ? 'Mark ready for pickup' : 'Hand off for delivery';
    case 'out_for_delivery':
      return takeaway ? 'Mark picked up' : 'Mark delivered';
    default:
      return null;
  }
}

export function customerStatusMessage(
  status: OrderStatus,
  fulfillment: FulfillmentMode = 'delivery',
): string {
  const takeaway = fulfillment === 'takeaway';
  switch (status) {
    case 'payment_pending':
      return 'Waiting for payment';
    case 'placed':
      return 'Waiting for the cook to accept';
    case 'accepted':
      return takeaway
        ? 'Cook accepted — your meal will be ready for pickup soon'
        : 'Cook accepted — preparing soon';
    case 'cooking':
      return takeaway
        ? 'Your meal is being prepared for pickup'
        : 'Your meal is being prepared';
    case 'out_for_delivery':
      return takeaway ? 'Your order is ready — you can pick it up now' : 'On the way to you';
    case 'delivered':
      return takeaway ? 'Picked up — enjoy your meal' : 'Delivered';
    case 'cancelled':
      return 'Order cancelled';
    case 'payment_failed':
      return 'Payment failed';
    default:
      return 'Tracking your order';
  }
}

function minutesSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

/**
 * Rough minutes until the meal is ready for the customer.
 * Takeaway: time until pickup. Delivery: time until food leaves / arrives (prep phase).
 */
export function estimateReadyMinutes(
  order: Pick<Order, 'status' | 'updated_at' | 'delivery_window' | 'thali_snapshot'>,
): number | null {
  const status = order.status;
  if (status === 'delivered' || status === 'cancelled' || status === 'payment_failed') {
    return 0;
  }
  if (status === 'out_for_delivery') {
    return isTakeawayOrder(order) ? 0 : null;
  }

  // Typical home-kitchen prep after accept / while cooking.
  if (status === 'cooking') {
    const elapsed = minutesSince(order.updated_at);
    return Math.max(5, Math.round(20 - elapsed));
  }
  if (status === 'accepted') {
    return 25;
  }
  if (status === 'placed' || status === 'payment_pending') {
    return 30;
  }
  return null;
}

export function pickupWindowLabel(deliveryWindow: string): string {
  if (deliveryWindow === '13:00-13:15' || deliveryWindow === '19:00-19:15') {
    return formatDeliveryWindow(deliveryWindow);
  }
  return deliveryWindow.replace('-', '–');
}

/** Customer-facing timing line for takeaway / prep. */
export function customerTimingHint(
  order: Pick<Order, 'status' | 'updated_at' | 'delivery_window' | 'thali_snapshot'>,
): string | null {
  const takeaway = isTakeawayOrder(order);
  const window = pickupWindowLabel(order.delivery_window);
  const mins = estimateReadyMinutes(order);

  if (order.status === 'out_for_delivery' && takeaway) {
    return `Ready now — please pick up by ${window}`;
  }
  if (order.status === 'delivered' && takeaway) {
    return 'Thanks — hope you enjoyed the meal';
  }
  if (mins == null) return takeaway ? `Pickup window · ${window}` : null;
  if (mins <= 0 && takeaway) return `Ready now — pickup window ${window}`;
  if (takeaway) {
    return `Ready in about ${mins} min · pickup window ${window}`;
  }
  if (order.status === 'cooking' || order.status === 'accepted' || order.status === 'placed') {
    return `Food ready in about ${mins} min · serving window ${window}`;
  }
  return null;
}

export function timelineStepLabels(fulfillment: FulfillmentMode): readonly string[] {
  if (fulfillment === 'takeaway') {
    return ['Placed', 'Cook accepted', 'Preparing', 'Ready for pickup', 'Picked up'] as const;
  }
  return ['Placed', 'Cook accepted', 'Preparing', 'Out for delivery', 'Delivered'] as const;
}
