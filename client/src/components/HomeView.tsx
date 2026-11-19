import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  GraduationCap,
  Feather,
  Compass,
  ChevronRight,
  Quote,
  RefreshCw,
  BookmarkCheck,
  ShieldCheck,
  Heart,
  Layers,
  ArrowRight,
  TrendingUp,
  BookMarked,
} from 'lucide-react';
import { BookCard } from './BookCard.js';
import type { Book, CuratedShelf } from '../types.js';

interface HomeViewProps {
  shelves: CuratedShelf[];
  loadingShelves: boolean;
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleFavorite: (book: Book) => void;
  favoriteIds: string[];
  onNavigateExplore: (catId?: string) => void;
  onSearchTopic: (query: string) => void;
}

const LITERARY_QUOTES = [
  {
    quote: 'Buku adalah jendela dunia, dan membaca adalah kuncinya untuk membuka cakrawala pengetahuan.',
    author: 'Pepatah Literasi Indonesia',
    role: 'Kearifan Pendidikan',
  },
  {
    quote: 'Aku rela di penjara asalkan bersama buku, karena dengan buku aku bebas.',
    author: 'Drs. Mohammad Hatta',
    role: 'Bung Hatta, Proklamator & Pecinta Buku',
  },
  {
    quote: 'Hanya perlu satu buku untuk jatuh cinta pada membaca. Cari buku itu, mari jatuh cinta.',
    author: 'Najwa Shihab',
    role: 'Duta Baca Indonesia',
  },
  {
    quote: 'Orang boleh pandai setinggi langit, tapi selama ia tidak menulis dan membaca, ia akan hilang di dalam masyarakat.',
    author: 'Pramoedya Ananta Toer',
    role: 'Sastrawan Legendaris Indonesia',
  },
  {
    quote: 'Ing ngarsa sung tulada, ing madya mangun karsa, tut wuri handayani. Belajarlah sepanjang hayat.',
    author: 'Ki Hajar Dewantara',
    role: 'Bapak Pendidikan Nasional',
  },
  {
    quote: 'Tujuan pendidikan itu untuk mempertajam kecerdasan, memperkukuh kemauan, serta memperhalus perasaan.',
    author: 'Tan Malaka',
    role: 'Pahlawan Nasional & Pemikir Bangsa',
  },
];

