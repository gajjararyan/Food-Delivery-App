import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui';
import {
  colors,
  radius,
  spacing,
  typography,
} from '../../constants/theme';
import { loadLeaflet } from '../../lib/maps/leafletLoader.web';
import { DELIVERY_LOCATIONS } from '../../constants/delivery';
import { formatCoordsLabel } from '../../lib/maps/formatLocation';

type Props = {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (point: { lat: number; lng: number }) => void;
  confirmLabel?: string;
  /** Grow map to fill modal / parent height. */
  fill?: boolean;
  /** Fixed map height when `fill` is false. */
  mapHeight?: number;
};

type LeafletMap = {
  remove: () => void;
  getCenter: () => { lat: number; lng: number };
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  on: (event: string, handler: () => void) => void;
  invalidateSize: () => void;
};

export function LocationPickerMap({
  initialLat,
  initialLng,
  onConfirm,
  confirmLabel = 'Confirm location',
  fill = false,
  mapHeight = 360,
}: Props) {
  const hostRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const startLat = initialLat ?? DELIVERY_LOCATIONS.kitchen.lat;
  const startLng = initialLng ?? DELIVERY_LOCATIONS.kitchen.lng;

  const [center, setCenter] = useState({
    lat: startLat,
    lng: startLng,
  });

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      await loadLeaflet();

      if (cancelled || !hostRef.current) return;

      const L = window.L;
      if (!L) return;

      const map = L.map(hostRef.current).setView(
        [startLat, startLng],
        16,
      ) as unknown as LeafletMap;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map as any);

      map.on('move', () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
      });

      mapRef.current = map;

      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    void initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('Location is not available on this device.');
      return;
    }

    setLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        mapRef.current?.setView([latitude, longitude], 17);
        setCenter({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => {
        setLocateError(
          'Could not get your location. Move the map manually instead.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <View style={[styles.wrap, fill && styles.wrapFill]}>
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          Drag the map until the pin sits on your exact entrance or pickup point
        </Text>
      </View>

      <View
        style={[
          styles.mapFrame,
          fill ? styles.mapFrameFill : { height: mapHeight },
        ]}
      >
        <View
          style={styles.mapHost}
          ref={(node) => {
            hostRef.current = node as unknown as HTMLElement;
          }}
        />

        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pinWrap}>
            <View style={styles.pinHead}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinTip} />
            <View style={styles.pinShadow} />
          </View>
        </View>

        {locateError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{locateError}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.coordsBar}>
        <Text style={styles.coordsLabel}>Pin at</Text>
        <Text style={styles.coordsValue}>
          {formatCoordsLabel(center.lat, center.lng)}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label={locating ? 'Locating...' : 'Use current location'}
          variant="outline"
          loading={locating}
          onPress={useCurrentLocation}
        />
        <Button label={confirmLabel} onPress={() => onConfirm(center)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: spacing.md,
  },
  wrapFill: {
    flex: 1,
    minHeight: 0,
  },
  hintBar: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  hintText: {
    ...typography.bodySm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  mapFrame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  mapFrameFill: {
    flex: 1,
    minHeight: 280,
  },
  mapHost: {
    ...StyleSheet.absoluteFill,
  },
  pinOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge pin tip to map center (pin graphic extends below center point).
    paddingBottom: 28,
  },
  pinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  pinTip: {
    marginTop: -5,
    width: 14,
    height: 14,
    backgroundColor: colors.primary,
    transform: [{ rotate: '45deg' }],
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  pinShadow: {
    width: 18,
    height: 6,
    borderRadius: radius.full,
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  errorBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
  },
  coordsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  coordsLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  coordsValue: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  footer: {
    gap: spacing.sm,
    width: '100%',
  },
});
