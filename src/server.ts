import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { env } from './config/env.js';
import { initDb } from './db/index.js';
import type { BookSortOption, BookSourceFilter, ProviderBook } from './providers/types.js';
import { WikisourceProvider } from './providers/wikisource.js';
import { ReaderResolverService } from './services/readerResolver.js';
import { SearchService } from './services/search.js';
import { validateIsbn } from './utils/isbn.js';
import { UserService } from './services/userService.js';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

function checkRateLimit(ip: string, route: string, maxRequests: number, windowMs: number): boolean {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count++;
  return true;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now > bucket.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000).unref();

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

  // OWASP & Cloudflare Security Headers Hook
  server.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  // Rate Limiting Hook (DDoS & Brute Force mitigation)
  server.addHook('onRequest', async (request, reply) => {
    const ip = request.ip || '127.0.0.1';
    const url = request.url;

    if (url.startsWith('/api/v1/auth')) {
      if (!checkRateLimit(ip, 'auth', 20, 60000)) {
        reply.header('Retry-After', '60');
        return reply.code(429).send({
          error: 'Terlalu banyak permintaan autentikasi. Silakan tunggu 1 menit.',
        });
      }
    } else if (url.startsWith('/api/v1/search')) {
      if (!checkRateLimit(ip, 'search', 60, 60000)) {
        reply.header('Retry-After', '60');
        return reply.code(429).send({
          error: 'Batas pencarian tercapai. Silakan coba kembali sesaat lagi.',
        });
      }
    }
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

  // Multi-provider book search with strict sort, year range, and source validation
  const VALID_SORT_OPTIONS = new Set<BookSortOption>([
    'relevance',
    'newest',
    'oldest',
    'popular',
    'title_asc',
    'title_desc',
  ]);
  const VALID_SOURCES = new Set<BookSourceFilter>([
    'all',
    'openlibrary',
    'googlebooks',
    'wikisource',
    'kemdikbud',
    'internetarchive',
  ]);

  const parseBoundedYear = (raw?: string): number | undefined => {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!/^\d{4}$/.test(trimmed)) return undefined;
    const year = parseInt(trimmed, 10);
    return year >= 1000 && year <= 2099 ? year : undefined;
  };

  server.get('/api/v1/search', async (request, reply) => {
    const query = request.query as {
      q?: string;
      limit?: string;
      offset?: string;
      freeOnly?: string;
      sort?: string;
      yearFrom?: string;
      yearTo?: string;
      source?: string;
    };

    if (!query.q || !query.q.trim()) {
      return reply.code(400).send({
        error: 'Parameter pencarian (q) wajib diisi',
      });
    }

    const sanitizedQuery = query.q.trim().slice(0, 200);
    const parsedLimit = parseInt(query.limit || '', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 30;
    const parsedOffset = parseInt(query.offset || '', 10);
    const offset = Number.isFinite(parsedOffset) ? Math.min(Math.max(parsedOffset, 0), 10000) : 0;
    const freeOnly = query.freeOnly === 'true';

    const sort: BookSortOption =
      query.sort && VALID_SORT_OPTIONS.has(query.sort as BookSortOption)
        ? (query.sort as BookSortOption)
        : 'relevance';
    const source: BookSourceFilter =
      query.source && VALID_SOURCES.has(query.source as BookSourceFilter)
        ? (query.source as BookSourceFilter)
        : 'all';

    let yearFrom = parseBoundedYear(query.yearFrom);
    let yearTo = parseBoundedYear(query.yearTo);
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
      [yearFrom, yearTo] = [yearTo, yearFrom];
    }

    const results = await searchService.search({
      query: sanitizedQuery,
      limit,
      offset,
      freeOnly,
      sort,
      yearFrom,
      yearTo,
      source,
    });

    return results;
  });

  // Curated Indonesian shelves cache
  let cachedCurated: {
    shelves: Array<{ id: string; title: string; subtitle: string; books: ProviderBook[] }>;
    expiresAt: number;
  } | null = null;

  // Curated Indonesian shelves (Novels at top: Tere Liye, Pidi Baiq, etc.)
  server.get('/api/v1/curated', async () => {
    if (cachedCurated && Date.now() < cachedCurated.expiresAt) {
      return { shelves: cachedCurated.shelves };
    }

    try {
      const [novelTere, novelPidi, novelAndrea, textbooks, classics, science, history] =
        await Promise.all([
          searchService.search({ query: 'Tere Liye', limit: 4, freeOnly: false }),
          searchService.search({ query: 'Pidi Baiq Dilan', limit: 4, freeOnly: false }),
          searchService.search({ query: 'Laskar Pelangi Andrea Hirata', limit: 2, freeOnly: false }),
          searchService.search({ query: 'pelajaran', limit: 8, freeOnly: true }),
          searchService.search({ query: 'cerita', limit: 8, freeOnly: true }),
          searchService.search({ query: 'matematika', limit: 8, freeOnly: true }),
          searchService.search({ query: 'sejarah', limit: 8, freeOnly: true }),
        ]);

      // Interleave novel authors so Tere Liye, Pidi Baiq, and Andrea Hirata are evenly distributed
      const seenIds = new Set<string>();
      const novelBooks: ProviderBook[] = [];
      const maxLen = Math.max(
        novelTere.books.length,
        novelPidi.books.length,
        novelAndrea.books.length
      );
      for (let i = 0; i < maxLen; i++) {
        const bTere = novelTere.books[i];
        if (bTere) {
          const k = `${bTere.provider}:${bTere.providerId}`;
          if (!seenIds.has(k)) {
            seenIds.add(k);
            novelBooks.push(bTere);
          }
        }
        const bPidi = novelPidi.books[i];
        if (bPidi) {
          const k = `${bPidi.provider}:${bPidi.providerId}`;
          if (!seenIds.has(k)) {
            seenIds.add(k);
            novelBooks.push(bPidi);
          }
        }
        const bAndrea = novelAndrea.books[i];
        if (bAndrea) {
          const k = `${bAndrea.provider}:${bAndrea.providerId}`;
          if (!seenIds.has(k)) {
            seenIds.add(k);
            novelBooks.push(bAndrea);
          }
        }
      }

      const shelves = [
        {
          id: 'novel-populer',
          title: 'Novel & Fiksi',
          subtitle: 'Kumpulan novel best seller, roman remaja, dan karya sastra fiksi pilihan nusantara',
          books: novelBooks,
        },
        {
          id: 'buku-pelajaran',
          title: 'Buku Teks Pelajaran Resmi (SD, SMP, SMA/SMK)',
          subtitle: 'Kurikulum Merdeka Kemendikdasmen RI - 100% Legal & Terbuka untuk Siswa & Guru',
          books: textbooks.books,
        },
        {
          id: 'sastra-nusantara',
          title: 'Sastra & Cerita Rakyat Nusantara',
          subtitle: 'Karya sastra klasik nusantara, fabel dongeng rakyat, dan naskah kuno berlisensi bebas',
          books: classics.books,
        },
        {
          id: 'sains-populer',
          title: 'Matematika, Sains & Pengetahuan Terbuka',
          subtitle: 'Buku rujukan ilmu pengetahuan alam, matematika, dan teknologi bahasa Indonesia',
          books: science.books,
        },
        {
          id: 'sejarah-tokoh',
          title: 'Sejarah, Biografi & Budaya Nusantara',
          subtitle: 'Catatan perjalanan bangsa, biografi tokoh pergerakan, dan peradaban Indonesia',
          books: history.books,
        },
      ];

      cachedCurated = {
        shelves,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins cache
      };

      return { shelves };
    } catch (err) {
      if (cachedCurated) {
        return { shelves: cachedCurated.shelves };
      }
      throw err;
    }
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
      googleClientId: (env.GOOGLE_CLIENT_ID || '').trim(),
      hasGoogleOAuth: Boolean(env.GOOGLE_CLIENT_ID),
      hasClientSecret: Boolean(env.GOOGLE_CLIENT_SECRET),
    };
  });

  // Helper for deterministic OAuth redirect URI
  const getGoogleRedirectUri = (request: any): string => {
    const forwardedHost = request.headers['x-forwarded-host'] as string;
    const hostHeader = request.headers.host as string;
    const rawHost = forwardedHost || hostHeader || 'darfin-book.onrender.com';
    const host = rawHost.split(',')[0].trim();

    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}/api/v1/auth/google/callback`;
    }
    // Production (Render or any public domain) MUST always be https
    return `https://${host}/api/v1/auth/google/callback`;
  };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAuthBridgeHtml(params: {
  success: boolean;
  token?: string;
  user?: { displayName?: string; email?: string };
  error?: string;
}): string {
  const isValidToken = Boolean(params.token) && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(params.token || '');
  const isSuccess = params.success && isValidToken;
  const token = isSuccess ? (params.token || '') : '';
  const appSchemeUrl = isSuccess ? `darfinbook://auth?token=${encodeURIComponent(token)}` : 'darfinbook://auth?error=invalid_token';
  const intentUrl = isSuccess ? `intent://auth?token=${encodeURIComponent(token)}#Intent;scheme=darfinbook;package=id.darfinbook.app;end` : '';
  const name = params.user?.displayName || params.user?.email || 'Pengguna';
  const errorMsg = params.error || (!isValidToken && params.success ? 'Token otentikasi tidak valid' : 'Autentikasi gagal');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${isSuccess ? 'Login Berhasil' : 'Login Gagal'} — DARFIN BOOK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #080E1E;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #0F172A;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      background: ${isSuccess ? 'rgba(13, 148, 136, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
      border: 1px solid ${isSuccess ? 'rgba(13, 148, 136, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    p {
      color: #94A3B8;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .btn {
      display: block;
      width: 100%;
      background: ${isSuccess ? '#0D9488' : '#334155'};
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 14px;
      box-shadow: ${isSuccess ? '0 4px 14px rgba(13, 148, 136, 0.4)' : 'none'};
      transition: background 0.2s;
    }
    .btn:active {
      background: ${isSuccess ? '#0F766E' : '#1E293B'};
    }
    .footnote {
      margin-top: 16px;
      font-size: 12px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">${isSuccess ? '✓' : '✕'}</div>
    <h1>${isSuccess ? 'Login Berhasil!' : 'Login Tidak Berhasil'}</h1>
    <p>${
      isSuccess
        ? `Selamat datang kembali, <strong>${escapeHtml(name)}</strong>.<br>Membuka aplikasi DARFIN BOOK...`
        : escapeHtml(errorMsg)
    }</p>
    ${
      isSuccess
        ? `<a id="openAppBtn" href="${appSchemeUrl}" class="btn">Buka Aplikasi DARFIN BOOK</a>
           <div class="footnote">Jika tidak berpindah otomatis, ketuk tombol di atas.</div>`
        : `<a href="darfinbook://auth?error=cancel" class="btn">Kembali ke Aplikasi</a>`
    }
  </div>
  ${
    isSuccess
      ? `<script>
    var appUrl = "${appSchemeUrl}";
    var intentUrl = "${intentUrl}";
    try {
      localStorage.setItem('darfin_token', "${token}");
    } catch(e) {}
    window.location.href = appUrl;
    setTimeout(function() {
      window.location.href = intentUrl;
    }, 450);
  </script>`
      : ''
  }
</body>
</html>`;
}

  // Official Google OAuth 2.0 URL generator
  server.get('/api/v1/auth/google/url', async (request, reply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      return {
        configured: false,
        error: 'GOOGLE_CLIENT_ID belum dikonfigurasi di server',
      };
    }

    const redirectUri = getGoogleRedirectUri(request);
    const query = request.query as { platform?: string };
    const platform = query?.platform || 'web';

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID.trim(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      access_type: 'online',
      state: platform,
    });

    return {
      configured: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  });

  // Official Google OAuth 2.0 Redirect Callback
  server.get('/api/v1/auth/google/callback', async (request, reply) => {
    const { code, error, state } = request.query as { code?: string; error?: string; state?: string };
    const isAndroid = state === 'android';

    if (error) {
      server.log.warn({ error }, 'Google OAuth redirected with error');
      if (isAndroid) {
        return reply.type('text/html').send(renderAuthBridgeHtml({
          success: false,
          error: error || 'Login Google dibatalkan',
        }));
      }
      return reply.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    if (!code || !env.GOOGLE_CLIENT_ID) {
      if (isAndroid) {
        return reply.type('text/html').send(renderAuthBridgeHtml({
          success: false,
          error: 'Kode otentikasi Google tidak ditemukan',
        }));
      }
      return reply.redirect('/?error=google_auth_failed');
    }

    const redirectUri = getGoogleRedirectUri(request);

    try {
      const clientId = env.GOOGLE_CLIENT_ID.trim();
      const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();

      const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        id_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenData.access_token && !tokenData.id_token) {
        server.log.error({ tokenData, redirectUri, hasSecret: Boolean(clientSecret) }, 'Google OAuth token exchange failed');
        const reason = tokenData.error_description || tokenData.error || 'token_exchange_failed';
        if (isAndroid) {
          return reply.type('text/html').send(renderAuthBridgeHtml({
            success: false,
            error: reason,
          }));
        }
        return reply.redirect(`/?error=token_exchange_failed&reason=${encodeURIComponent(reason)}`);
      }

      let email: string | undefined;
      let name: string | undefined;
      let picture: string | undefined;
      let googleId: string | undefined;

      // 1. First attempt to decode verified id_token
      if (tokenData.id_token) {
        try {
          const parts = tokenData.id_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
            googleId = payload.sub;
          }
        } catch (e) {
          server.log.warn({ e }, 'Failed to parse id_token from Google');
        }
      }

      // 2. Fallback to userinfo API if id_token did not yield email
      if (!email && tokenData.access_token) {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = (await profileRes.json()) as {
          email?: string;
          name?: string;
          picture?: string;
          sub?: string;
        };
        email = profile.email;
        name = profile.name || name;
        picture = profile.picture || picture;
        googleId = profile.sub || googleId;
      }

      if (!email) {
        if (isAndroid) {
          return reply.type('text/html').send(renderAuthBridgeHtml({
            success: false,
            error: 'Alamat email tidak ditemukan dari profil Google',
          }));
        }
        return reply.redirect('/?error=email_not_found');
      }

      const authResult = await userService.loginWithGoogle({
        email,
        name,
        picture,
        googleId,
      });

      if (isAndroid) {
        return reply.type('text/html').send(renderAuthBridgeHtml({
          success: true,
          token: authResult.token,
          user: authResult.user,
        }));
      }

      return reply.redirect(`/?auth_token=${encodeURIComponent(authResult.token)}`);
    } catch (err: any) {
      server.log.error({ err }, 'Google OAuth callback exchange exception');
      if (isAndroid) {
        return reply.type('text/html').send(renderAuthBridgeHtml({
          success: false,
          error: err?.message || 'Terjadi kesalahan sistem saat verifikasi Google OAuth',
        }));
      }
      return reply.redirect(`/?error=google_auth_error&details=${encodeURIComponent(err?.message || '')}`);
    }
  });

  // Google / Gmail Authentication
  server.post('/api/v1/auth/google', async (request, reply) => {
    const body = request.body as {
      credential?: string;
      accessToken?: string;
      email?: string;
      name?: string;
      picture?: string;
      googleId?: string;
    };

    let email: string | undefined;
    let name = body?.name;
    let picture = body?.picture;
    let googleId = body?.googleId;

    // 1. Verify Google ID token via Google tokeninfo API if provided
    if (body?.credential) {
      try {
        const tokenRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.credential)}`
        );
        if (tokenRes.ok) {
          const info = (await tokenRes.json()) as {
            email?: string;
            email_verified?: string | boolean;
            name?: string;
            picture?: string;
            sub?: string;
            aud?: string;
          };
          const isEmailVerified = info.email_verified === 'true' || info.email_verified === true;
          if (info.email && isEmailVerified) {
            if (env.GOOGLE_CLIENT_ID && info.aud && info.aud !== env.GOOGLE_CLIENT_ID.trim()) {
              return reply.code(401).send({
                error: 'Token Google tidak cocok dengan identitas Client ID aplikasi',
              });
            }
            email = info.email;
            name = info.name || name;
            picture = info.picture || picture;
            googleId = info.sub || googleId;
          }
        }
      } catch (e) {
        server.log.warn({ error: e }, 'Failed to verify Google ID token with tokeninfo');
      }
    }

    // 2. Verify Google Access Token via Google userinfo API if provided
    if (!email && body?.accessToken) {
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${body.accessToken}` },
        });
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as {
            email?: string;
            name?: string;
            picture?: string;
            sub?: string;
          };
          if (profile.email) {
            email = profile.email;
            name = profile.name || name;
            picture = profile.picture || picture;
            googleId = profile.sub || googleId;
          }
        }
      } catch (e) {
        server.log.warn({ error: e }, 'Failed to verify Google access token with userinfo');
      }
    }

    // 3. Fallback check: in production, unverified email login is strictly forbidden
    if (!email && body?.email) {
      if (env.NODE_ENV === 'production') {
        return reply.code(401).send({
          error: 'Verifikasi identitas Google resmi diperlukan untuk masuk di lingkungan produksi.',
        });
      }
      server.log.warn(
        { email: body.email },
        '[SECURITY WARNING] Allowing unverified direct email login strictly for local development'
      );
      email = body.email;
    }

    if (!email) {
      return reply.code(401).send({
        error: 'Otentikasi Google tidak valid atau gagal diverifikasi.',
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

  // Helper auth extractor with automatic user reconciliation
  const requireAuth = async (request: any, reply: any) => {
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

    // Ensure user record exists in SQLite database (guarantees cross-device & post-restart integrity)
    const verifiedUserId = await userService.ensureUser(session);
    session.userId = verifiedUserId;

    return session;
  };

  // Get current user profile
  server.get('/api/v1/auth/me', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    return {
      user: {
        id: session.userId,
        email: session.email,
        displayName: session.displayName || session.email.split('@')[0],
        avatarUrl: session.avatarUrl,
      },
    };
  });

  // User Library (Saved Books, Favorites, Bookmarks, Reading Progress)
  server.get('/api/v1/user/library', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const library = await userService.getUserLibrary(session.userId);
    return library;
  });

  // Bidirectional User Library Sync (reconciles device library with cloud server)
  server.post('/api/v1/user/sync', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      books?: ProviderBook[];
      favoriteIds?: string[];
      bookmarks?: Array<{
        id?: string;
        bookId: string;
        locationType: string;
        locationValue: string;
        label?: string | null;
      }>;
    };

    const unifiedLibrary = await userService.syncUserLibrary(session.userId, body || {});
    return unifiedLibrary;
  });

  // Save book to shelf
  server.post('/api/v1/user/books', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as { book?: ProviderBook; isFavorite?: boolean };
    if (!body?.book) {
      return reply.code(400).send({ error: 'Data buku wajib dilampirkan' });
    }

    await userService.saveBook(session.userId, body.book, body.isFavorite ?? false);
    return { ok: true, message: 'Buku berhasil disimpan ke rak' };
  });

  // Clear all books from user's shelf
  server.delete('/api/v1/user/shelf/clear', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    await userService.clearShelf(session.userId);
    return { ok: true, message: 'Rak buku berhasil dikosongkan' };
  });

  // Remove book from shelf
  server.delete('/api/v1/user/books/:provider/:providerId', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { provider, providerId } = request.params as { provider: string; providerId: string };
    await userService.removeBook(session.userId, provider, providerId);
    return { ok: true, message: 'Buku dihapus dari rak' };
  });

  // Toggle Favorite
  server.post('/api/v1/user/favorites/toggle', async (request, reply) => {
    const session = await requireAuth(request, reply);
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
    const session = await requireAuth(request, reply);
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
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    await userService.deleteBookmark(session.userId, id);
    return { ok: true };
  });

  // Save Reading Progress
  server.post('/api/v1/user/progress', async (request, reply) => {
    const session = await requireAuth(request, reply);
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
