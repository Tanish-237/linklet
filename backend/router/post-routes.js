import { Router } from "express";
import { upload } from "../middlewares/multer.js";
import { isLoggedIn } from "../middlewares/isLoggedIn.js";
import {
    createPost,
    getAllPosts,
    getPostById,
    getUserPosts,
    updatePost,
    deletePost,
    toggleUpvote,
} from "../controllers/post-controller.js";

import { addComment, editComment, deleteComment } from "../controllers/comment-controller.js";

const router = Router();

// Post creation and retrieval routes
router.route("/api/posts")
    .post(isLoggedIn, upload.single("image"), createPost)  // Create a new post
    .get(getAllPosts);  // Get all posts

// Post detail routes
router.route("/api/posts/:postId")
    .get(getPostById)  // Get a specific post
    .put(isLoggedIn, upload.single("image"), updatePost)  // Update a post
    .delete(isLoggedIn, deletePost);  // Delete a post

// Get posts by user
router.route("/api/users/:userId/posts")
    .get(getUserPosts);

// Upvote routes
router.route("/api/posts/:postId/upvote")
    .post(isLoggedIn, toggleUpvote);

// Comment routes
router.route("/api/posts/:postId/comments")
    .post(isLoggedIn, addComment);  // Add a comment

router.route("/api/posts/:postId/comments/:commentId")
    .put(isLoggedIn, editComment)  // Edit a comment
    .delete(isLoggedIn, deleteComment);  // Delete a comment

export { router };