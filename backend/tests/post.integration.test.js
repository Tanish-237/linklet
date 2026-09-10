import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockDeletePost = jest.fn();
const mockDeleteComment = jest.fn();
const mockSeedDefaultBranches = jest.fn();

jest.unstable_mockModule('../src/services/post.service.js', () => ({
  deletePost: mockDeletePost,
  deleteComment: mockDeleteComment,
  getFeed: jest.fn(),
  getUserPosts: jest.fn(),
  getPost: jest.fn(),
  createPost: jest.fn(),
  toggleUpvote: jest.fn(),
  toggleDownvote: jest.fn(),
  addComment: jest.fn(),
  addReply: jest.fn(),
  toggleCommentUpvote: jest.fn(),
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

describe('Post Comments Moderation & Branch Seeding Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
    currentTestUser = { _id: 'user_111', username: 'student1', role: 'user' };
  });

  // ── DELETE /posts/:postId/comments/:commentId ──────────────────────────────

  test('comment author can successfully delete their own comment', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] DELETE /posts/:postId/comments/:commentId › Comment author deletion');

    mockDeleteComment.mockResolvedValueOnce({
      _id: 'post_1',
      comments: [],
    });

    const res = await request.delete('/api/v1/posts/post_1/comments/c_1');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDeleteComment).toHaveBeenCalledWith('post_1', 'c_1', 'user_111', 'user');
  });

  test('admin can delete any user comment (admin moderation override)', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] DELETE /posts/:postId/comments/:commentId › Admin override deletion');

    currentTestUser = { _id: 'admin_999', username: 'admin', role: 'admin' };

    mockDeleteComment.mockResolvedValueOnce({
      _id: 'post_1',
      comments: [],
    });

    const res = await request.delete('/api/v1/posts/post_1/comments/c_1');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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
