import { Link, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeliveryMap } from '../../../components/customer/DeliveryMap';
import { OrderStatusTimeline } from '../../../components/customer/OrderStatusTimeline';
import { Button, ErrorState, LoadingState, StitchIcon } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdersRealtime } from '../../../hooks/useOrdersRealtime';
import { advanceOrderStatus, getOrder } from '../../../lib/api/orders';
import { fetchDeliveryTracking } from '../../../lib/api/tracking';
import { isDevAuthEnabled } from '../../../lib/devAuth';
import { buildInvoiceData, isOrderPaid } from '../../../lib/invoice';
import { googleMapsNavigateUrl } from '../../../lib/maps/distanceEstimate';
import {
  applyOriginRoute,
  withLiveOrigin,
  type DeliveryTrackingSnapshot,
} from '../../../lib/maps/driverLocation';
import { fetchDrivingRoute } from '../../../lib/maps/osrmRoute';
import type { LatLng } from '../../../lib/maps/config';
import { formatInr } from '../../../lib/date';
import type { OrderStatus } from '../../../lib/types';
import {
  customerStatusMessage,
  customerTimingHint,
  isTakeawayOrder,
  orderFulfillmentMode,
  shouldRevealPickupPin,
} from '../../../lib/orderStatus';
import { logger } from '../../../lib/logger';

function takeawayHeroTone(status: OrderStatus): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (status) {
    case 'out_for_delivery':
      return {
        bg: '#E8F5E9',
        fg: '#1B5E20',
        label: 'Ready — come grab it!',
      };
    case 'cooking':
    case 'accepted':
      return {
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
        label: status === 'cooking' ? 'Preparing your meal' : 'Accepted — cooking soon',
      };
    case 'delivered':
      return {
        bg: colors.surfaceContainerLow,
        fg: colors.onSurface,
        label: 'Picked up — enjoy!',
      };
    case 'cancelled':
    case 'payment_failed':
      return {
        bg: colors.errorContainer ?? '#FFCDD2',
        fg: colors.error,
        label: status === 'cancelled' ? 'Order cancelled' : 'Payment failed',
      };
    default:
      return {
        bg: colors.surfaceContainerLow,
        fg: colors.primary,
        label: 'Waiting for the kitchen',
      };
  }
}

