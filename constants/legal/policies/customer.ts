import type { LegalConfig } from '../config';
import { section } from '../helpers';
import type { LegalPolicy } from '../types';

export function buildTermsPolicy(config: LegalConfig): LegalPolicy {
  const { appName, companyName, effectiveDate, supportEmail, supportPhone, registeredAddress, courierPartnerName } =
    config;

  return {
    id: 'terms',
    title: 'Terms & Conditions',
    summary: 'Rules for using the GharKaSwad marketplace app.',
    category: 'primary',
    sections: [
      section(undefined, [
        `Last Updated: ${effectiveDate}`,
        `Operated by: ${companyName} ("Company", "we", "us", "our")`,
        `Application: ${appName} ("App", "Platform")`,
      ]),
      section('1. Acceptance of Terms', [
        `By downloading, accessing, registering for, or using ${appName}, you agree to be bound by these Terms & Conditions ("Terms"), our Privacy Policy, Refund Policy, Cancellation Policy, Delivery & Pickup Policy, Payment Policy, Ratings & Reviews Policy, and all other policies referenced herein. If you do not agree, do not use the App.`,
        'These Terms constitute an electronic record under the Information Technology Act, 2000, and rules thereunder. They are published in compliance with the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, and applicable provisions of the Digital Personal Data Protection Act, 2023 ("DPDP Act").',
      ]),
      section('2. About the Platform', [
        `${appName} is a technology marketplace that connects Customers with independent home cooks ("Makers") and, where selected, third-party courier service providers for fulfillment of homemade tiffin and meal subscription orders in India.`,
        `${companyName} operates one company-owned kitchen and an open marketplace of independent Makers. Makers are independent contractors, not employees, agents, or partners of ${companyName}. Courier services are provided by independent third parties (e.g. ${courierPartnerName}) and are not provided by ${companyName}.`,
        `${companyName} provides the Platform, payment facilitation, order management technology, and administrative support. Food preparation is performed by Makers (or the company-owned kitchen where applicable).`,
      ]),
      section('3. Eligibility', [
        'You must be at least 18 years of age, be competent to contract under the Indian Contract Act, 1872, provide accurate registration information, and use the App only for lawful personal purposes in India.',
      ]),
      section('4. User Accounts', [
        'Account creation requires mobile number verification via OTP. You are responsible for maintaining confidentiality of your account and for all activity under it.',
        'The Platform supports Customer accounts and Maker partner accounts. Each account type is subject to additional terms applicable to that role.',
        'We may suspend or terminate accounts for violation of these Terms, fraud, abuse, repeated complaints, food safety concerns, or legal/regulatory requirements. See Account Deletion Policy for user-initiated deletion.',
      ]),
      section('5. Services Description', [
        'For Customers: browse Makers near your location; customize meals at component level; subscribe to lunch and/or dinner plans (7, 15, or 30 days); choose self-pickup or courier delivery; pay via Razorpay-supported methods; track orders; rate and review Makers after fulfilled orders.',
        'Maker services are governed by the Home Cook ("Maker") Partner Terms, incorporated by reference.',
        'The following are not implemented at this stage: in-app wallet, referral program, coupon/offer engine, loyalty program, and customer–Maker chat/messaging.',
      ]),
      section('6. Orders and Subscriptions', [
        'Placing an order or subscription constitutes an offer to purchase meals from the selected Maker (or company-owned kitchen, where applicable), subject to Maker acceptance and availability.',
        'Recurring plans (7/15/30 days) may auto-renew or auto-debit per your selected payment method and e-mandate authorization via Razorpay, as described in the Payment Policy and Cancellation Policy.',
        'Component-level customization is subject to each Maker\'s menu configuration. Prices, delivery fees, taxes, and platform charges are displayed at checkout.',
      ]),
      section('7. Fulfillment', [
        'Fulfillment is governed by the Delivery & Pickup Policy. Customers may choose self-pickup from the Maker\'s kitchen (OTP confirmation; no delivery fee) or courier delivery via an independent third-party logistics provider.',
      ]),
      section('8–10. Payments, Cancellations, and Reviews', [
        'All payments are processed through Razorpay. See Payment Policy. Cancellations and refunds are governed by the Cancellation Policy and Refund Policy. Ratings and reviews are governed by the Ratings & Reviews Policy.',
      ]),
      section('11. Food Safety', [
        'Food is prepared by independent Makers under their own FSSAI registrations. See Food Safety & FSSAI Disclaimer. Customers acknowledge inherent risks of consuming home-prepared food and must disclose dietary restrictions and allergies where relevant.',
      ]),
      section('12. Prohibited Conduct', [
        'You agree not to: provide false information; circumvent payments; harass Makers or couriers; post unlawful reviews; reverse-engineer the Platform; or use the App for any unlawful purpose.',
      ]),
      section('13–15. IP, Third Parties, and Liability', [
        'All Platform content is owned by or licensed to the Company. See Intellectual Property Policy. The App integrates Razorpay, Google Maps, Firebase Cloud Messaging, SMS/OTP services, and third-party couriers.',
        'Disclaimers and liability limits are set out in the general Disclaimer, Courier Partner Disclaimer, and Food Safety & FSSAI Disclaimer. Nothing excludes liability that cannot be excluded under the Consumer Protection Act, 2019.',
      ]),
      section('16–19. Indemnity, Disputes, Changes, and Contact', [
        `These Terms are governed by the laws of India. Courts at ${config.jurisdiction} shall have exclusive jurisdiction, subject to your rights under the Consumer Protection Act, 2019.`,
        'We may update these Terms. Material changes will be notified via the App, email, or SMS.',
        `${companyName}, ${registeredAddress}. Email: ${supportEmail} | Phone: ${supportPhone}`,
      ]),
    ],
  };
}

