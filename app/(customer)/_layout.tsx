import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { HeaderBackButton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useMarketplaceRealtime } from '../../hooks/useMarketplaceRealtime';
import { colors } from '../../constants/theme';

function authRedirectPath(segments: string[]): string {
  const path = segments.filter((s) => !s.startsWith('(')).join('/');
  return path ? `/(customer)/${path}` : '/(customer)/checkout';
}

/**
 * Auth gate for customer stack.
 * Guest browse allowed on Discover / chef / thali / cart / dietary / become-chef.
 * Checkout & post-order routes require session; CartProvider keeps cart across re-auth.
 */
function routeRequiresAuth(segments: string[]): boolean {
  const path = segments.join('/');
  return (
    path.includes('checkout') ||
    path.includes('addresses') ||
    path.includes('wallet') ||
    path.includes('delete-account') ||
    path.includes('payment-failed') ||
    path.includes('pause-skip') ||
    path.includes('meal-calendar') ||
    path.includes('review/') ||
    path.includes('/review') ||
    path.includes('tracking/') ||
    path.includes('/tracking') ||
    path.includes('order/') ||
    path.includes('/order') ||
    path.includes('invoice/') ||
    path.includes('/invoice') ||
    segments.includes('review') ||
    segments.includes('tracking') ||
    segments.includes('order') ||
    segments.includes('invoice') ||
    segments.includes('checkout') ||
    segments.includes('addresses') ||
    segments.includes('wallet') ||
    segments.includes('payment-failed') ||
    segments.includes('pause-skip') ||
    segments.includes('meal-calendar')
  );
}

const stackHeaderOptions = {
  headerShown: true as const,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.onSurface,
  headerBackVisible: false,
  headerLeft: () => <HeaderBackButton />,
};

export default function CustomerLayout() {
  const { status } = useAuth();
  const segments = useSegments() as string[];
  const needsAuth = routeRequiresAuth(segments);
  // One marketplace subscription for the whole customer stack (avoids channel clashes).
  useMarketplaceRealtime();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'signedOut' && needsAuth) {
    const returnTo = authRedirectPath(segments);
    return (
      <Redirect
        href={{
          pathname: '/(auth)/login',
          params: { returnTo },
        }}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chef/[id]"
        options={{
          ...stackHeaderOptions,
          title: 'Kitchen',
        }}
      />
      <Stack.Screen
        name="thali/[menuItemId]"
        options={{ ...stackHeaderOptions, title: 'Build thali' }}
      />
      <Stack.Screen name="cart" options={{ ...stackHeaderOptions, title: 'Cart' }} />
      <Stack.Screen name="checkout" options={{ ...stackHeaderOptions, title: 'Checkout' }} />
      <Stack.Screen
        name="addresses"
        options={{ ...stackHeaderOptions, title: 'My Addresses' }}
      />
      <Stack.Screen
        name="wallet"
        options={{ ...stackHeaderOptions, title: 'Wallet' }}
      />
      <Stack.Screen
        name="tracking/[orderId]"
        options={{ ...stackHeaderOptions, title: 'Track order' }}
      />
      <Stack.Screen
        name="order/[orderId]"
        options={{ ...stackHeaderOptions, title: 'Order details' }}
      />
      <Stack.Screen
        name="invoice/[orderId]"
        options={{ ...stackHeaderOptions, title: 'Invoice' }}
      />
      <Stack.Screen
        name="review/[orderId]"
        options={{ ...stackHeaderOptions, title: 'Rate meal' }}
      />
      <Stack.Screen
        name="meal-calendar"
        options={{ ...stackHeaderOptions, title: 'Meal calendar' }}
      />
      <Stack.Screen
        name="pause-skip"
        options={{ ...stackHeaderOptions, title: 'Pause / Skip' }}
      />
      <Stack.Screen
        name="dietary"
        options={{ ...stackHeaderOptions, title: 'Dietary preferences' }}
      />
      <Stack.Screen
        name="become-chef"
        options={{ ...stackHeaderOptions, title: 'Become a chef' }}
      />
      <Stack.Screen
        name="payment-failed"
        options={{ ...stackHeaderOptions, title: 'Payment failed' }}
      />
      <Stack.Screen
        name="legal/index"
        options={{ ...stackHeaderOptions, title: 'Legal & policies' }}
      />
      <Stack.Screen
        name="legal/[policyId]"
        options={{ ...stackHeaderOptions, title: 'Policy' }}
      />
      <Stack.Screen
        name="delete-account"
        options={{ ...stackHeaderOptions, title: 'Delete account' }}
      />
    </Stack>
  );
}
