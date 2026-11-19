import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { resolveReader, getWikisourceContent } from '../api.js';
import type { Book, ReaderResolution } from '../types.js';

interface ReaderModalProps {
  book: Book;
  onClose: () => void;
}

type ReaderTheme = 'paper' | 'sepia' | 'dark';

export const ReaderModal: React.FC<ReaderModalProps> = ({ book, onClose }) => {
  const [resolution, setResolution] = useState<ReaderResolution | null>(null);
  const [chapters, setChapters] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader Settings
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [fontSize, setFontSize] = useState(18); // Default 18px
  const [isSerif, setIsSerif] = useState(true);
  const [showToc, setShowToc] = useState(false);

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
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || 'Gagal memuat pembaca buku');
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

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${themeClasses[theme]}`}>
      {/* Top Controls Bar */}
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-black/5 transition"
            title="Keluar dari pembaca"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-xs sm:max-w-md truncate">
            <h1 className="text-sm font-bold truncate">{book.title}</h1>
            <p className="text-xs opacity-70 truncate">{book.authors.join(', ')}</p>
          </div>
        </div>

        {/* Reader Customizer Controls */}
        <div className="flex items-center gap-2">
          {/* Table of Contents for multi-chapter books */}
          {chapters.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowToc(!showToc)}
                className="flex items-center gap-1.5 rounded-lg border border-black/15 bg-black/5 px-2.5 py-1 text-xs font-semibold hover:bg-black/10 transition"
                title="Daftar Bab & Bagian Buku"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Daftar Bab ({chapters.length})</span>
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

          {/* Font Family Toggle */}
          <button
            onClick={() => setIsSerif(!isSerif)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
              isSerif ? 'border-teal-600 text-teal-600' : 'border-black/20'
            }`}
            title="Ganti Font Serif / Sans"
          >
            {isSerif ? 'Serif' : 'Sans'}
          </button>

          {/* Font Size Adjusters */}
          <div className="flex items-center rounded-lg border border-black/10 bg-black/5 p-0.5">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="p-1 hover:bg-black/10 rounded"
              title="Perkecil Teks"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 2))}
              className="p-1 hover:bg-black/10 rounded"
              title="Perbesar Teks"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Theme Switchers */}
          <div className="flex items-center rounded-lg border border-black/10 bg-black/5 p-0.5">
            <button
              onClick={() => setTheme('paper')}
              className={`p-1 rounded transition ${theme === 'paper' ? 'bg-white shadow-xs' : ''}`}
              title="Mode Kertas (Terang)"
            >
              <Sun className="h-4 w-4 text-amber-500" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`p-1 rounded transition ${theme === 'sepia' ? 'bg-[#EBDDBF] shadow-xs' : ''}`}
              title="Mode Sepia (Nyaman untuk Mata)"
            >
              <Coffee className="h-4 w-4 text-[#8C6D4F]" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1 rounded transition ${theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : ''}`}
              title="Mode Malam (Gelap)"
            >
              <Moon className="h-4 w-4 text-blue-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Reader Viewport Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-sm font-medium">Memuat isi lengkap buku...</span>
          </div>
        )}

        {error && (
          <div className="mx-auto flex max-w-lg flex-col items-center justify-center p-6 text-center">
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
          <div className="mx-auto max-w-4xl">
            {/* 1. Wikisource Clean Complete Text Mode */}
            {resolution.mode === 'WIKISOURCE_TEXT' && resolution.contentHtml && (
              <article
                className={`prose max-w-none transition-all leading-relaxed ${
                  isSerif ? 'reader-serif' : 'font-sans'
                }`}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.85',
                }}
              >
                {/* Complete Unabridged Text */}
                <div
                  dangerouslySetInnerHTML={{ __html: resolution.contentHtml }}
                  className="space-y-6"
                />

                {/* License Attribution Footer */}
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
            )}

            {/* 2. Interactive Embedded Full Book Reader (Internet Archive / Google Books) */}
            {(resolution.mode === 'PROVIDER_READER' ||
              resolution.mode === 'INTERNAL_PDF' ||
              resolution.mode === 'GOOGLE_EMBEDDED') && (
              <div className="flex flex-col gap-4">
                {/* Reader Chrome Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 p-3 backdrop-blur-xs text-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <span className="font-bold text-teal-800">
                      Pembaca Resmi Buku Lengkap (Halaman per Halaman)
                    </span>
                  </div>

                  {resolution.launchUrl && (
                    <a
                      href={resolution.launchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1.5 font-semibold text-teal-700 hover:underline"
                    >
                      <span>Buka di Tab Baru</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* Live Embedded BookReader Frame */}
                {resolution.launchUrl ? (
                  <div className="relative w-full h-[78vh] rounded-2xl overflow-hidden border border-black/15 bg-stone-900 shadow-2xl">
                    <iframe
                      src={resolution.launchUrl}
                      title={book.title}
                      className="h-full w-full border-0"
                      allow="fullscreen; clipboard-write; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm">{resolution.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
