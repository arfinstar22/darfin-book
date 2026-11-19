import { GoogleBooksProvider } from '../providers/googlebooks.js';
import { InternetArchiveProvider } from '../providers/internetarchive.js';
import { KemdikbudProvider } from '../providers/kemdikbud.js';
import { OpenLibraryProvider } from '../providers/openlibrary.js';
import type { BookSearchQuery, ProviderBook } from '../providers/types.js';
import { WikisourceProvider } from '../providers/wikisource.js';
import { validateIsbn } from '../utils/isbn.js';

export class SearchService {
  private openLibrary = new OpenLibraryProvider();
  private internetArchive = new InternetArchiveProvider();
  private wikisource = new WikisourceProvider();
  private googleBooks = new GoogleBooksProvider();
  private kemdikbud = new KemdikbudProvider();

  /**
   * Orchestrates search across all providers.
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

    // 2. Multi-provider parallel search
    const [openLibraryRes, iaRes, kemdikbudRes, wikisourceRes, googleBooksRes] =
      await Promise.allSettled([
        this.openLibrary.search(query),
        this.internetArchive.search(query),
        this.kemdikbud.search(query),
        this.wikisource.search(query),
        this.googleBooks.search(query),
      ]);

    const collected: ProviderBook[] = [];

    // Prioritize OpenLibrary, InternetArchive, Kemdikbud, then Wikisource for rich metadata & covers
    if (openLibraryRes.status === 'fulfilled') {
      collected.push(...openLibraryRes.value);
    }
    if (iaRes.status === 'fulfilled') {
      collected.push(...iaRes.value);
    }
    if (kemdikbudRes.status === 'fulfilled') {
      collected.push(...kemdikbudRes.value);
    }
    if (googleBooksRes.status === 'fulfilled') {
      collected.push(...googleBooksRes.value);
    }
    if (wikisourceRes.status === 'fulfilled') {
      collected.push(...wikisourceRes.value);
    }

    // Strict Indonesian filtering
    const indonesianOnly = collected.filter(
      (b) => b.isIndonesianVerified && b.languageCode === 'id'
    );

    // Deduplication by title similarity + primary ISBN
    const deduplicated = this.deduplicateBooks(indonesianOnly);

    // Smart ranking: Prioritize books with real cover images and verified full access
    deduplicated.sort((a, b) => {
      const score = (book: ProviderBook) => {
        let pts = 0;
        if (book.coverUrl) pts += 10;
        if (book.access.status === 'FULL_ACCESS') pts += 5;
        if (book.access.status === 'BORROW_AVAILABLE') pts += 3;
        return pts;
      };
      return score(b) - score(a);
    });

    const reqLimit = query.limit || 30;
    const estimatedTotal = Math.max(
      deduplicated.length,
      this.internetArchive.lastTotalFound || 0,
      query.freeOnly ? 0 : this.openLibrary.lastTotalFound || 0
    );

    return {
      query: trimmed,
      total: estimatedTotal,
      books: deduplicated.slice(0, reqLimit),
    };
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
