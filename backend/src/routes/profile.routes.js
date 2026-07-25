import express from "express";
import * as profileController from "../controllers/profile.controller.js";
import * as collectionController from "../controllers/collection.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

// Specific routes FIRST (before dynamic /:username parameter routes)
router.get("/me/bookmarks", isLoggedIn, profileController.getMyBookmarks);
router.post("/bookmarks/:resourceId", isLoggedIn, profileController.toggleBookmark);
router.post("/follow/:targetUserId", isLoggedIn, profileController.toggleFollowUser);
router.put("/edit", isLoggedIn, upload.single("avatar"), profileController.updateProfile);

// Collection routes
router.get("/collections", isLoggedIn, collectionController.getUserCollections);
router.post("/collections", isLoggedIn, collectionController.createCollection);
router.get("/collections/:id", isLoggedIn, collectionController.getCollectionById);
router.delete("/collections/:id", isLoggedIn, collectionController.deleteCollection);
router.post("/collections/:id/resources/:resourceId", isLoggedIn, collectionController.toggleResourceInCollection);

// Dynamic username routes SECOND
router.get("/:username/bookmarks", profileController.getUserBookmarks);
router.get("/:username", profileController.getProfile);

export default router;
