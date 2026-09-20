import express from "express";
import * as branchController from "../controllers/branch.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/rbac.js";
import { browserCache } from "../middlewares/cacheControl.js";

const router = express.Router();

// Only Admins can manage branches
router.use(isLoggedIn);

router.get("/", browserCache(300), branchController.getBranches); // Maybe allow all logged-in users to view branches for UI dropdowns

// Restrict mutations to Admin
router.post("/seed-defaults", requireRole(["admin"]), branchController.seedDefaultBranches);
router.post("/", requireRole(["admin"]), branchController.createBranch);
router.put("/:id", requireRole(["admin"]), branchController.updateBranch);
router.delete("/:id", requireRole(["admin"]), branchController.deleteBranch);

export default router;
