import express from "express";
import * as postController from "../controllers/post.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/rbac.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/feed", postController.getFeed);
router.get("/user/:userId", postController.getUserPosts);
// Must be registered before the generic "/:postId" route below, or Express
// would match "/reports" itself as a postId.
router
  .route("/reports")
  .get(isLoggedIn, requireRole(["admin"]), postController.getReportedPosts)
  .put(isLoggedIn, requireRole(["admin"]), postController.updatePostReportStatus);
router.get("/:postId", postController.getPost);
router.get("/:postId/comments", postController.getComments);
router.get("/:postId/comments/:commentId/replies", postController.getReplies);

router.post("/", isLoggedIn, upload.single("image"), postController.createPost);
router.patch("/:postId", isLoggedIn, postController.updatePost);
router.delete("/:postId", isLoggedIn, postController.deletePost);
router.post("/:postId/report", isLoggedIn, postController.reportPost);

router.post("/:postId/upvote", isLoggedIn, postController.toggleUpvote);
router.post("/:postId/downvote", isLoggedIn, postController.toggleDownvote);
router.post("/:postId/comment", isLoggedIn, postController.addComment);
router.delete("/:postId/comments/:commentId", isLoggedIn, postController.deleteComment);
router.post("/:postId/comments/:commentId/reply", isLoggedIn, postController.addReply);
router.post("/:postId/comments/:commentId/upvote", isLoggedIn, postController.toggleCommentUpvote);

export default router;
