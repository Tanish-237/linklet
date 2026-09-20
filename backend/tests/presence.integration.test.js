import { jest } from '@jest/globals';
import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

/**
 * Presence, tested with REAL Socket.IO server + real socket.io-client sockets
 * (no mocked Server class), so room membership, fetchSockets() and event
 * scoping behave exactly as they do in production.
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

// Who shares a chat with whom: alice <-> bob. carol is a stranger to both.
const contacts = { alice: ['bob'], bob: ['alice'], carol: [], dave: [] };
jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  findContactIds: jest.fn(async (userId) => contacts[userId] || []),
  isParticipant: jest.fn().mockResolvedValue(true),
  findChatById: jest.fn(),
}));

const { initializeSocket, notifyNewMessage, refreshPresence } = await import('../socket.js');

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

/** Resolve true if `event` is NOT received within `ms` (used to prove something was NOT sent). */
const staysSilent = (socket, event, ms = 300) =>
  new Promise((resolve) => {
    const handler = () => resolve(false);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
  });

/** `setup` and wait for the online-status reply that the server sends to the connecting socket. */
const register = async (socket, userId) => {
  const status = waitFor(socket, 'user online status');
  socket.emit('setup', { _id: userId });
  return status;
};

describe('Presence (real Socket.IO)', () => {
  beforeAll(async () => {
    httpServer = http.createServer();
    await initializeSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterEach(() => {
    while (openSockets.length) openSockets.pop().disconnect();
  });

  afterAll(async () => {
    const { getIo } = await import('../socket.js');
    getIo().close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  test('a connecting user is told which of THEIR contacts are online, and contacts are told they arrived', async () => {
    console.log('[TEST] setup › online list is limited to contacts; contact receives user_connected');
    const alice = await connect('alice');
    await register(alice, 'alice');

    const aliceSeesBobArrive = waitFor(alice, 'user_connected');
    const bob = await connect('bob');
    const bobStatus = await register(bob, 'bob');

    console.log(`[TEST RESULT] bob's initial online list: ${JSON.stringify(bobStatus.onlineUsers)}`);
    expect(bobStatus.onlineUsers).toEqual(expect.arrayContaining(['alice', 'bob']));
    expect(await aliceSeesBobArrive).toEqual({ userId: 'bob' });
  });

  test('strangers never receive presence events (no campus-wide broadcast)', async () => {
    console.log('[TEST] presence scoping › carol shares no chat with alice/bob and hears nothing');
    const carol = await connect('carol');
    await register(carol, 'carol');
    const carolHearsConnect = staysSilent(carol, 'user_connected');
    const carolHearsDisconnect = staysSilent(carol, 'user_disconnected');

    const alice = await connect('alice');
    await register(alice, 'alice');
    alice.disconnect();

    const [connectSilent, disconnectSilent] = await Promise.all([carolHearsConnect, carolHearsDisconnect]);
    console.log(`[TEST RESULT] carol silent on connect=${connectSilent}, on disconnect=${disconnectSilent}`);
    expect(connectSilent).toBe(true);
    expect(disconnectSilent).toBe(true);
  });

  test('a user with no contacts connecting/disconnecting does not broadcast to everyone', async () => {
    console.log('[TEST] empty contact list › must NOT fall back to a global emit');
    const bob = await connect('bob');
    await register(bob, 'bob');
    const bobHearsConnect = staysSilent(bob, 'user_connected');
    const bobHearsDisconnect = staysSilent(bob, 'user_disconnected');

    const dave = await connect('dave'); // dave has zero contacts
    await register(dave, 'dave');
    dave.disconnect();

    expect(await bobHearsConnect).toBe(true);
    expect(await bobHearsDisconnect).toBe(true);
  });

  test('MULTI-TAB: closing one tab keeps the user online; closing the last tab marks them offline', async () => {
    console.log('[TEST] multi-tab › offline only when the LAST socket closes');
    const bob = await connect('bob');
    await register(bob, 'bob');

    const aliceTab1 = await connect('alice');
    await register(aliceTab1, 'alice');
    const aliceTab2 = await connect('alice');
    await register(aliceTab2, 'alice');

    // Tab 1 closes: alice still has tab 2, so bob must NOT see her go offline.
    const bobSeesOfflineAfterTab1 = staysSilent(bob, 'user_disconnected', 400);
    aliceTab1.disconnect();
    const silentAfterFirstClose = await bobSeesOfflineAfterTab1;
    console.log(`[TEST RESULT] bob told alice went offline after closing ONE tab? ${!silentAfterFirstClose}`);
    expect(silentAfterFirstClose).toBe(true);

    // Tab 2 closes: now she is really gone.
    const bobSeesOffline = waitFor(bob, 'user_disconnected');
    aliceTab2.disconnect();
    const payload = await bobSeesOffline;
    console.log(`[TEST RESULT] bob told alice went offline after closing the LAST tab: ${payload.userId}`);
    expect(payload.userId).toBe('alice');
    expect(payload.lastSeen).toBeDefined();
  });

  test('MULTI-TAB: a second tab does not re-announce a user who is already online', async () => {
    console.log('[TEST] multi-tab › user_connected is sent once per user, not once per tab');
    const bob = await connect('bob');
    await register(bob, 'bob');

    const firstAnnounce = waitFor(bob, 'user_connected');
    const aliceTab1 = await connect('alice');
    await register(aliceTab1, 'alice');
    await firstAnnounce;

    const secondAnnounceSilent = staysSilent(bob, 'user_connected', 400);
    const aliceTab2 = await connect('alice');
    await register(aliceTab2, 'alice');

    expect(await secondAnnounceSilent).toBe(true);
  });

  test('a socket that never completed setup does not trigger offline announcements', async () => {
    console.log('[TEST] disconnect › only sockets that registered presence affect it');
    const bob = await connect('bob');
    await register(bob, 'bob');
    const silent = staysSilent(bob, 'user_disconnected');

    const alice = await connect('alice'); // connected, authenticated, but never sent "setup"
    alice.disconnect();

    expect(await silent).toBe(true);
  });

  test('setup rejects a spoofed user id and does not register presence', async () => {
    console.log('[TEST] setup › cannot register as somebody else');
    const mallory = await connect('carol');
    const err = waitFor(mallory, 'error');
    mallory.emit('setup', { _id: 'alice' });
    const payload = await err;
    expect(payload.message).toMatch(/unauthorized/i);
  });

  test('a message is "delivered" only when a recipient is online (checked via the cluster-aware lookup)', async () => {
    console.log('[TEST] notifyNewMessage › delivered receipt reflects real presence');
    const alice = await connect('alice');
    await register(alice, 'alice');

    // bob is offline: no delivered receipt.
    const noReceipt = staysSilent(alice, 'message delivered', 400);
    await notifyNewMessage({
      _id: 'm1',
      chat: { _id: 'chat1', participants: ['alice', 'bob'] },
      sender: 'alice',
    });
    expect(await noReceipt).toBe(true);

    // bob comes online: receipt is sent.
    const bob = await connect('bob');
    await register(bob, 'bob');
    const receipt = waitFor(alice, 'message delivered');
    await notifyNewMessage({
      _id: 'm2',
      chat: { _id: 'chat1', participants: ['alice', 'bob'] },
      sender: 'alice',
    });
    expect(await receipt).toEqual({ chatId: 'chat1', messageId: 'm2' });
  });

  test('refreshPresence lets a NEW chat partner see current status immediately (no wait for their next connect)', async () => {
    console.log('[TEST] refreshPresence › alice starts a chat with dave; alice learns dave is online');
    const dave = await connect('dave');
    await register(dave, 'dave');
    const alice = await connect('alice');
    const initial = await register(alice, 'alice');
    expect(initial.onlineUsers).not.toContain('dave'); // not a contact yet → hidden

    // The chat is created: dave becomes one of alice's contacts.
    contacts.alice = ['bob', 'dave'];
    const updated = waitFor(alice, 'user online status');
    await refreshPresence(['alice', 'dave']);

    const status = await updated;
    console.log(`[TEST RESULT] alice's refreshed online list: ${JSON.stringify(status.onlineUsers)}`);
    expect(status.onlineUsers).toEqual(expect.arrayContaining(['dave', 'alice']));
    contacts.alice = ['bob']; // restore for other tests
  });
});
