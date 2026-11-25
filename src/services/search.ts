import { GoogleBooksProvider } from '../providers/googlebooks.js';
import { InternetArchiveProvider } from '../providers/internetarchive.js';
import { KemdikbudProvider } from '../providers/kemdikbud.js';
import { OpenLibraryProvider } from '../providers/openlibrary.js';
import type {
  BookProvider,
  BookSearchQuery,
  BookSortOption,
  BookSourceFilter,
  ProviderBook,
} from '../providers/types.js';
import { WikisourceProvider } from '../providers/wikisource.js';
import { validateIsbn } from '../utils/isbn.js';

interface CachedSearchEntry {
  result: { query: string; total: number; books: ProviderBook[] };
  expiresAt: number;
}

const SEARCH_CACHE_MAX = 60;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Computes quality score used for relevance ranking and tie-breaking.
 */
function getBookQualityScore(book: ProviderBook): number {
  let pts = 0;
  if (book.coverUrl) pts += 10;
  if (book.access.status === 'FULL_ACCESS') pts += 5;
  if (book.access.status === 'BORROW_AVAILABLE') pts += 3;
  return pts;
}

/**
 * Extracts normalized popularity signal across heterogeneous provider metadata.
 */
function getPopularityScore(book: ProviderBook): number {
  const downloads = Number(book.rawMetadata?.downloads || 0);
  const editions = Number(book.rawMetadata?.edition_count || 0) * 50;
  return downloads + editions + getBookQualityScore(book);
}

/**
 * Deterministic sorter across aggregated ProviderBook items.
 */
export function sortProviderBooks(
  books: ProviderBook[],
  sort: BookSortOption = 'relevance'
): ProviderBook[] {
  const copy = [...books];

  copy.sort((a, b) => {
    switch (sort) {
      case 'newest': {
        const ya = a.publishedYear ?? -1;
        const yb = b.publishedYear ?? -1;
        if (yb !== ya) return yb - ya;
        return getBookQualityScore(b) - getBookQualityScore(a);
      }
      case 'oldest': {
        const ya = a.publishedYear ?? Number.MAX_SAFE_INTEGER;
        const yb = b.publishedYear ?? Number.MAX_SAFE_INTEGER;
        if (ya !== yb) return ya - yb;
        return getBookQualityScore(b) - getBookQualityScore(a);
      }
      case 'popular': {
        const diff = getPopularityScore(b) - getPopularityScore(a);
        if (diff !== 0) return diff;
        return getBookQualityScore(b) - getBookQualityScore(a);
      }
      case 'title_asc':
        return a.title.localeCompare(b.title, 'id', { sensitivity: 'base' });
      case 'title_desc':
        return b.title.localeCompare(a.title, 'id', { sensitivity: 'base' });
      case 'relevance':
      default:
        return getBookQualityScore(b) - getBookQualityScore(a);
    }
  });

  return copy;
}

export class SearchService {
  private openLibrary = new OpenLibraryProvider();
  private internetArchive = new InternetArchiveProvider();
  private wikisource = new WikisourceProvider();
  private googleBooks = new GoogleBooksProvider();
  private kemdikbud = new KemdikbudProvider();

  // ponytail: bounded 60-entry in-memory TTL cache cuts repeat provider latency; upgrade to Redis/SQLite if horizontal scaling is added
  private searchCache = new Map<string, CachedSearchEntry>();

  private getProviderMap(): Record<Exclude<BookSourceFilter, 'all'>, BookProvider> {
    return {
      openlibrary: this.openLibrary,
      internetarchive: this.internetArchive,
      kemdikbud: this.kemdikbud,
      googlebooks: this.googleBooks,
      wikisource: this.wikisource,
    };
  }

