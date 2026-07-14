import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ADDON_PRESET_LABELS,
  createDraftFromPreset,
  createEmptyDraftRowForKind,
  defaultNewItemComponentDrafts,
  draftRowToInput,
  PLATE_PRESET_LABELS,
  type ComponentDraftRow,
} from '../../lib/chef/componentDraft';
import type { ChefComponentKind } from '../../lib/chef/componentSimple';
import { calculateThaliPrice } from '../../lib/pricing';
import { defaultQuantityForComponent, isIncludedComponent } from '../../lib/thaliComponents';
import type { ThaliComponent } from '../../lib/types';
import { formatInr } from '../../lib/date';
import { Button, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import { ChefComponentDraftRow } from './ChefComponentDraftRow';

type Props = {
  drafts: ComponentDraftRow[];
  onChange: (drafts: ComponentDraftRow[] | ((prev: ComponentDraftRow[]) => ComponentDraftRow[])) => void;
  basePrice: number;
};

function splitDrafts(drafts: ComponentDraftRow[]) {
  const plate: ComponentDraftRow[] = [];
  const addon: ComponentDraftRow[] = [];
  for (const row of drafts) {
    if (isIncludedComponent({ component_type: row.component_type })) plate.push(row);
    else addon.push(row);
  }
  return { plate, addon };
}

type SectionProps = {
  title: string;
  hint: string;
  presets: readonly string[];
  kind: ChefComponentKind;
  rows: ComponentDraftRow[];
  taken: (label: string) => boolean;
  onAddPreset: (label: string) => void;
  onAddCustom: () => void;
  onUpdate: (localId: string, next: ComponentDraftRow) => void;
  onRemove: (localId: string) => void;
  starterLabel?: string;
  onStarter?: () => void;
};

function MenuSection({
  title,
  hint,
  presets,
  rows,
  taken,
  onAddPreset,
  onAddCustom,
  onUpdate,
  onRemove,
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
            disabled={taken(label)}
            style={[styles.chip, taken(label) && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, taken(label) && styles.chipTextDisabled]}>+ {label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Button label="+ Add your own" variant="outline" onPress={onAddCustom} />

      {rows.map((row) => (
        <ChefComponentDraftRow
          key={row.localId}
          row={row}
          onChange={(next) => onUpdate(row.localId, next)}
          onRemove={() => onRemove(row.localId)}
        />
      ))}

      {rows.length === 0 && starterLabel && onStarter ? (
        <Pressable onPress={onStarter}>
          <Text style={styles.starterLink}>{starterLabel}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Two simple blocks: dishes in the meal + optional add-ons. */
export function ChefComponentsDraftEditor({ drafts, onChange, basePrice }: Props) {
  const { plate, addon } = useMemo(() => splitDrafts(drafts), [drafts]);

  const previewPrice = useMemo(() => {
    const priceables = drafts
      .map((row) => {
        const input = draftRowToInput(row);
        if (!input) return null;
        return { id: row.localId, ...input } as ThaliComponent;
      })
      .filter((row): row is ThaliComponent => row !== null);
    if (priceables.length === 0) return basePrice;
    const quantities = Object.fromEntries(
      priceables.map((c) => [c.id, defaultQuantityForComponent(c)]),
    );
    return calculateThaliPrice(basePrice, priceables, quantities, 0).finalPrice;
  }, [drafts, basePrice]);

  const addPreset = (label: string) => {
    onChange((prev) => {
      if (prev.some((d) => d.name.trim().toLowerCase() === label.toLowerCase())) return prev;
      return [...prev, createDraftFromPreset(label)];
    });
  };

  const addCustom = (kind: ChefComponentKind) => {
    onChange((prev) => [...prev, createEmptyDraftRowForKind(kind)]);
  };

  const updateRow = (localId: string, next: ComponentDraftRow) => {
    onChange((prev) => prev.map((d) => (d.localId === localId ? next : d)));
  };

  const removeRow = (localId: string) => {
    onChange((prev) => prev.filter((d) => d.localId !== localId));
  };

  const nameTaken = (label: string) =>
    drafts.some((d) => d.name.trim().toLowerCase() === label.toLowerCase());

  return (
    <View style={styles.wrap}>
      <Text style={styles.preview}>Price at default portions: {formatInr(previewPrice)}</Text>

      <MenuSection
        title="1 · Dishes in the meal"
        hint="What comes with the order — roti, rice, dal. Set included amount and extra charge."
        presets={PLATE_PRESET_LABELS}
        kind="plate"
        rows={plate}
        taken={nameTaken}
        onAddPreset={addPreset}
        onAddCustom={() => addCustom('plate')}
        onUpdate={updateRow}
        onRemove={removeRow}
        starterLabel="Quick fill: Roti + Rice + Dal"
        onStarter={() => onChange(defaultNewItemComponentDrafts())}
      />

      <MenuSection
        title="2 · Add-ons (optional)"
        hint="Extras customer can add — jamun, aachar, chaas. Not included by default."
        presets={ADDON_PRESET_LABELS}
        kind="addon"
        rows={addon}
        taken={nameTaken}
        onAddPreset={addPreset}
        onAddCustom={() => addCustom('addon')}
        onUpdate={updateRow}
        onRemove={removeRow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.base },
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
});
