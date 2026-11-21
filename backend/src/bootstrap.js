import mongoose from "mongoose";
import { connectDb } from "./utils/db.js";
import { connectRedis } from "./utils/redis.js";
import { hasUnmigratedPostComments } from "./migrations/postComments.migration.js";
import { hasUnmigratedResourceCategories } from "./migrations/resourceCategories.migration.js";
import logger from "./utils/logger.js";

/**
 * Connect MongoDB and Redis. Shared by both entrypoints (server.js and the
 * Vercel Function in api/index.js). Memoized: a serverless instance runs it once
 * per cold start and reuses the connections for every request it serves after.
 * A failed attempt is forgotten, so the next caller retries instead of being
 * handed the same rejected promise forever.
 */
let ready = null;

export const connectServices = () => {
  if (!ready) {
    ready = boot().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
};

const boot = async () => {
  await connectDb();
  logger.info("MongoDB connected successfully");
  await warnAboutPendingMigrations();
  await connectRedis();
};

// Data migrations that haven't been run leave records invisible or invalid.
// Make that impossible to miss in the logs instead of a silent data gap.
const warnAboutPendingMigrations = async () => {
  const checks = [
    [
      hasUnmigratedPostComments,
      "[MIGRATION REQUIRED] Some posts still have embedded comments. Run `npm run migrate:comments` (see CHANGELOG) — until then those comments will not appear.",
    ],
    [
      hasUnmigratedResourceCategories,
      "[MIGRATION REQUIRED] Some resources still use the retired \"presentations\" category. Run `npm run migrate:resource-categories` — until then they are hidden from the Lectures filter and fail validation when edited.",
    ],
  ];
  for (const [check, message] of checks) {
    try {
      if (await check(mongoose.connection.db)) logger.warn(message);
    } catch (err) {
      logger.warn(`Could not run migration check: ${err.message}`);
    }
  }
};
