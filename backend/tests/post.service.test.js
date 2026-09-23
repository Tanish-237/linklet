import { jest } from '@jest/globals';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockGetPostsFeed = jest.fn();
const mockFindPostById = jest.fn();
const mockDeletePostRepo = jest.fn();
const mockCreatePostRepo = jest.fn();
const mockUpdatePostRepo = jest.fn();
const mockToggleUpvoteRepo = jest.fn();

jest.unstable_mockModule('../src/repositories/post.repository.js', () => ({
  getPostsFeed: mockGetPostsFeed,
  findPostById: mockFindPostById,
  deletePost: mockDeletePostRepo,
  createPost: mockCreatePostRepo,
  updatePost: mockUpdatePostRepo,
  toggleUpvote: mockToggleUpvoteRepo,
  toggleDownvote: jest.fn(),
  getPostsByUserId: jest.fn(),
}));

const mockCreateReport = jest.fn();
const mockGetReports = jest.fn();
const mockUpdateReportStatus = jest.fn();

jest.unstable_mockModule('../src/repositories/postReport.repository.js', () => ({
  createReport: mockCreateReport,
  getReports: mockGetReports,
  updateReportStatus: mockUpdateReportStatus,
}));

const mockCreateComment = jest.fn();
const mockCreateReply = jest.fn();
const mockFindComment = jest.fn();
const mockDeleteCommentRepo = jest.fn();
const mockGetPostComments = jest.fn();
const mockGetCommentReplies = jest.fn();
const mockToggleCommentUpvoteRepo = jest.fn();

jest.unstable_mockModule('../src/repositories/postComment.repository.js', () => ({
  COMMENTS_PAGE_SIZE: 20,
  REPLIES_PAGE_SIZE: 20,
  createComment: mockCreateComment,
  createReply: mockCreateReply,
  findComment: mockFindComment,
  deleteComment: mockDeleteCommentRepo,
  getPostComments: mockGetPostComments,
  getCommentReplies: mockGetCommentReplies,
  toggleCommentUpvote: mockToggleCommentUpvoteRepo,
}));

// Cache: run the loader directly (a permanent miss) but record how it is used.
const mockCached = jest.fn((key, ttl, loader) => loader());
const mockGetCacheVersion = jest.fn().mockResolvedValue('7');
const mockBumpCacheVersion = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../src/utils/cache.js', () => ({
  cached: mockCached,
  getCacheVersion: mockGetCacheVersion,
  bumpCacheVersion: mockBumpCacheVersion,
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
}));

const mockCreateNotification = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../src/services/notification.service.js', () => ({
  createAndPushNotification: mockCreateNotification,
}));
const mockLogAdminAction = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../src/services/auditLog.service.js', () => ({
  logAdminAction: mockLogAdminAction,
}));

const postService = await import('../src/services/post.service.js');

const flush = () => new Promise((r) => setImmediate(r));

describe('post.service — feed', () => {
  beforeEach(() => jest.clearAllMocks());

  const rowsOf = (n) =>
    Array.from({ length: n }, (_, i) => ({ _id: `p${i}`, createdAt: new Date(2025, 0, 30 - i) }));

  test('asks the repository for limit+1 rows and reports hasMore/nextCursor exactly', async () => {
    console.log('[TEST] getGlobalFeed › fetches limit+1 to know whether another page exists');
    mockGetPostsFeed.mockResolvedValueOnce(rowsOf(11));

    const result = await postService.getGlobalFeed('2025-02-01', 10);

    console.log(`[TEST RESULT] returned ${result.posts.length} posts, hasMore=${result.hasMore}`);
    expect(mockGetPostsFeed).toHaveBeenCalledWith('2025-02-01', 11);
    expect(result.posts).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(result.posts[9].createdAt);
  });

  test('reports hasMore=false and a null cursor on the last page', async () => {
    console.log('[TEST] getGlobalFeed › last page has no cursor');
    mockGetPostsFeed.mockResolvedValueOnce(rowsOf(4));

    const result = await postService.getGlobalFeed('2025-02-01', 10);

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.posts).toHaveLength(4);
  });

  test('clamps a huge or invalid limit', async () => {
    console.log('[TEST] getGlobalFeed › limit is clamped to 1..50');
    mockGetPostsFeed.mockResolvedValue([]);

    await postService.getGlobalFeed('x', 999999);
    await postService.getGlobalFeed('x', -5);
    await postService.getGlobalFeed('x', 'abc');

    expect(mockGetPostsFeed).toHaveBeenNthCalledWith(1, 'x', 51);
    expect(mockGetPostsFeed).toHaveBeenNthCalledWith(2, 'x', 2); // negative clamps to 1 (+1 for the hasMore probe row)
    expect(mockGetPostsFeed).toHaveBeenNthCalledWith(3, 'x', 11); // NaN → default 10
  });

  test('caches only the FIRST page, under a versioned key', async () => {
    console.log('[TEST] getGlobalFeed › first page goes through the cache with the current version in the key');
    mockGetPostsFeed.mockResolvedValue([]);

    await postService.getGlobalFeed(undefined, 10);
    expect(mockCached).toHaveBeenCalledTimes(1);
    expect(mockCached.mock.calls[0][0]).toBe('posts:feed:v7:first:10');

    mockCached.mockClear();
    await postService.getGlobalFeed('2025-01-01', 10);
    console.log(`[TEST RESULT] cache used for cursor page? ${mockCached.mock.calls.length > 0}`);
    expect(mockCached).not.toHaveBeenCalled();
  });
});

