import type { Uuid } from './types';

/**
 * Apply available credits toward an order total.
 * Returns amount applied and remaining payable (never negative).
 */
export function applyCreditsAtCheckout(
  availableCredits: number,
  orderTotal: number,
): { creditsApplied: number; amountDue: number } {
  const available = Math.max(0, availableCredits);
  const total = Math.max(0, orderTotal);
  const creditsApplied = Math.min(available, total);
  return {
    creditsApplied,
    amountDue: total - creditsApplied,
  };
}

/** Pure sum of ledger amounts (positive grants, negative deductions). */
export function sumCreditLedger(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

export type SkipCutoffInput = {
  mealDate: string;
  now?: Date;
  /** Minutes before meal window start when skip is blocked (kitchen already prep). */
  cutoffMinutesBefore?: number;
  /** Fixed lunch start HH:mm local, MVP default. */
  lunchStart?: string;
  dinnerStart?: string;
  mealSlot: 'lunch' | 'dinner';
};

/**
 * Returns true when skip is still allowed. Block if past kitchen cutoff.
 * Delivery windows are fixed slots — we use slot start as the prep cutoff anchor.
 */
export function canSkipMeal(input: SkipCutoffInput): { allowed: boolean; message?: string } {
  const now = input.now ?? new Date();
  const cutoffMinutes = input.cutoffMinutesBefore ?? 180;
  const startHm = input.mealSlot === 'lunch' ? (input.lunchStart ?? '13:00') : (input.dinnerStart ?? '19:00');
  const [hh, mm] = startHm.split(':').map(Number);
  const mealStart = new Date(`${input.mealDate}T00:00:00`);
  mealStart.setHours(hh ?? 0, mm ?? 0, 0, 0);
  const cutoff = new Date(mealStart.getTime() - cutoffMinutes * 60_000);

  if (now.getTime() >= cutoff.getTime()) {
    return {
      allowed: false,
      message: 'This meal is already being prepared and can no longer be skipped.',
    };
  }
  return { allowed: true };
}

export type CreditRow = { id: Uuid; amount: number };
