import { StyleSheet, Switch, Text, View } from 'react-native';
import { Badge, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';

type KitchenStatusCardProps = {
  isOpen: boolean;
  saving?: boolean;
  onToggle: (next: boolean) => void;
};

/** Open / closed toggle for chef dashboard — closed kitchens stay on Discover greyed out. */
export function KitchenStatusCard({ isOpen, saving, onToggle }: KitchenStatusCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Accepting orders</Text>
            <Badge label={isOpen ? 'Open' : 'Closed'} tone={isOpen ? 'success' : 'neutral'} />
          </View>
          <Text style={styles.body}>
            {isOpen
              ? 'Your kitchen is live on Discover in full colour. Diners can browse and order.'
              : 'Paused — still listed on Discover in grey, but not taking new orders.'}
          </Text>
        </View>
        <Switch
          value={isOpen}
          onValueChange={onToggle}
          disabled={saving}
          trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
          thumbColor={isOpen ? colors.primary : colors.surfaceContainerHigh}
          accessibilityLabel="Accepting orders"
          accessibilityHint={isOpen ? 'Turn off to close kitchen' : 'Turn on to open kitchen'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, backgroundColor: colors.surfaceContainerLow },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  copy: { flex: 1, gap: spacing.xs },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: { ...typography.labelMd, color: colors.onSurface },
  body: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
});
