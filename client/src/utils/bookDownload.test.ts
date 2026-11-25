import { describe, expect, it } from 'vitest';
import { resolveOfflineActionUrls } from './bookDownload.js';

describe('Offline reading fallback URL resolver', () => {
  it('prioritizes direct PDF URLs and falls back to Internet Archive download hub cleanly', () => {
    const directRes = resolveOfflineActionUrls(
      {
        provider: 'kemdikbud',
        providerId: '3125',
        sourceUrl: 'https://buku.kemendikdasmen.go.id/katalog/seni-budaya',
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          downloadUrl: 'https://static.buku.kemdikbud.go.id/book.pdf',
          explanation: 'OK',
          canDownload: true,
          canBookmark: true,
        },
      },
      null
    );
    expect(directRes.primaryDownloadUrl).toBe('https://static.buku.kemdikbud.go.id/book.pdf');
    expect(directRes.isDirectPdf).toBe(true);
    expect(directRes.sourceUrl).toBe('https://buku.kemendikdasmen.go.id/katalog/seni-budaya');

    const iaFallback = resolveOfflineActionUrls(
      {
        provider: 'internetarchive',
        providerId: 'novel_nusantara_1920',
        sourceUrl: 'https://archive.org/details/novel_nusantara_1920',
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          explanation: 'OK',
          canDownload: true,
          canBookmark: true,
        },
      },
      null
    );
    expect(iaFallback.primaryDownloadUrl).toBe('https://archive.org/download/novel_nusantara_1920');
    expect(iaFallback.hasDownloadCapability).toBe(true);
  });

  it('rejects unsafe javascript: or non-http download URLs', () => {
    const unsafe = resolveOfflineActionUrls(
      {
        provider: 'zenodo',
        providerId: '999',
        sourceUrl: 'javascript:alert(1)',
        access: {
          status: 'FULL_ACCESS',
          readerMode: 'PROVIDER_READER',
          matchQuality: 'EXACT',
          downloadUrl: 'javascript:evil()',
          officialItemUrl: 'data:text/html,xss',
          explanation: 'OK',
          canDownload: true,
          canBookmark: true,
        },
      },
      null
    );
    expect(unsafe.primaryDownloadUrl).toBeUndefined();
    expect(unsafe.sourceUrl).toBeUndefined();
    expect(unsafe.hasDownloadCapability).toBe(true);
  });
});
