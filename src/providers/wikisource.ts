import { env } from '../config/env.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

export class WikisourceProvider implements BookProvider {
  name = 'wikisource';

  private baseUrl = env.WIKISOURCE_API_BASE_URL;

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  /**
   * Search eligible Indonesian public-domain texts & books on Wikisource.
   */
  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const limit = query.limit ?? 15;
    const offset = query.offset ?? 0;

    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query.query);
    url.searchParams.set('srnamespace', '0|102'); // Main namespace & Index namespace (books)
    url.searchParams.set('srlimit', limit.toString());
    url.searchParams.set('sroffset', offset.toString());
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
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
        const cleanTitle = item.title
          .replace(/^Indeks:/i, '')
          .replace(/\.pdf$/i, '')
          .replace(/_/g, ' ');

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(item.title)}`,
          explanation:
            'Teks domain publik / berlisensi bebas dari Wikisumber Bahasa Indonesia. Bebas dibaca langsung secara lengkap.',
          canDownload: true,
          canBookmark: true,
        };

        results.push({
          provider: 'wikisource',
          providerId: item.pageid.toString(),
          title: cleanTitle,
          authors: ['Domain Publik / Karya Nusantara'],
          description: item.snippet.replace(/<[^>]+>/g, ''),
          publishedDate: item.timestamp.split('T')[0],
          language: 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          sourceUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(item.title)}`,
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
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('pageids', providerId);
    url.searchParams.set('prop', 'info|extracts');
    url.searchParams.set('explaintext', 'true');
    url.searchParams.set('exintro', 'true');
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString(), { headers: this.headers });
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

      return {
        provider: 'wikisource',
        providerId: page.pageid.toString(),
        title: cleanTitle,
        authors: ['Karya Nusantara / Wikisumber'],
        description: page.extract || 'Naskah teks lengkap dari Wikisumber Bahasa Indonesia.',
        language: 'id',
        languageCode: 'id',
        isIndonesianVerified: true,
        sourceUrl: page.canonicalurl || `https://id.wikisource.org/wiki/${encodeURIComponent(page.title)}`,
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'WIKISOURCE_TEXT',
          matchQuality: 'EXACT',
          officialItemUrl: page.canonicalurl,
          explanation: 'Teks domain publik lengkap dari Wikisumber Indonesia.',
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
   * Fetch complete, unabridged content.
   * If the work is split into subpages/chapters, fetch and combine all chapters in order.
   */
  async getPageContent(pageId: string): Promise<{
    title: string;
    html: string;
    chapters: Array<{ id: string; title: string }>;
    licenseNotice: string;
    sourceUrl: string;
  } | null> {
    try {
      // 1. Get page title from pageId
      const titleUrl = new URL(this.baseUrl);
      titleUrl.searchParams.set('action', 'query');
      titleUrl.searchParams.set('pageids', pageId);
      titleUrl.searchParams.set('format', 'json');

      const titleRes = await fetch(titleUrl.toString(), { headers: this.headers });
      if (!titleRes.ok) return null;

      const titleData = (await titleRes.json()) as {
        query?: { pages?: Record<string, { title: string }> };
      };
      const rawTitle = titleData.query?.pages?.[pageId]?.title;
      if (!rawTitle) return null;

      // Extract root title if currently viewing a subpage
      const rootTitle = rawTitle.includes('/') ? rawTitle.split('/')[0] : rawTitle;

      // 2. Discover all subpages/chapters
      const subUrl = new URL(this.baseUrl);
      subUrl.searchParams.set('action', 'query');
      subUrl.searchParams.set('list', 'allpages');
      subUrl.searchParams.set('apprefix', `${rootTitle}/`);
      subUrl.searchParams.set('aplimit', '50');
      subUrl.searchParams.set('format', 'json');

      const subRes = await fetch(subUrl.toString(), { headers: this.headers });
      const subData = subRes.ok
        ? ((await subRes.json()) as {
            query?: { allpages?: Array<{ pageid: number; title: string }> };
          })
        : null;
      const subpages = subData?.query?.allpages || [];

      // Sort chapters logically
      const sortedChapters = this.sortChapters(subpages, rootTitle);

      // 3. If subpages exist, parse and concatenate all chapters
      if (sortedChapters.length > 0) {
        const chapterContents: string[] = [];
        const chapterList: Array<{ id: string; title: string }> = [];

        // Fetch chapters in parallel (bounded batch)
        const parsedResults = await Promise.all(
          sortedChapters.slice(0, 30).map(async (chap, idx) => {
            const chapTitle = chap.title.replace(`${rootTitle}/`, '');
            const chapId = `chapter-${idx + 1}`;
            chapterList.push({ id: chapId, title: chapTitle });

            const content = await this.parseSinglePage(chap.pageid.toString());
            return {
              id: chapId,
              title: chapTitle,
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
          licenseNotice:
            'Teks lengkap naskah tersedia di bawah Lisensi Creative Commons Pengakuan-BerbagiSerupa atau Domain Publik. Sumber resmi: Wikisumber Bahasa Indonesia.',
          sourceUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(rootTitle)}`,
        };
      }

      // 4. If no subpages, fetch single root page
      const singleHtml = await this.parseSinglePage(pageId);
      return {
        title: rawTitle,
        html: singleHtml,
        chapters: [{ id: 'chapter-1', title: rawTitle }],
        licenseNotice:
          'Teks lengkap naskah tersedia di bawah Lisensi Creative Commons Pengakuan-BerbagiSerupa atau Domain Publik. Sumber resmi: Wikisumber Bahasa Indonesia.',
        sourceUrl: `https://id.wikisource.org/wiki/${encodeURIComponent(rawTitle)}`,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse and sanitize single MediaWiki page.
   */
  private async parseSinglePage(pageId: string): Promise<string> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('pageid', pageId);
    url.searchParams.set('prop', 'text');
    url.searchParams.set('format', 'json');
    url.searchParams.set('disableeditsection', 'true');

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return '';

    const data = (await res.json()) as { parse?: { text?: { '*': string } } };
    const rawHtml = data.parse?.text?.['*'] || '';

    // Sanitize Wikisource header templates, navigation boxes, edit markers, and active script vectors (XSS prevention)
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
      // Strip active script, style, embed, object, iframe, and form tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      // Strip inline javascript handlers (on*, e.g. onload, onerror, onclick)
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Strip javascript: and data:text/html URIs in href and src
      .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*(?:"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, '$1="#"');
  }

  /**
   * Sort chapter titles in natural reading order:
   * (Prakata / Pengantar -> Bab 1 -> Bab 2 ... -> Lampiran)
   */
  private sortChapters(
    pages: Array<{ pageid: number; title: string }>,
    rootTitle: string
  ): Array<{ pageid: number; title: string }> {
    return [...pages].sort((a, b) => {
      const titleA = a.title.replace(`${rootTitle}/`, '').toLowerCase();
      const titleB = b.title.replace(`${rootTitle}/`, '').toLowerCase();

      // Front matter first
      if (titleA.includes('kata sambutan') || titleA.includes('prakata') || titleA.includes('pengantar')) {
        return -1;
      }
      if (titleB.includes('kata sambutan') || titleB.includes('prakata') || titleB.includes('pengantar')) {
        return 1;
      }

      // Back matter last
      if (titleA.includes('lampiran') || titleA.includes('daftar pustaka')) {
        return 1;
      }
      if (titleB.includes('lampiran') || titleB.includes('daftar pustaka')) {
        return -1;
      }

      // Natural alphanumeric sort
      return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
}
