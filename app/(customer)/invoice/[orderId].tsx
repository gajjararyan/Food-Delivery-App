import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InvoiceDocument } from '../../../components/customer/InvoiceDocument';
import { ErrorState, LoadingState } from '../../../components/ui';
import { colors, spacing } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getOrder } from '../../../lib/api/orders';
import { buildInvoiceData, isOrderPaid } from '../../../lib/invoice';
import { downloadInvoice, printInvoice } from '../../../lib/invoicePrint';

export default function InvoiceScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
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

  if (orderQuery.isLoading) return <LoadingState label="Loading invoice…" />;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <ErrorState
        message={orderQuery.error?.message ?? 'Invoice not found'}
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = orderQuery.data;
  if (!isOrderPaid(order)) {
    return (
      <ErrorState
        message="Invoice is available after payment is confirmed."
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const invoice = buildInvoiceData(order, profile ?? undefined);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <InvoiceDocument
          data={invoice}
          onPrint={() => printInvoice(invoice)}
          onDownload={() => downloadInvoice(invoice)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.margin, paddingBottom: spacing.xxl },
});
