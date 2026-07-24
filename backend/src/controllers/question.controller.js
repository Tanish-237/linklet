import * as questionService from "../services/question.service.js";
import { QUESTION_CATEGORIES, SUGGESTED_TAGS } from "../../models/question.js";

// ──────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ──────────────────────────────────────────────────────────────────────────────

export const createQuestion = async (req, res, next) => {
  try {
    const question = await questionService.createQuestion(req.user._id, req.body);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
};

export const getQuestions = async (req, res, next) => {
  try {
    const result = await questionService.getQuestionsFeed(req.query);
    res.status(200).json({
      success: true,
      data: result.questions,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    next(error);
  }
};

export const getQuestion = async (req, res, next) => {
  try {
    const question = await questionService.getQuestion(req.params.questionId);
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
};

export const voteQuestion = async (req, res, next) => {
  try {
    const { voteType } = req.body;
    const result = await questionService.voteQuestion(
      req.params.questionId,
      req.user._id,
      voteType
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req, res, next) => {
  try {
    await questionService.deleteQuestion(
      req.params.questionId,
      req.user._id,
      req.user.role
    );
    res.status(200).json({ success: true, message: "Question deleted" });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ANSWERS
// ──────────────────────────────────────────────────────────────────────────────

export const postAnswer = async (req, res, next) => {
  try {
    const answer = await questionService.postAnswer(
      req.params.questionId,
      req.user._id,
      req.body.body
    );
    res.status(201).json({ success: true, data: answer });
  } catch (error) {
    next(error);
  }
};

export const voteAnswer = async (req, res, next) => {
  try {
    const { voteType } = req.body;
    const result = await questionService.voteAnswer(
      req.params.questionId,
      req.params.answerId,
      req.user._id,
      voteType
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const acceptAnswer = async (req, res, next) => {
  try {
    const result = await questionService.acceptAnswer(
      req.params.questionId,
      req.params.answerId,
      req.user._id
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteAnswer = async (req, res, next) => {
  try {
    await questionService.deleteAnswer(
      req.params.questionId,
      req.params.answerId,
      req.user._id,
      req.user.role
    );
    res.status(200).json({ success: true, message: "Answer deleted" });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────────────────────

export const addComment = async (req, res, next) => {
  try {
    const updated = await questionService.addComment(
      req.params.questionId,
      req.params.answerId,
      req.user._id,
      req.body.text,
      req.body.parentId || null
    );
    res.status(201).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const voteComment = async (req, res, next) => {
  try {
    const { voteType } = req.body;
    const updated = await questionService.voteComment(
      req.params.questionId,
      req.params.answerId,
      req.params.commentId,
      req.user._id,
      voteType
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const updated = await questionService.deleteComment(
      req.params.questionId,
      req.params.answerId,
      req.params.commentId,
      req.user._id,
      req.user.role
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// METADATA
// ──────────────────────────────────────────────────────────────────────────────

export const getTagCloud = async (req, res, next) => {
  try {
    const tags = await questionService.getTagCloud();
    res.status(200).json({ success: true, data: tags });
  } catch (error) {
    next(error);
  }
};

export const getForumStats = async (req, res, next) => {
  try {
    const stats = await questionService.getForumStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getMetadata = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        categories: QUESTION_CATEGORIES,
        suggestedTags: SUGGESTED_TAGS,
      },
    });
  } catch (error) {
    next(error);
  }
};
