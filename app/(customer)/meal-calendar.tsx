import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { buildMealCalendar, listSubscriptions } from '../../lib/api/subscriptions';

/** Stitch: Meal Calendar (24a9a9344e2249bcbc767908780eb537) */
export default function MealCalendarScreen() {
  const router = useRouter();
  const { user, status } = useAuth();

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

  if (subsQuery.isLoading) return <LoadingState label="Loading calendar…" />;
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
        title="No active plan"
        description="Start a meal plan to see upcoming days."
        actionLabel="Meal plan"
        onAction={() => router.replace('/(customer)/(tabs)/subscription')}
      />
    );
  }

  const days = buildMealCalendar(active, 14);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Meal calendar</Text>
      <Text style={styles.sub}>
        Next 14 days · {active.meal_slot} · {active.delivery_window}
      </Text>
      {days.map((day) => (
        <Card key={day.date} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.date}>{day.date}</Text>
            <Badge
              label={day.paused ? 'Paused' : 'Scheduled'}
              tone={day.paused ? 'secondary' : 'success'}
            />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.margin,
    gap: spacing.sm,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  row: { paddingVertical: spacing.md },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { ...typography.bodyMd, color: colors.onSurface },
});
