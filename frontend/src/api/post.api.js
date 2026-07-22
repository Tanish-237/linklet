import { apiClient } from "./apiClient";

export const getFeed = async ({ pageParam = null }) => {
  const url = pageParam ? `/posts/feed?cursor=${pageParam}` : `/posts/feed`;
  const response = await apiClient.get(url);
  return response.data; // Expected { data: [], nextCursor: string | null }
};

export const createPost = async (postData) => {
  const response = await apiClient.post('/posts', postData);
  return response.data.data;
};

export const deletePost = async (postId) => {
  const response = await apiClient.delete(`/posts/${postId}`);
  return response.data;
};

export const toggleUpvote = async (postId) => {
  const response = await apiClient.post(`/posts/${postId}/upvote`);
  return response.data.data;
};

export const addComment = async (postId, text) => {
  const response = await apiClient.post(`/posts/${postId}/comment`, { text });
  return response.data.data;
};
