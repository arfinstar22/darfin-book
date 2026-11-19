import React from 'react';
import {
  GraduationCap,
  Feather,
  Landmark,
  Compass,
  Cpu,
  BookOpen,
} from 'lucide-react';

interface ExploreViewProps {
  onCategorySelect: (query: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onCategorySelect,
}) => {
  const categories = [
    {
      id: 'pelajaran',
      title: 'Buku Pelajaran Resmi',
      desc: 'Buku teks Kurikulum Merdeka untuk SD, SMP, SMA, dan SMK.',
      query: 'pelajaran',
      icon: GraduationCap,
      color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'sastra',
      title: 'Sastra & Cerita Rakyat',
      desc: 'Karya sastra klasik Indonesia, cerpen, fabel, dan dongeng nusantara.',
      query: 'cerita',
      icon: Feather,
      color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    {
      id: 'sejarah',
      title: 'Sejarah & Kebudayaan',
      desc: 'Naskah babad nusantara, biografi tokoh, dan sejarah nusantara.',
      query: 'sejarah',
      icon: Landmark,
      color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    {
      id: 'matematika-sains',
      title: 'Matematika & IPA',
      desc: 'Buku ajar Matematika, Fisika, Biologi, dan Kimia sekolah.',
      query: 'matematika',
      icon: Cpu,
      color: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
      id: 'bahasa',
      title: 'Bahasa Indonesia',
      desc: 'Buku ajar tata bahasa, literasi, dan bahasa persatuan.',
      query: 'bahasa indonesia',
      icon: BookOpen,
      color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    },
    {
      id: 'umum',
      title: 'Buku Umum Domain Publik',
      desc: 'Ribuan naskah klasik dan arsip buku yang bebas dibaca publik.',
      query: 'indonesia',
      icon: Compass,
      color: 'bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-200 dark:border-slate-700',
    },
  ];

  return (
    <div className="pb-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Jelajahi Berdasarkan Kategori</h2>
        <p className="text-xs text-stone-500 dark:text-slate-400">
          Temukan koleksi buku berbahasa Indonesia pilihan sesuai kebutuhan belajar dan membaca Anda
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => onCategorySelect(cat.query)}
              className="group flex flex-col justify-between rounded-2xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 shadow-xs transition hover:-translate-y-1 hover:border-[#D0CBBF] dark:hover:border-slate-700 hover:shadow-md cursor-pointer"
            >
              <div>
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${cat.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-base font-bold text-[#1A1A1A] dark:text-slate-100 group-hover:text-[#0D9488] dark:group-hover:text-teal-400 transition">
                  {cat.title}
                </h3>
                <p className="mt-1 text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
                  {cat.desc}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#0D9488] dark:text-teal-400">
                <span>Buka Koleksi</span>
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
