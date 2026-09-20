import { jest } from '@jest/globals';

const store = new Map();
const fakeRedis = {
  isReady: true,
  get: jest.fn(async (k) => store.get(k) ?? null),
  setEx: jest.fn(async (k, _t, v) => { store.set(k, v); }),
  del: jest.fn(async (keys) => { [].concat(keys).forEach((k) => store.delete(k)); }),
  incr: jest.fn(),
};
jest.unstable_mockModule('../src/utils/redis.js', () => ({ getRedisClient: () => fakeRedis }));

// A chainable, awaitable query stand-in.
const query = (result) => {
  const q = { select: () => q, populate: () => q, lean: () => q, then: (res, rej) => Promise.resolve(result).then(res, rej) };
  return q;
};

const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
jest.unstable_mockModule('../models/users.js', () => ({
  User: { findOne: mockFindOne, findById: mockFindById, findByIdAndUpdate: mockFindByIdAndUpdate },
}));
jest.unstable_mockModule('../models/resource.js', () => ({ Resource: { findById: jest.fn(), find: jest.fn() } }));
jest.unstable_mockModule('../models/posts.js', () => ({ Post: { findById: jest.fn(), find: jest.fn() } }));
jest.unstable_mockModule('../src/utils/userCache.js', () => ({ invalidateUserCache: jest.fn().mockResolvedValue(undefined) }));
jest.unstable_mockModule('../src/services/notification.service.js', () => ({ createAndPushNotification: jest.fn() }));

const { getProfile, getFollowers, getFollowing, toggleFollowUser, updateProfile } =
  await import('../src/controllers/profile.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('profile caching', () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  test('a profile is read from MongoDB once, then served from cache', async () => {
    console.log('[TEST] getProfile › cached per username');
    mockFindOne.mockReturnValue(query({ _id: 'u1', username: 'alice', bio: 'hi' }));

    const res1 = makeRes();
    const res2 = makeRes();
    await getProfile({ params: { username: 'alice' } }, res1, jest.fn());
    await getProfile({ params: { username: 'alice' } }, res2, jest.fn());

    expect(mockFindOne).toHaveBeenCalledTimes(1);
    expect(res2.json).toHaveBeenCalledWith({ success: true, data: { _id: 'u1', username: 'alice', bio: 'hi' } });
  });

  test('an unknown username is a 404 and is NOT cached', async () => {
    mockFindOne.mockReturnValueOnce(query(null)).mockReturnValueOnce(query({ _id: 'u2', username: 'newbie' }));
    const next = jest.fn();
    await getProfile({ params: { username: 'newbie' } }, makeRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(404);

    const res = makeRes();
    await getProfile({ params: { username: 'newbie' } }, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ username: 'newbie' }) });
  });

  test('followers and following lists are cached independently', async () => {
    mockFindOne
      .mockReturnValueOnce(query({ followers: [{ username: 'f1' }] }))
      .mockReturnValueOnce(query({ following: [{ username: 'g1' }] }));

    await getFollowers({ params: { username: 'alice' } }, makeRes(), jest.fn());
    await getFollowers({ params: { username: 'alice' } }, makeRes(), jest.fn());
    await getFollowing({ params: { username: 'alice' } }, makeRes(), jest.fn());
    await getFollowing({ params: { username: 'alice' } }, makeRes(), jest.fn());

    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });

  test('following someone clears the cached profile/follower/following data of BOTH people', async () => {
    console.log('[TEST] toggleFollowUser › both users\' profile caches invalidated');
    store.set('profile:data:alice', '{}');
    store.set('profile:followers:alice', '[]');
    store.set('profile:following:alice', '[]');
    store.set('profile:data:bob', '{}');
    store.set('profile:followers:bob', '[]');
    store.set('profile:following:bob', '[]');
    store.set('profile:data:carol', '{}'); // unrelated — must survive

    mockFindById
      .mockResolvedValueOnce({ _id: 'bobId', username: 'bob' })
      .mockResolvedValueOnce({ _id: 'aliceId', username: 'alice', fullName: 'Alice', following: [] });
    mockFindByIdAndUpdate.mockResolvedValue({});

    await toggleFollowUser({ user: { _id: 'aliceId' }, params: { targetUserId: 'bobId' } }, makeRes(), jest.fn());

    const remaining = [...store.keys()];
    console.log(`[TEST RESULT] remaining keys: ${remaining.join(', ')}`);
    expect(remaining).toEqual(['profile:data:carol']);
  });

  test('editing your profile clears the cache under both your old and new username', async () => {
    store.set('profile:data:oldname', '{}');
    store.set('profile:data:newname', '{}');
    mockFindByIdAndUpdate.mockReturnValue({ select: () => Promise.resolve({ _id: 'u1', username: 'newname' }) });

    await updateProfile(
      { user: { _id: 'u1', username: 'oldname' }, body: { bio: 'new bio' }, file: null },
      makeRes(),
      jest.fn()
    );

    expect(store.has('profile:data:oldname')).toBe(false);
    expect(store.has('profile:data:newname')).toBe(false);
  });
});
