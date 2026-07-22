import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "./src/utils/redis.js";
import logger from "./src/utils/logger.js";

export let io;

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

  // Helper to save room state to Redis (expires in 24 hours to prevent memory leaks)
  const setRoomState = async (roomId, state) => {
    if (!redisClient) return;
    await redisClient.setEx(`room:${roomId}`, 86400, JSON.stringify(state));
  };

  const deleteRoomState = async (roomId) => {
    if (!redisClient) return;
    await redisClient.del(`room:${roomId}`);
  };

  io.on("connection", (socket) => {
    logger.info(`A user connected: ${socket.id}`);

    // Chat events
    socket.on("join chat", (room) => {
      socket.join(room);
      logger.info(`User ${socket.id} joined room: ${room}`);
    });

    socket.on("new message", (newMessage) => {
      if (!newMessage || !newMessage.chat) return;
      io.to(newMessage.chat._id).emit("message received", newMessage);
    });

    socket.on("typing", (data) => {
      socket.to(data.chatId).emit("typing", { chatId: data.chatId, username: data.username });
    });

    socket.on("stop typing", (data) => {
      socket.to(data.chatId).emit("stop typing", { chatId: data.chatId, username: data.username });
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

    socket.on("game-move", async ({ roomId, move }) => {
      const room = await getRoomState(roomId);
      if (room) {
        room.gameState = move;
        await setRoomState(roomId, room);
        io.to(roomId).emit("game-state-update", move);
      }
    });

    socket.on("video-url-change", async ({ roomId, url }) => {
      const room = await getRoomState(roomId);
      if (room) {
        room.videoUrl = url;
        await setRoomState(roomId, room);
        io.to(roomId).emit("video-url-change", url);
      }
    });

    socket.on("video-state-change", async ({ roomId, state }) => {
      const room = await getRoomState(roomId);
      if (room) {
        room.videoState = state;
        await setRoomState(roomId, room);
        io.to(roomId).emit("video-state-update", state);
      }
    });

    socket.on("disconnect", async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      // In a Redis scaled env, scanning keys on disconnect is slow. 
      // Ideally, players should leave rooms explicitly or room state is managed via presence sets.
      // For now, we will let room data expire automatically (TTL) if everyone disconnects,
      // and we just broadcast the standard socket.io disconnect events.
    });
  });
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
