import { env } from '../config/env.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

export class InternetArchiveProvider implements BookProvider {
  name = 'internetarchive';
  lastTotalFound = 30607;

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  /**
   * Search 30,000+ Indonesian full-text books from Internet Archive.
   */
  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    // Sanitize query for Lucene syntax to prevent query operator/range injection
    const cleanQ = query.query.replace(/[:"()[\]{}]/g, ' ').trim();
    const isBroad =
      !cleanQ ||
      cleanQ === '*' ||
      cleanQ.toLowerCase() === 'all' ||
      cleanQ.toLowerCase() === 'semua' ||
      cleanQ.toLowerCase() === 'indonesia';

    const baseQuery = isBroad
      ? `(language:indonesian OR language:ind) AND mediatype:(texts)`
      : `(${cleanQ}) AND (language:indonesian OR language:ind) AND mediatype:(texts)`;

    const hasYearFilter = query.yearFrom !== undefined || query.yearTo !== undefined;
    const yFrom = Number.isInteger(query.yearFrom) ? (query.yearFrom as number) : 1000;
    const yTo = Number.isInteger(query.yearTo) ? (query.yearTo as number) : 2099;
    const searchQuery = hasYearFilter ? `${baseQuery} AND year:[${yFrom} TO ${yTo}]` : baseQuery;

    const url = new URL('https://archive.org/advancedsearch.php');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('fl[]', 'identifier,title,creator,year,description,downloads');

    const sortMap: Record<string, string | undefined> = {
      popular: 'downloads desc',
      newest: 'date desc',
      oldest: 'date asc',
      title_asc: 'titleSorter asc',
      title_desc: 'titleSorter desc',
      relevance: isBroad ? 'downloads desc' : undefined,
    };
    const iaSort = sortMap[query.sort || 'relevance'];
    if (iaSort) {
      url.searchParams.set('sort[]', iaSort);
    }

    url.searchParams.set('rows', limit.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('output', 'json');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        response?: {
          numFound?: number;
          docs?: Array<{
            identifier: string;
            title?: string;
            creator?: string;
            year?: number | string;
            description?: string;
          }>;
        };
      };

      if (typeof data.response?.numFound === 'number') {
        this.lastTotalFound = data.response.numFound;
      }

      const results: ProviderBook[] = [];

      for (const doc of data.response?.docs || []) {
        if (!doc.identifier || !doc.title) continue;

        // Skip obvious non-book clutter
        const lowerTitle = doc.title.toLowerCase();
        if (
          lowerTitle === 'iklan' ||
          lowerTitle.includes('hasil upload') ||
          lowerTitle.includes('drable')
        ) {
          continue;
        }

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: `https://archive.org/embed/${doc.identifier}`,
          explanation:
            'Buku lengkap dari Internet Archive. Dapat dibaca langsung lembar demi lembar dengan animasi buku interaktif.',
          canDownload: true,
          canBookmark: true,
        };

        const year =
          typeof doc.year === 'number'
            ? doc.year
            : doc.year
            ? parseInt(String(doc.year), 10)
            : undefined;

        results.push({
          provider: 'internetarchive',
          providerId: doc.identifier,
          title: doc.title,
          authors: doc.creator ? [doc.creator] : ['Penulis Terdaftar'],
          publishedYear: isNaN(year as number) ? undefined : year,
          description: doc.description ? doc.description.slice(0, 300) : undefined,
          language: 'ind',
          languageCode: 'id',
          isIndonesianVerified: true,
          coverUrl: `https://archive.org/services/img/${doc.identifier}`,
          sourceUrl: `https://archive.org/details/${doc.identifier}`,
          access,
          rawMetadata: doc,
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

  async getById(providerId: string): Promise<ProviderBook | null> {
    const url = `https://archive.org/metadata/${providerId}`;
    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        metadata?: {
          identifier: string;
          title?: string;
          creator?: string;
          year?: string;
          description?: string;
          publisher?: string;
        };
      };

      const meta = data.metadata;
      if (!meta) return null;

      const year = meta.year ? parseInt(meta.year, 10) : undefined;

      return {
        provider: 'internetarchive',
        providerId: meta.identifier,
        title: meta.title || 'Tanpa Judul',
        authors: meta.creator ? [meta.creator] : ['Penulis'],
        publisher: meta.publisher,
        publishedYear: isNaN(year as number) ? undefined : year,
        description: meta.description,
        language: 'ind',
        languageCode: 'id',
        isIndonesianVerified: true,
        coverUrl: `https://archive.org/services/img/${meta.identifier}`,
        sourceUrl: `https://archive.org/details/${meta.identifier}`,
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: `https://archive.org/embed/${meta.identifier}`,
          explanation: 'Buku teks lengkap arsip terbuka.',
          canDownload: true,
          canBookmark: true,
        },
        rawMetadata: data,
      };
    } catch {
      return null;
    }
  }
}
