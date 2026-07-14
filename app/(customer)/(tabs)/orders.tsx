import { Link, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, EmptyState, ErrorState, LoadingState, StitchIcon } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdersRealtime } from '../../../hooks/useOrdersRealtime';
import { listOrders } from '../../../lib/api/orders';
import { buildInvoiceData, isOrderPaid } from '../../../lib/invoice';
import { orderFulfillmentMode, orderStatusLabel } from '../../../lib/orderStatus';
import { formatInr } from '../../../lib/date';

/** Order history with links to details, tracking, and invoice. */
export default function OrdersTab() {
  const router = useRouter();
  const { user, profile, status } = useAuth();

  useOrdersRealtime({ customerId: user?.id });

  const ordersQuery = useQuery({
    queryKey: ['orders', user?.id],
    enabled: status === 'signedIn' && Boolean(user?.id),
    queryFn: async () => {
      const result = await listOrders(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
  });

  if (status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          title="Sign in to see orders"
          description="Your past tiffins will show up here."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  if (ordersQuery.isLoading) return <LoadingState label="Loading orders…" />;
  if (ordersQuery.isError) {
    return (
      <ErrorState
        message={ordersQuery.error.message}
        onRetry={() => void ordersQuery.refetch()}
      />
    );
  }

  const orders = ordersQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.lead}>Track meals, view payment details, and download invoices.</Text>

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your first thali will appear here after checkout."
            glyph="📦"
            actionLabel="Discover kitchens"
            onAction={() => router.replace('/(customer)/(tabs)/home')}
          />
        ) : (
          orders.map((order) => {
            const paid = isOrderPaid(order);
            const invoice = buildInvoiceData(order, profile ?? undefined);
            const fulfillment = orderFulfillmentMode(order);

            return (
              <Card key={order.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.meal}>
                    {(order.thali_snapshot?.menuName as string) ?? 'Thali'}
                  </Text>
                  <Badge
                    label={orderStatusLabel(order.status, fulfillment)}
                    tone={order.status === 'payment_failed' ? 'neutral' : 'neutral'}
                  />
                </View>
                <Text style={styles.meta}>
                  {(order.thali_snapshot?.kitchenName as string) ?? 'Kitchen'} · {order.meal_date} ·{' '}
                  {order.delivery_window} · {fulfillment === 'takeaway' ? 'Takeaway' : 'Delivery'}
                </Text>
                <Text style={styles.amount}>{formatInr(order.total)}</Text>

                {paid && invoice.invoiceNumber ? (
                  <Text style={styles.invoiceRef}>Invoice · {invoice.invoiceNumber}</Text>
                ) : null}
                {paid && invoice.razorpayPaymentId ? (
                  <Text style={styles.txn}>Payment · {invoice.razorpayPaymentId}</Text>
                ) : null}

                <View style={styles.actions}>
                  <Link href={`/(customer)/order/${order.id}` as Href} asChild>
                    <Pressable hitSlop={8}>
                      <Text style={styles.link}>Details</Text>
                    </Pressable>
                  </Link>
                  <Link href={`/(customer)/tracking/${order.id}`} asChild>
                    <Pressable hitSlop={8}>
                      <Text style={styles.link}>Track</Text>
                    </Pressable>
                  </Link>
                  {paid ? (
                    <Link href={`/(customer)/invoice/${order.id}` as Href} asChild>
                      <Pressable hitSlop={8} style={styles.invoiceBtn}>
                        <StitchIcon name="payment" size={16} color={colors.primary} />
                        <Text style={styles.link}>Invoice</Text>
                      </Pressable>
                    </Link>
                  ) : (
                    <Pressable hitSlop={8} onPress={() => router.push('/(customer)/checkout')}>
                      <Text style={styles.linkAccent}>Pay</Text>
                    </Pressable>
                  )}
                  {order.status === 'delivered' ? (
                    <Link href={`/(customer)/review/${order.id}`} asChild>
                      <Pressable hitSlop={8}>
                        <Text style={styles.link}>Rate</Text>
                      </Pressable>
                    </Link>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.margin, gap: spacing.base, paddingBottom: spacing.xxl },
  title: { ...typography.headlineMd, color: colors.onBackground },
  lead: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  card: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meal: { ...typography.headlineSm, color: colors.onSurface, flex: 1 },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  amount: { ...typography.labelMd, color: colors.primary },
  invoiceRef: { ...typography.labelSm, color: colors.onSurfaceVariant },
  txn: { ...typography.labelSm, color: colors.outline, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'center' },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { ...typography.labelMd, color: colors.primary },
  linkAccent: { ...typography.labelMd, color: colors.secondary },
});
