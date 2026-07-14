import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type ChefStat = {
  value: string;
  label: string;
};

export type ChefStatsCardProps = {
  stats: ChefStat[];
};

export function ChefStatsCard({ stats }: ChefStatsCardProps) {
  return (
    <View style={styles.card}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.cellWrap}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.cell}>
            <Text style={styles.value}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  cellWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: colors.outlineVariant,
    marginRight: spacing.sm,
  },
  value: { ...typography.headlineMd, color: colors.primary, fontSize: 22 },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
});
