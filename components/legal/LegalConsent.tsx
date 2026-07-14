import React from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { legalPolicyHref } from '../../constants/legal/routes';
import { colors, spacing, typography } from '../../constants/theme';

type LegalLinkProps = {
  policyId: string;
  label: string;
};

/** Standalone tappable link (use outside of Text). */
export function LegalLink({ policyId, label }: LegalLinkProps) {
  return (
    <Link href={legalPolicyHref(policyId)} asChild>
      <Pressable accessibilityRole="link">
        <Text style={styles.link}>{label}</Text>
      </Pressable>
    </Link>
  );
}

/** Inline link for use inside a parent Text component. */
export function LegalInlineLink({ policyId, label }: LegalLinkProps) {
  const router = useRouter();
  return (
    <Text
      style={styles.link}
      accessibilityRole="link"
      onPress={() => router.push(legalPolicyHref(policyId))}
    >
      {label}
    </Text>
  );
}

type LegalConsentRowProps = {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function LegalConsentRow({ checked, onToggle, children }: LegalConsentRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    ...typography.labelMd,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  content: {
    flex: 1,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tick: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
