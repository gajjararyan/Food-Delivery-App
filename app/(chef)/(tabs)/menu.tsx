import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ChefMenuItemEditor } from '../../../components/chef/ChefMenuItemEditor';
import { ChefAddItemForm } from '../../../components/chef/ChefAddItemForm';
import { KitchenLocationField } from '../../../components/chef/KitchenLocationField';
import { KitchenPhotoField } from '../../../components/chef/KitchenPhotoField';
import { Button, Card, EmptyState, Input, LoadingState } from '../../../components/ui';
import { stitchImages } from '../../../constants/images';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import {
  createCommunityMenuItem,
  ensureMakerSyncedToSupabase,
  fetchChefMenu,
  fetchMakerForCurrentPhone,
  removeCommunityMenuItem,
  saveMakerKitchen,
  saveMenuItem,
} from '../../../lib/api/chefs';
import { invalidateMarketplaceQueries } from '../../../lib/marketplace/invalidation';
import type { MealSlot } from '../../../lib/types';

/** Keep a just-uploaded URL if remote still has nothing (refetch used to wipe it). */
function preferRemoteOrPending(remote: string | null | undefined, local: string): string {
  const remoteUrl = remote?.trim() || '';
  if (remoteUrl) return remoteUrl;
  if (local.startsWith('http://') || local.startsWith('https://') || local.startsWith('data:')) {
    return local;
  }
  return '';
}

