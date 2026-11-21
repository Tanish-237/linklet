import logger from "./logger.js";
import { getRedisClient } from "./redis.js";
import * as chatRepo from "../repositories/chat.repository.js";

/**
 * Presence helpers ("who is online") for the Socket.IO layer.
 *
 * With Redis (production), every registered socket is recorded in two sorted
 * sets per user — all sockets, and foreground ("active") sockets — scored by an
 * expiry timestamp that the socket's heartbeat keeps pushing forward. "Is user X
 * online?" is then a ZCOUNT of unexpired members: one Redis round trip, with no
 * dependence on other server instances answering.
 *
 * Why not `io.in(room).fetchSockets()` across the Redis adapter: it waits for a
 * reply from EVERY subscribed instance. On Vercel, idle function instances are
 * suspended while still subscribed, so those lookups would stall until timeout.
 * An instance that dies without running its disconnect handlers (e.g. a
 * WebSocket closed at the function's maxDuration) simply stops heartbeating and
 * its entries expire after PRESENCE_TTL_MS.
 *
 * Without Redis (local dev, tests) there is only one process, so the local
 * `fetchSockets()` is exact and is used instead.
 */

// Upstash's free plan allows 500K commands a month, so presence is frugal: a
// heartbeat every 2 minutes per open socket is 1-2 ZADDs (no MULTI/EXEC, no
// EXPIRE), and an entry outlives two missed heartbeats.
export const PRESENCE_TTL_MS = 5 * 60_000;
export const PRESENCE_HEARTBEAT_MS = 2 * 60_000;
// The per-user keys themselves expire a day after the last full update, so
// users who stop visiting leave nothing behind. socket.js does a full update
// on setup, on every presence change and once an hour.
const KEY_TTL_MS = 24 * 60 * 60_000;

const allKey = (uid) => `presence:all:${uid}`;
const activeKey = (uid) => `presence:active:${uid}`;

const readyRedis = () => {
  try {
    const client = getRedisClient();
    return client.isReady ? client : null;
  } catch {
    return null;
  }
};

/** Ids of everyone this user shares a chat with (empty on any error). */
export const getContactIds = async (userId) => {
  try {
    return await chatRepo.findContactIds(userId);
  } catch (err) {
    logger.warn(`Presence: could not load contacts for ${userId}: ${err.message}`);
    return [];
  }
};

/**
 * Record (or refresh) a registered socket in the Redis presence registry,
 * reflecting its current foreground/background state. Call on setup, on every
 * presence change, and periodically. `{ heartbeat: true }` only pushes the
 * expiry forward (1-2 commands). No-op without Redis.
 * Commands are sent together (node-redis pipelines concurrent calls), not in
 * MULTI/EXEC, which would add two billed commands each time.
 */
export const trackSocket = async (socket, { heartbeat = false } = {}) => {
  const redis = readyRedis();
  const uid = socket?.data?.userId;
  if (!redis || !uid) return;
  const member = { score: Date.now() + PRESENCE_TTL_MS, value: socket.id };
  const active = !socket.data.away;
  try {
    const ops = [redis.zAdd(allKey(uid), member)];
    if (active) ops.push(redis.zAdd(activeKey(uid), member));
    if (!heartbeat) {
      if (!active) ops.push(redis.zRem(activeKey(uid), socket.id));
      ops.push(redis.pExpire(allKey(uid), KEY_TTL_MS), redis.pExpire(activeKey(uid), KEY_TTL_MS));
    }
    await Promise.all(ops);
  } catch (err) {
    logger.warn(`Presence: could not record socket ${socket.id}: ${err.message}`);
  }
};

/** Remove a socket from the presence registry. No-op without Redis. */
export const untrackSocket = async (socket) => {
  const redis = readyRedis();
  const uid = socket?.data?.userId;
  if (!redis || !uid) return;
  try {
    await Promise.all([redis.zRem(allKey(uid), socket.id), redis.zRem(activeKey(uid), socket.id)]);
  } catch (err) {
    logger.warn(`Presence: could not remove socket ${socket.id}: ${err.message}`);
  }
};

/** Live-socket count for each user id, read from Redis in one round trip. */
const redisCounts = async (redis, userIds, activeOnly) => {
  const now = Date.now();
  const keyFor = activeOnly ? activeKey : allKey;
  const counts = await Promise.all(userIds.map((uid) => redis.zCount(keyFor(uid), now, "+inf")));
  return counts.map(Number);
};

/**
 * A socket whose tab/app is in the background marks itself `data.away`
 * (the "presence" event in socket.js). It still receives messages — so it
 * counts for delivery ticks — but it doesn't make its user show as "online".
 */
const isActive = (s) => !s.data?.away;

/**
 * Which of `userIds` currently have at least one live socket, cluster-wide.
 * `activeOnly`: only count sockets in the foreground — what "online" in the
 * UI means. Delivery checks leave it off (a background tab still gets messages).
 */
export const filterOnlineUsers = async (io, userIds, { activeOnly = false } = {}) => {
  if (!io || !Array.isArray(userIds) || userIds.length === 0) return [];
  try {
    const ids = [...new Set(userIds.map((id) => id?.toString()).filter(Boolean))];
    const redis = readyRedis();
    if (redis) {
      const counts = await redisCounts(redis, ids, activeOnly);
      return ids.filter((_, i) => counts[i] > 0);
    }
    const sockets = await io.in(ids).fetchSockets();
    const counted = activeOnly ? sockets.filter(isActive) : sockets;
    return [...new Set(counted.map((s) => s.data?.userId).filter(Boolean))];
  } catch (err) {
    // A Redis hiccup must not break connecting or messaging.
    logger.warn(`Presence: online lookup failed: ${err.message}`);
    return [];
  }
};

/** Number of live sockets (tabs/devices, on any instance) a user currently has. */
export const countUserSockets = async (io, userId, { activeOnly = false } = {}) => {
  try {
    const uid = userId.toString();
    const redis = readyRedis();
    if (redis) {
      const [count] = await redisCounts(redis, [uid], activeOnly);
      return count;
    }
    const sockets = await io.in(uid).fetchSockets();
    return (activeOnly ? sockets.filter(isActive) : sockets).length;
  } catch (err) {
    logger.warn(`Presence: socket count failed for ${userId}: ${err.message}`);
    return null; // unknown — callers decide the safe default
  }
};
