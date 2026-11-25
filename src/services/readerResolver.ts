import type {
  AccessStatus,
  ProviderBook,
  ReaderMode,
} from '../providers/types.js';
import { WikibooksProvider } from '../providers/wikibooks.js';
import { WikisourceProvider } from '../providers/wikisource.js';

export interface ReaderResolution {
  mode: ReaderMode;
  accessStatus: AccessStatus;
  sourceProvider: string;
  launchUrl?: string;
  contentHtml?: string;
  explanation: string;
  licenseNotice?: string;
  canBookmark: boolean;
  canDownload: boolean;
  iaIdentifier?: string;
  totalPages?: number;
  pdfUrl?: string;
  pageTemplateUrl?: string;
}

export class ReaderResolverService {
  private wikisource = new WikisourceProvider();
  private wikibooks = new WikibooksProvider();

  /**
   * Resolve appropriate reader experience based on provider signals and legal permissions.
   */
  async resolve(
    book: ProviderBook,
    options: { preferredMode?: 'AUTO' | 'INTERNAL' | 'EXTERNAL' } = {}
  ): Promise<ReaderResolution> {
    const access = book.access;

    // 1. Wikisource & Wikibooks Texts: Render in-app with sanitized text and license attribution
    if (book.provider === 'wikisource' || book.provider === 'wikibooks') {
      const wikiProvider = book.provider === 'wikibooks' ? this.wikibooks : this.wikisource;
      const pageData = await wikiProvider.getPageContent(book.providerId);
      const isWikibooks = book.provider === 'wikibooks';
      return {
        mode: 'WIKISOURCE_TEXT',
        accessStatus: 'FULL_ACCESS',
        sourceProvider: book.provider,
        launchUrl: book.sourceUrl,
        contentHtml: pageData?.html,
        explanation: isWikibooks
          ? 'Buku pembelajaran terbuka (CC BY-SA) dari Wikibuku Bahasa Indonesia.'
          : 'Karya domain publik / lisensi terbuka dari Wikisumber Bahasa Indonesia.',
        licenseNotice:
          pageData?.licenseNotice ||
          'Teks tersedia di bawah Lisensi Creative Commons Attribution-ShareAlike atau Domain Publik.',
        canBookmark: true,
        canDownload: true,
      };
    }

    // 2. Google Books Embedded Viewer
    if (
      book.provider === 'googlebooks' &&
      access.embeddable &&
      options.preferredMode !== 'EXTERNAL'
    ) {
      return {
        mode: 'GOOGLE_EMBEDDED',
        accessStatus: access.status,
        sourceProvider: 'googlebooks',
        launchUrl: access.previewUrl || access.officialItemUrl,
        explanation: access.explanation,
        canBookmark: access.canBookmark,
        canDownload: access.canDownload,
      };
    }

    // 3. Official Provider Reader (Open Library / Internet Archive Lending)
    if (access.status === 'FULL_ACCESS' || access.status === 'BORROW_AVAILABLE') {
      let iaIdentifier: string | undefined;
      let totalPages: number | undefined;
      let pdfUrl: string | undefined;
      let pageTemplateUrl: string | undefined;

      if (book.provider === 'internetarchive') {
        iaIdentifier = book.providerId;
      } else if (access.officialItemUrl?.includes('archive.org/embed/')) {
        const parts = access.officialItemUrl.split('archive.org/embed/');
        iaIdentifier = parts[1]?.split(/[?/#]/)[0];
      }

      // Security: Validate iaIdentifier against path traversal or injection characters
      if (iaIdentifier && !/^[a-zA-Z0-9_.\-]+$/.test(iaIdentifier)) {
        iaIdentifier = undefined;
      }

      if (iaIdentifier) {
        pageTemplateUrl = `https://archive.org/download/${iaIdentifier}/page/n{page}_w1200.jpg`;
        try {
          const metaRes = await fetch(`https://archive.org/metadata/${iaIdentifier}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (metaRes.ok) {
            const data = (await metaRes.json()) as any;
            if (data.metadata?.imagecount) totalPages = parseInt(data.metadata.imagecount, 10);
            if (!totalPages && data.metadata?.pages) totalPages = parseInt(data.metadata.pages, 10);

            const scandataFile = data.files?.find(
              (f: any) =>
                typeof f.name === 'string' &&
                !f.name.includes('..') &&
                !f.name.includes('/') &&
                (f.format === 'Scandata' || f.name?.endsWith('_scandata.xml'))
            );
            if (!totalPages && scandataFile) {
              const scRes = await fetch(
                `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(scandataFile.name)}`,
                {
                  headers: { Range: 'bytes=0-4096' },
                  signal: AbortSignal.timeout(2000),
                }
              );
              if (scRes.ok) {
                const text = await scRes.text();
                const match =
                  text.match(/<leafCount>(\d+)<\/leafCount>/i) ||
                  text.match(/leafCount="(\d+)"/i);
                if (match) totalPages = parseInt(match[1], 10);
              }
            }

            const pdfFile = data.files?.find(
              (f: any) =>
                (f.format === 'Text PDF' ||
                  f.format === 'Image Container PDF' ||
                  f.name?.toLowerCase().endsWith('.pdf')) &&
                !f.name?.includes('_text.pdf')
            );
            if (pdfFile) {
              pdfUrl = `https://archive.org/download/${iaIdentifier}/${pdfFile.name}`;
            }
          }
        } catch {
          // Gracefully continue with pageTemplateUrl
        }
      }

      return {
        mode: 'PROVIDER_READER',
        accessStatus: access.status,
        sourceProvider: book.provider,
        launchUrl: access.officialItemUrl,
        explanation: access.explanation,
        canBookmark: access.canBookmark,
        canDownload: access.canDownload,
        iaIdentifier,
        totalPages,
        pdfUrl: pdfUrl || access.downloadUrl,
        pageTemplateUrl,
      };
    }

    // 4. Preview Only
    if (access.status === 'PREVIEW') {
      return {
        mode: 'PREVIEW_ONLY',
        accessStatus: 'PREVIEW',
        sourceProvider: book.provider,
        launchUrl: access.previewUrl || access.officialItemUrl,
        explanation: access.explanation,
        canBookmark: false,
        canDownload: false,
      };
    }

    // 5. Metadata Only / Unavailable
    return {
      mode: 'UNAVAILABLE',
      accessStatus: 'METADATA_ONLY',
      sourceProvider: book.provider,
      launchUrl: book.sourceUrl,
      explanation: access.explanation,
      canBookmark: false,
      canDownload: false,
    };
  }
}
