import { describe, expect, it } from 'vitest';
import { verifyIndonesianContent } from '../utils/language.js';
import { extractXmlTags, normalizeHttpsUrl, parseYearStrict } from '../utils/safeFetch.js';
import { buildServer } from '../server.js';

describe('New providers helpers and endpoints', () => {
  it('verifies Indonesian content accurately even when institutional repos mis-tag language as eng', () => {
    const misTaggedId = verifyIndonesianContent({
      rawLanguage: 'eng',
      title: 'Diversifikasi Pangan Lokal untuk Ketahanan Pangan di Indonesia',
      description: 'Kajian pangan yang berbasis pada masyarakat dan teknologi pangan.',
    });
    expect(misTaggedId.isEligibleForDefaultCatalog).toBe(true);
    expect(misTaggedId.languageCode).toBe('id');

    const pureEnglish = verifyIndonesianContent({
      rawLanguage: 'eng',
      title: 'The Fragmentation and Solidity of Islamic Parties in Indonesia',
      description: 'A study of political parties and electoral reform in the post-authoritarian era.',
    });
    expect(pureEnglish.isEligibleForDefaultCatalog).toBe(false);
  });

  it('parses XML tags, years, and upgrades unsafe http URLs safely', () => {
    const xml = `<dc:title xml:lang="en">Panduan Riset &amp; Teknologi</dc:title><dc:date>2025-04-12</dc:date>`;
    expect(extractXmlTags(xml, 'dc:title')).toEqual(['Panduan Riset & Teknologi']);
    expect(parseYearStrict('2025-04-12')).toBe(2025);
    expect(parseYearStrict('invalid')).toBeUndefined();
    expect(normalizeHttpsUrl('http://repositori.kemendikdasmen.go.id/123.pdf')).toBe(
      'https://repositori.kemendikdasmen.go.id/123.pdf'
    );
    expect(normalizeHttpsUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('serves live multi-provider search across new sources via /api/v1/search', async () => {
    const server = await buildServer();

    // StoryWeaver Indonesian query
    const swRes = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=kancil&source=storyweaver&limit=3',
    });
    expect(swRes.statusCode).toBe(200);
    const swBody = swRes.json();
    expect(Array.isArray(swBody.books)).toBe(true);
    expect(swBody.books.length).toBeGreaterThan(0);
    expect(swBody.books[0].provider).toBe('storyweaver');

    // Bloom Library Indonesian query
    const blRes = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=*&source=bloom&limit=3',
    });
    expect(blRes.statusCode).toBe(200);
    const blBody = blRes.json();
    expect(blBody.books.length).toBeGreaterThan(0);
    expect(blBody.books[0].provider).toBe('bloom');

    // Wikibooks Indonesian query
    const wbRes = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=matematika&source=wikibooks&limit=3',
    });
    expect(wbRes.statusCode).toBe(200);
    const wbBody = wbRes.json();
    expect(wbBody.books.length).toBeGreaterThan(0);
    expect(wbBody.books[0].provider).toBe('wikibooks');

    // Penerbit BRIN OAI-PMH cached search
    const brinRes = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=indonesia&source=brin&limit=3',
    });
    expect(brinRes.statusCode).toBe(200);
    const brinBody = brinRes.json();
    expect(brinBody.books.length).toBeGreaterThan(0);
    expect(brinBody.books[0].provider).toBe('brin');
  }, 30000);
});
