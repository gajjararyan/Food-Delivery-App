import {
  calculateDeliveryFeeBreakdown,
  calculateCartTotals,
  deliveryDistanceKmForCart,
  isWithinDeliveryRadius,
  parseDeliveryDistanceKm,
} from '../delivery';
import { DELIVERY_PRICING } from '../../constants/delivery';
import type { CartLine } from '../types';

const baseLine = (): CartLine => ({
  menuItemId: 'item-1',
  makerId: 'maker-1',
  menuName: 'Thali',
  kitchenName: 'Test Kitchen',
  basePrice: 160,
  components: [],
  quantities: {},
  applyJain: false,
  swapCreditsApplied: 0,
  mealSlot: 'lunch',
  deliveryWindow: '13:00-13:15',
  fulfillmentMode: 'delivery',
  deliveryAddress: 'Flat 12, Example Street',
  deliveryDistanceKm: 3,
  mealDate: '2026-07-09',
});

describe('delivery fees', () => {
  it('charges zero for takeaway', () => {
    const totals = calculateCartTotals({ ...baseLine(), fulfillmentMode: 'takeaway' }, 160);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.gstAmount).toBe(0);
    expect(totals.grandTotal).toBe(160);
  });

  it('requires distance for delivery fee calculation', () => {
    const totals = calculateCartTotals(
      { ...baseLine(), deliveryDistanceKm: undefined },
      160,
    );
    expect(totals.deliveryAvailable).toBe(false);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.distanceKm).toBeNull();
  });

  it('includes platform fee on every delivery order', () => {
    const fees = calculateDeliveryFeeBreakdown({
      distanceKm: 2,
      itemTotal: 160,
    });
    expect(fees.platformFee).toBe(14.9);
    expect(fees.lines.some((l) => l.key === 'platform')).toBe(true);
  });

  it('adds 18% GST on platform + delivery fees', () => {
    const fees = calculateDeliveryFeeBreakdown({
      distanceKm: 2,
      itemTotal: 160,
    });
    // platform 14.9 + delivery 15 = 29.9 → GST 18% = 5.382 → 5.38
    expect(fees.feesSubtotal).toBe(29.9);
    expect(fees.gstRatePercent).toBe(18);
    expect(fees.gstAmount).toBe(5.38);
    expect(fees.totalCharges).toBe(35.28);
    expect(fees.lines.some((l) => l.key === 'gst' && l.amount === 5.38)).toBe(true);
  });

  it('includes GST in cart grand total', () => {
    const totals = calculateCartTotals(baseLine(), 160);
    // 3 km → platform 14.9 + delivery 20 = 34.9 + GST 6.28 = 41.18
    expect(totals.gstAmount).toBe(6.28);
    expect(totals.deliveryFee).toBe(41.18);
    expect(totals.grandTotal).toBe(201.18);
  });

  it('applies lower delivery for 4–6 km when order is ₹150+', () => {
    const discounted = calculateDeliveryFeeBreakdown({
      distanceKm: 5,
      itemTotal: 160,
    });
    const full = calculateDeliveryFeeBreakdown({
      distanceKm: 5,
      itemTotal: 120,
    });
    expect(discounted.baseDeliveryFee).toBe(15);
    expect(full.baseDeliveryFee).toBe(25);
  });

  it('adds long-distance surcharge beyond 4 km', () => {
    const fees = calculateDeliveryFeeBreakdown({
      distanceKm: 5,
      itemTotal: 160,
    });
    expect(fees.longDistanceFee).toBe(DELIVERY_PRICING.longDistanceFee);
    // 14.9 + 15 + 15 = 44.9 → GST 8.08
    expect(fees.feesSubtotal).toBe(44.9);
    expect(fees.gstAmount).toBe(8.08);
    expect(fees.totalCharges).toBe(52.98);
  });

  it('uses customer-entered distance from cart', () => {
    const line = baseLine();
    expect(deliveryDistanceKmForCart(line)).toBe(3);
    expect(parseDeliveryDistanceKm('4.25')).toBe(4.3);
    expect(isWithinDeliveryRadius(3)).toBe(true);
    expect(isWithinDeliveryRadius(12)).toBe(false);
  });

  it('blocks addresses beyond max service distance', () => {
    const fees = calculateDeliveryFeeBreakdown({
      distanceKm: 12,
      itemTotal: 200,
    });
    expect(fees.deliveryAvailable).toBe(false);
    expect(fees.gstAmount).toBe(0);
  });
});