describe('post.service — cache invalidation', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['createPost', () => { mockCreatePostRepo.mockResolvedValueOnce({ _id: 'p' }); return postService.createPost('u1', { caption: 'hi' }); }],
    ['toggleUpvote', () => { mockToggleUpvoteRepo.mockResolvedValueOnce({ _id: 'p', upvotes: [], userId: 'u9' }); return postService.toggleUpvote('p', 'u1'); }],
    ['addComment', () => { mockCreateComment.mockResolvedValueOnce({ comment: {}, commentsCount: 1, postAuthorId: 'u9' }); return postService.addComment('p', 'u1', 'hello'); }],
    ['deleteComment', () => {
      mockFindComment.mockResolvedValueOnce({ _id: 'c', userId: 'u1' });
      mockDeleteCommentRepo.mockResolvedValueOnce({ deletedIds: ['c'], commentsCount: 0 });
      return postService.deleteComment('p', 'c', 'u1', 'user');
    }],
  ])('%s bumps the feed cache version so students never see a stale card', async (name, run) => {
    console.log(`[TEST] cache invalidation › ${name} → posts-feed version bumped`);
    await run();
    expect(mockBumpCacheVersion).toHaveBeenCalledWith('posts-feed');
  });
});

describe('post.service — comments', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects empty and over-long comment text before touching the database', async () => {
    console.log('[TEST] addComment › validation');
    await expect(postService.addComment('p', 'u1', '   ')).rejects.toMatchObject({ statusCode: 400 });
    await expect(postService.addComment('p', 'u1', undefined)).rejects.toMatchObject({ statusCode: 400 });
    await expect(postService.addComment('p', 'u1', 'x'.repeat(2001))).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  test('trims the text and returns comment + commentsCount', async () => {
    console.log('[TEST] addComment › trims and returns count');
    mockCreateComment.mockResolvedValueOnce({ comment: { _id: 'c1' }, commentsCount: 3, postAuthorId: 'author' });

    const result = await postService.addComment('p', 'u1', '  nice post  ');

    expect(mockCreateComment).toHaveBeenCalledWith({ postId: 'p', userId: 'u1', text: 'nice post' });
    expect(result).toEqual({ comment: { _id: 'c1' }, commentsCount: 3 });
  });

  test('notifies the post author, but never notifies people about their own comment', async () => {
    console.log('[TEST] addComment › notification to author only when commenter differs');
    mockCreateComment.mockResolvedValue({ comment: {}, commentsCount: 1, postAuthorId: 'author' });

    await postService.addComment('p', 'someone-else', 'hey');
    await flush();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'author', type: 'POST_COMMENT', link: '/posts/p' })
    );

    mockCreateNotification.mockClear();
    await postService.addComment('p', 'author', 'my own post');
    await flush();
    console.log(`[TEST RESULT] self-notifications sent: ${mockCreateNotification.mock.calls.length}`);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  test('addComment on a missing post is a 404', async () => {
    mockCreateComment.mockResolvedValueOnce(null);
    await expect(postService.addComment('nope', 'u1', 'hi')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('addReply returns repliesCount/commentsCount and notifies the parent comment author', async () => {
    console.log('[TEST] addReply › result shape + notification');
    mockCreateReply.mockResolvedValueOnce({
      reply: { _id: 'r1' },
      parentAuthorId: 'parent-author',
      repliesCount: 2,
      commentsCount: 5,
    });

    const result = await postService.addReply('p', 'c1', 'u1', 'agreed', 'alice');
    await flush();

    expect(result).toEqual({ reply: { _id: 'r1' }, repliesCount: 2, commentsCount: 5 });
    expect(mockCreateReply).toHaveBeenCalledWith({
      postId: 'p', parentId: 'c1', userId: 'u1', text: 'agreed', replyToUsername: 'alice',
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'parent-author', type: 'POST_REPLY' })
    );
  });

  test('addReply to a missing/foreign comment is a 404', async () => {
    mockCreateReply.mockResolvedValueOnce(null);
    await expect(postService.addReply('p', 'nope', 'u1', 'hi')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getComments 404s for a missing post and clamps the page size', async () => {
    console.log('[TEST] getComments › missing post / limit clamping');
    mockFindPostById.mockResolvedValueOnce(null);
    await expect(postService.getComments('nope')).rejects.toMatchObject({ statusCode: 404 });

    mockFindPostById.mockResolvedValueOnce({ _id: 'p' });
    mockGetPostComments.mockResolvedValueOnce({ comments: [], hasMore: false, nextCursor: null });
    await postService.getComments('p', 'cur', 100000);
    expect(mockGetPostComments).toHaveBeenCalledWith('p', { cursor: 'cur', limit: 50 });
  });

  test('getReplies rejects an unknown comment with 404, but allows fetching replies of a reply (nesting)', async () => {
    console.log('[TEST] getReplies › unknown comment 404s, nested reply-of-a-reply is allowed');
    mockFindComment.mockResolvedValueOnce(null);
    await expect(postService.getReplies('p', 'c')).rejects.toMatchObject({ statusCode: 404 });

    mockFindComment.mockResolvedValueOnce({ _id: 'r', parentId: 'c' });
    mockGetCommentReplies.mockResolvedValueOnce({ replies: [], hasMore: false, nextCursor: null });
    await expect(postService.getReplies('p', 'r')).resolves.toEqual({ replies: [], hasMore: false, nextCursor: null });
  });

  test('toggleCommentUpvote 404s when the comment is not on that post', async () => {
    mockToggleCommentUpvoteRepo.mockResolvedValueOnce(null);
    await expect(postService.toggleCommentUpvote('p', 'c', 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('post.service — deleting comments & moderation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('a stranger cannot delete someone else\'s comment (403) and nothing is deleted', async () => {
    console.log('[TEST] deleteComment › permission check');
    mockFindComment.mockResolvedValueOnce({ _id: 'c', userId: 'owner' });

    await expect(postService.deleteComment('p', 'c', 'stranger', 'user')).rejects.toMatchObject({ statusCode: 403 });
    expect(mockDeleteCommentRepo).not.toHaveBeenCalled();
  });

  test('the author can delete their own comment without an audit entry', async () => {
    mockFindComment.mockResolvedValueOnce({ _id: 'c', userId: 'owner' });
    mockDeleteCommentRepo.mockResolvedValueOnce({ deletedIds: ['c'], commentsCount: 2 });

    const result = await postService.deleteComment('p', 'c', 'owner', 'user');

    expect(result).toEqual({ deletedIds: ['c'], commentsCount: 2 });
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  test('an admin deleting someone else\'s comment writes an audit log and notifies the author', async () => {
    console.log('[TEST] deleteComment › admin moderation → audit + notification');
    mockFindComment.mockResolvedValueOnce({ _id: 'c', userId: 'owner', text: 'rude words' });
    mockDeleteCommentRepo.mockResolvedValueOnce({ deletedIds: ['c'], commentsCount: 0 });

    await postService.deleteComment('p', 'c', 'admin1', 'admin');

    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 'admin1', action: 'DELETE_COMMENT', targetId: 'c' })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'owner', type: 'SYSTEM_ALERT' })
    );
  });

  test('deleting a missing comment is a 404', async () => {
    mockFindComment.mockResolvedValueOnce(null);
    await expect(postService.deleteComment('p', 'c', 'u1', 'user')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('deletePost removes the post, invalidates the feed and audits admin moderation', async () => {
    console.log('[TEST] deletePost › admin moderation path');
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, caption: 'spam spam' });
    mockDeletePostRepo.mockResolvedValueOnce({ _id: 'p' });

    await postService.deletePost('p', 'admin1', 'admin');

    expect(mockDeletePostRepo).toHaveBeenCalledWith('p');
    expect(mockBumpCacheVersion).toHaveBeenCalledWith('posts-feed');
    expect(mockLogAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE_POST' }));
  });

  test('deletePost by a non-owner is forbidden', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' } });
    await expect(postService.deletePost('p', 'stranger', 'user')).rejects.toMatchObject({ statusCode: 403 });
    expect(mockDeletePostRepo).not.toHaveBeenCalled();
  });
});

describe('post.service — editing posts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('the owner can edit their caption; the post is marked edited and the feed cache is invalidated', async () => {
    console.log('[TEST] updatePost › owner edits caption');
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, image: 'pic.jpg' });
    mockUpdatePostRepo.mockResolvedValueOnce({ _id: 'p', caption: 'edited text', isEdited: true });

    const result = await postService.updatePost('p', 'owner', 'user', { caption: 'edited text' });

    expect(mockUpdatePostRepo).toHaveBeenCalledWith('p', { caption: 'edited text', isEdited: true });
    expect(mockBumpCacheVersion).toHaveBeenCalledWith('posts-feed');
    expect(result.isEdited).toBe(true);
  });

  test('an admin can edit someone else\'s post', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, image: '' });
    mockUpdatePostRepo.mockResolvedValueOnce({ _id: 'p', caption: 'moderated' });

    await postService.updatePost('p', 'admin1', 'admin', { caption: 'moderated' });
    expect(mockUpdatePostRepo).toHaveBeenCalled();
  });

  test('a stranger cannot edit someone else\'s post (403)', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, image: '' });
    await expect(postService.updatePost('p', 'stranger', 'user', { caption: 'x' })).rejects.toMatchObject({ statusCode: 403 });
    expect(mockUpdatePostRepo).not.toHaveBeenCalled();
  });

  test('editing a missing post is a 404', async () => {
    mockFindPostById.mockResolvedValueOnce(null);
    await expect(postService.updatePost('nope', 'owner', 'user', { caption: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('clearing the caption on a caption-only post is rejected (post would end up empty)', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, image: '' });
    await expect(postService.updatePost('p', 'owner', 'user', { caption: '   ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdatePostRepo).not.toHaveBeenCalled();
  });

  test('a request with no caption field at all is rejected as "nothing to update"', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, image: 'pic.jpg' });
    await expect(postService.updatePost('p', 'owner', 'user', {})).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('post.service — reporting posts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('a user can report someone else\'s post', async () => {
    console.log('[TEST] reportPost › creates a report against the post author');
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' }, caption: 'spammy content here' });
    mockCreateReport.mockResolvedValueOnce({ _id: 'r1', status: 'pending' });

    const result = await postService.reportPost('p', 'reporter1', 'Looks like spam');

    expect(mockCreateReport).toHaveBeenCalledWith({
      reportedBy: 'reporter1',
      postId: 'p',
      postAuthorId: 'owner',
      captionSnippet: 'spammy content here',
      reason: 'Looks like spam',
    });
    expect(result.status).toBe('pending');
  });

  test('reporting your own post is rejected', async () => {
    mockFindPostById.mockResolvedValueOnce({ _id: 'p', userId: { _id: 'owner' } });
    await expect(postService.reportPost('p', 'owner', 'spam')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreateReport).not.toHaveBeenCalled();
  });

  test('reporting a missing post is a 404', async () => {
    mockFindPostById.mockResolvedValueOnce(null);
    await expect(postService.reportPost('nope', 'u1', 'spam')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getReportedPosts clamps paging and defaults to the pending status filter', async () => {
    mockGetReports.mockResolvedValueOnce({ reports: [{ _id: 'r1' }], totalDocs: 1 });
    const result = await postService.getReportedPosts(undefined, 1, 999);
    expect(mockGetReports).toHaveBeenCalledWith('pending', 0, 50);
    expect(result.pagination.totalDocs).toBe(1);
  });

  const REPORT_ID = '64b7f0c2a1b2c3d4e5f60718';

  test('updatePostReportStatus delegates to the repository', async () => {
    mockUpdateReportStatus.mockResolvedValueOnce({ _id: REPORT_ID, status: 'dismissed' });
    const result = await postService.updatePostReportStatus(REPORT_ID, 'dismissed');
    expect(mockUpdateReportStatus).toHaveBeenCalledWith(REPORT_ID, 'dismissed');
    expect(result.status).toBe('dismissed');
  });

  test('updatePostReportStatus rejects unknown statuses and malformed ids', async () => {
    await expect(postService.updatePostReportStatus(REPORT_ID, 'deleted')).rejects.toMatchObject({ statusCode: 400 });
    await expect(postService.updatePostReportStatus('not-an-id', 'reviewed')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdateReportStatus).not.toHaveBeenCalled();
  });

  test('updatePostReportStatus 404s when the report does not exist', async () => {
    mockUpdateReportStatus.mockResolvedValueOnce(null);
    await expect(postService.updatePostReportStatus(REPORT_ID, 'reviewed')).rejects.toMatchObject({ statusCode: 404 });
  });
});
