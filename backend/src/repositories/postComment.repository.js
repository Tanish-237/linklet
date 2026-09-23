import mongoose from "mongoose";
import { Post } from "../../models/posts.js";
import { PostComment } from "../../models/postComment.js";
// Registers the User model: authors are populated below and Mongoose needs the
// schema registered even when no other module has imported it yet.
import "../../models/users.js";

const AUTHOR_FIELDS = "username avatar fullName";

// How many replies are sent inline under each comment. The rest are fetched on
// demand ("View N more replies"), so one comment with hundreds of replies can
// never bloat the comment list response.
export const REPLY_PREVIEW_LIMIT = 3;
export const COMMENTS_PAGE_SIZE = 20;
export const REPLIES_PAGE_SIZE = 20;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// `Math.max(0, x - 1)` as an update pipeline so a drifted counter can never go negative.
const decrementField = (field) => [
  { $set: { [field]: { $max: [0, { $subtract: [`$${field}`, 1] }] } } },
];

const populateAuthors = (docs) =>
  PostComment.populate(docs, { path: "userId", select: AUTHOR_FIELDS });

/**
 * Paginated top-level comments for a post (oldest first), each with its first
 * few replies attached. Cursor is the `_id` of the last comment already seen.
 */
export const getPostComments = async (postId, { cursor = null, limit = COMMENTS_PAGE_SIZE } = {}) => {
  if (!isValidId(postId)) return { comments: [], hasMore: false, nextCursor: null };

  const match = { postId: toObjectId(postId), parentId: null };
  if (cursor && isValidId(cursor)) match._id = { $gt: toObjectId(cursor) };

  const rows = await PostComment.find(match)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const comments = rows.slice(0, limit);
  if (comments.length === 0) return { comments: [], hasMore: false, nextCursor: null };

  // One round trip for every comment's reply preview (served by the
  // {parentId, _id} index, each sub-pipeline stops after REPLY_PREVIEW_LIMIT).
  const previews = await PostComment.aggregate([
    { $match: { _id: { $in: comments.map((c) => c._id) } } },
    {
      $lookup: {
        from: PostComment.collection.name,
        let: { commentId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$parentId", "$$commentId"] } } },
          { $sort: { _id: 1 } },
          { $limit: REPLY_PREVIEW_LIMIT },
        ],
        as: "replies",
      },
    },
    { $project: { replies: 1 } },
  ]);
  const repliesByComment = new Map(previews.map((p) => [p._id.toString(), p.replies]));

  const withReplies = comments.map((c) => ({
    ...c,
    replies: repliesByComment.get(c._id.toString()) || [],
  }));

  // Populate authors for comments and their inline replies in a single query.
  const flat = withReplies.flatMap((c) => [c, ...c.replies]);
  await populateAuthors(flat);

  return {
    comments: withReplies,
    hasMore,
    nextCursor: hasMore ? comments[comments.length - 1]._id.toString() : null,
  };
};

/** Paginated replies under one comment (oldest first). */
export const getCommentReplies = async (postId, commentId, { cursor = null, limit = REPLIES_PAGE_SIZE } = {}) => {
  if (!isValidId(postId) || !isValidId(commentId)) {
    return { replies: [], hasMore: false, nextCursor: null };
  }

  const match = { postId: toObjectId(postId), parentId: toObjectId(commentId) };
  if (cursor && isValidId(cursor)) match._id = { $gt: toObjectId(cursor) };

  const rows = await PostComment.find(match)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const replies = rows.slice(0, limit);
  await populateAuthors(replies);

  return {
    replies,
    hasMore,
    nextCursor: hasMore ? replies[replies.length - 1]._id.toString() : null,
  };
};

/** Fetch a single comment/reply scoped to its post (used for permission checks). */
export const findComment = async (postId, commentId) => {
  if (!isValidId(postId) || !isValidId(commentId)) return null;
  return PostComment.findOne({ _id: commentId, postId }).lean();
};

/** Increment a post's top-level comment counter and return its author + new count. */
const bumpPostCommentsCount = (postId, delta) =>
  Post.findByIdAndUpdate(postId, { $inc: { commentsCount: delta } }, { new: true })
    .select("userId commentsCount")
    .lean();

