import { Question } from "../../models/question.js";
import { User } from "../../models/users.js";
import mongoose from "mongoose";
import { buildFuzzySearchQuery, scoreSearchRelevance, escapeRegex } from "../utils/search.utils.js";

/**
 * Create a new question document.
 */
export const createQuestion = async (questionData) => {
  const question = new Question(questionData);
  return await question.save();
};

/**
 * Find a question by ID, populating author and all answers (with their authors).
 * Also atomically increments the view count.
 */
// A pathological/viral question could accumulate an unbounded number of
// answers (each with its own populated comments); without a ceiling, loading
// that single question detail page would fetch and serialize every one of
// them in a single response. This is a safety valve, not real pagination —
// it's set far above any realistic help-forum thread so normal questions are
// never affected.
const MAX_POPULATED_ANSWERS_PER_QUESTION = 300;

export const findQuestionByIdAndIncrementViews = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return await Question.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  )
    .populate("userId", "username avatar")
    .populate("acceptedAnswers")
    .populate({
      path: "answers",
      populate: [
        { path: "userId", select: "username avatar" },
        { path: "comments.userId", select: "username avatar" },
      ],
      options: { sort: { isAccepted: -1, createdAt: 1 }, perDocumentLimit: MAX_POPULATED_ANSWERS_PER_QUESTION },
    });
};

/**
 * Find a question by ID without incrementing views (for internal use).
 */
export const findQuestionById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return await Question.findById(id)
    .populate("userId", "username avatar")
    .populate("acceptedAnswers")
    .populate({
      path: "answers",
      populate: [
        { path: "userId", select: "username avatar" },
        { path: "comments.userId", select: "username avatar" },
      ],
      options: { perDocumentLimit: MAX_POPULATED_ANSWERS_PER_QUESTION },
    });
};

/**
 * Paginated questions feed with optional Elastic Fuzzy text & username search, category filter, and tag filter.
 * Supports cursor-based pagination using createdAt.
 *
 * @param {object} options
 * @param {string|null} options.cursor     - ISO date string for cursor-based pagination
 * @param {number}      options.limit      - page size
 * @param {string}      options.search     - full-text / fuzzy search string
 * @param {string}      options.filter     - "all" | "unanswered" | "answered" | "popular"
 * @param {string}      options.category   - category name to filter by
 * @param {string}      options.tag        - single tag to filter by
 * @param {string|null} options.userId     - if provided, filters to questions by this user
 */
