import type { DeliveryTrackingSnapshot } from '../../lib/maps/driverLocation';
import { getGoogleMapsApiKey } from '../../lib/maps/config';

type GoogleMap = {
  fitBounds: (bounds: unknown, padding?: number) => void;
  setCenter: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarker = {
  setPosition: (position: { lat: number; lng: number }) => void;
  setMap: (map: GoogleMap | null) => void;
};

type GooglePolyline = {
  setPath: (path: Array<{ lat: number; lng: number }>) => void;
  setMap: (map: GoogleMap | null) => void;
};

let loader: Promise<void> | null = null;

export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return Promise.reject(new Error('Google Maps API key is missing'));

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-gharkaswad-maps="true"]',
      );
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      // Maps JavaScript API only (no Directions / Distance Matrix / Geocoding).
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset.gharkaswadMaps = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }

  return loader;
}

export type WebMapHandles = {
  map: GoogleMap;
  kitchenMarker: GoogleMarker;
  customerMarker: GoogleMarker | null;
  driverMarker: GoogleMarker | null;
  routeLine: GooglePolyline | null;
};

export function createWebMap(
  container: HTMLElement,
  tracking: DeliveryTrackingSnapshot,
): WebMapHandles {
  const googleMaps = window.google;
  if (!googleMaps?.maps) throw new Error('Google Maps is not loaded');

  const map = new googleMaps.maps.Map(container, {
    center: tracking.kitchen,
    zoom: tracking.showRoute || tracking.showDriver ? 13 : 15,
    disableDefaultUI: false,
    gestureHandling: 'greedy',
  });

  const kitchenMarker = new googleMaps.maps.Marker({
    map,
    position: tracking.kitchen,
    title: tracking.kitchen.title,
    label: 'K',
  });

  if (!tracking.showRoute && !tracking.showDriver) {
    return {
      map,
      kitchenMarker,
      customerMarker: null,
      driverMarker: null,
      routeLine: null,
    };
  }

  const customerMarker = new googleMaps.maps.Marker({
    map,
    position: tracking.customer,
    title: tracking.customer.title,
    label: tracking.fulfillmentMode === 'takeaway' ? 'P' : 'H',
  });

  let driverMarker: GoogleMarker | null = null;
  if (tracking.showDriver) {
    driverMarker = new googleMaps.maps.Marker({
      map,
      position: tracking.driver,
      title: tracking.driver.title,
      label: 'D',
    });
  }

  const routeLine = tracking.showRoute
    ? new googleMaps.maps.Polyline({
        map,
        path: tracking.route,
        strokeColor: '#E85D2C',
        strokeOpacity: 0.85,
        strokeWeight: 4,
      })
    : null;

  const bounds = new googleMaps.maps.LatLngBounds();
  bounds.extend(tracking.kitchen);
  bounds.extend(tracking.customer);
  if (tracking.showDriver) bounds.extend(tracking.driver);
  map.fitBounds(bounds, 48);

  return { map, kitchenMarker, customerMarker, driverMarker, routeLine };
}

export function updateWebMap(handles: WebMapHandles, tracking: DeliveryTrackingSnapshot): void {
  handles.kitchenMarker.setPosition(tracking.kitchen);
  if (!tracking.showRoute && !tracking.showDriver) {
    handles.map.setCenter(tracking.kitchen);
    handles.map.setZoom(15);
    handles.driverMarker?.setMap(null);
    handles.customerMarker?.setMap(null);
    handles.routeLine?.setMap(null);
    return;
  }
  handles.customerMarker?.setPosition(tracking.customer);
  if (tracking.showDriver) {
    handles.driverMarker?.setPosition(tracking.driver);
  }
  if (tracking.showRoute) {
    handles.routeLine?.setPath(tracking.route);
  }
}
