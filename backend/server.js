// Long-running Node entrypoint: `npm run dev` locally, or any host that runs a
// persistent process. Production on Vercel uses api/index.js instead.
import "dotenv/config";
import http from "http";
import mongoose from "mongoose";

import app from "./src/app.js";
import { connectServices } from "./src/bootstrap.js";
import { initializeSocket } from "./socket.js";
import logger from "./src/utils/logger.js";

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

const bootServer = async () => {
  try {
    // MongoDB + Redis first: Socket.io's Redis adapter needs Redis connected.
    await connectServices();
    await initializeSocket(server);
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

bootServer();

// Graceful shutdown: on SIGTERM/SIGINT stop accepting new connections and let
// in-flight requests finish instead of dropping them mid-response, then close
// the DB connection cleanly.
let shuttingDown = false;
const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
    } catch (err) {
      logger.warn(`Error closing MongoDB connection: ${err.message}`);
    }
    logger.info("Shutdown complete.");
    process.exit(exitCode);
  });

  // Force-exit if connections don't close within a reasonable window (e.g. a
  // long-lived socket.io connection refusing to drain).
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout — some connections did not close cleanly.");
    process.exit(1);
  }, 10000).unref();
};

// A stray rejected promise or synchronous throw outside Express's error
// pipeline would otherwise kill the process with nothing useful in the logs.
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled promise rejection: ${reason?.stack || reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err?.stack || err}`);
  shutdown("uncaughtException", 1);
});
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
