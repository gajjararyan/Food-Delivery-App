import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { loadLeaflet } from '../../lib/maps/leafletLoader.web';

type Props = {
  lat: number;
  lng: number;
  /** Optional second pin (e.g. kitchen when showing route context). */
  secondLat?: number;
  secondLng?: number;
  height?: number;
};

type LeafletMap = {
  remove: () => void;
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  fitBounds: (bounds: unknown, opts?: object) => void;
  invalidateSize: () => void;
};

function buildPinIconHtml(fill: string): string {
  return `
    <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 1C7.37 1 2 6.37 2 13c0 9.17 10.17 18.84 11.23 19.84a1.1 1.1 0 0 0 1.54 0C15.83 31.84 26 22.17 26 13 26 6.37 20.63 1 14 1Z" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="13" r="4.5" fill="#ffffff"/>
    </svg>
  `;
}

/**
 * Read-only map preview — shows where the user pinned (and optional second point).
 * Web / Leaflet only (same stack as LocationPickerMap).
 */
export function LocationPreviewMap({
  lat,
  lng,
  secondLat,
  secondLng,
  height = 160,
}: Props) {
  const hostRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;

    const boot = async () => {
      await loadLeaflet();
      if (cancelled || !hostRef.current) return;
      const L = window.L;
      if (!L) return;

      const map = L.map(hostRef.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: false,
      }) as unknown as LeafletMap;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OSM',
      }).addTo(map as any);

      const primary = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: buildPinIconHtml('#2E7D32'),
          iconSize: [28, 40],
          iconAnchor: [14, 40],
        }),
      }).addTo(map as any);

      const layers: unknown[] = [primary];

      if (secondLat != null && secondLng != null) {
        const secondary = L.marker([secondLat, secondLng], {
          icon: L.divIcon({
            className: '',
            html: buildPinIconHtml('#E85D2C'),
            iconSize: [28, 40],
            iconAnchor: [14, 40],
          }),
        }).addTo(map as any);
        layers.push(secondary);
        const group = L.featureGroup(layers as never);
        map.fitBounds(group.getBounds(), { padding: [24, 24] });
      } else {
        map.setView([lat, lng], 16);
      }

      requestAnimationFrame(() => {
        map.invalidateSize();
      });

      mapRef.current = map;
    };

    void boot();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, secondLat, secondLng]);

  return (
    <View style={[styles.wrap, { height }]}>
      <View
        style={styles.map}
        ref={(node) => {
          hostRef.current = node as unknown as HTMLElement;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  map: { flex: 1 },
});
