import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Architecture Imports
import { connectDb } from "./utils/db.js";
import { connectRedis } from "./src/utils/redis.js";
import logger from "./src/utils/logger.js";
import apiRoutes from "./src/routes/index.js";
import { initializeSocket } from "./socket.js";

const app = express();

// Security Middlewares
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later"
});
app.use("/api", limiter); // Apply rate limiting to all /api routes

// Standard Middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Static Files
const uploadDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use(express.static("public"));

// Central API Router
app.use("/api/v1", apiRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "API Route Not Found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Server Initialization
const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

// Boot sequence
const bootServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectDb();
    logger.info("MongoDB connected successfully");

    // 2. Connect Redis
    await connectRedis();

    // 3. Initialize Socket.io (Requires Redis to be connected first!)
    await initializeSocket(server);

    // 4. Start HTTP Server
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

bootServer();
