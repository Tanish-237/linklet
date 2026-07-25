import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockCreateQuestion    = jest.fn();
const mockGetQuestionsFeed  = jest.fn();
const mockGetQuestion       = jest.fn();
const mockVoteQuestion      = jest.fn();
const mockDeleteQuestion    = jest.fn();
const mockPostAnswer        = jest.fn();
const mockVoteAnswer        = jest.fn();
const mockAcceptAnswer      = jest.fn();
const mockDeleteAnswer      = jest.fn();
const mockAddComment        = jest.fn();
const mockVoteComment       = jest.fn();
const mockDeleteComment     = jest.fn();
const mockGetTagCloud       = jest.fn();
const mockGetForumStats     = jest.fn();

jest.unstable_mockModule('../src/services/question.service.js', () => ({
  createQuestion: mockCreateQuestion,
  getQuestionsFeed: mockGetQuestionsFeed,
  getQuestion: mockGetQuestion,
  voteQuestion: mockVoteQuestion,
  deleteQuestion: mockDeleteQuestion,
  postAnswer: mockPostAnswer,
  voteAnswer: mockVoteAnswer,
  acceptAnswer: mockAcceptAnswer,
  deleteAnswer: mockDeleteAnswer,
  addComment: mockAddComment,
  voteComment: mockVoteComment,
  deleteComment: mockDeleteComment,
  getTagCloud: mockGetTagCloud,
  getForumStats: mockGetForumStats,
}));

// Mock auth middleware to automatically inject test user
const mockAuthMiddleware = (req, res, next) => {
  req.user = { _id: 'user123', username: 'testuser', role: 'user' };
  next();
};

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: mockAuthMiddleware,
}));

const questionRouter = (await import('../src/routes/question.routes.js')).default;

// Express setup
const app = express();
app.use(express.json());
app.use('/api/questions', questionRouter);
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ success: false, message: err.message });
});

const request = supertest(app);

// ─────────────────────────────────────────────────────────────────────────────

