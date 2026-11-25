import { env } from '../config/env.js';
import { cleanIsbn } from '../utils/isbn.js';
import { normalizeLanguage } from '../utils/language.js';
import type {
  AccessStatus,
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
  ReaderMode,
} from './types.js';

export class GoogleBooksProvider implements BookProvider {
  name = 'googlebooks';

  private apiKey = env.GOOGLE_BOOKS_API_KEY;

  /**
   * Search Google Books API with strict language restriction to Indonesian.
   */
  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query.query);
    url.searchParams.set('langRestrict', 'id');
    url.searchParams.set('maxResults', Math.min(limit, 40).toString());
    url.searchParams.set('startIndex', offset.toString());

    if (query.sort === 'newest') {
      url.searchParams.set('orderBy', 'newest');
    } else {
      url.searchParams.set('orderBy', 'relevance');
    }

    if (query.freeOnly) {
      url.searchParams.set('filter', 'free-ebooks');
    }

    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    try {
      const response = await fetch(url.toString());
      if (response.status === 429) {
        // Shared daily quota exceeded - graceful fallback
        return [];
      }
      if (!response.ok) return [];

      const data = (await response.json()) as {
        items?: Array<Record<string, unknown>>;
      };

      const results: ProviderBook[] = [];

      for (const item of data.items || []) {
        const volumeInfo = (item.volumeInfo as Record<string, unknown>) || {};
        const accessInfo = (item.accessInfo as Record<string, unknown>) || {};

        const lang = (volumeInfo.language as string) || '';
        const normalizedLang = normalizeLanguage(lang);

        if (env.STRICT_INDONESIAN_CATALOG && !normalizedLang.isEligibleForDefaultCatalog) {
          continue;
        }

        const access = this.classifyAccess(accessInfo, item.id as string);

        if (query.freeOnly && access.status !== 'FULL_ACCESS') {
          continue;
        }

        const industryIds =
          (volumeInfo.industryIdentifiers as Array<{
            type: string;
            identifier: string;
          }>) || [];
        const isbn10Obj = industryIds.find((id) => id.type === 'ISBN_10');
        const isbn13Obj = industryIds.find((id) => id.type === 'ISBN_13');

        const imageLinks = volumeInfo.imageLinks as Record<string, string> | undefined;
        const coverUrl =
          imageLinks?.thumbnail?.replace('http://', 'https://') ||
          imageLinks?.smallThumbnail?.replace('http://', 'https://');

        const rawPublishedDate = volumeInfo.publishedDate as string | undefined;
        const parsedYearMatch = rawPublishedDate?.match(/^(\d{4})/);
        const publishedYear = parsedYearMatch ? parseInt(parsedYearMatch[1], 10) : undefined;

        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          if (!publishedYear) continue;
          if (query.yearFrom !== undefined && publishedYear < query.yearFrom) continue;
          if (query.yearTo !== undefined && publishedYear > query.yearTo) continue;
        }

        results.push({
          provider: 'googlebooks',
          providerId: item.id as string,
          title: String(volumeInfo.title || 'Tanpa Judul'),
          subtitle: volumeInfo.subtitle as string | undefined,
          authors: (volumeInfo.authors as string[]) || ['Penulis Tidak Diketahui'],
          description: volumeInfo.description as string | undefined,
          publisher: volumeInfo.publisher as string | undefined,
          publishedYear,
          publishedDate: rawPublishedDate,
          language: lang,
          languageCode: normalizedLang.languageCode,
          isIndonesianVerified: normalizedLang.isEligibleForDefaultCatalog,
          coverUrl,
          isbn10: isbn10Obj ? cleanIsbn(isbn10Obj.identifier) : undefined,
          isbn13: isbn13Obj ? cleanIsbn(isbn13Obj.identifier) : undefined,
          pageCount: volumeInfo.pageCount as number | undefined,
          subjects: (volumeInfo.categories as string[]) || [],
          sourceUrl: (volumeInfo.infoLink as string) || undefined,
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
   * Search by ISBN.
   */
  async getByIsbn(isbn: string): Promise<ProviderBook | null> {
    const cleaned = cleanIsbn(isbn);
    const results = await this.search({
      query: `isbn:${cleaned}`,
      limit: 1,
    });
    return results[0] || null;
  }

  /**
   * Get volume by Google Books Volume ID.
   */
  async getById(providerId: string): Promise<ProviderBook | null> {
    const url = new URL(`https://www.googleapis.com/books/v1/volumes/${providerId}`);
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const item = (await response.json()) as Record<string, unknown>;
      const volumeInfo = (item.volumeInfo as Record<string, unknown>) || {};
      const accessInfo = (item.accessInfo as Record<string, unknown>) || {};

      const lang = (volumeInfo.language as string) || '';
      const normalizedLang = normalizeLanguage(lang);

      const access = this.classifyAccess(accessInfo, item.id as string);

      return {
        provider: 'googlebooks',
        providerId: item.id as string,
        title: String(volumeInfo.title || 'Tanpa Judul'),
        subtitle: volumeInfo.subtitle as string | undefined,
        authors: (volumeInfo.authors as string[]) || ['Penulis'],
        description: volumeInfo.description as string | undefined,
        publisher: volumeInfo.publisher as string | undefined,
        publishedDate: volumeInfo.publishedDate as string | undefined,
        language: lang,
        languageCode: normalizedLang.languageCode,
        isIndonesianVerified: normalizedLang.isEligibleForDefaultCatalog,
        access,
        rawMetadata: item,
      };
    } catch {
      return null;
    }
  }

  /**
   * Classify Google Books access from accessInfo object.
   */
  private classifyAccess(
    accessInfo: Record<string, unknown>,
    volumeId: string
  ): ProviderAccess {
    const viewability = (accessInfo.viewability as string) || 'NO_PAGES';
    const embeddable = Boolean(accessInfo.embeddable);
    const accessViewStatus = (accessInfo.accessViewStatus as string) || 'NONE';
    const webReaderLink = accessInfo.webReaderLink as string | undefined;

    let status: AccessStatus = 'METADATA_ONLY';
    let readerMode: ReaderMode = 'UNAVAILABLE';
    let explanation = 'Informasi buku saja. Tidak ada pratinjau halaman.';

    if (viewability === 'ALL_PAGES' || accessViewStatus === 'FULL_PUBLIC_DOMAIN') {
      status = 'FULL_ACCESS';
      readerMode = embeddable ? 'GOOGLE_EMBEDDED' : 'PROVIDER_READER';
      explanation = 'Akses penuh gratis / domain publik dari Google Buku.';
    } else if (viewability === 'PARTIAL') {
      status = 'PREVIEW';
      readerMode = embeddable ? 'GOOGLE_EMBEDDED' : 'PREVIEW_ONLY';
      explanation = 'Pratinjau beberapa halaman tersedia resmi dari Google Buku.';
    }

    return {
      status,
      readerMode,
      matchQuality: 'EXACT',
      officialItemUrl: webReaderLink || `https://books.google.co.id/books?id=${volumeId}`,
      previewUrl: webReaderLink,
      embeddable,
      explanation,
      canDownload: accessViewStatus === 'FULL_PUBLIC_DOMAIN',
      canBookmark: status === 'FULL_ACCESS',
    };
  }
}
