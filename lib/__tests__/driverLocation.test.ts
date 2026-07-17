import { getDeliveryTracking, withLiveOrigin } from '../maps/driverLocation';
import type { Order } from '../types';

const baseOrder: Order = {
  id: '11111111-1111-1111-1111-111111111111',
  customer_id: '22222222-2222-2222-2222-222222222222',
  maker_id: '33333333-3333-3333-3333-333333333333',
  menu_item_id: '44444444-4444-4444-4444-444444444444',
  status: 'out_for_delivery',
  meal_date: '2026-07-09',
  meal_slot: 'lunch',
  delivery_window: '13:00-13:15',
  subtotal: 199,
  credits_applied: 0,
  total: 199,
  razorpay_order_id: null,
  razorpay_payment_id: null,
  thali_snapshot: {
    kitchenName: "Nani Geeta's Kitchen",
    kitchenLat: 19.0596,
    kitchenLng: 72.8295,
    deliveryDistanceKm: 4.5,
  },
  created_at: '2026-07-09T06:00:00.000Z',
  updated_at: new Date(Date.now() - 6 * 60_000).toISOString(),
};

describe('driver location simulation', () => {
  it('places driver at kitchen before dispatch', () => {
    const tracking = getDeliveryTracking({ ...baseOrder, status: 'cooking' });
    expect(tracking.kitchenPinMissing).toBe(false);
    expect(tracking.liveCourier).toBe(false);
    expect(tracking.driver.lat).toBeCloseTo(tracking.kitchen.lat, 4);
    expect(tracking.driver.lng).toBeCloseTo(tracking.kitchen.lng, 4);
  });

  it('moves driver along estimated route when out for delivery', () => {
    const tracking = getDeliveryTracking(baseOrder);
    expect(tracking.driver.lat).toBeGreaterThan(tracking.kitchen.lat);
    expect(tracking.driver.lat).toBeLessThan(tracking.customer.lat);
    expect(tracking.etaMinutes).toBeGreaterThan(0);
    expect(tracking.statusLabel).toMatch(/estimated/i);
  });

  it('ends at customer address when delivered', () => {
    const tracking = getDeliveryTracking({ ...baseOrder, status: 'delivered' });
    expect(tracking.driver.lat).toBeCloseTo(tracking.customer.lat, 4);
    expect(tracking.etaMinutes).toBe(0);
  });

  it('uses cook kitchen pin from order snapshot', () => {
    const tracking = getDeliveryTracking({
      ...baseOrder,
      status: 'cooking',
      thali_snapshot: {
        kitchenName: "Priya's Kitchen",
        kitchenLat: 18.5204,
        kitchenLng: 73.8567,
        deliveryDistanceKm: 3,
      },
    });
    expect(tracking.kitchen.lat).toBeCloseTo(18.5204, 4);
    expect(tracking.kitchen.lng).toBeCloseTo(73.8567, 4);
    expect(tracking.kitchen.title).toBe("Priya's Kitchen");
    expect(tracking.driver.lat).toBeCloseTo(18.5204, 4);
  });

  it('flags missing kitchen pin instead of silently using demo coords as real', () => {
    const tracking = getDeliveryTracking({
      ...baseOrder,
      thali_snapshot: { kitchenName: 'Unset Kitchen' },
    });
    expect(tracking.kitchenPinMissing).toBe(true);
    expect(tracking.showDriver).toBe(false);
    expect(tracking.showRoute).toBe(false);
    expect(tracking.statusLabel).toMatch(/map pin missing/i);
  });

  it('hides driver for takeaway pickup orders', () => {
    const tracking = getDeliveryTracking({
      ...baseOrder,
      status: 'out_for_delivery',
      thali_snapshot: {
        fulfillmentMode: 'takeaway',
        kitchenName: "Dixit's Kitchen",
        kitchenLat: 19.06,
        kitchenLng: 72.83,
      },
    });
    expect(tracking.showDriver).toBe(false);
    expect(tracking.showRoute).toBe(false);
    expect(tracking.fulfillmentMode).toBe('takeaway');
    expect(tracking.driverName).toBe('');
    expect(tracking.statusLabel).toMatch(/ready/i);
    expect(tracking.driver.lat).toBeCloseTo(tracking.kitchen.lat, 4);
  });

  it('shows kitchen↔pickup route for takeaway when pickup point is set', () => {
    const tracking = getDeliveryTracking({
      ...baseOrder,
      status: 'cooking',
      thali_snapshot: {
        fulfillmentMode: 'takeaway',
        kitchenLat: 19.06,
        kitchenLng: 72.83,
        customerLat: 19.1,
        customerLng: 72.84,
        pickupContactName: 'Asha',
      },
    });
    expect(tracking.showDriver).toBe(false);
    expect(tracking.showRoute).toBe(true);
    expect(tracking.customer.lat).toBeCloseTo(19.1, 4);
    expect(tracking.customer.title).toMatch(/Asha|Pickup/i);
    expect(tracking.travelKm).toBeGreaterThan(0);
    expect(tracking.travelMinutes).toBeGreaterThan(0);
  });

  it('overlays live GPS as You → Kitchen for takeaway', () => {
    const base = getDeliveryTracking({
      ...baseOrder,
      status: 'placed',
      thali_snapshot: {
        fulfillmentMode: 'takeaway',
        kitchenLat: 19.06,
        kitchenLng: 72.83,
      },
    });
    expect(base.showRoute).toBe(false);
    const live = withLiveOrigin(base, { lat: 19.12, lng: 72.85 });
    expect(live.showRoute).toBe(true);
    expect(live.liveOrigin).toBe(true);
    expect(live.travelKm).toBeGreaterThan(0);
    expect(live.customer.title).toMatch(/current location/i);
  });
});
