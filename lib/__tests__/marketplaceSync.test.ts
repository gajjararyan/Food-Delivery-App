import type { ChefApplication } from '../types';
import { resetMarketplaceForTests, addChefApplication, approveChefApplication, listAllMenuItemsForMaker } from '../marketplace/localStore';

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

describe('marketplace sync fail-visible', () => {
  beforeEach(async () => {
    await resetMarketplaceForTests();
    rpcMock.mockReset();
  });

  async function seedApprovedKitchen() {
    const application: ChefApplication = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      full_name: 'Sync Test Chef',
      phone: '+919700000001',
      city: 'Mumbai',
      cuisine_experience: 'Gujarati',
      message: 'Test kitchen',
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    return approveChefApplication(application.id);
  }

  it('createCommunityMenuItem does not report success when remote upsert fails', async () => {
    const { createCommunityMenuItem } = await import('../api/chefs');
    const maker = await seedApprovedKitchen();

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'simulated upsert failure' },
    });

    const beforeCount = (await listAllMenuItemsForMaker(maker.id)).length;
    const result = await createCommunityMenuItem(maker.id, {
      name: 'Should Not Stick',
      base_price: 199,
      enable_customization: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/connection|simulated upsert failure/i);
    }
    const after = await listAllMenuItemsForMaker(maker.id);
    expect(after.length).toBe(beforeCount);
    expect(after.some((item) => item.name === 'Should Not Stick')).toBe(false);
  });

  it('saveMenuItem rolls back local patch when remote upsert fails', async () => {
    const { saveMenuItem } = await import('../api/chefs');
    const maker = await seedApprovedKitchen();
    const item = (await listAllMenuItemsForMaker(maker.id))[0];
    expect(item).toBeTruthy();

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'simulated menu save failure' },
    });

    const result = await saveMenuItem(maker.id, item!.id, { base_price: 999 });
    expect(result.ok).toBe(false);

    const after = (await listAllMenuItemsForMaker(maker.id)).find((row) => row.id === item!.id);
    expect(after?.base_price).toBe(item!.base_price);
  });
});
