import { Post } from "../../models/posts.js";

export const createPost = async (postData) => {
  const post = new Post(postData);
  await post.save();
  return await findPostById(post._id);
};

export const findPostById = async (id) => {
  return await Post.findById(id)
    .populate("userId", "username avatar fullName")
    .populate("comments.userId", "username avatar fullName")
    .populate("comments.replies.userId", "username avatar fullName");
};

/**
 * Fetch posts using cursor-based pagination for high performance at scale.
 * @param {Date} cursor - The createdAt timestamp of the last seen post.
 * @param {Number} limit - Number of posts to fetch.
 */
export const getPostsFeed = async (cursor, limit = 10) => {
  const query = {};

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username avatar fullName")
    .populate("comments.userId", "username avatar fullName")
    .populate("comments.replies.userId", "username avatar fullName")
    .lean();

  return posts;
};

export const updatePost = async (id, updateData) => {
  await Post.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  return await findPostById(id);
};

export const deletePost = async (id) => {
  return await Post.findByIdAndDelete(id);
};

/**
 * Atomic toggle: each branch is a single findOneAndUpdate/findByIdAndUpdate
 * call, so two simultaneous votes from different users (or double-clicks from
 * the same user) can't race on a read-modify-write of the same document and
 * silently drop one of the votes — the classic lost-update bug of loading the
 * full array, splicing it in JS, then `.save()`-ing the whole document back.
 */
export const toggleUpvote = async (postId, userId) => {
  // 1. If already upvoted, toggle it off.
  let post = await Post.findOneAndUpdate(
    { _id: postId, upvotes: userId },
    { $pull: { upvotes: userId } },
    { new: true }
  );

  // 2. Otherwise add the upvote, atomically clearing any downvote (mutual exclusion).
  if (!post) {
    post = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { upvotes: userId }, $pull: { downvotes: userId } },
      { new: true }
    );
  }

  if (!post) return null;
  return await findPostById(postId);
};

export const toggleDownvote = async (postId, userId) => {
  let post = await Post.findOneAndUpdate(
    { _id: postId, downvotes: userId },
    { $pull: { downvotes: userId } },
    { new: true }
  );

  if (!post) {
    post = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { downvotes: userId }, $pull: { upvotes: userId } },
      { new: true }
    );
  }

  if (!post) return null;
  return await findPostById(postId);
};

export const addComment = async (postId, commentData) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.comments.push(commentData);
  await post.save();
  return await findPostById(postId);
};

export const addReply = async (postId, commentId, replyData) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  const comment = post.comments.id(commentId);
  if (!comment) return null;

  comment.replies.push(replyData);
  await post.save();
  return await findPostById(postId);
};

export const toggleCommentUpvote = async (postId, commentId, userId) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  const comment = post.comments.id(commentId);
  if (!comment) return null;

  if (!comment.upvotes) comment.upvotes = [];
  const idx = comment.upvotes.indexOf(userId);
  if (idx === -1) {
    comment.upvotes.push(userId);
  } else {
    comment.upvotes.splice(idx, 1);
  }

  await post.save();
  return await findPostById(postId);
};

export const deleteComment = async (postId, commentId) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.comments.pull(commentId);
  await post.save();
  return await findPostById(postId);
};

export const getPostsByUserId = async (userId) => {
  // This endpoint has no pagination yet (see profile page "posts" tab) — a
  // hard cap at least stops a prolific user's profile from ever loading their
  // entire post history (each with all comments/replies populated) in one query.
  return await Post.find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "username avatar fullName")
    .populate("comments.userId", "username avatar fullName")
    .populate("comments.replies.userId", "username avatar fullName")
    .lean();
};


