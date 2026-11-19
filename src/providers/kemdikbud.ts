import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

interface EducationalBookItem {
  id: string;
  title: string;
  grade: string;
  subject: string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  publisher: string;
  pdfUrl: string;
  coverUrl?: string;
  year: number;
}

// Curated official open curriculum textbooks (SIBI Kemendikbudristek / Kurikulum Merdeka)
const KEMDIKBUD_TEXTBOOKS: EducationalBookItem[] = [
  {
    id: 'bse-mat-sd-1',
    title: 'Matematika untuk SD/MI Kelas I (Kurikulum Merdeka)',
    grade: 'Kelas 1',
    subject: 'Matematika',
    level: 'SD',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/buku-siswa-matematika-kelas-1',
    year: 2022,
  },
  {
    id: 'bse-bindo-sd-1',
    title: 'Bahasa Indonesia: Aku Bisa! untuk SD Kelas I',
    grade: 'Kelas 1',
    subject: 'Bahasa Indonesia',
    level: 'SD',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/bahasa-indonesia-sd-kelas-1',
    year: 2021,
  },
  {
    id: 'bse-ipas-sd-4',
    title: 'Ilmu Pengetahuan Alam dan Sosial (IPAS) untuk SD Kelas IV',
    grade: 'Kelas 4',
    subject: 'IPAS',
    level: 'SD',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/ipas-sd-kelas-4',
    year: 2021,
  },
  {
    id: 'bse-mat-smp-7',
    title: 'Matematika untuk SMP/MTs Kelas VII',
    grade: 'Kelas 7',
    subject: 'Matematika',
    level: 'SMP',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/matematika-smp-kelas-7',
    year: 2022,
  },
  {
    id: 'bse-ipa-smp-7',
    title: 'Ilmu Pengetahuan Alam (IPA) untuk SMP Kelas VII',
    grade: 'Kelas 7',
    subject: 'IPA',
    level: 'SMP',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/ipa-smp-kelas-7',
    year: 2021,
  },
  {
    id: 'bse-bindo-smp-7',
    title: 'Bahasa Indonesia untuk SMP Kelas VII',
    grade: 'Kelas 7',
    subject: 'Bahasa Indonesia',
    level: 'SMP',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/bahasa-indonesia-smp-kelas-7',
    year: 2021,
  },
  {
    id: 'bse-mat-sma-10',
    title: 'Matematika untuk SMA/SMK Kelas X',
    grade: 'Kelas 10',
    subject: 'Matematika',
    level: 'SMA',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/matematika-sma-kelas-10',
    year: 2021,
  },
  {
    id: 'bse-bio-sma-11',
    title: 'Biologi untuk SMA Kelas XI (Kurikulum Merdeka)',
    grade: 'Kelas 11',
    subject: 'Biologi',
    level: 'SMA',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/biologi-sma-kelas-11',
    year: 2022,
  },
  {
    id: 'bse-fis-sma-11',
    title: 'Fisika untuk SMA Kelas XI',
    grade: 'Kelas 11',
    subject: 'Fisika',
    level: 'SMA',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/fisika-sma-kelas-11',
    year: 2022,
  },
  {
    id: 'bse-kim-sma-11',
    title: 'Kimia untuk SMA Kelas XI',
    grade: 'Kelas 11',
    subject: 'Kimia',
    level: 'SMA',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/kimia-sma-kelas-11',
    year: 2022,
  },
  {
    id: 'bse-sej-sma-10',
    title: 'Sejarah untuk SMA/SMK Kelas X',
    grade: 'Kelas 10',
    subject: 'Sejarah',
    level: 'SMA',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/sejarah-sma-kelas-10',
    year: 2021,
  },
  {
    id: 'bse-pancasila-smp-8',
    title: 'Pendidikan Pancasila untuk SMP/MTs Kelas VIII',
    grade: 'Kelas 8',
    subject: 'Pendidikan Pancasila',
    level: 'SMP',
    publisher: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    pdfUrl: 'https://buku.kemdikbud.go.id/katalog/pendidikan-pancasila-smp-kelas-8',
    year: 2023,
  },
];

export class KemdikbudProvider implements BookProvider {
  name = 'kemdikbud';

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const q = query.query.toLowerCase().trim();
    const matched = KEMDIKBUD_TEXTBOOKS.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        b.grade.toLowerCase().includes(q) ||
        b.level.toLowerCase().includes(q) ||
        q.includes('pelajaran') ||
        q.includes('sekolah') ||
        q.includes('kemdikbud') ||
        q.includes('bse') ||
        q.includes('kurikulum')
    );

    return matched.map((item) => {
      const access: ProviderAccess = {
        status: 'FULL_ACCESS',
        readerMode: 'PROVIDER_READER',
        matchQuality: 'EXACT',
        officialItemUrl: item.pdfUrl,
        explanation:
          'Buku Teks Pelajaran Resmi Kemendikbudristek (Akses Terbuka Pendidikan). Gratis untuk siswa & guru.',
        canDownload: true,
        canBookmark: true,
      };

      return {
        provider: 'kemdikbud',
        providerId: item.id,
        title: item.title,
        authors: ['Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI'],
        publisher: item.publisher,
        publishedYear: item.year,
        language: 'id',
        languageCode: 'id',
        isIndonesianVerified: true,
        coverUrl: item.coverUrl,
        subjects: ['Buku Pelajaran', item.subject, item.level, item.grade],
        sourceUrl: item.pdfUrl,
        access,
      };
    });
  }

  async getByIsbn(_isbn: string): Promise<ProviderBook | null> {
    return null;
  }

  async getById(providerId: string): Promise<ProviderBook | null> {
    const item = KEMDIKBUD_TEXTBOOKS.find((b) => b.id === providerId);
    if (!item) return null;

    return {
      provider: 'kemdikbud',
      providerId: item.id,
      title: item.title,
      authors: ['Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI'],
      publisher: item.publisher,
      publishedYear: item.year,
      language: 'id',
      languageCode: 'id',
      isIndonesianVerified: true,
      coverUrl: item.coverUrl,
      subjects: ['Buku Pelajaran', item.subject, item.level, item.grade],
      sourceUrl: item.pdfUrl,
      access: {
        status: 'FULL_ACCESS',
        readerMode: 'PROVIDER_READER',
        matchQuality: 'EXACT',
        officialItemUrl: item.pdfUrl,
        explanation: 'Buku Pelajaran Resmi Kurikulum Merdeka Kemdikbud RI.',
        canDownload: true,
        canBookmark: true,
      },
    };
  }
}
