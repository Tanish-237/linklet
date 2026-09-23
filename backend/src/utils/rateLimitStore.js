import { MemoryStore } from "express-rate-limit";
import { getRedisClient } from "./redis.js";
import logger from "./logger.js";

/**
 * express-rate-limit store that keeps counters in Redis so every server
 * instance behind the load balancer shares one budget per client. The default
 * MemoryStore counts per process: with N instances a client effectively gets
 * N × max requests, and the OTP/login limits stop meaning anything.
 *
 * Limiters are constructed at import time, before Redis connects, so the
 * client is resolved lazily on each hit. Without Redis (local dev, tests) or
 * if a Redis call fails, it falls back to an in-process MemoryStore rather
 * than failing the request.
 */
class RedisRateLimitStore {
  constructor(prefix) {
    this.prefix = `rl:${prefix}:`;
    this.memory = new MemoryStore();
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  redis() {
    try {
      const client = getRedisClient();
      return client.isReady ? client : null;
    } catch {
      return null;
    }
  }

  async get(key) {
    const redis = this.redis();
    if (!redis) return this.memory.get(key);
    try {
      const [hits, ttl] = await redis.multi().get(this.prefix + key).pTTL(this.prefix + key).exec();
      if (hits === null) return undefined;
      return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(Number(ttl), 0)) };
    } catch (err) {
      logger.warn(`Rate limit store get failed, using memory: ${err.message}`);
      return this.memory.get(key);
    }
  }

  async increment(key) {
    const redis = this.redis();
    if (!redis) return this.memory.increment(key);
    const redisKey = this.prefix + key;
    try {
      // SET NX starts the window atomically with the first hit; later hits in
      // the same window only INCR, so the expiry is never pushed back.
      const [, hits, ttl] = await redis
        .multi()
        .addCommand(["SET", redisKey, "0", "PX", String(this.windowMs), "NX"])
        .incr(redisKey)
        .pTTL(redisKey)
        .exec();
      return {
        totalHits: Number(hits),
        resetTime: new Date(Date.now() + Math.max(Number(ttl), 0)),
      };
    } catch (err) {
      logger.warn(`Rate limit store increment failed, using memory: ${err.message}`);
      return this.memory.increment(key);
    }
  }

  async decrement(key) {
    const redis = this.redis();
    if (!redis) return this.memory.decrement(key);
    try {
      await redis.decr(this.prefix + key);
    } catch (err) {
      logger.warn(`Rate limit store decrement failed: ${err.message}`);
    }
  }

  async resetKey(key) {
    const redis = this.redis();
    if (!redis) return this.memory.resetKey(key);
    try {
      await redis.del(this.prefix + key);
    } catch (err) {
      logger.warn(`Rate limit store reset failed: ${err.message}`);
    }
  }

  shutdown() {
    this.memory.shutdown();
  }
}

// express-rate-limit requires a distinct store instance per limiter.
export const createRateLimitStore = (prefix) => new RedisRateLimitStore(prefix);
