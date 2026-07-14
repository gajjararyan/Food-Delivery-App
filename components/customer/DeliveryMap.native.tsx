import { useMemo } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { DeliveryTrackingSnapshot } from '../../lib/maps/driverLocation';
import { isGoogleMapsConfigured } from '../../lib/maps/config';

type Props = {
  tracking: DeliveryTrackingSnapshot;
  style?: ViewStyle;
};

/** Native delivery map — Google when keyed, platform default map otherwise. Never a poster. */
export function DeliveryMap({ tracking, style }: Props) {
  const useGoogle = isGoogleMapsConfigured();

  const region = useMemo(() => {
    const lats = [tracking.kitchen.lat, tracking.customer.lat, tracking.driver.lat];
    const lngs = [tracking.kitchen.lng, tracking.customer.lng, tracking.driver.lng];
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.8),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.8),
    };
  }, [tracking]);

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        style={styles.map}
        provider={useGoogle ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={region}
        showsUserLocation={false}
        showsCompass
        showsScale={Platform.OS === 'ios'}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: tracking.kitchen.lat, longitude: tracking.kitchen.lng }}
          title={tracking.kitchen.title}
          description="Kitchen"
          pinColor="#E85D2C"
        />
        <Marker
          coordinate={{ latitude: tracking.customer.lat, longitude: tracking.customer.lng }}
          title={tracking.customer.title}
          description="Delivery address"
          pinColor="#2E7D32"
        />
        <Marker
          coordinate={{ latitude: tracking.driver.lat, longitude: tracking.driver.lng }}
          title={tracking.driver.title}
          description="Delivery partner"
          pinColor="#1565C0"
        />
        <Polyline
          coordinates={tracking.route.map((point) => ({
            latitude: point.lat,
            longitude: point.lng,
          }))}
          strokeColor="#E85D2C"
          strokeWidth={5}
        />
      </MapView>
      <View style={styles.etaPill}>
        <Text style={styles.etaText}>
          {tracking.etaMinutes > 0 ? `ETA ${tracking.etaMinutes} min` : 'Arrived'}
        </Text>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E85D2C' }]} />
          <Text style={styles.legendText}>Kitchen</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1565C0' }]} />
          <Text style={styles.legendText}>Driver</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
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
  },
  map: { flex: 1 },
  etaPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  etaText: { ...typography.labelSm, color: colors.onPrimary },
  legend: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.labelSm, color: colors.onSurface },
});
