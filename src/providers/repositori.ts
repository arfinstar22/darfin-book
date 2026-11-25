import { env } from '../config/env.js';
import { verifyIndonesianContent } from '../utils/language.js';
import { fetchWithTimeout, normalizeHttpsUrl, parseYearStrict } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface EPrintsRecord {
  eprintid?: number;
  title?: string;
  abstract?: string;
  publisher?: string;
  date?: string | number;
  uri?: string;
  creators?: Array<{ name?: { family?: string; given?: string } }>;
  documents?: Array<{
    language?: string;
    mime_type?: string;
    files?: Array<{ uri?: string; mime_type?: string }>;
  }>;
}

export class RepositoriProvider implements BookProvider {
  name = 'repositori';

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const cleanQ = query.query.trim();
    // Skip slow wildcard search on EPrints unless specific keyword is queried
    if (!cleanQ || cleanQ === '*' || cleanQ.toLowerCase() === 'all' || cleanQ.toLowerCase() === 'semua') {
      return [];
    }

    const url = new URL('https://repositori.kemendikdasmen.go.id/cgi/search/simple');
    url.searchParams.set('q', cleanQ);
    url.searchParams.set('satisfyall', 'ALL');
    url.searchParams.set('order', query.sort === 'newest' ? '-date' : 'byyear');
    url.searchParams.set('_action_export', '1');
    url.searchParams.set('output', 'JSON');

    try {
      // Strict 3.5s timeout so EPrints latency never slows fast providers
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers }, 3500);
      if (!response.ok) return [];

      const items = (await response.json()) as EPrintsRecord[];
      if (!Array.isArray(items)) return [];

      const results: ProviderBook[] = [];
      const limit = Math.min(query.limit ?? 15, 20);

      for (const item of items) {
        if (!item.eprintid || !item.title) continue;

        const primaryDoc = item.documents?.find((d) => d.mime_type === 'application/pdf') || item.documents?.[0];
        const rawFileUri = primaryDoc?.files?.[0]?.uri;
        const pdfUrl = normalizeHttpsUrl(rawFileUri);
        const pageUrl = normalizeHttpsUrl(item.uri) || `https://repositori.kemendikdasmen.go.id/${item.eprintid}/`;

        if (!pdfUrl && !pageUrl) continue;

        const langCheck = verifyIndonesianContent({
          rawLanguage: primaryDoc?.language,
          title: item.title,
          description: item.abstract,
          provider: 'repositori',
        });
        if (!langCheck.isEligibleForDefaultCatalog) continue;

        const publishedYear = parseYearStrict(item.date);
        if (query.yearFrom !== undefined && (!publishedYear || publishedYear < query.yearFrom)) continue;
        if (query.yearTo !== undefined && (!publishedYear || publishedYear > query.yearTo)) continue;

        const authors = (item.creators || [])
          .map((c) => [c.name?.given, c.name?.family].filter(Boolean).join(' ').trim())
          .filter(Boolean);

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: pdfUrl || pageUrl,
          downloadUrl: pdfUrl,
          explanation:
            'Publikasi & naskah resmi Repositori Institusi Kemendikdasmen RI (CC BY-NC 4.0). Gratis dibaca & diunduh.',
          canDownload: Boolean(pdfUrl),
          canBookmark: true,
        };

        results.push({
          provider: 'repositori',
          providerId: String(item.eprintid),
          title: item.title.trim(),
          authors: authors.length > 0 ? authors : ['Kemendikdasmen RI'],
          description: item.abstract?.trim()?.slice(0, 350) || undefined,
          publisher: item.publisher || 'Repositori Institusi Kemendikdasmen RI',
          publishedYear,
          language: 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          subjects: ['Repositori Pendidikan', 'Kemendikdasmen'],
          sourceUrl: pageUrl,
          access,
        });

        if (results.length >= limit) break;
      }

      return results;
    } catch {
      return [];
    }
  }

  async getByIsbn(_isbn: string): Promise<ProviderBook | null> {
    return null;
  }

  async getById(_providerId: string): Promise<ProviderBook | null> {
    return null;
  }
}
