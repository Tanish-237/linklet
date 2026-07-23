import express from "express";
import * as profileController from "../controllers/profile.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/:username", profileController.getProfile);
router.put("/edit", isLoggedIn, upload.single("avatar"), profileController.updateProfile);

export default router;
