import type { Href } from 'expo-router';

export function legalPolicyHref(policyId: string): Href {
  return {
    pathname: '/(customer)/legal/[policyId]',
    params: { policyId },
  };
}

export const legalHubHref = '/(customer)/legal/index' as Href;
