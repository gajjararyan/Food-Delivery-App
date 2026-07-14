import { calculateThaliPrice } from '../pricing';
import { migrateStoredComponent } from '../marketplace/componentNormalize';
import { defaultQuantityForComponent } from '../thaliComponents';
import { seedMenuItemWithComponents } from '../../constants/seedCatalog';
import type { ThaliComponent } from '../types';

/**
 * Discover lists menu_items.base_price. The builder's default total must match
 * that list price when the customer hasn't changed any quantities.
 */
export function defaultBuilderPrice(
  basePrice: number,
  components: ThaliComponent[],
): number {
  const normalized = components.map(migrateStoredComponent);
  const quantities = Object.fromEntries(
    normalized.map((c) => [c.id, defaultQuantityForComponent(c)]),
  );
  return calculateThaliPrice(basePrice, normalized, quantities, 0).finalPrice;
}

describe('Discover list price vs builder default', () => {
  it('offline seed lunch thali: list price equals default builder total', () => {
    const bundle = seedMenuItemWithComponents('22222222-2222-4222-8222-222222222222');
    expect(bundle).not.toBeNull();
    const { menuItem, components } = bundle!;
    expect(defaultBuilderPrice(menuItem.base_price, components)).toBe(menuItem.base_price);
    expect(menuItem.base_price).toBe(149);
  });

  it('offline seed dinner thali: list price equals default builder total', () => {
    const bundle = seedMenuItemWithComponents('22222222-2222-4222-8222-222222222223');
    expect(bundle).not.toBeNull();
    const { menuItem, components } = bundle!;
    expect(defaultBuilderPrice(menuItem.base_price, components)).toBe(menuItem.base_price);
    expect(menuItem.base_price).toBe(159);
  });

  it('rejects the mis-seeded addon_stepper plate shape that caused ₹149→₹48', () => {
    // Raw DB shape before migration: plate items typed as addon_stepper with
    // included_qty > 0 and min_qty that clamps default 0 upward → negative deltas.
    const broken: ThaliComponent[] = [
      {
        id: 'r',
        menu_item_id: 'm',
        name: 'Roti',
        serving_amount: 1,
        serving_unit: 'piece',
        component_type: 'addon_stepper',
        included_qty: 3,
        min_qty: 1,
        max_qty: 6,
        unit_price_delta: 8,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 1,
      },
      {
        id: 'ri',
        menu_item_id: 'm',
        name: 'Rice',
        serving_amount: 150,
        serving_unit: 'gm',
        component_type: 'addon_stepper',
        included_qty: 1,
        min_qty: 0,
        max_qty: 2,
        unit_price_delta: 15,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 2,
      },
      {
        id: 'd',
        menu_item_id: 'm',
        name: 'Dal',
        serving_amount: 150,
        serving_unit: 'ml',
        component_type: 'addon_stepper',
        included_qty: 1,
        min_qty: 0,
        max_qty: 2,
        unit_price_delta: 20,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 3,
      },
      {
        id: 's',
        menu_item_id: 'm',
        name: 'Sabzi',
        serving_amount: 120,
        serving_unit: 'gm',
        component_type: 'addon_stepper',
        included_qty: 1,
        min_qty: 0,
        max_qty: 2,
        unit_price_delta: 25,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 4,
      },
      {
        id: 'p',
        menu_item_id: 'm',
        name: 'Papad',
        serving_amount: 1,
        serving_unit: 'piece',
        component_type: 'addon_stepper',
        included_qty: 1,
        min_qty: 0,
        max_qty: 3,
        unit_price_delta: 5,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 5,
      },
      {
        id: 'sw',
        menu_item_id: 'm',
        name: 'Sweet',
        serving_amount: 1,
        serving_unit: 'bowl',
        component_type: 'addon_stepper',
        included_qty: 1,
        min_qty: 0,
        max_qty: 2,
        unit_price_delta: 20,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 6,
      },
    ];

    // Without normalization this is the audit bug (149 - 101 = 48).
    const rawQtys = Object.fromEntries(broken.map((c) => [c.id, 0]));
    const raw = calculateThaliPrice(149, broken, rawQtys, 0);
    expect(raw.finalPrice).toBe(48);

    // After migrateStoredComponent (read path), default builder matches Discover.
    expect(defaultBuilderPrice(149, broken)).toBe(149);
  });

  it('correct included plate: Discover price === builder default', () => {
    const plate: ThaliComponent[] = [
      {
        id: 'roti',
        menu_item_id: 'm',
        name: 'Roti',
        serving_amount: 1,
        serving_unit: 'piece',
        component_type: 'included',
        included_qty: 3,
        min_qty: 1,
        max_qty: 6,
        unit_price_delta: 8,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 1,
      },
      {
        id: 'rice',
        menu_item_id: 'm',
        name: 'Rice',
        serving_amount: 150,
        serving_unit: 'gm',
        component_type: 'included',
        included_qty: 1,
        min_qty: 0,
        max_qty: 2,
        unit_price_delta: 15,
        has_jain_variant: false,
        jain_substitute: null,
        sort_order: 2,
      },
    ];
    expect(defaultBuilderPrice(149, plate)).toBe(149);
  });
});
