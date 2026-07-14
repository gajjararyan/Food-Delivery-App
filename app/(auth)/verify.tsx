import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button, OtpInput, StitchIcon } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { colors, spacing, typography } from '../../constants/theme';
import { applySignupProfile, formatDisplayPhone, sendOtp, verifyOtp } from '../../lib/api/auth';
import { isAdminPhone } from '../../lib/auth/roles';
import { useAuth } from '../../hooks/useAuth';

const RESEND_SECONDS = 30;

/**
 * OTP verification — signup saves account then asks to sign in;
 * sign-in opens the app (admin → admin panel, others → home).
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { setSessionLocal, signOut } = useAuth();
  const params = useLocalSearchParams<{
    phone?: string;
    fullName?: string;
    email?: string;
    returnTo?: string;
    mode?: string;
  }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const fullName = typeof params.fullName === 'string' ? params.fullName : '';
  const email = typeof params.email === 'string' ? params.email : '';
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const isSignup = params.mode === 'signup' || Boolean(fullName && email);
  const signup = isSignup && fullName && email ? ({ fullName, email } as const) : undefined;

  const [code, setCode] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (!phone) {
      router.replace('/(auth)/login');
    }
  }, [phone, router]);

  const onVerify = async () => {
    setInlineError(null);
    if (code.replace(/\D/g, '').length !== 6) {
      setInlineError('Enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    const result = await verifyOtp(phone, code, signup);
    setLoading(false);

    if (!result.ok) {
      setInlineError(result.error.message);
      setCode('');
      return;
    }

    // Sign-up: create customer profile, then require a separate sign-in.
    if (signup) {
      await applySignupProfile(result.data.user.id, phone, signup);
      await signOut();
      router.replace({
        pathname: '/(auth)/login',
        params: {
          phone: phone.replace(/^\+91/, ''),
          registered: '1',
          ...(returnTo ? { returnTo } : {}),
        },
      });
      return;
    }

    setSessionLocal(result.data.session);

    if (isAdminPhone(phone)) {
      router.replace('/(admin)/' as Href);
      return;
    }
    if (returnTo?.includes('checkout')) {
      router.replace('/(customer)/checkout');
      return;
    }
    router.replace('/(customer)/(tabs)/home');
  };

  const onResend = async () => {
    if (secondsLeft > 0) return;
    setInlineError(null);
    setLoading(true);
    const result = await sendOtp(phone);
    setLoading(false);
    if (!result.ok) {
      setInlineError(result.error.message);
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
    setCode('');
  };

  const timerLabel =
    secondsLeft > 0
      ? `Resend in 00:${String(secondsLeft).padStart(2, '0')}`
      : 'Resend OTP';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <StitchHero source={stitchImages.loginHero} aspectRatio={16 / 9} style={styles.hero} />
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back to phone">
            <StitchIcon name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.title}>{isSignup ? 'Verify & create account' : 'Verify OTP'}</Text>
          <Text style={styles.sub}>
            Enter the 6-digit code sent to{' '}
            <Text style={styles.phoneHighlight}>
              {phone ? formatDisplayPhone(phone) : 'your phone'}
            </Text>
          </Text>

          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (inlineError) setInlineError(null);
            }}
            hasError={Boolean(inlineError)}
          />
          {inlineError ? <Text style={styles.error}>{inlineError}</Text> : null}

          <Button
            label={isSignup ? 'Create account' : 'Verify & sign in'}
            onPress={onVerify}
            size="lg"
            loading={loading}
            style={styles.verify}
          />

          <Pressable onPress={onResend} disabled={secondsLeft > 0 || loading}>
            <Text style={[styles.resend, secondsLeft > 0 && styles.resendDisabled]}>
              {timerLabel}
            </Text>
          </Pressable>
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
  scroll: { paddingBottom: spacing.xl },
  hero: { marginBottom: spacing.base },
  content: {
    paddingHorizontal: spacing.margin,
    gap: spacing.base,
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
  phoneHighlight: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
  },
  verify: {
    marginTop: spacing.sm,
  },
  resend: {
    ...typography.labelMd,
    color: colors.primary,
    textAlign: 'center',
    padding: spacing.sm,
  },
  resendDisabled: {
    opacity: 0.5,
  },
});
