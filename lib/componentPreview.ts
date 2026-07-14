import { formatServingLabel, type ServingUnit } from './servingSize';
import { isIncludedComponent } from './thaliComponents';
import type { ThaliComponent, ThaliComponentType } from './types';

export type ComponentPreviewInput = Pick<
  ThaliComponent,
  'included_qty' | 'max_qty' | 'unit_price_delta' | 'serving_amount' | 'serving_unit' | 'component_type'
>;

function servingLabel(input: ComponentPreviewInput): string {
  return formatServingLabel(input.serving_amount, input.serving_unit);
}

/** Full sentence on chef forms — includes max servings. */
export function chefComponentPreview(input: ComponentPreviewInput): string {
  const serving = servingLabel(input);
  const price = Math.max(0, input.unit_price_delta);

  if (isIncludedComponent(input)) {
    const included = Math.max(0, input.included_qty);
    const max = Math.max(included, input.max_qty);
    return `${included} × ${serving} · +₹${price}/extra · max ${max}`;
  }

  const max = Math.max(1, input.max_qty);
  return `${serving} · ₹${price}/serving · max ${max}`;
}

/**
 * Short line under the item name on the customer builder — omits max
 * (stepper enforces the upper bound).
 */
export function customerComponentInlinePreview(input: ComponentPreviewInput): string {
  const serving = servingLabel(input);
  const price = Math.max(0, input.unit_price_delta);

  if (isIncludedComponent(input)) {
    const included = Math.max(0, input.included_qty);
    return `${included} × ${serving} · +₹${price}/extra`;
  }

  return `₹${price}`;
}

/** Customer title — add-ons show serving in parentheses; dishes use plain name. */
export function componentCustomerTitle(
  name: string,
  input: Pick<ComponentPreviewInput, 'serving_amount' | 'serving_unit' | 'component_type'>,
): string {
  if (isIncludedComponent(input)) return name.trim();
  const serving = formatServingLabel(input.serving_amount, input.serving_unit);
  return `${name.trim()} (${serving})`;
}

/** @deprecated Use chefComponentPreview — kept for gradual migration. */
export function plateSummary(included: number, extraPrice: number, max: number): string {
  return chefComponentPreview({
    component_type: 'included',
    included_qty: included,
    max_qty: max,
    unit_price_delta: extraPrice,
    serving_amount: 1,
    serving_unit: 'piece',
  });
}

/** @deprecated Use chefComponentPreview — kept for gradual migration. */
export function addonSummary(price: number, max: number): string {
  return chefComponentPreview({
    component_type: max <= 1 ? 'addon_toggle' : 'addon_stepper',
    included_qty: 0,
    max_qty: max,
    unit_price_delta: price,
    serving_amount: 1,
    serving_unit: 'piece',
  });
}

export function previewFromDraft(fields: {
  component_type: ThaliComponentType;
  included_qty: string | number;
  max_qty: string | number;
  unit_price_delta: string | number;
  serving_amount: string | number;
  serving_unit: ServingUnit;
}): string {
  return chefComponentPreview({
    component_type: fields.component_type,
    included_qty: Number(fields.included_qty) || 0,
    max_qty: Number(fields.max_qty) || 1,
    unit_price_delta: Number(fields.unit_price_delta) || 0,
    serving_amount: Number(fields.serving_amount) || 1,
    serving_unit: fields.serving_unit,
  });
}
