import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Subscribe to order row changes so cook + customer UIs stay in sync.
 * Invalidates React Query caches on INSERT/UPDATE/DELETE.
 */
export function useOrdersRealtime(options?: {
  orderId?: string | null;
  makerId?: string | null;
  customerId?: string | null;
}): void {
  const queryClient = useQueryClient();
  const orderId = options?.orderId ?? null;
  const makerId = options?.makerId ?? null;
  const customerId = options?.customerId ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Unique suffix avoids "cannot add callbacks after subscribe" when
    // multiple screens subscribe or React Strict Mode remounts.
    const channel = supabase
      .channel(
        `orders-live-${orderId ?? makerId ?? customerId ?? 'all'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          ...(orderId ? { filter: `id=eq.${orderId}` } : {}),
          ...(makerId && !orderId ? { filter: `maker_id=eq.${makerId}` } : {}),
          ...(customerId && !orderId && !makerId
            ? { filter: `customer_id=eq.${customerId}` }
            : {}),
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          void queryClient.invalidateQueries({ queryKey: ['chef-orders'] });
          void queryClient.invalidateQueries({ queryKey: ['order'] });
          if (orderId) {
            void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
            void queryClient.invalidateQueries({ queryKey: ['delivery-tracking', orderId] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, orderId, makerId, customerId]);
}
