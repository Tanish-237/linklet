import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mock setup ───────────────────────────────────────────────────────────────
const mockCreateResource     = jest.fn();
const mockGetVerifiedResources = jest.fn();
const mockFindResourceById   = jest.fn();
const mockIncrementDownload  = jest.fn();
const mockDeleteResource     = jest.fn();

jest.unstable_mockModule('../src/repositories/resource.repository.js', () => ({
  createResource:       mockCreateResource,
  getVerifiedResources: mockGetVerifiedResources,
  findResourceById:     mockFindResourceById,
  incrementDownloadCount: mockIncrementDownload,
  deleteResource:       mockDeleteResource,
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
        fileUrl: 'https://cloudinary.com/array.pdf',
        tags: ['alpha', 'beta'],
      };
      mockCreateResource.mockResolvedValue({ ...data, _id: 'res2' });

      const result = await resourceService.uploadResource(userId, data);

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

    it('should default category to "notes" when not provided', async () => {
      console.log('[TEST] uploadResource › default category');
      const data = { title: 'No Cat', fileUrl: 'https://x.com/f.pdf' };
      mockCreateResource.mockResolvedValue({ ...data, _id: 'r3' });
      await resourceService.uploadResource('u1', data);
      expect(mockCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'notes' })
      );
    });
  });

  // ── getVerifiedResourcesFeed ────────────────────────────────────────────────
  describe('getVerifiedResourcesFeed', () => {
    it('should call repository with parsed page and limit', async () => {
      console.log('[TEST] getVerifiedResourcesFeed › parses page & limit to integers');
      const filters = { search: 'algo', category: 'notes', sort: 'newest' };
      const mockResult = {
        resources: [{ _id: 'r1', title: 'Algo Notes' }],
        stats: { total: 1, categories: { all: 1, notes: 1, assignments: 0, papers: 0, presentations: 0, other: 0 } },
        totalPages: 1, totalDocs: 1, page: 1, hasNextPage: false,
      };
      mockGetVerifiedResources.mockResolvedValue(mockResult);

      const result = await resourceService.getVerifiedResourcesFeed(filters, '2', '12');

      console.log('[TEST] page passed to repo:', mockGetVerifiedResources.mock.calls[0][1]);
      expect(mockGetVerifiedResources).toHaveBeenCalledWith(filters, 2, 12);
      expect(result).toEqual(mockResult);
    });

    it('should default to page=1 and limit=12 when invalid strings are passed', async () => {
      console.log('[TEST] getVerifiedResourcesFeed › defaults for NaN page/limit');
      mockGetVerifiedResources.mockResolvedValue({ resources: [], stats: {} });
      await resourceService.getVerifiedResourcesFeed({}, 'abc', 'xyz');
      expect(mockGetVerifiedResources).toHaveBeenCalledWith({}, 1, 12);
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
