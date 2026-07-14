import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, Order, OrderStatus, Uuid } from '../types';
import { calculateCartTotals } from '../delivery';
import { nextOrderStatus, ORDER_STATUS_FLOW } from '../orderStatus';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import { applyCreditsAtCheckout } from '../credits';
import { calculateThaliPrice } from '../pricing';
import { getCreditBalance } from './credits';
import { getMakerById } from '../marketplace/localStore';

const ORDERS_STORAGE_KEY = 'gharkaswad_orders_v1';
const MEMORY_ORDERS = new Map<string, Order>();
let ordersHydrated = false;

function normalizeOrder(raw: Order): Order {
  return {
    ...raw,
    subtotal: Number(raw.subtotal) || 0,
    credits_applied: Number(raw.credits_applied) || 0,
    total: Number(raw.total) || 0,
  };
}

async function hydrateOrders(): Promise<void> {
  if (ordersHydrated) return;
  if (isSupabaseConfigured) {
    ordersHydrated = true;
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Order[];
      for (const order of list) {
        MEMORY_ORDERS.set(order.id, normalizeOrder(order));
      }
    }
  } catch (cause) {
    logger.warn('orders hydrate failed', cause);
  }
  ordersHydrated = true;
}

async function persistOrders(): Promise<void> {
  if (isSupabaseConfigured) return;
  try {
    await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([...MEMORY_ORDERS.values()]));
  } catch (cause) {
    logger.warn('orders persist failed', cause);
  }
}

function statusStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'placed':
    case 'payment_pending':
      return 0;
    case 'accepted':
      return 1;
    case 'cooking':
      return 2;
    case 'out_for_delivery':
      return 3;
    case 'delivered':
      return 4;
    default:
      return 0;
  }
}

export { statusStepIndex };

function remember(order: Order): void {
  MEMORY_ORDERS.set(order.id, normalizeOrder(order));
  void persistOrders();
}

async function rpcSetOrderStatus(
  orderId: Uuid,
  status: OrderStatus,
  makerId?: Uuid | null,
  paymentId?: string | null,
): Promise<Result<Order>> {
  const { data, error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_maker_id: makerId ?? null,
    p_payment_id: paymentId ?? null,
  });

  if (error || !data) {
    logger.error('set_order_status failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not update order', error);
  }
  const order = normalizeOrder(data as Order);
  remember(order);
  return ok(order);
}

