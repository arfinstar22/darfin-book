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
} from 'lucide-react';

interface AccountViewProps {
  onClearAllData: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  onClearAllData,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Akun & Pengaturan</h2>
        <p className="text-xs text-stone-500 dark:text-slate-400">
          Informasi platform DARFIN BOOK dan kontrol data peramban
        </p>
      </div>

      <div className="space-y-4">
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
                Perpustakaan Digital untuk Semua &middot; Versi 1.0.0 (Web + Mini App)
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
                Dapat diakses melalui Web, Telegram Bot, Telegram Mini App, dan kemasan Android APK dengan satu backend katalog terpadu.
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
