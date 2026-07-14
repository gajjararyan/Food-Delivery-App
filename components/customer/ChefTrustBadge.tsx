import { StyleSheet, Text, View } from 'react-native';
import { StitchIcon, type StitchIconName } from '../ui/StitchIcon';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type ChefTrustBadgeProps = {
  icon: StitchIconName;
  label: string;
  tone?: 'tertiary' | 'secondary' | 'primary';
};

const toneStyles = {
  tertiary: {
    bg: 'rgba(67, 99, 73, 0.1)',
    border: 'rgba(67, 99, 73, 0.2)',
    icon: colors.tertiary,
    text: colors.tertiary,
  },
  secondary: {
    bg: 'rgba(254, 182, 78, 0.15)',
    border: 'rgba(254, 182, 78, 0.35)',
    icon: colors.secondary,
    text: colors.secondary,
  },
  primary: {
    bg: 'rgba(255, 219, 207, 0.45)',
    border: 'rgba(157, 62, 24, 0.12)',
    icon: colors.primary,
    text: colors.primary,
  },
} as const;

export function ChefTrustBadge({ icon, label, tone = 'tertiary' }: ChefTrustBadgeProps) {
  const palette = toneStyles[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <StitchIcon name={icon} size={18} color={palette.icon} />
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: { ...typography.labelMd, fontSize: 13 },
});
