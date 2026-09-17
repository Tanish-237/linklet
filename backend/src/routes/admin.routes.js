import express from "express";
import * as adminController from "../controllers/admin.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/rbac.js";

const router = express.Router();

router.use(isLoggedIn, requireRole(["admin"]));

// Platform Analytics & Metrics
router.get("/stats", adminController.getStats);

// User Directory & Role/Ban Management
router.get("/users", adminController.getUsers);
router.patch("/users/:userId/role", adminController.promoteUser);
router.patch("/users/:userId/ban", adminController.setUserBanStatus);

// Platform Content Moderation & Oversight
router.get("/content-overview", adminController.getContentOverview);
router.patch("/resources/:resourceId/verify", adminController.setResourceVerification);

// Platform Security & Audit Trail
router.get("/audit-logs", adminController.getAuditLogs);

export default router;
