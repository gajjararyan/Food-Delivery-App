import { Link, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Badge, Card, StitchIcon } from '../ui';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { formatInr } from '../../lib/date';

export type MenuDishCardProps = {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  mealSlot?: 'lunch' | 'dinner';
  image: ImageSourcePropType;
  thaliHref: Href;
  badge?: string;
  tags?: string[];
  /** Featured = taller image + optional tags; same vertical layout as standard */
  featured?: boolean;
  /** Kitchen closed — greyed out, not tappable for orders */
  disabled?: boolean;
};

/** Stitch Chef Profile — unified vertical dish card (tap anywhere to customize). */
export function MenuDishCard({
  name,
  description,
  basePrice,
  mealSlot,
  image,
  thaliHref,
  badge,
  tags,
  featured = false,
  disabled = false,
}: MenuDishCardProps) {
  const slotBadge =
    mealSlot === 'lunch' ? 'Lunch' : mealSlot === 'dinner' ? 'Dinner' : null;

  const card = (
    <Card elevated style={[styles.card, disabled && styles.cardDisabled]}>
      <View style={[styles.imageWrap, featured && styles.imageWrapFeatured]}>
        <Image
          source={image}
          style={[styles.image, disabled && styles.imageDisabled]}
          resizeMode="cover"
        />
      </View>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, disabled && styles.textMuted]} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.badgeCol}>
            {disabled ? <Badge label="Closed" tone="neutral" /> : null}
            {!disabled && badge ? <Badge label={badge} tone="success" /> : null}
            {slotBadge ? <Badge label={slotBadge} tone="secondary" /> : null}
          </View>
        </View>
        {description ? (
          <Text style={[styles.desc, disabled && styles.textMuted]} numberOfLines={featured ? 3 : 2}>
            {description}
          </Text>
        ) : null}
        {tags?.length && !disabled ? (
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.footer}>
          <View>
            <Text style={styles.priceLabel}>Starting at</Text>
            <Text style={[styles.price, disabled && styles.textMuted]}>{formatInr(basePrice)}</Text>
          </View>
          {!disabled ? (
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>Customize</Text>
              <StitchIcon name="arrow-forward" size={18} color={colors.primary} />
            </View>
          ) : (
            <Text style={styles.unavailable}>Unavailable</Text>
          )}
        </View>
      </View>
    </Card>
  );

  if (disabled) {
    return (
      <View accessibilityRole="text" accessibilityLabel={`${name}, kitchen closed`}>
        {card}
      </View>
    );
  }

  return (
    <Link href={thaliHref} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Customize ${name}`}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {card}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', ...shadow.soft },
  cardDisabled: {
    backgroundColor: colors.surfaceContainerLow,
    opacity: 0.9,
  },
  pressed: { opacity: 0.92 },
  imageWrap: { height: 148, width: '100%' },
  imageWrapFeatured: { height: 180 },
  image: { width: '100%', height: '100%' },
  imageDisabled: { opacity: 0.4 },
  body: { padding: spacing.base, gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  title: { ...typography.headlineSm, color: colors.onSurface, flex: 1 },
  desc: { ...typography.bodySm, color: colors.onSurfaceVariant },
  textMuted: { color: colors.onSurfaceVariant },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
  },
  tagText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.secondary,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  priceLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  price: { ...typography.headlineSm, color: colors.primary },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: { ...typography.labelMd, color: colors.primary },
  unavailable: { ...typography.labelMd, color: colors.onSurfaceVariant },
});
