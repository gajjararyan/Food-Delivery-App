import { Stack } from 'expo-router';
import { RoleGate } from '../../components/auth/RoleGate';
import { colors } from '../../constants/theme';

/** Admin ops — marketplace visibility and chef approvals. */
export default function AdminLayout() {
  return (
    <RoleGate role="admin">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </RoleGate>
  );
}
