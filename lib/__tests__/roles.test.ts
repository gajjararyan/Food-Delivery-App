import { ADMIN_TEST_PHONE_E164, toE164India } from '../phone';
import { getAdminPhones, isAdminPhone, resolveUserAccess } from '../auth/roles';
import { addChefApplication, approveChefApplication, resetMarketplaceForTests } from '../marketplace/localStore';
import { DEV_OTP } from '../devAuth';
import type { ChefApplication } from '../types';

describe('admin phone + OTP defaults', () => {
  it('accepts reserved admin national number', () => {
    expect(toE164India('1234567890')).toEqual({ ok: true, data: ADMIN_TEST_PHONE_E164 });
  });

  it('defaults OTP to 654321 when env unset', () => {
    expect(DEV_OTP).toMatch(/^\d{6}$/);
  });
});

describe('isAdminPhone', () => {
  const original = process.env.EXPO_PUBLIC_ADMIN_PHONES;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_ADMIN_PHONES;
    else process.env.EXPO_PUBLIC_ADMIN_PHONES = original;
  });

  it('uses env override when set', () => {
    process.env.EXPO_PUBLIC_ADMIN_PHONES = '+919999999999';
    expect(getAdminPhones()).toEqual(['+919999999999']);
    expect(isAdminPhone('+919999999999')).toBe(true);
    expect(isAdminPhone(ADMIN_TEST_PHONE_E164)).toBe(false);
  });

  it('falls back to reserved admin phone 1234567890', () => {
    delete process.env.EXPO_PUBLIC_ADMIN_PHONES;
    expect(isAdminPhone(ADMIN_TEST_PHONE_E164)).toBe(true);
    expect(isAdminPhone('+917043156067')).toBe(false);
  });
});

describe('resolveUserAccess', () => {
  beforeEach(async () => {
    await resetMarketplaceForTests();
  });

  it('grants customer role to any signed-in phone', async () => {
    const access = await resolveUserAccess('+919123456789');
    expect(access.isCustomer).toBe(true);
    expect(access.isChef).toBe(false);
    expect(access.isAdmin).toBe(false);
  });

  it('adds chef role when kitchen is approved for phone', async () => {
    const application: ChefApplication = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      full_name: 'Chef Test',
      phone: '+919876543210',
      city: 'Mumbai',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    await approveChefApplication(application.id);

    const access = await resolveUserAccess('+919876543210');
    expect(access.isChef).toBe(true);
    expect(access.makerId).toBeTruthy();
    expect(access.roles).toEqual(['chef']);
    expect(access.isCustomer).toBe(true);
  });

  it('grants admin-only role for reserved admin phone', async () => {
    const access = await resolveUserAccess(ADMIN_TEST_PHONE_E164);
    expect(access.isAdmin).toBe(true);
    expect(access.isCustomer).toBe(false);
    expect(access.isChef).toBe(false);
    expect(access.roles).toEqual(['admin']);
  });

  it('does not grant chef from stale local map when remote says no kitchen', async () => {
    jest.resetModules();
    jest.doMock('../supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
    }));

    const application: ChefApplication = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      full_name: 'Stale Local Chef',
      phone: '+919811122233',
      city: 'Mumbai',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    await approveChefApplication(application.id);

    const { resolveUserAccess: resolveRemote } = await import('../auth/roles');
    const access = await resolveRemote('+919811122233');
    expect(access.isChef).toBe(false);
    expect(access.makerId).toBeNull();
    expect(access.roles).toEqual(['customer']);

    jest.dontMock('../supabase');
    jest.resetModules();
  });
});
