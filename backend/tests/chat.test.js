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
const mockAddGroupAdmin = jest.fn();
const mockRemoveGroupAdmin = jest.fn();
const mockFindMessagesByIds = jest.fn();
const mockCreateManyMessages = jest.fn();
const mockDeleteManyMessages = jest.fn();
const mockIsParticipant = jest.fn();
const mockChatExists = jest.fn();

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
  addGroupAdmin: mockAddGroupAdmin,
  removeGroupAdmin: mockRemoveGroupAdmin,
  findMessagesByIds: mockFindMessagesByIds,
  createManyMessages: mockCreateManyMessages,
  deleteManyMessages: mockDeleteManyMessages,
  isParticipant: mockIsParticipant,
  chatExists: mockChatExists,
}));

jest.unstable_mockModule('../src/utils/cloudinary.js', () => ({
  uploadOnCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/fake.png' }),
}));

const chatService = await import('../src/services/chat.service.js');

describe('Chat Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsParticipant.mockResolvedValue(true);
    mockChatExists.mockResolvedValue(true);
    mockCreateManyMessages.mockImplementation((arr) =>
      Promise.resolve(
        arr.map((item, idx) => ({
          _id: `mMsg_${idx}`,
          ...item,
        }))
      )
    );
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
        groupAdmins: ['adminUser'],
      });
    });

    it('throws error if group name is empty', async () => {
      console.log('TRACE [chat.test.js]: Testing createGroup - empty name error validation');
      await expect(
        chatService.createGroup('adminUser', { chatName: '', participants: ['p1'] })
      ).rejects.toThrow(AppError);
    });
  });

  describe('renameGroup', () => {
    it('throws error if new group name is identical to current name', async () => {
      console.log('TRACE [chat.test.js]: Testing renameGroup - rejects identical name');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        chatName: 'Study Group',
        isGroup: true,
        groupAdmin: { _id: 'adminUser' },
        groupAdmins: [{ _id: 'adminUser' }],
      });

      await expect(
        chatService.renameGroup('g1', 'adminUser', 'Study Group')
      ).rejects.toThrow('New group name cannot be the same as the current name');
      console.log('TRACE [chat.test.js]: Same-name validation confirmed rejected');
    });

    it('renames group successfully when different name is provided by admin', async () => {
      console.log('TRACE [chat.test.js]: Testing renameGroup - successful rename');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        chatName: 'Study Group',
        isGroup: true,
        participants: ['adminUser', 'p1'],
        groupAdmin: { _id: 'adminUser' },
        groupAdmins: [{ _id: 'adminUser' }],
      });
      mockUpdateChat.mockResolvedValue({
        _id: 'g1',
        chatName: 'Advanced Study Group',
      });

      const res = await chatService.renameGroup('g1', 'adminUser', 'Advanced Study Group');
      expect(res.chatName).toBe('Advanced Study Group');
      expect(mockUpdateChat).toHaveBeenCalledWith('g1', { chatName: 'Advanced Study Group' });
      console.log('TRACE [chat.test.js]: Group rename verified successfully');
    });
  });

  describe('promoteToAdmin & demoteAdmin', () => {
    it('promotes member to group admin', async () => {
      console.log('TRACE [chat.test.js]: Testing promoteToAdmin - success');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        isGroup: true,
        participants: [{ _id: 'adminUser' }, { _id: 'member1' }],
        groupAdmin: { _id: 'adminUser' },
        groupAdmins: [{ _id: 'adminUser' }],
      });
      mockAddGroupAdmin.mockResolvedValue({
        _id: 'g1',
        groupAdmins: [{ _id: 'adminUser' }, { _id: 'member1' }],
      });

      const res = await chatService.promoteToAdmin('g1', 'adminUser', 'member1');
      expect(mockAddGroupAdmin).toHaveBeenCalledWith('g1', 'member1');
      expect(res.groupAdmins).toHaveLength(2);
      console.log('TRACE [chat.test.js]: Member promoted to admin verified');
    });

    it('demotes admin to regular member', async () => {
      console.log('TRACE [chat.test.js]: Testing demoteAdmin - success');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        isGroup: true,
        participants: [{ _id: 'adminUser' }, { _id: 'admin2' }],
        groupAdmin: { _id: 'adminUser' },
        groupAdmins: [{ _id: 'adminUser' }, { _id: 'admin2' }],
      });
      mockRemoveGroupAdmin.mockResolvedValue({
        _id: 'g1',
        groupAdmins: [{ _id: 'adminUser' }],
      });

      const res = await chatService.demoteAdmin('g1', 'adminUser', 'admin2');
      expect(mockRemoveGroupAdmin).toHaveBeenCalledWith('g1', 'admin2');
      expect(res.groupAdmins).toHaveLength(1);
      console.log('TRACE [chat.test.js]: Admin demoted to member verified');
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

  describe('deleteMultipleMessages', () => {
    it('bulk deletes multiple messages owned by the user', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMultipleMessages - success');
      mockDeleteManyMessages.mockResolvedValue(['m1', 'm2']);

      const res = await chatService.deleteMultipleMessages('user1', {
        chatId: 'chat1',
        messageIds: ['m1', 'm2'],
      });
      console.log('TRACE [chat.test.js]: Bulk delete result:', res);
      expect(res.success).toBe(true);
      expect(res.deletedIds).toEqual(['m1', 'm2']);
      expect(mockDeleteManyMessages).toHaveBeenCalledWith(['m1', 'm2'], 'user1');
    });

    it('throws error if messageIds is empty', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMultipleMessages - empty messageIds error');
      await expect(
        chatService.deleteMultipleMessages('user1', { chatId: 'chat1', messageIds: [] })
      ).rejects.toThrow(AppError);
    });
  });

  describe('forwardMessages', () => {
    it('forwards messages chronologically based on createdAt timestamp', async () => {
      console.log('TRACE [chat.test.js]: Testing forwardMessages - chronological ordering');
      mockFindChatById.mockResolvedValue({
        _id: 'chat2',
        participants: ['user1', 'user2'],
      });

      mockFindMessagesByIds.mockResolvedValue([
        {
          _id: 'm2',
          content: 'Second message',
          createdAt: new Date('2026-09-11T12:05:00Z'),
        },
        {
          _id: 'm1',
          content: 'First message',
          createdAt: new Date('2026-09-11T12:00:00Z'),
        },
      ]);

      mockCreateManyMessages.mockImplementation((msgs) =>
        Promise.resolve(msgs.map((m) => ({ _id: `fwd_${m.content}`, ...m })))
      );

      const forwarded = await chatService.forwardMessages('user1', {
        targetChatId: 'chat2',
        messageIds: ['m2', 'm1'], // passed out of chronological order
      });

      console.log('TRACE [chat.test.js]: Forwarded result chronologically ordered:', forwarded);
      expect(forwarded).toHaveLength(2);
      expect(forwarded[0].content).toBe('First message');
      expect(forwarded[1].content).toBe('Second message');
      expect(mockCreateManyMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('pinMessage 3-pin limit', () => {
    it('throws error when trying to pin more than 3 messages', async () => {
      console.log('TRACE [chat.test.js]: Testing 3-pin limit enforcement');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: ['user1'],
        pinnedMessages: ['p1', 'p2', 'p3'],
      });

      await expect(
        chatService.pinMessage('user1', { chatId: 'chat1', messageId: 'p4' })
      ).rejects.toThrow('Maximum of 3 pinned messages allowed per chat');
    });

    it('allows pinning if under 3 messages', async () => {
      console.log('TRACE [chat.test.js]: Testing pin under limit');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: ['user1'],
        pinnedMessages: ['p1'],
      });
      mockPinChatMessage.mockResolvedValue({ _id: 'chat1', pinnedMessages: ['p1', 'p2'] });

      const res = await chatService.pinMessage('user1', { chatId: 'chat1', messageId: 'p2' });
      expect(mockPinChatMessage).toHaveBeenCalledWith('chat1', 'p2');
    });
  });

  describe('updateGroupImage admin validation', () => {
    it('allows secondary admin in groupAdmins array to update group image', async () => {
      console.log('TRACE [chat.test.js]: Testing secondary admin in groupAdmins can update group image');
      mockFindChatById.mockResolvedValue({
        _id: 'groupChat1',
        isGroup: true,
        groupAdmin: { _id: 'primaryAdmin' },
        groupAdmins: [{ _id: 'secondaryAdmin' }],
        participants: ['primaryAdmin', 'secondaryAdmin', 'user3'],
      });
      mockUpdateChat.mockResolvedValue({ _id: 'groupChat1', groupImage: 'https://cloudinary.com/fake.png' });

      const updated = await chatService.updateGroupImage('groupChat1', 'secondaryAdmin', '/tmp/fake.png');
      expect(updated).toBeDefined();
      expect(mockUpdateChat).toHaveBeenCalled();
    });
  });

  describe('getMessages participant & existence validation', () => {
    it('returns messages when user is a participant', async () => {
      console.log('TRACE [chat.test.js]: Testing getMessages for participant');
      mockIsParticipant.mockResolvedValue(true);
      mockGetMessages.mockResolvedValue({ messages: [{ _id: 'm1' }], hasMore: false });

      const res = await chatService.getMessages('c1', 'u1', { limit: 10 });
      expect(res.messages).toHaveLength(1);
      expect(mockIsParticipant).toHaveBeenCalledWith('c1', 'u1');
    });

    it('throws 404 when chat does not exist', async () => {
      console.log('TRACE [chat.test.js]: Testing getMessages when chat does not exist');
      mockIsParticipant.mockResolvedValue(false);
      mockChatExists.mockResolvedValue(false);

      await expect(chatService.getMessages('cMissing', 'u1')).rejects.toThrow('Chat not found');
    });

    it('throws 403 when user is not a participant', async () => {
      console.log('TRACE [chat.test.js]: Testing getMessages when user is not participant');
      mockIsParticipant.mockResolvedValue(false);
      mockChatExists.mockResolvedValue(true);

      await expect(chatService.getMessages('c1', 'unauthorizedUser')).rejects.toThrow(
        'You are not a participant in this chat'
      );
    });
  });

  describe('markAsRead participant & existence validation', () => {
    it('marks messages as read when user is participant', async () => {
      console.log('TRACE [chat.test.js]: Testing markAsRead success');
      mockIsParticipant.mockResolvedValue(true);
      mockMarkMessagesAsRead.mockResolvedValue(true);

      const res = await chatService.markAsRead('c1', 'u1');
      expect(res).toBe(true);
      expect(mockMarkMessagesAsRead).toHaveBeenCalledWith('c1', 'u1');
    });

    it('throws 404 when chat does not exist on markAsRead', async () => {
      console.log('TRACE [chat.test.js]: Testing markAsRead non-existent chat');
      mockIsParticipant.mockResolvedValue(false);
      mockChatExists.mockResolvedValue(false);

      await expect(chatService.markAsRead('cMissing', 'u1')).rejects.toThrow('Chat not found');
    });

    it('throws 403 when user is not a participant on markAsRead', async () => {
      console.log('TRACE [chat.test.js]: Testing markAsRead non-participant');
      mockIsParticipant.mockResolvedValue(false);
      mockChatExists.mockResolvedValue(true);

      await expect(chatService.markAsRead('c1', 'unauth')).rejects.toThrow(
        'You are not a participant in this chat'
      );
    });
  });

  describe('deleteMultipleMessages validation', () => {
    it('throws 400 if chatId is missing', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMultipleMessages missing chatId');
      await expect(
        chatService.deleteMultipleMessages('u1', { messageIds: ['m1'] })
      ).rejects.toThrow('Chat ID is required');
    });

    it('throws 403 if user is not participant of chatId', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteMultipleMessages non-participant');
      mockIsParticipant.mockResolvedValue(false);
      await expect(
        chatService.deleteMultipleMessages('u1', { chatId: 'c1', messageIds: ['m1'] })
      ).rejects.toThrow('You are not a participant in this chat');
    });
  });

  describe('leaveGroup admin cleanup', () => {
    it('updates groupAdmins to remove leaving admin when other admins remain', async () => {
      console.log('TRACE [chat.test.js]: Testing leaveGroup admin cleanup with remaining admins');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        isGroup: true,
        participants: [{ _id: 'admin1' }, { _id: 'admin2' }, { _id: 'member1' }],
        groupAdmin: { _id: 'admin1' },
        groupAdmins: [{ _id: 'admin1' }, { _id: 'admin2' }],
      });
      mockUpdateChat.mockResolvedValue({ _id: 'g1' });
      mockRemoveParticipant.mockResolvedValue({ _id: 'g1' });

      await chatService.leaveGroup('g1', 'admin1');

      expect(mockUpdateChat).toHaveBeenCalledWith('g1', {
        groupAdmin: 'admin2',
        groupAdmins: ['admin2'],
      });
      expect(mockRemoveParticipant).toHaveBeenCalledWith('g1', 'admin1');
    });

    it('deletes group when last participant leaves', async () => {
      console.log('TRACE [chat.test.js]: Testing leaveGroup when last participant leaves');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        isGroup: true,
        participants: [{ _id: 'soleUser' }],
        groupAdmin: { _id: 'soleUser' },
        groupAdmins: [{ _id: 'soleUser' }],
      });
      mockDeleteChat.mockResolvedValue(true);

      const res = await chatService.leaveGroup('g1', 'soleUser');
      expect(res).toBeNull();
      expect(mockDeleteChat).toHaveBeenCalledWith('g1');
    });
  });

  describe('sendMessage parallel media uploads', () => {
    it('parallelizes multi-file uploads and batch-creates messages with createManyMessages', async () => {
      console.log('TRACE [chat.test.js]: Testing parallel multi-file uploads');
      mockFindChatById.mockResolvedValue({
        _id: 'c1',
        participants: [{ _id: 'u1' }],
      });

      const files = [
        { path: '/tmp/img1.jpg', mimetype: 'image/jpeg' },
        { path: '/tmp/img2.png', mimetype: 'image/png' },
      ];

      const res = await chatService.sendMessage('u1', { chatId: 'c1', content: 'Here are pics' }, files);
      expect(mockCreateManyMessages).toHaveBeenCalled();
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(2);
      console.log('TRACE [chat.test.js]: Batch messages created in parallel successfully');
    });
  });
});
