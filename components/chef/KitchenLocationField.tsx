import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, Input } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { isGoogleMapsConfigured } from '../../lib/maps/config';
import { geocodeAddress, reverseGeocode } from '../../lib/maps/geocode';
import { KitchenPinMap } from './KitchenPinMap';

export type KitchenLocationValue = {
  kitchen_address: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  value: KitchenLocationValue;
  onChange: (next: KitchenLocationValue) => void;
};

type BusyMode = 'search' | 'gps' | 'resolve' | null;

/** Default (web): Google/OSM geocode + GPS + embedded street map. */
export function KitchenLocationField({ value, onChange }: Props) {
  const [query, setQuery] = useState(value.kitchen_address);
  const [busyMode, setBusyMode] = useState<BusyMode>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ address: string; lat: number; lng: number }>
  >([]);

  const hasPin =
    value.lat != null &&
    value.lng != null &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng);
  const useGoogle = isGoogleMapsConfigured();
  const isBusy = busyMode !== null;

  const commitPin = (lat: number, lng: number, address: string) => {
    onChange({ kitchen_address: address, lat, lng });
    setQuery(address);
    setSuggestions([]);
  };

  const applyPin = async (lat: number, lng: number, address?: string) => {
    setBusyMode('resolve');
    setStatus('Saving pin…');
    setError(null);
    try {
      const resolved = address
        ? { lat, lng, address }
        : await reverseGeocode(lat, lng);
      commitPin(resolved.lat, resolved.lng, resolved.address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve location');
    } finally {
      setBusyMode(null);
      setStatus(null);
    }
  };

  const onSearch = async () => {
    if (isBusy) return;
    setBusyMode('search');
    setStatus('Searching…');
    setError(null);
    try {
      const hits = await geocodeAddress(query);
      if (hits.length === 0) {
        setSuggestions([]);
        setError('No places found. Try a fuller address (area, city).');
        return;
      }
      if (hits.length === 1) {
        commitPin(hits[0]!.lat, hits[0]!.lng, hits[0]!.address);
        return;
      }
      setSuggestions(hits);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed');
    } finally {
      setBusyMode(null);
      setStatus(null);
    }
  };

  const onUseCurrent = async () => {
    if (isBusy) return;
    setBusyMode('gps');
    setError(null);
    setStatus('Waiting for location permission…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission is required to pin your kitchen.');
        return;
      }
      setStatus('Getting your GPS location…');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setStatus('Finding address for this pin…');
      const resolved = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      commitPin(resolved.lat, resolved.lng, resolved.address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read GPS');
    } finally {
      setBusyMode(null);
      setStatus(null);
    }
  };

  const mapsUrl = hasPin
    ? useGoogle
      ? `https://www.google.com/maps?q=${value.lat},${value.lng}`
      : `https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=16/${value.lat}/${value.lng}`
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Kitchen location</Text>
      <Text style={styles.hint}>
        Search or use GPS to drop a pin. The street map below is free (OpenStreetMap) — no Google
        billing needed. Drag the pin to fine-tune, then Save profile.
      </Text>

      <Input
        label="Kitchen address"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          onChange({ ...value, kitchen_address: t });
          if (error) setError(null);
        }}
        placeholder="Flat, street, area, city…"
      />

      <View style={styles.row}>
        <Button
          label="Search map"
          size="sm"
          loading={busyMode === 'search'}
          disabled={isBusy && busyMode !== 'search'}
          onPress={() => void onSearch()}
          style={styles.rowBtn}
        />
        <Button
          label="Use my GPS"
          size="sm"
          variant="outline"
          loading={busyMode === 'gps'}
          disabled={isBusy && busyMode !== 'gps'}
          onPress={() => void onUseCurrent()}
          style={styles.rowBtn}
        />
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((hit) => (
            <Pressable
              key={`${hit.lat},${hit.lng},${hit.address}`}
              onPress={() => {
                if (isBusy) return;
                void applyPin(hit.lat, hit.lng, hit.address);
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{hit.address}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hasPin ? (
        <>
          <KitchenPinMap
            lat={value.lat!}
            lng={value.lng!}
            title="Your kitchen"
            onPinChange={(nextLat, nextLng) => {
              void applyPin(nextLat, nextLng);
            }}
          />
          <View style={styles.pinMeta}>
            <Text style={styles.coords}>
              Pin · {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
            </Text>
            {mapsUrl ? (
              <Pressable
                onPress={() => {
                  if (typeof window !== 'undefined') window.open(mapsUrl, '_blank');
                }}
              >
                <Text style={styles.link}>Open full map</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.mapWrap}>
          <Text style={styles.emptyMapText}>
            {busyMode === 'gps'
              ? 'Allow location in the browser prompt, then we will drop the pin.'
              : 'No pin yet — search or use GPS to show the street map'}
          </Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hasPin ? (
        <Text style={styles.saved}>
          Saved pin · {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.labelMd, color: colors.onSurface },
  hint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowBtn: { flex: 1 },
  status: { ...typography.labelSm, color: colors.primary },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLowest,
  },
  suggestion: {
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  suggestionText: { ...typography.bodySm, color: colors.onSurface, lineHeight: 18 },
  mapWrap: {
    minHeight: 100,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    gap: spacing.xs,
  },
  pinMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  coords: { ...typography.labelMd, color: colors.primary },
  link: { ...typography.labelMd, color: colors.primary, textDecorationLine: 'underline' },
  emptyMapText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  error: { ...typography.bodySm, color: colors.error },
  saved: { ...typography.labelSm, color: colors.tertiary },
});
