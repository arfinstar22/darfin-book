import { env } from '../config/env.js';
import { verifyIndonesianContent } from '../utils/language.js';
import { fetchWithTimeout, normalizeHttpsUrl, parseYearStrict } from '../utils/safeFetch.js';
import type {
  BookProvider,
  BookSearchQuery,
  ProviderAccess,
  ProviderBook,
} from './types.js';

function getTextField(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return getTextField(val[0]);
  if (typeof val === 'object' && '$' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).$);
  }
  return undefined;
}

function getTextList(val: unknown): string[] {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map((v) => getTextField(v)).filter((s): s is string => Boolean(s));
}

export class OpenAireProvider implements BookProvider {
  name = 'openaire';

  private headers = {
    'User-Agent': env.OPEN_LIBRARY_USER_AGENT,
    Accept: 'application/json',
  };

  async search(query: BookSearchQuery): Promise<ProviderBook[]> {
    const cleanQ = query.query.trim();
    // Skip slow wildcard pings so homepage remains responsive
    if (!cleanQ || cleanQ === '*' || cleanQ.toLowerCase() === 'all' || cleanQ.toLowerCase() === 'semua') {
      return [];
    }

    const limit = Math.min(query.limit ?? 12, 20);
    const offset = query.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const url = new URL('https://api.openaire.eu/search/publications');
    url.searchParams.set('keywords', `${cleanQ} indonesia`);
    url.searchParams.set('OA', 'true');
    url.searchParams.set('instancetype', 'Book');
    url.searchParams.set('size', limit.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('format', 'json');

    try {
      const response = await fetchWithTimeout(url.toString(), { headers: this.headers }, 3500);
      if (!response.ok) return [];

      const json = (await response.json()) as any;
      const rawResults = json?.response?.results?.result;
      const items = Array.isArray(rawResults) ? rawResults : rawResults ? [rawResults] : [];

      const results: ProviderBook[] = [];

      for (const item of items) {
        const res = item?.metadata?.['oaf:entity']?.['oaf:result'];
        const title = getTextField(res?.title);
        if (!title) continue;

        const description = getTextField(res?.description);
        const rawLang =
          res?.language?.['@classname'] || res?.language?.['@classid'] || getTextField(res?.language);
        const langCheck = verifyIndonesianContent({
          rawLanguage: rawLang,
          title,
          description,
          provider: 'openaire',
        });
        if (!langCheck.isEligibleForDefaultCatalog) continue;

        const dateStr = getTextField(res?.dateofacceptance);
        const publishedYear = parseYearStrict(dateStr);
        if (query.yearFrom !== undefined && (!publishedYear || publishedYear < query.yearFrom)) continue;
        if (query.yearTo !== undefined && (!publishedYear || publishedYear > query.yearTo)) continue;

        const instances = Array.isArray(res?.children?.instance)
          ? res.children.instance
          : res?.children?.instance
            ? [res.children.instance]
            : [];
        let officialUrl: string | undefined;
        for (const inst of instances) {
          const webUrl = getTextField(inst?.webresource?.url) || getTextField(inst?.url);
          const safe = normalizeHttpsUrl(webUrl);
          if (safe) {
            officialUrl = safe;
            break;
          }
        }
        if (!officialUrl) continue;

        const objId =
          getTextField(item?.header?.['dri:objIdentifier'])?.replace(/[^A-Za-z0-9_.-]/g, '') ||
          title.slice(0, 24);
        const authors = getTextList(res?.creator);

        const access: ProviderAccess = {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          officialItemUrl: officialUrl,
          explanation:
            'Buku Open Access terindeks OpenAIRE & DOAB/OAPEN. Gratis diakses penuh secara legal.',
          canDownload: true,
          canBookmark: true,
        };

        results.push({
          provider: 'openaire',
          providerId: objId,
          title,
          authors: authors.length > 0 ? authors : ['OpenAIRE / DOAB'],
          description: description?.slice(0, 350),
          publisher: getTextField(res?.publisher) || 'OpenAIRE / DOAB',
          publishedYear,
          publishedDate: dateStr,
          language: langCheck.providerLanguageCode || 'id',
          languageCode: 'id',
          isIndonesianVerified: true,
          subjects: ['Open Access', 'DOAB / OpenAIRE'],
          sourceUrl: officialUrl,
          access,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  async getByIsbn(_isbn: string): Promise<ProviderBook | null> {
    return null;
  }

  async getById(_providerId: string): Promise<ProviderBook | null> {
    return null;
  }
}
