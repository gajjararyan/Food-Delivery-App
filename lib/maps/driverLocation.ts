import { DELIVERY_LOCATIONS } from '../../constants/delivery';
import type { Order, OrderStatus } from '../types';
import {
  buildRoutePoints,
  pointAlongRoute,
  type DeliveryRoute,
  type LatLng,
} from './config';
import { estimateTravel, haversineKm } from './distanceEstimate';

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

/** Prefer cook pin saved on the order snapshot. No silent Mumbai fallback. */
export function kitchenPointFromOrder(
  order: Order,
): (LatLng & { title: string }) | null {
  const snap = order.thali_snapshot ?? {};
  const lat = readNumber(snap.kitchenLat);
  const lng = readNumber(snap.kitchenLng);
  const title =
    (typeof snap.kitchenName === 'string' && snap.kitchenName) ||
    DELIVERY_LOCATIONS.kitchen.label;
  if (lat != null && lng != null) {
    return { lat, lng, title };
  }
  return null;
}

/** Customer / pickup pin from snapshot when present; else null for takeaway, approx for delivery. */
export function customerPointFromOrder(
  order: Order,
  kitchen: LatLng & { title?: string },
): LatLng & { title: string } {
  const snap = order.thali_snapshot ?? {};
  const lat = readNumber(snap.customerLat);
  const lng = readNumber(snap.customerLng);
  const takeaway = snap.fulfillmentMode === 'takeaway';
  const pickupName =
    typeof snap.pickupContactName === 'string' && snap.pickupContactName.trim()
      ? snap.pickupContactName.trim()
      : null;
  const title =
    (typeof snap.deliveryAddress === 'string' && snap.deliveryAddress.trim()) ||
    (takeaway ? pickupName || 'Pickup point' : DELIVERY_LOCATIONS.customer.label);

  if (lat != null && lng != null) {
    return { lat, lng, title };
  }

  if (takeaway) {
    // Legacy takeaway with no pickup point — collapse to kitchen.
    return { lat: kitchen.lat, lng: kitchen.lng, title: kitchen.title ?? title };
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
  /** Takeaway = no moving driver icon. */
  fulfillmentMode: 'delivery' | 'takeaway';
  showDriver: boolean;
  /** Draw kitchen ↔ customer/pickup polyline when points differ. */
  showRoute: boolean;
  /** Free haversine/OSRM estimate when showRoute is true. */
  travelKm?: number;
  travelMinutes?: number;
  /** True when customer pin came from live GPS (not order snapshot). */
  liveOrigin?: boolean;
  /** True when polyline/distance came from free OSRM road routing. */
  byRoad?: boolean;
  /** False until a real courier partner is wired — delivery path is estimated only. */
  liveCourier: boolean;
  /** Kitchen pin missing on the order snapshot. */
  kitchenPinMissing: boolean;
};

/**
 * Overlay the diner's live GPS as the takeaway "You" pin (sync fallback —
 * use applyLiveOriginRoute for real road geometry).
 */
export function withLiveOrigin(
  tracking: DeliveryTrackingSnapshot,
  origin: LatLng,
): DeliveryTrackingSnapshot {
  if (tracking.fulfillmentMode !== 'takeaway') return tracking;

  const kitchen = tracking.kitchen;
  const pointsDiffer =
    Math.abs(kitchen.lat - origin.lat) > 0.00005 ||
    Math.abs(kitchen.lng - origin.lng) > 0.00005;
  if (!pointsDiffer) {
    return {
      ...tracking,
      customer: { ...origin, title: 'You (current location)' },
      liveOrigin: true,
      byRoad: false,
    };
  }

  const travel = estimateTravel(origin, kitchen);
  const route = buildRoutePoints(origin, kitchen);

  return {
    ...tracking,
    customer: { lat: origin.lat, lng: origin.lng, title: 'You (current location)' },
    route,
    showRoute: true,
    travelKm: travel.km,
    travelMinutes: travel.minutes,
    liveOrigin: true,
    byRoad: false,
  };
}

/** Apply a fetched road (or fallback) route onto takeaway tracking. */
export function applyOriginRoute(
  tracking: DeliveryTrackingSnapshot,
  origin: LatLng,
  road: { route: LatLng[]; km: number; minutes: number; byRoad: boolean },
): DeliveryTrackingSnapshot {
  if (tracking.fulfillmentMode !== 'takeaway') return tracking;

  return {
    ...tracking,
    customer: { lat: origin.lat, lng: origin.lng, title: 'You (current location)' },
    route: road.route.length > 1 ? road.route : buildRoutePoints(origin, tracking.kitchen),
    showRoute: true,
    travelKm: road.km,
    travelMinutes: road.minutes,
    liveOrigin: true,
    byRoad: road.byRoad,
  };
}

export function getDeliveryTracking(order: Order): DeliveryTrackingSnapshot {
  const kitchenResolved = kitchenPointFromOrder(order);
  const kitchenPinMissing = kitchenResolved == null;
  const kitchen = kitchenResolved ?? {
    lat: DELIVERY_LOCATIONS.kitchen.lat,
    lng: DELIVERY_LOCATIONS.kitchen.lng,
    title:
      (typeof order.thali_snapshot?.kitchenName === 'string' &&
        order.thali_snapshot.kitchenName) ||
      DELIVERY_LOCATIONS.kitchen.label,
  };
  const customer = customerPointFromOrder(order, kitchen);
  const takeaway = order.thali_snapshot?.fulfillmentMode === 'takeaway';
  const pointsDiffer =
    Math.abs(kitchen.lat - customer.lat) > 0.00005 ||
    Math.abs(kitchen.lng - customer.lng) > 0.00005;
  const showRoute = pointsDiffer && !kitchenPinMissing;
  const showDriver = !takeaway && !kitchenPinMissing;

  const route = showRoute ? buildRoutePoints(kitchen, customer) : [kitchen];
  const progress = showDriver ? driverProgress(order.status, order.updated_at) : 0;
  const driverPoint = showDriver
    ? pointAlongRoute(route, progress)
    : { lat: kitchen.lat, lng: kitchen.lng };

  const travel = showRoute ? estimateTravel(kitchen, customer) : { km: 0, minutes: 0 };
  const remainingKm = showDriver
    ? haversineKm(driverPoint, customer) * (order.status === 'delivered' ? 0 : 1)
    : travel.km;

  let etaMinutes =
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

  if (takeaway && showRoute && order.status !== 'delivered' && order.status !== 'out_for_delivery') {
    etaMinutes = Math.max(etaMinutes, travel.minutes);
  }

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
      ? 'Ready — come grab it!'
      : 'Out for delivery · estimated route (no live courier yet)';
  }
  if (order.status === 'delivered') {
    statusLabel = takeaway ? 'Picked up — enjoy your meal' : 'Delivered';
  }
  if (order.status === 'cancelled') statusLabel = 'Order cancelled';
  if (order.status === 'payment_pending') statusLabel = 'Waiting for payment';
  if (kitchenPinMissing) {
    statusLabel = takeaway
      ? 'Kitchen map pin missing — ask the cook to set their location'
      : 'Kitchen map pin missing — delivery map unavailable';
  }

  return {
    kitchen: { lat: kitchen.lat, lng: kitchen.lng, title: kitchen.title },
    customer: {
      lat: customer.lat,
      lng: customer.lng,
      title: customer.title,
    },
    driver: {
      ...driverPoint,
      title: showDriver ? 'Estimated courier' : kitchen.title,
    },
    route,
    etaMinutes,
    driverName: showDriver ? 'Estimated route' : '',
    driverPhone: '',
    statusLabel,
    fulfillmentMode: takeaway ? 'takeaway' : 'delivery',
    showDriver,
    showRoute,
    travelKm: showRoute ? travel.km : undefined,
    travelMinutes: showRoute ? travel.minutes : undefined,
    liveOrigin: false,
    liveCourier: false,
    kitchenPinMissing,
  };
}
