import express from "express";
import * as resourceController from "../controllers/resource.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/library", resourceController.getLibrary); // Get only approved resources

router.use(isLoggedIn);

router.post("/", resourceController.createResource); // Submit resource (goes to pending)
router.delete("/:resourceId", resourceController.deleteResource);

export default router;
