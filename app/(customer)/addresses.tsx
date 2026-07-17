import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState } from '../../components/ui';
import { LocationPickerMap } from '../../components/customer/LocationPickerMap';
import { LocationPreviewMap } from '../../components/customer/LocationPreviewMap';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '../../lib/api/addresses';
import { reverseGeocode } from '../../lib/maps/geocode';
import { formatCoordsLabel, formatSpotTitle, isCoordsLabel } from '../../lib/maps/formatLocation';

type FlowStep = 'closed' | 'picker' | 'label';

/**
 * Profile screen keeps exactly one permanent address.
 * Extra saved pins from earlier testing are cleaned up automatically.
 */
export default function AddressesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<FlowStep>('closed');
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [labelText, setLabelText] = useState('');
  const [hintText, setHintText] = useState('');
  const [placeName, setPlaceName] = useState<string | null>(null);

  const addressesQuery = useQuery({
    queryKey: ['addresses', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const result = await listAddresses(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const addresses = addressesQuery.data ?? [];

  const permanent = useMemo(
    () => addresses.find((a) => a.is_default) ?? addresses[0] ?? null,
    [addresses],
  );

  // Keep only one permanent address — remove leftover pins.
  useEffect(() => {
    if (!user?.id || addresses.length <= 1) return;
    const keepId = permanent?.id;
    if (!keepId) return;

    void (async () => {
      if (!permanent.is_default) {
        await setDefaultAddress(permanent.id, user.id);
      }
      for (const row of addresses) {
        if (row.id !== keepId) {
          await deleteAddress(row.id, user.id);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['addresses', user.id] });
    })();
  }, [addresses, permanent, queryClient, user?.id]);

  useEffect(() => {
    if (!permanent) {
      setPlaceName(null);
      return;
    }
    let cancelled = false;
    void reverseGeocode(permanent.lat, permanent.lng)
      .then((geo) => {
        if (!cancelled) setPlaceName(geo.shortAddress ?? geo.address);
      })
      .catch(() => {
        if (!cancelled) setPlaceName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [permanent?.id, permanent?.lat, permanent?.lng]);

  const displayTitle = useMemo(() => {
    if (!permanent) return null;
    const named = formatSpotTitle({
      label: permanent.label,
      hint: permanent.formatted_hint,
    });
    if (named !== 'Saved pin') return named;
    return placeName ?? named;
  }, [permanent, placeName]);

  const openEdit = () => {
    if (permanent) {
      setPendingPoint({ lat: permanent.lat, lng: permanent.lng });
      setLabelText(permanent.label);
      setHintText(permanent.formatted_hint ?? '');
    } else {
      setPendingPoint(null);
      setLabelText('');
      setHintText('');
    }
    setStep('picker');
  };

  const onPickerConfirm = (point: { lat: number; lng: number }) => {
    setPendingPoint(point);
    setStep('label');
    void reverseGeocode(point.lat, point.lng)
      .then((geo) => {
        const name = geo.shortAddress ?? geo.address;
        setPlaceName(name);
        if (!labelText.trim() || isCoordsLabel(labelText)) {
          setLabelText(name);
        }
      })
      .catch(() => undefined);
  };

  const onSave = async () => {
    if (!user?.id || !pendingPoint || !labelText.trim()) return;

    if (permanent) {
      await updateAddress(permanent.id, user.id, {
        label: labelText.trim(),
        lat: pendingPoint.lat,
        lng: pendingPoint.lng,
        formatted_hint: hintText.trim() || null,
      });
      await setDefaultAddress(permanent.id, user.id);
    } else {
      await createAddress({
        customerId: user.id,
        label: labelText.trim(),
        lat: pendingPoint.lat,
        lng: pendingPoint.lng,
        formattedHint: hintText.trim() || null,
        isDefault: true,
      });
    }

    setStep('closed');
    void queryClient.invalidateQueries({ queryKey: ['addresses', user.id] });
  };

  const onClear = async () => {
    if (!user?.id || !permanent) return;
    await deleteAddress(permanent.id, user.id);
    void queryClient.invalidateQueries({ queryKey: ['addresses', user.id] });
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Permanent address</Text>
        <Text style={styles.sub}>
          One saved home address. At checkout you can also drop a temporary pin for that order only.
        </Text>

        {!permanent && !addressesQuery.isLoading ? (
          <EmptyState
            title="No permanent address yet"
            description="Add your home or office once. You can still set a different pin per order at checkout."
            actionLabel="Set permanent address"
            onAction={openEdit}
          />
        ) : permanent ? (
          <Card style={styles.card}>
            <Text style={styles.eyebrow}>Your saved address</Text>
            <Text style={styles.label}>
              {displayTitle}
            </Text>
            {placeName && displayTitle !== placeName ? (
              <Text style={styles.coords}>{placeName}</Text>
            ) : (
              <Text style={styles.coords}>
                {formatCoordsLabel(permanent.lat, permanent.lng)}
              </Text>
            )}
            <LocationPreviewMap
              lat={permanent.lat}
              lng={permanent.lng}
              height={160}
            />
            <Button label="Update permanent address" onPress={openEdit} />
            <Button label="Remove" variant="outline" onPress={() => void onClear()} />
          </Card>
        ) : null}
      </ScrollView>

      <Modal
        visible={step === 'picker'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setStep('closed')}
      >
        <View style={styles.modalPage}>
          <Text style={styles.modalTitle}>
            {permanent ? 'Update permanent address' : 'Set permanent address'}
          </Text>
          <LocationPickerMap
            fill
            initialLat={pendingPoint?.lat}
            initialLng={pendingPoint?.lng}
            onConfirm={onPickerConfirm}
          />
          <Button label="Cancel" variant="outline" onPress={() => setStep('closed')} />
        </View>
      </Modal>

      <Modal
        visible={step === 'label'}
        animationType="slide"
        onRequestClose={() => setStep('closed')}
      >
        <View style={styles.modalPage}>
          <Text style={styles.modalTitle}>Name this address</Text>
          {pendingPoint ? (
            <Text style={styles.coords}>
              {formatCoordsLabel(pendingPoint.lat, pendingPoint.lng)}
            </Text>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="e.g. Home, Office"
            value={labelText}
            onChangeText={setLabelText}
          />
          <TextInput
            style={styles.input}
            placeholder="Optional note (e.g. blue gate, 2nd floor)"
            value={hintText}
            onChangeText={setHintText}
          />
          <Button
            label="Save permanent address"
            disabled={!labelText.trim()}
            onPress={() => void onSave()}
          />
          <Button label="Back" variant="outline" onPress={() => setStep('picker')} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.margin, gap: spacing.md },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodySm, color: colors.onSurfaceVariant },
  card: { gap: spacing.md },
  eyebrow: { ...typography.labelSm, color: colors.onSurfaceVariant },
  label: { ...typography.bodyMd, fontWeight: '600', color: colors.onSurface },
  coords: { ...typography.bodySm, color: colors.onSurfaceVariant },
  modalPage: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.md,
    paddingTop: 60,
    minHeight: 0,
  },
  modalTitle: { ...typography.headlineSm, color: colors.onBackground },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
});
