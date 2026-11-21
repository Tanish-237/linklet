import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

/**
 * GET /health reports MongoDB and Redis state: 200 when both are usable, 503
 * (so uptime monitors alert) when either is down.
 */
let redisClient = { isReady: true };
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: () => {
    if (!redisClient) throw new Error('Redis client not initialized');
    return redisClient;
  },
}));

const mongoose = (await import('mongoose')).default;
const { health } = await import('../src/controllers/health.controller.js');

const app = express();
app.get('/health', health);

const setDbState = (state) => Object.defineProperty(mongoose.connection, 'readyState', { value: state, configurable: true });

describe('GET /health', () => {
  afterEach(() => {
    redisClient = { isReady: true };
  });

  test('200 when the database and Redis are up', async () => {
    setDbState(1);
    const res = await supertest(app).get('/health');
    console.log('[TEST] healthy:', res.body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up', redis: 'up' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('503 when the database is disconnected', async () => {
    setDbState(0);
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'down' });
  });

  test('503 when Redis is not ready', async () => {
    setDbState(1);
    redisClient = { isReady: false };
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.redis).toBe('down');
  });

  test('200 without Redis configured (local development)', async () => {
    setDbState(1);
    redisClient = null;
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe('not configured');
  });
});
