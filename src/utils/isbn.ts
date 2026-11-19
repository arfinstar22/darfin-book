/**
 * ISBN-10 and ISBN-13 validation and normalization utility.
 * Adheres to standard ISBN check-digit algorithms.
 */

export function cleanIsbn(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  const cleaned = cleanIsbn(isbn);
  if (!/^[0-9]{9}[0-9X]$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i], 10) * (10 - i);
  }

  const lastChar = cleaned[9];
  sum += lastChar === 'X' ? 10 : parseInt(lastChar, 10);

  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  const cleaned = cleanIsbn(isbn);
  if (!/^[0-9]{13}$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleaned[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[12], 10);
}

export function validateIsbn(input: string): {
  valid: boolean;
  type: 'ISBN-10' | 'ISBN-13' | 'INVALID';
  normalized: string;
} {
  const cleaned = cleanIsbn(input);
  if (cleaned.length === 10 && isValidIsbn10(cleaned)) {
    return { valid: true, type: 'ISBN-10', normalized: cleaned };
  }
  if (cleaned.length === 13 && isValidIsbn13(cleaned)) {
    return { valid: true, type: 'ISBN-13', normalized: cleaned };
  }
  return { valid: false, type: 'INVALID', normalized: cleaned };
}

export function isbn10ToIsbn13(isbn10: string): string | null {
  const cleaned = cleanIsbn(isbn10);
  if (!isValidIsbn10(cleaned)) return null;

  const prefix = '978' + cleaned.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(prefix[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return prefix + checkDigit.toString();
}
