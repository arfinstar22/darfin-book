import { describe, expect, it } from 'vitest';
import type { ProviderBook } from '../providers/types.js';
import { sortProviderBooks } from '../services/search.js';
import { buildServer } from '../server.js';

const mockBook = (overrides: Partial<ProviderBook>): ProviderBook => ({
  provider: 'kemdikbud',
  providerId: 'id-1',
  title: 'Buku Uji',
  authors: ['Penulis'],
  language: 'id',
  languageCode: 'id',
  isIndonesianVerified: true,
  access: {
    status: 'FULL_ACCESS',
    readerMode: 'PROVIDER_READER',
    matchQuality: 'EXACT',
    explanation: 'OK',
    canDownload: true,
    canBookmark: true,
  },
  ...overrides,
});

describe('Catalog sorting and year filtering', () => {
  it('sorts books by newest, oldest, title, and popularity deterministically', () => {
    const books: ProviderBook[] = [
      mockBook({ providerId: 'a', title: 'Zebra Ilmu', publishedYear: 2015, rawMetadata: { downloads: 10 } }),
      mockBook({ providerId: 'b', title: 'Aljabar Dasar', publishedYear: 2023, rawMetadata: { downloads: 500 } }),
      mockBook({ providerId: 'c', title: 'Biologi Nusantara', publishedYear: undefined, rawMetadata: { downloads: 5 } }),
    ];

    const newest = sortProviderBooks(books, 'newest');
    expect(newest.map((b) => b.providerId)).toEqual(['b', 'a', 'c']);

    const oldest = sortProviderBooks(books, 'oldest');
    expect(oldest.map((b) => b.providerId)).toEqual(['a', 'b', 'c']);

    const popular = sortProviderBooks(books, 'popular');
    expect(popular.map((b) => b.providerId)).toEqual(['b', 'a', 'c']);

    const titleAsc = sortProviderBooks(books, 'title_asc');
    expect(titleAsc.map((b) => b.title)).toEqual(['Aljabar Dasar', 'Biologi Nusantara', 'Zebra Ilmu']);

    const titleDesc = sortProviderBooks(books, 'title_desc');
    expect(titleDesc.map((b) => b.title)).toEqual(['Zebra Ilmu', 'Biologi Nusantara', 'Aljabar Dasar']);
  });

  it('filters and sorts Kemdikbud catalog via /api/v1/search with validated query params', async () => {
    const server = await buildServer();

    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=pelajaran&source=kemdikbud&sort=newest&yearFrom=2023&yearTo=2022',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { books: ProviderBook[]; total: number };
    expect(body.books.length).toBeGreaterThan(0);
    for (const book of body.books) {
      expect(book.provider).toBe('kemdikbud');
      expect(book.publishedYear).toBeGreaterThanOrEqual(2022);
      expect(book.publishedYear).toBeLessThanOrEqual(2023);
    }
    expect(body.books[0].publishedYear).toBe(2023);

    // Rejects injection / malformed sort/year gracefully using safe defaults
    const badRes = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=pelajaran&source=kemdikbud&sort=evil_sql&yearFrom=2022]OR[1',
    });
    expect(badRes.statusCode).toBe(200);
    expect(badRes.json().books.length).toBeGreaterThan(0);
  });
});
