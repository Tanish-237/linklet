import express from "express";
import * as resourceController from "../controllers/resource.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { documentUploadMiddleware } from "../middlewares/multer.middleware.js";
import { acceptDirectUploads } from "../middlewares/directUpload.middleware.js";

const router = express.Router();

// All resource routes require authentication (no guest access to library/resource-hub)
router.use(isLoggedIn);

router.get("/library", resourceController.getLibrary);
router.get("/subjects", resourceController.getSubjects);
router.get("/:id", resourceController.getResourceById);
router.patch("/:id/download", resourceController.incrementDownload);
router.post("/", documentUploadMiddleware.single("document"), acceptDirectUploads("document"), resourceController.createResource);
router.delete("/:resourceId", resourceController.deleteResource);

export default router;
