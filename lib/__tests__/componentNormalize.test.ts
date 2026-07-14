import { finalizeComponentQuantities, migrateStoredComponent } from '../marketplace/componentNormalize';
import type { ThaliComponent } from '../types';

describe('componentNormalize', () => {
  it('forces addon_toggle to included_qty 0 and max 1', () => {
    const qty = finalizeComponentQuantities({
      component_type: 'addon_toggle',
      included_qty: 5,
      min_qty: 1,
      max_qty: 9,
    });
    expect(qty).toEqual({
      component_type: 'addon_toggle',
      included_qty: 0,
      min_qty: 0,
      max_qty: 1,
    });
  });

  it('forces addon_stepper to included_qty 0', () => {
    const qty = finalizeComponentQuantities({
      component_type: 'addon_stepper',
      included_qty: 2,
      min_qty: 1,
      max_qty: 4,
    });
    expect(qty.included_qty).toBe(0);
    expect(qty.min_qty).toBe(0);
    expect(qty.max_qty).toBe(4);
  });

  it('migrates legacy components without component_type to included', () => {
    const legacy = {
      id: 'x',
      menu_item_id: 'y',
      name: 'Roti',
      included_qty: 3,
      min_qty: 1,
      max_qty: 6,
      unit_price_delta: 8,
      has_jain_variant: false,
      jain_substitute: null,
      sort_order: 1,
    } as ThaliComponent;

    const migrated = migrateStoredComponent(legacy);
    expect(migrated.component_type).toBe('included');
    expect(migrated.included_qty).toBe(3);
  });
});
