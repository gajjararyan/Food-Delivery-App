import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Button, Input } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { isGoogleMapsConfigured } from '../../lib/maps/config';
import { geocodeAddress, reverseGeocode } from '../../lib/maps/geocode';

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

/** iOS/Android: Google/Apple map with draggable kitchen pin. */
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
    if (isBusy) return;
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

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Kitchen location</Text>
      <Text style={styles.hint}>
        Search, use GPS, or drag the pin on the map. Free street tiles — no paid Google key required.
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
              onPress={() => void applyPin(hit.lat, hit.lng, hit.address)}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{hit.address}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hasPin ? (
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            provider={useGoogle ? PROVIDER_GOOGLE : undefined}
            region={{
              latitude: value.lat!,
              longitude: value.lng!,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              void applyPin(latitude, longitude);
            }}
          >
            <Marker
              coordinate={{ latitude: value.lat!, longitude: value.lng! }}
              title="Your kitchen"
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                void applyPin(latitude, longitude);
              }}
            />
          </MapView>
        </View>
      ) : (
        <View style={styles.emptyMap}>
          <Text style={styles.emptyMapText}>
            {busyMode === 'gps'
              ? 'Allow location access, then we will drop the pin.'
              : 'No pin yet — search or use GPS'}
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
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  map: { flex: 1 },
  emptyMap: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  emptyMapText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  error: { ...typography.bodySm, color: colors.error },
  saved: { ...typography.labelSm, color: colors.tertiary },
});
