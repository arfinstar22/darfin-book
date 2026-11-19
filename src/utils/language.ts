/**
 * Indonesian language normalization and verification utilities.
 * Enforces DARFIN BOOK Indonesian-first catalog requirements.
 */

export type LanguageVerificationStatus =
  | 'VERIFIED'
  | 'PROVIDER_DECLARED'
  | 'UNKNOWN'
  | 'DISPUTED';

export interface NormalizedLanguage {
  languageCode: string; // ISO 639-1 (e.g., 'id')
  languageTag: string; // BCP 47 (e.g., 'id-ID')
  providerLanguageCode: string; // Raw provider value (e.g., 'ind', 'in', 'id')
  verification: LanguageVerificationStatus;
  isEligibleForDefaultCatalog: boolean;
}

const INDONESIAN_CODES = new Set([
  'id',
  'ind',
  'in', // legacy ISO code for Indonesian
  'indonesian',
  'bahasa indonesia',
  'indonesia',
  '/languages/ind',
]);

export function normalizeLanguage(
  rawLanguage?: string | null,
  provenance: {
    provider?: string;
    hasTextSnippetOrExplicitEvidence?: boolean;
  } = {}
): NormalizedLanguage {
  if (!rawLanguage || typeof rawLanguage !== 'string') {
    return {
      languageCode: 'unknown',
      languageTag: 'und',
      providerLanguageCode: '',
      verification: 'UNKNOWN',
      isEligibleForDefaultCatalog: false,
    };
  }

  const cleaned = rawLanguage.trim().toLowerCase();

  if (INDONESIAN_CODES.has(cleaned)) {
    return {
      languageCode: 'id',
      languageTag: 'id-ID',
      providerLanguageCode: rawLanguage,
      verification: provenance.hasTextSnippetOrExplicitEvidence
        ? 'VERIFIED'
        : 'PROVIDER_DECLARED',
      isEligibleForDefaultCatalog: true,
    };
  }

  // Check if it's explicitly another language
  return {
    languageCode: cleaned.slice(0, 3),
    languageTag: cleaned,
    providerLanguageCode: rawLanguage,
    verification: 'PROVIDER_DECLARED',
    isEligibleForDefaultCatalog: false,
  };
}
