import logger from "./logger.js";
import * as chatRepo from "../repositories/chat.repository.js";

/**
 * Presence helpers ("who is online") for the Socket.IO layer.
 *
 * Every authenticated socket joins a room named after its user id, so "is user X
 * online?" is simply "does room X have any socket?". `io.in(room).fetchSockets()`
 * answers that across ALL server instances when the Redis adapter is active
 * (and just locally otherwise) — which means presence stays correct with one
 * Render instance or five, with no extra state to keep in sync and nothing that
 * can go stale if an instance crashes (its sockets vanish with it).
 *
 * Remote sockets returned by fetchSockets() only expose `id`, `rooms`,
 * `handshake` and `data`, so the owner's user id is read from `socket.data.userId`
 * (set by the handshake middleware in socket.js).
 */

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
    const sockets = await io.in(userIds).fetchSockets();
    const counted = activeOnly ? sockets.filter(isActive) : sockets;
    return [...new Set(counted.map((s) => s.data?.userId).filter(Boolean))];
  } catch (err) {
    // A slow/unreachable peer instance must not break connecting or messaging.
    logger.warn(`Presence: online lookup failed: ${err.message}`);
    return [];
  }
};

/** Number of live sockets (tabs/devices, on any instance) a user currently has. */
export const countUserSockets = async (io, userId, { activeOnly = false } = {}) => {
  try {
    const sockets = await io.in(userId.toString()).fetchSockets();
    return (activeOnly ? sockets.filter(isActive) : sockets).length;
  } catch (err) {
    logger.warn(`Presence: socket count failed for ${userId}: ${err.message}`);
    return null; // unknown — callers decide the safe default
  }
};
