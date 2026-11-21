import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

import logger from "./utils/logger.js";
import apiRoutes from "./routes/index.js";
import { corsOriginHandler } from "./utils/cors.js";
import { fileCleanupMiddleware, cleanupRequestFiles } from "./middlewares/fileCleanup.middleware.js";
import { rejectOperatorKeys } from "./middlewares/rejectOperators.middleware.js";
import { health } from "./controllers/health.controller.js";

/**
 * The Express app, with no listening, DB or Redis side effects. Two entrypoints
 * wrap it in an HTTP server and attach Socket.IO:
 *   - api/index.js  — the Vercel Function (production)
 *   - server.js     — a long-running Node process (local dev, or any VM/container host)
 */
const app = express();

// Trust the platform's single reverse-proxy hop (Vercel's edge) for the real
// client IP (rate limiting) and secure cookies.
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
  // Counted per server instance, not in Redis: this backstop runs on every API
  // request, and a shared counter would cost ~5 Redis commands each (Upstash
  // bills per command). The limits that matter (OTP, login, change password,
  // uploads, timetable AI) stay in Redis, shared across instances.
  standardHeaders: true,
  legacyHeaders: false,
  // JSON like every other API error, so the frontend shows this text instead
  // of a generic "Error 429: Something went wrong".
  message: { success: false, message: "Too many requests from your network. Please wait a few minutes and try again." },
});
app.use("/api", limiter); // Apply rate limiting to all /api routes

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

// File uploads are multipart and go through multer (with its own per-file
// limit), so these only cover JSON/form bodies, none of which come close to 1 MB.
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
// Express 5 leaves req.body undefined when a request has no body; controllers
// destructure it (`const { x } = req.body`) and validate the fields, as they
// did on Express 4, where it defaulted to {}.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
// No "$operator" keys in bodies (NoSQL injection). Multipart bodies are parsed
// later by multer, so their text fields are checked again in the upload routes.
app.use(rejectOperatorKeys);
app.use(cookieParser());

// Auto cleanup temporary uploaded files on finish/close
app.use(fileCleanupMiddleware);

// Health check for uptime monitoring (database + Redis state)
app.get("/health", health);

// Central API Router
app.use("/api/v1", apiRoutes);

// 404 Handler
app.use((req, res) => {
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

  // 4xx messages are written for the user (AppError); 5xx messages come from
  // whatever threw (Mongo, Cloudinary, a TypeError) and can leak internals, so
  // they're only surfaced outside production.
  const exposeMessage = statusCode < 500 || process.env.NODE_ENV !== "production";
  res.status(statusCode).json({
    success: false,
    message:
      err.type === "entity.too.large"
        ? "That request is too large." // body-parser's default is "request entity too large"
        : exposeMessage ? err.message || "Internal Server Error" : "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

export default app;
