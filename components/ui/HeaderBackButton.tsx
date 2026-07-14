import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';
import { StitchIcon } from './StitchIcon';

type HeaderBackButtonProps = {
  /** Fallback when there is no history (e.g. deep link). */
  fallbackHref?: string;
};

/** Left-arrow back control for stack headers (reliable on web + native). */
export function HeaderBackButton({
  fallbackHref = '/(customer)/(tabs)/home',
}: HeaderBackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(fallbackHref as never);
      }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      style={styles.hit}
    >
      <StitchIcon name="arrow-back" size={24} color={colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginRight: 4,
  },
});
