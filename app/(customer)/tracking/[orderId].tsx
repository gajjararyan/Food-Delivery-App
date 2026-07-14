import { Link, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeliveryMap } from '../../../components/customer/DeliveryMap';
import { OrderStatusTimeline } from '../../../components/customer/OrderStatusTimeline';
import { Button, ErrorState, LoadingState } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdersRealtime } from '../../../hooks/useOrdersRealtime';
import { advanceOrderStatus, getOrder } from '../../../lib/api/orders';
import { fetchDeliveryTracking } from '../../../lib/api/tracking';
import { isDevAuthEnabled } from '../../../lib/devAuth';
import { buildInvoiceData, isOrderPaid } from '../../../lib/invoice';
import { isGoogleMapsConfigured } from '../../../lib/maps/config';
import { formatInr } from '../../../lib/date';
import {
  customerStatusMessage,
  customerTimingHint,
  isTakeawayOrder,
  orderFulfillmentMode,
} from '../../../lib/orderStatus';

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

  const tracking = trackingQuery.data;
  // Prefer fulfillment-aware copy so takeaway never shows delivery-partner text.
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
      {tracking ? (
        <DeliveryMap tracking={tracking} />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Loading map…</Text>
        </View>
      )}

      <Text style={styles.title}>Track order</Text>
      <Text style={styles.meta}>
        {menuName} · {formatInr(order.total)} · {takeaway ? 'Takeaway' : 'Delivery'}
      </Text>
      <Text style={styles.status}>{statusLabel}</Text>
      {timingHint ? <Text style={styles.timing}>{timingHint}</Text> : null}

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
            <Text style={styles.partnerName}>{tracking?.driverName ?? 'Ramesh'}</Text>
            <Text style={styles.partnerRole}>Your delivery partner</Text>
            {tracking?.etaMinutes != null ? (
              <Text style={styles.eta}>
                {tracking.etaMinutes > 0
                  ? `Estimated arrival in ${tracking.etaMinutes} min`
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

      {!isGoogleMapsConfigured() ? (
        <Text style={styles.note}>
          Showing live map tiles. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env for Google Maps.
        </Text>
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
  mapPlaceholder: {
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  title: { ...typography.headlineMd, color: colors.onBackground },
  meta: { ...typography.labelSm, color: colors.outline },
  status: { ...typography.labelMd, color: colors.primary },
  timing: { ...typography.bodyMd, color: colors.onSurface },
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
  note: { ...typography.bodySm, color: colors.onSurfaceVariant },
});
