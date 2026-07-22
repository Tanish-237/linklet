import express from "express";
import * as questionController from "../controllers/question.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(isLoggedIn);

router.post("/", questionController.createQuestion);
router.get("/feed", questionController.getQuestions);
router.get("/:questionId", questionController.getQuestion);

export default router;
