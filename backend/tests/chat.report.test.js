import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockFind = jest.fn();
const mockCountDocuments = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.unstable_mockModule('../src/models/messageReport.model.js', () => ({
  MessageReport: {
    create: mockCreate,
    find: mockFind,
    countDocuments: mockCountDocuments,
    findByIdAndUpdate: mockFindByIdAndUpdate,
  },
}));

// Mock chat.service so chat.controller imports cleanly
jest.unstable_mockModule('../src/services/chat.service.js', () => ({
  accessOrCreateChat: jest.fn(),
  getUserChats: jest.fn(),
  createGroup: jest.fn(),
  renameGroup: jest.fn(),
  addToGroup: jest.fn(),
  removeFromGroup: jest.fn(),
  leaveGroup: jest.fn(),
  updateGroupImage: jest.fn(),
  sendMessage: jest.fn(),
  getMessages: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  markAsRead: jest.fn(),
  searchUsers: jest.fn(),
  searchMessagesInChat: jest.fn(),
  toggleMessageReaction: jest.fn(),
  pinMessage: jest.fn(),
  unpinMessage: jest.fn(),
}));

const { reportMessage, getReportedMessages, updateReportStatus } = await import(
  '../src/controllers/chat.controller.js'
);

describe('Message Report Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reportMessage', () => {
    it('returns 400 if messageId is missing', async () => {
      console.log('TRACE [chat.report.test.js]: Testing reportMessage validation with missing messageId');
      const req = {
        body: { chatId: 'c1', reason: 'Spam' },
        user: { _id: 'u1' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await reportMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'messageId is required' })
      );
      console.log('TRACE [chat.report.test.js]: 400 returned for missing messageId as expected');
    });

    it('creates message report successfully and returns 201', async () => {
      console.log('TRACE [chat.report.test.js]: Testing successful message report creation');
      const req = {
        body: {
          messageId: 'm123',
          chatId: 'c1',
          senderId: 'u2',
          messageContent: 'Abusive language text here',
          reason: 'Harassment / Abusive content',
        },
        user: { _id: 'u1' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const createdReport = {
        _id: 'rep_1',
        reportedBy: 'u1',
        messageId: 'm123',
        chatId: 'c1',
        senderId: 'u2',
        messageContent: 'Abusive language text here',
        reason: 'Harassment / Abusive content',
        status: 'pending',
      };
      mockCreate.mockResolvedValue(createdReport);

      await reportMessage(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          reportedBy: 'u1',
          messageId: 'm123',
          chatId: 'c1',
          senderId: 'u2',
          messageContent: 'Abusive language text here',
          reason: 'Harassment / Abusive content',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: createdReport });
      console.log('TRACE [chat.report.test.js]: Message report created with 201 response');
    });
  });

  describe('getReportedMessages', () => {
    it('queries reports with pagination and populated fields', async () => {
      console.log('TRACE [chat.report.test.js]: Testing getReportedMessages listing');
      const req = {
        query: { page: '1', limit: '10', status: 'pending' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { _id: 'rep_1', messageContent: 'spam', status: 'pending' },
        ]),
      };

      mockFind.mockReturnValue(mockQueryChain);
      mockCountDocuments.mockResolvedValue(1);

      await getReportedMessages(req, res, next);

      expect(mockFind).toHaveBeenCalledWith({ status: 'pending' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ _id: 'rep_1', messageContent: 'spam', status: 'pending' }],
          pagination: { totalDocs: 1, totalPages: 1, page: 1, limit: 10 },
        })
      );
      console.log('TRACE [chat.report.test.js]: Reported messages listing and pagination verified');
    });
  });

  describe('updateReportStatus', () => {
    it('updates report status and returns updated report', async () => {
      console.log('TRACE [chat.report.test.js]: Testing updateReportStatus');
      const req = {
        body: { reportId: 'rep_1', status: 'reviewed' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      mockFindByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'rep_1', status: 'reviewed' }),
      });

      await updateReportStatus(req, res, next);

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith('rep_1', { status: 'reviewed' }, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: 'rep_1', status: 'reviewed' },
      });
      console.log('TRACE [chat.report.test.js]: Report status updated successfully');
    });
  });
});
