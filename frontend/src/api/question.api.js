import { apiClient } from "./apiClient";

const BASE = "/questions";

// ──────────────────────────────────────────────────────────────────────────────
// METADATA
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch categories and suggested tags from the server.
 * No auth required.
 */
export const getQuestionMetadata = async () => {
  const res = await apiClient.get(`${BASE}/metadata`);
  return res.data.data; // { categories: [], suggestedTags: [] }
};

/**
 * Fetch the tag cloud (all distinct tags used).
 */
export const getTagCloud = async () => {
  const res = await apiClient.get(`${BASE}/tags`);
  return res.data.data; // string[]
};

/**
 * Fetch forum stats grouped by category.
 */
export const getForumStats = async () => {
  const res = await apiClient.get(`${BASE}/stats`);
  return res.data.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get paginated questions feed.
 * @param {object} params
 * @param {string|null} params.cursor   - Cursor for pagination
 * @param {number}      params.limit    - Page size (default 15)
 * @param {string}      params.search   - Search text
 * @param {string}      params.filter   - "all" | "unanswered" | "answered" | "popular"
 * @param {string}      params.category - Category name
 * @param {string}      params.tag      - Tag to filter by
 */
export const getQuestions = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await apiClient.get(`${BASE}/feed?${query.toString()}`);
  return res.data; // { data: [], nextCursor, hasMore }
};

/**
 * Get a single question by ID (increments view count).
 */
export const getQuestion = async (questionId) => {
  const res = await apiClient.get(`${BASE}/${questionId}`);
  return res.data.data;
};

/**
 * Create a new question.
 * @param {{ title: string, body: string, category: string, tags: string[] }} data
 */
export const createQuestion = async (data) => {
  const res = await apiClient.post(BASE, data);
  return res.data.data;
};

/**
 * Vote on a question.
 * @param {string} questionId
 * @param {"upvote"|"downvote"} voteType
 */
export const voteQuestion = async (questionId, voteType) => {
  const res = await apiClient.post(`${BASE}/${questionId}/vote`, { voteType });
  return res.data.data; // { upvotes, downvotes, userVote }
};

/**
 * Delete a question.
 */
export const deleteQuestion = async (questionId) => {
  const res = await apiClient.delete(`${BASE}/${questionId}`);
  return res.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// ANSWERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Post an answer to a question.
 * @param {string} questionId
 * @param {string} body
 */
export const postAnswer = async (questionId, body) => {
  const res = await apiClient.post(`${BASE}/${questionId}/answers`, { body });
  return res.data.data;
};

/**
 * Vote on an answer.
 * @param {string} questionId
 * @param {string} answerId
 * @param {"upvote"|"downvote"} voteType
 */
export const voteAnswer = async (questionId, answerId, voteType) => {
  const res = await apiClient.post(
    `${BASE}/${questionId}/answers/${answerId}/vote`,
    { voteType }
  );
  return res.data.data; // { upvotes, downvotes, userVote }
};

/**
 * Accept an answer (toggle). Only question author can call this.
 * @param {string} questionId
 * @param {string} answerId
 */
export const acceptAnswer = async (questionId, answerId) => {
  const res = await apiClient.post(
    `${BASE}/${questionId}/answers/${answerId}/accept`
  );
  return res.data.data; // { accepted: boolean }
};

/**
 * Delete an answer.
 */
export const deleteAnswer = async (questionId, answerId) => {
  const res = await apiClient.delete(
    `${BASE}/${questionId}/answers/${answerId}`
  );
  return res.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Add a comment (or nested reply) to an answer.
 * @param {string} questionId
 * @param {string} answerId
 * @param {string} text
 * @param {string|null} parentId
 */
export const addComment = async (questionId, answerId, text, parentId = null) => {
  const res = await apiClient.post(
    `${BASE}/${questionId}/answers/${answerId}/comments`,
    { text, parentId }
  );
  return res.data.data;
};

/**
 * Vote on a comment.
 * @param {string} questionId
 * @param {string} answerId
 * @param {string} commentId
 * @param {"upvote"|"downvote"} voteType
 */
export const voteComment = async (questionId, answerId, commentId, voteType) => {
  const res = await apiClient.post(
    `${BASE}/${questionId}/answers/${answerId}/comments/${commentId}/vote`,
    { voteType }
  );
  return res.data.data;
};

/**
 * Delete a comment from an answer.
 * @param {string} questionId
 * @param {string} answerId
 * @param {string} commentId
 */
export const deleteComment = async (questionId, answerId, commentId) => {
  const res = await apiClient.delete(
    `${BASE}/${questionId}/answers/${answerId}/comments/${commentId}`
  );
  return res.data.data;
};
