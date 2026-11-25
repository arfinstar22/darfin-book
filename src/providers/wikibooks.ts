import { MediaWikiBookProvider } from './mediawiki.js';

export class WikibooksProvider extends MediaWikiBookProvider {
  constructor() {
    super({
      providerKey: 'wikibooks',
      apiBaseUrl: 'https://id.wikibooks.org/w/api.php',
      wikiPageBaseUrl: 'https://id.wikibooks.org/wiki/',
      srnamespace: '0',
      defaultAuthor: 'Kontributor Wikibuku Indonesia',
      accessExplanation:
        'Buku teks dan modul pembelajaran terbuka dari Wikibuku Bahasa Indonesia (CC BY-SA). Dapat dibaca langsung lengkap.',
      idDescriptionFallback: 'Buku pembelajaran lengkap dari Wikibuku Bahasa Indonesia.',
      licenseNotice:
        'Teks tersedia di bawah Lisensi Creative Commons Atribusi-BerbagiSerupa. Sumber resmi: Wikibuku Bahasa Indonesia.',
      excludeTitlePrefixes: ['Subjek:', 'Kategori:', 'Wikibuku:'],
    });
  }
}
