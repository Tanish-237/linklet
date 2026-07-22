import express from "express";
import * as postController from "../controllers/post.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/feed", postController.getFeed);
router.get("/:postId", postController.getPost);

router.post("/", isLoggedIn, postController.createPost);
router.delete("/:postId", isLoggedIn, postController.deletePost);

router.post("/:postId/upvote", isLoggedIn, postController.toggleUpvote);
router.post("/:postId/comment", isLoggedIn, postController.addComment);

export default router;
