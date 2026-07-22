import express from "express";
import * as adminController from "../controllers/admin.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/rbac.js";

const router = express.Router();

router.use(isLoggedIn, requireRole(["admin"]));

// User Management
router.patch("/users/:userId/role", adminController.promoteUser);

export default router;
