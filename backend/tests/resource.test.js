import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mock setup ───────────────────────────────────────────────────────────────
const mockCreateResource     = jest.fn();
const mockGetVerifiedResources = jest.fn();
const mockFindResourceById   = jest.fn();
const mockIncrementDownload  = jest.fn();
const mockDeleteResource     = jest.fn();
const mockGetCategoryStats   = jest.fn();

const mockBumpCacheVersion = jest.fn().mockResolvedValue(undefined);
const mockCached = jest.fn((key, ttl, loader) => loader());
jest.unstable_mockModule('../src/utils/cache.js', () => ({
  cached: mockCached,
  getCacheVersion: jest.fn().mockResolvedValue('3'),
  bumpCacheVersion: mockBumpCacheVersion,
}));

jest.unstable_mockModule('../src/repositories/resource.repository.js', () => ({
  getCategoryStats:     mockGetCategoryStats,
  createResource:       mockCreateResource,
  getVerifiedResources: mockGetVerifiedResources,
  findResourceById:     mockFindResourceById,
  incrementDownloadCount: mockIncrementDownload,
  deleteResource:       mockDeleteResource,
}));

const mockDeleteFromCloudinary = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../src/utils/cloudinary.js', () => ({
  uploadOnCloudinary: jest.fn(),
  deleteFromCloudinary: mockDeleteFromCloudinary,
}));

const resourceService = await import('../src/services/resource.service.js');

// ─────────────────────────────────────────────────────────────────────────────

