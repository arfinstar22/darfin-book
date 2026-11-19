import React from 'react';
import { Bookmark, Trash2, BookOpen } from 'lucide-react';
import type { Book } from '../types.js';
import { BookCard } from './BookCard.js';

interface ShelfViewProps {
  savedBooks: Book[];
  onSelectBook: (book: Book) => void;
  onReadDirect: (book: Book) => void;
  onRemoveFromShelf: (book: Book) => void;
  onClearShelf: () => void;
}

export const ShelfView: React.FC<ShelfViewProps> = ({
  savedBooks,
  onSelectBook,
  onReadDirect,
  onRemoveFromShelf,
  onClearShelf,
}) => {
  if (savedBooks.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
          <Bookmark className="h-8 w-8 stroke-1" />
        </div>
        <h3 className="mt-4 text-base font-bold text-stone-800">Rak Buku Masih Kosong</h3>
        <p className="mt-1 max-w-sm text-xs text-stone-500">
          Simpan buku pelajaran atau novel favorit Anda untuk membacanya kembali kapan saja tanpa kehilangan jejak.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Rak Buku Saya</h2>
          <p className="text-xs text-stone-500">
            Tersimpan {savedBooks.length} buku di perangkat ini
          </p>
        </div>

        <button
          onClick={onClearShelf}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Kosongkan Rak</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {savedBooks.map((book) => (
          <div key={`${book.provider}-${book.providerId}`} className="relative group">
            <BookCard
              book={book}
              onSelect={onSelectBook}
              onReadDirect={onReadDirect}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromShelf(book);
              }}
              className="absolute top-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-stone-400 shadow-sm hover:text-rose-600 transition"
              title="Hapus dari Rak"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
