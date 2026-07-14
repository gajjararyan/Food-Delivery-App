import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { formatInr } from '../../lib/date';
import type { CartTotals } from '../../lib/delivery';

type Props = {
  menuName: string;
  kitchenName: string;
  meta?: string;
  note?: string | null;
  bill: CartTotals | null;
  grandTotal: number;
  formatFee?: (amount: number) => string;
};

function defaultFormatFee(amount: number): string {
  return amount % 1 === 0 ? formatInr(amount) : `₹${amount.toFixed(2)}`;
}

export function OrderBillSummary({
  menuName,
  kitchenName,
  meta,
  note,
  bill,
  grandTotal,
  formatFee = defaultFormatFee,
}: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.item}>{menuName}</Text>
      <Text style={styles.kitchen}>{kitchenName}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {note ? <Text style={styles.note}>Cook note · {note}</Text> : null}

      <View style={styles.divider} />

      {bill ? (
        <View style={styles.bill}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total</Text>
            <Text style={styles.billValue}>{formatInr(bill.itemTotal)}</Text>
          </View>
          {bill.fees
            ? bill.fees.lines.map((feeLine) => (
                <View key={feeLine.key} style={styles.billRow}>
                  <Text style={styles.billLabel}>{feeLine.label}</Text>
                  <Text style={styles.billValue}>{formatFee(feeLine.amount)}</Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Amount payable</Text>
        <Text style={styles.total}>{formatFee(grandTotal)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  item: { ...typography.headlineSm, color: colors.onSurface },
  kitchen: { ...typography.labelMd, color: colors.primary },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  note: { ...typography.bodySm, color: colors.secondary, lineHeight: 20 },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.xs,
  },
  bill: { gap: 6 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  billLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  billValue: { ...typography.bodySm, color: colors.onSurface },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  totalLabel: { ...typography.labelMd, color: colors.onSurface },
  total: { ...typography.headlineSm, color: colors.primary },
});
