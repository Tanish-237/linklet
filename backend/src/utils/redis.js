import { createClient } from 'redis';
import logger from './logger.js';

let redisClient;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    // Without Redis, Socket.io rooms, presence and rate-limit counters are
    // per-process: fine for local dev, silently wrong as soon as production
    // runs more than one instance. Refuse to boot rather than degrade quietly.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_URL is required in production.');
    }
    logger.warn('REDIS_URL not set — running with in-memory Socket.io adapter, cache and rate limits (development only).');
    return null;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));
  redisClient.on('reconnecting', () => logger.info('Redis Client Reconnecting...'));

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};
