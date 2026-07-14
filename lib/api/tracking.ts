import type { Order } from '../types';
import { isTakeawayOrder } from '../orderStatus';
import { getDeliveryTracking, type DeliveryTrackingSnapshot } from '../maps/driverLocation';
import { getApiBaseUrl } from './apiBase';

const API_URL = getApiBaseUrl();

export async function fetchDeliveryTracking(
  order: Order,
): Promise<DeliveryTrackingSnapshot> {
  // Takeaway timing/copy is computed locally — never use delivery-partner API text.
  if (isTakeawayOrder(order) || !API_URL || API_URL.includes('your-render')) {
    return getDeliveryTracking(order);
  }

  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/orders/${order.id}/tracking`);
    if (!res.ok) return getDeliveryTracking(order);
    const data = (await res.json()) as DeliveryTrackingSnapshot;
    return data;
  } catch {
    return getDeliveryTracking(order);
  }
}
