import type { ThaliComponent, ThaliComponentType } from '../types';
import { defaultServingSize } from '../servingSize';

type ComponentQtyInput = Pick<ThaliComponent, 'included_qty' | 'min_qty' | 'max_qty'> & {
  component_type?: ThaliComponentType;
};

/** Enforce qty rules per component type (included_qty = 0 for all add-ons). */
export function finalizeComponentQuantities(
  component: ComponentQtyInput,
): Pick<ThaliComponent, 'component_type' | 'included_qty' | 'min_qty' | 'max_qty'> {
  const componentType = component.component_type ?? 'included';

  if (componentType === 'addon_toggle') {
    return {
      component_type: 'addon_toggle',
      included_qty: 0,
      min_qty: 0,
      max_qty: 1,
    };
  }

  if (componentType === 'addon_stepper') {
    const maxQty = Math.max(1, component.max_qty);
    return {
      component_type: 'addon_stepper',
      included_qty: 0,
      min_qty: 0,
      max_qty: maxQty,
    };
  }

  const minQty = Math.max(0, component.min_qty);
  const maxQty = Math.max(minQty, component.max_qty);
  const includedQty = Math.min(maxQty, Math.max(minQty, component.included_qty));

  return {
    component_type: 'included',
    included_qty: includedQty,
    min_qty: minQty,
    max_qty: maxQty,
  };
}

/** Backward-compatible default for stored components missing component_type or serving. */
export function migrateStoredComponent(component: ThaliComponent): ThaliComponent {
  const componentType = component.component_type ?? 'included';
  const qty = finalizeComponentQuantities({ ...component, component_type: componentType });
  const serving = defaultServingSize(component);
  return {
    ...component,
    ...qty,
    ...serving,
    component_type: qty.component_type,
  };
}
