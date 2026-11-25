import type { Book, ReaderResolution } from '../types.js';

export const isSafeHttpUrl = (url?: string | null): url is string =>
  Boolean(url && /^(https?:\/\/)/i.test(url.trim()));

export interface OfflineActionUrls {
  primaryDownloadUrl?: string;
  isDirectPdf: boolean;
  sourceUrl?: string;
  hasDownloadCapability: boolean;
}

/**
 * Resolves safe legal download and official source URLs for offline reading fallback.
 */
export function resolveOfflineActionUrls(
  book: Pick<Book, 'provider' | 'providerId' | 'sourceUrl' | 'access'>,
  resolution?: Pick<ReaderResolution, 'pdfUrl' | 'iaIdentifier' | 'launchUrl'> | null
): OfflineActionUrls {
  const directPdf = isSafeHttpUrl(resolution?.pdfUrl)
    ? resolution!.pdfUrl
    : isSafeHttpUrl(book.access.downloadUrl)
      ? book.access.downloadUrl
      : undefined;

  const iaId =
    resolution?.iaIdentifier ||
    (book.provider === 'internetarchive' && /^[a-zA-Z0-9_.-]+$/.test(book.providerId)
      ? book.providerId
      : undefined);

  const archiveDownloadHub = iaId
    ? `https://archive.org/download/${encodeURIComponent(iaId)}`
    : undefined;

  const launchCandidate = isSafeHttpUrl(resolution?.launchUrl)
    ? resolution!.launchUrl
    : isSafeHttpUrl(book.access.officialItemUrl)
      ? book.access.officialItemUrl
      : undefined;

  const sourceUrl = isSafeHttpUrl(book.sourceUrl)
    ? book.sourceUrl
    : launchCandidate;

  const primaryDownloadUrl =
    directPdf ||
    archiveDownloadHub ||
    (book.access.canDownload ? launchCandidate : undefined) ||
    sourceUrl;

  const isDirectPdf = Boolean(
    primaryDownloadUrl && /\.pdf(\?|#|$)/i.test(primaryDownloadUrl)
  );

  return {
    primaryDownloadUrl,
    isDirectPdf,
    sourceUrl: sourceUrl && sourceUrl !== primaryDownloadUrl ? sourceUrl : undefined,
    hasDownloadCapability: Boolean(directPdf || archiveDownloadHub || book.access.canDownload),
  };
}
