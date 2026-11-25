import { fetchWithTimeout, normalizeHttpsUrl, parseYearStrict } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface BloomApiRecord {
  id?: string;
  baseUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUploaded?: string;
  summary?: string;
  tags?: string[];
  titles?: Array<{ lang?: string; title?: string }>;
  titleFromUpload?: string;
}

const BLOOM_API_URL = 'https://api.bloomlibrary.org/v1/books?lang=id&limit=500';
const BLOOM_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class BloomLibraryProvider implements BookProvider {
  name = 'bloom';
  lastTotalFound = 387;

  // ponytail: 6h in-memory cache of ~387 Bloom Indonesian books avoids unindexed API queries; upgrade to SQLite if >5000
  private cache: { books: ProviderBook[]; expiresAt: number } | null = null;
  private inflight: Promise<ProviderBook[]> | null = null;

  private mapRecord(item: BloomApiRecord): ProviderBook | null {
    if (!item.id) return null;
    const safeId = item.id.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(safeId)) return null;

    const idTitle = item.titles?.find((t) => t.lang === 'id')?.title;
    const rawTitle = idTitle || item.titleFromUpload || item.titles?.[0]?.title;
    if (!rawTitle) return null;

    const safeBase = normalizeHttpsUrl(item.baseUrl);
    const coverUrl = safeBase ? `${safeBase.replace(/\/?$/, '/')}thumbnail-256.png` : undefined;
    const officialUrl = `https://bloomlibrary.org/book/${encodeURIComponent(safeId)}`;

    const publishedYear =
      parseYearStrict(item.lastUploaded) ||
      parseYearStrict(item.updatedAt) ||
      parseYearStrict(item.createdAt);

    const subjects = (item.tags || [])
      .filter((t) => t.startsWith('topic:'))
      .map((t) => t.replace('topic:', '').trim())
      .filter(Boolean);

    const access: ProviderAccess = {
      status: 'FULL_ACCESS',
      readerMode: 'PROVIDER_READER',
      matchQuality: 'EXACT',
      officialItemUrl: officialUrl,
      explanation:
        'Buku digital berlisensi Creative Commons dari Bloom Library Indonesia. Dapat dibaca langsung secara gratis.',
      canDownload: true,
      canBookmark: true,
    };

    return {
      provider: 'bloom',
      providerId: safeId,
      title: rawTitle.trim(),
      authors: ['Bloom Library Indonesia'],
      description: item.summary?.trim() || undefined,
      publisher: 'SIL / Bloom Library',
      publishedYear,
      publishedDate: item.updatedAt?.split('T')[0],
      language: 'id',
      languageCode: 'id',
      isIndonesianVerified: true,
      coverUrl,
      subjects: subjects.length > 0 ? subjects : ['Buku Cerita'],
      sourceUrl: officialUrl,
      access,
      rawMetadata: { downloads: 100 },
    };
  }

  private async getBooks(): Promise<ProviderBook[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.books;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const res = await fetchWithTimeout(
          BLOOM_API_URL,
          { headers: { Accept: 'application/json', 'User-Agent': 'DarfinBook/1.0' } },
          5000
        );
        if (!res.ok) return this.cache?.books || [];

        const data = (await res.json()) as { results?: BloomApiRecord[] };
        const mapped = (data.results || [])
          .map((item) => this.mapRecord(item))
          .filter((b): b is ProviderBook => b !== null);

        if (mapped.length > 0) {
          this.lastTotalFound = mapped.length;
          this.cache = { books: mapped, expiresAt: Date.now() + BLOOM_CACHE_TTL_MS };
          return mapped;
        }
      } catch {
        // Keep search responsive if Bloom is unreachable
      } finally {
        this.inflight = null;
      }
      return this.cache?.books || [];
    })();

    return this.inflight;
  }

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const all = await this.getBooks();
    const q = query.query.toLowerCase().trim();
    const isBroad = !q || q === '*' || q === 'all' || q === 'semua' || q === 'indonesia';

    let matched = isBroad
      ? all
      : all.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.description?.toLowerCase().includes(q) ||
            b.subjects?.some((s) => s.toLowerCase().includes(q))
        );

    if (query.yearFrom !== undefined) {
      matched = matched.filter((b) => b.publishedYear !== undefined && b.publishedYear >= query.yearFrom!);
    }
    if (query.yearTo !== undefined) {
      matched = matched.filter((b) => b.publishedYear !== undefined && b.publishedYear <= query.yearTo!);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    return matched.slice(offset, offset + limit);
  }

  async getByIsbn(_isbn: string): Promise<ProviderBook | null> {
    return null;
  }

  async getById(providerId: string): Promise<ProviderBook | null> {
    const all = await this.getBooks();
    return all.find((b) => b.providerId === providerId) || null;
  }
}
