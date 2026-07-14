import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/** Keep Discover / kitchen open-close / menus in sync when chefs edit. */
export function useMarketplaceRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Unique name per mount — reusing `marketplace-live` throws if another
    // screen (or Strict Mode remount) already subscribed that channel.
    const channel = supabase
      .channel(`marketplace-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maker_profiles' },
        () => {
          // Open/close + profile photos/name must refresh customer + chef views.
          void queryClient.invalidateQueries({ queryKey: ['makers'] });
          void queryClient.invalidateQueries({ queryKey: ['maker'] });
          void queryClient.invalidateQueries({ queryKey: ['chef-maker'] });
          void queryClient.invalidateQueries({ queryKey: ['profile-maker'] });
          void queryClient.invalidateQueries({ queryKey: ['live-specials'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-kitchens'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['menu'] });
          void queryClient.invalidateQueries({ queryKey: ['live-specials'] });
          void queryClient.invalidateQueries({ queryKey: ['thali'] });
          void queryClient.invalidateQueries({ queryKey: ['chef-menu'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thali_components' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['thali'] });
          void queryClient.invalidateQueries({ queryKey: ['chef-thali-components'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['reviews'] });
          void queryClient.invalidateQueries({ queryKey: ['review'] });
          // submit_review also updates maker rating_avg / rating_count
          void queryClient.invalidateQueries({ queryKey: ['maker'] });
          void queryClient.invalidateQueries({ queryKey: ['makers'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
