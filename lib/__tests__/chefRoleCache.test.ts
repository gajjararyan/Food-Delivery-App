import {
  CHEF_ROLE_CACHE_TTL_MS,
  isChefRoleVerificationFresh,
  makerIdFromFreshChefCache,
  type ChefRoleVerification,
} from '../auth/chefRoleCache';

describe('chef role cache TTL', () => {
  const verification: ChefRoleVerification = {
    makerId: '11111111-1111-4111-8111-111111111111',
    verifiedAt: Date.now() - 60_000,
  };

  it('grants from cache when verification is within 24h (availability)', () => {
    const now = verification.verifiedAt + 12 * 60 * 60 * 1000;
    expect(isChefRoleVerificationFresh(verification, now)).toBe(true);
    expect(makerIdFromFreshChefCache(verification, now)).toBe(verification.makerId);
  });

  it('does NOT grant from cache when verification is older than 24h', () => {
    const now = verification.verifiedAt + CHEF_ROLE_CACHE_TTL_MS + 1;
    expect(isChefRoleVerificationFresh(verification, now)).toBe(false);
    expect(makerIdFromFreshChefCache(verification, now)).toBeNull();
  });

  it('does not grant when there is no cached verification', () => {
    expect(makerIdFromFreshChefCache(null)).toBeNull();
  });
});
