import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockGetVerifiedResourcesFeed = jest.fn();
const mockGetResourceById = jest.fn();
const mockIncrementDownloadCount = jest.fn();
const mockUploadResource = jest.fn();
const mockDeleteResource = jest.fn();

jest.unstable_mockModule('../src/services/resource.service.js', () => ({
  getVerifiedResourcesFeed: mockGetVerifiedResourcesFeed,
  getResourceById: mockGetResourceById,
  incrementDownloadCount: mockIncrementDownloadCount,
  uploadResource: mockUploadResource,
  deleteResource: mockDeleteResource,
}));

let isAuthenticated = false;
let currentUser = { _id: 'testUserId123', username: 'student_user', role: 'user', branch: 'cs_branch_id' };

// Conditional auth middleware to test guest vs authenticated modes
const testAuthMiddleware = (req, res, next) => {
  if (!isAuthenticated) {
    return next(new AppError('Unauthorized request: No token provided', 401));
  }
  req.user = currentUser;
  next();
};

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: testAuthMiddleware,
  optionalAuth: (req, res, next) => next(),
}));

const resourceRoutes = (await import('../src/routes/resource.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/resources', resourceRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const request = supertest(app);

describe('Resource API & Global Search Guest Gate Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = false;
  });

  test('rejects unauthenticated guest access to GET /api/v1/resources/library with 401', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/resources/library › Rejects guest access with 401');

    isAuthenticated = false;
    const res = await request.get('/api/v1/resources/library');

    console.log(`[TEST RESULT] Status: ${res.status}, Body:`, res.body);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Unauthorized request/i);
    expect(mockGetVerifiedResourcesFeed).not.toHaveBeenCalled();
  });

  test('rejects unauthenticated guest access to GET /api/v1/resources/:id with 401', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/resources/:id › Rejects guest preview with 401');

    isAuthenticated = false;
    const res = await request.get('/api/v1/resources/res_123');

    console.log(`[TEST RESULT] Status: ${res.status}, Body:`, res.body);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockGetResourceById).not.toHaveBeenCalled();
  });

  test('rejects unauthenticated guest access to PATCH /api/v1/resources/:id/download with 401', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] PATCH /api/v1/resources/:id/download › Rejects guest download with 401');

    isAuthenticated = false;
    const res = await request.patch('/api/v1/resources/res_123/download');

    console.log(`[TEST RESULT] Status: ${res.status}, Body:`, res.body);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockIncrementDownloadCount).not.toHaveBeenCalled();
  });

  test('allows authenticated student to access GET /api/v1/resources/library', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] GET /api/v1/resources/library › Allows authenticated access');

    isAuthenticated = true;
    mockGetVerifiedResourcesFeed.mockResolvedValueOnce({
      resources: [{ _id: 'res_1', title: 'Data Structures Notes' }],
      stats: { total: 1, categories: { all: 1 } },
      page: 1,
      totalPages: 1,
      totalDocs: 1,
      hasNextPage: false,
    });

    const res = await request.get('/api/v1/resources/library');

    console.log(`[TEST RESULT] Status: ${res.status}, Docs: ${res.body.data?.length}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockGetVerifiedResourcesFeed).toHaveBeenCalled();
  });
});
