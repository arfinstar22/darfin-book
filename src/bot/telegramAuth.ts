import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user?: TelegramUser;
  auth_date: number;
  query_id?: string;
  hash: string;
}

/**
 * Validates Telegram WebApp initData string using official HMAC-SHA256 specification.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken?: string
): { valid: boolean; data?: ValidatedInitData; error?: string } {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { valid: false, error: 'TELEGRAM_BOT_TOKEN belum dikonfigurasi di server' };
  }

  if (!initData) {
    return { valid: false, error: 'initData kosong' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Hash tidak ditemukan dalam initData' };
    }

    // Sort params alphabetically excluding hash
    const keys = Array.from(params.keys())
      .filter((k) => k !== 'hash')
      .sort();

    const dataCheckString = keys
      .map((k) => `${k}=${params.get(k)}`)
      .join('\n');

    // 1. Secret key = HMAC_SHA256("WebAppData", token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(token)
      .digest();

    // 2. Computed hash = HMAC_SHA256(secretKey, dataCheckString)
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      return { valid: false, error: 'Hash verifikasi Telegram tidak valid' };
    }

    // 3. Check auth_date expiration
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'auth_date tidak ditemukan' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = env.TELEGRAM_INITDATA_MAX_AGE_SECONDS || 86400;

    if (now - authDate > maxAge) {
      return { valid: false, error: 'Sesi Telegram WebApp telah kedaluwarsa' };
    }

    // Parse user json if present
    let user: TelegramUser | undefined;
    const userStr = params.get('user');
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        // user parsing ignored
      }
    }

    return {
      valid: true,
      data: {
        user,
        auth_date: authDate,
        query_id: params.get('query_id') || undefined,
        hash,
      },
    };
  } catch (err: unknown) {
    return { valid: false, error: (err as Error).message };
  }
}
