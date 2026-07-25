import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockAccessOrCreateChat = jest.fn();
const mockGetUserChats = jest.fn();
const mockCreateGroup = jest.fn();
const mockRenameGroup = jest.fn();
const mockAddToGroup = jest.fn();
const mockRemoveFromGroup = jest.fn();
const mockLeaveGroup = jest.fn();
const mockUpdateGroupImage = jest.fn();
const mockSendMessage = jest.fn();
const mockGetMessages = jest.fn();
const mockEditMessage = jest.fn();
const mockDeleteMessage = jest.fn();
const mockMarkAsRead = jest.fn();
const mockSearchUsers = jest.fn();
const mockSearchMessagesInChat = jest.fn();

jest.unstable_mockModule('../src/services/chat.service.js', () => ({
  accessOrCreateChat: mockAccessOrCreateChat,
  getUserChats: mockGetUserChats,
  createGroup: mockCreateGroup,
  renameGroup: mockRenameGroup,
  addToGroup: mockAddToGroup,
  removeFromGroup: mockRemoveFromGroup,
  leaveGroup: mockLeaveGroup,
  updateGroupImage: mockUpdateGroupImage,
  sendMessage: mockSendMessage,
  getMessages: mockGetMessages,
  editMessage: mockEditMessage,
  deleteMessage: mockDeleteMessage,
  markAsRead: mockMarkAsRead,
  searchUsers: mockSearchUsers,
  searchMessagesInChat: mockSearchMessagesInChat,
}));

// Mock auth middleware
const mockAuthMiddleware = (req, res, next) => {
  req.user = { _id: 'testUserId123', username: 'testuser', role: 'user' };
  next();
};

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: mockAuthMiddleware,
}));

// Import routes and express app setup
const chatRoutes = (await import('../src/routes/chat.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/chat', chatRoutes);

// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const request = supertest(app);

describe('Chat API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/chat — Access or Create 1:1 Chat', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing POST /api/v1/chat');
    mockAccessOrCreateChat.mockResolvedValue({ _id: 'chat123', isGroup: false });

    const res = await request
      .post('/api/v1/chat')
      .send({ userId: 'targetUser456' });

    console.log('TRACE [chat.integration.test.js]: Response status:', res.status);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe('chat123');
  });

  it('GET /api/v1/chat — Get User Chats', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing GET /api/v1/chat');
    mockGetUserChats.mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]);

    const res = await request.get('/api/v1/chat');

    console.log('TRACE [chat.integration.test.js]: Response chats count:', res.body.data.length);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('POST /api/v1/chat/group — Create Group Chat', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing POST /api/v1/chat/group');
    mockCreateGroup.mockResolvedValue({ _id: 'g1', chatName: 'Dev Team' });

    const res = await request
      .post('/api/v1/chat/group')
      .send({ chatName: 'Dev Team', participants: ['u1', 'u2'] });

    console.log('TRACE [chat.integration.test.js]: Group created res:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.data.chatName).toBe('Dev Team');
  });

  it('POST /api/v1/chat/message — Send Message', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing POST /api/v1/chat/message');
    mockSendMessage.mockResolvedValue({ _id: 'm1', content: 'Hello team!' });

    const res = await request
      .post('/api/v1/chat/message')
      .send({ chatId: 'g1', content: 'Hello team!' });

    console.log('TRACE [chat.integration.test.js]: Message response:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Hello team!');
  });

  it('GET /api/v1/chat/message/:chatId — Get Chat Messages', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing GET /api/v1/chat/message/g1');
    mockGetMessages.mockResolvedValue({
      messages: [{ _id: 'm1', content: 'Hello' }],
      hasMore: false,
    });

    const res = await request.get('/api/v1/chat/message/g1');

    console.log('TRACE [chat.integration.test.js]: Messages count:', res.body.data.messages.length);
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
  });

  it('GET /api/v1/chat/search?query=john — Search Users', async () => {
    console.log('TRACE [chat.integration.test.js]: Testing GET /api/v1/chat/search');
    mockSearchUsers.mockResolvedValue([{ _id: 'u1', username: 'john_doe' }]);

    const res = await request.get('/api/v1/chat/search?query=john');

    console.log('TRACE [chat.integration.test.js]: Found users:', res.body.data);
    expect(res.status).toBe(200);
    expect(res.body.data[0].username).toBe('john_doe');
  });
});
