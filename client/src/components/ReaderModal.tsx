import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sun,
  Moon,
  Coffee,
  ExternalLink,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  List,
  ChevronDown,
  BookOpen,
  Bookmark,
  Check,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  Loader2,
  Download,
} from 'lucide-react';
import { resolveReader, getWikisourceContent } from '../api.js';
import type { Book, ReaderResolution } from '../types.js';

interface ReaderModalProps {
  book: Book;
  onClose: () => void;
  isLoggedIn?: boolean;
  onRequestLogin?: (reason: 'bookmark') => void;
  onSaveBookmark?: (bookmark: {
    bookId: string;
    locationType: string;
    locationValue: string;
    label?: string;
  }) => void;
  bookmarks?: Array<{ id: string; locationValue: string; label?: string | null }>;
}

type ReaderTheme = 'paper' | 'sepia' | 'dark';

export const ReaderModal: React.FC<ReaderModalProps> = ({
  book,
  onClose,
  isLoggedIn = false,
  onRequestLogin,
  onSaveBookmark,
  bookmarks = [],
}) => {
  const [resolution, setResolution] = useState<ReaderResolution | null>(null);
  const [chapters, setChapters] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkSavedToast, setBookmarkSavedToast] = useState(false);

  // In-App Reader State
  const [useNativeReader, setUseNativeReader] = useState(true);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [imageLoading, setImageLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reader Settings
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [fontSize, setFontSize] = useState(18); // Default 18px for Wikisource
  const [isSerif, setIsSerif] = useState(true);
  const [showToc, setShowToc] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const totalPages = resolution?.totalPages || 100;

  // Sync page input when currentPage changes
  useEffect(() => {
    setPageInput(String(currentPage + 1));
  }, [currentPage]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any)?.webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen toggle error:', e);
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff < -50) {
      goToNextPage();
    } else if (diff > 50) {
      goToPrevPage();
    }
    touchStartX.current = null;
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setImageLoading(true);
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setImageLoading(true);
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleBookmarkClick = () => {
    if (!isLoggedIn) {
      if (onRequestLogin) onRequestLogin('bookmark');
      return;
    }
    if (onSaveBookmark) {
      const locationVal =
        resolution?.mode === 'WIKISOURCE_TEXT'
          ? (chapters.length > 0 ? chapters[0].title : 'Halaman Pembatas')
          : `Halaman ${currentPage + 1}`;

      onSaveBookmark({
        bookId: `${book.provider}:${book.providerId}`,
        locationType: resolution?.mode === 'WIKISOURCE_TEXT' ? 'WIKISOURCE_SECTION' : 'PDF_PAGE',
        locationValue: locationVal,
        label: `${book.title} - ${locationVal}`,
      });
      setBookmarkSavedToast(true);
      setTimeout(() => setBookmarkSavedToast(false), 3000);
    }
  };

  // Load resolution on mount
  useEffect(() => {
    let isMounted = true;

    async function loadReader() {
      setLoading(true);
      setError(null);
      try {
        const res = await resolveReader(book);

        // If Wikisource and contentHtml is not yet loaded, fetch it
        if (res.mode === 'WIKISOURCE_TEXT' && !res.contentHtml) {
          const wikiData = await getWikisourceContent(book.providerId);
          res.contentHtml = wikiData.html;
          res.licenseNotice = wikiData.licenseNotice;
          if ((wikiData as unknown as { chapters?: Array<{ id: string; title: string }> }).chapters) {
            setChapters((wikiData as unknown as { chapters: Array<{ id: string; title: string }> }).chapters);
          }
        }

        if (isMounted) {
          setResolution(res);
          // Set native reader mode if page template URL is ready
          setUseNativeReader(Boolean(res.pageTemplateUrl));
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || 'Gagal menyiapkan pembaca buku');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadReader();

    return () => {
      isMounted = false;
    };
  }, [book]);

  const themeClasses = {
    paper: 'theme-paper',
    sepia: 'theme-sepia',
    dark: 'theme-dark',
  };

  const scrollToChapter = (chapterId: string) => {
    const el = document.getElementById(chapterId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setShowToc(false);
    }
  };

  const hasNativeIaReader = Boolean(resolution?.pageTemplateUrl);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col select-none ${themeClasses[theme]} transition-colors duration-200`}
    >
      {/* Top Header Controls Bar */}
      <header
        className={`flex items-center justify-between border-b border-black/10 px-3 py-2.5 backdrop-blur-md transition-all duration-300 z-30 ${
          isControlsVisible ? 'opacity-100 translate-y-0' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 max-w-[50%] sm:max-w-md">
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-black/10 transition shrink-0"
            title="Keluar dari pembaca"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="truncate">
            <h1 className="text-xs sm:text-sm font-bold truncate leading-tight">{book.title}</h1>
            <p className="text-[10px] sm:text-xs opacity-70 truncate">{book.authors.join(', ')}</p>
          </div>
        </div>

        {/* Reader Customizer Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Table of Contents for multi-chapter books */}
          {chapters.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowToc(!showToc)}
                className="flex items-center gap-1.5 rounded-lg border border-black/15 bg-black/5 px-2.5 py-1 text-xs font-semibold hover:bg-black/10 transition"
                title="Daftar Bab & Bagian Buku"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bab ({chapters.length})</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showToc && (
                <div className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto rounded-xl border border-black/15 bg-white p-2 shadow-2xl z-50 text-[#1A1A1A]">
                  <h4 className="px-2 py-1 text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Daftar Bab / Bagian
                  </h4>
                  {chapters.map((chap, idx) => (
                    <button
                      key={chap.id}
                      onClick={() => scrollToChapter(chap.id)}
                      className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs hover:bg-teal-50 hover:text-teal-700 transition truncate"
                    >
                      <span className="font-mono text-stone-400 mr-1.5">{idx + 1}.</span>
                      {chap.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bookmark Button */}
          <button
            onClick={handleBookmarkClick}
            className={`flex items-center gap-1 rounded-lg border px-2 sm:px-2.5 py-1 text-xs font-semibold transition ${
              bookmarkSavedToast
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-black/15 bg-black/5 hover:bg-black/10'
            }`}
            title="Tandai Halaman Ini (Perlu Login)"
          >
            {bookmarkSavedToast ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {bookmarkSavedToast ? 'Tersimpan!' : 'Tandai'}
            </span>
          </button>

          {/* Native In-App Reader Controls */}
          {hasNativeIaReader && useNativeReader && (
            <>
              {/* View Mode Toggle: Single Page vs Continuous Scroll */}
              <button
                onClick={() => setViewMode(viewMode === 'single' ? 'scroll' : 'single')}
                className="flex items-center gap-1 rounded-lg border border-black/15 bg-black/5 px-2 py-1 text-xs font-semibold hover:bg-black/10 transition"
                title={viewMode === 'single' ? 'Ganti ke Mode Gulir Vertikal' : 'Ganti ke Mode Halaman Satuan'}
              >
                {viewMode === 'single' ? <Layers className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{viewMode === 'single' ? 'Mode Gulir' : 'Mode Lembar'}</span>
              </button>

              {/* Zoom Controls (Single page mode) */}
              {viewMode === 'single' && (
                <div className="hidden sm:flex items-center rounded-lg border border-black/10 bg-black/5 p-0.5">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
                    className="p-1 hover:bg-black/10 rounded"
                    title="Perkecil Halaman"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="px-1.5 text-[10px] font-mono hover:underline"
                    title="Reset Ukuran Normal"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                    className="p-1 hover:bg-black/10 rounded"
                    title="Perbesar Halaman"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Mode Switcher: DARFIN Clean Reader vs Original Archive Embed */}
          {hasNativeIaReader && (
            <button
              onClick={() => setUseNativeReader(!useNativeReader)}
              className="hidden lg:flex items-center gap-1 rounded-lg border border-black/15 bg-black/5 px-2 py-1 text-[11px] font-semibold hover:bg-black/10 transition"
              title="Ganti antara Pembaca Nyaman DARFIN dan Frame Asli Archive"
            >
              <span>{useNativeReader ? 'Mode Arsip Asli' : 'Pembaca Bersih'}</span>
            </button>
          )}

          {/* Theme Switcher */}
          <div className="flex items-center rounded-lg border border-black/10 bg-black/5 p-0.5">
            <button
              onClick={() => setTheme('paper')}
              className={`p-1 rounded transition ${theme === 'paper' ? 'bg-white shadow-xs text-amber-600' : ''}`}
              title="Mode Kertas (Terang)"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`p-1 rounded transition ${theme === 'sepia' ? 'bg-[#EBDDBF] shadow-xs text-[#8C6D4F]' : ''}`}
              title="Mode Sepia (Nyaman untuk Mata)"
            >
              <Coffee className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1 rounded transition ${theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : ''}`}
              title="Mode Malam (Gelap OLED)"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
              isFullscreen
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-black/15 bg-black/5 hover:bg-black/10 text-teal-700 dark:text-teal-400'
            }`}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
          </button>
        </div>
      </header>

      {/* Reader Viewport Area */}
      <main
        className="flex-1 relative overflow-y-auto overflow-x-hidden flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <span className="text-sm font-medium">Menyiapkan halaman buku...</span>
          </div>
        )}

        {error && (
          <div className="mx-auto flex max-w-lg flex-col items-center justify-center p-6 text-center my-auto">
            <ShieldAlert className="h-12 w-12 text-rose-500" />
            <h3 className="mt-3 text-base font-bold">Gagal Menampilkan Buku</h3>
            <p className="mt-1 text-sm opacity-80">{error}</p>
            {book.sourceUrl && (
              <a
                href={book.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition"
              >
                <span>Buka Langsung di Sumber Resmi</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {!loading && !error && resolution && (
          <>
            {/* 1. Custom In-App DARFIN Clean Book Reader (Direct Page Streaming) */}
            {hasNativeIaReader && useNativeReader ? (
              <div
                className="relative flex-1 flex flex-col justify-center items-center w-full min-h-full"
                onClick={(e) => {
                  // If clicked near edges, navigate; if clicked middle, toggle toolbar
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const width = rect.width;

                  if (viewMode === 'single') {
                    if (clickX < width * 0.22) {
                      goToPrevPage();
                    } else if (clickX > width * 0.78) {
                      goToNextPage();
                    } else {
                      setIsControlsVisible((prev) => !prev);
                    }
                  } else {
                    setIsControlsVisible((prev) => !prev);
                  }
                }}
              >
                {/* Mode Lembar (Single Page) */}
                {viewMode === 'single' ? (
                  <div className="relative flex-1 flex items-center justify-center w-full p-2 sm:p-4 overflow-auto">
                    {/* Navigation Hotspot Indicators (visible on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevPage();
                      }}
                      disabled={currentPage <= 0}
                      className="absolute left-2 sm:left-4 z-20 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextPage();
                      }}
                      disabled={currentPage >= totalPages - 1}
                      className="absolute right-2 sm:right-4 z-20 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
                      title="Halaman Selanjutnya"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* Page Container */}
                    <div
                      className="relative flex items-center justify-center max-w-full transition-transform duration-150"
                      style={{
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'center center',
                      }}
                    >
                      {imageLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                          <span className="text-xs font-medium opacity-70">Memuat halaman {currentPage + 1}...</span>
                        </div>
                      )}

                      <img
                        key={currentPage}
                        src={resolution.pageTemplateUrl!.replace('{page}', String(currentPage))}
                        alt={`Halaman ${currentPage + 1}`}
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                        className={`max-h-[82vh] sm:max-h-[86vh] w-auto max-w-full rounded-md shadow-2xl object-contain transition-opacity duration-200 ${
                          imageLoading ? 'opacity-30' : 'opacity-100'
                        }`}
                        draggable={false}
                      />
                    </div>
                  </div>
                ) : (
                  /* Mode Gulir (Continuous Vertical Scroll) */
                  <div className="w-full flex-1 overflow-y-auto px-2 py-6">
                    <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
                      {Array.from({ length: totalPages }, (_, idx) => (
                        <div key={idx} className="w-full flex flex-col items-center">
                          <div className="relative w-full flex justify-center bg-black/5 rounded-xl overflow-hidden shadow-lg border border-black/10">
                            <img
                              src={resolution.pageTemplateUrl!.replace('{page}', String(idx))}
                              alt={`Halaman ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-auto object-contain max-h-[92vh]"
                            />
                          </div>
                          <span className="mt-2 text-[11px] font-mono opacity-50">
                            Halaman {idx + 1} dari {totalPages}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Floating Bottom Navigation Toolbar (Single Page Mode) */}
                {viewMode === 'single' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-black/15 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur-md transition-all duration-300 text-stone-900 dark:text-white ${
                      isControlsVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8 pointer-events-none'
                    }`}
                  >
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage <= 0}
                      className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30 transition"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Interactive Slider Scrubber */}
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, totalPages - 1)}
                      value={currentPage}
                      onChange={(e) => {
                        setImageLoading(true);
                        setCurrentPage(Number(e.target.value));
                      }}
                      className="w-24 sm:w-44 accent-teal-600 h-1.5 cursor-pointer"
                      title={`Geser Halaman (1 - ${totalPages})`}
                    />

                    {/* Page Number & Direct Jump */}
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span className="opacity-70">Hal.</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(pageInput, 10);
                            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                              setImageLoading(true);
                              setCurrentPage(val - 1);
                            }
                          }
                        }}
                        className="w-12 text-center rounded border border-black/20 bg-black/5 dark:bg-slate-800 py-0.5 font-mono text-xs text-stone-900 dark:text-white"
                      />
                      <span className="opacity-70">/ {totalPages}</span>
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages - 1}
                      className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30 transition"
                      title="Halaman Selanjutnya"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Direct PDF Download if available */}
                    {resolution.pdfUrl && (
                      <a
                        href={resolution.pdfUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        download
                        className="hidden sm:flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-50 dark:bg-teal-950/50 px-2 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition ml-1"
                        title="Unduh File PDF Lengkap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* 2. Wikisource Clean Text Mode */
              resolution.mode === 'WIKISOURCE_TEXT' && resolution.contentHtml ? (
                <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full">
                  <article
                    className={`prose max-w-none transition-all leading-relaxed ${
                      isSerif ? 'reader-serif' : 'font-sans'
                    }`}
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.85',
                    }}
                  >
                    <div
                      dangerouslySetInnerHTML={{ __html: resolution.contentHtml }}
                      className="space-y-6"
                    />

                    <footer className="mt-16 border-t border-black/10 pt-6 text-xs opacity-75">
                      <p className="font-bold text-sm">Informasi Lisensi & Sumber Naskah:</p>
                      <p className="mt-1">{resolution.licenseNotice}</p>
                      <p className="mt-1">
                        Tautan naskah asli:{' '}
                        <a
                          href={resolution.launchUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline text-teal-600 font-semibold"
                        >
                          Wikisumber Bahasa Indonesia
                        </a>
                      </p>
                    </footer>
                  </article>
                </div>
              ) : (
                /* 3. Official Kemendikdasmen Textbook View */
                (book.provider === 'kemdikbud' ||
                  resolution.launchUrl?.includes('kemendikdasmen.go.id') ||
                  resolution.launchUrl?.includes('kemdikbud.go.id')) ? (
                  <div className="mx-auto max-w-xl py-8 px-4 my-auto">
                    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 dark:bg-slate-900/80 p-6 sm:p-8 shadow-xl backdrop-blur-md text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 mb-4">
                        <BookOpen className="h-8 w-8" />
                      </div>

                      <span className="inline-block rounded-full bg-teal-100 dark:bg-teal-900/60 px-3 py-1 text-xs font-bold text-teal-800 dark:text-teal-300">
                        Buku Pelajaran Resmi Kurikulum Merdeka
                      </span>

                      <h2 className="mt-3 text-lg font-bold sm:text-xl text-stone-900 dark:text-white">
                        {book.title}
                      </h2>
                      <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                        Penerbit: {book.publisher || 'Kementerian Pendidikan Dasar dan Menengah RI'}
                      </p>

                      <div className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-4 text-left text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        <p className="font-semibold mb-1">Akses Resmi & Aman SIBI Kemendikdasmen:</p>
                        <p>
                          Sesuai protokol keamanan portal pemerintah Kemendikdasmen RI, naskah resmi dan reader interaktif dapat dibaca secara resmi langsung melalui Sistem Informasi Perbukuan Indonesia (SIBI). Akses 100% gratis untuk seluruh siswa dan pendidik di Indonesia.
                        </p>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        {resolution.launchUrl && (
                          <a
                            href={resolution.launchUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-xs font-bold text-white hover:bg-teal-700 shadow-md shadow-teal-600/20 transition"
                          >
                            <span>Buka Buku di Portal Resmi SIBI</span>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handleBookmarkClick}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-slate-700 transition"
                        >
                          <Bookmark className="h-4 w-4 text-teal-600" />
                          <span>{bookmarkSavedToast ? 'Tersimpan ke Rak!' : 'Tandai Buku Ini'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 4. Fullscreen Edge-to-Edge Embedded Frame (Fallback for external embed) */
                  <div className="relative flex-1 w-full h-full bg-black">
                    <iframe
                      src={resolution.launchUrl}
                      title={book.title}
                      className="h-full w-full border-0"
                      allow="fullscreen; clipboard-write; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                )
              )
            )}
          </>
        )}
      </main>
    </div>
  );
};
