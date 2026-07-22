import express from "express";
import * as moderatorController from "../controllers/moderator.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole, requireBranchModerator } from "../middlewares/rbac.js";

const router = express.Router();

router.use(isLoggedIn);
router.use(requireRole(["admin", "moderator"]));

// Get pending queue for the moderator's branch
router.get("/queue", moderatorController.getPendingQueue);

// Verify a resource (Approve or Reject)
// The request body must include the 'branch' of the resource for requireBranchModerator to check
router.patch("/verify/resource/:resourceId", requireBranchModerator, moderatorController.verifyResource);

export default router;
