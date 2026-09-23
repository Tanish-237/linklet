import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "./models/users.js";
import { getRedisClient } from "./src/utils/redis.js";
import { isTokenBlacklisted } from "./src/utils/blacklist.js";
import logger from "./src/utils/logger.js";

import { corsOriginHandler } from "./src/utils/cors.js";
import * as chatRepo from "./src/repositories/chat.repository.js";
import { markAsRead as markChatAsRead } from "./src/services/chat.service.js";
import { getContactIds, filterOnlineUsers, countUserSockets } from "./src/utils/presence.js";

export let io;

/**
 * Extract the JWT access token from a socket handshake (auth payload, Authorization
 * header, or the httpOnly cookie), matching the precedence used by the REST middleware.
 */
const SOCKET_EVENTS_PER_SECOND = 10;
const SOCKET_EVENT_BURST = 40;

const extractHandshakeToken = (socket) => {
  let token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token && socket.handshake.headers?.cookie) {
    const rawCookies = socket.handshake.headers.cookie.split(";");
    for (const cookie of rawCookies) {
      const [name, val] = cookie.trim().split("=");
      if (name === "accesstoken") {
        token = decodeURIComponent(val);
        break;
      }
    }
  }
  return token;
};

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOriginHandler,
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  let redisClient = null;
  try {
    redisClient = getRedisClient();
  } catch (error) {
    logger.warn("Redis client not initialized; Socket.io running with default in-memory adapter");
  }

  if (redisClient) {
    const pubClient = redisClient;
    const subClient = pubClient.duplicate();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis Adapter configured for horizontal scaling");
  }

  // Handshake authentication middleware.
  // Every socket connection to this server requires chat access, so we reject the
  // handshake outright instead of admitting an "unauthenticated" socket that later
  // handlers must remember to special-case. Legitimate clients (SocketContext.jsx)
  // only ever connect once a signed-in user's access token is available.
  io.use(async (socket, next) => {
    try {
      const token = extractHandshakeToken(socket);

      if (!token || !process.env.ACCESS_TOKEN_SECRET) {
        return next(new Error("Authentication required"));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (jwtErr) {
        return next(new Error("Invalid or expired token"));
      }

      // isTokenBlacklisted() fails open (returns false) both when Redis is
      // unreachable and when it's simply not configured — same trade-off the
      // REST `isLoggedIn`/`optionalAuth` middlewares already make. This means
      // a logged-out token can still open a socket during a Redis outage; we
      // accept that here for consistency with the REST API rather than making
      // sockets fail closed while REST endpoints stay available.
      const blacklisted = await isTokenBlacklisted(token);
      if (blacklisted) {
        return next(new Error("Session expired"));
      }

      const uid = (decoded?.id || decoded?._id)?.toString();
      if (!uid) {
        return next(new Error("Invalid token payload"));
      }

      socket.user = decoded;
      socket.userId = uid;
      // `socket.data` is what fetchSockets() exposes for remote (other-instance)
      // sockets, so presence lookups can map a socket back to its user.
      socket.data = socket.data || {};
      socket.data.userId = uid;
      socket.authenticated = true;
      return next();
    } catch (err) {
      logger.error(`Socket auth middleware error: ${err.message}`);
      return next(new Error("Authentication failed"));
    }
  });

  // Helper to get room state from Redis
  const getRoomState = async (roomId) => {
    if (!redisClient) return null;
    const data = await redisClient.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  };

  // Helper to save room state to Redis
  const setRoomState = async (roomId, state) => {
    if (!redisClient) return;
    await redisClient.setEx(`room:${roomId}`, 86400, JSON.stringify(state));
  };

  io.on("connection", (socket) => {
    logger.info(`A user connected: ${socket.id} (user ${socket.userId})`);

    // Per-socket flood guard (token bucket): normal use — typing pings every 2s,
    // read receipts, game moves — stays far below this; a script spamming events
    // just has the excess silently dropped instead of hitting Mongo/Redis.
    let tokens = SOCKET_EVENT_BURST;
    let lastRefill = Date.now();
    socket.use((packet, next) => {
      const now = Date.now();
      tokens = Math.min(SOCKET_EVENT_BURST, tokens + ((now - lastRefill) / 1000) * SOCKET_EVENTS_PER_SECOND);
      lastRefill = now;
      if (tokens < 1) return; // drop the event
      tokens -= 1;
      next();
    });

    // Setup user session. The socket is already authenticated at this point (the
    // handshake middleware rejects unauthenticated connections), so the identity
    // used to join rooms and populate presence always comes from the verified JWT,
    // never from client-supplied data.
    socket.on("setup", async (userData) => {
      const requestedId = userData?._id?.toString();
      if (requestedId && requestedId !== socket.userId) {
        logger.warn(`Security alert: Socket ${socket.id} (user ${socket.userId}) attempted unauthorized registration as ${requestedId}`);
        return socket.emit("error", { message: "Unauthorized socket registration" });
      }

      const uid = socket.userId;
      socket.join(uid);
      socket.data = socket.data || {};
      socket.data.presenceRegistered = true;

      // Presence is scoped to the people who share a chat with this user — not
      // the whole campus. (Broadcasting every connect/disconnect to every
      // connected socket meant N users generating N² emits.)
      const contactIds = await getContactIds(uid);

      // 1. Tell ONLY the connecting socket which of its contacts are online.
      //    (The list includes the user themself, as it always has.)
      const onlineContacts = await filterOnlineUsers(io, contactIds, { activeOnly: true });
      socket.emit("user online status", { onlineUsers: [...onlineContacts, uid] });

      // 2. Announce "came online" to contacts — but only for this user's FIRST
      //    active socket. A second tab/device (or another server instance) must
      //    not re-announce someone who is already online, and a socket opened
      //    in a background tab doesn't make them online at all.
      if (socket.data.away) return;
      const activeSockets = await countUserSockets(io, uid, { activeOnly: true });
      const isFirstSocket = activeSockets === null || activeSockets <= 1;
      if (isFirstSocket && contactIds.length > 0) {
        // Guard on length: an emit with an empty room list would reach EVERYONE.
        socket.to(contactIds).emit("user_connected", { userId: uid });
      }

      logger.info(`User ${uid} registered on socket ${socket.id}`);
    });

    // Foreground/background ("online" vs merely connected). A client reports
    // when its tab/app goes to the background and comes back; the user shows
    // online while ANY of their sockets is active, and "last seen" is the
    // moment the last one went away.
    socket.on("presence", async ({ active } = {}) => {
      const away = !active;
      if (Boolean(socket.data.away) === away) return;
      socket.data.away = away;
      if (!socket.data.presenceRegistered) return; // setup announces it

      const uid = socket.userId;
      const otherActive = await countUserSockets(io, uid, { activeOnly: true });
      // Now active: announce only if this is the user's only active socket.
      // Now away: go offline only if no other socket is still active.
      if (otherActive === null || otherActive > (away ? 0 : 1)) return;
      const contactIds = await getContactIds(uid);
      if (contactIds.length === 0) return;
      if (away) {
        const lastSeen = new Date();
        Promise.resolve(User.findByIdAndUpdate(uid, { lastSeen })).catch((err) =>
          logger.warn(`Failed to update lastSeen for user ${uid}: ${err.message}`)
        );
        io.to(contactIds).emit("user_disconnected", { userId: uid, lastSeen });
      } else {
        io.to(contactIds).emit("user_connected", { userId: uid });
      }
    });

    // Chat room events. Membership is always re-verified server-side; the client
    // cannot join a room for a chat it does not belong to.
    socket.on("join chat", async (room) => {
      if (!room) return;
      try {
        const isMember = await chatRepo.isParticipant(room, socket.userId);
        if (!isMember) {
          logger.warn(`User ${socket.userId} unauthorized to join chat room: ${room}`);
          return socket.emit("error", { message: "Unauthorized to join this chat room" });
        }
      } catch (err) {
        logger.error(`Error verifying chat participant for room ${room}: ${err.message}`);
        return;
      }
      socket.join(room);
      logger.info(`User ${socket.id} joined room: ${room}`);
    });

    socket.on("leave chat", (room) => {
      if (!room) return;
      socket.leave(room);
      logger.info(`User ${socket.id} left room: ${room}`);
    });

    // Ephemeral, non-persisted typing signals. The sender must have joined the
    // chat's room (membership is verified in "join chat" above), and a direct
    // recipient is only notified if they are actually in that chat — otherwise
    // any user could push typing indicators at arbitrary chats or people.
    // Only known fields are relayed, with identity taken from the socket.
    const verifiedRecipients = new Map();
    const isRecipientInChat = async (chatId, recipientId) => {
      const key = `${chatId}:${recipientId}`;
      if (!verifiedRecipients.has(key)) {
        if (verifiedRecipients.size > 200) verifiedRecipients.clear();
        verifiedRecipients.set(key, await chatRepo.isParticipant(chatId, recipientId).catch(() => false));
      }
      return verifiedRecipients.get(key);
    };
    let cachedUsername;
    const getUsername = async () => {
      if (cachedUsername === undefined) {
        const user = await User.findById(socket.userId).select("username").lean().catch(() => null);
        cachedUsername = user?.username || null;
      }
      return cachedUsername;
    };
    const relayTyping = (event) => async (data) => {
      const chatId = data?.chatId?.toString();
      if (!chatId || !socket.rooms.has(chatId)) return;
      const payload = { chatId, userId: socket.userId, username: await getUsername() };
      socket.to(chatId).emit(event, payload);
      const recipientId = data.recipientId?.toString();
      if (recipientId && recipientId !== socket.userId && (await isRecipientInChat(chatId, recipientId))) {
        socket.to(recipientId).emit(event, payload);
      }
    };
    socket.on("typing", relayTyping("typing"));
    socket.on("stop typing", relayTyping("stop typing"));

    // Sent by a client that has a chat open and visible when messages arrive.
    // Persisted (readBy + the user's read cursor), not just relayed — otherwise
    // anything read while the chat was open came back as unread after a reload.
    socket.on("read receipt", async ({ chatId } = {}) => {
      if (!chatId || !socket.userId) return;
      try {
        await markChatAsRead(chatId, socket.userId);
      } catch (err) {
        return; // not a member / chat gone
      }
      broadcastChatRead(chatId, socket.userId);
    });

    // Room / Game / Video events (casual games & watch-together — no persisted or
    // sensitive data changes hands here, only ephemeral room state).
    socket.on("create-room", async () => {
      try {
        const roomId = Math.random().toString(36).substring(2, 8);
        const roomData = {
          players: [socket.id],
          gameState: null,
          videoUrl: null,
          videoState: { isPlaying: false, currentTime: 0 },
        };

        await setRoomState(roomId, roomData);
        socket.join(roomId);
        socket.emit("room-created", roomId);
        socket.emit("player-joined", roomData.players);
      } catch (error) {
        logger.error("Error in create-room handler:", error);
        socket.emit("error", { message: "Failed to create room" });
      }
    });

    socket.on("join-room", async (roomId) => {
      const room = await getRoomState(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (!room.players.includes(socket.id)) {
        room.players.push(socket.id);
        await setRoomState(roomId, room);
      }

      socket.join(roomId);
      io.to(roomId).emit("player-joined", room.players);

      if (room.gameState) socket.emit("game-state-update", room.gameState);
      if (room.videoUrl) socket.emit("video-url-change", room.videoUrl);
      if (room.videoState) socket.emit("video-state-update", room.videoState);
    });

    socket.on("game-move", async ({ roomId, move }) => {
      if (!roomId) return;
      try {
        const room = await getRoomState(roomId);
        if (!room || !room.players.includes(socket.id)) return;
        room.gameState = move;
        await setRoomState(roomId, room);
        socket.to(roomId).emit("game-move", { roomId, move });
      } catch (err) {
        logger.error(`Error in game-move handler: ${err.message}`);
      }
    });

    socket.on("video-url-change", async ({ roomId, url }) => {
      if (!roomId) return;
      try {
        const room = await getRoomState(roomId);
        if (!room || !room.players.includes(socket.id)) return;
        room.videoUrl = url;
        room.videoState = { isPlaying: false, currentTime: 0 };
        await setRoomState(roomId, room);
        socket.to(roomId).emit("video-url-change", url);
      } catch (err) {
        logger.error(`Error in video-url-change handler: ${err.message}`);
      }
    });

    socket.on("video-state-update", async ({ roomId, videoState }) => {
      if (!roomId || !videoState) return;
      try {
        const room = await getRoomState(roomId);
        if (!room || !room.players.includes(socket.id)) return;
        room.videoState = videoState;
        await setRoomState(roomId, room);
        socket.to(roomId).emit("video-state-update", videoState);
      } catch (err) {
        logger.error(`Error in video-state-update handler: ${err.message}`);
      }
    });

    socket.on("disconnect", async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      if (!socket.userId || !socket.data?.presenceRegistered) return;

      const uid = socket.userId.toString();

      // Closing ONE tab must not mark the user offline while another tab, device
      // or server instance still has a live socket for them. By the time this
      // handler runs, this socket has already left its rooms, so any socket
      // still in the user's room belongs to a different connection.
      // A socket that was already in the background announced "offline" (and
      // set lastSeen) when it went away; closing it now changes nothing.
      if (socket.data.away) return;
      const remaining = await countUserSockets(io, uid, { activeOnly: true });
      if (remaining !== null && remaining > 0) return;

      const lastSeen = new Date();

      try {
        if (mongoose.connection?.readyState === 1 && User && typeof User.findByIdAndUpdate === "function") {
          User.findByIdAndUpdate(uid, { lastSeen }, { new: false }).catch((err) => {
            logger.warn(`Failed to update lastSeen for user ${uid}: ${err.message}`);
          });
        }
      } catch (err) {
        // ignore error in tests or uninitialized mongo
      }

      const contactIds = await getContactIds(uid);
      if (contactIds.length > 0) {
        io.to(contactIds).emit("user_disconnected", { userId: uid, lastSeen });
      }
    });
  });
};

