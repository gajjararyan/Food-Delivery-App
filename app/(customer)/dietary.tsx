import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile } from '../../lib/api/auth';

/**
 * Stitch: Dietary Preferences (8ab43f64bbaa4e198f9924fbe1151eaf)
 * Jain toggle persisted on profile; applied at order-build via jain.ts.
 */
export default function DietaryScreen() {
  const router = useRouter();
  const { status, user, profile, refreshProfile } = useAuth();
  const [jainOverride, setJainOverride] = useState<boolean | null>(null);
  const jain = jainOverride ?? Boolean(profile?.jain_preference);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'signedIn' || !user) {
    return (
      <EmptyState
        title="Sign in to save preferences"
        actionLabel="Sign in"
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await updateProfile(user.id, { jain_preference: jain });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await refreshProfile();
    setJainOverride(null);
    setMessage('Preferences saved');
  };

  return (
    <View style={styles.safe}>
      <Text style={styles.title}>Dietary preferences</Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: jain }}
        onPress={() => setJainOverride(!jain)}
        style={styles.row}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Jain preference</Text>
          <Text style={styles.hint}>Applied globally to every thali at order time.</Text>
        </View>
        <View style={[styles.switch, jain && styles.switchOn]}>
          <View style={[styles.knob, jain && styles.knobOn]} />
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button label="Save" loading={saving} onPress={() => void onSave()} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.lg,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.base,
    borderRadius: radius.lg,
  },
  label: { ...typography.bodyMd, color: colors.onSurface },
  hint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  switch: {
    width: 52,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.primary },
  knob: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  knobOn: { alignSelf: 'flex-end' },
  error: { ...typography.bodySm, color: colors.error },
  ok: { ...typography.bodySm, color: colors.success },
});
