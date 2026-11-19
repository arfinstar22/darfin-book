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

export class OpenLibraryProvider implements BookProvider {
  name = 'openlibrary';

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  /**
   * Search books via Open Library Search API.
   * Strictly filters/tags Indonesian records.
   */
  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    // Build search query with Indonesian language preference/restriction
    let searchParam = query.query.trim();
    if (env.STRICT_INDONESIAN_CATALOG) {
      searchParam = `language:ind ${searchParam}`;
    }

    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('q', searchParam);
    url.searchParams.set(
      'fields',
      'key,title,author_name,first_publish_year,cover_i,isbn,edition_count,language,subject,edition_key,ebook_access,has_fulltext,ia'
    );
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('page', page.toString());

    try {
      const response = await fetch(url.toString(), {
        headers: this.headers,
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        docs: Array<Record<string, unknown>>;
      };

      const results: ProviderBook[] = [];

      for (const doc of data.docs || []) {
        const languages = (doc.language as string[]) || [];
        const isInd = languages.some(
          (l) => l === 'ind' || l === 'id' || l.toLowerCase().includes('indonesia')
        );

        if (env.STRICT_INDONESIAN_CATALOG && !isInd) {
          continue;
        }

        const normalizedLang = normalizeLanguage(languages[0] || 'ind');
        const access = this.classifyAccessFromDoc(doc);

        if (query.freeOnly && access.status !== 'FULL_ACCESS' && access.status !== 'BORROW_AVAILABLE') {
          continue;
        }

        const isbns = (doc.isbn as string[]) || [];
        const primaryIsbn = isbns[0] ? cleanIsbn(isbns[0]) : undefined;
        const coverI = doc.cover_i as number | undefined;

        results.push({
          provider: 'openlibrary',
          providerId: String(doc.key).replace('/works/', ''),
          providerWorkId: String(doc.key).replace('/works/', ''),
          title: String(doc.title || 'Tanpa Judul'),
          authors: (doc.author_name as string[]) || ['Penulis Tidak Diketahui'],
          publishedYear: (doc.first_publish_year as number) || undefined,
          language: languages[0] || 'ind',
          languageCode: normalizedLang.languageCode,
          isIndonesianVerified: normalizedLang.isEligibleForDefaultCatalog,
          coverUrl: coverI
            ? `https://covers.openlibrary.org/b/id/${coverI}-M.jpg`
            : undefined,
          isbn10: primaryIsbn && primaryIsbn.length === 10 ? primaryIsbn : undefined,
          isbn13: primaryIsbn && primaryIsbn.length === 13 ? primaryIsbn : undefined,
          subjects: (doc.subject as string[])?.slice(0, 5) || [],
          sourceUrl: `https://openlibrary.org${doc.key}`,
          access,
          rawMetadata: doc,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Lookup book by ISBN.
   */
  async getByIsbn(isbn: string): Promise<ProviderBook | null> {
    const cleaned = cleanIsbn(isbn);
    const url = `https://openlibrary.org/isbn/${cleaned}.json`;

    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;

      const doc = (await response.json()) as Record<string, unknown>;
      const languages = ((doc.languages as Array<{ key: string }>) || []).map(
        (l) => l.key.replace('/languages/', '')
      );
      const isInd = languages.some((l) => l === 'ind' || l === 'id');
      const normalizedLang = normalizeLanguage(languages[0] || (isInd ? 'id' : 'unknown'));

      const access = await this.resolveReadApiAccess(cleaned);

      return {
        provider: 'openlibrary',
        providerId: String(doc.key).replace('/books/', ''),
        providerWorkId: (doc.works as Array<{ key: string }>)?.[0]?.key.replace('/works/', ''),
        title: String(doc.title || 'Tanpa Judul'),
        authors: ['Penulis Terdaftar'],
        publisher: (doc.publishers as string[])?.[0],
        publishedDate: doc.publish_date as string,
        language: languages[0] || 'id',
        languageCode: normalizedLang.languageCode,
        isIndonesianVerified: normalizedLang.isEligibleForDefaultCatalog,
        isbn10: cleaned.length === 10 ? cleaned : undefined,
        isbn13: cleaned.length === 13 ? cleaned : undefined,
        pageCount: doc.number_of_pages as number,
        sourceUrl: `https://openlibrary.org${doc.key}`,
        access,
        rawMetadata: doc,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get edition by OpenLibrary ID.
   */
  async getById(providerId: string): Promise<ProviderBook | null> {
    const url = `https://openlibrary.org/books/${providerId}.json`;
    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;
      const doc = (await response.json()) as Record<string, unknown>;
      const isbns = (doc.isbn_13 as string[]) || (doc.isbn_10 as string[]) || [];
      const primaryIsbn = isbns[0] ? cleanIsbn(isbns[0]) : '';
      const access = primaryIsbn
        ? await this.resolveReadApiAccess(primaryIsbn)
        : this.classifyAccessFromDoc(doc);

      return {
        provider: 'openlibrary',
        providerId,
        title: String(doc.title || 'Tanpa Judul'),
        authors: ['Penulis'],
        publisher: (doc.publishers as string[])?.[0],
        language: 'id',
        languageCode: 'id',
        isIndonesianVerified: true,
        isbn10: primaryIsbn.length === 10 ? primaryIsbn : undefined,
        isbn13: primaryIsbn.length === 13 ? primaryIsbn : undefined,
        sourceUrl: `https://openlibrary.org/books/${providerId}`,
        access,
        rawMetadata: doc,
      };
    } catch {
      return null;
    }
  }

  /**
   * Classify access from Open Library search doc.
   */
  private classifyAccessFromDoc(doc: Record<string, unknown>): ProviderAccess {
    const ebookAccess = doc.ebook_access as string;
    const hasFulltext = Boolean(doc.has_fulltext);
    const iaKeys = (doc.ia as string[]) || [];
    const iaKey = iaKeys[0];

    if (ebookAccess === 'public' && hasFulltext) {
      return {
        status: 'FULL_ACCESS',
        readerMode: 'PROVIDER_READER',
        matchQuality: 'EXACT',
        officialItemUrl: iaKey
          ? `https://archive.org/details/${iaKey}`
          : `https://openlibrary.org${doc.key}`,
        explanation: 'Buku domain publik / akses terbuka, dapat dibaca gratis.',
        canDownload: true,
        canBookmark: true,
      };
    }

    if (ebookAccess === 'borrowable') {
      return {
        status: 'BORROW_AVAILABLE',
        readerMode: 'PROVIDER_READER',
        matchQuality: 'EXACT',
        officialItemUrl: `https://openlibrary.org${doc.key}`,
        explanation: 'Tersedia untuk dipinjam secara resmi (Controlled Digital Lending).',
        canDownload: false,
        canBookmark: true,
      };
    }

    return {
      status: 'METADATA_ONLY',
      readerMode: 'UNAVAILABLE',
      matchQuality: 'EXACT',
      officialItemUrl: `https://openlibrary.org${doc.key}`,
      explanation: 'Informasi bibliografi tersedia; akses teks penuh tidak ditemukan.',
      canDownload: false,
      canBookmark: false,
    };
  }

  /**
   * Resolve live lending status from Read API by ISBN.
   */
  private async resolveReadApiAccess(isbn: string): Promise<ProviderAccess> {
    const url = `https://openlibrary.org/api/volumes/brief/isbn/${isbn}.json`;
    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        return this.fallbackAccess();
      }

      const data = (await response.json()) as {
        records?: Record<
          string,
          {
            data?: {
              title?: string;
              url?: string;
            };
            details?: {
              details?: {
                ocaid?: string;
              };
            };
          }
        >;
        items?: Array<{
          status?: string;
          itemURL?: string;
          match?: string;
        }>;
      };

      const item = data.items?.[0];
      if (!item) return this.fallbackAccess();

      const rawStatus = (item.status || '').toLowerCase();
      let status: AccessStatus = 'METADATA_ONLY';
      let readerMode: ReaderMode = 'UNAVAILABLE';
      let explanation = 'Informasi bibliografi tercatat.';

      if (rawStatus.includes('full') || rawStatus.includes('public')) {
        status = 'FULL_ACCESS';
        readerMode = 'PROVIDER_READER';
        explanation = 'Buku dapat dibaca penuh melalui pembaca resmi.';
      } else if (rawStatus.includes('lendable')) {
        status = 'BORROW_AVAILABLE';
        readerMode = 'PROVIDER_READER';
        explanation = 'Bisa dipinjam digital gratis melalui Open Library.';
      } else if (rawStatus.includes('checked out')) {
        status = 'CHECKED_OUT';
        readerMode = 'UNAVAILABLE';
        explanation = 'Sedang dipinjam oleh pembaca lain. Silakan coba kembali nanti.';
      } else if (rawStatus.includes('restricted')) {
        status = 'RESTRICTED';
        readerMode = 'UNAVAILABLE';
        explanation = 'Akses dibatasi oleh penyedia/penerbit.';
      }

      return {
        status,
        readerMode,
        matchQuality: item.match === 'similar' ? 'SIMILAR' : 'EXACT',
        officialItemUrl: item.itemURL,
        explanation,
        canDownload: status === 'FULL_ACCESS',
        canBookmark: status === 'FULL_ACCESS' || status === 'BORROW_AVAILABLE',
      };
    } catch {
      return this.fallbackAccess();
    }
  }

  private fallbackAccess(): ProviderAccess {
    return {
      status: 'METADATA_ONLY',
      readerMode: 'UNAVAILABLE',
      matchQuality: 'UNKNOWN',
      explanation: 'Status akses langsung tidak tersedia; informasi katalog tercatat.',
      canDownload: false,
      canBookmark: false,
    };
  }
}
