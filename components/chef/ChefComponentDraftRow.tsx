import { Pressable, StyleSheet, Text } from 'react-native';
import type { ComponentDraftRow } from '../../lib/chef/componentDraft';
import { kindFromDraftType } from '../../lib/chef/componentSimple';
import { Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { ComponentFormFields } from './ComponentFormFields';

type Props = {
  row: ComponentDraftRow;
  onChange: (next: ComponentDraftRow) => void;
  onRemove: () => void;
};

/** One dish or add-on row — type chosen by which section + button was tapped. */
export function ChefComponentDraftRow({ row, onChange, onRemove }: Props) {
  const isPlate = kindFromDraftType(row.component_type) === 'plate';

  return (
    <Card style={styles.card}>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove">
        <Text style={styles.remove}>Remove</Text>
      </Pressable>

      <ComponentFormFields
        isPlate={isPlate}
        values={row}
        onChange={(next) => onChange({ ...row, ...next })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  remove: { ...typography.labelSm, color: colors.error, alignSelf: 'flex-end' },
});
