import { Link, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Badge, Card, StitchIcon } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { isKitchenOpen } from '../../lib/marketplace/kitchenStatus';
import type { MakerProfile } from '../../lib/types';

export type MakerCardProps = {
  maker: MakerProfile;
  href?: Href;
  image?: ImageSourcePropType;
};

function ratingLabel(maker: MakerProfile): string {
  const avg = Number(maker.rating_avg);
  const count = Number(maker.rating_count);
  const avgText = Number.isFinite(avg) ? avg.toFixed(1) : '0.0';
  return Number.isFinite(count) && count > 0 ? `${avgText} (${count})` : avgText;
}

/** Stitch Discover — kitchen card; closed kitchens stay visible but greyed. */
export function MakerCard({ maker, href, image }: MakerCardProps) {
  const tags = Array.isArray(maker.cuisine_tags) ? maker.cuisine_tags : [];
  const cuisine = tags.slice(0, 2).join(' · ');
  const open = isKitchenOpen(maker);

  const body = (
    <Card elevated style={[styles.card, !open && styles.cardClosed]}>
      {image ? (
        <View style={styles.imageWrap}>
          <Image
            source={image}
            style={[styles.image, !open && styles.imageClosed]}
            resizeMode="cover"
          />
          <View style={[styles.imageOverlay, !open && styles.imageOverlayClosed]} />
          {!open ? (
            <View style={styles.closedPill}>
              <Badge label="Closed" tone="neutral" />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.body, !open && styles.bodyClosed]}>
        <View style={styles.titleRow}>
          {maker.tier === 'verified' || maker.tier === 'featured' ? (
            <View style={styles.verifiedRow}>
              <StitchIcon
                name="verified"
                size={16}
                color={open ? colors.tertiary : colors.onSurfaceVariant}
              />
              <Badge label="Verified" tone={open ? 'success' : 'neutral'} />
            </View>
          ) : null}
          {!image && !open ? <Badge label="Closed" tone="neutral" /> : null}
        </View>
        <Text style={[styles.kitchen, !open && styles.textMuted]}>{maker.kitchen_name}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, !open && styles.textMuted]}>
            {open ? cuisine || 'Home kitchen' : 'Currently closed · opens later'}
          </Text>
          <View style={styles.ratingRow}>
            <StitchIcon name="star" size={14} color={open ? colors.primary : colors.outline} />
            <Text style={[styles.meta, !open && styles.textMuted]}>{ratingLabel(maker)}</Text>
          </View>
        </View>
        {maker.bio ? (
          <Text style={[styles.blurb, !open && styles.textMuted]} numberOfLines={2}>
            {maker.bio}
          </Text>
        ) : null}
      </View>
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          open ? maker.kitchen_name : `${maker.kitchen_name}, currently closed`
        }
      >
        {body}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  cardClosed: {
    backgroundColor: colors.surfaceContainerLow,
    opacity: 0.92,
  },
  imageWrap: { height: 140, width: '100%' },
  image: { width: '100%', height: '100%' },
  imageClosed: { opacity: 0.45 },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,27,24,0.12)',
  },
  imageOverlayClosed: {
    backgroundColor: 'rgba(30,27,24,0.38)',
  },
  closedPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  body: { padding: spacing.base, gap: spacing.sm },
  bodyClosed: { opacity: 0.85 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kitchen: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  meta: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  textMuted: {
    color: colors.onSurfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  blurb: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
});
