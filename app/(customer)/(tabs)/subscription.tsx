import { Link, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getCreditBalance } from '../../../lib/api/credits';
import {
  createWeeklySubscription,
  listSubscriptions,
} from '../../../lib/api/subscriptions';
import { formatInr } from '../../../lib/date';

/** Stitch: Subscription Dashboard (40bb2bf6b7e94f3e9eff0b658df1584f) */
export default function SubscriptionTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const [starting, setStarting] = useState(false);
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

  const creditsQuery = useQuery({
    queryKey: ['credits', user?.id],
    enabled: status === 'signedIn' && Boolean(user?.id),
    queryFn: async () => {
      const result = await getCreditBalance(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          title="Sign in for meal plans"
          description="Weekly tiffin subscriptions live here."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  if (subsQuery.isLoading) return <LoadingState label="Loading plan…" />;
  if (subsQuery.isError) {
    return (
      <ErrorState message={subsQuery.error.message} onRetry={() => void subsQuery.refetch()} />
    );
  }

  const subs = subsQuery.data ?? [];
  const active = subs.find((s) => s.status === 'active') ?? subs[0];

  const onStartPlan = async () => {
    if (!user) return;
    setStarting(true);
    setError(null);
    const created = await createWeeklySubscription({ customerId: user.id });
    setStarting(false);
    if (!created.ok) {
      setError(created.error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['subscriptions', user.id] });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Meal plan</Text>
        <Card style={styles.creditCard}>
          <Text style={styles.creditLabel}>Credit balance</Text>
          <Text style={styles.creditValue}>
            {formatInr(creditsQuery.data ?? 0)}
          </Text>
        </Card>

        {!active ? (
          <EmptyState
            title="No meal plan yet"
            description="Start a 7-day lunch plan with Nani Geeta’s kitchen."
            glyph="📅"
            actionLabel="Start weekly plan"
            onAction={() => void onStartPlan()}
          />
        ) : (
          <Card style={styles.card}>
            <Badge label={active.status} tone="success" />
            <Text style={styles.planTitle}>Daily {active.meal_slot} tiffin</Text>
            <Text style={styles.meta}>
              {active.plan_days}-day plan · {active.delivery_window}
            </Text>
            <Text style={styles.meta}>
              {active.starts_on}
              {active.ends_on ? ` → ${active.ends_on}` : ''}
            </Text>
            <Text style={styles.meta}>
              Paused dates: {active.paused_dates.length || 'none'}
            </Text>
            <Link href="/(customer)/meal-calendar" asChild>
              <Button label="Meal calendar" variant="outline" />
            </Link>
            <Link href="/(customer)/pause-skip" asChild>
              <Button label="Pause / Skip a meal" />
            </Link>
          </Card>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {active ? null : (
          <Button label="Start weekly plan" loading={starting} onPress={() => void onStartPlan()} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.margin, gap: spacing.base, paddingBottom: spacing.xxl },
  title: { ...typography.headlineMd, color: colors.onBackground },
  creditCard: { gap: spacing.xs },
  creditLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  creditValue: { ...typography.headlineSm, color: colors.primary },
  card: { gap: spacing.sm },
  planTitle: { ...typography.headlineSm, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  error: { ...typography.bodySm, color: colors.error },
});
