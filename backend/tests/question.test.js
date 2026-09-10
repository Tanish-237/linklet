import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mock: question.repository ─────────────────────────────────────────────────
const mockCreateQuestion = jest.fn();
const mockFindQuestionById = jest.fn();
const mockGetQuestionsFeed = jest.fn();
const mockVoteQuestion = jest.fn();
const mockAddAnswerToQuestion = jest.fn();
const mockAddAcceptedAnswer = jest.fn();
const mockRemoveAcceptedAnswer = jest.fn();
const mockDeleteQuestion = jest.fn();
const mockGetAllTags = jest.fn();
const mockGetQuestionStats = jest.fn();
const mockFindQuestionByIdAndIncrementViews = jest.fn();

jest.unstable_mockModule('../src/repositories/question.repository.js', () => ({
  createQuestion: mockCreateQuestion,
  findQuestionById: mockFindQuestionById,
  findQuestionByIdAndIncrementViews: mockFindQuestionByIdAndIncrementViews,
  getQuestionsFeed: mockGetQuestionsFeed,
  voteQuestion: mockVoteQuestion,
  addAnswerToQuestion: mockAddAnswerToQuestion,
  addAcceptedAnswer: mockAddAcceptedAnswer,
  removeAcceptedAnswer: mockRemoveAcceptedAnswer,
  deleteQuestion: mockDeleteQuestion,
  getAllTags: mockGetAllTags,
  getQuestionStats: mockGetQuestionStats,
}));

// ─── Mock: answer.repository ─────────────────────────────────────────────────
const mockCreateAnswer = jest.fn();
const mockFindAnswerById = jest.fn();
const mockVoteAnswer = jest.fn();
const mockSetAnswerAccepted = jest.fn();
const mockAddCommentToAnswer = jest.fn();
const mockVoteCommentOnAnswer = jest.fn();
const mockDeleteCommentFromAnswer = jest.fn();
const mockDeleteAnswer = jest.fn();

jest.unstable_mockModule('../src/repositories/answer.repository.js', () => ({
  createAnswer: mockCreateAnswer,
  findAnswerById: mockFindAnswerById,
  voteAnswer: mockVoteAnswer,
  setAnswerAccepted: mockSetAnswerAccepted,
  addCommentToAnswer: mockAddCommentToAnswer,
  voteCommentOnAnswer: mockVoteCommentOnAnswer,
  deleteCommentFromAnswer: mockDeleteCommentFromAnswer,
  deleteAnswer: mockDeleteAnswer,
}));

// ─── Mock: Question model (used directly in question.service for deleteAnswer) ─
jest.unstable_mockModule('../models/question.js', () => ({
  Question: { findByIdAndUpdate: jest.fn(), deleteMany: jest.fn() },
  QUESTION_CATEGORIES: ['General', 'Academic', 'Technical'],
  SUGGESTED_TAGS: ['react', 'nodejs'],
}));

// ─── Mock: Answer model (used in deleteQuestion) ──────────────────────────────
jest.unstable_mockModule('../models/answer.js', () => ({
  Answer: { deleteMany: jest.fn() },
}));

