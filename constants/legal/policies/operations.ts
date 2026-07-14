import type { LegalConfig } from '../config';
import { section } from '../helpers';
import type { LegalPolicy } from '../types';

export function buildDeliveryPickupPolicy(config: LegalConfig): LegalPolicy {
  const { appName, companyName, courierPartnerName, supportEmail, supportPhone, effectiveDate } = config;

  return {
    id: 'delivery-pickup',
    title: 'Delivery & Pickup Policy',
    summary: 'Self-pickup and third-party courier delivery rules.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${effectiveDate}`]),
      section('PART A — Self-Pickup', [
        `Customer collects the order directly from the Maker's registered kitchen at a fixed time slot. Self-pickup is at zero delivery cost.`,
        'Pickup is confirmed via OTP generated in the App. Customer must share OTP with the Maker to receive the order.',
        'Arrive within the stated window. Uncollected orders after the window may be deemed fulfilled with no refund unless Maker agrees otherwise.',
        `Risk passes to Customer upon OTP-verified handover. ${companyName} is not liable for issues arising after pickup except as required under consumer law.`,
      ]),
      section('PART B — Courier Delivery', [
        `Delivery is performed by independent third-party logistics providers (e.g. ${courierPartnerName}), booked by ${appName} via API. ${companyName} does not employ, train, or supervise delivery personnel.`,
        'Delivery fees and availability depend on location and courier serviceability. A fixed delivery window is displayed; reasonable delays may occur.',
        'Delivery completion is confirmed through the courier\'s OTP and/or photo proof system. Masked phone numbers may be used for coordination. No in-app chat between Customer and Maker.',
        'Failed delivery due to incorrect address or customer unavailability may result in forfeiture per Refund Policy. Report damage or spillage immediately with photos.',
        'See Courier Partner Disclaimer. The Platform\'s role is limited to booking and status tracking.',
      ]),
      section('PART C — Common Provisions', [
        'Consume hot meals promptly. Neither the Platform, Makers, nor couriers are liable for delays due to force majeure.',
        `Disputes: ${supportEmail} within 48 hours of scheduled fulfillment. Phone: ${supportPhone}`,
      ]),
    ],
  };
}

export function buildPaymentPolicy(config: LegalConfig): LegalPolicy {
  const { appName, effectiveDate, supportEmail, supportPhone } = config;

  return {
    id: 'payment',
    title: 'Payment Policy',
    summary: 'Razorpay, UPI, cards, and subscription auto-debit.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${effectiveDate}`]),
      section('1. Payment Processor', [
        `All payments on ${appName} are processed by Razorpay Software Private Limited, an RBI-authorized payment aggregator. ${config.companyName} does not store full card numbers, CVV, or UPI PINs.`,
      ]),
      section('2. Accepted Methods', [
        'UPI (Google Pay, PhonePe, Paytm, BHIM, etc.), debit and credit cards, and other Razorpay-supported methods. No in-app wallet is available at this stage.',
      ]),
      section('3–5. Pricing and Subscriptions', [
        'Checkout displays meal price, delivery fee (courier mode), applicable GST, and total payable.',
        'By subscribing with auto-renewal, you authorize Razorpay to debit your payment method per the disclosed billing cycle. E-mandate/UPI AutoPay may be used per RBI/NPCI guidelines.',
        'Failed debits may pause subscription. Price changes for renewals will be notified in advance.',
      ]),
      section('6–10. Receipts, Security, and Contact', [
        'Tax invoices/receipts are available in-app or via email. Report unauthorized transactions immediately.',
        'Your use of Razorpay is subject to Razorpay Terms of Service.',
        `Payment disputes: ${supportEmail} | ${supportPhone}`,
      ]),
    ],
  };
}

export function buildRatingsReviewsPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'ratings-reviews',
    title: 'Ratings & Reviews Policy',
    summary: 'How customer ratings and reviews work.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('1–4. Purpose and Visibility', [
        'Customers may rate Makers after each fulfilled order: 1–5 stars (required), optional comment and photo. Reviews appear on the Maker\'s public profile and may influence Trial → Verified tier.',
        'Only Customers with a completed, fulfilled order may review that order.',
      ]),
      section('5–9. Standards and Moderation', [
        'Reviews must be truthful, relate to the actual experience, and not contain hate speech, harassment, personal data, or fake/incentivized content.',
        `${config.companyName} may remove reviews violating this policy or law. Appeals: ${config.supportEmail}`,
      ]),
    ],
  };
}

