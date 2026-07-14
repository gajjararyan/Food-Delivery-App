import { StyleSheet, Text, View } from 'react-native';
import { previewFromDraft } from '../../lib/componentPreview';
import { applyKindQuantities, kindFromDraftType } from '../../lib/chef/componentSimple';
import type { ThaliComponentType } from '../../lib/types';
import type { ServingUnit } from '../../lib/servingSize';
import { Input } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { ServingSizeField } from './ServingSizeField';

export type ComponentFormValues = {
  name: string;
  serving_amount: string;
  serving_unit: ServingUnit;
  component_type: ThaliComponentType;
  included_qty: string;
  max_qty: string;
  unit_price_delta: string;
};

type Props = {
  values: ComponentFormValues;
  isPlate: boolean;
  onChange: (next: ComponentFormValues) => void;
};

/** Unified dish / add-on fields with live customer preview. */
export function ComponentFormFields({ values, isPlate, onChange }: Props) {
  const setField = <K extends keyof ComponentFormValues>(key: K, value: ComponentFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const preview = previewFromDraft(values);

  return (
    <View style={styles.wrap}>
      <Input
        label="Item name"
        value={values.name}
        onChangeText={(v) => setField('name', v)}
        placeholder={isPlate ? 'Rajma, Rice, Roti…' : 'Buttermilk, Papad…'}
      />

      <ServingSizeField
        amount={values.serving_amount}
        unit={values.serving_unit}
        onAmountChange={(v) => setField('serving_amount', v)}
        onUnitChange={(v) => setField('serving_unit', v)}
      />

      {isPlate ? (
        <>
          <Input
            label="Included servings"
            keyboardType="numeric"
            value={values.included_qty}
            onChangeText={(v) => setField('included_qty', v)}
          />
          <Input
            label="Extra ₹ per serving"
            keyboardType="numeric"
            value={values.unit_price_delta}
            onChangeText={(v) => setField('unit_price_delta', v)}
          />
        </>
      ) : (
        <Input
          label="Price per serving"
          keyboardType="numeric"
          value={values.unit_price_delta}
          onChangeText={(v) => setField('unit_price_delta', v)}
        />
      )}

      <Input
        label="Max servings"
        keyboardType="numeric"
        value={values.max_qty}
        onChangeText={(v) => {
          if (!isPlate) {
            const qty = applyKindQuantities('addon', {
              included_qty: 0,
              min_qty: 0,
              max_qty: Number(v) || 1,
            });
            onChange({
              ...values,
              max_qty: v,
              component_type: qty.component_type as ThaliComponentType,
            });
            return;
          }
          setField('max_qty', v);
        }}
      />

      <View style={styles.previewBox}>
        <Text style={styles.previewLabel}>Preview (what customer sees)</Text>
        <Text style={styles.previewText}>{preview}</Text>
      </View>
    </View>
  );
}

export function formValuesToPatch(values: ComponentFormValues) {
  const kind = kindFromDraftType(values.component_type);
  const qty = applyKindQuantities(kind, {
    included_qty: Number(values.included_qty) || 0,
    min_qty: 0,
    max_qty: Number(values.max_qty) || 1,
  });
  return {
    name: values.name.trim(),
    serving_amount: Number(values.serving_amount) || 1,
    serving_unit: values.serving_unit,
    component_type: qty.component_type,
    included_qty: qty.included_qty,
    min_qty: qty.min_qty,
    max_qty: qty.max_qty,
    unit_price_delta: Number(values.unit_price_delta) || 0,
  };
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  previewBox: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHighest,
    gap: 4,
  },
  previewLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  previewText: { ...typography.bodySm, color: colors.onSurface, lineHeight: 20 },
});
