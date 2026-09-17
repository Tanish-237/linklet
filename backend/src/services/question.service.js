import * as questionRepository from "../repositories/question.repository.js";
import * as answerRepository from "../repositories/answer.repository.js";
import { Answer } from "../../models/answer.js";
import { Question } from "../../models/question.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { QUESTION_CATEGORIES } from "../../models/question.js";
import mongoose from "mongoose";

/**
 * Create a new question.
 */
export const createQuestion = async (userId, questionData) => {
  const { title, body, category, tags } = questionData;

  if (!title || !title.trim()) throw new AppError("Title is required", 400);

  // Validate category
  const resolvedCategory =
    category && QUESTION_CATEGORIES.includes(category) ? category : "General";

  // Parse tags: accept comma-separated string or array
  let parsedTags = [];
  if (Array.isArray(tags)) {
    parsedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  } else if (typeof tags === "string" && tags.trim()) {
    parsedTags = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  // Limit to 10 tags, max 30 chars each
  parsedTags = parsedTags.slice(0, 10).map((t) => t.slice(0, 30));

  return await questionRepository.createQuestion({
    userId,
    title: title.trim(),
    body: body ? body.trim() : "",
    category: resolvedCategory,
    tags: parsedTags,
  });
};

/**
 * Get paginated questions feed with full filtering support.
 */
export const getQuestionsFeed = async (queryParams) => {
  const {
    cursor,
    limit,
    search,
    filter,
    category,
    tag,
    userId: authorId,
  } = queryParams;

  const questions = await questionRepository.getQuestionsFeed({
    cursor: cursor || null,
    limit: Math.min(parseInt(limit) || 15, 50),
    search: search || "",
    filter: filter || "all",
    category: category || "",
    tag: tag || "",
    userId: authorId || null,
  });

  const nextCursor =
    questions.length > 0
      ? questions[questions.length - 1].createdAt
      : null;

  return { questions, nextCursor, hasMore: questions.length === (parseInt(limit) || 15) };
};

/**
 * Get a single question by ID (increments view count).
 */
export const getQuestion = async (questionId) => {
  if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
    throw new AppError("Question not found", 404);
  }
  const question =
    await questionRepository.findQuestionByIdAndIncrementViews(questionId);
  if (!question) throw new AppError("Question not found", 404);
  return question;
};

/**
 * Vote (upvote or downvote) on a question.
 * Users cannot vote on their own question.
 */
export const voteQuestion = async (questionId, userId, voteType) => {
  if (!["upvote", "downvote"].includes(voteType)) {
    throw new AppError("Invalid vote type", 400);
  }

  const question = await questionRepository.findQuestionById(questionId);
  if (!question) throw new AppError("Question not found", 404);

  if (question.userId._id.toString() === userId.toString()) {
    throw new AppError("You cannot vote on your own question", 403);
  }

  const updated = await questionRepository.voteQuestion(
    questionId,
    userId,
    voteType
  );

  // Trigger notification if upvoted
  if (voteType === "upvote") {
    const questionAuthorId = (question.userId?._id || question.userId)?.toString();
    if (questionAuthorId && questionAuthorId !== userId.toString()) {
      import("./notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: questionAuthorId,
            sender: userId,
            type: "FORUM_UPVOTE",
            title: "Question Upvoted",
            message: `Someone upvoted your question: "${question.title.slice(0, 50)}"`,
            link: `/dashboard/question/${questionId}`,
            entityId: questionId,
            entityType: "Question",
          });
        })
        .catch(() => {});
    }
  }

  return {
    upvotes: updated.upvotes.length,
    downvotes: updated.downvotes.length,
    userVote: updated.upvotes.some((id) => id.toString() === userId.toString())
      ? "upvote"
      : updated.downvotes.some((id) => id.toString() === userId.toString())
      ? "downvote"
      : null,
  };
};

/**
 * Post an answer to a question.
 */
export const postAnswer = async (questionId, userId, body) => {
  if (!body || !body.trim()) throw new AppError("Answer body is required", 400);

  const question = await questionRepository.findQuestionById(questionId);
  if (!question) throw new AppError("Question not found", 404);
  if (question.isClosed) throw new AppError("This question is closed", 403);

  const answer = await answerRepository.createAnswer({
    questionId,
    userId,
    body: body.trim(),
  });

  await questionRepository.addAnswerToQuestion(questionId, answer._id);

  // Trigger notification to question author
  const questionAuthorId = (question.userId?._id || question.userId)?.toString();
  if (questionAuthorId && questionAuthorId !== userId.toString()) {
    import("./notification.service.js")
      .then(({ createAndPushNotification }) => {
        createAndPushNotification({
          recipient: questionAuthorId,
          sender: userId,
          type: "FORUM_ANSWER",
          title: "New Answer on Your Question",
          message: `Someone answered: "${question.title.slice(0, 60)}"`,
          link: `/dashboard/question/${questionId}`,
          entityId: questionId,
          entityType: "Question",
        });
      })
      .catch(() => {});
  }

  return answer;
};

