import { err, ok, type Result } from './result';

/** Reserved admin test number (not a real Indian mobile prefix). */
export const ADMIN_TEST_PHONE_NATIONAL = '1234567890';
export const ADMIN_TEST_PHONE_E164 = '+911234567890';

/** Normalize Indian mobile to E.164 (+91XXXXXXXXXX). Allows reserved admin test phone. */
export function toE164India(phone: string): Result<string> {
  const digits = phone.replace(/\D/g, '');
  const national = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  if (national === ADMIN_TEST_PHONE_NATIONAL) {
    return ok(ADMIN_TEST_PHONE_E164);
  }
  if (national.length !== 10 || !/^[6-9]/.test(national)) {
    return err('VALIDATION', 'Enter a valid 10-digit mobile number');
  }
  return ok(`+91${national}`);
}

export function formatDisplayPhone(e164: string): string {
  const national = e164.replace(/^\+91/, '');
  if (national.length === 10) {
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return e164;
}
