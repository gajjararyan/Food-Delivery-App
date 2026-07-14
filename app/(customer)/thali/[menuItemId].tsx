import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { StitchHero } from '../../../components/customer/StitchHero';
import { ThaliComponentRow } from '../../../components/customer/ThaliComponentRow';
import { Button, ErrorState, LoadingState } from '../../../components/ui';
import { resolveMenuItemId } from '../../../constants/seedCatalog';
import { stitchImages } from '../../../constants/images';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useCart } from '../../../hooks/useCart';
import { getMaker, getMenuItemWithComponents } from '../../../lib/api/menu';
import { formatInr, todayISODate } from '../../../lib/date';
import { applyJainSubstitution } from '../../../lib/jain';
import { calculateThaliPrice } from '../../../lib/pricing';
import { defaultQuantityForComponent, isIncludedComponent } from '../../../lib/thaliComponents';
import { customerAddonSectionTitle, customerPlateSectionTitle } from '../../../lib/chef/componentSimple';
import type { DeliveryWindow, Uuid } from '../../../lib/types';
import { deliveryWindowForMealSlot } from '../../../lib/delivery';

type ThaliEdits = {
  menuId: string;
  quantities: Record<Uuid, number>;
  jainOverride: boolean | null;
};

/**
 * Stitch: Custom Thali Builder (d760e58f344748f9805b169f5052446e)
 * Quantity steppers + live pricing.ts total. Stitch grain/oil toggles mapped to
 * included-qty steppers (MVP). Jain swap uses profile preference + local toggle.
 */
