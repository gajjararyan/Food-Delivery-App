/**
 * Shared Window.google / Window.L typings for web map loaders.
 * Keep a single ambient declaration so KitchenPinMap, DeliveryMap, and
 * googleMapsLoader.web do not fight over incompatible Window merges.
 */

type GharKaSwadGoogleMap = {
  fitBounds: (bounds: unknown, padding?: number) => void;
  setCenter: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  setTilt?: (tilt: number) => void;
  setMapTypeId?: (id: string) => void;
};

type GharKaSwadGoogleMarker = {
  setPosition: (position: { lat: number; lng: number }) => void;
  setMap: (map: GharKaSwadGoogleMap | null) => void;
  addListener: (event: string, handler: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
};

type GharKaSwadGooglePolyline = {
  setPath: (path: Array<{ lat: number; lng: number }>) => void;
  setMap: (map: GharKaSwadGoogleMap | null) => void;
};

type GharKaSwadLeafletMap = {
  remove: () => void;
  setView: (latlng: [number, number], zoom?: number) => void;
  fitBounds: (bounds: unknown, opts?: object) => void;
};

type GharKaSwadLeafletMarker = {
  addTo: (map: GharKaSwadLeafletMap) => GharKaSwadLeafletMarker;
  setLatLng: (latlng: [number, number]) => void;
  getLatLng: () => { lat: number; lng: number };
  bindPopup: (html: string) => GharKaSwadLeafletMarker;
  on: (event: string, handler: () => void) => void;
  remove: () => void;
};

type GharKaSwadLeafletPolyline = {
  addTo: (map: GharKaSwadLeafletMap) => GharKaSwadLeafletPolyline;
  setLatLngs: (latlngs: Array<[number, number]>) => void;
  remove: () => void;
};

type GharKaSwadLeafletNamespace = {
  map: (el: HTMLElement, opts?: object) => GharKaSwadLeafletMap;
  tileLayer: (
    url: string,
    opts?: object,
  ) => { addTo: (map: GharKaSwadLeafletMap) => void };
  marker: (
    latlng: [number, number],
    opts?: object,
  ) => GharKaSwadLeafletMarker;
  polyline: (
    latlngs: Array<[number, number]>,
    opts?: object,
  ) => GharKaSwadLeafletPolyline;
  divIcon: (opts: {
    className?: string;
    html: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }) => unknown;
  featureGroup: (layers: unknown[]) => { getBounds: () => unknown };
};

type GharKaSwadGoogleNamespace = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: {
        center: { lat: number; lng: number };
        zoom: number;
        disableDefaultUI?: boolean;
        gestureHandling?: string;
        mapTypeId?: string;
        tilt?: number;
        heading?: number;
        [key: string]: unknown;
      },
    ) => GharKaSwadGoogleMap;
    Marker: new (opts: {
      map: GharKaSwadGoogleMap | null;
      position: { lat: number; lng: number };
      title?: string;
      label?: string;
      draggable?: boolean;
      [key: string]: unknown;
    }) => GharKaSwadGoogleMarker;
    Polyline: new (opts: {
      map: GharKaSwadGoogleMap | null;
      path: Array<{ lat: number; lng: number }>;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }) => GharKaSwadGooglePolyline;
    LatLngBounds: new () => {
      extend: (point: { lat: number; lng: number }) => void;
    };
    MapTypeId?: { HYBRID: string; ROADMAP: string; SATELLITE: string };
  };
};

declare global {
  interface Window {
    google?: GharKaSwadGoogleNamespace;
    L?: GharKaSwadLeafletNamespace;
  }
}

export {};
