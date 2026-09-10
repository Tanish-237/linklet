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

export const toggleUpvote = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  const upvoteIndex = post.upvotes.indexOf(userId);
  if (upvoteIndex === -1) {
    post.upvotes.push(userId); // Add upvote
    // Remove from downvotes if present (mutual exclusion)
    const downvoteIndex = post.downvotes.indexOf(userId);
    if (downvoteIndex !== -1) {
      post.downvotes.splice(downvoteIndex, 1);
    }
  } else {
    post.upvotes.splice(upvoteIndex, 1); // Remove upvote
  }

  await post.save();
  return await findPostById(postId);
};

export const toggleDownvote = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) return null;

  const downvoteIndex = post.downvotes.indexOf(userId);
  if (downvoteIndex === -1) {
    post.downvotes.push(userId); // Add downvote
    // Remove from upvotes if present (mutual exclusion)
    const upvoteIndex = post.upvotes.indexOf(userId);
    if (upvoteIndex !== -1) {
      post.upvotes.splice(upvoteIndex, 1);
    }
  } else {
    post.downvotes.splice(downvoteIndex, 1); // Remove downvote
  }

  await post.save();
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
  return await Post.find({ userId })
    .sort({ createdAt: -1 })
    .populate("userId", "username avatar fullName")
    .populate("comments.userId", "username avatar fullName")
    .populate("comments.replies.userId", "username avatar fullName")
    .lean();
};


