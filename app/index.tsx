import { Redirect, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useRoles } from '../hooks/useRoles';
import { colors } from '../constants/theme';
import { webRootStyle } from '../constants/webLayout';

/**
 * Entry redirect.
 * Admin → admin panel. Signed-in customers → Discover. Others → Welcome.
 */
export default function Index() {
  const { status } = useAuth();
  const { isAdmin, status: roleStatus } = useRoles();

  if (status === 'loading' || (status === 'signedIn' && roleStatus === 'loading')) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'signedIn') {
    if (isAdmin) return <Redirect href={'/(admin)/' as Href} />;
    return <Redirect href="/(customer)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    ...webRootStyle,
  },
});
