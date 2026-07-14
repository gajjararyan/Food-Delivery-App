import {
  applicationStatusLabel,
  applicationUiState,
} from '../marketplace/applicationUiState';
import type { ChefApplication } from '../types';
import {
  addChefApplication,
  approveChefApplication,
  attachActivationErrors,
  getApplicationActivationError,
  resetMarketplaceForTests,
} from '../marketplace/localStore';

const rpcMock = jest.fn();

jest.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: jest.fn(),
  },
}));

jest.mock('../images/uploadKitchenImage', () => ({
  persistImageUrl: async (url: string | null | undefined) => ({
    ok: true as const,
    data: url ?? null,
  }),
}));

describe('applicationUiState', () => {
  const base = (): ChefApplication => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    full_name: 'Priya',
    phone: '+919800000001',
    city: 'Mumbai',
    cuisine_experience: 'Gujarati',
    message: null,
    status: 'accepted',
    created_at: new Date().toISOString(),
  });

  it('marks accepted + activation_error as needs_retry, not fully accepted', () => {
    const state = applicationUiState({
      ...base(),
      activation_error: 'Could not sync kitchen',
    });
    expect(state).toBe('needs_retry');
    expect(applicationStatusLabel(state)).toBe('Needs retry');
  });

  it('marks clean accepted as accepted', () => {
    expect(applicationUiState(base())).toBe('accepted');
  });
});

describe('acceptApplication partial failure visibility', () => {
  beforeEach(async () => {
    await resetMarketplaceForTests();
    rpcMock.mockReset();
  });

  it('stores activation_error so admin UI state is needs_retry, not fully accepted', async () => {
    const application: ChefApplication = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      full_name: 'Retry Chef',
      phone: '+919800000099',
      city: 'Pune',
      cuisine_experience: 'Maharashtrian',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'simulated maker upsert failure' },
    });

    const { acceptApplication } = await import('../api/chefs');
    const result = await acceptApplication(application.id);
    expect(result.ok).toBe(false);

    const activationError = await getApplicationActivationError(application.id);
    expect(activationError).toMatch(/simulated maker upsert failure/i);

    const [enriched] = await attachActivationErrors([
      { ...application, status: 'accepted' },
    ]);
    expect(applicationUiState(enriched!)).toBe('needs_retry');
  });

  it('retryKitchenActivation clears activation_error after successful publish', async () => {
    const application: ChefApplication = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      full_name: 'Retry Success',
      phone: '+919800000088',
      city: 'Pune',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    await approveChefApplication(application.id);

    // First call fails (leave activation error), then retry succeeds.
    const { setApplicationActivationError } = await import('../marketplace/localStore');
    await setApplicationActivationError(application.id, 'previous failure');

    rpcMock.mockResolvedValue({ data: true, error: null });

    const { retryKitchenActivation } = await import('../api/chefs');
    const result = await retryKitchenActivation(application.id);
    expect(result.ok).toBe(true);
    expect(await getApplicationActivationError(application.id)).toBeNull();
  });
});
