import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

// Architecture Imports
import { connectDb } from "./src/utils/db.js";
import { connectRedis } from "./src/utils/redis.js";
import { hasUnmigratedPostComments } from "./src/migrations/postComments.migration.js";
import logger from "./src/utils/logger.js";
import apiRoutes from "./src/routes/index.js";
import { initializeSocket } from "./socket.js";
import { fileCleanupMiddleware, cleanupRequestFiles } from "./src/middlewares/fileCleanup.middleware.js";

const app = express();

// Trust reverse proxy (Render, Cloudflare) for accurate client IP and secure cookies
app.set("trust proxy", 1);

// Security & Optimization Middlewares
app.use(helmet());
app.use(compression());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // A hostel/campus Wi-Fi network puts hundreds of students behind a handful of
  // NAT IPs, so a low per-IP ceiling here risks rate-limiting the whole hostel
  // together. This is a broad abuse backstop; the truly sensitive endpoints
  // (OTP, login) have their own much tighter limiters in auth.routes.js.
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later"
});
app.use("/api", limiter); // Apply rate limiting to all /api routes

// Standard Middlewares

import { corsOriginHandler } from "./src/utils/cors.js";

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Static Files
const uploadDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use(express.static("public"));

// Auto cleanup temporary uploaded files on finish/close
app.use(fileCleanupMiddleware);

// Health Check Endpoint (Render zero-downtime deploys & uptime monitoring)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Central API Router
app.use("/api/v1", apiRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "API Route Not Found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  cleanupRequestFiles(req);
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(err.stack);
  } else {
    logger.warn(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method}`);
  }

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

    // Post comments moved out of the Post document into their own collection.
    // Until `npm run migrate:comments` has run, old comments are invisible —
    // make that impossible to miss in the logs instead of a silent data gap.
    try {
      const mongoose = (await import("mongoose")).default;
      if (await hasUnmigratedPostComments(mongoose.connection.db)) {
        logger.warn(
          "[MIGRATION REQUIRED] Some posts still have embedded comments. Run `npm run migrate:comments` (see CHANGELOG) — until then those comments will not appear."
        );
      }
    } catch (err) {
      logger.warn(`Could not check for un-migrated post comments: ${err.message}`);
    }

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

// Graceful shutdown: on a platform redeploy/restart (Render sends SIGTERM),
// stop accepting new connections and let in-flight requests finish instead of
// dropping them mid-response, then close the DB connection cleanly.
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      const mongoose = (await import("mongoose")).default;
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
    } catch (err) {
      logger.warn(`Error closing MongoDB connection: ${err.message}`);
    }
    logger.info("Shutdown complete.");
    process.exit(0);
  });

  // Force-exit if connections don't close within a reasonable window (e.g. a
  // long-lived socket.io connection refusing to drain).
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout — some connections did not close cleanly.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
