import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockCreateChat = jest.fn();
const mockFindChatById = jest.fn();
const mockFindOneToOneChat = jest.fn();
const mockFindChatsByUser = jest.fn();
const mockUpdateChat = jest.fn();
const mockAddParticipants = jest.fn();
const mockRemoveParticipant = jest.fn();
const mockDeleteChat = jest.fn();
const mockCreateMessage = jest.fn();
const mockGetMessages = jest.fn();
const mockUpdateMessage = jest.fn();
const mockDeleteMessage = jest.fn();
const mockFindMessageById = jest.fn();
const mockMarkMessagesAsRead = jest.fn();
const mockSearchUsers = jest.fn();
const mockSearchMessagesInChat = jest.fn();
const mockToggleReaction = jest.fn();
const mockPinChatMessage = jest.fn();
const mockUnpinChatMessage = jest.fn();

jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  createChat: mockCreateChat,
  findChatById: mockFindChatById,
  findOneToOneChat: mockFindOneToOneChat,
  findChatsByUser: mockFindChatsByUser,
  updateChat: mockUpdateChat,
  addParticipants: mockAddParticipants,
  removeParticipant: mockRemoveParticipant,
  deleteChat: mockDeleteChat,
  createMessage: mockCreateMessage,
  getMessages: mockGetMessages,
  updateMessage: mockUpdateMessage,
  deleteMessage: mockDeleteMessage,
  findMessageById: mockFindMessageById,
  markMessagesAsRead: mockMarkMessagesAsRead,
  searchUsers: mockSearchUsers,
  searchMessagesInChat: mockSearchMessagesInChat,
  toggleReaction: mockToggleReaction,
  pinChatMessage: mockPinChatMessage,
  unpinChatMessage: mockUnpinChatMessage,
}));

jest.unstable_mockModule('../src/utils/cloudinary.js', () => ({
  uploadOnCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/fake.png' }),
}));

const chatService = await import('../src/services/chat.service.js');

