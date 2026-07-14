import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealSlot, MenuItem } from '../../lib/types';
import { Badge, Button, Card, Input } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { formatInr } from '../../lib/date';
import { ChefThaliComponentsEditor } from './ChefThaliComponentsEditor';
import { KitchenPhotoField } from './KitchenPhotoField';
import { stitchImages } from '../../constants/images';

type Props = {
  item: MenuItem;
  makerId: string;
  saving: boolean;
  onSave: (patch: {
    name: string;
    description: string;
    base_price: number;
    meal_slot: MealSlot;
    is_available: boolean;
    has_jain_variant: boolean;
    image_url: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
};

const MEAL_SLOTS: MealSlot[] = ['lunch', 'dinner'];

export function ChefMenuItemEditor({ item, makerId, saving, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [price, setPrice] = useState(String(item.base_price));
  const [mealSlot, setMealSlot] = useState<MealSlot>(item.meal_slot);
  const [available, setAvailable] = useState(item.is_available);
  const [jainFriendly, setJainFriendly] = useState(item.has_jain_variant);
  const [imageUrl, setImageUrl] = useState(item.image_url ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const syncFromItem = () => {
    setName(item.name);
    setDescription(item.description ?? '');
    setPrice(String(item.base_price));
    setMealSlot(item.meal_slot);
    setAvailable(item.is_available);
    setJainFriendly(item.has_jain_variant);
    setImageUrl(item.image_url ?? '');
    setConfirmDelete(false);
  };

  const onToggle = () => {
    if (!expanded) syncFromItem();
    setExpanded((v) => !v);
  };

  const handleSave = async () => {
    const parsed = Number(price);
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      base_price: parsed,
      meal_slot: mealSlot,
      is_available: available,
      has_jain_variant: jainFriendly,
      image_url: imageUrl,
    });
    setExpanded(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
  };

  return (
    <Card style={styles.card}>
      <Pressable onPress={onToggle} style={styles.header} accessibilityRole="button">
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {formatInr(item.base_price)} · {item.meal_slot}
          </Text>
        </View>
        <View style={styles.badges}>
          {!item.is_available ? <Badge label="Hidden" tone="neutral" /> : null}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <KitchenPhotoField
            label="Item photo"
            hint="Shown on your chef profile menu list."
            value={imageUrl}
            fallback={stitchImages.thaliDish}
            aspectRatio={4 / 3}
            onChange={setImageUrl}
          />
          <Input label="Item name" value={name} onChangeText={setName} />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What diners see on your profile"
          />
          <Input
            label="Base price (₹)"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />

          <Text style={styles.fieldLabel}>Meal slot</Text>
          <View style={styles.slotRow}>
            {MEAL_SLOTS.map((slot) => {
              const active = mealSlot === slot;
              return (
                <Pressable
                  key={slot}
                  onPress={() => setMealSlot(slot)}
                  style={[styles.slotChip, active && styles.slotChipActive]}
                >
                  <Text style={[styles.slotLabel, active && styles.slotLabelActive]}>
                    {slot.charAt(0).toUpperCase() + slot.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setJainFriendly((v) => !v)}
            style={styles.toggleRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: jainFriendly }}
          >
            <Text style={styles.toggleLabel}>Jain-friendly item</Text>
            <Text style={styles.toggleValue}>{jainFriendly ? 'On' : 'Off'}</Text>
          </Pressable>

          <Pressable
            onPress={() => setAvailable((v) => !v)}
            style={styles.toggleRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: available }}
          >
            <Text style={styles.toggleLabel}>Visible on Discover</Text>
            <Text style={[styles.toggleValue, !available && styles.toggleOff]}>
              {available ? 'On' : 'Off'}
            </Text>
          </Pressable>

          <ChefThaliComponentsEditor
            makerId={makerId}
            menuItemId={item.id}
            basePrice={Number(price) || item.base_price}
          />

          <Button label="Save item" loading={saving} onPress={() => void handleSave()} />
          <Button
            label={confirmDelete ? 'Confirm delete' : 'Remove item'}
            variant="outline"
            loading={saving}
            onPress={() => void handleDelete()}
          />
          {confirmDelete ? (
            <Pressable onPress={() => setConfirmDelete(false)}>
              <Text style={styles.cancelDelete}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 2 },
  name: { ...typography.labelMd, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chevron: { ...typography.labelSm, color: colors.onSurfaceVariant },
  body: { gap: spacing.base, marginTop: spacing.sm },
  fieldLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotRow: { flexDirection: 'row', gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  slotChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  slotLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  slotLabelActive: { color: colors.primary },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...typography.bodyMd, color: colors.onSurface },
  toggleValue: { ...typography.labelMd, color: colors.tertiary },
  toggleOff: { color: colors.error },
  cancelDelete: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
