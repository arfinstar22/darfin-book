import { Capacitor } from '@capacitor/core';
import type {
  Book,
  BookSortOption,
  BookSourceFilter,
  CuratedShelf,
  ReaderResolution,
  UserProfile,
  BookmarkItem,
  ReadingProgressItem,
} from './types.js';

export const API_BASE =
  typeof window !== 'undefined' &&
  window.location.origin &&
  window.location.origin.includes('onrender.com')
    ? '/api/v1'
    : 'https://darfin-book.onrender.com/api/v1';

export async function getAuthConfigApi(): Promise<{ googleClientId: string; hasGoogleOAuth: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (res.ok) {
      return res.json();
    }
  } catch {
    // fallback if offline or error
  }
  return { googleClientId: '', hasGoogleOAuth: false };
}

export async function getGoogleAuthUrlApi(platform?: string): Promise<{ configured: boolean; url?: string; error?: string }> {
  try {
    const url = new URL(`${API_BASE}/auth/google/url`, window.location.origin);
    if (platform) {
      url.searchParams.set('platform', platform);
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      return res.json();
    }
  } catch {
    // fallback
  }
  return { configured: false, error: 'Gagal menghubungi server untuk Google OAuth' };
}

export async function loginWithGoogleApi(payload: {
  email?: string;
  name?: string;
  picture?: string;
  googleId?: string;
  credential?: string;
}): Promise<{ user: UserProfile; token: string }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal masuk dengan akun Google');
  }
  return res.json();
}

export async function fetchUserLibraryApi(token: string): Promise<{
  books: Book[];
  favoriteIds: string[];
  bookmarks: BookmarkItem[];
  progress: ReadingProgressItem[];
}> {
  const res = await fetch(`${API_BASE}/user/library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal memuat perpustakaan pengguna');
  }
  return res.json();
}

export async function syncUserLibraryApi(
  clientData: {
    books: Book[];
    favoriteIds: string[];
    bookmarks: BookmarkItem[];
  },
  token: string
): Promise<{
  books: Book[];
  favoriteIds: string[];
  bookmarks: BookmarkItem[];
  progress: ReadingProgressItem[];
}> {
  const res = await fetch(`${API_BASE}/user/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(clientData),
  });
  if (!res.ok) {
    throw new Error('Gagal melakukan sinkronisasi perpustakaan ke cloud');
  }
  return res.json();
}

export async function clearUserShelfApi(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/user/shelf/clear`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal mengosongkan rak di server');
  }
}

export async function saveBookToShelfApi(book: Book, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/user/books`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ book }),
  });
  if (!res.ok) {
    throw new Error('Gagal menyimpan buku ke rak');
  }
}

export async function removeBookFromShelfApi(
  provider: string,
  providerId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/user/books/${encodeURIComponent(provider)}/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal menghapus buku dari rak');
  }
}

export async function toggleFavoriteBookApi(book: Book, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/user/favorites/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ book }),
  });
  if (!res.ok) {
    throw new Error('Gagal memperbarui status favorit');
  }
  const data = await res.json();
  return Boolean(data.isFavorite);
}

export async function saveBookmarkApi(
  bookmark: {
    bookId: string;
    locationType: string;
    locationValue: string;
    label?: string;
  },
  token: string
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/user/bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookmark),
  });
  if (!res.ok) {
    throw new Error('Gagal menyimpan pembatas buku');
  }
  const data = await res.json();
  return { id: data.bookmarkId };
}

export async function deleteBookmarkApi(bookmarkId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/user/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal menghapus pembatas buku');
  }
}

export async function saveReadingProgressApi(
  progress: {
    bookId: string;
    readerMode: string;
    locationType: string;
    locationValue: string;
    progressPercent?: number;
  },
  token: string
): Promise<void> {
  await fetch(`${API_BASE}/user/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(progress),
  });
}

export interface SearchResultResponse {
  books: Book[];
  total: number;
}

export interface SearchBookOptions {
  sort?: BookSortOption;
  yearFrom?: number;
  yearTo?: number;
  source?: BookSourceFilter;
}

export async function searchBooks(
  query: string,
  freeOnly = false,
  limit = 30,
  offset = 0,
  options?: SearchBookOptions
): Promise<SearchResultResponse> {
  const url = new URL(`${API_BASE}/search`, window.location.origin);
  url.searchParams.set('q', query);
  if (freeOnly) {
    url.searchParams.set('freeOnly', 'true');
  }
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('offset', offset.toString());
  if (options?.sort && options.sort !== 'relevance') {
    url.searchParams.set('sort', options.sort);
  }
  if (options?.yearFrom !== undefined) {
    url.searchParams.set('yearFrom', String(options.yearFrom));
  }
  if (options?.yearTo !== undefined) {
    url.searchParams.set('yearTo', String(options.yearTo));
  }
  if (options?.source && options.source !== 'all') {
    url.searchParams.set('source', options.source);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('Gagal memuat hasil pencarian');
  }
  const data = await res.json();
  return {
    books: data.books || [],
    total: typeof data.total === 'number' ? data.total : (data.books || []).length,
  };
}

export async function getCuratedShelves(): Promise<CuratedShelf[]> {
  const res = await fetch(`${API_BASE}/curated`);
  if (!res.ok) {
    throw new Error('Gagal memuat rekomendasi buku');
  }
  const data = await res.json();
  return data.shelves || [];
}

export async function lookupIsbn(isbn: string): Promise<Book[]> {
  const res = await fetch(`${API_BASE}/isbn/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isbn }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'ISBN tidak valid');
  }
  const data = await res.json();
  return data.books || [];
}

export async function resolveReader(book: Book): Promise<ReaderResolution> {
  const res = await fetch(`${API_BASE}/reader/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book }),
  });
  if (!res.ok) {
    throw new Error('Gagal menyiapkan pembaca buku');
  }
  return res.json();
}

export async function getWikisourceContent(
  pageId: string,
  provider: 'wikisource' | 'wikibooks' = 'wikisource'
): Promise<{
  title: string;
  html: string;
  licenseNotice: string;
  sourceUrl: string;
}> {
  const endpoint = provider === 'wikibooks' ? 'wikibooks' : 'wikisource';
  const res = await fetch(`${API_BASE}/${endpoint}/content/${encodeURIComponent(pageId)}`);
  if (!res.ok) {
    throw new Error(
      provider === 'wikibooks'
        ? 'Gagal memuat teks buku Wikibuku'
        : 'Gagal memuat teks naskah Wikisumber'
    );
  }
  return res.json();
}
