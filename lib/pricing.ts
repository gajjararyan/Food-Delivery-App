import type { SelectedQuantity, ThaliComponent, Uuid } from './types';
import { defaultQuantityForComponent } from './thaliComponents';

export type PriceableComponent = Pick<
  ThaliComponent,
  'id' | 'included_qty' | 'min_qty' | 'max_qty' | 'unit_price_delta' | 'component_type'
>;

export type ThaliPriceBreakdown = {
  basePrice: number;
  deltasTotal: number;
  swapCreditsApplied: number;
  finalPrice: number;
  clampedQuantities: Record<Uuid, number>;
};

/**
 * final_price = base_price + Σ(selected_qty − included_qty) × unit_price_delta − swap_credits_applied
 * Quantities are clamped to [min_qty, max_qty] before pricing.
 */
export function calculateThaliPrice(
  basePrice: number,
  components: PriceableComponent[],
  selectedQuantities: Record<Uuid, number> | SelectedQuantity[],
  swapCreditsApplied = 0,
): ThaliPriceBreakdown {
  const qtyMap = Array.isArray(selectedQuantities)
    ? Object.fromEntries(selectedQuantities.map((q) => [q.componentId, q.quantity]))
    : { ...selectedQuantities };

  const clampedQuantities: Record<Uuid, number> = {};
  let deltasTotal = 0;

  for (const component of components) {
    const raw = qtyMap[component.id] ?? defaultQuantityForComponent(component as ThaliComponent);
    const clamped = Math.min(component.max_qty, Math.max(component.min_qty, raw));
    clampedQuantities[component.id] = clamped;
    deltasTotal += (clamped - component.included_qty) * component.unit_price_delta;
  }

  const credits = Math.max(0, swapCreditsApplied);
  const finalPrice = Math.max(0, basePrice + deltasTotal - credits);

  return {
    basePrice,
    deltasTotal,
    swapCreditsApplied: credits,
    finalPrice,
    clampedQuantities,
  };
}
