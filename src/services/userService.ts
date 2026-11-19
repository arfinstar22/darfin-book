import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userIdentities, userBooks, bookmarks, readingProgress } from '../db/schema.js';
import { env } from '../config/env.js';
import type { ProviderBook } from '../providers/types.js';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * Deterministic user ID generation based on normalized Google email.
 * Guarantees that across all devices, browser sessions, and container restarts,
 * the same email always maps to the exact same user account ID.
 */
export function getDeterministicUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  return `usr_${hash}`;
}

export interface UserLibraryData {
  books: ProviderBook[];
  favoriteIds: string[]; // Set of `${provider}:${providerId}`
  bookmarks: Array<{
    id: string;
    bookId: string;
    locationType: string;
    locationValue: string;
    label?: string | null;
    createdAt?: string | null;
  }>;
  progress: Array<{
    id: string;
    bookId: string;
    readerMode: string;
    locationType: string;
    locationValue: string;
    progressPercent?: number | null;
    lastReadAt?: string | null;
  }>;
}

export class UserService {
  /**
   * Simple, secure, zero-dependency signed JWT session token.
   */
  generateSessionToken(user: UserProfile): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.displayName,
        picture: user.avatarUrl || null,
        iat: now,
        exp: now + 30 * 24 * 60 * 60, // 30 days
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Verifies session token and extracts user ID.
   */
  verifySessionToken(token: string): {
    userId: string;
    email: string;
    displayName?: string;
    avatarUrl?: string | null;
  } | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      return null;
    }

    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      const now = Math.floor(Date.now() / 1000);
      if (data.exp && data.exp < now) {
        return null;
      }
      return {
        userId: data.sub,
        email: data.email,
        displayName: data.name || data.email?.split('@')[0] || 'Pengguna',
        avatarUrl: data.picture || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Ensures that user record exists in the database.
   * If database was recreated (e.g. Render restart/redeploy), this seamlessly recreates the user record.
   */
  async ensureUser(session: {
    userId?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string | null;
  }): Promise<string> {
    const email = session.email ? session.email.trim().toLowerCase() : '';
    if (!email) {
      return session.userId || `usr_${crypto.randomUUID()}`;
    }
    const deterministicId = getDeterministicUserId(email);

    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return existing.id;
    }

    // Insert user record with deterministic ID
    try {
      db.insert(users)
        .values({
          id: deterministicId,
          email,
          displayName: session.displayName || email.split('@')[0],
          avatarUrl: session.avatarUrl || null,
        })
        .run();
    } catch {
      // Row may have been inserted in concurrent call
      const fallback = db.select().from(users).where(eq(users.email, email)).get();
      if (fallback) return fallback.id;
    }

    return deterministicId;
  }

  /**
   * Google Sign-In handler: Finds or creates user with verified Google email.
   */
  async loginWithGoogle(data: {
    email: string;
    name?: string;
    picture?: string;
    googleId?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Email akun Google tidak valid');
    }

    const displayName = data.name?.trim() || email.split('@')[0];
    const avatarUrl = data.picture || null;
    const deterministicId = getDeterministicUserId(email);

    // 1. Check existing user
    const existing = db.select().from(users).where(eq(users.email, email)).get();

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update name/avatar if changed
      db.update(users)
        .set({
          displayName: displayName || existing.displayName,
          avatarUrl: avatarUrl || existing.avatarUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .run();
    } else {
      userId = deterministicId;
      db.insert(users)
        .values({
          id: userId,
          email,
          displayName,
          avatarUrl,
        })
        .run();

      db.insert(userIdentities)
        .values({
          id: `ident_${crypto.randomUUID()}`,
          userId,
          provider: 'google',
          providerUserId: data.googleId || email,
        })
        .run();
    }

    const userProfile: UserProfile = {
      id: userId,
      email,
      displayName,
      avatarUrl,
    };

    const token = this.generateSessionToken(userProfile);
    return { user: userProfile, token };
  }

  /**
   * Fetches user's full library (saved books, favorites, bookmarks, reading progress).
   */
  async getUserLibrary(userId: string): Promise<UserLibraryData> {
    const rawBooks = db
      .select()
      .from(userBooks)
      .where(eq(userBooks.userId, userId))
      .all();

    const books: ProviderBook[] = [];
    const favoriteIds: string[] = [];

    for (const b of rawBooks) {
      if (b.bookData) {
        try {
          const parsed = JSON.parse(b.bookData) as ProviderBook;
          books.push(parsed);
        } catch {
          // Skip corrupt data
        }
      }
      if (b.isFavorite) {
        favoriteIds.push(`${b.provider}:${b.providerId}`);
      }
    }

    const userBookmarks = db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .all();

    const progressList = db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId))
      .all();

    return {
      books,
      favoriteIds,
      bookmarks: userBookmarks.map((bm) => ({
        id: bm.id,
        bookId: bm.bookId,
        locationType: bm.locationType,
        locationValue: bm.locationValue,
        label: bm.label,
        createdAt: bm.createdAt,
      })),
      progress: progressList.map((pr) => ({
        id: pr.id,
        bookId: pr.bookId,
        readerMode: pr.readerMode,
        locationType: pr.locationType,
        locationValue: pr.locationValue,
        progressPercent: pr.progressPercent,
        lastReadAt: pr.lastReadAt,
      })),
    };
  }

  /**
   * Save a book to user's shelf.
   */
  async saveBook(userId: string, book: ProviderBook, isFavorite: boolean = false): Promise<void> {
    const bookId = `${book.provider}:${book.providerId}`;

    const existing = db
      .select()
      .from(userBooks)
      .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
      .get();

    if (existing) {
      db.update(userBooks)
        .set({
          bookData: JSON.stringify(book),
          isFavorite: isFavorite ? true : existing.isFavorite,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userBooks.id, existing.id))
        .run();
    } else {
      db.insert(userBooks)
        .values({
          id: `ub_${crypto.randomUUID()}`,
          userId,
          bookId,
          provider: book.provider,
          providerId: book.providerId,
          bookData: JSON.stringify(book),
          isFavorite,
          shelfStatus: 'SAVED',
        })
        .run();
    }
  }

  /**
   * Remove a book from user's shelf.
   */
  async removeBook(userId: string, provider: string, providerId: string): Promise<void> {
    const bookId = `${provider}:${providerId}`;
    db.delete(userBooks)
      .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
      .run();
  }

  /**
   * Toggle favorite status on a book.
   */
  async toggleFavorite(userId: string, book: ProviderBook): Promise<boolean> {
    const bookId = `${book.provider}:${book.providerId}`;
    const existing = db
      .select()
      .from(userBooks)
      .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
      .get();

    if (existing) {
      const nextFavorite = !existing.isFavorite;
      db.update(userBooks)
        .set({
          isFavorite: nextFavorite,
          bookData: JSON.stringify(book),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userBooks.id, existing.id))
        .run();
      return nextFavorite;
    } else {
      // Create new book in shelf marked as favorite
      db.insert(userBooks)
        .values({
          id: `ub_${crypto.randomUUID()}`,
          userId,
          bookId,
          provider: book.provider,
          providerId: book.providerId,
          bookData: JSON.stringify(book),
          isFavorite: true,
          shelfStatus: 'FAVORITE',
        })
        .run();
      return true;
    }
  }

  /**
   * Save a bookmark / reading marker for a page or chapter.
   */
  async saveBookmark(
    userId: string,
    data: {
      bookId: string;
      locationType: string;
      locationValue: string;
      label?: string;
    }
  ): Promise<{ id: string }> {
    const id = `bm_${crypto.randomUUID()}`;
    db.insert(bookmarks)
      .values({
        id,
        userId,
        bookId: data.bookId,
        locationType: data.locationType,
        locationValue: data.locationValue,
        label: data.label || 'Pembatas Bacaan',
      })
      .run();
    return { id };
  }

  /**
   * Delete a bookmark.
   */
  async deleteBookmark(userId: string, bookmarkId: string): Promise<void> {
    db.delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.id, bookmarkId)))
      .run();
  }

  /**
   * Clear all books from user's shelf.
   */
  async clearShelf(userId: string): Promise<void> {
    db.delete(userBooks)
      .where(eq(userBooks.userId, userId))
      .run();
  }

  /**
   * Synchronize entire library: Merges client local data with server data,
   * returning the combined latest state.
   */
  async syncUserLibrary(
    userId: string,
    clientData: {
      books?: ProviderBook[];
      favoriteIds?: string[];
      bookmarks?: Array<{
        id?: string;
        bookId: string;
        locationType: string;
        locationValue: string;
        label?: string | null;
      }>;
    }
  ): Promise<UserLibraryData> {
    const clientFavoriteSet = new Set(clientData.favoriteIds || []);

    // 1. Insert/update any books sent by client that don't exist or need updating
    if (clientData.books && clientData.books.length > 0) {
      for (const book of clientData.books) {
        if (!book?.provider || !book?.providerId) continue;
        const key = `${book.provider}:${book.providerId}`;
        const isFav = clientFavoriteSet.has(key);
        await this.saveBook(userId, book, isFav);
      }
    }

    // 2. Fetch current server bookmarks to avoid duplicate bookmarks
    const currentBookmarks = db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .all();
    const serverBmKeys = new Set(currentBookmarks.map((bm) => `${bm.bookId}:${bm.locationValue}`));

    // 3. Sync client bookmarks
    if (clientData.bookmarks && clientData.bookmarks.length > 0) {
      for (const bm of clientData.bookmarks) {
        if (!bm?.bookId || !bm?.locationValue) continue;
        const key = `${bm.bookId}:${bm.locationValue}`;
        if (!serverBmKeys.has(key)) {
          await this.saveBookmark(userId, {
            bookId: bm.bookId,
            locationType: bm.locationType || 'PAGE',
            locationValue: bm.locationValue,
            label: bm.label || undefined,
          });
          serverBmKeys.add(key);
        }
      }
    }

    // 4. Return complete unified library
    return await this.getUserLibrary(userId);
  }

  /**
   * Save reading progress for a book.
   */
  async saveReadingProgress(
    userId: string,
    data: {
      bookId: string;
      readerMode: string;
      locationType: string;
      locationValue: string;
      progressPercent?: number;
    }
  ): Promise<void> {
    const existing = db
      .select()
      .from(readingProgress)
      .where(
        and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, data.bookId))
      )
      .get();

    if (existing) {
      db.update(readingProgress)
        .set({
          locationType: data.locationType as any,
          locationValue: data.locationValue,
          progressPercent: data.progressPercent ?? existing.progressPercent,
          lastReadAt: new Date().toISOString(),
        })
        .where(eq(readingProgress.id, existing.id))
        .run();
    } else {
      db.insert(readingProgress)
        .values({
          id: `prog_${crypto.randomUUID()}`,
          userId,
          bookId: data.bookId,
          readerMode: data.readerMode as any,
          locationType: data.locationType as any,
          locationValue: data.locationValue,
          progressPercent: data.progressPercent || 0,
        })
        .run();
    }
  }
}
