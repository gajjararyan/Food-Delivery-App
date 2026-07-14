import { StyleSheet, Text, View } from 'react-native';
import {
  componentCustomerTitle,
  customerComponentInlinePreview,
} from '../../lib/componentPreview';
import { isIncludedComponent } from '../../lib/thaliComponents';
import type { ThaliComponent } from '../../lib/types';
import { Card, Stepper } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';

type DisplayComponent = Pick<
  ThaliComponent,
  | 'id'
  | 'included_qty'
  | 'min_qty'
  | 'max_qty'
  | 'unit_price_delta'
  | 'serving_amount'
  | 'serving_unit'
  | 'component_type'
  | 'has_jain_variant'
  | 'jain_substitute'
>;

export type ThaliComponentRowProps = {
  component: DisplayComponent;
  displayName: string;
  value: number;
  onChange: (next: number) => void;
};

/** Customer builder row — dish or add-on with shared preview wording. */
export function ThaliComponentRow({
  component,
  displayName,
  value,
  onChange,
}: ThaliComponentRowProps) {
  const isPlate = isIncludedComponent(component);
  const title = isPlate
    ? displayName
    : `${componentCustomerTitle(displayName, component)} — ${customerComponentInlinePreview(component)}`;
  const subtitle = isPlate ? customerComponentInlinePreview(component) : null;
  const min = isPlate ? component.min_qty : 0;

  return (
    <Card style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Stepper label="" value={value} min={min} max={component.max_qty} onChange={onChange} />
      {component.has_jain_variant && component.jain_substitute ? (
        <Text style={styles.jainHint}>Jain: {component.jain_substitute}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  title: { ...typography.labelMd, color: colors.onSurface },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  jainHint: { ...typography.labelSm, color: colors.tertiary },
});
