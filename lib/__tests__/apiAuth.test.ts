import { isDevAccessToken, isDevPaymentAuthEnabled } from '../payment/apiAuth';

describe('isDevAccessToken', () => {
  it('detects dev session tokens', () => {
    expect(isDevAccessToken('dev-access-token')).toBe(true);
    expect(isDevAccessToken('dev-custom')).toBe(true);
    expect(isDevAccessToken(null)).toBe(false);
    expect(isDevAccessToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(false);
  });
});

describe('isDevPaymentAuthEnabled', () => {
  const prevDevAuth = process.env.EXPO_PUBLIC_DEV_AUTH;
  const prevAllowDev = process.env.ALLOW_DEV_PAYMENT;

  afterEach(() => {
    if (prevDevAuth === undefined) delete process.env.EXPO_PUBLIC_DEV_AUTH;
    else process.env.EXPO_PUBLIC_DEV_AUTH = prevDevAuth;
    if (prevAllowDev === undefined) delete process.env.ALLOW_DEV_PAYMENT;
    else process.env.ALLOW_DEV_PAYMENT = prevAllowDev;
  });

  it('respects EXPO_PUBLIC_DEV_AUTH', () => {
    process.env.EXPO_PUBLIC_DEV_AUTH = 'true';
    delete process.env.ALLOW_DEV_PAYMENT;
    expect(isDevPaymentAuthEnabled()).toBe(true);
  });

  it('can be disabled with ALLOW_DEV_PAYMENT=false', () => {
    process.env.EXPO_PUBLIC_DEV_AUTH = 'true';
    process.env.ALLOW_DEV_PAYMENT = 'false';
    expect(isDevPaymentAuthEnabled()).toBe(false);
  });
});
