import * as postRepository from "../repositories/post.repository.js";
import { AppError } from "../utils/error.js";

export const createPost = async (userId, postData) => {
  // Validate that image and caption exist
  if (!postData.image || !postData.caption) {
    throw new AppError("Image and caption are required", 400);
  }

  return await postRepository.createPost({
    userId,
    caption: postData.caption,
    image: postData.image,
  });
};

export const getGlobalFeed = async (cursor, limit) => {
  const posts = await postRepository.getPostsFeed(cursor, parseInt(limit) || 10);
  
  // Calculate next cursor
  const nextCursor = posts.length > 0 ? posts[posts.length - 1].createdAt : null;

  return {
    posts,
    nextCursor
  };
};

export const getPost = async (postId) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }
  return post;
};

export const deletePost = async (postId, userId, userRole) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  // Only the owner or an admin can delete the post
  if (post.userId._id.toString() !== userId.toString() && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this post", 403);
  }

  return await postRepository.deletePost(postId);
};

export const toggleUpvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleUpvote(postId, userId);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  return updatedPost;
};

export const addComment = async (postId, userId, text) => {
  if (!text || text.trim() === "") {
    throw new AppError("Comment text is required", 400);
  }

  const commentData = {
    user: userId,
    text: text.trim(),
  };

  const updatedPost = await postRepository.addComment(postId, commentData);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  return updatedPost;
};
