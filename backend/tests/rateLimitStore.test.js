import { jest } from "@jest/globals";

// Minimal in-memory stand-in for the node-redis client: just the commands the
// store issues, with real SET NX / PX expiry semantics.
const data = new Map();
let redisReady = true;
let now = 1_000_000;

const alive = (key) => {
  const entry = data.get(key);
  if (entry && entry.expiresAt <= now) data.delete(key);
  return data.get(key);
};

const fakeRedis = {
  get isReady() {
    return redisReady;
  },
  multi() {
    const ops = [];
    const chain = {
      addCommand(args) {
        ops.push(() => {
          const [, key, value, , px, nx] = args;
          if (nx === "NX" && alive(key)) return null;
          data.set(key, { value: Number(value), expiresAt: now + Number(px) });
          return "OK";
        });
        return chain;
      },
      incr(key) {
        ops.push(() => {
          const entry = alive(key) || { value: 0, expiresAt: Infinity };
          entry.value += 1;
          data.set(key, entry);
          return entry.value;
        });
        return chain;
      },
      get(key) {
        ops.push(() => (alive(key) ? String(alive(key).value) : null));
        return chain;
      },
      pTTL(key) {
        ops.push(() => (alive(key) ? alive(key).expiresAt - now : -2));
        return chain;
      },
      exec: async () => ops.map((op) => op()),
    };
    return chain;
  },
  decr: async (key) => {
    const entry = alive(key);
    if (entry) entry.value -= 1;
  },
  del: async (key) => {
    data.delete(key);
  },
};

jest.unstable_mockModule("../src/utils/redis.js", () => ({
  getRedisClient: jest.fn(() => fakeRedis),
}));

const { createRateLimitStore } = await import("../src/utils/rateLimitStore.js");

const makeStore = (prefix = "test") => {
  const store = createRateLimitStore(prefix);
  store.init({ windowMs: 60_000 });
  return store;
};

describe("Redis rate-limit store", () => {
  beforeEach(() => {
    data.clear();
    redisReady = true;
    now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("counts hits in Redis under a per-limiter prefix", async () => {
    const store = makeStore("login");
    expect((await store.increment("1.2.3.4")).totalHits).toBe(1);
    expect((await store.increment("1.2.3.4")).totalHits).toBe(2);
    expect(data.get("rl:login:1.2.3.4").value).toBe(2);
  });

  test("shares one budget between store instances with the same prefix (i.e. across servers)", async () => {
    const serverA = makeStore("otp");
    const serverB = makeStore("otp");
    await serverA.increment("ip");
    const res = await serverB.increment("ip");
    expect(res.totalHits).toBe(2);
  });

  test("later hits do not push the window's expiry back", async () => {
    const store = makeStore();
    const first = await store.increment("ip");
    now += 30_000;
    const second = await store.increment("ip");
    expect(second.resetTime.getTime()).toBe(first.resetTime.getTime());
  });

  test("starts a fresh window once the previous one expires", async () => {
    const store = makeStore();
    await store.increment("ip");
    await store.increment("ip");
    now += 60_001;
    expect((await store.increment("ip")).totalHits).toBe(1);
  });

  test("decrement and resetKey adjust the shared counter", async () => {
    const store = makeStore();
    await store.increment("ip");
    await store.increment("ip");
    await store.decrement("ip");
    expect((await store.get("ip")).totalHits).toBe(1);
    await store.resetKey("ip");
    expect(await store.get("ip")).toBeUndefined();
  });

  test("falls back to in-process memory when Redis is not ready", async () => {
    redisReady = false;
    const store = makeStore();
    expect((await store.increment("ip")).totalHits).toBe(1);
    expect((await store.increment("ip")).totalHits).toBe(2);
    expect(data.size).toBe(0);
    store.shutdown();
  });
});
