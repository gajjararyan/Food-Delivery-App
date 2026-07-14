import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { adminListKitchens } from '../../../lib/api/admin';

/** All kitchens — active, closed, and inactive. */
export default function AdminKitchensScreen() {
  const kitchensQuery = useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: async () => {
      const result = await adminListKitchens();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 20_000,
  });

  if (kitchensQuery.isLoading) {
    return <LoadingState label="Loading kitchens…" />;
  }

  const kitchens = kitchensQuery.data ?? [];
  const open = kitchens.filter((k) => k.is_active && k.is_open !== false).length;
  const closed = kitchens.filter((k) => k.is_active && k.is_open === false).length;

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.brand}>GharKaSwad Ops</Text>
      <Text style={styles.title}>Kitchens</Text>
      <Text style={styles.sub}>
        Full marketplace visibility — open, closed, and inactive kitchens.
      </Text>
      <Text style={styles.counts}>
        {open} open · {closed} closed · {kitchens.length} total
      </Text>

      {kitchens.length === 0 ? (
        <EmptyState
          title="No kitchens yet"
          description="Approved chef applications create kitchens here."
          glyph="🏠"
        />
      ) : (
        kitchens.map((kitchen) => {
          const openNow = kitchen.is_active && kitchen.is_open !== false;
          const tone = !kitchen.is_active ? 'error' : openNow ? 'success' : 'neutral';
          const statusLabel = !kitchen.is_active ? 'inactive' : openNow ? 'open' : 'closed';

          return (
            <Card key={kitchen.id} elevated style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.name}>{kitchen.kitchen_name}</Text>
                <Badge label={statusLabel} tone={tone} />
              </View>
              <Text style={styles.meta}>
                {kitchen.display_name}
                {kitchen.kitchen_address ? ` · ${kitchen.kitchen_address}` : ''}
              </Text>
              {kitchen.cuisine_tags.length > 0 ? (
                <Text style={styles.tags}>{kitchen.cuisine_tags.join(' · ')}</Text>
              ) : null}
              <Text style={styles.rating}>
                ★ {kitchen.rating_avg.toFixed(1)} ({kitchen.rating_count}) · {kitchen.tier}
              </Text>
            </Card>
          );
        })
      )}
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
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  counts: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  card: { gap: spacing.xs },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { ...typography.headlineSm, color: colors.onSurface, flex: 1, fontSize: 18 },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  tags: { ...typography.bodyMd, color: colors.onSurface },
  rating: { ...typography.labelSm, color: colors.secondary },
});
