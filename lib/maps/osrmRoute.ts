import type { LatLng } from './config';
import { estimateTravel, buildFallbackRoute } from './distanceEstimate';

export type RoadRouteResult = {
  route: LatLng[];
  km: number;
  minutes: number;
  /** True when OSRM road geometry was used (free OSM routing — not Google). */
  byRoad: boolean;
};

/**
 * Free driving route via the public OSRM demo server (OpenStreetMap).
 * No API key, no Google billing. Falls back to haversine estimate on failure.
 *
 * @see http://project-osrm.org/
 */
export async function fetchDrivingRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<RoadRouteResult> {
  const fallback = estimateTravel(origin, destination);
  const fallbackRoute = buildFallbackRoute(origin, destination);

  try {
    // OSRM expects lon,lat (not lat,lon).
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;

    const response = await fetch(url);
    if (!response.ok) {
      return { route: fallbackRoute, km: fallback.km, minutes: fallback.minutes, byRoad: false };
    }

    const body = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    const first = body.routes?.[0];
    if (body.code !== 'Ok' || !first?.geometry?.coordinates?.length) {
      return { route: fallbackRoute, km: fallback.km, minutes: fallback.minutes, byRoad: false };
    }

    const route: LatLng[] = first.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    }));

    const km = Math.round((first.distance / 1000) * 10) / 10;
    const minutes = Math.max(1, Math.round(first.duration / 60));

    return { route, km, minutes, byRoad: true };
  } catch {
    return { route: fallbackRoute, km: fallback.km, minutes: fallback.minutes, byRoad: false };
  }
}
