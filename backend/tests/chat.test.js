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
const mockGetBlockStatus = jest.fn();
const mockFilterExistingUserIds = jest.fn();
const mockFindMessagesByClientId = jest.fn();
const mockFindUserChatsByIds = jest.fn();
const mockFindMemberSettingsByUser = jest.fn();
const mockFindMemberSetting = jest.fn();
const mockUpsertMemberSetting = jest.fn();
const mockCountPinnedChats = jest.fn();
const mockDeleteMemberSetting = jest.fn();
const mockRefreshLastMessage = jest.fn();
const mockHideMessagesForUser = jest.fn();
const mockCountUnreadMessages = jest.fn();

jest.unstable_mockModule('../src/repositories/chat.repository.js', () => ({
  createChat: mockCreateChat,
  findChatById: mockFindChatById,
  findOneToOneChat: mockFindOneToOneChat,
  findChatsByUser: mockFindChatsByUser,
  findUserChatsByIds: mockFindUserChatsByIds,
  updateChat: mockUpdateChat,
  addParticipants: mockAddParticipants,
  removeParticipant: mockRemoveParticipant,
  deleteChat: mockDeleteChat,
  createMessage: mockCreateMessage,
  getMessages: mockGetMessages,
  updateMessage: mockUpdateMessage,
  deleteMessage: mockDeleteMessage,
  findMessageById: mockFindMessageById,
  findMessagesByClientId: mockFindMessagesByClientId,
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
  getBlockStatus: mockGetBlockStatus,
  filterExistingUserIds: mockFilterExistingUserIds,
  findMemberSettingsByUser: mockFindMemberSettingsByUser,
  findMemberSetting: mockFindMemberSetting,
  upsertMemberSetting: mockUpsertMemberSetting,
  countPinnedChats: mockCountPinnedChats,
  deleteMemberSetting: mockDeleteMemberSetting,
  refreshLastMessage: mockRefreshLastMessage,
  hideMessagesForUser: mockHideMessagesForUser,
  countUnreadMessages: mockCountUnreadMessages,
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
    mockGetBlockStatus.mockResolvedValue({ iBlockedThem: false, theyBlockedMe: false });
    mockFilterExistingUserIds.mockImplementation(async (ids) => ids);
    mockCreateManyMessages.mockImplementation((arr) =>
      Promise.resolve(
        arr.map((item, idx) => ({
          _id: `mMsg_${idx}`,
          ...item,
        }))
      )
    );
    mockFindMessagesByClientId.mockResolvedValue([]);
    mockFindMemberSetting.mockResolvedValue(null);
    mockFindMemberSettingsByUser.mockResolvedValue([]);
    mockFindUserChatsByIds.mockResolvedValue([]);
    mockCountPinnedChats.mockResolvedValue(0);
    mockDeleteMemberSetting.mockResolvedValue({ deletedCount: 1 });
    mockUpsertMemberSetting.mockImplementation(async (chatId, userId, update) => ({
      chat: chatId,
      user: userId,
      pinned: false,
      muted: false,
      archived: false,
      clearedAt: null,
      ...update,
    }));
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

    it('blocks sending a direct message if the sender has blocked the recipient', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - sender blocked recipient');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        isGroup: false,
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      mockGetBlockStatus.mockResolvedValue({ iBlockedThem: true, theyBlockedMe: false });

      await expect(
        chatService.sendMessage('user1', { chatId: 'chat1', content: 'Hi' })
      ).rejects.toThrow('You have blocked this user');
      expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it('blocks sending a direct message if the recipient has blocked the sender', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - recipient blocked sender');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        isGroup: false,
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      mockGetBlockStatus.mockResolvedValue({ iBlockedThem: false, theyBlockedMe: true });

      await expect(
        chatService.sendMessage('user1', { chatId: 'chat1', content: 'Hi' })
      ).rejects.toThrow('You cannot send messages to this user');
      expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it('does not enforce blocking in group chats', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - blocking exempt in groups');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        isGroup: true,
        participants: [{ _id: 'user1' }, { _id: 'user2' }, { _id: 'user3' }],
      });
      const createdMsg = { _id: 'm1', content: 'Hello group', chat: 'chat1', sender: 'user1' };
      mockCreateMessage.mockResolvedValue(createdMsg);

      const result = await chatService.sendMessage('user1', { chatId: 'chat1', content: 'Hello group' });
      expect(result).toBe(createdMsg);
      expect(mockGetBlockStatus).not.toHaveBeenCalled();
    });

    it('allows replying to a message that belongs to the same chat', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - valid same-chat replyTo');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      mockFindMessageById.mockResolvedValue({ _id: 'm0', chat: 'chat1' });
      const createdMsg = { _id: 'm1', content: 'Hello', chat: 'chat1', sender: 'user1', replyTo: 'm0' };
      mockCreateMessage.mockResolvedValue(createdMsg);

      const result = await chatService.sendMessage('user1', {
        chatId: 'chat1',
        content: 'Hello',
        replyTo: 'm0',
      });

      expect(result).toBe(createdMsg);
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'm0' })
      );
    });

    it('rejects replying to a message from a different chat (would leak its content)', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - cross-chat replyTo blocked');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      mockFindMessageById.mockResolvedValue({ _id: 'm0', chat: 'a-different-chat' });

      await expect(
        chatService.sendMessage('user1', {
          chatId: 'chat1',
          content: 'Hello',
          replyTo: 'm0',
        })
      ).rejects.toThrow('Cannot reply to a message from a different chat');
      expect(mockCreateMessage).not.toHaveBeenCalled();
    });
  });

  describe('toggleMessageReaction', () => {
    it('toggles reaction for chat participant', async () => {
      console.log('TRACE [chat.test.js]: Testing toggleMessageReaction - participant success');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      mockFindMessageById.mockResolvedValue({ _id: 'm1', chat: 'chat1' });
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

    it('rejects reacting to a message that belongs to a different chat', async () => {
      console.log('TRACE [chat.test.js]: Testing toggleMessageReaction - cross-chat message rejected');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      // Message actually lives in a chat the caller has nothing to do with
      mockFindMessageById.mockResolvedValue({ _id: 'm1', chat: 'someone-elses-chat' });

      await expect(
        chatService.toggleMessageReaction('user1', {
          chatId: 'chat1',
          messageId: 'm1',
          emoji: '❤️',
        })
      ).rejects.toThrow('Message does not belong to this chat');
      expect(mockToggleReaction).not.toHaveBeenCalled();
    });
  });

  describe('pinMessage & unpinMessage', () => {
    it('pins message for chat participant', async () => {
      console.log('TRACE [chat.test.js]: Testing pinMessage - participant success');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      mockFindMessageById.mockResolvedValue({ _id: 'm1', chat: 'chat1' });
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
      mockFindMessageById.mockResolvedValue({ _id: 'm1', chat: 'chat1' });
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

    it('rejects pinning a message that belongs to a different chat', async () => {
      console.log('TRACE [chat.test.js]: Testing pinMessage - cross-chat message rejected');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
        pinnedMessages: [],
      });
      mockFindMessageById.mockResolvedValue({ _id: 'm1', chat: 'someone-elses-chat' });

      await expect(
        chatService.pinMessage('user1', { chatId: 'chat1', messageId: 'm1' })
      ).rejects.toThrow('Message does not belong to this chat');
      expect(mockPinChatMessage).not.toHaveBeenCalled();
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

      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: ['user1', 'user2'],
        lastMessage: { _id: 'm0', content: 'earlier' },
      });

      const res = await chatService.deleteMessage('user1', { chatId: 'chat1', messageId: 'm1' });
      console.log('TRACE [chat.test.js]: Message deleted successfully:', res);
      expect(res.success).toBe(true);
      // The chat's preview is repointed at the newest surviving message
      expect(mockRefreshLastMessage).toHaveBeenCalledWith('chat1');
      expect(res.preview.lastMessage).toEqual({ _id: 'm0', content: 'earlier' });
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
      expect(res.hiddenIds).toEqual([]);
      expect(mockDeleteManyMessages).toHaveBeenCalledWith(['m1', 'm2'], 'user1');
      expect(mockHideMessagesForUser).not.toHaveBeenCalled();
    });

    it('hides (rather than silently skips) selected messages sent by someone else', async () => {
      mockIsParticipant.mockResolvedValue(true);
      mockDeleteManyMessages.mockResolvedValue(['m1']);
      mockFindChatById.mockResolvedValue({ _id: 'chat1', participants: ['user1', 'user2'], lastMessage: null });

      const res = await chatService.deleteMultipleMessages('user1', {
        chatId: 'chat1',
        messageIds: ['m1', 'theirs'],
      });

      expect(res.deletedIds).toEqual(['m1']);
      expect(res.hiddenIds).toEqual(['theirs']);
      expect(mockHideMessagesForUser).toHaveBeenCalledWith('chat1', ['theirs'], 'user1');
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

    it('rejects forwarding a message the caller is not a participant of in its source chat', async () => {
      console.log('TRACE [chat.test.js]: Testing forwardMessages - blocks reading a message from a foreign chat');
      mockFindChatById.mockResolvedValue({
        _id: 'chat2',
        participants: ['user1', 'user2'],
      });

      mockFindMessagesByIds.mockResolvedValue([
        {
          _id: 'secret1',
          content: 'private message from a chat user1 is not in',
          chat: 'chat_user1_is_not_in',
          createdAt: new Date('2026-09-11T12:00:00Z'),
        },
      ]);

      // The caller is not a member of the source chat this message actually lives in
      mockIsParticipant.mockImplementation(async (chatId) => chatId !== 'chat_user1_is_not_in');

      await expect(
        chatService.forwardMessages('user1', {
          targetChatId: 'chat2',
          messageIds: ['secret1'],
        })
      ).rejects.toThrow('You are not authorized to forward one or more of these messages');
      expect(mockCreateManyMessages).not.toHaveBeenCalled();
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
      mockFindMessageById.mockResolvedValue({ _id: 'p2', chat: 'chat1' });
      mockPinChatMessage.mockResolvedValue({ _id: 'chat1', pinnedMessages: ['p1', 'p2'] });

      await chatService.pinMessage('user1', { chatId: 'chat1', messageId: 'p2' });
      expect(mockPinChatMessage).toHaveBeenCalledWith('chat1', 'p2');
    });
  });

  describe('addToGroup', () => {
    it('only adds user IDs that correspond to a real account', async () => {
      console.log('TRACE [chat.test.js]: Testing addToGroup - filters out bogus user IDs');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        isGroup: true,
        participants: [{ _id: 'admin1' }],
        groupAdmin: { _id: 'admin1' },
        groupAdmins: [{ _id: 'admin1' }],
      });
      // "bogus-id" doesn't correspond to any real user
      mockFilterExistingUserIds.mockResolvedValue(['real-user-1']);
      mockAddParticipants.mockResolvedValue({ _id: 'chat1', participants: ['admin1', 'real-user-1'] });

      await chatService.addToGroup('chat1', 'admin1', ['real-user-1', 'bogus-id']);

      expect(mockFilterExistingUserIds).toHaveBeenCalledWith(['real-user-1', 'bogus-id']);
      expect(mockAddParticipants).toHaveBeenCalledWith('chat1', ['real-user-1']);
    });

    it('rejects when none of the provided user IDs correspond to a real account', async () => {
      console.log('TRACE [chat.test.js]: Testing addToGroup - all bogus IDs rejected');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        isGroup: true,
        participants: [{ _id: 'admin1' }],
        groupAdmin: { _id: 'admin1' },
        groupAdmins: [{ _id: 'admin1' }],
      });
      mockFilterExistingUserIds.mockResolvedValue([]);

      await expect(
        chatService.addToGroup('chat1', 'admin1', ['bogus-1', 'bogus-2'])
      ).rejects.toThrow('None of the provided user IDs correspond to a real account');
      expect(mockAddParticipants).not.toHaveBeenCalled();
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

    it('returns the original message and skips re-creating it when clientId was already used (idempotent resend)', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - idempotent resend via clientId');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }, { _id: 'user2' }],
      });
      const original = { _id: 'm1', content: 'Hello', chat: 'chat1', sender: 'user1', clientId: 'abc' };
      mockFindMessagesByClientId.mockResolvedValue([original]);

      const result = await chatService.sendMessage('user1', {
        chatId: 'chat1',
        content: 'Hello',
        clientId: 'abc',
      });

      console.log('TRACE [chat.test.js]: Resend returned original message instead of creating a new one:', result[chatService.DUPLICATE_SEND]);
      expect(result).toBe(original);
      expect(result[chatService.DUPLICATE_SEND]).toBe(true);
      expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it('recovers from a duplicate-key race by returning the winner instead of throwing', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - concurrent same-clientId race resolved via unique index');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      // Pre-check passes (nothing found yet) — the OTHER concurrent request wins the insert.
      mockFindMessagesByClientId
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: 'winner', content: 'Hello', chat: 'chat1', sender: 'user1', clientId: 'race' }]);
      const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      mockCreateMessage.mockRejectedValue(dupError);

      const result = await chatService.sendMessage('user1', {
        chatId: 'chat1',
        content: 'Hello',
        clientId: 'race',
      });

      console.log('TRACE [chat.test.js]: Race resolved, returned winner message:', result._id);
      expect(result._id).toBe('winner');
      expect(result[chatService.DUPLICATE_SEND]).toBe(true);
    });

    it('ignores a malformed clientId instead of persisting it', async () => {
      console.log('TRACE [chat.test.js]: Testing sendMessage - clientId with disallowed characters is dropped');
      mockFindChatById.mockResolvedValue({
        _id: 'chat1',
        participants: [{ _id: 'user1' }],
      });
      mockCreateMessage.mockImplementation((data) => ({ _id: 'm1', ...data }));

      await chatService.sendMessage('user1', {
        chatId: 'chat1',
        content: 'Hi',
        clientId: 'not valid! id/with slashes',
      });

      expect(mockFindMessagesByClientId).not.toHaveBeenCalled();
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.not.objectContaining({ clientId: expect.anything() })
      );
    });
  });

  describe('getMessages "delete for me" cutoff', () => {
    it('passes the caller\'s clearedAt setting through as the `after` filter', async () => {
      console.log('TRACE [chat.test.js]: Testing getMessages - clearedAt from member settings is forwarded to the repo');
      const clearedAt = new Date('2026-01-01T00:00:00.000Z');
      mockFindMemberSetting.mockResolvedValue({ chat: 'c1', user: 'u1', clearedAt });
      mockGetMessages.mockResolvedValue({ messages: [], hasMore: false, nextCursor: null });

      await chatService.getMessages('c1', 'u1', { limit: 10 });

      expect(mockGetMessages).toHaveBeenCalledWith('c1', expect.objectContaining({ after: clearedAt }));
    });
  });

  describe('chat-level settings: pin / mute / archive / delete-for-me', () => {
    beforeEach(() => {
      mockIsParticipant.mockResolvedValue(true);
    });

    it('setChatPinned(true) persists pinned + pinnedAt', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatPinned - pin a chat');
      const result = await chatService.setChatPinned('u1', 'c1', true);
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith(
        'c1', 'u1', expect.objectContaining({ pinned: true, pinnedAt: expect.any(Date) })
      );
      expect(result.pinned).toBe(true);
    });

    it('setChatPinned(false) clears pinnedAt', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatPinned - unpin a chat');
      await chatService.setChatPinned('u1', 'c1', false);
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith(
        'c1', 'u1', expect.objectContaining({ pinned: false, pinnedAt: null })
      );
    });

    it('rejects pinning past MAX_PINNED_CHATS', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatPinned - over the pin cap is rejected');
      mockCountPinnedChats.mockResolvedValue(5);
      mockFindMemberSetting.mockResolvedValue(null);

      await expect(chatService.setChatPinned('u1', 'c6', true)).rejects.toThrow(
        /only pin up to/i
      );
      expect(mockUpsertMemberSetting).not.toHaveBeenCalled();
    });

    it('re-pinning an already-pinned chat does not count against the cap', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatPinned - re-pin does not double count');
      mockCountPinnedChats.mockResolvedValue(5);
      mockFindMemberSetting.mockResolvedValue({ chat: 'c1', user: 'u1', pinned: true });

      await expect(chatService.setChatPinned('u1', 'c1', true)).resolves.toBeTruthy();
    });

    it('setChatMuted persists the muted flag', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatMuted');
      await chatService.setChatMuted('u1', 'c1', true);
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith('c1', 'u1', { muted: true });
    });

    it('setChatArchived persists the archived flag', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatArchived');
      await chatService.setChatArchived('u1', 'c1', true);
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith('c1', 'u1', { archived: true });
    });

    it('rejects a settings change from a non-participant', async () => {
      console.log('TRACE [chat.test.js]: Testing setChatMuted - non-participant rejected');
      mockIsParticipant.mockResolvedValue(false);
      mockChatExists.mockResolvedValue(true);
      await expect(chatService.setChatMuted('intruder', 'c1', true)).rejects.toThrow(
        'You are not a participant in this chat'
      );
    });

    it('clearChatForUser sets clearedAt and un-archives the chat', async () => {
      console.log('TRACE [chat.test.js]: Testing clearChatForUser - "delete chat for me"');
      await chatService.clearChatForUser('u1', 'c1');
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith(
        'c1', 'u1', expect.objectContaining({ clearedAt: expect.any(Date), archived: false })
      );
    });
  });

  describe('deleteChatForUser', () => {
    it('delegates to leaveGroup for a group chat', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteChatForUser - group chat delegates to leaveGroup');
      mockFindChatById.mockResolvedValue({
        _id: 'g1',
        isGroup: true,
        participants: [{ _id: 'u1' }, { _id: 'u2' }],
        groupAdmins: [{ _id: 'u2' }],
        groupAdmin: { _id: 'u2' },
      });

      await chatService.deleteChatForUser('u1', 'g1');
      expect(mockRemoveParticipant).toHaveBeenCalledWith('g1', 'u1');
    });

    it('clears history for the caller only on a 1:1 chat, without deleting the Chat document', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteChatForUser - 1:1 chat is a per-user cutoff, not a hard delete');
      mockFindChatById.mockResolvedValue({
        _id: 'c1',
        isGroup: false,
        participants: [{ _id: 'u1' }, { _id: 'u2' }],
      });

      await chatService.deleteChatForUser('u1', 'c1');
      expect(mockUpsertMemberSetting).toHaveBeenCalledWith(
        'c1', 'u1', expect.objectContaining({ clearedAt: expect.any(Date) })
      );
      expect(mockDeleteChat).not.toHaveBeenCalled();
    });

    it('rejects deleting a chat the caller is not part of', async () => {
      console.log('TRACE [chat.test.js]: Testing deleteChatForUser - non-participant rejected');
      mockFindChatById.mockResolvedValue({
        _id: 'c1',
        isGroup: false,
        participants: [{ _id: 'u2' }],
      });

      await expect(chatService.deleteChatForUser('intruder', 'c1')).rejects.toThrow(
        'You are not a participant in this chat'
      );
    });
  });

  describe('getUserChats — pagination, pinned chats, and dead 1:1 chats', () => {
    it('drops a 1:1 chat whose other participant no longer resolves (deleted account)', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - deleted-user 1:1 chat is filtered out');
      // populate() silently omits a participant ref whose User document is gone,
      // so this chat comes back from the repo with only the caller in `participants`.
      mockFindChatsByUser.mockResolvedValue({
        chats: [
          { _id: 'live', isGroup: false, participants: [{ _id: 'u1' }, { _id: 'u2' }], updatedAt: new Date() },
          { _id: 'dead', isGroup: false, participants: [{ _id: 'u1' }], updatedAt: new Date() },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      const ids = result.chats.map((c) => c._id);
      console.log('TRACE [chat.test.js]: Chats returned after filtering:', ids);
      expect(ids).toContain('live');
      expect(ids).not.toContain('dead');
    });

    it('keeps a group chat even if a member left/was deleted', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - group chats are exempt from the dead-chat filter');
      mockFindChatsByUser.mockResolvedValue({
        chats: [{ _id: 'g1', isGroup: true, participants: [{ _id: 'u1' }], updatedAt: new Date() }],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      expect(result.chats.map((c) => c._id)).toContain('g1');
    });

    it('hides a chat cleared by the user until a newer message arrives', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - cleared chat stays hidden until a fresh message');
      const clearedAt = new Date('2026-01-01T00:00:00.000Z');
      mockFindMemberSettingsByUser.mockResolvedValue([
        { chat: 'c1', pinned: false, muted: false, archived: false, clearedAt },
      ]);
      mockFindChatsByUser.mockResolvedValue({
        chats: [{
          _id: 'c1', isGroup: false,
          participants: [{ _id: 'u1' }, { _id: 'u2' }],
          lastMessage: { createdAt: new Date('2025-12-31T00:00:00.000Z') },
          updatedAt: new Date('2025-12-31T00:00:00.000Z'),
        }],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      console.log('TRACE [chat.test.js]: Chats visible while stale (pre-cutoff):', result.chats.map((c) => c._id));
      expect(result.chats).toHaveLength(0);
    });

    it('re-shows a cleared chat once a message newer than the cutoff arrives', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - cleared chat reappears after a fresh message');
      const clearedAt = new Date('2026-01-01T00:00:00.000Z');
      mockFindMemberSettingsByUser.mockResolvedValue([
        { chat: 'c1', pinned: false, muted: false, archived: false, clearedAt },
      ]);
      mockFindChatsByUser.mockResolvedValue({
        chats: [{
          _id: 'c1', isGroup: false,
          participants: [{ _id: 'u1' }, { _id: 'u2' }],
          lastMessage: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        }],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      expect(result.chats.map((c) => c._id)).toContain('c1');
    });

    it('excludes pinned chat ids from the cursor query and prepends them, sorted by pinnedAt', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - pinned chats float to the top of page 1');
      mockFindMemberSettingsByUser.mockResolvedValue([
        { chat: 'p1', pinned: true, pinnedAt: new Date('2026-01-01T00:00:00.000Z'), muted: false, archived: false, clearedAt: null },
        { chat: 'p2', pinned: true, pinnedAt: new Date('2026-01-02T00:00:00.000Z'), muted: false, archived: false, clearedAt: null },
      ]);
      mockFindUserChatsByIds.mockResolvedValue([
        { _id: 'p1', isGroup: false, participants: [{ _id: 'u1' }, { _id: 'u2' }], updatedAt: new Date() },
        { _id: 'p2', isGroup: false, participants: [{ _id: 'u1' }, { _id: 'u3' }], updatedAt: new Date() },
      ]);
      mockFindChatsByUser.mockResolvedValue({
        chats: [{ _id: 'regular', isGroup: false, participants: [{ _id: 'u1' }, { _id: 'u4' }], updatedAt: new Date() }],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      const ids = result.chats.map((c) => c._id);
      console.log('TRACE [chat.test.js]: Order returned:', ids);
      // p2 was pinned more recently than p1, so it sorts first; both precede the unpinned chat.
      expect(ids).toEqual(['p2', 'p1', 'regular']);
      expect(mockFindChatsByUser).toHaveBeenCalledWith(
        'u1', expect.objectContaining({ excludeIds: ['p1', 'p2'] })
      );
    });

    it('does not re-fetch pinned chats on a later page (cursor present)', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - pinned chats only surface on page 1');
      mockFindMemberSettingsByUser.mockResolvedValue([
        { chat: 'p1', pinned: true, pinnedAt: new Date(), muted: false, archived: false, clearedAt: null },
      ]);
      mockFindChatsByUser.mockResolvedValue({ chats: [], hasMore: false, nextCursor: null });

      await chatService.getUserChats('u1', { cursor: 'some-cursor' });
      expect(mockFindUserChatsByIds).not.toHaveBeenCalled();
    });

    it('passes each chat through with pinned/muted/archived merged from settings', async () => {
      console.log('TRACE [chat.test.js]: Testing getUserChats - settings flags are merged onto each chat');
      mockFindMemberSettingsByUser.mockResolvedValue([
        { chat: 'c1', pinned: false, muted: true, archived: false, clearedAt: null },
      ]);
      mockFindChatsByUser.mockResolvedValue({
        chats: [{ _id: 'c1', isGroup: false, participants: [{ _id: 'u1' }, { _id: 'u2' }], updatedAt: new Date() }],
        hasMore: false,
        nextCursor: null,
      });

      const result = await chatService.getUserChats('u1');
      expect(result.chats[0]).toMatchObject({ pinned: false, muted: true, archived: false });
    });
  });
});
