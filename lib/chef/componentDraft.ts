import {
  applyKindQuantities,
  kindFromDraftType,
  type ChefComponentKind,
} from './componentSimple';
import { previewFromDraft } from '../componentPreview';
import { finalizeComponentQuantities } from '../marketplace/componentNormalize';
import type { ThaliComponentInput } from '../marketplace/localStore';
import { DEFAULT_SERVING_AMOUNT, DEFAULT_SERVING_UNIT, type ServingUnit } from '../servingSize';
import type { ThaliComponentType } from '../types';

/** In-memory row while chef is creating or editing an item (before save). */
export type ComponentDraftRow = {
  localId: string;
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

export type ComponentPreset = {
  label: string;
  draft: Partial<Omit<ComponentDraftRow, 'localId'>>;
};

export const COMPONENT_PRESETS: ComponentPreset[] = [
  {
    label: 'Roti',
    draft: {
      name: 'Roti',
      serving_amount: '1',
      serving_unit: 'piece',
      component_type: 'included',
      included_qty: '3',
      min_qty: '1',
      max_qty: '6',
      unit_price_delta: '6',
    },
  },
  {
    label: 'Rice',
    draft: {
      name: 'Rice',
      serving_amount: '500',
      serving_unit: 'gm',
      component_type: 'included',
      included_qty: '1',
      min_qty: '0',
      max_qty: '2',
      unit_price_delta: '15',
    },
  },
  {
    label: 'Dal',
    draft: {
      name: 'Dal',
      serving_amount: '1',
      serving_unit: 'bowl',
      component_type: 'included',
      included_qty: '1',
      min_qty: '0',
      max_qty: '2',
      unit_price_delta: '20',
      has_jain_variant: true,
      jain_substitute: 'Moong dal (no onion/garlic)',
    },
  },
  {
    label: 'Sabzi',
    draft: {
      name: 'Sabzi',
      serving_amount: '1',
      serving_unit: 'bowl',
      component_type: 'included',
      included_qty: '1',
      min_qty: '0',
      max_qty: '2',
      unit_price_delta: '25',
    },
  },
  {
    label: 'Rajma',
    draft: {
      name: 'Rajma',
      serving_amount: '400',
      serving_unit: 'gm',
      component_type: 'included',
      included_qty: '1',
      min_qty: '0',
      max_qty: '3',
      unit_price_delta: '20',
    },
  },
  {
    label: 'Gulab Jamun',
    draft: {
      name: 'Gulab Jamun',
      serving_amount: '2',
      serving_unit: 'piece',
      component_type: 'addon_toggle',
      unit_price_delta: '25',
    },
  },
  {
    label: 'Aachar',
    draft: {
      name: 'Aachar',
      serving_amount: '50',
      serving_unit: 'gm',
      component_type: 'addon_toggle',
      unit_price_delta: '15',
    },
  },
  {
    label: 'Chaas',
    draft: {
      name: 'Chaas',
      serving_amount: '250',
      serving_unit: 'ml',
      component_type: 'addon_stepper',
      max_qty: '2',
      unit_price_delta: '20',
    },
  },
  {
    label: 'Cheese',
    draft: {
      name: 'Cheese',
      serving_amount: '50',
      serving_unit: 'gm',
      component_type: 'addon_stepper',
      max_qty: '3',
      unit_price_delta: '30',
    },
  },
  {
    label: 'Butter',
    draft: {
      name: 'Butter',
      serving_amount: '10',
      serving_unit: 'gm',
      component_type: 'addon_stepper',
      max_qty: '2',
      unit_price_delta: '15',
    },
  },
  {
    label: 'Papad',
    draft: {
      name: 'Papad',
      serving_amount: '1',
      serving_unit: 'piece',
      component_type: 'addon_toggle',
      unit_price_delta: '10',
    },
  },
];

/** Sensible defaults when opening “Add item” with customization on. */
export function defaultNewItemComponentDrafts(): ComponentDraftRow[] {
  return ['Roti', 'Rice', 'Dal'].map((label) => createDraftFromPreset(label));
}

export function createEmptyDraftRow(): ComponentDraftRow {
  return createEmptyDraftRowForKind('plate');
}

/** Blank row for chef to name anything — rajma, custom pickle, etc. */
export function createEmptyDraftRowForKind(kind: ChefComponentKind): ComponentDraftRow {
  const qty = applyKindQuantities(kind, {
    included_qty: kind === 'plate' ? 1 : 0,
    min_qty: 0,
    max_qty: kind === 'plate' ? 3 : 1,
  });
  return {
    localId: crypto.randomUUID(),
    name: '',
    serving_amount: kind === 'plate' ? '400' : '1',
    serving_unit: kind === 'plate' ? 'gm' : 'piece',
    component_type: qty.component_type!,
    included_qty: String(qty.included_qty),
    min_qty: String(qty.min_qty),
    max_qty: String(qty.max_qty),
    unit_price_delta: kind === 'plate' ? '10' : '15',
    has_jain_variant: false,
    jain_substitute: '',
  };
}

export function createDraftFromPreset(label: string): ComponentDraftRow {
  const preset = COMPONENT_PRESETS.find((p) => p.label === label);
  const base = createEmptyDraftRow();
  if (!preset) return base;
  return applyPresetToDraft(base, preset);
}

export function applyPresetToDraft(row: ComponentDraftRow, preset: ComponentPreset): ComponentDraftRow {
  const type = preset.draft.component_type ?? 'included';
  const qty = finalizeComponentQuantities({
    component_type: type,
    included_qty: Number(preset.draft.included_qty ?? (type === 'included' ? 1 : 0)),
    min_qty: Number(preset.draft.min_qty ?? 0),
    max_qty: Number(preset.draft.max_qty ?? (type === 'addon_toggle' ? 1 : 3)),
  });
  return {
    ...row,
    localId: crypto.randomUUID(),
    name: preset.draft.name ?? preset.label,
    serving_amount: preset.draft.serving_amount ?? String(DEFAULT_SERVING_AMOUNT),
    serving_unit: preset.draft.serving_unit ?? DEFAULT_SERVING_UNIT,
    component_type: type,
    included_qty: String(qty.included_qty),
    min_qty: String(qty.min_qty),
    max_qty: String(qty.max_qty),
    unit_price_delta: preset.draft.unit_price_delta ?? row.unit_price_delta,
    has_jain_variant: preset.draft.has_jain_variant ?? false,
    jain_substitute: preset.draft.jain_substitute ?? '',
  };
}

export function draftRowToInput(row: ComponentDraftRow): ThaliComponentInput | null {
  const name = row.name.trim();
  if (!name) return null;
  const kind = kindFromDraftType(row.component_type);
  const qty = applyKindQuantities(kind, {
    included_qty: Number(row.included_qty) || 0,
    min_qty: Number(row.min_qty) || 0,
    max_qty: Number(row.max_qty) || 1,
  });
  return {
    name,
    serving_amount: Number(row.serving_amount) || DEFAULT_SERVING_AMOUNT,
    serving_unit: row.serving_unit,
    component_type: qty.component_type,
    included_qty: qty.included_qty,
    min_qty: qty.min_qty,
    max_qty: qty.max_qty,
    unit_price_delta: Math.max(0, Number(row.unit_price_delta) || 0),
    has_jain_variant: row.has_jain_variant,
    jain_substitute: row.has_jain_variant ? row.jain_substitute.trim() || null : null,
  };
}

export function draftsToInputs(rows: ComponentDraftRow[]): ThaliComponentInput[] {
  const inputs = rows
    .map(draftRowToInput)
    .filter((row): row is ThaliComponentInput => row !== null);
  const seen = new Set<string>();
  return inputs.filter((row) => {
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function draftRowSummary(row: ComponentDraftRow): string {
  return previewFromDraft(row);
}

/** Plate items vs add-ons for quick-add chips. */
export const PLATE_PRESET_LABELS = ['Roti', 'Rice', 'Dal', 'Sabzi', 'Rajma'] as const;
export const ADDON_PRESET_LABELS = ['Gulab Jamun', 'Aachar', 'Chaas', 'Papad'] as const;
