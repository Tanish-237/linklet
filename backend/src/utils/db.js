import mongoose from "mongoose";
import logger from "./logger.js";

export const connectDb = async () => {
  const url = process.env.MONGO_URL;
  if (!url) {
    logger.error("MONGO_URL environment variable is not set.");
    // Exit 1, not 0: a failed startup must never look like a clean exit to the
    // host platform's process supervisor (Render, PM2, Docker, ...) — a 0 exit
    // code is normally read as "the process finished successfully" and can
    // suppress restart/alerting logic that a real crash would trigger.
    process.exit(1);
  }

  try {
    await mongoose.connect(url);
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};
