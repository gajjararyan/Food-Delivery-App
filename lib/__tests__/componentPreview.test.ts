import {
  chefComponentPreview,
  customerComponentInlinePreview,
  componentCustomerTitle,
} from '../componentPreview';

describe('componentPreview', () => {
  const plate = {
    component_type: 'included' as const,
    included_qty: 1,
    max_qty: 3,
    unit_price_delta: 20,
    serving_amount: 400,
    serving_unit: 'gm' as const,
  };

  const addon = {
    component_type: 'addon_stepper' as const,
    included_qty: 0,
    max_qty: 2,
    unit_price_delta: 20,
    serving_amount: 500,
    serving_unit: 'ml' as const,
  };

  it('formats chef preview for included dish', () => {
    expect(chefComponentPreview(plate)).toBe('1 × 400gm · +₹20/extra · max 3');
  });

  it('formats chef preview for add-on', () => {
    expect(chefComponentPreview(addon)).toBe('500 ml · ₹20/serving · max 2');
  });

  it('formats customer inline preview for included dish', () => {
    expect(customerComponentInlinePreview(plate)).toBe('1 × 400gm · +₹20/extra');
  });

  it('formats customer title for add-on with serving', () => {
    expect(componentCustomerTitle('Buttermilk', addon)).toBe('Buttermilk (500 ml)');
  });

  it('keeps plain name for included dish title', () => {
    expect(componentCustomerTitle('Rice', plate)).toBe('Rice');
  });
});
