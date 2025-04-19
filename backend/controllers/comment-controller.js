import { Post } from "../models/posts.js";
import apiError  from "../utils/apiError.js";
import wrapAsync  from "../utils/wrapAsync.js";

// Add a comment
const addComment = wrapAsync(async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  const userId = req.user.id;

  const post = await Post.findById(postId);
  if (!post) throw new apiError(404, "Post not found");

  post.comments.push({ userId, text });
  await post.save();

  res.status(201).json({ success: true, message: "Comment added", post });
});

// Edit a comment
const editComment = wrapAsync(async (req, res) => {
  const { postId, commentId } = req.params;
  const { text } = req.body;
  const userId = req.user.id;

  const post = await Post.findById(postId);
  if (!post) throw new apiError(404, "Post not found");

  const comment = post.comments.id(commentId);
  if (!comment) throw new apiError(404, "Comment not found");
  if (comment.userId.toString() !== userId)
    throw new apiError(403, "Unauthorized");

  comment.text = text;
  await post.save();

  res.json({ success: true, message: "Comment edited", post });
});

// Delete a comment
const deleteComment = wrapAsync(async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  const post = await Post.findById(postId);
  if (!post) throw new apiError(404, "Post not found");

  const comment = post.comments.id(commentId);
  if (!comment) throw new apiError(404, "Comment not found");

  if (comment.userId.toString() !== userId && post.userId.toString() !== userId)
    throw new apiError(403, "Unauthorized");

  comment.remove();
  await post.save();

  res.json({ success: true, message: "Comment deleted", post });
});

// Add reply to comment
const addReply = wrapAsync(async (req, res) => {
  const { postId, commentId } = req.params;
  const { text } = req.body;
  const userId = req.user.id;

  const post = await Post.findById(postId);
  const comment = post.comments.id(commentId);
  if (!comment) throw new apiError(404, "Comment not found");

  comment.replies.push({ userId, text });

  await post.save();

  res.status(201).json({ success: true, message: "Reply added", post });
});

export { addComment, editComment, deleteComment };