/** Chef menu & kitchen settings — profile images + menu items. */
export default function ChefMenuScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [savingKitchen, setSavingKitchen] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kitchenName, setKitchenName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [kitchenAddress, setKitchenAddress] = useState('');
  const [kitchenLat, setKitchenLat] = useState<number | null>(null);
  const [kitchenLng, setKitchenLng] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const formHydratedForMaker = useRef<string | null>(null);

  const makerQuery = useQuery({
    queryKey: ['chef-maker', user?.phone],
    enabled: Boolean(user?.phone),
    queryFn: async () => {
      const result = await fetchMakerForCurrentPhone(user!.phone!);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchOnMount: 'always',
    refetchInterval: 15_000,
  });

  const menuQuery = useQuery({
    queryKey: ['chef-menu', makerQuery.data?.id],
    enabled: Boolean(makerQuery.data?.id),
    queryFn: async () => {
      const result = await fetchChefMenu(makerQuery.data!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchOnMount: 'always',
    refetchInterval: 15_000,
  });

  // Pull Supabase → local whenever Menu tab opens (same kitchen customers see).
  useLayoutEffect(() => {
    const maker = makerQuery.data;
    const phone = user?.phone;
    if (!maker) return;
    void ensureMakerSyncedToSupabase(maker, phone).then(() => {
      invalidateMarketplaceQueries(queryClient, maker.id);
    });
  }, [makerQuery.data, user?.phone, queryClient]);

  const maker = makerQuery.data;
  const menuItems = menuQuery.data ?? [];

  useEffect(() => {
    if (!maker) return;
    const firstHydrate = formHydratedForMaker.current !== maker.id;
    formHydratedForMaker.current = maker.id;

    if (firstHydrate) {
      setKitchenName(maker.kitchen_name);
      setBio(maker.bio ?? '');
      setPhotoUrl(maker.photo_url ?? '');
      setCoverUrl(maker.cover_url ?? '');
      setKitchenAddress(maker.kitchen_address ?? '');
      setKitchenLat(maker.lat ?? null);
      setKitchenLng(maker.lng ?? null);
      return;
    }

    // Later refetches: adopt remote photos when present, never wipe a pending upload.
    setPhotoUrl((prev) => preferRemoteOrPending(maker.photo_url, prev));
    setCoverUrl((prev) => preferRemoteOrPending(maker.cover_url, prev));
  }, [maker]);

  if (makerQuery.isLoading || menuQuery.isLoading) return <LoadingState label="Loading menu…" />;

  if (!maker) {
    return (
      <EmptyState
        title="Kitchen not found"
        description="Your account is not linked to an approved kitchen yet."
        glyph="🍳"
      />
    );
  }

  const refreshAll = () => {
    invalidateMarketplaceQueries(queryClient, maker.id);
  };

  const persistPhotoNow = async (field: 'photo_url' | 'cover_url', url: string) => {
    if (field === 'photo_url') setPhotoUrl(url);
    else setCoverUrl(url);

    // Ignore non-hosted drafts; empty string means remove from Discover.
    if (url && !url.startsWith('http')) return;

    setSavingKitchen(true);
    setMessage(null);
    setError(null);
    const kitchen = await saveMakerKitchen(maker.id, { [field]: url.trim() || null });
    setSavingKitchen(false);
    if (!kitchen.ok) {
      setError(kitchen.error.message);
      return;
    }
    setPhotoUrl(kitchen.data.photo_url ?? '');
    setCoverUrl(kitchen.data.cover_url ?? '');
    setMessage(
      !url.trim()
        ? 'Photo removed from your public chef page.'
        : field === 'cover_url'
          ? 'Cover photo saved — refresh your public chef page to see it.'
          : 'Chef photo saved — refresh your public chef page to see it.',
    );
    refreshAll();
  };

  const onSaveKitchen = async () => {
    setSavingKitchen(true);
    setMessage(null);
    setError(null);
    const kitchen = await saveMakerKitchen(maker.id, {
      kitchen_name: kitchenName.trim() || maker.kitchen_name,
      bio: bio.trim() || null,
      photo_url: photoUrl.trim() || null,
      cover_url: coverUrl.trim() || null,
      kitchen_address: kitchenAddress.trim() || null,
      lat: kitchenLat,
      lng: kitchenLng,
    });
    setSavingKitchen(false);
    if (!kitchen.ok) {
      setError(kitchen.error.message);
      return;
    }
    setPhotoUrl(kitchen.data.photo_url ?? '');
    setCoverUrl(kitchen.data.cover_url ?? '');
    if (kitchenLat == null || kitchenLng == null) {
      setMessage('Profile saved — add a map pin so delivery tracking uses your real kitchen.');
    } else {
      setMessage('Kitchen profile & photos saved — Discover and your chef page will show them.');
    }
    refreshAll();
  };

  const onSaveItem = async (
    menuItemId: string,
    patch: {
      name: string;
      description: string;
      base_price: number;
      meal_slot: MealSlot;
      is_available: boolean;
      has_jain_variant: boolean;
      image_url: string;
    },
  ) => {
    setSavingItemId(menuItemId);
    setMessage(null);
    setError(null);
    const result = await saveMenuItem(maker.id, menuItemId, {
      name: patch.name,
      description: patch.description || null,
      base_price: patch.base_price,
      meal_slot: patch.meal_slot,
      is_available: patch.is_available,
      has_jain_variant: patch.has_jain_variant,
      image_url: patch.image_url.trim() || null,
    });
    setSavingItemId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMessage('Item updated — visible on your chef profile.');
    refreshAll();
  };

  const onDeleteItem = async (menuItemId: string) => {
    setSavingItemId(menuItemId);
    setMessage(null);
    setError(null);
    const result = await removeCommunityMenuItem(maker.id, menuItemId);
    setSavingItemId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMessage('Item removed from your menu.');
    refreshAll();
  };

  const onAddItem = async (payload: Parameters<typeof createCommunityMenuItem>[1]) => {
    setSavingItemId('new');
    setMessage(null);
    setError(null);
    const result = await createCommunityMenuItem(maker.id, payload);
    setSavingItemId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setShowAddForm(false);
    setMessage('New item saved with all components — customers can customize it now.');
    refreshAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.title}>Your kitchen</Text>
      <Text style={styles.sub}>
        Edit photos, story, and items. Changes appear on Discover and your public chef page.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.section}>Kitchen profile</Text>
        <KitchenPhotoField
          label="Cover photo"
          hint="Wide banner at the top of your chef page. Upload saves to your public page right away."
          value={coverUrl}
          fallback={stitchImages.kitchenHero}
          aspectRatio={16 / 9}
          folder="cover"
          onChange={(url) => void persistPhotoNow('cover_url', url)}
        />
        <KitchenPhotoField
          label="Chef photo"
          hint="Round portrait next to your kitchen name. Upload saves to your public page right away."
          value={photoUrl}
          fallback={stitchImages.naniPortrait}
          rounded
          folder="photo"
          onChange={(url) => void persistPhotoNow('photo_url', url)}
        />
        <Input label="Kitchen name" value={kitchenName} onChangeText={setKitchenName} />
        <Input
          label="Story / bio"
          value={bio}
          onChangeText={setBio}
          placeholder="What makes your food special?"
        />
        <KitchenLocationField
          value={{
            kitchen_address: kitchenAddress,
            lat: kitchenLat,
            lng: kitchenLng,
          }}
          onChange={(next) => {
            setKitchenAddress(next.kitchen_address);
            setKitchenLat(next.lat);
            setKitchenLng(next.lng);
          }}
        />
        <Button label="Save profile" loading={savingKitchen} onPress={() => void onSaveKitchen()} />
      </Card>

      <Text style={styles.sectionHeading}>Your items ({menuItems.length})</Text>
      <Text style={styles.sectionHint}>
        Tap an item to edit price, photo, components, extras, Jain swaps, and visibility on Discover.
      </Text>

      {menuItems.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add your first item for customers to order."
          glyph="🍱"
        />
      ) : (
        menuItems.map((item) => (
          <ChefMenuItemEditor
            key={item.id}
            item={item}
            makerId={maker.id}
            saving={savingItemId === item.id}
            onSave={(patch) => onSaveItem(item.id, patch)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))
      )}

      {showAddForm ? (
        <Card style={styles.card}>
          <ChefAddItemForm
            loading={savingItemId === 'new'}
            onSubmit={onAddItem}
            onCancel={() => setShowAddForm(false)}
          />
        </Card>
      ) : (
        <Button label="Add new item" variant="outline" onPress={() => setShowAddForm(true)} />
      )}

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  card: { gap: spacing.base },
  section: { ...typography.labelMd, color: colors.primary },
  sectionHeading: { ...typography.headlineSm, color: colors.onBackground, marginTop: spacing.sm },
  sectionHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  fieldLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotRow: { flexDirection: 'row', gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  slotChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  slotLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotLabelActive: { color: colors.primary },
  toggleRow: { ...typography.bodyMd, color: colors.onSurface },
  success: { ...typography.bodySm, color: colors.tertiary },
  error: { ...typography.bodySm, color: colors.error },
});
