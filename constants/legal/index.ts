import { legalConfig } from './config';
import {
  buildCancellationPolicy,
  buildPrivacyPolicy,
  buildRefundPolicy,
  buildTermsPolicy,
} from './policies/customer';
import {
  buildAccountDeletionPolicy,
  buildDataRetentionPolicy,
  buildDeliveryPickupPolicy,
  buildDisclaimerPolicy,
  buildGrievancePolicy,
  buildIntellectualPropertyPolicy,
  buildPaymentPolicy,
  buildRatingsReviewsPolicy,
} from './policies/operations';
import {
  buildCourierDisclaimerPolicy,
  buildFssaiDisclaimerPolicy,
  buildMakerTermsPolicy,
  buildPlaceholderPolicies,
} from './policies/maker';
import type { LegalPolicy, LegalPolicyCategory } from './types';

function buildAllPolicies(): LegalPolicy[] {
  return [
    buildTermsPolicy(legalConfig),
    buildPrivacyPolicy(legalConfig),
    buildRefundPolicy(legalConfig),
    buildCancellationPolicy(legalConfig),
    buildDeliveryPickupPolicy(legalConfig),
    buildMakerTermsPolicy(legalConfig),
    buildCourierDisclaimerPolicy(legalConfig),
    buildFssaiDisclaimerPolicy(legalConfig),
    buildDisclaimerPolicy(legalConfig),
    buildGrievancePolicy(legalConfig),
    buildDataRetentionPolicy(legalConfig),
    buildAccountDeletionPolicy(legalConfig),
    buildPaymentPolicy(legalConfig),
    buildIntellectualPropertyPolicy(legalConfig),
    buildRatingsReviewsPolicy(legalConfig),
    ...buildPlaceholderPolicies(legalConfig),
  ];
}

export const legalPolicies: LegalPolicy[] = buildAllPolicies();

export const legalPolicyMap: Record<string, LegalPolicy> = Object.fromEntries(
  legalPolicies.map((policy) => [policy.id, policy]),
);

export function getLegalPolicy(id: string): LegalPolicy | undefined {
  return legalPolicyMap[id];
}

export function getPoliciesByCategory(category: LegalPolicyCategory): LegalPolicy[] {
  return legalPolicies.filter((policy) => policy.category === category);
}

export { legalConfig } from './config';
export type {
  CheckoutConsentPolicyId,
  LegalPolicy,
  LegalPolicyCategory,
  LegalSection,
  MakerConsentPolicyId,
} from './types';
