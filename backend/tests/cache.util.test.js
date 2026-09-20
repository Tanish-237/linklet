import { jest } from '@jest/globals';

const store = new Map();
let redisState = 'ready'; // 'ready' | 'down' | 'uninitialized' | 'erroring'
const fakeRedis = {
  get isReady() { return redisState === 'ready' || redisState === 'erroring'; },
  get: jest.fn(async (k) => { if (redisState === 'erroring') throw new Error('ECONNRESET'); return store.get(k) ?? null; }),
  setEx: jest.fn(async (k, ttl, v) => { if (redisState === 'erroring') throw new Error('ECONNRESET'); store.set(k, v); }),
  del: jest.fn(async (keys) => { [].concat(keys).forEach((k) => store.delete(k)); }),
  incr: jest.fn(async (k) => { const n = Number(store.get(k) || 0) + 1; store.set(k, String(n)); return n; }),
};
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: () => {
    if (redisState === 'uninitialized') throw new Error('Redis client not initialized');
    return fakeRedis;
  },
}));

const { cached, cacheGet, cacheSet, cacheDel, getCacheVersion, bumpCacheVersion } = await import('../src/utils/cache.js');

describe('cache helper', () => {
  beforeEach(() => {
    store.clear();
    redisState = 'ready';
    jest.clearAllMocks();
  });

  test('read-through: loader runs once, then the cached value is served', async () => {
    console.log('[TEST] cached › miss → loader, hit → no loader');
    const loader = jest.fn().mockResolvedValue({ a: 1 });
    expect(await cached('k1', 60, loader)).toEqual({ a: 1 });
    expect(await cached('k1', 60, loader)).toEqual({ a: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fakeRedis.setEx).toHaveBeenCalledWith('k1', 60, JSON.stringify({ a: 1 }));
  });

  test('caches falsy-but-valid values like [] and 0', async () => {
    const loader = jest.fn().mockResolvedValue([]);
    await cached('empty', 60, loader);
    await cached('empty', 60, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('null/undefined results are returned but never cached', async () => {
    console.log('[TEST] cached › "not found" is not pinned for the whole TTL');
    const loader = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ found: true });
    expect(await cached('nf', 60, loader)).toBeNull();
    expect(await cached('nf', 60, loader)).toEqual({ found: true });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('single-flight: 50 simultaneous misses run the loader ONCE', async () => {
    console.log('[TEST] cached › stampede protection');
    const loader = jest.fn(() => new Promise((r) => setTimeout(() => r('value'), 30)));
    const results = await Promise.all(Array.from({ length: 50 }, () => cached('hot', 60, loader)));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(new Set(results)).toEqual(new Set(['value']));
  });

  test('a failing loader rejects for everyone waiting, and the next call retries', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('ok');
    const [a, b] = await Promise.allSettled([cached('err', 60, loader), cached('err', 60, loader)]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    expect(await cached('err', 60, loader)).toBe('ok');
  });

  test.each([['uninitialized'], ['down'], ['erroring']])(
    'falls back to running the loader when Redis is %s (never breaks the request)',
    async (state) => {
      console.log(`[TEST] cached › Redis ${state} → loader still serves the request`);
      redisState = state;
      const loader = jest.fn().mockResolvedValue('from-db');
      expect(await cached('k', 60, loader)).toBe('from-db');
      expect(loader).toHaveBeenCalledTimes(1);
    }
  );

  test('does not even attempt a Redis command while the client is not ready (no hanging on the offline queue)', async () => {
    redisState = 'down';
    await cached('k', 60, async () => 'v');
    expect(fakeRedis.get).not.toHaveBeenCalled();
    expect(fakeRedis.setEx).not.toHaveBeenCalled();
  });

  test('cacheGet/cacheSet/cacheDel round-trip and delete accepts arrays', async () => {
    await cacheSet('x', { n: 1 }, 30);
    await cacheSet('y', { n: 2 }, 30);
    expect(await cacheGet('x')).toEqual({ n: 1 });
    await cacheDel(['x', 'y']);
    expect(await cacheGet('x')).toBeNull();
    expect(await cacheGet('y')).toBeNull();
  });

  test('cacheDel with nothing to delete does not call Redis', async () => {
    await cacheDel();
    await cacheDel([]);
    await cacheDel(undefined, null);
    expect(fakeRedis.del).not.toHaveBeenCalled();
  });

  test('version counters invalidate a whole key family with one INCR', async () => {
    console.log('[TEST] versions › bump changes the key namespace');
    expect(await getCacheVersion('feed')).toBe('0');
    const keyBefore = `feed:v${await getCacheVersion('feed')}:page1`;
    await bumpCacheVersion('feed');
    const keyAfter = `feed:v${await getCacheVersion('feed')}:page1`;
    console.log(`[TEST RESULT] ${keyBefore} → ${keyAfter}`);
    expect(keyBefore).not.toBe(keyAfter);
    expect(await getCacheVersion('feed')).toBe('1');
  });

  test('versions degrade to a constant "0" when Redis is unavailable', async () => {
    redisState = 'uninitialized';
    expect(await getCacheVersion('feed')).toBe('0');
    await expect(bumpCacheVersion('feed')).resolves.toBeUndefined();
  });
});
