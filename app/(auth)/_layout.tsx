import React from 'react';
import { Redirect, Stack, type Href } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../../constants/theme';
import { webRootStyle, webScreenStyle } from '../../constants/webLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRoles } from '../../hooks/useRoles';

function AuthSignedInRedirect({ children }: { children: React.ReactNode }) {
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

  return children;
}

export default function AuthLayout() {
  return (
    <AuthSignedInRedirect>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.screen,
          ...Platform.select({
            web: { animation: 'none' as const },
            default: {},
          }),
        }}
      />
    </AuthSignedInRedirect>
  );
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
  screen: webScreenStyle,
});
