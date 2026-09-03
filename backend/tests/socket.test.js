import { jest } from '@jest/globals';
import http from 'http';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

// Mock redis
const mockGetRedisClient = jest.fn();
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: mockGetRedisClient,
}));

// Mock @socket.io/redis-adapter
const mockCreateAdapter = jest.fn();
jest.unstable_mockModule('@socket.io/redis-adapter', () => ({
  createAdapter: mockCreateAdapter,
}));

// Mock socket.io Server
const mockAdapter = jest.fn();
const mockOn = jest.fn();
let capturedOptions = null;

class MockServer {
  constructor(server, options) {
    capturedOptions = options;
    this.adapter = mockAdapter;
    this.on = mockOn;
  }
}

jest.unstable_mockModule('socket.io', () => ({
  Server: MockServer,
}));

describe('Socket Initialization Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    capturedOptions = null;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('configures CORS origin handler with credentials', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] initializeSocket › configures CORS origin handler');

    process.env.CLIENT_URL = 'https://linklet-frontend.vercel.app';
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await initializeSocket(mockHttpServer);

    console.log('[TEST] Captured Socket Server CORS options:', capturedOptions?.cors);
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.cors.credentials).toBe(true);
    expect(typeof capturedOptions.cors.origin).toBe('function');

    const cb = jest.fn();
    capturedOptions.cors.origin('https://linklet-frontend.vercel.app', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  test('falls back safely to in-memory mode when Redis is uninitialized', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] initializeSocket › handles uninitialized Redis gracefully without throwing');

    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis client not initialized');
    });

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await expect(initializeSocket(mockHttpServer)).resolves.not.toThrow();

    console.log('[TEST] Logger warn called count:', mockLogger.warn.mock.calls.length);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Redis client not initialized')
    );
    expect(mockCreateAdapter).not.toHaveBeenCalled();
  });

  test('configures Redis adapter when Redis client is available', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] initializeSocket › attaches Redis adapter when client is present');

    const mockSubClient = {
      connect: jest.fn().mockResolvedValue(true),
    };
    const mockPubClient = {
      duplicate: jest.fn().mockReturnValue(mockSubClient),
    };
    mockGetRedisClient.mockReturnValue(mockPubClient);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await initializeSocket(mockHttpServer);

    console.log('[TEST] SubClient connect called:', mockSubClient.connect.mock.calls.length);
    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockSubClient.connect).toHaveBeenCalled();
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
  });
});
