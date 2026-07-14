import { Stack } from 'expo-router';
import { RoleGate } from '../../components/auth/RoleGate';
import { colors } from '../../constants/theme';

/** Chef app — kitchen operations after approval. */
export default function ChefLayout() {
  return (
    <RoleGate role="chef">
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
