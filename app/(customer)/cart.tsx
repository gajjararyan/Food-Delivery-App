import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button, Card, EmptyState, Input } from '../../components/ui';
import { ThaliComponentRow } from '../../components/customer/ThaliComponentRow';
import { stitchImages } from '../../constants/images';
import { DELIVERY_PRICING } from '../../constants/delivery';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useCart } from '../../hooks/useCart';
import {
  calculateCartTotals,
  formatDeliveryWindow,
  mealSlotLabel,
} from '../../lib/delivery';
import { applyJainSubstitution } from '../../lib/jain';
import { calculateThaliPrice } from '../../lib/pricing';
import { isIncludedComponent } from '../../lib/thaliComponents';
import { customerAddonSectionTitle, customerPlateSectionTitle } from '../../lib/chef/componentSimple';
import { formatInr } from '../../lib/date';
import type { FulfillmentMode, Uuid } from '../../lib/types';

const FULFILLMENT_OPTIONS: { mode: FulfillmentMode; title: string; hint: string }[] = [
  {
    mode: 'takeaway',
    title: 'Takeaway',
    hint: 'Pick up from the kitchen · no fees',
  },
  {
    mode: 'delivery',
    title: 'Delivery',
    hint: `To your address · from ₹${(
      (DELIVERY_PRICING.platformFee + 15) *
      (1 + DELIVERY_PRICING.gstRatePercent / 100)
    ).toFixed(0)} incl. GST`,
  },
];

function formatFee(amount: number): string {
  return amount % 1 === 0 ? formatInr(amount) : `₹${amount.toFixed(2)}`;
}

