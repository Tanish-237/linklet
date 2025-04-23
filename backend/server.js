import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router as resourceRouter } from "./router/resource-routes.js";
import { router as questionRouter } from "./router/question-routes.js";
import { router as answerRouter } from "./router/answer-routes.js";
import { router as userRouter } from "./router/user-routes.js";
import { router as postRouter } from "./router/post-routes.js";
import { connectDb } from "./utils/db.js";
import { User } from "./models/users.js";
import { errorHandler } from "./utils/errorHandler.js";
import { initializeSocket } from "./socket.js";
import { chatRouter } from "./router/chat-routes.js";
import fs from "fs";
import path from "path";
import http from "http";
import { Server } from "socket.io";

const app = express();

// Create upload directories if they don't exist
const uploadDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Middleware for serving static files
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/", userRouter);
app.use("/", postRouter);
app.use("/", resourceRouter);
app.use("/", questionRouter);
app.use("/", answerRouter);
app.use("/", resourceRouter);
app.use("/api/questions", questionRouter);
app.use("/api/chat", chatRouter);

app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Connect to database and start server
connectDb()
  .then(() => {
    const server = app.listen(5000);

    server
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
          app.listen(PORT + 1).on("listening", () => {
            console.log(`Server is running on port ${PORT + 1}`);
            initializeSocket(server);
          });
        } else {
          console.error("Server error:", err);
        }
      })
      .on("listening", () => {
        const address = server.address();
        console.log(`Server is running on port ${address.port}`);
        initializeSocket(server);
      });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
  pingTimeout: 5000,
  pingInterval: 10000,
  transports: ["websocket"],
  allowEIO3: true,
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.emit("error", { message: "Socket error occurred" });
  });

  socket.on("create-room", () => {
    try {
      console.log("Create room request received from", socket.id);

      // Generate a unique room ID
      const roomId = Math.random().toString(36).substring(2, 8);
      console.log("Generated room ID:", roomId);

      // Create room data
      const roomData = {
        players: [socket.id],
        gameState: null,
        videoUrl: null,
        videoState: { isPlaying: false, currentTime: 0 },
      };

      // Store room data
      rooms.set(roomId, roomData);
      console.log("Room data stored:", roomData);

      // Join room
      socket.join(roomId);
      console.log("Socket joined room:", roomId);

      // Emit success
      console.log("Emitting room-created event to socket:", socket.id);
      socket.emit("room-created", roomId);

      // Emit initial player list
      socket.emit("player-joined", roomData.players);
    } catch (error) {
      console.error("Error in create-room handler:", error);
      socket.emit("error", {
        message: "Failed to create room: " + error.message,
      });
    }
  });

  // Add error handler for unhandled events
  socket.onAny((eventName, ...args) => {
    console.log("Received event:", eventName, "with args:", args);
  });

  socket.on("join-room", (roomId) => {
    console.log(
      "Join room request received for room:",
      roomId,
      "from socket:",
      socket.id
    );

    if (!rooms.has(roomId)) {
      console.error("Room not found:", roomId);
      socket.emit("error", { message: "Room not found" });
      return;
    }

    const room = rooms.get(roomId);
    console.log("Current room state:", room);

    // Add player to room if not already present
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      console.log("Added player to room. New players list:", room.players);
    }

    // Join socket room
    socket.join(roomId);
    console.log("Socket joined room:", roomId);

    // Send current room state to all players
    io.to(roomId).emit("player-joined", room.players);
    console.log("Emitted player-joined event to room:", roomId);

    // Send current game state to new player
    if (room.gameState) {
      socket.emit("game-state-update", room.gameState);
      console.log("Sent game state to new player:", room.gameState);
    }

    // Send current video state to new player
    if (room.videoUrl) {
      socket.emit("video-url-change", room.videoUrl);
      console.log("Sent video URL to new player:", room.videoUrl);
    }

    // Send current video state to new player
    if (room.videoState) {
      socket.emit("video-state-update", room.videoState);
      console.log("Sent video state to new player:", room.videoState);
    }
  });

  socket.on("game-move", ({ roomId, move }) => {
    console.log("Game move received for room:", roomId, "move:", move);

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.gameState = move;
      io.to(roomId).emit("game-state-update", move);
      console.log("Game state updated and broadcasted to room:", roomId);
    }
  });

  socket.on("video-url-change", ({ roomId, url }) => {
    console.log("Video URL change received for room:", roomId, "URL:", url);

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoUrl = url;
      io.to(roomId).emit("video-url-change", url);
      console.log("Video URL updated and broadcasted to room:", roomId);
    }
  });

  socket.on("video-state-change", ({ roomId, state }) => {
    console.log(
      "Video state change received for room:",
      roomId,
      "state:",
      state
    );

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoState = state;
      io.to(roomId).emit("video-state-update", state);
      console.log("Video state updated and broadcasted to room:", roomId);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", socket.id, "Reason:", reason);

    // Clean up rooms when players leave
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.indexOf(socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        console.log(
          "Removed player from room:",
          roomId,
          "New players list:",
          room.players
        );

        // Notify remaining players
        io.to(roomId).emit("player-joined", room.players);

        // Delete room if empty
        if (room.players.length === 0) {
          console.log("Deleting empty room:", roomId);
          rooms.delete(roomId);
        }
      }
    });
  });
});
