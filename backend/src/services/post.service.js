import mongoose from "mongoose";
import * as postRepository from "../repositories/post.repository.js";
import * as commentRepository from "../repositories/postComment.repository.js";
import * as postReportRepository from "../repositories/postReport.repository.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { cached, getCacheVersion, bumpCacheVersion } from "../utils/cache.js";

const FEED_CACHE_TTL = 60; // seconds — a backstop; every feed-visible write bumps the version
const FEED_VERSION_KEY = "posts-feed";
const MAX_COMMENT_LENGTH = 2000;

/**
 * Any change a feed card can show (new/deleted post, votes, comment count)
 * invalidates every cached feed page with a single INCR.
 */
const invalidateFeedCache = () => bumpCacheVersion(FEED_VERSION_KEY);

const notifyAsync = (payload) => {
  import("./notification.service.js")
    .then(({ createAndPushNotification }) => createAndPushNotification(payload))
    .catch(() => {});
};

export const createPost = async (userId, postData) => {
  if (!postData.caption && !postData.image) {
    throw new AppError("Please provide a caption or image", 400);
  }

  const post = await postRepository.createPost({
    userId,
    caption: postData.caption || "",
    image: postData.image || "",
    mediaType: postData.mediaType || null,
  });
  await invalidateFeedCache();
  return post;
};

export const getGlobalFeed = async (cursor, limit) => {
  // Clamp so `?limit=999999` can't force an oversized page.
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));

  const load = async () => {
    // Fetch one extra row so `hasMore` is exact instead of guessed.
    const rows = await postRepository.getPostsFeed(cursor, safeLimit + 1);
    const hasMore = rows.length > safeLimit;
    const posts = hasMore ? rows.slice(0, safeLimit) : rows;
    return {
      posts,
      hasMore,
      nextCursor: hasMore ? posts[posts.length - 1].createdAt : null,
    };
  };

  // Only the first page is cached: it's what every student opens, while deeper
  // pages are visited rarely and by few people.
  if (cursor) return load();

  const version = await getCacheVersion(FEED_VERSION_KEY);
  return cached(`posts:feed:v${version}:first:${safeLimit}`, FEED_CACHE_TTL, load);
};

export const getPost = async (postId) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }
  return post;
};

export const getUserPosts = async (userId, { limit, cursor } = {}) => {
  const parsed = parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 12;
  return await postRepository.getPostsByUserId(userId, { limit: safeLimit, cursor });
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
  await invalidateFeedCache();

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

export const updatePost = async (postId, userId, userRole, updateData) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const postAuthorId = (post.userId?._id || post.userId)?.toString();
  if (postAuthorId !== userId.toString() && userRole !== "admin") {
    throw new AppError("You do not have permission to edit this post", 403);
  }

  const caption = typeof updateData.caption === "string" ? updateData.caption.trim() : undefined;
  if (caption === undefined) {
    throw new AppError("Nothing to update", 400);
  }
  if (!caption && !post.image) {
    throw new AppError("Please provide a caption or image", 400);
  }

  const updated = await postRepository.updatePost(postId, { caption, isEdited: true });
  await invalidateFeedCache();
  return updated;
};

export const reportPost = async (postId, userId, reason) => {
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const postAuthorId = (post.userId?._id || post.userId)?.toString();
  if (postAuthorId === userId.toString()) {
    throw new AppError("You cannot report your own post", 400);
  }

  const report = await postReportRepository.createReport({
    reportedBy: userId,
    postId,
    postAuthorId,
    captionSnippet: (post.caption || "").slice(0, 200),
    reason: reason || "Reported by user",
  });
  return report;
};

export const getReportedPosts = async (statusFilter, page, limit) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, parseInt(limit) || 20);
  const skip = (safePage - 1) * safeLimit;
  const status = statusFilter || "pending";

  const { reports, totalDocs } = await postReportRepository.getReports(status, skip, safeLimit);

  return {
    reports,
    pagination: { totalDocs, totalPages: Math.ceil(totalDocs / safeLimit), page: safePage, limit: safeLimit },
  };
};

const POST_REPORT_STATUSES = ["pending", "reviewed", "dismissed"];

export const updatePostReportStatus = async (reportId, status) => {
  if (!mongoose.isValidObjectId(reportId)) {
    throw new AppError("Invalid report id", 400);
  }
  if (!POST_REPORT_STATUSES.includes(status)) {
    throw new AppError(`Status must be one of: ${POST_REPORT_STATUSES.join(", ")}`, 400);
  }
  const report = await postReportRepository.updateReportStatus(reportId, status);
  if (!report) {
    throw new AppError("Report not found", 404);
  }
  return report;
};

