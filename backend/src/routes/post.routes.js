import express from "express";
import * as postController from "../controllers/post.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/feed", postController.getFeed);
router.get("/user/:userId", postController.getUserPosts);
router.get("/:postId", postController.getPost);

router.post("/", isLoggedIn, upload.single("image"), postController.createPost);
router.delete("/:postId", isLoggedIn, postController.deletePost);

router.post("/:postId/upvote", isLoggedIn, postController.toggleUpvote);
router.post("/:postId/downvote", isLoggedIn, postController.toggleDownvote);
router.post("/:postId/comment", isLoggedIn, postController.addComment);
router.delete("/:postId/comments/:commentId", isLoggedIn, postController.deleteComment);
router.post("/:postId/comments/:commentId/reply", isLoggedIn, postController.addReply);
router.post("/:postId/comments/:commentId/upvote", isLoggedIn, postController.toggleCommentUpvote);

export default router;
