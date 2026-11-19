import React from 'react';
import { CheckCircle2, Clock, Eye, Info, Heart } from 'lucide-react';
import type { AccessStatus, Book } from '../types.js';
import { BookCoverVisual } from './BookCoverVisual.js';

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  onReadDirect?: (book: Book) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (book: Book) => void;
}

export const getAccessBadge = (status: AccessStatus) => {
  switch (status) {
    case 'FULL_ACCESS':
      return {
        label: 'Akses Penuh',
        color: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: CheckCircle2,
      };
    case 'BORROW_AVAILABLE':
      return {
        label: 'Bisa Dipinjam',
        color: 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        icon: Clock,
      };
    case 'PREVIEW':
      return {
        label: 'Pratinjau',
        color: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        icon: Eye,
      };
    default:
      return {
        label: 'Info Saja',
        color: 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 border-stone-200 dark:border-slate-700',
        icon: Info,
      };
  }
};

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onSelect,
  onReadDirect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const badge = getAccessBadge(book.access.status);
  const BadgeIcon = badge.icon;
  const isDirectReadable =
    book.access.status === 'FULL_ACCESS' &&
    (book.access.readerMode === 'WIKISOURCE_TEXT' ||
      book.access.readerMode === 'INTERNAL_PDF' ||
      book.access.readerMode === 'PROVIDER_READER');

  return (
    <div
      onClick={() => onSelect(book)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-3.5 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-[#D0CBBF] dark:hover:border-slate-700 hover:shadow-md cursor-pointer"
    >
      <div>
        {/* Cover Aspect Ratio Container */}
        <div className="relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl shadow-xs bg-[#F4EFEA] dark:bg-slate-900">
          <BookCoverVisual book={book} />

          {/* Access Status Pill */}
          <div className="absolute top-2 left-2 z-20">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-xs ${badge.color}`}
            >
              <BadgeIcon className="h-3 w-3" />
              <span>{badge.label}</span>
            </span>
          </div>

          {/* Favorite Button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(book);
              }}
              className={`absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md shadow-xs transition ${
                isFavorite
                  ? 'bg-rose-500 text-white'
                  : 'bg-black/30 text-white/80 hover:bg-black/50 hover:text-white'
              }`}
              title={isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Title & Author */}
        <h3 className="line-clamp-2 text-sm font-bold text-[#1A1A1A] dark:text-slate-100 group-hover:text-[#0D9488] dark:group-hover:text-teal-400">
          {book.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-[#5A5A5A] dark:text-slate-400">
          {book.authors.join(', ')}
        </p>
      </div>

      {/* Meta Footer & Quick Action */}
      <div className="mt-3 flex items-center justify-between border-t border-[#F0ECE1] dark:border-slate-800/80 pt-2.5 text-[11px] text-[#78716C] dark:text-slate-400">
        <span>{book.publishedYear || 'Bahasa Indonesia'}</span>

        {isDirectReadable && onReadDirect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReadDirect(book);
            }}
            className="rounded-lg bg-[#0B132B] dark:bg-teal-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#0D9488] dark:hover:bg-teal-500"
          >
            Baca
          </button>
        ) : (
          <span className="text-[11px] font-medium text-[#0D9488] dark:text-teal-400">Detail</span>
        )}
      </div>
    </div>
  );
};
