import type { LegalConfig } from '../config';
import { section } from '../helpers';
import type { LegalPolicy } from '../types';

export function buildMakerTermsPolicy(config: LegalConfig): LegalPolicy {
  const { companyName, appName, effectiveDate, courierPartnerName } = config;

  return {
    id: 'maker-terms',
    title: 'Maker Partner Terms',
    summary: 'Terms for independent home cook partners.',
    category: 'maker',
    sections: [
      section(undefined, [
        `Last Updated: ${effectiveDate}`,
        `Between: ${companyName} ("Platform") and the registering home cook ("Maker", "you")`,
      ]),
      section('1. Independent Contractor', [
        'You register as an independent home cook and contractor, not an employee, agent, or franchisee. You control your schedule and preparation methods and are responsible for your own taxes and compliance.',
      ]),
      section('2. Registration and Verification', [
        'Requirements: valid mobile (OTP), kitchen photographs, FSSAI Basic Registration, bank/UPI details, accurate kitchen address.',
        'Trial tier: 15%–18% platform commission. Verified tier: 8%–12% commission. Platform may upgrade, downgrade, suspend, or remove tiers based on performance and compliance.',
      ]),
      section('3–6. FSSAI, Menu, and Fulfillment', [
        'You are solely responsible for FSSAI registration, hygiene, Food Safety and Standards Act compliance, and accurate veg/non-veg/Jain/allergen disclosures.',
        'Honor confirmed customized orders. Package food securely with food-grade materials and veg/non-veg indicators where applicable.',
        `Confirm self-pickup via OTP. Cooperate with ${courierPartnerName} for delivery orders.`,
      ]),
      section('7–14. Payouts, Quality, and Termination', [
        'Platform deducts tier commission before payout on a defined cycle. GST on your income is your responsibility.',
        'Low ratings, complaints, or FSSAI non-compliance may result in suspension or delisting.',
        'Prohibited: misrepresenting FSSAI status, off-platform diversion, unsafe materials, unapproved subcontracting.',
        `You grant ${companyName} license to use your name, photos, menu, and ratings for Platform operations. You indemnify the Platform against claims from your food preparation or non-compliance.`,
        'By completing Maker registration, you accept these terms in addition to the general Terms & Conditions and Privacy Policy.',
      ]),
    ],
  };
}

export function buildCourierDisclaimerPolicy(config: LegalConfig): LegalPolicy {
  const { companyName, appName, courierPartnerName, effectiveDate } = config;

  return {
    id: 'courier-disclaimer',
    title: 'Courier Partner Disclaimer',
    summary: 'Third-party delivery — not platform employees.',
    category: 'maker',
    sections: [
      section(undefined, [`Last Updated: ${effectiveDate}`]),
      section('IMPORTANT NOTICE', [
        `Delivery services on ${appName} are provided by independent third-party logistics companies (e.g. ${courierPartnerName}), not by ${companyName}.`,
      ]),
      section('1–3. No Employment Relationship', [
        'Courier personnel are NOT employees, agents, or partners of the Company. They are engaged by third-party courier companies under their own contracts.',
        `${companyName}'s role is limited to API booking, sharing necessary order information, displaying tracking, and support coordination.`,
        `${courierPartnerName} is responsible for transport, regulatory compliance, insurance, and OTP/photo delivery confirmation.`,
      ]),
      section('4–6. Limitation and Acknowledgement', [
        'The Company is not liable for acts, negligence, loss, theft, damage, spillage, injury, or delays attributable to courier personnel or operations beyond applicable law.',
        'By selecting courier delivery, you acknowledge delivery is a third-party service and agree to cooperate with courier verification.',
      ]),
    ],
  };
}

export function buildFssaiDisclaimerPolicy(config: LegalConfig): LegalPolicy {
  const { companyName, appName, effectiveDate, supportEmail } = config;

  return {
    id: 'fssai-disclaimer',
    title: 'Food Safety & FSSAI Disclaimer',
    summary: 'Food prepared by independent Makers under their own FSSAI.',
    category: 'maker',
    sections: [
      section(undefined, [`Last Updated: ${effectiveDate}`]),
      section('1–3. Marketplace and FSSAI', [
        `${appName} connects Customers with independent Makers who prepare food in their own kitchens, and with one company-owned kitchen operated by ${companyName} where applicable.`,
        'Each Maker must hold valid FSSAI Basic Registration in their own name. Makers are solely responsible for compliance with the Food Safety and Standards Act, 2006.',
        `${companyName} verifies FSSAI documentation at onboarding but does not guarantee ongoing compliance or inspect every meal.`,
      ]),
      section('4–7. Allergens, Warranty, and Complaints', [
        'Customers must review Maker disclosures. Home kitchens carry cross-contamination risk. No warranty on taste or nutrition except as required under consumer law.',
        `Report food safety issues immediately to ${supportEmail}. Platform may suspend Makers and cooperate with authorities.`,
        'By ordering, you acknowledge home-cooked food carries inherent variability and limited Platform liability as stated in the Disclaimer.',
      ]),
    ],
  };
}

export function buildPlaceholderPolicies(config: LegalConfig): LegalPolicy[] {
  const note = (id: string, title: string, feature: string): LegalPolicy => ({
    id,
    title,
    summary: 'Not applicable at this stage.',
    category: 'placeholder',
    sections: [
      section(undefined, [
        `Last Updated: ${config.effectiveDate}`,
        `Not applicable at this stage — add if this feature is built.`,
        `${config.appName} does not currently offer ${feature}. If introduced, publish full terms covering eligibility, compliance, and user rights before launch.`,
      ]),
    ],
  });

  return [
    note('wallet', 'Wallet Policy', 'an in-app wallet, stored balance, or prepaid credits'),
    note('referral', 'Referral Policy', 'a referral or invite-and-earn program'),
    note('coupon', 'Coupon & Offer Policy', 'a coupon, promo code, or offer engine'),
    note('loyalty', 'Loyalty Program Policy', 'a loyalty points or rewards program'),
    note('community', 'Community Guidelines', 'user community, forums, or in-app chat/messaging'),
    note('cookie', 'Cookie Policy', 'a marketing website with browser cookies (the mobile App uses app permissions per the Privacy Policy)'),
  ];
}
