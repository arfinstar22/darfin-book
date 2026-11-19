import { env } from '../config/env.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

export class WikisourceProvider implements BookProvider {
  name = 'wikisource';

  private baseUrl = env.WIKISOURCE_API_BASE_URL;

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  /**
   * Search eligible Indonesian public-domain texts & books on Wikisource.
   */
  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = query.limit ?? 15;
    const offset = query.offset ?? 0;

    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query.query);
    url.searchParams.set('srnamespace', '0|102'); // Main namespace & Index namespace (books)
    url.searchParams.set('srlimit', limit.toString());
    url.searchParams.set('sroffset', offset.toString());
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        query?: {
          search?: Array<{
            pageid: number;
            title: string;
            snippet: string;
            size: number;
            wordcount: number;
            timestamp: string;
          }>;
        };
      };

      const results: ProviderBook[] = [];

      for (const item of data.query?.search || []) {
        const cleanTitle = item.title
          .replace(/^Indeks:/i, '')
          .replace(/\.pdf$/i, '')
          .replace(/_/g, ' ');

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(item.title)}`,
          explanation:
            'Teks domain publik / berlisensi bebas dari Wikisumber Bahasa Indonesia. Bebas dibaca langsung.',
          canDownload: true,
          canBookmark: true,
        };

        results.push({
          provider: 'wikisource',
          providerId: item.pageid.toString(),
          title: cleanTitle,
          authors: ['Domain Publik / Karya Nusantara'],
          description: item.snippet.replace(/<[^>]+>/g, ''),
          publishedDate: item.timestamp.split('T')[0],
          language: 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          sourceUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(item.title)}`,
          access,
          rawMetadata: item,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Wikisource texts generally do not have ISBNs.
   */
  async getByIsbn(_isbn: string): Promise<ProviderBook | null> {
    return null;
  }

  /**
   * Get page details by pageId.
   */
  async getById(providerId: string): Promise<ProviderBook | null> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('pageids', providerId);
    url.searchParams.set('prop', 'info|extracts');
    url.searchParams.set('explaintext', 'true');
    url.searchParams.set('exintro', 'true');
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              extract?: string;
              canonicalurl?: string;
            }
          >;
        };
      };

      const page = data.query?.pages?.[providerId];
      if (!page) return null;

      const cleanTitle = page.title
        .replace(/^Indeks:/i, '')
        .replace(/\.pdf$/i, '')
        .replace(/_/g, ' ');

      return {
        provider: 'wikisource',
        providerId: page.pageid.toString(),
        title: cleanTitle,
        authors: ['Karya Nusantara / Wikisumber'],
        description: page.extract || 'Naskah teks lengkap dari Wikisumber Bahasa Indonesia.',
        language: 'id',
        languageCode: 'id',
        isIndonesianVerified: true,
        sourceUrl: page.canonicalurl || `https://id.wikisource.org/wiki/${encodeURIComponent(page.title)}`,
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: page.canonicalurl,
          explanation: 'Teks domain publik dari Wikisumber Indonesia.',
          canDownload: true,
          canBookmark: true,
        },
        rawMetadata: page,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch rendered HTML content for safe in-app reading.
   */
  async getPageContent(pageId: string): Promise<{
    title: string;
    html: string;
    licenseNotice: string;
    sourceUrl: string;
  } | null> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('pageid', pageId);
    url.searchParams.set('prop', 'text|displaytitle');
    url.searchParams.set('format', 'json');
    url.searchParams.set('disableeditsection', 'true');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        parse?: {
          title: string;
          text?: { '*': string };
        };
      };

      if (!data.parse?.text?.['*']) return null;

      return {
        title: data.parse.title,
        html: data.parse.text['*'],
        licenseNotice:
          'Teks tersedia di bawah Lisensi Creative Commons Pengakuan-BerbagiSerupa atau Domain Publik. Sumber: Wikisumber Bahasa Indonesia.',
        sourceUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(data.parse.title)}`,
      };
    } catch {
      return null;
    }
  }
}
