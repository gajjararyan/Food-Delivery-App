import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MakerCard } from '../../../components/customer/MakerCard';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { SEED } from '../../../constants/seed';
import { useAuth } from '../../../hooks/useAuth';
import { listLiveSpecials, listMakers, makerChefHref } from '../../../lib/api/menu';
import { formatInr, greetingForHour } from '../../../lib/date';
import { imageSourceFromUrl } from '../../../lib/images/resolveImageSource';
import type { MakerProfile } from '../../../lib/types';

function MakerDiscoverCard({ maker }: { maker: MakerProfile }) {
  const hrefQuery = useQuery({
    queryKey: ['maker-href', maker.id],
    queryFn: () => makerChefHref(maker),
  });
  const image = imageSourceFromUrl(
    maker.cover_url ?? maker.photo_url,
    maker.id === SEED.makerId ? stitchImages.discoverChef : stitchImages.kitchenHero,
  );

  return (
    <MakerCard
      maker={maker}
      image={image}
      href={(hrefQuery.data ?? `/(customer)/chef/${maker.id}`) as `/(customer)/chef/${string}`}
    />
  );
}

/** Discover — live kitchens and their real menu items only. */
export default function HomeScreen() {
  const { profile, status } = useAuth();

  const makersQuery = useQuery({
    queryKey: ['makers'],
    queryFn: async () => {
      const result = await listMakers();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Backup if realtime is slow — open/close should still flip within a few seconds.
    refetchInterval: 5_000,
  });

  const specialsQuery = useQuery({
    queryKey: ['live-specials'],
    queryFn: async () => {
      const result = await listLiveSpecials(12);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 15_000,
  });

  const firstName = profile?.full_name?.split(' ')[0];
  const greeting =
    status === 'signedIn' && firstName
      ? `Namaste, ${firstName}`
      : greetingForHour();

  if (makersQuery.isLoading) {
    return <LoadingState label="Finding kitchens…" />;
  }

  if (makersQuery.isError) {
    return (
      <ErrorState
        message={makersQuery.error.message}
        onRetry={() => void makersQuery.refetch()}
      />
    );
  }

  const makers = makersQuery.data ?? [];
  const specials = specialsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>GharKaSwad</Text>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.headline}>Discover home kitchens</Text>

        {makers.length === 0 ? (
          <EmptyState
            title="No kitchens nearby"
            description="Approved kitchens appear here when they are live."
            glyph="🏠"
          />
        ) : (
          <View style={styles.list}>
            {makers.map((maker) => (
              <MakerDiscoverCard key={maker.id} maker={maker} />
            ))}
          </View>
        )}

        {specials.length > 0 ? (
          <>
            <Text style={styles.section}>Available now</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.specials}
            >
              {specials.map((item) => (
                <Link
                  key={item.id}
                  href={`/(customer)/thali/${item.id}` as Href}
                  asChild
                >
                  <Pressable style={styles.specialCard}>
                    <Image
                      source={imageSourceFromUrl(item.image_url, stitchImages.discoverThali)}
                      style={styles.specialImage}
                      resizeMode="cover"
                    />
                    <View style={styles.specialBody}>
                      <Text style={styles.specialTitle} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.specialMeta} numberOfLines={1}>
                        {item.kitchen_name}
                      </Text>
                      <Text style={styles.specialPrice}>{formatInr(item.base_price)}</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.margin,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  brand: {
    ...typography.labelMd,
    color: colors.primary,
  },
  greeting: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onBackground,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.base,
  },
  section: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  specials: {
    gap: spacing.base,
    paddingVertical: spacing.sm,
  },
  specialCard: {
    width: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  specialImage: { width: '100%', height: 120 },
  specialBody: { padding: spacing.sm, gap: 2 },
  specialTitle: { ...typography.labelMd, color: colors.onSurface },
  specialMeta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  specialPrice: { ...typography.labelMd, color: colors.primary, marginTop: 4 },
});
