import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { legalPolicyHref } from '../../constants/legal/routes';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { accountRegisteredForPhone, sendOtp } from '../../lib/api/auth';
import { isAdminPhone } from '../../lib/auth/roles';
import { toE164India } from '../../lib/phone';

/** Returning users — phone number only, then OTP. */
export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; phone?: string; registered?: string }>();
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const phoneParam = typeof params.phone === 'string' ? params.phone.replace(/^\+91/, '') : '';
  const justRegistered = params.registered === '1';
  const [phone, setPhone] = useState(phoneParam);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    setInlineError(null);
    setLoading(true);

    const normalized = toE164India(phone);
    if (!normalized.ok) {
      setLoading(false);
      setInlineError(normalized.error.message);
      return;
    }

    // Admin signs in with phone + OTP only (no customer signup).
    if (!isAdminPhone(normalized.data)) {
      const registered = await accountRegisteredForPhone(phone);
      if (!registered.ok) {
        setLoading(false);
        setInlineError(registered.error.message);
        return;
      }
      if (!registered.data) {
        setLoading(false);
        setInlineError('No account found with this number. Please sign up first.');
        return;
      }
    }

    const result = await sendOtp(phone);
    setLoading(false);

    if (!result.ok) {
      setInlineError(result.error.message);
      return;
    }

    router.push({
      pathname: '/(auth)/verify',
      params: {
        phone: result.data.phone,
        mode: 'signin',
        ...(returnTo ? { returnTo } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <StitchHero source={stitchImages.loginHero} aspectRatio={16 / 9} style={styles.hero} />
        <View style={styles.content}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.sub}>
            Enter your phone number. We&apos;ll send a one-time password to sign you in.
          </Text>
          {justRegistered ? (
            <Text style={styles.success}>
              Account created. Sign in with your phone and OTP to continue.
            </Text>
          ) : null}

          <Text style={styles.label}>Phone number</Text>
          <View style={[styles.phoneRow, inlineError ? styles.phoneRowError : null]}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneField}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              placeholderTextColor={colors.outline}
              value={phone}
              onChangeText={(t) => {
                setPhone(t.replace(/[^\d\s]/g, '').slice(0, 12));
                if (inlineError) setInlineError(null);
              }}
              maxLength={12}
              accessibilityLabel="Phone number"
            />
          </View>
          {inlineError ? <Text style={styles.error}>{inlineError}</Text> : null}

          <Button label="Send OTP" onPress={onContinue} size="lg" loading={loading} />
          <Text style={styles.hint}>
            By continuing you agree to our{' '}
            <Link href={legalPolicyHref('terms')}>
              <Text style={styles.legalLink}>Terms</Text>
            </Link>
            {' and '}
            <Link href={legalPolicyHref('privacy')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Link>
            .
          </Text>

          <Link href="/(auth)/signup" style={styles.switchLink}>
            <Text style={styles.switchText}>New here? Create an account</Text>
          </Link>

          <Link href="/(auth)/welcome" style={styles.back}>
            <Text style={styles.backText}>Back</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.margin,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    marginTop: spacing.sm,
  },
  content: {
    gap: spacing.sm,
  },
  title: {
    ...typography.headlineLg,
    color: colors.onBackground,
  },
  sub: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  success: {
    ...typography.bodySm,
    color: colors.tertiary,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  phoneRowError: {
    borderColor: colors.error,
  },
  prefix: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.surfaceContainer,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.outlineVariant,
  },
  prefixText: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  phoneField: {
    ...typography.bodyLg,
    flex: 1,
    color: colors.onSurface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    letterSpacing: 2,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
  },
  hint: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  switchLink: {
    alignSelf: 'center',
    padding: spacing.xs,
  },
  switchText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  back: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
  backText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  legalLink: {
    ...typography.bodySm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
