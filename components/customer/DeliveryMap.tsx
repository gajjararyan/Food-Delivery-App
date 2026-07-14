import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { DeliveryTrackingSnapshot } from '../../lib/maps/driverLocation';
import { isGoogleMapsConfigured } from '../../lib/maps/config';
import {
  createWebMap,
  loadGoogleMapsScript,
  updateWebMap,
  type WebMapHandles,
} from '../../lib/maps/googleMapsLoader.web';

type Props = {
  tracking: DeliveryTrackingSnapshot;
  style?: ViewStyle;
};

type LeafletMap = {
  remove: () => void;
  fitBounds: (bounds: unknown, opts?: object) => void;
  setView: (latlng: [number, number], zoom?: number) => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  setLatLng: (latlng: [number, number]) => void;
  bindPopup: (html: string) => LeafletMarker;
  remove: () => void;
};

type LeafletPolyline = {
  addTo: (map: LeafletMap) => LeafletPolyline;
  setLatLngs: (latlngs: Array<[number, number]>) => void;
  remove: () => void;
};

let leafletLoader: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-gharkaswad-leaflet="true"]');
    if (!existingCss) {
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

type OsmHandles = {
  map: LeafletMap;
  kitchenMarker: LeafletMarker;
  customerMarker: LeafletMarker | null;
  driverMarker: LeafletMarker | null;
  routeLine: LeafletPolyline | null;
};

function pinHtml(label: string, color: string): string {
  return `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);font:700 11px/1 system-ui">${label}</span></div>`;
}

function createOsmMap(container: HTMLElement, tracking: DeliveryTrackingSnapshot): OsmHandles {
  const L = window.L;
  if (!L) throw new Error('Leaflet is not loaded');

  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const kitchenMarker = L.marker([tracking.kitchen.lat, tracking.kitchen.lng], {
    icon: L.divIcon({
      className: '',
      html: pinHtml('K', '#E85D2C'),
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    }),
  })
    .addTo(map)
    .bindPopup(tracking.kitchen.title);

  if (!tracking.showDriver) {
    map.setView([tracking.kitchen.lat, tracking.kitchen.lng], 15);
    return {
      map,
      kitchenMarker,
      customerMarker: null,
      driverMarker: null,
      routeLine: null,
    };
  }

  const customerMarker = L.marker([tracking.customer.lat, tracking.customer.lng], {
    icon: L.divIcon({
      className: '',
      html: pinHtml('H', '#2E7D32'),
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    }),
  })
    .addTo(map)
    .bindPopup(tracking.customer.title);

  const driverMarker = L.marker([tracking.driver.lat, tracking.driver.lng], {
    icon: L.divIcon({
      className: '',
      html: pinHtml('D', '#1565C0'),
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    }),
  })
    .addTo(map)
    .bindPopup(tracking.driver.title);

  const routeLine = L.polyline(
    tracking.route.map((p) => [p.lat, p.lng] as [number, number]),
    { color: '#E85D2C', weight: 5, opacity: 0.9 },
  ).addTo(map);

  const group = L.featureGroup([kitchenMarker, customerMarker, driverMarker, routeLine]);
  map.fitBounds(group.getBounds(), { padding: [40, 40] });

  return { map, kitchenMarker, customerMarker, driverMarker, routeLine };
}

function updateOsmMap(handles: OsmHandles, tracking: DeliveryTrackingSnapshot): void {
  handles.kitchenMarker.setLatLng([tracking.kitchen.lat, tracking.kitchen.lng]);
  if (!tracking.showDriver) {
    handles.map.setView([tracking.kitchen.lat, tracking.kitchen.lng], 15);
    return;
  }
  handles.driverMarker?.setLatLng([tracking.driver.lat, tracking.driver.lng]);
  handles.routeLine?.setLatLngs(tracking.route.map((p) => [p.lat, p.lng] as [number, number]));
}

/** Interactive map — kitchen-only for takeaway; kitchen + driver route for delivery. */
export function DeliveryMap({ tracking, style }: Props) {
  const googleHandlesRef = useRef<WebMapHandles | null>(null);
  const osmHandlesRef = useRef<OsmHandles | null>(null);
  const [mapHost, setMapHost] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [provider, setProvider] = useState<'google' | 'osm' | null>(null);

  const legend = useMemo(() => {
    if (!tracking.showDriver) {
      return [{ key: 'K', label: 'Kitchen (pickup)', color: '#E85D2C' }];
    }
    return [
      { key: 'K', label: 'Kitchen', color: '#E85D2C' },
      { key: 'D', label: 'Driver', color: '#1565C0' },
      { key: 'H', label: 'You', color: '#2E7D32' },
    ];
  }, [tracking.showDriver]);

  useEffect(() => {
    if (!mapHost) return;
    let cancelled = false;

    const boot = async () => {
      try {
        if (isGoogleMapsConfigured()) {
          await loadGoogleMapsScript();
          if (cancelled || !mapHost) return;
          googleHandlesRef.current = createWebMap(mapHost, tracking);
          setProvider('google');
        } else {
          await loadLeaflet();
          if (cancelled || !mapHost) return;
          osmHandlesRef.current = createOsmMap(mapHost, tracking);
          setProvider('osm');
        }
        setReady(true);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        try {
          await loadLeaflet();
          if (cancelled || !mapHost) return;
          osmHandlesRef.current = createOsmMap(mapHost, tracking);
          setProvider('osm');
          setReady(true);
          setError(null);
        } catch {
          setError(err instanceof Error ? err.message : 'Map failed to load');
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      osmHandlesRef.current?.map.remove();
      osmHandlesRef.current = null;
      googleHandlesRef.current = null;
      setReady(false);
      setProvider(null);
      if (mapHost) mapHost.innerHTML = '';
    };
    // Re-init when switching delivery ↔ takeaway so markers match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapHost, tracking.showDriver]);

  useEffect(() => {
    if (!ready) return;
    if (provider === 'google' && googleHandlesRef.current) {
      updateWebMap(googleHandlesRef.current, tracking);
    }
    if (provider === 'osm' && osmHandlesRef.current) {
      updateOsmMap(osmHandlesRef.current, tracking);
    }
  }, [tracking, ready, provider]);

  const etaText = !tracking.showDriver
    ? tracking.etaMinutes > 0
      ? `Ready in ~${tracking.etaMinutes} min`
      : 'Ready for pickup'
    : tracking.etaMinutes > 0
      ? `ETA ${tracking.etaMinutes} min`
      : 'Arrived';

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={styles.map}
        ref={(node) => {
          if (node) setMapHost(node as unknown as HTMLElement);
        }}
      />
      {!ready && !error ? (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.etaPill}>
        <Text style={styles.etaText}>{etaText}</Text>
      </View>
      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFill },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,245,0.7)',
  },
  loadingText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  banner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.errorContainer ?? '#fdecea',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  bannerText: { ...typography.bodySm, color: colors.error },
  etaPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  etaText: { ...typography.labelSm, color: colors.onPrimary },
  legend: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.labelSm, color: colors.onSurface },
});
