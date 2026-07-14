import type { ThaliComponent, ThaliComponentType } from '../types';
import { finalizeComponentQuantities } from '../marketplace/componentNormalize';
import { isIncludedComponent, normalizeComponentType } from '../thaliComponents';

/** Simple labels chefs see — maps to stored component_type under the hood. */
export type ChefComponentKind = 'plate' | 'addon';

export function kindFromComponent(component: Pick<ThaliComponent, 'component_type'>): ChefComponentKind {
  return isIncludedComponent(component) ? 'plate' : 'addon';
}

export function storageTypeFromKind(kind: ChefComponentKind, maxQty: number): ThaliComponentType {
  if (kind === 'plate') return 'included';
  return maxQty <= 1 ? 'addon_toggle' : 'addon_stepper';
}

export function kindLabel(kind: ChefComponentKind): string {
  return kind === 'plate' ? 'Comes with the order' : 'Add-on (+)';
}

export function kindHint(kind: ChefComponentKind): string {
  if (kind === 'plate') {
    return 'How much is included (e.g. 500g rice, 3 roti). Customer can ask for extra up to max at your price.';
  }
  return 'Customer adds if they want — gulab jamun, aachar, chaas. Set price and max pieces.';
}

export function plateSectionTitle(): string {
  return 'What comes with the order';
}

export function addonSectionTitle(): string {
  return 'Add-ons';
}

export function customerPlateSectionTitle(): string {
  return 'Your plate';
}

export function customerAddonSectionTitle(): string {
  return 'Add extras';
}

export function plateSummary(included: number, extraPrice: number, max: number): string {
  return `${included} included · +₹${extraPrice}/extra · max ${max}`;
}

export function addonSummary(price: number, max: number): string {
  if (max <= 1) return `+₹${price}`;
  return `+₹${price} each · max ${max}`;
}

export function kindBadge(kind: ChefComponentKind): string {
  return kind === 'plate' ? 'In the meal' : 'Add-on';
}

/** Apply chef “kind” choice and normalize qty rules. */
export function applyKindQuantities(
  kind: ChefComponentKind,
  input: { included_qty: number; min_qty: number; max_qty: number },
): Pick<ThaliComponent, 'component_type' | 'included_qty' | 'min_qty' | 'max_qty'> {
  if (kind === 'plate') {
    const included = Math.max(1, input.included_qty || 1);
    const max = Math.max(included, input.max_qty || included);
    return finalizeComponentQuantities({
      component_type: 'included',
      included_qty: included,
      min_qty: 0,
      max_qty: max,
    });
  }
  const max = Math.max(1, input.max_qty || 1);
  return finalizeComponentQuantities({
    component_type: storageTypeFromKind('addon', max),
    included_qty: 0,
    min_qty: 0,
    max_qty: max,
  });
}

export function kindFromDraftType(type: ThaliComponentType): ChefComponentKind {
  return normalizeComponentType({ component_type: type }) === 'included' ? 'plate' : 'addon';
}
