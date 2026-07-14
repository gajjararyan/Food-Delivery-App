import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../constants/theme';

export type StitchHeroProps = {
  source: ImageSourcePropType;
  /** Aspect ratio width/height — Stitch welcome uses 4/3, login uses 16/9 */
  aspectRatio?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
  fade?: boolean;
};

/** Full-bleed Stitch hero image with optional bottom fade. */
export function StitchHero({
  source,
  aspectRatio = 16 / 9,
  rounded = radius.xxl,
  style,
  fade = true,
}: StitchHeroProps) {
  return (
    <View style={[styles.wrap, { aspectRatio, borderRadius: rounded }, style]}>
      <Image source={source} style={styles.image} resizeMode="cover" accessibilityRole="image" />
      {fade ? <View style={styles.fade} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  image: { width: '100%', height: '100%' },
  fade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,248,245,0.25)',
  },
});
