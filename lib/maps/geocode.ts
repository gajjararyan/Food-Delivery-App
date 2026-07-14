import { getGoogleMapsApiKey, isGoogleMapsConfigured, type LatLng } from './config';

export type GeocodeResult = LatLng & {
  address: string;
};

/** Reverse-geocode lat/lng → address (Google when keyed, else OpenStreetMap). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  if (isGoogleMapsConfigured()) {
    const key = getGoogleMapsApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      status: string;
      results?: Array<{ formatted_address: string }>;
      error_message?: string;
    };
    if (body.status === 'OK' && body.results?.[0]) {
      return { lat, lng, address: body.results[0].formatted_address };
    }
    if (body.status !== 'ZERO_RESULTS') {
      throw new Error(body.error_message ?? `Geocode failed: ${body.status}`);
    }
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { Accept: 'application/json', 'User-Agent': 'GharKaSwad/1.0' } },
  );
  const body = (await res.json()) as { display_name?: string };
  return {
    lat,
    lng,
    address: body.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
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
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }));
    }
    if (body.status === 'ZERO_RESULTS') return [];
    throw new Error(body.error_message ?? `Geocode failed: ${body.status}`);
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json', 'User-Agent': 'GharKaSwad/1.0' } },
  );
  const body = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return body.map((r) => ({
    address: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
