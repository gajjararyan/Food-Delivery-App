import {
  addChefApplication,
  approveChefApplication,
  listActiveMakers,
  resetMarketplaceForTests,
  updateMakerProfile,
} from '../marketplace/localStore';
import {
  isKitchenAcceptingOrders,
  isKitchenDiscoverable,
  isKitchenOpen,
  sortMakersForDiscover,
} from '../marketplace/kitchenStatus';
import type { ChefApplication, MakerProfile } from '../types';

describe('kitchenStatus', () => {
  it('defaults to open when is_open is unset', () => {
    expect(isKitchenOpen({ is_open: undefined })).toBe(true);
    expect(isKitchenOpen({})).toBe(true);
  });

  it('keeps closed kitchens discoverable but not accepting orders', () => {
    expect(isKitchenOpen({ is_open: false })).toBe(false);
    expect(isKitchenDiscoverable({ is_active: true })).toBe(true);
    expect(isKitchenAcceptingOrders({ is_active: true, is_open: false })).toBe(false);
  });

  it('sorts open kitchens ahead of closed ones', () => {
    const makers = [
      { id: 'closed', is_open: false, rating_avg: 5, is_active: true },
      { id: 'open', is_open: true, rating_avg: 4, is_active: true },
    ] as MakerProfile[];
    expect(sortMakersForDiscover(makers).map((m) => m.id)).toEqual(['open', 'closed']);
  });
});

describe('listActiveMakers with kitchen open state', () => {
  beforeEach(async () => {
    await resetMarketplaceForTests();
  });

  it('still lists kitchens that are paused by the chef (greyed on Discover)', async () => {
    const application: ChefApplication = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      full_name: 'Paused Chef',
      phone: '+919876543210',
      city: 'Mumbai',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    const maker = await approveChefApplication(application.id);
    await updateMakerProfile(maker.id, { is_open: false });

    const active = await listActiveMakers();
    const listed = active.find((m) => m.id === maker.id);
    expect(listed).toBeTruthy();
    expect(isKitchenOpen(listed!)).toBe(false);
    expect(isKitchenAcceptingOrders(listed!)).toBe(false);
  });
});
