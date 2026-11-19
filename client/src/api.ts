import type { Book, CuratedShelf, ReaderResolution } from './types.js';

const API_BASE = '/api/v1';

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
