import { StyleSheet, Text, View } from 'react-native';
import { StitchIcon } from '../ui/StitchIcon';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type CheckoutPhase =
  | 'idle'
  | 'preparing'
  | 'gateway'
  | 'verifying'
  | 'success'
  | 'error';

const PHASES: { key: CheckoutPhase; label: string }[] = [
  { key: 'preparing', label: 'Order' },
  { key: 'gateway', label: 'Pay' },
  { key: 'verifying', label: 'Verify' },
  { key: 'success', label: 'Done' },
];

function phaseIndex(phase: CheckoutPhase): number {
  switch (phase) {
    case 'preparing':
      return 0;
    case 'gateway':
      return 1;
    case 'verifying':
      return 2;
    case 'success':
      return 3;
    default:
      return -1;
  }
}

type Props = {
  phase: CheckoutPhase;
  message?: string | null;
};

export function CheckoutProgress({ phase, message }: Props) {
  const active = phaseIndex(phase);

  if (phase === 'idle') return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.steps}>
        {PHASES.map((step, index) => {
          const done = active > index;
          const current = active === index;
          return (
            <View key={step.key} style={styles.step}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  current && styles.dotActive,
                ]}
              >
                {done ? (
                  <StitchIcon name="verified" size={14} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.dotText, current && styles.dotTextActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>
                {step.label}
              </Text>
              {index < PHASES.length - 1 ? (
                <View style={[styles.connector, done && styles.connectorDone]} />
              ) : null}
            </View>
          );
        })}
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  dotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  dotDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dotText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  dotTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  connector: {
    position: 'absolute',
    top: 14,
    left: '55%',
    right: '-45%',
    height: 2,
    backgroundColor: colors.outlineVariant,
    zIndex: -1,
  },
  connectorDone: {
    backgroundColor: colors.primary,
  },
  message: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
