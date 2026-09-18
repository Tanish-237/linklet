import { Answer } from "../../models/answer.js";
import mongoose from "mongoose";

/**
 * Create a new answer document.
 */
export const createAnswer = async (answerData) => {
  const answer = new Answer(answerData);
  const saved = await answer.save();
  // Return populated version
  return await Answer.findById(saved._id).populate("userId", "username avatar");
};

/**
 * Find an answer by ID.
 */
export const findAnswerById = async (answerId) => {
  if (!answerId || !mongoose.Types.ObjectId.isValid(answerId)) return null;
  return await Answer.findById(answerId).populate("userId", "username avatar");
};

/**
 * Toggle upvote or downvote on an answer atomically.
 * Returns the updated answer.
 */
export const voteAnswer = async (answerId, userId, voteType) => {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const addField = voteType === "upvote" ? "upvotes" : "downvotes";
  const removeField = voteType === "upvote" ? "downvotes" : "upvotes";

  const answer = await Answer.findById(answerId);
  if (!answer) return null;

  const alreadyVoted = answer[addField].some((id) => id.equals(userObjId));

  if (alreadyVoted) {
    return await Answer.findByIdAndUpdate(
      answerId,
      { $pull: { [addField]: userObjId } },
      { new: true }
    ).populate("userId", "username avatar");
  } else {
    return await Answer.findByIdAndUpdate(
      answerId,
      {
        $addToSet: { [addField]: userObjId },
        $pull: { [removeField]: userObjId },
      },
      { new: true }
    ).populate("userId", "username avatar");
  }
};

/**
 * Mark an answer as accepted (or unmark if it's already accepted).
 */
export const setAnswerAccepted = async (answerId, isAccepted) => {
  return await Answer.findByIdAndUpdate(
    answerId,
    { isAccepted },
    { new: true }
  ).populate("userId", "username avatar");
};

/**
 * Add an embedded comment to an answer (supports nested replies via parentId).
 * Returns the full updated answer with populated user.
 */
export const addCommentToAnswer = async (answerId, userId, text, parentId = null) => {
  const newComment = {
    userId: new mongoose.Types.ObjectId(userId),
    text,
    parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
    upvotes: [],
    downvotes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updated = await Answer.findByIdAndUpdate(
    answerId,
    { $push: { comments: newComment } },
    { new: true }
  ).populate("userId", "username avatar");

  // Also populate the comment's userId
  await updated.populate("comments.userId", "username avatar");
  return updated;
};

/**
 * Toggle upvote or downvote on an embedded comment atomically.
 */
export const voteCommentOnAnswer = async (answerId, commentId, userId, voteType) => {
  const answer = await Answer.findById(answerId);
  if (!answer) return null;

  const comment = answer.comments.find(
    (c) => (c._id || c).toString() === commentId.toString()
  );
  if (!comment) return null;

  if (!Array.isArray(comment.upvotes)) comment.upvotes = [];
  if (!Array.isArray(comment.downvotes)) comment.downvotes = [];

  const userObjId = new mongoose.Types.ObjectId(userId);
  const userStrId = userId.toString();
  const addField = voteType === "upvote" ? "upvotes" : "downvotes";
  const removeField = voteType === "upvote" ? "downvotes" : "upvotes";

  const alreadyVoted = comment[addField].some(
    (id) => (id._id || id).toString() === userStrId
  );

  if (alreadyVoted) {
    comment[addField] = comment[addField].filter(
      (id) => (id._id || id).toString() !== userStrId
    );
  } else {
    comment[addField].push(userObjId);
    comment[removeField] = comment[removeField].filter(
      (id) => (id._id || id).toString() !== userStrId
    );
  }

  await answer.save();
  const updated = await Answer.findById(answerId)
    .populate("userId", "username avatar")
    .populate("comments.userId", "username avatar");
  return updated;
};

/**
 * Delete an embedded comment and all its child replies from an answer.
 */
export const deleteCommentFromAnswer = async (answerId, commentId) => {
  const answer = await Answer.findById(answerId);
  if (!answer) return null;

  // Find all child comment IDs recursively
  const toDelete = new Set([commentId.toString()]);
  let added = true;
  while (added) {
    added = false;
    answer.comments.forEach((c) => {
      if (c.parentId && toDelete.has(c.parentId.toString()) && !toDelete.has(c._id.toString())) {
        toDelete.add(c._id.toString());
        added = true;
      }
    });
  }

  const deleteIds = Array.from(toDelete).map((id) => new mongoose.Types.ObjectId(id));
  const updated = await Answer.findByIdAndUpdate(
    answerId,
    { $pull: { comments: { _id: { $in: deleteIds } } } },
    { new: true }
  ).populate("userId", "username avatar");

  await updated.populate("comments.userId", "username avatar");
  return updated;
};

/**
 * Delete an answer by ID.
 */
export const deleteAnswer = async (answerId) => {
  return await Answer.findByIdAndDelete(answerId);
};
