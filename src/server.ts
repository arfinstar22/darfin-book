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
    };
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
