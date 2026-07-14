import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SERVING_UNITS, type ServingUnit } from '../../lib/servingSize';
import { Input } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';

type Props = {
  amount: string;
  unit: ServingUnit;
  onAmountChange: (value: string) => void;
  onUnitChange: (unit: ServingUnit) => void;
};

/** Amount + unit picker for one serving (e.g. 400 gm, 500 ml). */
export function ServingSizeField({ amount, unit, onAmountChange, onUnitChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Serving size</Text>
      <View style={styles.row}>
        <View style={styles.amountField}>
          <Input
            label=""
            keyboardType="numeric"
            value={amount}
            onChangeText={onAmountChange}
            placeholder="400"
          />
        </View>
        <View style={styles.unitField}>
          <View style={styles.unitRow}>
            {SERVING_UNITS.map((option) => {
              const active = unit === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => onUnitChange(option)}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.unitText, active && styles.unitTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  amountField: { width: 88 },
  unitField: { flex: 1 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.sm },
  unitChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  unitChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  unitText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  unitTextActive: { color: colors.primary },
});
