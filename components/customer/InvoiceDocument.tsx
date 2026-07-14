import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Card, StitchIcon } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { InvoiceData } from '../../lib/invoice';
import { formatInr } from '../../lib/date';

type Props = {
  data: InvoiceData;
  onPrint?: () => void;
  onDownload?: () => void;
  showActions?: boolean;
};

export function InvoiceDocument({ data, onPrint, onDownload, showActions = true }: Props) {
  return (
    <View style={styles.root} nativeID="invoice-document">
      <Card style={styles.header}>
        <Text style={styles.brand}>{data.companyName}</Text>
        <Text style={styles.address}>{data.companyAddress}</Text>
        <Text style={styles.gst}>GSTIN · {data.gstNumber}</Text>
      </Card>

      <View style={styles.invoiceMeta}>
        <View>
          <Text style={styles.sectionLabel}>Tax invoice</Text>
          <Text style={styles.invoiceNo}>{data.invoiceNumber}</Text>
        </View>
        <View style={styles.paidBadge}>
          <StitchIcon
            name={data.paymentStatus === 'Paid' ? 'verified' : 'payment'}
            size={18}
            color={data.paymentStatus === 'Paid' ? colors.tertiary : colors.primary}
          />
          <Text style={styles.paidText}>{data.paymentStatus}</Text>
        </View>
      </View>

      <Card style={styles.block}>
        <Text style={styles.sectionLabel}>Bill to</Text>
        <Text style={styles.bold}>{data.customerName}</Text>
        <Text style={styles.body}>{data.billingAddress}</Text>
        {data.customerPhone ? <Text style={styles.muted}>{data.customerPhone}</Text> : null}
        {data.customerEmail ? <Text style={styles.muted}>{data.customerEmail}</Text> : null}
      </Card>

      <Card style={styles.block}>
        <Text style={styles.sectionLabel}>Order details</Text>
        <Text style={styles.bold}>
          {data.menuName} · {data.kitchenName}
        </Text>
        <Text style={styles.body}>
          {data.mealDate} · {data.mealSlot} · {data.deliveryWindow} · {data.fulfillmentMode}
        </Text>
        <Text style={styles.muted}>Order ID · {data.orderId}</Text>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.sectionLabel}>Line items</Text>
        {data.itemLines.map((line) => (
          <View key={line.label} style={styles.lineRow}>
            <Text style={[styles.lineLabel, line.emphasis && styles.bold]}>{line.label}</Text>
            <Text style={[styles.lineAmount, line.emphasis && styles.totalAmount]}>
              {formatInr(line.amount)}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.block}>
        <Text style={styles.sectionLabel}>Payment</Text>
        <Text style={styles.body}>{data.paymentMethod}</Text>
        {data.razorpayOrderId ? (
          <Text style={styles.muted}>Razorpay order · {data.razorpayOrderId}</Text>
        ) : null}
        {data.razorpayPaymentId ? (
          <Text style={styles.muted}>Razorpay payment · {data.razorpayPaymentId}</Text>
        ) : null}
        {data.paidAt ? (
          <Text style={styles.muted}>Paid · {new Date(data.paidAt).toLocaleString('en-IN')}</Text>
        ) : null}
        {data.creditsApplied > 0 ? (
          <Text style={styles.muted}>Credits used · {formatInr(data.creditsApplied)}</Text>
        ) : null}
      </Card>

      {showActions && (onPrint || onDownload) ? (
        <View style={styles.actions}>
          {onPrint ? (
            <Button label="Print invoice" variant="outline" onPress={onPrint} style={styles.actionBtn} />
          ) : null}
          {onDownload ? (
            <Button
              label={Platform.OS === 'web' ? 'Download HTML' : 'Download'}
              onPress={onDownload}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      ) : null}

      <Text style={styles.footer}>Need help? {data.supportEmail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.base },
  header: { gap: 4, backgroundColor: colors.primaryContainer },
  brand: { ...typography.headlineSm, color: colors.primary },
  address: { ...typography.bodySm, color: colors.onSurfaceVariant },
  gst: { ...typography.labelSm, color: colors.onSurfaceVariant },
  invoiceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  invoiceNo: { ...typography.headlineMd, color: colors.onBackground },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
  },
  paidText: { ...typography.labelSm, color: colors.onSurface },
  block: { gap: 4 },
  bold: { ...typography.labelMd, color: colors.onSurface },
  body: { ...typography.bodyMd, color: colors.onSurface },
  muted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  lineLabel: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },
  lineAmount: { ...typography.bodyMd, color: colors.onSurface },
  totalAmount: { ...typography.headlineSm, color: colors.primary },
  actions: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: spacing.sm,
  },
  actionBtn: { flex: Platform.OS === 'web' ? 1 : undefined },
  footer: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
