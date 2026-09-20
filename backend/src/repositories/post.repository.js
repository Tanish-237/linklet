import mongoose from "mongoose";
import { Post } from "../../models/posts.js";
import "../../models/users.js"; // registers User for the author populate below
import { deleteCommentsByPost } from "./postComment.repository.js";

const AUTHOR_FIELDS = "username avatar fullName";

// Until scripts/migrate-post-comments.js has run against a database, legacy
// posts still carry the old embedded `comments` array. Excluding it here keeps
// a not-yet-migrated deployment from shipping (or lean()-returning) that
// payload in every feed response.
const LEGACY_EMBEDDED_FIELDS = "-comments";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createPost = async (postData) => {
  const post = new Post(postData);
  await post.save();
  return await findPostById(post._id);
};

export const findPostById = async (id) => {
  if (!isValidId(id)) return null;
  return await Post.findById(id).select(LEGACY_EMBEDDED_FIELDS).populate("userId", AUTHOR_FIELDS);
};

/**
 * Fetch posts using cursor-based pagination for high performance at scale.
 * Comments are NOT loaded here — feed cards only need `commentsCount`.
 * @param {Date} cursor - The createdAt timestamp of the last seen post.
 * @param {Number} limit - Number of posts to fetch.
 */
export const getPostsFeed = async (cursor, limit = 10) => {
  const query = {};

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  return await Post.find(query)
    .select(LEGACY_EMBEDDED_FIELDS)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", AUTHOR_FIELDS)
    .lean();
};

export const updatePost = async (id, updateData) => {
  await Post.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  return await findPostById(id);
};

export const deletePost = async (id) => {
  const deleted = await Post.findByIdAndDelete(id);
  // Comments are separate documents now, so they no longer vanish with the post.
  if (deleted) await deleteCommentsByPost(id);
  return deleted;
};

/**
 * Atomic toggle: each branch is a single findOneAndUpdate/findByIdAndUpdate
 * call, so two simultaneous votes from different users (or double-clicks from
 * the same user) can't race on a read-modify-write of the same document and
 * silently drop one of the votes — the classic lost-update bug of loading the
 * full array, splicing it in JS, then `.save()`-ing the whole document back.
 */
const toggleVote = async (postId, userId, addField, removeField) => {
  if (!isValidId(postId)) return null;

  // 1. Already voted this way → toggle it off.
  let post = await Post.findOneAndUpdate(
    { _id: postId, [addField]: userId },
    { $pull: { [addField]: userId } },
    { new: true }
  )
    .select(LEGACY_EMBEDDED_FIELDS)
    .populate("userId", AUTHOR_FIELDS);

  // 2. Otherwise add the vote, atomically clearing the opposite one (mutual exclusion).
  if (!post) {
    post = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { [addField]: userId }, $pull: { [removeField]: userId } },
      { new: true }
    )
      .select(LEGACY_EMBEDDED_FIELDS)
      .populate("userId", AUTHOR_FIELDS);
  }

  return post || null;
};

export const toggleUpvote = (postId, userId) => toggleVote(postId, userId, "upvotes", "downvotes");

export const toggleDownvote = (postId, userId) => toggleVote(postId, userId, "downvotes", "upvotes");

export const getPostsByUserId = async (userId) => {
  if (!isValidId(userId)) return [];
  // This endpoint has no pagination yet (see profile page "posts" tab) — a
  // hard cap at least stops a prolific user's profile from ever loading their
  // entire post history in one query.
  return await Post.find({ userId })
    .select(LEGACY_EMBEDDED_FIELDS)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", AUTHOR_FIELDS)
    .lean();
};
