/**
 * Legal & compliance placeholders for GharKaSwad.
 * Replace with finalized business details before production launch.
 */
export const legalConfig = {
  appName: 'GharKaSwad',
  companyName: 'GharKaSwad Technologies Pvt. Ltd.',
  registeredAddress: '402, Shivalik Plaza, Satellite, Ahmedabad, Gujarat 380015, India',
  gstNumber: '24AABCG1234A1Z5',
  supportEmail: 'support@gharkaswad.in',
  supportPhone: '+91 98765 43210',
  grievanceOfficerName: 'Priya Sharma',
  effectiveDate: '9 July 2026',
  courierPartnerName: 'Porter / Shadowfax',
  jurisdiction: 'Ahmedabad',
  supportHours: 'Mon–Sat, 9:00 AM – 6:00 PM IST',
} as const;

export type LegalConfig = typeof legalConfig;
