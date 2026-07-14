import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  defaultNewItemComponentDrafts,
  draftsToInputs,
  type ComponentDraftRow,
} from '../../lib/chef/componentDraft';
import type { MealSlot } from '../../lib/types';
import { Button, Input } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { KitchenPhotoField } from './KitchenPhotoField';
import { ChefComponentsDraftEditor } from './ChefComponentsDraftEditor';
import { stitchImages } from '../../constants/images';

const MEAL_SLOTS: MealSlot[] = ['lunch', 'dinner'];

export type NewItemPayload = {
  name: string;
  description: string | null;
  base_price: number;
  meal_slot: MealSlot;
  has_jain_variant: boolean;
  image_url: string | null;
  is_available: boolean;
  enable_customization: boolean;
  components?: ReturnType<typeof draftsToInputs>;
};

type Props = {
  loading: boolean;
  onSubmit: (payload: NewItemPayload) => Promise<void>;
  onCancel: () => void;
};

/** Full add-item form — basics + all components in one step. */
export function ChefAddItemForm({ loading, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('149');
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [imageUrl, setImageUrl] = useState('');
  const [jainFriendly, setJainFriendly] = useState(true);
  const [visible, setVisible] = useState(true);
  const [customizable, setCustomizable] = useState(true);
  const [drafts, setDrafts] = useState<ComponentDraftRow[]>(() => defaultNewItemComponentDrafts());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const parsed = Number(price);
    if (!name.trim()) {
      setError('Enter an item name');
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid base price');
      return;
    }
    if (customizable) {
      const inputs = draftsToInputs(drafts);
      if (inputs.length === 0) {
        setError('Add at least one component or turn off customization');
        return;
      }
    }

    setError(null);
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      base_price: parsed,
      meal_slot: slot,
      has_jain_variant: jainFriendly,
      image_url: imageUrl.trim() || null,
      is_available: visible,
      enable_customization: customizable,
      components: customizable ? draftsToInputs(drafts) : undefined,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Add new item</Text>
      <KitchenPhotoField
        label="Item photo"
        hint="Good photos increase orders."
        value={imageUrl}
        fallback={stitchImages.thaliDish}
        aspectRatio={4 / 3}
        onChange={setImageUrl}
      />
      <Input label="Item name" value={name} onChangeText={setName} placeholder="Gujarati Thali, Shak Rotli…" />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Short line for customers"
      />
      <Input label="Base price (₹)" keyboardType="numeric" value={price} onChangeText={setPrice} />

      <Text style={styles.fieldLabel}>Meal slot</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
        {MEAL_SLOTS.map((mealSlot) => {
          const active = slot === mealSlot;
          return (
            <Text
              key={mealSlot}
              onPress={() => setSlot(mealSlot)}
              style={[styles.slotChip, active && styles.slotChipActive, styles.slotLabel, active && styles.slotLabelActive]}
            >
              {mealSlot.charAt(0).toUpperCase() + mealSlot.slice(1)}
            </Text>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => setJainFriendly((v) => !v)} style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Jain-friendly item</Text>
        <Text style={styles.toggleValue}>{jainFriendly ? 'On' : 'Off'}</Text>
      </Pressable>
      <Pressable onPress={() => setVisible((v) => !v)} style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Visible on Discover</Text>
        <Text style={styles.toggleValue}>{visible ? 'On' : 'Off'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setCustomizable((v) => {
            const next = !v;
            if (next && drafts.length === 0) setDrafts(defaultNewItemComponentDrafts());
            return next;
          });
        }}
        style={styles.toggleRow}
      >
        <Text style={styles.toggleLabel}>Let customers customize</Text>
        <Text style={styles.toggleValue}>{customizable ? 'On' : 'Off'}</Text>
      </Pressable>

      {customizable ? (
        <ChefComponentsDraftEditor
          drafts={drafts}
          onChange={setDrafts}
          basePrice={Number(price) || 0}
        />
      ) : (
        <Text style={styles.simpleHint}>
          Simple item — fixed price, no roti/dal/extras builder. Good for single dishes like Shak Rotli.
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Save item" loading={loading} onPress={() => void handleSubmit()} />
      <Button label="Cancel" variant="outline" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.base },
  section: { ...typography.labelMd, color: colors.primary },
  fieldLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotRow: { flexDirection: 'row', gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  slotChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  slotLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotLabelActive: { color: colors.primary },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...typography.bodyMd, color: colors.onSurface },
  toggleValue: { ...typography.labelMd, color: colors.primary },
  simpleHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
  error: { ...typography.bodySm, color: colors.error },
});
