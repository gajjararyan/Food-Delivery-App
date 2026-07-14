import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../constants/theme';

export type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ padded = true, elevated = false, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && shadow.soft,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  padded: {
    padding: spacing.base,
  },
});