export default function ThaliBuilderScreen() {
  const router = useRouter();
  const { setLine } = useCart();
  const { profile } = useAuth();
  const { menuItemId: rawId } = useLocalSearchParams<{ menuItemId: string }>();
  const menuItemId = resolveMenuItemId(typeof rawId === 'string' ? rawId : '');

  const [edits, setEdits] = useState<ThaliEdits | null>(null);

  const thaliQuery = useQuery({
    queryKey: ['thali', menuItemId],
    enabled: Boolean(menuItemId),
    queryFn: async () => {
      const result = await getMenuItemWithComponents(menuItemId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchOnMount: 'always',
  });

  const makerQuery = useQuery({
    queryKey: ['maker-for-thali', thaliQuery.data?.menuItem.maker_id],
    enabled: Boolean(thaliQuery.data?.menuItem.maker_id),
    queryFn: async () => {
      const result = await getMaker(thaliQuery.data!.menuItem.maker_id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const activeEdits = edits?.menuId === menuItemId ? edits : null;

  const applyJain =
    activeEdits?.jainOverride ?? Boolean(profile?.jain_preference);

  const quantities = useMemo(() => {
    if (!thaliQuery.data) return null;
    if (activeEdits) return activeEdits.quantities;
    return Object.fromEntries(
      thaliQuery.data.components.map((c) => [c.id, defaultQuantityForComponent(c)]),
    ) as Record<Uuid, number>;
  }, [thaliQuery.data, activeEdits]);

  const displayComponents = useMemo(() => {
    if (!thaliQuery.data) return [];
    return applyJainSubstitution(thaliQuery.data.components, applyJain);
  }, [thaliQuery.data, applyJain]);

  const includedComponents = useMemo(
    () => displayComponents.filter((c) => isIncludedComponent(c)),
    [displayComponents],
  );

  const addonComponents = useMemo(
    () => displayComponents.filter((c) => !isIncludedComponent(c)),
    [displayComponents],
  );

  const price = useMemo(() => {
    if (!thaliQuery.data || !quantities) return null;
    return calculateThaliPrice(
      thaliQuery.data.menuItem.base_price,
      thaliQuery.data.components,
      quantities,
      0,
    );
  }, [thaliQuery.data, quantities]);

  if (thaliQuery.isLoading || !quantities) {
    return <LoadingState label="Loading thali…" />;
  }

  if (thaliQuery.isError || !thaliQuery.data) {
    return (
      <ErrorState
        message={thaliQuery.error?.message ?? 'Thali not found'}
        onRetry={() => void thaliQuery.refetch()}
      />
    );
  }

  const { menuItem, components } = thaliQuery.data;
  const deliveryWindow: DeliveryWindow = deliveryWindowForMealSlot(menuItem.meal_slot);

  const patchEdits = (patch: Partial<Omit<ThaliEdits, 'menuId'>>) => {
    setEdits({
      menuId: menuItemId,
      quantities: patch.quantities ?? quantities,
      jainOverride:
        patch.jainOverride !== undefined
          ? patch.jainOverride
          : (activeEdits?.jainOverride ?? null),
    });
  };

  const onAddToCart = () => {
    if (!price) return;
    const maker = makerQuery.data;
    setLine({
      menuItemId: menuItem.id,
      makerId: menuItem.maker_id,
      menuName: menuItem.name,
      kitchenName: maker?.kitchen_name ?? 'Home kitchen',
      basePrice: menuItem.base_price,
      components: components.map((c) => ({
        id: c.id,
        name: c.name,
        serving_amount: c.serving_amount,
        serving_unit: c.serving_unit,
        included_qty: c.included_qty,
        min_qty: c.min_qty,
        max_qty: c.max_qty,
        unit_price_delta: c.unit_price_delta,
        has_jain_variant: c.has_jain_variant,
        jain_substitute: c.jain_substitute,
        component_type: c.component_type,
      })),
      quantities: price.clampedQuantities,
      applyJain,
      swapCreditsApplied: 0,
      mealSlot: menuItem.meal_slot,
      fulfillmentMode: 'takeaway',
      deliveryWindow,
      mealDate: todayISODate(),
    });
    router.push('/(customer)/cart');
  };

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <StitchHero source={stitchImages.thaliHero} aspectRatio={2.2} style={styles.hero} />
        <Text style={styles.eyebrow}>Customize thali</Text>
        <Text style={styles.title}>{menuItem.name}</Text>
        {menuItem.description ? (
          <Text style={styles.sub}>{menuItem.description}</Text>
        ) : null}

        {menuItem.has_jain_variant ? (
          <View style={styles.jainRow}>
            <View style={styles.jainCopy}>
              <Text style={styles.jainLabel}>Jain preparation</Text>
              <Text style={styles.jainHint}>Applied to the whole thali</Text>
            </View>
            <Switch
              value={applyJain}
              onValueChange={(next) => patchEdits({ jainOverride: next })}
              trackColor={{ false: colors.outlineVariant, true: colors.tertiaryContainer }}
              thumbColor={applyJain ? colors.tertiary : colors.surfaceContainerHighest}
            />
          </View>
        ) : null}

        {includedComponents.length > 0 ? (
          <Text style={styles.extrasHeading}>{customerPlateSectionTitle()}</Text>
        ) : null}
        {includedComponents.map((component) => (
          <ThaliComponentRow
            key={component.id}
            component={component}
            displayName={component.name}
            value={quantities[component.id] ?? component.included_qty}
            onChange={(next) =>
              patchEdits({
                quantities: {
                  ...quantities,
                  [component.id]: next,
                },
              })
            }
          />
        ))}

        {addonComponents.length > 0 ? (
          <>
            <Text style={styles.extrasHeading}>{customerAddonSectionTitle()}</Text>
            {addonComponents.map((component) => (
              <ThaliComponentRow
                key={component.id}
                component={component}
                displayName={component.name}
                value={quantities[component.id] ?? 0}
                onChange={(next) =>
                  patchEdits({
                    quantities: {
                      ...quantities,
                      [component.id]: next,
                    },
                  })
                }
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.total}>{formatInr(price?.finalPrice ?? menuItem.base_price)}</Text>
        <Button
          label="Add to cart"
          size="lg"
          style={styles.cta}
          onPress={onAddToCart}
          disabled={!price}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.margin, gap: spacing.md, paddingBottom: 120 },
  hero: { marginHorizontal: -spacing.margin, width: undefined, alignSelf: 'stretch' },
  eyebrow: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  jainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
  },
  jainCopy: { flex: 1, gap: 2 },
  jainLabel: { ...typography.labelMd, color: colors.onSurface },
  jainHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  extrasHeading: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.margin,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  total: { ...typography.headlineSm, color: colors.onSurface, minWidth: 72 },
  cta: { flex: 1 },
});
