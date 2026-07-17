import { getGoogleMapsApiKey, isGoogleMapsConfigured, type LatLng } from './config';

export type GeocodeResult = LatLng & {
  address: string;
  /** Shorter line for UI cards (road / area). */
  shortAddress?: string;
};

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  path?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
};

const cache = new Map<string, GeocodeResult>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Compact place line similar to Google Maps cards. */
export function buildShortAddress(
  parts: NominatimAddress,
  fallback?: string,
): string {
  const road =
    parts.road ??
    parts.pedestrian ??
    parts.path ??
    parts.neighbourhood;
  const area =
    parts.suburb ??
    parts.village ??
    parts.town ??
    parts.city ??
    parts.county ??
    parts.state_district;
  const city = parts.city && parts.city !== area ? parts.city : undefined;

  const bits = [road, area, city].filter(Boolean) as string[];
  if (bits.length > 0) return bits.join(', ');

  if (fallback) {
    // Take first 2–3 comma segments of Nominatim display_name.
    return fallback
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  }

  return 'Pinned location';
}

/** Reverse-geocode lat/lng → address (Google when keyed, else OpenStreetMap). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit) return hit;

  if (isGoogleMapsConfigured()) {
    const apiKey = getGoogleMapsApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      status: string;
      results?: Array<{ formatted_address: string }>;
      error_message?: string;
    };
    if (body.status === 'OK' && body.results?.[0]) {
      const address = body.results[0].formatted_address;
      const result: GeocodeResult = {
        lat,
        lng,
        address,
        shortAddress: address
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(', '),
      };
      cache.set(key, result);
      return result;
    }
    if (body.status !== 'ZERO_RESULTS') {
      throw new Error(body.error_message ?? `Geocode failed: ${body.status}`);
    }
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GharKaSwad/1.0 (food-delivery; contact@gharkaswad.app)',
      },
    },
  );
  const body = (await res.json()) as {
    display_name?: string;
    address?: NominatimAddress;
  };
  const address =
    body.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const result: GeocodeResult = {
    lat,
    lng,
    address,
    shortAddress: buildShortAddress(body.address ?? {}, body.display_name),
  };
  cache.set(key, result);
  return result;
}

/** Forward-geocode address → lat/lng (Google when keyed, else OpenStreetMap). */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (isGoogleMapsConfigured()) {
    const key = getGoogleMapsApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
      error_message?: string;
    };
    if (body.status === 'OK' && body.results?.length) {
      return body.results.slice(0, 5).map((r) => ({
        address: r.formatted_address,
        shortAddress: r.formatted_address
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(', '),
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }));
    }
    if (body.status === 'ZERO_RESULTS') return [];
    throw new Error(body.error_message ?? `Geocode failed: ${body.status}`);
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=in&q=${encodeURIComponent(q)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GharKaSwad/1.0 (food-delivery; contact@gharkaswad.app)',
      },
    },
  );
  const body = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: NominatimAddress;
  }>;
  return body.map((r) => ({
    address: r.display_name,
    shortAddress: buildShortAddress(r.address ?? {}, r.display_name),
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
