import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Calendar, Database, RotateCcw } from 'lucide-react';
import type { BookSortOption, BookSourceFilter, CatalogFilterState } from '../types.js';
import { DEFAULT_CATALOG_FILTER } from '../utils/bookSort.js';

interface CatalogControlsProps {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  showSourceFilter?: boolean;
  showPopularOption?: boolean;
}

type YearPresetId = 'all' | '2020_now' | '2010_2019' | '2000_2009' | 'classic' | 'custom';

function detectYearPreset(yearFrom?: number, yearTo?: number): YearPresetId {
  if (yearFrom === undefined && yearTo === undefined) return 'all';
  if (yearFrom === 2020 && yearTo === undefined) return '2020_now';
  if (yearFrom === 2010 && yearTo === 2019) return '2010_2019';
  if (yearFrom === 2000 && yearTo === 2009) return '2000_2009';
  if (yearFrom === undefined && yearTo === 1999) return 'classic';
  return 'custom';
}

/**
 * Shared accessible sort, year-range, and source filter controls for catalog, search, and shelf views.
 */
export const CatalogControls: React.FC<CatalogControlsProps> = ({
  value,
  onChange,
  showSourceFilter = true,
  showPopularOption = true,
}) => {
  const activePreset = detectYearPreset(value.yearFrom, value.yearTo);
  const [isCustomYearOpen, setIsCustomYearOpen] = useState(activePreset === 'custom');
  const [customFrom, setCustomFrom] = useState(value.yearFrom ? String(value.yearFrom) : '');
  const [customTo, setCustomTo] = useState(value.yearTo ? String(value.yearTo) : '');

  useEffect(() => {
    setCustomFrom(value.yearFrom ? String(value.yearFrom) : '');
    setCustomTo(value.yearTo ? String(value.yearTo) : '');
    if (detectYearPreset(value.yearFrom, value.yearTo) === 'custom') {
      setIsCustomYearOpen(true);
    } else if (value.yearFrom === undefined && value.yearTo === undefined) {
      setIsCustomYearOpen(false);
    }
  }, [value.yearFrom, value.yearTo]);

  const isFiltered =
    value.sort !== 'relevance' ||
    value.yearFrom !== undefined ||
    value.yearTo !== undefined ||
    value.source !== 'all';

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      sort: e.target.value as BookSortOption,
    });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      source: e.target.value as BookSourceFilter,
    });
  };

  const handleYearPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value as YearPresetId;
    if (preset === 'custom') {
      setIsCustomYearOpen(true);
      return;
    }

    setIsCustomYearOpen(false);
    switch (preset) {
      case '2020_now':
        onChange({ ...value, yearFrom: 2020, yearTo: undefined });
        break;
      case '2010_2019':
        onChange({ ...value, yearFrom: 2010, yearTo: 2019 });
        break;
      case '2000_2009':
        onChange({ ...value, yearFrom: 2000, yearTo: 2009 });
        break;
      case 'classic':
        onChange({ ...value, yearFrom: undefined, yearTo: 1999 });
        break;
      case 'all':
      default:
        onChange({ ...value, yearFrom: undefined, yearTo: undefined });
        break;
    }
  };

  const handleApplyCustomYear = (e: React.FormEvent) => {
    e.preventDefault();
    const parseYear = (raw: string): number | undefined => {
      const cleaned = raw.trim();
      if (!/^\d{4}$/.test(cleaned)) return undefined;
      const n = parseInt(cleaned, 10);
      return n >= 1000 && n <= 2099 ? n : undefined;
    };

    let yFrom = parseYear(customFrom);
    let yTo = parseYear(customTo);
    if (yFrom !== undefined && yTo !== undefined && yFrom > yTo) {
      [yFrom, yTo] = [yTo, yFrom];
    }

    onChange({
      ...value,
      yearFrom: yFrom,
      yearTo: yTo,
    });
  };

  const handleReset = () => {
    setIsCustomYearOpen(false);
    setCustomFrom('');
    setCustomTo('');
    onChange(DEFAULT_CATALOG_FILTER);
  };

  const controlClass =
    'min-h-[44px] w-full appearance-none rounded-xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800/90 pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 dark:text-slate-100 shadow-2xs transition hover:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Sort By */}
        <div className="relative min-w-[155px] flex-1 sm:flex-none">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <select
            value={value.sort}
            onChange={handleSortChange}
            aria-label="Urutkan daftar buku"
            className={controlClass}
          >
            <option value="relevance">Urutkan: Paling Relevan</option>
            <option value="newest">Urutkan: Tahun Terbaru</option>
            <option value="oldest">Urutkan: Tahun Terlama</option>
            {showPopularOption && <option value="popular">Urutkan: Terpopuler</option>}
            <option value="title_asc">Urutkan: Judul A - Z</option>
            <option value="title_desc">Urutkan: Judul Z - A</option>
          </select>
        </div>

        {/* Publication Year Filter */}
        <div className="relative min-w-[155px] flex-1 sm:flex-none">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <select
            value={isCustomYearOpen ? 'custom' : activePreset}
            onChange={handleYearPresetChange}
            aria-label="Filter tahun terbit"
            className={controlClass}
          >
            <option value="all">Tahun: Semua Tahun</option>
            <option value="2020_now">Tahun: 2020 - Sekarang</option>
            <option value="2010_2019">Tahun: 2010 - 2019</option>
            <option value="2000_2009">Tahun: 2000 - 2009</option>
            <option value="classic">Tahun: Klasik (&lt; 2000)</option>
            <option value="custom">Tahun: Rentang Kustom...</option>
          </select>
        </div>

        {/* Provider / Source Filter */}
        {showSourceFilter && (
          <div className="relative min-w-[155px] flex-1 sm:flex-none">
            <Database className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <select
              value={value.source}
              onChange={handleSourceChange}
              aria-label="Filter sumber katalog"
              className={controlClass}
            >
              <option value="all">Sumber: Semua Katalog</option>
              <option value="kemdikbud">Kemendikdasmen (Sekolah)</option>
              <option value="internetarchive">Internet Archive</option>
              <option value="openlibrary">Open Library</option>
              <option value="wikisource">Wikisumber</option>
              <option value="googlebooks">Google Buku</option>
            </select>
          </div>
        )}

        {/* Reset Filters */}
        {isFiltered && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset semua sortir dan filter"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Expandable Custom Year Range Row */}
      {isCustomYearOpen && (
        <form
          onSubmit={handleApplyCustomYear}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DCD8CE] dark:border-slate-700/80 bg-stone-50/80 dark:bg-slate-900/60 p-2.5"
        >
          <span className="text-xs font-semibold text-stone-600 dark:text-slate-300 px-1">
            Rentang Tahun:
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1000}
            max={2099}
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            placeholder="Dari (mis. 1990)"
            aria-label="Tahun terbit mulai"
            className="min-h-[44px] w-32 rounded-xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-xs font-bold text-stone-400">-</span>
          <input
            type="number"
            inputMode="numeric"
            min={1000}
            max={2099}
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            placeholder="Sampai (mis. 2024)"
            aria-label="Tahun terbit sampai"
            className="min-h-[44px] w-32 rounded-xl border border-[#DCD8CE] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-[#0D9488] px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
          >
            Terapkan
          </button>
        </form>
      )}
    </div>
  );
};
