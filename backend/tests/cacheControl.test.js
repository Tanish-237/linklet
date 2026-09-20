import express from 'express';
import supertest from 'supertest';
import { apiDefaultCacheControl, browserCache } from '../src/middlewares/cacheControl.js';

const app = express();
app.use(apiDefaultCacheControl);
app.get('/plain', (req, res) => res.json({ ok: true }));
app.get('/static-ish', browserCache(300), (req, res) => res.json({ ok: true }));
app.get('/short', browserCache(30, 60), (req, res) => res.json({ ok: true }));
app.post('/write', browserCache(300), (req, res) => res.json({ ok: true }));
const request = supertest(app);

describe('API Cache-Control policy', () => {
  test('plain GETs are private and must revalidate (never heuristically cached, never shared)', async () => {
    const res = await request.get('/plain');
    console.log(`[TEST RESULT] /plain → ${res.headers['cache-control']}`);
    expect(res.headers['cache-control']).toBe('private, no-cache');
  });

  test('opted-in reference data gets a private max-age with stale-while-revalidate', async () => {
    const res = await request.get('/static-ish');
    console.log(`[TEST RESULT] /static-ish → ${res.headers['cache-control']}`);
    expect(res.headers['cache-control']).toBe('private, max-age=300, stale-while-revalidate=1500');
    const short = await request.get('/short');
    expect(short.headers['cache-control']).toBe('private, max-age=30, stale-while-revalidate=60');
  });

  test('nothing is ever marked public (responses are user-scoped)', async () => {
    for (const path of ['/plain', '/static-ish', '/short']) {
      const res = await request.get(path);
      expect(res.headers['cache-control']).not.toMatch(/public|s-maxage/);
    }
  });

  test('writes never get a caching header from these middlewares', async () => {
    const res = await request.post('/write');
    expect(res.headers['cache-control']).toBeUndefined();
  });

  test('unchanged GET responses revalidate to a 304 via ETag', async () => {
    const first = await request.get('/plain');
    const second = await request.get('/plain').set('If-None-Match', first.headers.etag);
    console.log(`[TEST RESULT] revalidation status: ${second.status}`);
    expect(second.status).toBe(304);
  });
});
