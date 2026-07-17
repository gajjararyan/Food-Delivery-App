import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  radius,
  spacing,
  typography,
} from '../../constants/theme';
import {
  createAddress,
  listAddresses,
  updateAddress,
} from '../../lib/api/addresses';
import type { SavedAddress } from '../../lib/types';
import { reverseGeocode } from '../../lib/maps/geocode';
import {
  coordsNear,
  formatCoordsLabel,
  formatSpotTitle,
  isCoordsLabel,
} from '../../lib/maps/formatLocation';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui';
import { StitchIcon } from '../ui/StitchIcon';
import { LocationPickerMap } from './LocationPickerMap';
import { LocationPreviewMap } from './LocationPreviewMap';

function placeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export type AddressPick = {
  savedAddressId?: string | null;
  label: string;
  hint?: string;
  lat: number;
  lng: number;
};

type Props = {
  customerId?: string | null;
  selectedId?: string | null;
  selectedLabel?: string | null;
  selectedLat?: number | null;
  selectedLng?: number | null;
  title?: string;
  onSelect: (pick: AddressPick) => void;
};

/**
 * Simple 2-pin model:
 * 1) Permanent address (saved home / default)
 * 2) Current pin for this order (can differ; updated on Change)
 */
export function AddressPickerPanel({
  customerId,
  selectedId,
  selectedLabel,
  selectedLat,
  selectedLng,
  title = 'Delivery address',
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [permanent, setPermanent] = useState<SavedAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [hintDraft, setHintDraft] = useState('');
  const [saveAsPermanent, setSaveAsPermanent] = useState(false);
  const [mapSession, setMapSession] = useState(0);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [pendingPlaceName, setPendingPlaceName] = useState<string | null>(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const autoAppliedForId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setPermanent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listAddresses(customerId);
    if (res.ok) {
      const list = res.data;
      const preferred =
        list.find((a) => a.is_default) ??
        list[0] ??
        null;
      setPermanent(preferred);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Default to permanent address when cart/checkout has no pin yet.
  useEffect(() => {
    if (loading || !permanent) return;
    if (selectedLat != null && selectedLng != null) {
      autoAppliedForId.current = permanent.id;
      return;
    }
    if (autoAppliedForId.current === permanent.id) return;
    autoAppliedForId.current = permanent.id;
    onSelectRef.current({
      savedAddressId: permanent.id,
      label: formatSpotTitle({
        label: permanent.label,
        hint: permanent.formatted_hint,
      }),
      hint: permanent.formatted_hint ?? undefined,
      lat: permanent.lat,
      lng: permanent.lng,
    });
  }, [loading, permanent, selectedLat, selectedLng]);

  const resolvePlaceName = useCallback(async (lat: number, lng: number) => {
    const key = placeCacheKey(lat, lng);
    let existing: string | undefined;
    setPlaceNames((prev) => {
      existing = prev[key];
      return prev;
    });
    if (existing) return existing;

    try {
      const geo = await reverseGeocode(lat, lng);
      const name = geo.shortAddress ?? geo.address;
      setPlaceNames((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: name };
      });
      return name;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!permanent) return;
    void resolvePlaceName(permanent.lat, permanent.lng);
  }, [permanent?.lat, permanent?.lng, resolvePlaceName]);

  useEffect(() => {
    if (selectedLat == null || selectedLng == null) return;
    void resolvePlaceName(selectedLat, selectedLng);
  }, [selectedLat, selectedLng, resolvePlaceName]);

  const hasCurrent =
    selectedLat != null && selectedLng != null;

  const usingPermanent =
    permanent != null &&
    ((selectedId != null && selectedId === permanent.id) ||
      (hasCurrent &&
        coordsNear(permanent, {
          lat: selectedLat!,
          lng: selectedLng!,
        })));

  const permanentPlace =
    permanent != null
      ? placeNames[placeCacheKey(permanent.lat, permanent.lng)]
      : undefined;

  const currentPlace =
    hasCurrent
      ? placeNames[placeCacheKey(selectedLat!, selectedLng!)]
      : undefined;

  const currentTitle = useMemo(() => {
    if (usingPermanent && permanent) {
      const named = formatSpotTitle({
        label: permanent.label,
        hint: permanent.formatted_hint,
      });
      if (named !== 'Saved pin') return named;
      return permanentPlace ?? named;
    }
    if (selectedLabel?.trim()) {
      const named = formatSpotTitle({
        label: selectedLabel,
        hint: null,
      });
      if (named !== 'Saved pin') return named;
    }
    return currentPlace ?? 'Current pin';
  }, [
    usingPermanent,
    permanent,
    selectedLabel,
    permanentPlace,
    currentPlace,
  ]);

  const permanentTitle = useMemo(() => {
    if (!permanent) return null;
    const named = formatSpotTitle({
      label: permanent.label,
      hint: permanent.formatted_hint,
    });
    if (named !== 'Saved pin') return named;
    return permanentPlace ?? named;
  }, [permanent, permanentPlace]);

  const openMap = () => {
    setPendingPoint(null);
    setPendingPlaceName(null);
    setLabelDraft(
      usingPermanent && permanent && !isCoordsLabel(permanent.label)
        ? permanent.label
        : '',
    );
    setHintDraft(
      usingPermanent && permanent
        ? permanent.formatted_hint ?? ''
        : '',
    );
    setSaveAsPermanent(false);
    setMapSession((n) => n + 1);
    setMapOpen(true);
  };

  const usePermanent = () => {
    if (!permanent) return;
    const place =
      permanentPlace ??
      formatSpotTitle({
        label: permanent.label,
        hint: permanent.formatted_hint,
      });
    onSelect({
      savedAddressId: permanent.id,
      label: place,
      hint: permanent.formatted_hint ?? undefined,
      lat: permanent.lat,
      lng: permanent.lng,
    });
  };

  const finishPick = async (pick: AddressPick, makePermanent: boolean) => {
    if (makePermanent && customerId) {
      if (permanent) {
        const updated = await updateAddress(permanent.id, customerId, {
          label: pick.label,
          formatted_hint: pick.hint ?? permanent.formatted_hint,
          lat: pick.lat,
          lng: pick.lng,
        });
        if (updated.ok) {
          onSelect({
            savedAddressId: permanent.id,
            label: pick.label,
            hint: pick.hint,
            lat: pick.lat,
            lng: pick.lng,
          });
          setMapOpen(false);
          setPendingPoint(null);
          void refresh();
          return;
        }
      } else {
        const created = await createAddress({
          customerId,
          label: pick.label,
          lat: pick.lat,
          lng: pick.lng,
          formattedHint: pick.hint,
          isDefault: true,
        });
        if (created.ok) {
          onSelect({
            savedAddressId: created.data.id,
            label: pick.label,
            hint: pick.hint,
            lat: pick.lat,
            lng: pick.lng,
          });
          setMapOpen(false);
          setPendingPoint(null);
          void refresh();
          return;
        }
      }
    }

    // Current pin for this order only — do not create more saved addresses.
    onSelect({
      ...pick,
      savedAddressId: null,
    });
    setMapOpen(false);
    setPendingPoint(null);
  };

  const confirmPin = async () => {
    if (!pendingPoint) return;

    const place =
      pendingPlaceName ??
      (await resolvePlaceName(pendingPoint.lat, pendingPoint.lng)) ??
      formatCoordsLabel(pendingPoint.lat, pendingPoint.lng);

    const label = saveAsPermanent
      ? labelDraft.trim() || place
      : place;
    const hint = saveAsPermanent
      ? hintDraft.trim() || place
      : place;

    await finishPick(
      {
        label,
        hint,
        lat: pendingPoint.lat,
        lng: pendingPoint.lng,
      },
      saveAsPermanent,
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>

      {/* 1) Permanent address */}
      {permanent ? (
        <Pressable
          onPress={usePermanent}
          style={[styles.slot, usingPermanent && styles.slotActive]}
        >
          <View style={styles.slotTop}>
            <View style={styles.slotIcon}>
              <StitchIcon name="location-on" size={18} color={colors.primary} />
            </View>
            <View style={styles.slotBody}>
              <Text style={styles.slotEyebrow}>Permanent address</Text>
              <Text style={styles.slotTitle} numberOfLines={2}>
                {permanentTitle}
              </Text>
              {permanentPlace && permanentTitle !== permanentPlace ? (
                <Text style={styles.slotCoords} numberOfLines={2}>
                  {permanentPlace}
                </Text>
              ) : (
                <Text style={styles.slotCoords}>
                  {formatCoordsLabel(permanent.lat, permanent.lng)}
                </Text>
              )}
            </View>
            {usingPermanent ? <Badge label="In use" tone="success" /> : null}
          </View>
          {!usingPermanent ? (
            <Text style={styles.slotHint}>Tap to use this address</Text>
          ) : null}
        </Pressable>
      ) : loading ? (
        <Text style={styles.muted}>Loading address…</Text>
      ) : (
        <Card style={styles.emptySlot}>
          <Text style={styles.slotEyebrow}>Permanent address</Text>
          <Text style={styles.muted}>
            Not set yet. Pin a location and tick “Save as permanent address”.
          </Text>
        </Card>
      )}

      {/* 2) Current pin for this order */}
      <View style={[styles.slot, hasCurrent && !usingPermanent && styles.slotActive]}>
        <View style={styles.slotTop}>
          <View style={[styles.slotIcon, styles.slotIconCurrent]}>
            <StitchIcon name="navigation" size={18} color={colors.onPrimary} />
          </View>
          <View style={styles.slotBody}>
            <Text style={styles.slotEyebrow}>For this order</Text>
            <Text style={styles.slotTitle} numberOfLines={2}>
              {hasCurrent ? currentTitle : 'No pin yet'}
            </Text>
            {hasCurrent ? (
              currentPlace && currentTitle !== currentPlace ? (
                <Text style={styles.slotCoords} numberOfLines={2}>
                  {currentPlace}
                </Text>
              ) : (
                <Text style={styles.slotCoords}>
                  {formatCoordsLabel(selectedLat!, selectedLng!)}
                </Text>
              )
            ) : (
              <Text style={styles.muted}>
                Drop a pin for pickup / delivery on this order.
              </Text>
            )}
          </View>
          {hasCurrent && !usingPermanent ? (
            <Badge label="In use" tone="success" />
          ) : null}
        </View>

        {hasCurrent ? (
          <LocationPreviewMap
            key={`preview-${selectedLat!.toFixed(5)}-${selectedLng!.toFixed(5)}`}
            lat={selectedLat!}
            lng={selectedLng!}
            height={150}
          />
        ) : null}

        <Button
          label={hasCurrent ? 'Update pin on map' : 'Drop pin on map'}
          variant={hasCurrent ? 'outline' : 'primary'}
          onPress={openMap}
        />
      </View>

      <Modal
        visible={mapOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapOpen(false)}
      >
        <View
          style={[
            styles.modalPage,
            {
              paddingTop: Math.max(insets.top, spacing.lg),
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>
                {pendingPoint ? 'Confirm pin' : 'Update pin'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {pendingPoint
                  ? 'Name it only if you want to save it as your permanent address.'
                  : 'Move the map until the pin is on the exact spot.'}
              </Text>
            </View>
            <Pressable onPress={() => setMapOpen(false)} style={styles.closeBtn}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {!pendingPoint ? (
            <View style={styles.mapStep}>
              <LocationPickerMap
                key={`picker-${mapSession}`}
                fill
                initialLat={selectedLat ?? permanent?.lat}
                initialLng={selectedLng ?? permanent?.lng}
                confirmLabel="Continue"
                onConfirm={(point) => {
                  setPendingPoint(point);
                  setResolvingPlace(true);
                  setPendingPlaceName(null);
                  void resolvePlaceName(point.lat, point.lng)
                    .then((name) => {
                      if (name) {
                        setPendingPlaceName(name);
                        if (!labelDraft.trim()) setLabelDraft(name);
                      }
                    })
                    .finally(() => setResolvingPlace(false));
                }}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.nameScroll}
              contentContainerStyle={styles.nameForm}
              keyboardShouldPersistTaps="handled"
            >
              <LocationPreviewMap
                key={`confirm-${pendingPoint.lat.toFixed(5)}-${pendingPoint.lng.toFixed(5)}`}
                lat={pendingPoint.lat}
                lng={pendingPoint.lng}
                height={180}
              />
              <Text style={styles.slotTitle}>
                {resolvingPlace
                  ? 'Finding place name…'
                  : pendingPlaceName ??
                    formatCoordsLabel(pendingPoint.lat, pendingPoint.lng)}
              </Text>
              <Text style={styles.slotCoords}>
                {formatCoordsLabel(pendingPoint.lat, pendingPoint.lng)}
              </Text>

              <Pressable
                style={styles.checkRow}
                onPress={() => setSaveAsPermanent((v) => !v)}
              >
                <View
                  style={[
                    styles.checkbox,
                    saveAsPermanent && styles.checkboxActive,
                  ]}
                >
                  {saveAsPermanent ? (
                    <StitchIcon name="verified" size={14} color={colors.onPrimary} />
                  ) : null}
                </View>
                <View style={styles.checkCopy}>
                  <Text style={styles.checkLabel}>
                    Save as permanent address
                  </Text>
                  <Text style={styles.checkHint}>
                    Replaces your saved home address. Leave unchecked to use
                    only for this order.
                  </Text>
                </View>
              </Pressable>

              {saveAsPermanent ? (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={labelDraft}
                      onChangeText={setLabelDraft}
                      placeholder="Home, Office…"
                      placeholderTextColor={colors.onSurfaceVariant}
                    />
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Landmark (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={hintDraft}
                      onChangeText={setHintDraft}
                      placeholder="Near STI Chowk, 2nd floor…"
                      placeholderTextColor={colors.onSurfaceVariant}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.modalActions}>
                <Button
                  label="Back"
                  variant="ghost"
                  onPress={() => setPendingPoint(null)}
                />
                <Button
                  label={
                    saveAsPermanent
                      ? 'Save permanent & use'
                      : 'Use for this order'
                  }
                  onPress={() => void confirmPin()}
                  style={styles.primaryAction}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  muted: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  slot: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  slotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLow,
  },
  emptySlot: {
    gap: spacing.sm,
  },
  slotTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  slotIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  slotIconCurrent: {
    backgroundColor: colors.primary,
  },
  slotBody: { flex: 1, gap: 2, minWidth: 0 },
  slotEyebrow: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  slotTitle: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: colors.onSurface,
  },
  slotCoords: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  slotHint: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
  modalPage: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.margin,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modalHeaderCopy: { flex: 1, minWidth: 0 },
  modalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  modalSubtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  close: {
    ...typography.bodyMd,
    color: colors.primary,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  mapStep: {
    flex: 1,
    minHeight: 0,
  },
  nameScroll: { flex: 1 },
  nameForm: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  formSection: { gap: spacing.sm },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    marginTop: 1,
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkCopy: { flex: 1, gap: 2 },
  checkLabel: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  checkHint: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryAction: { flex: 1 },
});
