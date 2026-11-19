import { describe, expect, it } from 'vitest';
import { normalizeLanguage } from '../utils/language.js';

describe('Indonesian Language Normalization and Verification', () => {
  it('identifies standard Indonesian ISO-639 codes', () => {
    const r1 = normalizeLanguage('id');
    expect(r1.languageCode).toBe('id');
    expect(r1.isEligibleForDefaultCatalog).toBe(true);

    const r2 = normalizeLanguage('ind');
    expect(r2.languageCode).toBe('id');
    expect(r2.languageTag).toBe('id-ID');
    expect(r2.isEligibleForDefaultCatalog).toBe(true);

    const r3 = normalizeLanguage('Bahasa Indonesia');
    expect(r3.languageCode).toBe('id');
    expect(r3.isEligibleForDefaultCatalog).toBe(true);

    const r4 = normalizeLanguage('/languages/ind');
    expect(r4.languageCode).toBe('id');
    expect(r4.isEligibleForDefaultCatalog).toBe(true);
  });

  it('marks explicit text verification as VERIFIED', () => {
    const verified = normalizeLanguage('id', {
      hasTextSnippetOrExplicitEvidence: true,
    });
    expect(verified.verification).toBe('VERIFIED');
    expect(verified.isEligibleForDefaultCatalog).toBe(true);
  });

  it('excludes foreign languages from default Indonesian catalog', () => {
    const eng = normalizeLanguage('eng');
    expect(eng.languageCode).toBe('eng');
    expect(eng.isEligibleForDefaultCatalog).toBe(false);

    const jpn = normalizeLanguage('japanese');
    expect(jpn.isEligibleForDefaultCatalog).toBe(false);
  });

  it('handles null, empty, or undefined input gracefully', () => {
    const empty = normalizeLanguage(null);
    expect(empty.verification).toBe('UNKNOWN');
    expect(empty.isEligibleForDefaultCatalog).toBe(false);
  });
});
