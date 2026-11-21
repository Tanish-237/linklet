import { jest } from '@jest/globals';

/**
 * The Redis-backed presence registry (production path). The existing presence
 * integration test runs without Redis and covers the local fetchSockets()
 * fallback; this one covers trackSocket/untrackSocket and the counts read from
 * the registry, including expiry of sockets whose heartbeat stopped.
 */

// Minimal in-memory stand-in for the node-redis sorted-set commands used.
const zsets = new Map();
const zset = (key) => {
  if (!zsets.has(key)) zsets.set(key, new Map());
  return zsets.get(key);
};
const commands = {
  zAdd: (key, { score, value }) => zset(key).set(value, score),
  zRem: (key, value) => zset(key).delete(value),
  pExpire: () => 1,
  zCount: (key, min) => [...zset(key).values()].filter((s) => s >= min).length,
};
const fakeRedis = {
  isReady: true,
  ...Object.fromEntries(Object.entries(commands).map(([name, fn]) => [name, async (...args) => fn(...args)])),
  multi() {
    const queued = [];
    const tx = {
      exec: async () => queued.map((fn) => fn()),
    };
    for (const [name, fn] of Object.entries(commands)) {
      tx[name] = (...args) => {
        queued.push(() => fn(...args));
        return tx;
      };
    }
    return tx;
  },
};

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: () => fakeRedis,
}));
jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  findContactIds: jest.fn(async () => []),
}));

const presence = await import('../src/utils/presence.js');
const { trackSocket, untrackSocket, filterOnlineUsers, countUserSockets, PRESENCE_TTL_MS } = presence;

// fetchSockets must never be reached while Redis is available.
const io = {
  in: () => ({
    fetchSockets: () => {
      throw new Error('fetchSockets should not be used when Redis is ready');
    },
  }),
};
const sock = (id, userId, away = false) => ({ id, data: { userId, away } });

beforeEach(() => zsets.clear());
afterEach(() => jest.useRealTimers());

describe('Redis presence registry', () => {
  it('counts a tracked socket as online and active', async () => {
    await trackSocket(sock('s1', 'alice'));
    expect(await countUserSockets(io, 'alice')).toBe(1);
    expect(await countUserSockets(io, 'alice', { activeOnly: true })).toBe(1);
    expect(await filterOnlineUsers(io, ['alice', 'bob'], { activeOnly: true })).toEqual(['alice']);
  });

  it('a background socket counts for delivery but not for "online"', async () => {
    const s = sock('s1', 'alice');
    await trackSocket(s);
    s.data.away = true;
    await trackSocket(s);
    expect(await filterOnlineUsers(io, ['alice'])).toEqual(['alice']);
    expect(await filterOnlineUsers(io, ['alice'], { activeOnly: true })).toEqual([]);
  });

  it('counts every tab/device separately and removes them on untrack', async () => {
    const a = sock('s1', 'alice');
    const b = sock('s2', 'alice');
    await trackSocket(a);
    await trackSocket(b);
    expect(await countUserSockets(io, 'alice')).toBe(2);
    await untrackSocket(a);
    expect(await countUserSockets(io, 'alice', { activeOnly: true })).toBe(1);
    await untrackSocket(b);
    expect(await countUserSockets(io, 'alice')).toBe(0);
  });

  it('treats a socket whose heartbeat stopped as offline after the TTL', async () => {
    jest.useFakeTimers({ now: Date.now() });
    await trackSocket(sock('s1', 'alice'));
    jest.setSystemTime(Date.now() + PRESENCE_TTL_MS + 1);
    expect(await filterOnlineUsers(io, ['alice'])).toEqual([]);
  });

  it('dedupes ids and accepts ObjectId-like values', async () => {
    await trackSocket(sock('s1', 'alice'));
    const objectIdLike = { toString: () => 'alice' };
    expect(await filterOnlineUsers(io, [objectIdLike, 'alice'])).toEqual(['alice']);
  });

  it('a heartbeat costs at most two commands (Upstash free plan budget)', async () => {
    const calls = [];
    const spies = ['zAdd', 'zRem', 'pExpire', 'zCount'].map((name) => {
      const original = fakeRedis[name];
      fakeRedis[name] = (...args) => { calls.push(name); return original(...args); };
      return () => { fakeRedis[name] = original; };
    });
    await trackSocket(sock('s1', 'alice'), { heartbeat: true });
    spies.forEach((restore) => restore());
    expect(calls).toEqual(['zAdd', 'zAdd']);
  });
});
