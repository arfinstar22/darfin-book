import { fetchWithTimeout, isSafeHttpUrl, normalizeHttpsUrl } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  BookSortOption,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface SibiApiBook {
  id?: string | number;
  title?: string;
  slug?: string;
  image?: string | null;
  attachment?: string | null;
  description?: string | null;
  published_year?: string | number | null;
  class?: string | null;
  level?: string | null;
  writer?: string | null;
  publisher?: string | null;
  subject?: string | null;
  isbn?: string | null;
  category?: string | null;
  created_at?: string | null;
}

const SIBI_CATALOG_URL = 'https://api.buku.kemendikdasmen.go.id/api/catalogue/getBooks?limit=500';
const SIBI_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const CURATED_MERDEKA_ITEMS: Array<{
  id: string;
  title: string;
  grade: string;
  subject: string;
  level: string;
  publisher: string;
  pdfUrl: string;
  year: number;
}> = [
  { id: 'bse-mat-sd-1', title: 'Matematika untuk SD/MI Kelas I (Kurikulum Merdeka)', grade: 'Kelas 1', subject: 'Matematika', level: 'SD', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/buku-siswa-matematika-kelas-1', year: 2022 },
  { id: 'bse-bindo-sd-1', title: 'Bahasa Indonesia: Aku Bisa! untuk SD Kelas I', grade: 'Kelas 1', subject: 'Bahasa Indonesia', level: 'SD', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/bahasa-indonesia-sd-kelas-1', year: 2021 },
  { id: 'bse-ipas-sd-4', title: 'Ilmu Pengetahuan Alam dan Sosial (IPAS) untuk SD Kelas IV', grade: 'Kelas 4', subject: 'IPAS', level: 'SD', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/ipas-sd-kelas-4', year: 2021 },
  { id: 'bse-mat-sd-5', title: 'Matematika untuk SD/MI Kelas V', grade: 'Kelas 5', subject: 'Matematika', level: 'SD', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/buku-siswa-matematika-kelas-5', year: 2022 },
  { id: 'bse-bindo-sd-5', title: 'Bahasa Indonesia: Bergerak Bersama untuk SD Kelas V', grade: 'Kelas 5', subject: 'Bahasa Indonesia', level: 'SD', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/bahasa-indonesia-sd-kelas-5', year: 2021 },
  { id: 'bse-mat-smp-7', title: 'Matematika untuk SMP/MTs Kelas VII', grade: 'Kelas 7', subject: 'Matematika', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/matematika-smp-kelas-7', year: 2022 },
  { id: 'bse-ipa-smp-7', title: 'Ilmu Pengetahuan Alam (IPA) untuk SMP Kelas VII', grade: 'Kelas 7', subject: 'IPA', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/ipa-smp-kelas-7', year: 2021 },
  { id: 'bse-bindo-smp-7', title: 'Bahasa Indonesia untuk SMP Kelas VII', grade: 'Kelas 7', subject: 'Bahasa Indonesia', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/bahasa-indonesia-smp-kelas-7', year: 2021 },
  { id: 'bse-ips-smp-7', title: 'Ilmu Pengetahuan Sosial (IPS) untuk SMP Kelas VII', grade: 'Kelas 7', subject: 'IPS', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/ilmu-pengetahuan-sosial-smp-kelas-7', year: 2021 },
  { id: 'bse-infor-smp-7', title: 'Informatika untuk SMP Kelas VII', grade: 'Kelas 7', subject: 'Informatika', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/informatika-smp-kelas-7', year: 2021 },
  { id: 'bse-pancasila-smp-8', title: 'Pendidikan Pancasila untuk SMP/MTs Kelas VIII', grade: 'Kelas 8', subject: 'Pendidikan Pancasila', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/pendidikan-pancasila-smp-kelas-8', year: 2023 },
  { id: 'bse-mat-smp-8', title: 'Matematika untuk SMP/MTs Kelas VIII', grade: 'Kelas 8', subject: 'Matematika', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/matematika-smp-kelas-8', year: 2022 },
  { id: 'bse-ipa-smp-8', title: 'Ilmu Pengetahuan Alam (IPA) untuk SMP Kelas VIII', grade: 'Kelas 8', subject: 'IPA', level: 'SMP', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/ilmu-pengetahuan-alam-smp-kelas-8', year: 2021 },
  { id: 'bse-mat-sma-10', title: 'Matematika untuk SMA/SMK Kelas X', grade: 'Kelas 10', subject: 'Matematika', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/matematika-sma-kelas-10', year: 2021 },
  { id: 'bse-bindo-sma-10', title: 'Bahasa Indonesia: Cerdas Cergas Berbahasa dan Bersastra untuk SMA Kelas X', grade: 'Kelas 10', subject: 'Bahasa Indonesia', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/bahasa-indonesia-sma-kelas-10', year: 2021 },
  { id: 'bse-sej-sma-10', title: 'Sejarah untuk SMA/SMK Kelas X', grade: 'Kelas 10', subject: 'Sejarah', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/sejarah-sma-kelas-10', year: 2021 },
  { id: 'bse-infor-sma-10', title: 'Informatika untuk SMA Kelas X', grade: 'Kelas 10', subject: 'Informatika', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/informatika-sma-kelas-10', year: 2021 },
  { id: 'bse-bio-sma-11', title: 'Biologi untuk SMA Kelas XI (Kurikulum Merdeka)', grade: 'Kelas 11', subject: 'Biologi', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/biologi-sma-kelas-11', year: 2022 },
  { id: 'bse-fis-sma-11', title: 'Fisika untuk SMA Kelas XI', grade: 'Kelas 11', subject: 'Fisika', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/fisika-sma-kelas-11', year: 2022 },
  { id: 'bse-kim-sma-11', title: 'Kimia untuk SMA Kelas XI', grade: 'Kelas 11', subject: 'Kimia', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/kimia-sma-kelas-11', year: 2022 },
  { id: 'bse-sosiologi-sma-11', title: 'Sosiologi untuk SMA Kelas XI', grade: 'Kelas 11', subject: 'Sosiologi', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/sosiologi-sma-kelas-11', year: 2021 },
  { id: 'bse-ekonomi-sma-11', title: 'Ekonomi untuk SMA Kelas XI', grade: 'Kelas 11', subject: 'Ekonomi', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/ekonomi-sma-kelas-11', year: 2021 },
  { id: 'bse-geografi-sma-11', title: 'Geografi untuk SMA Kelas XI', grade: 'Kelas 11', subject: 'Geografi', level: 'SMA', publisher: 'Kementerian Pendidikan Dasar dan Menengah', pdfUrl: 'https://buku.kemendikdasmen.go.id/katalog/geografi-sma-kelas-11', year: 2021 },
];

const CURATED_BOOKS: ProviderBook[] = CURATED_MERDEKA_ITEMS.map((item) => ({
  provider: 'kemdikbud',
  providerId: item.id,
  title: item.title,
  authors: ['Kementerian Pendidikan Dasar dan Menengah RI'],
  publisher: item.publisher,
  publishedYear: item.year,
  language: 'id',
  languageCode: 'id',
  isIndonesianVerified: true,
  subjects: ['Buku Pelajaran', item.subject, item.level, item.grade],
  sourceUrl: item.pdfUrl,
  access: {
    status: 'FULL_ACCESS',
    readerMode: 'PROVIDER_READER',
    matchQuality: 'EXACT',
    officialItemUrl: item.pdfUrl,
    explanation: 'Buku Teks Pelajaran Resmi Kemendikdasmen (Akses Terbuka Pendidikan). Gratis untuk siswa & guru.',
    canDownload: true,
    canBookmark: true,
  },
  rawMetadata: { downloads: 1200 },
}));

export class KemdikbudProvider implements BookProvider {
  name = 'kemdikbud';
  lastTotalFound = 383 + CURATED_BOOKS.length;

  // ponytail: 6h in-memory cache combines 2021-2023 Kurikulum Merdeka books with ~383 live SIBI API books (<1ms search)
  private cache: { books: ProviderBook[]; expiresAt: number } | null = null;
  private inflight: Promise<ProviderBook[]> | null = null;

  private mapApiBook(item: SibiApiBook): ProviderBook | null {
    if (!item.id || !item.title) return null;

    const cleanIsbn = item.isbn ? item.isbn.replace(/[^0-9Xx]/g, '') : '';
    const rawYear = item.published_year || item.created_at;
    const yearMatch = rawYear ? String(rawYear).match(/\b(1[0-9]{3}|20[0-9]{2})\b/) : null;
    const publishedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    const coverUrl = normalizeHttpsUrl(item.image);
    const attachmentUrl = normalizeHttpsUrl(item.attachment);
    const catalogUrl = item.slug
      ? `https://buku.kemendikdasmen.go.id/katalog/${encodeURIComponent(item.slug)}`
      : 'https://buku.kemendikdasmen.go.id';

    const officialUrl = attachmentUrl || catalogUrl;
    const isPdf = Boolean(attachmentUrl && attachmentUrl.toLowerCase().endsWith('.pdf'));

    const writers = item.writer
      ? item.writer.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const subjects = [item.category === 'buku_nonteks' ? 'Buku Bacaan' : 'Buku Pelajaran', item.subject, item.level, item.class]
      .filter((v): v is string => Boolean(v && v.trim()))
      .map((s) => s.replace(/_/g, ' '));

    const access: ProviderAccess = {
      status: 'FULL_ACCESS',
      readerMode: 'PROVIDER_READER',
      matchQuality: 'EXACT',
      officialItemUrl: officialUrl,
      downloadUrl: isPdf ? attachmentUrl : undefined,
      explanation:
        'Buku Resmi Sistem Informasi Perbukuan Indonesia (SIBI) Kemendikdasmen RI. Gratis dan legal.',
      canDownload: true,
      canBookmark: true,
    };

    return {
      provider: 'kemdikbud',
      providerId: String(item.id),
      title: item.title.trim(),
      authors: writers.length > 0 ? writers : ['Kementerian Pendidikan Dasar dan Menengah RI'],
      description: item.description?.trim() || undefined,
      publisher: item.publisher?.trim() || 'Pusat Perbukuan Kemendikdasmen RI',
      publishedYear,
      language: 'id',
      languageCode: 'id',
      isIndonesianVerified: true,
      coverUrl,
      isbn10: cleanIsbn.length === 10 ? cleanIsbn : undefined,
      isbn13: cleanIsbn.length === 13 ? cleanIsbn : undefined,
      subjects,
      sourceUrl: catalogUrl,
      access,
      rawMetadata: { downloads: 1000 },
    };
  }

  private async getCatalogBooks(): Promise<ProviderBook[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.books;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const res = await fetchWithTimeout(
          SIBI_CATALOG_URL,
          { headers: { Accept: 'application/json', 'User-Agent': 'DarfinBook/1.0' } },
          3000
        );
        if (!res.ok) return this.cache?.books || CURATED_BOOKS;

        const data = (await res.json()) as { status?: string; results?: SibiApiBook[] };
        const liveBooks = (data.results || [])
          .map((item) => this.mapApiBook(item))
          .filter((b): b is ProviderBook => b !== null && isSafeHttpUrl(b.access.officialItemUrl));

        if (liveBooks.length > 0) {
          const seenTitles = new Set(CURATED_BOOKS.map((b) => b.title.toLowerCase()));
          const merged = [
            ...CURATED_BOOKS,
            ...liveBooks.filter((b) => !seenTitles.has(b.title.toLowerCase())),
          ];
          this.lastTotalFound = merged.length;
          this.cache = { books: merged, expiresAt: Date.now() + SIBI_CACHE_TTL_MS };
          return merged;
        }
      } catch {
        // Fallback cleanly to curated Merdeka textbooks
      } finally {
        this.inflight = null;
      }
      return this.cache?.books || CURATED_BOOKS;
    })();

    return this.inflight;
  }

  private sortLocal(books: ProviderBook[], sort?: BookSortOption): ProviderBook[] {
    const copy = [...books];
    if (sort === 'newest') {
      copy.sort((a, b) => (b.publishedYear ?? 0) - (a.publishedYear ?? 0));
    } else if (sort === 'oldest') {
      copy.sort((a, b) => (a.publishedYear ?? 9999) - (b.publishedYear ?? 9999));
    } else if (sort === 'title_asc') {
      copy.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    } else if (sort === 'title_desc') {
      copy.sort((a, b) => b.title.localeCompare(a.title, 'id'));
    }
    return copy;
  }

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const catalog = await this.getCatalogBooks();
    const q = query.query.toLowerCase().trim();
    const isBroad =
      !q ||
      q === '*' ||
      q === 'all' ||
      q === 'semua' ||
      q.includes('pelajaran') ||
      q.includes('sekolah') ||
      q.includes('kemdikbud') ||
      q.includes('kemendikdasmen') ||
      q.includes('bse') ||
      q.includes('kurikulum') ||
      q.includes('indonesia');

    let matched = isBroad
      ? catalog
      : catalog.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.authors.some((a) => a.toLowerCase().includes(q)) ||
            b.subjects?.some((s) => s.toLowerCase().includes(q)) ||
            b.description?.toLowerCase().includes(q)
        );

    if (query.yearFrom !== undefined) {
      matched = matched.filter((b) => b.publishedYear !== undefined && b.publishedYear >= query.yearFrom!);
    }
    if (query.yearTo !== undefined) {
      matched = matched.filter((b) => b.publishedYear !== undefined && b.publishedYear <= query.yearTo!);
    }

    const sorted = this.sortLocal(matched, query.sort);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 30;
    return sorted.slice(offset, offset + limit);
  }

  async getByIsbn(isbn: string): Promise<ProviderBook | null> {
    const cleaned = isbn.replace(/[^0-9Xx]/g, '');
    const catalog = this.cache?.books || CURATED_BOOKS;
    if (!this.cache) {
      void this.getCatalogBooks();
    }
    return catalog.find((b) => b.isbn13 === cleaned || b.isbn10 === cleaned) || null;
  }

  async getById(providerId: string): Promise<ProviderBook | null> {
    const catalog = await this.getCatalogBooks();
    return catalog.find((b) => b.providerId === providerId) || null;
  }
}
