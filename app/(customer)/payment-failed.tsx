import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, StitchIcon } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { retryPendingCheckoutVerification, syncOrderAfterVerifiedPayment } from '../../lib/api/payments';

/** Payment failed / verification pending recovery. */
export default function PaymentFailedScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const { orderId, verifyPending } = useLocalSearchParams<{
    orderId?: string;
    verifyPending?: string;
  }>();
  const { setPendingOrderId, pendingOrderId, clearCart } = useCart();
  const resolvedId =
    (typeof orderId === 'string' && orderId ? orderId : null) ?? pendingOrderId;
  const awaitingVerify = verifyPending === '1';

  const onRetryVerify = async () => {
    if (!resolvedId) return;
    const result = await retryPendingCheckoutVerification(
      resolvedId,
      session?.access_token ?? null,
      user?.id ?? null,
    );
    if (result.ok) {
      const synced = await syncOrderAfterVerifiedPayment(resolvedId);
      if (synced.ok) {
        clearCart();
        setPendingOrderId(null);
      }
      router.replace(`/(customer)/tracking/${resolvedId}`);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.iconRow}>
        <StitchIcon name={awaitingVerify ? 'schedule' : 'error-outline'} size={40} color={colors.error} />
      </View>
      <Text style={styles.title}>{awaitingVerify ? 'Confirming payment' : 'Payment failed'}</Text>
      <Text style={styles.sub}>
        {awaitingVerify
          ? 'Your payment may have gone through. Tap below to retry server verification — you will not be charged again.'
          : 'Your order is saved as payment pending. Retry without creating a duplicate charge.'}
      </Text>
      {resolvedId ? (
        <View style={styles.orderCard}>
          <Image source={stitchImages.paymentFailedItem} style={styles.orderImage} resizeMode="cover" />
          <View style={styles.orderMeta}>
            <Text style={styles.orderLabel}>Order pending</Text>
            <Text style={styles.meta}>{resolvedId}</Text>
          </View>
        </View>
      ) : null}
      <Button
        label={awaitingVerify ? 'Retry verification' : 'Retry payment'}
        onPress={() => {
          if (resolvedId) setPendingOrderId(resolvedId);
          if (awaitingVerify) {
            void onRetryVerify();
            return;
          }
          router.push('/(customer)/checkout');
        }}
      />
      {resolvedId ? (
        <Link href={`/(customer)/order/${resolvedId}` as Href} asChild>
          <Button label="View order details" variant="outline" />
        </Link>
      ) : null}
      <Link href="/(customer)/(tabs)/home" asChild>
        <Button label="Back to discover" variant="outline" />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
  },
  title: { ...typography.headlineMd, color: colors.error },
  iconRow: { alignItems: 'center', marginBottom: spacing.sm },
  sub: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  orderCard: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: spacing.sm,
  },
  orderImage: { width: 48, height: 48, borderRadius: radius.md },
  orderMeta: { flex: 1, gap: 2 },
  orderLabel: { ...typography.labelMd, color: colors.onSurface },
  meta: { ...typography.labelSm, color: colors.outline },
});