// ─── Import service (after mocks are set up) ──────────────────────────────────
const questionService = await import('../src/services/question.service.js');

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Question Service — Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('\n──────────────────────────────────────');
  });

  // ── createQuestion ─────────────────────────────────────────────────────────

  describe('createQuestion', () => {
    it('should create a question with parsed comma-separated tags', async () => {
      console.log('[TEST] createQuestion › parses comma-separated tag string');

      const userId = 'user123';
      const data = {
        title: 'How does React context work?',
        body: 'I want to understand how context propagates values down the tree.',
        category: 'Technical',
        tags: 'react, context, javascript',
      };

      const saved = { _id: 'q1', ...data, tags: ['react', 'context', 'javascript'] };
      mockCreateQuestion.mockResolvedValue(saved);

      const result = await questionService.createQuestion(userId, data);

      console.log('[TEST] result.tags:', result.tags);
      expect(mockCreateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          title: data.title,
          category: 'Technical',
          tags: expect.arrayContaining(['react', 'context', 'javascript']),
        })
      );
      expect(result.tags).toEqual(['react', 'context', 'javascript']);
    });

    it('should accept array tags', async () => {
      console.log('[TEST] createQuestion › accepts array tags');

      const saved = { _id: 'q2', tags: ['exam', 'cgpa'] };
      mockCreateQuestion.mockResolvedValue(saved);

      await questionService.createQuestion('u1', {
        title: 'Question about CGPA calculation rules at MNNIT',
        body: 'Can someone explain how CGPA is calculated from SGPA across all semesters?',
        tags: ['exam', 'cgpa'],
      });

      const call = mockCreateQuestion.mock.calls[0][0];
      console.log('[TEST] tags passed to repo:', call.tags);
      expect(call.tags).toEqual(['exam', 'cgpa']);
    });

    it('should default to General category when unknown category provided', async () => {
      console.log('[TEST] createQuestion › defaults to General for unknown category');

      mockCreateQuestion.mockResolvedValue({ _id: 'q3', category: 'General' });

      await questionService.createQuestion('u1', {
        title: 'A valid question title that is long enough for the check',
        body: 'This body is definitely long enough to pass the validation check here.',
        category: 'NonExistentCategory',
        tags: [],
      });

      const call = mockCreateQuestion.mock.calls[0][0];
      console.log('[TEST] category passed:', call.category);
      expect(call.category).toBe('General');
    });

    it('should throw AppError if title is missing', async () => {
      console.log('[TEST] createQuestion › throws on missing title');

      await expect(
        questionService.createQuestion('u1', { title: '', body: 'Some body content here' })
      ).rejects.toThrow(AppError);

      expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it('should limit tags to 10', async () => {
      console.log('[TEST] createQuestion › limits tags to 10');

      mockCreateQuestion.mockResolvedValue({ _id: 'q4', tags: [] });

      const tooManyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      await questionService.createQuestion('u1', {
        title: 'Question with too many tags being passed to the service here',
        body: 'Body content that is long enough to pass the minimum length check.',
        tags: tooManyTags,
      });

      const call = mockCreateQuestion.mock.calls[0][0];
      console.log('[TEST] tags length:', call.tags.length);
      expect(call.tags.length).toBe(10);
    });
  });

  // ── getQuestion ────────────────────────────────────────────────────────────

  describe('getQuestion', () => {
    it('should return question data and increment views for valid ObjectId', async () => {
      console.log('[TEST] getQuestion › increments views and returns data');

      const validId = '507f1f77bcf86cd799439011';
      const mockQ = { _id: validId, title: 'Some Question', views: 15 };
      mockFindQuestionByIdAndIncrementViews.mockResolvedValue(mockQ);

      const result = await questionService.getQuestion(validId);

      console.log('[TEST] result views:', result.views);
      expect(mockFindQuestionByIdAndIncrementViews).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockQ);
    });

    it('should throw 404 if question is not found in database', async () => {
      console.log('[TEST] getQuestion › throws 404 for missing question in DB');

      const validId = '507f1f77bcf86cd799439012';
      mockFindQuestionByIdAndIncrementViews.mockResolvedValue(null);

      await expect(questionService.getQuestion(validId)).rejects.toThrow(AppError);
    });

    it('should throw 404 for invalid question ID format', async () => {
      console.log('[TEST] getQuestion › throws 404 for malformed/invalid ObjectId');

      await expect(questionService.getQuestion('invalid-id-string')).rejects.toThrow(AppError);
      await expect(questionService.getQuestion('undefined')).rejects.toThrow(AppError);
      await expect(questionService.getQuestion('')).rejects.toThrow(AppError);
    });
  });

  // ── voteQuestion ───────────────────────────────────────────────────────────

  describe('voteQuestion', () => {
    it('should return vote counts after successful upvote', async () => {
      console.log('[TEST] voteQuestion › happy path upvote');

      const userId = 'voter1';
      const questionAuthorId = 'author1';

      mockFindQuestionById.mockResolvedValue({
        _id: 'q1',
        userId: { _id: questionAuthorId, username: 'author' },
        upvotes: [],
        downvotes: [],
      });

      mockVoteQuestion.mockResolvedValue({
        _id: 'q1',
        upvotes: [{ toString: () => userId }],
        downvotes: [],
      });

      const result = await questionService.voteQuestion('q1', userId, 'upvote');

      console.log('[TEST] vote result:', result);
      expect(result.upvotes).toBe(1);
      expect(result.downvotes).toBe(0);
    });

    it('should throw 403 if user votes on their own question', async () => {
      console.log('[TEST] voteQuestion › throws 403 for self-vote');

      const userId = 'author1';
      mockFindQuestionById.mockResolvedValue({
        _id: 'q1',
        userId: { _id: userId, toString: () => userId },
        upvotes: [],
        downvotes: [],
      });

      await expect(
        questionService.voteQuestion('q1', userId, 'upvote')
      ).rejects.toThrow(AppError);

      expect(mockVoteQuestion).not.toHaveBeenCalled();
    });

    it('should throw 400 for invalid vote type', async () => {
      console.log('[TEST] voteQuestion › throws 400 for invalid voteType');

      await expect(
        questionService.voteQuestion('q1', 'user1', 'sidewaysvote')
      ).rejects.toThrow(AppError);
    });
  });

  // ── postAnswer ─────────────────────────────────────────────────────────────

  describe('postAnswer', () => {
    it('should create an answer and add it to the question', async () => {
      console.log('[TEST] postAnswer › happy path');

      const mockAnswer = { _id: 'a1', body: 'This is a helpful answer' };
      mockFindQuestionById.mockResolvedValue({ _id: 'q1', isClosed: false });
      mockCreateAnswer.mockResolvedValue(mockAnswer);
      mockAddAnswerToQuestion.mockResolvedValue({});

      const result = await questionService.postAnswer('q1', 'u1', 'This is a helpful answer');

      console.log('[TEST] answer:', result);
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: 'q1', userId: 'u1' })
      );
      expect(mockAddAnswerToQuestion).toHaveBeenCalledWith('q1', 'a1');
      expect(result).toEqual(mockAnswer);
    });

    it('should throw 400 if answer body is empty', async () => {
      console.log('[TEST] postAnswer › throws on empty body');

      await expect(
        questionService.postAnswer('q1', 'u1', '   ')
      ).rejects.toThrow(AppError);
    });

    it('should throw 403 if question is closed', async () => {
      console.log('[TEST] postAnswer › throws 403 for closed question');

      mockFindQuestionById.mockResolvedValue({ _id: 'q1', isClosed: true });

      await expect(
        questionService.postAnswer('q1', 'u1', 'Valid answer body content here')
      ).rejects.toThrow(AppError);

      expect(mockCreateAnswer).not.toHaveBeenCalled();
    });
  });

  // ── voteAnswer ─────────────────────────────────────────────────────────────

  describe('voteAnswer', () => {
    it('should return vote counts after answer upvote', async () => {
      console.log('[TEST] voteAnswer › happy path upvote');

      const userId = 'voter1';
      const answerAuthorId = 'author1';

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        questionId: 'q1',
        userId: { _id: answerAuthorId, toString: () => answerAuthorId },
        upvotes: [],
        downvotes: [],
      });

      mockVoteAnswer.mockResolvedValue({
        _id: 'a1',
        upvotes: [{ toString: () => userId }],
        downvotes: [],
      });

      const result = await questionService.voteAnswer('q1', 'a1', userId, 'upvote');

      console.log('[TEST] vote result:', result);
      expect(result.upvotes).toBe(1);
    });

    it('should throw 403 if voting on own answer', async () => {
      console.log('[TEST] voteAnswer › throws 403 for self-vote');

      const userId = 'author1';
      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        questionId: 'q1',
        userId: { _id: userId, toString: () => userId },
      });

      await expect(
        questionService.voteAnswer('q1', 'a1', userId, 'upvote')
      ).rejects.toThrow(AppError);
    });

    it('should throw 400 if answer does not belong to question', async () => {
      console.log('[TEST] voteAnswer › throws 400 if answer belongs to different question');

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        questionId: 'different-question-id',
        userId: { _id: 'author1', toString: () => 'author1' },
      });

      await expect(
        questionService.voteAnswer('q1', 'a1', 'voter1', 'upvote')
      ).rejects.toThrow(AppError);
    });
  });

  // ── acceptAnswer ───────────────────────────────────────────────────────────

  describe('acceptAnswer', () => {
    it('should accept an answer when called by question author', async () => {
      console.log('[TEST] acceptAnswer › happy path acceptance');

      const questionAuthor = 'author1';
      mockFindQuestionById.mockResolvedValue({
        _id: 'q1',
        userId: { _id: questionAuthor, toString: () => questionAuthor },
      });
      mockFindAnswerById.mockResolvedValue({ _id: 'a1', isAccepted: false });
      mockAddAcceptedAnswer.mockResolvedValue({});
      mockSetAnswerAccepted.mockResolvedValue({});

      const result = await questionService.acceptAnswer('q1', 'a1', questionAuthor);

      console.log('[TEST] accept result:', result);
      expect(result.accepted).toBe(true);
      expect(mockSetAnswerAccepted).toHaveBeenCalledWith('a1', true);
    });

    it('should unmark an accepted answer when toggled', async () => {
      console.log('[TEST] acceptAnswer › unmark accepted answer');

      const questionAuthor = 'author1';
      mockFindQuestionById.mockResolvedValue({
        _id: 'q1',
        userId: { _id: questionAuthor, toString: () => questionAuthor },
      });
      mockFindAnswerById.mockResolvedValue({ _id: 'a1', isAccepted: true });
      mockRemoveAcceptedAnswer.mockResolvedValue({});
      mockSetAnswerAccepted.mockResolvedValue({});

      const result = await questionService.acceptAnswer('q1', 'a1', questionAuthor);

      console.log('[TEST] unmark result:', result);
      expect(result.accepted).toBe(false);
      expect(mockSetAnswerAccepted).toHaveBeenCalledWith('a1', false);
    });

    it('should throw 403 if non-author tries to accept', async () => {
      console.log('[TEST] acceptAnswer › throws 403 for non-author');

      mockFindQuestionById.mockResolvedValue({
        _id: 'q1',
        userId: { _id: 'author1', toString: () => 'author1' },
        acceptedAnswer: null,
      });

      await expect(
        questionService.acceptAnswer('q1', 'a1', 'not-the-author')
      ).rejects.toThrow(AppError);
    });
  });

  // ── addComment ─────────────────────────────────────────────────────────────

  describe('addComment', () => {
    it('should add a top-level comment to an answer', async () => {
      console.log('[TEST] addComment › happy path top-level');

      const updatedAnswer = {
        _id: 'a1',
        comments: [{ text: 'Great answer!', userId: 'u1', parentId: null }],
      };

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        questionId: 'q1',
      });
      mockAddCommentToAnswer.mockResolvedValue(updatedAnswer);

      const result = await questionService.addComment('q1', 'a1', 'u1', 'Great answer!');

      console.log('[TEST] updated answer comments count:', result.comments.length);
      expect(mockAddCommentToAnswer).toHaveBeenCalledWith('a1', 'u1', 'Great answer!', null);
      expect(result.comments).toHaveLength(1);
    });

    it('should add a nested reply comment to an answer', async () => {
      console.log('[TEST] addComment › happy path nested reply');

      const parentCommentId = 'c1';
      const updatedAnswer = {
        _id: 'a1',
        comments: [
          { _id: 'c1', text: 'Top level' },
          { _id: 'c2', text: 'Nested reply', parentId: parentCommentId },
        ],
      };

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        questionId: 'q1',
        comments: [{ _id: 'c1', text: 'Top level' }],
      });
      mockAddCommentToAnswer.mockResolvedValue(updatedAnswer);

      const result = await questionService.addComment('q1', 'a1', 'u2', 'Nested reply', parentCommentId);

      expect(mockAddCommentToAnswer).toHaveBeenCalledWith('a1', 'u2', 'Nested reply', parentCommentId);
      expect(result.comments).toHaveLength(2);
    });

    it('should throw 400 if comment text is empty', async () => {
      console.log('[TEST] addComment › throws on empty text');

      await expect(
        questionService.addComment('q1', 'a1', 'u1', '   ')
      ).rejects.toThrow(AppError);
    });

    it('should throw 400 if comment exceeds 1000 characters', async () => {
      console.log('[TEST] addComment › throws on text > 1000 chars');

      const longText = 'a'.repeat(1001);
      await expect(
        questionService.addComment('q1', 'a1', 'u1', longText)
      ).rejects.toThrow(AppError);
    });
  });

  // ── voteComment ────────────────────────────────────────────────────────────

  describe('voteComment', () => {
    it('should vote on a comment', async () => {
      console.log('[TEST] voteComment › happy path');

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        comments: [{ _id: 'c1', userId: { _id: 'u1' }, text: 'Comment text' }],
      });
      mockVoteCommentOnAnswer.mockResolvedValue({ _id: 'a1', comments: [] });

      await questionService.voteComment('q1', 'a1', 'c1', 'u2', 'upvote');
      expect(mockVoteCommentOnAnswer).toHaveBeenCalledWith('a1', 'c1', 'u2', 'upvote');
    });
  });

  // ── deleteComment ──────────────────────────────────────────────────────────

  describe('deleteComment', () => {
    it('should delete a comment when called by comment author', async () => {
      console.log('[TEST] deleteComment › happy path by comment author');

      const commentAuthor = 'user1';
      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        comments: [
          { _id: 'c1', userId: { _id: commentAuthor, toString: () => commentAuthor }, text: 'Hello' },
        ],
      });
      mockDeleteCommentFromAnswer.mockResolvedValue({ _id: 'a1', comments: [] });

      const result = await questionService.deleteComment('q1', 'a1', 'c1', commentAuthor, 'user');
      expect(mockDeleteCommentFromAnswer).toHaveBeenCalledWith('a1', 'c1');
    });

    it('should throw 403 if non-author tries to delete comment', async () => {
      console.log('[TEST] deleteComment › throws 403 for unauthorized user');

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        comments: [
          { _id: 'c1', userId: { _id: 'author1', toString: () => 'author1' }, text: 'Hello' },
        ],
      });

      await expect(
        questionService.deleteComment('q1', 'a1', 'c1', 'different-user', 'user')
      ).rejects.toThrow(AppError);
    });

    it('should allow admin to delete any comment', async () => {
      console.log('[TEST] deleteComment › happy path for admin');

      mockFindAnswerById.mockResolvedValue({
        _id: 'a1',
        comments: [
          { _id: 'c1', userId: { _id: 'author1', toString: () => 'author1' }, text: 'Hello' },
        ],
      });
      mockDeleteCommentFromAnswer.mockResolvedValue({ _id: 'a1', comments: [] });

      await questionService.deleteComment('q1', 'a1', 'c1', 'adminUser', 'admin');
      expect(mockDeleteCommentFromAnswer).toHaveBeenCalledWith('a1', 'c1');
    });
  });

  // ── getTagCloud ────────────────────────────────────────────────────────────

  describe('getTagCloud', () => {
    it('should return all distinct tags', async () => {
      console.log('[TEST] getTagCloud › returns tags array');

      const mockTags = ['react', 'nodejs', 'exam', 'cgpa'];
      mockGetAllTags.mockResolvedValue(mockTags);

      const result = await questionService.getTagCloud();

      console.log('[TEST] tags:', result);
      expect(result).toEqual(mockTags);
    });
  });

  // ── Elastic Fuzzy Search Utility Tests ────────────────────────────────────

  describe('Elastic Fuzzy Search Utility', () => {
    it('should build fuzzy search regex queries with token splitting', async () => {
      console.log('[TEST] buildFuzzySearchQuery › builds regex conditions');
      const { buildFuzzySearchQuery } = await import('../src/utils/search.utils.js');

      const query = buildFuzzySearchQuery('btech exam');
      expect(query).toBeDefined();
      expect(query.$or).toBeInstanceOf(Array);
      expect(query.$or.length).toBeGreaterThan(0);
    });

    it('should return null for empty search string', async () => {
      console.log('[TEST] buildFuzzySearchQuery › returns null for empty term');
      const { buildFuzzySearchQuery } = await import('../src/utils/search.utils.js');

      expect(buildFuzzySearchQuery('')).toBeNull();
      expect(buildFuzzySearchQuery('   ')).toBeNull();
    });

    it('should include userId match condition when matchedUserIds are provided', async () => {
      console.log('[TEST] buildFuzzySearchQuery › includes matchedUserIds');
      const { buildFuzzySearchQuery } = await import('../src/utils/search.utils.js');

      const query = buildFuzzySearchQuery('tanish', ['title'], ['user-id-123']);
      expect(query.$or).toContainEqual({ userId: { $in: ['user-id-123'] } });
    });

    it('should rank documents by author username relevance', async () => {
      console.log('[TEST] scoreSearchRelevance › ranks by author username');
      const { scoreSearchRelevance } = await import('../src/utils/search.utils.js');

      const docs = [
        { title: 'General question', userId: { username: 'otheruser' } },
        { title: 'General question', userId: { username: 'tanish-mittal' } },
      ];

      const scored = scoreSearchRelevance(docs, 'tanish');
      expect(scored[0].userId.username).toBe('tanish-mittal');
      expect(scored[0].relevanceScore).toBeGreaterThan(scored[1].relevanceScore);
    });
  });

  // ── New Filter Options Tests ────────────────────────────────────────────────

  describe('New Filter Options (oldest, views, solved)', () => {
    it('should call getQuestionsFeed with oldest filter option', async () => {
      console.log('[TEST] getQuestionsFeed › passes oldest filter');
      mockGetQuestionsFeed.mockResolvedValue([]);

      await questionService.getQuestionsFeed({ filter: 'oldest' });
      expect(mockGetQuestionsFeed).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'oldest' })
      );
    });

    it('should call getQuestionsFeed with views filter option', async () => {
      console.log('[TEST] getQuestionsFeed › passes views filter');
      mockGetQuestionsFeed.mockResolvedValue([]);

      await questionService.getQuestionsFeed({ filter: 'views' });
      expect(mockGetQuestionsFeed).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'views' })
      );
    });

    it('should call getQuestionsFeed with solved filter option', async () => {
      console.log('[TEST] getQuestionsFeed › passes solved filter');
      mockGetQuestionsFeed.mockResolvedValue([]);

      await questionService.getQuestionsFeed({ filter: 'solved' });
      expect(mockGetQuestionsFeed).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'solved' })
      );
    });
  });
});
