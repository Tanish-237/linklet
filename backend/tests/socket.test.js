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
const mockFindContactIds = jest.fn().mockResolvedValue([]);
jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  isParticipant: mockIsParticipant,
  findChatById: mockFindChatById,
  findContactIds: mockFindContactIds,
}));

// Mock User model (typing relays look up the sender's username once per socket)
const mockUserLean = jest.fn().mockResolvedValue({ username: 'real_name' });
jest.unstable_mockModule('../models/users.js', () => ({
  User: {
    findById: jest.fn(() => ({ select: () => ({ lean: mockUserLean }) })),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
  },
}));

// Mock socket.io Server
const mockAdapter = jest.fn();
const mockOn = jest.fn();
const mockUse = jest.fn();
let capturedOptions = null;

// fetchSockets() answers presence lookups: an ARRAY of rooms is the "which of my
// contacts are online" query, a single room string is "how many sockets does this
// user have". Tests override these to simulate other tabs / other instances.
const mockRoomQuery = jest.fn();
const mockIoEmit = jest.fn();
const mockIoTo = jest.fn(() => ({ emit: mockIoEmit }));

class MockServer {
  constructor(server, options) {
    capturedOptions = options;
    this.adapter = mockAdapter;
    this.on = mockOn;
    this.use = mockUse;
    this.to = mockIoTo;
    this.in = jest.fn((rooms) => ({ fetchSockets: () => mockRoomQuery(rooms) }));
  }
}

jest.unstable_mockModule('socket.io', () => ({
  Server: MockServer,
}));

