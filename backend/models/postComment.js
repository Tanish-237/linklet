import mongoose from "mongoose";

/**
 * Comments and replies on feed posts, stored in their own collection.
 *
 * They used to be embedded inside the Post document (`post.comments[].replies[]`),
 * which meant every feed load, vote and comment re-read and re-populated every
 * comment on the post, and a viral post would eventually hit MongoDB's 16 MB
 * document limit. As standalone documents they can be paginated and indexed.
 *
 * One flat collection covers both levels:
 *  - top-level comment: `parentId` is null
 *  - reply:             `parentId` is the top-level comment's _id
 * (the UI only ever nests one level, so `parentId` never points at a reply.)
 */
const postCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostComment",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    replyToUsername: {
      type: String,
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Denormalized so listing comments never has to count replies per comment.
    // Only meaningful on top-level comments.
    repliesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Paginated top-level comments of a post, oldest first.
postCommentSchema.index({ postId: 1, parentId: 1, _id: 1 });
// Paginated replies under one comment, oldest first.
postCommentSchema.index({ parentId: 1, _id: 1 });

export const PostComment = mongoose.model("PostComment", postCommentSchema);
