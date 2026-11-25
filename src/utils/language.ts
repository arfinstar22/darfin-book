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

const ID_LEXICAL_MARKERS = new Set([
  'dan', 'yang', 'untuk', 'dalam', 'pada', 'dari', 'dengan', 'di', 'ke', 'oleh',
  'tentang', 'sebagai', 'buku', 'kajian', 'panduan', 'pedoman', 'pembelajaran',
  'pendidikan', 'masyarakat', 'indonesia', 'nusantara', 'bahasa', 'serta', 'atau',
  'terhadap', 'analisis', 'pengembangan', 'cerita', 'sastra', 'sejarah', 'kelas',
]);

const EN_LEXICAL_MARKERS = new Set([
  'the', 'and', 'of', 'with', 'for', 'in', 'on', 'from', 'an', 'this', 'that',
  'study', 'perspective', 'perspectives', 'toward', 'towards', 'handbook', 'analysis',
]);

/**
 * Verifies Indonesian eligibility including content-level fallback when institutional
 * repositories mis-tag Indonesian works as 'eng' or leave language metadata blank.
 */
export function verifyIndonesianContent(params: {
  rawLanguage?: string | null;
  title?: string;
  description?: string;
  provider?: string;
}): NormalizedLanguage {
  const direct = normalizeLanguage(params.rawLanguage, { provider: params.provider });
  if (direct.isEligibleForDefaultCatalog) {
    return direct;
  }

  const raw = (params.rawLanguage || '').trim().toLowerCase();
  const ambiguous = !raw || raw === 'eng' || raw === 'en' || raw === 'und' || raw === 'unknown';
  if (!ambiguous) {
    return direct;
  }

  const sampleText = `${params.title || ''} ${(params.description || '').slice(0, 400)}`.toLowerCase();
  const words = sampleText.match(/[a-z]{2,}/g) || [];
  let idHits = 0;
  let enHits = 0;

  for (const w of words) {
    if (ID_LEXICAL_MARKERS.has(w)) idHits++;
    if (EN_LEXICAL_MARKERS.has(w)) enHits++;
  }

  if ((idHits >= 2 && idHits > enHits) || (!raw && idHits >= 1 && enHits === 0)) {
    return {
      languageCode: 'id',
      languageTag: 'id-ID',
      providerLanguageCode: params.rawLanguage || 'inferred-id',
      verification: 'VERIFIED',
      isEligibleForDefaultCatalog: true,
    };
  }

  return direct;
}
