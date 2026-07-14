import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ADDON_PRESET_LABELS,
  createDraftFromPreset,
  createEmptyDraftRowForKind,
  draftRowToInput,
  PLATE_PRESET_LABELS,
  type ComponentDraftRow,
} from '../../lib/chef/componentDraft';
import { kindFromDraftType, type ChefComponentKind } from '../../lib/chef/componentSimple';
import {
  createThaliComponent,
  fetchChefThaliComponents,
  removeThaliComponent,
  saveThaliComponent,
} from '../../lib/api/chefs';
import { invalidateMarketplaceQueries } from '../../lib/marketplace/invalidation';
import { calculateThaliPrice } from '../../lib/pricing';
import { defaultQuantityForComponent, isIncludedComponent } from '../../lib/thaliComponents';
import type { ThaliComponent, Uuid } from '../../lib/types';
import { formatInr } from '../../lib/date';
import { Button, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { ChefThaliComponentEditor } from './ChefThaliComponentEditor';
import { ComponentFormFields } from './ComponentFormFields';

type Props = {
  makerId: Uuid;
  menuItemId: Uuid;
  basePrice: number;
};

type SectionProps = {
  title: string;
  hint: string;
  presets: readonly string[];
  components: ThaliComponent[];
  nameTaken: (label: string) => boolean;
  onAddPreset: (label: string) => void;
  onAddCustom: () => void;
  savingId: string | null;
  onSave: (componentId: Uuid, patch: Parameters<typeof saveThaliComponent>[3]) => Promise<void>;
  onDelete: (componentId: Uuid) => Promise<void>;
  addForm: ReactNode;
  starterLabel?: string;
  onStarter?: () => void;
};

function MenuSection({
  title,
  hint,
  presets,
  components,
  nameTaken,
  onAddPreset,
  onAddCustom,
  savingId,
  onSave,
  onDelete,
  addForm,
  starterLabel,
  onStarter,
}: SectionProps) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {presets.map((label) => (
          <Pressable
            key={label}
            onPress={() => onAddPreset(label)}
            disabled={nameTaken(label) || Boolean(savingId)}
            style={[styles.chip, (nameTaken(label) || Boolean(savingId)) && styles.chipDisabled]}
          >
            <Text
              style={[
                styles.chipText,
                (nameTaken(label) || Boolean(savingId)) && styles.chipTextDisabled,
              ]}
            >
              + {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Button label="+ Add your own" variant="outline" onPress={onAddCustom} />

      {components.map((component) => (
        <ChefThaliComponentEditor
          key={component.id}
          component={component}
          saving={savingId === component.id}
          onSave={(patch) => onSave(component.id, patch)}
          onDelete={() => onDelete(component.id)}
        />
      ))}

      {addForm}

      {components.length === 0 && !addForm && starterLabel && onStarter ? (
        <Pressable onPress={onStarter}>
          <Text style={styles.starterLink}>{starterLabel}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Chef configures plate contents and add-ons for an item. */
export function ChefThaliComponentsEditor({ makerId, menuItemId, basePrice }: Props) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<ComponentDraftRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addingLock = useRef(false);

  const componentsQuery = useQuery({
    queryKey: ['chef-thali-components', makerId, menuItemId],
    queryFn: async () => {
      const result = await fetchChefThaliComponents(makerId, menuItemId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const components = componentsQuery.data ?? [];
  const plateComponents = useMemo(
    () => components.filter((c) => isIncludedComponent(c)),
    [components],
  );
  const addonComponents = useMemo(
    () => components.filter((c) => !isIncludedComponent(c)),
    [components],
  );

  const previewPrice = (() => {
    if (components.length === 0) return basePrice;
    const quantities = Object.fromEntries(
      components.map((c) => [c.id, defaultQuantityForComponent(c)]),
    );
    return calculateThaliPrice(basePrice, components, quantities, 0).finalPrice;
  })();

  const refresh = () => {
    invalidateMarketplaceQueries(queryClient, makerId);
    void queryClient.invalidateQueries({ queryKey: ['chef-thali-components', makerId, menuItemId] });
  };

  const resetAddForm = () => {
    setAddDraft(null);
  };

  const openCustomAdd = (kind: ChefComponentKind) => {
    setAddDraft(createEmptyDraftRowForKind(kind));
  };

  const createFromInput = async (input: NonNullable<ReturnType<typeof draftRowToInput>>) => {
    if (addingLock.current) return false;
    addingLock.current = true;
    setSavingId('new');
    setError(null);
    try {
      const result = await createThaliComponent(makerId, menuItemId, input);
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
      resetAddForm();
      refresh();
      return true;
    } finally {
      addingLock.current = false;
      setSavingId(null);
    }
  };

  const onAddPreset = async (label: string) => {
    if (nameTaken(label) || savingId) return;
    const input = draftRowToInput(createDraftFromPreset(label));
    if (!input) return;
    await createFromInput(input);
  };

  const onAddCustom = async () => {
    if (!addDraft) return;
    const input = draftRowToInput(addDraft);
    if (!input) {
      setError('Enter a name');
      return;
    }
    await createFromInput(input);
  };

  const onStarter = async () => {
    for (const label of ['Roti', 'Rice', 'Dal'] as const) {
      if (components.some((c) => c.name.toLowerCase() === label.toLowerCase())) continue;
      const input = draftRowToInput(createDraftFromPreset(label));
      if (!input) continue;
      const ok = await createFromInput(input);
      if (!ok) break;
    }
  };

  const onSave = async (componentId: Uuid, patch: Parameters<typeof saveThaliComponent>[3]) => {
    setSavingId(componentId);
    setError(null);
    const result = await saveThaliComponent(makerId, menuItemId, componentId, patch);
    setSavingId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    refresh();
  };

  const onDelete = async (componentId: Uuid) => {
    setSavingId(componentId);
    setError(null);
    const result = await removeThaliComponent(makerId, menuItemId, componentId);
    setSavingId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    refresh();
  };

  const nameTaken = (label: string) =>
    components.some((c) => c.name.trim().toLowerCase() === label.toLowerCase());

  const renderAddForm = (kind: ChefComponentKind) => {
    if (!addDraft || kindFromDraftType(addDraft.component_type) !== kind) return null;
    const isPlate = kind === 'plate';
    return (
      <Card style={styles.addCard}>
        <ComponentFormFields
          isPlate={isPlate}
          values={addDraft}
          onChange={(next) => setAddDraft((prev) => (prev ? { ...prev, ...next } : prev))}
        />
        <Button label={isPlate ? 'Save dish' : 'Save add-on'} loading={savingId === 'new'} onPress={() => void onAddCustom()} />
        <Button label="Cancel" variant="outline" onPress={resetAddForm} />
      </Card>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.preview}>Price at default portions: {formatInr(previewPrice)}</Text>

      <MenuSection
        title="1 · Dishes in the meal"
        hint="What comes with the order — roti, rice, dal. Set included amount and extra charge."
        presets={PLATE_PRESET_LABELS}
        components={plateComponents}
        nameTaken={nameTaken}
        onAddPreset={(label) => void onAddPreset(label)}
        onAddCustom={() => openCustomAdd('plate')}
        savingId={savingId}
        onSave={onSave}
        onDelete={onDelete}
        addForm={renderAddForm('plate')}
        starterLabel="Quick fill: Roti + Rice + Dal"
        onStarter={() => void onStarter()}
      />

      <MenuSection
        title="2 · Add-ons (optional)"
        hint="Extras customer can add — jamun, aachar, chaas. Not included by default."
        presets={ADDON_PRESET_LABELS}
        components={addonComponents}
        nameTaken={nameTaken}
        onAddPreset={(label) => void onAddPreset(label)}
        onAddCustom={() => openCustomAdd('addon')}
        savingId={savingId}
        onSave={onSave}
        onDelete={onDelete}
        addForm={renderAddForm('addon')}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.base, marginTop: spacing.base },
  preview: { ...typography.labelSm, color: colors.tertiary },
  sectionCard: { gap: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  sectionTitle: { ...typography.labelMd, color: colors.primary },
  sectionHint: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chipDisabled: { borderColor: colors.outlineVariant, opacity: 0.5 },
  chipText: { ...typography.labelSm, color: colors.primary },
  chipTextDisabled: { color: colors.onSurfaceVariant },
  starterLink: {
    ...typography.labelSm,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  addCard: { gap: spacing.sm, backgroundColor: colors.surface },
  error: { ...typography.bodySm, color: colors.error },
});
