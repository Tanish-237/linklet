import wrapAsync from "../utils/wrapAsync.js";
import { Post } from "../models/posts.js";
import { User } from "../models/users.js";
import apiError from "../utils/apiError.js";
import { postImageUpload } from "../utils/postImageUpload.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

// Create a new post
const createPost = wrapAsync(async (req, res) => {
  const { caption } = req.body;
  const userId = req.user.id;

  if (!caption) {
    throw new apiError(400, "Caption is required");
  }

  // Check if image is uploaded
  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new apiError(400, "Image is required");
  }

  // Upload image to cloudinary
  let imageUrl = await postImageUpload(imageLocalPath);
  if (!imageUrl) {
    throw new apiError(500, "Image upload failed");
  }

  // Create post
  const newPost = await Post.create({
    userId,
    caption,
    image: imageUrl,
  });

  const createdPost = await Post.findById(newPost._id).populate(
    "userId",
    "username avatar"
  ); //include only username and avatar

  res.status(201).json({
    success: true,
    post: createdPost,
  });
});

// Get all posts (with pagination)
const getAllPosts = wrapAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
  };

  const aggregateQuery = Post.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        caption: 1,
        image: 1,
        upvotes: 1,
        comments: 1,
        createdAt: 1,
        "user.username": 1,
        "user.avatar": 1,
      },
    },
  ]);

  const posts = await Post.aggregatePaginate(aggregateQuery, options);

  res.status(200).json({
    success: true,
    posts,
  });
});

// Get a specific post by ID
const getPostById = wrapAsync(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findById(postId)
    .populate("userId", "username avatar")
    .populate("comments.userId", "username avatar");

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  res.status(200).json({
    success: true,
    post,
  });
});

// Get posts by a specific user
const getUserPosts = wrapAsync(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new apiError(400, "Invalid user ID format");
  }

  // Check if user exists
  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw new apiError(404, "User not found");
  }

  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10))),
    sort: { createdAt: -1 },
  };

  const posts = await Post.paginate(
    { userId },
    {
      ...options,
      populate: [
        {
          path: "userId",
          select: "username avatar",
        },
        {
          path: "comments.userId",
          select: "username avatar",
        },
      ],
      select: "-__v", // Exclude version key
    }
  );

  //   const posts = await Post.aggregatePaginate(aggregateQuery, options);

  res.status(200).json({
    success: true,
    posts: {
      ...posts,
      docs: posts.docs.map((post) => ({
        ...post.toObject(),
        comments: post.comments || [], // Ensure comments exists
      })),
    },
  });
});

// Update a post
const updatePost = wrapAsync(async (req, res) => {
  const { postId } = req.params;
  const { caption } = req.body;
  const userId = req.user.id;

  const post = await Post.findById(postId);

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  // Check if user is the owner of the post
  if (post.userId.toString() !== userId) {
    throw new apiError(403, "You don't have permission to update this post");
  }

  // Update the caption if provided
  if (caption) {
    post.caption = caption;
  }

  // Check if new image is provided
  const imageLocalPath = req.file?.path;
  if (imageLocalPath) {
    // Delete old image from cloudinary if exists
    if (post.image) {
      const publicId = post.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`posts/${publicId}`);
    }

    // Upload new image
    const newImageUrl = await postImageUpload(imageLocalPath);
    if (!newImageUrl) {
      throw new apiError(500, "Image upload failed");
    }

    post.image = newImageUrl;
  }

  await post.save();

  const updatedPost = await Post.findById(postId).populate(
    "userId",
    "username avatar"
  );

  res.status(200).json({
    success: true,
    post: updatedPost,
  });
});

// Delete a post
const deletePost = wrapAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const post = await Post.findById(postId);

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  // Check if user is the owner of the post
  if (post.userId.toString() !== userId) {
    throw new apiError(403, "You don't have permission to delete this post");
  }

  // Delete image from cloudinary
  if (post.image) {
    const publicId = post.image.split("/").pop().split(".")[0];
    await cloudinary.uploader.destroy(`posts/${publicId}`);
  }

  await Post.findByIdAndDelete(postId);

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

// Add/remove upvote to a post
const toggleUpvote = wrapAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const post = await Post.findById(postId);

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  // Check if user already upvoted the post
  const upvoteIndex = post.upvotes.indexOf(userId);

  if (upvoteIndex === -1) {
    // Add upvote
    post.upvotes.push(userId);
  } else {
    // Remove upvote
    post.upvotes.splice(upvoteIndex, 1);
  }

  await post.save();

  res.status(200).json({
    success: true,
    upvoted: upvoteIndex === -1,
    upvotes: post.upvotes.length,
  });
});

// Add a comment to a post
const addComment = wrapAsync(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content) {
    throw new apiError(400, "Comment content is required");
  }

  const post = await Post.findById(postId);

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  const comment = {
    userId,
    content,
  };

  post.comments.push(comment);

  await post.save();

  // Get the updated post with populated comments
  const updatedPost = await Post.findById(postId)
    .populate("userId", "username avatar")
    .populate("comments.userId", "username avatar");

  res.status(201).json({
    success: true,
    post: updatedPost,
  });
});

// Delete a comment
const deleteComment = wrapAsync(async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  const post = await Post.findById(postId);

  if (!post) {
    throw new apiError(404, "Post not found");
  }

  // Find the comment
  const comment = post.comments.id(commentId);

  if (!comment) {
    throw new apiError(404, "Comment not found");
  }

  // Check if user is the owner of the comment or the post
  if (
    comment.userId.toString() !== userId &&
    post.userId.toString() !== userId
  ) {
    throw new apiError(403, "You don't have permission to delete this comment");
  }

  // Remove the comment
  post.comments.pull(commentId);

  await post.save();

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});

export {
  createPost,
  getAllPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  toggleUpvote,
  addComment,
  deleteComment,
};