  /**
   * Orchestrates search across all or selected providers with sorting and year bounds.
   * Ensures 100% strict Indonesian language verification.
   */
  async search(query: BookSearchQuery): Promise<{
    query: string;
    total: number;
    books: ProviderBook[];
  }> {
    const trimmed = query.query.trim();
    if (!trimmed) {
      return { query: '', total: 0, books: [] };
    }

    const cacheKey = JSON.stringify({
      q: trimmed.toLowerCase(),
      limit: query.limit || 30,
      offset: query.offset || 0,
      freeOnly: Boolean(query.freeOnly),
      sort: query.sort || 'relevance',
      yearFrom: query.yearFrom ?? null,
      yearTo: query.yearTo ?? null,
      source: query.source || 'all',
    });

    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    // 1. Detect if query is an ISBN
    const isbnCheck = validateIsbn(trimmed);
    if (isbnCheck.valid) {
      const isbnResults = await this.searchByIsbn(isbnCheck.normalized);
      return {
        query: trimmed,
        total: isbnResults.length,
        books: isbnResults,
      };
    }

    // 2. Targeted or multi-provider parallel search
    const sourceFilter = query.source || 'all';
    const providersMap = this.getProviderMap();
    const activeEntries: Array<[Exclude<BookSourceFilter, 'all'>, BookProvider]> =
      sourceFilter !== 'all' && providersMap[sourceFilter]
        ? [[sourceFilter, providersMap[sourceFilter]]]
        : [
            ['openlibrary', this.openLibrary],
            ['internetarchive', this.internetArchive],
            ['kemdikbud', this.kemdikbud],
            ['googlebooks', this.googleBooks],
            ['wikisource', this.wikisource],
          ];

    const settled = await Promise.allSettled(
      activeEntries.map(([, provider]) => provider.search(query))
    );

    const collected: ProviderBook[] = [];
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        collected.push(...res.value);
      }
    }

    // Strict Indonesian filtering
    const indonesianOnly = collected.filter(
      (b) => b.isIndonesianVerified && b.languageCode === 'id'
    );

    // Deduplication by title similarity + primary ISBN
    const deduplicated = this.deduplicateBooks(indonesianOnly);

    // Apply strict year range filter when requested
    const hasYearFilter = query.yearFrom !== undefined || query.yearTo !== undefined;
    const filtered = hasYearFilter
      ? deduplicated.filter((b) => {
          if (!b.publishedYear) return false;
          if (query.yearFrom !== undefined && b.publishedYear < query.yearFrom) return false;
          if (query.yearTo !== undefined && b.publishedYear > query.yearTo) return false;
          return true;
        })
      : deduplicated;

    // Sort uniformly across aggregated providers
    const sorted = sortProviderBooks(filtered, query.sort || 'relevance');

    const reqLimit = query.limit || 30;
    const ranIa = activeEntries.some(([key]) => key === 'internetarchive');
    const ranOl = activeEntries.some(([key]) => key === 'openlibrary');

    const estimatedTotal =
      sourceFilter === 'internetarchive'
        ? this.internetArchive.lastTotalFound || sorted.length
        : sourceFilter === 'openlibrary'
          ? this.openLibrary.lastTotalFound || sorted.length
          : sourceFilter !== 'all'
            ? sorted.length
            : Math.max(
                sorted.length,
                ranIa ? this.internetArchive.lastTotalFound || 0 : 0,
                !query.freeOnly && ranOl ? this.openLibrary.lastTotalFound || 0 : 0
              );

    const result = {
      query: trimmed,
      total: estimatedTotal,
      books: sorted.slice(0, reqLimit),
    };

    if (this.searchCache.size >= SEARCH_CACHE_MAX) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) this.searchCache.delete(oldestKey);
    }
    this.searchCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });

    return result;
  }

  /**
   * Search by ISBN with provider fallback.
   */
  async searchByIsbn(isbn: string): Promise<ProviderBook[]> {
    const results: ProviderBook[] = [];

    // Check Open Library first
    const olBook = await this.openLibrary.getByIsbn(isbn);
    if (olBook && olBook.isIndonesianVerified) {
      results.push(olBook);
    }

    // Check Google Books
    const gbBook = await this.googleBooks.getByIsbn(isbn);
    if (gbBook && gbBook.isIndonesianVerified) {
      results.push(gbBook);
    }

    return results;
  }

  /**
   * Conservative deduplication based on title & ISBN.
   */
  private deduplicateBooks(books: ProviderBook[]): ProviderBook[] {
    const seen = new Set<string>();
    const unique: ProviderBook[] = [];

    for (const book of books) {
      const normalizedTitle = book.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30);

      const key = book.isbn13 || book.isbn10 || normalizedTitle;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(book);
      }
    }

    return unique;
  }
}
