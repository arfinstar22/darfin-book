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
  RotateCcw,
} from 'lucide-react';
import { resolveReader, getWikisourceContent } from '../api.js';
import { PROVIDER_LABELS, type Book, type ReaderResolution } from '../types.js';
import { BookOfflineFallbackCard } from './BookOfflineFallbackCard.js';
import { resolveOfflineActionUrls } from '../utils/bookDownload.js';

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
  const [pageImageError, setPageImageError] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const [scrollImageErrors, setScrollImageErrors] = useState<Record<number, boolean>>({});
  const [reloadNonce, setReloadNonce] = useState(0);
  const [forceOfflineFallback, setForceOfflineFallback] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clientTotalPages, setClientTotalPages] = useState<number | null>(null);

  // 3D Page Flip Animation State
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Reader Settings
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [fontSize, setFontSize] = useState(18); // Default 18px for Wikisource
  const [isSerif, setIsSerif] = useState(true);
  const [showToc, setShowToc] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);
  const tapTimeout = useRef<NodeJS.Timeout | null>(null);

  // Mobile Pinch-to-Zoom & Pan Gesture Tracking Refs
  const zoomLevelRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isFlippingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragXRef = useRef(0);
  const isPanningRef = useRef(false);
  const isPinchingRef = useRef(false);
  const initialPinchDist = useRef(0);
  const initialZoom = useRef(1);
  const panStart = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const mouseStartRef = useRef({ x: 0, y: 0 });

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

  // Preload adjacent pages for smooth 3D flips
  useEffect(() => {
    if (!resolution?.pageTemplateUrl) return;
    if (currentPage + 1 < totalPages) {
      const nextImg = new Image();
      nextImg.src = resolution.pageTemplateUrl.replace('{page}', String(currentPage + 1));
    }
    if (currentPage - 1 >= 0) {
      const prevImg = new Image();
      prevImg.src = resolution.pageTemplateUrl.replace('{page}', String(currentPage - 1));
    }
  }, [currentPage, resolution, totalPages]);

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

  // Keyboard navigation & Shortcuts
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
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, zoomLevel, isFlipping]);

  // Keep refs synchronized for high-performance touch & gesture handling
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    isFlippingRef.current = isFlipping;
  }, [isFlipping]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    dragXRef.current = dragX;
  }, [dragX]);

  // 3D Page Turn Forward (Auto resets zoom & pan)
  const goToNextPage = () => {
    if (currentPage >= totalPages - 1 || isFlippingRef.current) return;
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    zoomLevelRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setFlipDirection('next');
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setFlipDirection(null);
      setIsFlipping(false);
      setPageImageError(false);
      setImageLoading(true);
    }, 360);
  };

  // 3D Page Turn Backward (Auto resets zoom & pan)
  const goToPrevPage = () => {
    if (currentPage <= 0 || isFlippingRef.current) return;
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    zoomLevelRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setFlipDirection('prev');
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev - 1);
      setFlipDirection(null);
      setIsFlipping(false);
      setPageImageError(false);
      setImageLoading(true);
    }, 360);
  };

  // Native non-passive Touch Gesture Engine for Pinch-to-Zoom (2 Fingers) and Pan (1 Finger)
  useEffect(() => {
    const el = stageRef.current;
    if (!el || viewMode !== 'single') return;

    const onTouchStart = (e: TouchEvent) => {
      touchMovedRef.current = false;

      // 2 fingers = Pinch-to-zoom
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        isDraggingRef.current = false;
        isPanningRef.current = false;
        setIsDragging(false);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist.current = Math.hypot(dx, dy);
        initialZoom.current = zoomLevelRef.current;
      } else if (e.touches.length === 1) {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;

        if (zoomLevelRef.current > 1.05) {
          // 1 finger while zoomed in = Pan viewport
          isPanningRef.current = true;
          panStart.current = {
            x: e.touches[0].clientX - panRef.current.x,
            y: e.touches[0].clientY - panRef.current.y,
          };
        } else if (!isFlippingRef.current) {
          // 1 finger at normal zoom = 3D Paper Flip curl
          isDraggingRef.current = true;
          setIsDragging(true);
          setDragX(0);
          dragXRef.current = 0;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // 2 fingers = Smooth Pinch to Zoom
      if (e.touches.length === 2 && initialPinchDist.current > 0) {
        if (e.cancelable) e.preventDefault();
        touchMovedRef.current = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / initialPinchDist.current;
        const nextZoom = Math.max(1, Math.min(3.5, Math.round(initialZoom.current * factor * 100) / 100));
        setZoomLevel(nextZoom);
        zoomLevelRef.current = nextZoom;

        if (nextZoom <= 1.05) {
          setPan({ x: 0, y: 0 });
          panRef.current = { x: 0, y: 0 };
        }
      } else if (e.touches.length === 1) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - (touchStartX.current ?? currentX);
        const diffY = currentY - (touchStartY.current ?? currentY);

        if (Math.hypot(diffX, diffY) > 8) {
          touchMovedRef.current = true;
        }

        if (isPanningRef.current && zoomLevelRef.current > 1.05) {
          if (e.cancelable) e.preventDefault();
          const nextX = currentX - panStart.current.x;
          const nextY = currentY - panStart.current.y;
          // Clamp panning limits so the page doesn't disappear offscreen
          const maxPanX = (window.innerWidth * (zoomLevelRef.current - 1)) / 1.5 + 40;
          const maxPanY = (window.innerHeight * (zoomLevelRef.current - 1)) / 1.5 + 40;
          const clamped = {
            x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
            y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
          };
          setPan(clamped);
          panRef.current = clamped;
        } else if (isDraggingRef.current && zoomLevelRef.current <= 1.05 && !isFlippingRef.current) {
          if (Math.abs(diffX) > Math.abs(diffY)) {
            if (e.cancelable) e.preventDefault();
            setDragX(diffX);
            dragXRef.current = diffX;
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
        initialPinchDist.current = 0;
      }
      if (e.touches.length === 0) {
        isPanningRef.current = false;
        if (zoomLevelRef.current <= 1.05) {
          setZoomLevel(1);
          zoomLevelRef.current = 1;
          setPan({ x: 0, y: 0 });
          panRef.current = { x: 0, y: 0 };

          // Trigger page flip on significant swipe
          if (dragXRef.current < -50) {
            goToNextPage();
          } else if (dragXRef.current > 50) {
            goToPrevPage();
          }
        }
        touchStartX.current = null;
        touchStartY.current = null;
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragX(0);
        dragXRef.current = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [viewMode, currentPage, totalPages]);

  // Desktop Mouse Drag to Pan when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1.05) {
      isMouseDownRef.current = true;
      mouseStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDownRef.current && zoomLevel > 1.05) {
      touchMovedRef.current = true;
      const nx = e.clientX - mouseStartRef.current.x;
      const ny = e.clientY - mouseStartRef.current.y;
      const maxPanX = (window.innerWidth * (zoomLevel - 1)) / 1.5 + 40;
      const maxPanY = (window.innerHeight * (zoomLevel - 1)) / 1.5 + 40;
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, nx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, ny)),
      });
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  // Zoom Helpers (for Desktop buttons & shortcuts)
  const zoomIn = () => {
    setZoomLevel((prev) => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  };

  const zoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1.05) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    zoomLevelRef.current = 1;
    panRef.current = { x: 0, y: 0 };
  };

  const toggleFitWidth = () => {
    setZoomLevel((prev) => {
      const next = prev > 1.2 ? 1 : 2.0;
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Canvas Click Handler: Distinguishes between Single Tap (toggle controls / flip) and Double Tap (zoom)
  const handleCanvasClick = (e: React.MouseEvent, clickX: number, width: number) => {
    if (isFlippingRef.current || touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }
    const now = Date.now();
    const isDouble = now - lastTapTime.current < 280;
    lastTapTime.current = now;

    if (isDouble) {
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      if (zoomLevelRef.current > 1.1) {
        resetZoom();
      } else {
        setZoomLevel(2.0);
      }
      return;
    }

    tapTimeout.current = setTimeout(() => {
      if (viewMode === 'single' && zoomLevelRef.current <= 1.1) {
        if (clickX < width * 0.2) {
          goToPrevPage();
        } else if (clickX > width * 0.8) {
          goToNextPage();
        } else {
          setIsControlsVisible((prev) => !prev);
        }
      } else {
        setIsControlsVisible((prev) => !prev);
      }
    }, 280);
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
      setPageImageError(false);
      setScrollImageErrors({});
      setForceOfflineFallback(false);
      try {
        const res = await resolveReader(book);

        // If Wikisource/Wikibooks and contentHtml is not yet loaded, fetch it
        if (res.mode === 'WIKISOURCE_TEXT' && !res.contentHtml) {
          const wikiProvider = book.provider === 'wikibooks' ? 'wikibooks' : 'wikisource';
          const wikiData = await getWikisourceContent(book.providerId, wikiProvider);
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
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    };
  }, [book, reloadNonce]);

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

  // Drag angle calculation for live 3D touch page turn
  const dragAngle = Math.max(
    -85,
    Math.min(85, (dragX / (typeof window !== 'undefined' ? window.innerWidth || 360 : 360)) * 95)
  );

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col select-none ${themeStyles.container} transition-colors duration-200 overflow-hidden`}
    >
      {/* Top Header Controls Bar (Overlay Fixed at Top) */}
      <header
        className={`fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b px-3 sm:px-6 py-2.5 backdrop-blur-md transition-all duration-300 ${
          themeStyles.header
        } ${isControlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
      >
        {/* Left: Close Button (Large 44px touch target) */}
        <div className="flex items-center">
          <button
            onClick={onClose}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl active:scale-95 transition ${themeStyles.btnDefault}`}
            title="Keluar dari pembaca"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Right: High-Contrast Reader Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
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

          {/* Mode Lembar vs Mode Gulir */}
          {hasNativeIaReader && useNativeReader && (
            <button
              onClick={() => {
                setViewMode(viewMode === 'single' ? 'scroll' : 'single');
                resetZoom();
              }}
              className={`flex h-11 items-center gap-1.5 rounded-2xl px-2.5 sm:px-3.5 text-xs font-semibold active:scale-95 transition ${themeStyles.btnDefault}`}
              title={viewMode === 'single' ? 'Ganti ke Mode Gulir Vertikal (Scroll)' : 'Ganti ke Mode Halaman Satuan (Flip 3D)'}
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
            className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl px-2.5 sm:px-3.5 text-xs font-semibold active:scale-95 transition ${
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

          {/* Theme Switcher: 3 large, high-contrast buttons */}
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

          {/* Fullscreen Toggle Button */}
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
        className={`fixed inset-0 z-20 flex flex-col overflow-hidden transition-all duration-300 ${
          isControlsVisible ? 'pt-16 pb-20' : 'pt-0 pb-0'
        }`}
      >
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <span className="text-sm font-medium">Menyiapkan halaman buku...</span>
          </div>
        )}

        {error && (
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-2">
            <BookOfflineFallbackCard
              book={book}
              resolution={resolution}
              errorMessage={error}
              theme={theme}
              onRetry={() => setReloadNonce((n) => n + 1)}
              onBookmark={handleBookmarkClick}
              bookmarkSaved={bookmarkSavedToast}
            />
          </div>
        )}

        {!loading && !error && resolution && (
          <>
            {/* 1. Custom In-App DARFIN Clean Book Reader (Direct Page Streaming) */}
            {hasNativeIaReader && useNativeReader ? (
              <div
                className="relative flex-1 flex flex-col justify-center items-center w-full h-full min-h-full"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  handleCanvasClick(e, clickX, rect.width);
                }}
              >
                {/* Mode Lembar: 3D Realistic Paper Flipbook with Pinch-to-Zoom & Pan */}
                {viewMode === 'single' ? (
                  <div
                    ref={stageRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="relative flex-1 flex items-center justify-center w-full h-full overflow-hidden p-1 sm:p-4 touch-none select-none"
                    style={{
                      perspective: '1400px',
                      cursor: zoomLevel > 1.05 ? (isMouseDownRef.current ? 'grabbing' : 'grab') : 'default',
                    }}
                  >
                    {/* Navigation Hotspot Buttons (hidden on mobile, visible on desktop hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevPage();
                      }}
                      disabled={currentPage <= 0 || isFlipping}
                      className="hidden sm:flex absolute left-4 z-30 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextPage();
                      }}
                      disabled={currentPage >= totalPages - 1 || isFlipping}
                      className="hidden sm:flex absolute right-4 z-30 rounded-full bg-black/40 text-white p-3 backdrop-blur-sm opacity-20 hover:opacity-100 disabled:opacity-0 transition"
                      title="Halaman Selanjutnya"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* Page Stage: 3D Layers with Smooth GPU Transform Scale & Pan */}
                    <div
                      className="relative flex items-center justify-center w-full h-full"
                      style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoomLevel})`,
                        transformOrigin: 'center center',
                        transition:
                          isPinchingRef.current || isPanningRef.current || isDragging || isMouseDownRef.current
                            ? 'none'
                            : 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)',
                        willChange: 'transform',
                      }}
                    >
                      {/* UNDERNEATH PAGE: Revealed during 3D flip forward */}
                      {isFlipping && flipDirection === 'next' && currentPage + 1 < totalPages && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <div className="relative flex items-center justify-center rounded-md overflow-hidden book-spine-shadow shadow-xl">
                            <img
                              src={resolution.pageTemplateUrl!.replace('{page}', String(currentPage + 1))}
                              alt={`Halaman ${currentPage + 2}`}
                              className={`rounded-md object-contain select-none pointer-events-none ${
                                isControlsVisible
                                  ? 'max-h-[82vh] sm:max-h-[86vh] w-auto max-w-full'
                                  : 'max-h-[98vh] w-auto max-w-full'
                              }`}
                            />
                          </div>
                        </div>
                      )}

                      {/* UNDERNEATH PAGE: Revealed during 3D flip backward */}
                      {isFlipping && flipDirection === 'prev' && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <div className="relative flex items-center justify-center rounded-md overflow-hidden book-spine-shadow shadow-xl">
                            <img
                              src={resolution.pageTemplateUrl!.replace('{page}', String(currentPage))}
                              alt={`Halaman ${currentPage + 1}`}
                              className={`rounded-md object-contain select-none pointer-events-none ${
                                isControlsVisible
                                  ? 'max-h-[82vh] sm:max-h-[86vh] w-auto max-w-full'
                                  : 'max-h-[98vh] w-auto max-w-full'
                              }`}
                            />
                          </div>
                        </div>
                      )}

                      {/* ACTIVE / FLIPPING PAGE SHEET */}
                      <div
                        className={`relative z-20 flex items-center justify-center transition-all ${
                          isFlipping && flipDirection === 'next'
                            ? 'book-page-flip-next'
                            : isFlipping && flipDirection === 'prev'
                            ? 'book-page-flip-prev'
                            : ''
                        }`}
                        style={{
                          transformOrigin: 'left center',
                          transform:
                            isDragging && zoomLevel <= 1.05 && Math.abs(dragX) > 10
                              ? `perspective(1400px) rotateY(${dragAngle}deg)`
                              : undefined,
                          transition: isDragging ? 'none' : 'transform 0.25s ease',
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

                        <div className="relative rounded-md overflow-hidden shadow-2xl book-spine-shadow">
                          {pageImageError ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="max-h-[82vh] overflow-y-auto"
                            >
                              <BookOfflineFallbackCard
                                book={book}
                                resolution={resolution}
                                theme={theme}
                                failedPageNumber={currentPage + 1}
                                onRetry={() => {
                                  setPageImageError(false);
                                  setImageLoading(true);
                                  setImageRetryKey((k) => k + 1);
                                }}
                                onBookmark={handleBookmarkClick}
                                bookmarkSaved={bookmarkSavedToast}
                              />
                            </div>
                          ) : (
                            <img
                              key={`${currentPage}-${imageRetryKey}`}
                              src={resolution.pageTemplateUrl!.replace(
                                '{page}',
                                String(
                                  isFlipping && flipDirection === 'prev' && currentPage > 0
                                    ? currentPage - 1
                                    : currentPage
                                )
                              )}
                              alt={`Halaman ${currentPage + 1}`}
                              onLoad={() => {
                                setImageLoading(false);
                                setPageImageError(false);
                              }}
                              onError={() => {
                                setImageLoading(false);
                                setPageImageError(true);
                              }}
                              className={`rounded-md object-contain select-none pointer-events-none transition-all duration-200 ${
                                imageLoading ? 'opacity-30' : 'opacity-100'
                              } ${
                                isControlsVisible
                                  ? 'max-h-[82vh] sm:max-h-[86vh] w-auto max-w-full'
                                  : 'max-h-[98vh] w-auto max-w-full'
                              }`}
                              draggable={false}
                            />
                          )}

                          {/* 3D Paper fold lighting/shadow overlay on turn */}
                          {(isFlipping || (isDragging && Math.abs(dragX) > 10)) && zoomLevel <= 1.05 && (
                            <div
                              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                              style={{
                                background:
                                  dragX < 0 || flipDirection === 'next'
                                    ? 'linear-gradient(to right, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.25) 100%)'
                                    : 'linear-gradient(to left, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.25) 100%)',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mode Gulir (Continuous Vertical Scroll with Zoom Support) */
                  <div className="w-full flex-1 overflow-y-auto px-2 py-6">
                    <div
                      className="mx-auto flex flex-col items-center gap-6 transition-all duration-200"
                      style={{
                        maxWidth:
                          zoomLevel >= 1.6
                            ? '100%'
                            : zoomLevel >= 1.3
                            ? '56rem'
                            : '48rem',
                      }}
                    >
                      {Array.from({ length: totalPages }, (_, idx) => (
                        <div key={idx} className="w-full flex flex-col items-center">
                          {scrollImageErrors[idx] ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full max-w-lg"
                            >
                              <BookOfflineFallbackCard
                                book={book}
                                resolution={resolution}
                                theme={theme}
                                failedPageNumber={idx + 1}
                                onRetry={() => {
                                  setScrollImageErrors((prev) => ({ ...prev, [idx]: false }));
                                  setImageRetryKey((k) => k + 1);
                                }}
                                onBookmark={handleBookmarkClick}
                                bookmarkSaved={bookmarkSavedToast}
                              />
                            </div>
                          ) : (
                            <div className="relative w-full flex justify-center rounded-xl overflow-hidden shadow-lg border border-black/10 book-spine-shadow">
                              <img
                                key={`${idx}-${imageRetryKey}`}
                                src={resolution.pageTemplateUrl!.replace('{page}', String(idx))}
                                alt={`Halaman ${idx + 1}`}
                                loading="lazy"
                                onError={() =>
                                  setScrollImageErrors((prev) => ({ ...prev, [idx]: true }))
                                }
                                className="w-full h-auto object-contain max-h-[96vh]"
                              />
                            </div>
                          )}
                          <span className={`mt-2 text-[11px] font-mono ${themeStyles.tagText}`}>
                            Halaman {idx + 1} dari {totalPages}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Floating Bottom Navigation Toolbar (Page Navigation + Zoom) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2 transition-all duration-300 max-w-[96vw] ${
                    themeStyles.bottomToolbar
                  } ${
                    isControlsVisible
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-12 opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Page Flipping (In single mode) */}
                  {viewMode === 'single' && (
                    <>
                      <button
                        onClick={goToPrevPage}
                        disabled={currentPage <= 0 || isFlipping}
                        className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30 transition"
                        title="Halaman Sebelumnya (3D Flip)"
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
                          setPageImageError(false);
                          setImageLoading(true);
                          setCurrentPage(Number(e.target.value));
                        }}
                        className={`w-20 sm:w-36 h-1.5 cursor-pointer ${themeStyles.slider}`}
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
                                setPageImageError(false);
                                setImageLoading(true);
                                setCurrentPage(val - 1);
                              }
                            }
                          }}
                          className={`w-11 text-center rounded py-0.5 font-mono text-xs ${themeStyles.input}`}
                        />
                        <span className={themeStyles.tagText}>/ {totalPages}</span>
                      </div>

                      <button
                        onClick={goToNextPage}
                        disabled={currentPage >= totalPages - 1 || isFlipping}
                        className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30 transition"
                        title="Halaman Selanjutnya (3D Flip)"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>

                      <div className="hidden sm:block h-4 w-px bg-black/15 mx-0.5" />
                    </>
                  )}

                  {/* Zoom Controls (Desktop only - on mobile, pinch-to-zoom is used directly) */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      onClick={zoomOut}
                      disabled={zoomLevel <= 1}
                      className="rounded-lg p-1 hover:bg-black/10 disabled:opacity-30 transition"
                      title="Perkecil Tulisan (-)"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>

                    <button
                      onClick={toggleFitWidth}
                      className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold hover:bg-black/10 transition"
                      title="Klik untuk Perbesar / Normal"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>

                    <button
                      onClick={zoomIn}
                      disabled={zoomLevel >= 3.5}
                      className="rounded-lg p-1 hover:bg-black/10 disabled:opacity-30 transition"
                      title="Perbesar Tulisan (+)"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>

                    {zoomLevel !== 1 && (
                      <button
                        onClick={resetZoom}
                        className="p-1 hover:bg-black/10 rounded transition text-teal-600"
                        title="Kembalikan ke Ukuran Normal 100%"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Mobile Floating Reset Button (Appears only when zoomed in via 2-finger pinch) */}
                  {zoomLevel > 1.15 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetZoom();
                      }}
                      className="sm:hidden flex items-center gap-1 rounded-lg bg-teal-600/90 px-2 py-1 text-[11px] font-bold text-white shadow-md active:scale-95 transition"
                      title="Kembalikan ukuran normal"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* Direct Download PDF / Offline hub button visible on mobile & desktop */}
                  {(() => {
                    const { primaryDownloadUrl, isDirectPdf } = resolveOfflineActionUrls(book, resolution);
                    if (!primaryDownloadUrl) return null;
                    return (
                      <a
                        href={primaryDownloadUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        download={isDirectPdf ? true : undefined}
                        className="flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-600/15 px-2.5 py-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-600/25 transition ml-1"
                        title="Unduh buku untuk dibaca offline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{isDirectPdf ? 'PDF' : 'Unduh'}</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* 2. Wikisource / Wikibooks Clean Text Mode */
              resolution.mode === 'WIKISOURCE_TEXT' ? (
                resolution.contentHtml ? (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    <div className="max-w-4xl mx-auto w-full">
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

                        <footer className="mt-16 border-t border-black/10 dark:border-white/10 pt-6 text-xs opacity-85 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-sm">Informasi Lisensi &amp; Sumber Naskah:</p>
                              <p className="mt-1">{resolution.licenseNotice}</p>
                              <p className="mt-1">
                                Tautan naskah asli:{' '}
                                <a
                                  href={resolution.launchUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="underline text-teal-600 dark:text-teal-400 font-semibold"
                                >
                                  {book.provider === 'wikibooks'
                                    ? 'Wikibuku Bahasa Indonesia'
                                    : 'Wikisumber Bahasa Indonesia'}
                                </a>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const safeTitle = book.title.replace(/[&<>"']/g, (ch) =>
                                  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch)
                                );
                                const offlineHtml = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} - DARFIN BOOK Offline</title><style>body{font-family:Georgia,serif;max-width:740px;margin:32px auto;padding:0 18px;line-height:1.8;background:#FDFBF7;color:#1A1A1A;}h1,h2{font-family:system-ui,sans-serif;}img{max-width:100%;}</style></head><body><h1>${safeTitle}</h1><hr>${resolution.contentHtml}</body></html>`;
                                const blob = new Blob([offlineHtml], { type: 'text/html;charset=utf-8' });
                                const blobUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = `${book.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60)}.html`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                              }}
                              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                              <span>Simpan Baca Offline (.html)</span>
                            </button>
                          </div>
                        </footer>
                      </article>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto flex items-center justify-center p-2">
                    <BookOfflineFallbackCard
                      book={book}
                      resolution={resolution}
                      errorMessage="Teks naskah tidak dapat diambil dari server Wikimedia saat ini."
                      theme={theme}
                      onRetry={() => setReloadNonce((n) => n + 1)}
                      onBookmark={handleBookmarkClick}
                      bookmarkSaved={bookmarkSavedToast}
                    />
                  </div>
                )
              ) : (
                /* 3. Official External Reader / Direct PDF Card */
                (['kemdikbud', 'brin', 'zenodo', 'repositori', 'openaire', 'storyweaver', 'bloom'].includes(book.provider) ||
                  resolution.launchUrl?.includes('kemendikdasmen.go.id') ||
                  resolution.launchUrl?.includes('kemdikbud.go.id')) ? (
                  <div className="flex-1 overflow-y-auto mx-auto max-w-xl py-8 px-4 my-auto flex items-center">
                    <div className="w-full overflow-hidden rounded-3xl border border-black/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl backdrop-blur-md text-center text-stone-900 dark:text-slate-100">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 mb-4">
                        <BookOpen className="h-8 w-8" />
                      </div>

                      <span className="inline-block rounded-full bg-teal-100 dark:bg-teal-900/60 px-3 py-1 text-xs font-bold text-teal-800 dark:text-teal-200">
                        {PROVIDER_LABELS[book.provider] || 'Akses Terbuka Resmi'}
                      </span>

                      <h2 className="mt-3 text-lg font-bold sm:text-xl text-stone-900 dark:text-white">
                        {book.title}
                      </h2>
                      <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                        Penerbit: {book.publisher || PROVIDER_LABELS[book.provider] || 'Sumber Terbuka Resmi'}
                      </p>

                      <div className="mt-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 text-left text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        <p className="font-semibold mb-1">Akses Resmi &amp; Saran Baca Offline:</p>
                        <p>{resolution.explanation} Untuk kenyamanan tanpa hambatan jaringan, unduh file buku dan baca secara offline di perangkat Anda.</p>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        {(() => {
                          const { primaryDownloadUrl, isDirectPdf } = resolveOfflineActionUrls(book, resolution);
                          return primaryDownloadUrl ? (
                            <a
                              href={primaryDownloadUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              download={isDirectPdf ? true : undefined}
                              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-xs font-bold text-white hover:bg-teal-700 shadow-md shadow-teal-600/20 transition"
                            >
                              <Download className="h-4 w-4" />
                              <span>{isDirectPdf ? 'Unduh PDF untuk Baca Offline' : 'Buka &amp; Simpan Naskah Resmi'}</span>
                            </a>
                          ) : null;
                        })()}
                        {resolution.launchUrl &&
                          resolution.launchUrl !== resolution.pdfUrl &&
                          /^(https?:\/\/)/i.test(resolution.launchUrl) && (
                            <a
                              href={resolution.launchUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 px-5 py-3 text-xs font-bold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition"
                            >
                              <span>Buka di Sumber Asli</span>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        <button
                          type="button"
                          onClick={handleBookmarkClick}
                          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-slate-700 transition text-stone-800 dark:text-slate-100"
                        >
                          <Bookmark className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          <span>{bookmarkSavedToast ? 'Tersimpan ke Rak!' : 'Tandai Buku Ini'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : resolution.mode === 'UNAVAILABLE' ||
                  forceOfflineFallback ||
                  !resolution.launchUrl ||
                  !/^(https?:\/\/)/i.test(resolution.launchUrl) ? (
                  <div className="flex-1 overflow-y-auto flex items-center justify-center p-2">
                    <BookOfflineFallbackCard
                      book={book}
                      resolution={resolution}
                      errorMessage={resolution.explanation}
                      theme={theme}
                      onRetry={() => {
                        setForceOfflineFallback(false);
                        setReloadNonce((n) => n + 1);
                      }}
                      onBookmark={handleBookmarkClick}
                      bookmarkSaved={bookmarkSavedToast}
                    />
                  </div>
                ) : (
                  /* 4. Fullscreen Edge-to-Edge Embedded Frame with Instant Offline Escape Bar */
                  <div className="relative flex-1 w-full h-full bg-black">
                    <iframe
                      src={resolution.launchUrl}
                      title={book.title}
                      className="h-full w-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      allow="fullscreen; clipboard-write; encrypted-media"
                      allowFullScreen
                    />
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
                      <button
                        type="button"
                        onClick={() => setForceOfflineFallback(true)}
                        className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-slate-900/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md hover:bg-teal-700 transition cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-teal-400" />
                        <span>Buku gagal tampil? Unduh &amp; Baca Offline</span>
                      </button>
                    </div>
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
