import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Feather,
  Landmark,
  Compass,
  Cpu,
  BookOpen,
  Sparkles,
  Search,
  Loader2,
  Layers,
  BookMarked,
} from 'lucide-react';
import { searchBooks } from '../api.js';
import { BookCard } from './BookCard.js';
import type { Book } from '../types.js';

interface ExploreViewProps {
  initialCategory?: string;
  onCategorySelect?: (query: string) => void;
  onBookSelect: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleFavorite: (book: Book) => void;
  favoriteIds: string[];
  isLoggedIn: boolean;
  onRequestLogin: (reason: 'save' | 'favorite' | 'bookmark') => void;
}

const CATEGORIES = [
  {
    id: 'all',
    title: 'Semua Koleksi (30.000+)',
    shortTitle: 'Semua Koleksi',
    query: '*',
    icon: Layers,
    color: 'teal',
  },
  {
    id: 'pelajaran',
    title: 'Buku Pelajaran Resmi (SD, SMP, SMA/SMK)',
    shortTitle: 'Buku Pelajaran',
    query: 'pelajaran',
    icon: GraduationCap,
    color: 'emerald',
  },
  {
    id: 'sastra',
    title: 'Sastra & Cerita Rakyat Nusantara',
    shortTitle: 'Sastra & Cerita',
    query: 'cerita',
    icon: Feather,
    color: 'amber',
  },
  {
    id: 'novel',
    title: 'Novel & Prosa Indonesia',
    shortTitle: 'Novel & Fiksi',
    query: 'novel',
    icon: BookMarked,
    color: 'purple',
  },
  {
    id: 'sejarah',
    title: 'Sejarah, Tokoh & Budaya',
    shortTitle: 'Sejarah & Tokoh',
    query: 'sejarah',
    icon: Landmark,
    color: 'blue',
  },
  {
    id: 'sains',
    title: 'Matematika & Sains',
    shortTitle: 'Matematika & IPA',
    query: 'matematika',
    icon: Cpu,
    color: 'indigo',
  },
  {
    id: 'bahasa',
    title: 'Bahasa & Literasi',
    shortTitle: 'Bahasa Indonesia',
    query: 'bahasa indonesia',
    icon: BookOpen,
    color: 'rose',
  },
];

