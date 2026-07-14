import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckoutProgress, type CheckoutPhase } from '../../components/customer/CheckoutProgress';
import { OrderBillSummary } from '../../components/customer/OrderBillSummary';
import { LegalConsentRow, LegalInlineLink } from '../../components/legal/LegalConsent';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button, Card, EmptyState, StitchIcon } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { webPageStyle } from '../../constants/webLayout';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { createOrderFromCart, getOrder } from '../../lib/api/orders';
import {
  createPaymentSession,
  rememberCheckoutProof,
  syncOrderAfterVerifiedPayment,
  verifyRazorpayPaymentWithRetry,
} from '../../lib/api/payments';
import { openRazorpayCheckout } from '../../lib/api/razorpayCheckout';
import { formatInr } from '../../lib/date';
import {
  calculateCartTotals,
  fulfillmentModeLabel,
  formatDeliveryWindow,
  mealSlotLabel,
} from '../../lib/delivery';
import { calculateThaliPrice } from '../../lib/pricing';
import { AnalyticsEvents, trackEvent } from '../../lib/analytics';
import { logger } from '../../lib/logger';

function formatFee(amount: number): string {
  return amount % 1 === 0 ? formatInr(amount) : `₹${amount.toFixed(2)}`;
}

const PHASE_MESSAGES: Record<CheckoutPhase, string> = {
  idle: '',
  preparing: 'Creating your order…',
  gateway: 'Opening Razorpay secure checkout…',
  verifying: 'Verifying payment signature on server…',
  success: 'Payment confirmed! Redirecting…',
  error: '',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, status, session: authSession } = useAuth();
  const { line, lineTotal, clearCart, pendingOrderId, setPendingOrderId } = useCart();
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const accessToken = authSession?.access_token ?? null;
  const loading = phase !== 'idle' && phase !== 'error';

  const bill = useMemo(() => {
    if (!line) return null;
    const priced = calculateThaliPrice(
      line.basePrice,
      line.components,
      line.quantities,
      line.swapCreditsApplied,
    );
    return calculateCartTotals(line, priced.finalPrice);
  }, [line]);

  const grandTotal = bill?.grandTotal ?? lineTotal ?? 0;

  if (status !== 'signedIn' || !user) {
    return (
      <EmptyState
        title="Sign in to checkout"
        description="Your cart is saved — sign in to pay."
        actionLabel="Sign in"
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  if (!line && !pendingOrderId) {
    return (
      <EmptyState
        title="Nothing to checkout"
        description="Add a thali to your cart first."
        actionLabel="Discover"
        onAction={() => router.replace('/(customer)/(tabs)/home')}
      />
    );
  }

  const onPay = async () => {
    if (loading) return;
    if (!acceptedTerms) {
      setInlineError('Please accept the Terms and policies to continue.');
      return;
    }
    setInlineError(null);
    setPhase('preparing');
    trackEvent(AnalyticsEvents.beginCheckout, { total: lineTotal });

    try {
      let orderId = pendingOrderId;

      if (orderId) {
        const existing = await getOrder(orderId, user.id);
        if (!existing.ok || existing.data.customer_id !== user.id) {
          orderId = null;
          setPendingOrderId(null);
        }
      }

      if (!orderId && line) {
        const created = await createOrderFromCart({
          customerId: user.id,
          line,
          customerPhone: user.phone ?? profile?.phone ?? null,
          customerName:
            profile?.full_name?.trim() ||
            (typeof user.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name.trim()
              : null) ||
            null,
        });
        if (!created.ok) {
          setInlineError(created.error.message);
          setPhase('error');
          return;
        }
        orderId = created.data.id;
        setPendingOrderId(orderId);
      }

      if (!orderId) {
        setInlineError('Could not prepare order');
        setPhase('error');
        return;
      }

      const paymentSession = await createPaymentSession(orderId, accessToken, user.id);
      if (!paymentSession.ok) {
        if (
          paymentSession.error.message.toLowerCase().includes('not found') ||
          paymentSession.error.message.toLowerCase().includes('invalid response')
        ) {
          setPendingOrderId(null);
        }
        setInlineError(paymentSession.error.message);
        setPhase('error');
        return;
      }

      if (paymentSession.data.paidWithCredits) {
        setPhase('success');
        clearCart();
        trackEvent(AnalyticsEvents.purchase, { orderId, method: 'credits' });
        router.replace(`/(customer)/tracking/${orderId}`);
        return;
      }

      if (!paymentSession.data.razorpayOrderId) {
        setInlineError('Could not start Razorpay payment');
        setPhase('error');
        return;
      }

      setPhase('gateway');
      const prefillName =
        profile?.full_name?.trim() ||
        (typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.trim()
          : undefined);
      const prefillPhone = (user.phone ?? profile?.phone ?? '').replace(/\D/g, '').slice(-10);

      let checkoutResult;
      try {
        checkoutResult = await openRazorpayCheckout({
          key: paymentSession.data.keyId,
          amount: paymentSession.data.amountPaise,
          currency: paymentSession.data.currency,
          name: 'GharKaSwad',
          description: line?.menuName ?? 'Home kitchen thali',
          order_id: paymentSession.data.razorpayOrderId,
          prefill: {
            name: prefillName,
            contact: prefillPhone ? `+91${prefillPhone}` : undefined,
            email: profile?.email ?? undefined,
          },
          theme: { color: colors.primary },
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Payment failed';
        if (message === 'USER_CANCELLED') {
          setPhase('idle');
          return;
        }
        trackEvent(AnalyticsEvents.paymentFailed, { orderId, reason: message });
        router.replace({
          pathname: '/(customer)/payment-failed',
          params: { orderId },
        });
        setPhase('idle');
        return;
      }

      setPhase('verifying');
      await rememberCheckoutProof({
        orderId,
        razorpayOrderId: checkoutResult.razorpay_order_id,
        razorpayPaymentId: checkoutResult.razorpay_payment_id,
        razorpaySignature: checkoutResult.razorpay_signature,
      });

      const verified = await verifyRazorpayPaymentWithRetry({
        orderId,
        razorpayOrderId: checkoutResult.razorpay_order_id,
        razorpayPaymentId: checkoutResult.razorpay_payment_id,
        razorpaySignature: checkoutResult.razorpay_signature,
        accessTokenOverride: accessToken,
        customerId: user.id,
      });

      if (!verified.ok) {
        trackEvent(AnalyticsEvents.paymentFailed, {
          orderId,
          reason: verified.error.code,
        });
        router.replace({
          pathname: '/(customer)/payment-failed',
          params: {
            orderId,
            verifyPending: verified.error.code === 'NETWORK' ? '1' : '0',
          },
        });
        setPhase('idle');
        return;
      }

      const synced = await syncOrderAfterVerifiedPayment(orderId);
      if (!synced.ok) {
        setInlineError(synced.error.message);
        setPhase('error');
        return;
      }

      setPhase('success');
      clearCart();
      setPendingOrderId(null);
      trackEvent(AnalyticsEvents.purchase, { orderId, method: 'razorpay' });
      router.replace(`/(customer)/tracking/${orderId}`);
    } catch (cause) {
      logger.error('checkout pay failed', cause);
      setInlineError('Payment could not be completed. Try again.');
      setPhase('error');
    }
  };

  const billingName =
    profile?.full_name?.trim() ||
    (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : null) ||
    'Customer';
  const billingPhone = user.phone ?? profile?.phone ?? '—';
  const billingEmail = profile?.email ?? '—';

  return (
    <View style={[styles.page, webPageStyle]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + 88 },
        ]}
      >
        <StitchHero source={stitchImages.checkoutHero} aspectRatio={16 / 9} style={styles.hero} />

        <Text style={styles.title}>Secure checkout</Text>
        <Text style={styles.sub}>
          Pay with Razorpay test mode. Your order stays pending until payment is verified on our
          server.
        </Text>

        <CheckoutProgress phase={phase} message={PHASE_MESSAGES[phase]} />

        {line ? (
          <OrderBillSummary
            menuName={line.menuName}
            kitchenName={line.kitchenName}
            meta={`${mealSlotLabel(line.mealSlot)} · ${formatDeliveryWindow(line.deliveryWindow)} · ${fulfillmentModeLabel(line.fulfillmentMode)} · ${line.mealDate}`}
            note={line.cookingInstructions}
            bill={bill}
            grandTotal={grandTotal}
            formatFee={formatFee}
          />
        ) : (
          <Card style={styles.retryCard}>
            <Text style={styles.item}>Retry pending payment</Text>
            <Text style={styles.meta}>Order {pendingOrderId}</Text>
            <Text style={styles.total}>{formatFee(grandTotal)}</Text>
          </Card>
        )}

        <Card style={styles.billingCard}>
          <Text style={styles.sectionTitle}>Billing details</Text>
          <Text style={styles.billingRow}>{billingName}</Text>
          <Text style={styles.billingMuted}>{billingPhone}</Text>
          <Text style={styles.billingMuted}>{billingEmail}</Text>
          {line?.deliveryAddress?.trim() ? (
            <Text style={styles.billingMuted}>{line.deliveryAddress.trim()}</Text>
          ) : null}
        </Card>

        <Card style={styles.secureCard}>
          <View style={styles.secureRow}>
            <StitchIcon name="payment" size={22} color={colors.primary} />
            <View style={styles.secureCopy}>
              <Text style={styles.secureTitle}>Razorpay secure payments</Text>
              <Text style={styles.secureSub}>
                UPI, cards & netbanking. Test card 4111 1111 1111 1111 in Razorpay test mode.
              </Text>
            </View>
          </View>
        </Card>

        {inlineError ? (
          <View style={styles.errorBox}>
            <StitchIcon name="error-outline" size={18} color={colors.error} />
            <Text style={styles.error}>{inlineError}</Text>
          </View>
        ) : null}

        <LegalConsentRow checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
          <Text style={styles.consentText}>
            I agree to the <LegalInlineLink policyId="terms" label="Terms & Conditions" />,{' '}
            <LegalInlineLink policyId="cancellation" label="Cancellation Policy" />,{' '}
            <LegalInlineLink policyId="delivery-pickup" label="Delivery & Pickup Policy" />, and{' '}
            <LegalInlineLink policyId="payment" label="Payment Policy" />.
          </Text>
        </LegalConsentRow>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          Platform.OS === 'web' && styles.footerWeb,
        ]}
      >
        <View style={styles.footerTotal}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerAmount}>{formatFee(grandTotal)}</Text>
        </View>
        <Button
          label={
            phase === 'success'
              ? 'Done'
              : pendingOrderId && !line
                ? 'Retry payment'
                : 'Pay now'
          }
          size="lg"
          loading={loading}
          disabled={!acceptedTerms || phase === 'success'}
          onPress={() => void onPay()}
          style={styles.payBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: spacing.margin,
    gap: spacing.base,
  },
  hero: { marginHorizontal: -spacing.margin, marginTop: -spacing.margin, marginBottom: spacing.sm },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  retryCard: { gap: spacing.sm },
  item: { ...typography.headlineSm, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  total: { ...typography.headlineSm, color: colors.primary },
  billingCard: { gap: 4 },
  sectionTitle: { ...typography.labelMd, color: colors.primary, marginBottom: 4 },
  billingRow: { ...typography.labelMd, color: colors.onSurface },
  billingMuted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  secureCard: { backgroundColor: colors.surfaceContainerLow },
  secureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  secureCopy: { flex: 1, gap: 2 },
  secureTitle: { ...typography.labelMd, color: colors.onSurface },
  secureSub: { ...typography.bodySm, color: colors.onSurfaceVariant },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
  },
  error: { ...typography.bodySm, color: colors.error, flex: 1 },
  consentText: { ...typography.bodySm, color: colors.onSurface, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  footerWeb: {
    maxWidth: 480,
    alignSelf: 'center',
  },
  footerTotal: { flex: 1 },
  footerLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  footerAmount: { ...typography.headlineSm, color: colors.primary },
  payBtn: { minWidth: 148 },
});
