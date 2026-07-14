import { useQuery } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChefStatsCard } from '../../../components/customer/ChefStatsCard';
import { Card, EmptyState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { adminGetStats, adminListApplications, adminListOrders } from '../../../lib/api/admin';
import { formatInr } from '../../../lib/date';
import { useAuth } from '../../../hooks/useAuth';

/** Admin ops home — marketplace health at a glance. */
export default function AdminOverviewScreen() {
  const { user, signOut } = useAuth();

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const result = await adminGetStats();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 20_000,
  });

  const pendingQuery = useQuery({
    queryKey: ['admin-applications-preview'],
    queryFn: async () => {
      const result = await adminListApplications();
      if (!result.ok) throw new Error(result.error.message);
      return result.data
        .filter((a) => a.status === 'new' || a.status === 'reviewing')
        .slice(0, 3);
    },
    refetchInterval: 20_000,
  });

  const recentOrdersQuery = useQuery({
    queryKey: ['admin-orders-preview'],
    queryFn: async () => {
      const result = await adminListOrders();
      if (!result.ok) throw new Error(result.error.message);
      return result.data.slice(0, 5);
    },
    refetchInterval: 15_000,
  });

  if (statsQuery.isLoading) {
    return <LoadingState label="Loading ops overview…" />;
  }

  const stats = statsQuery.data;
  if (!stats) {
    return (
      <EmptyState
        title="Could not load overview"
        description={statsQuery.error?.message ?? 'Try again in a moment.'}
        glyph="⚠️"
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.brand}>GharKaSwad Ops</Text>
      <Text style={styles.title}>Marketplace control</Text>
      <Text style={styles.sub}>
        Signed in as {user?.phone ?? 'admin'} · approve kitchens, watch orders, and keep Discover
        healthy.
      </Text>

      <ChefStatsCard
        stats={[
          { value: String(stats.pendingApplications), label: 'Pending apps' },
          { value: String(stats.activeKitchens), label: 'Open kitchens' },
          { value: String(stats.openOrders), label: 'Live orders' },
        ]}
      />

      <ChefStatsCard
        stats={[
          { value: String(stats.totalKitchens), label: 'All kitchens' },
          { value: String(stats.totalOrders), label: 'Orders' },
          { value: formatInr(stats.revenueDelivered), label: 'Delivered ₹' },
        ]}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Needs review</Text>
        <Link href={'/(admin)/(tabs)/applications' as Href} asChild>
          <Pressable>
            <Text style={styles.link}>All applications</Text>
          </Pressable>
        </Link>
      </View>

      {(pendingQuery.data ?? []).length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.cardBody}>No pending chef applications.</Text>
        </Card>
      ) : (
        (pendingQuery.data ?? []).map((app) => (
          <Card key={app.id} style={styles.card}>
            <Text style={styles.cardTitle}>{app.full_name}</Text>
            <Text style={styles.cardMeta}>
              {app.city} · {app.cuisine_experience}
            </Text>
          </Card>
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent orders</Text>
        <Link href={'/(admin)/(tabs)/orders' as Href} asChild>
          <Pressable>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </Link>
      </View>

      {(recentOrdersQuery.data ?? []).length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.cardBody}>No orders yet.</Text>
        </Card>
      ) : (
        (recentOrdersQuery.data ?? []).map((order) => {
          const fulfillment =
            order.thali_snapshot?.fulfillmentMode === 'delivery' ? 'delivery' : 'takeaway';
          return (
            <Card key={order.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{formatInr(order.total)}</Text>
                <Text style={styles.status}>{order.status.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {fulfillment} · {order.meal_slot} ·{' '}
                {new Date(order.created_at).toLocaleString()}
              </Text>
            </Card>
          );
        })
      )}

      <View style={styles.quickLinks}>
        <Link href={'/(admin)/(tabs)/kitchens' as Href} asChild>
          <Pressable style={styles.quickLink}>
            <Text style={styles.quickLinkText}>Browse kitchens</Text>
          </Pressable>
        </Link>
        <Pressable style={styles.quickLinkOutline} onPress={() => void signOut()}>
          <Text style={styles.quickLinkOutlineText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  brand: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.headlineSm, color: colors.onBackground },
  link: { ...typography.labelMd, color: colors.primary },
  card: { gap: spacing.xs },
  cardTitle: { ...typography.labelMd, color: colors.onSurface },
  cardMeta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  cardBody: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { ...typography.labelSm, color: colors.secondary, textTransform: 'capitalize' },
  quickLinks: { gap: spacing.sm, marginTop: spacing.md },
  quickLink: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickLinkText: { ...typography.labelMd, color: colors.onPrimary },
  quickLinkOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
  },
  quickLinkOutlineText: { ...typography.labelMd, color: colors.primary },
});
