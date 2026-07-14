import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label?: string;
};

export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel="Decrease"
          onPress={decrement}
          disabled={value <= min}
          style={[styles.btn, value <= min && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityLabel="Increase"
          onPress={increment}
          disabled={value >= max}
          style={[styles.btn, value >= max && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  label: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    ...typography.headlineSm,
    color: colors.onPrimary,
    marginTop: -2,
  },
  value: {
    ...typography.labelMd,
    color: colors.onSurface,
    minWidth: 24,
    textAlign: 'center',
  },
});
