import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { legalConfig } from '../../constants/legal';
import type { LegalPolicy } from '../../constants/legal';
import { colors, spacing, typography } from '../../constants/theme';

type PolicyDocumentProps = {
  policy: LegalPolicy;
};

export function PolicyDocument({ policy }: PolicyDocumentProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
      <Text style={styles.title}>{policy.title}</Text>
      <Text style={styles.updated}>Last updated: {legalConfig.effectiveDate}</Text>
      <Text style={styles.summary}>{policy.summary}</Text>

      {policy.sections.map((block, index) => (
        <View key={`${policy.id}-section-${index}`} style={styles.block}>
          {block.heading ? <Text style={styles.heading}>{block.heading}</Text> : null}
          {block.paragraphs.map((paragraph, pIndex) => (
            <Text key={`${policy.id}-p-${index}-${pIndex}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Questions? Contact {legalConfig.supportEmail} or {legalConfig.supportPhone}
        </Text>
        <Text style={styles.footerMeta}>
          {legalConfig.companyName} · {legalConfig.registeredAddress}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.margin,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onBackground,
  },
  updated: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  summary: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  block: {
    gap: spacing.sm,
  },
  heading: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  paragraph: {
    ...typography.bodyMd,
    color: colors.onSurface,
    lineHeight: 24,
  },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.xs,
  },
  footerText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  footerMeta: {
    ...typography.labelSm,
    color: colors.outline,
  },
});