describe('Question Forum Routes — Integration API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('\n──────────────────────────────────────────');
  });

  // ── Public Metadata Routes ──────────────────────────────────────────────────
  describe('GET /api/questions/metadata', () => {
    it('should return categories and suggested tags', async () => {
      console.log('[INTEGRATION TEST] GET /api/questions/metadata');
      const res = await request.get('/api/questions/metadata');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeInstanceOf(Array);
      expect(res.body.data.suggestedTags).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/questions/tags', () => {
    it('should return tag cloud array', async () => {
      console.log('[INTEGRATION TEST] GET /api/questions/tags');
      mockGetTagCloud.mockResolvedValue(['react', 'nodejs']);

      const res = await request.get('/api/questions/tags');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(['react', 'nodejs']);
    });
  });

  // ── Question Feed & CRUD Routes ─────────────────────────────────────────────
  describe('POST /api/questions', () => {
    it('should create a question and return 201', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions');
      const mockQuestion = { _id: 'q1', title: 'When is exam result?', category: 'Exams' };
      mockCreateQuestion.mockResolvedValue(mockQuestion);

      const res = await request
        .post('/api/questions')
        .send({ title: 'When is exam result?', category: 'Exams' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockQuestion);
      expect(mockCreateQuestion).toHaveBeenCalledWith('user123', {
        title: 'When is exam result?',
        category: 'Exams',
      });
    });

    it('should return 400 when title is missing', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions › missing title');
      mockCreateQuestion.mockRejectedValue(new AppError('Title is required', 400));

      const res = await request.post('/api/questions').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Title is required');
    });
  });

  describe('GET /api/questions/feed', () => {
    it('should return paginated questions feed', async () => {
      console.log('[INTEGRATION TEST] GET /api/questions/feed');
      mockGetQuestionsFeed.mockResolvedValue({
        questions: [{ _id: 'q1', title: 'Feed Item' }],
        nextCursor: null,
        hasMore: false,
      });

      const res = await request.get('/api/questions/feed?filter=popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/questions/:questionId', () => {
    it('should return single question details', async () => {
      console.log('[INTEGRATION TEST] GET /api/questions/:questionId');
      mockGetQuestion.mockResolvedValue({ _id: 'q1', title: 'Details' });

      const res = await request.get('/api/questions/q1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe('q1');
    });
  });

  describe('POST /api/questions/:questionId/vote', () => {
    it('should record question vote', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions/:questionId/vote');
      mockVoteQuestion.mockResolvedValue({ upvotes: 1, downvotes: 0 });

      const res = await request
        .post('/api/questions/q1/vote')
        .send({ voteType: 'upvote' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/questions/:questionId', () => {
    it('should delete a question', async () => {
      console.log('[INTEGRATION TEST] DELETE /api/questions/:questionId');
      mockDeleteQuestion.mockResolvedValue();

      const res = await request.delete('/api/questions/q1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Question deleted');
    });
  });

  // ── Answer Routes ───────────────────────────────────────────────────────────
  describe('POST /api/questions/:questionId/answers', () => {
    it('should post an answer to question', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions/:questionId/answers');
      mockPostAnswer.mockResolvedValue({ _id: 'a1', body: 'Helpful answer' });

      const res = await request
        .post('/api/questions/q1/answers')
        .send({ body: 'Helpful answer' });

      expect(res.status).toBe(201);
      expect(res.body.data._id).toBe('a1');
    });
  });

  describe('POST /api/questions/:questionId/answers/:answerId/accept', () => {
    it('should accept or toggle an answer', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions/:questionId/answers/:answerId/accept');
      mockAcceptAnswer.mockResolvedValue({ accepted: true });

      const res = await request.post('/api/questions/q1/answers/a1/accept');

      expect(res.status).toBe(200);
      expect(res.body.data.accepted).toBe(true);
    });
  });

  describe('DELETE /api/questions/:questionId/answers/:answerId', () => {
    it('should delete an answer', async () => {
      console.log('[INTEGRATION TEST] DELETE /api/questions/:questionId/answers/:answerId');
      mockDeleteAnswer.mockResolvedValue();

      const res = await request.delete('/api/questions/q1/answers/a1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Answer deleted');
    });
  });

  // ── Comment Routes ──────────────────────────────────────────────────────────
  describe('POST /api/questions/:questionId/answers/:answerId/comments', () => {
    it('should add comment to an answer', async () => {
      console.log('[INTEGRATION TEST] POST /api/questions/:questionId/answers/:answerId/comments');
      mockAddComment.mockResolvedValue({ _id: 'a1', comments: [{ text: 'Great comment' }] });

      const res = await request
        .post('/api/questions/q1/answers/a1/comments')
        .send({ text: 'Great comment' });

      expect(res.status).toBe(201);
      expect(res.body.data._id).toBe('a1');
    });
  });

  describe('POST /api/questions/:questionId/answers/:answerId/comments/:commentId/vote', () => {
    it('should vote on a comment and return 200', async () => {
      console.log('[INTEGRATION TEST] POST comment vote route');
      mockVoteComment.mockResolvedValue({ _id: 'a1', comments: [{ _id: 'c1', upvotes: ['user123'] }] });

      const res = await request
        .post('/api/questions/q1/answers/a1/comments/c1/vote')
        .send({ voteType: 'upvote' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockVoteComment).toHaveBeenCalledWith('q1', 'a1', 'c1', 'user123', 'upvote');
    });
  });

  describe('DELETE /api/questions/:questionId/answers/:answerId/comments/:commentId', () => {
    it('should delete a comment from an answer', async () => {
      console.log('[INTEGRATION TEST] DELETE comment route');
      mockDeleteComment.mockResolvedValue({ _id: 'a1', comments: [] });

      const res = await request.delete('/api/questions/q1/answers/a1/comments/c1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
