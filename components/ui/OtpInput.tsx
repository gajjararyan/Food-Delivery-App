import React, { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  hasError?: boolean;
};

/** 6-box OTP grid matching Stitch Login & OTP Verification. */
export function OtpInput({ length = 6, value, onChange, hasError }: OtpInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const setAt = (index: number, char: string) => {
    const next = digits.map((d, i) => (i === index ? char : d === ' ' ? '' : d));
    const joined = next.join('').replace(/\s/g, '').slice(0, length);
    onChange(joined);
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
      setAt(index - 1, '');
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) => (
        <Pressable
          key={`otp-${index}`}
          onPress={() => refs.current[index]?.focus()}
          style={[styles.box, hasError && styles.boxError]}
        >
          <TextInput
            ref={(node) => {
              refs.current[index] = node;
            }}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={1}
            value={digits[index]?.trim() ? digits[index] : ''}
            onChangeText={(text) => {
              const char = text.replace(/\D/g, '').slice(-1);
              setAt(index, char);
              if (char && index < length - 1) {
                refs.current[index + 1]?.focus();
              }
            }}
            onKeyPress={(e) => onKeyPress(index, e.nativeEvent.key)}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            accessibilityLabel={`OTP digit ${index + 1}`}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxError: {
    borderColor: colors.error,
  },
  input: {
    ...typography.headlineMd,
    width: '100%',
    textAlign: 'center',
    color: colors.onSurface,
    padding: 0,
  },
});
