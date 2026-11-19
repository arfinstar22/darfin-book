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
  const [clientTotalPages, setClientTotalPages] = useState<number | null>(null);

  // Reader Settings
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [fontSize, setFontSize] = useState(18); // Default 18px for Wikisource
  const [isSerif, setIsSerif] = useState(true);
  const [showToc, setShowToc] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const totalPages = clientTotalPages || resolution?.totalPages || 100;

  // Background fetch accurate total page count from Internet Archive if server fell back to default
  useEffect(() => {
    if (!resolution?.iaIdentifier) return;
    if (resolution.totalPages && resolution.totalPages > 10) return;

    let isMounted = true;
    async function fetchIaPages() {
      try {
        const res = await fetch(`https://archive.org/metadata/${resolution.iaIdentifier}`);
        if (!res.ok) return;
        const data = await res.json();
        let count: number | null = null;
        if (data.metadata?.imagecount) count = parseInt(data.metadata.imagecount, 10);
        if (!count && data.metadata?.pages) count = parseInt(data.metadata.pages, 10);

        const scandata = data.files?.find(
          (f: any) => f.format === 'Scandata' || f.name?.endsWith('_scandata.xml')
        );
        if (!count && scandata) {
          const scRes = await fetch(
            `https://archive.org/download/${resolution.iaIdentifier}/${scandata.name}`,
            { headers: { Range: 'bytes=0-4096' } }
          );
          if (scRes.ok) {
            const text = await scRes.text();
            const match =
              text.match(/<leafCount>(\d+)<\/leafCount>/i) ||
              text.match(/leafCount="(\d+)"/i);
            if (match) count = parseInt(match[1], 10);
          }
        }

        if (isMounted && count && count > 0) {
          setClientTotalPages(count);
        }
      } catch (e) {
        console.warn('Direct IA total pages fetch error:', e);
      }
    }

    fetchIaPages();
    return () => {
      isMounted = false;
    };
  }, [resolution]);

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

  const scrollToChapter = (chapterId: string) => {
    const el = document.getElementById(chapterId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setShowToc(false);
    }
  };

  const hasNativeIaReader = Boolean(resolution?.pageTemplateUrl);

  // Self-contained theme styling that overrides root html dark classes
  const themeStyles = {
    paper: {
      container: 'bg-[#FDFBF7] text-[#1A1A1A]',
      header: 'bg-white/95 border-stone-200 text-[#1A1A1A] shadow-xs',
      btnDefault: 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200/80',
      btnActive: 'bg-teal-600 text-white font-bold border border-teal-600',
      themeBox: 'bg-stone-100 border border-stone-200/80',
      bottomToolbar: 'bg-white/95 border border-stone-200/90 text-[#1A1A1A] shadow-2xl',
      input: 'bg-stone-100 border border-stone-300 text-[#1A1A1A]',
      slider: 'accent-teal-600',
      tagText: 'text-stone-500',
    },
    sepia: {
      container: 'bg-[#F4ECD8] text-[#433422]',
      header: 'bg-[#EBDDBF]/95 border-[#D5C5A1] text-[#433422] shadow-xs',
      btnDefault: 'bg-[#E5D7B7] hover:bg-[#DBCB9E] text-[#433422] border border-[#D5C5A1]/80',
      btnActive: 'bg-[#7A5A35] text-white font-bold border border-[#7A5A35]',
      themeBox: 'bg-[#E5D7B7] border border-[#D5C5A1]/80',
      bottomToolbar: 'bg-[#FAF4E6]/95 border border-[#D5C5A1] text-[#433422] shadow-2xl',
      input: 'bg-[#EBDDBF] border border-[#C8B68F] text-[#433422]',
      slider: 'accent-[#7A5A35]',
      tagText: 'text-[#7D6B56]',
    },
    dark: {
      container: 'bg-[#080E1E] text-[#F1F5F9]',
      header: 'bg-[#0F172A]/95 border-slate-800 text-[#F1F5F9] shadow-xs',
      btnDefault: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
      btnActive: 'bg-teal-600 text-white font-bold border border-teal-500',
      themeBox: 'bg-slate-800 border border-slate-700',
      bottomToolbar: 'bg-[#0F172A]/95 border border-slate-700/80 text-white shadow-2xl',
      input: 'bg-slate-800 border border-slate-600 text-white',
      slider: 'accent-teal-500',
      tagText: 'text-slate-400',
    },
  }[theme];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col select-none ${themeStyles.container} transition-colors duration-200`}
    >
      {/* Top Header Controls Bar */}
      <header
        className={`flex items-center justify-between border-b px-3 sm:px-6 py-2.5 backdrop-blur-md transition-all duration-300 z-30 ${
          themeStyles.header
        } ${isControlsVisible ? 'opacity-100 translate-y-0' : '-translate-y-full opacity-0 pointer-events-none'}`}
      >
        {/* Left: Close Button (Large, comfortable 44px target) */}
        <div className="flex items-center">
          <button
            onClick={onClose}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl active:scale-95 transition ${themeStyles.btnDefault}`}
            title="Keluar dari pembaca"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Right: Clean, spacious, high-contrast Reader Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Table of Contents for multi-chapter books */}
          {chapters.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowToc(!showToc)}
                className={`flex h-11 items-center gap-1.5 rounded-2xl px-3 text-xs font-semibold active:scale-95 transition ${themeStyles.btnDefault}`}
                title="Daftar Bab & Bagian Buku"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Bab ({chapters.length})</span>
                <ChevronDown className="h-3.5 w-3.5" />
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

          {/* Native In-App Reader: Mode Lembar vs Mode Gulir */}
          {hasNativeIaReader && useNativeReader && (
            <button
              onClick={() => setViewMode(viewMode === 'single' ? 'scroll' : 'single')}
              className={`flex h-11 items-center gap-1.5 rounded-2xl px-3 sm:px-3.5 text-xs font-semibold active:scale-95 transition ${themeStyles.btnDefault}`}
              title={viewMode === 'single' ? 'Ganti ke Mode Gulir Vertikal (Scroll)' : 'Ganti ke Mode Halaman Satuan (Flip)'}
            >
              {viewMode === 'single' ? (
                <Layers className="h-4 w-4 text-teal-600" />
              ) : (
                <BookOpen className="h-4 w-4 text-teal-600" />
              )}
              <span className="text-xs font-medium">{viewMode === 'single' ? 'Lembar' : 'Gulir'}</span>
            </button>
          )}

          {/* Bookmark Button */}
          <button
            onClick={handleBookmarkClick}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl px-3 sm:px-3.5 text-xs font-semibold active:scale-95 transition ${
              bookmarkSavedToast
                ? 'bg-emerald-600 text-white font-bold border border-emerald-600 shadow-sm'
                : themeStyles.btnDefault
            }`}
            title="Tandai Halaman Ini"
          >
            {bookmarkSavedToast ? (
              <Check className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4 text-amber-500 fill-amber-500/20" />
            )}
            <span className="hidden md:inline">
              {bookmarkSavedToast ? 'Tersimpan!' : 'Tandai'}
            </span>
          </button>

          {/* Theme Switcher: 3 large, distinctive high-contrast buttons */}
          <div className={`flex h-11 items-center rounded-2xl p-1 gap-1 ${themeStyles.themeBox}`}>
            <button
              onClick={() => setTheme('paper')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                theme === 'paper'
                  ? 'bg-white shadow-md text-amber-700 font-bold border border-stone-200'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Kertas (Terang)"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                theme === 'sepia'
                  ? 'bg-[#FAF4E6] shadow-md text-[#5C4227] font-bold border border-[#D5C5A1]'
                  : 'text-stone-500 hover:text-[#5C4227]'
              }`}
              title="Sepia (Hangat & Nyaman)"
            >
              <Coffee className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                theme === 'dark'
                  ? 'bg-slate-950 shadow-md text-cyan-400 font-bold border border-slate-700'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Malam (Gelap OLED)"
            >
              <Moon className="h-4 w-4" />
            </button>
          </div>

          {/* Fullscreen Toggle Button (Prominent & high contrast) */}
          <button
            onClick={toggleFullscreen}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl px-3 sm:px-3.5 text-xs font-semibold active:scale-95 transition shadow-sm ${
              isFullscreen
                ? 'bg-teal-700 text-white font-bold border border-teal-600'
                : 'bg-teal-600 hover:bg-teal-700 text-white font-bold border border-teal-600'
            }`}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline font-medium">{isFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
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
                    {/* Navigation Hotspot Buttons (hidden on mobile, visible on desktop hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevPage();
                      }}
                      disabled={currentPage <= 0}
                      className="hidden sm:flex absolute left-4 z-20 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
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
                      className="hidden sm:flex absolute right-4 z-20 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
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
                          <span className={`text-xs font-medium ${themeStyles.tagText}`}>
                            Memuat halaman {currentPage + 1}...
                          </span>
                        </div>
                      )}

                      <img
                        key={currentPage}
                        src={resolution.pageTemplateUrl!.replace('{page}', String(currentPage))}
                        alt={`Halaman ${currentPage + 1}`}
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                        className={`max-h-[84vh] sm:max-h-[88vh] w-auto max-w-full rounded-md shadow-2xl object-contain transition-opacity duration-200 ${
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
                          <div className="relative w-full flex justify-center rounded-xl overflow-hidden shadow-lg border border-black/10">
                            <img
                              src={resolution.pageTemplateUrl!.replace('{page}', String(idx))}
                              alt={`Halaman ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-auto object-contain max-h-[92vh]"
                            />
                          </div>
                          <span className={`mt-2 text-[11px] font-mono ${themeStyles.tagText}`}>
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
                    className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-300 ${
                      themeStyles.bottomToolbar
                    } ${
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
                      className={`w-24 sm:w-44 h-1.5 cursor-pointer ${themeStyles.slider}`}
                      title={`Geser Halaman (1 - ${totalPages})`}
                    />

                    {/* Page Number & Direct Jump */}
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span className={themeStyles.tagText}>Hal.</span>
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
                        className={`w-12 text-center rounded py-0.5 font-mono text-xs ${themeStyles.input}`}
                      />
                      <span className={themeStyles.tagText}>/ {totalPages}</span>
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
                        className="hidden sm:flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-100 transition ml-1"
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
                    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 sm:p-8 shadow-xl backdrop-blur-md text-center text-stone-900">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 mb-4">
                        <BookOpen className="h-8 w-8" />
                      </div>

                      <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                        Buku Pelajaran Resmi Kurikulum Merdeka
                      </span>

                      <h2 className="mt-3 text-lg font-bold sm:text-xl text-stone-900">
                        {book.title}
                      </h2>
                      <p className="mt-1 text-xs text-stone-500">
                        Penerbit: {book.publisher || 'Kementerian Pendidikan Dasar dan Menengah RI'}
                      </p>

                      <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left text-xs text-amber-900 leading-relaxed">
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
                          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-semibold hover:bg-stone-50 transition text-stone-800"
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
