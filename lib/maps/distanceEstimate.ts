import { TRAVEL_ESTIMATE } from '../../constants/delivery';
import type { LatLng } from './config';

/** Assumed effective urban travel speed for the road-distance fudge factor, in km/h. */
export const ASSUMED_ROAD_SPEED_KMH = TRAVEL_ESTIMATE.assumedRoadSpeedKmh;

/** Straight-line road fudge factor — real roads are never straight. */
export const ROAD_DISTANCE_FACTOR = TRAVEL_ESTIMATE.roadDistanceFactor;

export function haversineKm(a: LatLng, b: LatLng): number {
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

/** Rough "as the crow flies, plus road-wiggle" distance estimate — free, no API. */
export function estimateRoadDistanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_DISTANCE_FACTOR;
}

/** Rough travel time in minutes for a given road-distance estimate. */
export function estimateRoadMinutes(roadDistanceKm: number): number {
  if (roadDistanceKm <= 0) return 0;
  return Math.max(3, Math.round((roadDistanceKm / ASSUMED_ROAD_SPEED_KMH) * 60));
}

/** Convenience: distance + time between two points in one call. */
export function estimateTravel(a: LatLng, b: LatLng): { km: number; minutes: number } {
  const km = estimateRoadDistanceKm(a, b);
  return { km: Math.round(km * 10) / 10, minutes: estimateRoadMinutes(km) };
}

/** Straight-line polyline fallback when OSRM is unreachable. */
export function buildFallbackRoute(a: LatLng, b: LatLng, steps = 24): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }
  return points;
}

/** Opens Maps directions from origin → destination (free deep-link, no API key). */
export function googleMapsDirectionsUrl(origin: LatLng, destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
}

/** Opens the device's own Google Maps app/site for real turn-by-turn navigation. Free — no API key. */
export function googleMapsNavigateUrl(destination: LatLng, origin?: LatLng | null): string {
  if (origin) return googleMapsDirectionsUrl(origin, destination);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
}