import { createClient } from 'redis';
import logger from './logger.js';

let redisClient;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not found in environment variables. Falling back to in-memory store (NOT FOR PRODUCTION).');
    // For local development without Redis, we can mock basic operations or throw an error based on preference.
    // However, to ensure learning is smooth, we'll initialize a disconnected mock if needed, 
    // but ideally, we want to enforce Redis for this revamp.
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
