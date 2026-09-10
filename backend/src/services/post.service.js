import * as postRepository from "../repositories/post.repository.js";
import { AppError } from "../utils/error.js";

export const createPost = async (userId, postData) => {
  if (!postData.caption && !postData.image) {
    throw new AppError("Please provide a caption or image", 400);
  }

  return await postRepository.createPost({
    userId,
    caption: postData.caption || "",
    image: postData.image || "",
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

export const getUserPosts = async (userId) => {
  return await postRepository.getPostsByUserId(userId);
};



export const deletePost = async (postId, userId, userRole) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const postAuthorId = (post.userId?._id || post.userId)?.toString();

  // Only the owner or an admin can delete the post
  if (postAuthorId !== userId.toString() && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this post", 403);
  }

  const deleted = await postRepository.deletePost(postId);

  // If deleted by an admin moderating another user's post, log to audit trail
  if (userRole === "admin" && postAuthorId !== userId.toString()) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_POST",
        targetType: "Post",
        targetId: postId,
        details: { postAuthorId, captionSnippet: post.caption?.slice(0, 50) },
      });
    } catch (e) {
      console.error("[AUDIT LOG ERROR]", e);
    }
  }

  return deleted;
};

export const deleteComment = async (postId, commentId, userId, userRole) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const comment = post.comments.find(
    (c) => (c._id || c.id)?.toString() === commentId?.toString()
  );
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  const commentAuthorId = (comment.userId?._id || comment.userId)?.toString();

  // Only the comment author or an admin can delete
  if (commentAuthorId !== userId.toString() && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this comment", 403);
  }

  const updatedPost = await postRepository.deleteComment(postId, commentId);

  // If deleted by an admin moderating another user's comment, log to audit trail
  if (userRole === "admin" && commentAuthorId !== userId.toString()) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_COMMENT",
        targetType: "Comment",
        targetId: commentId,
        details: { postId, commentAuthorId, textSnippet: comment.text?.slice(0, 50) },
      });
    } catch (e) {
      console.error("[AUDIT LOG ERROR]", e);
    }
  }

  return updatedPost;
};


export const toggleUpvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleUpvote(postId, userId);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  return updatedPost;
};

export const toggleDownvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleDownvote(postId, userId);
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
    userId: userId, // Fixed: use userId matching schema
    text: text.trim(),
  };

  const updatedPost = await postRepository.addComment(postId, commentData);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  return updatedPost;
};

export const addReply = async (postId, commentId, userId, text, replyToUsername) => {
  if (!text || text.trim() === "") {
    throw new AppError("Reply text is required", 400);
  }

  const replyData = {
    userId: userId,
    text: text.trim(),
    replyToUsername: replyToUsername || null,
  };

  const updatedPost = await postRepository.addReply(postId, commentId, replyData);
  if (!updatedPost) {
    throw new AppError("Post or comment not found", 404);
  }
  return updatedPost;
};

export const toggleCommentUpvote = async (postId, commentId, userId) => {
  const updatedPost = await postRepository.toggleCommentUpvote(postId, commentId, userId);
  if (!updatedPost) {
    throw new AppError("Post or comment not found", 404);
  }
  return updatedPost;
};
