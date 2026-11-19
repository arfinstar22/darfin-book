import React, { useState, useEffect } from 'react';
import {
  X,
  Type,
  Sun,
  Moon,
  Coffee,
  ExternalLink,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Maximize2,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader Settings
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [fontSize, setFontSize] = useState(18); // Default 18px per spec 6.1.1
  const [isSerif, setIsSerif] = useState(true);

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
          <div className="max-w-md truncate">
            <h1 className="text-sm font-bold truncate">{book.title}</h1>
            <p className="text-xs opacity-70 truncate">{book.authors.join(', ')}</p>
          </div>
        </div>

        {/* Reader Customizer Controls */}
        <div className="flex items-center gap-2">
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
            <span className="text-sm">Menyiapkan buku...</span>
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
          <div className="mx-auto max-w-3xl">
            {/* 1. Wikisource Clean Text Mode */}
            {resolution.mode === 'WIKISOURCE_TEXT' && resolution.contentHtml && (
              <article
                className={`prose max-w-none transition-all leading-relaxed ${
                  isSerif ? 'reader-serif' : 'font-sans'
                }`}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.75',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: resolution.contentHtml }}
                  className="space-y-4"
                />

                {/* License Attribution Footer */}
                <footer className="mt-12 border-t border-black/10 pt-4 text-xs opacity-70">
                  <p className="font-semibold">Informasi Lisensi & Sumber:</p>
                  <p>{resolution.licenseNotice}</p>
                  <p className="mt-1">
                    Tautan asli:{' '}
                    <a
                      href={resolution.launchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline text-teal-600"
                    >
                      Wikisumber Bahasa Indonesia
                    </a>
                  </p>
                </footer>
              </article>
            )}

            {/* 2. Provider Reader / PDF / External Embed */}
            {(resolution.mode === 'PROVIDER_READER' ||
              resolution.mode === 'INTERNAL_PDF' ||
              resolution.mode === 'GOOGLE_EMBEDDED') && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white/50 p-6 backdrop-blur-xs">
                  <h3 className="text-base font-bold text-teal-700">Akses Buku Resmi Tersedia</h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-80">
                    {resolution.explanation}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {resolution.launchUrl && (
                      <a
                        href={resolution.launchUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-700 transition"
                      >
                        <span>Buka Pembaca Resmi ({book.provider.toUpperCase()})</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
