import * as postService from "../services/post.service.js";

export const createPost = async (req, res, next) => {
  try {
    const post = await postService.createPost(req.user._id, req.body);
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
      nextCursor: feedData.nextCursor
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

export const toggleUpvote = async (req, res, next) => {
  try {
    const post = await postService.toggleUpvote(req.params.postId, req.user._id);
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const post = await postService.addComment(req.params.postId, req.user._id, req.body.text);
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
};
