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

export interface Book {
  provider: 'openlibrary' | 'googlebooks' | 'wikisource' | 'kemdikbud' | 'internetarchive';
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
}
