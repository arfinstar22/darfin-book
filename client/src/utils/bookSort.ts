import type { Book, CatalogFilterState } from '../types.js';

export const DEFAULT_CATALOG_FILTER: CatalogFilterState = {
  sort: 'relevance',
  source: 'all',
};

/**
 * Extracts normalized 4-digit publication year from Book metadata.
 */
export function getBookYear(book: Book): number | undefined {
  if (typeof book.publishedYear === 'number' && Number.isFinite(book.publishedYear)) {
    return book.publishedYear;
  }
  if (book.publishedDate) {
    const match = book.publishedDate.match(/^(\d{4})/);
    if (match) {
      const y = parseInt(match[1], 10);
      if (y >= 1000 && y <= 2099) return y;
    }
  }
  return undefined;
}

/**
 * Applies source filtering, year bounds, and deterministic sorting on client-side book lists.
 */
export function sortAndFilterBooksLocal(
  books: Book[],
  filter: CatalogFilterState
): Book[] {
  let result = [...books];

  if (filter.source && filter.source !== 'all') {
    result = result.filter((b) => b.provider === filter.source);
  }

  if (filter.yearFrom !== undefined || filter.yearTo !== undefined) {
    result = result.filter((b) => {
      const y = getBookYear(b);
      if (y === undefined) return false;
      if (filter.yearFrom !== undefined && y < filter.yearFrom) return false;
      if (filter.yearTo !== undefined && y > filter.yearTo) return false;
      return true;
    });
  }

  const qualityScore = (book: Book) => {
    let pts = 0;
    if (book.coverUrl) pts += 10;
    if (book.access.status === 'FULL_ACCESS') pts += 5;
    if (book.access.status === 'BORROW_AVAILABLE') pts += 3;
    return pts;
  };

  switch (filter.sort) {
    case 'newest':
      result.sort((a, b) => {
        const ya = getBookYear(a) ?? -1;
        const yb = getBookYear(b) ?? -1;
        if (yb !== ya) return yb - ya;
        return qualityScore(b) - qualityScore(a);
      });
      break;
    case 'oldest':
      result.sort((a, b) => {
        const ya = getBookYear(a) ?? Number.MAX_SAFE_INTEGER;
        const yb = getBookYear(b) ?? Number.MAX_SAFE_INTEGER;
        if (ya !== yb) return ya - yb;
        return qualityScore(b) - qualityScore(a);
      });
      break;
    case 'popular':
      result.sort((a, b) => qualityScore(b) - qualityScore(a));
      break;
    case 'title_asc':
      result.sort((a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' }));
      break;
    case 'title_desc':
      result.sort((a, b) => b.title.localeCompare(a.title, 'id', { sensitivity: 'base' }));
      break;
    case 'relevance':
    default:
      break;
  }

  return result;
}