/**
 * Re-send the full "who's online" list to the given users, computed against their
 * CURRENT contacts. Presence is scoped to people you share a chat with, so when a
 * new direct chat or group appears, its participants would otherwise not learn
 * each other's status until someone's next connect/disconnect event.
 * Best-effort and bounded: it runs only when chats are created or extended.
 */
export const refreshPresence = async (userIds) => {
  if (!io || !Array.isArray(userIds)) return;
  const unique = [
    ...new Set(userIds.map((id) => (id?._id || id)?.toString()).filter(Boolean)),
  ].slice(0, 50);

  await Promise.all(
    unique.map(async (uid) => {
      const contactIds = await getContactIds(uid);
      const online = await filterOnlineUsers(io, contactIds, { activeOnly: true });
      io.to(uid).emit("user online status", { onlineUsers: [...online, uid] });
    })
  );
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

/**
 * Server-authoritative chat event broadcasters.
 *
 * These are the ONLY place chat mutation events are emitted. They are called from
 * chat.controller.js after a mutation has already been validated and persisted by
 * chat.service.js — the client never triggers these events directly, so there is no
 * way to forge a message, deletion, reaction, pin, or group change for a chat the
 * caller isn't authorized to touch.
 */
/**
 * Tell the chat room a user has read it (blue ticks for the senders), and the
 * user's own personal room so their other tabs/devices clear the unread badge.
 */
export const broadcastChatRead = (chatId, userId) => {
  if (!io || !chatId || !userId) return;
  const payload = { chatId: chatId.toString(), userId: userId.toString() };
  io.to(payload.chatId).emit("read receipt", payload);
  io.to(payload.userId).emit("chat read", payload);
};

/**
 * Push a chat's new sidebar preview (after its latest message was deleted) to
 * every participant's personal room.
 */
export const notifyChatPreview = (chatId, preview) => {
  if (!io || !chatId || !preview) return;
  const rooms = (preview.participants || [])
    .map((p) => (p?._id || p)?.toString())
    .filter(Boolean);
  if (rooms.length === 0) return;
  io.to(rooms).emit("chat preview updated", {
    chatId: chatId.toString(),
    lastMessage: preview.lastMessage || null,
  });
};

export const notifyNewMessage = async (message) => {
  if (!io || !message) return;
  const chatId = (message.chat?._id || message.chat)?.toString();
  if (!chatId) return;

  // One emit to the chat room plus every participant's personal room.
  // Socket.io de-duplicates across the rooms of a single emit, so a recipient
  // who has the chat open (in both rooms) still gets the message exactly once;
  // separate emits delivered it twice.
  let emitted = false;
  try {
    let participants = message.chat?.participants;
    if (!Array.isArray(participants) || participants.length === 0) {
      const chatDoc = await chatRepo.findChatById(chatId);
      participants = chatDoc?.participants || [];
    }

    const senderId = (message.sender?._id || message.sender)?.toString();
    const recipientIds = participants
      .map((p) => (p._id || p)?.toString())
      .filter((pId) => pId && pId !== senderId);

    io.to([chatId, ...recipientIds]).emit("message received", message);
    emitted = true;

    // "Delivered" means at least one recipient has a live socket — on ANY server
    // instance (a per-process map would report users on another instance offline).
    const deliveredToAny = (await filterOnlineUsers(io, recipientIds)).length > 0;

    if (deliveredToAny && senderId) {
      io.to(senderId).emit("message delivered", {
        chatId,
        messageId: message._id,
      });
    }
  } catch (err) {
    logger.error(`notifyNewMessage participant fan-out error: ${err.message}`);
    // Participant lookup failed — still reach everyone who has the chat open.
    if (!emitted) io.to(chatId).emit("message received", message);
  }
};

export const notifyMessageUpdated = (message) => {
  if (!io || !message) return;
  const chatId = (message.chat?._id || message.chat)?.toString();
  if (!chatId) return;
  io.to(chatId).emit("message updated", message);
};

export const notifyMessagesDeleted = (chatId, messageIds) => {
  if (!io || !chatId) return;
  const ids = (Array.isArray(messageIds) ? messageIds : [messageIds]).filter(Boolean);
  if (ids.length === 0) return;
  const chatIdStr = chatId.toString();
  if (ids.length === 1) {
    io.to(chatIdStr).emit("message deleted", { chatId: chatIdStr, messageId: ids[0].toString() });
  } else {
    io.to(chatIdStr).emit("messages_bulk_deleted", { chatId: chatIdStr, messageIds: ids.map((id) => id.toString()) });
  }
};

export const notifyReaction = (chatId, messageId, reactions) => {
  if (!io || !chatId || !messageId) return;
  io.to(chatId.toString()).emit("message reaction", { chatId, messageId, reactions });
};

export const notifyPinChange = (chatId, pinnedMessages, pinned) => {
  if (!io || !chatId) return;
  io.to(chatId.toString()).emit(pinned ? "message pinned" : "message unpinned", { chatId, pinnedMessages });
};

/**
 * Broadcast a group chat change to every participant, whether or not they currently
 * have the chat room joined (e.g. a user just added to the group).
 */
export const notifyGroupUpdated = (chat) => {
  if (!io || !chat?._id) return;
  const chatId = chat._id.toString();
  io.to(chatId).emit("group updated", chat);
  (chat.participants || []).forEach((p) => {
    const pId = (p._id || p)?.toString();
    if (pId) io.to(pId).emit("group updated", chat);
  });
};

/**
 * Notify a user who was just removed from (or left) a group so their client can
 * drop it from the sidebar even though they're no longer in chat.participants.
 */
export const notifyRemovedFromGroup = (userId, chatId) => {
  if (!io || !userId || !chatId) return;
  io.to(userId.toString()).emit("removed from group", { chatId: chatId.toString() });
};
