import { Link, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LegalConsentRow, LegalInlineLink } from '../../components/legal/LegalConsent';
import { StitchHero } from '../../components/customer/StitchHero';
import { Button, Input } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { colors, spacing, typography } from '../../constants/theme';
import { useRoles } from '../../hooks/useRoles';
import {
  fetchChefApplicationForPhone,
  submitChefApplication,
} from '../../lib/api/chefs';
import { AnalyticsEvents, trackEvent } from '../../lib/analytics';

/** Stitch: Become a Home Chef — lead capture → admin approval → live kitchen. */
export default function BecomeChefScreen() {
  const router = useRouter();
  const { isAdmin } = useRoles();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [acceptedMakerTerms, setAcceptedMakerTerms] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['chef-application', submittedPhone],
    enabled: done && Boolean(submittedPhone),
    queryFn: async () => {
      const result = await fetchChefApplicationForPhone(submittedPhone);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: done ? 5000 : false,
  });

  const onSubmit = async () => {
    if (!acceptedMakerTerms) {
      setError('Please accept the Maker Partner Terms and FSSAI disclaimer.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await submitChefApplication({
      fullName,
      phone,
      city,
      cuisineExperience: cuisine,
      message,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    trackEvent(AnalyticsEvents.chefApply, { city });
    setSubmittedPhone(phone);
    setDone(true);
  };

  if (done) {
    const application = statusQuery.data;
    const needsRetry = Boolean(application?.activation_error);
    const accepted = application?.status === 'accepted' && !needsRetry;

    return (
      <ScrollView contentContainerStyle={styles.safe}>
        <StitchHero source={stitchImages.kitchenHero} aspectRatio={16 / 9} rounded={16} />
        <Text style={styles.title}>
          {needsRetry
            ? 'Approved — kitchen not live yet'
            : accepted
              ? 'Kitchen approved!'
              : 'Application received'}
        </Text>
        <Text style={styles.hint}>
          {needsRetry
            ? 'Ops approved your application, but kitchen activation did not finish. We will retry publishing your kitchen — it is not on Discover yet.'
            : accepted
              ? 'Your kitchen is live on Discover. Sign in with the same phone to manage orders and menu.'
              : "We'll review your kitchen details. In dev mode, open Admin to approve instantly."}
        </Text>
        {application ? (
          <Text style={styles.status}>
            Status: {needsRetry ? 'needs retry' : application.status}
          </Text>
        ) : null}
        {needsRetry && application?.activation_error ? (
          <Text style={styles.error}>{application.activation_error}</Text>
        ) : null}
        {isAdmin ? (
          <Link href={'/(admin)/(tabs)/applications' as Href}>
            <Text style={styles.link}>Open admin review</Text>
          </Link>
        ) : null}
        {accepted ? (
          <Button
            label="Open chef dashboard"
            onPress={() => router.push('/(chef)/(tabs)/' as Href)}
          />
        ) : (
          <Button label="Back to profile" variant="outline" onPress={() => router.back()} />
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.safe}>
      <StitchHero source={stitchImages.naniPortrait} aspectRatio={16 / 10} rounded={16} />
      <Text style={styles.title}>Become a home chef</Text>
      <Text style={styles.intro}>
        Share your home cooking with neighbors. After approval, your customizable thali goes live on
        Discover.
      </Text>
      <Input label="Full name" placeholder="Your name" value={fullName} onChangeText={setFullName} />
      <Input
        label="Phone"
        keyboardType="phone-pad"
        placeholder="98765 43210"
        value={phone}
        onChangeText={setPhone}
      />
      <Input label="City" placeholder="Mumbai" value={city} onChangeText={setCity} />
      <Input
        label="Cuisine experience"
        placeholder="Gujarati thalis for 10 years…"
        value={cuisine}
        onChangeText={setCuisine}
      />
      <Input
        label="Message (optional)"
        placeholder="Tell us about your kitchen"
        value={message}
        onChangeText={setMessage}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LegalConsentRow
        checked={acceptedMakerTerms}
        onToggle={() => setAcceptedMakerTerms((v) => !v)}
      >
        <Text style={styles.consent}>
          I have read and agree to the{' '}
          <LegalInlineLink policyId="maker-terms" label="Maker Partner Terms" /> and{' '}
          <LegalInlineLink policyId="fssai-disclaimer" label="Food Safety & FSSAI Disclaimer" />.
          I confirm I hold or will obtain valid FSSAI registration before cooking for customers.
        </Text>
      </LegalConsentRow>
      <Button
        label="Submit application"
        loading={loading}
        disabled={!acceptedMakerTerms}
        onPress={() => void onSubmit()}
      />
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
  intro: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  hint: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  status: { ...typography.labelMd, color: colors.primary },
  link: { ...typography.labelMd, color: colors.primary, marginVertical: spacing.sm },
  consent: { ...typography.bodySm, color: colors.onSurface, lineHeight: 20 },
  error: { ...typography.bodySm, color: colors.error },
});