/**
 * Vote on an answer.
 */
export const voteAnswer = async (questionId, answerId, userId, voteType) => {
  if (!["upvote", "downvote"].includes(voteType)) {
    throw new AppError("Invalid vote type", 400);
  }

  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  // Verify answer belongs to this question
  if (answer.questionId.toString() !== questionId) {
    throw new AppError("Answer does not belong to this question", 400);
  }

  if (answer.userId._id.toString() === userId.toString()) {
    throw new AppError("You cannot vote on your own answer", 403);
  }

  const updated = await answerRepository.voteAnswer(answerId, userId, voteType);

  // Trigger notification if upvoted
  if (voteType === "upvote") {
    const answerAuthorId = (answer.userId?._id || answer.userId)?.toString();
    if (answerAuthorId && answerAuthorId !== userId.toString()) {
      import("./notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: answerAuthorId,
            sender: userId,
            type: "FORUM_UPVOTE",
            title: "Answer Upvoted",
            message: "Someone upvoted your answer in the Help Forum.",
            link: `/dashboard/question/${questionId}`,
            entityId: answerId,
            entityType: "Question",
          });
        })
        .catch(() => {});
    }
  }
  return {
    upvotes: updated.upvotes.length,
    downvotes: updated.downvotes.length,
    userVote: updated.upvotes.some((id) => id.toString() === userId.toString())
      ? "upvote"
      : updated.downvotes.some((id) => id.toString() === userId.toString())
      ? "downvote"
      : null,
  };
};

/**
 * Accept an answer. Only the question author can do this.
 */
export const acceptAnswer = async (questionId, answerId, userId) => {
  const question = await questionRepository.findQuestionById(questionId);
  if (!question) throw new AppError("Question not found", 404);

  if (question.userId._id.toString() !== userId.toString()) {
    throw new AppError("Only the question author can accept an answer", 403);
  }

  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  // Check if answer is currently accepted
  const isCurrentlyAccepted = answer.isAccepted === true;

  if (isCurrentlyAccepted) {
    await questionRepository.removeAcceptedAnswer(questionId, answerId);
    await answerRepository.setAnswerAccepted(answerId, false);
    return { accepted: false };
  } else {
    await questionRepository.addAcceptedAnswer(questionId, answerId);
    await answerRepository.setAnswerAccepted(answerId, true);

    // Trigger notification to answer author
    const answerAuthorId = (answer.userId?._id || answer.userId)?.toString();
    if (answerAuthorId && answerAuthorId !== userId.toString()) {
      import("./notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: answerAuthorId,
            sender: userId,
            type: "FORUM_ACCEPT",
            title: "Answer Accepted!",
            message: `Your answer on "${question.title.slice(0, 60)}" was marked as accepted!`,
            link: `/dashboard/question/${questionId}`,
            entityId: questionId,
            entityType: "Question",
          });
        })
        .catch(() => {});
    }

    return { accepted: true };
  }
};

/**
 * Add a comment to an answer.
 */
export const addComment = async (questionId, answerId, userId, text, parentId = null) => {
  if (!text || !text.trim()) throw new AppError("Comment text is required", 400);
  if (text.trim().length > 1000)
    throw new AppError("Comment must be 1000 characters or less", 400);

  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  if (answer.questionId.toString() !== questionId) {
    throw new AppError("Answer does not belong to this question", 400);
  }

  if (parentId) {
    const parentComment = answer.comments.find(
      (c) => (c._id || c).toString() === parentId.toString()
    );
    if (!parentComment) throw new AppError("Parent comment not found", 404);
  }

  const updated = await answerRepository.addCommentToAnswer(
    answerId,
    userId,
    text.trim(),
    parentId
  );

  // Trigger notification to answer author
  const answerAuthorId = (answer.userId?._id || answer.userId)?.toString();
  if (answerAuthorId && answerAuthorId !== userId.toString()) {
    import("./notification.service.js")
      .then(({ createAndPushNotification }) => {
        createAndPushNotification({
          recipient: answerAuthorId,
          sender: userId,
          type: "FORUM_COMMENT",
          title: "New Reply on Your Answer",
          message: `Someone replied: "${text.trim().slice(0, 60)}"`,
          link: `/dashboard/question/${questionId}`,
          entityId: questionId,
          entityType: "Question",
        });
      })
      .catch(() => {});
  }

  // If this is a nested reply to a specific sub-comment, notify the parent comment author
  if (parentId) {
    const parentComment = answer.comments.find(
      (c) => (c._id || c).toString() === parentId.toString()
    );
    const parentAuthorId = (parentComment?.userId?._id || parentComment?.userId)?.toString();
    if (
      parentAuthorId &&
      parentAuthorId !== userId.toString() &&
      parentAuthorId !== answerAuthorId
    ) {
      import("./notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: parentAuthorId,
            sender: userId,
            type: "FORUM_COMMENT",
            title: "Reply to Your Comment",
            message: `Someone replied to your comment: "${text.trim().slice(0, 60)}"`,
            link: `/dashboard/question/${questionId}`,
            entityId: questionId,
            entityType: "Question",
          });
        })
        .catch(() => {});
    }
  }

  return updated;
};

