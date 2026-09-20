import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockDeletePost = jest.fn();
const mockDeleteComment = jest.fn();
const mockGetGlobalFeed = jest.fn();
const mockGetComments = jest.fn();
const mockGetReplies = jest.fn();
const mockAddComment = jest.fn();
const mockAddReply = jest.fn();
const mockToggleCommentUpvote = jest.fn();
const mockSeedDefaultBranches = jest.fn();

// Names mirror the REAL exports of post.service.js. (This mock used to declare
// `getFeed`, which the service never exported — the drift went unnoticed
// because nothing exercised the feed route.)
jest.unstable_mockModule('../src/services/post.service.js', () => ({
  deletePost: mockDeletePost,
  deleteComment: mockDeleteComment,
  getGlobalFeed: mockGetGlobalFeed,
  getUserPosts: jest.fn(),
  getPost: jest.fn(),
  createPost: jest.fn(),
  toggleUpvote: jest.fn(),
  toggleDownvote: jest.fn(),
  getComments: mockGetComments,
  getReplies: mockGetReplies,
  addComment: mockAddComment,
  addReply: mockAddReply,
  toggleCommentUpvote: mockToggleCommentUpvote,
}));

jest.unstable_mockModule('../src/services/branch.service.js', () => ({
  seedDefaultBranches: mockSeedDefaultBranches,
  createBranch: jest.fn(),
  getAllBranches: jest.fn(),
  updateBranch: jest.fn(),
  deleteBranch: jest.fn(),
}));

let currentTestUser = { _id: 'user_111', username: 'student1', role: 'user' };
let isAuthenticated = true;

const testAuthMiddleware = (req, res, next) => {
  if (!isAuthenticated) {
    return next(new AppError('Unauthorized request: No token provided', 401));
  }
  req.user = currentTestUser;
  next();
};

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: testAuthMiddleware,
  optionalAuth: (req, res, next) => next(),
}));