export const toggleUpvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleUpvote(postId, userId);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  await invalidateFeedCache();

  // Trigger notification if newly upvoted
  const isUpvoted = updatedPost.upvotes?.some(
    (id) => (id._id || id).toString() === userId.toString()
  );
  if (isUpvoted) {
    const postAuthorId = (updatedPost.userId?._id || updatedPost.userId)?.toString();
    if (postAuthorId && postAuthorId !== userId.toString()) {
      notifyAsync({
        recipient: postAuthorId,
        sender: userId,
        type: "POST_LIKE",
        title: "New Upvote on Post",
        message: "Someone upvoted your post",
        link: `/posts/${postId}`,
        entityId: postId,
        entityType: "Post",
      });
    }
  }

  return updatedPost;
};

export const toggleDownvote = async (postId, userId) => {
  const updatedPost = await postRepository.toggleDownvote(postId, userId);
  if (!updatedPost) {
    throw new AppError("Post not found", 404);
  }
  await invalidateFeedCache();
  return updatedPost;
};

// ─── Comments ────────────────────────────────────────────────────────────────

const normalizeCommentText = (text, label) => {
  if (typeof text !== "string" || text.trim() === "") {
    throw new AppError(`${label} text is required`, 400);
  }
  const trimmed = text.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new AppError(`${label} must be ${MAX_COMMENT_LENGTH} characters or fewer`, 400);
  }
  return trimmed;
};

const parsePageSize = (limit, fallback) => Math.min(50, Math.max(1, parseInt(limit) || fallback));

export const getComments = async (postId, cursor, limit) => {
  const post = await postRepository.findPostById(postId);
  if (!post) throw new AppError("Post not found", 404);

  return commentRepository.getPostComments(postId, {
    cursor,
    limit: parsePageSize(limit, commentRepository.COMMENTS_PAGE_SIZE),
  });
};

export const getReplies = async (postId, commentId, cursor, limit) => {
  // Any comment or reply can have its own replies fetched (arbitrary nesting).
  const comment = await commentRepository.findComment(postId, commentId);
  if (!comment) throw new AppError("Comment not found", 404);

  return commentRepository.getCommentReplies(postId, commentId, {
    cursor,
    limit: parsePageSize(limit, commentRepository.REPLIES_PAGE_SIZE),
  });
};

export const addComment = async (postId, userId, text) => {
  const cleanText = normalizeCommentText(text, "Comment");

  const result = await commentRepository.createComment({ postId, userId, text: cleanText });
  if (!result) {
    throw new AppError("Post not found", 404);
  }
  await invalidateFeedCache();

  // Trigger notification to post author
  const postAuthorId = result.postAuthorId?.toString();
  if (postAuthorId && postAuthorId !== userId.toString()) {
    notifyAsync({
      recipient: postAuthorId,
      sender: userId,
      type: "POST_COMMENT",
      title: "New Comment on Your Post",
      message: `Someone commented: "${cleanText.slice(0, 80)}"`,
      link: `/posts/${postId}`,
      entityId: postId,
      entityType: "Post",
    });
  }

  return { comment: result.comment, commentsCount: result.commentsCount };
};

export const addReply = async (postId, commentId, userId, text, replyToUsername) => {
  const cleanText = normalizeCommentText(text, "Reply");

  const result = await commentRepository.createReply({
    postId,
    parentId: commentId,
    userId,
    text: cleanText,
    replyToUsername,
  });
  if (!result) {
    throw new AppError("Post or comment not found", 404);
  }

  // Trigger notification to comment author
  const commentAuthorId = result.parentAuthorId?.toString();
  if (commentAuthorId && commentAuthorId !== userId.toString()) {
    notifyAsync({
      recipient: commentAuthorId,
      sender: userId,
      type: "POST_REPLY",
      title: "Reply to Your Comment",
      message: `Someone replied: "${cleanText.slice(0, 80)}"`,
      link: `/posts/${postId}`,
      entityId: postId,
      entityType: "Post",
    });
  }

  return {
    reply: result.reply,
    repliesCount: result.repliesCount,
    commentsCount: result.commentsCount,
  };
};

export const toggleCommentUpvote = async (postId, commentId, userId) => {
  const comment = await commentRepository.toggleCommentUpvote(postId, commentId, userId);
  if (!comment) {
    throw new AppError("Post or comment not found", 404);
  }
  return comment;
};

export const deleteComment = async (postId, commentId, userId, userRole) => {
  const comment = await commentRepository.findComment(postId, commentId);
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  const commentAuthorId = comment.userId?.toString();

  // Only the comment author or an admin can delete
  if (commentAuthorId !== userId.toString() && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this comment", 403);
  }

  const result = await commentRepository.deleteComment(comment);
  await invalidateFeedCache();

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

  return result;
};
