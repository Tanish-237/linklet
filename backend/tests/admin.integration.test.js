import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockGetPlatformStats = jest.fn();
const mockGetUsersDirectory = jest.fn();
const mockAssignRoleAndBranch = jest.fn();
const mockGetRecentContentOverview = jest.fn();
const mockSetUserBanStatus = jest.fn();
const mockGetAdminAuditLogs = jest.fn();

jest.unstable_mockModule('../src/services/admin.service.js', () => ({
  getPlatformStats: mockGetPlatformStats,
  getUsersDirectory: mockGetUsersDirectory,
  assignRoleAndBranch: mockAssignRoleAndBranch,
  getRecentContentOverview: mockGetRecentContentOverview,
  setUserBanStatus: mockSetUserBanStatus,
  getAdminAuditLogs: mockGetAdminAuditLogs,
}));

let currentTestUser = { _id: 'admin_123', username: 'superadmin', role: 'admin' };
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

const adminRoutes = (await import('../src/routes/admin.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const request = supertest(app);

describe('Admin API Integration & RBAC Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
    currentTestUser = { _id: 'admin_123', username: 'superadmin', role: 'admin' };
  });

  test('rejects unauthenticated request with 401', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/stats › Rejects unauthenticated request with 401');

    isAuthenticated = false;
    const res = await request.get('/api/v1/admin/stats');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects standard student user with 403 Forbidden', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/stats › Rejects non-admin user with 403');

    isAuthenticated = true;
    currentTestUser = { _id: 'student_456', username: 'student', role: 'user' };

    const res = await request.get('/api/v1/admin/stats');

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/do not have permission/i);
  });

  test('allows admin to fetch platform stats and KPIs', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/stats › Returns aggregated platform metrics');

    mockGetPlatformStats.mockResolvedValueOnce({
      users: { total: 150, admins: 2, students: 148 },
      resources: { total: 42, downloads: 350 },
      community: { posts: 80, questions: 60, answers: 95, discussions: 155 },
      academic: { branches: 8 },
      updatedAt: new Date().toISOString(),
    });

    const res = await request.get('/api/v1/admin/stats');

    console.log(`[TEST RESULT] Status: ${res.status}, Data:`, res.body.data);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.total).toBe(150);
    expect(mockGetPlatformStats).toHaveBeenCalled();
  });

  test('allows admin to search and paginate user directory', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/users › Returns paginated user directory');

    mockGetUsersDirectory.mockResolvedValueOnce({
      users: [
        { _id: 'u1', username: 'arjun', fullName: 'Arjun Verma', email: 'arjun@mnnit.ac.in', role: 'user' },
        { _id: 'u2', username: 'tanish', fullName: 'Tanish Sharma', email: 'tanish@mnnit.ac.in', role: 'admin' },
      ],
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      limit: 10,
      hasNextPage: false,
    });

    const res = await request
      .get('/api/v1/admin/users')
      .query({ search: 'tanish', role: 'admin', page: 1, limit: 10 });

    console.log(`[TEST RESULT] Status: ${res.status}, Users count: ${res.body.data?.length}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalDocs).toBe(2);
    expect(mockGetUsersDirectory).toHaveBeenCalledWith({
      search: 'tanish',
      role: 'admin',
      branch: undefined,
      page: '1',
      limit: '10',
    });
  });

  test('successfully promotes a user to admin', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] PATCH /api/v1/admin/users/:userId/role › Promotes user to admin');

    mockAssignRoleAndBranch.mockResolvedValueOnce({
      _id: 'target_u1',
      username: 'student1',
      role: 'admin',
    });

    const res = await request
      .patch('/api/v1/admin/users/target_u1/role')
      .send({ role: 'admin' });

    console.log(`[TEST RESULT] Status: ${res.status}, Updated Role: ${res.body.data?.role}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('admin');
    expect(mockAssignRoleAndBranch).toHaveBeenCalledWith('target_u1', 'admin', 'admin_123');
  });

  test('prevents self-demotion lockout when service throws AppError', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] PATCH /api/v1/admin/users/:userId/role › Prevents admin self-demotion');

    mockAssignRoleAndBranch.mockRejectedValueOnce(
      new AppError('You cannot demote your own admin account', 400)
    );

    const res = await request
      .patch('/api/v1/admin/users/admin_123/role')
      .send({ role: 'user' });

    console.log(`[TEST RESULT] Status: ${res.status}, Error Message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot demote your own admin account/i);
  });

  test('fetches platform recent content overview for moderation', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/content-overview › Returns recent platform activity');

    mockGetRecentContentOverview.mockResolvedValueOnce({
      recentResources: [{ _id: 'r1', title: 'Compiler Design Notes' }],
      recentQuestions: [{ _id: 'q1', title: 'Doubt in Dijkstra algorithm' }],
      recentPosts: [{ _id: 'p1', caption: 'Hackathon winners announced!' }],
    });

    const res = await request.get('/api/v1/admin/content-overview');

    console.log(`[TEST RESULT] Status: ${res.status}, Keys:`, Object.keys(res.body.data));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recentResources).toHaveLength(1);
    expect(res.body.data.recentQuestions).toHaveLength(1);
    expect(res.body.data.recentPosts).toHaveLength(1);
  });

  test('successfully suspends (bans) a student user', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] PATCH /api/v1/admin/users/:userId/ban › Suspends student account');

    mockSetUserBanStatus.mockResolvedValueOnce({
      _id: 'bad_user',
      username: 'spammer',
      isBanned: true,
      banReason: 'Spamming inappropriate messages',
    });

    const res = await request
      .patch('/api/v1/admin/users/bad_user/ban')
      .send({ isBanned: true, banReason: 'Spamming inappropriate messages' });

    console.log(`[TEST RESULT] Status: ${res.status}, Message: ${res.body.message}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/account has been suspended/i);
    expect(res.body.data.isBanned).toBe(true);
    expect(mockSetUserBanStatus).toHaveBeenCalledWith(
      'admin_123',
      'bad_user',
      true,
      'Spamming inappropriate messages'
    );
  });

  test('prevents admin from banning their own account', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] PATCH /api/v1/admin/users/:userId/ban › Prevents admin self-ban');

    mockSetUserBanStatus.mockRejectedValueOnce(
      new AppError('You cannot suspend your own admin account', 400)
    );

    const res = await request
      .patch('/api/v1/admin/users/admin_123/ban')
      .send({ isBanned: true });

    console.log(`[TEST RESULT] Status: ${res.status}, Error Message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot suspend your own admin account/i);
  });

  test('fetches administrative audit logs with pagination', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/admin/audit-logs › Fetches audit trail logs');

    mockGetAdminAuditLogs.mockResolvedValueOnce({
      logs: [
        {
          _id: 'log1',
          action: 'BAN_USER',
          targetType: 'User',
          targetId: 'bad_user',
          details: { banReason: 'Spam' },
          createdAt: new Date().toISOString(),
        },
      ],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      limit: 20,
    });

    const res = await request
      .get('/api/v1/admin/audit-logs')
      .query({ page: 1, limit: 20 });

    console.log(`[TEST RESULT] Status: ${res.status}, Logs count: ${res.body.data?.length}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].action).toBe('BAN_USER');
  });
});
