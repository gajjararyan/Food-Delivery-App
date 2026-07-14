import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InvoiceDocument } from '../../../components/customer/InvoiceDocument';
import { OrderStatusTimeline } from '../../../components/customer/OrderStatusTimeline';
import { Badge, Button, Card, ErrorState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getOrder } from '../../../lib/api/orders';
import { buildInvoiceData, isOrderPaid } from '../../../lib/invoice';
import { downloadInvoice, printInvoice } from '../../../lib/invoicePrint';
import { formatInr } from '../../../lib/date';
import { orderFulfillmentMode, orderStatusLabel } from '../../../lib/orderStatus';

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const id = typeof orderId === 'string' ? orderId : '';

  const orderQuery = useQuery({
    queryKey: ['order', id],
    enabled: Boolean(id && user?.id),
    queryFn: async () => {
      const result = await getOrder(id, user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (orderQuery.isLoading) return <LoadingState label="Loading order…" />;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <ErrorState
        message={orderQuery.error?.message ?? 'Order not found'}
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = orderQuery.data;
  const fulfillment = orderFulfillmentMode(order);
  const menuName = (order.thali_snapshot?.menuName as string) ?? 'Thali';
  const kitchenName = (order.thali_snapshot?.kitchenName as string) ?? 'Kitchen';
  const paid = isOrderPaid(order);
  const invoice = buildInvoiceData(order, profile ?? undefined);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Order details</Text>
          <Badge label={orderStatusLabel(order.status, fulfillment)} tone="neutral" />
        </View>

        <Card style={styles.card}>
          <Text style={styles.meal}>{menuName}</Text>
          <Text style={styles.meta}>
            {kitchenName} · {order.meal_date} · {order.delivery_window} ·{' '}
            {fulfillment === 'takeaway' ? 'Takeaway' : 'Delivery'}
          </Text>
          <Text style={styles.total}>{formatInr(order.total)}</Text>
          <Text style={styles.orderId}>Order · {order.id}</Text>
        </Card>

        <OrderStatusTimeline
          status={order.status}
          deliveryWindow={order.delivery_window}
          fulfillmentMode={fulfillment}
        />

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.row}>
            Status · <Text style={styles.rowValue}>{invoice.paymentStatus}</Text>
          </Text>
          <Text style={styles.row}>
            Method · <Text style={styles.rowValue}>{invoice.paymentMethod}</Text>
          </Text>
          {invoice.razorpayOrderId ? (
            <Text style={styles.mono}>Razorpay order · {invoice.razorpayOrderId}</Text>
          ) : null}
          {invoice.razorpayPaymentId ? (
            <Text style={styles.mono}>Razorpay payment · {invoice.razorpayPaymentId}</Text>
          ) : null}
          {invoice.invoiceNumber ? (
            <Text style={styles.row}>
              Invoice · <Text style={styles.rowValue}>{invoice.invoiceNumber}</Text>
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Billing</Text>
          <Text style={styles.rowValue}>{invoice.customerName}</Text>
          <Text style={styles.meta}>{invoice.billingAddress}</Text>
        </Card>

        <View style={styles.actions}>
          <Link href={`/(customer)/tracking/${order.id}`} asChild>
            <Button label="Track order" variant="outline" />
          </Link>
          {paid ? (
            <Link href={`/(customer)/invoice/${order.id}` as Href} asChild>
              <Button label="View invoice" />
            </Link>
          ) : (
            <Button
              label="Complete payment"
              onPress={() => router.push('/(customer)/checkout')}
            />
          )}
        </View>

        {paid ? (
          <InvoiceDocument
            data={invoice}
            onPrint={() => printInvoice(invoice)}
            onDownload={() => downloadInvoice(invoice)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.margin, gap: spacing.base, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...typography.headlineMd, color: colors.onBackground, flex: 1 },
  card: { gap: spacing.sm },
  meal: { ...typography.headlineSm, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  total: { ...typography.headlineSm, color: colors.primary },
  orderId: { ...typography.labelSm, color: colors.outline },
  sectionTitle: { ...typography.labelMd, color: colors.primary },
  row: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  rowValue: { color: colors.onSurface, fontWeight: '600' },
  mono: { ...typography.labelSm, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  actions: { gap: spacing.sm },
});
