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
 * Delivery fee constants (INR).
 * Platform / delivery / long-distance amounts are pre-GST;
 * GST at `gstRatePercent` is added on those fees at checkout (not on meal price —
 * makers handle GST on food income separately).
 */
export const DELIVERY_PRICING = {
  /** Flat platform fee per delivery order (pre-GST). */
  platformFee: 14.9,
  /** GST % on platform + delivery + long-distance fees. */
  gstRatePercent: 18,
  discountedDeliveryMinOrder: 150,
  longDistanceThresholdKm: 4,
  longDistanceFee: 15,
  maxServiceDistanceKm: 10,
} as const;
