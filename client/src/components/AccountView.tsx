import React from 'react';
import {
  ShieldCheck,
  Globe,
  Trash2,
  ExternalLink,
  Info,
  Smartphone,
} from 'lucide-react';

interface AccountViewProps {
  onClearAllData: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({ onClearAllData }) => {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A]">Akun & Pengaturan</h2>
        <p className="text-xs text-stone-500">
          Informasi platform DARFIN BOOK dan kontrol data peramban
        </p>
      </div>

      <div className="space-y-4">
        {/* Brand Banner */}
        <div className="rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="DARFIN BOOK Logo"
              className="h-12 w-12 rounded-2xl object-cover shadow-xs"
            />
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A]">DARFIN BOOK</h3>
              <p className="text-xs text-stone-500">
                Perpustakaan Digital untuk Semua &middot; Versi 1.0.0 (Web + Mini App)
              </p>
            </div>
          </div>
        </div>

        {/* Policy & Compliance Information */}
        <div className="rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs space-y-4 text-xs text-stone-600 leading-relaxed">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A]">Kebijakan Bahasa Indonesia</h4>
              <p className="mt-0.5">
                Katalog default hanya menyajikan edisi buku yang terverifikasi berbahasa Indonesia. Buku non-Indonesia tidak dimunculkan dalam katalog umum.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A]">Integritas Hak Cipta & Sumber Legal</h4>
              <p className="mt-0.5">
                DARFIN BOOK bukan perpustakaan bayangan. Seluruh naskah yang dapat dibaca berasal dari sumber terbuka resmi: Wikisumber Indonesia (Domain Publik), SIBI Kemendikbudristek (Akses Terbuka Pendidikan), dan peminjaman digital resmi Open Library.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#1A1A1A]">Dukungan Multi-Platform</h4>
              <p className="mt-0.5">
                Dapat diakses melalui Web, Telegram Bot, Telegram Mini App, dan kemasan Android APK dengan satu backend katalog terpadu.
              </p>
            </div>
          </div>
        </div>

        {/* Data Reset */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 shadow-xs">
          <h4 className="font-bold text-rose-900 text-sm">Privasi & Riwayat Lokal</h4>
          <p className="mt-1 text-xs text-rose-700">
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
