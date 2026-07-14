import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import type { ChefApplication } from '../../lib/types';
import { formatDisplayPhone } from '../../lib/api/auth';
import {
  applicationStatusLabel,
  applicationUiState,
} from '../../lib/marketplace/applicationUiState';

type Props = {
  application: ChefApplication;
  onAccept: () => void;
  onReject: () => void;
  onRetryActivation?: () => void;
  loading?: boolean;
};

export function ApplicationCard({
  application,
  onAccept,
  onReject,
  onRetryActivation,
  loading,
}: Props) {
  const uiState = applicationUiState(application);
  const statusTone =
    uiState === 'needs_retry'
      ? 'error'
      : uiState === 'accepted'
        ? 'success'
        : uiState === 'rejected'
          ? 'error'
          : 'neutral';

  const canDecide = application.status === 'new' || application.status === 'reviewing';
  const needsRetry = uiState === 'needs_retry';

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{application.full_name}</Text>
        <Badge label={applicationStatusLabel(uiState)} tone={statusTone} />
      </View>
      <Text style={styles.meta}>
        {formatDisplayPhone(application.phone)} · {application.city}
      </Text>
      <Text style={styles.body}>{application.cuisine_experience}</Text>
      {application.message ? <Text style={styles.message}>{application.message}</Text> : null}

      {needsRetry ? (
        <View style={styles.retryBox}>
          <Text style={styles.retryTitle}>Approved, but kitchen activation failed — retry needed</Text>
          <Text style={styles.retryBody}>
            {application.activation_error ??
              "The kitchen was not published to Discover. Retry when you're back online."}
          </Text>
          {onRetryActivation ? (
            <Text
              style={[styles.action, styles.retryAction, loading && styles.disabled]}
              onPress={loading ? undefined : onRetryActivation}
            >
              Retry kitchen activation
            </Text>
          ) : null}
        </View>
      ) : null}

      {canDecide && !needsRetry ? (
        <View style={styles.actions}>
          <Text
            style={[styles.action, styles.reject, loading && styles.disabled]}
            onPress={loading ? undefined : onReject}
          >
            Decline
          </Text>
          <Text
            style={[styles.action, styles.accept, loading && styles.disabled]}
            onPress={loading ? undefined : onAccept}
          >
            Approve kitchen
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { ...typography.headlineSm, color: colors.onSurface, flex: 1 },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  body: { ...typography.bodyMd, color: colors.onSurface },
  message: { ...typography.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  action: { ...typography.labelMd },
  accept: { color: colors.primary },
  reject: { color: colors.error },
  retryAction: { color: colors.primary, marginTop: spacing.xs },
  disabled: { opacity: 0.5 },
  retryBox: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.errorContainer ?? '#fdecea',
  },
  retryTitle: { ...typography.labelMd, color: colors.error },
  retryBody: { ...typography.bodySm, color: colors.onSurface },
});
