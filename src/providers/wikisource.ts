import { env } from '../config/env.js';
import { MediaWikiBookProvider } from './mediawiki.js';

export class WikisourceProvider extends MediaWikiBookProvider {
  constructor() {
    super({
      providerKey: 'wikisource',
      apiBaseUrl: env.WIKISOURCE_API_BASE_URL,
      wikiPageBaseUrl: 'https://id.wikisource.org/wiki/',
      srnamespace: '0|102',
      defaultAuthor: 'Domain Publik / Karya Nusantara',
      accessExplanation:
        'Teks domain publik / berlisensi bebas dari Wikisumber Bahasa Indonesia. Bebas dibaca langsung secara lengkap.',
      idDescriptionFallback: 'Naskah teks lengkap dari Wikisumber Bahasa Indonesia.',
      licenseNotice:
        'Teks lengkap naskah tersedia di bawah Lisensi Creative Commons Pengakuan-BerbagiSerupa atau Domain Publik. Sumber resmi: Wikisumber Bahasa Indonesia.',
    });
  }
}
