import type { Book, CuratedShelf, ReaderResolution, UserProfile, BookmarkItem, ReadingProgressItem } from './types.js';

const API_BASE = '/api/v1';

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

export async function searchBooks(query: string, freeOnly = false): Promise<Book[]> {
  const url = new URL(`${API_BASE}/search`, window.location.origin);
  url.searchParams.set('q', query);
  if (freeOnly) {
    url.searchParams.set('freeOnly', 'true');
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('Gagal memuat hasil pencarian');
  }
  const data = await res.json();
  return data.books || [];
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

export async function getWikisourceContent(pageId: string): Promise<{
  title: string;
  html: string;
  licenseNotice: string;
  sourceUrl: string;
}> {
  const res = await fetch(`${API_BASE}/wikisource/content/${pageId}`);
  if (!res.ok) {
    throw new Error('Gagal memuat teks naskah Wikisumber');
  }
  return res.json();
}
