export type LatLng = {
  lat: number;
  lng: number;
};

export type MapMarker = LatLng & {
  title: string;
};

export type DeliveryRoute = {
  kitchen: MapMarker;
  customer: MapMarker;
  driver: MapMarker;
  route: LatLng[];
  etaMinutes: number;
};

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export function isGoogleMapsConfigured(): boolean {
  return Boolean(apiKey && apiKey.length > 10 && !apiKey.includes('your-'));
}

export function getGoogleMapsApiKey(): string {
  return apiKey;
}

/** Linear interpolate between route points by progress 0..1 */
export function pointAlongRoute(route: LatLng[], progress: number): LatLng {
  if (route.length === 0) return { lat: 0, lng: 0 };
  if (route.length === 1) return route[0]!;
  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (route.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(route.length - 1, index + 1);
  const t = scaled - index;
  const a = route[index]!;
  const b = route[nextIndex]!;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export function buildRoutePoints(kitchen: LatLng, customer: LatLng, steps = 24): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      lat: kitchen.lat + (customer.lat - kitchen.lat) * t,
      lng: kitchen.lng + (customer.lng - kitchen.lng) * t,
    });
  }
  return points;
}
