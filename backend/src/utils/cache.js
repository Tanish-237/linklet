import { getRedisClient } from "./redis.js";
import logger from "./logger.js";

/**
 * Small Redis read-through cache helper used by the read-heavy endpoints
 * (posts feed, forum metadata, resource stats, timetable, branches, ...).
 *
 * Design rules:
 *  - Redis is an accelerator, never a dependency. If it isn't configured, isn't
 *    connected yet, or errors, every helper falls back to "no cache" and the
 *    caller's loader runs against MongoDB as if the cache didn't exist.
 *  - `node-redis` queues commands while disconnected, which would make a request
 *    hang until the reconnect. We skip Redis entirely unless the client is ready.
 *  - Concurrent cache misses for the same key share ONE loader call
 *    (single-flight), so a burst of students opening the feed at 9am hits Mongo
 *    once per instance instead of once per request.
 */

const inflight = new Map();

const getReadyRedis = () => {
  try {
    const client = getRedisClient();
    if (!client || client.isReady === false) return null;
    return client;
  } catch {
    return null;
  }
};

export const cacheGet = async (key) => {
  const redis = getReadyRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.debug?.(`Cache read error for ${key}: ${err.message}`);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds) => {
  const redis = getReadyRedis();
  if (!redis || value === undefined || value === null) return;
  try {
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.debug?.(`Cache write error for ${key}: ${err.message}`);
  }
};

export const cacheDel = async (...keys) => {
  const flat = keys.flat().filter(Boolean);
  const redis = getReadyRedis();
  if (!redis || flat.length === 0) return;
  try {
    await redis.del(flat);
  } catch (err) {
    logger.debug?.(`Cache delete error for ${flat.join(",")}: ${err.message}`);
  }
};

/**
 * Read-through: return the cached value for `key`, or run `loader`, cache its
 * result for `ttlSeconds` and return it. A null/undefined loader result is
 * returned but never cached (so "not found" isn't pinned for the whole TTL).
 */
export const cached = async (key, ttlSeconds, loader) => {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const value = await loader();
    await cacheSet(key, value, ttlSeconds);
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
};

/**
 * Version counters let one cheap INCR invalidate a whole family of cache keys
 * (e.g. every cached page of the posts feed) without SCAN/KEYS. Build the real
 * key as `${prefix}:v${version}:...` and bump the version on any write.
 */
export const getCacheVersion = async (name) => {
  const redis = getReadyRedis();
  if (!redis) return "0";
  try {
    return (await redis.get(`cachever:${name}`)) || "0";
  } catch {
    return "0";
  }
};

export const bumpCacheVersion = async (name) => {
  const redis = getReadyRedis();
  if (!redis) return;
  try {
    await redis.incr(`cachever:${name}`);
  } catch (err) {
    logger.debug?.(`Cache version bump error for ${name}: ${err.message}`);
  }
};
