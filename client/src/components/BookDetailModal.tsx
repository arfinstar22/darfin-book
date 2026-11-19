import React from 'react';
import {
  X,
  BookOpen,
  Bookmark,
  ExternalLink,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  Share2,
  Heart,
} from 'lucide-react';
import type { Book } from '../types.js';
import { getAccessBadge } from './BookCard.js';
import { BookCoverVisual } from './BookCoverVisual.js';

interface BookDetailModalProps {
  book: Book | null;
  onClose: () => void;
  onRead: (book: Book) => void;
  isSaved: boolean;
  onToggleSave: (book: Book) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  onRead,
  isSaved,
  onToggleSave,
  isFavorite = false,
  onToggleFavorite,
}) => {
  if (!book) return null;

  const badge = getAccessBadge(book.access.status);
  const BadgeIcon = badge.icon;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: book.title,
        text: `Lihat buku "${book.title}" di DARFIN BOOK`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan buku disalin ke papan klip!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white dark:bg-[#0F172A] border border-[#E8E5DF] dark:border-slate-800 text-[#1A1A1A] dark:text-slate-100 shadow-2xl transition-colors">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#E8E5DF] dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.color}`}
            >
              <BadgeIcon className="h-3.5 w-3.5" />
              <span>{badge.label}</span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-stone-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Bahasa Indonesia Terverifikasi</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="rounded-full p-2 text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
              title="Bagikan"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
              title="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover Column */}
            <div className="flex flex-col items-center sm:w-1/3">
              <div className="aspect-[3/4] w-44 overflow-hidden rounded-xl border border-[#E8E5DF] dark:border-slate-700 shadow-sm bg-[#F4EFEA] dark:bg-slate-900">
                <BookCoverVisual book={book} size="large" />
              </div>

              {/* Provider Attribution Pill */}
              <div className="mt-3 text-center text-[11px] text-stone-500 dark:text-slate-400">
                Penyedia data: <span className="font-semibold capitalize text-stone-700 dark:text-slate-200">{book.provider}</span>
              </div>
            </div>

            {/* Info Column */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">{book.title}</h2>
              {book.subtitle && (
                <p className="mt-1 text-sm font-medium text-stone-600 dark:text-slate-300">{book.subtitle}</p>
              )}
              <p className="mt-2 text-sm font-semibold text-[#0D9488] dark:text-teal-400">
                {book.authors.join(', ')}
              </p>

              {/* Access Explanation Box */}
              <div className="mt-4 rounded-xl border border-[#E8E5DF] dark:border-slate-800 bg-[#FAF8F5] dark:bg-slate-900/60 p-3 text-xs leading-relaxed text-stone-700 dark:text-slate-300">
                <span className="font-bold text-[#1A1A1A] dark:text-white">Status Akses: </span>
                {book.access.explanation}
              </div>

              {/* Metadata Badges */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-stone-600 dark:text-slate-400 sm:grid-cols-2">
                {book.publisher && (
                  <div className="flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-stone-400 dark:text-slate-500" />
                    <span className="truncate">{book.publisher}</span>
                  </div>
                )}
                {book.publishedYear && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-stone-400 dark:text-slate-500" />
                    <span>Tahun {book.publishedYear}</span>
                  </div>
                )}
                {(book.isbn13 || book.isbn10) && (
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-stone-400 dark:text-slate-500" />
                    <span>ISBN: {book.isbn13 || book.isbn10}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {book.description && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">
                    Sinopsis / Deskripsi
                  </h4>
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                    {book.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E5DF] dark:border-slate-800 bg-[#FAF8F5] dark:bg-[#080E1E] px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleSave(book)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                isSaved
                  ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                  : 'border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Tersimpan di Rak' : 'Simpan ke Rak'}</span>
            </button>

            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(book)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isFavorite
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700'
                }`}
                title={isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current text-rose-500' : ''}`} />
                <span>{isFavorite ? 'Favorit' : 'Suka'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {book.sourceUrl && (
              <a
                href={book.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 rounded-xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700 transition"
              >
                <span>Buka Sumber Resmi</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {book.access.status === 'FULL_ACCESS' && (
              <button
                onClick={() => {
                  onClose();
                  onRead(book);
                }}
                className="flex items-center gap-2 rounded-xl bg-[#0B132B] dark:bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0D9488] dark:hover:bg-teal-500 transition"
              >
                <BookOpen className="h-4 w-4" />
                <span>Baca Sekarang</span>
              </button>
            )}

            {book.access.status === 'BORROW_AVAILABLE' && book.access.officialItemUrl && (
              <a
                href={book.access.officialItemUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 rounded-xl bg-[#0284C7] dark:bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0369A1] dark:hover:bg-sky-500 transition"
              >
                <BookOpen className="h-4 w-4" />
                <span>Pinjam Buku Resmi</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
