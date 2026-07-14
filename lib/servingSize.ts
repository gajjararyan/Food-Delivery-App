/** Units chefs can pick for one serving of a dish or add-on. */
export type ServingUnit = 'gm' | 'ml' | 'piece' | 'bowl' | 'plate';

export const SERVING_UNITS: readonly ServingUnit[] = ['gm', 'ml', 'piece', 'bowl', 'plate'] as const;

export const DEFAULT_SERVING_AMOUNT = 1;
export const DEFAULT_SERVING_UNIT: ServingUnit = 'piece';

export type ServingSize = {
  serving_amount: number;
  serving_unit: ServingUnit;
};

export function normalizeServingAmount(raw: number | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SERVING_AMOUNT;
  return Math.round(n);
}

export function normalizeServingUnit(raw: string | undefined): ServingUnit {
  if (raw && (SERVING_UNITS as readonly string[]).includes(raw)) {
    return raw as ServingUnit;
  }
  return DEFAULT_SERVING_UNIT;
}

/** Migrate legacy rows missing serving fields. */
export function defaultServingSize(existing?: Partial<ServingSize>): ServingSize {
  return {
    serving_amount: normalizeServingAmount(existing?.serving_amount),
    serving_unit: normalizeServingUnit(existing?.serving_unit),
  };
}

/**
 * One consistent label for a serving — used in previews so free/extra always
 * refer to the same amount (e.g. "400gm", "500 ml", "1 piece").
 */
export function formatServingLabel(amount: number, unit: ServingUnit): string {
  const qty = normalizeServingAmount(amount);
  if (unit === 'gm') return `${qty}gm`;
  if (unit === 'ml') return `${qty} ml`;
  return `${qty} ${unit}`;
}
