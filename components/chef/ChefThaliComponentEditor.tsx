import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chefComponentPreview } from '../../lib/componentPreview';
import { kindBadge, kindFromComponent, kindFromDraftType } from '../../lib/chef/componentSimple';
import { normalizeComponentType } from '../../lib/thaliComponents';
import type { ThaliComponent, ThaliComponentType } from '../../lib/types';
import type { ServingUnit } from '../../lib/servingSize';
import { Button, Card, Input } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { ComponentFormFields, formValuesToPatch } from './ComponentFormFields';

export type ComponentDraft = {
  name: string;
  serving_amount: string;
  serving_unit: ServingUnit;
  component_type: ThaliComponentType;
  included_qty: string;
  min_qty: string;
  max_qty: string;
  unit_price_delta: string;
  has_jain_variant: boolean;
  jain_substitute: string;
};

export function componentToDraft(component: ThaliComponent): ComponentDraft {
  return {
    name: component.name,
    serving_amount: String(component.serving_amount),
    serving_unit: component.serving_unit,
    component_type: normalizeComponentType(component),
    included_qty: String(component.included_qty),
    min_qty: String(component.min_qty),
    max_qty: String(component.max_qty),
    unit_price_delta: String(component.unit_price_delta),
    has_jain_variant: component.has_jain_variant,
    jain_substitute: component.jain_substitute ?? '',
  };
}

export function draftToPatch(draft: ComponentDraft) {
  return {
    ...formValuesToPatch(draft),
    has_jain_variant: draft.has_jain_variant,
    jain_substitute: draft.has_jain_variant ? draft.jain_substitute.trim() || null : null,
  };
}

function summaryMeta(component: ThaliComponent): string {
  return chefComponentPreview(component);
}

type Props = {
  component: ThaliComponent;
  saving: boolean;
  onSave: (patch: ReturnType<typeof draftToPatch>) => Promise<void>;
  onDelete: () => Promise<void>;
};

/** One customizable dish row inside a thali (roti, dal, papad add-on, etc.). */
export function ChefThaliComponentEditor({ component, saving, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ComponentDraft>(() => componentToDraft(component));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sync = () => {
    setDraft(componentToDraft(component));
    setConfirmDelete(false);
  };

  const toggle = () => {
    if (!expanded) sync();
    setExpanded((v) => !v);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    await onSave(draftToPatch(draft));
    setExpanded(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
  };

  const setField = <K extends keyof ComponentDraft>(key: K, value: ComponentDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const isPlate = kindFromDraftType(draft.component_type) === 'plate';

  return (
    <Card style={styles.card}>
      <Pressable onPress={toggle} style={styles.header} accessibilityRole="button">
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{component.name}</Text>
          <Text style={styles.meta}>{summaryMeta(component)}</Text>
          <Text style={styles.typeTag}>{kindBadge(kindFromComponent(component))}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <ComponentFormFields
            isPlate={isPlate}
            values={draft}
            onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
          />
          <Pressable
            onPress={() => setField('has_jain_variant', !draft.has_jain_variant)}
            style={styles.toggleRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: draft.has_jain_variant }}
          >
            <Text style={styles.toggleLabel}>Jain swap available</Text>
            <Text style={styles.toggleValue}>{draft.has_jain_variant ? 'Yes' : 'No'}</Text>
          </Pressable>
          {draft.has_jain_variant ? (
            <Input
              label="Jain substitute label"
              value={draft.jain_substitute}
              onChangeText={(v) => setField('jain_substitute', v)}
              placeholder="e.g. Moong dal (no onion/garlic)"
            />
          ) : null}
          <Button label={isPlate ? 'Save dish' : 'Save add-on'} loading={saving} onPress={() => void handleSave()} />
          <Button
            label={confirmDelete ? 'Confirm remove component' : 'Remove from item'}
            variant="outline"
            loading={saving}
            onPress={() => void handleDelete()}
          />
          {confirmDelete ? (
            <Pressable onPress={() => setConfirmDelete(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 2 },
  name: { ...typography.labelMd, color: colors.onSurface },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  typeTag: { ...typography.labelSm, color: colors.tertiary },
  chevron: { ...typography.labelSm, color: colors.onSurfaceVariant },
  body: { gap: spacing.base, marginTop: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: { ...typography.bodyMd, color: colors.onSurface },
  toggleValue: { ...typography.labelMd, color: colors.primary },
  cancel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
});