export function buildGrievancePolicy(config: LegalConfig): LegalPolicy {
  const { companyName, registeredAddress, gstNumber, supportEmail, supportPhone, grievanceOfficerName, effectiveDate, supportHours } =
    config;

  return {
    id: 'grievance',
    title: 'Contact & Grievance Redressal',
    summary: 'Support channels and IT Rules 2021 grievance officer.',
    category: 'primary',
    sections: [
      section(undefined, [
        `Last Updated: ${effectiveDate}`,
        'Published in compliance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.',
      ]),
      section('1. Customer Support', [
        `${companyName}`,
        `Address: ${registeredAddress}`,
        `GST: ${gstNumber}`,
        `Email: ${supportEmail}`,
        `Phone: ${supportPhone} (${supportHours})`,
        'In-App: Profile → Legal & Policies → Contact support',
      ]),
      section('2. Grievance Officer', [
        `Name: ${grievanceOfficerName}`,
        'Designation: Grievance Officer',
        `Email: ${supportEmail}`,
        `Phone: ${supportPhone}`,
        `Address: ${registeredAddress}`,
        'Scope: complaints regarding Platform services, privacy, orders, refunds, Maker conduct, and delivery issues.',
      ]),
      section('3–5. Process and Escalation', [
        'Submit grievance to ' + supportEmail + ' with name, registered mobile, order ID, and supporting documents.',
        'Acknowledgement within 24 hours. Resolution within 15 days from receipt.',
        'If unsatisfied, you may approach the appropriate consumer forum under the Consumer Protection Act, 2019, or the Data Protection Board under the DPDP Act.',
      ]),
    ],
  };
}

export function buildDataRetentionPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'data-retention',
    title: 'Data Retention Policy',
    summary: 'How long we keep your data.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('2. Retention Schedule', [
        'Account profile: active account + 3 years after deletion/last activity.',
        'Order and payment records: 8 years (tax/GST compliance).',
        'Ratings and reviews: duration of Maker listing + 2 years after removal (anonymized where possible).',
        'Maker FSSAI/KYC: active Maker + 5 years after offboarding.',
        'Delivery proof photos: 1 year after order closure.',
        'Support/grievance tickets: 3 years after resolution.',
        'OTP/security logs: 90 days. Analytics/crash logs: 12 months.',
      ]),
      section('3–5. Deletion and Requests', [
        'After retention periods, data is securely deleted or anonymized unless longer retention is required by law.',
        'Account deletion requests: see Account Deletion Policy. Queries: ' + config.supportEmail,
      ]),
    ],
  };
}

export function buildAccountDeletionPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'account-deletion',
    title: 'Account Deletion Policy',
    summary: 'Delete your account and personal data in-app.',
    category: 'primary',
    sections: [
      section(undefined, [
        `Last Updated: ${config.effectiveDate}`,
        'Compliant with Google Play User Data policy and Apple App Store account deletion requirements.',
      ]),
      section('1–2. Right to Delete', [
        `You may request deletion of your ${config.appName} account via Profile → Delete Account. Confirm via OTP sent to your registered mobile number.`,
        `Alternative: email ${config.supportEmail} with subject "Account Deletion Request".`,
      ]),
      section('3–7. What Happens', [
        'Deleted: profile, saved addresses, notification tokens, active subscriptions (cancelled per Cancellation Policy).',
        'Retained per law: transaction records (anonymized where feasible), grievance records, fraud prevention data.',
        'Processing: account deactivated immediately; personal data deleted within 30 days. Deletion is irreversible.',
        'Maker accounts require settlement of pending payouts and open orders.',
      ]),
      section('8. Contact', [`${config.supportEmail} | ${config.supportPhone}`]),
    ],
  };
}

export function buildIntellectualPropertyPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'intellectual-property',
    title: 'Intellectual Property Policy',
    summary: 'Ownership of app content and user-generated content.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('1–4. Platform Ownership', [
        `All intellectual property in ${config.appName} — software, UI/UX, logos, trademarks — is owned by or licensed to ${config.companyName}.`,
        'By submitting ratings, reviews, or photos, you grant a non-exclusive, royalty-free license to use such content on the Platform and marketing materials.',
        'You may not copy, reverse-engineer, scrape, or use Platform content for competing services.',
      ]),
      section('5–6. IP Complaints', [
        `Copyright complaints: ${config.supportEmail} with identification of work, location of material, and contact information.`,
        'Google Maps, Razorpay, Firebase, and other third-party marks belong to their respective owners.',
      ]),
    ],
  };
}

export function buildDisclaimerPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'disclaimer',
    title: 'Disclaimer',
    summary: 'General liability limitations.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('1–4. Platform Limitations', [
        `${config.appName} is provided "as is". ${config.companyName} is an intermediary/e-commerce marketplace under the Information Technology Act, 2000 (as applicable).`,
        'Nutritional information, if displayed, is illustrative only and not medical advice. Ratings and reviews are user-generated; we do not endorse all content.',
      ]),
      section('5–6. Limitation of Liability', [
        `To the maximum extent permitted under Indian law, aggregate liability shall not exceed the amount paid for the specific order giving rise to the claim, or INR 1,000, whichever is higher, except where law prohibits such limitation.`,
        'Nothing herein limits non-waivable rights under the Consumer Protection Act, 2019.',
      ]),
    ],
  };
}
