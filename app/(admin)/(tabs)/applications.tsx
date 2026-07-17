import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ApplicationCard } from '../../../components/admin/ApplicationCard';
import { EmptyState, LoadingState } from '../../../components/ui';
import { colors, spacing, typography } from '../../../constants/theme';
import { adminListApplications } from '../../../lib/api/admin';
import {
  acceptApplication,
  declineApplication,
  retryKitchenActivation,
} from '../../../lib/api/chefs';
import { invalidateMarketplaceQueries } from '../../../lib/marketplace/invalidation';

/** Review home-chef applications and publish kitchens to Discover. */
export default function AdminApplicationsScreen() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ['admin-applications'],
    queryFn: async () => {
      const result = await adminListApplications();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 15_000,
  });

  if (applicationsQuery.isLoading) {
    return <LoadingState label="Loading applications…" />;
  }

  const applications = applicationsQuery.data ?? [];
  const pending = applications.filter((a) => a.status === 'new' || a.status === 'reviewing');
  const needsRetry = applications.filter((a) => Boolean(a.activation_error));
  const decided = applications.filter((a) => a.status === 'accepted' || a.status === 'rejected');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-applications-preview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['user-access'] });
    invalidateMarketplaceQueries(queryClient);
  };

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.brand}>GharKaSwad Ops</Text>
      <Text style={styles.title}>Chef applications</Text>
      <Text style={styles.sub}>
        Approve publishes the kitchen on Discover (closed until the chef sets a kitchen map pin).
      </Text>
      <Text style={styles.counts}>
        {pending.length} pending · {needsRetry.length} need retry · {decided.length} decided ·{' '}
        {applications.length} total
      </Text>
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="When cooks apply via Become a home chef, they appear here."
          glyph="📋"
        />
      ) : (
        applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            loading={busyId === application.id}
            onAccept={async () => {
              setBusyId(application.id);
              setActionError(null);
              try {
                const result = await acceptApplication(application.id);
                if (!result.ok) {
                  setActionError(
                    result.error.message ||
                      'Approved, but kitchen activation failed — retry needed',
                  );
                }
                refresh();
              } finally {
                setBusyId(null);
              }
            }}
            onReject={async () => {
              setBusyId(application.id);
              setActionError(null);
              try {
                const result = await declineApplication(application.id);
                if (!result.ok) {
                  setActionError(result.error.message);
                }
                refresh();
              } finally {
                setBusyId(null);
              }
            }}
            onRetryActivation={async () => {
              setBusyId(application.id);
              setActionError(null);
              try {
                const result = await retryKitchenActivation(application.id);
                if (!result.ok) {
                  setActionError(
                    result.error.message ||
                      'Kitchen activation still failing — check connection and retry',
                  );
                }
                refresh();
              } finally {
                setBusyId(null);
              }
            }}
          />
        ))
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
  brand: { ...typography.labelMd, color: colors.primary },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  counts: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  error: { ...typography.bodySm, color: colors.error },
});
