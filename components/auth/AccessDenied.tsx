import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';

type Props = {
  title?: string;
  description?: string;
  returnHref?: string;
  returnLabel?: string;
};

/** Shown when a signed-in user lacks permission for a route group. */
export function AccessDenied({
  title = 'Access restricted',
  description = 'Your account does not have permission to view this area.',
  returnHref = '/(customer)/(tabs)/home',
  returnLabel = 'Back to Discover',
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.glyph}>🔒</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Link href={returnHref as never} asChild>
          <Button label={returnLabel} />
        </Link>
        <Link href="/(auth)/login" asChild>
          <Button label="Sign in with a different account" variant="outline" />
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.margin,
    gap: spacing.base,
  },
  glyph: { fontSize: 48 },
  title: { ...typography.headlineMd, color: colors.onBackground, textAlign: 'center' },
  description: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
});
