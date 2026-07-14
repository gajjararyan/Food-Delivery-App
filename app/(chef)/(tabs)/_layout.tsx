import { Link, Tabs, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TabBarIcon } from '../../../components/navigation/TabBarIcon';
import { colors, spacing, typography } from '../../../constants/theme';
import { useMarketplaceRealtime } from '../../../hooks/useMarketplaceRealtime';

function BackToHomeButton() {
  return (
    <Link href={'/(customer)/(tabs)/home' as Href} asChild>
      <Pressable
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={styles.headerActionWrap}
      >
        <Text style={styles.headerAction}>Back to home</Text>
      </Pressable>
    </Link>
  );
}

/** Chef kitchen operations — overview, menu, orders. */
export default function ChefTabsLayout() {
  // Keep chef Menu / Overview in sync with Discover (Supabase).
  useMarketplaceRealtime();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { ...typography.labelMd, color: colors.onBackground },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: {
          ...typography.labelSm,
          fontSize: 11,
          lineHeight: 13,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.outlineVariant,
          height: 62,
          paddingBottom: 4,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarLabel: 'Overview',
          headerRight: () => <BackToHomeButton />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarLabel: 'Menu',
          headerRight: () => <BackToHomeButton />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="restaurant-menu" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: 'Orders',
          headerRight: () => <BackToHomeButton />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="receipt-long" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActionWrap: {
    marginRight: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerAction: {
    ...typography.labelMd,
    color: colors.primary,
  },
});
