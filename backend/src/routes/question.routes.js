import express from "express";
import * as questionController from "../controllers/question.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Public metadata (no auth required)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/metadata", questionController.getMetadata);
router.get("/tags", questionController.getTagCloud);
router.get("/stats", questionController.getForumStats);

// ──────────────────────────────────────────────────────────────────────────────
// All routes below require authentication
// ──────────────────────────────────────────────────────────────────────────────
router.use(isLoggedIn);

// Questions
router.post("/", questionController.createQuestion);
router.get("/feed", questionController.getQuestions);
router.get("/:questionId", questionController.getQuestion);
router.post("/:questionId/vote", questionController.voteQuestion);
router.delete("/:questionId", questionController.deleteQuestion);

// Answers
router.post("/:questionId/answers", questionController.postAnswer);
router.post(
  "/:questionId/answers/:answerId/vote",
  questionController.voteAnswer
);
router.post(
  "/:questionId/answers/:answerId/accept",
  questionController.acceptAnswer
);
router.delete(
  "/:questionId/answers/:answerId",
  questionController.deleteAnswer
);

// Comments (on answers)
router.post(
  "/:questionId/answers/:answerId/comments",
  questionController.addComment
);
router.post(
  "/:questionId/answers/:answerId/comments/:commentId/vote",
  questionController.voteComment
);
router.delete(
  "/:questionId/answers/:answerId/comments/:commentId",
  questionController.deleteComment
);

export default router;
