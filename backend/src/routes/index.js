import express from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import branchRoutes from "./branch.routes.js";
import moderatorRoutes from "./moderator.routes.js";
import postRoutes from "./post.routes.js";
import resourceRoutes from "./resource.routes.js";
import questionRoutes from "./question.routes.js";
import profileRoutes from "./profile.routes.js";
import chatRoutes from "./chat.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import timetableRoutes from "./timetable.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/branches", branchRoutes);
router.use("/moderator", moderatorRoutes);
router.use("/posts", postRoutes);
router.use("/resources", resourceRoutes);
router.use("/questions", questionRoutes);
router.use("/profile", profileRoutes);
router.use("/chat", chatRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/timetable", timetableRoutes);

export default router;

