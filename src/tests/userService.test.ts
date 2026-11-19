import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../services/userService.js';
import { initDb } from '../db/index.js';
import type { ProviderBook } from '../providers/types.js';

describe('UserService - Google Authentication & Library Sync', () => {
  let userService: UserService;

  beforeEach(() => {
    initDb();
    userService = new UserService();
  });

  it('authenticates user with Google email and generates signed token', async () => {
    const googleProfile = {
      email: 'darfin.test@gmail.com',
      name: 'Darfin Star',
      picture: 'https://lh3.googleusercontent.com/a/test-avatar',
      googleId: 'google-sub-123456',
    };

    const res = await userService.loginWithGoogle(googleProfile);
    expect(res.user.email).toBe('darfin.test@gmail.com');
    expect(res.user.displayName).toBe('Darfin Star');
    expect(res.user.avatarUrl).toBe('https://lh3.googleusercontent.com/a/test-avatar');
    expect(res.token).toBeDefined();

    // Verify token
    const verified = userService.verifySessionToken(res.token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(res.user.id);
    expect(verified?.email).toBe('darfin.test@gmail.com');
  });

  it('rejects invalid email address', async () => {
    await expect(
      userService.loginWithGoogle({ email: 'not-an-email' })
    ).rejects.toThrow('Email akun Google tidak valid');
  });

  it('saves book, toggles favorite, and saves bookmark for authenticated user', async () => {
    const auth = await userService.loginWithGoogle({
      email: 'pembaca.indonesia@gmail.com',
      name: 'Pembaca Indonesia',
    });

    const mockBook: ProviderBook = {
      provider: 'wikisource',
      providerId: 'Cerita_Rakyat_Test',
      title: 'Cerita Rakyat Nusantara Test',
      authors: ['Anonim'],
      description: 'Dongeng nusantara untuk tes unit.',
      language: 'id',
      languageCode: 'id',
      isIndonesianVerified: true,
      access: {
        status: 'FULL_ACCESS',
        readerMode: 'WIKISOURCE_TEXT',
        matchQuality: 'EXACT',
        explanation: 'Domain publik',
        canDownload: true,
        canBookmark: true,
      },
    };

    // 1. Save book
    await userService.saveBook(auth.user.id, mockBook);

    // 2. Toggle favorite
    const favStatus = await userService.toggleFavorite(auth.user.id, mockBook);
    expect(favStatus).toBe(true);

    // 3. Save bookmark / page marker
    const bookmark = await userService.saveBookmark(auth.user.id, {
      bookId: 'wikisource:Cerita_Rakyat_Test',
      locationType: 'WIKISOURCE_SECTION',
      locationValue: 'Bab 2',
      label: 'Halaman 15 - Bab 2',
    });
    expect(bookmark.id).toBeDefined();

    // 4. Retrieve user library
    const lib = await userService.getUserLibrary(auth.user.id);
    expect(lib.books.length).toBeGreaterThan(0);
    expect(lib.books.some((b) => b.title === 'Cerita Rakyat Nusantara Test')).toBe(true);
    expect(lib.favoriteIds).toContain('wikisource:Cerita_Rakyat_Test');
    expect(lib.bookmarks.some((bm) => bm.label === 'Halaman 15 - Bab 2')).toBe(true);

    // 5. Delete bookmark
    await userService.deleteBookmark(auth.user.id, bookmark.id);
    const libAfter = await userService.getUserLibrary(auth.user.id);
    expect(libAfter.bookmarks.some((bm) => bm.id === bookmark.id)).toBe(false);

    // 6. Remove book from shelf
    await userService.removeBook(auth.user.id, 'wikisource', 'Cerita_Rakyat_Test');
    const libFinal = await userService.getUserLibrary(auth.user.id);
    expect(libFinal.books.some((b) => b.providerId === 'Cerita_Rakyat_Test')).toBe(false);

    // 7. Test syncUserLibrary (bidirectional client-server synchronization)
    const synced = await userService.syncUserLibrary(auth.user.id, {
      books: [mockBook],
      favoriteIds: ['wikisource:Cerita_Rakyat_Test'],
      bookmarks: [
        {
          bookId: 'wikisource:Cerita_Rakyat_Test',
          locationType: 'WIKISOURCE_SECTION',
          locationValue: 'Bab 5',
          label: 'Bookmark Baru dari HP',
        },
      ],
    });
    expect(synced.books.length).toBe(1);
    expect(synced.favoriteIds).toContain('wikisource:Cerita_Rakyat_Test');
    expect(synced.bookmarks.some((b) => b.label === 'Bookmark Baru dari HP')).toBe(true);

    // 8. Test clearShelf
    await userService.clearShelf(auth.user.id);
    const clearedLib = await userService.getUserLibrary(auth.user.id);
    expect(clearedLib.books.length).toBe(0);
  });
});
