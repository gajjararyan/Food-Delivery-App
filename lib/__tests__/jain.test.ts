import { applyJainSubstitution } from '../jain';

const COMPONENTS = [
  {
    id: 'sabzi',
    name: 'Aloo mutter',
    has_jain_variant: true,
    jain_substitute: 'Mixed veg (no root)',
  },
  {
    id: 'roti',
    name: 'Roti',
    has_jain_variant: false,
    jain_substitute: null,
  },
];

describe('applyJainSubstitution', () => {
  it('leaves names unchanged when Jain is off', () => {
    const result = applyJainSubstitution(COMPONENTS, false);
    expect(result[0]?.name).toBe('Aloo mutter');
  });

  it('swaps names when Jain is on', () => {
    const result = applyJainSubstitution(COMPONENTS, true);
    expect(result[0]?.name).toBe('Mixed veg (no root)');
    expect(result[1]?.name).toBe('Roti');
  });
});
