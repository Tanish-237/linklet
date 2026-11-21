import mongoose from "mongoose";
import logger from "./logger.js";

export const connectDb = async () => {
  const url = process.env.MONGO_URL;
  // Throw rather than process.exit(): server.js turns this into exit code 1,
  // and on Vercel a throw fails just this cold start so the next request retries.
  if (!url) {
    logger.error("MONGO_URL environment variable is not set.");
    throw new Error("MONGO_URL environment variable is not set.");
  }

  try {
    await mongoose.connect(url, {
      // Every serverless instance opens its own pool. The driver's default of
      // 100 connections each would exhaust Atlas's limit (500 on M0) with a
      // handful of warm instances; a request here needs one or two at a time.
      maxPoolSize: 10,
      // Explicit, so a connection string without a path can't silently point
      // at a different (empty) database. Production's data lives in "test";
      // preview deployments use their own database.
      dbName: process.env.MONGO_DB_NAME || undefined,
      serverSelectionTimeoutMS: 10_000,
    });
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    throw error;
  }
};
