import { Question } from "../../models/question.js";
import { User } from "../../models/users.js";
import mongoose from "mongoose";
import { buildFuzzySearchQuery, scoreSearchRelevance, escapeRegex } from "../utils/search.utils.js";
import { parseFeedCursor, makeOffsetCursor } from "../utils/feedCursor.js";

// Upper bound on how many search matches are ranked per query. Ranking happens
// in memory over this fixed candidate set, so page 1, 2, 3... of one search are
// slices of the SAME ordered list (stable, no duplicates or gaps).
export const SEARCH_CANDIDATE_CAP = 200;
// Unanchored regex scans can be slow on a big collection; never let one run away.
const SEARCH_MAX_TIME_MS = 4000;

const AUTHOR_FIELDS = "username avatar";

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
 * Conditions shared by every feed mode (everything except search text and sort).
 * Written to be index-friendly: `"answers.0": { $exists }` is an ordinary
 * indexable path check, unlike the old `$expr: { $size }` which forced a full
 * collection scan for the "answered"/"unanswered" tabs.
 */
const buildBaseQuery = ({ category, tag, userId, filter }) => {
  const base = {};

  if (category && category !== "All") base.category = category;
  if (tag) base.tags = { $in: [tag.toLowerCase()] };
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    base.userId = new mongoose.Types.ObjectId(userId);
  }

  if (filter === "unanswered") base["answers.0"] = { $exists: false };
  else if (filter === "answered") base["answers.0"] = { $exists: true };
  else if (filter === "solved") base["acceptedAnswers.0"] = { $exists: true };

  return base;
};

/**
 * Paginated questions feed for every NON-search view.
 *
 *  - all / unanswered / answered / solved / oldest → ordered by createdAt, keyset
 *    cursor on createdAt (exact, uses the createdAt index).
 *  - views / popular → ordered by a different key, so they use an OFFSET cursor
 *    (see utils/feedCursor.js for why a date cursor is wrong here).
 *
 * `hasMore` is exact: one extra row is fetched and dropped.
 *
 * @returns {Promise<{ questions: object[], hasMore: boolean, nextCursor: string|null }>}
 */
export const getQuestionsFeed = async ({
  cursor = null,
  limit = 15,
  filter = "all",
  category = "",
  tag = "",
  userId = null,
} = {}) => {
  const base = buildBaseQuery({ category, tag, userId, filter });
  const { offset, date } = parseFeedCursor(cursor);

  // ── Ordered by something other than time: offset paging ───────────────────
  if (filter === "views" || filter === "popular") {
    let rows;
    if (filter === "views") {
      rows = await Question.find(base)
        .sort({ views: -1, createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit + 1)
        .populate("userId", AUTHOR_FIELDS)
        .lean();
    } else {
      // "Popular" = most upvotes. Sorting on the `upvotes` ARRAY (as before)
      // orders by its largest ObjectId, i.e. by who voted — not by how many.
      rows = await Question.aggregate([
        { $match: base },
        { $addFields: { upvoteCount: { $size: { $ifNull: ["$upvotes", []] } } } },
        { $sort: { upvoteCount: -1, createdAt: -1, _id: -1 } },
        { $skip: offset },
        { $limit: limit + 1 },
        { $unset: "upvoteCount" },
      ]);
      await Question.populate(rows, { path: "userId", select: AUTHOR_FIELDS });
    }

    const hasMore = rows.length > limit;
    return {
      questions: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
      nextCursor: hasMore ? makeOffsetCursor(offset + limit) : null,
    };
  }

  // ── Ordered by createdAt: keyset paging ───────────────────────────────────
  const oldestFirst = filter === "oldest";
  const query = { ...base };
  if (date) query.createdAt = oldestFirst ? { $gt: date } : { $lt: date };

  const rows = await Question.find(query)
    .sort({ createdAt: oldestFirst ? 1 : -1 })
    .limit(limit + 1)
    .populate("userId", AUTHOR_FIELDS)
    .lean();

  const hasMore = rows.length > limit;
  const questions = hasMore ? rows.slice(0, limit) : rows;
  return {
    questions,
    hasMore,
    nextCursor: hasMore ? new Date(questions[questions.length - 1].createdAt).toISOString() : null,
  };
};

/**
 * Every question matching a search, ranked by relevance (best first), capped at
 * SEARCH_CANDIDATE_CAP. The caller pages through this list with an offset cursor
 * (and may cache it), so all pages come from one consistent ordering.
 *
 * Strategy: an indexed $text query first; if it finds nothing (typos, partial
 * words) or the user searched an @username, fall back to a fuzzy regex/username
 * query and merge the two.
 */
export const findSearchCandidates = async ({
  search,
  filter = "all",
  category = "",
  tag = "",
  userId = null,
}) => {
  const base = buildBaseQuery({ category, tag, userId, filter });
  const rawSearch = String(search).trim();
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

  // 2. Full-text search index
  let questions = [];
  try {
    questions = await Question.find({ ...base, $text: { $search: rawSearch } })
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .limit(SEARCH_CANDIDATE_CAP)
      .populate("userId", AUTHOR_FIELDS)
      .lean();
  } catch {
    questions = [];
  }

  // 3. Fuzzy + username fallback when $text found nothing, or for @username searches
  if (questions.length === 0 || matchedUserIds.length > 0) {
    const fuzzyCondition = buildFuzzySearchQuery(rawSearch, ["title", "body", "tags", "category"], matchedUserIds);
    const fuzzyQuery = fuzzyCondition ? { ...base, ...fuzzyCondition } : base;
    const fuzzyQuestions = await Question.find(fuzzyQuery)
      .sort({ createdAt: -1 })
      .limit(SEARCH_CANDIDATE_CAP)
      .maxTimeMS(SEARCH_MAX_TIME_MS)
      .populate("userId", AUTHOR_FIELDS)
      .lean();

    const existingIds = new Set(questions.map((q) => q._id.toString()));
    fuzzyQuestions.forEach((q) => {
      if (!existingIds.has(q._id.toString())) questions.push(q);
    });
  }

  // Relevance across title, tags, category and username (ties → newest first).
  // (`score` is Mongo's internal text score; it isn't part of the API shape.)
  return scoreSearchRelevance(questions, rawSearch)
    .slice(0, SEARCH_CANDIDATE_CAP)
    .map(({ score: _textScore, ...question }) => question);
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
