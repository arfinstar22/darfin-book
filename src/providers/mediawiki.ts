import { env } from '../config/env.js';
import { fetchWithTimeout } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

export interface MediaWikiProviderConfig {
  providerKey: 'wikisource' | 'wikibooks';
  apiBaseUrl: string;
  wikiPageBaseUrl: string;
  srnamespace: string;
  defaultAuthor: string;
  accessExplanation: string;
  idDescriptionFallback: string;
  licenseNotice: string;
  excludeTitlePrefixes?: string[];
}

/**
 * Shared MediaWiki full-text Indonesian book provider used by Wikisource and Wikibooks.
 */
export class MediaWikiBookProvider implements BookProvider {
  name: string;
  protected config: MediaWikiProviderConfig;

  protected headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  constructor(config: MediaWikiProviderConfig) {
    this.name = config.providerKey;
    this.config = config;
  }

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const rawQ = query.query.trim();
    if (!rawQ || rawQ === '*' || rawQ.toLowerCase() === 'all' || rawQ.toLowerCase() === 'semua') {
      // Broad wildcard query uses Indonesian topic fallback so MediaWiki returns rich results
      return this.runSearch({ ...query, query: this.config.providerKey === 'wikibooks' ? 'matematika' : 'cerita' });
    }
    return this.runSearch(query);
  }

  private async runSearch(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = Math.min(query.limit ?? 15, 25);
    const offset = query.offset ?? 0;

    const url = new URL(this.config.apiBaseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query.query);
    url.searchParams.set('srnamespace', this.config.srnamespace);
    url.searchParams.set('srlimit', limit.toString());
    url.searchParams.set('sroffset', offset.toString());
    if (query.sort === 'newest') {
      url.searchParams.set('srsort', 'create_timestamp_desc');
    } else if (query.sort === 'oldest') {
      url.searchParams.set('srsort', 'create_timestamp_asc');
    } else if (query.sort === 'popular') {
      url.searchParams.set('srsort', 'incoming_links_desc');
    }
    url.searchParams.set('format', 'json');

    try {
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers });
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
        if (
          this.config.excludeTitlePrefixes?.some((prefix) =>
            item.title.toLowerCase().startsWith(prefix.toLowerCase())
          )
        ) {
          continue;
        }

        const cleanTitle = item.title
          .replace(/^Indeks:/i, '')
          .replace(/\.pdf$/i, '')
          .replace(/_/g, ' ');

        const officialUrl = `${this.config.wikiPageBaseUrl}${encodeURIComponent(item.title)}`;
        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: officialUrl,
          explanation: this.config.accessExplanation,
          canDownload: true,
          canBookmark: true,
        };

        results.push({
          provider: this.config.providerKey,
          providerId: item.pageid.toString(),
          title: cleanTitle,
          authors: [this.config.defaultAuthor],
          description: item.snippet.replace(/<[^>]+>/g, ''),
          publishedDate: item.timestamp?.split('T')[0],
          language: 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          sourceUrl: officialUrl,
          access,
          rawMetadata: item,
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

  async getById(providerId: string): Promise<ProviderBook | null> {
    const url = new URL(this.config.apiBaseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('pageids', providerId);
    url.searchParams.set('prop', 'info|extracts');
    url.searchParams.set('explaintext', 'true');
    url.searchParams.set('exintro', 'true');
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers });
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

      const pageUrl = page.canonicalurl || `${this.config.wikiPageBaseUrl}${encodeURIComponent(page.title)}`;

      return {
        provider: this.config.providerKey,
        providerId: page.pageid.toString(),
        title: cleanTitle,
        authors: [this.config.defaultAuthor],
        description: page.extract || this.config.idDescriptionFallback,
        language: 'id',
        languageCode: 'id',
        isIndonesianVerified: true,
        sourceUrl: pageUrl,
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: pageUrl,
          explanation: this.config.accessExplanation,
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
   * Fetch complete, sanitized content including chapters/subpages in reading order.
   */
  async getPageContent(pageId: string): Promise<{
    title: string;
    html: string;
    chapters: Array<{ id: string; title: string }>;
    licenseNotice: string;
    sourceUrl: string;
  } | null> {
    if (!/^\d+$/.test(pageId)) return null;

    try {
      const titleUrl = new URL(this.config.apiBaseUrl);
      titleUrl.searchParams.set('action', 'query');
      titleUrl.searchParams.set('pageids', pageId);
      titleUrl.searchParams.set('format', 'json');

      const titleRes = await fetchWithTimeout(titleUrl.toString(), { headers: this.headers });
      if (!titleRes.ok) return null;

      const titleData = (await titleRes.json()) as {
        query?: { pages?: Record<string, { title: string }> };
      };
      const rawTitle = titleData.query?.pages?.[pageId]?.title;
      if (!rawTitle) return null;

      const rootTitle = rawTitle.includes('/') ? rawTitle.split('/')[0] : rawTitle;

      const subUrl = new URL(this.config.apiBaseUrl);
      subUrl.searchParams.set('action', 'query');
      subUrl.searchParams.set('list', 'allpages');
      subUrl.searchParams.set('apprefix', `${rootTitle}/`);
      subUrl.searchParams.set('aplimit', '50');
      subUrl.searchParams.set('format', 'json');

      const subRes = await fetchWithTimeout(subUrl.toString(), { headers: this.headers });
      const subData = subRes.ok
        ? ((await subRes.json()) as {
            query?: { allpages?: Array<{ pageid: number; title: string }> };
          })
        : null;
      const subpages = subData?.query?.allpages || [];

      const sortedChapters = this.sortChapters(subpages, rootTitle);

      if (sortedChapters.length > 0) {
        const chapterContents: string[] = [];
        const chapterList: Array<{ id: string; title: string }> = [];

        const parsedResults = await Promise.all(
          sortedChapters.slice(0, 30).map(async (chap, idx) => {
            const chapTitle = chap.title.replace(`${rootTitle}/`, '');
            const chapId = `chapter-${idx + 1}`;
            chapterList.push({ id: chapId, title: chapTitle });

            const content = await this.parseSinglePage(chap.pageid.toString());
            return {
              id: chapId,
              title: this.escapeText(chapTitle),
              html: content,
            };
          })
        );

        for (const chap of parsedResults) {
          chapterContents.push(`
            <section id="${chap.id}" class="chapter-container mb-12 scroll-mt-20">
              <div class="mb-6 flex items-center gap-3 border-b border-black/10 pb-3">
                <span class="rounded-full bg-teal-600/10 px-3 py-1 text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Bagian Buku
                </span>
                <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A]">${chap.title}</h2>
              </div>
              <div class="chapter-body space-y-4">
                ${chap.html}
              </div>
            </section>
          `);
        }

        return {
          title: rootTitle,
          html: chapterContents.join('\n'),
          chapters: chapterList,
          licenseNotice: this.config.licenseNotice,
          sourceUrl: `${this.config.wikiPageBaseUrl}${encodeURIComponent(rootTitle)}`,
        };
      }

      const singleHtml = await this.parseSinglePage(pageId);
      return {
        title: rawTitle,
        html: singleHtml,
        chapters: [{ id: 'chapter-1', title: rawTitle }],
        licenseNotice: this.config.licenseNotice,
        sourceUrl: `${this.config.wikiPageBaseUrl}${encodeURIComponent(rawTitle)}`,
      };
    } catch {
      return null;
    }
  }

  private escapeText(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async parseSinglePage(pageId: string): Promise<string> {
    const url = new URL(this.config.apiBaseUrl);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('pageid', pageId);
    url.searchParams.set('prop', 'text');
    url.searchParams.set('format', 'json');
    url.searchParams.set('disableeditsection', 'true');

    const res = await fetchWithTimeout(url.toString(), { headers: this.headers }, 6000);
    if (!res.ok) return '';

    const data = (await res.json()) as { parse?: { text?: { '*': string } } };
    const rawHtml = data.parse?.text?.['*'] || '';

    return this.sanitizeHtml(rawHtml);
  }

  /**
   * Defensive HTML sanitizer to neutralize Stored XSS vectors in scraped wiki content.
   */
  private sanitizeHtml(rawHtml: string): string {
    return rawHtml
      .replace(/<div id="headerContainer"[\s\S]*?<\/div>\s*<\/div>/gi, '')
      .replace(/<div class="[^"]*ws-noexport[^"]*"[\s\S]*?<\/div>/gi, '')
      .replace(/<span class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, '')
      .replace(/<table class="[^"]*headertemplate[^"]*"[\s\S]*?<\/table>/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*(?:"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, '$1="#"');
  }

  private sortChapters(
    pages: Array<{ pageid: number; title: string }>,
    rootTitle: string
  ): Array<{ pageid: number; title: string }> {
    return [...pages].sort((a, b) => {
      const titleA = a.title.replace(`${rootTitle}/`, '').toLowerCase();
      const titleB = b.title.replace(`${rootTitle}/`, '').toLowerCase();

      if (titleA.includes('kata sambutan') || titleA.includes('prakata') || titleA.includes('pengantar')) {
        return -1;
      }
      if (titleB.includes('kata sambutan') || titleB.includes('prakata') || titleB.includes('pengantar')) {
        return 1;
      }
      if (titleA.includes('lampiran') || titleA.includes('daftar pustaka')) {
        return 1;
      }
      if (titleB.includes('lampiran') || titleB.includes('daftar pustaka')) {
        return -1;
      }

      const numA = parseInt(titleA.match(/\d+/)?.[0] || '', 10);
      const numB = parseInt(titleB.match(/\d+/)?.[0] || '', 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }

      return titleA.localeCompare(titleB);
    });
  }
}
