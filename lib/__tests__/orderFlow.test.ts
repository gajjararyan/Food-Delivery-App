import { createDevSession } from '../devAuth';
import { createOrderFromCart, getOrder, listOrders } from '../api/orders';
import { confirmSandboxPayment, createPaymentSession } from '../api/payments';
import { seedMenuItemWithComponents } from '../../constants/seedCatalog';
import { SEED } from '../../constants/seed';
import type { CartLine } from '../types';

/** Offline cart → order → sandbox payment (no Supabase / browser APIs). */
describe('offline order flow', () => {
  it('creates order, payment session, and confirms sandbox payment', async () => {
    const { user } = createDevSession('+917043156067');
    const seed = seedMenuItemWithComponents(SEED.lunchThaliId);
    expect(seed).toBeTruthy();
    if (!seed) return;

    const { menuItem, components } = seed;
    const quantities = Object.fromEntries(
      components.map((c) => [c.id, c.included_qty]),
    ) as Record<string, number>;

    const line: CartLine = {
      makerId: SEED.makerId,
      menuItemId: menuItem.id,
      menuName: menuItem.name,
      kitchenName: "Nani Geeta's Kitchen",
      basePrice: menuItem.base_price,
      components,
      quantities,
      applyJain: false,
      swapCreditsApplied: 0,
      mealSlot: menuItem.meal_slot,
      fulfillmentMode: 'takeaway',
      deliveryWindow: '13:00-13:15',
      mealDate: '2026-07-09',
    };

    const created = await createOrderFromCart({ customerId: user.id, line });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const orderId = created.data.id;

    const payment = await createPaymentSession(orderId, 'dev-access-token');
    expect(payment.ok).toBe(true);
    if (!payment.ok) return;
    expect(payment.data.sandbox).toBe(true);
    expect(payment.data.amountPaise).toBeGreaterThan(0);

    const confirmed = await confirmSandboxPayment(orderId, 'dev-access-token');
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.status).toBe('placed');

    const fetched = await getOrder(orderId, user.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.data.status).toBe('placed');

    const orders = await listOrders(user.id);
    expect(orders.ok).toBe(true);
    if (!orders.ok) return;
    expect(orders.data.some((o) => o.id === orderId)).toBe(true);
  });

  it('reuses pending order for same cart signature (no double charge)', async () => {
    const { user } = createDevSession('+917043156067');
    const seed = seedMenuItemWithComponents(SEED.lunchThaliId);
    if (!seed) return;

    const { menuItem, components } = seed;
    const quantities = Object.fromEntries(
      components.map((c) => [c.id, c.included_qty]),
    ) as Record<string, number>;

    const line: CartLine = {
      makerId: SEED.makerId,
      menuItemId: menuItem.id,
      menuName: menuItem.name,
      kitchenName: "Nani Geeta's Kitchen",
      basePrice: menuItem.base_price,
      components,
      quantities,
      applyJain: false,
      swapCreditsApplied: 0,
      mealSlot: 'dinner',
      fulfillmentMode: 'delivery',
      deliveryWindow: '19:00-19:15',
      mealDate: '2026-07-10',
    };

    const first = await createOrderFromCart({ customerId: user.id, line });
    const second = await createOrderFromCart({ customerId: user.id, line });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data.id).toBe(first.data.id);
  });
});