export const ExploreView: React.FC<ExploreViewProps> = ({
  initialCategory,
  onBookSelect,
  onReadBook,
  onToggleFavorite,
  favoriteIds,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'all');

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);
  const [books, setBooks] = useState<Book[]>([]);
  const [totalCatalogCount, setTotalCatalogCount] = useState<number>(30607);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterFreeOnly, setFilterFreeOnly] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Fetch initial books whenever category or free filter changes
  useEffect(() => {
    let isMounted = true;
    const cat = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

    async function loadInitialCategoryBooks() {
      setIsLoading(true);
      setError(null);
      setBooks([]);
      setHasMore(true);

      try {
        const queryToFetch = searchFilter.trim() || cat.query;
        const res = await searchBooks(queryToFetch, filterFreeOnly, 30, 0);
        if (isMounted) {
          setBooks(res.books);
          setTotalCatalogCount(res.total || 30607);
          setHasMore(res.books.length >= 20 && res.books.length < (res.total || 30607));
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || 'Gagal memuat katalog buku');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialCategoryBooks();

    return () => {
      isMounted = false;
    };
  }, [activeCategory, filterFreeOnly]);

  // Handle server-side pagination for "Muat Lebih Banyak"
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const cat = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
      const queryToFetch = searchFilter.trim() || cat.query;
      const res = await searchBooks(queryToFetch, filterFreeOnly, 30, books.length);

      if (!res.books || res.books.length === 0) {
        setHasMore(false);
      } else {
        setBooks((prev) => {
          const seen = new Set(prev.map((b) => `${b.provider}:${b.providerId}`));
          const newlyAdded = res.books.filter((b) => !seen.has(`${b.provider}:${b.providerId}`));
          const updated = [...prev, ...newlyAdded];
          if (updated.length >= res.total || newlyAdded.length === 0) {
            setHasMore(false);
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Gagal memuat buku tambahan:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // In-view live query search submit
  const handleInViewSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchFilter.trim();
    const cat = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
    const queryToFetch = q || cat.query;

    setIsLoading(true);
    setError(null);
    setBooks([]);
    setHasMore(true);

    try {
      const res = await searchBooks(queryToFetch, filterFreeOnly, 30, 0);
      setBooks(res.books);
      setTotalCatalogCount(res.total || res.books.length);
      setHasMore(res.books.length >= 20 && res.books.length < (res.total || 30607));
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal mencari buku');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter books locally by search term if typed, or show all loaded books
  const filteredBooks = books.filter((b) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.authors?.some((a) => a.toLowerCase().includes(q)) ||
      b.subjects?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="pb-16 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-linear-to-r from-teal-900 via-slate-900 to-[#0B132B] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 px-3 py-1 text-xs font-semibold text-teal-300 mb-3">
            <Compass className="h-3.5 w-3.5" />
            <span>Katalog Lengkap Nusantara (30.000+ Koleksi)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Jelajahi 30.000+ Buku Legal &amp; Gratis
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed">
            Akses tak terbatas ke buku pelajaran resmi Kemendikdasmen Kurikulum Merdeka, karya sastra pujangga baru, naskah kuno nusantara, dan ensiklopedia terbuka.
          </p>

          {/* In-view search box */}
          <form onSubmit={handleInViewSearchSubmit} className="mt-5 relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Cari judul atau topik (Tekan Enter untuk cari)..."
              className="w-full rounded-full border border-white/20 bg-white/10 backdrop-blur-md py-2.5 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </form>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
          <Compass className="h-80 w-80 text-white" />
        </div>
      </div>

      {/* Category Pills & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8E5DF] dark:border-slate-800 pb-4">
        {/* Horizontal Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchFilter('');
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition shrink-0 ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Free Only Toggle */}
        <button
          type="button"
          onClick={() => setFilterFreeOnly(!filterFreeOnly)}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition self-start sm:self-auto shrink-0 ${
            filterFreeOnly
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-700'
          }`}
          title="Tampilkan hanya buku yang bebas dibaca 100%"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Akses Penuh Bebas</span>
        </button>
      </div>

      {/* Catalog Status Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-stone-500 dark:text-slate-400">
        <p>
          Menampilkan <span className="font-bold text-stone-800 dark:text-slate-200">{filteredBooks.length}</span> dari{' '}
          <span className="font-bold text-teal-600 dark:text-teal-400">
            {totalCatalogCount.toLocaleString('id-ID')}
          </span> buku tersedia di katalog
        </p>
        <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
          Koleksi Terverifikasi Bahasa Indonesia
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex min-h-[35vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <span className="text-xs font-medium text-stone-600 dark:text-slate-400">
            Menghubungkan ke katalog 30.000+ buku nusantara...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-6 text-center text-xs text-rose-700 dark:text-rose-300">
          <p className="font-bold mb-1">Gagal Menampilkan Buku</p>
          <p>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredBooks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#DCD8CE] dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-stone-300 dark:text-slate-600 mb-3" />
          <h4 className="text-base font-bold text-stone-800 dark:text-slate-200">
            Tidak ada buku yang cocok
          </h4>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
            Coba pilih kategori lain atau bersihkan kata kunci pencarian Anda.
          </p>
        </div>
      )}

      {/* Books Grid */}
      {!isLoading && !error && filteredBooks.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredBooks.map((book) => {
            const isFav = favoriteIds.includes(`${book.provider}:${book.providerId}`);
            return (
              <BookCard
                key={`${book.provider}:${book.providerId}`}
                book={book}
                isFavorite={isFav}
                onSelect={onBookSelect}
                onReadDirect={onReadBook}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}
        </div>
      )}

      {/* Load More Button with Server-side Pagination */}
      {hasMore && !isLoading && (
        <div className="text-center pt-6 pb-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-3.5 text-xs font-bold text-stone-800 dark:text-white shadow-md hover:bg-stone-50 dark:hover:bg-slate-700 transition disabled:opacity-60 cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                <span>Memuat 30 buku berikutnya...</span>
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 text-teal-600" />
                <span>Muat Lebih Banyak Buku (+30 Buku)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
