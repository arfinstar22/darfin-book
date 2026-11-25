import React from 'react';
import {
  WifiOff,
  Download,
  RotateCw,
  ExternalLink,
  Smartphone,
  Bookmark,
  Check,
  FileDown,
} from 'lucide-react';
import { PROVIDER_LABELS, type Book, type ReaderResolution } from '../types.js';
import { resolveOfflineActionUrls } from '../utils/bookDownload.js';

export type ReaderThemeMode = 'paper' | 'sepia' | 'dark';

interface BookOfflineFallbackCardProps {
  book: Book;
  resolution?: ReaderResolution | null;
  errorMessage?: string | null;
  theme?: ReaderThemeMode;
  failedPageNumber?: number;
  onRetry?: () => void;
  onBookmark?: () => void;
  bookmarkSaved?: boolean;
}

/**
 * Editorial high-craft fallback card displayed when book pages or endpoints fail to load,
 * encouraging users to download legal copies for reliable offline reading.
 */
export const BookOfflineFallbackCard: React.FC<BookOfflineFallbackCardProps> = ({
  book,
  resolution,
  errorMessage,
  theme = 'paper',
  failedPageNumber,
  onRetry,
  onBookmark,
  bookmarkSaved = false,
}) => {
  const { primaryDownloadUrl, isDirectPdf, sourceUrl, hasDownloadCapability } =
    resolveOfflineActionUrls(book, resolution);

  const palette = {
    paper: {
      card: 'bg-white border-[#E5E0D5] text-[#1A1A1A] shadow-2xl',
      badge: 'bg-amber-50 border-amber-200 text-amber-800',
      iconWrap: 'bg-rose-50 border-rose-200 text-rose-600',
      muted: 'text-[#5A5A5A]',
      tipBox: 'bg-teal-50/70 border-teal-200 text-teal-950',
      tipIcon: 'bg-teal-600 text-white',
      tipSub: 'text-teal-800',
      btnSecondary:
        'bg-stone-100 hover:bg-stone-200 border-[#DCD8CE] text-stone-800',
    },
    sepia: {
      card: 'bg-[#FAF4E6] border-[#D5C5A1] text-[#433422] shadow-2xl',
      badge: 'bg-amber-100/80 border-[#C8B68F] text-[#5C4227]',
      iconWrap: 'bg-rose-100/80 border-rose-300 text-rose-700',
      muted: 'text-[#6E5942]',
      tipBox: 'bg-[#EFE5CD] border-[#C8B68F] text-[#3D2E1E]',
      tipIcon: 'bg-[#7A5A35] text-white',
      tipSub: 'text-[#5C4227]',
      btnSecondary:
        'bg-[#EBDDBF] hover:bg-[#E1CEAA] border-[#C8B68F] text-[#433422]',
    },
    dark: {
      card: 'bg-[#0F172A] border-slate-700/80 text-slate-100 shadow-2xl',
      badge: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
      iconWrap: 'bg-rose-950/60 border-rose-800/70 text-rose-400',
      muted: 'text-slate-400',
      tipBox: 'bg-teal-950/50 border-teal-800/70 text-slate-100',
      tipIcon: 'bg-teal-500 text-slate-950',
      tipSub: 'text-teal-200/90',
      btnSecondary:
        'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100',
    },
  }[theme];

  const headline =
    failedPageNumber !== undefined
      ? `Halaman ${failedPageNumber} Gagal Dimuat`
      : 'Buku Gagal Dimuat di Pembaca';

  const reasonText =
    errorMessage ||
    (failedPageNumber !== undefined
      ? 'Koneksi ke server gambar halaman terputus atau penyedia sedang membatasi akses streaming.'
      : 'Koneksi sedang tidak stabil atau penyedia naskah sedang mengalami gangguan sementara.');

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mx-auto flex w-full max-w-lg items-center justify-center px-3 py-6 my-auto"
    >
      <div
        className={`w-full overflow-hidden rounded-3xl border p-5 sm:p-7 transition-colors ${palette.card}`}
      >
        {/* Status Header */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-xs ${palette.iconWrap}`}
          >
            <WifiOff className="h-7 w-7" />
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${palette.badge}`}
          >
            <span>{PROVIDER_LABELS[book.provider] || 'Sumber Terbuka'}</span>
          </span>

          <h3 className="mt-3 text-lg sm:text-xl font-extrabold tracking-tight leading-snug">
            {headline}
          </h3>

          <p className={`mt-1.5 text-xs sm:text-sm leading-relaxed max-w-md ${palette.muted}`}>
            {reasonText}
          </p>
        </div>

        {/* Offline Reading Suggestion Box */}
        <div className={`mt-5 rounded-2xl border p-4 text-left ${palette.tipBox}`}>
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs ${palette.tipIcon}`}
            >
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="space-y-1.5 text-xs leading-relaxed">
              <p className="font-extrabold text-[13px]">
                Saran Terbaik: Unduh &amp; Baca Secara Offline
              </p>
              <p className={palette.tipSub}>
                Simpan salinan legal buku ini langsung ke HP atau perangkat Anda agar tetap bisa dibaca dengan lancar kapan saja - bebas buffering dan hemat kuota internet.
              </p>
              <ul className={`space-y-1 pt-0.5 text-[11px] font-medium ${palette.tipSub}`}>
                <li className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5 shrink-0 opacity-85" />
                  <span>Format resmi (PDF / EPUB) langsung terbuka di pembaca bawaan HP.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons (Min 44px touch targets) */}
        <div className="mt-5 flex flex-col gap-2.5">
          {primaryDownloadUrl && (
            <a
              href={primaryDownloadUrl}
              target="_blank"
              rel="noreferrer noopener"
              download={isDirectPdf ? true : undefined}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0D9488] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-teal-700/25 hover:bg-teal-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>
                {isDirectPdf
                  ? 'Unduh PDF untuk Baca Offline'
                  : hasDownloadCapability
                    ? 'Unduh Buku (PDF / EPUB Offline)'
                    : 'Buka & Simpan dari Sumber Resmi'}
              </span>
            </a>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition cursor-pointer ${palette.btnSecondary}`}
              >
                <RotateCw className="h-3.5 w-3.5 shrink-0" />
                <span>Coba Muat Ulang</span>
              </button>
            )}

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition ${palette.btnSecondary}`}
              >
                <span>Buka Web Asli</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}

            {onBookmark && (
              <button
                type="button"
                onClick={onBookmark}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition cursor-pointer ${palette.btnSecondary}`}
                title="Tandai buku ini ke rak untuk dibuka nanti"
              >
                {bookmarkSaved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                )}
                <span>{bookmarkSaved ? 'Ditandai' : 'Tandai'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
