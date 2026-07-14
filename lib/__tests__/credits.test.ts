import { applyCreditsAtCheckout, canSkipMeal, sumCreditLedger } from '../credits';

describe('applyCreditsAtCheckout', () => {
  it('applies partial credits and leaves remainder due', () => {
    expect(applyCreditsAtCheckout(40, 149)).toEqual({
      creditsApplied: 40,
      amountDue: 109,
    });
  });

  it('never charges negative when credits exceed total', () => {
    expect(applyCreditsAtCheckout(200, 149)).toEqual({
      creditsApplied: 149,
      amountDue: 0,
    });
  });

  it('handles zero credits', () => {
    expect(applyCreditsAtCheckout(0, 149)).toEqual({
      creditsApplied: 0,
      amountDue: 149,
    });
  });
});

describe('sumCreditLedger', () => {
  it('sums grants and deductions', () => {
    expect(sumCreditLedger([40, -10, 5])).toBe(35);
  });
});

describe('canSkipMeal', () => {
  it('blocks skip after cutoff', () => {
    const result = canSkipMeal({
      mealDate: '2026-07-08',
      mealSlot: 'lunch',
      lunchStart: '13:00',
      cutoffMinutesBefore: 180,
      now: new Date('2026-07-08T12:00:00'),
    });
    expect(result.allowed).toBe(false);
  });

  it('allows skip before cutoff', () => {
    const result = canSkipMeal({
      mealDate: '2026-07-08',
      mealSlot: 'lunch',
      lunchStart: '13:00',
      cutoffMinutesBefore: 180,
      now: new Date('2026-07-08T09:00:00'),
    });
    expect(result.allowed).toBe(true);
  });
});
