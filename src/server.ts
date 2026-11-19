import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { env } from './config/env.js';
import { initDb } from './db/index.js';
import type { ProviderBook } from './providers/types.js';
import { WikisourceProvider } from './providers/wikisource.js';
import { ReaderResolverService } from './services/readerResolver.js';
import { SearchService } from './services/search.js';
import { validateIsbn } from './utils/isbn.js';
import { UserService } from './services/userService.js';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            remoteAddress: req.ip,
          };
        },
      },
    },
  });

  // Enable CORS
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Initialize database schema
  initDb();

  const searchService = new SearchService();
  const readerResolver = new ReaderResolverService();
  const wikisource = new WikisourceProvider();
  const userService = new UserService();

  // Basic Health check
  server.get('/health', async () => {
    return {
      status: 'ok',
      service: env.APP_NAME,
      locale: env.APP_LOCALE,
      timestamp: new Date().toISOString(),
    };
  });

  server.get('/ready', async () => {
    return {
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  });

  // Privacy Policy for Google OAuth & Public Compliance
  server.get('/privacy', async (request, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kebijakan Privasi — DARFIN BOOK</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1e293b; background: #fafaf9; }
    .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { color: #0f766e; margin-top: 0; }
    h2 { color: #0f172a; margin-top: 24px; font-size: 1.15rem; }
    a { color: #0d9488; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Kebijakan Privasi DARFIN BOOK</h1>
    <p><em>Terakhir diperbarui: 19 November 2026</em></p>
    <p>DARFIN BOOK ("kami") adalah perpustakaan digital terbuka untuk membaca buku pelajaran resmi, naskah sastra, dan dokumen publik secara legal dan gratis.</p>
    <h2>1. Data yang Kami Kumpulkan</h2>
    <p>Ketika Anda menggunakan fitur Masuk dengan Akun Google, kami hanya menerima informasi profil dasar dari Google berupa: <strong>nama lengkap</strong>, <strong>alamat email</strong>, dan <strong>foto profil</strong>.</p>
    <h2>2. Penggunaan Data</h2>
    <p>Data profil Google Anda hanya digunakan secara eksklusif untuk:</p>
    <ul>
      <li>Mengidentifikasi akun Anda saat menyimpan buku ke rak bacaan pribadi.</li>
      <li>Menyimpan daftar buku favorit Anda.</li>
      <li>Menyimpan penanda halaman (bookmark) dan progres membaca.</li>
    </ul>
    <h2>3. Keamanan Data & Pihak Ketiga</h2>
    <p>Kami tidak pernah menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga mana pun.</p>
    <h2>4. Kontak</h2>
    <p>Untuk pertanyaan terkait privasi data, silakan hubungi pengelola melalui email: <a href="mailto:support@darfinbook.id">support@darfinbook.id</a>.</p>
    <p><a href="/">&larr; Kembali ke Beranda DARFIN BOOK</a></p>
  </div>
</body>
</html>`);
  });

  // Terms of Service for Google OAuth & Public Compliance
  server.get('/terms', async (request, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ketentuan Layanan — DARFIN BOOK</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1e293b; background: #fafaf9; }
    .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { color: #0f766e; margin-top: 0; }
    h2 { color: #0f172a; margin-top: 24px; font-size: 1.15rem; }
    a { color: #0d9488; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Ketentuan Layanan DARFIN BOOK</h1>
    <p><em>Terakhir diperbarui: 19 November 2026</em></p>
    <p>Dengan mengakses atau menggunakan DARFIN BOOK, Anda menyetujui ketentuan berikut:</p>
    <h2>1. Layanan Baca Gratis</h2>
    <p>Semua materi buku disediakan untuk tujuan pendidikan, penelitian, dan literasi publik sesuai lisensi domain publik dan sumber resmi Kemdikbud.</p>
    <h2>2. Akun Pengguna</h2>
    <p>Fitur login menggunakan akun Google disediakan agar Anda dapat menyimpan preferensi rak dan pembatas bacaan Anda di berbagai perangkat.</p>
    <p><a href="/">&larr; Kembali ke Beranda DARFIN BOOK</a></p>
  </div>
</body>
</html>`);
  });

  // API v1 root
  server.get('/api/v1', async () => {
    return {
      name: env.APP_NAME,
      version: '1.0.0',
      description: 'Perpustakaan Digital untuk Semua',
      defaultLanguage: env.DEFAULT_BOOK_LANGUAGE,
      strictIndonesianCatalog: env.STRICT_INDONESIAN_CATALOG,
    };
  });

  // ISBN validation endpoint
  server.post('/api/v1/isbn/lookup', async (request, reply) => {
    const body = request.body as { isbn?: string };
    if (!body?.isbn) {
      return reply.code(400).send({
        error: 'ISBN wajib diisi',
      });
    }

    const validation = validateIsbn(body.isbn);
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Format ISBN tidak valid (harus ISBN-10 atau ISBN-13 yang valid)',
        normalized: validation.normalized,
      });
    }

    // Lookup book by ISBN
    const books = await searchService.searchByIsbn(validation.normalized);

    return {
      valid: true,
      type: validation.type,
      isbn: validation.normalized,
      books,
    };
  });

  // Multi-provider book search
  server.get('/api/v1/search', async (request, reply) => {
    const query = request.query as {
      q?: string;
      limit?: string;
      offset?: string;
      freeOnly?: string;
    };

    if (!query.q || !query.q.trim()) {
      return reply.code(400).send({
        error: 'Parameter pencarian (q) wajib diisi',
      });
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const freeOnly = query.freeOnly === 'true';

    const results = await searchService.search({
      query: query.q,
      limit,
      offset,
      freeOnly,
    });

    return results;
  });

  // Curated Indonesian shelves
  server.get('/api/v1/curated', async () => {
    const [textbooks, classics] = await Promise.all([
      searchService.search({ query: 'pelajaran', limit: 8, freeOnly: true }),
      searchService.search({ query: 'cerita', limit: 8, freeOnly: true }),
    ]);

    return {
      shelves: [
        {
          id: 'buku-pelajaran',
          title: 'Buku Teks Pelajaran Resmi (SD, SMP, SMA/SMK)',
          subtitle: 'Kurikulum Merdeka Kemendikbudristek — 100% Gratis & Legal',
          books: textbooks.books,
        },
        {
          id: 'sastra-nusantara',
          title: 'Sastra & Cerita Rakyat Nusantara',
          subtitle: 'Karya sastra domain publik dan cerita rakyat nusantara',
          books: classics.books,
        },
      ],
    };
  });

  // Resolve reading mode
  server.post('/api/v1/reader/resolve', async (request, reply) => {
    const body = request.body as {
      book?: ProviderBook;
      preferredMode?: 'AUTO' | 'INTERNAL' | 'EXTERNAL';
    };

    if (!body?.book) {
      return reply.code(400).send({
        error: 'Data buku wajib dilampirkan',
      });
    }

    const resolution = await readerResolver.resolve(body.book, {
      preferredMode: body.preferredMode,
    });

    return resolution;
  });

  // Direct Wikisource reading content
  server.get('/api/v1/wikisource/content/:pageId', async (request, reply) => {
    const params = request.params as { pageId: string };
    const content = await wikisource.getPageContent(params.pageId);

    if (!content) {
      return reply.code(404).send({
        error: 'Konten naskah Wikisumber tidak ditemukan atau gagal dimuat.',
      });
    }

    return content;
  });

  // Public auth configuration (e.g. Google Client ID for GIS SDK)
  server.get('/api/v1/auth/config', async () => {
    return {
      googleClientId: env.GOOGLE_CLIENT_ID || '',
      hasGoogleOAuth: Boolean(env.GOOGLE_CLIENT_ID),
    };
  });

  // Official Google OAuth 2.0 URL generator
  server.get('/api/v1/auth/google/url', async (request, reply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      return {
        configured: false,
        error: 'GOOGLE_CLIENT_ID belum dikonfigurasi di server',
      };
    }

    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'darfin-book.onrender.com';
    const proto = (request.headers['x-forwarded-proto'] as string) || (host.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${proto}://${host}/api/v1/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      access_type: 'online',
    });

    return {
      configured: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  });

  // Official Google OAuth 2.0 Redirect Callback
  server.get('/api/v1/auth/google/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code || !env.GOOGLE_CLIENT_ID) {
      return reply.redirect('/?error=google_auth_failed');
    }

    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'darfin-book.onrender.com';
    const proto = (request.headers['x-forwarded-proto'] as string) || (host.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${proto}://${host}/api/v1/auth/google/callback`;

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
      if (!tokenData.access_token && !tokenData.id_token) {
        return reply.redirect('/?error=token_exchange_failed');
      }

      // Fetch user profile from Google
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = (await profileRes.json()) as { email?: string; name?: string; picture?: string; sub?: string };

      if (!profile.email) {
        return reply.redirect('/?error=email_not_found');
      }

      const authResult = await userService.loginWithGoogle({
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        googleId: profile.sub,
      });

      return reply.redirect(`/?auth_token=${encodeURIComponent(authResult.token)}`);
    } catch (err) {
      server.log.error({ err }, 'Google OAuth callback exchange failed');
      return reply.redirect('/?error=google_auth_error');
    }
  });

  // Google / Gmail Authentication
  server.post('/api/v1/auth/google', async (request, reply) => {
    const body = request.body as {
      credential?: string;
      email?: string;
      name?: string;
      picture?: string;
      googleId?: string;
    };

    let email = body?.email;
    let name = body?.name;
    let picture = body?.picture;
    let googleId = body?.googleId;

    // Decode Google ID token if provided
    if (body?.credential) {
      try {
        const parts = body.credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          if (payload.email) {
            email = payload.email;
            name = payload.name || name;
            picture = payload.picture || picture;
            googleId = payload.sub || googleId;
          }
        }
      } catch (e) {
        server.log.warn({ error: e }, 'Failed to parse Google credential token');
      }
    }

    if (!email) {
      return reply.code(400).send({
        error: 'Email Google wajib disertakan untuk masuk',
      });
    }

    try {
      const authResult = await userService.loginWithGoogle({
        email,
        name,
        picture,
        googleId,
      });
      return reply.code(200).send(authResult);
    } catch (err: unknown) {
      return reply.code(400).send({
        error: (err as Error).message || 'Gagal masuk dengan akun Google',
      });
    }
  });

  // Helper auth extractor
  const requireAuth = (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Sesi masuk diperlukan. Silakan login dengan Google.' });
      return null;
    }
    const token = authHeader.slice(7);
    const session = userService.verifySessionToken(token);
    if (!session) {
      reply.code(401).send({ error: 'Sesi masuk tidak valid atau kedaluwarsa.' });
      return null;
    }
    return session;
  };

  // Get current user profile
  server.get('/api/v1/auth/me', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    return { user: session };
  });

  // User Library (Saved Books, Favorites, Bookmarks, Reading Progress)
  server.get('/api/v1/user/library', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const library = await userService.getUserLibrary(session.userId);
    return library;
  });

  // Save book to shelf
  server.post('/api/v1/user/books', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const body = request.body as { book?: ProviderBook; isFavorite?: boolean };
    if (!body?.book) {
      return reply.code(400).send({ error: 'Data buku wajib dilampirkan' });
    }

    await userService.saveBook(session.userId, body.book, body.isFavorite ?? false);
    return { ok: true, message: 'Buku berhasil disimpan ke rak' };
  });

  // Remove book from shelf
  server.delete('/api/v1/user/books/:provider/:providerId', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const { provider, providerId } = request.params as { provider: string; providerId: string };
    await userService.removeBook(session.userId, provider, providerId);
    return { ok: true, message: 'Buku dihapus dari rak' };
  });

  // Toggle Favorite
  server.post('/api/v1/user/favorites/toggle', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const body = request.body as { book?: ProviderBook };
    if (!body?.book) {
      return reply.code(400).send({ error: 'Data buku wajib dilampirkan' });
    }

    const isFavorite = await userService.toggleFavorite(session.userId, body.book);
    return { ok: true, isFavorite };
  });

  // Save Bookmark / Reading Marker
  server.post('/api/v1/user/bookmarks', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      bookId: string;
      locationType: string;
      locationValue: string;
      label?: string;
    };

    if (!body?.bookId || !body?.locationValue) {
      return reply.code(400).send({ error: 'Lokasi bacaan wajib diisi' });
    }

    const res = await userService.saveBookmark(session.userId, body);
    return { ok: true, bookmarkId: res.id };
  });

  // Delete Bookmark
  server.delete('/api/v1/user/bookmarks/:id', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    await userService.deleteBookmark(session.userId, id);
    return { ok: true };
  });

  // Save Reading Progress
  server.post('/api/v1/user/progress', async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      bookId: string;
      readerMode: string;
      locationType: string;
      locationValue: string;
      progressPercent?: number;
    };

    if (!body?.bookId || !body?.locationValue) {
      return reply.code(400).send({ error: 'Lokasi progres membaca wajib diisi' });
    }

    await userService.saveReadingProgress(session.userId, body);
    return { ok: true };
  });

  // Serve static frontend in production if built
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    await server.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });

    server.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Endpoint API tidak ditemukan' });
      }
      return reply.sendFile('index.html');
    });
  }

  return server;
}

// Start standalone server when executed directly
if (
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js')
) {
  const start = async () => {
    try {
      const server = await buildServer();
      const address = await server.listen({
        port: env.PORT,
        host: env.HOST,
      });
      server.log.info(`DARFIN BOOK Backend running at ${address}`);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  };
  start();
}
