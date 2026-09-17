import * as postRepository from "../repositories/post.repository.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";

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
  // Clamp so `?limit=999999` can't force the feed query (which populates
  // comments, replies, and their authors on every post) to load everything.
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const posts = await postRepository.getPostsFeed(cursor, safeLimit);

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

  // If deleted by an admin moderating another user's post, log to audit trail & notify author
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

      const { createAndPushNotification } = await import("./notification.service.js");
      await createAndPushNotification({
        recipient: postAuthorId,
        sender: userId,
        type: "SYSTEM_ALERT",
        title: "Content Moderated",
        message: "Your post was removed by an administrator for content moderation.",
        link: "/home",
        entityId: null,
        entityType: "System",
      });
    } catch (e) {
      logger.warn(`[AUDIT/NOTIF ERROR] ${e.message}`);
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

  // If deleted by an admin moderating another user's comment, log to audit trail & notify author
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

      const { createAndPushNotification } = await import("./notification.service.js");
      await createAndPushNotification({
        recipient: commentAuthorId,
        sender: userId,
        type: "SYSTEM_ALERT",
        title: "Content Moderated",
        message: "Your comment was removed by an administrator for content moderation.",
        link: `/posts/${postId}`,
        entityId: null,
        entityType: "System",
      });
    } catch (e) {
      logger.warn(`[AUDIT/NOTIF ERROR] ${e.message}`);
    }
  }

  return updatedPost;
};


export const toggleUpvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleUpvote(postId, userId);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }

  // Trigger notification if newly upvoted
  const isUpvoted = updatedPost.upvotes?.some(
    (id) => (id._id || id).toString() === userId.toString()
  );
  if (isUpvoted) {
    const postAuthorId = (updatedPost.userId?._id || updatedPost.userId)?.toString();
    if (postAuthorId && postAuthorId !== userId.toString()) {
      import("./notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: postAuthorId,
            sender: userId,
            type: "POST_LIKE",
            title: "New Upvote on Post",
            message: "Someone upvoted your post",
            link: `/posts/${postId}`,
            entityId: postId,
            entityType: "Post",
          });
        })
        .catch(() => {});
    }
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

  // Trigger notification to post author
  const postAuthorId = (updatedPost.userId?._id || updatedPost.userId)?.toString();
  if (postAuthorId && postAuthorId !== userId.toString()) {
    import("./notification.service.js")
      .then(({ createAndPushNotification }) => {
        createAndPushNotification({
          recipient: postAuthorId,
          sender: userId,
          type: "POST_COMMENT",
          title: "New Comment on Your Post",
          message: `Someone commented: "${text.trim().slice(0, 80)}"`,
          link: `/posts/${postId}`,
          entityId: postId,
          entityType: "Post",
        });
      })
      .catch(() => {});
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

  // Trigger notification to comment author
  const targetComment = updatedPost.comments?.find(
    (c) => (c._id || c.id)?.toString() === commentId?.toString()
  );
  const commentAuthorId = (targetComment?.userId?._id || targetComment?.userId)?.toString();
  if (commentAuthorId && commentAuthorId !== userId.toString()) {
    import("./notification.service.js")
      .then(({ createAndPushNotification }) => {
        createAndPushNotification({
          recipient: commentAuthorId,
          sender: userId,
          type: "POST_REPLY",
          title: "Reply to Your Comment",
          message: `Someone replied: "${text.trim().slice(0, 80)}"`,
          link: `/posts/${postId}`,
          entityId: postId,
          entityType: "Post",
        });
      })
      .catch(() => {});
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
