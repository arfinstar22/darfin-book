import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  freeOnly: boolean;
  onToggleFreeOnly: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  freeOnly,
  onToggleFreeOnly,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E8E5DF] bg-[#FDFBF7]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand: Logo + Wordmark */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="DARFIN BOOK Logo"
            className="h-10 w-10 rounded-xl object-cover shadow-sm transition hover:scale-105"
          />
          <div>
            <span className="text-lg font-bold tracking-tight text-[#0B132B]">
              DARFIN BOOK
            </span>
            <span className="hidden text-xs text-[#5A5A5A] sm:block">
              Perpustakaan Digital untuk Semua
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <form
          onSubmit={onSearchSubmit}
          className="relative flex flex-1 max-w-md items-center"
        >
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#8C887B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari judul, pelajaran, novel, atau ISBN..."
            className="w-full rounded-full border border-[#DCD8CE] bg-white py-2 pl-10 pr-4 text-sm text-[#1A1A1A] placeholder-[#8C887B] transition focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
          />
        </form>

        {/* Quick Free Filter Pill */}
        <button
          type="button"
          onClick={onToggleFreeOnly}
          className={`hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:inline-flex ${
            freeOnly
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'border border-[#DCD8CE] bg-white text-[#5A5A5A] hover:bg-[#F4EFEA]'
          }`}
          title="Tampilkan hanya buku yang bebas dibaca atau dipinjam gratis"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Buku Gratis Saja</span>
        </button>
      </div>
    </header>
  );
};
