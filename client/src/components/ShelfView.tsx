import React, { useState } from 'react';
import { Bookmark, Trash2, BookOpen, Heart, Sparkles, RotateCw } from 'lucide-react';
import type { Book, BookmarkItem, CatalogFilterState, UserProfile } from '../types.js';
import { BookCard } from './BookCard.js';
import { CatalogControls } from './CatalogControls.js';
import { DEFAULT_CATALOG_FILTER, sortAndFilterBooksLocal } from '../utils/bookSort.js';

interface ShelfViewProps {
  savedBooks: Book[];
  favoriteIds?: string[];
  bookmarks?: BookmarkItem[];
  onSelectBook: (book: Book) => void;
  onReadDirect: (book: Book) => void;
  onRemoveFromShelf: (book: Book) => void;
  onToggleFavorite?: (book: Book) => void;
  onClearShelf: () => void;
  onSyncLibrary?: () => void;
  isSyncing?: boolean;
  user?: UserProfile | null;
  onOpenLogin?: () => void;
  onDeleteBookmark?: (id: string) => void;
}

export const ShelfView: React.FC<ShelfViewProps> = ({
  savedBooks,
  favoriteIds = [],
  bookmarks = [],
  onSelectBook,
  onReadDirect,
  onRemoveFromShelf,
  onToggleFavorite,
  onClearShelf,
  onSyncLibrary,
  isSyncing = false,
  user,
  onOpenLogin,
  onDeleteBookmark,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'bookmarks'>('all');
  const [filterState, setFilterState] = useState<CatalogFilterState>(DEFAULT_CATALOG_FILTER);

  const baseBooks = activeFilter === 'favorites'
    ? savedBooks.filter((b) => favoriteIds.includes(`${b.provider}:${b.providerId}`))
    : savedBooks;
  const displayedBooks = sortAndFilterBooksLocal(baseBooks, filterState);

  const isFavorite = (book: Book) => favoriteIds.includes(`${book.provider}:${book.providerId}`);

  return (
    <div className="pb-12">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
            Rak Buku Saya
          </h2>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400 truncate">
            {user
              ? `Tersinkronisasi akun Google (${user.email})`
              : 'Tersimpan lokal di perangkat ini'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user && onSyncLibrary && (
            <button
              type="button"
              onClick={onSyncLibrary}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/60 dark:bg-teal-950/40 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Sinkronkan dengan rak cloud"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
            </button>
          )}

          {savedBooks.length > 0 && activeFilter !== 'bookmarks' && (
            <button
              type="button"
              onClick={onClearShelf}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-2xs"
              title="Kosongkan seluruh rak buku"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kosongkan</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#E8E5DF] dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 ${
            activeFilter === 'all'
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border border-[#DCD8CE] dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-50'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Semua ({savedBooks.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter('favorites')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 ${
            activeFilter === 'favorites'
              ? 'bg-rose-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border border-[#DCD8CE] dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-50'
          }`}
        >
          <Heart className="h-3.5 w-3.5" />
          <span>Favorit ({favoriteIds.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter('bookmarks')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 ${
            activeFilter === 'bookmarks'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border border-[#DCD8CE] dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-50'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Pembatas ({bookmarks.length})</span>
        </button>
      </div>

      {/* Bookmarks List View */}
      {activeFilter === 'bookmarks' && (
        <div>
          {bookmarks.length === 0 ? (
            <div className="flex min-h-[35vh] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                <BookOpen className="h-7 w-7 stroke-1" />
              </div>
              <h3 className="mt-3 text-base font-bold text-stone-800 dark:text-slate-200">
                Belum Ada Pembatas Halaman
              </h3>
              <p className="mt-1 max-w-sm text-xs text-stone-500 dark:text-slate-400">
                Buka buku apa saja lalu tekan tombol &ldquo;Tandai Halaman&rdquo; di pembaca untuk menyimpan posisi bacaan Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="flex items-center justify-between rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                      <Bookmark className="h-5 w-5 fill-current" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                        {bm.label || 'Pembatas Halaman'}
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-slate-400">
                        Lokasi: {bm.locationValue}
                      </p>
                    </div>
                  </div>

                  {onDeleteBookmark && (
                    <button
                      onClick={() => onDeleteBookmark(bm.id)}
                      className="rounded-lg p-2 text-stone-400 hover:text-rose-600 transition"
                      title="Hapus Pembatas"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Books Grid */}
      {activeFilter !== 'bookmarks' && (
        <div className="space-y-5">
          {baseBooks.length > 0 && (
            <CatalogControls
              value={filterState}
              onChange={setFilterState}
              showPopularOption={false}
            />
          )}

          {displayedBooks.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-slate-800 text-stone-400 dark:text-slate-500">
                {activeFilter === 'favorites' ? (
                  <Heart className="h-8 w-8 stroke-1" />
                ) : (
                  <Bookmark className="h-8 w-8 stroke-1" />
                )}
              </div>
              <h3 className="mt-4 text-base font-bold text-stone-800 dark:text-slate-200">
                {baseBooks.length > 0
                  ? 'Tidak Ada Buku Cocok dengan Filter'
                  : activeFilter === 'favorites'
                    ? 'Belum Ada Buku Favorit'
                    : 'Rak Buku Masih Kosong'}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-stone-500 dark:text-slate-400">
                {baseBooks.length > 0
                  ? 'Coba ubah atau reset filter tahun dan sumber untuk melihat buku tersimpan Anda.'
                  : activeFilter === 'favorites'
                    ? 'Tekan ikon hati pada buku yang Anda sukai untuk menambahkannya ke koleksi favorit.'
                    : 'Simpan buku pelajaran atau novel favorit Anda untuk membacanya kembali kapan saja.'}
              </p>
              {baseBooks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterState(DEFAULT_CATALOG_FILTER)}
                  className="mt-4 min-h-[44px] rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
              {baseBooks.length === 0 && !user && onOpenLogin && (
                <button
                  onClick={onOpenLogin}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Masuk dengan Google untuk Sinkronisasi</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {displayedBooks.map((book) => (
                <BookCard
                  key={`${book.provider}-${book.providerId}`}
                  book={book}
                  onSelect={onSelectBook}
                  onReadDirect={onReadDirect}
                  isFavorite={isFavorite(book)}
                  onToggleFavorite={onToggleFavorite}
                  onRemove={onRemoveFromShelf}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
