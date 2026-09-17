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

// Mock blacklist
const mockIsTokenBlacklisted = jest.fn().mockResolvedValue(false);
jest.unstable_mockModule('../src/utils/blacklist.js', () => ({
  isTokenBlacklisted: mockIsTokenBlacklisted,
}));

// Mock @socket.io/redis-adapter
const mockCreateAdapter = jest.fn();
jest.unstable_mockModule('@socket.io/redis-adapter', () => ({
  createAdapter: mockCreateAdapter,
}));

// Mock chat repository
const mockIsParticipant = jest.fn();
const mockFindChatById = jest.fn();
jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  isParticipant: mockIsParticipant,
  findChatById: mockFindChatById,
}));

// Mock socket.io Server
const mockAdapter = jest.fn();
const mockOn = jest.fn();
const mockUse = jest.fn();
let capturedOptions = null;

class MockServer {
  constructor(server, options) {
    capturedOptions = options;
    this.adapter = mockAdapter;
    this.on = mockOn;
    this.use = mockUse;
    this.to = jest.fn(() => ({ emit: jest.fn() }));
  }
}

jest.unstable_mockModule('socket.io', () => ({
  Server: MockServer,
}));

describe('Socket Initialization Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTokenBlacklisted.mockResolvedValue(false);
    process.env = { ...originalEnv };
    capturedOptions = null;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('configures CORS origin handler with credentials', async () => {
    process.env.CLIENT_URL = 'https://linklet-frontend.vercel.app';
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await initializeSocket(mockHttpServer);

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.cors.credentials).toBe(true);
    expect(typeof capturedOptions.cors.origin).toBe('function');

    const cb = jest.fn();
    capturedOptions.cors.origin('https://linklet-frontend.vercel.app', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  test('falls back safely to in-memory mode when Redis is uninitialized', async () => {
    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis client not initialized');
    });

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await expect(initializeSocket(mockHttpServer)).resolves.not.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Redis client not initialized')
    );
    expect(mockCreateAdapter).not.toHaveBeenCalled();
  });

  test('configures Redis adapter when Redis client is available', async () => {
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

    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockSubClient.connect).toHaveBeenCalled();
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
  });

  test('handshake middleware rejects a connection with no token', async () => {
    mockGetRedisClient.mockReturnValue(null);
    process.env.ACCESS_TOKEN_SECRET = 'test_secret_key_123';

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const handshakeMiddleware = mockUse.mock.calls[0][0];
    const mockSocket = { id: 'socket-no-token', handshake: { auth: {}, headers: {} } };
    const nextFn = jest.fn();

    await handshakeMiddleware(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    expect(mockSocket.authenticated).toBeUndefined();
  });

  test('handshake middleware rejects an invalid/expired token', async () => {
    mockGetRedisClient.mockReturnValue(null);
    process.env.ACCESS_TOKEN_SECRET = 'test_secret_key_123';

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const handshakeMiddleware = mockUse.mock.calls[0][0];
    const mockSocket = {
      id: 'socket-bad-token',
      handshake: { auth: { token: 'not-a-real-jwt' }, headers: {} },
    };
    const nextFn = jest.fn();

    await handshakeMiddleware(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
  });

  test('handshake middleware rejects a blacklisted (logged-out) token', async () => {
    mockGetRedisClient.mockReturnValue(null);
    process.env.ACCESS_TOKEN_SECRET = 'test_secret_key_123';
    mockIsTokenBlacklisted.mockResolvedValue(true);

    const jwt = (await import('jsonwebtoken')).default;
    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const handshakeMiddleware = mockUse.mock.calls[0][0];
    const validToken = jwt.sign({ id: 'verified-user-789' }, process.env.ACCESS_TOKEN_SECRET);
    const mockSocket = {
      id: 'socket-blacklisted',
      handshake: { auth: { token: validToken }, headers: {} },
    };
    const nextFn = jest.fn();

    await handshakeMiddleware(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
  });

  test('handshake middleware decodes a valid token and authenticates the socket', async () => {
    mockGetRedisClient.mockReturnValue(null);
    const jwt = (await import('jsonwebtoken')).default;
    process.env.ACCESS_TOKEN_SECRET = 'test_secret_key_123';

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    expect(mockUse).toHaveBeenCalled();
    const handshakeMiddleware = mockUse.mock.calls[0][0];

    const validToken = jwt.sign({ id: 'verified-user-789' }, process.env.ACCESS_TOKEN_SECRET);
    const mockSocket = {
      id: 'socket-auth-1',
      handshake: { auth: { token: validToken }, headers: {} },
    };

    const nextFn = jest.fn();
    await handshakeMiddleware(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith();
    expect(mockSocket.authenticated).toBe(true);
    expect(mockSocket.user.id).toBe('verified-user-789');
    expect(mockSocket.userId).toBe('verified-user-789');
  });

  test('setup and disconnect emit targeted presence and broadcast delta events (no broadcast storm)', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();

    await initializeSocket(mockHttpServer);

    const connectionCall = mockOn.mock.calls.find((call) => call[0] === 'connection');
    expect(connectionCall).toBeDefined();
    const connectionHandler = connectionCall[1];

    const registeredHandlers = {};
    const mockSocket = {
      id: 'socket-123',
      userId: 'user-456', // set by the (already-passed) handshake middleware
      authenticated: true,
      join: jest.fn(),
      emit: jest.fn(),
      broadcast: {
        emit: jest.fn(),
      },
      on: jest.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };

    // Simulate connection
    connectionHandler(mockSocket);

    expect(registeredHandlers['setup']).toBeDefined();
    expect(registeredHandlers['disconnect']).toBeDefined();

    // Trigger setup
    registeredHandlers['setup']({ _id: 'user-456' });

    // Targeted emit to self only
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'user online status',
      expect.objectContaining({ onlineUsers: expect.arrayContaining(['user-456']) })
    );

    // Delta broadcast to others
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user_connected', {
      userId: 'user-456',
    });

    // Trigger disconnect
    registeredHandlers['disconnect']();
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user_disconnected', {
      userId: 'user-456',
      lastSeen: expect.any(Date),
    });
  });

  test('setup event rejects registration when client tries to spoof a different user ID', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const connectionCall = mockOn.mock.calls.find((call) => call[0] === 'connection');
    const connectionHandler = connectionCall[1];

    const registeredHandlers = {};
    const mockSocket = {
      id: 'socket-spoof-test',
      authenticated: true,
      userId: 'legit-user-001',
      join: jest.fn(),
      emit: jest.fn(),
      broadcast: { emit: jest.fn() },
      on: jest.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };

    connectionHandler(mockSocket);

    // Attacker tries to setup as victim user ID
    registeredHandlers['setup']({ _id: 'victim-user-999' });

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      message: 'Unauthorized socket registration',
    });
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  test('sets robust pingTimeout and pingInterval for mobile clients', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    expect(capturedOptions.pingTimeout).toBe(20000);
    expect(capturedOptions.pingInterval).toBe(25000);
  });

  test('join chat blocks users who are not participants of the chat room', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const connectionCall = mockOn.mock.calls.find((call) => call[0] === 'connection');
    const connectionHandler = connectionCall[1];

    const registeredHandlers = {};
    const mockSocket = {
      id: 'socket-join-test',
      userId: 'attacker_user',
      authenticated: true,
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };

    connectionHandler(mockSocket);

    mockIsParticipant.mockResolvedValue(false);
    await registeredHandlers['join chat']('secret_chat_room');

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      message: 'Unauthorized to join this chat room',
    });
    expect(mockSocket.join).not.toHaveBeenCalled();

    // Now test authorized member
    mockIsParticipant.mockResolvedValue(true);
    await registeredHandlers['join chat']('allowed_chat_room');
    expect(mockSocket.join).toHaveBeenCalledWith('allowed_chat_room');
  });

  test('does not register client-forgeable chat mutation relays (new message, message deleted, etc.)', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const { initializeSocket } = await import('../socket.js');
    const mockHttpServer = http.createServer();
    await initializeSocket(mockHttpServer);

    const connectionCall = mockOn.mock.calls.find((call) => call[0] === 'connection');
    const connectionHandler = connectionCall[1];

    const registeredHandlers = {};
    const mockSocket = {
      id: 'socket-mutation-test',
      userId: 'user-1',
      authenticated: true,
      join: jest.fn(),
      emit: jest.fn(),
      broadcast: { emit: jest.fn() },
      on: jest.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };

    connectionHandler(mockSocket);

    // These events are now server-authoritative only (emitted via notify* helpers
    // from chat.controller.js after a validated DB write) — the client can no
    // longer trigger them directly.
    [
      'new message',
      'message updated',
      'message deleted',
      'messages_bulk_deleted',
      'message reaction',
      'message pinned',
      'message unpinned',
      'group updated',
    ].forEach((event) => {
      expect(registeredHandlers[event]).toBeUndefined();
    });
  });
});