/** Live order tracking — delivery partner for delivery, pickup timing for takeaway. */
export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const id = typeof orderId === 'string' ? orderId : '';
  const [tick, setTick] = useState(0);

  useOrdersRealtime({ orderId: id || null });

  const orderQuery = useQuery({
    queryKey: ['order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const result = await getOrder(id, user?.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 4000,
  });

  const order = orderQuery.data;
  const takeaway = order ? isTakeawayOrder(order) : false;
  const fulfillment = order ? orderFulfillmentMode(order) : 'delivery';

  const [liveOrigin, setLiveOrigin] = useState<LatLng | null>(null);
  const [locateStatus, setLocateStatus] = useState<'idle' | 'loading' | 'denied' | 'ready'>(
    'idle',
  );

  useEffect(() => {
    if (!takeaway) return;
    let cancelled = false;

    const locate = async () => {
      setLocateStatus('loading');
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!cancelled) setLocateStatus('denied');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setLiveOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocateStatus('ready');
      } catch (cause) {
        logger.warn('takeaway live location failed', cause);
        if (!cancelled) setLocateStatus('denied');
      }
    };

    void locate();
    return () => {
      cancelled = true;
    };
  }, [takeaway, order?.id]);

  useEffect(() => {
    if (!order) return;
    if (order.status !== 'out_for_delivery' && order.status !== 'cooking') return;
    const timer = setInterval(() => setTick((value) => value + 1), 4000);
    return () => clearInterval(timer);
  }, [order?.status, order?.id]);

  const trackingQuery = useQuery({
    queryKey: ['delivery-tracking', id, order?.status, order?.updated_at, tick],
    enabled: Boolean(order),
    queryFn: async () => fetchDeliveryTracking(order!),
    refetchInterval:
      order?.status === 'out_for_delivery' || order?.status === 'cooking' ? 4000 : false,
  });

  const baseTracking = trackingQuery.data;

  const roadRouteQuery = useQuery({
    queryKey: [
      'takeaway-road-route',
      id,
      liveOrigin?.lat,
      liveOrigin?.lng,
      baseTracking?.kitchen.lat,
      baseTracking?.kitchen.lng,
    ],
    enabled: Boolean(takeaway && liveOrigin && baseTracking),
    staleTime: 60_000,
    queryFn: async () => {
      const road = await fetchDrivingRoute(liveOrigin!, baseTracking!.kitchen);
      return applyOriginRoute(baseTracking!, liveOrigin!, road);
    },
  });

  const tracking = useMemo((): DeliveryTrackingSnapshot | undefined => {
    if (roadRouteQuery.data) return roadRouteQuery.data;
    if (!baseTracking) return undefined;
    if (!takeaway || !liveOrigin) return baseTracking;
    // Instant straight-line preview while OSRM road route loads.
    return withLiveOrigin(baseTracking, liveOrigin);
  }, [roadRouteQuery.data, baseTracking, takeaway, liveOrigin]);

  const statusLabel = useMemo(() => {
    if (!order) return 'Tracking your order';
    if (takeaway) return customerStatusMessage(order.status, 'takeaway');
    return tracking?.statusLabel ?? customerStatusMessage(order.status, fulfillment);
  }, [order, takeaway, tracking?.statusLabel, fulfillment]);
  const menuName = (order?.thali_snapshot?.menuName as string | undefined) ?? 'Thali';
  const kitchenName =
    (order?.thali_snapshot?.kitchenName as string | undefined) ??
    tracking?.kitchen.title ??
    'Kitchen';
  const kitchenAddress =
    typeof order?.thali_snapshot?.kitchenAddress === 'string'
      ? order.thali_snapshot.kitchenAddress
      : null;
  const timingHint = order ? customerTimingHint(order) : null;
  const paid = order ? isOrderPaid(order) : false;
  const invoice = order ? buildInvoiceData(order) : null;
  const hero = order && takeaway ? takeawayHeroTone(order.status) : null;

  const refreshLocation = async () => {
    setLocateStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocateStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLiveOrigin({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLocateStatus('ready');
    } catch (cause) {
      logger.warn('takeaway live location refresh failed', cause);
      setLocateStatus('denied');
    }
  };

  if (orderQuery.isLoading) return <LoadingState label="Loading order…" />;
  if (orderQuery.isError || !order) {
    return (
      <ErrorState
        message={orderQuery.error?.message ?? 'Order not found'}
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      {takeaway && hero ? (
        <View style={[styles.statusHero, { backgroundColor: hero.bg }]}>
          <Text style={[styles.statusHeroLabel, { color: hero.fg }]}>{hero.label}</Text>
          <Text style={styles.statusHeroMeta}>
            {menuName} · {formatInr(order.total)} · Takeaway
          </Text>
          {timingHint ? <Text style={styles.statusHeroHint}>{timingHint}</Text> : null}
        </View>
      ) : null}

      {tracking ? (
        <DeliveryMap tracking={tracking} />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Loading map…</Text>
        </View>
      )}

      {takeaway ? (
        <View style={styles.directionsCard}>
          <Text style={styles.directionsEyebrow}>Directions to kitchen</Text>
          {tracking?.showRoute &&
          tracking.travelKm != null &&
          tracking.travelMinutes != null ? (
            <>
              <Text style={styles.directionsTime}>{tracking.travelMinutes} min</Text>
              <Text style={styles.directionsKm}>
                {tracking.travelKm} km
                {tracking.byRoad ? ' by road' : ' approx.'}
                {tracking.liveOrigin ? ' · from your current location' : ' · from your pickup pin'}
                {roadRouteQuery.isFetching && !tracking.byRoad ? ' · loading road route…' : ''}
              </Text>
              <Text style={styles.directionsVia}>
                You → {kitchenName}
                {'\n'}
                {tracking.byRoad
                  ? 'Route follows roads (OpenStreetMap / OSRM — free). Tap below for Google Maps turn-by-turn.'
                  : 'Showing a quick estimate while the road route loads (or if routing is unavailable).'}
              </Text>
              {tracking.travelKm != null && tracking.travelKm > 25 ? (
                <Text style={styles.directionsWarn}>
                  This looks far for a local takeaway — check that the kitchen pin on the chef
                  profile is set to the real kitchen address (not a default city).
                </Text>
              ) : null}
              <Pressable
                style={styles.directionsNavBtn}
                onPress={() =>
                  void Linking.openURL(
                    googleMapsNavigateUrl(tracking.kitchen, {
                      lat: tracking.customer.lat,
                      lng: tracking.customer.lng,
                    }),
                  )
                }
                accessibilityRole="button"
              >
                <StitchIcon name="navigation" size={18} color={colors.onPrimary} />
                <Text style={styles.directionsNavText}>Open in Google Maps</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.directionsKm}>
                {locateStatus === 'loading'
                  ? 'Getting your current location…'
                  : locateStatus === 'denied'
                    ? 'Location permission needed to show distance to the kitchen.'
                    : 'Waiting for your location to draw You → Kitchen.'}
              </Text>
              <Button
                label={locateStatus === 'loading' ? 'Locating…' : 'Use my current location'}
                variant="outline"
                loading={locateStatus === 'loading'}
                onPress={() => void refreshLocation()}
              />
            </>
          )}
        </View>
      ) : null}

      {!takeaway ? (
        <>
          <Text style={styles.title}>Track order</Text>
          <Text style={styles.meta}>
            {menuName} · {formatInr(order.total)} · Delivery
          </Text>
          <Text style={styles.status}>{statusLabel}</Text>
          {timingHint ? <Text style={styles.timing}>{timingHint}</Text> : null}
          <View style={styles.estimateBanner}>
            <Text style={styles.estimateBannerText}>
              Estimated route only — live courier GPS is not connected yet. Timing may differ.
            </Text>
          </View>
          {tracking?.kitchenPinMissing ? (
            <Text style={styles.pinMissing}>
              Kitchen map pin is missing on this order — ask the cook to set their location.
            </Text>
          ) : null}
        </>
      ) : null}

      {takeaway && order.pickup_pin && shouldRevealPickupPin(order.status) ? (
        <View style={styles.pinCard}>
          <Text style={styles.pinLabel}>Show this code when collecting</Text>
          <Text style={styles.pinValue}>{order.pickup_pin}</Text>
        </View>
      ) : takeaway && order.pickup_pin && order.status === 'placed' ? (
        <View style={styles.pinCard}>
          <Text style={styles.pinLabel}>Pickup code</Text>
          <Text style={styles.pinWaiting}>
            Your code will appear here after the cook accepts this order.
          </Text>
        </View>
      ) : null}

      {takeaway ? (
        <View style={styles.pickupCard}>
          <Text style={styles.pickupLabel}>Pickup at kitchen</Text>
          <Text style={styles.pickupName}>{kitchenName}</Text>
          {kitchenAddress ? <Text style={styles.pickupAddress}>{kitchenAddress}</Text> : null}
          {order.status === 'out_for_delivery' ? (
            <Text style={styles.pickupReady}>Your order is ready — please collect it.</Text>
          ) : order.status === 'cooking' || order.status === 'accepted' ? (
            <Text style={styles.pickupWait}>
              We&apos;ll notify you here when it&apos;s ready for pickup.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.partnerRow}>
          <Image source={stitchImages.trackingPartner} style={styles.partnerPhoto} />
          <View style={styles.partnerMeta}>
            <Text style={styles.partnerName}>
              {tracking?.liveCourier
                ? tracking.driverName
                : 'Estimated delivery progress'}
            </Text>
            <Text style={styles.partnerRole}>
              {tracking?.liveCourier
                ? 'Your delivery partner'
                : 'No live courier assigned yet — showing an approximate route'}
            </Text>
            {tracking?.etaMinutes != null ? (
              <Text style={styles.eta}>
                {tracking.etaMinutes > 0
                  ? `Rough ETA ~${tracking.etaMinutes} min`
                  : 'Arrived at your door'}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <OrderStatusTimeline
        status={order.status}
        deliveryWindow={order.delivery_window}
        fulfillmentMode={fulfillment}
      />

      {paid && invoice ? (
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment confirmed</Text>
          <Text style={styles.paymentLine}>Invoice · {invoice.invoiceNumber}</Text>
          {invoice.razorpayPaymentId ? (
            <Text style={styles.paymentMono}>Txn · {invoice.razorpayPaymentId}</Text>
          ) : null}
          <View style={styles.paymentActions}>
            <Link href={`/(customer)/order/${order.id}` as Href} asChild>
              <Button label="Order details" variant="outline" />
            </Link>
            <Link href={`/(customer)/invoice/${order.id}` as Href} asChild>
              <Button label="View invoice" />
            </Link>
          </View>
        </View>
      ) : null}

      {order.status === 'delivered' ? (
        <Link href={`/(customer)/review/${order.id}`} asChild>
          <Button label="Rate this meal" />
        </Link>
      ) : isDevAuthEnabled() ? (
        <Button
          label="Advance status (dev)"
          variant="outline"
          onPress={async () => {
            await advanceOrderStatus(order.id);
            void orderQuery.refetch();
            void trackingQuery.refetch();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.md,
  },
  statusHero: {
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: 4,
  },
  statusHeroLabel: {
    ...typography.headlineMd,
    fontSize: 26,
    lineHeight: 32,
  },
  statusHeroMeta: { ...typography.labelSm, color: colors.onSurfaceVariant },
  statusHeroHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  mapPlaceholder: {
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  directionsCard: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  directionsEyebrow: { ...typography.labelSm, color: colors.onSurfaceVariant },
  directionsTime: {
    ...typography.headlineMd,
    fontSize: 28,
    lineHeight: 34,
    color: '#1B5E20',
  },
  directionsKm: { ...typography.labelMd, color: colors.onSurface },
  directionsVia: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
  directionsWarn: {
    ...typography.bodySm,
    color: colors.error,
    lineHeight: 20,
  },
  directionsNavBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.tertiary,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  directionsNavText: { ...typography.labelMd, color: colors.onPrimary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  meta: { ...typography.labelSm, color: colors.outline },
  status: { ...typography.labelMd, color: colors.primary },
  timing: { ...typography.bodyMd, color: colors.onSurface },
  estimateBanner: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  estimateBannerText: {
    ...typography.bodySm,
    color: colors.onSecondaryContainer,
  },
  pinMissing: {
    ...typography.bodySm,
    color: colors.error,
  },
  pinCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pinLabel: { ...typography.labelMd, color: colors.primary },
  pinValue: {
    ...typography.headlineMd,
    fontSize: 36,
    letterSpacing: 8,
    color: colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  pinWaiting: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  pickupCard: {
    gap: 4,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  pickupLabel: { ...typography.labelSm, color: colors.primary },
  pickupName: { ...typography.labelMd, color: colors.onSurface },
  pickupAddress: { ...typography.bodySm, color: colors.onSurfaceVariant },
  pickupReady: { ...typography.labelSm, color: colors.tertiary, marginTop: 4 },
  pickupWait: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 4 },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  partnerMeta: { flex: 1 },
  partnerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  partnerName: { ...typography.labelMd, color: colors.onSurface },
  partnerRole: { ...typography.bodySm, color: colors.onSurfaceVariant },
  eta: { ...typography.labelSm, color: colors.primary, marginTop: 2 },
  paymentCard: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  paymentTitle: { ...typography.labelMd, color: colors.tertiary },
  paymentLine: { ...typography.bodySm, color: colors.onSurface },
  paymentMono: { ...typography.labelSm, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  paymentActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
