import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getCreditBalance, listCredits } from '../../lib/api/credits';

function formatInr(amount: number): string {
  const n = Math.round(amount * 100) / 100;
  return `₹${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Customer wallet balance + credit ledger (skips, decline refunds, etc.). */
export default function WalletScreen() {
  const { user, status } = useAuth();

  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', user?.id],
    enabled: status === 'signedIn' && Boolean(user?.id),
    queryFn: async () => {
      const result = await getCreditBalance(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const ledgerQuery = useQuery({
    queryKey: ['wallet-ledger', user?.id],
    enabled: status === 'signedIn' && Boolean(user?.id),
    queryFn: async () => {
      const result = await listCredits(user!.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (status !== 'signedIn' || !user) {
    return (
      <EmptyState title="Sign in to view your wallet" description="Credits appear here after skips or refunds." />
    );
  }

  if (balanceQuery.isLoading || ledgerQuery.isLoading) return <LoadingState />;
  if (balanceQuery.isError) {
    return (
      <ErrorState
        message={balanceQuery.error.message}
        onRetry={() => {
          void balanceQuery.refetch();
          void ledgerQuery.refetch();
        }}
      />
    );
  }

  const balance = balanceQuery.data ?? 0;
  const entries = ledgerQuery.data ?? [];

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available credit</Text>
        <Text style={styles.balanceValue}>{formatInr(balance)}</Text>
        <Text style={styles.hint}>Applied automatically at checkout when you have a balance.</Text>
      </Card>

      <Text style={styles.section}>Activity</Text>
      {entries.length === 0 ? (
        <EmptyState
          title="No credits yet"
          description="Skip a meal or get a kitchen-decline refund to see entries here."
        />
      ) : (
        entries.map((row) => (
          <Card key={row.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.reason} numberOfLines={2}>
                {row.reason || 'Wallet credit'}
              </Text>
              {row.created_at ? <Text style={styles.when}>{formatWhen(row.created_at)}</Text> : null}
            </View>
            <Text style={[styles.amount, row.amount < 0 ? styles.debit : styles.credit]}>
              {row.amount >= 0 ? '+' : ''}
              {formatInr(row.amount)}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.margin,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  balanceCard: { gap: spacing.xs },
  balanceLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  balanceValue: { ...typography.headlineLg, color: colors.onBackground },
  hint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  section: {
    ...typography.headlineMd,
    color: colors.onBackground,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowMain: { flex: 1, gap: 2 },
  reason: { ...typography.bodyMd, color: colors.onSurface },
  when: { ...typography.bodySm, color: colors.onSurfaceVariant },
  amount: { ...typography.headlineMd },
  credit: { color: colors.primary },
  debit: { color: colors.error },
});
