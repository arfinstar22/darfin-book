import { env } from '../config/env.js';
import { verifyIndonesianContent } from '../utils/language.js';
import { fetchWithTimeout, normalizeHttpsUrl, parseYearStrict } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface ZenodoRecord {
  id: number;
  metadata?: {
    title?: string;
    description?: string;
    publication_date?: string;
    access_right?: string;
    language?: string;
    creators?: Array<{ name?: string }>;
    keywords?: string[];
    alternate_identifiers?: Array<{ identifier?: string }>;
  };
  files?: Array<{ key?: string; links?: { self?: string } }>;
  links?: { self_html?: string };
}

export class ZenodoProvider implements BookProvider {
  name = 'zenodo';

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = Math.min(query.limit ?? 15, 25);
    const offset = query.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const cleanQ = query.query.trim();
    const isBroad = !cleanQ || cleanQ === '*' || cleanQ.toLowerCase() === 'all' || cleanQ.toLowerCase() === 'semua';
    const searchQ = isBroad ? 'bahasa indonesia' : `${cleanQ} indonesia`;

    const url = new URL('https://zenodo.org/api/records');
    url.searchParams.set('q', searchQ);
    url.searchParams.set('type', 'publication');
    url.searchParams.set('subtype', 'book');
    url.searchParams.set('size', limit.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('sort', query.sort === 'newest' ? 'mostrecent' : 'bestmatch');

    try {
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers }, 3800);
      if (!response.ok) return [];

      const json = (await response.json()) as { hits?: { hits?: ZenodoRecord[] } };
      const results: ProviderBook[] = [];

      for (const hit of json.hits?.hits || []) {
        const meta = hit.metadata;
        if (!meta?.title || meta.access_right !== 'open') continue;

        const cleanDesc = meta.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const langCheck = verifyIndonesianContent({
          rawLanguage: meta.language,
          title: meta.title,
          description: cleanDesc,
          provider: 'zenodo',
        });
        if (!langCheck.isEligibleForDefaultCatalog) continue;

        const publishedYear = parseYearStrict(meta.publication_date);
        if (query.yearFrom !== undefined && (!publishedYear || publishedYear < query.yearFrom)) continue;
        if (query.yearTo !== undefined && (!publishedYear || publishedYear > query.yearTo)) continue;

        const pdfFile = hit.files?.find((f) => f.key?.toLowerCase().endsWith('.pdf'));
        const pdfUrl = normalizeHttpsUrl(pdfFile?.links?.self);
        const pageUrl = normalizeHttpsUrl(hit.links?.self_html) || `https://zenodo.org/records/${hit.id}`;
        const officialUrl = pdfUrl || pageUrl;

        const altIsbn = meta.alternate_identifiers
          ?.map((x) => (x.identifier || '').replace(/[^0-9Xx]/g, ''))
          .find((s) => s.length === 10 || s.length === 13);

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: officialUrl,
          downloadUrl: pdfUrl,
          explanation:
            'Buku dan panduan Open Access resmi dari repositori ilmiah global Zenodo (CERN). Bebas baca & unduh.',
          canDownload: Boolean(pdfUrl),
          canBookmark: true,
        };

        results.push({
          provider: 'zenodo',
          providerId: String(hit.id),
          title: meta.title.trim(),
          authors:
            meta.creators?.map((c) => c.name).filter((n): n is string => Boolean(n)) || [
              'Zenodo Open Access',
            ],
          description: cleanDesc?.slice(0, 350),
          publisher: 'Zenodo Open Access',
          publishedYear,
          publishedDate: meta.publication_date,
          language: langCheck.providerLanguageCode || 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          isbn10: altIsbn && altIsbn.length === 10 ? altIsbn : undefined,
          isbn13: altIsbn && altIsbn.length === 13 ? altIsbn : undefined,
          subjects: meta.keywords?.slice(0, 5) || ['Open Access'],
          sourceUrl: pageUrl,
          access,
        });
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
