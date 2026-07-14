import type { ThaliComponent, ThaliComponentType } from './types';

export type { ThaliComponentType };

export function normalizeComponentType(
  component: Pick<ThaliComponent, 'component_type'>,
): ThaliComponentType {
  return component.component_type ?? 'included';
}

export function isIncludedComponent(component: Pick<ThaliComponent, 'component_type'>): boolean {
  return normalizeComponentType(component) === 'included';
}

export function isAddonComponent(component: Pick<ThaliComponent, 'component_type'>): boolean {
  return !isIncludedComponent(component);
}

export function defaultQuantityForComponent(component: ThaliComponent): number {
  return isAddonComponent(component) ? 0 : component.included_qty;
}

export function componentTypeLabel(type: ThaliComponentType): string {
  switch (type) {
    case 'included':
      return 'Included in plate';
    case 'addon_toggle':
      return 'Optional add-on (yes/no)';
    case 'addon_stepper':
      return 'Extra (qty + price)';
  }
}

export function componentSectionLabel(type: ThaliComponentType): string {
  switch (type) {
    case 'included':
      return 'Included in plate';
    case 'addon_toggle':
    case 'addon_stepper':
      return 'Add extras';
  }
}
