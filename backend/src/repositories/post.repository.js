import { Post } from "../../models/posts.js";

export const createPost = async (postData) => {
  const post = new Post(postData);
  return await post.save();
};

export const findPostById = async (id) => {
  return await Post.findById(id).populate("userId", "username avatar fullName");
};

/**
 * Fetch posts using cursor-based pagination for high performance at scale.
 * @param {Date} cursor - The createdAt timestamp of the last seen post.
 * @param {Number} limit - Number of posts to fetch.
 */
export const getPostsFeed = async (cursor, limit = 10) => {
  const query = {};
  
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username avatar fullName")
    .lean(); // .lean() returns plain JS objects, faster for read-only ops

  return posts;
};

export const updatePost = async (id, updateData) => {
  return await Post.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

export const deletePost = async (id) => {
  return await Post.findByIdAndDelete(id);
};

export const toggleUpvote = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  const upvoteIndex = post.upvotes.indexOf(userId);
  if (upvoteIndex === -1) {
    post.upvotes.push(userId); // Add upvote
  } else {
    post.upvotes.splice(upvoteIndex, 1); // Remove upvote
  }

  return await post.save();
};

export const addComment = async (postId, commentData) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.comments.push(commentData);
  return await post.save();
};
