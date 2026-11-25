import { verifyIndonesianContent } from '../utils/language.js';
import {
  extractXmlTags,
  fetchWithTimeout,
  normalizeHttpsUrl,
  parseYearStrict,
} from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

const BRIN_OAI_BASE = 'https://penerbit.brin.go.id/index.php/press/oai';
const BRIN_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BRIN_MAX_OAI_PAGES = 5;

export class BrinProvider implements BookProvider {
  name = 'brin';
  lastTotalFound = 291;

  // ponytail: 12h in-memory OAI-PMH catalog cache (~291 records across <=5 pages) keeps search <1ms; upgrade to SQLite if catalog scales
  private cache: { books: ProviderBook[]; expiresAt: number } | null = null;
  private inflight: Promise<ProviderBook[]> | null = null;

  private parseOaiRecords(xml: string): { books: ProviderBook[]; resumptionToken?: string } {
    const books: ProviderBook[] = [];
    const blocks = xml.split('<record>');

    for (let i = 1; i < blocks.length; i++) {
      const recordXml = blocks[i];
      if (!recordXml.includes('<metadata>') || /<header[^>]*status="deleted"/i.test(recordXml)) {
        continue;
      }

      const headerId = extractXmlTags(recordXml, 'identifier')[0] || `brin-${i}`;
      const titles = extractXmlTags(recordXml, 'dc:title');
      const title = titles[0];
      if (!title) continue;

      const creators = extractXmlTags(recordXml, 'dc:creator');
      const descriptions = extractXmlTags(recordXml, 'dc:description');
      const description = descriptions[0];
      const subjects = extractXmlTags(recordXml, 'dc:subject').slice(0, 6);
      const publishers = extractXmlTags(recordXml, 'dc:publisher');
      const dates = extractXmlTags(recordXml, 'dc:date');
      const languages = extractXmlTags(recordXml, 'dc:language');
      const identifiers = extractXmlTags(recordXml, 'dc:identifier');
      const relations = extractXmlTags(recordXml, 'dc:relation');

      const langCheck = verifyIndonesianContent({
        rawLanguage: languages[0],
        title,
        description,
        provider: 'brin',
      });
      if (!langCheck.isEligibleForDefaultCatalog) {
        continue;
      }

      const catalogUrl = identifiers
        .map((id) => normalizeHttpsUrl(id))
        .find((u) => u && u.includes('penerbit.brin.go.id'));
      const viewerUrl = relations
        .map((rel) => normalizeHttpsUrl(rel))
        .find((u) => u && u.includes('penerbit.brin.go.id'));

      const officialUrl = viewerUrl || catalogUrl;
      if (!officialUrl) continue;

      const publishedYear = parseYearStrict(dates[0]);
      const providerId = headerId.split('/').pop()?.replace(/[^A-Za-z0-9_-]/g, '') || String(i);

      const access: ProviderAccess = {
        status: 'FULL_ACCESS',
        readerMode: 'PROVIDER_READER',
        matchQuality: 'EXACT',
        officialItemUrl: officialUrl,
        downloadUrl: viewerUrl,
        explanation:
          'Buku ilmiah dan pengetahuan populer Open Access resmi Penerbit BRIN (CC BY-NC-SA 4.0). Gratis dibaca & diunduh.',
        canDownload: true,
        canBookmark: true,
      };

      books.push({
        provider: 'brin',
        providerId,
        title,
        authors: creators.length > 0 ? creators : ['Penerbit BRIN'],
        description: description?.slice(0, 350),
        publisher: publishers[0] || 'Penerbit BRIN (Badan Riset dan Inovasi Nasional)',
        publishedYear,
        publishedDate: dates[0],
        language: langCheck.providerLanguageCode || 'id',
        languageCode: langCheck.languageCode,
        isIndonesianVerified: true,
        subjects,
        sourceUrl: catalogUrl || officialUrl,
        access,
        rawMetadata: { downloads: 150 },
      });
    }

    const tokenMatch = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/i);
    const resumptionToken = tokenMatch?.[1]?.trim() || undefined;
    return { books, resumptionToken };
  }

  private async getCatalog(): Promise<ProviderBook[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.books;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        // Fetch page 1 immediately (<= 3.5s) so first user search stays fast
        const firstUrl = `${BRIN_OAI_BASE}?verb=ListRecords&metadataPrefix=oai_dc`;
        const res = await fetchWithTimeout(
          firstUrl,
          { headers: { Accept: 'application/xml', 'User-Agent': 'DarfinBook/1.0' } },
          3500
        );
        if (!res.ok) return this.cache?.books || [];

        const firstXml = await res.text();
        const firstPage = this.parseOaiRecords(firstXml);
        if (firstPage.books.length > 0) {
          this.lastTotalFound = firstPage.books.length;
          this.cache = { books: firstPage.books, expiresAt: Date.now() + BRIN_CACHE_TTL_MS };
        }

        // Background harvest remaining OAI pages without blocking current request
        if (firstPage.resumptionToken) {
          void this.warmRemainingPages(firstPage.books, firstPage.resumptionToken);
        }

        return this.cache?.books || [];
      } catch {
        return this.cache?.books || [];
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }

  private async warmRemainingPages(initialBooks: ProviderBook[], initialToken: string): Promise<void> {
    const collected = [...initialBooks];
    let token: string | undefined = initialToken;

    try {
      for (let page = 1; page < BRIN_MAX_OAI_PAGES && token; page++) {
        const nextUrl = `${BRIN_OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`;
        const res = await fetchWithTimeout(
          nextUrl,
          { headers: { Accept: 'application/xml', 'User-Agent': 'DarfinBook/1.0' } },
          4000
        );
        if (!res.ok) break;
        const xml = await res.text();
        const parsed = this.parseOaiRecords(xml);
        collected.push(...parsed.books);
        token = parsed.resumptionToken;
      }
      if (collected.length > initialBooks.length) {
        this.lastTotalFound = collected.length;
        this.cache = { books: collected, expiresAt: Date.now() + BRIN_CACHE_TTL_MS };
      }
    } catch {
      // Keep page 1 cached cleanly on background failure
    }
  }

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const all = await this.getCatalog();
    const q = query.query.toLowerCase().trim();
    const isBroad = !q || q === '*' || q === 'all' || q === 'semua' || q === 'indonesia';

    let matched = isBroad
      ? all
      : all.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.authors.some((a) => a.toLowerCase().includes(q)) ||
            b.subjects?.some((s) => s.toLowerCase().includes(q)) ||
            b.description?.toLowerCase().includes(q)
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
    const all = await this.getCatalog();
    return all.find((b) => b.providerId === providerId) || null;
  }
}
