import { buildShortAddress } from '../maps/geocode';

describe('buildShortAddress', () => {
  it('builds a compact road + area line', () => {
    expect(
      buildShortAddress({
        road: 'Linking Road',
        suburb: 'Bandra West',
        city: 'Mumbai',
      }),
    ).toBe('Linking Road, Bandra West, Mumbai');
  });

  it('falls back to display_name segments', () => {
    expect(
      buildShortAddress(
        {},
        'Linking Road, Bandra West, Mumbai, Maharashtra, India',
      ),
    ).toBe('Linking Road, Bandra West, Mumbai');
  });
});
