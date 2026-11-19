import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../bot/telegramAuth.js';

describe('Telegram WebApp initData validation', () => {
  const dummyBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  it('rejects empty or missing initData', () => {
    const res = validateTelegramInitData('', dummyBotToken);
    expect(res.valid).toBe(false);
  });

  it('correctly verifies a valid HMAC-SHA256 initData', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new Map([
      ['auth_date', String(authDate)],
      ['query_id', 'AAG90_sAAAAAAJzT-wD_dummy'],
      ['user', JSON.stringify({ id: 98765432, first_name: 'Darfin', username: 'darfin' })],
    ]);

    // Build dataCheckString
    const dataCheckString = Array.from(params.keys())
      .sort()
      .map((k) => `${k}=${params.get(k)}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(dummyBotToken)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const initData = `auth_date=${authDate}&query_id=AAG90_sAAAAAAJzT-wD_dummy&user=${encodeURIComponent(
      params.get('user')!
    )}&hash=${hash}`;

    const verification = validateTelegramInitData(initData, dummyBotToken);
    expect(verification.valid).toBe(true);
    expect(verification.data?.user?.id).toBe(98765432);
    expect(verification.data?.user?.first_name).toBe('Darfin');
  });

  it('rejects tampered initData', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const initData = `auth_date=${authDate}&query_id=fake&hash=deadbeef00112233445566778899aabbccddeeff`;

    const verification = validateTelegramInitData(initData, dummyBotToken);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain('tidak valid');
  });
});
