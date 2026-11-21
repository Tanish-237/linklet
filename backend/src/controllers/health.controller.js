import mongoose from "mongoose";
import { getRedisClient } from "../utils/redis.js";

const redisStatus = () => {
  try {
    return getRedisClient().isReady ? "up" : "down";
  } catch {
    // Not configured: only possible outside production (connectRedis refuses
    // to start without it there).
    return "not configured";
  }
};

/**
 * GET /health, for uptime monitoring. 200 when MongoDB and Redis are both
 * usable, 503 otherwise, so a monitor notices an outage instead of seeing "ok"
 * from a server that can't reach its database. Reads connection state only:
 * no queries, cheap enough to poll every minute.
 */
export const health = (req, res) => {
  const database = mongoose.connection.readyState === 1 ? "up" : "down";
  const redis = redisStatus();
  const ok = database === "up" && redis !== "down";
  res.set("Cache-Control", "no-store");
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    database,
    redis,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
