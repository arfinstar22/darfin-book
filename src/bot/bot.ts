import { Bot, InlineKeyboard } from 'grammy';
import { env } from '../config/env.js';
import type { ProviderBook } from '../providers/types.js';
import { SearchService } from '../services/search.js';
import { validateIsbn } from '../utils/isbn.js';

export function createTelegramBot() {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }

  const bot = new Bot(token);
  const searchService = new SearchService();
  const miniAppUrl = env.TELEGRAM_MINI_APP_URL || 'https://darfin-book.onrender.com';

  // Helper: Access badge text
  const formatAccessBadge = (book: ProviderBook) => {
    switch (book.access.status) {
      case 'FULL_ACCESS':
        return '🟢 Akses Penuh (Gratis Dibaca)';
      case 'BORROW_AVAILABLE':
        return '🔵 Bisa Dipinjam Resmi';
      case 'PREVIEW':
        return '🟡 Pratinjau Terbatas';
      default:
        return '⚪ Info Katalog';
    }
  };

  // /start command
  bot.command('start', async (ctx) => {
    const firstName = ctx.from?.first_name || 'Pembaca';
    const message =
      `Halo *${firstName}*! Selamat datang di *DARFIN BOOK* 📚\n\n` +
      `Perpustakaan digital terbuka untuk semua, menyajikan buku berbahasa Indonesia resmi—mulai dari buku pelajaran Kurikulum Merdeka Kemdikbud hingga sastra nusantara dan arsip sejarah.\n\n` +
      `*Cara Menggunakan:*\n` +
      `• Ketik judul buku atau penulis (contoh: \`Matematika\`, \`Cerita Rakyat\`)\n` +
      `• Ketik nomor ISBN untuk cek ketersediaan\n` +
      `• Atau buka aplikasi lengkap melalui tombol di bawah:`;

    const keyboard = new InlineKeyboard()
      .webApp('🌐 Buka DARFIN BOOK (Mini App)', miniAppUrl)
      .row()
      .text('📚 Buku Pelajaran', 'cat_pelajaran')
      .text('📖 Sastra Nusantara', 'cat_sastra')
      .row()
      .text('❔ Bantuan & Sumber Legal', 'help_info');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // /help command
  bot.command('help', async (ctx) => {
    const helpText =
      `*PANDUAN DARFIN BOOK* 📚\n\n` +
      `*Perintah:*\n` +
      `• \`/start\` - Membuka menu utama\n` +
      `• \`/baca <kata kunci>\` - Mencari buku berbahasa Indonesia\n` +
      `• \`/pelajaran\` - Rekomendasi buku sekolah resmi Kemdikbud\n` +
      `• \`/sastra\` - Rekomendasi karya sastra & budaya nusantara\n\n` +
      `*Integritas Hak Cipta & Sumber Legal:*\n` +
      `DARFIN BOOK hanya menyajikan naskah dari sumber terverifikasi resmi: Wikisumber Indonesia (Domain Publik), SIBI Kemdikbudristek (Kurikulum Merdeka), dan Open Library.\n\n` +
      `Semua buku yang berlabel *Akses Penuh* dapat Anda baca langsung tanpa biaya.`;

    const keyboard = new InlineKeyboard().webApp(
      '🌐 Buka DARFIN BOOK',
      miniAppUrl
    );

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // Category Callbacks
  bot.callbackQuery('cat_pelajaran', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Memuat buku pelajaran...' });
    await handleBookSearch(ctx, 'pelajaran');
  });

  bot.callbackQuery('cat_sastra', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Memuat sastra nusantara...' });
    await handleBookSearch(ctx, 'cerita');
  });

  bot.callbackQuery('help_info', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `*Tentang DARFIN BOOK*\n\n` +
      `Platform ini dirancang untuk memudahkan seluruh masyarakat Indonesia dalam mengakses buku berkualitas secara legal dan gratis.\n\n` +
      `Kunjungi website resmi kami di: ${miniAppUrl}`,
      { parse_mode: 'Markdown' }
    );
  });

  // /baca or /cari command
  bot.command(['baca', 'cari'], async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Silakan sertakan kata kunci. Contoh: `/baca matematika` atau `/cari cerita rakyat`', {
        parse_mode: 'Markdown',
      });
    }
    await handleBookSearch(ctx, query);
  });

  // Handle free text messages (smart detection for ISBN or title search)
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // Ignore unhandled commands

    await handleBookSearch(ctx, text);
  });

  // Helper search handler
  async function handleBookSearch(ctx: any, query: string) {
    const isIsbn = validateIsbn(query).valid;
    const searchingMsg = await ctx.reply(
      `🔎 _Sedang mencari "${query}" di koleksi bahasa Indonesia..._`,
      { parse_mode: 'Markdown' }
    );

    try {
      const searchRes = await searchService.search({
        query,
        freeOnly: false,
        limit: 8,
      });
      const results = searchRes.books;

      if (!results || results.length === 0) {
        return await ctx.api.editMessageText(
          ctx.chat.id,
          searchingMsg.message_id,
          `❌ Maaf, buku untuk pencarian *"${query}"* belum ditemukan di katalog bahasa Indonesia.\n\nCoba gunakan kata kunci umum seperti \`pelajaran\`, \`matematika\`, atau \`sejarah\`.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().webApp('🌐 Jelajahi di Web', miniAppUrl),
          }
        );
      }

      const topResults = results.slice(0, 4);

      await ctx.api.deleteMessage(ctx.chat.id, searchingMsg.message_id);

      for (const book of topResults) {
        const authors = book.authors.length > 0 ? book.authors.join(', ') : 'Penulis Anonim';
        const year = book.publishedYear ? ` (${book.publishedYear})` : '';
        const badge = formatAccessBadge(book);

        let desc = book.description || 'Buku terverifikasi berbahasa Indonesia.';
        if (desc.length > 200) {
          desc = desc.slice(0, 197) + '...';
        }

        const caption =
          `📖 *${book.title}*${year}\n` +
          `✍️ Penulis: ${authors}\n` +
          `🏷️ Status: ${badge}\n\n` +
          `${desc}`;

        const keyboard = new InlineKeyboard();

        if (book.access.status === 'FULL_ACCESS') {
          keyboard.webApp('📖 Baca di Mini App', miniAppUrl);
        } else if (book.access.status === 'BORROW_AVAILABLE' && book.access.officialItemUrl) {
          keyboard.url('🔵 Pinjam Buku Resmi', book.access.officialItemUrl);
        }

        if (book.sourceUrl) {
          keyboard.url('🌐 Buka Sumber', book.sourceUrl);
        }

        if (book.coverUrl && !book.coverUrl.includes('placeholder')) {
          try {
            await ctx.replyWithPhoto(book.coverUrl, {
              caption,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            });
            continue;
          } catch {
            // Fallback to text if photo cannot be fetched by Telegram
          }
        }

        await ctx.reply(caption, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch (err: unknown) {
      console.error('Telegram bot search error:', err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        searchingMsg.message_id,
        `⚠️ Terjadi kendala saat menghubungi katalog buku. Silakan coba kembali nanti.`
      );
    }
  }

  return bot;
}
