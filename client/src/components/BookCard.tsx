import React from 'react';
import { Book as BookIcon, CheckCircle2, Clock, Eye, Info } from 'lucide-react';
import type { AccessStatus, Book } from '../types.js';

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  onReadDirect?: (book: Book) => void;
}

export const getAccessBadge = (status: AccessStatus) => {
  switch (status) {
    case 'FULL_ACCESS':
      return {
        label: 'Akses Penuh',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'BORROW_AVAILABLE':
      return {
        label: 'Bisa Dipinjam',
        color: 'bg-sky-50 text-sky-700 border-sky-200',
        icon: Clock,
      };
    case 'PREVIEW':
      return {
        label: 'Pratinjau',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Eye,
      };
    default:
      return {
        label: 'Info Saja',
        color: 'bg-stone-100 text-stone-600 border-stone-200',
        icon: Info,
      };
  }
};

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onSelect,
  onReadDirect,
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
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E8E5DF] bg-white p-3.5 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-[#D0CBBF] hover:shadow-md cursor-pointer"
    >
      <div>
        {/* Cover Aspect Ratio Container */}
        <div className="relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl bg-[#F4EFEA]">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              onError={(e) => {
                // Fallback on broken image
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <BookIcon className="h-10 w-10 text-[#A8A29E] stroke-1" />
              <span className="mt-2 line-clamp-2 text-xs font-semibold text-[#5A5A5A]">
                {book.title}
              </span>
            </div>
          )}

          {/* Access Status Pill */}
          <div className="absolute top-2 left-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-xs ${badge.color}`}
            >
              <BadgeIcon className="h-3 w-3" />
              <span>{badge.label}</span>
            </span>
          </div>
        </div>

        {/* Title & Author */}
        <h3 className="line-clamp-2 text-sm font-bold text-[#1A1A1A] group-hover:text-[#0D9488]">
          {book.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-[#5A5A5A]">
          {book.authors.join(', ')}
        </p>
      </div>

      {/* Meta Footer & Quick Action */}
      <div className="mt-3 flex items-center justify-between border-t border-[#F0ECE1] pt-2.5 text-[11px] text-[#78716C]">
        <span>{book.publishedYear || 'Bahasa Indonesia'}</span>

        {isDirectReadable && onReadDirect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReadDirect(book);
            }}
            className="rounded-lg bg-[#0B132B] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#0D9488]"
          >
            Baca
          </button>
        ) : (
          <span className="text-[11px] font-medium text-[#0D9488]">Detail</span>
        )}
      </div>
    </div>
  );
};
