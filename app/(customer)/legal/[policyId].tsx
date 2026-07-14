import { Stack, useLocalSearchParams } from 'expo-router';
import { PolicyDocument } from '../../../components/legal/PolicyDocument';
import { EmptyState } from '../../../components/ui';
import { getLegalPolicy } from '../../../constants/legal';
import { colors } from '../../../constants/theme';

export default function LegalPolicyScreen() {
  const { policyId } = useLocalSearchParams<{ policyId: string }>();
  const policy = policyId ? getLegalPolicy(policyId) : undefined;

  if (!policy) {
    return (
      <>
        <Stack.Screen options={{ title: 'Policy' }} />
        <EmptyState title="Policy not found" description="This document may have been moved." />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: policy.title,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
      <PolicyDocument policy={policy} />
    </>
  );
}
