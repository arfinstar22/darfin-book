import { BloomLibraryProvider } from '../providers/bloom.js';
import { BrinProvider } from '../providers/brin.js';
import { GoogleBooksProvider } from '../providers/googlebooks.js';
import { InternetArchiveProvider } from '../providers/internetarchive.js';
import { KemdikbudProvider } from '../providers/kemdikbud.js';
import { OpenAireProvider } from '../providers/openaire.js';
import { OpenLibraryProvider } from '../providers/openlibrary.js';
import { RepositoriProvider } from '../providers/repositori.js';
import { StoryWeaverProvider } from '../providers/storyweaver.js';
import type {
  BookProvider,
  BookSearchQuery,
  BookSortOption,
  BookSourceFilter,
  ProviderBook,
} from '../providers/types.js';
import { WikibooksProvider } from '../providers/wikibooks.js';
import { WikisourceProvider } from '../providers/wikisource.js';
import { ZenodoProvider } from '../providers/zenodo.js';
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
  private wikibooks = new WikibooksProvider();
  private googleBooks = new GoogleBooksProvider();
  private kemdikbud = new KemdikbudProvider();
  private storyweaver = new StoryWeaverProvider();
  private bloom = new BloomLibraryProvider();
  private brin = new BrinProvider();
  private zenodo = new ZenodoProvider();
  private repositori = new RepositoriProvider();
  private openaire = new OpenAireProvider();

  // ponytail: bounded 60-entry in-memory TTL cache cuts repeat provider latency; upgrade to Redis/SQLite if horizontal scaling is added
  private searchCache = new Map<string, CachedSearchEntry>();

  private getProviderMap(): Record<Exclude<BookSourceFilter, 'all'>, BookProvider> {
    return {
      openlibrary: this.openLibrary,
      internetarchive: this.internetArchive,
      kemdikbud: this.kemdikbud,
      googlebooks: this.googleBooks,
      wikisource: this.wikisource,
      wikibooks: this.wikibooks,
      storyweaver: this.storyweaver,
      bloom: this.bloom,
      brin: this.brin,
      zenodo: this.zenodo,
      repositori: this.repositori,
      openaire: this.openaire,
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
    const isWildcardPing = trimmed === '*' && (query.limit || 30) <= 5;
    const activeEntries: Array<[Exclude<BookSourceFilter, 'all'>, BookProvider]> =
      sourceFilter !== 'all' && providersMap[sourceFilter]
        ? [[sourceFilter, providersMap[sourceFilter]]]
        : isWildcardPing || query.fastMode
          ? [
              ['openlibrary', this.openLibrary],
              ['internetarchive', this.internetArchive],
              ['kemdikbud', this.kemdikbud],
              ['storyweaver', this.storyweaver],
              ['bloom', this.bloom],
              ['brin', this.brin],
              ['googlebooks', this.googleBooks],
            ]
          : [
              ['openlibrary', this.openLibrary],
              ['internetarchive', this.internetArchive],
              ['kemdikbud', this.kemdikbud],
              ['storyweaver', this.storyweaver],
              ['bloom', this.bloom],
              ['brin', this.brin],
              ['wikibooks', this.wikibooks],
              ['wikisource', this.wikisource],
              ['zenodo', this.zenodo],
              ['repositori', this.repositori],
              ['openaire', this.openaire],
              ['googlebooks', this.googleBooks],
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
    const ranSw = activeEntries.some(([key]) => key === 'storyweaver');
    const ranBloom = activeEntries.some(([key]) => key === 'bloom');
    const ranBrin = activeEntries.some(([key]) => key === 'brin');
    const ranKemdikbud = activeEntries.some(([key]) => key === 'kemdikbud');

    let estimatedTotal = sorted.length;
    if (sourceFilter === 'internetarchive') {
      estimatedTotal = this.internetArchive.lastTotalFound || sorted.length;
    } else if (sourceFilter === 'openlibrary') {
      estimatedTotal = this.openLibrary.lastTotalFound || sorted.length;
    } else if (sourceFilter === 'storyweaver' && !hasYearFilter) {
      estimatedTotal = this.storyweaver.lastTotalFound || sorted.length;
    } else if (sourceFilter === 'all') {
      const baseMain = Math.max(
        sorted.length,
        ranIa ? this.internetArchive.lastTotalFound || 0 : 0,
        !query.freeOnly && ranOl ? this.openLibrary.lastTotalFound || 0 : 0
      );
      const extraCatalogs =
        !hasYearFilter
          ? (ranSw ? this.storyweaver.lastTotalFound : 0) +
            (ranBloom ? this.bloom.lastTotalFound : 0) +
            (ranBrin ? this.brin.lastTotalFound : 0) +
            (ranKemdikbud ? this.kemdikbud.lastTotalFound : 0)
          : 0;
      estimatedTotal = baseMain + extraCatalogs;
    }

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
   * Search by ISBN with parallel provider lookup.
   */
  async searchByIsbn(isbn: string): Promise<ProviderBook[]> {
    const settled = await Promise.allSettled([
      this.kemdikbud.getByIsbn(isbn),
      this.openLibrary.getByIsbn(isbn),
      this.googleBooks.getByIsbn(isbn),
    ]);

    const results: ProviderBook[] = [];
    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value && item.value.isIndonesianVerified) {
        results.push(item.value);
      }
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
