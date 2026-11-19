import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import * as schema from './schema.js';

// Ensure data directory exists
const dbPath = path.resolve(process.cwd(), env.DATABASE_PATH);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite: DatabaseType = new Database(dbPath);
// Enable WAL mode for high performance & concurrency
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

/**
 * Initialize database tables if not already present.
 */
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      canonical_title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      first_publish_year INTEGER,
      primary_language TEXT DEFAULT 'id',
      language_tag TEXT DEFAULT 'id-ID',
      language_verification TEXT DEFAULT 'PROVIDER_DECLARED',
      language_evidence TEXT,
      cover_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS book_editions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      publisher TEXT,
      publish_date TEXT,
      publish_year INTEGER,
      language TEXT DEFAULT 'id',
      language_code TEXT DEFAULT 'id',
      language_tag TEXT DEFAULT 'id-ID',
      language_verification TEXT DEFAULT 'PROVIDER_DECLARED',
      language_evidence TEXT,
      page_count INTEGER,
      format TEXT,
      isbn10 TEXT,
      isbn13 TEXT,
      edition_name TEXT,
      cover_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS provider_records (
      id TEXT PRIMARY KEY,
      edition_id TEXT REFERENCES book_editions(id) ON DELETE CASCADE,
      book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_work_id TEXT,
      provider_edition_id TEXT,
      provider_volume_id TEXT,
      provider_item_id TEXT,
      source_url TEXT,
      raw_metadata TEXT,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS book_access (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL REFERENCES book_editions(id) ON DELETE CASCADE,
      provider_record_id TEXT NOT NULL REFERENCES provider_records(id) ON DELETE CASCADE,
      country_code TEXT DEFAULT 'ID' NOT NULL,
      status TEXT NOT NULL,
      match_quality TEXT DEFAULT 'EXACT',
      reader_mode TEXT NOT NULL,
      official_item_url TEXT,
      preview_url TEXT,
      download_url TEXT,
      embeddable INTEGER DEFAULT 0,
      checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      access_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      display_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      edition_id TEXT REFERENCES book_editions(id) ON DELETE CASCADE,
      shelf_status TEXT DEFAULT 'SAVED',
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      edition_id TEXT NOT NULL REFERENCES book_editions(id) ON DELETE CASCADE,
      reader_mode TEXT NOT NULL,
      location_type TEXT NOT NULL,
      location_value TEXT NOT NULL,
      progress_percent REAL,
      last_read_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      edition_id TEXT NOT NULL REFERENCES book_editions(id) ON DELETE CASCADE,
      location_type TEXT NOT NULL,
      location_value TEXT NOT NULL,
      label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      query_hash TEXT,
      query_display TEXT,
      searched_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS book_rights_provenance (
      id TEXT PRIMARY KEY,
      edition_id TEXT REFERENCES book_editions(id) ON DELETE CASCADE,
      provider_record_id TEXT REFERENCES provider_records(id) ON DELETE CASCADE,
      content_source_url TEXT NOT NULL,
      content_revision_id TEXT,
      rights_status TEXT NOT NULL,
      license_identifier TEXT,
      attribution_text TEXT,
      license_url TEXT,
      jurisdiction_review TEXT,
      reviewed_at TEXT,
      redistribution_allowed INTEGER DEFAULT 0,
      internal_render_allowed INTEGER DEFAULT 0,
      notes TEXT
    );
  `);
}