export const createComment = async ({ postId, userId, text }) => {
  if (!isValidId(postId)) return null;

  const post = await bumpPostCommentsCount(postId, 1);
  if (!post) return null;

  let created;
  try {
    created = await PostComment.create({ postId, userId, text, parentId: null });
  } catch (err) {
    // Keep the counter honest if the insert itself failed after the bump.
    await Post.findByIdAndUpdate(postId, decrementField("commentsCount"));
    throw err;
  }

  const comment = { ...created.toObject(), replies: [] };
  await populateAuthors(comment);

  return { comment, commentsCount: post.commentsCount, postAuthorId: post.userId };
};

export const createReply = async ({ postId, parentId, userId, text, replyToUsername }) => {
  if (!isValidId(postId) || !isValidId(parentId)) return null;

  // Any comment or reply of THIS post can be replied to (arbitrary nesting
  // depth). The parent's counter is bumped first, atomically, which doubles
  // as the existence check.
  const parent = await PostComment.findOneAndUpdate(
    { _id: parentId, postId },
    { $inc: { repliesCount: 1 } },
    { new: true }
  ).lean();
  if (!parent) return null;

  let created;
  try {
    created = await PostComment.create({
      postId,
      parentId,
      userId,
      text,
      replyToUsername: replyToUsername || null,
    });
  } catch (err) {
    await PostComment.findByIdAndUpdate(parentId, decrementField("repliesCount"));
    throw err;
  }

  const reply = created.toObject();
  await populateAuthors(reply);

  const post = await Post.findById(postId).select("commentsCount").lean();

  return {
    reply,
    parentAuthorId: parent.userId,
    repliesCount: parent.repliesCount,
    commentsCount: post?.commentsCount ?? 0,
  };
};

/**
 * Atomic upvote toggle (same lost-update-safe pattern as post votes): each
 * branch is one findOneAndUpdate, never load-splice-save.
 */
export const toggleCommentUpvote = async (postId, commentId, userId) => {
  if (!isValidId(postId) || !isValidId(commentId)) return null;

  const projection = "postId parentId upvotes";
  let comment = await PostComment.findOneAndUpdate(
    { _id: commentId, postId, upvotes: userId },
    { $pull: { upvotes: userId } },
    { new: true }
  )
    .select(projection)
    .lean();

  if (!comment) {
    comment = await PostComment.findOneAndUpdate(
      { _id: commentId, postId },
      { $addToSet: { upvotes: userId } },
      { new: true }
    )
      .select(projection)
      .lean();
  }

  return comment;
};

/**
 * Every descendant of `commentId` at any depth (its replies, their replies,
 * and so on), via $graphLookup rather than a fixed number of manual
 * one-level queries — the thread can now nest arbitrarily deep.
 */
const findDescendantIds = async (commentId) => {
  const [result] = await PostComment.aggregate([
    { $match: { _id: commentId } },
    {
      $graphLookup: {
        from: PostComment.collection.name,
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentId",
        as: "descendants",
      },
    },
    { $project: { "descendants._id": 1 } },
  ]);
  return (result?.descendants || []).map((d) => d._id);
};

/**
 * Delete a comment and its entire reply subtree (at any depth) and keep the
 * denormalized counters in sync. Returns the ids that were removed.
 */
export const deleteComment = async (comment) => {
  const isReply = Boolean(comment.parentId);
  const descendantIds = await findDescendantIds(comment._id);
  const deletedIds = [comment._id, ...descendantIds];
  await PostComment.deleteMany({ _id: { $in: deletedIds } });

  if (isReply) {
    // Replies never count toward the post's top-level commentsCount — only
    // the immediate parent's direct-children counter needs adjusting.
    await PostComment.findByIdAndUpdate(comment.parentId, decrementField("repliesCount"));
    const post = await Post.findById(comment.postId).select("commentsCount").lean();
    return { deletedIds: deletedIds.map((id) => id.toString()), commentsCount: post?.commentsCount ?? 0 };
  }

  const post = await Post.findByIdAndUpdate(comment.postId, decrementField("commentsCount"), { new: true })
    .select("commentsCount")
    .lean();

  return { deletedIds: deletedIds.map((id) => id.toString()), commentsCount: post?.commentsCount ?? 0 };
};

/** Remove every comment on a post (called when the post itself is deleted). */
export const deleteCommentsByPost = async (postId) => {
  if (!isValidId(postId)) return;
  await PostComment.deleteMany({ postId });
};
