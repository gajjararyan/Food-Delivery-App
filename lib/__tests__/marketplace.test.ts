import {
  addChefApplication,
  addMenuItem,
  addThaliComponent,
  approveChefApplication,
  deleteMenuItem,
  deleteThaliComponent,
  getMakerForPhone,
  getMenuItemBundle,
  listAllMenuItemsForMaker,
  listMenuItemsForMaker,
  listThaliComponents,
  resetMarketplaceForTests,
  updateMenuItem,
  updateThaliComponent,
} from '../marketplace/localStore';
import { createDraftFromPreset, draftsToInputs } from '../chef/componentDraft';
import type { ChefApplication } from '../types';

describe('marketplace chef onboarding', () => {
  beforeEach(async () => {
    await resetMarketplaceForTests();
  });

  it('approves application and creates starter menu', async () => {
    const application: ChefApplication = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      full_name: 'Priya Sharma',
      phone: '+919876543210',
      city: 'Mumbai',
      cuisine_experience: 'North Indian, 8 years',
      message: 'Home kitchen near Andheri',
      status: 'new',
      created_at: new Date().toISOString(),
    };

    await addChefApplication(application);
    const maker = await approveChefApplication(application.id);

    expect(maker.kitchen_name).toContain('Priya');
    expect(maker.is_active).toBe(true);

    const linked = await getMakerForPhone('+919876543210');
    expect(linked?.id).toBe(maker.id);

    const menu = await listMenuItemsForMaker(maker.id);
    expect(menu.length).toBe(1);
    expect(menu[0]?.base_price).toBe(149);
  });

  it('supports full menu CRUD for approved kitchen', async () => {
    const application: ChefApplication = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      full_name: 'Ravi Patel',
      phone: '+919111111111',
      city: 'Pune',
      cuisine_experience: 'Gujarati',
      message: 'Home tiffins',
      status: 'new',
      created_at: new Date().toISOString(),
    };

    await addChefApplication(application);
    const maker = await approveChefApplication(application.id);

    const dinner = await addMenuItem(maker.id, {
      name: 'Gujarati dinner thali',
      description: 'Evening comfort meal',
      base_price: 179,
      meal_slot: 'dinner',
    });
    expect(dinner.name).toBe('Gujarati dinner thali');

    const allItems = await listAllMenuItemsForMaker(maker.id);
    expect(allItems.length).toBe(2);

    const updated = await updateMenuItem(maker.id, dinner.id, {
      base_price: 199,
      is_available: false,
    });
    expect(updated.base_price).toBe(199);
    expect(updated.is_available).toBe(false);

    const publicMenu = await listMenuItemsForMaker(maker.id);
    expect(publicMenu.length).toBe(1);
    expect(publicMenu[0]?.id).not.toBe(dinner.id);

    await deleteMenuItem(maker.id, dinner.id);
    expect((await listAllMenuItemsForMaker(maker.id)).length).toBe(1);
  });

  it('lets chef customize thali components and pricing', async () => {
    const application: ChefApplication = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      full_name: 'Meera Shah',
      phone: '+919222222222',
      city: 'Ahmedabad',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };

    await addChefApplication(application);
    const maker = await approveChefApplication(application.id);
    const menu = await listAllMenuItemsForMaker(maker.id);
    const thali = menu[0]!;

    const pickle = await addThaliComponent(maker.id, thali.id, {
      name: 'Homemade pickle',
      component_type: 'addon_toggle',
      included_qty: 0,
      max_qty: 1,
      unit_price_delta: 15,
    });
    expect(pickle.component_type).toBe('addon_toggle');
    expect(pickle.included_qty).toBe(0);
    expect(pickle.name).toBe('Homemade pickle');

    await updateThaliComponent(maker.id, thali.id, pickle.id, { unit_price_delta: 20 });
    await updateMenuItem(maker.id, thali.id, { base_price: 165, has_jain_variant: true });

    const bundle = await getMenuItemBundle(thali.id);
    expect(bundle?.menuItem.base_price).toBe(165);
    expect(bundle?.components.some((c) => c.name === 'Homemade pickle')).toBe(true);
    expect(bundle?.components.find((c) => c.id === pickle.id)?.unit_price_delta).toBe(20);

    await deleteThaliComponent(maker.id, thali.id, pickle.id);
    expect((await listThaliComponents(maker.id, thali.id)).length).toBe(7);
  });

  it('creates menu item with chef-defined components in one step', async () => {
    const application: ChefApplication = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      full_name: 'Kiran Mehta',
      phone: '+919333333333',
      city: 'Surat',
      cuisine_experience: 'Gujarati',
      message: null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    await addChefApplication(application);
    const maker = await approveChefApplication(application.id);

    const components = draftsToInputs([
      createDraftFromPreset('Roti'),
      createDraftFromPreset('Gulab Jamun'),
      createDraftFromPreset('Cheese'),
    ]);

    const item = await addMenuItem(maker.id, {
      name: 'Full Gujarati Thali',
      base_price: 199,
      components,
    });

    const saved = await listThaliComponents(maker.id, item.id);
    expect(saved.some((c) => c.name === 'Gulab Jamun' && c.component_type === 'addon_toggle')).toBe(true);
    expect(saved.some((c) => c.name === 'Cheese' && c.component_type === 'addon_stepper')).toBe(true);
  });
});
