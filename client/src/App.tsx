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
  syncUserLibraryApi,
  clearUserShelfApi,
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
import { HomeView } from './components/HomeView.js';
import { LoginModal } from './components/LoginModal.js';
import { Navbar } from './components/Navbar.js';
import { ReaderModal } from './components/ReaderModal.js';
import { ShelfView } from './components/ShelfView.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { Toast, type ToastMessage } from './components/Toast.js';
import type { Book, CuratedShelf, UserProfile, BookmarkItem } from './types.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [exploreCategory, setExploreCategory] = useState<string>('all');
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

  // Modern Confirmation Dialog State (Replaces native browser confirm/alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  // Modern Toast Notification System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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

  // Check for Google OAuth callback token in URL (?auth_token=...) and clean legacy error parameters
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const authToken = params.get('auth_token');
      const errorParam = params.get('error');

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
            addToast(`Selamat datang kembali, ${u.displayName}!`, 'success', 'Berhasil Masuk');
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
      }

      // Always clean lingering query string from browser URL bar (e.g. error, auth_token, reason)
      if (window.location.search) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('OAuth URL parse error:', e);
    }
  }, []);

  // Bidirectional cloud sync with server when logged in or on window focus
  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function syncLibrary() {
      try {
        let localBooks: Book[] = [];
        let localFavs: string[] = [];
        let localBm: BookmarkItem[] = [];

        try {
          const rawB = localStorage.getItem('darfin_saved_books');
          if (rawB) localBooks = JSON.parse(rawB);
          const rawF = localStorage.getItem('darfin_favorites');
          if (rawF) localFavs = JSON.parse(rawF);
          const rawM = localStorage.getItem('darfin_bookmarks');
          if (rawM) localBm = JSON.parse(rawM);
        } catch (e) {
          console.warn('Gagal membaca storage lokal:', e);
        }

        const unified = await syncUserLibraryApi(
          {
            books: localBooks,
            favoriteIds: localFavs,
            bookmarks: localBm,
          },
          token!
        );

        if (!isMounted) return;

        if (Array.isArray(unified.books)) {
          setSavedBooks(unified.books);
          localStorage.setItem('darfin_saved_books', JSON.stringify(unified.books));
        }
        if (Array.isArray(unified.favoriteIds)) {
          setFavoriteIds(unified.favoriteIds);
          localStorage.setItem('darfin_favorites', JSON.stringify(unified.favoriteIds));
        }
        if (Array.isArray(unified.bookmarks)) {
          setBookmarks(unified.bookmarks);
          localStorage.setItem('darfin_bookmarks', JSON.stringify(unified.bookmarks));
        }
      } catch (err) {
        console.error('Gagal sinkronisasi perpustakaan:', err);
      }
    }

    syncLibrary();

    // Re-sync when switching tabs or switching back to app window
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && token) {
        syncLibrary();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Silent background sync every 30 seconds while app is active
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && token) {
        syncLibrary();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [token, currentTab]);

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
      setSearchQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCurrentTab('home');

    try {
      const { books } = await searchBooks(q, onlyFree);
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
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
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
      addToast(`"${book.title}" dihapus dari rak buku.`, 'info');
      if (token) {
        removeBookFromShelfApi(book.provider, book.providerId, token).catch(console.error);
      }
    } else {
      setSavedBooks((prev) => [book, ...prev]);
      addToast(`"${book.title}" ditambahkan ke rak buku.`, 'success');
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
      addToast(`"${book.title}" dihapus dari favorit.`, 'info');
    } else {
      setFavoriteIds((prev) => [...prev, bookKey]);
      addToast(`"${book.title}" ditandai sebagai favorit!`, 'success');
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
    addToast('Pembatas bacaan berhasil disimpan.', 'success');

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
    addToast('Pembatas halaman dihapus.', 'info');
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
    addToast(`Selamat datang, ${newUser.displayName}!`, 'success', 'Login Berhasil');

    // Trigger immediate cloud synchronization upon login
    try {
      const rawB = localStorage.getItem('darfin_saved_books');
      const curBooks: Book[] = rawB ? JSON.parse(rawB) : savedBooks;
      const rawF = localStorage.getItem('darfin_favorites');
      const curFavs: string[] = rawF ? JSON.parse(rawF) : favoriteIds;
      const rawM = localStorage.getItem('darfin_bookmarks');
      const curBm: BookmarkItem[] = rawM ? JSON.parse(rawM) : bookmarks;

      syncUserLibraryApi(
        {
          books: curBooks,
          favoriteIds: curFavs,
          bookmarks: curBm,
        },
        newToken
      )
        .then((unified) => {
          if (Array.isArray(unified.books)) {
            setSavedBooks(unified.books);
            localStorage.setItem('darfin_saved_books', JSON.stringify(unified.books));
          }
          if (Array.isArray(unified.favoriteIds)) {
            setFavoriteIds(unified.favoriteIds);
            localStorage.setItem('darfin_favorites', JSON.stringify(unified.favoriteIds));
          }
          if (Array.isArray(unified.bookmarks)) {
            setBookmarks(unified.bookmarks);
            localStorage.setItem('darfin_bookmarks', JSON.stringify(unified.bookmarks));
          }
        })
        .catch(console.error);
    } catch (e) {
      console.warn('Sync on login error:', e);
    }

    // Process pending action
    if (pendingBookAction) {
      const { type, book } = pendingBookAction;
      if (type === 'save') {
        setSavedBooks((prev) => [book, ...prev.filter(b => !(b.provider === book.provider && b.providerId === book.providerId))]);
        saveBookToShelfApi(book, newToken).catch(console.error);
        addToast(`"${book.title}" berhasil disimpan ke rak.`, 'success');
      } else if (type === 'favorite') {
        const key = `${book.provider}:${book.providerId}`;
        setFavoriteIds((prev) => [...prev.filter(id => id !== key), key]);
        setSavedBooks((prev) => [book, ...prev.filter(b => !(b.provider === book.provider && b.providerId === book.providerId))]);
        toggleFavoriteBookApi(book, newToken).catch(console.error);
        addToast(`"${book.title}" ditambahkan ke favorit.`, 'success');
      }
      setPendingBookAction(null);
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Keluar dari Akun Google?',
      message: 'Sesi akun Anda akan ditutup. Riwayat baca dan rak yang tersinkronisasi tetap aman di server.',
      type: 'danger',
      confirmLabel: 'Ya, Keluar Akun',
      cancelLabel: 'Batal',
      onConfirm: () => {
        setUser(null);
        setToken(null);
        try {
          localStorage.removeItem('darfin_user');
          localStorage.removeItem('darfin_token');
        } catch (e) {
          console.error(e);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        addToast('Anda telah keluar dari akun Google.', 'info');
      },
    });
  };

  const handleClearShelf = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kosongkan Rak Buku?',
      message: 'Semua buku yang tersimpan di rak lokal dan cloud server akan dikosongkan. Anda yakin?',
      type: 'warning',
      confirmLabel: 'Kosongkan Rak',
      cancelLabel: 'Batal',
      onConfirm: () => {
        setSavedBooks([]);
        localStorage.removeItem('darfin_saved_books');
        if (token) {
          clearUserShelfApi(token).catch(console.error);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        addToast('Rak buku berhasil dikosongkan.', 'info');
      },
    });
  };

  const handleClearAllData = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Semua Data & Riwayat?',
      message: 'Semua data lokal termasuk rak, bookmark, dan sesi akun pada peramban ini akan dibersihkan.',
      type: 'danger',
      confirmLabel: 'Hapus Seluruh Data',
      cancelLabel: 'Batal',
      onConfirm: () => {
        localStorage.clear();
        setSavedBooks([]);
        setFavoriteIds([]);
        setBookmarks([]);
        setUser(null);
        setToken(null);
        setSearchResults(null);
        setSearchQuery('');
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        addToast('Seluruh data lokal berhasil dibersihkan.', 'success');
      },
    });
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
        onNavigateHome={() => {
          setSearchResults(null);
          setSearchQuery('');
          setCurrentTab('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateAccount={() => {
          setCurrentTab('account');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-3 sm:px-6 pt-4 pb-28 sm:pb-14">
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

            {/* Search Results Display (Only active when search query is not empty and results exist) */}
            {!isSearching && searchResults !== null && searchQuery.trim() !== '' && (
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
                    type="button"
                    onClick={() => {
                      setSearchResults(null);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-[#0D9488] dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    <span>✕ Tutup Pencarian &amp; Kembali ke Beranda</span>
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

            {/* Default Aesthetic Home Discovery (Rendered when not searching or query is cleared) */}
            {!isSearching && (searchResults === null || searchQuery.trim() === '') && (
              <HomeView
                shelves={shelves}
                loadingShelves={loadingShelves}
                onSelectBook={setSelectedBook}
                onReadBook={setActiveReadingBook}
                onToggleFavorite={handleToggleFavorite}
                favoriteIds={favoriteIds}
                onNavigateExplore={(catId) => {
                  setExploreCategory(catId || 'all');
                  setCurrentTab('explore');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSearchTopic={(topic) => {
                  setSearchQuery(topic);
                  handleSearch(topic, true);
                }}
              />
            )}
          </div>
        )}

        {/* Tab: Jelajahi */}
        {currentTab === 'explore' && (
          <ExploreView
            initialCategory={exploreCategory}
            onCategorySelect={(catQuery) => {
              setSearchQuery(catQuery);
              handleSearch(catQuery, freeOnly);
            }}
            onBookSelect={setSelectedBook}
            onReadBook={setActiveReadingBook}
            onToggleFavorite={handleToggleFavorite}
            favoriteIds={favoriteIds}
            isLoggedIn={Boolean(user)}
            onRequestLogin={(reason) => {
              setLoginReason(reason);
              setIsLoginModalOpen(true);
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
          if (tab === 'home') {
            setSearchResults(null);
            setSearchQuery('');
          }
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        savedCount={savedBooks.length}
      />

      {/* Custom Modern Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Floating Toast Notification Stack */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
