import { describe, expect, it } from 'vitest';
import { cleanIsbn, isValidIsbn10, isValidIsbn13, validateIsbn, isbn10ToIsbn13 } from '../utils/isbn.js';

describe('ISBN validation and normalization', () => {
  it('cleans whitespace and dashes', () => {
    expect(cleanIsbn('978-602-03-8591-4')).toBe('9786020385914');
    expect(cleanIsbn(' 0-306-40615-2 ')).toBe('0306406152');
  });

  it('validates correct ISBN-10', () => {
    // Valid ISBN-10s
    expect(isValidIsbn10('0306406152')).toBe(true);
    expect(isValidIsbn10('0-306-40615-2')).toBe(true);
    // With X check digit
    expect(isValidIsbn10('080442957X')).toBe(true);
  });

  it('rejects invalid ISBN-10', () => {
    expect(isValidIsbn10('0306406153')).toBe(false);
    expect(isValidIsbn10('12345')).toBe(false);
  });

  it('validates correct ISBN-13', () => {
    // Laskar Pelangi / Indonesian book ISBN
    expect(isValidIsbn13('9786020385914')).toBe(true);
    expect(isValidIsbn13('978-602-03-8591-4')).toBe(true);
  });

  it('rejects invalid ISBN-13', () => {
    expect(isValidIsbn13('9786020385915')).toBe(false);
    expect(isValidIsbn13('9781234567890')).toBe(false);
  });

  it('classifies input correctly using validateIsbn', () => {
    const res13 = validateIsbn('978-602-03-8591-4');
    expect(res13.valid).toBe(true);
    expect(res13.type).toBe('ISBN-13');

    const res10 = validateIsbn('0-306-40615-2');
    expect(res10.valid).toBe(true);
    expect(res10.type).toBe('ISBN-10');

    const resInv = validateIsbn('invalid-isbn');
    expect(resInv.valid).toBe(false);
    expect(resInv.type).toBe('INVALID');
  });

  it('converts valid ISBN-10 to ISBN-13', () => {
    const converted = isbn10ToIsbn13('0306406152');
    expect(converted).toBe('9780306406157');
    expect(isValidIsbn13(converted!)).toBe(true);
  });
});