describe('Socket Initialization Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindContactIds.mockResolvedValue([]);
    mockRoomQuery.mockResolvedValue([]);
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

  const connectSocket = async () => {
    mockGetRedisClient.mockReturnValue(null);
    const { initializeSocket } = await import('../socket.js');
    await initializeSocket(http.createServer());

    const connectionHandler = mockOn.mock.calls.find((call) => call[0] === 'connection')[1];
    const registeredHandlers = {};
    const toEmit = jest.fn();
    const mockSocket = {
      id: 'socket-123',
      userId: 'user-456', // set by the (already-passed) handshake middleware
      data: { userId: 'user-456' },
      authenticated: true,
      join: jest.fn(),
      use: jest.fn(),
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: toEmit })),
      broadcast: { emit: jest.fn() },
      on: jest.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };
    connectionHandler(mockSocket);
    return { mockSocket, registeredHandlers, toEmit };
  };

  test('setup tells the connecting socket which CONTACTS are online and announces arrival only to contacts', async () => {
    console.log('[TEST] presence setup › scoped to contacts, never socket.broadcast');
    mockFindContactIds.mockResolvedValue(['friend-1', 'friend-2']);
    mockRoomQuery.mockImplementation(async (rooms) =>
      Array.isArray(rooms) ? [{ data: { userId: 'friend-2' } }] : [{ id: 'socket-123' }]
    );
    const { mockSocket, registeredHandlers, toEmit } = await connectSocket();

    await registeredHandlers['setup']({ _id: 'user-456' });

    expect(mockSocket.join).toHaveBeenCalledWith('user-456');
    expect(mockSocket.emit).toHaveBeenCalledWith('user online status', {
      onlineUsers: ['friend-2', 'user-456'],
    });
    expect(mockSocket.to).toHaveBeenCalledWith(['friend-1', 'friend-2']);
    expect(toEmit).toHaveBeenCalledWith('user_connected', { userId: 'user-456' });
    expect(mockSocket.broadcast.emit).not.toHaveBeenCalled();
  });

  test('a user with no contacts announces nothing (an empty room list would reach everyone)', async () => {
    console.log('[TEST] presence setup › empty contacts → no emit at all');
    mockFindContactIds.mockResolvedValue([]);
    const { mockSocket, registeredHandlers, toEmit } = await connectSocket();

    await registeredHandlers['setup']({ _id: 'user-456' });

    expect(mockSocket.to).not.toHaveBeenCalled();
    expect(toEmit).not.toHaveBeenCalled();
    expect(mockSocket.broadcast.emit).not.toHaveBeenCalled();
  });

  test('a second tab (another live socket) does not re-announce the user', async () => {
    console.log('[TEST] presence setup › already online elsewhere → no duplicate user_connected');
    mockFindContactIds.mockResolvedValue(['friend-1']);
    mockRoomQuery.mockImplementation(async (rooms) =>
      Array.isArray(rooms) ? [] : [{ id: 'socket-123' }, { id: 'other-tab' }]
    );
    const { registeredHandlers, toEmit } = await connectSocket();

    await registeredHandlers['setup']({ _id: 'user-456' });

    expect(toEmit).not.toHaveBeenCalled();
  });

  test('disconnect announces offline + lastSeen to contacts only when NO other socket remains', async () => {
    console.log('[TEST] presence disconnect › last socket closes → user_disconnected to contacts');
    mockFindContactIds.mockResolvedValue(['friend-1']);
    mockRoomQuery.mockResolvedValue([]); // nobody left in the user's room
    const { registeredHandlers } = await connectSocket();
    await registeredHandlers['setup']({ _id: 'user-456' });

    await registeredHandlers['disconnect']();

    expect(mockIoTo).toHaveBeenCalledWith(['friend-1']);
    expect(mockIoEmit).toHaveBeenCalledWith('user_disconnected', {
      userId: 'user-456',
      lastSeen: expect.any(Date),
    });
  });

  test('disconnect of one tab is silent while another tab/instance is still connected', async () => {
    console.log('[TEST] presence disconnect › another live socket → stay online');
    mockFindContactIds.mockResolvedValue(['friend-1']);
    const { registeredHandlers } = await connectSocket();
    await registeredHandlers['setup']({ _id: 'user-456' });

    mockRoomQuery.mockResolvedValue([{ id: 'other-tab-on-another-instance' }]);
    await registeredHandlers['disconnect']();

    expect(mockIoEmit).not.toHaveBeenCalled();
  });

  test('a peer-instance timeout while counting sockets falls back safely instead of crashing', async () => {
    console.log('[TEST] presence › fetchSockets failure is handled');
    mockFindContactIds.mockResolvedValue(['friend-1']);
    mockRoomQuery.mockRejectedValue(new Error('timeout reached while waiting for fetchSockets response'));
    const { mockSocket, registeredHandlers, toEmit } = await connectSocket();

    await expect(registeredHandlers['setup']({ _id: 'user-456' })).resolves.not.toThrow();

    expect(mockSocket.emit).toHaveBeenCalledWith('user online status', { onlineUsers: ['user-456'] });
    expect(toEmit).toHaveBeenCalledWith('user_connected', { userId: 'user-456' });
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
      use: jest.fn(),
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
      use: jest.fn(),
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
      use: jest.fn(),
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

  const connectForTyping = async (rooms = []) => {
    mockGetRedisClient.mockReturnValue(null);
    const { initializeSocket } = await import('../socket.js');
    await initializeSocket(http.createServer());
    const connectionHandler = mockOn.mock.calls.find((call) => call[0] === 'connection')[1];
    const registeredHandlers = {};
    const toEmit = jest.fn();
    let packetMiddleware;
    const mockSocket = {
      id: 'socket-typing',
      userId: 'sender-1',
      data: { userId: 'sender-1' },
      rooms: new Set(['socket-typing', ...rooms]),
      join: jest.fn(),
      use: jest.fn((fn) => { packetMiddleware = fn; }),
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: toEmit })),
      on: jest.fn((event, handler) => { registeredHandlers[event] = handler; }),
    };
    connectionHandler(mockSocket);
    return { mockSocket, registeredHandlers, toEmit, packetMiddleware: () => packetMiddleware };
  };

  test('typing is only relayed for a chat room the sender has joined', async () => {
    const { mockSocket, registeredHandlers, toEmit } = await connectForTyping([]);
    await registeredHandlers['typing']({ chatId: 'someone-elses-chat', recipientId: 'victim' });
    expect(mockSocket.to).not.toHaveBeenCalled();
    expect(toEmit).not.toHaveBeenCalled();
  });

  test('typing relays only known fields, with identity from the socket, not the client', async () => {
    mockIsParticipant.mockResolvedValue(true);
    const { mockSocket, registeredHandlers, toEmit } = await connectForTyping(['chat-1']);
    await registeredHandlers['typing']({
      chatId: 'chat-1', recipientId: 'friend-1', userId: 'forged', username: 'forged', html: '<b>x</b>',
    });
    expect(mockSocket.to).toHaveBeenCalledWith('chat-1');
    expect(mockSocket.to).toHaveBeenCalledWith('friend-1');
    expect(toEmit).toHaveBeenCalledWith('typing', { chatId: 'chat-1', userId: 'sender-1', username: 'real_name' });
  });

  test('typing is not pushed to a recipient who is not in that chat', async () => {
    mockIsParticipant.mockResolvedValue(false);
    const { mockSocket, registeredHandlers } = await connectForTyping(['chat-1']);
    await registeredHandlers['stop typing']({ chatId: 'chat-1', recipientId: 'stranger' });
    expect(mockSocket.to).toHaveBeenCalledWith('chat-1');
    expect(mockSocket.to).not.toHaveBeenCalledWith('stranger');
  });

  test('flood guard drops events beyond the per-socket burst', async () => {
    const { packetMiddleware } = await connectForTyping();
    const middleware = packetMiddleware();
    const next = jest.fn();
    for (let i = 0; i < 100; i++) middleware(['typing', {}], next);
    expect(next.mock.calls.length).toBeGreaterThanOrEqual(40);
    expect(next.mock.calls.length).toBeLessThan(45);
  });

  describe('foreground/background presence', () => {
    const connectRegistered = async () => {
      const ctx = await connectSocket();
      ctx.mockSocket.data.presenceRegistered = true;
      mockFindContactIds.mockResolvedValue(['friend-1']);
      return ctx;
    };

    test('backgrounding the only active tab shows the user offline with a lastSeen', async () => {
      const { registeredHandlers } = await connectRegistered();
      mockRoomQuery.mockResolvedValue([]); // no other active socket
      await registeredHandlers['presence']({ active: false });
      expect(mockIoTo).toHaveBeenCalledWith(['friend-1']);
      expect(mockIoEmit).toHaveBeenCalledWith('user_disconnected', expect.objectContaining({ userId: 'user-456', lastSeen: expect.any(Date) }));
    });

    test('backgrounding one tab while another is still active keeps the user online', async () => {
      const { registeredHandlers } = await connectRegistered();
      mockRoomQuery.mockResolvedValue([{ data: { userId: 'user-456' } }]); // other tab, active
      await registeredHandlers['presence']({ active: false });
      expect(mockIoEmit).not.toHaveBeenCalled();
    });

    test('coming back to the foreground announces the user online again', async () => {
      const { mockSocket, registeredHandlers } = await connectRegistered();
      mockSocket.data.away = true;
      mockRoomQuery.mockResolvedValue([{ data: { userId: 'user-456' } }]); // just this socket
      await registeredHandlers['presence']({ active: true });
      expect(mockIoEmit).toHaveBeenCalledWith('user_connected', { userId: 'user-456' });
    });

    test('closing a tab that was already in the background announces nothing new', async () => {
      const { mockSocket, registeredHandlers } = await connectRegistered();
      mockSocket.data.away = true;
      await registeredHandlers['disconnect']();
      expect(mockIoEmit).not.toHaveBeenCalled();
    });

    test('background sockets do not count as online contacts', async () => {
      const { registeredHandlers, mockSocket } = await connectSocket();
      mockFindContactIds.mockResolvedValue(['friend-1', 'friend-2']);
      mockRoomQuery.mockImplementation(async (rooms) =>
        Array.isArray(rooms)
          ? [{ data: { userId: 'friend-1', away: true } }, { data: { userId: 'friend-2' } }]
          : [{ id: 'socket-123' }]
      );
      await registeredHandlers['setup']({ _id: 'user-456' });
      expect(mockSocket.emit).toHaveBeenCalledWith('user online status', { onlineUsers: ['friend-2', 'user-456'] });
    });
  });
});
