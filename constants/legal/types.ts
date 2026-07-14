export type LegalSection = {
  heading?: string;
  paragraphs: string[];
};

export type LegalPolicyCategory = 'primary' | 'maker' | 'placeholder';

export type LegalPolicy = {
  id: string;
  title: string;
  summary: string;
  category: LegalPolicyCategory;
  sections: LegalSection[];
};

export type CheckoutConsentPolicyId = 'terms' | 'cancellation' | 'delivery-pickup' | 'payment';

export type MakerConsentPolicyId = 'maker-terms' | 'fssai-disclaimer';
