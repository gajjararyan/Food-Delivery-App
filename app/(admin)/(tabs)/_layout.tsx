import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TabBarIcon } from '../../../components/navigation/TabBarIcon';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      style={styles.headerActionWrap}
      onPress={() => void signOut()}
    >
      <Text style={styles.headerAction}>Sign out</Text>
    </Pressable>
  );
}

/** Admin ops tabs — overview, applications, kitchens, orders. */
export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { ...typography.labelMd, color: colors.onBackground },
        headerRight: () => <SignOutButton />,
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
          title: 'Ops overview',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ focused }) => <TabBarIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarLabel: 'Apply',
          tabBarIcon: ({ focused }) => <TabBarIcon name="assignment" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="kitchens"
        options={{
          title: 'Kitchens',
          tabBarLabel: 'Kitchens',
          tabBarIcon: ({ focused }) => <TabBarIcon name="storefront" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'All orders',
          tabBarLabel: 'Orders',
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
