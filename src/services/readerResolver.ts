import type {
  AccessStatus,
  ProviderBook,
  ReaderMode,
} from '../providers/types.js';
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
}

export class ReaderResolverService {
  private wikisource = new WikisourceProvider();

  /**
   * Resolve appropriate reader experience based on provider signals and legal permissions.
   */
  async resolve(
    book: ProviderBook,
    options: { preferredMode?: 'AUTO' | 'INTERNAL' | 'EXTERNAL' } = {}
  ): Promise<ReaderResolution> {
    const access = book.access;

    // 1. Wikisource Texts: Render in-app with sanitized text and license attribution
    if (book.provider === 'wikisource') {
      const pageData = await this.wikisource.getPageContent(book.providerId);
      return {
        mode: 'WIKISOURCE_TEXT',
        accessStatus: 'FULL_ACCESS',
        sourceProvider: 'wikisource',
        launchUrl: book.sourceUrl,
        contentHtml: pageData?.html,
        explanation:
          'Karya domain publik / lisensi terbuka dari Wikisumber Bahasa Indonesia.',
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
      return {
        mode: 'PROVIDER_READER',
        accessStatus: access.status,
        sourceProvider: book.provider,
        launchUrl: access.officialItemUrl,
        explanation: access.explanation,
        canBookmark: access.canBookmark,
        canDownload: access.canDownload,
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