export function buildPrivacyPolicy(config: LegalConfig): LegalPolicy {
  const { appName, companyName, registeredAddress, effectiveDate, supportEmail, grievanceOfficerName, courierPartnerName } =
    config;

  return {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'How we collect, use, and protect your personal data.',
    category: 'primary',
    sections: [
      section(undefined, [
        `Last Updated: ${effectiveDate}`,
        `Data Fiduciary: ${companyName}, ${registeredAddress}`,
      ]),
      section('1. Scope', [
        `This Privacy Policy applies to Customers, Makers, and visitors who use the ${appName} mobile application.`,
      ]),
      section('2. Personal Data We Collect', [
        'Identity & contact: name, mobile number (OTP-verified) — for account creation and support.',
        'Location: precise/coarse location, delivery address — for Maker discovery and delivery.',
        'Order & preference: order history, dietary preferences (veg/non-veg/Jain/other), meal customizations.',
        'Payment: transaction IDs and payment status via Razorpay; we do not store full card or UPI credentials.',
        'Reviews: star ratings, comments, optional photos — displayed on Maker profiles.',
        'Maker data: kitchen photos, FSSAI registration number, bank/UPI payout details.',
        'Delivery proof: photos uploaded by Maker or courier for confirmation.',
        'Device & usage: device identifiers, app version, crash logs, notification tokens.',
      ]),
      section('3–5. Collection, Purpose, and Permissions', [
        'We collect data directly from you, automatically (with consent/permissions), and from third parties including Razorpay, couriers, SMS/OTP providers, and Google Maps.',
        'We process data to perform contracts, comply with law, prevent fraud, and improve services. Consent is obtained where required for location, camera, push notifications, and similar features.',
        'Location — Maker discovery and delivery. Camera — kitchen and delivery photos. Storage — image uploads. Notifications — order status and pickup alerts.',
      ]),
      section('6–8. Sharing and International Transfers', [
        `We may share data with Makers (order fulfillment), Razorpay (payments), ${courierPartnerName} (delivery), Google/Firebase (maps and notifications), SMS providers, and authorities when legally required. We do not sell personal data.`,
        'Primary processing is in India. Some subprocessors may process data outside India with safeguards consistent with the DPDP Act.',
      ]),
      section('9–12. Your Rights and Security', [
        'You may access, correct, withdraw consent, request erasure (see Account Deletion Policy), and file grievances. Contact: ' + supportEmail + '.',
        `${appName} is not directed at persons under 18. We implement reasonable security measures. Data breach notifications will be made as required under the DPDP Act.`,
      ]),
      section('13. Grievance Officer', [
        `Name: ${grievanceOfficerName}. Email: ${supportEmail}. Address: ${registeredAddress}.`,
      ]),
    ],
  };
}

export function buildRefundPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'refund',
    title: 'Refund Policy',
    summary: 'When refunds apply and how they are processed.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('1. General Principles', [
        `${config.appName} facilitates transactions between Customers and Makers. Refunds, when approved, are processed to the original payment method via Razorpay within 7–10 business days.`,
      ]),
      section('2. Refund-Eligible Situations', [
        'Cancellation within allowed window; Maker/Platform cancellation due to unavailability; significant order error by Maker; failed/duplicate payment; verified courier delivery failure; substantiated food safety complaints.',
      ]),
      section('3. Non-Refundable Situations', [
        'Late cancellations; customer unavailability at delivery/pickup; subjective taste where food matched specifications; missed self-pickup window; subscription days already consumed; delays due to force majeure or third-party courier issues beyond Platform control.',
      ]),
      section('4–7. Process and Contact', [
        'Request via App support or ' + config.supportEmail + ' within 48 hours (food safety: 24 hours). Provide order ID and supporting photos.',
        'Unauthorised chargebacks without prior grievance may result in account suspension.',
        `Contact: ${config.supportEmail} | ${config.supportPhone}`,
      ]),
    ],
  };
}

export function buildCancellationPolicy(config: LegalConfig): LegalPolicy {
  return {
    id: 'cancellation',
    title: 'Cancellation Policy',
    summary: 'Cancel, pause, or skip subscription meals.',
    category: 'primary',
    sections: [
      section(undefined, [`Last Updated: ${config.effectiveDate}`]),
      section('1. Definitions', [
        'Cancel — terminate future meals and/or entire subscription. Pause — temporarily suspend deliveries. Skip — skip a specific meal date without cancelling the full subscription.',
      ]),
      section('2. One-Time Orders', [
        'Before preparation starts: full refund. After preparation starts: generally non-cancellable. At pickup/delivery: non-cancellable except for verified failure.',
      ]),
      section('3. Subscription Plans (7/15/30 Days)', [
        'Before plan start: full refund. Skip: request before Maker cutoff (typically 12–24 hours before meal slot). Pause: unused paused days not charged if confirmed before billing.',
        'Cancel subscription: pro-rata refund for unused future meals minus disclosed fees. Auto-debit stops for future cycles upon cancellation.',
      ]),
      section('4–7. No-Shows and How to Cancel', [
        'Self-pickup not collected within window may forfeit that meal\'s charge. Delivery not accepted may forfeit charge; redelivery fees may apply.',
        'Cancel via App: Orders → Subscription → Cancel / Pause / Skip. Email: ' + config.supportEmail,
      ]),
    ],
  };
}
