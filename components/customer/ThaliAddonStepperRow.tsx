import { StyleSheet, Text, View } from 'react-native';
import { Card, Stepper } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import type { ThaliComponent } from '../../lib/types';

type DisplayComponent = Pick<
  ThaliComponent,
  'id' | 'included_qty' | 'min_qty' | 'max_qty' | 'unit_price_delta' | 'component_type'
>;

export type ThaliAddonStepperRowProps = {
  component: DisplayComponent;
  displayName: string;
  value: number;
  onChange: (next: number) => void;
};

/** Optional add-on with adjustable quantity — stepper starts at 0. */
export function ThaliAddonStepperRow({
  component,
  displayName,
  value,
  onChange,
}: ThaliAddonStepperRowProps) {
  return (
    <Card style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.price}>+₹{component.unit_price_delta} each</Text>
      </View>
      <Stepper label="" value={value} min={0} max={component.max_qty} onChange={onChange} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, backgroundColor: colors.surfaceContainerLow },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { ...typography.labelMd, color: colors.onSurface, flex: 1 },
  price: { ...typography.bodySm, color: colors.onSurfaceVariant },
});
