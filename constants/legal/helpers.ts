import type { LegalConfig } from './config';
import type { LegalSection } from './types';

export function section(heading: string | undefined, paragraphs: string[]): LegalSection {
  return { heading, paragraphs };
}

export function c(config: LegalConfig, key: keyof LegalConfig): string {
  return config[key];
}
