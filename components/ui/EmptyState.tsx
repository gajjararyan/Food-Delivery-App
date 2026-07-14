import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { Button } from './Button';

export type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional emoji/icon glyph — Stitch Empty States Gallery uses soft illustrations */
  glyph?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  glyph = '🍽️',
}: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.glyph}>{glyph}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  glyph: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.base,
    minWidth: 180,
  },
});
