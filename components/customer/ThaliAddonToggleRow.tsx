import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { ThaliComponent } from '../../lib/types';

type DisplayComponent = Pick<
  ThaliComponent,
  'id' | 'included_qty' | 'min_qty' | 'max_qty' | 'unit_price_delta' | 'component_type'
>;

export type ThaliAddonToggleRowProps = {
  component: DisplayComponent;
  displayName: string;
  selected: boolean;
  onToggle: (selected: boolean) => void;
};

/** Optional one-time add-on — tap to add/remove (no stepper). */
export function ThaliAddonToggleRow({
  component,
  displayName,
  selected,
  onToggle,
}: ThaliAddonToggleRowProps) {
  return (
    <Pressable
      onPress={() => onToggle(!selected)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${displayName}, ${selected ? 'added' : 'not added'}, ₹${component.unit_price_delta}`}
    >
      <Card style={[styles.row, selected && styles.rowSelected]}>
        <View style={styles.copy}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.price}>+₹{component.unit_price_delta}</Text>
        </View>
        <View style={[styles.chip, selected && styles.chipSelected]}>
          <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
            {selected ? `✓ ${displayName}` : '+ Add'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    backgroundColor: colors.surfaceContainerLow,
  },
  rowSelected: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  copy: { flex: 1, gap: 2 },
  name: { ...typography.labelMd, color: colors.onSurface },
  price: { ...typography.bodySm, color: colors.onSurfaceVariant },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainerLowest,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  chipLabel: { ...typography.labelSm, color: colors.primary },
  chipLabelSelected: { color: colors.onPrimary },
});
