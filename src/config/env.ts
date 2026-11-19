import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  APP_NAME: z.string().default('DARFIN BOOK'),
  APP_LOCALE: z.string().default('id-ID'),
  DEFAULT_BOOK_LANGUAGE: z.string().default('id'),
  STRICT_INDONESIAN_CATALOG: z
    .string()
    .transform((val) => val === 'true')
    .default(true),

  DATABASE_PATH: z.string().default('./data/darfin_book.db'),
  DATABASE_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  OPEN_LIBRARY_USER_AGENT: z
    .string()
    .default('DarfinBook/1.0 (contact: support@darfinbook.id)'),
  OPEN_LIBRARY_CONTACT_EMAIL: z.string().default('support@darfinbook.id'),
  WIKISOURCE_API_BASE_URL: z.string().default('https://id.wikisource.org/w/api.php'),

  JWT_SECRET: z.string().default('darfin-book-jwt-secret-dev-2026'),
  SESSION_SECRET: z.string().default('darfin-book-session-secret-dev-2026'),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);
