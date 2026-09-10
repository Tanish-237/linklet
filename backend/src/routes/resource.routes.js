import express from "express";
import * as resourceController from "../controllers/resource.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { documentUploadMiddleware } from "../middlewares/multer.middleware.js";

const router = express.Router();

// All resource routes require authentication (no guest access to library/global-search)
router.use(isLoggedIn);

router.get("/library", resourceController.getLibrary);
router.get("/:id", resourceController.getResourceById);
router.patch("/:id/download", resourceController.incrementDownload);
router.post("/", documentUploadMiddleware.single("document"), resourceController.createResource);
router.delete("/:resourceId", resourceController.deleteResource);

export default router;