describe('Chat Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('accessOrCreateChat', () => {
    it('returns existing chat if found', async () => {
      console.log('TRACE [chat.test.js]: Testing accessOrCreateChat - existing chat scenario');
      const existingChat = { _id: 'chat123', isGroup: false };
      mockFindOneToOneChat.mockResolvedValue(existingChat);

      const result = await chatService.accessOrCreateChat('user1', 'user2');
      console.log('TRACE [chat.test.js]: Result returned existing chat successfully:', result._id);
      expect(result).toBe(existingChat);
      expect(mockFindOneToOneChat).toHaveBeenCalledWith('user1', 'user2');
      expect(mockCreateChat).not.toHaveBeenCalled();
    });

    it('creates new 1:1 chat if none exists', async () => {
      console.log('TRACE [chat.test.js]: Testing accessOrCreateChat - create new chat scenario');
      mockFindOneToOneChat.mockResolvedValue(null);
      const newChat = { _id: 'chat456', isGroup: false, participants: ['user1', 'user2'] };
      mockCreateChat.mockResolvedValue(newChat);

      const result = await chatService.accessOrCreateChat('user1', 'user2');
      console.log('TRACE [chat.test.js]: Result created new chat successfully:', result._id);
      expect(result).toBe(newChat);
      expect(mockCreateChat).toHaveBeenCalledWith({
        chatName: 'Direct Message',
        isGroup: false,
        participants: ['user1', 'user2'],
      });
    });

    it('throws error if targetUserId is missing or same as userId', async () => {
      console.log('TRACE [chat.test.js]: Testing accessOrCreateChat - error validation');
      await expect(chatService.accessOrCreateChat('user1', null)).rejects.toThrow(AppError);
      await expect(chatService.accessOrCreateChat('user1', 'user1')).rejects.toThrow(AppError);
    });
  });

  describe('createGroup', () => {
    it('creates group with name and participants', async () => {
      console.log('TRACE [chat.test.js]: Testing createGroup - success');
      const createdGroup = { _id: 'g1', chatName: 'Study Group', isGroup: true };
      mockCreateChat.mockResolvedValue(createdGroup);

      const result = await chatService.createGroup('adminUser', {
        chatName: 'Study Group',
        participants: ['p1', 'p2'],
      });

      console.log('TRACE [chat.test.js]: Group created:', result.chatName);
      expect(result).toBe(createdGroup);
      expect(mockCreateChat).toHaveBeenCalledWith({
        chatName: 'Study Group',
        isGroup: true,
        participants: expect.arrayContaining(['adminUser', 'p1', 'p2']),
        groupAdmin: 'adminUser',
      });
    });

    it('throws error if group name is empty', async () => {
      console.log('TRACE [chat.test.js]: Testing createGroup - empty name error validation');
      await expect(
        chatService.createGroup('adminUser', { chatName: '', participants: ['p1'] })
      ).rejects.toThrow(AppError);
    });
  });

  describe('sendMessage', () => {
    it('sends text message successfully', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - text message');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      const createdMsg = { _id: 'm1', content: 'Hello', chat: 'chat1', sender: 'user1' };
      mockCreateMessage.mockResolvedValue(createdMsg);

      const result = await chatService.sendMessage('user1', {
        chatId: 'chat1',
        content: 'Hello',
      });

      console.log('TRACE [chat.test.js]: Message sent:', result.content);
      expect(result).toBe(createdMsg);
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'user1',
          chat: 'chat1',
          content: 'Hello',
        })
      );
    });

    it('handles audio voice notes file attachments', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - audio voice note upload');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      mockCreateMessage.mockImplementation((data) => ({
        _id: 'mAudio',
        ...data,
      }));

      const fakeAudioFile = {
        path: '/tmp/voicenote.webm',
        mimetype: 'audio/webm',
      };

      const result = await chatService.sendMessage(
        'user1',
        { chatId: 'chat1' },
        fakeAudioFile
      );

      console.log('TRACE [chat.test.js]: Audio message created:', result.mediaType);
      expect(result.mediaType).toBe('audio');
      expect(result.media).toBe('https://cloudinary.com/fake.png');
    });

    it('throws error if user is not in chat', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - non-participant error');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user2' }],
      });

      await expect(
        chatService.sendMessage('user1', { chatId: 'chat1', content: 'Hi' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('toggleMessageReaction', () => {
    it('toggles reaction for chat participant', async () => {
      console.log('TRACE [chat.test.js]: Testing toggleMessageReaction - participant success');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      const updatedMsg = {
        _id: 'm1',
        reactions: [{ user: 'user1', emoji: '❤️' }],
      };
      mockToggleReaction.mockResolvedValue(updatedMsg);

      const result = await chatService.toggleMessageReaction('user1', {
        chatId: 'chat1',
        messageId: 'm1',
        emoji: '❤️',
      });

      console.log('TRACE [chat.test.js]: Reaction toggled:', result.reactions);
      expect(result).toBe(updatedMsg);
      expect(mockToggleReaction).toHaveBeenCalledWith('m1', 'user1', '❤️');
    });
  });

  describe('pinMessage & unpinMessage', () => {
    it('pins message for chat participant', async () => {
      console.log('TRACE [chat.test.js]: Testing pinMessage - participant success');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      const updatedChat = { _id: 'chat1', pinnedMessages: ['m1'] };
      mockPinChatMessage.mockResolvedValue(updatedChat);

      const result = await chatService.pinMessage('user1', {
        chatId: 'chat1',
        messageId: 'm1',
      });

      console.log('TRACE [chat.test.js]: Message pinned in chat:', result.pinnedMessages);
      expect(result).toBe(updatedChat);
      expect(mockPinChatMessage).toHaveBeenCalledWith('chat1', 'm1');
    });

    it('unpins message for chat participant', async () => {
      console.log('TRACE [chat.test.js]: Testing unpinMessage - participant success');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      const updatedChat = { _id: 'chat1', pinnedMessages: [] };
      mockUnpinChatMessage.mockResolvedValue(updatedChat);

      const result = await chatService.unpinMessage('user1', {
        chatId: 'chat1',
        messageId: 'm1',
      });

      console.log('TRACE [chat.test.js]: Message unpinned from chat:', result.pinnedMessages);
      expect(result).toBe(updatedChat);
      expect(mockUnpinChatMessage).toHaveBeenCalledWith('chat1', 'm1');
    });
  });

  describe('deleteMessage', () => {
    it('deletes message if user is sender', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMessage - success');
      mockFindMessageById.mockResolvedValue({
        _id: 'm1',
        sender: { _id: 'user1' },
        chat: 'chat1',
      });
      mockDeleteMessage.mockResolvedValue(true);

      const res = await chatService.deleteMessage('user1', { chatId: 'chat1', messageId: 'm1' });
      console.log('TRACE [chat.test.js]: Message deleted successfully:', res);
      expect(res.success).toBe(true);
    });

    it('throws error if editing someone elses message', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMessage - unauthorized deletion error');
      mockFindMessageById.mockResolvedValue({
        _id: 'm1',
        sender: { _id: 'user2' },
        chat: 'chat1',
      });

      await expect(
        chatService.deleteMessage('user1', { chatId: 'chat1', messageId: 'm1' })
      ).rejects.toThrow(AppError);
    });
  });
});
