import { apiClient } from "./apiClient";

const FEED_PAGE_SIZE = 15;

/** One page of the campus feed. Shape: { data: Post[], nextCursor, hasMore } */
export const getFeed = async ({ pageParam = null } = {}) => {
  const params = { limit: FEED_PAGE_SIZE };
  if (pageParam) params.cursor = pageParam;
  const response = await apiClient.get("/posts/feed", { params });
  return response.data;
};

export const deletePost = async (postId) => {
  const response = await apiClient.delete(`/posts/${postId}`);
  return response.data;
};

export const updatePost = async (postId, caption) => {
  const response = await apiClient.patch(`/posts/${postId}`, { caption });
  return response.data.data;
};

export const reportPost = async (postId, reason) => {
  const response = await apiClient.post(`/posts/${postId}/report`, { reason });
  return response.data.data;
};

// ─── Comments (paginated, stored separately from the post) ───────────────────

/** Shape: { data: Comment[] (each with first replies inline), nextCursor, hasMore } */
export const getPostComments = async (postId, { cursor = null, limit } = {}) => {
  const params = {};
  if (cursor) params.cursor = cursor;
  if (limit) params.limit = limit;
  const response = await apiClient.get(`/posts/${postId}/comments`, { params });
  return response.data;
};

/** Shape: { data: Reply[], nextCursor, hasMore } */
export const getCommentReplies = async (postId, commentId, { cursor = null, limit } = {}) => {
  const params = {};
  if (cursor) params.cursor = cursor;
  if (limit) params.limit = limit;
  const response = await apiClient.get(`/posts/${postId}/comments/${commentId}/replies`, { params });
  return response.data;
};

/** Returns { comment, commentsCount } */
export const addComment = async (postId, text) => {
  const response = await apiClient.post(`/posts/${postId}/comment`, { text });
  return { comment: response.data.data, commentsCount: response.data.commentsCount };
};

/** Returns { reply, repliesCount, commentsCount } */
export const addReply = async (postId, commentId, text, replyToUsername) => {
  const response = await apiClient.post(`/posts/${postId}/comments/${commentId}/reply`, {
    text,
    replyToUsername,
  });
  return {
    reply: response.data.data,
    repliesCount: response.data.repliesCount,
    commentsCount: response.data.commentsCount,
  };
};

/** Returns the comment's updated { _id, upvotes } */
export const toggleCommentUpvote = async (postId, commentId) => {
  const response = await apiClient.post(`/posts/${postId}/comments/${commentId}/upvote`);
  return response.data.data;
};

/** Returns { deletedIds, commentsCount } */
export const deletePostComment = async (postId, commentId) => {
  const response = await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
  return response.data.data;
};
