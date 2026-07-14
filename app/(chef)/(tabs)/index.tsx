import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KitchenStatusCard } from '../../../components/chef/KitchenStatusCard';
import { StitchHero } from '../../../components/customer/StitchHero';
import { ChefStatsCard } from '../../../components/customer/ChefStatsCard';
import { Button, Card, EmptyState, LoadingState } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import {
  fetchChefMenu,
  fetchMakerForCurrentPhone,
  makerPublicSlug,
  saveMakerKitchen,
  ensureMakerSyncedToSupabase,
} from '../../../lib/api/chefs';
import { listOrdersForMaker } from '../../../lib/api/orders';
import { formatInr } from '../../../lib/date';
import { invalidateMarketplaceQueries } from '../../../lib/marketplace/invalidation';
import { isKitchenOpen } from '../../../lib/marketplace/kitchenStatus';

function shouldShowBio(bio: string | null | undefined, cuisineTags: string[]): boolean {
  const trimmed = bio?.trim();
  if (!trimmed) return false;
  const cuisineLine = cuisineTags.join(' · ');
  if (trimmed === cuisineLine) return false;
  return !cuisineTags.some((tag) => trimmed === tag.trim());
}

/** Stitch-aligned chef dashboard overview. */
export default function ChefOverviewScreen() {
  const queryClient = useQueryClient();
  const { user, status, signOut } = useAuth();
  const phone = user?.phone ?? undefined;
  const [savingOpen, setSavingOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const makerQuery = useQuery({
    queryKey: ['chef-maker', phone],
    enabled: Boolean(phone),
    queryFn: async () => {
      const result = await fetchMakerForCurrentPhone(phone);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['chef-orders', makerQuery.data?.id],
    enabled: Boolean(makerQuery.data?.id),
    queryFn: async () => {
      const result = await listOrdersForMaker(makerQuery.data!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const menuQuery = useQuery({
    queryKey: ['chef-menu', makerQuery.data?.id],
    enabled: Boolean(makerQuery.data?.id),
    queryFn: async () => {
      const result = await fetchChefMenu(makerQuery.data!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchOnMount: 'always',
    refetchInterval: 15_000,
  });

  const slugQuery = useQuery({
    queryKey: ['chef-slug', makerQuery.data?.id],
    enabled: Boolean(makerQuery.data?.id),
    queryFn: async () => makerPublicSlug(makerQuery.data!.id),
  });

  // Keep Discover in sync when chef opens dashboard (local kitchens → Supabase).
  useLayoutEffect(() => {
    const maker = makerQuery.data;
    if (!maker) return;
    void ensureMakerSyncedToSupabase(maker, phone).then(() => {
      invalidateMarketplaceQueries(queryClient, maker.id);
    });
  }, [makerQuery.data, phone, queryClient]);

  if (status === 'loading' || makerQuery.isLoading) {
    return <LoadingState label="Loading your kitchen…" />;
  }

  if (!phone || !makerQuery.data) {
    return (
      <SafeAreaView style={styles.safeCenter}>
        <EmptyState
          title="No kitchen linked"
          description="Apply to become a home chef. Once approved, sign in with the same phone to manage orders."
          glyph="🍳"
        />
        <View style={styles.centerLink}>
          <Link href="/(customer)/become-chef">
            <Text style={styles.link}>Become a home chef</Text>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  const maker = makerQuery.data;
  const orders = ordersQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];
  const liveMenuCount = menuItems.filter((item) => item.is_available).length;
  const activeOrders = orders.filter(
    (o) =>
      o.status === 'placed' ||
      o.status === 'accepted' ||
      o.status === 'cooking' ||
      o.status === 'out_for_delivery',
  ).length;
  const revenue = orders
    .filter((o) => o.status === 'delivered' || o.status === 'out_for_delivery')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const publicSlug = slugQuery.data ?? maker.id;
  const kitchenOpen = isKitchenOpen(maker);

  const onToggleOpen = async (next: boolean) => {
    setSavingOpen(true);
    setStatusError(null);
    const result = await saveMakerKitchen(maker.id, { is_open: next });
    setSavingOpen(false);
    if (!result.ok) {
      setStatusError(result.error.message);
      return;
    }
    invalidateMarketplaceQueries(queryClient, maker.id);
    void makerQuery.refetch();
  };

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <StitchHero source={stitchImages.kitchenHero} aspectRatio={16 / 9} rounded={16} />
      <Text style={styles.brand}>Chef dashboard</Text>
      <Text style={styles.title}>{maker.kitchen_name}</Text>
      <Text style={styles.sub}>
        {maker.display_name} · {maker.cuisine_tags.join(' · ')}
      </Text>
      {shouldShowBio(maker.bio, maker.cuisine_tags) ? (
        <Text style={styles.bio}>{maker.bio}</Text>
      ) : null}

      <KitchenStatusCard isOpen={kitchenOpen} saving={savingOpen} onToggle={onToggleOpen} />
      {statusError ? <Text style={styles.error}>{statusError}</Text> : null}

      <ChefStatsCard
        stats={[
          { value: String(activeOrders), label: 'Active orders' },
          { value: String(liveMenuCount), label: 'Live items' },
          { value: formatInr(revenue), label: 'Earnings' },
        ]}
      />

      <Card style={styles.tipCard}>
        <Text style={styles.tipTitle}>
          {kitchenOpen ? 'Kitchen live on Discover' : 'Kitchen paused (still listed)'}
        </Text>
        <Text style={styles.tipBody}>
          {kitchenOpen
            ? `You have ${menuItems.length} item${menuItems.length === 1 ? '' : 's'} on your menu (${liveMenuCount} visible). Edit photos, dishes, prices, and your story from the Menu tab.`
            : 'Diners still see your kitchen on Discover in grey, but cannot place new orders. Existing orders stay in the Orders tab. Turn accepting orders back on when you are ready to cook.'}
        </Text>
      </Card>

      <Link href={'/(chef)/(tabs)/orders' as Href} asChild>
        <Button label="View incoming orders" />
      </Link>
      <Link href={`/(customer)/chef/${publicSlug}` as Href} asChild>
        <Button label="Preview chef profile" variant="outline" />
      </Link>

      <Card style={styles.accountCard}>
        <Text style={styles.accountLabel}>Signed in as</Text>
        <Text style={styles.accountPhone}>{phone}</Text>
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
      </Card>
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
  safeCenter: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  centerLink: { alignItems: 'center', padding: spacing.margin },
  brand: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  bio: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
  tipCard: { gap: spacing.xs, backgroundColor: colors.surfaceContainerLow },
  tipTitle: { ...typography.labelMd, color: colors.onSurface },
  tipBody: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
  accountCard: { gap: spacing.sm, marginTop: spacing.sm },
  accountLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  accountPhone: { ...typography.bodyMd, color: colors.onBackground },
  error: { ...typography.bodySm, color: colors.error },
  link: { ...typography.labelMd, color: colors.primary },
});
