import type { OrderStatus, FulfillmentMode } from '../../lib/types';
import { Badge, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { StyleSheet, Text, View } from 'react-native';
import { timelineStepLabels } from '../../lib/orderStatus';

export function orderStatusToStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'placed':
    case 'payment_pending':
      return 0;
    case 'accepted':
      return 1;
    case 'cooking':
      return 2;
    case 'out_for_delivery':
      return 3;
    case 'delivered':
      return 4;
    case 'payment_failed':
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

export type OrderStatusTimelineProps = {
  status: OrderStatus;
  deliveryWindow?: string;
  fulfillmentMode?: FulfillmentMode;
};

/** Customer-facing kitchen progress — delivery vs takeaway wording. */
export function OrderStatusTimeline({
  status,
  deliveryWindow,
  fulfillmentMode = 'delivery',
}: OrderStatusTimelineProps) {
  const activeIndex = orderStatusToStepIndex(status);
  const steps = timelineStepLabels(fulfillmentMode);

  if (activeIndex < 0) {
    return (
      <Card style={styles.timeline}>
        <Text style={styles.failed}>
          {status === 'payment_failed' ? 'Payment failed' : 'Order cancelled by cook'}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={styles.timeline}>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <Badge label={step} tone={index <= activeIndex ? 'primary' : 'neutral'} />
          {index === activeIndex ? <Text style={styles.current}>Current</Text> : null}
        </View>
      ))}
      {deliveryWindow ? (
        <Text style={styles.window}>
          {fulfillmentMode === 'takeaway' ? 'Pickup window' : 'Serving window'} · {deliveryWindow}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  current: { ...typography.labelSm, color: colors.primary },
  window: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  failed: { ...typography.labelMd, color: colors.error },
});
