import { Link } from 'expo-router';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { stitchImages } from '../../constants/images';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { webScreenStyle } from '../../constants/webLayout';

/**
 * Stitch: Onboarding - Welcome (c34465a744714db381b28dcb55ae3a74)
 * Hero illustration + brand-first layout from downloaded Stitch assets.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 720;

  return (
    <View style={styles.root}>
      <Image
        source={stitchImages.welcomeAtmosphere}
        style={styles.atmosphere}
        blurRadius={Platform.OS === 'web' ? 0 : 2}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, spacing.sm),
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.brand}>GharKaSwad</Text>

        <View style={[styles.heroWrap, compact && styles.heroWrapCompact]}>
          <Image source={stitchImages.welcomeHero} style={styles.hero} resizeMode="cover" />
          <View style={styles.heroFade} />
        </View>

        <Text style={styles.headline}>
          Authentic Home Flavors,{'\n'}Delivered.
        </Text>
        <Text style={styles.sub}>
          Discover verified home chefs in your neighborhood and enjoy meals made with love.
        </Text>

        <View style={styles.actions}>
          <Link href="/(auth)/signup" asChild>
            <Button label="Create account" size="lg" style={styles.cta} />
          </Link>
          <Link href="/(auth)/login" asChild>
            <Button label="Sign in" variant="outline" size="lg" style={styles.cta} />
          </Link>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...webScreenStyle,
    position: 'relative',
  },
  atmosphere: {
    ...StyleSheet.absoluteFill,
    opacity: 0.18,
    width: '100%',
    height: '100%',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: spacing.margin,
    gap: spacing.md,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  brand: {
    ...typography.headlineLg,
    color: colors.primary,
    textAlign: 'center',
  },
  heroWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 300,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    alignSelf: 'center',
  },
  heroWrapCompact: {
    maxHeight: 220,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFill,
    borderBottomWidth: 80,
    borderBottomColor: 'rgba(255,248,245,0.35)',
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onBackground,
    textAlign: 'center',
    width: '100%',
  },
  sub: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    width: '100%',
    lineHeight: 26,
  },
  actions: {
    gap: spacing.sm,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  cta: {
    width: '100%',
    borderRadius: radius.full,
    alignSelf: 'stretch',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
  },
  dotActive: {
    width: 32,
    backgroundColor: colors.primary,
  },
});
