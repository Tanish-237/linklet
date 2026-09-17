import { getRedisClient } from "./redis.js";
import logger from "./logger.js";

import { USER_CACHE_TTL_SECONDS } from "../config/constants.js";

const USER_CACHE_TTL = USER_CACHE_TTL_SECONDS;

/**
 * Retrieve a cached user profile by user ID.
 * Returns null if not found or if Redis is unavailable.
 */
export const getCachedUser = async (userId) => {
  if (!userId) return null;
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(`user:cache:${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    // Graceful fallback to database if Redis encounters an error or is uninitialized
    logger.debug?.(`Redis getCachedUser cache miss/error for ${userId}: ${error.message}`);
  }
  return null;
};

/**
 * Cache user profile data in Redis.
 */
export const setCachedUser = async (userId, userData) => {
  if (!userId || !userData) return;
  try {
    const redis = getRedisClient();
    if (!redis) return;
    // Strip sensitive fields just in case
    const sanitized = { ...userData };
    delete sanitized.password;
    delete sanitized.refreshToken;

    await redis.setEx(`user:cache:${userId}`, USER_CACHE_TTL, JSON.stringify(sanitized));
  } catch (error) {
    logger.debug?.(`Redis setCachedUser error for ${userId}: ${error.message}`);
  }
};

/**
 * Invalidate (delete) cached user profile by user ID.
 */
export const invalidateUserCache = async (userId) => {
  if (!userId) return;
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.del(`user:cache:${userId}`);
  } catch (error) {
    logger.debug?.(`Redis invalidateUserCache error for ${userId}: ${error.message}`);
  }
};
