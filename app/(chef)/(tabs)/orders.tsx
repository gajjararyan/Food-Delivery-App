import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChefOrderCard } from '../../../components/chef/ChefOrderCard';
import { EmptyState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdersRealtime } from '../../../hooks/useOrdersRealtime';
import { fetchMakerForCurrentPhone } from '../../../lib/api/chefs';
import {
  acceptMakerOrder,
  advanceMakerOrderStatus,
  listOrdersForMaker,
  rejectMakerOrder,
} from '../../../lib/api/orders';
import type { Uuid } from '../../../lib/types';

/** Incoming orders — accept → prepare → hand off → delivered. */
export default function ChefOrdersScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<Uuid | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const makerQuery = useQuery({
    queryKey: ['chef-maker', user?.phone],
    enabled: Boolean(user?.phone),
    queryFn: async () => {
      const result = await fetchMakerForCurrentPhone(user!.phone!);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  useOrdersRealtime({ makerId: makerQuery.data?.id });

  const ordersQuery = useQuery({
    queryKey: ['chef-orders', makerQuery.data?.id],
    enabled: Boolean(makerQuery.data?.id),
    queryFn: async () => {
      const result = await listOrdersForMaker(makerQuery.data!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['chef-orders'] });
  };

  if (makerQuery.isLoading || ordersQuery.isLoading) {
    return <LoadingState label="Loading orders…" />;
  }

  const maker = makerQuery.data;
  if (!maker) {
    return (
      <EmptyState
        title="No kitchen linked"
        description="Approved chefs see customer orders here."
        glyph="📦"
      />
    );
  }

  const orders = ordersQuery.data ?? [];
  const pending = orders.filter((o) => o.status === 'placed');
  const active = orders.filter(
    (o) =>
      o.status === 'accepted' ||
      o.status === 'cooking' ||
      o.status === 'out_for_delivery',
  );
  const done = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'payment_failed',
  );

  const run = async (
    orderId: Uuid,
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) => {
    setBusyId(orderId);
    setActionError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error?.message ?? 'Could not update order');
        return;
      }
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.title}>Incoming orders</Text>
      <Text style={styles.sub}>
        Accept new orders, prepare the meal, then mark ready for pickup (takeaway) or hand off for
        delivery. For takeaway, confirm the customer PIN before completing. Declining a paid order
        credits the customer wallet.
      </Text>
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When customers order your thali, they appear here for you to accept."
          glyph="🍱"
        />
      ) : (
        <>
          {pending.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Needs your acceptance ({pending.length})</Text>
              {pending.map((order) => (
                <ChefOrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAccept={() =>
                    run(order.id, () => acceptMakerOrder(order.id, maker.id))
                  }
                  onReject={() =>
                    run(order.id, () => rejectMakerOrder(order.id, maker.id))
                  }
                />
              ))}
            </View>
          ) : null}

          {active.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>In progress ({active.length})</Text>
              {active.map((order) => (
                <ChefOrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAdvance={(opts) =>
                    run(order.id, () =>
                      advanceMakerOrderStatus(order.id, maker.id, opts),
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          {done.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Completed ({done.length})</Text>
              {done.map((order) => (
                <ChefOrderCard key={order.id} order={order} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  error: { ...typography.bodySm, color: colors.error, marginBottom: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.labelMd, color: colors.onSurface },
});
