import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "./src/utils/redis.js";
import logger from "./src/utils/logger.js";

export let io;

// Track online users in memory (and Redis if available)
const onlineUsers = new Map(); // userId -> socketId

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
    pingTimeout: 5000,
    pingInterval: 10000,
    allowEIO3: true,
  });

  const redisClient = getRedisClient();
  if (redisClient) {
    const pubClient = redisClient;
    const subClient = pubClient.duplicate();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis Adapter configured for horizontal scaling");
  }

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
    logger.info(`A user connected: ${socket.id}`);

    // Setup user session
    socket.on("setup", (userData) => {
      if (userData && userData._id) {
        socket.userId = userData._id;
        socket.join(userData._id);
        onlineUsers.set(userData._id.toString(), socket.id);
        io.emit("user online status", {
          onlineUsers: Array.from(onlineUsers.keys()),
        });
        logger.info(`User ${userData._id} registered on socket ${socket.id}`);
      }
    });

    // Chat room events
    socket.on("join chat", (room) => {
      socket.join(room);
      logger.info(`User ${socket.id} joined room: ${room}`);
    });

    socket.on("leave chat", (room) => {
      socket.leave(room);
      logger.info(`User ${socket.id} left room: ${room}`);
    });

    socket.on("new message", (newMessage) => {
      if (!newMessage || !newMessage.chat) return;
      const chatId = typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;
      io.to(chatId).emit("message received", newMessage);
    });

    socket.on("message updated", (updatedMessage) => {
      if (!updatedMessage || !updatedMessage.chat) return;
      const chatId = typeof updatedMessage.chat === "object" ? updatedMessage.chat._id : updatedMessage.chat;
      io.to(chatId).emit("message updated", updatedMessage);
    });

    socket.on("message deleted", ({ chatId, messageId }) => {
      if (!chatId || !messageId) return;
      io.to(chatId).emit("message deleted", messageId);
    });

    socket.on("typing", (data) => {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("typing", data);
      }
    });

    socket.on("stop typing", (data) => {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("stop typing", data);
      }
    });

    socket.on("read receipt", ({ chatId, userId }) => {
      socket.to(chatId).emit("read receipt", { chatId, userId });
    });

    socket.on("group updated", (updatedChat) => {
      if (!updatedChat || !updatedChat._id) return;
      io.to(updatedChat._id).emit("group updated", updatedChat);
    });

    // Room / Game / Video events
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

    socket.on("disconnect", async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      if (socket.userId) {
        onlineUsers.delete(socket.userId.toString());
        io.emit("user online status", {
          onlineUsers: Array.from(onlineUsers.keys()),
        });
      }
    });
  });
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