const postRoutes = (await import('../src/routes/post.routes.js')).default;
const branchRoutes = (await import('../src/routes/branch.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/branches', branchRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const request = supertest(app);

describe('Post Comments API & Branch Seeding Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
    currentTestUser = { _id: 'user_111', username: 'student1', role: 'user' };
  });

  // ── DELETE /posts/:postId/comments/:commentId ──────────────────────────────

  test('comment author can successfully delete their own comment', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] DELETE /posts/:postId/comments/:commentId › Comment author deletion');

    mockDeleteComment.mockResolvedValueOnce({ deletedIds: ['c_1'], commentsCount: 0 });

    const res = await request.delete('/api/v1/posts/post_1/comments/c_1');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ deletedIds: ['c_1'], commentsCount: 0 });
    expect(mockDeleteComment).toHaveBeenCalledWith('post_1', 'c_1', 'user_111', 'user');
  });

  test('admin can delete any user comment (admin moderation override)', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] DELETE /posts/:postId/comments/:commentId › Admin override deletion');

    currentTestUser = { _id: 'admin_999', username: 'admin', role: 'admin' };

    mockDeleteComment.mockResolvedValueOnce({ deletedIds: ['c_1', 'r_1'], commentsCount: 2 });

    const res = await request.delete('/api/v1/posts/post_1/comments/c_1');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deletedIds).toEqual(['c_1', 'r_1']);
    expect(mockDeleteComment).toHaveBeenCalledWith('post_1', 'c_1', 'admin_999', 'admin');
  });

  test('rejects non-author student attempting to delete another comment with 403', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] DELETE /posts/:postId/comments/:commentId › Unauthorized deletion rejection');

    mockDeleteComment.mockRejectedValueOnce(
      new AppError('You do not have permission to delete this comment', 403)
    );

    const res = await request.delete('/api/v1/posts/post_1/comments/c_1');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/do not have permission/i);
  });

  // ── GET /posts/feed ────────────────────────────────────────────────────────

  test('feed route returns posts with hasMore and nextCursor and forwards cursor/limit', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /posts/feed › pagination contract');

    mockGetGlobalFeed.mockResolvedValueOnce({
      posts: [{ _id: 'p1', commentsCount: 3 }],
      hasMore: true,
      nextCursor: '2025-01-01T00:00:00.000Z',
    });

    const res = await request.get('/api/v1/posts/feed?cursor=abc&limit=15');

    console.log(`[TEST RESULT] Status: ${res.status}, hasMore: ${res.body.hasMore}, nextCursor: ${res.body.nextCursor}`);
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe('2025-01-01T00:00:00.000Z');
    expect(res.body.data[0].commentsCount).toBe(3);
    expect(mockGetGlobalFeed).toHaveBeenCalledWith('abc', '15');
  });

  // ── GET /posts/:postId/comments (+ replies) ────────────────────────────────

  test('lists comments with cursor pagination metadata', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /posts/:postId/comments › paginated list');

    mockGetComments.mockResolvedValueOnce({
      comments: [{ _id: 'c1', text: 'hi', replies: [], repliesCount: 0 }],
      hasMore: true,
      nextCursor: 'c1',
    });

    const res = await request.get('/api/v1/posts/post_1/comments?cursor=c0&limit=20');

    console.log(`[TEST RESULT] Status: ${res.status}, count: ${res.body.data?.length}, nextCursor: ${res.body.nextCursor}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe('c1');
    expect(mockGetComments).toHaveBeenCalledWith('post_1', 'c0', '20');
  });

  test('comments list is publicly readable (no auth required)', async () => {
    console.log('[TEST] GET /posts/:postId/comments › works for logged-out visitors');
    isAuthenticated = false;
    mockGetComments.mockResolvedValueOnce({ comments: [], hasMore: false, nextCursor: null });

    const res = await request.get('/api/v1/posts/post_1/comments');

    console.log(`[TEST RESULT] Status: ${res.status}`);
    expect(res.status).toBe(200);
  });

  test('lists replies for a comment and 404s when the comment is missing', async () => {
    console.log('[TEST] GET /posts/:postId/comments/:commentId/replies › list + 404');

    mockGetReplies.mockResolvedValueOnce({ replies: [{ _id: 'r1' }], hasMore: false, nextCursor: null });
    const ok = await request.get('/api/v1/posts/post_1/comments/c_1/replies?cursor=r0');
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual([{ _id: 'r1' }]);
    expect(mockGetReplies).toHaveBeenCalledWith('post_1', 'c_1', 'r0', undefined);

    mockGetReplies.mockRejectedValueOnce(new AppError('Comment not found', 404));
    const missing = await request.get('/api/v1/posts/post_1/comments/nope/replies');
    console.log(`[TEST RESULT] Status: ${missing.status}`);
    expect(missing.status).toBe(404);
  });

  // ── POST comment / reply / upvote ──────────────────────────────────────────

  test('adding a comment returns the new comment plus the updated commentsCount', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /posts/:postId/comment › returns comment + commentsCount');

    mockAddComment.mockResolvedValueOnce({ comment: { _id: 'c9', text: 'nice' }, commentsCount: 4 });

    const res = await request.post('/api/v1/posts/post_1/comment').send({ text: 'nice' });

    console.log(`[TEST RESULT] Status: ${res.status}, commentsCount: ${res.body.commentsCount}`);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ _id: 'c9', text: 'nice' });
    expect(res.body.commentsCount).toBe(4);
    expect(mockAddComment).toHaveBeenCalledWith('post_1', 'user_111', 'nice');
  });

  test('adding a comment requires authentication', async () => {
    console.log('[TEST] POST /posts/:postId/comment › 401 when logged out');
    isAuthenticated = false;

    const res = await request.post('/api/v1/posts/post_1/comment').send({ text: 'nice' });

    console.log(`[TEST RESULT] Status: ${res.status}`);
    expect(res.status).toBe(401);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  test('replying returns the reply with repliesCount and commentsCount', async () => {
    console.log('[TEST] POST /posts/:postId/comments/:commentId/reply › reply payload');

    mockAddReply.mockResolvedValueOnce({ reply: { _id: 'r7', text: 'yes' }, repliesCount: 2, commentsCount: 5 });

    const res = await request
      .post('/api/v1/posts/post_1/comments/c_1/reply')
      .send({ text: 'yes', replyToUsername: 'alice' });

    console.log(`[TEST RESULT] Status: ${res.status}, repliesCount: ${res.body.repliesCount}`);
    expect(res.status).toBe(201);
    expect(res.body.repliesCount).toBe(2);
    expect(res.body.commentsCount).toBe(5);
    expect(mockAddReply).toHaveBeenCalledWith('post_1', 'c_1', 'user_111', 'yes', 'alice');
  });

  test('toggling a comment upvote returns the comment with its upvotes', async () => {
    console.log('[TEST] POST /posts/:postId/comments/:commentId/upvote › returns updated upvotes');

    mockToggleCommentUpvote.mockResolvedValueOnce({ _id: 'c_1', upvotes: ['user_111'] });

    const res = await request.post('/api/v1/posts/post_1/comments/c_1/upvote');

    console.log(`[TEST RESULT] Status: ${res.status}, upvotes: ${JSON.stringify(res.body.data?.upvotes)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.upvotes).toEqual(['user_111']);
  });

  test('service validation errors surface as 400 responses', async () => {
    console.log('[TEST] POST /posts/:postId/comment › empty text → 400');
    mockAddComment.mockRejectedValueOnce(new AppError('Comment text is required', 400));

    const res = await request.post('/api/v1/posts/post_1/comment').send({ text: '   ' });

    console.log(`[TEST RESULT] Status: ${res.status}, message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  // ── POST /branches/seed-defaults ──────────────────────────────────────────

  test('rejects non-admin from triggering branch seeding with 403', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /branches/seed-defaults › Rejects non-admin user');

    currentTestUser = { _id: 'student_1', username: 'student', role: 'user' };

    const res = await request.post('/api/v1/branches/seed-defaults');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/do not have permission/i);
  });

  test('allows admin to trigger standard department seeding', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /branches/seed-defaults › Admin seeds standard departments');

    currentTestUser = { _id: 'admin_1', username: 'admin', role: 'admin' };

    mockSeedDefaultBranches.mockResolvedValueOnce([
      { _id: 'b1', name: 'COMPUTER SCIENCE & ENGINEERING' },
      { _id: 'b2', name: 'ELECTRONICS & COMMUNICATION ENGINEERING' },
    ]);

    const res = await request.post('/api/v1/branches/seed-defaults');

    console.log(`[TEST RESULT] Status: ${res.status}, Seeded count: ${res.body.data?.length}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(mockSeedDefaultBranches).toHaveBeenCalledWith('admin_1');
  });
});