/**
 * Toggle upvote/downvote on a comment.
 */
export const voteComment = async (questionId, answerId, commentId, userId, voteType) => {
  if (!["upvote", "downvote"].includes(voteType)) {
    throw new AppError("Invalid vote type", 400);
  }

  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  const comment = answer.comments.find(
    (c) => (c._id || c).toString() === commentId.toString()
  );
  if (!comment) throw new AppError("Comment not found", 404);

  return await answerRepository.voteCommentOnAnswer(
    answerId,
    commentId,
    userId,
    voteType
  );
};

/**
 * Delete a question. Only the question author or admin can delete.
 */
export const deleteQuestion = async (questionId, userId, userRole) => {
  const question = await questionRepository.findQuestionById(questionId);
  if (!question) throw new AppError("Question not found", 404);

  const isOwner = question.userId._id.toString() === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not authorized to delete this question", 403);
  }

  // Delete all associated answers
  await Answer.deleteMany({ questionId });
  await questionRepository.deleteQuestion(questionId);

  if (isAdmin && !isOwner) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_QUESTION",
        targetType: "Question",
        targetId: questionId,
        details: { title: question.title, questionAuthorId: question.userId._id },
      });

      // Send SYSTEM_ALERT notification to question owner
      const { createAndPushNotification } = await import("./notification.service.js");
      await createAndPushNotification({
        recipient: question.userId._id,
        sender: userId,
        type: "SYSTEM_ALERT",
        title: "Content Moderated",
        message: `Your question "${question.title.slice(0, 50)}" was removed by an administrator for content moderation.`,
        link: "/dashboard",
        entityId: null,
        entityType: "System",
      });
    } catch (e) {
      logger.warn(`[AUDIT/NOTIF ERROR] ${e.message}`);
    }
  }
};

/**
 * Delete an answer. Only the answer author or admin can delete.
 */
export const deleteAnswer = async (questionId, answerId, userId, userRole) => {
  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  const isOwner = answer.userId._id.toString() === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not authorized to delete this answer", 403);
  }

  await answerRepository.deleteAnswer(answerId);

  // Remove from question's answers array
  await Question.findByIdAndUpdate(questionId, {
    $pull: { answers: answer._id },
  });

  if (isAdmin && !isOwner) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_ANSWER",
        targetType: "Answer",
        targetId: answerId,
        details: { questionId, answerAuthorId: answer.userId._id },
      });
    } catch (e) {
      logger.warn(`[AUDIT LOG ERROR] ${e.message}`);
    }
  }
};

/**
 * Delete a comment. Only the comment author or admin can delete.
 */
export const deleteComment = async (questionId, answerId, commentId, userId, userRole) => {
  const answer = await answerRepository.findAnswerById(answerId);
  if (!answer) throw new AppError("Answer not found", 404);

  const comment = answer.comments.find(
    (c) => (c._id || c).toString() === commentId.toString()
  );
  if (!comment) throw new AppError("Comment not found", 404);

  const commentAuthorId = (comment.userId._id || comment.userId).toString();
  const isOwner = commentAuthorId === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not authorized to delete this comment", 403);
  }

  const result = await answerRepository.deleteCommentFromAnswer(answerId, commentId);

  if (isAdmin && !isOwner) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_COMMENT",
        targetType: "Comment",
        targetId: commentId,
        details: { questionId, answerId, commentAuthorId },
      });
    } catch (e) {
      logger.warn(`[AUDIT LOG ERROR] ${e.message}`);
    }
  }

  return result;
};

/**
 * Get tag cloud — all distinct tags used across questions.
 */
export const getTagCloud = async () => {
  return await questionRepository.getAllTags();
};

/**
 * Get forum stats grouped by category.
 */
export const getForumStats = async () => {
  return await questionRepository.getQuestionStats();
};