export const getQuestionsFeed = async ({
  cursor = null,
  limit = 15,
  search = "",
  filter = "all",
  category = "",
  tag = "",
  userId = null,
} = {}) => {
  const baseQuery = {};

  // Category filter
  if (category && category !== "All") {
    baseQuery.category = category;
  }

  // Tag filter
  if (tag) {
    baseQuery.tags = { $in: [tag.toLowerCase()] };
  }

  // Author filter (my questions)
  if (userId) {
    baseQuery.userId = new mongoose.Types.ObjectId(userId);
  }

  // Filter logic
  if (filter === "unanswered") {
    baseQuery.$expr = { $eq: [{ $size: "$answers" }, 0] };
  } else if (filter === "answered") {
    baseQuery.$expr = { $gt: [{ $size: "$answers" }, 0] };
  } else if (filter === "solved") {
    baseQuery.acceptedAnswers = { $exists: true, $not: { $size: 0 } };
  }

  // Cursor pagination
  if (cursor) {
    if (filter === "oldest") {
      baseQuery.createdAt = { $gt: new Date(cursor) };
    } else {
      baseQuery.createdAt = { $lt: new Date(cursor) };
    }
  }

  let sortOrder = { createdAt: -1 };
  if (filter === "oldest") {
    sortOrder = { createdAt: 1 };
  } else if (filter === "popular") {
    sortOrder = { upvotes: -1, createdAt: -1 };
  } else if (filter === "views") {
    sortOrder = { views: -1, createdAt: -1 };
  }

  const hasSearch = search && search.trim();
  let questions = [];

  if (hasSearch) {
    const rawSearch = search.trim();
    const cleanSearchTerm = rawSearch.replace(/^@/, "");

    // 1. Indexed lookup for matching author usernames (max 20)
    let matchedUserIds = [];
    try {
      if (cleanSearchTerm) {
        const matchedUsers = await User.find({
          username: { $regex: escapeRegex(cleanSearchTerm), $options: "i" },
        })
          .select("_id")
          .limit(20)
          .lean();
        matchedUserIds = matchedUsers.map((u) => u._id);
      }
    } catch {
      matchedUserIds = [];
    }

    // Attempt 1: Full-Text search index
    try {
      const textQuery = { ...baseQuery, $text: { $search: rawSearch } };
      questions = await Question.find(textQuery)
        .sort(sortOrder)
        .limit(limit)
        .populate("userId", "username avatar")
        .lean();
    } catch {
      questions = [];
    }

    // Attempt 2: Elastic Fuzzy + Username search fallback if $text yielded 0 results or for username searches
    if (!questions || questions.length === 0 || matchedUserIds.length > 0) {
      const fuzzyCondition = buildFuzzySearchQuery(
        rawSearch,
        ["title", "body", "tags", "category"],
        matchedUserIds
      );
      const fuzzyQuery = fuzzyCondition ? { ...baseQuery, ...fuzzyCondition } : baseQuery;
      const fuzzyQuestions = await Question.find(fuzzyQuery)
        .sort(sortOrder)
        .limit(limit)
        .populate("userId", "username avatar")
        .lean();

      // Deduplicate questions from Attempt 1 & Attempt 2
      const existingIds = new Set(questions.map((q) => q._id.toString()));
      fuzzyQuestions.forEach((q) => {
        if (!existingIds.has(q._id.toString())) {
          questions.push(q);
        }
      });
    }

    // Relevance scoring & ranking across title, tags, category, and username
    questions = scoreSearchRelevance(questions, rawSearch);
  } else {
    questions = await Question.find(baseQuery)
      .sort(sortOrder)
      .limit(limit)
      .populate("userId", "username avatar")
      .lean();
  }

  return questions;
};

/**
 * Toggle upvote or downvote on a question atomically.
 * Removes the opposite vote if present.
 * Returns the updated question.
 */
export const voteQuestion = async (questionId, userId, voteType) => {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const addField = voteType === "upvote" ? "upvotes" : "downvotes";
  const removeField = voteType === "upvote" ? "downvotes" : "upvotes";

  // Check if already voted
  const question = await Question.findById(questionId);
  if (!question) return null;

  const alreadyVoted = question[addField].some((id) => id.equals(userObjId));

  if (alreadyVoted) {
    // Toggle off
    return await Question.findByIdAndUpdate(
      questionId,
      { $pull: { [addField]: userObjId } },
      { new: true }
    ).populate("userId", "username avatar");
  } else {
    // Add vote, remove opposite
    return await Question.findByIdAndUpdate(
      questionId,
      {
        $addToSet: { [addField]: userObjId },
        $pull: { [removeField]: userObjId },
      },
      { new: true }
    ).populate("userId", "username avatar");
  }
};

/**
 * Push an answer ObjectId into the question's answers array.
 */
export const addAnswerToQuestion = async (questionId, answerId) => {
  return await Question.findByIdAndUpdate(
    questionId,
    { $push: { answers: answerId } },
    { new: true }
  );
};

/**
 * Add an answerId to acceptedAnswers array.
 */
export const addAcceptedAnswer = async (questionId, answerId) => {
  return await Question.findByIdAndUpdate(
    questionId,
    { $addToSet: { acceptedAnswers: answerId } },
    { new: true }
  );
};

/**
 * Remove an answerId from acceptedAnswers array.
 */
export const removeAcceptedAnswer = async (questionId, answerId) => {
  return await Question.findByIdAndUpdate(
    questionId,
    { $pull: { acceptedAnswers: answerId } },
    { new: true }
  );
};

/**
 * Delete a question by ID.
 */
export const deleteQuestion = async (id) => {
  return await Question.findByIdAndDelete(id);
};

/**
 * Get distinct tags across all questions (for the tag cloud).
 */
export const getAllTags = async () => {
  return await Question.distinct("tags");
};

/**
 * Get questions grouped by category for stats.
 */
export const getQuestionStats = async () => {
  return await Question.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        unanswered: {
          $sum: { $cond: [{ $eq: [{ $size: "$answers" }, 0] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);
};
