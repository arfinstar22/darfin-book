import React from 'react';
import { Search, Sparkles, Sun, Moon, LogIn, User, LogOut } from 'lucide-react';
import type { UserProfile } from '../types.js';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  freeOnly: boolean;
  onToggleFreeOnly: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  user?: UserProfile | null;
  onOpenLogin?: () => void;
  onNavigateHome?: () => void;
  onNavigateAccount?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  freeOnly,
  onToggleFreeOnly,
  isDarkMode,
  onToggleDarkMode,
  user,
  onOpenLogin,
  onNavigateHome,
  onNavigateAccount,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E8E5DF] dark:border-slate-800 bg-[#FDFBF7]/90 dark:bg-[#080E1E]/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand: Logo + Wordmark */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left hover:opacity-90 transition cursor-pointer"
          title="Kembali ke Beranda"
        >
          <img
            src="/logo.png"
            alt="DARFIN BOOK Logo"
            className="h-10 w-10 rounded-xl object-cover shadow-sm transition hover:scale-105"
          />
          <div>
            <span className="text-lg font-bold tracking-tight text-[#0B132B] dark:text-white">
              DARFIN BOOK
            </span>
            <span className="hidden text-xs text-[#5A5A5A] dark:text-slate-400 sm:block">
              Perpustakaan Digital untuk Semua
            </span>
          </div>
        </button>

        {/* Global Search Bar */}
        <form
          onSubmit={onSearchSubmit}
          className="relative flex flex-1 max-w-md items-center"
        >
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#8C887B] dark:text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari judul, pelajaran, novel, atau ISBN..."
            className="w-full rounded-full border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-10 text-xs sm:text-sm text-[#1A1A1A] dark:text-white placeholder-[#8C887B] dark:placeholder-slate-500 shadow-inner focus:border-[#0D9488] dark:focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-[#0D9488] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-slate-300"
              title="Bersihkan pencarian"
            >
              ✕
            </button>
          )}
        </form>

        <div className="flex items-center gap-2">
          {/* Quick Free Filter Pill */}
          <button
            type="button"
            onClick={onToggleFreeOnly}
            className={`hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:inline-flex ${
              freeOnly
                ? 'bg-[#0D9488] text-white shadow-sm'
                : 'border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#5A5A5A] dark:text-slate-300 hover:bg-[#F4EFEA] dark:hover:bg-slate-700'
            }`}
            title="Tampilkan hanya buku yang bebas dibaca atau dipinjam gratis"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Buku Gratis Saja</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-amber-300 shadow-xs hover:bg-[#F4EFEA] dark:hover:bg-slate-700 transition"
            title={isDarkMode ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </button>

          {/* User Profile or Google Sign In */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onNavigateAccount}
                className="flex items-center gap-2 rounded-full border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/40 py-1 pl-1 pr-3 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition"
                title={`Akun: ${user.displayName} (${user.email})`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[120px] truncate">{user.displayName}</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-2xs"
                  title="Keluar dari akun Google"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 rounded-full border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-stone-700 dark:text-white shadow-xs hover:bg-stone-50 dark:hover:bg-slate-700 transition"
              title="Masuk dengan Akun Google"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
