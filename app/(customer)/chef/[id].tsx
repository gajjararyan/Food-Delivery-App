import { Link, useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefStatsCard } from '../../../components/customer/ChefStatsCard';
import { ChefTrustBadge } from '../../../components/customer/ChefTrustBadge';
import { MenuDishCard } from '../../../components/customer/MenuDishCard';
import { Button, ErrorState, LoadingState, StitchIcon, Badge } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { resolveMakerId } from '../../../constants/seedCatalog';
import { colors, radius, shadow, spacing, typography } from '../../../constants/theme';
import { getMaker, listMenuForMaker, listReviewsForMaker } from '../../../lib/api/menu';
import { imageSourceFromUrl } from '../../../lib/images/resolveImageSource';
import { isKitchenOpen } from '../../../lib/marketplace/kitchenStatus';

type ProfileTab = 'menu' | 'reviews' | 'about';

/** Kitchen profile — only real menu items, reviews, and bio from the DB. */
export default function ChefProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = resolveMakerId(typeof rawId === 'string' ? rawId : '');
  const [tab, setTab] = useState<ProfileTab>('menu');

  const makerQuery = useQuery({
    queryKey: ['maker', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const result = await getMaker(id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const makerUuid = makerQuery.data?.id;

  const menuQuery = useQuery({
    queryKey: ['menu', makerUuid ?? id],
    enabled: Boolean(makerUuid ?? id),
    queryFn: async () => {
      const result = await listMenuForMaker(makerUuid ?? id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 8_000,
  });

  const reviewsQuery = useQuery({
    queryKey: ['reviews', makerUuid ?? id],
    enabled: Boolean(makerUuid ?? id),
    queryFn: async () => {
      const result = await listReviewsForMaker(makerUuid ?? id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const maker = makerQuery.data;
  const menu = menuQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const primaryThali = menu[0];
  const primaryHref = primaryThali
    ? (`/(customer)/thali/${primaryThali.id}` as const)
    : null;
  const kitchenOpen = maker ? isKitchenOpen(maker) : false;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: maker?.kitchen_name ?? 'Kitchen',
      headerTransparent: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.onBackground,
      headerShadowVisible: false,
    });
  }, [maker?.kitchen_name, navigation]);

  const stats = useMemo(
    () => [
      { value: maker ? Number(maker.rating_avg).toFixed(1) : '—', label: 'Rating' },
      { value: String(maker?.rating_count ?? reviews.length), label: 'Reviews' },
      { value: String(menu.length), label: 'Items' },
    ],
    [maker, menu.length, reviews.length],
  );

  if (makerQuery.isLoading || menuQuery.isLoading) {
    return <LoadingState label="Opening kitchen…" />;
  }

  if (makerQuery.isError || !maker) {
    return (
      <ErrorState
        message={makerQuery.error?.message ?? 'Kitchen not found'}
        onRetry={() => void makerQuery.refetch()}
      />
    );
  }

  const stickyBarHeight = 88 + insets.bottom;
  const coverSource = imageSourceFromUrl(maker.cover_url, stitchImages.kitchenHero);
  const avatarSource = imageSourceFromUrl(maker.photo_url, stitchImages.naniPortrait);
  const locationLabel = maker.kitchen_address?.trim() || null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: stickyBarHeight + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View>
          <View style={styles.heroWrap}>
            <Image
              source={coverSource}
              style={[styles.hero, !kitchenOpen && styles.heroClosed]}
              resizeMode="cover"
            />
            <View
              style={[styles.heroScrim, !kitchenOpen && styles.heroScrimClosed]}
              pointerEvents="none"
            />
          </View>

          <View style={styles.profileBlock}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarWrap}>
                <Image
                  source={avatarSource}
                  style={[styles.avatar, !kitchenOpen && styles.avatarClosed]}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.kitchenName}>{maker.kitchen_name}</Text>
                {!kitchenOpen ? <Badge label="Closed" tone="neutral" /> : null}
              </View>
              <Text style={styles.chefName}>{maker.display_name}</Text>
              {locationLabel ? (
                <View style={styles.locationRow}>
                  <StitchIcon name="location-on" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.location}>{locationLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.badgeRow}>
              <ChefTrustBadge icon="restaurant" label="Home chef" tone="primary" />
              {maker.tier === 'verified' || maker.tier === 'featured' ? (
                <ChefTrustBadge icon="verified" label="Verified kitchen" tone="tertiary" />
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <StitchIcon name="star" size={16} color={colors.primary} />
              <Text style={styles.meta}>
                {Number(maker.rating_avg).toFixed(1)} · {maker.rating_count} reviews
                {maker.cuisine_tags.length ? ` · ${maker.cuisine_tags.join(' · ')}` : ''}
              </Text>
            </View>

            <ChefStatsCard stats={stats} />

            {maker.bio?.trim() ? (
              <View style={styles.story}>
                <Text style={styles.storyHeading}>Kitchen story</Text>
                <Text style={styles.bio}>{maker.bio}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.tabsSticky, { paddingTop: spacing.sm }]}>
          <View style={styles.tabs}>
            {(['menu', 'reviews', 'about'] as const).map((key) => {
              const active = tab === key;
              const label = key === 'menu' ? "Chef's Menu" : key === 'reviews' ? 'Reviews' : 'About';
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tab, active && styles.tabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.tabPanel}>
          {tab === 'menu' ? (
            <View style={styles.menuSection}>
              {menu.length === 0 ? (
                <Text style={styles.emptyMenu}>
                  {kitchenOpen
                    ? 'No dishes on the menu yet.'
                    : 'Kitchen is closed and has no available dishes.'}
                </Text>
              ) : (
                menu.map((item, index) => (
                  <MenuDishCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    basePrice={item.base_price}
                    mealSlot={item.meal_slot}
                    image={imageSourceFromUrl(
                      item.image_url,
                      index === 0 ? stitchImages.thaliDish : stitchImages.discoverThali,
                    )}
                    thaliHref={`/(customer)/thali/${item.id}`}
                    featured={index === 0}
                    tags={item.has_jain_variant ? ['Jain-friendly'] : undefined}
                    disabled={!kitchenOpen}
                  />
                ))
              )}
            </View>
          ) : null}

          {tab === 'reviews' ? (
            <View style={styles.reviewsSection}>
              {reviewsQuery.isLoading ? (
                <Text style={styles.emptyMenu}>Loading reviews…</Text>
              ) : reviews.length === 0 ? (
                <Text style={styles.emptyMenu}>No reviews yet for this kitchen.</Text>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewName}>
                        {'★'.repeat(Math.max(1, Math.min(5, review.rating)))}
                      </Text>
                      <Text style={styles.reviewStars}>{review.rating}/5</Text>
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewText}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'about' ? (
            <View style={styles.aboutSection}>
              {maker.bio?.trim() ? (
                <Text style={styles.aboutLead}>{maker.bio}</Text>
              ) : (
                <Text style={styles.aboutLead}>
                  {maker.display_name} cooks from {maker.kitchen_name}.
                </Text>
              )}
              {maker.cuisine_tags.length > 0 ? (
                <View style={styles.aboutList}>
                  <Text style={styles.aboutItem}>
                    · Cuisine: {maker.cuisine_tags.join(', ')}
                  </Text>
                  {locationLabel ? (
                    <Text style={styles.aboutItem}>· Kitchen: {locationLabel}</Text>
                  ) : null}
                  <Text style={styles.aboutItem}>
                    · Status: {kitchenOpen ? 'Accepting orders' : 'Closed'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {tab === 'menu' && primaryThali && primaryHref ? (
        kitchenOpen ? (
          <View
            style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.sm }, shadow.soft]}
          >
            <View style={styles.stickyCopy}>
              <Text style={styles.stickyLabel} numberOfLines={1}>
                {primaryThali.name}
              </Text>
              <Text style={styles.stickyPrice}>From ₹{primaryThali.base_price}</Text>
            </View>
            <Link href={primaryHref} asChild>
              <Button label="Order item" size="lg" style={styles.stickyCta} />
            </Link>
          </View>
        ) : (
          <View
            style={[
              styles.stickyBar,
              styles.stickyBarClosed,
              { paddingBottom: insets.bottom + spacing.sm },
              shadow.soft,
            ]}
          >
            <Text style={styles.closedNotice}>
              This kitchen is closed right now and not accepting new orders.
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { backgroundColor: colors.background },
  heroWrap: {
    height: 200,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.surfaceContainer,
  },
  hero: { width: '100%', height: '100%' },
  heroClosed: { opacity: 0.45 },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: colors.background,
    opacity: 0.92,
  },
  heroScrimClosed: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,27,24,0.45)',
    opacity: 1,
    height: undefined,
  },
  profileBlock: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.margin,
    paddingBottom: spacing.sm,
  },
  avatarRow: { marginTop: -44, marginBottom: spacing.sm },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    ...shadow.soft,
  },
  avatar: { width: '100%', height: '100%' },
  avatarClosed: { opacity: 0.5 },
  identityText: { gap: 6 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  kitchenName: { ...typography.headlineMd, color: colors.onBackground, flexShrink: 1 },
  chefName: { ...typography.labelMd, color: colors.primary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { ...typography.bodySm, color: colors.onSurfaceVariant },
  body: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.sm,
    gap: spacing.base,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  story: { gap: spacing.sm },
  storyHeading: {
    ...typography.headlineSm,
    color: colors.primary,
    fontStyle: 'italic',
  },
  bio: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 26 },
  tabsSticky: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.margin,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tab: { paddingBottom: spacing.sm },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  tabLabelActive: { color: colors.primary },
  tabPanel: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.base,
  },
  menuSection: { gap: spacing.base },
  emptyMenu: { ...typography.bodyMd, color: colors.outline },
  reviewsSection: { gap: spacing.base },
  reviewCard: {
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    gap: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewName: { ...typography.labelMd, color: colors.onSurface },
  reviewStars: { color: colors.primary },
  reviewText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  aboutSection: { gap: spacing.base },
  aboutLead: { ...typography.bodyLg, color: colors.onSurfaceVariant },
  aboutList: { gap: spacing.sm },
  aboutItem: { ...typography.bodyMd, color: colors.onSurface },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  stickyCopy: { flex: 1, gap: 2 },
  stickyLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  stickyPrice: { ...typography.labelMd, color: colors.primary },
  stickyCta: { minWidth: 160 },
  stickyBarClosed: { justifyContent: 'center' },
  closedNotice: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    flex: 1,
  },
});
