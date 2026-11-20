import { describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';

describe('Fastify server endpoints and search integration', () => {
  it('returns ok on /health', async () => {
    const server = await buildServer();
    const res = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('DARFIN BOOK');
    expect(body.locale).toBe('id-ID');
  });

  it('validates ISBN via /api/v1/isbn/lookup', async () => {
    const server = await buildServer();
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/isbn/lookup',
      payload: {
        isbn: '978-602-03-8591-4',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.type).toBe('ISBN-13');
    expect(body.isbn).toBe('9786020385914');
  }, 30000);

  it('searches Indonesian educational textbooks and literature', async () => {
    const server = await buildServer();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/search?q=matematika&freeOnly=true',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.query).toBe('matematika');
    expect(Array.isArray(body.books)).toBe(true);
    const hasMath = body.books.some((b: { title: string }) =>
      b.title.toLowerCase().includes('matematika')
    );
    expect(hasMath).toBe(true);
  }, 30000);

  it('provides curated shelves on /api/v1/curated', async () => {
    const server = await buildServer();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/curated',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.shelves)).toBe(true);
    expect(body.shelves.length).toBeGreaterThan(0);
    expect(body.shelves[0].id).toBe('novel-populer');
  }, 60000);

  it('serves SPA index.html on root /', async () => {
    const server = await buildServer();
    const res = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('DARFIN BOOK');
  });
});
