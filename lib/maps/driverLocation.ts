import { DELIVERY_LOCATIONS, DEFAULT_DRIVER } from '../../constants/delivery';
import type { Order, OrderStatus } from '../types';
import {
  buildRoutePoints,
  pointAlongRoute,
  type DeliveryRoute,
  type LatLng,
} from './config';

function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / 60_000);
}

function driverProgress(status: OrderStatus, updatedAt: string): number {
  switch (status) {
    case 'placed':
    case 'accepted':
    case 'cooking':
    case 'payment_pending':
      return 0;
    case 'out_for_delivery': {
      const elapsed = minutesSince(updatedAt);
      return Math.min(0.92, elapsed / 18);
    }
    case 'delivered':
      return 1;
    default:
      return 0;
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Prefer cook pin saved on the order snapshot; fall back to demo coords. */
export function kitchenPointFromOrder(order: Order): LatLng & { title: string } {
  const snap = order.thali_snapshot ?? {};
  const lat = readNumber(snap.kitchenLat);
  const lng = readNumber(snap.kitchenLng);
  const title =
    (typeof snap.kitchenName === 'string' && snap.kitchenName) ||
    DELIVERY_LOCATIONS.kitchen.label;
  if (lat != null && lng != null) {
    return { lat, lng, title };
  }
  return {
    lat: DELIVERY_LOCATIONS.kitchen.lat,
    lng: DELIVERY_LOCATIONS.kitchen.lng,
    title,
  };
}

/** Customer pin from snapshot when present; else demo offset from kitchen. */
export function customerPointFromOrder(
  order: Order,
  kitchen: LatLng,
): LatLng & { title: string } {
  const snap = order.thali_snapshot ?? {};
  const lat = readNumber(snap.customerLat);
  const lng = readNumber(snap.customerLng);
  const title =
    (typeof snap.deliveryAddress === 'string' && snap.deliveryAddress.trim()) ||
    DELIVERY_LOCATIONS.customer.label;

  if (lat != null && lng != null) {
    return { lat, lng, title };
  }

  // Approximate customer ~4.5 km north of kitchen when only address text exists
  const distanceKm = readNumber(snap.deliveryDistanceKm) ?? 4.5;
  const deg = distanceKm / 111;
  return {
    lat: kitchen.lat + deg,
    lng: kitchen.lng,
    title,
  };
}

export type DeliveryTrackingSnapshot = DeliveryRoute & {
  driverName: string;
  driverPhone: string;
  statusLabel: string;
  /** Takeaway = kitchen-only map, no driver. */
  fulfillmentMode: 'delivery' | 'takeaway';
  showDriver: boolean;
};

export function getDeliveryTracking(order: Order): DeliveryTrackingSnapshot {
  const kitchen = kitchenPointFromOrder(order);
  const customer = customerPointFromOrder(order, kitchen);
  const takeaway = order.thali_snapshot?.fulfillmentMode === 'takeaway';
  const route = takeaway ? [kitchen] : buildRoutePoints(kitchen, customer);
  const progress = takeaway ? 0 : driverProgress(order.status, order.updated_at);
  const driverPoint = takeaway
    ? { lat: kitchen.lat, lng: kitchen.lng }
    : pointAlongRoute(route, progress);

  const remainingKm = takeaway
    ? 0
    : haversineKm(driverPoint, customer) * (order.status === 'delivered' ? 0 : 1);
  const etaMinutes =
    order.status === 'delivered'
      ? 0
      : order.status === 'out_for_delivery'
        ? takeaway
          ? 0
          : Math.max(3, Math.round(remainingKm * 6))
        : order.status === 'cooking'
          ? Math.max(5, Math.round(20 - minutesSince(order.updated_at)))
          : order.status === 'accepted'
            ? 25
            : 30;

  let statusLabel = 'Waiting for the cook to accept';
  if (order.status === 'accepted') {
    statusLabel = takeaway
      ? 'Cook accepted — preparing for pickup'
      : 'Cook accepted — preparing soon';
  }
  if (order.status === 'cooking') {
    statusLabel = takeaway
      ? 'Your meal is being prepared for pickup'
      : 'Your meal is being prepared';
  }
  if (order.status === 'out_for_delivery') {
    statusLabel = takeaway
      ? 'Your order is ready — you can pick it up now'
      : 'Ramesh is on the way';
  }
  if (order.status === 'delivered') {
    statusLabel = takeaway ? 'Picked up — enjoy your meal' : 'Delivered';
  }
  if (order.status === 'cancelled') statusLabel = 'Order cancelled';
  if (order.status === 'payment_pending') statusLabel = 'Waiting for payment';

  return {
    kitchen: { lat: kitchen.lat, lng: kitchen.lng, title: kitchen.title },
    customer: takeaway
      ? { lat: kitchen.lat, lng: kitchen.lng, title: kitchen.title }
      : { lat: customer.lat, lng: customer.lng, title: customer.title },
    driver: { ...driverPoint, title: takeaway ? kitchen.title : DEFAULT_DRIVER.name },
    route,
    etaMinutes,
    driverName: takeaway ? '' : DEFAULT_DRIVER.name,
    driverPhone: takeaway ? '' : DEFAULT_DRIVER.phone,
    statusLabel,
    fulfillmentMode: takeaway ? 'takeaway' : 'delivery',
    showDriver: !takeaway,
  };
}

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
