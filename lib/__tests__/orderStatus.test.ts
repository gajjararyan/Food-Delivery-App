import {
  chefNextActionLabel,
  customerStatusMessage,
  customerTimingHint,
  nextOrderStatus,
  ORDER_STATUS_FLOW,
  orderStatusLabel,
  shouldRevealPickupPin,
} from '../orderStatus';
import type { Order } from '../types';

describe('order acceptance flow', () => {
  it('moves placed → accepted → cooking → out_for_delivery → delivered', () => {
    expect(ORDER_STATUS_FLOW).toEqual([
      'placed',
      'accepted',
      'cooking',
      'out_for_delivery',
      'delivered',
    ]);
    expect(nextOrderStatus('placed')).toBe('accepted');
    expect(nextOrderStatus('accepted')).toBe('cooking');
    expect(nextOrderStatus('cooking')).toBe('out_for_delivery');
    expect(nextOrderStatus('out_for_delivery')).toBe('delivered');
    expect(nextOrderStatus('delivered')).toBeNull();
  });

  it('hides pickup PIN until cook accepts', () => {
    expect(shouldRevealPickupPin('placed')).toBe(false);
    expect(shouldRevealPickupPin('payment_pending')).toBe(false);
    expect(shouldRevealPickupPin('accepted')).toBe(true);
    expect(shouldRevealPickupPin('cooking')).toBe(true);
    expect(shouldRevealPickupPin('out_for_delivery')).toBe(true);
    expect(shouldRevealPickupPin('delivered')).toBe(true);
    expect(shouldRevealPickupPin('cancelled')).toBe(false);
  });

  it('labels chef actions for delivery vs takeaway', () => {
    expect(chefNextActionLabel('placed')).toBe('Accept order');
    expect(chefNextActionLabel('accepted')).toBe('Start preparing');
    expect(chefNextActionLabel('cooking', 'delivery')).toBe('Hand off for delivery');
    expect(chefNextActionLabel('cooking', 'takeaway')).toBe('Mark ready for pickup');
    expect(chefNextActionLabel('out_for_delivery', 'delivery')).toBe('Mark delivered');
    expect(chefNextActionLabel('out_for_delivery', 'takeaway')).toBe('Mark picked up');
  });

  it('uses pickup wording for takeaway statuses', () => {
    expect(orderStatusLabel('out_for_delivery', 'takeaway')).toBe('Ready for pickup');
    expect(orderStatusLabel('delivered', 'takeaway')).toBe('Picked up');
    expect(customerStatusMessage('out_for_delivery', 'takeaway')).toMatch(/ready/i);
    expect(customerStatusMessage('cooking', 'takeaway')).toMatch(/pickup/i);
  });

  it('shows waiting-for-cook message before acceptance', () => {
    expect(customerStatusMessage('placed')).toMatch(/accept/i);
    expect(customerStatusMessage('accepted')).toMatch(/accepted/i);
    expect(customerStatusMessage('cooking')).toMatch(/prepared/i);
  });

  it('gives takeaway customers a ready/pickup timing hint', () => {
    const order = {
      status: 'cooking' as const,
      updated_at: new Date().toISOString(),
      delivery_window: '13:00-13:15' as const,
      thali_snapshot: { fulfillmentMode: 'takeaway' },
    } satisfies Pick<Order, 'status' | 'updated_at' | 'delivery_window' | 'thali_snapshot'>;
    expect(customerTimingHint(order)).toMatch(/Ready in about/i);
    expect(customerTimingHint(order)).toMatch(/13:00/);

    const ready = { ...order, status: 'out_for_delivery' as const };
    expect(customerTimingHint(ready)).toMatch(/Ready now/i);
  });
});
