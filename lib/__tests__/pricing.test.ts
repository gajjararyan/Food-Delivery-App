import { calculateThaliPrice } from '../pricing';

/** Legacy-style included-only thali (seed catalog shape). */
const INCLUDED_ONLY = [
  { id: 'roti', component_type: 'included' as const, included_qty: 3, min_qty: 1, max_qty: 6, unit_price_delta: 8 },
  { id: 'rice', component_type: 'included' as const, included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 15 },
  { id: 'dal', component_type: 'included' as const, included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 20 },
];

const WITH_ADDONS = [
  ...INCLUDED_ONLY,
  { id: 'papad', component_type: 'addon_toggle' as const, included_qty: 0, min_qty: 0, max_qty: 1, unit_price_delta: 10 },
  { id: 'chaas', component_type: 'addon_stepper' as const, included_qty: 0, min_qty: 0, max_qty: 2, unit_price_delta: 20 },
];

const BASE = 149;

describe('calculateThaliPrice', () => {
  it('returns base price for default included quantities (legacy items)', () => {
    const result = calculateThaliPrice(BASE, INCLUDED_ONLY, {
      roti: 3,
      rice: 1,
      dal: 1,
    });
    expect(result.finalPrice).toBe(149);
    expect(result.deltasTotal).toBe(0);
  });

  it('reduces price when roti is below included', () => {
    const result = calculateThaliPrice(BASE, INCLUDED_ONLY, {
      roti: 1,
      rice: 1,
      dal: 1,
    });
    expect(result.finalPrice).toBe(133);
    expect(result.deltasTotal).toBe(-16);
  });

  it('charges nothing for unselected addon_toggle', () => {
    const result = calculateThaliPrice(BASE, WITH_ADDONS, {
      roti: 3,
      rice: 1,
      dal: 1,
      papad: 0,
      chaas: 0,
    });
    expect(result.finalPrice).toBe(149);
    expect(result.deltasTotal).toBe(0);
  });

  it('charges addon_toggle when selected', () => {
    const result = calculateThaliPrice(BASE, WITH_ADDONS, {
      roti: 3,
      rice: 1,
      dal: 1,
      papad: 1,
      chaas: 0,
    });
    expect(result.finalPrice).toBe(159);
    expect(result.deltasTotal).toBe(10);
  });

  it('charges addon_stepper by quantity', () => {
    const result = calculateThaliPrice(BASE, WITH_ADDONS, {
      roti: 3,
      rice: 1,
      dal: 1,
      papad: 0,
      chaas: 2,
    });
    expect(result.finalPrice).toBe(189);
    expect(result.deltasTotal).toBe(40);
  });

  it('sums included adjustments and all add-on types together', () => {
    const result = calculateThaliPrice(BASE, WITH_ADDONS, {
      roti: 4,
      rice: 1,
      dal: 1,
      papad: 1,
      chaas: 1,
    });
    // +1 roti × 8 + papad 10 + chaas 20 = 38
    expect(result.finalPrice).toBe(187);
    expect(result.deltasTotal).toBe(38);
  });

  it('defaults missing addon quantities to 0 via included_qty', () => {
    const result = calculateThaliPrice(BASE, WITH_ADDONS, {
      roti: 3,
      rice: 1,
      dal: 1,
    });
    expect(result.finalPrice).toBe(149);
  });

  it('applies swap credits at checkout', () => {
    const result = calculateThaliPrice(
      BASE,
      INCLUDED_ONLY,
      { roti: 3, rice: 1, dal: 1 },
      20,
    );
    expect(result.finalPrice).toBe(129);
    expect(result.swapCreditsApplied).toBe(20);
  });

  it('clamps quantities over max before pricing', () => {
    const result = calculateThaliPrice(BASE, INCLUDED_ONLY, {
      roti: 99,
      rice: 1,
      dal: 1,
    });
    expect(result.clampedQuantities.roti).toBe(6);
    expect(result.finalPrice).toBe(173);
  });
});
