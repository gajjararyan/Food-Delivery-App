import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

type BadgeTone = 'primary' | 'secondary' | 'success' | 'neutral' | 'error';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'primary', style }: BadgeProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Text style={[styles.label, labelToneStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  label: {
    ...typography.labelSm,
  },
});

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primaryContainer },
  secondary: { backgroundColor: colors.secondaryContainer },
  success: { backgroundColor: colors.tertiaryContainer },
  neutral: { backgroundColor: colors.surfaceContainerHigh },
  error: { backgroundColor: colors.errorContainer },
});

const labelToneStyles = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.onSecondaryContainer },
  success: { color: colors.onTertiary },
  neutral: { color: colors.onSurfaceVariant },
  error: { color: colors.onErrorContainer },
});
