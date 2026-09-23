import { jest } from '@jest/globals';
import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

/**
 * Chat delivery and read receipts over a REAL Socket.IO server with real
 * clients, so room membership and cross-room de-duplication behave exactly as
 * in production.
 */

const SECRET = 'test-access-secret';
process.env.ACCESS_TOKEN_SECRET = SECRET;

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: () => {
    throw new Error('Redis client not initialized');
  },
}));
jest.unstable_mockModule('../src/utils/blacklist.js', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  findContactIds: jest.fn(async () => []),
  isParticipant: jest.fn().mockResolvedValue(true),
  findChatById: jest.fn(async () => ({ _id: 'chat1', participants: ['alice', 'bob'] })),
}));
const mockMarkAsRead = jest.fn().mockResolvedValue({ modifiedCount: 1 });
jest.unstable_mockModule('../src/services/chat.service.js', () => ({
  markAsRead: mockMarkAsRead,
}));

const { initializeSocket, notifyNewMessage } = await import('../socket.js');

let httpServer;
let port;
const openSockets = [];

const connect = (userId) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token: jwt.sign({ id: userId }, SECRET) },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    openSockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });

const waitFor = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const setupAndJoin = async (socket, userId, chatId) => {
  const status = waitFor(socket, 'user online status');
  socket.emit('setup', { _id: userId });
  await status;
  if (chatId) {
    socket.emit('join chat', chatId);
    await settle(100);
  }
};

describe('Chat delivery & read receipts (real Socket.IO)', () => {
  beforeAll(async () => {
    httpServer = http.createServer();
    await initializeSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterEach(() => {
    mockMarkAsRead.mockClear();
    while (openSockets.length) openSockets.pop().disconnect();
  });

  afterAll(async () => {
    const { getIo } = await import('../socket.js');
    getIo().close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  test('a recipient with the chat open receives each new message exactly once', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await setupAndJoin(alice, 'alice', 'chat1');
    await setupAndJoin(bob, 'bob', 'chat1'); // bob is in BOTH the chat room and his personal room

    let bobCount = 0;
    bob.on('message received', () => bobCount++);

    await notifyNewMessage({
      _id: 'm1',
      chat: { _id: 'chat1', participants: ['alice', 'bob'] },
      sender: 'alice',
      content: 'hi',
    });
    await settle();

    expect(bobCount).toBe(1);
  });

  test('a recipient without the chat open still gets it (via their personal room)', async () => {
    const bob = await connect('bob');
    await setupAndJoin(bob, 'bob', null);

    const received = waitFor(bob, 'message received');
    await notifyNewMessage({
      _id: 'm2',
      chat: { _id: 'chat1', participants: ['alice', 'bob'] },
      sender: 'alice',
      content: 'you there?',
    });

    expect((await received)._id).toBe('m2');
  });

  test('a read receipt is persisted, shown to the sender, and syncs the reader\'s other tabs', async () => {
    const alice = await connect('alice');
    const bobTab1 = await connect('bob');
    const bobTab2 = await connect('bob');
    await setupAndJoin(alice, 'alice', 'chat1');
    await setupAndJoin(bobTab1, 'bob', 'chat1');
    await setupAndJoin(bobTab2, 'bob', null);

    const aliceSeesRead = waitFor(alice, 'read receipt');
    const otherTabSyncs = waitFor(bobTab2, 'chat read');
    bobTab1.emit('read receipt', { chatId: 'chat1' });

    expect(await aliceSeesRead).toEqual({ chatId: 'chat1', userId: 'bob' });
    expect(await otherTabSyncs).toEqual({ chatId: 'chat1', userId: 'bob' });
    expect(mockMarkAsRead).toHaveBeenCalledWith('chat1', 'bob');
  });

  test('a read receipt for a chat the user is not in is dropped, not broadcast', async () => {
    mockMarkAsRead.mockRejectedValueOnce(new Error('You are not a participant in this chat'));
    const alice = await connect('alice');
    const mallory = await connect('mallory');
    await setupAndJoin(alice, 'alice', 'chat1');
    await setupAndJoin(mallory, 'mallory', null);

    let aliceGotReceipt = false;
    alice.on('read receipt', () => {
      aliceGotReceipt = true;
    });
    mallory.emit('read receipt', { chatId: 'chat1' });
    await settle();

    expect(aliceGotReceipt).toBe(false);
  });
});
