/**
 * Shared safe URL, timeout fetch, year parsing, and lightweight OAI-PMH XML utilities.
 */

export const PROVIDER_FETCH_TIMEOUT_MS = 4000;

/**
 * Validates URL uses safe http/https protocol.
 */
export function isSafeHttpUrl(raw?: string | null): raw is string {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Upgrades http:// to https:// when valid, rejecting unsafe schemes.
 */
export function normalizeHttpsUrl(raw?: string | null): string | undefined {
  if (!isSafeHttpUrl(raw)) return undefined;
  const trimmed = raw.trim();
  return trimmed.startsWith('http://') ? `https://${trimmed.slice(7)}` : trimmed;
}

/**
 * Extracts validated 4-digit publication year (1000..2099).
 */
export function parseYearStrict(raw?: string | number | null): number | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 1000 && raw <= 2099 ? raw : undefined;
  }
  if (!raw || typeof raw !== 'string') return undefined;
  const match = raw.trim().match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (!match) return undefined;
  const year = parseInt(match[1], 10);
  return year >= 1000 && year <= 2099 ? year : undefined;
}

/**
 * Decodes common XML/HTML entities safely.
 */
export function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

/**
 * Extracts all plain-text values of a given XML tag (handles attributes like xml:lang).
 */
export function extractXmlTags(xml: string, tagName: string): string[] {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
  const values: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const decoded = decodeXmlEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    if (decoded) values.push(decoded);
  }
  return values;
}

/**
 * Fetches text or JSON with strict timeout guard so slow external APIs never stall search.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = PROVIDER_FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(timeoutMs),
  });
}
