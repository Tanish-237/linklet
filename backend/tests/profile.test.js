import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindOne        = jest.fn();
const mockFindById       = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindResourceById  = jest.fn();
const mockResourceFindById  = jest.fn();

jest.unstable_mockModule('../models/users.js', () => ({
  User: {
    findOne:           mockFindOne,
    findById:          mockFindById,
    findByIdAndUpdate: mockFindByIdAndUpdate,
  },
}));

jest.unstable_mockModule('../models/resource.js', () => ({
  Resource: { findById: mockResourceFindById },
}));

const {
  toggleBookmark,
  getMyBookmarks,
  getUserBookmarks,
  toggleFollowUser,
} = await import('../src/controllers/profile.controller.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  user: { _id: 'user1' },
  params: {},
  body: {},
  file: null,
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile Controller — Bookmark Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('\n──────────────────────────────────────────');
  });

  // ── toggleBookmark ──────────────────────────────────────────────────────────
  describe('toggleBookmark', () => {
    it('should ADD bookmark when resource is not yet bookmarked', async () => {
      console.log('[TEST] toggleBookmark › add new bookmark');
      const req = makeReq({ params: { resourceId: 'res1' } });
      const res = makeRes();
      const next = jest.fn();

      mockResourceFindById.mockResolvedValue({ _id: 'res1' });
      mockFindById.mockResolvedValue({ bookmarks: [] }); // not bookmarked
      mockFindByIdAndUpdate.mockResolvedValue({});

      await toggleBookmark(req, res, next);

      console.log('[TEST] json called with:', res.json.mock.calls[0][0]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarked: true })
      );
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        { $addToSet: { bookmarks: 'res1' } }
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should REMOVE bookmark when resource is already bookmarked', async () => {
      console.log('[TEST] toggleBookmark › remove existing bookmark');
      const req = makeReq({ params: { resourceId: 'res1' } });
      const res = makeRes();
      const next = jest.fn();

      mockResourceFindById.mockResolvedValue({ _id: 'res1' });
      mockFindById.mockResolvedValue({
        bookmarks: [{ toString: () => 'res1' }], // already bookmarked
      });
      mockFindByIdAndUpdate.mockResolvedValue({});

      await toggleBookmark(req, res, next);

      console.log('[TEST] json called with:', res.json.mock.calls[0][0]);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarked: false })
      );
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        { $pull: { bookmarks: 'res1' } }
      );
    });

    it('should call next(AppError) when resource not found', async () => {
      console.log('[TEST] toggleBookmark › resource not found → next(AppError)');
      const req = makeReq({ params: { resourceId: 'ghost' } });
      const res = makeRes();
      const next = jest.fn();

      mockResourceFindById.mockResolvedValue(null);

      await toggleBookmark(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      console.log('[TEST] error passed to next:', err?.message);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  // ── getMyBookmarks ──────────────────────────────────────────────────────────
  describe('getMyBookmarks', () => {
    it('should return the current user\'s populated bookmarks', async () => {
      console.log('[TEST] getMyBookmarks › returns populated array');
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      const mockBookmarks = [
        { _id: 'r1', title: 'DS Notes', userId: { username: 'alice', avatar: '' } },
        { _id: 'r2', title: 'OS Paper', userId: { username: 'bob',   avatar: '' } },
      ];

      mockFindById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ bookmarks: mockBookmarks }),
        }),
      });

      await getMyBookmarks(req, res, next);

      console.log('[TEST] returned', mockBookmarks.length, 'bookmarks');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockBookmarks })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return empty array when user has no bookmarks', async () => {
      console.log('[TEST] getMyBookmarks › empty bookmarks');
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      mockFindById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ bookmarks: [] }),
        }),
      });

      await getMyBookmarks(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [] })
      );
    });
  });

  // ── getUserBookmarks ────────────────────────────────────────────────────────
  describe('getUserBookmarks', () => {
    it('should return bookmarks for a given username', async () => {
      console.log('[TEST] getUserBookmarks › found user alice');
      const req = makeReq({ params: { username: 'alice' } });
      const res = makeRes();
      const next = jest.fn();

      const mockBookmarks = [{ _id: 'r1', title: 'Notes', userId: { username: 'alice' } }];

      mockFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ bookmarks: mockBookmarks }),
        }),
      });

      await getUserBookmarks(req, res, next);

      console.log('[TEST] bookmarks for alice:', mockBookmarks.length);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockBookmarks })
      );
    });

    it('should call next(AppError) when username not found', async () => {
      console.log('[TEST] getUserBookmarks › user not found → next(AppError)');
      const req = makeReq({ params: { username: 'ghost' } });
      const res = makeRes();
      const next = jest.fn();

      mockFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        }),
      });

      await getUserBookmarks(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      console.log('[TEST] error:', err?.message);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  // ── toggleFollowUser ────────────────────────────────────────────────────────
  describe('toggleFollowUser', () => {
    it('should prevent user from following themselves', async () => {
      console.log('[TEST] toggleFollowUser › cannot follow self');
      const req = makeReq({ user: { _id: 'user1' }, params: { targetUserId: 'user1' } });
      const res = makeRes();
      const next = jest.fn();

      await toggleFollowUser(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      console.log('[TEST] self-follow error:', err?.message);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
    });

    it('should follow a target user when not already following', async () => {
      console.log('[TEST] toggleFollowUser › follow user');
      const req = makeReq({ user: { _id: 'user1' }, params: { targetUserId: 'targetUser2' } });
      const res = makeRes();
      const next = jest.fn();

      mockFindById
        .mockResolvedValueOnce({ _id: 'targetUser2' }) // targetUser check
        .mockResolvedValueOnce({ _id: 'user1', following: [] }); // currentUser check

      await toggleFollowUser(req, res, next);

      expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, isFollowing: true })
      );
    });
  });
});
