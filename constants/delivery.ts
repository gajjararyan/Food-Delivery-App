/** Default Mumbai coordinates for offline / demo delivery tracking. */
export const DELIVERY_LOCATIONS = {
  kitchen: {
    lat: 19.0596,
    lng: 72.8295,
    label: "Nani Geeta's Kitchen",
  },
  customer: {
    lat: 19.1046,
    lng: 72.8295,
    label: 'Delivery address',
  },
} as const;

/** Simulated driver name shown on tracking screen. */
export const DEFAULT_DRIVER = {
  name: 'Ramesh',
  phone: '+91 98765 43210',
} as const;

/**
 * Delivery fee constants (INR) — home-kitchen / thali focused.
 *
 * Radius inspired by Zomato/Swiggy (typically 7–10 km), tightened for freshness:
 * - Comfort: 0–5 km
 * - Long-distance surcharge: beyond 4 km
 * - Hard stop: 7 km (no delivery farther)
 *
 * Platform / delivery / long-distance amounts are pre-GST;
 * GST at `gstRatePercent` is added on those fees at checkout (not on meal price —
 * makers handle GST on food income separately).
 */
export const DELIVERY_PRICING = {
  /** Flat platform fee per delivery order (pre-GST). */
  platformFee: 14.9,
  /** GST % on platform + delivery + long-distance fees. */
  gstRatePercent: 18,
  /** Lower delivery fee in the 4–6 km band when item total is at/above this. */
  discountedDeliveryMinOrder: 150,
  /** Long-distance surcharge starts after this km. */
  longDistanceThresholdKm: 4,
  /** Surcharge for 4–6 km (Zomato-style ₹15–40 band, lower end). */
  longDistanceFee: 15,
  /** Outer long-distance band starts after this km. */
  longDistanceFarThresholdKm: 6,
  /** Surcharge for 6–7 km (outer service edge). */
  longDistanceFarFee: 30,
  /**
   * Max kitchen → customer road-estimate km for delivery.
   * Beyond this, cart/checkout/order create force takeaway or a nearer pin.
   */
  maxServiceDistanceKm: 7,
} as const;

/**
 * Rough urban travel assumptions for free haversine-based ETA
 * (checkout + takeaway tracking). No paid Distance Matrix / Directions.
 */
export const TRAVEL_ESTIMATE = {
  /** Effective urban speed km/h after applying road-distance fudge. */
  assumedRoadSpeedKmh: 20,
  /** Multiply straight-line km by this to approximate road distance. */
  roadDistanceFactor: 1.3,
} as const;
