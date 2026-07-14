import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../../components/ui';
import { getPoliciesByCategory, legalConfig } from '../../../constants/legal';
import { legalPolicyHref } from '../../../constants/legal/routes';
import { colors, spacing, typography } from '../../../constants/theme';

function PolicyLink({ id, title, summary }: { id: string; title: string; summary: string }) {
  return (
    <Link href={legalPolicyHref(id)} asChild>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSummary}>{summary}</Text>
      </Card>
    </Link>
  );
}

export default function LegalHubScreen() {
  const primary = getPoliciesByCategory('primary');
  const maker = getPoliciesByCategory('maker');
  const placeholders = getPoliciesByCategory('placeholder');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Legal documents for {legalConfig.appName}. All policies are available in-app — no website
          required.
        </Text>

        <Text style={styles.sectionLabel}>Customer policies</Text>
        {primary.map((policy) => (
          <PolicyLink key={policy.id} id={policy.id} title={policy.title} summary={policy.summary} />
        ))}

        <Text style={styles.sectionLabel}>Maker & fulfillment</Text>
        {maker.map((policy) => (
          <PolicyLink key={policy.id} id={policy.id} title={policy.title} summary={policy.summary} />
        ))}

        <Text style={styles.sectionLabel}>Not yet applicable</Text>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderHint}>
            These features are not built yet. Placeholder notes only.
          </Text>
          {placeholders.map((policy) => (
            <PolicyLink key={policy.id} id={policy.id} title={policy.title} summary={policy.summary} />
          ))}
        </View>

        <Card style={styles.contactCard}>
          <Text style={styles.cardTitle}>Contact & grievances</Text>
          <Text style={styles.contactLine}>Email: {legalConfig.supportEmail}</Text>
          <Text style={styles.contactLine}>Phone: {legalConfig.supportPhone}</Text>
          <Text style={styles.contactLine}>
            Grievance Officer: {legalConfig.grievanceOfficerName}
          </Text>
          <Text style={styles.contactMeta}>{legalConfig.supportHours}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.margin,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  lead: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyMd,
    color: colors.onSurface,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  cardSummary: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  placeholderBox: {
    gap: spacing.sm,
  },
  placeholderHint: {
    ...typography.bodySm,
    color: colors.outline,
    fontStyle: 'italic',
  },
  contactCard: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  contactLine: {
    ...typography.bodySm,
    color: colors.onSurface,
  },
  contactMeta: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
});
