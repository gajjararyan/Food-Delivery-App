import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { isGoogleMapsConfigured } from '../../lib/maps/config';
import { loadGoogleMapsScript } from '../../lib/maps/googleMapsLoader.web';

type Props = {
  lat: number;
  lng: number;
  title?: string;
  onPinChange?: (lat: number, lng: number) => void;
};

type PinGoogleMap = {
  setCenter: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  setTilt?: (tilt: number) => void;
  setMapTypeId?: (id: string) => void;
};

type PinGoogleMarker = {
  setPosition: (position: { lat: number; lng: number }) => void;
  setMap: (map: PinGoogleMap | null) => void;
  addListener: (event: string, handler: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
};

type PinLeafletMap = {
  remove: () => void;
  setView: (latlng: [number, number], zoom?: number) => void;
  fitBounds?: (bounds: unknown, opts?: object) => void;
};

type PinLeafletMarker = {
  addTo: (map: PinLeafletMap) => PinLeafletMarker;
  setLatLng: (latlng: [number, number]) => void;
  getLatLng: () => { lat: number; lng: number };
  on: (event: string, handler: () => void) => void;
  remove: () => void;
};

let leafletLoader: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-gharkaswad-leaflet="true"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.gharkaswadLeaflet = 'true';
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-gharkaswad-leaflet="true"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Map failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.gharkaswadLeaflet = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Map failed to load'));
    document.head.appendChild(script);
  });

  return leafletLoader;
}

function pinHtml(): string {
  return `<div style="background:#9d3e18;color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);font:700 11px/1 system-ui">K</span></div>`;
}

/**
 * Web kitchen pin map — Google hybrid (tilted) when API key is set,
 * otherwise OpenStreetMap street tiles so chefs always see a real map.
 */
export function KitchenPinMap({ lat, lng, title = 'Your kitchen', onPinChange }: Props) {
  const [mapHost, setMapHost] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'google' | 'osm' | null>(null);
  const googleRef = useRef<{ map: PinGoogleMap; marker: PinGoogleMarker } | null>(null);
  const osmRef = useRef<{ map: PinLeafletMap; marker: PinLeafletMarker } | null>(null);
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;

  useEffect(() => {
    if (!mapHost) return;
    let cancelled = false;

    const boot = async () => {
      try {
        if (isGoogleMapsConfigured()) {
          await loadGoogleMapsScript();
          if (cancelled || !mapHost) return;
          const g = window.google;
          if (!g?.maps) throw new Error('Google Maps unavailable');

          const map = new g.maps.Map(mapHost, {
            center: { lat, lng },
            zoom: 18,
            mapTypeId: g.maps.MapTypeId?.HYBRID ?? 'hybrid',
            tilt: 45,
            heading: 0,
            gestureHandling: 'greedy',
            disableDefaultUI: false,
          });
          const marker = new g.maps.Marker({
            map,
            position: { lat, lng },
            title,
            draggable: Boolean(onPinChangeRef.current),
          });
          marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            if (!pos) return;
            onPinChangeRef.current?.(pos.lat(), pos.lng());
          });
          googleRef.current = { map: map as PinGoogleMap, marker: marker as PinGoogleMarker };
          setProvider('google');
        } else {
          await loadLeaflet();
          if (cancelled || !mapHost) return;
          const L = window.L;
          if (!L) throw new Error('Map library unavailable');

          const map = L.map(mapHost, { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap',
          }).addTo(map);
          const marker = L.marker([lat, lng], {
            draggable: Boolean(onPinChangeRef.current),
            icon: L.divIcon({
              className: '',
              html: pinHtml(),
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
            onPinChangeRef.current?.(pos.lat, pos.lng);
          });
          map.setView([lat, lng], 17);
          osmRef.current = { map: map as PinLeafletMap, marker: marker as PinLeafletMarker };
          setProvider('osm');
        }
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (cause) {
        if (cancelled) return;
        try {
          await loadLeaflet();
          if (cancelled || !mapHost) return;
          const L = window.L;
          if (!L) throw cause;
          const map = L.map(mapHost, { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap',
          }).addTo(map);
          const marker = L.marker([lat, lng], {
            draggable: Boolean(onPinChangeRef.current),
            icon: L.divIcon({
              className: '',
              html: pinHtml(),
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
            onPinChangeRef.current?.(pos.lat, pos.lng);
          });
          map.setView([lat, lng], 17);
          osmRef.current = { map: map as PinLeafletMap, marker: marker as PinLeafletMarker };
          setProvider('osm');
          setReady(true);
          setError(null);
        } catch {
          setError(cause instanceof Error ? cause.message : 'Map failed to load');
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      osmRef.current?.map.remove();
      osmRef.current = null;
      googleRef.current = null;
      setReady(false);
      setProvider(null);
      mapHost.innerHTML = '';
    };
    // Boot once per host; position updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapHost]);

  useEffect(() => {
    if (!ready) return;
    if (provider === 'google' && googleRef.current) {
      googleRef.current.marker.setPosition({ lat, lng });
      googleRef.current.map.setCenter({ lat, lng });
      googleRef.current.map.setTilt?.(45);
    }
    if (provider === 'osm' && osmRef.current) {
      osmRef.current.marker.setLatLng([lat, lng]);
      osmRef.current.map.setView([lat, lng], 17);
    }
  }, [lat, lng, ready, provider]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapFrame}>
        <View
          style={styles.map}
          ref={(node) => {
            if (node) setMapHost(node as unknown as HTMLElement);
          }}
        />
        {!ready && !error ? (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.overlayText}>Loading street map…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
      {ready ? (
        <Text style={styles.caption}>Street map · drag the pin to adjust</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  mapFrame: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,245,0.72)',
  },
  overlayText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
  caption: { ...typography.labelSm, color: colors.onSurfaceVariant },
});
