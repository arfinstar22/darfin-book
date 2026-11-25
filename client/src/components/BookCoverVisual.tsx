import React, { useState } from 'react';
import { BookOpen, Sparkles, GraduationCap, Feather, Bookmark } from 'lucide-react';
import type { Book } from '../types.js';

interface BookCoverVisualProps {
  book: Book;
  className?: string;
  size?: 'normal' | 'large';
}

const PALETTES = [
  {
    bg: 'from-[#0B1E36] to-[#060F1B]',
    border: 'border-amber-300/30',
    accent: 'text-amber-300',
    tag: 'bg-amber-400/20 text-amber-200',
  },
  {
    bg: 'from-[#0E3A2F] to-[#071F19]',
    border: 'border-emerald-300/30',
    accent: 'text-emerald-300',
    tag: 'bg-emerald-400/20 text-emerald-200',
  },
  {
    bg: 'from-[#4A1521] to-[#240A10]',
    border: 'border-rose-300/30',
    accent: 'text-rose-300',
    tag: 'bg-rose-400/20 text-rose-200',
  },
  {
    bg: 'from-[#5C2E17] to-[#2E160A]',
    border: 'border-amber-400/30',
    accent: 'text-amber-400',
    tag: 'bg-amber-400/20 text-amber-200',
  },
  {
    bg: 'from-[#3A2254] to-[#1C102A]',
    border: 'border-purple-300/30',
    accent: 'text-purple-300',
    tag: 'bg-purple-400/20 text-purple-200',
  },
  {
    bg: 'from-[#1A2530] to-[#0D1318]',
    border: 'border-cyan-300/30',
    accent: 'text-cyan-300',
    tag: 'bg-cyan-400/20 text-cyan-200',
  },
];

function getPalette(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export const BookCoverVisual: React.FC<BookCoverVisualProps> = ({
  book,
  className = '',
  size = 'normal',
}) => {
  const [imgError, setImgError] = useState(false);
  const palette = getPalette(book.title);

  // If there's an image and it hasn't failed, show the real cover image
  if (book.coverUrl && !imgError) {
    return (
      <div className={`relative aspect-[3/4] w-full overflow-hidden bg-[#F4EFEA] ${className}`}>
        <img
          src={book.coverUrl}
          alt={book.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        {/* Subtle realistic book spine highlight on the left */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/30 via-black/10 to-transparent" />
      </div>
    );
  }

  // Fallback: Generate an authentic, beautiful hardcover book design
  const isSchoolBook =
    book.provider === 'kemdikbud' ||
    book.title.toLowerCase().includes('matematika') ||
    book.title.toLowerCase().includes('kelas') ||
    book.title.toLowerCase().includes('pelajaran');

  const categoryLabel = isSchoolBook
    ? 'Buku Teks Pelajaran'
    : book.provider === 'wikibooks'
      ? 'Modul & Panduan'
      : book.provider === 'brin' || book.provider === 'zenodo' || book.provider === 'openaire' || book.provider === 'repositori'
        ? 'Pustaka Riset & Ilmu'
        : book.provider === 'storyweaver' || book.provider === 'bloom'
          ? 'Cerita Bergambar'
          : book.provider === 'wikisource'
            ? 'Sastra Nusantara'
            : 'Koleksi Indonesia';

  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-md bg-gradient-to-b ${palette.bg} p-3 text-white shadow-md transition duration-300 group-hover:scale-[1.02] flex flex-col justify-between ${className}`}
    >
      {/* Book spine crease effect on left side */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/40 via-black/15 to-transparent border-r border-white/5" />

      {/* Outer Ornamental Frame */}
      <div className={`absolute inset-2 rounded-sm border ${palette.border} pointer-events-none`} />
      <div className="absolute inset-2.5 border border-white/10 pointer-events-none" />

      {/* Top Header Badge */}
      <div className="relative z-10 pt-1 px-1 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs ${palette.tag}`}
        >
          {isSchoolBook ? (
            <GraduationCap className="h-2.5 w-2.5" />
          ) : (
            <Feather className="h-2.5 w-2.5" />
          )}
          <span>{categoryLabel}</span>
        </span>
        <Bookmark className="h-3 w-3 text-amber-200/60" />
      </div>

      {/* Middle: Title & Author in Editorial Serif */}
      <div className="relative z-10 px-2 text-center my-auto">
        <h4
          className={`reader-serif font-bold leading-tight line-clamp-3 ${
            size === 'large' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
          } text-amber-50 drop-shadow-sm`}
        >
          {book.title}
        </h4>

        {/* Decorative divider */}
        <div className="my-2 flex items-center justify-center gap-1.5 opacity-60">
          <div className="h-px w-6 bg-amber-200/50" />
          <Sparkles className="h-2.5 w-2.5 text-amber-300" />
          <div className="h-px w-6 bg-amber-200/50" />
        </div>

        <p className="line-clamp-1 text-[10px] italic text-amber-200/80">
          {book.authors[0] || 'Karya Nusantara'}
        </p>
      </div>

      {/* Bottom: Library Hallmark / Publisher seal */}
      <div className="relative z-10 pb-1 text-center">
        <span className="text-[9px] tracking-widest font-semibold uppercase opacity-60 text-amber-200">
          DARFIN EDISI RESMI
        </span>
      </div>
    </div>
  );
};
