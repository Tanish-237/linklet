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

// One heartbeat a minute per open socket (each is a few Redis commands, which
// Upstash bills per command); an entry outlives two missed heartbeats.
export const PRESENCE_TTL_MS = 150_000;
export const PRESENCE_HEARTBEAT_MS = 60_000;

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
 * presence change, and periodically as a heartbeat. No-op without Redis.
 */
export const trackSocket = async (socket) => {
  const redis = readyRedis();
  const uid = socket?.data?.userId;
  if (!redis || !uid) return;
  const member = { score: Date.now() + PRESENCE_TTL_MS, value: socket.id };
  try {
    const tx = redis.multi().zAdd(allKey(uid), member).pExpire(allKey(uid), PRESENCE_TTL_MS);
    if (socket.data.away) {
      tx.zRem(activeKey(uid), socket.id);
    } else {
      tx.zAdd(activeKey(uid), member).pExpire(activeKey(uid), PRESENCE_TTL_MS);
    }
    await tx.exec();
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
    await redis.multi().zRem(allKey(uid), socket.id).zRem(activeKey(uid), socket.id).exec();
  } catch (err) {
    logger.warn(`Presence: could not remove socket ${socket.id}: ${err.message}`);
  }
};

/** Live-socket count for each user id, read from Redis in one round trip. */
const redisCounts = async (redis, userIds, activeOnly) => {
  const now = Date.now();
  const keyFor = activeOnly ? activeKey : allKey;
  const tx = redis.multi();
  userIds.forEach((uid) => tx.zCount(keyFor(uid), now, "+inf"));
  return (await tx.exec()).map(Number);
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