/** Find an unpaid order for this cart signature to avoid double-charge on retry. */
export async function findPendingOrderForCart(
  customerId: Uuid,
  line: CartLine,
): Promise<Result<Order | null>> {
  await hydrateOrders();
  if (!isSupabaseConfigured) {
    const hit = [...MEMORY_ORDERS.values()].find(
      (o) =>
        o.customer_id === customerId &&
        o.menu_item_id === line.menuItemId &&
        o.meal_date === line.mealDate &&
        o.delivery_window === line.deliveryWindow &&
        (o.status === 'payment_pending' || o.status === 'payment_failed'),
    );
    return ok(hit ?? null);
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .eq('menu_item_id', line.menuItemId)
    .eq('meal_date', line.mealDate)
    .eq('delivery_window', line.deliveryWindow)
    .in('status', ['payment_pending', 'payment_failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('findPendingOrderForCart failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok(data ? normalizeOrder(data as Order) : null);
}

export async function createOrderFromCart(params: {
  customerId: Uuid;
  line: CartLine;
  customerPhone?: string | null;
  customerName?: string | null;
}): Promise<Result<Order>> {
  const { customerId, line, customerPhone, customerName } = params;

  const pending = await findPendingOrderForCart(customerId, line);
  if (!pending.ok) return pending;
  if (pending.data) {
    return ok(pending.data);
  }

  const priced = calculateThaliPrice(
    line.basePrice,
    line.components,
    line.quantities,
    line.swapCreditsApplied,
  );

  const cartTotals = calculateCartTotals(line, priced.finalPrice);

  let creditsApplied = 0;
  let total = cartTotals.grandTotal;

  if (isSupabaseConfigured) {
    const balance = await getCreditBalance(customerId);
    if (balance.ok && balance.data > 0) {
      const applied = applyCreditsAtCheckout(balance.data, cartTotals.grandTotal);
      creditsApplied = applied.creditsApplied;
      total = applied.amountDue;
    }
  }

  const maker = await getMakerById(line.makerId);
  const trimmedName = customerName?.trim() || null;

  const thali_snapshot = {
    menuName: line.menuName,
    kitchenName: line.kitchenName,
    applyJain: line.applyJain,
    quantities: priced.clampedQuantities,
    components: line.components,
    basePrice: line.basePrice,
    deltasTotal: priced.deltasTotal,
    fulfillmentMode: line.fulfillmentMode,
    deliveryFee: cartTotals.deliveryFee,
    deliveryFeeBreakdown: cartTotals.fees,
    gstAmount: cartTotals.gstAmount,
    deliveryAddress: line.deliveryAddress,
    deliveryDistanceKm: line.deliveryDistanceKm,
    kitchenAddress: maker?.kitchen_address ?? null,
    kitchenLat: maker?.lat ?? null,
    kitchenLng: maker?.lng ?? null,
    // Profile name only in snapshot — phone stays on orders.customer_phone for backend use.
    customerName: trimmedName,
    cookingInstructions: line.cookingInstructions?.trim() || null,
    swapCreditsApplied: line.swapCreditsApplied,
  };
  console.log("========== THALI SNAPSHOT ==========");  
  console.log(JSON.stringify(thali_snapshot, null, 2));
  console.log("========== END THALI SNAPSHOT ==========");

  const meal_slot = line.mealSlot;
  const now = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const local: Order = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      customer_phone: customerPhone ?? null,
      maker_id: line.makerId,
      menu_item_id: line.menuItemId,
      status: 'payment_pending',
      meal_date: line.mealDate,
      meal_slot,
      delivery_window: line.deliveryWindow,
      subtotal: priced.finalPrice,
      credits_applied: creditsApplied,
      total,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      thali_snapshot,
      created_at: now,
      updated_at: now,
    };
    remember(local);
    return ok(local);
  }

  const payload = {
    customer_id: customerId,
    customer_phone: customerPhone ?? null,
    maker_id: line.makerId,
    menu_item_id: line.menuItemId,
    status: 'payment_pending',
    meal_date: line.mealDate,
    meal_slot,
    delivery_window: line.deliveryWindow,
    subtotal: priced.finalPrice,
    credits_applied: creditsApplied,
    total,
    thali_snapshot,
  };
  
  console.log("========== PAYLOAD ==========");
  console.log(JSON.stringify(payload, null, 2));
  
  const { data, error } = await supabase.rpc('place_order', {
    payload,
  });

  if (error || !data) {
    logger.error('createOrderFromCart failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not create order', error);
  }

  const order = normalizeOrder(data as Order);
  remember(order);
  return ok(order);
}

export async function listOrders(customerId: Uuid): Promise<Result<Order[]>> {
  if (!customerId) return ok([]);

  await hydrateOrders();
  if (!isSupabaseConfigured) {
    return ok(
      [...MEMORY_ORDERS.values()]
        .filter((o) => o.customer_id === customerId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listOrders failed', error);
    return err('UNKNOWN', error.message, error);
  }

  // Belt-and-suspenders: pilot RLS allows broad reads for realtime — never leak other users.
  const mine = ((data ?? []) as Order[])
    .map(normalizeOrder)
    .filter((o) => o.customer_id === customerId);
  return ok(mine);
}

export async function listOrdersForMaker(makerId: Uuid): Promise<Result<Order[]>> {
  await hydrateOrders();
  if (!isSupabaseConfigured) {
    return ok(
      [...MEMORY_ORDERS.values()]
        .filter((o) => o.maker_id === makerId && o.status !== 'payment_pending')
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('maker_id', makerId)
    .neq('status', 'payment_pending')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listOrdersForMaker failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok(((data ?? []) as Order[]).map(normalizeOrder));
}

export async function advanceMakerOrderStatus(orderId: Uuid, makerId: Uuid): Promise<Result<Order>> {
  await hydrateOrders();

  const current = await getOrder(orderId);
  if (!current.ok) return current;
  if (current.data.maker_id !== makerId) return err('FORBIDDEN', 'Order not found');

  const nextStatus = nextOrderStatus(current.data.status);
  if (!nextStatus) return ok(current.data);

  if (!isSupabaseConfigured) {
    const next = {
      ...current.data,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    remember(next);
    return ok(next);
  }

  return rpcSetOrderStatus(orderId, nextStatus, makerId);
}

/** Cook accepts a newly placed order → accepted. */
export async function acceptMakerOrder(orderId: Uuid, makerId: Uuid): Promise<Result<Order>> {
  await hydrateOrders();
  const current = await getOrder(orderId);
  if (!current.ok) return current;
  if (current.data.maker_id !== makerId) return err('FORBIDDEN', 'Order not found');
  if (current.data.status !== 'placed') {
    return err('VALIDATION', 'Only new orders can be accepted');
  }

  if (!isSupabaseConfigured) {
    return advanceMakerOrderStatus(orderId, makerId);
  }
  return rpcSetOrderStatus(orderId, 'accepted', makerId);
}

/** Cook declines a newly placed order → cancelled. */
export async function rejectMakerOrder(orderId: Uuid, makerId: Uuid): Promise<Result<Order>> {
  await hydrateOrders();
  const current = await getOrder(orderId);
  if (!current.ok) return current;
  if (current.data.maker_id !== makerId) return err('FORBIDDEN', 'Order not found');
  if (current.data.status !== 'placed') {
    return err('VALIDATION', 'Only new orders can be declined');
  }

  if (!isSupabaseConfigured) {
    const next = {
      ...current.data,
      status: 'cancelled' as const,
      updated_at: new Date().toISOString(),
    };
    remember(next);
    return ok(next);
  }

  return rpcSetOrderStatus(orderId, 'cancelled', makerId);
}

export async function getOrder(orderId: Uuid, customerId?: Uuid): Promise<Result<Order>> {
  await hydrateOrders();
  const cached = MEMORY_ORDERS.get(orderId);

  if (!isSupabaseConfigured) {
    if (!cached) return err('NOT_FOUND', 'Order not found');
    if (customerId && cached.customer_id !== customerId) {
      return err('FORBIDDEN', 'Order not found');
    }
    return ok(cached);
  }

  let query = supabase.from('orders').select('*').eq('id', orderId);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, error } = await query.maybeSingle();
  if (error) return err('UNKNOWN', error.message, error);
  if (!data) {
    // Do not serve stale local cache when Supabase is live — payment API needs the DB row.
    if (cached) {
      MEMORY_ORDERS.delete(orderId);
    }
    return err('NOT_FOUND', 'Order not found');
  }
  const order = normalizeOrder(data as Order);
  remember(order);
  return ok(order);
}

export async function markOrderFailed(orderId: Uuid): Promise<Result<Order>> {
  if (!isSupabaseConfigured) {
    await hydrateOrders();
    const cached = MEMORY_ORDERS.get(orderId);
    if (!cached) return err('NOT_FOUND', 'Order not found');
    const next = {
      ...cached,
      status: 'payment_failed' as const,
      updated_at: new Date().toISOString(),
    };
    remember(next);
    return ok(next);
  }
  return rpcSetOrderStatus(orderId, 'payment_failed');
}

/** Mark paid → placed so the cook sees the order. */
export async function markOrderPlaced(
  orderId: Uuid,
  paymentId?: string | null,
): Promise<Result<Order>> {
  if (!isSupabaseConfigured) {
    await hydrateOrders();
    const cached = MEMORY_ORDERS.get(orderId);
    if (!cached) return err('NOT_FOUND', 'Order not found');
    const next = {
      ...cached,
      status: 'placed' as const,
      razorpay_payment_id: paymentId ?? cached.razorpay_payment_id ?? `pay_local_${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    remember(next);
    return ok(next);
  }
  return rpcSetOrderStatus(orderId, 'placed', null, paymentId ?? `pay_local_${Date.now()}`);
}

export function syncLocalOrder(order: Order): void {
  remember(order);
}

export { ORDER_STATUS_FLOW };

/** Dev/offline: advance order one step for testing tracking → review. */
export async function advanceOrderStatus(orderId: Uuid): Promise<Result<Order>> {
  await hydrateOrders();
  const current = await getOrder(orderId);
  if (!current.ok) return current;

  const nextStatus = nextOrderStatus(current.data.status);
  if (!nextStatus) return ok(current.data);

  if (!isSupabaseConfigured) {
    const next = {
      ...current.data,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    remember(next);
    return ok(next);
  }

  return rpcSetOrderStatus(orderId, nextStatus);
}
