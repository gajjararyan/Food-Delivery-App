import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LegalInlineLink } from '../../components/legal/LegalConsent';
import { Button, OtpInput } from '../../components/ui';
import { legalConfig } from '../../constants/legal';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { requestAccountDeletion, sendOtp } from '../../lib/api/auth';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const phone = profile?.phone ?? user?.phone ?? '';

  const onSendOtp = async () => {
    if (!phone) {
      setError('No phone number on your account.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await sendOtp(phone.replace(/^\+91/, ''));
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOtpSent(true);
  };

  const onDelete = async () => {
    if (!user || !phone) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP to confirm deletion.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await requestAccountDeletion(phone, otp);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await signOut();
    setDone(true);
    setTimeout(() => router.replace('/(auth)/welcome'), 1500);
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.safe}>
        <Text style={styles.title}>Account deletion requested</Text>
        <Text style={styles.body}>
          Your account has been deactivated. Personal data will be deleted within 30 days per our
          Account Deletion Policy.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <Text style={styles.title}>Delete account</Text>
      <Text style={styles.body}>
        This permanently removes your {legalConfig.appName} profile, preferences, and access to
        order history. Active subscriptions will be cancelled. Some records may be retained as
        described in our{' '}
        <LegalInlineLink policyId="account-deletion" label="Account Deletion Policy" />.
      </Text>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>This cannot be undone</Text>
        <Text style={styles.warningText}>
          Transaction records may be kept in anonymized form for tax and legal compliance.
        </Text>
      </View>

      <Text style={styles.label}>Confirm with OTP sent to {phone || 'your registered number'}</Text>
      {!otpSent ? (
        <Button label="Send OTP" onPress={() => void onSendOtp()} loading={loading} />
      ) : (
        <>
          <OtpInput value={otp} onChange={setOtp} hasError={Boolean(error)} />
          <Button
            label="Delete my account permanently"
            variant="outline"
            loading={loading}
            onPress={() => void onDelete()}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.alt}>
        Prefer email? Write to{' '}
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL(`mailto:${legalConfig.supportEmail}?subject=Account%20Deletion%20Request`)}
        >
          {legalConfig.supportEmail}
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    padding: spacing.margin,
    gap: spacing.base,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  body: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  warning: {
    backgroundColor: colors.errorContainer,
    padding: spacing.base,
    borderRadius: 8,
    gap: spacing.xs,
  },
  warningTitle: {
    ...typography.labelMd,
    color: colors.onErrorContainer,
  },
  warningText: {
    ...typography.bodySm,
    color: colors.onErrorContainer,
  },
  label: { ...typography.labelMd, color: colors.onSurface },
  error: { ...typography.bodySm, color: colors.error },
  alt: { ...typography.bodySm, color: colors.onSurfaceVariant },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});
