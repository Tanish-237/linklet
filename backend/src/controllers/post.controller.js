import * as postService from "../services/post.service.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { isSafeHttpUrl } from "../utils/url.utils.js";
import { AppError } from "../utils/error.js";

export const createPost = async (req, res, next) => {
  try {
    let imageUrl = req.body.image || "";
    if (req.file) {
      const uploadResult = await uploadOnCloudinary(req.file.path);
      if (uploadResult) {
        imageUrl = uploadResult.secure_url;
      }
    } else if (imageUrl && !isSafeHttpUrl(imageUrl)) {
      throw new AppError("Image must be a valid http(s) URL", 400);
    }
    const postData = {
      caption: req.body.caption || "",
      image: imageUrl,
    };
    const post = await postService.createPost(req.user._id, postData);
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};

export const getFeed = async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const feedData = await postService.getGlobalFeed(cursor, limit);

    res.status(200).json({
      success: true,
      data: feedData.posts,
      nextCursor: feedData.nextCursor,
      hasMore: feedData.hasMore,
    });
  } catch (error) {
    next(error);
  }
};

export const getPost = async (req, res, next) => {
  try {
    const post = await postService.getPost(req.params.postId);
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    await postService.deletePost(req.params.postId, req.user._id, req.user.role);
    res.status(200).json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUserPosts = async (req, res, next) => {
  try {
    const posts = await postService.getUserPosts(req.params.userId);
    res.status(200).json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
};


export const toggleUpvote = async (req, res, next) => {
  try {
    const post = await postService.toggleUpvote(req.params.postId, req.user._id);
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};

export const toggleDownvote = async (req, res, next) => {
  try {
    const post = await postService.toggleDownvote(req.params.postId, req.user._id);
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const result = await postService.getComments(req.params.postId, cursor, limit);
    res.status(200).json({
      success: true,
      data: result.comments,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    next(error);
  }
};

export const getReplies = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;
    const { cursor, limit } = req.query;
    const result = await postService.getReplies(postId, commentId, cursor, limit);
    res.status(200).json({
      success: true,
      data: result.replies,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { comment, commentsCount } = await postService.addComment(
      req.params.postId,
      req.user._id,
      req.body.text
    );
    res.status(201).json({ success: true, data: comment, commentsCount });
  } catch (error) {
    next(error);
  }
};

export const addReply = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;
    const { text, replyToUsername } = req.body;
    const { reply, repliesCount, commentsCount } = await postService.addReply(
      postId,
      commentId,
      req.user._id,
      text,
      replyToUsername
    );
    res.status(201).json({ success: true, data: reply, repliesCount, commentsCount });
  } catch (error) {
    next(error);
  }
};

export const toggleCommentUpvote = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;
    const comment = await postService.toggleCommentUpvote(postId, commentId, req.user._id);
    res.status(200).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;
    const { deletedIds, commentsCount } = await postService.deleteComment(
      postId,
      commentId,
      req.user._id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: { deletedIds, commentsCount },
    });
  } catch (error) {
    next(error);
  }
};
