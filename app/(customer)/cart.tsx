import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AddressPickerPanel } from '../../components/customer/AddressPickerPanel';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button, Card, EmptyState, Input } from '../../components/ui';
import { ThaliComponentRow } from '../../components/customer/ThaliComponentRow';
import { stitchImages } from '../../constants/images';
import { DELIVERY_LOCATIONS, DELIVERY_PRICING } from '../../constants/delivery';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import {
  calculateCartTotals,
  formatDeliveryWindow,
  mealSlotLabel,
} from '../../lib/delivery';
import { applyJainSubstitution } from '../../lib/jain';
import { estimateTravel } from '../../lib/maps/distanceEstimate';
import { formatSpotTitle } from '../../lib/maps/formatLocation';
import { fetchCommunityMaker } from '../../lib/api/chefs';
import { hasKitchenPin } from '../../lib/marketplace/kitchenStatus';
import { calculateThaliPrice } from '../../lib/pricing';
import { isIncludedComponent } from '../../lib/thaliComponents';
import { customerAddonSectionTitle, customerPlateSectionTitle } from '../../lib/chef/componentSimple';
import { formatInr } from '../../lib/date';
import type { FulfillmentMode, MakerProfile, Uuid } from '../../lib/types';

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
  const { user } = useAuth();
  const {
    line,
    clearCart,
    updateQuantities,
    setFulfillmentMode,
    setDeliveryLocation,
    setPickupDetails,
    setCookingInstructions,
    hasItems,
  } = useCart();
  const [maker, setMaker] = useState<MakerProfile | null>(null);

  useEffect(() => {
    if (!line?.makerId) {
      setMaker(null);
      return;
    }
    let cancelled = false;
    void fetchCommunityMaker(line.makerId).then((result) => {
      if (!cancelled && result.ok) setMaker(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [line?.makerId]);

  const kitchenReady = hasKitchenPin(maker);

  const kitchenPoint = useMemo(() => {
    if (!kitchenReady || maker?.lat == null || maker?.lng == null) return null;
    return { lat: maker.lat, lng: maker.lng };
  }, [kitchenReady, maker?.lat, maker?.lng]);

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

  const travelEstimate = useMemo(() => {
    if (!kitchenPoint || !line?.customerLat || !line?.customerLng) return null;
    return estimateTravel(kitchenPoint, {
      lat: line.customerLat,
      lng: line.customerLng,
    });
  }, [line?.customerLat, line?.customerLng, kitchenPoint]);

  // Keep fee distance in sync with kitchen pin + address (road estimate).
  useEffect(() => {
    if (!line || line.fulfillmentMode !== 'delivery') return;
    if (!kitchenPoint || line.customerLat == null || line.customerLng == null) return;
    const travel = estimateTravel(kitchenPoint, {
      lat: line.customerLat,
      lng: line.customerLng,
    });
    const next = Math.round(travel.km * 10) / 10;
    const prev = line.deliveryDistanceKm;
    if (prev != null && Math.abs(prev - next) < 0.05) return;
    setDeliveryLocation({
      label: line.deliveryAddress || formatSpotTitle({ label: 'Delivery', hint: null }),
      hint: null,
      lat: line.customerLat,
      lng: line.customerLng,
      distanceKm: next,
      savedAddressId: line.savedAddressId,
    });
  }, [
    line,
    kitchenPoint,
    setDeliveryLocation,
  ]);

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

  const kitchenBlocked = !kitchenReady;

  const deliveryBlocked =
    line.fulfillmentMode === 'delivery' &&
    (!line.deliveryAddress?.trim() ||
      line.customerLat == null ||
      line.customerLng == null ||
      !totals.deliveryAvailable ||
      totals.distanceKm === null ||
      kitchenBlocked);

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
          <>
            <AddressPickerPanel
              customerId={user?.id}
              selectedId={line.savedAddressId}
              selectedLabel={line.deliveryAddress}
              selectedLat={line.customerLat}
              selectedLng={line.customerLng}
              title="Deliver to"
              onSelect={(picked) => {
                const travel = kitchenPoint
                  ? estimateTravel(kitchenPoint, {
                      lat: picked.lat,
                      lng: picked.lng,
                    })
                  : null;
                setDeliveryLocation({
                  label: formatSpotTitle({
                    label: picked.label,
                    hint: picked.hint,
                  }),
                  hint: picked.hint,
                  lat: picked.lat,
                  lng: picked.lng,
                  distanceKm: travel?.km ?? 0,
                  savedAddressId: picked.savedAddressId,
                });
              }}
            />
            {!kitchenReady ? (
              <Text style={styles.addressHint}>
                Delivery distance needs the cook’s kitchen pin. Ask them to set it on their Menu
                tab — your address below is ready.
              </Text>
            ) : travelEstimate && !totals.deliveryAvailable ? (
              <Text style={styles.warningInline}>
                Too far: ~{travelEstimate.km} km away. This kitchen delivers only within{' '}
                {DELIVERY_PRICING.maxServiceDistanceKm} km — pick a nearer address or switch to
                takeaway.
              </Text>
            ) : travelEstimate ? (
              <Text style={styles.addressHint}>
                Kitchen → you: ~{travelEstimate.km} km road approx. · ~{travelEstimate.minutes} min.
                Delivery radius: {DELIVERY_PRICING.maxServiceDistanceKm} km.
              </Text>
            ) : (
              <Text style={styles.addressHint}>
                Your permanent address is used by default. Tap Change if you want a different pin
                for this order. Delivery is within {DELIVERY_PRICING.maxServiceDistanceKm} km of
                the kitchen.
              </Text>
            )}
          </>
        ) : null}

        {line.fulfillmentMode === 'takeaway' ? (
          <>
            <AddressPickerPanel
              customerId={user?.id}
              selectedId={line.savedAddressId}
              selectedLabel={
                line.pickupLat != null && line.pickupLng != null
                  ? line.deliveryAddress ?? null
                  : null
              }
              selectedLat={line.pickupLat}
              selectedLng={line.pickupLng}
              title="Pickup starting point (optional)"
              onSelect={(picked) =>
                setPickupDetails({
                  pickupIsSelf: true,
                  pickupContactName: null,
                  label: formatSpotTitle({
                    label: picked.label,
                    hint: picked.hint,
                  }),
                  lat: picked.lat,
                  lng: picked.lng,
                  savedAddressId: picked.savedAddressId ?? null,
                })
              }
            />
            <Text style={styles.addressHint}>
              Optional: where you’re coming from (defaults to your permanent address). You can
              change it or skip — set later at checkout if you prefer.
            </Text>
          </>
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

        {kitchenBlocked ? (
          <Text style={styles.warning}>
            This cook hasn’t set their kitchen map pin yet (Menu tab → kitchen location). Orders
            stay paused until they add it — this is not about your delivery address.
          </Text>
        ) : null}

        {deliveryBlocked && !kitchenBlocked ? (
          <Text style={styles.warning}>
            {line.customerLat == null || !line.deliveryAddress?.trim()
              ? 'Choose a delivery location on the map to continue.'
              : totals.distanceKm != null && !totals.deliveryAvailable
                ? `Delivery is only within ${DELIVERY_PRICING.maxServiceDistanceKm} km (~${totals.distanceKm.toFixed(1)} km away). Try takeaway or a nearer address.`
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
            disabled={deliveryBlocked || kitchenBlocked}
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
  addressHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  warningInline: { ...typography.bodySm, color: colors.error, lineHeight: 18 },
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
