import { env } from '../config/env.js';
import { fetchWithTimeout, normalizeHttpsUrl } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface StoryWeaverBook {
  id: number;
  title?: string;
  language?: string;
  level?: string;
  slug?: string;
  description?: string;
  readsCount?: number;
  authors?: Array<{ name?: string }>;
  publisher?: { name?: string };
  coverImage?: { sizes?: Array<{ url?: string }> };
}

export class StoryWeaverProvider implements BookProvider {
  name = 'storyweaver';
  lastTotalFound = 6787;

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = Math.min(query.limit ?? 20, 30);
    const offset = query.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const cleanQ = query.query.trim();
    const isBroad =
      !cleanQ ||
      cleanQ === '*' ||
      cleanQ.toLowerCase() === 'all' ||
      cleanQ.toLowerCase() === 'semua' ||
      cleanQ.toLowerCase() === 'indonesia';

    const url = new URL('https://storyweaver.org.in/api/v1/books-search');
    url.searchParams.append('languages[]', 'Bahasa Indonesia');
    url.searchParams.set('per_page', limit.toString());
    url.searchParams.set('page', page.toString());

    if (!isBroad) {
      url.searchParams.set('query', cleanQ);
    }
    if (query.sort === 'popular') {
      url.searchParams.set('sort', 'Most Read');
    } else if (query.sort === 'newest') {
      url.searchParams.set('sort', 'New Arrivals');
    }

    try {
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers }, 4000);
      if (!response.ok) return [];

      const json = (await response.json()) as {
        ok?: boolean;
        metadata?: { hits?: number };
        data?: StoryWeaverBook[];
      };

      if (typeof json.metadata?.hits === 'number') {
        this.lastTotalFound = json.metadata.hits;
      }

      const results: ProviderBook[] = [];
      for (const item of json.data || []) {
        if (!item.id || !item.title || !item.slug) continue;

        const officialUrl = `https://storyweaver.org.in/en/stories/${encodeURIComponent(item.slug)}`;
        const sizes = item.coverImage?.sizes || [];
        const rawCover = sizes[sizes.length - 1]?.url || sizes[0]?.url;
        const coverUrl = normalizeHttpsUrl(rawCover);

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: officialUrl,
          explanation:
            'Buku cerita bergambar berlisensi terbuka (CC BY 4.0) dari StoryWeaver Pratham Books & mitra literasi Indonesia.',
          canDownload: true,
          canBookmark: true,
        };

        results.push({
          provider: 'storyweaver',
          providerId: String(item.id),
          title: item.title.trim(),
          authors:
            item.authors?.map((a) => a.name).filter((n): n is string => Boolean(n)) || [
              'StoryWeaver',
            ],
          description: item.description?.trim() || undefined,
          publisher: item.publisher?.name || 'StoryWeaver / Badan Bahasa',
          language: 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          coverUrl,
          subjects: item.level ? ['Cerita Bergambar', `Level ${item.level}`] : ['Cerita Bergambar'],
          sourceUrl: officialUrl,
          access,
          rawMetadata: { downloads: item.readsCount || 0 },
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
