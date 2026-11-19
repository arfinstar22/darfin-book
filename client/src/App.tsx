import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Library,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import { searchBooks, getCuratedShelves } from './api.js';
import { AccountView } from './components/AccountView.js';
import { BookCard } from './components/BookCard.js';
import { BookDetailModal } from './components/BookDetailModal.js';
import { BottomNav, type NavTab } from './components/BottomNav.js';
import { ExploreView } from './components/ExploreView.js';
import { Navbar } from './components/Navbar.js';
import { ReaderModal } from './components/ReaderModal.js';
import { ShelfView } from './components/ShelfView.js';
import type { Book, CuratedShelf } from './types.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Book[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('darfin_dark_mode');
      if (savedTheme !== null) {
        return savedTheme === 'true';
      }
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sync dark mode class to html element
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('darfin_dark_mode', String(isDarkMode));
    } catch (e) {
      console.error(e);
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Curated Shelves for Home
  const [shelves, setShelves] = useState<CuratedShelf[]>([]);
  const [loadingShelves, setLoadingShelves] = useState(true);

  // Active Modals
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activeReadingBook, setActiveReadingBook] = useState<Book | null>(null);

  // Saved Books (Local Storage)
  const [savedBooks, setSavedBooks] = useState<Book[]>(() => {
    try {
      const stored = localStorage.getItem('darfin_saved_books');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync savedBooks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('darfin_saved_books', JSON.stringify(savedBooks));
    } catch (e) {
      console.error(e);
    }
  }, [savedBooks]);

  // Load curated shelves on initial load
  useEffect(() => {
    async function loadShelves() {
      setLoadingShelves(true);
      try {
        const data = await getCuratedShelves();
        setShelves(data);
      } catch (err) {
        console.error('Gagal memuat rak kurasi:', err);
      } finally {
        setLoadingShelves(false);
      }
    }
    loadShelves();
  }, []);

  // Handle Search Submission
  const handleSearch = async (queryText: string, onlyFree = freeOnly) => {
    const q = queryText.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCurrentTab('home');

    try {
      const books = await searchBooks(q, onlyFree);
      setSearchResults(books);
    } catch (err: unknown) {
      setSearchError((err as Error).message || 'Terjadi kesalahan saat mencari');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery, freeOnly);
  };

  const handleToggleFreeOnly = () => {
    const nextVal = !freeOnly;
    setFreeOnly(nextVal);
    if (searchQuery.trim()) {
      handleSearch(searchQuery, nextVal);
    }
  };

  // Saved books management
  const handleToggleSave = (book: Book) => {
    const exists = savedBooks.some(
      (b) => b.provider === book.provider && b.providerId === book.providerId
    );
    if (exists) {
      setSavedBooks((prev) =>
        prev.filter(
          (b) =>
            !(b.provider === book.provider && b.providerId === book.providerId)
        )
      );
    } else {
      setSavedBooks((prev) => [book, ...prev]);
    }
  };

  const handleClearShelf = () => {
    if (confirm('Kosongkan semua buku yang tersimpan di rak?')) {
      setSavedBooks([]);
    }
  };

  const handleClearAllData = () => {
    if (confirm('Hapus seluruh data lokal dan riwayat di peramban ini?')) {
      localStorage.clear();
      setSavedBooks([]);
      setSearchResults(null);
      setSearchQuery('');
      alert('Data lokal berhasil dibersihkan.');
    }
  };

  const isBookSaved = (book: Book) =>
    savedBooks.some(
      (b) => b.provider === book.provider && b.providerId === book.providerId
    );

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#080E1E] text-[#1A1A1A] dark:text-[#E2E8F0] pb-20 sm:pb-8 transition-colors duration-200">
      {/* Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        freeOnly={freeOnly}
        onToggleFreeOnly={handleToggleFreeOnly}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Tab: Beranda (Home) */}
        {currentTab === 'home' && (
          <div>
            {/* Searching Indicator */}
            {isSearching && (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
                <span className="text-sm font-medium text-stone-600 dark:text-slate-300">
                  Mencari buku berbahasa Indonesia...
                </span>
              </div>
            )}

            {/* Search Results Display */}
            {!isSearching && searchResults !== null && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#E8E5DF] dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                      Hasil Pencarian: &ldquo;{searchQuery}&rdquo;
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Ditemukan {searchResults.length} buku terverifikasi bahasa Indonesia
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSearchResults(null);
                      setSearchQuery('');
                    }}
                    className="text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:underline"
                  >
                    Kembali ke Beranda
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="flex min-h-[30vh] flex-col items-center justify-center p-8 text-center">
                    <Search className="h-10 w-10 text-stone-400 dark:text-slate-500 stroke-1" />
                    <h3 className="mt-3 text-base font-bold text-stone-800 dark:text-slate-200">
                      Buku Tidak Ditemukan
                    </h3>
                    <p className="mt-1 max-w-md text-xs text-stone-500 dark:text-slate-400">
                      Coba cari dengan kata kunci lain (contoh: &ldquo;matematika&rdquo;, &ldquo;cerita rakyat&rdquo;, atau nama penulis).
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {searchResults.map((book) => (
                      <BookCard
                        key={`${book.provider}-${book.providerId}`}
                        book={book}
                        onSelect={setSelectedBook}
                        onReadDirect={setActiveReadingBook}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Default Home Discovery (When not searching) */}
            {!isSearching && searchResults === null && (
              <div className="space-y-10">
                {/* Hero Editorial Card */}
                <section className="relative overflow-hidden rounded-3xl bg-[#0B132B] dark:bg-slate-900/90 border dark:border-slate-800 p-6 text-white sm:p-10 shadow-lg">
                  <div className="relative z-10 max-w-xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-xs">
                      <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                      <span>Koleksi Terbuka Resmi Indonesia</span>
                    </span>

                    <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl leading-tight">
                      Perpustakaan Digital untuk Semua.
                    </h1>

                    <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Ribuan buku berbahasa Indonesia dapat diakses langsung. Mulai dari buku teks pelajaran sekolah resmi Kurikulum Merdeka hingga naskah sastra klasik nusantara.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2.5">
                      <button
                        onClick={() => {
                          setSearchQuery('pelajaran');
                          handleSearch('pelajaran', true);
                        }}
                        className="rounded-xl bg-[#0D9488] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition"
                      >
                        Buku Pelajaran Sekolah
                      </button>
                      <button
                        onClick={() => {
                          setSearchQuery('cerita');
                          handleSearch('cerita', true);
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                      >
                        Sastra & Cerita Rakyat
                      </button>
                    </div>
                  </div>

                  {/* Decorative Subtle Background Elements */}
                  <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-teal-600/10 blur-3xl" />
                </section>

                {/* Curated Shelves Section */}
                {loadingShelves ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-slate-500" />
                  </div>
                ) : (
                  shelves.map((shelf) => (
                    <section key={shelf.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                            {shelf.title}
                          </h2>
                          <p className="text-xs text-stone-500 dark:text-slate-400">{shelf.subtitle}</p>
                        </div>

                        <button
                          onClick={() => {
                            setSearchQuery(shelf.id.includes('pelajaran') ? 'pelajaran' : 'cerita');
                            handleSearch(shelf.id.includes('pelajaran') ? 'pelajaran' : 'cerita', true);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:underline"
                        >
                          <span>Lihat Semua</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                        {shelf.books.slice(0, 4).map((book) => (
                          <BookCard
                            key={`${book.provider}-${book.providerId}`}
                            book={book}
                            onSelect={setSelectedBook}
                            onReadDirect={setActiveReadingBook}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Jelajahi */}
        {currentTab === 'explore' && (
          <ExploreView
            onCategorySelect={(catQuery) => {
              setSearchQuery(catQuery);
              handleSearch(catQuery, freeOnly);
            }}
          />
        )}

        {/* Tab: Rak Saya */}
        {currentTab === 'shelf' && (
          <ShelfView
            savedBooks={savedBooks}
            onSelectBook={setSelectedBook}
            onReadDirect={setActiveReadingBook}
            onRemoveFromShelf={handleToggleSave}
            onClearShelf={handleClearShelf}
          />
        )}

        {/* Tab: Akun */}
        {currentTab === 'account' && (
          <AccountView
            onClearAllData={handleClearAllData}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        )}
      </main>

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onRead={setActiveReadingBook}
          isSaved={isBookSaved(selectedBook)}
          onToggleSave={handleToggleSave}
        />
      )}

      {/* In-App Reader Modal */}
      {activeReadingBook && (
        <ReaderModal
          book={activeReadingBook}
          onClose={() => setActiveReadingBook(null)}
        />
      )}

      {/* Bottom Navigation for Mobile */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        savedCount={savedBooks.length}
      />
    </div>
  );
};
