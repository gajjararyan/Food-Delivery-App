import crypto from 'node:crypto';
import { computeVerifiedOrderAmounts, orderTotalMismatch } from '../payment/orderTotal';
import { verifyRazorpayPaymentSignature } from '../payment/razorpaySignature';
import type { Order } from '../types';

const KEY_SECRET = 'test_secret_key';

function sign(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('verifyRazorpayPaymentSignature', () => {
  it('accepts a valid signature', () => {
    const orderId = 'order_abc123';
    const paymentId = 'pay_xyz789';
    expect(
      verifyRazorpayPaymentSignature(KEY_SECRET, orderId, paymentId, sign(orderId, paymentId)),
    ).toBe(true);
  });

  it('rejects a tampered signature', () => {
    expect(
      verifyRazorpayPaymentSignature(KEY_SECRET, 'order_abc', 'pay_xyz', 'bad_signature'),
    ).toBe(false);
  });

  it('rejects empty inputs', () => {
    expect(verifyRazorpayPaymentSignature('', 'order_abc', 'pay_xyz', 'sig')).toBe(false);
  });
});

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    customer_id: '22222222-2222-4222-8222-222222222222',
    maker_id: '33333333-3333-4333-8333-333333333333',
    menu_item_id: '44444444-4444-4444-8444-444444444444',
    status: 'payment_pending',
    meal_date: '2026-07-14',
    meal_slot: 'lunch',
    delivery_window: '13:00-13:15',
    subtotal: 149,
    credits_applied: 0,
    total: 149,
    razorpay_order_id: null,
    razorpay_payment_id: null,
    thali_snapshot: {
      basePrice: 149,
      swapCreditsApplied: 0,
      fulfillmentMode: 'takeaway',
      quantities: { comp1: 1 },
      components: [
        {
          id: 'comp1',
          menu_item_id: '44444444-4444-4444-8444-444444444444',
          name: 'Roti',
          serving_amount: 1,
          serving_unit: 'piece',
          included_qty: 1,
          min_qty: 1,
          max_qty: 4,
          unit_price_delta: 0,
          has_jain_variant: false,
          jain_substitute: null,
          sort_order: 0,
          component_type: 'included',
        },
      ],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeVerifiedOrderAmounts', () => {
  it('recomputes takeaway total from snapshot (ignores tampered order.total)', () => {
    const order = sampleOrder({ total: 1, subtotal: 1 });
    const verified = computeVerifiedOrderAmounts(order);
    expect(verified).not.toBeNull();
    expect(verified!.amountDue).toBe(149);
    expect(verified!.grandTotal).toBe(149);
  });

  it('detects mismatch between client total and recomputed amount', () => {
    const order = sampleOrder({ total: 50 });
    expect(orderTotalMismatch(order, 50)).toBe(true);
    expect(orderTotalMismatch(order, 149)).toBe(false);
  });

  it('applies stored credits after recomputing grand total', () => {
    const order = sampleOrder({ credits_applied: 49, total: 100 });
    const verified = computeVerifiedOrderAmounts(order);
    expect(verified!.grandTotal).toBe(149);
    expect(verified!.amountDue).toBe(100);
  });
});
