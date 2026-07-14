import type { QueryClient } from '@tanstack/react-query';

/** Refresh customer + chef views after marketplace menu/kitchen edits. */
export function invalidateMarketplaceQueries(queryClient: QueryClient, makerId?: string): void {
  void queryClient.invalidateQueries({ queryKey: ['makers'] });
  void queryClient.invalidateQueries({ queryKey: ['chef-menu'] });
  void queryClient.invalidateQueries({ queryKey: ['chef-maker'] });
  void queryClient.invalidateQueries({ queryKey: ['profile-maker'] });
  void queryClient.invalidateQueries({ queryKey: ['menu'] });
  void queryClient.invalidateQueries({ queryKey: ['maker'] });
  void queryClient.invalidateQueries({ queryKey: ['thali'] });
  void queryClient.invalidateQueries({ queryKey: ['chef-thali-components'] });
  void queryClient.invalidateQueries({ queryKey: ['reviews'] });
  void queryClient.invalidateQueries({ queryKey: ['review'] });
  if (makerId) {
    void queryClient.invalidateQueries({ queryKey: ['menu', makerId] });
    void queryClient.invalidateQueries({ queryKey: ['maker', makerId] });
    void queryClient.invalidateQueries({ queryKey: ['chef-menu', makerId] });
  }
}
