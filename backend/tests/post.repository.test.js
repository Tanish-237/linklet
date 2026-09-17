import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindOneAndUpdate = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindById = jest.fn();

jest.unstable_mockModule('../models/posts.js', () => ({
  Post: {
    findOneAndUpdate: mockFindOneAndUpdate,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    findById: mockFindById,
  },
}));

const postRepository = await import('../src/repositories/post.repository.js');

// findPostById re-fetches via Post.findById(...).populate(...).populate(...) —
// stub a chainable object so it resolves to a simple sentinel document.
const makePopulateChain = (resolvedValue) => ({
  populate: jest.fn().mockReturnThis(),
  then: (resolve) => resolve(resolvedValue),
});

describe('Post Repository — Atomic Vote Toggle Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toggleUpvote', () => {
    it('removes the upvote atomically when the user already upvoted (single $pull call)', async () => {
      console.log('[TEST] toggleUpvote › already upvoted → single atomic $pull, no $addToSet call');
      mockFindOneAndUpdate.mockResolvedValueOnce({ _id: 'post1', upvotes: [] });
      mockFindById.mockReturnValue(makePopulateChain({ _id: 'post1', upvotes: [] }));

      await postRepository.toggleUpvote('post1', 'user1');

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'post1', upvotes: 'user1' },
        { $pull: { upvotes: 'user1' } },
        { new: true }
      );
      expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('adds the upvote and atomically clears any downvote in ONE call when not previously upvoted', async () => {
      console.log('[TEST] toggleUpvote › not upvoted → single atomic $addToSet + $pull call');
      mockFindOneAndUpdate.mockResolvedValueOnce(null); // not already upvoted
      mockFindByIdAndUpdate.mockResolvedValueOnce({ _id: 'post1', upvotes: ['user1'] });
      mockFindById.mockReturnValue(makePopulateChain({ _id: 'post1', upvotes: ['user1'] }));

      await postRepository.toggleUpvote('post1', 'user1');

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'post1',
        { $addToSet: { upvotes: 'user1' }, $pull: { downvotes: 'user1' } },
        { new: true }
      );
    });

    it('returns null when the post does not exist', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce(null);
      mockFindByIdAndUpdate.mockResolvedValueOnce(null);

      const result = await postRepository.toggleUpvote('missing', 'user1');
      expect(result).toBeNull();
      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('toggleDownvote', () => {
    it('adds the downvote and atomically clears any upvote in ONE call when not previously downvoted', async () => {
      console.log('[TEST] toggleDownvote › not downvoted → single atomic $addToSet + $pull call');
      mockFindOneAndUpdate.mockResolvedValueOnce(null);
      mockFindByIdAndUpdate.mockResolvedValueOnce({ _id: 'post1', downvotes: ['user1'] });
      mockFindById.mockReturnValue(makePopulateChain({ _id: 'post1', downvotes: ['user1'] }));

      await postRepository.toggleDownvote('post1', 'user1');

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'post1',
        { $addToSet: { downvotes: 'user1' }, $pull: { upvotes: 'user1' } },
        { new: true }
      );
    });

    it('removes the downvote atomically when the user already downvoted', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce({ _id: 'post1', downvotes: [] });
      mockFindById.mockReturnValue(makePopulateChain({ _id: 'post1', downvotes: [] }));

      await postRepository.toggleDownvote('post1', 'user1');

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'post1', downvotes: 'user1' },
        { $pull: { downvotes: 'user1' } },
        { new: true }
      );
      expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
