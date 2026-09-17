import { getRedisClient } from './redis.js';
import jwt from 'jsonwebtoken';
import logger from './logger.js';

export const blacklistToken = async (token) => {
  try {
    const redis = getRedisClient();
    if (!redis) return; // Fallback if Redis is not connected (e.g., local dev)

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return;

    const expirationInSeconds = decoded.exp - Math.floor(Date.now() / 1000);
    if (expirationInSeconds > 0) {
      // Save token to blacklist with an expiration matching the JWT expiration
      await redis.setEx(`bl_${token}`, expirationInSeconds, 'true');
    }
  } catch (error) {
    logger.warn(`Error blacklisting token: ${error.message}`);
  }
};

export const isTokenBlacklisted = async (token) => {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const result = await redis.get(`bl_${token}`);
    return result === 'true';
  } catch (error) {
    logger.warn(`Error checking token blacklist: ${error.message}`);
    return false;
  }
};