export default function CartScreen() {
  const router = useRouter();
  const {
    line,
    clearCart,
    updateQuantities,
    setFulfillmentMode,
    setDeliveryAddress,
    setDeliveryDistanceKm,
    setCookingInstructions,
    hasItems,
  } = useCart();

  const priced = useMemo(() => {
    if (!line) return null;
    return calculateThaliPrice(
      line.basePrice,
      line.components,
      line.quantities,
      line.swapCreditsApplied,
    );
  }, [line]);

  const totals = useMemo(() => {
    if (!line || !priced) return null;
    return calculateCartTotals(line, priced.finalPrice);
  }, [line, priced]);

  const displayComponents = useMemo(() => {
    if (!line) return [];
    return applyJainSubstitution(line.components, line.applyJain);
  }, [line]);

  const includedComponents = useMemo(
    () => displayComponents.filter((c) => isIncludedComponent(c)),
    [displayComponents],
  );

  const addonComponents = useMemo(
    () => displayComponents.filter((c) => !isIncludedComponent(c)),
    [displayComponents],
  );

  const patchQuantity = (componentId: Uuid, next: number) => {
    updateQuantities({ ...line!.quantities, [componentId]: next });
  };

  if (!hasItems || !line || !priced || !totals) {
    return (
      <View style={styles.safe}>
        <EmptyState
          title="Your cart is empty"
          description="Build a thali to get started."
          glyph="🛒"
          actionLabel="Discover kitchens"
          onAction={() => router.replace('/(customer)/(tabs)/home')}
        />
      </View>
    );
  }

  const deliveryBlocked =
    line.fulfillmentMode === 'delivery' &&
    (!line.deliveryAddress?.trim() ||
      !totals.deliveryAvailable ||
      totals.distanceKm === null);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <StitchHero source={stitchImages.checkoutHero} aspectRatio={2.2} rounded={16} style={styles.hero} />
        <Text style={styles.eyebrow}>Cart</Text>
        <Text style={styles.title}>Your tiffin</Text>

        <Card style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Image source={stitchImages.cartItem} style={styles.itemImage} resizeMode="cover" />
            <View style={styles.itemMeta}>
              <Text style={styles.itemName}>{line.menuName}</Text>
              <Text style={styles.kitchen}>{line.kitchenName}</Text>
              <Text style={styles.mealSlotTag}>
                {mealSlotLabel(line.mealSlot)} item · {formatDeliveryWindow(line.deliveryWindow)}
              </Text>
              {line.applyJain ? <Text style={styles.jainTag}>Jain preparation</Text> : null}
              <Text style={styles.mealDate}>Meal date · {line.mealDate}</Text>
            </View>
          </View>

          {includedComponents.length > 0 ? (
            <Text style={styles.extrasHeading}>{customerPlateSectionTitle()}</Text>
          ) : null}
          {includedComponents.map((component) => (
            <View key={component.id} style={styles.componentRow}>
              <ThaliComponentRow
                component={component}
                displayName={component.name}
                value={line.quantities[component.id] ?? component.included_qty}
                onChange={(next) => patchQuantity(component.id, next)}
              />
            </View>
          ))}

          {addonComponents.length > 0 ? (
            <>
              <Text style={styles.extrasHeading}>{customerAddonSectionTitle()}</Text>
              {addonComponents.map((component) => (
                <View key={component.id} style={styles.componentRow}>
                  <ThaliComponentRow
                    component={component}
                    displayName={component.name}
                    value={line.quantities[component.id] ?? 0}
                    onChange={(next) => patchQuantity(component.id, next)}
                  />
                </View>
              ))}
            </>
          ) : null}

          <Pressable onPress={clearCart} accessibilityRole="button">
            <Text style={styles.remove}>Remove item</Text>
          </Pressable>
        </Card>

        <Text style={styles.sectionLabel}>How do you want it?</Text>
        <View style={styles.fulfillmentRow}>
          {FULFILLMENT_OPTIONS.map((option) => {
            const selected = line.fulfillmentMode === option.mode;
            return (
              <Pressable
                key={option.mode}
                onPress={() => setFulfillmentMode(option.mode)}
                style={[
                  styles.fulfillmentCard,
                  selected && styles.fulfillmentCardSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.fulfillmentTitle, selected && styles.fulfillmentTextSelected]}>
                  {option.title}
                </Text>
                <Text style={[styles.fulfillmentHint, selected && styles.fulfillmentTextSelected]}>
                  {option.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {line.fulfillmentMode === 'delivery' ? (
          <Card style={styles.addressCard}>
            <Text style={styles.sectionLabel}>Deliver to</Text>
            <Input
              label="Your address"
              value={line.deliveryAddress ?? ''}
              onChangeText={setDeliveryAddress}
              placeholder="Flat, street, area, landmark…"
            />
            <Input
              label="Distance from kitchen (km)"
              keyboardType="decimal-pad"
              value={
                line.deliveryDistanceKm !== undefined
                  ? String(line.deliveryDistanceKm)
                  : ''
              }
              onChangeText={setDeliveryDistanceKm}
              placeholder="e.g. 3.5"
            />
            <Text style={styles.addressHint}>
              Enter how far you are from the kitchen. Delivery up to{' '}
              {DELIVERY_PRICING.maxServiceDistanceKm} km.
            </Text>
          </Card>
        ) : null}

        <Card style={styles.noteCard}>
          <Text style={styles.sectionLabel}>Cooking instructions (optional)</Text>
          <Text style={styles.noteHint}>
            Tell the kitchen special requests — spice level, less oil, “no onion”, or allergies.
            Kitchens try to honour these when they can.
          </Text>
          <Input
            label="Note for the cook"
            value={line.cookingInstructions ?? ''}
            onChangeText={setCookingInstructions}
            placeholder="e.g. Medium spicy · nut allergy · no onion/garlic"
            multiline
            numberOfLines={3}
            maxLength={200}
            style={styles.noteInput}
          />
          <Text style={styles.noteCount}>
            {(line.cookingInstructions ?? '').length}/200
          </Text>
        </Card>

        <Card style={styles.slotInfo}>
          <Text style={styles.slotInfoLabel}>Serving time</Text>
          <Text style={styles.slotInfoValue}>
            {mealSlotLabel(line.mealSlot)} · {formatDeliveryWindow(line.deliveryWindow)}
          </Text>
          <Text style={styles.slotInfoHint}>
            Set by the cook for this item — {mealSlotLabel(line.mealSlot).toLowerCase()} only.
          </Text>
        </Card>

        {deliveryBlocked ? (
          <Text style={styles.warning}>
            {totals.distanceKm === null
              ? 'Enter your address and distance (km) for delivery fees.'
              : `Delivery is not available beyond ${DELIVERY_PRICING.maxServiceDistanceKm} km. Try takeaway or a nearer address.`}
          </Text>
        ) : null}

        <Card style={styles.bill}>
          <Text style={styles.sectionLabel}>Bill summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total</Text>
            <Text style={styles.billValue}>{formatInr(totals.itemTotal)}</Text>
          </View>

          {line.fulfillmentMode === 'delivery' && totals.fees ? (
            <>
              {totals.fees.lines.map((feeLine) => (
                <View key={feeLine.key} style={styles.billRow}>
                  <Text style={styles.billLabel}>{feeLine.label}</Text>
                  <Text style={styles.billValue}>{formatFee(feeLine.amount)}</Text>
                </View>
              ))}
              <Text style={styles.billHint}>
                {totals.customerAddressLabel}
                {totals.distanceKm !== null ? ` · ${totals.distanceKm.toFixed(1)} km` : ''}
                {totals.itemTotal >= DELIVERY_PRICING.discountedDeliveryMinOrder
                  ? ' · lower delivery on orders ₹150+'
                  : ''}
                {` · fees excl. meal; GST ${DELIVERY_PRICING.gstRatePercent}% on fees`}
              </Text>
            </>
          ) : (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Fees</Text>
              <Text style={styles.billValue}>{formatInr(0)}</Text>
            </View>
          )}

          <View style={[styles.billRow, styles.billTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatFee(totals.grandTotal)}</Text>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Link href="/(customer)/checkout" asChild>
          <Button
            label="Continue to checkout"
            size="lg"
            style={styles.cta}
            disabled={deliveryBlocked}
          />
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.margin,
    gap: spacing.md,
    paddingBottom: 120,
  },
  hero: { marginTop: -spacing.margin, marginHorizontal: -spacing.margin },
  eyebrow: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  itemCard: { gap: spacing.sm },
  itemHeader: { flexDirection: 'row', gap: spacing.base },
  itemImage: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
  },
  itemMeta: { flex: 1, gap: 2 },
  itemName: { ...typography.headlineSm, color: colors.onSurface },
  kitchen: { ...typography.bodySm, color: colors.onSurfaceVariant },
  mealSlotTag: { ...typography.labelSm, color: colors.primary },
  jainTag: { ...typography.labelSm, color: colors.tertiary },
  mealDate: { ...typography.bodySm, color: colors.outline },
  componentRow: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  extrasHeading: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.sm,
  },
  remove: {
    ...typography.labelMd,
    color: colors.error,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  fulfillmentRow: { flexDirection: 'row', gap: spacing.sm },
  fulfillmentCard: {
    flex: 1,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    gap: 4,
  },
  fulfillmentCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLow,
  },
  fulfillmentTitle: { ...typography.labelMd, color: colors.onSurface },
  fulfillmentHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  fulfillmentTextSelected: { color: colors.primary },
  addressCard: { gap: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  addressHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  noteCard: { gap: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  noteHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top' as const,
  },
  noteCount: {
    ...typography.labelSm,
    color: colors.outline,
    textAlign: 'right' as const,
  },
  slotInfo: { gap: 4, backgroundColor: colors.surfaceContainerLow },
  slotInfoLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotInfoValue: { ...typography.labelMd, color: colors.onSurface },
  slotInfoHint: { ...typography.bodySm, color: colors.outline, lineHeight: 18 },
  warning: { ...typography.bodySm, color: colors.error, lineHeight: 20 },
  bill: { gap: spacing.sm },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  billValue: { ...typography.bodyMd, color: colors.onSurface },
  billHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  billTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  totalLabel: { ...typography.labelMd, color: colors.onSurface },
  totalValue: { ...typography.headlineSm, color: colors.onSurface },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.margin,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  cta: { width: '100%' },
});