export const HomeView: React.FC<HomeViewProps> = ({
  shelves,
  loadingShelves,
  onSelectBook,
  onReadBook,
  onToggleFavorite,
  favoriteIds,
  onNavigateExplore,
  onSearchTopic,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % LITERARY_QUOTES.length);
  };

  const currentQuote = LITERARY_QUOTES[quoteIndex];

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Editorial Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-linear-to-br from-[#0B132B] via-slate-900 to-teal-950 p-6 sm:p-12 text-white shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 border border-teal-400/30 px-3.5 py-1 text-xs font-semibold text-teal-300 backdrop-blur-xs mb-4">
            <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            <span>Perpustakaan Terbuka Indonesia - 30.000+ Koleksi Bebas</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Buku Adalah Jendela Dunia.
          </h1>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-300 max-w-xl">
            Selamat datang di DARFIN BOOK. Akses gratis dan legal ke puluhan ribu buku teks pelajaran Kurikulum Merdeka, karya sastra nusantara, novel klasik, dan naskah kuno nusantara langsung dari peramban Anda.
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateExplore('all')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0D9488] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-teal-700/30 hover:bg-teal-700 transition cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Jelajahi 30.000+ Buku</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateExplore('novel')}
              className="inline-flex items-center gap-2 rounded-2xl border border-purple-400/30 bg-purple-500/20 px-4 py-3 text-xs sm:text-sm font-bold text-purple-200 hover:bg-purple-500/30 backdrop-blur-md transition cursor-pointer"
            >
              <BookMarked className="h-4 w-4 text-purple-300" />
              <span>Novel (Tere Liye, Dilan, dll)</span>
            </button>

            <button
              type="button"
              onClick={() => onSearchTopic('pelajaran')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition cursor-pointer"
            >
              <GraduationCap className="h-4 w-4 text-emerald-300" />
              <span>Buku Sekolah (SD-SMA)</span>
            </button>

            <button
              type="button"
              onClick={() => onSearchTopic('cerita')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition cursor-pointer"
            >
              <Feather className="h-4 w-4 text-amber-300" />
              <span>Sastra Nusantara</span>
            </button>
          </div>

          {/* Feature Highlights Pills */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>100% Legal & Terbuka</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              <span>Bebas Baca Tanpa Login</span>
            </div>
            <div className="flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-amber-400" />
              <span>Sinkronisasi Rak Google</span>
            </div>
          </div>
        </div>

        {/* Ambient subtle decorative background element */}
        <div className="pointer-events-none absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10">
          <BookOpen className="h-96 w-96 text-white" />
        </div>
      </section>

      {/* 2. Literary Quote of the Day Widget */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 sm:p-8 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900/50 text-teal-600 dark:text-teal-400 shadow-xs">
              <Quote className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Inspirasi Literasi Hari Ini
              </span>
              <p className="text-sm sm:text-base font-serif italic text-stone-800 dark:text-stone-200 leading-relaxed max-w-2xl">
                &ldquo;{currentQuote.quote}&rdquo;
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                <span className="font-bold text-stone-700 dark:text-slate-300">{currentQuote.author}</span>
                {' - '}
                <span>{currentQuote.role}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextQuote}
            className="flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Tampilkan kutipan lain"
          >
            <RefreshCw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Kutipan Lain</span>
          </button>
        </div>
      </section>

      {/* 3. Bento Motivation Cards: Mengapa Membaca di DARFIN BOOK */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white">
              Mengapa Membaca di DARFIN BOOK?
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Gerakan literasi digital inklusif untuk seluruh generasi Indonesia
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bento Card 1 */}
          <div className="rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 mb-4">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Buku Sekolah Kurikulum Merdeka
            </h3>
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
              Buku teks pelajaran resmi dari Pusat Perbukuan Kemendikdasmen RI untuk SD, SMP, SMA, dan SMK. Bebas diakses tanpa biaya seumur hidup.
            </p>
            <button
              type="button"
              onClick={() => onSearchTopic('pelajaran')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <span>Buka Buku Pelajaran</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Bento Card 2 */}
          <div className="rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 mb-4">
              <Feather className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Khasanah Sastra &amp; Cerita Rakyat
            </h3>
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
              Karya sastra pujangga baru nusantara, fabel dongeng daerah, dan naskah kuno Wikisumber. Warisan literasi bangsa yang tak lekang oleh waktu.
            </p>
            <button
              type="button"
              onClick={() => onSearchTopic('cerita')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <span>Baca Sastra Nusantara</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Bento Card 3 */}
          <div className="rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900 text-teal-600 dark:text-teal-400 mb-4">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Rak Pribadi &amp; Pembatas Halaman
            </h3>
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
              Masuk dengan akun Google untuk menyimpan buku favorit, menandai halaman terakhir yang dibaca, dan sinkronkan riwayat baca di seluruh perangkat.
            </p>
            <button
              type="button"
              onClick={() => onNavigateExplore('all')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <span>Jelajahi Katalog Lengkap</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Curated Shelves (Koleksi Pilihan Redaksi) */}
      <section className="space-y-10">
        {loadingShelves ? (
          <div className="space-y-4">
            <div className="h-6 w-48 bg-stone-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-stone-200 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          shelves.map((shelf) => (
            <div key={shelf.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E5DF] dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                    <span>{shelf.title}</span>
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">{shelf.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (shelf.id.includes('novel')) {
                      onNavigateExplore('novel');
                    } else if (shelf.id.includes('pelajaran')) {
                      onNavigateExplore('pelajaran');
                    } else if (shelf.id.includes('sastra')) {
                      onNavigateExplore('sastra');
                    } else if (shelf.id.includes('sains')) {
                      onNavigateExplore('sains');
                    } else {
                      onNavigateExplore('sejarah');
                    }
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer shrink-0"
                >
                  <span>Lihat Semua</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                {shelf.books.slice(0, 8).map((book) => (
                  <BookCard
                    key={`${book.provider}-${book.providerId}`}
                    book={book}
                    onSelect={onSelectBook}
                    onReadDirect={onReadBook}
                    isFavorite={favoriteIds.includes(`${book.provider}:${book.providerId}`)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 5. Reading Habit Invitation / Daily Literacy Pledge Banner */}
      <section className="rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-linear-to-r from-teal-50 via-emerald-50 to-amber-50 dark:from-slate-900 dark:via-teal-950/40 dark:to-slate-900 p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl text-center sm:text-left">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Gerakan 15 Menit Membaca Setiap Hari</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-white">
              Investasikan Waktu untuk Pikiran Anda.
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed">
              Cukup luangkan 15 menit setiap hari untuk membaca satu bab buku. Temukan ide baru, perkaya kosakata, dan perluas pandangan hidup bersama DARFIN BOOK.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateExplore('all')}
            className="rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 shadow-md shadow-teal-600/20 transition cursor-pointer shrink-0"
          >
            Mulai Membaca Sekarang
          </button>
        </div>
      </section>
    </div>
  );
};
