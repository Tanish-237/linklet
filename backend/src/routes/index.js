import express from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import branchRoutes from "./branch.routes.js";
import moderatorRoutes from "./moderator.routes.js";
import postRoutes from "./post.routes.js";
import resourceRoutes from "./resource.routes.js";
import questionRoutes from "./question.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/branches", branchRoutes);
router.use("/moderator", moderatorRoutes);
router.use("/posts", postRoutes);
router.use("/resources", resourceRoutes);
router.use("/questions", questionRoutes);

export default router;
