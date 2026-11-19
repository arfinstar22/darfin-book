/**
 * Core provider interfaces and normalized book models for DARFIN BOOK.
 */

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
  expiresAt?: string;
}

export interface ProviderBook {
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
  language: string; // Raw language string
  languageCode: string; // Normalized ISO 639-1 ('id')
  isIndonesianVerified: boolean;
  coverUrl?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  subjects?: string[];
  sourceUrl?: string;
  access: ProviderAccess;
  rawMetadata?: Record<string, unknown>;
}

export interface BookSearchQuery {
  query: string;
  type?: 'all' | 'title' | 'author' | 'isbn' | 'subject';
  language?: string; // defaults to 'id'
  limit?: number;
  offset?: number;
  freeOnly?: boolean;
}

export interface BookProvider {
  name: string;
  search(query: BookSearchQuery): Promise<ProviderBook[]>;
  getByIsbn(isbn: string): Promise<ProviderBook | null>;
  getById(providerId: string): Promise<ProviderBook | null>;
  getAccess?(book: ProviderBook, countryCode?: string): Promise<ProviderAccess>;
}
