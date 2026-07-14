import { toE164India, formatDisplayPhone } from '../phone';

describe('toE164India', () => {
  it('normalizes 10-digit local numbers', () => {
    const result = toE164India('98765 43210');
    expect(result).toEqual({ ok: true, data: '+919876543210' });
  });

  it('accepts already-prefixed 91 numbers', () => {
    const result = toE164India('919876543210');
    expect(result).toEqual({ ok: true, data: '+919876543210' });
  });

  it('rejects short numbers', () => {
    const result = toE164India('98765');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
    }
  });

  it('allows reserved admin test phone 1234567890', () => {
    expect(toE164India('1234567890')).toEqual({ ok: true, data: '+911234567890' });
  });
});

describe('formatDisplayPhone', () => {
  it('formats E.164 for UI', () => {
    expect(formatDisplayPhone('+919876543210')).toBe('+91 98765 43210');
  });
});
