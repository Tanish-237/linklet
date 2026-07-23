import express from "express";
import * as resourceController from "../controllers/resource.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { documentUploadMiddleware } from "../middlewares/multer.middleware.js";

const router = express.Router();

// Public routes
router.get("/library", resourceController.getLibrary);
router.get("/:id", resourceController.getResourceById);
router.patch("/:id/download", resourceController.incrementDownload);

// Protected routes
router.use(isLoggedIn);
router.post("/", documentUploadMiddleware.single("document"), resourceController.createResource);
router.delete("/:resourceId", resourceController.deleteResource);

export default router;
