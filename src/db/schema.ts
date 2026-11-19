import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  canonicalTitle: text('canonical_title').notNull(),
  subtitle: text('subtitle'),
  description: text('description'),
  firstPublishYear: integer('first_publish_year'),
  primaryLanguage: text('primary_language').default('id'),
  languageTag: text('language_tag').default('id-ID'),
  languageVerification: text('language_verification', {
    enum: ['VERIFIED', 'PROVIDER_DECLARED', 'UNKNOWN', 'DISPUTED'],
  }).default('PROVIDER_DECLARED'),
  languageEvidence: text('language_evidence'), // JSON string
  coverUrl: text('cover_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bookEditions = sqliteTable('book_editions', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  publisher: text('publisher'),
  publishDate: text('publish_date'),
  publishYear: integer('publish_year'),
  language: text('language').default('id'),
  languageCode: text('language_code').default('id'),
  languageTag: text('language_tag').default('id-ID'),
  languageVerification: text('language_verification', {
    enum: ['VERIFIED', 'PROVIDER_DECLARED', 'UNKNOWN', 'DISPUTED'],
  }).default('PROVIDER_DECLARED'),
  languageEvidence: text('language_evidence'), // JSON string
  pageCount: integer('page_count'),
  format: text('format'),
  isbn10: text('isbn10'),
  isbn13: text('isbn13'),
  editionName: text('edition_name'),
  coverUrl: text('cover_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const providerRecords = sqliteTable(
  'provider_records',
  {
    id: text('id').primaryKey(),
    editionId: text('edition_id').references(() => bookEditions.id, {
      onDelete: 'cascade',
    }),
    bookId: text('book_id').references(() => books.id, {
      onDelete: 'cascade',
    }),
    provider: text('provider').notNull(), // 'openlibrary' | 'googlebooks' | 'wikisource' | 'kemdikbud'
    providerWorkId: text('provider_work_id'),
    providerEditionId: text('provider_edition_id'),
    providerVolumeId: text('provider_volume_id'),
    providerItemId: text('provider_item_id'),
    sourceUrl: text('source_url'),
    rawMetadata: text('raw_metadata'), // JSON string
    fetchedAt: text('fetched_at').default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text('expires_at'),
  },
  (table) => ({
    providerIndex: uniqueIndex('provider_unique_idx').on(
      table.provider,
      table.providerWorkId,
      table.providerEditionId,
      table.providerVolumeId,
      table.providerItemId
    ),
  })
);

export const bookAccess = sqliteTable('book_access', {
  id: text('id').primaryKey(),
  editionId: text('edition_id')
    .notNull()
    .references(() => bookEditions.id, { onDelete: 'cascade' }),
  providerRecordId: text('provider_record_id')
    .notNull()
    .references(() => providerRecords.id, { onDelete: 'cascade' }),
  countryCode: text('country_code').default('ID').notNull(),
  status: text('status', {
    enum: [
      'FULL_ACCESS',
      'PREVIEW',
      'BORROW_AVAILABLE',
      'BORROW_WAITLIST',
      'BORROWED_BY_USER',
      'CHECKED_OUT',
      'RESTRICTED',
      'EXTERNAL_READER',
      'METADATA_ONLY',
      'UNKNOWN',
    ],
  }).notNull(),
  matchQuality: text('match_quality', {
    enum: ['EXACT', 'SIMILAR', 'UNKNOWN'],
  }).default('EXACT'),
  readerMode: text('reader_mode', {
    enum: [
      'INTERNAL_PDF',
      'INTERNAL_EPUB',
      'WIKISOURCE_TEXT',
      'GOOGLE_EMBEDDED',
      'PROVIDER_READER',
      'PREVIEW_ONLY',
      'UNAVAILABLE',
    ],
  }).notNull(),
  officialItemUrl: text('official_item_url'),
  previewUrl: text('preview_url'),
  downloadUrl: text('download_url'),
  embeddable: integer('embeddable', { mode: 'boolean' }).default(false),
  checkedAt: text('checked_at').default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at'),
  accessNotes: text('access_notes'),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const userIdentities = sqliteTable(
  'user_identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'telegram' | 'email'
    providerUserId: text('provider_user_id').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdentityIdx: uniqueIndex('user_identity_provider_uid_idx').on(
      table.provider,
      table.providerUserId
    ),
  })
);

export const userBooks = sqliteTable('user_books', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull(),
  provider: text('provider'),
  providerId: text('provider_id'),
  bookData: text('book_data'), // JSON serialization of ProviderBook
  shelfStatus: text('shelf_status', {
    enum: ['SAVED', 'FAVORITE', 'WANT_TO_READ', 'READING', 'COMPLETED', 'ABANDONED'],
  }).default('SAVED'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const readingProgress = sqliteTable('reading_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull(),
  editionId: text('edition_id'),
  readerMode: text('reader_mode').notNull(),
  locationType: text('location_type', {
    enum: ['PDF_PAGE', 'EPUB_CFI', 'PROVIDER_POSITION', 'WIKISOURCE_SECTION'],
  }).notNull(),
  locationValue: text('location_value').notNull(),
  progressPercent: real('progress_percent'),
  lastReadAt: text('last_read_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull(),
  editionId: text('edition_id'),
  locationType: text('location_type').notNull(),
  locationValue: text('location_value').notNull(),
  label: text('label'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const searchHistory = sqliteTable('search_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  queryHash: text('query_hash'),
  queryDisplay: text('query_display'),
  searchedAt: text('searched_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bookRightsProvenance = sqliteTable('book_rights_provenance', {
  id: text('id').primaryKey(),
  editionId: text('edition_id').references(() => bookEditions.id, {
    onDelete: 'cascade',
  }),
  providerRecordId: text('provider_record_id').references(
    () => providerRecords.id,
    { onDelete: 'cascade' }
  ),
  contentSourceUrl: text('content_source_url').notNull(),
  contentRevisionId: text('content_revision_id'),
  rightsStatus: text('rights_status', {
    enum: [
      'PUBLIC_DOMAIN_VERIFIED',
      'OPEN_LICENSE_VERIFIED',
      'PROVIDER_PREVIEW_ONLY',
      'PROVIDER_BORROW_ONLY',
      'UNKNOWN',
      'RESTRICTED',
    ],
  }).notNull(),
  licenseIdentifier: text('license_identifier'),
  attributionText: text('attribution_text'),
  licenseUrl: text('license_url'),
  jurisdictionReview: text('jurisdiction_review'),
  reviewedAt: text('reviewed_at'),
  redistributionAllowed: integer('redistribution_allowed', {
    mode: 'boolean',
  }).default(false),
  internalRenderAllowed: integer('internal_render_allowed', {
    mode: 'boolean',
  }).default(false),
  notes: text('notes'),
});
