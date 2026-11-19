import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Library,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import {
  searchBooks,
  getCuratedShelves,
  fetchUserLibraryApi,
  saveBookToShelfApi,
  removeBookFromShelfApi,
  toggleFavoriteBookApi,
  saveBookmarkApi,
  deleteBookmarkApi,
} from './api.js';
import { AccountView } from './components/AccountView.js';
import { BookCard } from './components/BookCard.js';
import { BookDetailModal } from './components/BookDetailModal.js';
import { BottomNav, type NavTab } from './components/BottomNav.js';
import { ExploreView } from './components/ExploreView.js';
import { LoginModal } from './components/LoginModal.js';
import { Navbar } from './components/Navbar.js';
import { ReaderModal } from './components/ReaderModal.js';
import { ShelfView } from './components/ShelfView.js';
import type { Book, CuratedShelf, UserProfile, BookmarkItem } from './types.js';

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

  // User Authentication State
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('darfin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('darfin_token');
    } catch {
      return null;
    }
  });

  // Favorite Books IDs (Set of provider:providerId)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('darfin_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Reading Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const stored = localStorage.getItem('darfin_bookmarks');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Login Gate Modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<'save' | 'favorite' | 'bookmark' | 'general'>('general');
  const [pendingBookAction, setPendingBookAction] = useState<{
    type: 'save' | 'favorite';
    book: Book;
  } | null>(null);

  // Saved Books (Local Storage)
  const [savedBooks, setSavedBooks] = useState<Book[]>(() => {
    try {
      const stored = localStorage.getItem('darfin_saved_books');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync local data
  useEffect(() => {
    try {
      localStorage.setItem('darfin_saved_books', JSON.stringify(savedBooks));
      localStorage.setItem('darfin_favorites', JSON.stringify(favoriteIds));
      localStorage.setItem('darfin_bookmarks', JSON.stringify(bookmarks));
    } catch (e) {
      console.error(e);
    }
  }, [savedBooks, favoriteIds, bookmarks]);

  // Check for Google OAuth callback token in URL (?auth_token=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const authToken = params.get('auth_token');
      if (authToken) {
        setToken(authToken);
        localStorage.setItem('darfin_token', authToken);

        // Parse user profile immediately from signed token payload
        try {
          const parts = authToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const u: UserProfile = {
              id: payload.sub,
              email: payload.email,
              displayName: payload.name || payload.email?.split('@')[0] || 'Pengguna',
              avatarUrl: payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name || payload.email)}`,
            };
            setUser(u);
            localStorage.setItem('darfin_user', JSON.stringify(u));
          }
        } catch (e) {
          console.warn('Failed to parse token payload:', e);
        }

        // Confirm with server /api/v1/auth/me
        fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((res) => {
            if (res?.user) {
              setUser(res.user);
              localStorage.setItem('darfin_user', JSON.stringify(res.user));
            }
          })
          .catch(console.error);

        // Clean query string from browser URL bar
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_token');
        url.searchParams.delete('error');
        url.searchParams.delete('reason');
        window.history.replaceState({}, document.title, url.pathname);
      }
    } catch (e) {
      console.warn('OAuth URL parse error:', e);
    }
  }, []);

  // Sync library with server when logged in
  useEffect(() => {
    if (!token) return;
    async function syncLibrary() {
      try {
        const lib = await fetchUserLibraryApi(token!);
        if (lib.books && lib.books.length > 0) {
          setSavedBooks((prev) => {
            const map = new Map<string, Book>();
            for (const b of lib.books) map.set(`${b.provider}:${b.providerId}`, b);
            for (const b of prev) map.set(`${b.provider}:${b.providerId}`, b);
            return Array.from(map.values());
          });
        }
        if (lib.favoriteIds) {
          setFavoriteIds(lib.favoriteIds);
        }
        if (lib.bookmarks) {
          setBookmarks(lib.bookmarks);
        }
      } catch (err) {
        console.error('Gagal sinkronisasi perpustakaan:', err);
      }
    }
    syncLibrary();
  }, [token]);

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

  // Saved books management (Gated by Google Login)
  const handleToggleSave = async (book: Book) => {
    if (!user) {
      setLoginReason('save');
      setPendingBookAction({ type: 'save', book });
      setIsLoginModalOpen(true);
      return;
    }

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
      if (token) {
        removeBookFromShelfApi(book.provider, book.providerId, token).catch(console.error);
      }
    } else {
      setSavedBooks((prev) => [book, ...prev]);
      if (token) {
        saveBookToShelfApi(book, token).catch(console.error);
      }
    }
  };

  // Toggle Favorite (Gated by Google Login)
  const handleToggleFavorite = async (book: Book) => {
    if (!user) {
      setLoginReason('favorite');
      setPendingBookAction({ type: 'favorite', book });
      setIsLoginModalOpen(true);
      return;
    }

    const bookKey = `${book.provider}:${book.providerId}`;
    const wasFavorite = favoriteIds.includes(bookKey);

    if (wasFavorite) {
      setFavoriteIds((prev) => prev.filter((id) => id !== bookKey));
    } else {
      setFavoriteIds((prev) => [...prev, bookKey]);
      if (!savedBooks.some((b) => b.provider === book.provider && b.providerId === book.providerId)) {
        setSavedBooks((prev) => [book, ...prev]);
      }
    }

    if (token) {
      toggleFavoriteBookApi(book, token).catch(console.error);
    }
  };

  // Save Bookmark / Reading Marker (Gated by Google Login)
  const handleSaveBookmark = async (bookmarkData: {
    bookId: string;
    locationType: string;
    locationValue: string;
    label?: string;
  }) => {
    if (!user) {
      setLoginReason('bookmark');
      setIsLoginModalOpen(true);
      return;
    }

    const tempId = `bm_${Date.now()}`;
    const newBookmark: BookmarkItem = {
      id: tempId,
      bookId: bookmarkData.bookId,
      locationType: bookmarkData.locationType,
      locationValue: bookmarkData.locationValue,
      label: bookmarkData.label || 'Pembatas Halaman',
      createdAt: new Date().toISOString(),
    };

    setBookmarks((prev) => [newBookmark, ...prev]);

    if (token) {
      try {
        const res = await saveBookmarkApi(bookmarkData, token);
        setBookmarks((prev) =>
          prev.map((b) => (b.id === tempId ? { ...b, id: res.id } : b))
        );
      } catch (err) {
        console.error('Gagal simpan bookmark ke server:', err);
      }
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    if (token) {
      deleteBookmarkApi(bookmarkId, token).catch(console.error);
    }
  };

  const handleLoginSuccess = async (newUser: UserProfile, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    try {
      localStorage.setItem('darfin_user', JSON.stringify(newUser));
      localStorage.setItem('darfin_token', newToken);
    } catch (e) {
      console.error(e);
    }

    // Process pending action
    if (pendingBookAction) {
      const { type, book } = pendingBookAction;
      if (type === 'save') {
        setSavedBooks((prev) => [book, ...prev.filter(b => !(b.provider === book.provider && b.providerId === book.providerId))]);
        saveBookToShelfApi(book, newToken).catch(console.error);
      } else if (type === 'favorite') {
        const key = `${book.provider}:${book.providerId}`;
        setFavoriteIds((prev) => [...prev.filter(id => id !== key), key]);
        setSavedBooks((prev) => [book, ...prev.filter(b => !(b.provider === book.provider && b.providerId === book.providerId))]);
        toggleFavoriteBookApi(book, newToken).catch(console.error);
      }
      setPendingBookAction(null);
    }
  };

  const handleLogout = () => {
    if (confirm('Keluar dari Akun Google?')) {
      setUser(null);
      setToken(null);
      try {
        localStorage.removeItem('darfin_user');
        localStorage.removeItem('darfin_token');
      } catch (e) {
        console.error(e);
      }
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
      setFavoriteIds([]);
      setBookmarks([]);
      setUser(null);
      setToken(null);
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
        user={user}
        onOpenLogin={() => {
          setLoginReason('general');
          setIsLoginModalOpen(true);
        }}
        onNavigateAccount={() => {
          setCurrentTab('account');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
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
                        isFavorite={favoriteIds.includes(`${book.provider}:${book.providerId}`)}
                        onToggleFavorite={handleToggleFavorite}
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
                      Ribuan buku berbahasa Indonesia dapat diakses langsung tanpa login. Mulai dari buku teks pelajaran sekolah resmi Kurikulum Merdeka hingga naskah sastra klasik nusantara.
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
                            isFavorite={favoriteIds.includes(`${book.provider}:${book.providerId}`)}
                            onToggleFavorite={handleToggleFavorite}
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
            favoriteIds={favoriteIds}
            bookmarks={bookmarks}
            onSelectBook={setSelectedBook}
            onReadDirect={setActiveReadingBook}
            onRemoveFromShelf={handleToggleSave}
            onToggleFavorite={handleToggleFavorite}
            onClearShelf={handleClearShelf}
            user={user}
            onOpenLogin={() => {
              setLoginReason('save');
              setIsLoginModalOpen(true);
            }}
            onDeleteBookmark={handleDeleteBookmark}
          />
        )}

        {/* Tab: Akun */}
        {currentTab === 'account' && (
          <AccountView
            onClearAllData={handleClearAllData}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            user={user}
            onOpenLogin={() => {
              setLoginReason('general');
              setIsLoginModalOpen(true);
            }}
            onLogout={handleLogout}
            savedCount={savedBooks.length}
            favoriteCount={favoriteIds.length}
            bookmarkCount={bookmarks.length}
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
          isFavorite={favoriteIds.includes(`${selectedBook.provider}:${selectedBook.providerId}`)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* In-App Reader Modal */}
      {activeReadingBook && (
        <ReaderModal
          book={activeReadingBook}
          onClose={() => setActiveReadingBook(null)}
          isLoggedIn={Boolean(user)}
          onRequestLogin={(reason) => {
            setLoginReason(reason);
            setIsLoginModalOpen(true);
          }}
          onSaveBookmark={handleSaveBookmark}
          bookmarks={bookmarks}
        />
      )}

      {/* Google Login Gate Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setPendingBookAction(null);
        }}
        reason={loginReason}
        onLoginSuccess={handleLoginSuccess}
      />

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
