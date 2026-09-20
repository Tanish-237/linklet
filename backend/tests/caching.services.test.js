import { jest } from '@jest/globals';

const store = new Map();
const fakeRedis = {
  isReady: true,
  get: jest.fn(async (k) => store.get(k) ?? null),
  setEx: jest.fn(async (k, _t, v) => { store.set(k, v); }),
  del: jest.fn(async (keys) => { [].concat(keys).forEach((k) => store.delete(k)); }),
  incr: jest.fn(async (k) => { const n = Number(store.get(k) || 0) + 1; store.set(k, String(n)); return n; }),
};
jest.unstable_mockModule('../src/utils/redis.js', () => ({ getRedisClient: () => fakeRedis }));

// ── branch repo
const mockFindAllBranches = jest.fn();
jest.unstable_mockModule('../src/repositories/branch.repository.js', () => ({
  findAllBranches: mockFindAllBranches,
  createBranch: jest.fn().mockResolvedValue({ _id: 'b9' }),
  updateBranch: jest.fn().mockResolvedValue({ _id: 'b1' }),
  deleteBranch: jest.fn().mockResolvedValue({ _id: 'b1' }),
  seedDefaultBranches: jest.fn().mockResolvedValue([]),
}));

// ── question repo + models
const mockGetAllTags = jest.fn();
const mockGetQuestionStats = jest.fn();
const mockFindSearchCandidates = jest.fn();
const mockRepoCreateQuestion = jest.fn();
const mockRepoDeleteQuestion = jest.fn();
const mockFindQuestionById = jest.fn();
jest.unstable_mockModule('../src/repositories/question.repository.js', () => ({
  getAllTags: mockGetAllTags,
  getQuestionStats: mockGetQuestionStats,
  findSearchCandidates: mockFindSearchCandidates,
  getQuestionsFeed: jest.fn(),
  createQuestion: mockRepoCreateQuestion,
  deleteQuestion: mockRepoDeleteQuestion,
  findQuestionById: mockFindQuestionById,
  addAnswerToQuestion: jest.fn(),
}));
jest.unstable_mockModule('../src/repositories/answer.repository.js', () => ({
  createAnswer: jest.fn().mockResolvedValue({ _id: 'a1' }),
}));
jest.unstable_mockModule('../models/question.js', () => ({
  Question: { findByIdAndUpdate: jest.fn() },
  QUESTION_CATEGORIES: ['General', 'Academic'],
  SUGGESTED_TAGS: [],
}));
jest.unstable_mockModule('../models/answer.js', () => ({ Answer: { deleteMany: jest.fn() } }));

const branchService = await import('../src/services/branch.service.js');
const questionService = await import('../src/services/question.service.js');