describe('Resource Service — Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('\n──────────────────────────────────────────');
  });

  // ── uploadResource ──────────────────────────────────────────────────────────
  describe('uploadResource', () => {
    it('should successfully upload a resource with comma-separated tags', async () => {
      console.log('[TEST] uploadResource › happy path with string tags');
      const userId = 'user123';
      const data = {
        title: 'Test Notes',
        description: 'Desc',
        category: 'notes',
        tags: 'test, notes, mid-term',
        fileUrl: 'https://cloudinary.com/test.pdf',
        fileType: 'pdf',
        fileName: 'test.pdf',
        publicId: 'pub123',
        branch: 'branch1',
      };
      const saved = { ...data, _id: 'res1', resourcetags: ['test', 'notes', 'mid-term'] };
      mockCreateResource.mockResolvedValue(saved);

      const result = await resourceService.uploadResource(userId, data);

      console.log('[TEST] result.resourcetags:', result.resourcetags);
      expect(result).toEqual(saved);
      expect(mockCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({ resourcetags: ['test', 'notes', 'mid-term'] })
      );
    });

    it('should successfully upload a resource with array tags', async () => {
      console.log('[TEST] uploadResource › happy path with array tags');
      const userId = 'user123';
      const data = {
        title: 'Array Tag Notes',
        description: 'Array tag test description',
        fileUrl: 'https://cloudinary.com/array.pdf',
        tags: ['alpha', 'beta'],
      };
      mockCreateResource.mockResolvedValue({ ...data, _id: 'res2' });

      await resourceService.uploadResource(userId, data);

      console.log('[TEST] called createResource with tags:', mockCreateResource.mock.calls[0][0].resourcetags);
      expect(mockCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({ resourcetags: ['alpha', 'beta'] })
      );
    });

    it('should throw AppError when title is missing', async () => {
      console.log('[TEST] uploadResource › missing title → AppError');
      await expect(
        resourceService.uploadResource('user1', { fileUrl: 'https://x.com/f.pdf' })
      ).rejects.toThrow(AppError);
    });

    it('should throw AppError when fileUrl is missing', async () => {
      console.log('[TEST] uploadResource › missing fileUrl → AppError');
      await expect(
        resourceService.uploadResource('user1', { title: 'No URL' })
      ).rejects.toThrow(AppError);
    });

    it('should throw a clean AppError (not a raw Mongoose validation error) when description is missing', async () => {
      console.log('[TEST] uploadResource › missing description → clean 400 AppError');
      await expect(
        resourceService.uploadResource('user1', {
          title: 'No description',
          fileUrl: 'https://cloudinary.com/x.pdf',
        })
      ).rejects.toThrow('Description is required');
      expect(mockCreateResource).not.toHaveBeenCalled();
    });

    it('should default category to "notes" when not provided', async () => {
      console.log('[TEST] uploadResource › default category');
      const data = { title: 'No Cat', description: 'Some description', fileUrl: 'https://x.com/f.pdf' };
      mockCreateResource.mockResolvedValue({ ...data, _id: 'r3' });
      await resourceService.uploadResource('u1', data);
      expect(mockCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'notes' })
      );
    });
  });

  // ── getVerifiedResourcesFeed ────────────────────────────────────────────────
  describe('getVerifiedResourcesFeed', () => {
    it('should call repository with parsed page and limit and attach cached category stats', async () => {
      console.log('[TEST] getVerifiedResourcesFeed › parses page & limit, stats come from the (cached) stats query');
      const filters = { search: 'algo', category: 'notes', sort: 'newest', branchId: 'b1' };
      const stats = { total: 1, categories: { all: 1, notes: 1, assignments: 0, papers: 0, books: 0, lectures: 0, other: 0 } };
      const page = { resources: [{ _id: 'r1', title: 'Algo Notes' }], totalPages: 1, totalDocs: 1, page: 2, hasNextPage: false };
      mockGetVerifiedResources.mockResolvedValue(page);
      mockGetCategoryStats.mockResolvedValue(stats);

      const result = await resourceService.getVerifiedResourcesFeed(filters, '2', '12');

      expect(mockGetVerifiedResources).toHaveBeenCalledWith(filters, 2, 12);
      expect(mockCached.mock.calls[0][0]).toBe('resources:stats:v3:b1'); // versioned, per-branch key
      expect(result).toEqual({ ...page, stats });
    });

    it('should default to page=1 and limit=12 when invalid strings are passed', async () => {
      console.log('[TEST] getVerifiedResourcesFeed › defaults for NaN page/limit');
      mockGetVerifiedResources.mockResolvedValue({ resources: [] });
      mockGetCategoryStats.mockResolvedValue({});
      await resourceService.getVerifiedResourcesFeed({}, 'abc', 'xyz');
      expect(mockGetVerifiedResources).toHaveBeenCalledWith({}, 1, 12);
    });

    it('should clamp an oversized limit to 50 and a negative page to 1', async () => {
      console.log('[TEST] getVerifiedResourcesFeed › clamps limit/page');
      mockGetVerifiedResources.mockResolvedValue({ resources: [] });
      mockGetCategoryStats.mockResolvedValue({});
      await resourceService.getVerifiedResourcesFeed({}, '-3', '99999');
      expect(mockGetVerifiedResources).toHaveBeenCalledWith({}, 1, 50);
    });
  });

  // ── cache invalidation ──────────────────────────────────────────────────────
  describe('resource stats cache invalidation', () => {
    it('uploading a resource bumps the resources cache version', async () => {
      console.log('[TEST] uploadResource › invalidates cached category stats');
      mockCreateResource.mockResolvedValue({ _id: 'r9' });
      await resourceService.uploadResource('u1', { title: 't', fileUrl: 'https://x.test/a.pdf', description: 'd' });
      expect(mockBumpCacheVersion).toHaveBeenCalledWith('resources');
    });

    it('deleting a resource bumps the resources cache version', async () => {
      console.log('[TEST] deleteResource › invalidates cached category stats');
      mockFindResourceById.mockResolvedValue({ _id: 'r1', userId: { _id: 'u1' }, title: 't' });
      mockDeleteResource.mockResolvedValue({});
      await resourceService.deleteResource('r1', 'u1', 'user');
      expect(mockBumpCacheVersion).toHaveBeenCalledWith('resources');
    });
  });

  // ── getResourceById ─────────────────────────────────────────────────────────
  describe('getResourceById', () => {
    it('should return a resource when found', async () => {
      console.log('[TEST] getResourceById › found');
      const mock = { _id: 'r1', title: 'Found Resource', userId: { username: 'alice' } };
      mockFindResourceById.mockResolvedValue(mock);

      const result = await resourceService.getResourceById('r1');

      console.log('[TEST] returned resource title:', result.title);
      expect(result).toEqual(mock);
      expect(mockFindResourceById).toHaveBeenCalledWith('r1');
    });

    it('should throw AppError when resource not found', async () => {
      console.log('[TEST] getResourceById › not found → AppError 404');
      mockFindResourceById.mockResolvedValue(null);
      await expect(resourceService.getResourceById('nonexistent')).rejects.toThrow(AppError);
    });
  });

  // ── incrementDownloadCount ──────────────────────────────────────────────────
  describe('incrementDownloadCount', () => {
    it('should increment and return the updated resource', async () => {
      console.log('[TEST] incrementDownloadCount › success');
      const updated = { _id: 'r1', downloadsCount: 42 };
      mockIncrementDownload.mockResolvedValue(updated);

      const result = await resourceService.incrementDownloadCount('r1');

      console.log('[TEST] downloadsCount after increment:', result.downloadsCount);
      expect(result.downloadsCount).toBe(42);
      expect(mockIncrementDownload).toHaveBeenCalledWith('r1');
    });
  });

  // ── deleteResource ──────────────────────────────────────────────────────────
  describe('deleteResource', () => {
    const resourceId = 'res1';
    const ownerId = 'owner1';
    const otherUserId = 'other1';

    it('should allow owner to delete their own resource', async () => {
      console.log('[TEST] deleteResource › owner deletes own resource');
      mockFindResourceById.mockResolvedValue({
        _id: resourceId,
        userId: { _id: { toString: () => ownerId } },
      });
      mockDeleteResource.mockResolvedValue({ _id: resourceId });

      const result = await resourceService.deleteResource(resourceId, ownerId, 'user');
      expect(mockDeleteResource).toHaveBeenCalledWith(resourceId);
      console.log('[TEST] deletion successful, id:', result._id);
    });

    it('should clean up the underlying Cloudinary file when the resource has a publicId', async () => {
      console.log('[TEST] deleteResource › cleans up orphaned Cloudinary file');
      mockFindResourceById.mockResolvedValue({
        _id: resourceId,
        publicId: 'linklet/resources/abc123',
        userId: { _id: { toString: () => ownerId } },
      });
      mockDeleteResource.mockResolvedValue({ _id: resourceId });

      await resourceService.deleteResource(resourceId, ownerId, 'user');
      // Fire-and-forget cleanup — allow the microtask to run before asserting.
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockDeleteFromCloudinary).toHaveBeenCalledWith('linklet/resources/abc123');
    });

    it('should NOT attempt Cloudinary cleanup for a link-type resource (no publicId)', async () => {
      console.log('[TEST] deleteResource › skips cleanup for link resources');
      mockFindResourceById.mockResolvedValue({
        _id: resourceId,
        publicId: null,
        userId: { _id: { toString: () => ownerId } },
      });
      mockDeleteResource.mockResolvedValue({ _id: resourceId });

      await resourceService.deleteResource(resourceId, ownerId, 'user');
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockDeleteFromCloudinary).not.toHaveBeenCalled();
    });

    it('should allow admin to delete any resource', async () => {
      console.log('[TEST] deleteResource › admin override');
      mockFindResourceById.mockResolvedValue({
        _id: resourceId,
        userId: { _id: { toString: () => ownerId } },
      });
      mockDeleteResource.mockResolvedValue({ _id: resourceId });

      await resourceService.deleteResource(resourceId, otherUserId, 'admin');
      expect(mockDeleteResource).toHaveBeenCalledWith(resourceId);
    });


    it('should throw AppError 403 when non-owner tries to delete', async () => {
      console.log('[TEST] deleteResource › non-owner → AppError 403');
      mockFindResourceById.mockResolvedValue({
        _id: resourceId,
        userId: { _id: { toString: () => ownerId } },
      });

      await expect(
        resourceService.deleteResource(resourceId, otherUserId, 'user')
      ).rejects.toThrow(AppError);
    });

    it('should throw AppError 404 when resource does not exist', async () => {
      console.log('[TEST] deleteResource › resource not found → AppError 404');
      mockFindResourceById.mockResolvedValue(null);

      await expect(
        resourceService.deleteResource('ghost', ownerId, 'user')
      ).rejects.toThrow(AppError);
    });
  });
});
