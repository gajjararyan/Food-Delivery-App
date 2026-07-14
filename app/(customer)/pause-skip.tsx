import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, EmptyState, ErrorState, Input, LoadingState } from '../../components/ui';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { applySkip } from '../../lib/api/credits';
import { listSubscriptions } from '../../lib/api/subscriptions';
import { getMenuItemWithComponents } from '../../lib/api/menu';
import { AnalyticsEvents, trackEvent } from '../../lib/analytics';
import { todayISODate } from '../../lib/date';

/**
 * Stitch: Customer - Pause or Skip a Meal (418e05edc9fa4342a80f3c6d583d6c92)
 * Uses credits.applySkip + canSkipMeal cutoff (blocks past kitchen prep).
 */
export default function PauseSkipScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const [date, setDate] = useState(todayISODate());
  const [reason, setReason] = useState('Skipping this meal');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subsQuery = useQuery({
    queryKey: ['subscriptions', user?.id],
    enabled: status === 'signedIn' && Boolean(user?.id),
    queryFn: async () => {
      const result = await listSubscriptions(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (status !== 'signedIn') {
    return (
      <EmptyState
        title="Sign in required"
        actionLabel="Sign in"
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  if (subsQuery.isLoading) return <LoadingState />;
  if (subsQuery.isError) {
    return (
      <ErrorState message={subsQuery.error.message} onRetry={() => void subsQuery.refetch()} />
    );
  }

  const active =
    (subsQuery.data ?? []).find((s) => s.status === 'active') ?? subsQuery.data?.[0];

  if (!active) {
    return (
      <EmptyState
        title="No plan to skip"
        description="Start a meal plan before pausing meals."
        actionLabel="Meal plan"
        onAction={() => router.replace('/(customer)/(tabs)/subscription')}
      />
    );
  }

  const onSkip = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const menu = await getMenuItemWithComponents(active.menu_item_id);
    const mealValue = menu.ok ? menu.data.menuItem.base_price : 149;

    const result = await applySkip({
      customerId: user.id,
      subscriptionId: active.id,
      date,
      reason,
      mealValue,
      mealSlot: active.meal_slot,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    trackEvent(AnalyticsEvents.skipMeal, { date, subscriptionId: active.id });
    setMessage(`Skipped ${date}. Credit added to your balance.`);
    await queryClient.invalidateQueries({ queryKey: ['subscriptions', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pause / Skip</Text>
      <Text style={styles.sub}>
        Skips after kitchen cutoff are blocked so the cook isn&apos;t stranded.
      </Text>
      <Card style={styles.card}>
        <Text style={styles.label}>Active plan</Text>
        <Text style={styles.value}>
          {active.meal_slot} · {active.delivery_window}
        </Text>
      </Card>
      <Input label="Meal date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Input label="Reason" value={reason} onChangeText={setReason} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button label="Skip this meal" loading={loading} onPress={() => void onSkip()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.margin,
    gap: spacing.base,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  card: { gap: spacing.xs },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMd, color: colors.onSurface },
  error: { ...typography.bodySm, color: colors.error },
  ok: { ...typography.bodySm, color: colors.success },
});