describe('service-level caching', () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  describe('branches', () => {
    test('the branch list is read once, then served from cache; any mutation clears it', async () => {
      console.log('[TEST] branches › cached, invalidated by create/update/delete/seed');
      mockFindAllBranches.mockResolvedValue([{ _id: 'b1', name: 'CSE' }]);

      await branchService.getAllBranches();
      await branchService.getAllBranches();
      expect(mockFindAllBranches).toHaveBeenCalledTimes(1);

      const mutations = {
        createBranch: () => branchService.createBranch({ name: 'New' }),
        updateBranch: () => branchService.updateBranch('b1', { name: 'X' }),
        deleteBranch: () => branchService.deleteBranch('b1'),
        seedDefaultBranches: () => branchService.seedDefaultBranches(),
      };

      for (const mutate of Object.values(mutations)) {
        await branchService.getAllBranches(); // warm the cache
        const readsWhileWarm = mockFindAllBranches.mock.calls.length;
        await branchService.getAllBranches();
        expect(mockFindAllBranches.mock.calls.length).toBe(readsWhileWarm); // served from cache

        await mutate();
        await branchService.getAllBranches();
        expect(mockFindAllBranches.mock.calls.length).toBe(readsWhileWarm + 1); // re-read after the mutation
      }
      console.log(`[TEST RESULT] repo reads after 4 mutations: ${mockFindAllBranches.mock.calls.length}`);
    });
  });

  describe('forum tag cloud & stats', () => {
    test('tags and stats are cached, and creating a question refreshes both', async () => {
      console.log('[TEST] forum metadata › cached; createQuestion bumps the forum version');
      mockGetAllTags.mockResolvedValue(['react']);
      mockGetQuestionStats.mockResolvedValue([{ _id: 'General', count: 1 }]);
      mockRepoCreateQuestion.mockResolvedValue({ _id: 'q1' });

      await questionService.getTagCloud();
      await questionService.getTagCloud();
      await questionService.getForumStats();
      await questionService.getForumStats();
      expect(mockGetAllTags).toHaveBeenCalledTimes(1);
      expect(mockGetQuestionStats).toHaveBeenCalledTimes(1);

      await questionService.createQuestion('u1', { title: 'New question', body: 'b' });
      await questionService.getTagCloud();
      await questionService.getForumStats();
      console.log(`[TEST RESULT] after createQuestion: tag reads=${mockGetAllTags.mock.calls.length}, stats reads=${mockGetQuestionStats.mock.calls.length}`);
      expect(mockGetAllTags).toHaveBeenCalledTimes(2);
      expect(mockGetQuestionStats).toHaveBeenCalledTimes(2);
    });

    test('posting an answer refreshes the stats (unanswered counts changed)', async () => {
      mockGetQuestionStats.mockResolvedValue([]);
      mockFindQuestionById.mockResolvedValue({ _id: 'q1', userId: 'author', title: 't', isClosed: false });
      await questionService.getForumStats();
      await questionService.postAnswer('q1', 'u2', 'my answer');
      await questionService.getForumStats();
      expect(mockGetQuestionStats).toHaveBeenCalledTimes(2);
    });
  });

  describe('forum search paging', () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({ _id: `q${i}`, title: `hit ${i}` }));

    test('the expensive candidate query runs ONCE while the user pages through results', async () => {
      console.log('[TEST] search cache › page 1,2,3 share one candidate query');
      mockFindSearchCandidates.mockResolvedValue(candidates);

      const p1 = await questionService.getQuestionsFeed({ search: 'hit', limit: '10' });
      const p2 = await questionService.getQuestionsFeed({ search: 'hit', limit: '10', cursor: p1.nextCursor });
      const p3 = await questionService.getQuestionsFeed({ search: 'hit', limit: '10', cursor: p2.nextCursor });

      console.log(`[TEST RESULT] candidate queries=${mockFindSearchCandidates.mock.calls.length}, sizes=${[p1, p2, p3].map((p) => p.questions.length)}`);
      expect(mockFindSearchCandidates).toHaveBeenCalledTimes(1);
      expect([p1, p2, p3].map((p) => p.questions.length)).toEqual([10, 10, 5]);
      expect(p3.hasMore).toBe(false);
    });

    test('different searches / filters do not share a cache entry', async () => {
      mockFindSearchCandidates.mockResolvedValue(candidates);
      await questionService.getQuestionsFeed({ search: 'hit' });
      await questionService.getQuestionsFeed({ search: 'hit', category: 'Academic' });
      await questionService.getQuestionsFeed({ search: 'other' });
      expect(mockFindSearchCandidates).toHaveBeenCalledTimes(3);
    });

    test('search text is case-insensitive for caching, and a new question invalidates cached results', async () => {
      mockFindSearchCandidates.mockResolvedValue(candidates);
      mockRepoCreateQuestion.mockResolvedValue({ _id: 'q-new' });
      await questionService.getQuestionsFeed({ search: 'Hit' });
      await questionService.getQuestionsFeed({ search: 'hit ' });
      expect(mockFindSearchCandidates).toHaveBeenCalledTimes(1);

      await questionService.createQuestion('u1', { title: 'Brand new hit' });
      await questionService.getQuestionsFeed({ search: 'hit' });
      expect(mockFindSearchCandidates).toHaveBeenCalledTimes(2);
    });

    test('an oversized limit is clamped before paging so hasMore stays truthful', async () => {
      mockFindSearchCandidates.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ _id: `q${i}` })));
      const page = await questionService.getQuestionsFeed({ search: 'x', limit: '500' });
      expect(page.questions).toHaveLength(50);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('o:50');
    });
  });
});
