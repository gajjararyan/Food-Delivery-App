import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { adminListKitchens, adminListOrders } from '../../../lib/api/admin';
import { formatInr } from '../../../lib/date';
import type { OrderStatus } from '../../../lib/types';

function statusTone(status: OrderStatus): 'success' | 'error' | 'neutral' | 'secondary' {
  if (status === 'delivered') return 'success';
  if (status === 'cancelled' || status === 'payment_failed') return 'error';
  if (status === 'out_for_delivery' || status === 'cooking') return 'secondary';
  return 'neutral';
}

/** Cross-kitchen order feed for ops. */
export default function AdminOrdersScreen() {
  const kitchensQuery = useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: async () => {
      const result = await adminListKitchens();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const result = await adminListOrders();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 12_000,
  });

  if (ordersQuery.isLoading) {
    return <LoadingState label="Loading orders…" />;
  }

  const orders = ordersQuery.data ?? [];
  const kitchenNameById = new Map(
    (kitchensQuery.data ?? []).map((k) => [k.id, k.kitchen_name] as const),
  );

  const openStatuses = new Set(['placed', 'accepted', 'cooking', 'out_for_delivery']);
  const live = orders.filter((o) => openStatuses.has(o.status)).length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.brand}>GharKaSwad Ops</Text>
      <Text style={styles.title}>All orders</Text>
      <Text style={styles.sub}>Live marketplace orders across every kitchen.</Text>
      <Text style={styles.counts}>
        {live} live · {delivered} delivered · {orders.length} shown
      </Text>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Customer checkouts will show up here for ops visibility."
          glyph="🧾"
        />
      ) : (
        orders.map((order) => {
          const snap = order.thali_snapshot ?? {};
          const fulfillment =
            snap.fulfillmentMode === 'delivery' ? 'delivery' : 'takeaway';
          const customerName =
            typeof snap.customerName === 'string' && snap.customerName.trim()
              ? snap.customerName.trim()
              : null;
          const kitchen = kitchenNameById.get(order.maker_id) ?? 'Kitchen';

          return (
            <Card key={order.id} elevated style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.amount}>{formatInr(order.total)}</Text>
                <Badge
                  label={order.status.replace(/_/g, ' ')}
                  tone={statusTone(order.status)}
                />
              </View>
              <Text style={styles.kitchen}>{kitchen}</Text>
              <Text style={styles.meta}>
                {fulfillment} · {order.meal_slot} · {order.meal_date}
                {customerName ? ` · ${customerName}` : ''}
              </Text>
              <Text style={styles.time}>{new Date(order.created_at).toLocaleString()}</Text>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  brand: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  counts: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  card: { gap: spacing.xs },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amount: { ...typography.headlineSm, color: colors.onSurface, fontSize: 18 },
  kitchen: { ...typography.labelMd, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  time: { ...typography.labelSm, color: colors.outline },
});
