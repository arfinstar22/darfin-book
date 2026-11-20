import React from 'react';
import {
  ShieldCheck,
  Globe,
  Trash2,
  ExternalLink,
  Info,
  Smartphone,
  Sun,
  Moon,
  LogOut,
  Bookmark,
  Heart,
  BookOpen,
  UserCheck,
  RotateCw,
} from 'lucide-react';
import type { UserProfile } from '../types.js';

interface AccountViewProps {
  onClearAllData: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  user?: UserProfile | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  onSyncLibrary?: () => void;
  isSyncing?: boolean;
  savedCount?: number;
  favoriteCount?: number;
  bookmarkCount?: number;
}

export const AccountView: React.FC<AccountViewProps> = ({
  onClearAllData,
  isDarkMode = false,
  onToggleDarkMode,
  user,
  onOpenLogin,
  onLogout,
  onSyncLibrary,
  isSyncing = false,
  savedCount = 0,
  favoriteCount = 0,
  bookmarkCount = 0,
}) => {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Akun & Pengaturan</h2>
        <p className="text-xs text-stone-500 dark:text-slate-400">
          Informasi platform DARFIN BOOK, status akun Google, dan kontrol data
        </p>
      </div>

      <div className="space-y-4">
        {/* Google Account Profile Card */}
        {user ? (
          <div className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-white dark:bg-[#0F172A] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-14 w-14 rounded-2xl object-cover border border-teal-200 dark:border-teal-800"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-xs">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                      {user.displayName}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                      <UserCheck className="h-3 w-3" />
                      <span>Google</span>
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition self-start sm:self-auto"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar Akun</span>
                </button>
              )}
            </div>

            {/* User Library Stats */}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#F0ECE1] dark:border-slate-800 pt-4 text-center">
              <div className="rounded-xl bg-[#FAF8F5] dark:bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-center text-teal-600 dark:text-teal-400 mb-1">
                  <Bookmark className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                  {savedCount}
                </div>
                <div className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                  Buku di Rak
                </div>
              </div>

              <div className="rounded-xl bg-[#FAF8F5] dark:bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-center text-rose-500 mb-1">
                  <Heart className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                  {favoriteCount}
                </div>
                <div className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                  Buku Favorit
                </div>
              </div>

              <div className="rounded-xl bg-[#FAF8F5] dark:bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-center text-amber-500 mb-1">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                  {bookmarkCount}
                </div>
                <div className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                  Pembatas Halaman
                </div>
              </div>
            </div>

            {/* Cloud Sync Section */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 p-3.5">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/70 text-teal-700 dark:text-teal-300 ${isSyncing ? 'animate-spin' : ''}`}>
                  <RotateCw className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                    <span>Sinkronisasi Cloud Aktif</span>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-slate-400">
                    {isSyncing
                      ? 'Sedang mengunduh rak buku & favorit dari cloud...'
                      : 'Data buku tersimpan aman dan terhubung dengan server cloud.'}
                  </div>
                </div>
              </div>

              {onSyncLibrary && (
                <button
                  type="button"
                  onClick={onSyncLibrary}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] hover:bg-teal-700 active:scale-95 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                  Masuk dengan Akun Google
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-slate-400 leading-relaxed max-w-md">
                  Login diperlukan saat menyimpan buku ke rak, menandai buku favorit, dan menyimpan pembatas halaman. Membaca tetap 100% gratis tanpa login.
                </p>
              </div>

              {onOpenLogin && (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="flex items-center gap-2.5 rounded-xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-stone-800 dark:text-white shadow-xs hover:bg-stone-50 dark:hover:bg-slate-700 transition self-start sm:self-auto shrink-0"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                  <span>Login dengan Google</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Brand Banner */}
        <div className="rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="DARFIN BOOK Logo"
              className="h-12 w-12 rounded-2xl object-cover shadow-xs"
            />
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">DARFIN BOOK</h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Perpustakaan Digital untuk Semua &middot; Versi 1.0.0 (Web & Android APK)
              </p>
            </div>
          </div>
        </div>

        {/* Theme Settings (Light Mode / Dark Mode) */}
        {onToggleDarkMode && (
          <div className="rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[#1A1A1A] dark:text-white text-sm">Tema Tampilan Aplikasi</h4>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                  Pilih antara Mode Terang (Light) atau Mode Gelap (Dark)
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#E8E5DF] dark:border-slate-700 bg-stone-50 dark:bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isDarkMode) onToggleDarkMode();
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    !isDarkMode
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Terang</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isDarkMode) onToggleDarkMode();
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isDarkMode
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5 text-amber-300" />
                  <span>Gelap</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Policy & Compliance Information */}
        <div className="rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-xs space-y-4 text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A] dark:text-white">Kebijakan Bahasa Indonesia</h4>
              <p className="mt-0.5">
                Katalog default hanya menyajikan edisi buku yang terverifikasi berbahasa Indonesia. Buku non-Indonesia tidak dimunculkan dalam katalog umum.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A] dark:text-white">Integritas Hak Cipta & Sumber Legal</h4>
              <p className="mt-0.5">
                DARFIN BOOK bukan perpustakaan bayangan. Seluruh naskah yang dapat dibaca berasal dari sumber terbuka resmi: Wikisumber Indonesia (Domain Publik), SIBI Kemendikbudristek (Akses Terbuka Pendidikan), dan peminjaman digital resmi Open Library.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A] dark:text-white">Dukungan Multi-Platform</h4>
              <p className="mt-0.5">
                Dapat diakses melalui Web dan kemasan aplikasi Android APK dengan satu akun Google terpadu.
              </p>
            </div>
          </div>
        </div>

        {/* Data Reset */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-6 shadow-xs">
          <h4 className="font-bold text-rose-900 dark:text-rose-300 text-sm">Privasi & Riwayat Lokal</h4>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
            Hapus seluruh data rak buku dan riwayat membaca yang tersimpan di peramban ini.
          </p>

          <button
            onClick={onClearAllData}
            className="mt-4 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus Semua Data Lokal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
