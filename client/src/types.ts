export type AccessStatus =
  | 'FULL_ACCESS'
  | 'PREVIEW'
  | 'BORROW_AVAILABLE'
  | 'BORROW_WAITLIST'
  | 'BORROWED_BY_USER'
  | 'CHECKED_OUT'
  | 'RESTRICTED'
  | 'EXTERNAL_READER'
  | 'METADATA_ONLY'
  | 'UNKNOWN';

export type ReaderMode =
  | 'INTERNAL_PDF'
  | 'INTERNAL_EPUB'
  | 'WIKISOURCE_TEXT'
  | 'GOOGLE_EMBEDDED'
  | 'PROVIDER_READER'
  | 'PREVIEW_ONLY'
  | 'UNAVAILABLE';

export interface ProviderAccess {
  status: AccessStatus;
  readerMode: ReaderMode;
  matchQuality: 'EXACT' | 'SIMILAR' | 'UNKNOWN';
  officialItemUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  embeddable?: boolean;
  explanation: string;
  canDownload: boolean;
  canBookmark: boolean;
}

export type BookProviderName =
  | 'openlibrary'
  | 'googlebooks'
  | 'wikisource'
  | 'wikibooks'
  | 'kemdikbud'
  | 'internetarchive'
  | 'storyweaver'
  | 'bloom'
  | 'brin'
  | 'zenodo'
  | 'repositori'
  | 'openaire';

export const PROVIDER_LABELS: Record<BookProviderName, string> = {
  kemdikbud: 'SIBI Kemendikdasmen',
  storyweaver: 'StoryWeaver (CC BY 4.0)',
  bloom: 'Bloom Library Indonesia',
  brin: 'Penerbit BRIN (Open Access)',
  wikisource: 'Wikisumber Indonesia',
  wikibooks: 'Wikibuku Indonesia',
  internetarchive: 'Internet Archive',
  openlibrary: 'Open Library',
  repositori: 'Repositori Kemendikdasmen',
  zenodo: 'Zenodo Open Access',
  openaire: 'OpenAIRE / DOAB',
  googlebooks: 'Google Buku',
};

export interface Book {
  provider: BookProviderName;
  providerId: string;
  providerWorkId?: string;
  title: string;
  subtitle?: string;
  authors: string[];
  description?: string;
  publisher?: string;
  publishedYear?: number;
  publishedDate?: string;
  language: string;
  languageCode: string;
  isIndonesianVerified: boolean;
  coverUrl?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  subjects?: string[];
  sourceUrl?: string;
  access: ProviderAccess;
}

export interface CuratedShelf {
  id: string;
  title: string;
  subtitle: string;
  books: Book[];
}

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

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface BookmarkItem {
  id: string;
  bookId: string;
  locationType: string;
  locationValue: string;
  label?: string | null;
  createdAt?: string | null;
}

export interface ReadingProgressItem {
  id: string;
  bookId: string;
  readerMode: string;
  locationType: string;
  locationValue: string;
  progressPercent?: number | null;
  lastReadAt?: string | null;
}

export type BookSortOption =
  | 'relevance'
  | 'newest'
  | 'oldest'
  | 'popular'
  | 'title_asc'
  | 'title_desc';

export type BookSourceFilter = 'all' | BookProviderName;

export interface CatalogFilterState {
  sort: BookSortOption;
  yearFrom?: number;
  yearTo?: number;
  source: BookSourceFilter;
}

export function formatCatalogCount(count: number): string {
  if (!count || count < 1000) return '100.000+';
  const thousands = Math.floor(count / 1000);
  return `${thousands.toLocaleString('id-ID')}.000+`;
}
